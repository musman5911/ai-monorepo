import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const source = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

describe('Dairy API request budget', () => {
  it('allows normal multi-screen browsing while retaining dedicated auth limits', () => {
    const server = source('dairy_farm/backend/server.js');
    const auth = source('dairy_farm/backend/routes/auth.js');

    expect(server).toContain('max: mufTestRateLimitMax(1200)');
    expect(server).toContain('windowMs: 15 * 60 * 1000');
    expect(auth).toContain('max: mufTestRateLimitMax(5)'); // login and reset
    expect(auth).toContain('max: mufTestRateLimitMax(3)'); // first-owner setup
    expect(auth).toContain('max: mufTestRateLimitMax(20)'); // user management
  });

  it('does not re-fetch shared header indicators on every tab change', () => {
    const app = source('dairy_farm/client/src/App.tsx');
    const indicatorBlock = app.split('const [healthAlerts')[1]?.split('const notifications = useMemo')[0] || '';

    expect(indicatorBlock).toContain('api.getUpcomingHealth()');
    expect(indicatorBlock).toContain('api.getMilk({ from: today, to: today })');
    expect(indicatorBlock).toContain('}, [token]);');
    expect(indicatorBlock).not.toContain('[token, tab]');
  });
});
