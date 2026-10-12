const PATTERNS = Object.freeze([
  {
    name: 'T1190-SQL-구문-주입',
    condition: '요청 인자나 URL에 데이터베이스 조회/조작 구문(SQL)을 이어 붙인 시도가 다수 반복 발생한 경우',
    rationale: 'MITRE ATT&CK T1190(Exploit Public-Facing Application): 외부 입력값을 통해 비정상 SQL 쿼리를 삽입하여 데이터베이스 탈취나 조작을 시도하는 공격'
  },
  {
    name: 'T1190-스크립트-명령어-삽입',
    condition: '요청 인자 내에 스크립트 태그, 삽입 표식, 명령 구분자 표기가 반복되거나 번갈아 나타난 경우',
    rationale: 'MITRE ATT&CK T1190(Exploit Public-Facing Application): 웹 입력 폼에 스크립트나 명령 구분자를 밀어 넣어 악성 코드 실행을 유도하는 주입 공격'
  },
  {
    name: 'T1190-경로-거슬러올라가기-탐색',
    condition: '파일 경로 인자에 상위 디렉터리 거슬러 올라가기(../) 표기나 경로 이탈 시도가 다수 반복된 경우',
    rationale: 'MITRE ATT&CK T1190(Exploit Public-Facing Application): 웹 서버의 경로 검증 허점을 노려 비인가 시스템 파일에 접근하려는 디렉터리 경로 탐색 공격'
  },
  {
    name: 'T1190-단발성-특수문자-입력-의심',
    condition: '따옴표, 수업용 키워드(select, script 등), 구분 문자가 1회성으로 포함되었으나 공격 반복이 없는 상태',
    rationale: 'MITRE ATT&CK T1190(Exploit Public-Facing Application): 주입 공격의 초기 탐색 가능성과 정상 사용자의 단순 검색/오입력 가능성이 공존하는 경계선 신호'
  }
]);

export async function decide(alert) {
  if (!alert || typeof alert !== 'object') {
    return {
      action: 'record',
      confidence: 0,
      reason: '알 수 없는 경보 형식'
    };
  }

  const level = Number(alert.rule?.level ?? 0);
  const count = Number(alert.data?.count ?? 0);
  const desc = String(alert.rule?.description ?? '');
  const mitre = Array.isArray(alert.rule?.mitre) ? alert.rule.mitre : [];
  const isT1190 = mitre.includes('T1190');

  // 1. 명확한 주입 공격 (심각도 10 이상 및 T1190 태그, 반복된 시도): block (confidence >= 0.85)
  if (level >= 10 && isT1190) {
    let matchedPattern = PATTERNS[0];
    if (desc.includes('경로') || desc.includes('거슬러') || desc.includes('이탈')) {
      matchedPattern = PATTERNS[2];
    } else if (desc.includes('스크립트') || desc.includes('명령')) {
      matchedPattern = PATTERNS[1];
    } else {
      matchedPattern = PATTERNS[0];
    }

    const confidence = (count >= 12 || level === 12) ? 0.95 : 0.9;

    return {
      action: 'block',
      confidence,
      reason: matchedPattern.name
    };
  }

  // 2. 애매한 시도 (단발성 특수문자, 수업명 조회, 반복 없는 의심 입력): alert (0.5 <= confidence < 0.85)
  if (isT1190 && (level >= 5 || desc.includes('1건') || desc.includes('한 번') || desc.includes('평소보다'))) {
    return {
      action: 'alert',
      confidence: 0.65,
      reason: PATTERNS[3].name
    };
  }

  // 3. 정상 이벤트: record (confidence < 0.5)
  return {
    action: 'record',
    confidence: 0.1,
    reason: '정상 이벤트'
  };
}
