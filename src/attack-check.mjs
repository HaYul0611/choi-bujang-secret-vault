// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (config.step !== 2) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');

  let staticExposed = false;
  let staticStatus = 404;
  try {
    const response = await fetch(new URL('/data.json', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    staticStatus = response.status;
    if (response.ok) {
      const data = await response.json();
      staticExposed = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    }
  } catch {
    // 404 or non-JSON
  }

  let apiAccessible = false;
  let apiStatus = 500;
  try {
    const apiRes = await fetch(new URL('/api/notes', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    apiStatus = apiRes.status;
    if (apiRes.ok) {
      const data = await apiRes.json();
      apiAccessible = Array.isArray(data.notes) && data.notes.length > 0;
    }
  } catch {
    // network or error
  }

  return [
    {
      attackId: 'anonymous_static_leak',
      expected: '정적 /data.json에서 가상 메모 문장 미노출 (404 또는 메모 0건)',
      observed: staticExposed ? '정적 /data.json에서 가상 메모가 노출됨' : `정적 가상 메모 노출 차단 확인 (HTTP ${staticStatus})`,
    },
    {
      attackId: 'public_api_direct_read',
      expected: '공개 서버 API(/api/notes)를 통한 가상 메모 응답 확인',
      observed: apiAccessible ? '서버 API를 통해 메모 조회가 가능하나 미인증 공개 상태임' : `서버 API 응답 확인 (HTTP ${apiStatus})`,
    },
  ];
}
