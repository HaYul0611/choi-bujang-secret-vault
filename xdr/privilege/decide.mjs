const PATTERNS = Object.freeze([
  {
    name: 'T1078-비인가-관리자-그룹-추가-및-재등록',
    condition: '원격 주소 또는 처음 보는 위치에서 일반 계정을 관리자 그룹에 추가하거나, 대량 계정 추가, 탈퇴 직후 재등록 등 비정상 그룹 승격이 발생한 경우',
    rationale: 'MITRE ATT&CK T1078(Valid Accounts): 정상 계정 권한을 임의로 최고 관리자 그룹으로 승격시켜 지속적인 시스템 제어 권한을 획득하려는 공격'
  },
  {
    name: 'T1068-비인가-관리자-명령-실행-및-권한-악용',
    condition: '관리자 그룹에 추가된 직후 관리자 명령을 실행하거나, 세션 권한이 관리자로 급변하여 처음 보는 주소에서 특권 명령을 수행하는 경우',
    rationale: 'MITRE ATT&CK T1068(Exploitation for Privilege Escalation): 시스템 취약점이나 구성 결함을 악용하여 획득한 관리자 권한으로 특권 명령을 즉시 수행하는 공격'
  },
  {
    name: 'T1078-T1068-업무-시간-외-원격-권한-남용',
    condition: '수업 및 업무 시간 외 시각에 처음 보는 원격 주소에서 관리자 명령을 실행하거나, 타 계정 권한을 도용하여 특권 명령을 병행 실행하는 경우',
    rationale: 'MITRE ATT&CK T1078 / T1068: 정상 업무 시간대를 벗어난 야간 또는 비인가 원격 환경에서 관리자 권한을 남용하여 감사 추적을 회피하려는 공격'
  },
  {
    name: 'T1078-T1068-단발성-권한-상승-시도-및-일반-그룹-변경-의심',
    condition: '권한 상승 창 취소, 일반 과제 그룹 추가, 명령 수행 없는 단발성 권한 상승, 신규 로컬 그룹 생성 등 악성 여부가 불분명한 경계선 신호인 경우',
    rationale: 'MITRE ATT&CK T1078 / T1068: 정규 실습 활동이나 단순 실수일 수 있으나 권한 상승 사전 탐색 가능성이 있어 추가 주의 관찰이 필요한 신호'
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
  const isPrivilege = mitre.includes('T1068') || mitre.includes('T1078');

  // 1. 명확한 공격 (심각도 10 이상, T1068 또는 T1078 태그): block (confidence >= 0.85)
  if (level >= 10 && isPrivilege) {
    let matchedPattern = PATTERNS[0];
    if (desc.includes('시각') || desc.includes('수업 시간 밖에') || desc.includes('다른 계정')) {
      matchedPattern = PATTERNS[2];
    } else if (desc.includes('관리자 명령') || desc.includes('권한 명령') || desc.includes('명령 실행')) {
      matchedPattern = PATTERNS[1];
    } else if (desc.includes('관리자 그룹')) {
      matchedPattern = PATTERNS[0];
    }

    const confidence = level >= 12 ? 0.95 : (level >= 11 ? 0.9 : 0.85);

    return {
      action: 'block',
      confidence,
      reason: matchedPattern.name
    };
  }

  // 2. 애매한 시도 (수업 과제 그룹 추가, 단발성 권한 상승, 설명 변경 등): alert (0.5 <= confidence < 0.85)
  if (isPrivilege && level >= 5) {
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
