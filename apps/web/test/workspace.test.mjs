import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(workspaceRoot, 'package.json'), 'utf8'),
);
const source = readFileSync(join(workspaceRoot, 'src/index.ts'), 'utf8');

test('apps/web has a typed workspace entry point', () => {
  assert.equal(packageJson.name, '@dayloop/web');
  assert.match(source, /export const workspace = '@dayloop\/web';/);
});
