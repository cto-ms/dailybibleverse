// virtue-week.mjs
// 52-week virtue-of-the-week calendar with fixed + flex phases.
// Mirrors the spec at
//   https://cto-ms.github.io/truepresence-dev-reference/virtue-of-the-week.html
//
// Phases:
//   Advent         1–4   fixed (4 weeks; Advent Sunday 1 through Dec 24)
//   Christmas      5–6   fixed (Christmas octave through Baptism of the Lord)
//   Ordinary I     7–13  flex  (Baptism of Lord through Ash Wednesday)
//   Lent          14–19  fixed (Ash Wednesday through Holy Saturday)
//   Easter        20–27  fixed (Easter through Pentecost +6 days)
//   Ordinary II   28–52  flex  (Post-Pentecost through Saturday before next Advent 1)

// ───────── Date helpers ─────────
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function diffDays(a, b) {
  return Math.round((toUTC(a) - toUTC(b)) / MS_PER_DAY);
}

// ───────── Liturgical anchors ─────────

// Easter Sunday (Gregorian) — Meeus/Jones/Butcher computus.
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

// First Sunday of Advent = Sunday on or before 4 Sundays before Christmas.
// Equivalent: the Sunday nearest (or on) Nov 30 / closest to Nov 30 working backward.
// Standard rule: Advent I = Sunday closest to the feast of St. Andrew (Nov 30).
export function firstSundayOfAdvent(year) {
  // Start at Christmas (Dec 25). Go back until we find the 4th previous Sunday.
  const christmas = new Date(Date.UTC(year, 11, 25));
  // Sunday before Christmas:
  let sunday = addDays(christmas, -christmas.getUTCDay());
  if (sunday.getUTCDate() === christmas.getUTCDate()) sunday = addDays(sunday, -7);
  // That's Advent IV. Go back 3 more weeks.
  return addDays(sunday, -21);
}

export function ashWednesday(year) {
  return addDays(easterSunday(year), -46);
}

export function pentecost(year) {
  return addDays(easterSunday(year), 49);
}

export function baptismOfTheLord(year) {
  // First Sunday after Jan 6 (Epiphany). If Jan 6 is Sunday, it falls on Jan 7 = Monday
  // under older rubrics, but current US Catholic practice observes on the following Monday
  // when Epiphany is moved to Jan 7–8. For the calendar's purposes we use the simple rule:
  // Sunday after Epiphany. If Epiphany itself is a Sunday, Baptism is observed the next day.
  const epiphany = new Date(Date.UTC(year, 0, 6));
  const dow = epiphany.getUTCDay();
  if (dow === 0) return addDays(epiphany, 1); // Monday observance
  return addDays(epiphany, 7 - dow); // next Sunday
}

// ───────── Phase table for a given "liturgical year" anchored on Advent I ─────────
// A liturgical year starts on Advent I of year Y_adv and ends the day before
// Advent I of year Y_adv + 1. So for date D on/after Advent I of year Y, the
// liturgical year is Y. For D before Advent I of year Y, it's Y-1.
export function liturgicalYearStart(date) {
  const d = toUTC(date);
  const y = d.getUTCFullYear();
  const adventThisYear = firstSundayOfAdvent(y);
  return d >= adventThisYear
    ? adventThisYear
    : firstSundayOfAdvent(y - 1);
}

