# TruePresence Bible Verse Infrastructure

Implements the spec in `TruePresence_Bible_Verse_Infrastructure_Spec.docx`.

- **Virtue-of-the-Week calendar** — 52-week cycle derived from liturgical anchors (Easter computus, Advent I, Ash Wednesday, Pentecost).
- **GCS-backed translation cache** — BSB / KJV / WEB / DRB normalized to one JSON schema.
- **Sanity-managed verse assignments** — 52 × 7 = 364 editorial records, reviewable in Studio.
- **Daily Verse-of-the-Day uploader** — cron-driven script that writes today's verse to Sanity.
- **Runtime resolver** — Express service with in-memory verse lookup for near-zero latency.
- **Translation picker UI** — React drop-in that reads `index.json` from GCS.

## Layout

```
src/
  lib/
    virtue-week.mjs         # getVirtueWeek / getDayIndex / Easter computus
    virtue-week.test.mjs    # 25 smoke tests
    bible-refs.mjs          # canonical book codes, parse / format helpers
    gcs.mjs                 # Google Cloud Storage client factory
    sanity.mjs              # Sanity client factory
    translation-cache.mjs   # in-memory GCS-backed verse lookup
  scripts/
    01-ingest-gcs.mjs       # download + normalize + upload translations
    03-generate-refs.mjs    # Claude API: 52 × 7 arc drafts
    04-hydrate.mjs          # HelloAO BSB validation + text attachment
    05-import-sanity.mjs    # bulk import verseAssignment docs
    06-upload-verse-of-day.mjs  # daily "verse of the day" Sanity writer
  schema/
    verseAssignment.js      # Sanity doc type (editorial source of truth)
    verseOfDay.js           # Sanity doc type (dated, client-facing)
    README.md               # Studio install notes
  server/
    index.mjs               # runtime resolver (GKE-ready)
  ui/
    TranslationPicker.jsx   # React drop-in
```

## One-time setup

```bash
npm install
cp .env.example .env
# fill in SANITY_WRITE_TOKEN, GCS_BUCKET + credentials, ANTHROPIC_API_KEY
```

## Build sequence (matches spec §8)

1. **Ingest translations → GCS.** Populates `gs://truepresence-bible/translations/*.json` and `index.json`.
   ```bash
   npm run ingest:gcs                  # full run
   node src/scripts/01-ingest-gcs.mjs --dry-run --only=bsb
   ```

2. **Add Sanity schema.** Copy `src/schema/verseAssignment.js` + `verseOfDay.js` into the Studio repo, register, deploy (see `src/schema/README.md`).

3. **Generate verse references.** Calls Claude per virtue; writes `data/generated/references.json`.
   ```bash
   npm run generate:refs
   node src/scripts/03-generate-refs.mjs --weeks=1-4
   ```

4. **Hydrate + validate against HelloAO BSB.** Writes `data/hydrated/references.json` + `errors.json`.
   ```bash
   npm run hydrate
   ```

5. **Import into Sanity.** Deterministic IDs — safe to re-run.
   ```bash
   npm run import:sanity -- --dry-run
   npm run import:sanity
   ```

6. **Run the resolver service.** (Deploy to GKE us-east1 per spec.)
   ```bash
   npm run server
   # GET /verse-of-day → { date, reference, text, virtue, … }
   ```

7. **Daily verse-of-the-day upload.** Writes one `verseOfDay-YYYY-MM-DD` doc per day.
   ```bash
   npm run upload:verse-of-day
   node src/scripts/06-upload-verse-of-day.mjs --backfill=7
   ```

   Schedule with cron / GKE CronJob / Cloud Scheduler at 00:05 UTC:
   ```cron
   5 0 * * *  cd /app && /usr/bin/node src/scripts/06-upload-verse-of-day.mjs >> /var/log/votd.log 2>&1
   ```

## Runtime lookup flow (spec §6)

```
getVirtueWeek(today) → N (1..52)
getDayIndex(today)   → D (0..6)
Sanity GROQ:
  *[_type == "verseAssignment" && weekNumber == N && day == D][0]
→ reference = "PHP.4.13"
  parseReference → { book, chapter, verse }
  translationCache.lookup → text
→ return { reference, text, virtue, dayTheme, rationale }
```

## Key invariants (do not break)

- **Sanity never stores verse text.** It stores only the dotted reference. Adding a translation = ingesting to GCS; no Sanity edits required.
- **Translation JSON is loaded ONCE at startup.** The resolver never makes a per-request GCS call.
- **All document IDs are deterministic.** `verseAssignment-w{week}-d{day}` and `verseOfDay-YYYY-MM-DD` so every script is idempotent.
- **BSB canon only for AI-generated drafts.** The 66-book restriction is enforced in the system prompt and re-validated at hydration time.

## External references

- Virtue-of-the-Week: https://cto-ms.github.io/truepresence-dev-reference/virtue-of-the-week.html
- BSB license: https://berean.bible/licensing.htm (CC0)
- HelloAO BSB API: https://bible.helloao.org
- Bible SuperSearch JSON: https://sourceforge.net/projects/biblesuper/files/All%20Bibles%20-%20JSON/
- Sanity Studio: https://virtuestories.sanity.studio (project `hx1r1wkd`)
# dailybibleverse
