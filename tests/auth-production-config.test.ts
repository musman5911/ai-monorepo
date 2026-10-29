import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(__dirname, '..');
const source = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

describe('production JWT configuration guards', () => {
  it('Dairy refuses to start in production without JWT_SECRET', () => {
    const auth = source('dairy_farm/backend/middleware/auth.js');
    expect(auth).toContain("MUF_ENV.nodeEnv === 'production' ? null");
    expect(auth).toContain('if (!SECRET)');
    expect(auth).toContain('process.exit(1)');
  });

  it('Flock refuses to start in production without JWT_SECRET', () => {
    const server = source('flock_farm/backend/server.js');
    expect(server).toContain("if (isProd)");
    expect(server).toContain('!MUF_ENV.jwtSecret');
    expect(server).toContain('process.exit(1)');
  });

  it('all three apps refuse demo memory mode in production', () => {
    for (const app of ['dairy_farm', 'flock_farm', 'agri_farm']) {
      const db = source(`${app}/backend/db.js`);
      expect(db).toContain("MUF_ENV.nodeEnv === 'production'");
      expect(db).toContain('MEMORY_MODE is not allowed in production. Configure MONGO_URI.');
      expect(db).toContain('process.exit(1)');
    }
  });

  it('Agri refuses to fall back to a generated local JWT secret in production', () => {
    const auth = source('agri_farm/backend/middleware/auth.js');
    expect(auth).toContain("MUF_ENV.nodeEnv === 'production' && !SECRET");
    expect(auth).toContain('JWT_SECRET must be set to a strong non-default value in production.');
    expect(auth).toContain('process.exit(1)');
  });
  it('Agri rejects deactivated users even when their JWT is still valid', () => {
    const auth = source('agri_farm/backend/middleware/auth.js');
    expect(auth).toContain('const user = await findUserForSub(sub);');
    expect(auth).toContain('return user && user.active !== false ? user : null;');
  });

});


describe('mufTestRateLimitMax', () => {
  const runWithEnv = (values: Record<string, string | undefined>, raw: string) => {
    const envPrefix = Object.entries(values)
      .map(([key, value]) => value === undefined
        ? `delete process.env[${JSON.stringify(key)}];`
        : `process.env[${JSON.stringify(key)}] = ${JSON.stringify(value)};`)
      .join('');
    const script = `${envPrefix} const mod = await import('./dairy_farm/backend/muf-env.mjs?case=' + Math.random()); console.log(mod.mufTestRateLimitMax(60));`;
    return Number(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env: { ...process.env, MUF_TEST_RATE_LIMIT_MAX: raw },
    }).trim());
  };

  it('keeps the default in production or outside memory mode', () => {
    expect(runWithEnv({ NODE_ENV: 'production', MEMORY_MODE: '1' }, '200')).toBe(60);
    expect(runWithEnv({ NODE_ENV: 'test', MEMORY_MODE: '0' }, '200')).toBe(60);
    expect(runWithEnv({ NODE_ENV: 'development', MEMORY_MODE: '1' }, '200')).toBe(60);
  });

  it('uses the requested value only in test memory mode and caps it at one million', () => {
    expect(runWithEnv({ NODE_ENV: 'test', MEMORY_MODE: '1' }, '200')).toBe(200);
    expect(runWithEnv({ NODE_ENV: 'test', MEMORY_MODE: '1' }, '1000001')).toBe(1000000);
    expect(runWithEnv({ NODE_ENV: 'test', MEMORY_MODE: '1' }, 'not-a-number')).toBe(60);
    expect(runWithEnv({ NODE_ENV: 'test', MEMORY_MODE: '1' }, '0')).toBe(60);
  });
});
