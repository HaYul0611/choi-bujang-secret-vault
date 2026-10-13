// 9단계: 반 엔진이 검증한 사건에서 필요한 항목(가명 사용자, 기기, 요청 종류, 판정, 네트워크/지역 신호)만 안전하게 읽습니다.
// 메모 본문, 인증 토큰, 실명은 저장하거나 출력하지 않습니다.
function sanitizeEvent(event) {
  if (!event || typeof event !== 'object') return null;

  const at = typeof event.at === 'string' ? event.at : null;
  const method = typeof event.method === 'string' ? event.method.toUpperCase() : null;
  const sub = typeof event.identity?.sub === 'string'
    ? event.identity.sub
    : (typeof event.subjectId === 'string' ? event.subjectId : (typeof event.subject === 'string' ? event.subject : null));
  const deviceId = typeof event.device?.id === 'string'
    ? event.device.id
    : (typeof event.deviceId === 'string' ? event.deviceId : null);
  const decision = typeof event.decision === 'string' ? event.decision : null;

  const network = typeof event.network === 'string'
    ? event.network
    : (typeof event.signals?.network === 'string' ? event.signals.network : null);
  const region = typeof event.region === 'string'
    ? event.region
    : (typeof event.signals?.region === 'string' ? event.signals.region : null);
  const count = typeof event.count === 'number' ? event.count : null;

  if (!at || !method || !sub) return null;
  return { at, method, sub, deviceId, decision, network, region, count };
}

const TEN_MINUTES_MS = 10 * 60 * 1000; // 10분 (600,000 밀리초)

export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');

  // 가명 사용자·기기·요청 종류·판정만 비밀값 없이 읽어 들입니다.
  const parsedEvents = events.map(sanitizeEvent).filter(Boolean);
  if (parsedEvents.length === 0) {
    return { action: 'observe' };
  }

  // 사용자(sub)별로 사건 분리 (타 사용자 사건 합산 방지)
  const userEvents = new Map();
  for (const ev of parsedEvents) {
    if (ev.method !== 'GET') continue; // 계약: GET 조회 사건만 판정 대상
    if (!userEvents.has(ev.sub)) {
      userEvents.set(ev.sub, []);
    }
    userEvents.get(ev.sub).push(ev);
  }

  for (const [sub, evList] of userEvents.entries()) {
    // 단건 사건에 다량 조회가 명시된 모의 사건 대응 (count > 120)
    const burstCountEvent = evList.find(e => typeof e.count === 'number' && e.count > 120);
    if (burstCountEvent) {
      // 지역 하나만으로 확정하지 않음 (region만 있고 network가 usual인 경우 제외)
      if (burstCountEvent.region && burstCountEvent.network === 'usual') {
        continue;
      }
      return { action: 'propose_revocation', reasonCode: 'burst_read', subject: sub };
    }

    // 시간순 정렬
    evList.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    // 10분 구간 슬라이딩 윈도우로 다량 조회(120건 초과) 판정
    let left = 0;
    for (let right = 0; right < evList.length; right++) {
      const rightTime = new Date(evList[right].at).getTime();
      while (rightTime - new Date(evList[left].at).getTime() > TEN_MINUTES_MS) {
        left++;
      }

      const windowEvents = evList.slice(left, right + 1);
      const countInWindow = windowEvents.length;

      // 같은 sub의 사건이 어느 10분 구간에서든 120건을 넘을 때만 회수 제안 (120건 이하는 제외)
      if (countInWindow > 120) {
        // 지역 하나만으로 확정하지 않음:
        // 네트워크 정보가 주어졌는데 오직 region만 비정상이고 network는 usual이면 보류
        const hasNetworkData = windowEvents.some(e => e.network !== null);
        const onlyRegionUnusual = windowEvents.some(e => e.region === 'unusual' || e.region === 'foreign')
          && windowEvents.every(e => e.network === 'usual');

        if (hasNetworkData && onlyRegionUnusual) {
          continue;
        }

        const targetDevice = windowEvents.find(e => e.deviceId)?.deviceId || null;
        const proposal = {
          action: 'propose_revocation',
          reasonCode: 'burst_read',
          subject: sub,
        };
        if (targetDevice) {
          proposal.deviceId = targetDevice;
        }
        return proposal;
      }
    }
  }

  // 정상 사건 또는 120건 이하 정상 범위는 그대로 관찰(observe) 유지
  return { action: 'observe' };
}
