# Sanity schema changes

This project adds two document types to the existing Sanity project `hx1r1wkd`
(virtuestories.sanity.studio):

- `verseAssignment` — 364 editorial records (52 weeks × 7 days)
- `verseOfDay` — dated, client-facing verse documents written by the daily cron

## Install

1. Copy `verseAssignment.js` and `verseOfDay.js` into the Sanity Studio repo's
   `schemas/` folder.
2. Register them in `schemas/index.(js|ts)`:

   ```js
   import verseAssignment from "./verseAssignment";
   import verseOfDay from "./verseOfDay";

   export const schemaTypes = [
     // …existing types
     verseAssignment,
     verseOfDay,
   ];
   ```

3. Deploy Studio: `npx sanity deploy` (or push to the Studio host).

## How weekNumber works

There is **no weekNumber field** on the `virtue` document type. The virtue-of-the-
week mapping is determined entirely by client-side JavaScript:

1. `getVirtueWeek(date)` computes which liturgical week it is (1–52)
2. The static HTML schedule on `virtue-of-the-week.html` maps week → virtue

The `verseAssignment` document uses `weekNumber` + `day` as its primary key.
The `virtueTitle` field is a plain string for display purposes — it comes from
the HTML schedule, not from a Sanity reference.

The optional `virtue` reference field allows linking to an existing Sanity
virtue document if one exists, but it is **not required**.

## GROQ for runtime lookup

```groq
*[_type == "verseAssignment" && weekNumber == $week && day == $day][0]{
  reference,
  dayTheme,
  rationale,
  virtueTitle,
  virtueLiturgicalContext
}
```

For the verse of the day (client-facing):

```groq
*[_type == "verseOfDay" && date == $today][0]{
  date,
  weekNumber,
  day,
  dayTheme,
  virtueTitle,
  reference,
  humanReference,
  bookName,
  bsbText,
  rationale,
  publishedAt
}
```
