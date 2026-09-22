/**
 * Verify the published artifacts actually load, in both module systems.
 *
 * `tsc`, `publint` and `attw` all pass on builds that throw the moment Node
 * imports them: tsc only checks types, publint only checks the manifest, and
 * attw only checks type resolution. Two real defects slipped past all three —
 * a directory specifier in the ESM barrel, and a named value import from a
 * CommonJS dependency that cjs-module-lexer cannot resolve. Only loading the
 * output catches those.
 *
 * Run against the engines floor so the advertised minimum is exercised too.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = process.cwd();
const require = createRequire(pathToFileURL(resolve(root, 'package.json')));

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};

const cjs = require('./dist/cjs/index.js');
const esm = await import(pathToFileURL(resolve(root, 'dist/esm/index.js')).href);

const cjsKeys = Object.keys(cjs).sort();
const esmKeys = Object.keys(esm)
  .filter((key) => key !== 'default')
  .sort();

if (cjsKeys.length === 0) fail('the CommonJS build exports nothing');
if (esmKeys.length === 0) fail('the ES module build exports nothing');

// TwilioModule is the entry point the package has exported since v1; if it is
// missing, the barrel is broken regardless of what else resolved.
if (!cjsKeys.includes('TwilioModule')) fail('the CommonJS build does not export TwilioModule');
if (!esmKeys.includes('TwilioModule')) fail('the ES module build does not export TwilioModule');

const onlyCjs = cjsKeys.filter((key) => !esmKeys.includes(key));
const onlyEsm = esmKeys.filter((key) => !cjsKeys.includes(key));

if (onlyCjs.length > 0) fail(`exported only by the CommonJS build: ${onlyCjs.join(', ')}`);
if (onlyEsm.length > 0) fail(`exported only by the ES module build: ${onlyEsm.join(', ')}`);

// `@nestjs/terminus` is an optional peer, so the health indicator lives behind
// the `nestjs-twilio/terminus` subpath. If the root entry ever pulled it in,
// importing this package would throw for every consumer who has not installed
// Terminus. `require.cache` holds the full CommonJS graph loaded above, so a
// regression shows up here.
const loadedTerminus = Object.keys(require.cache).some((file) => file.includes('@nestjs/terminus'));

if (loadedTerminus) {
  fail('the root entry pulled in @nestjs/terminus, which is an optional peer');
}

if (process.exitCode === 1) {
  console.error('\nThe two builds are not interchangeable. Consumers will see different APIs.');
  process.exit(1);
}

console.log(`✓ dual build loads on Node ${process.versions.node}`);
console.log(`✓ export surfaces match (${cjsKeys.length}): ${cjsKeys.join(', ')}`);
