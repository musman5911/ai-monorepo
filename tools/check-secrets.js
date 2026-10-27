#!/usr/bin/env node
'use strict';

// Scan files tracked by Git. Local ignored .env files are intentionally excluded;
// a tracked .env file, private key, or recognizable credential fails the check.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const listed = spawnSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
if (listed.error || listed.status !== 0) {
  console.error(`Secret scan could not list tracked files: ${listed.error?.message || listed.stderr || 'git ls-files failed'}`);
  process.exit(2);
}

const findings = [];
const add = (file, reason) => findings.push(`${file}: ${reason}`);
const secretPatterns = [
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub access token', /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/],
  ['Telegram bot token', /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/],
  ['MongoDB URI with embedded credentials', /mongodb(?:\+srv)?:\/\/[^\s/:@]+:[^\s/@]+@/i],
  ['live Stripe secret key', /\bsk_live_[A-Za-z0-9]{20,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
];

const trackedPaths = listed.stdout.split('\0').filter(Boolean);
for (const relative of trackedPaths) {
  const normalized = relative.replace(/\\/g, '/');
  const base = path.posix.basename(normalized);
  if (/^\.env(?:\..+)?$/i.test(base) && !/^\.env\.example$/i.test(base)) {
    add(normalized, 'environment file is tracked; only .env.example templates may be committed');
    continue;
  }
  if (/\.(?:pem|p12|pfx)$/i.test(base) || /(?:^|\/)(?:id_rsa|id_ed25519)$/i.test(normalized)) {
    add(normalized, 'private-key or certificate file is tracked');
    continue;
  }
  if (/\.lock$/i.test(base) || /package-lock\.json$/i.test(base)) continue;

  const absolute = path.join(root, relative);
  let stat;
  try { stat = fs.statSync(absolute); } catch { continue; }
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;

  let content;
  try { content = fs.readFileSync(absolute, 'utf8'); } catch { continue; }
  if (content.includes('\u0000')) continue;

  for (const [label, pattern] of secretPatterns) {
    if (!pattern.test(content)) continue;
    // Public templates deliberately contain documented placeholders, not credentials.
    if (label === 'MongoDB URI with embedded credentials' && (content.includes('mongodb+srv://user:password@cluster.mongodb.net/') || content.includes('mongodb://user:password@cluster.mongodb.net/'))) continue;
    add(normalized, `possible ${label}`);
  }
}

if (findings.length) {
  console.error('\nSecret scan failed. Findings name files only; inspect locally and rotate any credential that was committed.');
  for (const finding of [...new Set(findings)]) console.error(`  ✗ ${finding}`);
  console.error('\nRemoving a secret from the current file does not remove it from Git history. Revoke/rotate exposed credentials.');
  process.exit(1);
}

console.log(`Secret scan passed: ${trackedPaths.length} tracked paths checked; no tracked .env files, private keys, or recognized credential patterns found.`);
