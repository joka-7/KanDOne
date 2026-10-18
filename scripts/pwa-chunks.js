/**
 * Keeps the Android sign-in plugin out of the web app's service-worker precache.
 *
 * `@capgo/capacitor-social-login` is reached only from nativeGoogleAuth.js,
 * which the web build never calls (it runs only inside the Capacitor shell,
 * where the files ship in the APK and no service worker runs). Its chunks are
 * still emitted into dist/ for the APK, but precaching them made every web
 * visitor download code the page never loads.
 *
 * Build output hashes file names, so the chunks get a fixed prefix to exclude by.
 */

export const SOCIAL_LOGIN_CHUNK = 'social-login';

const SOCIAL_LOGIN_PACKAGE = '@capgo/capacitor-social-login';

// The one other module that ends up in the plugin's chunk: the TypeScript
// helpers its compiled code imports. Nothing else in the app uses them.
const PLUGIN_ONLY_DEPENDENCIES = ['tslib'];

const inPackage = (id, name) => id.replaceAll('\\', '/').includes(`/node_modules/${name}/`);

/** Workbox `globIgnores` for files only the Android app loads. */
export const NATIVE_ONLY_PRECACHE_IGNORES = [`**/${SOCIAL_LOGIN_CHUNK}-*.js`];

/**
 * Rollup/Rolldown `output.chunkFileNames`: a chunk made only of the plugin (and
 * the helpers only it uses) is named `social-login-<hash>.js`; every other chunk
 * keeps the default name. A chunk that also holds anything the web app might
 * load is deliberately not renamed: it stays precached, which wastes a little
 * space but can never leave a web page without a file it needs.
 *
 * @param {{ moduleIds: string[] }} chunk
 */
export function chunkFileName(chunk) {
  const pluginOnly = chunk.moduleIds.some((id) => inPackage(id, SOCIAL_LOGIN_PACKAGE))
    && chunk.moduleIds.every((id) => inPackage(id, SOCIAL_LOGIN_PACKAGE)
      || PLUGIN_ONLY_DEPENDENCIES.some((name) => inPackage(id, name)));
  return pluginOnly ? `assets/${SOCIAL_LOGIN_CHUNK}-[hash].js` : 'assets/[name]-[hash].js';
}

const isPluginChunk = (name) => name.startsWith(`${SOCIAL_LOGIN_CHUNK}-`);

// `from"./social-login-x.js"` and `import"./social-login-x.js"` run when the
// importing file loads; `import("./social-login-x.js")` runs only on demand.
const STATIC_IMPORT = new RegExp(`(?:from|import)\\s*["']\\./(${SOCIAL_LOGIN_CHUNK}-[^"']+)["']`, 'g');

/**
 * Check a finished build for the ways the exclusion above can quietly stop working.
 *
 * @param {{ swSource: string, assets: Record<string, string | undefined> }} build
 *   `swSource` is dist/sw.js; `assets` maps each file name under dist/assets to its source.
 * @returns {string[]} what is wrong; empty when the build is fine
 */
export function checkPrecache({ swSource, assets }) {
  const files = Object.entries(assets).filter(([, source]) => typeof source === 'string');
  const problems = [];

  if (!files.some(([name]) => isPluginChunk(name))) {
    problems.push(
      `No ${SOCIAL_LOGIN_CHUNK} chunk was built, so the precache exclusion matches nothing. `
      + 'Check chunkFileNames in vite.config.js.',
    );
  }

  const precached = [...swSource.matchAll(/url:\s*"([^"]+)"/g)].map((match) => match[1]);
  for (const url of precached.filter((entry) => entry.split('/').pop().startsWith(`${SOCIAL_LOGIN_CHUNK}-`))) {
    problems.push(`The service worker precaches ${url}, which the web build never loads.`);
  }

  for (const [name, source] of files.filter(([fileName]) => !isPluginChunk(fileName))) {
    for (const [, imported] of source.matchAll(STATIC_IMPORT)) {
      problems.push(
        `${name} statically imports ${imported}, so the web app would load it without it being precached.`,
      );
    }
  }
  return problems;
}
