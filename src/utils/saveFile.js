/**
 * Save a JSON-serializable value to a file the user picks.
 *
 * Where the File System Access API is available (Chromium-based browsers) the
 * user gets a native "Save As" dialog and can choose the destination folder and
 * filename. Elsewhere (Firefox, Safari) it falls back to a standard download to
 * the browser's default download location.
 *
 * @param {string} suggestedName - default filename, e.g. "job-tracker-backup.json"
 * @param {unknown} data - value to serialize as pretty-printed JSON
 * @returns {Promise<boolean>} true if saved, false if the user cancelled the picker
 */
export async function saveJsonFile(suggestedName, data) {
  // Prefix a UTF-8 BOM so apps that don't sniff the encoding (Windows Notepad,
  // Excel) render non-Latin text (Hebrew, etc.) correctly instead of as mojibake.
  const json = '\ufeff' + JSON.stringify(data, null, 2);

  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') return false;
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
