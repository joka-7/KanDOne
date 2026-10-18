import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** { directive: sorted sources } for a CSP string. */
function parse(csp) {
  return Object.fromEntries(
    csp.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name, ...sources] = part.split(/\s+/);
      return [name, sources.sort()];
    }),
  );
}

function metaPolicy() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  return parse(html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1]);
}

function headerPolicy() {
  const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const header = config.headers.flatMap((rule) => rule.headers).find((h) => h.key === 'Content-Security-Policy');
  return parse(header.value);
}

// The Android app ships inside the APK and is served without Vercel's headers,
// so the <meta> policy is the only one it gets. Browsers get both.
describe('Content-Security-Policy', () => {
  it('is the same in index.html and the Vercel header, apart from the directives a meta tag cannot carry', () => {
    const header = headerPolicy();
    delete header['frame-ancestors'];

    expect(metaPolicy()).toEqual(header);
  });

  it.each([
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['img-src', ["'self'", 'data:']],
  ])('%s is locked down in both', (directive, sources) => {
    expect(metaPolicy()[directive]).toEqual([...sources].sort());
    expect(headerPolicy()[directive]).toEqual([...sources].sort());
  });

  it('forbids framing and inline or eval scripts in the header', () => {
    const policy = headerPolicy();

    expect(policy['frame-ancestors']).toEqual(["'none'"]);
    expect(policy['script-src']).not.toContain("'unsafe-inline'");
    expect(policy['script-src']).not.toContain("'unsafe-eval'");
  });
});
