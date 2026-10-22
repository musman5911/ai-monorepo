#!/usr/bin/env node
/**
 * Runtime smoke test for the development-only MUF visual workbench.
 *
 * Start the Dairy Vite dev server in one terminal, then run:
 *   node tools/check-muf-workbench-runtime.js
 *
 * Uses Node's built-in fetch; no extra package or database is required.
 */
'use strict';

const routePath = '/__muf-workbench';
const editorModulePath = '/src/editing-x-projetcs.tsx';
const stylesheetPath = '/src/muf-workbench.css';
const viteClientPath = '/@vite/client';
const reactRefreshPath = '/@react-refresh';
const baseUrl = new URL(process.env.MUF_WORKBENCH_URL || 'http://127.0.0.1:5000');
const timeoutMs = Number(process.env.MUF_WORKBENCH_TIMEOUT_MS || 5000);
let passed = 0;

function check(condition, message) {
  if (!condition) throw new Error(message);
  passed += 1;
  console.log('  ✓ ' + message);
}

function makeUrl(pathname) {
  return new URL(pathname, baseUrl).toString();
}

async function get(pathname, label) {
  const url = makeUrl(pathname);
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      'Could not reach ' + label + ' at ' + url +
      '. Start the Dairy Vite dev server on port 5000 first. Details: ' + detail
    );
  }
  if (!response.ok) {
    throw new Error(label + ' returned HTTP ' + response.status + ' at ' + url);
  }
  return response;
}

async function main() {
  console.log('\nMUF workbench runtime smoke test');
  console.log('  Base URL: ' + baseUrl.origin);

  const pageResponse = await get(routePath, 'workbench page');
  const contentType = pageResponse.headers.get('content-type') || '';
  const html = await pageResponse.text();
  check(contentType.includes('text/html'), 'workbench route responds with HTML');
  check(html.includes('id="muf-workbench-root"'), 'workbench mount point is present');
  check(
    /<script\b[^>]*type=["']module["'][^>]*src=["']\/src\/editing-x-projetcs\.tsx["'][^>]*>/i.test(html),
    'workbench editor module is referenced'
  );
  check(
    html.includes(viteClientPath) && html.includes(reactRefreshPath),
    'Vite client and React refresh are injected into the custom HTML'
  );

  const editorResponse = await get(editorModulePath, 'workbench editor module');
  const editorType = editorResponse.headers.get('content-type') || '';
  const editorSource = await editorResponse.text();
  check(/javascript/i.test(editorType), 'editor TSX is transformed and served as JavaScript');
  check(
    editorSource.includes('createRoot') &&
    editorSource.includes('muf-visual-workbench-draft-v2') &&
    !/Internal Server Error|Failed to resolve import|Could not resolve/i.test(editorSource),
    'editor module compiles and contains the expected mount/draft code'
  );

  const cssResponse = await get(stylesheetPath, 'workbench stylesheet');
  const cssSource = await cssResponse.text();
  check(
    !/Internal Server Error|Failed to resolve import|Could not resolve/i.test(cssSource),
    'workbench stylesheet is served without a transform error'
  );

  await get(viteClientPath, 'Vite client runtime');
  await get(reactRefreshPath, 'React refresh runtime');
  check(true, 'Vite client and React refresh endpoints return HTTP 200');

  console.log('\nAll ' + passed + ' workbench runtime checks passed.');
}

main().catch(error => {
  console.error('\nFAIL: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
