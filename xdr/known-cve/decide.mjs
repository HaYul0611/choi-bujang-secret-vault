const PATTERNS = Object.freeze([
  {
    name: 'T1190-CVE-2021-44228-머리글-원격조회-주입',
    condition: '요청 머리글(User-Agent 등)에 Log4Shell 원격 조회 구문(${jndi:...})이 포함되었거나 다수 머리글에 중복 존재하는 경우',
    rationale: 'MITRE ATT&CK T1190(Exploit Public-Facing Application) / CVE-2021-44228: HTTP 요청 머리글에 악성 JNDI 조회 구문을 주입하여 서버의 원격 코드 실행을 유도하는 공격'
  },
  {
    name: 'T1190-CVE-2021-44228-URL인자-원격조회-주입',
    condition: '요청 주소(URL) 인자나 파라미터 내에 Log4Shell 원격 조회 구문(${jndi:...})이 포함되었거나 반복 전송된 경우',
    rationale: 'MITRE ATT&CK T1190(Exploit Public-Facing Application) / CVE-2021-44228: 웹 애플리케이션 입력 파라미터를 통해 악성 JNDI 호출 문자열을 전송하여 원격 페이로드 로드를 시도하는 공격'
  },
  {
    name: 'T1190-CVE-2021-44228-자동화-취약점-점검-도구-악용',
    condition: '알려진 자동화 취약점 점검 도구의 서명 흔적과 함께 CVE-2021-44228 원격 조회 구문이 동일 IP에서 다수 반복 발생한 경우',
    rationale: 'MITRE ATT&CK T1190(Exploit Public-Facing Application) / CVE-2021-44228: 자동화 점검 도구를 사용하여 Log4Shell 취약 서버를 무차별 식별하고 침투를 시도하는 행위'
  },
  {
    name: 'T1190-단순-키워드-검색-및-불완전-구문-의심',
    condition: '단순 CVE 번호 검색, jndi 단어 언급, 잘린 조회 형태, 점검 도구 유사 단어가 포함되었으나 완전한 원격 악용 구문(${jndi:...})은 없는 경우',
    rationale: 'MITRE ATT&CK T1190(Exploit Public-Facing Application): 정상적인 취약점 정보 검색 또는 오입력일 수 있으나 정찰 시도 가능성이 공존하여 추가 모니터링이 필요한 신호'
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
  const desc = String(alert.rule?.description ?? '');
  const mitre = Array.isArray(alert.rule?.mitre) ? alert.rule.mitre : [];
  const isT1190 = mitre.includes('T1190');
  const useragent = String(alert.data?.useragent ?? '');
  const url = String(alert.data?.url ?? '');

  // 1. 명확한 취약점 공격 (심각도 10 이상, T1190 태그, jndi 원격 조회 구문 존재): block (confidence >= 0.85)
  if (level >= 10 && isT1190) {
    let matchedPattern = PATTERNS[0];
    if (desc.includes('점검 흔적') || desc.includes('도구') || desc.includes('반복')) {
      matchedPattern = PATTERNS[2];
    } else if (desc.includes('주소 인자') || url.includes('jndi') || desc.includes('요청 인자')) {
      matchedPattern = PATTERNS[1];
    } else if (desc.includes('머리글') || useragent.includes('jndi')) {
      matchedPattern = PATTERNS[0];
    } else {
      matchedPattern = PATTERNS[0];
    }

    const confidence = level >= 12 ? 0.95 : 0.9;

    return {
      action: 'block',
      confidence,
      reason: matchedPattern.name
    };
  }

  // 2. 애매한 시도 (조회 구문 없는 단순 키워드 검색, 단발성 언급, 잘린 구문): alert (0.5 <= confidence < 0.85)
  if (isT1190 && (level >= 5 || desc.includes('글자만') || desc.includes('단어가') || desc.includes('없습니다'))) {
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
