import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import DataStore from '../models/DataStore.js';
import { acquireEggInventoryLock, FLOCK_EGG_INVENTORY_LOCK_KEY } from '../egg-inventory-lock.mjs';

const REQUIRED_DATABASE = 'muf_phase19_flock_lock_ci';
const uri = process.env.MUF_PHASE19_FLOCK_LOCK_URI || '';
const farmId = process.env.MUF_PHASE19_FLOCK_LOCK_FARM_ID || '';
const parsed = (() => {
  try { return new URL(uri); } catch { return null; }
})();

if (!parsed || !['localhost', '127.0.0.1'].includes(parsed.hostname)
    || parsed.pathname !== '/' + REQUIRED_DATABASE
    || parsed.username || parsed.password) {
  throw new Error('Refusing to run: this check only permits the dedicated localhost Phase 19 CI database.');
}
if (farmId !== 'phase19-ci-farm') {
  throw new Error('Refusing to run: the expected disposable CI farm ID was not supplied.');
}

const scriptPath = fileURLToPath(import.meta.url);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function worker(mode) {
  await connect();
  try {
    if (mode === 'hold') {
      const release = await acquireEggInventoryLock(DataStore, farmId);
      process.stdout.write('LOCK_HELD\n');
      await sleep(4500);
      await release();
      process.stdout.write('LOCK_RELEASED\n');
      return;
    }
    if (mode === 'busy') {
      try {
        const release = await acquireEggInventoryLock(DataStore, farmId);
        await release();
        throw new Error('Second process unexpectedly acquired a lock already held by the first process.');
      } catch (error) {
        if (error?.code !== 'EGG_INVENTORY_BUSY') throw error;
        process.stdout.write('LOCK_BUSY_CONFIRMED\n');
        return;
      }
    }
    if (mode === 'after-release') {
      const release = await acquireEggInventoryLock(DataStore, farmId);
      await release();
      process.stdout.write('LOCK_REACQUIRED_AFTER_RELEASE\n');
      return;
    }
    throw new Error('Unknown worker mode.');
  } finally {
    await mongoose.disconnect();
  }
}

function startWorker(mode) {
  const child = spawn(process.execPath, [scriptPath, '--worker', mode], {
    cwd: path.dirname(scriptPath),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return { child, get stdout() { return stdout; }, get stderr() { return stderr; } };
}

async function waitForOutput(workerProcess, marker, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (workerProcess.stdout.includes(marker)) return;
    if (workerProcess.child.exitCode !== null) {
      throw new Error('Worker exited before ' + marker + '. stdout=' + workerProcess.stdout + ' stderr=' + workerProcess.stderr);
    }
    await sleep(25);
  }
  workerProcess.child.kill('SIGKILL');
  throw new Error('Timed out waiting for ' + marker + '. stdout=' + workerProcess.stdout + ' stderr=' + workerProcess.stderr);
}

function waitForExit(workerProcess, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (workerProcess.child.exitCode !== null) {
      resolve(workerProcess.child.exitCode);
      return;
    }
    const timer = setTimeout(() => {
      workerProcess.child.kill('SIGKILL');
      reject(new Error('Worker process did not exit in time.'));
    }, timeoutMs);
    workerProcess.child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    workerProcess.child.once('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function parent() {
  await connect();
  try {
    // Only create indexes and clear the exact test lock row in this disposable database.
    await DataStore.createIndexes();
    await DataStore.deleteMany({ farmId, key: FLOCK_EGG_INVENTORY_LOCK_KEY });
  } finally {
    await mongoose.disconnect();
  }

  const holder = startWorker('hold');
  try {
    await waitForOutput(holder, 'LOCK_HELD');
    const contender = startWorker('busy');
    await waitForOutput(contender, 'LOCK_BUSY_CONFIRMED');
    const contenderCode = await waitForExit(contender);
    if (contenderCode !== 0) {
      throw new Error('Contending process failed: ' + contender.stderr);
    }

    const holderCode = await waitForExit(holder);
    if (holderCode !== 0 || !holder.stdout.includes('LOCK_RELEASED')) {
      throw new Error('Lock holder did not release cleanly. stdout=' + holder.stdout + ' stderr=' + holder.stderr);
    }

    const afterRelease = startWorker('after-release');
    await waitForOutput(afterRelease, 'LOCK_REACQUIRED_AFTER_RELEASE');
    const afterReleaseCode = await waitForExit(afterRelease);
    if (afterReleaseCode !== 0) {
      throw new Error('Reacquisition process failed: ' + afterRelease.stderr);
    }

    console.log('PASS: independent process B was rejected while process A held the MongoDB lock.');
    console.log('PASS: a new process acquired and released the same farm lock after process A finished.');
  } finally {
    if (holder.child.exitCode === null) holder.child.kill('SIGKILL');
    await connect();
    try {
      await DataStore.deleteMany({ farmId, key: FLOCK_EGG_INVENTORY_LOCK_KEY });
    } finally {
      await mongoose.disconnect();
    }
  }
}

if (process.argv[2] === '--worker') {
  worker(process.argv[3]).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
} else {
  parent().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
