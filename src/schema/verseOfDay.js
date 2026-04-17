// src/schema/verseOfDay.js
// A dated, published "Verse of the Day" document written by the daily cron.
//
// i18n: Date+language keyed (Pattern 2, matches dailyReading/dailyMeditation).
//   English:  verseOfDay-2026-04-17-en
//   Spanish:  verseOfDay-2026-04-17-es
//   Query:    *[_type == "verseOfDay" && date == $today && language == $lang][0]
//
// NOTE: weekNumber is the structural key. virtueTitle is display metadata
// from the virtue-of-the-week HTML schedule. The virtue reference is optional.

export default {
  name: "verseOfDay",
  title: "Verse of the Day",
  type: "document",
  fields: [
    {
      name: "language",
      title: "Language",
      type: "string",
      description: "ISO language code (en, es, pt, etc.).",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "date",
      title: "Date (YYYY-MM-DD)",
      type: "string",
      description: "The calendar date this verse is published for.",
      validation: (Rule) =>
        Rule.required().regex(/^\d{4}-\d{2}-\d{2}$/, { name: "ISO date" }),
    },
    { name: "weekNumber", title: "Virtue Week (1–52)", type: "number" },
    { name: "day", title: "Day (0=Sun…6=Sat)", type: "number" },
    { name: "dayTheme", title: "Day Theme", type: "string" },
    {
      name: "virtueTitle",
      title: "Virtue Title",
      type: "string",
      description: "Display name of the virtue for this week.",
    },
    {
      name: "virtue",
      title: "Virtue (optional ref)",
      type: "reference",
      to: [{ type: "virtue" }],
      weak: true,
      description: "Optional link to a Sanity virtue doc, if one exists.",
    },
    { name: "reference", title: "Scripture Reference (OSIS)", type: "string" },
    { name: "bookName", title: "Book Name", type: "string" },
    { name: "humanReference", title: "Human Reference", type: "string" },
    { name: "bsbText", title: "Verse Text", type: "text", rows: 3, description: "BSB text for English; translated text for other languages." },
    { name: "rationale", title: "Editorial Rationale", type: "text", rows: 2 },
    { name: "commentaryExcerpt", title: "Commentary Excerpt", type: "text", rows: 3, description: "Short reflection from commentary (may vary by language)." },
    {
      name: "assignment",
      title: "Source Assignment",
      type: "reference",
      to: [{ type: "verseAssignment" }],
      weak: true,
    },
    { name: "publishedAt", title: "Published At", type: "datetime" },
  ],
  preview: {
    select: { date: "date", ref: "humanReference", virtueTitle: "virtueTitle", language: "language" },
    prepare: ({ date, ref, virtueTitle, language }) => ({
      title: `${date} [${language || "en"}] — ${ref ?? "(no ref)"}`,
      subtitle: virtueTitle ? `Virtue: ${virtueTitle}` : undefined,
    }),
  },
  orderings: [
    { title: "Date (newest first)", name: "dateDesc", by: [{ field: "date", direction: "desc" }] },
  ],
};
