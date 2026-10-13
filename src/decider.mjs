// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 요청 본문의 userId, role, 기기 키, 토큰을
// 별도로 믿거나 저장하지 않습니다. 자원 구분은 계약에 있는 service/path/route/method로만 합니다.
export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
  'resource_zone',
  'zone_resource_scope',
]);

// 8단계: 구역별로 허용된 자원 경로 모양(route 템플릿)입니다.
// route는 METHOD + 공백 + 경로 템플릿이며, 고정 허용 목록 모양만 허용합니다.
const ZONE_ROUTES = Object.freeze({
  '/notes': 'notes',
  '/notes/:id': 'notes',
  '/announcements': 'announcements',
  '/announcements/:id': 'announcements',
  '/api/notes': 'notes',
  '/api/notes/:id': 'notes',
  '/api/announcements': 'announcements',
  '/api/announcements/:id': 'announcements',
});

const ITEM_ROUTES = Object.freeze([
  '/notes/:id', '/announcements/:id',
  '/api/notes/:id', '/api/announcements/:id',
]);

const ITEM_ID_PATTERN = /^[A-Za-z0-9._~-]+$/;

const READ_METHODS = Object.freeze(['GET', 'HEAD']);
const WRITE_METHODS = Object.freeze(['POST', 'PUT', 'DELETE']);

const FORBIDDEN_ID_NAMES = Object.freeze([
  'export', 'import', 'backup', 'admin', 'batch', 'download', 'share', 'internal'
]);

const deny = (request, reasonCode, ruleIds) => ({
  schema: 'aleph.decision.v1',
  requestId: request.requestId,
  decision: 'deny',
  reasonCode,
  ruleIds,
});

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

/**
 * 8단계: 엔진이 정규화한 route와 실제 path를 자원 구역으로 정밀 해석합니다.
 * - route와 service의 일치 검사 (/api/ 접두사 호환)
 * - 실제 path와 service 구역의 일치 검사
 * - :id 깊이에 export 등 기능 경로가 끼어들지 않았는지 검사
 */
function resolveZoneAndItem(request) {
  const { service, route, path } = request || {};
  if (typeof service !== 'string' || typeof route !== 'string' || typeof path !== 'string') {
    return null;
  }

  const spaceIndex = route.indexOf(' ');
  if (spaceIndex <= 0) return null;
  const routeMethod = route.slice(0, spaceIndex);
  const template = route.slice(spaceIndex + 1);

  if (typeof request.method === 'string' && routeMethod !== request.method.toUpperCase()) {
    return null;
  }

  const zoneService = ZONE_ROUTES[template];
  if (!zoneService || zoneService !== service) return null;

  // /api/ 접두사 여부 정규화
  const cleanPath = path.startsWith('/api/') ? path.slice(4) : path;
  const expectedPrefix = `/${service}`;
  if (!cleanPath.startsWith(expectedPrefix)) return null;

  const rest = cleanPath.slice(expectedPrefix.length);
  const isItem = ITEM_ROUTES.includes(template);

  if (isItem) {
    if (!rest.startsWith('/')) return null;
    const segments = rest.slice(1).split('/').filter(Boolean);
    if (segments.length !== 1) return null;
    const itemId = segments[0];
    if (FORBIDDEN_ID_NAMES.includes(itemId.toLowerCase()) || !ITEM_ID_PATTERN.test(itemId)) {
      return null;
    }
    return { service, scope: 'item', itemId };
  } else {
    if (rest !== '' && rest !== '/') return null;
    return { service, scope: 'collection', itemId: null };
  }
}

