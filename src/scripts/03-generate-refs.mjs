// 03-generate-refs.mjs
// Phase 1 of the content pipeline: ask Claude to propose 7 BSB verse
// references (one per day of the week) for every virtue, following the
// spec's 7-day arc.
//
// IMPORTANT: The virtue schedule is NOT in Sanity (there is no weekNumber on
// Sanity virtue docs). Instead, virtues are read from an INPUT FILE that
// mirrors the virtue-of-the-week.html schedule:
//
//   data/virtues.json → [{ weekNumber, title, liturgicalContext?, description? }, …]
//
// You can generate this file from the HTML schedule page, or create it
// manually. See data/virtues.example.json for the expected shape.
//
// Output: data/generated/references.json
//   [{ weekNumber, virtueTitle, day, dayTheme, reference, rationale }, …]
//
// Usage:
//   node src/scripts/03-generate-refs.mjs
//   node src/scripts/03-generate-refs.mjs --weeks=1-4       # subset
//   node src/scripts/03-generate-refs.mjs --dry-run         # no API calls; placeholder output
//   node src/scripts/03-generate-refs.mjs --input=data/virtues.json

import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import { DAY_THEMES } from "../lib/virtue-week.mjs";
import { parseReference, formatReference } from "../lib/bible-refs.mjs";

const OUT_DIR = path.resolve("data/generated");
const OUT = path.join(OUT_DIR, "references.json");
const DEFAULT_INPUT = path.resolve("data/virtues.json");

const argWeeks = (process.argv.find((a) => a.startsWith("--weeks=")) || "").split("=")[1];
const argInput = (process.argv.find((a) => a.startsWith("--input=")) || "").split("=")[1];
const DRY = process.argv.includes("--dry-run");
const CONCURRENCY = Number(process.env.GEN_CONCURRENCY || 3);
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-6";

function parseWeekFilter(arg) {
  if (!arg) return null;
  const set = new Set();
  for (const part of arg.split(",")) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const lo = +m[1], hi = +(m[2] ?? m[1]);
    for (let i = lo; i <= hi; i++) set.add(i);
  }
  return set;
}

const SYSTEM = `You are a Scripture-literate editorial assistant for the TruePresence Catholic/Christian
mental-health platform. For each virtue, you propose 7 Bible verse references — one per day
of the week — that trace a 7-day spiritual arc through the virtue.

ARC (mandatory order):
- Sunday (Define): A verse that names or describes the virtue directly.
- Monday (Root): God as source; the theological foundation of the virtue.
- Tuesday (Model): A biblical person or narrative that embodies the virtue.
- Wednesday (Practice): Action-oriented or instructive; practical formation.
- Thursday (Obstacle): The vice or temptation this virtue overcomes.
- Friday (Fruit): The promised outcome, blessing, or transformation.
- Saturday (Prayer): A verse suited to closing prayer and reflective quiet.

CONSTRAINTS:
- Use the Berean Standard Bible (BSB) canon — 66 books only. No deuterocanon.
- Output references in DOTTED OSIS form: BOOK.CHAPTER.VERSE (e.g. PHP.4.13, 1CO.13.4).
- Use these book codes: GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST
  JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL
  MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE
  1JN 2JN 3JN JUD REV.
- Single verses only (no ranges).
- Pick verses that actually exist (well-known chapter/verse bounds).
- Keep rationale to ONE sentence, ~20 words.

OUTPUT FORMAT (strict JSON, no prose, no code fences):
{
  "entries": [
    { "day": 0, "dayTheme": "Define",   "reference": "…", "rationale": "…" },
    { "day": 1, "dayTheme": "Root",     "reference": "…", "rationale": "…" },
    { "day": 2, "dayTheme": "Model",    "reference": "…", "rationale": "…" },
    { "day": 3, "dayTheme": "Practice", "reference": "…", "rationale": "…" },
    { "day": 4, "dayTheme": "Obstacle", "reference": "…", "rationale": "…" },
    { "day": 5, "dayTheme": "Fruit",    "reference": "…", "rationale": "…" },
    { "day": 6, "dayTheme": "Prayer",   "reference": "…", "rationale": "…" }
  ]
}`;

function userPrompt(virtue) {
  return `Virtue: ${virtue.title}
Virtue Week: ${virtue.weekNumber}
${virtue.liturgicalContext ? `Liturgical context: ${virtue.liturgicalContext}` : ""}
${virtue.description ? `Description: ${virtue.description}` : ""}

Produce the 7-day arc as described. Return JSON only.`;
}

