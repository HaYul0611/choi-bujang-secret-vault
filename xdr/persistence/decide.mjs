const PATTERNS = Object.freeze([
  {
    name: 'T1543-서명-없는-신규-서비스-등록-및-변조',
    condition: '서명 없는 신규 서비스 등록, 서비스 실행 파일 경로의 임시 폴더(Temp) 지정 또는 비인가 교체, 원격지에서의 연속 서비스 등록이 발생한 경우',
    rationale: 'MITRE ATT&CK T1543(Create or Modify System Process): 시스템 서비스 또는 데몬을 생성하거나 수정하여 시스템 재부팅 후에도 지속적으로 악성 코드를 자동 실행하려는 공격'
  },
  {
    name: 'T1053-비인가-예약-작업-등록-및-악용',
    condition: '처음 보는 예약 작업이 등록되어 임시 폴더(Temp) 내 실행 파일을 수업 시간 외에 실행하거나, 임의 문자열 이름의 예약 작업이 비정상 경로를 가리키는 경우',
    rationale: 'MITRE ATT&CK T1053(Scheduled Task/Job): 작업 스케줄러를 악용하여 특정 시각이나 주기마다 악성 페이로드가 은밀하게 실행되도록 지속성을 유지하려는 공격'
  },
  {
    name: 'T1543-시작-폴더-비인가-프로그램-추가-및-복합-지속성',
    condition: '사용자 시작 프로그램 폴더(Startup)에 평소 목록에 없는 파일이 추가되었거나, 시작 프로그램과 예약 작업이 동일한 임시 실행 파일을 중복 지목하는 경우',
    rationale: 'MITRE ATT&CK T1543(Create or Modify System Process): 사용자 로그인 시 자동 실행되는 시작 프로그램 목록에 침투하여 영속적 제어 권한을 획득하려는 공격'
  },
  {
    name: 'T1543-T1053-수업-작업-유사-및-단순-설정-변경-의심',
    condition: '수업 과제/도구 명칭과 유사하거나 서명이 확인되지 않은 단일 작업 생성, 서비스 설명 단순 변경, 서비스 등록 없는 임시 실행 파일 생성 등 정규 활동과 혼재된 의심 신호인 경우',
    rationale: 'MITRE ATT&CK T1543 / T1053: 정상적인 관리 또는 실습 작업 형태를 모방하거나 사전 정찰일 수 있어 즉시 차단 대신 주의 깊은 추적이 필요한 모니터링 신호'
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
  const isPersistence = mitre.includes('T1543') || mitre.includes('T1053');

  // 1. 명확한 공격 (심각도 10 이상, T1543 또는 T1053 태그): block (confidence >= 0.85)
  if (level >= 10 && isPersistence) {
    let matchedPattern = PATTERNS[0];
    if (desc.includes('시작 폴더') || desc.includes('시작 프로그램')) {
      matchedPattern = PATTERNS[2];
    } else if (desc.includes('예약 작업')) {
      matchedPattern = PATTERNS[1];
    } else if (desc.includes('서비스')) {
      matchedPattern = PATTERNS[0];
    }

    const confidence = level >= 12 ? 0.95 : (level >= 11 ? 0.9 : 0.85);

    return {
      action: 'block',
      confidence,
      reason: matchedPattern.name
    };
  }

  // 2. 애매한 시도 (수업 과제 유사 명칭, 단순 설명 변경, 실행 없는 파일 생성 등): alert (0.5 <= confidence < 0.85)
  if (isPersistence && level >= 5) {
    return {
      action: 'alert',
      confidence: 0.65,
      reason: PATTERNS[3].name
    };
  }

  // 3. 정상 이벤트 (심각도 3 이하, MITRE 태그 없음): record (confidence < 0.5)
  return {
    action: 'record',
    confidence: 0.1,
    reason: '정상 이벤트'
  };
}
