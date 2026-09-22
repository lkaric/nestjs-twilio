/**
 * Write package.json stubs to dist/cjs and dist/esm to mark module type.
 * Runs after tsc to ensure dist/ directories exist.
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const distRoot = new URL('../dist', import.meta.url).pathname;

const cjsStub = {
  type: 'commonjs',
};

const esmStub = {
  type: 'module',
};

writeFileSync(
  resolve(distRoot, 'cjs', 'package.json'),
  JSON.stringify(cjsStub, null, 2) + '\n',
  'utf8'
);
writeFileSync(
  resolve(distRoot, 'esm', 'package.json'),
  JSON.stringify(esmStub, null, 2) + '\n',
  'utf8'
);

console.log('✓ dist/cjs/package.json');
console.log('✓ dist/esm/package.json');
