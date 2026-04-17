// 05-import-sanity.mjs
// Imports data/hydrated/references.json into Sanity as verseAssignment docs.
// Uses deterministic _id = `verseAssignment-w{week}-d{day}` so re-runs are idempotent.
//
// i18n: Document-level i18n (Pattern 1).
//   English base docs use ID:  verseAssignment-wNN-dD
//   Future translations use:   i18n.verseAssignment-wNN-dD.{lang}
//   All docs include a `language` field.
//
// NOTE: The virtue reference is OPTIONAL. If Sanity has `virtue` documents
// whose titles match, the script will attempt a title-based lookup and attach
// a weak reference. If no match is found, the doc is still valid — weekNumber
// is the primary key and virtueTitle carries the display name.
//
// Usage:
//   node src/scripts/05-import-sanity.mjs                 # create-or-replace
//   node src/scripts/05-import-sanity.mjs --patch-only    # only update existing
//   node src/scripts/05-import-sanity.mjs --dry-run       # print, don't write
//   node src/scripts/05-import-sanity.mjs --skip-virtue-lookup  # don't try to match virtue docs

import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import { makeSanityClient } from "../lib/sanity.mjs";

const IN = path.resolve("data/hydrated/references.json");
const DRY = process.argv.includes("--dry-run");
const PATCH_ONLY = process.argv.includes("--patch-only");
const SKIP_VIRTUE_LOOKUP = process.argv.includes("--skip-virtue-lookup");
const LANGUAGE = "en"; // Base language for this import

function docId(weekNumber, day) {
  return `verseAssignment-w${String(weekNumber).padStart(2, "0")}-d${day}`;
}

async function buildVirtueLookup(client) {
  if (SKIP_VIRTUE_LOOKUP) return new Map();
  try {
    const virtues = await client.fetch(
      `*[_type == "virtue"]{ _id, title }`
    );
    const map = new Map();
    for (const v of virtues) {
      if (v.title) map.set(v.title.toLowerCase().trim(), v._id);
    }
    console.log(`Found ${map.size} virtue docs in Sanity for optional ref matching.`);
    return map;
  } catch (err) {
    console.warn(`Could not fetch virtue docs (optional): ${err.message}`);
    return new Map();
  }
}

async function main() {
  if (!process.env.SANITY_WRITE_TOKEN && !DRY) {
    console.error("SANITY_WRITE_TOKEN is required (or pass --dry-run).");
    process.exit(1);
  }
  const entries = JSON.parse(await fs.readFile(IN, "utf8"));
  const client = makeSanityClient();

  const virtueMap = await buildVirtueLookup(client);

  console.log(`Importing ${entries.length} verseAssignment docs, language=${LANGUAGE} (dry=${DRY}, patchOnly=${PATCH_ONLY})`);

  const BATCH = 50;
  let done = 0;
  let linkedVirtues = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    const tx = client.transaction();
    for (const e of slice) {
      const id = docId(e.weekNumber, e.day);

      // Try to find a matching virtue doc by title
      const virtueId = e.virtueTitle
        ? virtueMap.get(e.virtueTitle.toLowerCase().trim())
        : null;
      if (virtueId) linkedVirtues++;

      const body = {
        _id: id,
        _type: "verseAssignment",
        language: LANGUAGE,
        weekNumber: e.weekNumber,
        day: e.day,
        virtueTitle: e.virtueTitle || "",
        virtueLiturgicalContext: e.liturgicalContext || "",
        dayTheme: e.dayTheme,
        reference: e.reference,
        bsbText: e.bsbText || "",
        rationale: e.rationale || "",
        commentary: e.commentary || "",
        commentaryExcerpt: e.commentaryExcerpt || "",
        commentarySource: e.commentarySource || "",
        reviewStatus: "draft",
        ...(virtueId
          ? { virtue: { _type: "reference", _ref: virtueId, _weak: true } }
          : {}),
      };
      if (PATCH_ONLY) {
        tx.patch(id, {
          set: {
            language: LANGUAGE,
            reference: body.reference,
            bsbText: body.bsbText,
            rationale: body.rationale,
            dayTheme: body.dayTheme,
            weekNumber: body.weekNumber,
            day: body.day,
            virtueTitle: body.virtueTitle,
            virtueLiturgicalContext: body.virtueLiturgicalContext,
            commentary: body.commentary,
            commentaryExcerpt: body.commentaryExcerpt,
            commentarySource: body.commentarySource,
          },
        });
      } else {
        tx.createOrReplace(body);
      }
    }
    if (DRY) {
      console.log(`[dry] would commit batch ${i / BATCH + 1} (${slice.length} docs)`);
    } else {
      await tx.commit({ autoGenerateArrayKeys: true });
    }
    done += slice.length;
    console.log(`  committed ${done}/${entries.length}`);
  }

  console.log(`done. Linked ${linkedVirtues}/${entries.length} to Sanity virtue docs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
