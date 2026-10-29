import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const backends = [
  { app: 'dairy', modulePath: fileURLToPath(new URL('../dairy_farm/backend/muf-env.mjs', import.meta.url)) },
  { app: 'agri', modulePath: fileURLToPath(new URL('../agri_farm/backend/muf-env.mjs', import.meta.url)) },
  { app: 'flock', modulePath: fileURLToPath(new URL('../flock_farm/backend/muf-env.mjs', import.meta.url)) },
];

const cases = [
  {
    name: 'keeps the default in production even when an override is requested',
    nodeEnv: 'production',
    memoryMode: '1',
    requested: '41',
    expected: 17,
  },
  {
    name: 'keeps the default when memory mode is disabled',
    nodeEnv: 'test',
    memoryMode: '0',
    requested: '41',
    expected: 17,
  },
  {
    name: 'uses the requested value in memory mode with NODE_ENV=test',
    nodeEnv: 'test',
    memoryMode: '1',
    requested: '73',
    expected: 73,
  },
  {
    name: 'caps the requested value at 1,000,000',
    nodeEnv: 'test',
    memoryMode: '1',
    requested: '1000001',
    expected: 1000000,
  },
];

const evaluateScript = `
  import { pathToFileURL } from 'node:url';
  const mod = await import(pathToFileURL(process.env.MUF_ENV_TEST_MODULE).href);
  process.stdout.write(String(mod.mufTestRateLimitMax(Number(process.env.MUF_ENV_DEFAULT_MAX))));
`;

function evaluate(modulePath, testCase) {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', evaluateScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: testCase.nodeEnv,
      MEMORY_MODE: testCase.memoryMode,
      ALLOW_MEMORY_MODE: '',
      MUF_TEST_RATE_LIMIT_MAX: testCase.requested,
      MUF_ENV_TEST_MODULE: modulePath,
      MUF_ENV_DEFAULT_MAX: '17',
    },
  });
  return Number(output);
}

describe.each(backends)('$app mufTestRateLimitMax', ({ modulePath }) => {
  it.each(cases)('$name', (testCase) => {
    expect(evaluate(modulePath, testCase)).toBe(testCase.expected);
  });
});
