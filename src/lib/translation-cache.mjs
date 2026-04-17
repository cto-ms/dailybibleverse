// translation-cache.mjs
// Loads translation JSON from GCS (or a public HTTP base) once into memory
// and exposes an O(1) verse lookup.

import { makeStorage } from "./gcs.mjs";
import { parseReference } from "./bible-refs.mjs";

const cache = new Map(); // id -> { index: Map<"BOOK.C.V", text>, meta }
let indexJson = null;

export async function loadIndex({ fromGcs = true } = {}) {
  if (indexJson) return indexJson;
  if (fromGcs && process.env.GCS_BUCKET) {
    const [buf] = await makeStorage()
      .bucket(process.env.GCS_BUCKET)
      .file("index.json")
      .download();
    indexJson = JSON.parse(buf.toString("utf8"));
  } else {
    const base = process.env.GCS_PUBLIC_BASE;
    if (!base) throw new Error("No GCS access; set GCS_BUCKET or GCS_PUBLIC_BASE");
    const res = await fetch(`${base}/index.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status} reading index.json`);
    indexJson = await res.json();
  }
  return indexJson;
}

export async function loadTranslation(id, { fromGcs = true } = {}) {
  if (cache.has(id)) return cache.get(id);
  let payload;
  if (fromGcs && process.env.GCS_BUCKET) {
    const [buf] = await makeStorage()
      .bucket(process.env.GCS_BUCKET)
      .file(`translations/${id}.json`)
      .download();
    payload = JSON.parse(buf.toString("utf8"));
  } else {
    const base = process.env.GCS_PUBLIC_BASE;
    if (!base) throw new Error("No GCS access; set GCS_BUCKET or GCS_PUBLIC_BASE");
    const res = await fetch(`${base}/translations/${id}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status} reading ${id}.json`);
    payload = await res.json();
  }
  const index = new Map();
  for (const v of payload.verses) {
    index.set(`${v.book}.${v.chapter}.${v.verse}`, v.text);
  }
  const meta = (await loadIndex({ fromGcs })).find((x) => x.id === id) || null;
  const entry = { index, meta };
  cache.set(id, entry);
  return entry;
}

export async function lookup(reference, translationId) {
  const parsed = parseReference(reference);
  if (!parsed) return null;
  const t = await loadTranslation(translationId);

  if (parsed.verseEnd) {
    // Range lookup — join all verses in the range
    const parts = [];
    for (let v = parsed.verse; v <= parsed.verseEnd; v++) {
      const key = `${parsed.book}.${parsed.chapter}.${v}`;
      const vText = t.index.get(key);
      if (vText) parts.push(vText);
    }
    if (parts.length === 0) return null;
    const refStr = `${parsed.book}.${parsed.chapter}.${parsed.verse}-${parsed.verseEnd}`;
    return { reference: refStr, text: parts.join(" "), translation: t.meta };
  }

  const key = `${parsed.book}.${parsed.chapter}.${parsed.verse}`;
  const text = t.index.get(key);
  return text ? { reference: key, text, translation: t.meta } : null;
}

export async function preload(ids) {
  await Promise.all(ids.map((id) => loadTranslation(id)));
}

export function availableTranslations() {
  return indexJson;
}
