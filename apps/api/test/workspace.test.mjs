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

test('apps/api has a typed workspace entry point', () => {
  assert.equal(packageJson.name, '@dayloop/api');
  assert.match(source, /export const workspace = '@dayloop\/api';/);
});