// ───────── getVirtueWeek(date) → 1..52 ─────────
export function getVirtueWeek(date) {
  const today = toUTC(date);
  const adventI = liturgicalYearStart(today);
  const civilYearOfAdventStart = adventI.getUTCFullYear();
  const nextAdventI = firstSundayOfAdvent(civilYearOfAdventStart + 1);

  // Fixed anchors for the SAME liturgical year:
  // Advent I is in civilYearOfAdventStart. Christmas, Baptism, Ash Wed, Easter,
  // Pentecost all fall in the FOLLOWING civil year.
  const liturgYear = civilYearOfAdventStart + 1;
  const christmas = new Date(Date.UTC(civilYearOfAdventStart, 11, 25));
  const baptism = baptismOfTheLord(liturgYear);
  const ashWed = ashWednesday(liturgYear);
  const easter = easterSunday(liturgYear);
  const pent = pentecost(liturgYear);
  const pentPlus6 = addDays(pent, 6); // End of week 27

  // Phase boundaries (inclusive start, exclusive end).
  // Advent weeks 1–4 map to the 4 Sundays of Advent.
  if (today < addDays(christmas, 0)) {
    // Advent I (week 1) starts at adventI. Weeks 1..4 are 7 days each.
    const w = Math.floor(diffDays(today, adventI) / 7) + 1;
    return clamp(w, 1, 4);
  }

  // Christmas weeks 5–6: Dec 25 through Baptism of the Lord (inclusive).
  // That span can be 14–20ish days; we compress/expand to 2 weeks (5 & 6).
  if (today <= baptism) {
    const spanDays = diffDays(baptism, christmas) + 1;
    const offset = diffDays(today, christmas);
    const frac = offset / Math.max(spanDays - 1, 1); // 0..1
    const w = 5 + Math.floor(frac * 2 + 1e-9); // 5 or 6
    return clamp(w, 5, 6);
  }

  // Ordinary Time I: weeks 7–13 (FLEX). From day after Baptism through day before Ash Wednesday.
  if (today < ashWed) {
    return flexWeek(today, addDays(baptism, 1), addDays(ashWed, -1), 7, 13);
  }

  // Lent: weeks 14–19 (FIXED 6 weeks = 42 days). Ash Wed through Holy Saturday (Easter - 1).
  const holySat = addDays(easter, -1);
  if (today <= holySat) {
    const w = 14 + Math.floor(diffDays(today, ashWed) / 7);
    return clamp(w, 14, 19);
  }

  // Easter: weeks 20–27 (FIXED 8 weeks = 56 days). Easter Sunday through Pentecost +6.
  if (today <= pentPlus6) {
    const w = 20 + Math.floor(diffDays(today, easter) / 7);
    return clamp(w, 20, 27);
  }

  // Ordinary Time II: weeks 28–52 (FLEX). Day after Pentecost+6 through Saturday before next Advent I.
  const ordIIStart = addDays(pentPlus6, 1);
  const ordIIEnd = addDays(nextAdventI, -1);
  return flexWeek(today, ordIIStart, ordIIEnd, 28, 52);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Proportional mapping across a flex zone.
// Given start/end (inclusive) and weekLo..weekHi (inclusive), map today → week.
function flexWeek(today, start, end, weekLo, weekHi) {
  const totalDays = diffDays(end, start) + 1;
  const offset = diffDays(today, start);
  const frac = Math.max(0, Math.min(1, offset / Math.max(totalDays - 1, 1)));
  const span = weekHi - weekLo + 1;
  let w = weekLo + Math.floor(frac * span);
  if (w > weekHi) w = weekHi;
  return w;
}

// ───────── getDayIndex(date) → 0..6 (0 = Sunday) ─────────
export function getDayIndex(date) {
  return toUTC(date).getUTCDay();
}

// ───────── Day theme table ─────────
export const DAY_THEMES = [
  { day: 0, name: "Sunday", theme: "Define", intent: "What is this virtue?", guidance: "A verse that names or describes the virtue directly." },
  { day: 1, name: "Monday", theme: "Root", intent: "Where does it come from?", guidance: "God as source; the theological foundation of the virtue." },
  { day: 2, name: "Tuesday", theme: "Model", intent: "Who lived it?", guidance: "A biblical person or narrative that embodies the virtue." },
  { day: 3, name: "Wednesday", theme: "Practice", intent: "How do I grow it?", guidance: "Action-oriented or instructive verse; practical formation." },
  { day: 4, name: "Thursday", theme: "Obstacle", intent: "What opposes it?", guidance: "The vice or temptation this virtue overcomes." },
  { day: 5, name: "Friday", theme: "Fruit", intent: "What does it produce?", guidance: "The promised outcome, blessing, or transformation." },
  { day: 6, name: "Saturday", theme: "Prayer", intent: "Surrender and receive", guidance: "A verse suited to closing prayer and reflective quiet." },
];

export function dayTheme(date) {
  return DAY_THEMES[getDayIndex(date)];
}

// Convenience wrapper
export function virtueContext(date = new Date()) {
  return {
    weekNumber: getVirtueWeek(date),
    day: getDayIndex(date),
    theme: dayTheme(date),
  };
}
