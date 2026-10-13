const PATTERNS = Object.freeze([
  {
    name: 'T1048-처음-보는-목적지-대용량-자료-전송',
    condition: '처음 보는 목적지 IP로 짧은 시간 내 다량의 파일이나 대용량 바이트가 연속 반복 전송되거나 비인가 포트로 자료가 유출되는 경우',
    rationale: 'MITRE ATT&CK T1048(Exfiltration Over Alternative Protocol): 기본 네트워크 통로 외의 다른 프로토콜이나 미승인 목적지로 대량의 민감 자료를 외부로 유출하려는 공격'
  },
  {
    name: 'T1048-업무-시간-외-압축-파일-외부-반출',
    condition: '정규 수업 및 업무 시간 외 시각에 압축 파일이 생성되어 처음 보는 외부 주소로 복수 전송되거나 분산 반출되는 경우',
    rationale: 'MITRE ATT&CK T1048(Exfiltration Over Alternative Protocol): 감시가 소홀한 야간이나 비업무 시간대를 노려 사전에 압축된 기밀 파일 묶음을 외부로 전송하려는 공격'
  },
  {
    name: 'T1041-명령-통로-기반-대용량-파일-유출',
    condition: 'C2 명령 제어 통로 또는 비정상 명령 통신을 통해 대용량 파일 및 자료실 데이터가 처음 보는 목적지로 반복 전송되는 경우',
    rationale: 'MITRE ATT&CK T1041(Exfiltration Over C2 Channel): 기 구축된 악성 명령 제어(C2) 통신 경로를 악용하여 탐지를 우회하며 내부 기밀 자료를 빼돌리려는 공격'
  },
  {
    name: 'T1048-T1041-단발성-소용량-전송-및-수업-자료-동기화-의심',
    condition: '단발성 소용량 파일 전송, 정규 수업 자료 주소 대상 일시적 전송량 증가, 전송 없는 압축 파일 생성 등 공격 여부가 불분명한 경계선 신호인 경우',
    rationale: 'MITRE ATT&CK T1048 / T1041: 실습 백업이나 정상 동기화 작업일 수 있으나 자료 유출 사전 테스트 가능성이 있어 즉시 차단 대신 주의 깊은 모니터링이 필요한 신호'
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
  const isExfiltration = mitre.includes('T1041') || mitre.includes('T1048');

  // 1. 명확한 공격 (심각도 10 이상, T1041 또는 T1048 태그): block (confidence >= 0.85)
  if (level >= 10 && isExfiltration) {
    let matchedPattern = PATTERNS[0];
    if (desc.includes('명령 통로')) {
      matchedPattern = PATTERNS[2];
    } else if (desc.includes('압축 파일') || desc.includes('시간 밖에')) {
      matchedPattern = PATTERNS[1];
    } else {
      matchedPattern = PATTERNS[0];
    }

    const confidence = level >= 12 ? 0.95 : (level >= 11 ? 0.9 : 0.85);

    return {
      action: 'block',
      confidence,
      reason: matchedPattern.name
    };
  }

  // 2. 애매한 시도 (단발성 소용량 전송, 수업 자료 동기화, 압축 파일 생성 등): alert (0.5 <= confidence < 0.85)
  if (isExfiltration && level >= 5) {
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
