// 04-hydrate.mjs
// Validates every reference in data/generated/references.json against the
// HelloAO BSB API and attaches the canonical BSB text. Emits a report of
// any misses that reviewers must correct before import.
//
// Output: data/hydrated/references.json     (valid entries w/ text attached)
//         data/hydrated/errors.json         (entries that failed validation)
//
// Usage: node src/scripts/04-hydrate.mjs

import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import pLimit from "p-limit";
import { parseReference, formatReference, humanReference, BOOK_NAMES } from "../lib/bible-refs.mjs";

const IN = path.resolve("data/generated/references.json");
const OUT_DIR = path.resolve("data/hydrated");
const OUT_OK = path.join(OUT_DIR, "references.json");
const OUT_ERR = path.join(OUT_DIR, "errors.json");

const BASE = process.env.HELLOAO_BASE || "https://bible.helloao.org/api";
const CONCURRENCY = Number(process.env.HYDRATE_CONCURRENCY || 4);

// HelloAO exposes translations via /{translation}/{book}/{chapter}.json
// e.g. GET https://bible.helloao.org/api/BSB/PHP/4.json
// Response shape (abbreviated):
//   { "chapter": { "content": [ { "type": "verse", "number": 1, "content": [...] } ] } }
// We flatten the nested content into plain text.
function verseTextFromChapter(chapterJson, verseNum) {
  const content = chapterJson?.chapter?.content;
  if (!Array.isArray(content)) return null;
  const verseNode = content.find(
    (n) => n?.type === "verse" && Number(n.number) === Number(verseNum)
  );
  if (!verseNode) return null;
  const raw = flattenContent(verseNode.content).replace(/\s+/g, " ").trim();
  return applyReverentialCapitals(raw);
}

// Fetch a verse range (e.g., verses 46–47) from a single chapter.
// Returns the joined text of all verses in the range, or null if none found.
function verseRangeFromChapter(chapterJson, verseStart, verseEnd) {
  const content = chapterJson?.chapter?.content;
  if (!Array.isArray(content)) return null;
  const parts = [];
  for (let v = verseStart; v <= verseEnd; v++) {
    const node = content.find(
      (n) => n?.type === "verse" && Number(n.number) === v
    );
    if (node) {
      const raw = flattenContent(node.content).replace(/\s+/g, " ").trim();
      if (raw) parts.push(raw);
    }
  }
  if (parts.length === 0) return null;
  return applyReverentialCapitals(parts.join(" "));
}

// Apply reverential capitals to pronouns referring to God / Jesus / the Holy Spirit.
// The BSB is inconsistent about this; devotional usage in TruePresence expects capitals.
// We capitalize: he/him/his/himself/who/whom/whose when they appear to refer to God.
//
// Strategy: scan for divine-subject signals (God, LORD, Jesus, Christ, the Lord,
// the Spirit, the Father, the Son, the Almighty, etc.) — if the verse contains one,
// capitalize eligible pronouns. This is intentionally aggressive for a devotional
// context; a verse about a human figure would need manual review in Sanity Studio.
const DIVINE_SUBJECTS = /\b(God|LORD|Lord|Jesus|Christ|Spirit|Father(?! Abraham)(?! Isaac)(?! Jacob)|Son of (?:God|Man)|Almighty|Most High|Savior|Redeemer|Messiah|Holy One|I AM)\b/;

function applyReverentialCapitals(text) {
  if (!DIVINE_SUBJECTS.test(text)) return text;

  // Capitalize he/him/his/himself/who/whom/whose that are lowercase.
  // Use word-boundary matching to avoid mangling words like "the", "this", "when".
  return text
    .replace(/\bhe\b/g, "He")
    .replace(/\bhim\b/g, "Him")
    .replace(/\bhis\b/g, "His")
    .replace(/\bhimself\b/g, "Himself")
    // "who/whom/whose" only after a comma or dash (relative clause referring back
    // to the divine subject), not at the start of a sentence (often a question).
    .replace(/([,—–-]\s*)who\b/g, "$1Who")
    .replace(/([,—–-]\s*)whom\b/g, "$1Whom")
    .replace(/([,—–-]\s*)whose\b/g, "$1Whose");
}

function flattenContent(nodes) {
  if (nodes == null) return "";
  if (typeof nodes === "string") return nodes;
  if (Array.isArray(nodes)) {
    // Join child nodes with a space between them to prevent run-togethers.
    // The HelloAO API nests text in arrays of strings, objects with .text,
    // objects with .content, and structural nodes (line breaks, headings)
    // that should all be separated by whitespace when flattened.
    return nodes.map(flattenContent).filter(Boolean).join(" ");
  }
  if (typeof nodes === "object") {
    // Structural / break nodes — emit a space so surrounding text doesn't merge.
    if (nodes.type === "line_break" || nodes.lineBreak) return " ";
    if (typeof nodes.text === "string") return nodes.text;
    if (nodes.content) return flattenContent(nodes.content);
    // Other structural nodes (headings, notes, etc.) — recurse children if any,
    // otherwise emit a space so we don't silently swallow a boundary.
    if (nodes.children) return flattenContent(nodes.children);
    return " ";
  }
  return "";
}

// Simple in-memory cache keyed by "BOOK.CHAPTER" so we don't refetch chapters.
const chapterCache = new Map();

async function fetchChapter(book, chapter) {
  const key = `${book}.${chapter}`;
  if (chapterCache.has(key)) return chapterCache.get(key);
  const url = `${BASE}/BSB/${book}/${chapter}.json`;
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  })();
  chapterCache.set(key, p);
  return p;
}

async function main() {
  const raw = await fs.readFile(IN, "utf8");
  const entries = JSON.parse(raw);
  await fs.mkdir(OUT_DIR, { recursive: true });

  const limit = pLimit(CONCURRENCY);
  const ok = [], errors = [];

  await Promise.all(
    entries.map((entry) =>
      limit(async () => {
        const parsed = parseReference(entry.reference);
        if (!parsed) {
          errors.push({ ...entry, error: "unparseable reference" });
          return;
        }
        try {
          const ch = await fetchChapter(parsed.book, parsed.chapter);
          const text = parsed.verseEnd
            ? verseRangeFromChapter(ch, parsed.verse, parsed.verseEnd)
            : verseTextFromChapter(ch, parsed.verse);
          if (!text) {
            errors.push({
              ...entry,
              error: `verse not found in chapter ${parsed.book} ${parsed.chapter}`,
            });
            return;
          }
          ok.push({
            ...entry,
            bsbText: text,
            bookName: BOOK_NAMES[parsed.book] || parsed.book,
            humanReference: humanReference(parsed),
          });
        } catch (err) {
          errors.push({ ...entry, error: err.message });
        }
      })
    )
  );

  ok.sort((a, b) => a.weekNumber - b.weekNumber || a.day - b.day);
  await fs.writeFile(OUT_OK, JSON.stringify(ok, null, 2));
  await fs.writeFile(OUT_ERR, JSON.stringify(errors, null, 2));
  console.log(`Hydrated ${ok.length} entries → ${OUT_OK}`);
  console.log(`Errors ${errors.length} → ${OUT_ERR}`);
  if (errors.length) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