async function loadVirtues() {
  const inputPath = argInput || DEFAULT_INPUT;
  try {
    const raw = await fs.readFile(inputPath, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || !data.length) {
      throw new Error("virtues input must be a non-empty JSON array");
    }
    // Validate shape
    for (const v of data) {
      if (!v.weekNumber || !v.title) {
        throw new Error(`Each virtue must have weekNumber and title. Got: ${JSON.stringify(v)}`);
      }
    }
    return data.sort((a, b) => a.weekNumber - b.weekNumber);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`\nVirtues input file not found: ${inputPath}`);
      console.error(`\nCreate a JSON file with this shape:`);
      console.error(`  [{ "weekNumber": 1, "title": "Prudence", "liturgicalContext": "Advent begins with 'stay awake'" }, …]`);
      console.error(`\nYou can extract this from the virtue-of-the-week.html schedule page.`);
      console.error(`See data/virtues.example.json for the expected format.\n`);
      process.exit(1);
    }
    throw err;
  }
}

function tryParseJson(text) {
  const match = text.match(/\{[\s\S]*\}$/m) || text.match(/\{[\s\S]*\}/);
  const candidate = match ? match[0] : text;
  return JSON.parse(candidate);
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length !== 7) {
    throw new Error(`expected 7 entries, got ${entries?.length}`);
  }
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.day)) throw new Error(`duplicate day ${e.day}`);
    seen.add(e.day);
    const expected = DAY_THEMES[e.day];
    if (!expected || expected.theme !== e.dayTheme) {
      throw new Error(`day ${e.day} theme mismatch: ${e.dayTheme}`);
    }
    const parsed = parseReference(e.reference);
    if (!parsed) throw new Error(`unparseable reference: ${e.reference}`);
    e.reference = formatReference(parsed);
  }
  return entries.sort((a, b) => a.day - b.day);
}

async function callClaude(client, virtue) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt(virtue) }],
  });
  const text = res.content.map((b) => b.text || "").join("\n").trim();
  const parsed = tryParseJson(text);
  return validateEntries(parsed.entries);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const filter = parseWeekFilter(argWeeks);

  let virtues;
  if (DRY && !(argInput || await fs.access(DEFAULT_INPUT).then(() => true).catch(() => false))) {
    // In dry-run mode, use placeholders if no input file exists
    virtues = [
      { weekNumber: 1, title: "Prudence", liturgicalContext: "Advent begins with 'stay awake' (Mt 24:42). Prudence is watchful discernment." },
      { weekNumber: 14, title: "Fasting", liturgicalContext: "Ash Wednesday inaugurates the Lenten fast." },
      { weekNumber: 20, title: "Fortitude", liturgicalContext: "Tied to the Resurrection narrative." },
    ];
    console.log("(dry-run: using 3 placeholder virtues since no input file exists)");
  } else {
    virtues = await loadVirtues();
  }

  virtues = virtues.filter((v) => !filter || filter.has(v.weekNumber));
  if (!virtues.length) {
    console.error("No virtues matched the filter. Aborting.");
    process.exit(1);
  }
  console.log(`Generating for ${virtues.length} virtue(s) with model=${MODEL}, dry=${DRY}`);

  const anthropic = DRY ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const limit = pLimit(CONCURRENCY);
  const all = [];

  await Promise.all(
    virtues.map((v) =>
      limit(async () => {
        try {
          const entries = DRY
            ? DAY_THEMES.map((t) => ({
                day: t.day,
                dayTheme: t.theme,
                reference: "PHP.4.13",
                rationale: `[dry-run placeholder] ${v.title} — ${t.theme}`,
              }))
            : await callClaude(anthropic, v);

          for (const e of entries) {
            all.push({
              weekNumber: v.weekNumber,
              virtueTitle: v.title,
              liturgicalContext: v.liturgicalContext || "",
              day: e.day,
              dayTheme: e.dayTheme,
              reference: e.reference,
              rationale: e.rationale,
            });
          }
          console.log(`  ✓ week ${v.weekNumber} ${v.title}`);
        } catch (err) {
          console.error(`  ✗ week ${v.weekNumber} ${v.title}: ${err.message}`);
        }
      })
    )
  );

  all.sort((a, b) => a.weekNumber - b.weekNumber || a.day - b.day);
  await fs.writeFile(OUT, JSON.stringify(all, null, 2));
  console.log(`Wrote ${all.length} entries → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
