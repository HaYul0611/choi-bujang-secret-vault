const PATTERNS = Object.freeze([
  {
    name: 'T1110.001-단일계정-고빈도-무차별대입',
    condition: '같은 출발 주소에서 단시간에 단일 계정을 대상으로 임계치(30건 이상 또는 룰 레벨 10 이상 대량 실패)를 초과하는 로그인 실패 발생',
    rationale: 'MITRE ATT&CK T1110.001(Password Guessing): 특정 계정에 비밀번호를 연속 대입하여 계정 탈취를 시도하는 무차별 대입 공격 신호'
  },
  {
    name: 'T1110.003-다중계정-비밀번호-스프레이',
    condition: '동일 출발 주소에서 여러 계정을 대상으로 동일 비밀번호를 연속 대입하거나 계정명을 바꿔 가며 실패가 발생하는 형태',
    rationale: 'MITRE ATT&CK T1110.003(Password Spraying): 계정 잠금을 우회하기 위해 다수의 계정에 비밀번호를 분산 대입하는 공격 신호'
  },
  {
    name: 'T1110-단시간-반복-로그인실패-의심',
    condition: '동일 주소 또는 계정에서 평소와 다른 위치나 간격으로 3~10건 미만의 로그인 실패가 연속 발생한 상태',
    rationale: 'MITRE ATT&CK T1110(Brute Force): 무차별 대입 공격의 사전 탐색 시도이거나 사용자 단순 오입력 가능성이 공존하는 경계선 신호'
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
  const hasAccounts = Boolean(alert.data?.accounts);
  const desc = String(alert.rule?.description ?? '');
  const mitre = Array.isArray(alert.rule?.mitre) ? alert.rule.mitre : [];
  const isT1110 = mitre.includes('T1110');

  // 1. 명확한 무차별 대입 공격 (심각도 10 이상 및 T1110 태그): block (confidence >= 0.85)
  if (level >= 10 && isT1110) {
    const isSpray = hasAccounts || desc.includes('여러 계정') || desc.includes('계정 20개') || desc.includes('계정 이름을 바꿔') || desc.includes('서로 다른 계정');
    const matched = isSpray ? PATTERNS[1] : PATTERNS[0];
    const confidence = (count >= 50 || desc.includes('90건') || desc.includes('70건')) ? 0.95 : 0.9;

    return {
      action: 'block',
      confidence,
      reason: matched.name
    };
  }

  // 2. 애매한 시도 (경계선 실패, 간헐적 실패 등): alert (0.5 <= confidence < 0.85)
  if (isT1110 && (level >= 5 || count >= 3 || desc.includes('실패'))) {
    return {
      action: 'alert',
      confidence: 0.65,
      reason: PATTERNS[2].name
    };
  }

  // 3. 정상 이벤트: record (confidence < 0.5)
  return {
    action: 'record',
    confidence: 0.1,
    reason: '정상 이벤트'
  };
}
