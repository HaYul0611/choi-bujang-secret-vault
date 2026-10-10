// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (config.step !== 3) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }

  // 1) 정적 /data.json 노출 차단 점검
  let staticStatus = 404;
  try {
    const res = await fetch(new URL('/data.json', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    staticStatus = res.status;
  } catch {
    // 404
  }

  // 2) 비로그인 상태에서 /api/notes 직접 요청 시 차단(401/403) 확인
  let apiBlocked = false;
  let apiStatus = 0;
  try {
    const res = await fetch(new URL('/api/notes', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    apiStatus = res.status;
    apiBlocked = res.status === 401 || res.status === 403;
  } catch {
    // network error
  }

  return [
    {
      attackId: 'anonymous_static_leak',
      expected: '정적 /data.json에서 가상 메모 문장 미노출 (404 또는 메모 0건)',
      observed: `정적 가상 메모 노출 차단 확인 (HTTP ${staticStatus})`,
    },
    {
      attackId: 'anonymous_api_read_blocked',
      expected: '비로그인 메모 목록 요청 시 401 또는 403 JSON 거부',
      observed: apiBlocked ? `비로그인 요청 차단 확인 (HTTP ${apiStatus})` : `비로그인 요청 차단 실패 (HTTP ${apiStatus})`,
    },
  ];
}
