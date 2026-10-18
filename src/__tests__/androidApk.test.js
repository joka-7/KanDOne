import { describe, it, expect } from 'vitest';
import { ANDROID_APK_URL, isAndroidBrowser } from '../utils/androidApk';

describe('ANDROID_APK_URL', () => {
  it('points at the latest release asset the Android workflow publishes', () => {
    expect(ANDROID_APK_URL).toBe('https://github.com/joka-7/KanDOne/releases/latest/download/KanDOne.apk');
  });
});

describe('isAndroidBrowser', () => {
  it.each([
    ['Chrome on an Android phone', 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', true],
    ['Firefox on an Android tablet', 'Mozilla/5.0 (Android 13; Tablet; rv:128.0) Gecko/128.0 Firefox/128.0', true],
    ['Samsung Internet', 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36', true],
    ['Safari on an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', false],
    ['Chrome on Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', false],
    ['Chrome on desktop Linux', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', false],
    ['an empty user agent', '', false],
    ['a missing user agent', undefined, false],
  ])('%s → %s', (_label, userAgent, expected) => {
    expect(isAndroidBrowser(userAgent)).toBe(expected);
  });
});
