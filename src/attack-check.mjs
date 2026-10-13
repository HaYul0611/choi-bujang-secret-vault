// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
import { createHash, randomUUID } from 'node:crypto';

// 판정기에 보낼 가상 요청의 공통 모양입니다(계약 18개 이름만 사용).
function zoneRequest(over) {
  return {
    schema: 'aleph.decision.v1', requestId: randomUUID(), classId: 'class_fixture',
    projectId: 'project_fixture', subjectId: 'learner_fixture', deviceId: 'a'.repeat(16),
    service: 'notes', method: 'GET', path: '/notes/demo', route: 'GET /notes/:id',
    queryLength: 0, querySha256: createHash('sha256').update('').digest('hex'),
    at: new Date().toISOString(), policyRevision: 1, deviceRegistered: true,
    stepUp: { verified: false, authAgeSeconds: null }, recentEvents: [],
    signals: { source: 'judge_fixture', region: 'local', network: 'usual', hour: 14 },
    ...over,
  };
}

export async function runAttackChecks(config) {
  if (config.step !== 10) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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

  // 네트워크에 실제로 닿은 요청만 상태 코드를 기록하고, 닿지 못한 요청은
  // 임의의 통과/실패로 보고하지 않고 미실행(reached:false)으로 남깁니다.
  const probe = async (url, options) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000), ...options });
      return { reached: true, status: res.status };
    } catch {
      return { reached: false, status: 0 };
    }
  };

  // 1) 정적 /data.json 노출 차단 점검
  const staticProbe = await probe(new URL('/data.json', app), { redirect: 'error' });

  // 2) 비로그인 상태에서 /api/notes 직접 요청 시 차단(401/403) 확인
  const apiProbe = await probe(new URL('/api/notes', app), { redirect: 'error' });

  // 3) 비로그인 상태에서 /api/announcements 직접 요청 시 차단(401/403) 확인
  const announceProbe = await probe(new URL('/api/announcements', app), { redirect: 'error' });

  // 4) 원본 자료 API(originalApiUrl) 직접 요청 시 차단 확인
  const originProbe = config.originalApiUrl
    ? await probe(config.originalApiUrl, { headers: { apikey: 'anon-test' } })
    : { reached: false, status: 0 };

  // 5) 6단계: 판정기 미등록 기기 차단 점검(보존)
  let deciderBlocked = false;
  let deciderReason = '';
  try {
    const { decide } = await import('./decider.mjs');
    const denied = await decide(zoneRequest({ deviceRegistered: false }));
    deciderBlocked = denied.decision === 'deny' && denied.reasonCode === 'device_not_registered';
    deciderReason = denied.reasonCode;
  } catch {
    deciderBlocked = false;
  }

  // 6) 7단계: 판정기 복합 이상 접속 추가 확인(step_up) 점검(보존)
  let suspiciousStepUp = false;
  let stepUpReason = '';
  try {
    const { decide } = await import('./decider.mjs');
    const { suspicious } = (await import('../scripts/fixture-7.mjs')).fixtureRequests();
    const res = await decide(suspicious);
    suspiciousStepUp = res.decision === 'step_up' && res.reasonCode === 'step_up_required';
    stepUpReason = res.reasonCode;
  } catch {
    suspiciousStepUp = false;
  }

  // 7) 8단계: 구역 혼선 차단 점검. service=notes인데 공지 경로로 들어온 요청은 거부되어야 합니다.
  let crossZoneBlocked = false;
  let crossZoneReason = '';
  try {
    const { decide } = await import('./decider.mjs');
    const res = await decide(zoneRequest({
      service: 'notes', method: 'GET', path: '/announcements/x', route: 'GET /announcements/:id',
    }));
    crossZoneBlocked = res.decision === 'deny';
    crossZoneReason = res.reasonCode;
  } catch {
    crossZoneBlocked = false;
  }

  // 8) 8단계: :id 깊이에 숨긴 기능 경로(export 등) 위장 요청은 거부되어야 합니다.
  let hiddenRouteBlocked = false;
  let hiddenRouteReason = '';
  try {
    const { decide } = await import('./decider.mjs');
    const res = await decide(zoneRequest({
      service: 'notes', method: 'GET', path: '/notes/x/export', route: 'GET /notes/:id/export',
    }));
    hiddenRouteBlocked = res.decision === 'deny';
    hiddenRouteReason = res.reasonCode;
  } catch {
    hiddenRouteBlocked = false;
  }

  // 9) 8단계: 공지 구역의 정상 읽기는 메모 구역과 분리되어 허용되어야 합니다.
  let announceZoneAllowed = false;
  let announceZoneReason = '';
  try {
    const { decide } = await import('./decider.mjs');
    const res = await decide(zoneRequest({
      service: 'announcements', method: 'GET', path: '/announcements', route: 'GET /announcements',
    }));
    announceZoneAllowed = res.decision === 'allow';
    announceZoneReason = res.reasonCode;
  } catch {
    announceZoneAllowed = false;
  }

  // 10) 8단계: 다른 사용자의 메모 조회 시 판정기 거부(deny) 점검
  let otherNoteBlocked = false;
  let otherNoteReason = '';
  try {
    const { decide } = await import('./decider.mjs');
    const res = await decide(zoneRequest({
      subjectId: 'learner_b', service: 'notes', method: 'GET',
      path: '/notes/learner_a', route: 'GET /notes/:id',
    }));
    otherNoteBlocked = res.decision === 'deny';
    otherNoteReason = res.reasonCode;
  } catch {
    otherNoteBlocked = false;
  }

  // 11) 8단계: 일반 학생의 공지 수정 요청 시 판정기 거부(deny) 점검
  let studentAnnounceWriteBlocked = false;
  let studentAnnounceWriteReason = '';
  try {
    const { decide } = await import('./decider.mjs');
    const res = await decide(zoneRequest({
      subjectId: 'learner_a', service: 'announcements', method: 'PUT',
      path: '/announcements/demo', route: 'PUT /announcements/:id',
    }));
    studentAnnounceWriteBlocked = res.decision === 'deny';
    studentAnnounceWriteReason = res.reasonCode;
  } catch {
    studentAnnounceWriteBlocked = false;
  }

  // 12) 9단계: 10분 내 120건 초과 폭주 조회 탐지(propose_revocation) 점검
  let burstDetectPassed = false;
  let burstDetectResult = '';
  try {
    const { detect } = await import('./detect.mjs');
    const start = Date.UTC(2026, 9, 1, 0, 0, 0);
    const burstEvents = Array.from({ length: 121 }, (_, i) => ({
      at: new Date(start + i * 2000).toISOString(),
      method: 'GET',
      identity: { sub: 'learner_victim' },
      deviceId: 'dev_victim_01',
    }));
    const res = await detect(burstEvents);
    burstDetectPassed = res?.action === 'propose_revocation'
      && res?.reasonCode === 'burst_read'
      && res?.subject === 'learner_victim';
    burstDetectResult = res?.action ? `${res.action}/${res.reasonCode}` : 'unknown';
  } catch (err) {
    burstDetectPassed = false;
    burstDetectResult = err.message;
  }

  // 13) 10단계: 침해 전 안전 정책 사본 검증 및 변경 범위 사전 확인(Dry-run) 점검
  let policyRestorePreviewPassed = false;
  let policyRestorePreviewResult = '';
  try {
    const { getVerifiedBaselineSnapshot, previewPolicyRestore } = await import('./restore.mjs');
    const safeBackup = getVerifiedBaselineSnapshot();
    const preview = previewPolicyRestore(safeBackup, {
      version: 'test-compromised',
      ruleIds: ['device_registered'],
      allowedRoutes: ['GET /api/notes', 'POST /api/admin/backdoor'],
      resources: { notes: { service: 'notes', ownership: 'owner_id', writeRoles: ['owner'] } },
    });
    policyRestorePreviewPassed = preview.readyToRestore === true
      && preview.restoreVersion === 9
      && preview.diffSummary.routes.unauthorizedAdded.includes('POST /api/admin/backdoor');
    policyRestorePreviewResult = policyRestorePreviewPassed ? '통과' : '사전 확인 불일치';
  } catch (err) {
    policyRestorePreviewPassed = false;
    policyRestorePreviewResult = err.message;
  }

  // 14) 10단계: 비공개 가상 메모 사본 단건 복원(ID·소유자·내용 해시 대조) 점검
  let singleNoteRestorePassed = false;
  let singleNoteRestoreResult = '';
  try {
    const { restoreSingleNote, PRIVATE_NOTES_BACKUP } = await import('../api/notes/restore.js');
    const noteB = PRIVATE_NOTES_BACKUP.find(n => n.owner_id === 'learner_b');
    const restored = await restoreSingleNote({
      id: noteB.id,
      ownerId: 'learner_b',
      contentHash: noteB.contentHash,
    });
    singleNoteRestorePassed = restored.id === noteB.id
      && restored.owner_id === 'learner_b'
      && restored.contentHash === noteB.contentHash;
    singleNoteRestoreResult = singleNoteRestorePassed ? '통과' : '단건 복원 불일치';
  } catch (err) {
    singleNoteRestorePassed = false;
    singleNoteRestoreResult = err.message;
  }

  const staticBlocked = staticProbe.reached && (staticProbe.status === 404 || staticProbe.status === 410);
  const apiBlocked = apiProbe.reached && (apiProbe.status === 401 || apiProbe.status === 403);
  const announceBlocked = announceProbe.reached && (announceProbe.status === 401 || announceProbe.status === 403);
  const originBlocked = originProbe.reached
    && (originProbe.status === 401 || originProbe.status === 403 || originProbe.status === 404);

  return [
    {
      attackId: 'anonymous_static_leak',
      expected: '정적 /data.json에서 가상 메모 문장 미노출 (404 또는 메모 0건)',
      observed: !staticProbe.reached ? '배포 주소 연결 불가로 미실행(보존)'
        : staticBlocked ? `정적 가상 메모 노출 차단 확인 (HTTP ${staticProbe.status})`
          : `정적 가상 메모 노출 차단 실패 (HTTP ${staticProbe.status})`,
    },
    {
      attackId: 'anonymous_api_read_blocked',
      expected: '비로그인 메모 목록 요청 시 401 또는 403 JSON 거부',
      observed: !apiProbe.reached ? '배포 주소 연결 불가로 미실행(보존)'
        : apiBlocked ? `비로그인 메모 요청 차단 확인 (HTTP ${apiProbe.status})`
          : `비로그인 메모 요청 차단 실패 (HTTP ${apiProbe.status})`,
    },
    {
      attackId: 'anonymous_announcement_read_blocked',
      expected: '비로그인 공지 목록 요청 시 401 또는 403 JSON 거부',
      observed: !announceProbe.reached ? '배포 주소 연결 불가로 미실행(보존)'
        : announceBlocked ? `비로그인 공지 요청 차단 확인 (HTTP ${announceProbe.status})`
          : `비로그인 공지 요청 차단 실패 (HTTP ${announceProbe.status})`,
    },
    {
      attackId: 'direct_origin_api_blocked',
      expected: '원본 자료 저장소 직접 요청 차단 (401/403/거부)',
      observed: !originProbe.reached ? '원본 API 연결 불가로 미실행(보존)'
        : originBlocked ? `원본 직접 요청 차단 확인 (HTTP ${originProbe.status})`
          : `원본 직접 요청 허용됨 (HTTP ${originProbe.status})`,
    },
    {
      attackId: 'unregistered_device_decider_blocked',
      expected: '미등록 기기의 판정 요청 시 deny 및 device_not_registered 반환',
      observed: deciderBlocked ? '미등록 기기 판정 거부 확인 (deny / device_not_registered)' : `미등록 기기 판정 거부 실패 (${deciderReason})`,
    },
    {
      attackId: 'suspicious_access_step_up_required',
      expected: '평소와 다른 시각·네트워크 및 대량 조회의 복합 이상 접속 시 step_up 및 step_up_required 반환',
      observed: suspiciousStepUp ? '복합 이상 접속 추가 확인 요구 확인 (step_up / step_up_required)' : `복합 이상 판정 실패 (${stepUpReason})`,
    },
    {
      attackId: 'cross_zone_path_blocked',
      expected: '선언 서비스와 다른 구역 경로로 들어온 요청은 deny 반환',
      observed: crossZoneBlocked ? `구역 혼선 요청 거부 확인 (deny / ${crossZoneReason})` : `구역 혼선 요청 거부 실패 (${crossZoneReason})`,
    },
    {
      attackId: 'hidden_function_route_blocked',
      expected: ':id 깊이에 숨긴 기능 경로(export 등) 위장 요청은 deny 반환',
      observed: hiddenRouteBlocked ? `기능 경로 위장 요청 거부 확인 (deny / ${hiddenRouteReason})` : `기능 경로 위장 요청 거부 실패 (${hiddenRouteReason})`,
    },
    {
      attackId: 'announcement_zone_isolated_allow',
      expected: '공지 구역 정상 읽기는 메모 구역과 분리되어 allow 반환',
      observed: announceZoneAllowed ? `공지 구역 분리 허용 확인 (allow / ${announceZoneReason})` : `공지 구역 분리 허용 실패 (${announceZoneReason})`,
    },
    {
      attackId: 'other_user_note_read_blocked',
      expected: '타인 메모 조회 시도 시 판정기에서 deny 및 unauthorized_operation 반환',
      observed: otherNoteBlocked ? `타인 메모 요청 판정 거부 확인 (deny / ${otherNoteReason})` : `타인 메모 요청 판정 거부 실패 (${otherNoteReason})`,
    },
    {
      attackId: 'student_announcement_write_blocked',
      expected: '일반 학생의 공지 수정 요청 시 판정기에서 deny 및 unauthorized_operation 반환',
      observed: studentAnnounceWriteBlocked ? `학생 공지 수정 판정 거부 확인 (deny / ${studentAnnounceWriteReason})` : `학생 공지 수정 판정 거부 실패 (${studentAnnounceWriteReason})`,
    },
    {
      attackId: 'burst_read_detection_revocation',
      expected: '10분 내 120건 초과 폭주 조회 시 propose_revocation 및 burst_read 제안',
      observed: burstDetectPassed ? `폭주 조회 회수 제안 확인 (propose_revocation / burst_read)` : `폭주 조회 회수 제안 실패 (${burstDetectResult})`,
    },
    {
      attackId: 'policy_restore_preview_verified',
      expected: '침해 전 안전 정책 사본 무결성 검증 및 사전 변경 diff 계산 확인',
      observed: policyRestorePreviewPassed ? '안전 정책 사본 검증 및 복원 계획 사전 확인 완료 (v9 복원 대기)' : `사본 사전 확인 실패 (${policyRestorePreviewResult})`,
    },
    {
      attackId: 'single_note_restore_verified',
      expected: '비공개 가상 메모 사본에서 시험 계정 B의 메모가 ID·소유자·내용 해시 일치로 복원됨',
      observed: singleNoteRestorePassed ? '시험 계정 B의 비공개 메모 단건 복원 확인 (ID·소유자·해시 일치)' : `단건 복원 실패 (${singleNoteRestoreResult})`,
    },
    {
      attackId: 'live_instructor_write_guard',
      expected: '라이브 환경에서 일반 학생의 공지 수정 요청 시 403 차단 (실제 로그인 토큰 필요)',
      observed: '운영 로그인 토큰 미발급 환경으로 라이브 강사 권한 재확인 점검은 미실행으로 보존',
    },
  ];
}
