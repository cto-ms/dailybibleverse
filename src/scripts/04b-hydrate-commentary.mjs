// 04b-hydrate-commentary.mjs
// Enriches data/hydrated/references.json with Matthew Henry's Concise Commentary
// from the HelloAO API.
//
// Matthew Henry groups verses (e.g., one entry covers vv. 3–4). This script finds
// the covering entry for each verse — exact match or nearest preceding entry in
// the chapter — and attaches:
//   - commentary:        full Matthew Henry paragraph
//   - commentaryExcerpt: first ~2 sentences, suitable for a daily reflection card
//
// Usage:
//   node src/scripts/04b-hydrate-commentary.mjs
//   node src/scripts/04b-hydrate-commentary.mjs --dry-run     # prints stats only
//   node src/scripts/04b-hydrate-commentary.mjs --weeks=1-4   # subset

import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import pLimit from "p-limit";
import { parseReference } from "../lib/bible-refs.mjs";

const IN = path.resolve("data/hydrated/references.json");
const OUT = path.resolve("data/hydrated/references.json"); // overwrites in place
const DRY = process.argv.includes("--dry-run");
const argWeeks = (process.argv.find((a) => a.startsWith("--weeks=")) || "").split("=")[1];
const CONCURRENCY = Number(process.env.COMMENTARY_CONCURRENCY || 4);
const BASE = process.env.HELLOAO_BASE || "https://bible.helloao.org/api";
const COMMENTARY_ID = "matthew-henry";
const FALLBACK_IDS = ["jamieson-fausset-brown", "john-gill"];

function parseWeekFilter(arg) {
  if (!arg) return null;
  const set = new Set();
  for (const part of (arg || "").split(",")) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const lo = +m[1], hi = +(m[2] ?? m[1]);
    for (let i = lo; i <= hi; i++) set.add(i);
  }
  return set;
}

// ─── HelloAO commentary fetch ───

// Chapter-level cache: "BOOK.CHAPTER" → Promise<Map<verseNumber, text>>
const chapterCache = new Map();

/**
 * Parse a commentary JSON response into a sorted array of { number, text }.
 * Returns null if the response is missing, non-JSON, or has no content.
 */
