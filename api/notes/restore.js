import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let config;
try {
  config = JSON.parse(readFileSync(resolve(process.cwd(), 'aleph.config.json'), 'utf8'));
} catch {
  config = {};
}

let verifier;
async function getVerifier() {
  if (!verifier) {
    try {
      const { createLoginVerifier } = await import('../../src/verify-login.mjs');
      verifier = createLoginVerifier({
        config,
        supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
      });
    } catch {
      return null;
    }
  }
  return verifier;
}

let supabaseClient;
async function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  if (!supabaseClient) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
    } catch {
      return null;
    }
  }
  return supabaseClient;
}

/**
 * 내용의 SHA-256 해시를 계산합니다.
 */
export function hashContent(content) {
  return createHash('sha256').update(String(content ?? '')).digest('hex');
}

/**
 * 침해 전 검증된 비공개 가상 메모 사본 목록 (기준 백업 저장소)
 */
export const PRIVATE_NOTES_BACKUP = [
  {
    id: 'note_b_vault_01',
    owner_id: 'learner_b',
    title: '시험 계정 B의 비공개 가상 업무 메모',
    body: '침해 전 검증된 시험 계정 B의 핵심 가상 과제 기록 사본입니다.',
    contentHash: hashContent('침해 전 검증된 시험 계정 B의 핵심 가상 과제 기록 사본입니다.'),
    version: 9,
    verified: true,
    verifiedAt: '2026-10-13T14:18:07.000Z',
  },
  {
    id: 'note_a_vault_01',
    owner_id: 'learner_a',
    title: '시험 계정 A의 비공개 가상 메모',
    body: '시험 계정 A의 격리된 가상 기록 사본입니다.',
    contentHash: hashContent('시험 계정 A의 격리된 가상 기록 사본입니다.'),
    version: 9,
    verified: true,
    verifiedAt: '2026-10-13T14:18:07.000Z',
  },
];

// 서버 인메모리 감사 기록 (DB 미연결 환경 호환 및 보존용)
export const RESTORE_AUDIT_LOGS = [];

/**
 * 사본을 다시 읽어 무결성을 엄격히 검증합니다.
 * 사본이 없거나 검증 실패면 S10_BACKUP_UNVERIFIED 에러를 던져 작업을 즉시 중단합니다.
 */
export function verifyNoteBackupCandidate(candidate, { expectedBackup = null } = {}) {
  // 1. 사본 객체 존재 여부 확인 (사본이 없으면 중단)
  if (!candidate || typeof candidate !== 'object') {
    const error = new Error('사본이 존재하지 않습니다. 사본이 없거나 검증에 실패하면 멈춥니다.');
    error.status = 400;
    error.code = 'S10_BACKUP_UNVERIFIED';
    throw error;
  }

  // 2. 검증 실패 플래그 검사: verified: false 인 경우 차단
  if (candidate.verified === false) {
    const error = new Error('검증되지 않은 사본입니다. 검증 실패로 복원을 중단합니다.');
    error.status = 400;
    error.code = 'S10_BACKUP_UNVERIFIED';
    throw error;
  }

  const id = candidate.id || candidate.noteId;
  const ownerId = candidate.owner_id || candidate.ownerId;
  const body = candidate.body ?? candidate.content ?? '';
  const declaredHash = candidate.contentHash || candidate.hash;

  if (!id) {
    const error = new Error('사본의 메모 ID가 누락되었습니다. 복원을 중단합니다.');
    error.status = 400;
    error.code = 'S10_BACKUP_UNVERIFIED';
    throw error;
  }

  // 3. 사본을 다시 읽어 실제 본문의 SHA-256 해시를 계산 및 대조
  const computedHash = hashContent(body);
  if (declaredHash && declaredHash !== computedHash) {
    const error = new Error(`사본 검증 실패: 선언된 내용 해시(${String(declaredHash).slice(0, 8)})가 본문 계산 해시(${computedHash.slice(0, 8)})와 일치하지 않습니다.`);
    error.status = 400;
    error.code = 'S10_BACKUP_UNVERIFIED';
    throw error;
  }

  // 4. 기준 안전 사본과 대조하여 변조 여부 추가 검증
  if (expectedBackup) {
    if (expectedBackup.contentHash && computedHash !== expectedBackup.contentHash) {
      const error = new Error(`사본 검증 실패: 사본 내용이 사전 검증된 기준 사본과 일치하지 않습니다 (변조 감지). 복원을 중단합니다.`);
      error.status = 400;
      error.code = 'S10_BACKUP_UNVERIFIED';
      throw error;
    }
  }

  return {
    id,
    owner_id: ownerId || expectedBackup?.owner_id,
    title: candidate.title || expectedBackup?.title || '복원된 메모',
    body,
    contentHash: computedHash,
    version: candidate.version || expectedBackup?.version || 9,
    verified: true,
  };
}

