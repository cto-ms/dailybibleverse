// src/schema/verseAssignment.js
// Sanity schema: one document per (weekNumber × day-of-week) = 52 × 7 = 364 docs.
// Drop this into the Sanity Studio `schemas/` folder for project hx1r1wkd
// and register it in schemas/index.(js|ts).
//
// i18n: Document-level i18n (Pattern 1).
//   English base:  verseAssignment-wNN-dD
//   Spanish:       i18n.verseAssignment-wNN-dD.es
//   Metadata:      translation.metadata.verseAssignment-wNN-dD
// Translatable fields: bsbText, commentaryExcerpt, rationale
//
// IMPORTANT: weekNumber is the PRIMARY KEY — computed at runtime by
// getVirtueWeek(date) from the liturgical calendar. There is NO weekNumber
// field on the `virtue` Sanity schema. The virtue-to-week mapping lives in
// the static HTML schedule (virtue-of-the-week.html), not in Sanity.

export default {
  name: "verseAssignment",
  title: "Verse Assignment",
  type: "document",
  fields: [
    {
      name: "language",
      title: "Language",
      type: "string",
      description: "ISO language code. 'en' for base docs, 'es'/'pt'/etc. for translations.",
      initialValue: "en",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "weekNumber",
      title: "Virtue Week (1–52)",
      type: "number",
      description:
        "Computed from getVirtueWeek(date). This is the primary lookup key.",
      validation: (Rule) => Rule.required().integer().min(1).max(52),
    },
    {
      name: "day",
      title: "Day (0 = Sun … 6 = Sat)",
      type: "number",
      validation: (Rule) => Rule.required().integer().min(0).max(6),
    },
    {
      name: "virtueTitle",
      title: "Virtue Title",
      type: "string",
      description:
        "Display name of the virtue for this week (e.g. 'Prudence'). Stored as a string — the canonical source is the virtue-of-the-week HTML schedule.",
    },
    {
      name: "virtueLiturgicalContext",
      title: "Liturgical Context",
      type: "text",
      description:
        "Why this virtue fits this liturgical week (from the schedule page).",
      rows: 2,
    },
    {
      name: "virtue",
      title: "Virtue (optional Sanity ref)",
      type: "reference",
      to: [{ type: "virtue" }],
      weak: true,
      description:
        "Optional link to a Sanity virtue document, if one exists. Not required — weekNumber is the primary key.",
    },
    {
      name: "dayTheme",
      title: "Day Theme",
      type: "string",
      options: {
        list: [
          { title: "Sunday — Define", value: "Define" },
          { title: "Monday — Root", value: "Root" },
          { title: "Tuesday — Model", value: "Model" },
          { title: "Wednesday — Practice", value: "Practice" },
          { title: "Thursday — Obstacle", value: "Obstacle" },
          { title: "Friday — Fruit", value: "Fruit" },
          { title: "Saturday — Prayer", value: "Prayer" },
        ],
        layout: "dropdown",
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "reference",
      title: "Scripture Reference",
      type: "string",
      description:
        "Dotted form: BOOK.CHAPTER.VERSE — e.g. PHP.4.13. Translation-agnostic.",
      validation: (Rule) =>
        Rule.required().regex(/^[1-3]?[A-Z]{2,3}\.\d+\.\d+(-\d+)?$/, {
          name: "dotted reference",
        }),
    },
    {
      name: "bsbText",
      title: "Verse Text",
      type: "text",
      description: "BSB verse text for English; translated verse text for other languages.",
      rows: 3,
    },
    {
      name: "rationale",
      title: "Editorial Rationale",
      type: "text",
      description:
        "Why this verse fits the virtue and day theme. Shown only to reviewers.",
      rows: 3,
    },
    {
      name: "commentary",
      title: "Commentary",
      type: "text",
      description:
        "Full commentary for this verse (public domain). Matthew Henry primary; Jamieson-Fausset-Brown fallback. May cover a verse group.",
      rows: 6,
    },
    {
      name: "commentaryExcerpt",
      title: "Commentary Excerpt",
      type: "text",
      description:
        "First 2–3 sentences of commentary, suitable for a daily reflection card. Editable.",
      rows: 3,
    },
    {
      name: "commentarySource",
      title: "Commentary Source",
      type: "string",
      description:
        "Which commentary was used — 'matthew-henry' (primary) or 'jamieson-fausset-brown' (fallback).",
      options: {
        list: [
          { title: "Matthew Henry", value: "matthew-henry" },
          { title: "Jamieson-Fausset-Brown", value: "jamieson-fausset-brown" },
        ],
      },
      readOnly: true,
    },
    {
      name: "reviewStatus",
      title: "Review Status",
      type: "string",
      initialValue: "draft",
      options: {
        list: [
          { title: "Draft (AI)", value: "draft" },
          { title: "In Review", value: "review" },
          { title: "Approved", value: "approved" },
          { title: "Needs Rework", value: "rework" },
        ],
      },
    },
    {
      name: "reviewer",
      title: "Reviewer",
      type: "string",
    },
    {
      name: "reviewedAt",
      title: "Reviewed At",
      type: "datetime",
    },
  ],
  preview: {
    select: {
      week: "weekNumber",
      day: "day",
      theme: "dayTheme",
      ref: "reference",
      virtueTitle: "virtueTitle",
    },
    prepare({ week, day, theme, ref, virtueTitle }) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return {
        title: `W${week} ${days[day] ?? day} — ${virtueTitle ?? "(week " + week + ")"}`,
        subtitle: `${theme ?? "—"} · ${ref ?? "—"}`,
      };
    },
  },
  orderings: [
    {
      title: "Week then day",
      name: "weekDay",
      by: [
        { field: "weekNumber", direction: "asc" },
        { field: "day", direction: "asc" },
      ],
    },
  ],
};
