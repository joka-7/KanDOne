import { describe, it, expect } from 'vitest';
import {
  chunkFileName, checkPrecache, NATIVE_ONLY_PRECACHE_IGNORES,
} from '../../scripts/pwa-chunks.js';

const PLUGIN = '/repo/node_modules/@capgo/capacitor-social-login/dist/esm';

describe('chunkFileName', () => {
  it.each([
    ['the plugin entry', [`${PLUGIN}/index.js`], 'assets/social-login-[hash].js'],
    ['the plugin web provider', [`${PLUGIN}/web.js`, `${PLUGIN}/helpers.js`], 'assets/social-login-[hash].js'],
    ['the plugin on Windows', ['C:\\repo\\node_modules\\@capgo\\capacitor-social-login\\dist\\esm\\index.js'], 'assets/social-login-[hash].js'],
    ['an app module', ['/repo/src/TasksApp.jsx'], 'assets/[name]-[hash].js'],
    ['another dependency', ['/repo/node_modules/react-dom/index.js'], 'assets/[name]-[hash].js'],
    ['the plugin with the tslib helpers only it uses', ['/repo/node_modules/tslib/tslib.es6.mjs', `${PLUGIN}/index.js`], 'assets/social-login-[hash].js'],
    ['tslib on Windows with the plugin', ['C:\\repo\\node_modules\\tslib\\tslib.es6.mjs', `${PLUGIN}/index.js`], 'assets/social-login-[hash].js'],
    ['a chunk mixing the plugin with app code, which web pages may load', ['/repo/src/driveSync.js', `${PLUGIN}/index.js`], 'assets/[name]-[hash].js'],
    ['a chunk mixing the plugin with another dependency', ['/repo/node_modules/react-dom/index.js', `${PLUGIN}/index.js`], 'assets/[name]-[hash].js'],
    ['tslib alone', ['/repo/node_modules/tslib/tslib.es6.mjs'], 'assets/[name]-[hash].js'],
    ['a package whose name only starts like the plugin', ['/repo/node_modules/@capgo/capacitor-social-login-docs/index.js'], 'assets/[name]-[hash].js'],
    ['no modules', [], 'assets/[name]-[hash].js'],
  ])('names the chunk for %s', (_label, moduleIds, expected) => {
    expect(chunkFileName({ moduleIds })).toBe(expected);
  });
});

describe('NATIVE_ONLY_PRECACHE_IGNORES', () => {
  it('ignores the chunks chunkFileName gives that prefix', () => {
    expect(NATIVE_ONLY_PRECACHE_IGNORES).toEqual(['**/social-login-*.js']);
  });
});

describe('checkPrecache', () => {
  const sw = (...urls) => `precacheAndRoute([${urls.map((url) => `{url:"${url}",revision:null}`).join(',')}])`;
  const build = (overrides = {}) => ({
    swSource: sw('index.html', 'assets/index-AAA.js', 'assets/ChatModal-BBB.js'),
    assets: {
      'index-AAA.js': 'const lazy=()=>import("./social-login-CCC.js");export{lazy}',
      'ChatModal-BBB.js': 'import{a as e}from"./index-AAA.js";export{e}',
      'social-login-CCC.js': 'import{a as e}from"./index-AAA.js";export{e}',
      ...overrides.assets,
    },
    ...(overrides.swSource ? { swSource: overrides.swSource } : {}),
  });

  it('accepts a build where the plugin chunks exist, are not precached and are only loaded on demand', () => {
    expect(checkPrecache(build())).toEqual([]);
  });

  it.each([
    [
      'the service worker precaches a plugin chunk',
      build({ swSource: sw('index.html', 'assets/social-login-CCC.js') }),
      /precache.*social-login-CCC\.js/i,
    ],
    [
      'the web app statically imports a plugin chunk, so it would load without being precached',
      build({ assets: { 'ChatModal-BBB.js': 'import{x as e}from"./social-login-CCC.js";export{e}' } }),
      /ChatModal-BBB\.js.*social-login-CCC\.js/,
    ],
    [
      'a bare static import of a plugin chunk',
      build({ assets: { 'ChatModal-BBB.js': 'import"./social-login-CCC.js";' } }),
      /ChatModal-BBB\.js.*social-login-CCC\.js/,
    ],
    [
      'no plugin chunk was built, so the exclusion would silently match nothing',
      build({ assets: { 'social-login-CCC.js': undefined } }),
      /no social-login chunk/i,
    ],
  ])('reports a problem when %s', (_label, input, expected) => {
    const problems = checkPrecache(input);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(expected);
  });

  it('reports every web chunk that statically imports a plugin chunk, not just the first', () => {
    const input = build({
      assets: {
        'ChatModal-BBB.js': 'import{x as e}from"./social-login-CCC.js";export{e}',
        'Onboarding-EEE.js': 'import{y as e}from"./social-login-CCC.js";import{z as t}from"./social-login-DDD.js";export{e,t}',
        'social-login-DDD.js': 'export const z=1',
      },
    });

    const problems = checkPrecache(input);

    expect(problems).toHaveLength(3);
    expect(problems.join('\n')).toMatch(/ChatModal-BBB\.js[\s\S]*Onboarding-EEE\.js[\s\S]*Onboarding-EEE\.js/);
  });

  it('lets plugin chunks import each other', () => {
    const input = build({ assets: { 'social-login-DDD.js': 'import{x as e}from"./social-login-CCC.js";export{e}' } });

    expect(checkPrecache(input)).toEqual([]);
  });
});
