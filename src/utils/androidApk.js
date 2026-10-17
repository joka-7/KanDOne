/**
 * The Android app is published as a GitHub release by `.github/workflows/android.yml`.
 * `latest/download/<asset>` always resolves to the newest release's file, so the
 * link needs no version number.
 */
export const ANDROID_APK_URL = 'https://github.com/joka-7/KanDOne/releases/latest/download/KanDOne.apk';

/**
 * True in a browser running on Android, the only place the APK can be installed.
 * Used to offer it on the website; the Android app itself never shows the offer.
 */
export function isAndroidBrowser(userAgent) {
  return typeof userAgent === 'string' && /Android/i.test(userAgent);
}
