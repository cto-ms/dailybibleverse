// bible-refs.mjs
// Canonical 3-letter book codes + parse/format of verse references like "PHP.4.13".

export const BOOKS_66 = [
  // Protestant canon (used by BSB and KJV) — 66 books.
  "GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI",
  "1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER",
  "LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP",
  "HAG","ZEC","MAL",
  "MAT","MRK","LUK","JHN","ACT","ROM","1CO","2CO","GAL","EPH","PHP","COL",
  "1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS","1PE","2PE","1JN","2JN",
  "3JN","JUD","REV",
];

// Deuterocanonical additions included in WEB (with apocrypha) and DRB.
export const DEUTERO_BOOKS = [
  "TOB","JDT","ESG","WIS","SIR","BAR","LJE","S3Y","SUS","BEL",
  "1MA","2MA","3MA","4MA","1ES","2ES","MAN",
];

export const BOOKS_73 = [...BOOKS_66, ...DEUTERO_BOOKS];

// Human-readable names (for index UIs / logging).
export const BOOK_NAMES = {
  GEN: "Genesis", EXO: "Exodus", LEV: "Leviticus", NUM: "Numbers", DEU: "Deuteronomy",
  JOS: "Joshua", JDG: "Judges", RUT: "Ruth", "1SA": "1 Samuel", "2SA": "2 Samuel",
  "1KI": "1 Kings", "2KI": "2 Kings", "1CH": "1 Chronicles", "2CH": "2 Chronicles",
  EZR: "Ezra", NEH: "Nehemiah", EST: "Esther", JOB: "Job", PSA: "Psalms",
  PRO: "Proverbs", ECC: "Ecclesiastes", SNG: "Song of Solomon", ISA: "Isaiah",
  JER: "Jeremiah", LAM: "Lamentations", EZK: "Ezekiel", DAN: "Daniel", HOS: "Hosea",
  JOL: "Joel", AMO: "Amos", OBA: "Obadiah", JON: "Jonah", MIC: "Micah", NAM: "Nahum",
  HAB: "Habakkuk", ZEP: "Zephaniah", HAG: "Haggai", ZEC: "Zechariah", MAL: "Malachi",
  MAT: "Matthew", MRK: "Mark", LUK: "Luke", JHN: "John", ACT: "Acts", ROM: "Romans",
  "1CO": "1 Corinthians", "2CO": "2 Corinthians", GAL: "Galatians", EPH: "Ephesians",
  PHP: "Philippians", COL: "Colossians", "1TH": "1 Thessalonians", "2TH": "2 Thessalonians",
  "1TI": "1 Timothy", "2TI": "2 Timothy", TIT: "Titus", PHM: "Philemon", HEB: "Hebrews",
  JAS: "James", "1PE": "1 Peter", "2PE": "2 Peter", "1JN": "1 John", "2JN": "2 John",
  "3JN": "3 John", JUD: "Jude", REV: "Revelation",
  TOB: "Tobit", JDT: "Judith", ESG: "Esther (Greek)", WIS: "Wisdom", SIR: "Sirach",
  BAR: "Baruch", LJE: "Letter of Jeremiah", S3Y: "Song of the Three Youths",
  SUS: "Susanna", BEL: "Bel and the Dragon",
  "1MA": "1 Maccabees", "2MA": "2 Maccabees", "3MA": "3 Maccabees", "4MA": "4 Maccabees",
  "1ES": "1 Esdras", "2ES": "2 Esdras", MAN: "Prayer of Manasseh",
};

