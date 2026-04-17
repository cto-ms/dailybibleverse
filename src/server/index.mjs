// Runtime resolver.
// Loads translation JSON into memory at startup and exposes:
//   GET /healthz
//   GET /translations          → index.json passthrough
//   GET /verse-of-day?translation=bsb&date=YYYY-MM-DD
//   GET /verse?ref=PHP.4.13&translation=bsb
//
// weekNumber is computed from the liturgical calendar via getVirtueWeek(date).
// Virtue names come from verseAssignment.virtueTitle (a plain string), not
// from a Sanity virtue document reference.
//
// Designed for a GKE service in us-east1 per the spec. No per-request GCS
// calls once the in-memory cache is warm.

import "dotenv/config";
import express from "express";
import { loadIndex, loadTranslation, lookup } from "../lib/translation-cache.mjs";
import { makeSanityClient } from "../lib/sanity.mjs";
import { getVirtueWeek, getDayIndex, dayTheme } from "../lib/virtue-week.mjs";
import { parseReference, humanReference, BOOK_NAMES } from "../lib/bible-refs.mjs";

const PORT = Number(process.env.PORT || 8080);
const DEFAULT_TRANSLATION = process.env.DEFAULT_TRANSLATION || "bsb";

const app = express();
app.disable("x-powered-by");

app.get("/healthz", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.get("/translations", async (req, res) => {
  try {
    const idx = await loadIndex();
    res.json(idx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/verse", async (req, res) => {
  const { ref, translation = DEFAULT_TRANSLATION } = req.query;
  if (!ref) return res.status(400).json({ error: "ref is required" });
  try {
    const hit = await lookup(String(ref), String(translation));
    if (!hit) return res.status(404).json({ error: "not found" });
    res.json({
      reference: hit.reference,
      humanReference: humanReference(parseReference(hit.reference)),
      translation: hit.translation,
      text: hit.text,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cached verseAssignment lookup — keyed by (lang, week, day).
const assignmentCache = new Map();

async function resolveAssignment(week, day, lang = "en") {
  const key = `${lang}.${week}.${day}`;
  if (assignmentCache.has(key)) return assignmentCache.get(key);
  const client = makeSanityClient({ useCdn: true, withToken: false });

  // For English, fetch base docs (exclude i18n.* prefixed docs).
  // For other languages, fetch the i18n-prefixed translation doc.
  const filter = lang === "en"
    ? `_type == "verseAssignment" && weekNumber == $week && day == $day && !(_id match "i18n.*")`
    : `_type == "verseAssignment" && weekNumber == $week && day == $day && language == $lang`;

  const doc = await client.fetch(
    `*[${filter}][0]{
       _id, reference, dayTheme, rationale, commentaryExcerpt, virtueTitle,
       virtueLiturgicalContext, bsbText, language
     }`,
    { week, day, lang }
  );
  assignmentCache.set(key, doc);
  return doc;
}

// GET /verse-of-day?date=YYYY-MM-DD&translation=bsb&lang=en
app.get("/verse-of-day", async (req, res) => {
  try {
    const dateStr = req.query.date ? String(req.query.date) : null;
    const translationId = String(req.query.translation || DEFAULT_TRANSLATION);
    const lang = String(req.query.lang || "en");
    const d = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
    if (isNaN(d.getTime())) return res.status(400).json({ error: "bad date" });

    const weekNumber = getVirtueWeek(d);
    const day = getDayIndex(d);
    const theme = dayTheme(d);

    const assignment = await resolveAssignment(weekNumber, day, lang);
    if (!assignment) {
      return res.status(404).json({
        error: "no verseAssignment for this virtue+day+lang",
        weekNumber,
        day,
        language: lang,
      });
    }

    const parsed = parseReference(assignment.reference);

    // Use verse text from the assignment doc (includes translated text for non-EN).
    // Fall back to GCS translation cache for English.
    let text = assignment.bsbText || null;
    if (!text && lang === "en") {
      const hit = await lookup(assignment.reference, translationId);
      text = hit?.text || null;
    }

    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      date: d.toISOString().slice(0, 10),
      language: lang,
      weekNumber,
      day,
      dayTheme: assignment.dayTheme || theme.theme,
      intent: theme.intent,
      virtueTitle: assignment.virtueTitle || null,
      liturgicalContext: assignment.virtueLiturgicalContext || null,
      reference: assignment.reference,
      bookName: BOOK_NAMES[parsed.book] || parsed.book,
      humanReference: humanReference(parsed),
      text,
      rationale: assignment.rationale || "",
      commentaryExcerpt: assignment.commentaryExcerpt || "",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function warmUp() {
  console.log("warming translation cache…");
  const idx = await loadIndex();
  await Promise.all(idx.map((t) => loadTranslation(t.id)));
  console.log(`loaded ${idx.length} translations into memory`);
}

warmUp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`verse-of-day resolver listening on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("startup failed:", err);
    process.exit(1);
  });
