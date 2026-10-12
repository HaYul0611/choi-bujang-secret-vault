// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required']);

/**
 * 엔진이 검증해 넘긴 가상 접속 신호의 출처를 검사합니다.
 * 출처가 불명확하거나 누락된 경우 임의의 기본값(정상값)으로 채우지 않고 null로 유지합니다.
 */
function extractVerifiedSignals(request) {
  const signals = request?.signals;
  if (!signals || typeof signals !== 'object') {
    return null;
  }
  // 엔진이 검증한 공인 가상 접속 출처(judge_fixture)만 신뢰
  if (signals.source !== 'judge_fixture') {
    return null;
  }
  const { region, network, hour } = signals;
  if (typeof region !== 'string' || typeof network !== 'string' || typeof hour !== 'number') {
    return null;
  }
  return { region, network, hour, source: 'judge_fixture' };
}

function extractVerifiedEvents(request) {
  if (!Array.isArray(request?.recentEvents)) {
    return [];
  }
  return request.recentEvents.filter(ev =>
    ev && typeof ev === 'object' && typeof ev.kind === 'string'
    && typeof ev.ageSeconds === 'number' && typeof ev.count === 'number'
  );
}

/**
 * 평소와 다른 시각, 처음 보는 네트워크, 대량 읽기 사건의 복합 이상 여부를 판별합니다.
 * 지역 하나만으로 영구 차단하지 않고 세 가지 이상 신호가 중첩될 때만 추가 확인 대상으로 지정합니다.
 */
function isSuspiciousAccess(signals, events) {
  if (!signals) return false;
  const isUnusualHour = signals.hour < 6 || signals.hour >= 23;
  const isUnusualNetwork = signals.network === 'unusual';
  const hasBurstRead = events.some(ev => ev.kind === 'risk_signal' || ev.count >= 10);

  return isUnusualHour && isUnusualNetwork && hasBurstRead;
}

export async function decide(request) {
  // 1. 기존 기기 규칙: 미등록 기기 또는 사용자 바인딩 실패 즉시 거부
  if (request?.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  if (!request?.subjectId || !request?.deviceId) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_bound',
      ruleIds: ['device_registered'],
    };
  }

  // 2. 엔진이 검증한 접속 정보 및 사건 출처 검사
  const verifiedSignals = extractVerifiedSignals(request);
  const verifiedEvents = extractVerifiedEvents(request);

  // 3. 복합 이상 접속 판정: 추가 인증(step-up) 요구
  if (isSuspiciousAccess(verifiedSignals, verifiedEvents)) {
    const isStepUpVerified = request?.stepUp?.verified === true
      && typeof request?.stepUp?.authAgeSeconds === 'number'
      && request.stepUp.authAgeSeconds <= 900;

    if (!isStepUpVerified) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'step_up',
        reasonCode: 'step_up_required',
        ruleIds: ['step_up_required'],
      };
    }
  }

  // 4. 정상 자료실 읽기 요청 허용
  const isRead = request?.method === 'GET' || request?.method === 'HEAD';
  const isNotesService = !request?.service || request?.service === 'notes';

  if (isRead && isNotesService) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'allow',
      reasonCode: 'approved',
      ruleIds: ['device_registered'],
    };
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'deny',
    reasonCode: 'unauthorized_operation',
    ruleIds: ['device_registered'],
  };
}
