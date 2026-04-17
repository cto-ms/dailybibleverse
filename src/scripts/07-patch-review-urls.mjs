// 07-patch-review-urls.mjs
// Patches all verseAssignment docs with a reviewPageUrl field pointing to
// the GitHub Pages review page with a deep link to the specific assignment row.
//
// URL format: https://{org}.github.io/bibleverseoftheday/#w{week}-d{day}
//
// Usage:
//   node src/scripts/07-patch-review-urls.mjs                          # patch all
//   node src/scripts/07-patch-review-urls.mjs --dry-run                # preview
//   node src/scripts/07-patch-review-urls.mjs --base-url=https://example.github.io/bibleverseoftheday

import "dotenv/config";
import { makeSanityClient } from "../lib/sanity.mjs";

const DRY = process.argv.includes("--dry-run");
const argBase = (process.argv.find((a) => a.startsWith("--base-url=")) || "").split("=").slice(1).join("=");

// Default GitHub Pages base URL — override with --base-url if your org differs
const BASE_URL = argBase || process.env.REVIEW_PAGE_URL || "https://enterprisetechnologyparks.github.io/bibleverseoftheday";

function reviewUrl(weekNumber, day) {
  return `${BASE_URL}/#w${weekNumber}-d${day}`;
}

async function main() {
  if (!process.env.SANITY_WRITE_TOKEN && !DRY) {
    console.error("SANITY_WRITE_TOKEN is required (or pass --dry-run).");
    process.exit(1);
  }
  const client = makeSanityClient();

  // Fetch all verseAssignment IDs
  const docs = await client.fetch(
    `*[_type == "verseAssignment" && !(_id match "i18n.*")]{ _id, weekNumber, day }`
  );

  console.log(`Patching ${docs.length} verseAssignment docs with reviewPageUrl (dry=${DRY})`);
  console.log(`Base URL: ${BASE_URL}`);

  const BATCH = 50;
  let done = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    const tx = client.transaction();
    for (const doc of slice) {
      const url = reviewUrl(doc.weekNumber, doc.day);
      tx.patch(doc._id, { set: { reviewPageUrl: url } });
    }
    if (DRY) {
      const sample = slice[0];
      console.log(`  [dry] batch ${Math.floor(i / BATCH) + 1}: e.g. ${sample._id} → ${reviewUrl(sample.weekNumber, sample.day)}`);
    } else {
      await tx.commit();
    }
    done += slice.length;
    console.log(`  committed ${done}/${docs.length}`);
  }

  console.log(`Done. ${done} docs patched.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
