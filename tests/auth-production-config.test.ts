import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
});
