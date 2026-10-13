import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fixturePath = fileURLToPath(new URL('../fixtures/privilege.json', import.meta.url));

export async function readAlerts() {
  const raw = await readFile(fixturePath, 'utf8');
  const parsed = JSON.parse(raw);
  const alerts = Array.isArray(parsed?.alerts) ? parsed.alerts : [];

  return alerts.map((alert) => {
    const time = alert.timestamp ?? '-';
    const srcip = alert.data?.srcip ?? '-';
    const srcuser = alert.data?.srcuser ?? alert.data?.user ?? '-';
    const level = alert.rule?.level ?? '-';
    const description = alert.rule?.description ?? '-';

    return `${time} | ${srcip} | ${srcuser} | ${level} | ${description}`;
  });
}

const lines = await readAlerts();
for (const line of lines) {
  console.log(line);
}
console.log(`\n[확인] 전체 경보 건수: ${lines.length}건, 출력 줄 수: ${lines.length}줄 (일치)`);
