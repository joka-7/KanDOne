// Regenerates the Android launcher icon layers and splash screens from one
// drawing, so the icon fills its mask (no light corners) and the glyph is big.
// Run: node scripts/gen-android-icons.mjs   (needs Playwright's Chromium)
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const RES = 'android/app/src/main/res';
const GRADIENT = `<linearGradient id="g" x1="0.1" y1="1" x2="0.9" y2="0">
  <stop offset="0" stop-color="#1D7FE0"/><stop offset="0.5" stop-color="#14B8A6"/><stop offset="1" stop-color="#5EDC82"/></linearGradient>`;

// The glyph is drawn on a 108-unit canvas and stays inside the 66-unit safe
// zone Android guarantees to keep visible under any mask.
const GLYPH = `
  <rect x="25" y="31" width="16" height="46" rx="4" fill="#fff" fill-opacity=".38"/>
  <rect x="46" y="31" width="16" height="46" rx="4" fill="#fff" fill-opacity=".5"/>
  <rect x="67" y="31" width="16" height="46" rx="4" fill="#fff" fill-opacity=".85"/>
  <path d="M26 76 C31 58 40 52 52 52" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
  <path d="M49 42 L61 52 L49 62 Z" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="77" cy="52" r="13" fill="#22C55E" stroke="#fff" stroke-width="3.5"/>
  <path d="M70.5 52.5 L75 57 L83 47" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;
const layer = (size, inner) => svg(size, size, `<defs>${GRADIENT}</defs><svg viewBox="0 0 108 108" width="${size}" height="${size}">${inner}</svg>`);

const foreground = (size) => layer(size, GLYPH);
const background = (size) => layer(size, '<rect width="108" height="108" fill="url(#g)"/>');
const legacy = (size, round) => layer(size, `<clipPath id="c">${round
  ? '<circle cx="54" cy="54" r="54"/>' : '<rect width="108" height="108" rx="24"/>'}</clipPath>
  <g clip-path="url(#c)"><rect width="108" height="108" fill="url(#g)"/><g transform="translate(54 54) scale(1.25) translate(-54 -54)">${GLYPH}</g></g>`);
const splash = (w, h) => {
  const glyph = Math.round(Math.min(w * 0.9, h * 0.62));
  const font = Math.round(glyph * 0.2);
  const centerY = h * 0.42;
  const y = Math.round(centerY - glyph / 2);
  const x = Math.round((w - glyph) / 2);
  const baseline = Math.round(centerY + glyph * 0.38 + font * 1.3);
  return svg(w, h, `<defs>${GRADIENT}</defs><rect width="${w}" height="${h}" fill="url(#g)"/>
    <svg x="${x}" y="${y}" viewBox="0 0 108 108" width="${glyph}" height="${glyph}">${GLYPH}</svg>
    <text x="${w / 2}" y="${baseline}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
      font-weight="800" font-size="${font}" fill="#fff">KanDOne</text>`);
};

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const jobs = [];
for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = `${RES}/mipmap-${name}`;
  jobs.push([`${dir}/ic_launcher_foreground.png`, foreground(108 * scale), 108 * scale, true]);
  jobs.push([`${dir}/ic_launcher_background.png`, background(108 * scale), 108 * scale, false]);
  jobs.push([`${dir}/ic_launcher.png`, legacy(48 * scale, false), 48 * scale, true]);
  jobs.push([`${dir}/ic_launcher_round.png`, legacy(48 * scale, true), 48 * scale, true]);
}
const SPLASH_SIZES = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [name, [shortSide, longSide]] of Object.entries(SPLASH_SIZES)) {
  jobs.push([`${RES}/drawable-port-${name}/splash.png`, splash(shortSide, longSide), [shortSide, longSide], false]);
  jobs.push([`${RES}/drawable-land-${name}/splash.png`, splash(longSide, shortSide), [longSide, shortSide], false]);
}
jobs.push([`${RES}/drawable/splash.png`, splash(480, 320), [480, 320], false]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const [file, markup, size, transparent] of jobs) {
  const [w, h] = Array.isArray(size) ? size : [size, size];
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<body style="margin:0">${markup}</body>`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } }));
}
await browser.close();
