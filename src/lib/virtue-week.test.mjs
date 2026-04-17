// Smoke tests for the virtue-week library.
// Run: node src/lib/virtue-week.test.mjs
import {
  getVirtueWeek,
  getDayIndex,
  easterSunday,
  firstSundayOfAdvent,
  ashWednesday,
  pentecost,
  baptismOfTheLord,
  dayTheme,
} from "./virtue-week.mjs";

let passed = 0, failed = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  (ok ? passed++ : failed++);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
}
function d(y, m, dd) { return new Date(Date.UTC(y, m - 1, dd)); }
function iso(x) { return x.toISOString().slice(0, 10); }

// Easter spot-checks (well-known dates)
eq("Easter 2024", iso(easterSunday(2024)), "2024-03-31");
eq("Easter 2025", iso(easterSunday(2025)), "2025-04-20");
eq("Easter 2026", iso(easterSunday(2026)), "2026-04-05");
eq("Easter 2027", iso(easterSunday(2027)), "2027-03-28");

// Advent I spot-checks
eq("Advent I 2024", iso(firstSundayOfAdvent(2024)), "2024-12-01");
eq("Advent I 2025", iso(firstSundayOfAdvent(2025)), "2025-11-30");
eq("Advent I 2026", iso(firstSundayOfAdvent(2026)), "2026-11-29");

// Ash Wed & Pentecost derive from Easter
eq("Ash Wed 2026", iso(ashWednesday(2026)), "2026-02-18");
eq("Pentecost 2026", iso(pentecost(2026)), "2026-05-24");

// Baptism of the Lord
// 2026: Jan 6 is a Tuesday → Sunday after = Jan 11.
eq("Baptism 2026", iso(baptismOfTheLord(2026)), "2026-01-11");

// Phase sanity checks for liturgical year starting Advent 2025 (Nov 30 2025) → year 2026.
// Advent I (Nov 30 2025) should be week 1.
eq("Advent I Nov 30 2025 → week 1", getVirtueWeek(d(2025, 11, 30)), 1);
eq("Advent II Dec 7 2025 → week 2", getVirtueWeek(d(2025, 12, 7)), 2);
eq("Dec 25 2025 Christmas → week 5", getVirtueWeek(d(2025, 12, 25)), 5);
eq("Baptism Jan 11 2026 → week 6", getVirtueWeek(d(2026, 1, 11)), 6);

// Ordinary I flex: Jan 12 → week 7, day before Ash Wed (Feb 17) → week 13
eq("Jan 12 2026 → week 7", getVirtueWeek(d(2026, 1, 12)), 7);
eq("Feb 17 2026 → week 13", getVirtueWeek(d(2026, 2, 17)), 13);

// Lent weeks 14–19 (6 fixed weeks starting Ash Wed Feb 18 2026)
eq("Ash Wed Feb 18 2026 → week 14", getVirtueWeek(d(2026, 2, 18)), 14);
eq("Holy Saturday Apr 4 2026 → week 19", getVirtueWeek(d(2026, 4, 4)), 19);

// Easter weeks 20–27
eq("Easter Apr 5 2026 → week 20", getVirtueWeek(d(2026, 4, 5)), 20);
eq("Pentecost +6 = May 30 2026 → week 27", getVirtueWeek(d(2026, 5, 30)), 27);

// Ordinary II starts May 31 2026 → week 28, ends Nov 28 2026 → week 52
eq("May 31 2026 → week 28", getVirtueWeek(d(2026, 5, 31)), 28);
eq("Nov 28 2026 → week 52", getVirtueWeek(d(2026, 11, 28)), 52);

// Boundary check: Nov 29 2026 is next Advent I → week 1
eq("Nov 29 2026 → week 1 (next liturg year)", getVirtueWeek(d(2026, 11, 29)), 1);

// Day index + themes
eq("Day index Apr 15 2026 (Wed)", getDayIndex(d(2026, 4, 15)), 3);
eq("Theme Wed", dayTheme(d(2026, 4, 15)).theme, "Practice");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
