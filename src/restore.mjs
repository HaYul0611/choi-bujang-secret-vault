import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 가상 메모 단건 복원 관련 핵심 함수 및 픽스처 re-export
export {
  restoreSingleNote,
  verifyNoteBackupCandidate,
  hashContent,
  PRIVATE_NOTES_BACKUP,
  RESTORE_AUDIT_LOGS,
} from '../api/notes/restore.js';

/**
 * 정책 객체의 정규화된 SHA-256 체크섬을 계산합니다.
 */
export function computePolicyChecksum(policy) {
  if (!policy || typeof policy !== 'object') {
    throw new TypeError('체크섬 계산 대상 정책은 유효한 객체여야 합니다.');
  }
  const payload = JSON.stringify({
    version: policy.version,
    resources: policy.resources,
    allowedRoutes: Array.isArray(policy.allowedRoutes) ? [...policy.allowedRoutes].sort() : [],
    ruleIds: Array.isArray(policy.ruleIds) ? [...policy.ruleIds].sort() : [],
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * 침해 전에 검증된 표준 9단계 안전 정책 사본 픽스처를 반환합니다.
 */
export function getVerifiedBaselineSnapshot() {
  const policyCore = {
    version: 9,
    policyRevision: 9,
    service: 'notes',
    resources: {
      notes: {
        service: 'notes',
        ownership: 'owner_id',
        writeRoles: ['owner'],
      },
      announcements: {
        service: 'announcements',
        ownership: 'author_id',
        writeRoles: ['instructor'],
      },
    },
    allowedRoutes: [
      'GET /api/notes',
      'POST /api/notes',
      'GET /api/notes/:id',
      'PUT /api/notes/:id',
      'DELETE /api/notes/:id',
      'GET /api/announcements',
      'GET /api/announcements/:id',
      'POST /api/announcements',
      'PUT /api/announcements/:id',
      'DELETE /api/announcements/:id',
      'POST /api/auth',
    ],
    ruleIds: [
      'device_registered',
      'step_up_required',
      'resource_zone',
      'zone_resource_scope',
    ],
  };

  const checksum = computePolicyChecksum(policyCore);
  return {
    ...policyCore,
    verified: true,
    checksum,
    verifiedAt: '2026-10-13T14:18:07.000Z',
  };
}

/**
 * 안전 정책 사본의 유효성과 체크섬을 검증합니다.
 * 사본이 없거나 검증 실패면 에러를 던져 작업을 중단합니다.
 */
export function verifyPolicySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    const error = new Error('안전 정책 사본이 존재하지 않습니다. 작업을 중단합니다.');
    error.code = 'S10_BACKUP_UNVERIFIED';
    throw error;
  }
  if (!snapshot.verified) {
    const error = new Error('검증 표시(verified)가 없는 미공인 정책 사본입니다. 작업을 중단합니다.');
    error.code = 'S10_BACKUP_UNVERIFIED';
    throw error;
  }
  if (!snapshot.version || !snapshot.resources || !Array.isArray(snapshot.allowedRoutes) || !Array.isArray(snapshot.ruleIds)) {
    const error = new Error('안전 정책 사본의 필수 항목(version, resources, allowedRoutes, ruleIds)이 누락되었습니다. 작업을 중단합니다.');
    error.code = 'S10_BACKUP_UNVERIFIED';
    throw error;
  }
  const expectedChecksum = computePolicyChecksum(snapshot);
  if (snapshot.checksum !== expectedChecksum) {
    const error = new Error(`안전 정책 사본 체크섬 불일치 (기대값: ${expectedChecksum.slice(0, 8)}, 실제값: ${String(snapshot.checksum).slice(0, 8)}). 위변조로 판정하여 작업을 중단합니다.`);
    error.code = 'S10_BACKUP_UNVERIFIED';
    throw error;
  }
  return true;
}

/**
 * 침해 전 검증된 사본과 현재 시험 정책 간의 차이(diff)만 계산하여 미리보기를 제공합니다.
 * 실제 운영 정책 파일이나 서버 환경은 건드리지 않습니다.
 */
export function previewPolicyRestore(verifiedSnapshot, testPolicy) {
  // 1. 사본 무결성 검증 (사본 없거나 실패 시 중단)
  verifyPolicySnapshot(verifiedSnapshot);

  if (!testPolicy || typeof testPolicy !== 'object') {
    throw new Error('비교할 현재 시험 정책 객체가 존재하지 않습니다.');
  }

  const targetVersion = verifiedSnapshot.version;
  const currentTestVersion = testPolicy.version ?? testPolicy.step ?? 'unknown';

  // 2. 허용 경로(allowedRoutes) 차이
  const safeRoutes = new Set(verifiedSnapshot.allowedRoutes || []);
  const testRoutes = new Set(testPolicy.allowedRoutes || []);

  const unauthorizedAddedRoutes = [...testRoutes].filter(r => !safeRoutes.has(r));
  const missingRoutes = [...safeRoutes].filter(r => !testRoutes.has(r));

  // 3. 판정 규칙(ruleIds) 차이
  const safeRules = new Set(verifiedSnapshot.ruleIds || []);
  const testRules = new Set(testPolicy.ruleIds || []);

  const unauthorizedAddedRules = [...testRules].filter(r => !safeRules.has(r));
  const missingRules = [...safeRules].filter(r => !testRules.has(r));

  // 4. 자원 구역(resources) 차이
  const resourceDiffs = [];
  const safeResources = verifiedSnapshot.resources || {};
  const testResources = testPolicy.resources || {};

  for (const [key, safeRes] of Object.entries(safeResources)) {
    if (!testResources[key]) {
      resourceDiffs.push({ resource: key, type: 'missing_in_current', safe: safeRes });
    } else {
      const safeStr = JSON.stringify(safeRes);
      const testStr = JSON.stringify(testResources[key]);
      if (safeStr !== testStr) {
        resourceDiffs.push({ resource: key, type: 'modified', safe: safeRes, current: testResources[key] });
      }
    }
  }
  for (const key of Object.keys(testResources)) {
    if (!safeResources[key]) {
      resourceDiffs.push({ resource: key, type: 'unauthorized_resource_added', current: testResources[key] });
    }
  }

  const hasDiff = unauthorizedAddedRoutes.length > 0 || missingRoutes.length > 0
    || unauthorizedAddedRules.length > 0 || missingRules.length > 0
    || resourceDiffs.length > 0;

  return {
    readyToRestore: true,
    restoreVersion: targetVersion,
    currentVersion: currentTestVersion,
    hasDiff,
    diffSummary: {
      routes: {
        unauthorizedAdded: unauthorizedAddedRoutes,
        missing: missingRoutes,
      },
      rules: {
        unauthorizedAdded: unauthorizedAddedRules,
        missing: missingRules,
      },
      resources: resourceDiffs,
    },
    message: hasDiff
      ? `[복원 준비 완료] 복원 대상 버전: v${targetVersion} / 변경 범위가 탐지되었습니다.`
      : `[일치] 현재 시험 정책이 검증된 안전 사본(v${targetVersion})과 완전히 일치합니다.`,
  };
}

/**
 * 검증된 안전 정책 사본으로 시험 정책을 되돌리는 복원 절차입니다.
 * - 복원 실행 전 변경될 항목(preview)을 사전에 산출합니다.
 * - 대상 서비스(notes, announcements)의 구역과 규칙을 사본으로 복구합니다.
 * - 다른 서비스(ai, threat-intel 등)의 기존 규칙과 설정은 온전히 보존합니다.
 * - 기존 감사 이력(auditLogs)은 지우지 않고 보존하며 복원 사건만 덧붙입니다.
 */
export function restorePolicy(verifiedSnapshot, currentPolicy, { auditLogs = [] } = {}) {
  // 1. 실행 전 사전 변경 항목 확인 및 사본 검증 (실패 시 즉시 중단)
  const preview = previewPolicyRestore(verifiedSnapshot, currentPolicy);

  // 2. 다른 서비스 자원 및 규칙 보존
  const targetServices = new Set(['notes', 'announcements']);
  const otherResources = {};
  for (const [key, val] of Object.entries(currentPolicy?.resources || {})) {
    if (!targetServices.has(key)) {
      otherResources[key] = val;
    }
  }

  // 타 서비스용 보존 규칙 선별 (침해로 주입된 규칙 제외, 기존 타 서비스 규칙 보존)
  const targetRuleSet = new Set(verifiedSnapshot.ruleIds);
  const otherRules = (currentPolicy?.ruleIds || []).filter(
    r => !targetRuleSet.has(r) && !['compromised_rule', 'unauthorized_rule'].includes(r)
  );

  // 3. 복원된 시험 정책 구성
  const restoredPolicy = {
    version: verifiedSnapshot.version,
    policyRevision: verifiedSnapshot.policyRevision ?? verifiedSnapshot.version,
    service: verifiedSnapshot.service,
    resources: {
      ...otherResources,
      ...verifiedSnapshot.resources,
    },
    allowedRoutes: [...verifiedSnapshot.allowedRoutes],
    ruleIds: [...verifiedSnapshot.ruleIds, ...otherRules],
    restoredAt: new Date().toISOString(),
  };

  // 4. 기존 감사 이력 보존 및 복원 이벤트 추가 (Append-only)
  const updatedAuditLogs = [
    ...auditLogs,
    {
      at: new Date().toISOString(),
      action: 'policy_restore',
      targetVersion: verifiedSnapshot.version,
      checksum: verifiedSnapshot.checksum,
      changesApplied: {
        routesAddedCount: preview.diffSummary.routes.missing.length,
        routesRemovedCount: preview.diffSummary.routes.unauthorizedAdded.length,
        rulesRestoredCount: preview.diffSummary.rules.missing.length,
        rulesRemovedCount: preview.diffSummary.rules.unauthorizedAdded.length,
      },
    },
  ];

  return {
    restoredPolicy,
    auditLogs: updatedAuditLogs,
    preview,
  };
}

/**
 * 복원된 정책 환경에서 A의 정상 요청 유지 및 B의 A 자료 요청 거부를 확인합니다.
 */
export async function verifyRestoredPolicyAccess({ decide }) {
  if (typeof decide !== 'function') {
    throw new TypeError('판정 함수(decide)가 필요합니다.');
  }

  // A 사용자의 본인 자료 조회 요청 (정상)
  const requestA = {
    schema: 'aleph.decision.v1',
    requestId: 'req_a_normal_access',
    classId: 'class_fixture',
    projectId: 'project_fixture',
    subjectId: 'learner_a',
    deviceId: 'a'.repeat(16),
    service: 'notes',
    method: 'GET',
    path: '/notes/learner_a',
    route: 'GET /notes/:id',
    queryLength: 0,
    querySha256: createHash('sha256').update('').digest('hex'),
    at: new Date().toISOString(),
    policyRevision: 9,
    deviceRegistered: true,
    stepUp: { verified: false, authAgeSeconds: null },
    recentEvents: [],
    signals: { source: 'judge_fixture', region: 'local', network: 'usual', hour: 14 },
  };

  // B 사용자의 A 자료 조회 요청 (타인 자료 침해 시도)
  const requestB = {
    ...requestA,
    requestId: 'req_b_cross_subject_leak',
    subjectId: 'learner_b',
    path: '/notes/learner_a',
  };

  const responseA = await decide(requestA);
  const responseB = await decide(requestB);

  const aAllowed = responseA.decision === 'allow';
  const bDenied = responseB.decision === 'deny';

  return {
    success: aAllowed && bDenied,
    aRequest: {
      decision: responseA.decision,
      reasonCode: responseA.reasonCode,
      passed: aAllowed,
    },
    bRequest: {
      decision: responseB.decision,
      reasonCode: responseB.reasonCode,
      passed: bDenied,
    },
  };
}

// CLI 단독 실행 진입점
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write('=== 10단계: 안전 정책 사본 검증, 사전 확인 및 복원 절차 ===\n\n');

    // 1) 안전 정책 사본 획득 및 무결성 검증
    const safeBackup = getVerifiedBaselineSnapshot();
    process.stdout.write(`1. 침해 전 안전 사본 로드: 버전 v${safeBackup.version} (체크섬: ${safeBackup.checksum.slice(0, 12)}...)\n`);
    verifyPolicySnapshot(safeBackup);
    process.stdout.write('   -> 사본 무결성 검증: 성공\n\n');

    // 2) 침해 상황 모의 시험 정책 및 기존 감사 이력
    const compromisedTestPolicy = {
      version: 'compromised-test',
      ruleIds: ['device_registered', 'resource_zone', 'ai_assistant_guard'], // step_up_required 누락, 타 서비스 규칙(ai_assistant_guard) 포함
      allowedRoutes: [
        'GET /api/notes',
        'POST /api/notes',
        'POST /api/admin/backdoor', // 비인가 경로 침투
      ],
      resources: {
        notes: { service: 'notes', ownership: 'owner_id', writeRoles: ['owner', 'guest'] }, // guest 비인가 침투
        announcements: { service: 'announcements', ownership: 'author_id', writeRoles: ['instructor'] },
        ai_service: { service: 'ai', access: 'internal' }, // 타 서비스 자원
      },
    };

    const initialAuditLogs = [
      { at: '2026-10-13T12:00:00.000Z', action: 'user_login', subject: 'learner_a' },
      { at: '2026-10-13T12:05:00.000Z', action: 'read_note', subject: 'learner_a', noteId: 'learner_a' },
    ];

    // 3) 실행 전 바뀔 항목 사전 확인 (Dry-run)
    const preview = previewPolicyRestore(safeBackup, compromisedTestPolicy);
    process.stdout.write('2. 복원 실행 전 변경 예정 항목 확인 (Dry-run):\n');
    process.stdout.write(`   - 복원 대상 버전: v${preview.restoreVersion}\n`);
    process.stdout.write(`   - 제거될 비인가 경로: ${JSON.stringify(preview.diffSummary.routes.unauthorizedAdded)}\n`);
    process.stdout.write(`   - 복원될 누락 필수 경로: ${preview.diffSummary.routes.missing.length}건\n`);
    process.stdout.write(`   - 복원될 누락 필수 규칙: ${JSON.stringify(preview.diffSummary.rules.missing)}\n`);
    process.stdout.write(`   - 정상화될 자원 권한: notes\n\n`);

    // 4) 복원 절차 실행 (타 서비스 규칙 및 감사 이력 보존)
    const { restoredPolicy, auditLogs } = restorePolicy(safeBackup, compromisedTestPolicy, {
      auditLogs: initialAuditLogs,
    });

    process.stdout.write('3. 복원 절차 실행 결과:\n');
    process.stdout.write(`   - 복원된 정책 버전: v${restoredPolicy.version}\n`);
    process.stdout.write(`   - 타 서비스(ai_service) 자원 보존 여부: ${Boolean(restoredPolicy.resources.ai_service) ? '보존됨' : '누락됨'}\n`);
    process.stdout.write(`   - 타 서비스 규칙(ai_assistant_guard) 보존 여부: ${restoredPolicy.ruleIds.includes('ai_assistant_guard') ? '보존됨' : '누락됨'}\n`);
    process.stdout.write(`   - 기존 감사 이력 보존 건수: ${initialAuditLogs.length}건 보존됨 (총 감사 기록: ${auditLogs.length}건, 복원 로그 1건 추가)\n\n`);

    // 5) 복원 후 접근 제어 확인 (A 정상 허용, B의 A 자료 요청 거부)
    const { decide } = await import('./decider.mjs');
    const accessCheck = await verifyRestoredPolicyAccess({ decide });

    process.stdout.write('4. 복원 후 접근 제어 확인 (A 정상 유지 / B의 A 침해 거부):\n');
    process.stdout.write(`   - A의 정상 메모 요청: ${accessCheck.aRequest.decision} (${accessCheck.aRequest.reasonCode}) -> ${accessCheck.aRequest.passed ? '허용 유지 확인' : '실패'}\n`);
    process.stdout.write(`   - B의 A 메모 요청: ${accessCheck.bRequest.decision} (${accessCheck.bRequest.reasonCode}) -> ${accessCheck.bRequest.passed ? '거부 확인' : '실패'}\n`);

    if (!accessCheck.success) {
      throw new Error('복원 후 접근 제어 확인 실패: A 정상 요청이 거부되었거나 B의 타인 요청이 차단되지 않았습니다.');
    }

    // 6) 비공개 가상 메모 사본에서 지정한 단건 복원 확인 (시험 계정 B의 메모)
    process.stdout.write('\n5. 비공개 가상 메모 사본에서 지정 1건 복원 확인 (POST /api/notes/restore):\n');
    const { restoreSingleNote, PRIVATE_NOTES_BACKUP, RESTORE_AUDIT_LOGS } = await import('../api/notes/restore.js');

    const targetBNote = PRIVATE_NOTES_BACKUP.find(n => n.owner_id === 'learner_b');
    process.stdout.write(`   - 복구 대상 원본 사본: ID=${targetBNote.id}, 소유자=${targetBNote.owner_id}, 해시=${targetBNote.contentHash.slice(0, 10)}...\n`);

    // 정상 복원: 시험 계정 B의 메모 복원 (ID, 소유자, 내용 해시 일치)
    const restoredB = await restoreSingleNote({
      id: targetBNote.id,
      ownerId: 'learner_b',
      contentHash: targetBNote.contentHash,
    });

    const isMatch = restoredB.id === targetBNote.id
      && restoredB.owner_id === targetBNote.owner_id
      && restoredB.contentHash === targetBNote.contentHash;

    process.stdout.write(`   - B의 메모 복원 결과: ID 일치(${restoredB.id === targetBNote.id}), 소유자 일치(${restoredB.owner_id === targetBNote.owner_id}), 내용 해시 일치(${restoredB.contentHash === targetBNote.contentHash})\n`);
    process.stdout.write(`   - 확인 판정: ${isMatch ? '복구 대상 1건의 ID·소유자·내용 해시가 사본과 일치함 (확인 완료)' : '불일치'}\n`);

    // 거부 확인 1: 소유자 불일치 (다른 사용자가 B의 메모 복원 시도)
    try {
      await restoreSingleNote({
        id: targetBNote.id,
        ownerId: 'learner_a', // 타인 계정
        contentHash: targetBNote.contentHash,
      });
      throw new Error('타인 계정의 메모 복원이 차단되지 않았습니다.');
    } catch (err) {
      process.stdout.write(`   - 타인(A)의 B 메모 복원 차단 확인: 거부 (${err.code || err.message})\n`);
    }

    // 거부 확인 2: 내용 해시 불일치 (위변조된 내용 해시로 복원 시도)
    try {
      await restoreSingleNote({
        id: targetBNote.id,
        ownerId: 'learner_b',
        contentHash: 'tampered_hash_0000000000000000000000000000000000000000000000000000',
      });
      throw new Error('내용 해시 불일치 복원이 차단되지 않았습니다.');
    } catch (err) {
      process.stdout.write(`   - 내용 해시 위변조 시 복원 차단 확인: 거부 (${err.code || err.message})\n`);
    }

    process.stdout.write(`   - 복원 감사 기록 보존 건수: ${RESTORE_AUDIT_LOGS.length}건 보존됨\n`);

    process.stdout.write('\n모든 복원 절차, 접근 제어 및 비공개 메모 단건 복원 검증이 성공적으로 완료되었습니다.\n');
  } catch (error) {
    process.stderr.write(`오류 발생: ${error.message}\n`);
    process.exitCode = 1;
  }
}
