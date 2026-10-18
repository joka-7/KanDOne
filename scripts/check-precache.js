/**
 * Fails the build when the Android sign-in plugin would be precached by the web
 * service worker (or the exclusion stopped matching). Run after `npm run build`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPrecache } from './pwa-chunks.js';

const dist = join(import.meta.dirname, '..', 'dist');
const assetsDir = join(dist, 'assets');

const assets = Object.fromEntries(
  readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => [name, readFileSync(join(assetsDir, name), 'utf8')]),
);

const problems = checkPrecache({ swSource: readFileSync(join(dist, 'sw.js'), 'utf8'), assets });

if (problems.length > 0) {
  console.error(problems.map((problem) => `check-precache: ${problem}`).join('\n'));
  process.exit(1);
}
console.log('check-precache: ok');
