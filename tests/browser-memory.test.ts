import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test.each(['https://example.com', 'http://127.0.0.1.example.com:4173', 'http://user:secret@localhost:4173'])('memory harness rejects non-local or credentialed preview before browser launch: %s', url => {
  let stderr = '';
  try {
    execFileSync(process.execPath, ['scripts/measure-browser-memory.mjs'], {
      env: {...process.env, ASTRALYS_BASE_URL:url}, stdio:'pipe', timeout:10_000,
    });
  } catch (error) { stderr = String((error as {stderr:Buffer}).stderr); }
  expect(stderr).toContain('must be an HTTP loopback preview');
  expect(stderr).not.toContain('browserType.launch');
});
