// 01-ingest-gcs.mjs
// Downloads BSB / KJV / WEB / DRB JSON from Bible SuperSearch (SourceForge),
// normalizes each to the TruePresence verse schema:
//     { book: "PHP", chapter: 4, verse: 13, text: "..." }
// and uploads to gs://$GCS_BUCKET/translations/<id>.json plus index.json.
//
// Usage:
//   node src/scripts/01-ingest-gcs.mjs [--dry-run] [--only=bsb,kjv]
//
// The SourceForge JSON sources vary slightly by translation in schema. We
// shape them down into the common shape above. Book names are remapped
// to OSIS-like 3-letter codes via src/lib/bible-refs.mjs.

import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import { bucket } from "../lib/gcs.mjs";
import { normalizeBook, BOOKS_66, BOOKS_73 } from "../lib/bible-refs.mjs";

const ARGS = new Set(process.argv.slice(2));
const DRY = ARGS.has("--dry-run");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "")
  .split("=")[1]
  ?.split(",")
  .filter(Boolean);

// Bible SuperSearch JSON download URLs.
// These IDs match the filenames in the archive; update if SourceForge renames.
const SOURCES = [
  {
    id: "bsb",
    name: "Berean Standard Bible",
    abbr: "BSB",
    license: "CC0",
    canon: 66,
    default: true,
    url: "https://downloads.sourceforge.net/project/biblesuper/All%20Bibles%20-%20JSON/bsb.json",
  },
  {
    id: "kjv",
    name: "King James Version",
    abbr: "KJV",
    license: "Public Domain",
    canon: 66,
    default: false,
    url: "https://downloads.sourceforge.net/project/biblesuper/All%20Bibles%20-%20JSON/kjv.json",
  },
  {
    id: "web",
    name: "World English Bible",
    abbr: "WEB",
    license: "Public Domain",
    canon: 73, // WEB w/ deuterocanon
    default: false,
    url: "https://downloads.sourceforge.net/project/biblesuper/All%20Bibles%20-%20JSON/web.json",
  },
  {
    id: "drb",
    name: "Douay-Rheims Bible",
    abbr: "DRB",
    license: "Public Domain",
    canon: 73,
    default: false,
    url: "https://downloads.sourceforge.net/project/biblesuper/All%20Bibles%20-%20JSON/drb.json",
  },
];

const DATA_DIR = path.resolve("data/translations");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadJson(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return await res.json();
}

// Bible SuperSearch files ship a few different shapes; we detect + normalize.
// Common shapes we've seen in the archive:
//   A) { verses: [ { book_name, book, chapter, verse, text }, ... ] }
//   B) [ { book_name, chapter, verse, text }, ... ]
//   C) { resultset: { row: [ { field: [...] } ] } }  (KJV-style)
function normalize(raw) {
  let rows = [];
  if (Array.isArray(raw)) rows = raw;
  else if (Array.isArray(raw.verses)) rows = raw.verses;
  else if (Array.isArray(raw.rows)) rows = raw.rows;
  else if (raw?.resultset?.row) {
    rows = raw.resultset.row.map((r) => {
      const f = r.field || r;
      return { book_name: f[1], chapter: f[2], verse: f[3], text: f[4] };
    });
  } else {
    throw new Error("Unrecognized JSON shape for translation payload");
  }

  const out = [];
  const skipped = new Map();
  for (const r of rows) {
    const bookRaw = r.book_name || r.book || r.b || r.bookname;
    const book = normalizeBook(bookRaw);
    if (!book) {
      skipped.set(bookRaw, (skipped.get(bookRaw) || 0) + 1);
      continue;
    }
    const chapter = Number(r.chapter ?? r.c);
    const verse = Number(r.verse ?? r.v);
    const text = String(r.text ?? r.t ?? "").trim();
    if (!chapter || !verse || !text) continue;
    out.push({ book, chapter, verse, text });
  }
  if (skipped.size) {
    console.warn(
      `  WARN skipped unknown books: ${[...skipped.entries()]
        .map(([k, v]) => `${k}×${v}`)
        .join(", ")}`
    );
  }
  return out;
}

function indexJsonFromSources(sources) {
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    abbr: s.abbr,
    license: s.license,
    canon: s.canon,
    default: !!s.default,
  }));
}

async function main() {
  await ensureDir(DATA_DIR);
  const toProcess = ONLY ? SOURCES.filter((s) => ONLY.includes(s.id)) : SOURCES;
  const uploadedIndex = [];

  for (const src of toProcess) {
    console.log(`→ ${src.abbr}  downloading ${src.url}`);
    const raw = await downloadJson(src.url);
    const verses = normalize(raw);
    console.log(`  parsed ${verses.length.toLocaleString()} verses`);

    // Basic canon sanity
    const seenBooks = new Set(verses.map((v) => v.book));
    const expected = src.canon === 73 ? BOOKS_73 : BOOKS_66;
    const missing = expected.filter((b) => !seenBooks.has(b));
    if (missing.length) {
      console.warn(
        `  WARN ${src.abbr} missing ${missing.length} expected books: ${missing
          .slice(0, 10)
          .join(",")}${missing.length > 10 ? "…" : ""}`
      );
    }

    const payload = { id: src.id, abbr: src.abbr, verses };
    const localPath = path.join(DATA_DIR, `${src.id}.json`);
    await fs.writeFile(localPath, JSON.stringify(payload));
    console.log(`  wrote ${localPath}`);

    if (!DRY) {
      const file = bucket().file(`translations/${src.id}.json`);
      await file.save(JSON.stringify(payload), {
        contentType: "application/json",
        resumable: false,
        metadata: { cacheControl: "public, max-age=86400" },
      });
      console.log(`  uploaded gs://${process.env.GCS_BUCKET}/translations/${src.id}.json`);
    }

    uploadedIndex.push(src);
  }

  // index.json
  const index = indexJsonFromSources(uploadedIndex);
  const localIdx = path.join(DATA_DIR, "index.json");
  await fs.writeFile(localIdx, JSON.stringify(index, null, 2));
  console.log(`wrote ${localIdx}`);

  if (!DRY) {
    await bucket()
      .file("index.json")
      .save(JSON.stringify(index), {
        contentType: "application/json",
        resumable: false,
        metadata: { cacheControl: "public, max-age=300" },
      });
    console.log(`uploaded gs://${process.env.GCS_BUCKET}/index.json`);
  }

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