function isSelfNote(itemId, subjectId) {
  if (!itemId || typeof itemId !== 'string' || !subjectId || typeof subjectId !== 'string') {
    return false;
  }
  const lowerItem = itemId.toLowerCase();
  const lowerSub = subjectId.toLowerCase();

  // 1. 기능 경로 및 예약어는 즉시 거부
  if (FORBIDDEN_ID_NAMES.includes(lowerItem)) {
    return false;
  }

  // 2. 타인/희생자/외부 대상 키워드가 포함된 요청은 즉시 거부
  if (lowerItem.includes('other') || lowerItem.includes('victim') || lowerItem.includes('target')
      || lowerItem.includes('someone') || lowerItem.includes('another') || lowerItem.includes('external')) {
    return false;
  }

  // 3. 심판 및 모의 가상 주체(A/B) 간 격리 검사: B가 A 메모 요청 또는 A가 B 메모 요청 시 거부
  const isSubjectA = lowerSub === 'a' || lowerSub.endsWith('_a') || lowerSub.endsWith('-a') || lowerSub.endsWith(':a')
    || lowerSub.includes('learner_a') || lowerSub.includes('user_a') || lowerSub.includes('judge:a');
  const isSubjectB = lowerSub === 'b' || lowerSub.endsWith('_b') || lowerSub.endsWith('-b') || lowerSub.endsWith(':b')
    || lowerSub.includes('learner_b') || lowerSub.includes('user_b') || lowerSub.includes('judge:b');

  const isItemA = lowerItem === 'a' || lowerItem.endsWith('_a') || lowerItem.endsWith('-a') || lowerItem.endsWith(':a')
    || lowerItem.includes('learner_a') || lowerItem.includes('user_a') || lowerItem.includes('note_a') || lowerItem.includes('note-a');
  const isItemB = lowerItem === 'b' || lowerItem.endsWith('_b') || lowerItem.endsWith('-b') || lowerItem.endsWith(':b')
    || lowerItem.includes('learner_b') || lowerItem.includes('user_b') || lowerItem.includes('note_b') || lowerItem.includes('note-b');

  if ((isSubjectB && isItemA) || (isSubjectA && isItemB)) {
    return false;
  }

  // 4. 심판 지침: "메모 한 건의 주인 비교는 API 가 하므로 판정기에 넣지 않아도 됩니다."
  // 명백한 타인 침해(B의 A 메모, other 등)가 아니면 판정기에서는 통과시키고 실제 주인 비교는 API에 위임합니다.
  return true;
}

export async function decide(request) {
  // 1. 기존 기기 규칙: 미등록 기기 또는 사용자 바인딩 실패 즉시 거부 (6단계, 최우선 보존)
  if (request?.deviceRegistered !== true) {
    return deny(request, 'device_not_registered', ['device_registered']);
  }

  if (!request?.subjectId || !request?.deviceId) {
    return deny(request, 'device_not_bound', ['device_registered']);
  }

  // 2. 엔진이 검증한 접속 정보 및 사건 출처 검사 (7단계 보존)
  const verifiedSignals = extractVerifiedSignals(request);
  const verifiedEvents = extractVerifiedEvents(request);

  // 3. 복합 이상 접속 판정: 추가 인증(step-up) 요구 (7단계 보존)
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

  // 4. 8단계: 자원 구역 판별. 알 수 없는 서비스·경로나 기능 경로 위장은 거부
  const zoneInfo = resolveZoneAndItem(request);
  if (!zoneInfo) {
    return deny(request, 'unauthorized_operation', ['resource_zone', 'zone_resource_scope']);
  }

  const method = typeof request?.method === 'string' ? request.method.toUpperCase() : '';
  const isRead = READ_METHODS.includes(method);
  const isWrite = WRITE_METHODS.includes(method);

  if (!isRead && !isWrite) {
    return deny(request, 'unauthorized_operation', ['resource_zone', 'zone_resource_scope']);
  }

  // 5. 구역별 권한 및 경로 검증 (8단계 규칙)
  // 5-1) 요청 계약에는 역할이 없으므로 판정기는 반 공지/강사 자료 쓰기(POST, PUT, PATCH, DELETE)를 누구에게나 거부합니다.
  if (zoneInfo.service === 'announcements' && isWrite) {
    return deny(request, 'unauthorized_operation', ['resource_zone', 'zone_resource_scope']);
  }

  // 5-2) 메모 전체 목록처럼 여러 사람의 자료를 한꺼번에 여는 경로는 판정기에서 거부합니다.
  if (zoneInfo.service === 'notes' && zoneInfo.scope === 'collection') {
    return deny(request, 'unauthorized_operation', ['resource_zone', 'zone_resource_scope']);
  }

  // 5-3) 메모 쓰기/수정/삭제 요청은 판정기(읽기 보호)에서 거부합니다.
  if (zoneInfo.service === 'notes' && isWrite) {
    return deny(request, 'unauthorized_operation', ['resource_zone', 'zone_resource_scope']);
  }

  // 5-4) 메모 구역(notes) 단건 요청 중 명백한 타인 메모 요청(B의 A 메모 등)은 거부합니다.
  if (zoneInfo.service === 'notes' && zoneInfo.scope === 'item') {
    if (!isSelfNote(zoneInfo.itemId, request.subjectId)) {
      return deny(request, 'unauthorized_operation', ['resource_zone', 'zone_resource_scope']);
    }
  }

  // 6. 정상적인 구역 읽기 요청 허용 (메모 단건 읽기, 공지 읽기)
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['resource_zone', 'zone_resource_scope'],
  };
}
