// Persistence: localStorage on the device, plus JSON backup export/import.
// Keys are prefixed "lists." because Routine lives on the same web address (lhmsousa2.github.io) and shares storage.
import { newState, validateState, migrate } from './model.js';

const KEY = 'lists.state.v1';
const BACKUP_KEY = 'lists.lastBackup';

// Returns { state, recovered }. recovered is true if unreadable data was found and set aside.
export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    console.error('Could not read saved data', e);
  }
  if (raw) {
    try {
      const s = migrate(JSON.parse(raw));
      if (validateState(s)) return { state: s, recovered: false };
    } catch {
      /* fall through */
    }
    // Never silently overwrite data we couldn't read: keep the raw copy aside (once), reachable from Settings.
    try {
      if (!recoveryCopies().some((c) => localStorage.getItem(c.key) === raw)) localStorage.setItem(`${KEY}.unreadable.${Date.now()}`, raw);
    } catch {
      /* storage full: nothing more we can do */
    }
    return { state: newState(), recovered: true };
  }
  return { state: newState(), recovered: false };
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Could not save', e);
    return false;
  }
}

// Keep a copy of the current data before it gets replaced by an import.
export function keepSafetyCopy(state, label) {
  try {
    localStorage.setItem(`${KEY}.before-${label}.${Date.now()}`, JSON.stringify(state));
  } catch {
    /* best effort */
  }
}

// Copies kept by load() (unreadable data) and keepSafetyCopy() (before an import), newest first.
export function recoveryCopies() {
  const out = [];
  try {
    for (let n = 0; n < localStorage.length; n++) {
      const key = localStorage.key(n);
      const m = key?.match(/^lists\.state\.v1\.(unreadable|before-import)\.(\d+)$/);
      if (m) out.push({ key, kind: m[1], ts: Number(m[2]) });
    }
  } catch {
    /* storage unavailable */
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function deleteRecoveryCopy(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* best effort */
  }
}

export function exportRecoveryCopy(key, dateLabel) {
  let raw = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    /* fall through */
  }
  if (raw == null) throw new Error('That copy is no longer on this phone.');
  const kind = key.includes('.unreadable.') ? 'unreadable' : 'before-import';
  return shareFile(`lists-${kind}-${dateLabel}.json`, raw);
}

// Ask the browser not to evict our data under storage pressure (best effort).
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}

export function lastBackup() {
  try {
    const n = Number(localStorage.getItem(BACKUP_KEY));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

function markBackup() {
  try {
    localStorage.setItem(BACKUP_KEY, String(Date.now()));
  } catch {
    /* best effort */
  }
}

export async function exportBackup(state, dateLabel) {
  const r = await shareFile(`lists-backup-${dateLabel}.json`, JSON.stringify(state, null, 2));
  if (r !== 'cancelled') markBackup();
  return r;
}

async function shareFile(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  // On iPhone this opens the share sheet (Save to Files, AirDrop, etc.).
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      throw new Error('Could not open the share sheet. Try again.');
    }
  }
  // Desktop browsers: plain download.
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export async function readBackup(file) {
  const text = await file.text();
  let s;
  try {
    s = migrate(JSON.parse(text));
  } catch {
    throw new Error('That file is not a valid backup (not JSON).');
  }
  if (!validateState(s)) throw new Error('That file is not a Lists backup, or it is damaged.');
  return s;
}
