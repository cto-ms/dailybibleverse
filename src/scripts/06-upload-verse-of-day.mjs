// 06-upload-verse-of-day.mjs
// Daily job — resolves today's (virtueWeek, day) → verseAssignment, loads the
// BSB text, and writes a `verseOfDay` document to Sanity. Idempotent.
//
// i18n: Date+language keyed (Pattern 2, matches dailyReading).
//   _id = verseOfDay-YYYY-MM-DD-{lang}
//   Currently publishes English only. Spanish support will add a second pass
//   that reads from i18n.verseAssignment-wNN-dD.es docs.
//
// Usage:
//   node src/scripts/06-upload-verse-of-day.mjs               # today (UTC)
//   node src/scripts/06-upload-verse-of-day.mjs --date=2026-04-20
//   node src/scripts/06-upload-verse-of-day.mjs --backfill=30 # last 30 days
//   node src/scripts/06-upload-verse-of-day.mjs --dry-run

import "dotenv/config";
import { makeSanityClient } from "../lib/sanity.mjs";
import { getVirtueWeek, getDayIndex, dayTheme } from "../lib/virtue-week.mjs";
import { parseReference, humanReference, BOOK_NAMES } from "../lib/bible-refs.mjs";
import { lookup } from "../lib/translation-cache.mjs";

const DRY = process.argv.includes("--dry-run");
const argDate = (process.argv.find((a) => a.startsWith("--date=")) || "").split("=")[1];
const argBackfill = Number((process.argv.find((a) => a.startsWith("--backfill=")) || "").split("=")[1] || 0);
const DEFAULT_TRANSLATION = process.env.DEFAULT_TRANSLATION || "bsb";
const LANGUAGE = "en"; // Base language for this run

function isoDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function docId(iso, lang) {
  return `verseOfDay-${iso}-${lang}`;
}

async function fetchAssignment(client, weekNumber, day) {
  // Fetch the English base assignment (no i18n prefix)
  return await client.fetch(
    `*[_type == "verseAssignment" && weekNumber == $week && day == $day && !(_id match "i18n.*")][0]{
       _id, reference, dayTheme, rationale, commentaryExcerpt, virtueTitle, bsbText,
       "virtueRef": virtue._ref
     }`,
    { week: weekNumber, day }
  );
}

async function publishForDate(client, date) {
  const iso = isoDate(date);
  const weekNumber = getVirtueWeek(date);
  const day = getDayIndex(date);
  const theme = dayTheme(date);

  const assignment = await fetchAssignment(client, weekNumber, day);
  if (!assignment) {
    console.warn(`  ! ${iso}: no verseAssignment for week=${weekNumber} day=${day}`);
    return { iso, skipped: true };
  }
  const parsed = parseReference(assignment.reference);
  if (!parsed) {
    console.warn(`  ! ${iso}: unparseable reference ${assignment.reference}`);
    return { iso, skipped: true };
  }

  // Use text from the assignment doc if available, otherwise fetch from GCS cache
  let text = assignment.bsbText || "";
  if (!text) {
    try {
      const hit = await lookup(assignment.reference, DEFAULT_TRANSLATION);
      text = hit?.text || "";
    } catch (err) {
      console.warn(`  ! ${iso}: translation lookup failed: ${err.message}`);
    }
  }

  const body = {
    _id: docId(iso, LANGUAGE),
    _type: "verseOfDay",
    language: LANGUAGE,
    date: iso,
    weekNumber,
    day,
    dayTheme: assignment.dayTheme || theme.theme,
    virtueTitle: assignment.virtueTitle || "",
    // Optional virtue ref — only set if the assignment has one linked
    ...(assignment.virtueRef
      ? { virtue: { _type: "reference", _ref: assignment.virtueRef, _weak: true } }
      : {}),
    reference: assignment.reference,
    bookName: BOOK_NAMES[parsed.book] || parsed.book,
    humanReference: humanReference(parsed),
    bsbText: text,
    rationale: assignment.rationale || "",
    commentaryExcerpt: assignment.commentaryExcerpt || "",
    assignment: { _type: "reference", _ref: assignment._id, _weak: true },
    publishedAt: new Date().toISOString(),
  };

  if (DRY) {
    console.log(`  [dry] ${iso} [${LANGUAGE}]  W${weekNumber} ${assignment.virtueTitle || "(untitled)"}  ${body.humanReference}  "${text.slice(0, 80)}…"`);
  } else {
    await client.createOrReplace(body);
    console.log(`  ✓ ${iso} [${LANGUAGE}]  W${weekNumber} ${assignment.virtueTitle || "(untitled)"}  ${body.humanReference}`);
  }
  return { iso, weekNumber, day, reference: body.reference };
}

async function main() {
  if (!process.env.SANITY_WRITE_TOKEN && !DRY) {
    console.error("SANITY_WRITE_TOKEN is required (or pass --dry-run).");
    process.exit(1);
  }
  const client = makeSanityClient();

  const base = argDate ? new Date(`${argDate}T00:00:00Z`) : new Date();
  const dates = [];
  if (argBackfill > 0) {
    for (let i = argBackfill - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(d);
    }
  } else {
    dates.push(base);
  }

  console.log(`Publishing verse-of-day for ${dates.length} date(s), language=${LANGUAGE}, translation=${DEFAULT_TRANSLATION}, dry=${DRY}`);
  const results = [];
  for (const d of dates) {
    results.push(await publishForDate(client, d));
  }
  const published = results.filter((r) => !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`Done. Published: ${published}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
