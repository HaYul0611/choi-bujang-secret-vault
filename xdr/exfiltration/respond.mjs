import { appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALERTS_LOG_PATH = join(__dirname, '..', 'alerts.log');

// ZTNA 판정기와 연동할 동적 거부 규칙 보관소
export const dynamicDenyRules = new Map();

/**
 * 차단 후보를 위한 ZTNA 판정기 거부 규칙 객체 생성
 * 만료 시각(expiresAt)과 근거 경보 번호(evidenceAlertId) 포함
 */
export function createDenyRule(alert, decision, durationSeconds = 3600) {
  const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
  return {
    ruleId: `xdr.block.${alert.id}`,
    action: 'deny',
    targetIp: alert.data?.srcip ?? '',
    evidenceAlertId: alert.id,
    reason: decision.reason,
    confidence: decision.confidence,
    expiresAt,
  };
}

/**
 * xdr/alerts.log 에 알림 한 줄 추가
 */
export async function logAlert(alert, decision) {
  const now = new Date().toISOString();
  const alertId = alert.id ?? 'unknown';
  const ip = alert.data?.srcip ?? '-';
  const user = alert.data?.srcuser ?? alert.data?.user ?? '-';
  const logLine = `[${now}] [${decision.action.toUpperCase()}] alertId=${alertId} ip=${ip} user=${user} reason="${decision.reason}" confidence=${decision.confidence}\n`;

  await appendFile(ALERTS_LOG_PATH, logLine, 'utf8');
}

/**
 * 경보 처리 및 ZTNA 거부 규칙 연동
 * 차단 후보만 ZTNA 거부 규칙으로 등록하고 정상 사용자는 제외
 */
export async function handleAlert(alert) {
  const decision = await decide(alert);

  // 1. 차단(block) 대상: ZTNA 거부 규칙 등록 및 알림 로그 추가
  if (decision.action === 'block') {
    const rule = createDenyRule(alert, decision);
    if (rule.targetIp) {
      dynamicDenyRules.set(rule.targetIp, rule);
    }
    await logAlert(alert, decision);
    return { decision, rule, blocked: true };
  }

  // 2. 의심(alert) 대상: 알림 로그만 추가하고 ZTNA 차단은 하지 않음
  if (decision.action === 'alert') {
    await logAlert(alert, decision);
    return { decision, rule: null, blocked: false };
  }

  // 3. 정상(record) 대상: 통과 (거부 규칙 미등록)
  return { decision, rule: null, blocked: false };
}

/**
 * ZTNA 판정기에서 요청 IP의 차단 여부를 검사하는 연결 인터페이스
 */
export function checkZtnaAccess(requestIp) {
  const rule = dynamicDenyRules.get(requestIp);
  if (!rule) {
    return { allowed: true };
  }

  // 만료 시각 검사
  if (new Date(rule.expiresAt).getTime() <= Date.now()) {
    dynamicDenyRules.delete(requestIp);
    return { allowed: true };
  }

  return {
    allowed: false,
    decision: 'deny',
    ruleId: rule.ruleId,
    reason: rule.reason,
    evidenceAlertId: rule.evidenceAlertId,
    expiresAt: rule.expiresAt,
  };
}

// 직접 실행 시 시험 경보 전체를 처리하고 정상 통과 검증
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { readFile } = await import('node:fs/promises');
  const fixturePath = join(__dirname, '..', 'fixtures', 'exfiltration.json');
  const data = JSON.parse(await readFile(fixturePath, 'utf8'));

  let blockedCount = 0;
  let normalBlocked = 0;

  for (const alert of data.alerts) {
    const result = await handleAlert(alert);
    if (result.blocked) {
      blockedCount++;
      const mitre = alert.rule?.mitre ?? [];
      const isNormal = (alert.rule?.level ?? 0) <= 3 || (!mitre.includes('T1041') && !mitre.includes('T1048'));
      if (isNormal) normalBlocked++;
    }
  }

  console.log(`처리 완료: 차단 규칙 등록 ${blockedCount}건, 정상 이벤트 차단 ${normalBlocked}건`);
}
