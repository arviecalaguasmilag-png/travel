import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('Server serves the new modules, health check and validated same-origin rate route', async t => {
  const child = spawn(process.execPath, ['server.mjs'], {cwd:new URL('../', import.meta.url), env:{...process.env, PORT:'0'}, stdio:['ignore','pipe','pipe']});
  t.after(() => child.kill());
  const [output] = await once(child.stdout, 'data');
  const base = output.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(base);
  for (const path of ['/', '/health', '/currency.js', '/place-actions.js', '/sw.js']) {
    const response = await fetch(base + path); assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  }
  const php = await fetch(base + '/api/rates?base=PHP'); assert.equal((await php.json()).rate, 1);
  assert.equal((await fetch(base + '/api/rates?base=bad')).status, 400);
  assert.equal((await fetch(base + '/api/rates?base=TWD', {method:'POST'})).status, 405);
  const head = await fetch(base + '/api/rates?base=PHP', {method:'HEAD'}); assert.equal(await head.text(), '');
});