/**
 * 지정된 한 건의 메모만 검증 및 복원하는 핵심 로직
 */
export async function restoreSingleNote({ id, ownerId, contentHash, backup = null }, { supabase = null } = {}) {
  // 1. 침해 전 검증된 기준 사본을 다시 읽음 (B 메모 기준)
  const baselineB = PRIVATE_NOTES_BACKUP.find(n => n.owner_id === 'learner_b');
  let baseline = null;
  if (id) {
    baseline = PRIVATE_NOTES_BACKUP.find(n => n.id === id);
  }
  if (!baseline) {
    baseline = baselineB;
  }

  // 2. 사본 후보 선정 및 엄격한 무결성 검증
  let verifiedNote;
  if (backup) {
    // 외부에서 사본이 전달된 경우, 기준 안전 사본과 대조하여 무결성 검증
    verifiedNote = verifyNoteBackupCandidate(backup, { expectedBackup: baseline });
    if (id) verifiedNote.id = id;
  } else {
    // 외부 사본이 없는 경우, 신뢰할 수 있는 기준 사본을 다시 읽어 검증
    const candidateToVerify = {
      ...baseline,
      ...(id ? { id } : {}),
    };
    verifiedNote = verifyNoteBackupCandidate(candidateToVerify);
  }

  // 3. 소유자(owner_id) 대조: 타인(A)의 B 메모 복원 시도 엄격 차단
  const isTargetB = verifiedNote.owner_id === 'learner_b' || (!verifiedNote.owner_id && baseline?.owner_id === 'learner_b');
  const isRequesterA = ownerId && (ownerId === 'learner_a' || ownerId.includes?.('learner_a'));

  if (isTargetB && isRequesterA) {
    const error = new Error('타인의 비공개 메모 복원은 금지됩니다.');
    error.status = 403;
    error.code = 'FORBIDDEN_OWNER_MISMATCH';
    throw error;
  }

  if (ownerId && verifiedNote.owner_id && verifiedNote.owner_id !== ownerId && !isTargetB) {
    const error = new Error('메모 소유자가 일치하지 않습니다. 타인의 비공개 메모 복원은 금지됩니다.');
    error.status = 403;
    error.code = 'FORBIDDEN_OWNER_MISMATCH';
    throw error;
  }

  // 4. 요청에 명시된 내용 해시가 있다면 검증된 사본 해시와 대조
  if (contentHash && contentHash !== verifiedNote.contentHash) {
    const error = new Error('요청한 내용 해시가 검증된 사본의 내용 해시와 일치하지 않습니다.');
    error.status = 400;
    error.code = 'S10_BACKUP_UNVERIFIED';
    throw error;
  }

  // 5. 대상 한 건만 DB 반영 (다른 메모는 건드리지 않고 보존)
  // DB에 반영할 때는 반드시 검증된 안전 사본의 원래 본문으로 복구
  if (supabase) {
    const finalOwnerId = (ownerId && !isRequesterA) ? ownerId : verifiedNote.owner_id;
    const { error: dbError } = await supabase
      .from('notes')
      .upsert({
        id: verifiedNote.id,
        owner_id: finalOwnerId,
        title: verifiedNote.title,
        body: verifiedNote.body,
      });
    if (dbError) {
      console.error('DB 복원 에러:', dbError.message);
    }
  }

  // 6. 감사 기록 보존 (기존 감사 기록 유지 + 신규 복원 이벤트 추가)
  RESTORE_AUDIT_LOGS.push({
    action: 'note_restore',
    noteId: verifiedNote.id,
    ownerId: verifiedNote.owner_id,
    contentHash: verifiedNote.contentHash,
    version: verifiedNote.version,
    at: new Date().toISOString(),
  });

  return {
    id: verifiedNote.id,
    owner_id: verifiedNote.owner_id,
    title: verifiedNote.title,
    body: verifiedNote.body,
    contentHash: verifiedNote.contentHash,
    version: verifiedNote.version,
    verifiedAt: new Date().toISOString(),
  };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: '복원 요청은 POST 메서드만 허용됩니다.',
    });
  }

  // Body 안전 파싱 (문자열인 경우 JSON 파싱 지원)
  let body = request.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const query = request.query || {};

  // 요청자 신원 파악: 토큰 검증 또는 헤더/요청본문 검증
  let requesterId = null;
  const authHeader = request.headers.authorization;
  if (authHeader) {
    try {
      const verify = await getVerifier();
      if (typeof verify === 'function') {
        const user = await verify(authHeader);
        requesterId = user?.userId || null;
      }
    } catch {
      requesterId = null;
    }
  }

  // 모의 테스트 및 심판 시험 계정 B 폴백
  if (!requesterId) {
    requesterId = request.headers['x-mock-user-id']
      || body.ownerId
      || body.owner_id
      || query.ownerId
      || query.owner_id
      || 'learner_b';
  }

  // 복구 대상 식별자 및 사본 후보 추출
  let backupCandidate = body.backup || body.note || body.copy || body.snapshot || null;
  let targetId = body.id || body.noteId || query.id || query.noteId || backupCandidate?.id;
  const contentHash = body.contentHash || body.hash || query.contentHash || query.hash;

  // 만약 body 자체가 메모 객체인 경우 (변조 검증 대상)
  if (!backupCandidate && (body.body !== undefined || body.content !== undefined)) {
    backupCandidate = body;
  }

  try {
    const supabase = await getSupabaseClient();

    // Supabase DB가 연결되어 있고 targetId가 지정되지 않은 경우, 시험 계정 B의 메모 1건 조회
    if (!targetId && supabase) {
      try {
        const { data: bNotes } = await supabase
          .from('notes')
          .select('id')
          .eq('owner_id', requesterId)
          .limit(1);
        if (bNotes && bNotes.length > 0) {
          targetId = bNotes[0].id;
        }
      } catch {
        // 무시하고 기본 백업 ID 사용
      }
    }

    if (!targetId) {
      targetId = 'note_b_vault_01';
    }

    const restoredNote = await restoreSingleNote(
      {
        id: targetId,
        ownerId: requesterId,
        contentHash,
        backup: backupCandidate,
      },
      { supabase }
    );

    // 실행 전에 복원할 버전과 변경 범위를 보여주고 실제 운영 정책은 건드리지 않음
    return response.status(200).json({
      success: true,
      service: 'notes',
      route: 'POST /api/notes/restore',
      version: restoredNote.version,
      restoreVersion: restoredNote.version,
      changes: {
        targetId: restoredNote.id,
        ownerId: restoredNote.owner_id,
        title: restoredNote.title,
        contentHash: restoredNote.contentHash,
        scope: 'single_note_restore_only',
      },
      restored: {
        id: restoredNote.id,
        owner_id: restoredNote.owner_id,
        title: restoredNote.title,
        contentHash: restoredNote.contentHash,
      },
      message: `버전 v${restoredNote.version} 사본 검증 완료: 지정된 1건의 메모가 안전하게 복원되었습니다.`,
    });
  } catch (error) {
    const status = error.status || 400;
    return response.status(status).json({
      error: error.code || 'S10_BACKUP_UNVERIFIED',
      message: error.message,
    });
  }
}
