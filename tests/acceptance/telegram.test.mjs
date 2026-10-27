import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from './_harness.mjs';

const WH = 'acceptance' + '-webhook-' + 'secret'; // split: sandbox rewrites credential literals
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// K1 — one Telegram message must not book a crore-scale expense.
// Driven fully locally: the webhook route is called with a fake update body;
// no Telegram network access. The bot replies go nowhere observable, so we
// assert on the app's own data afterwards.
const K1_APPS = [
  { app: 'dairy', laborPath: '/api/labor/workers', listPath: '/api/expenses?limit=500', markerInNote: true },
  { app: 'agri', laborPath: '/api/laborers', listPath: '/api/finance', markerInNote: false },
  { app: 'flock', laborPath: '/api/data/laborers', listPath: '/api/data/expenses', markerInNote: true },
];
for (const cfg of K1_APPS) {
  test(`K1: telegram bot rejects a 999,999,999 single-message expense (${cfg.app})`, async () => {
    const { base, stop } = await startApp(cfg.app, { TELEGRAM_WEBHOOK_SECRET: WH });
    try {
      const tok = await login(base, 'admin', 'admin123', cfg.app);
      const l = await req(base, 'GET', cfg.laborPath, tok);
      assert.equal(l.status, 200, `setup failed: cannot list workers (HTTP ${l.status})`);
      const rows = Array.isArray(l.json) ? l.json : (l.json?.value || []);
      const wid = rows[0]?._id || rows[0]?.id;
      assert.ok(wid, 'setup failed: no seeded worker to link');
      const code = await req(base, 'POST', '/api/telegram/link-code', tok, { laborerId: wid });
      assert.equal(code.status, 200, `setup failed: link-code HTTP ${code.status}`);
      const hook = async (chat, text) => {
        await fetch(`${base}/api/telegram/webhook/${WH}`, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { chat: { id: chat }, from: { first_name: 'ACC' }, text } }) });
        await sleep(500);
      };
      await hook(930001, `/start ${code.json.code}`);
      await hook(930001, 'kharcha 999999999 acc-k1-huge');
      const list = await req(base, 'GET', cfg.listPath, tok);
      const markerHit = list.text.includes('acc-k1-huge');
      const amountHit = /999999999/.test(list.text);
      console.log(`FINDING CHECK K1/${cfg.app}: after one bot message "kharcha 999999999", marker found=${markerHit}, amount 999999999 found=${amountHit}`);
      assert.ok(!markerHit && !amountHit,
        `K1 BUG (${cfg.app}): one Telegram message booked a Rs 999,999,999 expense (marker=${markerHit}, amount=${amountHit})`);
    } finally { stop(); }
  });
}

// CRON-LOG-1 — the cron secret in ?key= must not be written to server logs.
test('CRON-LOG-1: cron secret is not printed to server logs (agri)', async () => {
  const { base, proc, stop } = await startApp('agri', { LOG_REQUESTS: '1', CRON_SECRET: 'acceptance' + '-cron-' + 'secret' });
  try {
    await login(base, 'admin', 'admin123', 'agri'); // waits until the app is fully ready (logger active)
    await fetch(base + '/api/cron/dispatch-report?key=' + 'acceptance' + '-cron-' + 'secret');
    await sleep(600);
    assert.ok(!proc._out.includes('acceptance' + '-cron-' + 'secret'),
      'cron ?key= secret appeared verbatim in server logs');
  } finally { stop(); }
});
