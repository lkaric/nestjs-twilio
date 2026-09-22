/**
 * Write the package.json stubs the published package needs.
 *
 * Two kinds:
 *
 * 1. `dist/cjs` and `dist/esm` each get a `type` marker, so Node reads each
 *    build as the format it was compiled to despite the ESM-first root
 *    manifest.
 * 2. Every subpath export gets a directory stub at the package root, so the
 *    legacy Node resolution algorithm can still find it. That algorithm
 *    ignores the `exports` map and resolves `nestjs-twilio/terminus` as a
 *    directory on disk; without the stub, `are-the-types-wrong` reports the
 *    subpath as unresolvable under node10.
 *
 * Runs after tsc, so the dist directories already exist.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const distRoot = resolve(packageRoot, 'dist');

/** Subpaths exported besides the package root. Keep in sync with `exports`. */
const SUBPATHS = ['terminus'];

const write = (path, contents) => {
  writeFileSync(path, `${JSON.stringify(contents, null, 2)}\n`, 'utf8');
  console.log(`✓ ${path.replace(packageRoot, '')}`);
};

write(resolve(distRoot, 'cjs', 'package.json'), { type: 'commonjs' });
write(resolve(distRoot, 'esm', 'package.json'), { type: 'module' });

for (const subpath of SUBPATHS) {
  const dir = resolve(packageRoot, subpath);
  mkdirSync(dir, { recursive: true });

  write(resolve(dir, 'package.json'), {
    // Legacy resolvers read these; modern ones use the root `exports` map and
    // never look here.
    main: `../dist/cjs/${subpath}/index.js`,
    module: `../dist/esm/${subpath}/index.js`,
    types: `../dist/cjs/${subpath}/index.d.ts`,
  });
}
