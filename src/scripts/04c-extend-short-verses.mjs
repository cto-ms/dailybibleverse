// 04c-extend-short-verses.mjs
// Patches references.json to extend single-verse references that are too short
// or end mid-thought into verse ranges (e.g., LUK.1.46 → LUK.1.46-47).
//
// This is a one-time fix script. After running, re-run 04-hydrate.mjs and
// 04b-hydrate-commentary.mjs to pick up the multi-verse text.
//
// Usage:
//   node src/scripts/04c-extend-short-verses.mjs              # apply fixes
//   node src/scripts/04c-extend-short-verses.mjs --dry-run    # preview only

import fs from "node:fs/promises";
import path from "node:path";

const IN = path.resolve("data/generated/references.json");
const OUT = IN; // overwrite in place
const DRY = process.argv.includes("--dry-run");

// Map: original single-verse ref → new range ref.
// Each extension was chosen to complete the thought without bloating the verse block.
// Guidelines: max 3 verses total (keep it concise for a daily card).
const EXTENSIONS = {
  "LUK.1.46":  "LUK.1.46-47",   // "My soul magnifies the Lord," → + "and my spirit rejoices in God my Savior"
  "LUK.3.10":  "LUK.3.10-11",   // "What then should we do?" → + John's answer about sharing
  "GAL.5.22":  "GAL.5.22-23",   // "fruit of the Spirit is love, joy, peace..." → + "gentleness, self-control..."
  "GAL.5.23":  "GAL.5.22-23",   // Fragment starting "gentleness," → expand to full fruit passage
  "COL.3.23":  "COL.3.23-24",   // "work at it with your whole being..." → + "since you know you will receive an inheritance"
  "COL.4.2":   "COL.4.2-3",     // "Devote yourselves to prayer, being watchful" → + "praying also for us"
  "MAT.5.44":  "MAT.5.44-45",   // "love your enemies and pray..." → + "that you may be sons of your Father in heaven"
  "MAT.6.17":  "MAT.6.17-18",   // "when you fast, anoint your head" → + "so that your fasting is not seen by men"
  "MAT.28.19": "MAT.28.19-20",  // "go and make disciples..." → + "teaching them to observe all I have commanded"
  "EPH.3.20":  "EPH.3.20-21",   // "able to do immeasurably more..." → + "to Him be the glory"
  "EPH.6.2":   "EPH.6.2-3",     // "Honor your father and mother..." → + the promise: "that it may go well with you"
  "EXO.31.4":  "EXO.31.3-4",    // Fragment "to design artistic works" → prepend v3 for context
  "EXO.35.31": "EXO.35.31-32",  // "filled him with the Spirit of God..." → + "to make artistic designs"
  "JAS.1.19":  "JAS.1.19-20",   // "quick to listen, slow to speak, slow to anger," → + "for man's anger does not bring about God's righteousness"
  "PHP.1.9":   "PHP.1.9-10",    // "love may abound more and more..." → + "so that you may approve the things that are excellent"
  "1PE.3.15":  "1PE.3.15-16",   // "respond with gentleness and respect," → + "keeping a clear conscience"
  "ZEC.8.16":  "ZEC.8.16-17",   // "speak truth, render true judgments," → + "do not plot evil... for I hate all these things"
  "PSA.30.11": "PSA.30.11-12",  // "turned mourning into dancing," → + "that my heart may sing... and not be silent"
  "LUK.1.3":   "LUK.1.3-4",    // "write an orderly account, most excellent Theophilus," → + "so that you may know the certainty"
  "ECC.3.4":   "ECC.3.1-4",     // "a time to weep..." → expand to iconic "For everything there is a season" (vv. 1-4)
  "2SA.6.14":  "2SA.6.14-15",   // "David danced before the LORD," → + "as they brought up the Ark with shouts and trumpet"
  "TIT.2.12":  "TIT.2.12-13",   // "live sensible, upright, godly lives," → + "while we await the blessed hope"
  "1TI.2.9":   "1TI.2.9-10",    // "adorn themselves with respectable apparel," → + "but with good deeds, as befits women who profess worship"
  "PSA.146.7":  "PSA.146.7-8",  // "sets the prisoners free," → + "the LORD opens the eyes of the blind"
  "ACT.4.35":  "ACT.4.34-35",   // "and lay them at the apostles' feet" → prepend v34 for context
};

async function main() {
  const entries = JSON.parse(await fs.readFile(IN, "utf8"));
  let patched = 0;

  for (const entry of entries) {
    const newRef = EXTENSIONS[entry.reference];
    if (newRef && newRef !== entry.reference) {
      if (DRY) {
        console.log(`  [dry] W${entry.weekNumber} d${entry.day}: ${entry.reference} → ${newRef}`);
      }
      entry.reference = newRef;
      patched++;
    }
  }

  console.log(`Patched ${patched} references (dry=${DRY})`);

  if (!DRY) {
    await fs.writeFile(OUT, JSON.stringify(entries, null, 2));
    console.log(`Wrote ${OUT}`);
    console.log(`\nNext steps:`);
    console.log(`  1. npm run hydrate       # re-fetch BSB text for ranges`);
    console.log(`  2. npm run hydrate:commentary  # re-fetch commentary`);
    console.log(`  3. npm run review        # rebuild the review page`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
