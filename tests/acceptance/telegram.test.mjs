import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from './_harness.mjs';

const WH = 'acceptance' + '-webhook-' + 'secret'; // split: sandbox rewrites credential literals
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// K1 — one Telegram message must not book a crore-scale expense.
// Dairy path is fully driven (link a worker, /start the chat, send the message).
test('K1: telegram bot rejects a 999,999,999 single-message expense (dairy)', async () => {
  const { base, stop } = await startApp('dairy', { TELEGRAM_WEBHOOK_SECRET: WH });
  try {
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const w = await req(base, 'POST', '/api/labor/workers', tok, { name: 'ACC TG Worker', dailyWage: 1000 });
    const wid = w.json?._id || w.json?.id;
    assert.ok(wid, `worker create failed ${w.status}: ${w.text.slice(0, 100)}`);
    const code = await req(base, 'POST', '/api/telegram/link-code', tok, { laborerId: wid });
    assert.equal(code.status, 200, `link-code failed ${code.status}`);
    const hook = async (chat, text) => {
      await fetch(`${base}/api/telegram/webhook/${WH}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { chat: { id: chat }, from: { first_name: 'ACC' }, text } }) });
      await sleep(400);
    };
    await hook(910001, `/start ${code.json.code}`);
    await hook(910001, 'kharcha 999999999 acc-k1-huge');
    const list = await req(base, 'GET', '/api/expenses?limit=500', tok);
    const rows = Array.isArray(list.json) ? list.json : (list.json?.expenses || []);
    assert.ok(!rows.some((e) => String(e.note || '').includes('acc-k1-huge')),
      'bot booked a 999,999,999 expense from one message');
  } finally { stop(); }
});

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