function parseCommentaryResponse(res) {
  return (async () => {
    if (!res.ok) {
      if (res.status === 404) return null;
      return null; // treat any HTTP error as missing
    }

    // Guard against HTML error pages (MAT 19-28 return text/html)
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return null;

    let json;
    try {
      json = await res.json();
    } catch {
      return null; // malformed JSON — treat as missing
    }

    const content = json?.chapter?.content;
    if (!Array.isArray(content)) return null;

    const entries = [];
    for (const node of content) {
      if (node?.type !== "verse" || !node.number) continue;
      const text = Array.isArray(node.content)
        ? node.content
            .map((c) => (typeof c === "string" ? c : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
        : "";
      if (text) entries.push({ number: Number(node.number), text });
    }
    entries.sort((a, b) => a.number - b.number);
    return entries.length ? entries : null;
  })();
}

async function fetchCommentaryChapter(book, chapter) {
  const key = `${book}.${chapter}`;
  if (chapterCache.has(key)) return chapterCache.get(key);

  const p = (async () => {
    // Try each commentary source in priority order:
    // Matthew Henry (concise, devotional) → JFB → John Gill (most comprehensive)
    const sources = [COMMENTARY_ID, ...FALLBACK_IDS];
    for (const sourceId of sources) {
      const url = `${BASE}/c/${sourceId}/${book}/${chapter}.json`;
      let entries = null;
      try {
        const res = await fetch(url);
        entries = await parseCommentaryResponse(res);
      } catch (err) {
        // Network error — try next source
      }
      if (entries) {
        if (sourceId !== COMMENTARY_ID) {
          console.log(`  ↳ ${key}: using ${sourceId} fallback (Matthew Henry unavailable)`);
        }
        return { entries, source: sourceId };
      }
    }

    console.warn(`  ✗ ${key}: no commentary from any source (tried ${sources.join(", ")})`);
    return null;
  })();

  chapterCache.set(key, p);
  return p;
}

// Find the commentary entry that covers a given verse number.
// Commentaries group verses (e.g., one entry covers vv. 42–51 under entry 42).
// Strategy:
//   1. Exact match
//   2. Nearest preceding entry (the most common grouping pattern)
//   3. Nearest following entry within 5 verses (some commentaries group under a
//      later number, e.g., entry 50 covering vv. 48–51)
// The ±5 window avoids pulling in commentary from a completely different passage.
function findCoveringEntry(entries, verseNum) {
  if (!entries || !entries.length) return null;

  // Exact match first
  const exact = entries.find((e) => e.number === verseNum);
  if (exact) return exact;

  // Nearest preceding entry
  let preceding = null;
  for (const e of entries) {
    if (e.number <= verseNum) {
      if (!preceding || e.number > preceding.number) preceding = e;
    }
  }

  // Nearest following entry (within 5 verses)
  let following = null;
  for (const e of entries) {
    if (e.number > verseNum && e.number <= verseNum + 5) {
      if (!following || e.number < following.number) following = e;
    }
  }

  // Prefer preceding (more natural grouping), but use following if preceding
  // is too far away (more than 5 verses back) or absent
  if (preceding && (verseNum - preceding.number) <= 5) return preceding;
  if (following) return following;
  return preceding; // even if distant, it's our best bet
}

// Extract first ~2 sentences for a devotional excerpt.
function makeExcerpt(text, maxLen = 350) {
  if (!text) return "";
  // Remove leading "Note, " or numbering like "1. " that Matthew Henry often uses.
  let clean = text.replace(/^Note,?\s*/i, "").replace(/^\d+\.\s*/, "");

  // Find sentence boundaries (period followed by space and capital, or end of string).
  const sentences = [];
  const re = /[^.!?]*[.!?]+/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    sentences.push(m[0].trim());
    if (sentences.join(" ").length >= maxLen) break;
  }

  if (sentences.length === 0) {
    // No sentence boundary found — just truncate.
    return clean.length <= maxLen ? clean : clean.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
  }

  // Take 2–3 sentences, staying under maxLen.
  let result = sentences[0];
  for (let i = 1; i < sentences.length && i < 3; i++) {
    const candidate = result + " " + sentences[i];
    if (candidate.length > maxLen) break;
    result = candidate;
  }
  return result;
}

// ─── Main ───

async function main() {
  const entries = JSON.parse(await fs.readFile(IN, "utf8"));
  const filter = parseWeekFilter(argWeeks);
  const toProcess = filter
    ? entries.filter((e) => filter.has(e.weekNumber))
    : entries;

  console.log(
    `Enriching ${toProcess.length}/${entries.length} entries with Matthew Henry commentary (dry=${DRY})`
  );

  const limit = pLimit(CONCURRENCY);
  let found = 0,
    missed = 0,
    fallbacks = 0;

  await Promise.all(
    toProcess.map((entry) =>
      limit(async () => {
        const parsed = parseReference(entry.reference);
        if (!parsed) {
          missed++;
          return;
        }
        try {
          const result = await fetchCommentaryChapter(
            parsed.book,
            parsed.chapter
          );
          if (!result) {
            entry.commentary = "";
            entry.commentaryExcerpt = "";
            entry.commentarySource = "";
            missed++;
            return;
          }
          const hit = findCoveringEntry(result.entries, parsed.verse);
          if (hit) {
            entry.commentary = hit.text;
            entry.commentaryExcerpt = makeExcerpt(hit.text);
            entry.commentaryVerseGroup = hit.number;
            entry.commentarySource = result.source;
            found++;
            if (result.source !== COMMENTARY_ID) fallbacks++;
          } else {
            entry.commentary = "";
            entry.commentaryExcerpt = "";
            entry.commentarySource = "";
            missed++;
          }
        } catch (err) {
          console.warn(
            `  ! ${entry.reference}: commentary fetch failed: ${err.message}`
          );
          missed++;
        }
      })
    )
  );

  console.log(
    `  Commentary found: ${found}/${toProcess.length}, missed: ${missed}`
  );
  if (fallbacks > 0) {
    // Break down fallbacks by source
    const sourceCounts = {};
    for (const e of toProcess) {
      if (e.commentarySource && e.commentarySource !== COMMENTARY_ID) {
        sourceCounts[e.commentarySource] = (sourceCounts[e.commentarySource] || 0) + 1;
      }
    }
    const parts = Object.entries(sourceCounts).map(([s, n]) => `${n} ${s}`);
    console.log(`  (${fallbacks} used fallback: ${parts.join(", ")})`);
  }

  if (!DRY) {
    await fs.writeFile(OUT, JSON.stringify(entries, null, 2));
    console.log(`  Wrote ${OUT}`);
  } else {
    // Print a few samples
    const samples = toProcess.filter((e) => e.commentaryExcerpt).slice(0, 3);
    for (const s of samples) {
      console.log(`\n  W${s.weekNumber} ${s.dayTheme} ${s.reference}`);
      console.log(`  Excerpt: ${s.commentaryExcerpt}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