// Common free-form → 3-letter-code aliases. Lowercased keys, no spaces.
const ALIASES = {
  genesis: "GEN", gen: "GEN",
  exodus: "EXO", exo: "EXO", ex: "EXO",
  leviticus: "LEV", lev: "LEV",
  numbers: "NUM", num: "NUM",
  deuteronomy: "DEU", deut: "DEU", deu: "DEU",
  joshua: "JOS", josh: "JOS",
  judges: "JDG", jdg: "JDG",
  ruth: "RUT",
  "1samuel": "1SA", "1sam": "1SA", "1sa": "1SA", "isamuel": "1SA",
  "2samuel": "2SA", "2sam": "2SA", "2sa": "2SA",
  "1kings": "1KI", "1kgs": "1KI", "1ki": "1KI",
  "2kings": "2KI", "2kgs": "2KI", "2ki": "2KI",
  "1chronicles": "1CH", "1chr": "1CH", "1ch": "1CH",
  "2chronicles": "2CH", "2chr": "2CH", "2ch": "2CH",
  ezra: "EZR", nehemiah: "NEH", esther: "EST",
  job: "JOB",
  psalm: "PSA", psalms: "PSA", ps: "PSA", psa: "PSA",
  proverbs: "PRO", prov: "PRO", pro: "PRO",
  ecclesiastes: "ECC", eccl: "ECC", ecc: "ECC",
  songofsolomon: "SNG", songofsongs: "SNG", song: "SNG", sos: "SNG", sng: "SNG",
  isaiah: "ISA", isa: "ISA",
  jeremiah: "JER", jer: "JER",
  lamentations: "LAM", lam: "LAM",
  ezekiel: "EZK", ezek: "EZK", ezk: "EZK",
  daniel: "DAN", dan: "DAN",
  hosea: "HOS", joel: "JOL", amos: "AMO", obadiah: "OBA", jonah: "JON",
  micah: "MIC", nahum: "NAM", habakkuk: "HAB", zephaniah: "ZEP",
  haggai: "HAG", zechariah: "ZEC", malachi: "MAL",
  matthew: "MAT", matt: "MAT", mat: "MAT",
  mark: "MRK", mrk: "MRK", mk: "MRK",
  luke: "LUK", luk: "LUK", lk: "LUK",
  john: "JHN", jhn: "JHN", jn: "JHN",
  acts: "ACT",
  romans: "ROM", rom: "ROM",
  "1corinthians": "1CO", "1cor": "1CO", "1co": "1CO",
  "2corinthians": "2CO", "2cor": "2CO", "2co": "2CO",
  galatians: "GAL", ephesians: "EPH", philippians: "PHP", phil: "PHP", php: "PHP",
  colossians: "COL", col: "COL",
  "1thessalonians": "1TH", "1thess": "1TH", "1th": "1TH",
  "2thessalonians": "2TH", "2thess": "2TH", "2th": "2TH",
  "1timothy": "1TI", "1tim": "1TI", "1ti": "1TI",
  "2timothy": "2TI", "2tim": "2TI", "2ti": "2TI",
  titus: "TIT", philemon: "PHM", phm: "PHM",
  hebrews: "HEB", heb: "HEB",
  james: "JAS", jas: "JAS",
  "1peter": "1PE", "1pet": "1PE", "1pe": "1PE",
  "2peter": "2PE", "2pet": "2PE", "2pe": "2PE",
  "1john": "1JN", "1jn": "1JN",
  "2john": "2JN", "2jn": "2JN",
  "3john": "3JN", "3jn": "3JN",
  jude: "JUD",
  revelation: "REV", rev: "REV", apocalypse: "REV",
};

export function normalizeBook(name) {
  if (!name) return null;
  const up = String(name).trim().toUpperCase();
  if (BOOKS_73.includes(up)) return up;
  const key = String(name).trim().toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  return ALIASES[key] || null;
}

// Parse "PHP.4.13" or "PHP.4.13-14" or "Philippians 4:13" or "Philippians 4:13-14"
// → { book, chapter, verse, verseEnd? }
// When verseEnd is present, the reference covers verses verse–verseEnd inclusive.
export function parseReference(ref) {
  if (!ref) return null;
  const s = String(ref).trim();

  // Dotted form: BOOK.CHAPTER.VERSE or BOOK.CHAPTER.VERSE-VERSEEND
  const dot = s.match(/^([1-3]?[A-Z]{2,3})\.(\d+)\.(\d+)(?:-(\d+))?$/);
  if (dot) {
    const result = { book: dot[1], chapter: +dot[2], verse: +dot[3] };
    if (dot[4]) result.verseEnd = +dot[4];
    return result;
  }

  // "Book C:V" or "Book C:V-V2"
  const long = s.match(/^(\d?\s?[A-Za-z]+(?:\s[A-Za-z]+)?)\s*(\d+)\s*[:.]\s*(\d+)(?:-(\d+))?$/);
  if (long) {
    const book = normalizeBook(long[1]);
    if (!book) return null;
    const result = { book, chapter: +long[2], verse: +long[3] };
    if (long[4]) result.verseEnd = +long[4];
    return result;
  }
  return null;
}

// Helper: is this a multi-verse range?
export function isRange(parsed) {
  return parsed && parsed.verseEnd != null && parsed.verseEnd > parsed.verse;
}

export function formatReference({ book, chapter, verse, verseEnd }) {
  const base = `${book}.${chapter}.${verse}`;
  return verseEnd ? `${base}-${verseEnd}` : base;
}

export function humanReference({ book, chapter, verse, verseEnd }) {
  const name = BOOK_NAMES[book] || book;
  const base = `${name} ${chapter}:${verse}`;
  return verseEnd ? `${base}-${verseEnd}` : base;
}
