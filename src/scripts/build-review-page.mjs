// build-review-page.mjs
// Generates a self-contained HTML review page for all 364 verse assignments.
// Embeds the JSON data directly so it can be opened as a local file.
//
// Usage: node src/scripts/build-review-page.mjs
//   Reads:  data/hydrated/references.json (preferred) or data/generated/references.json
//   Reads:  data/virtues.json (for virtue metadata)
//   Writes: data/review.html

import fs from "node:fs/promises";
import path from "node:path";

const HYDRATED = path.resolve("data/hydrated/references.json");
const GENERATED = path.resolve("data/generated/references.json");
const VIRTUES = path.resolve("data/virtues.json");
const OUT = path.resolve("data/review.html");

async function tryRead(p) {
  try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return null; }
}

async function main() {
  let entries = await tryRead(HYDRATED);
  let source = "hydrated";
  if (!entries || entries.length === 0) {
    entries = await tryRead(GENERATED);
    source = "generated";
  }
  if (!entries) { console.error("No references file found."); process.exit(1); }

  const virtues = (await tryRead(VIRTUES)) || [];
  const virtueMap = Object.fromEntries(virtues.map(v => [v.weekNumber, v]));

  console.log(`Building review page from ${source} data (${entries.length} entries)`);

  const html = buildHtml(entries, virtueMap, source);
  await fs.writeFile(OUT, html);
  console.log(`Wrote ${OUT}`);

  // Also write to docs/ for GitHub Pages
  const DOCS_OUT = path.resolve("docs/index.html");
  await fs.mkdir(path.dirname(DOCS_OUT), { recursive: true });
  await fs.writeFile(DOCS_OUT, html);
  console.log(`Wrote ${DOCS_OUT} (GitHub Pages)`);
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function humanRef(ref) {
  const NAMES = {GEN:"Genesis",EXO:"Exodus",LEV:"Leviticus",NUM:"Numbers",DEU:"Deuteronomy",JOS:"Joshua",JDG:"Judges",RUT:"Ruth","1SA":"1 Samuel","2SA":"2 Samuel","1KI":"1 Kings","2KI":"2 Kings","1CH":"1 Chronicles","2CH":"2 Chronicles",EZR:"Ezra",NEH:"Nehemiah",EST:"Esther",JOB:"Job",PSA:"Psalms",PRO:"Proverbs",ECC:"Ecclesiastes",SNG:"Song of Solomon",ISA:"Isaiah",JER:"Jeremiah",LAM:"Lamentations",EZK:"Ezekiel",DAN:"Daniel",HOS:"Hosea",JOL:"Joel",AMO:"Amos",OBA:"Obadiah",JON:"Jonah",MIC:"Micah",NAM:"Nahum",HAB:"Habakkuk",ZEP:"Zephaniah",HAG:"Haggai",ZEC:"Zechariah",MAL:"Malachi",MAT:"Matthew",MRK:"Mark",LUK:"Luke",JHN:"John",ACT:"Acts",ROM:"Romans","1CO":"1 Corinthians","2CO":"2 Corinthians",GAL:"Galatians",EPH:"Ephesians",PHP:"Philippians",COL:"Colossians","1TH":"1 Thessalonians","2TH":"2 Thessalonians","1TI":"1 Timothy","2TI":"2 Timothy",TIT:"Titus",PHM:"Philemon",HEB:"Hebrews",JAS:"James","1PE":"1 Peter","2PE":"2 Peter","1JN":"1 John","2JN":"2 John","3JN":"3 John",JUD:"Jude",REV:"Revelation"};
  const parts = ref.split(".");
  const verseStr = parts[2]; // may be "46" or "46-47"
  return `${NAMES[parts[0]] || parts[0]} ${parts[1]}:${verseStr}`;
}

function buildHtml(entries, virtueMap, source) {
  const hasText = entries.some(e => e.bsbText);
  const hasCommentary = entries.some(e => e.commentaryExcerpt);
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const themes = ["Define","Root","Model","Practice","Obstacle","Fruit","Prayer"];
  const themeColors = {Define:"#58a6ff",Root:"#3fb950",Model:"#d29922",Practice:"#f0883e",Obstacle:"#f85149",Fruit:"#bc8cff",Prayer:"#f778ba"};
  const phaseColors = {Advent:"#bc8cff","Christmas":"#e3b341","Ordinary Time I":"#58a6ff",Lent:"#f85149",Easter:"#3fb950","Ordinary Time II":"#58a6ff"};

  // Group by week
  const weeks = {};
  for (const e of entries) {
    if (!weeks[e.weekNumber]) weeks[e.weekNumber] = [];
    weeks[e.weekNumber].push(e);
  }
  for (const w of Object.values(weeks)) w.sort((a,b) => a.day - b.day);

  let weekRows = "";
  for (let w = 1; w <= 52; w++) {
    const days = weeks[w] || [];
    const virtue = virtueMap[w] || {};
    const phase = virtue.phase || days[0]?.phase || "";
    const pColor = phaseColors[phase] || "#8b949e";

    weekRows += `
    <div class="week-card" id="week-${w}">
      <div class="week-header" onclick="toggleWeek(${w})">
        <div class="week-title">
          <span class="week-num">W${w}</span>
          <span class="virtue-name">${esc(days[0]?.virtueTitle || virtue.title || "(unknown)")}</span>
          <span class="phase-badge" style="background:${pColor}22;color:${pColor};border:1px solid ${pColor}44">${esc(phase)}</span>
          ${virtue.cardinal ? `<span class="cardinal-badge">${esc(virtue.cardinal)}</span>` : ""}
        </div>
        <div class="week-subtitle">${esc(virtue.liturgicalContext || days[0]?.liturgicalContext || "")}</div>
        <span class="chevron" id="chev-${w}">▸</span>
      </div>
      <div class="week-body" id="body-${w}" style="display:none">
        ${virtue.connection ? `<div class="connection">${esc(virtue.connection)}</div>` : ""}
        <table class="verse-table">
          <thead>
            <tr>
              <th style="width:100px">Day</th>
              <th style="width:80px">Theme</th>
              <th style="width:140px">Reference</th>
              ${hasText ? '<th>BSB Text</th>' : ''}
              ${hasCommentary ? '<th>Commentary Reflection</th>' : ''}
              <th>Rationale</th>
            </tr>
          </thead>
          <tbody>
            ${days.map(d => {
              const tc = themeColors[d.dayTheme] || "#8b949e";
              return `<tr id="w${d.weekNumber}-d${d.day}">
                <td>${dayNames[d.day] || d.day}</td>
                <td><span class="theme-pill" style="background:${tc}22;color:${tc}">${esc(d.dayTheme)}</span></td>
                <td class="ref-cell"><a href="https://www.biblegateway.com/passage/?search=${encodeURIComponent(humanRef(d.reference))}&version=BSB" target="_blank" title="Open on BibleGateway">${esc(humanRef(d.reference))}</a><br><code class="osis">${esc(d.reference)}</code></td>
                ${hasText ? `<td class="text-cell">${esc(d.bsbText || "(not hydrated)")}</td>` : ''}
                ${hasCommentary ? `<td class="commentary-cell">${esc(d.commentaryExcerpt || "(no commentary)")}${d.commentarySource && d.commentarySource !== "matthew-henry" ? ` <span class="source-tag">[${esc(d.commentarySource)}]</span>` : ''}</td>` : ''}
                <td class="rationale-cell">${esc(d.rationale)}</td>
              </tr>`;
            }).join("\n")}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // Stats
  const totalEntries = entries.length;
  const booksUsed = new Set(entries.map(e => e.reference.split(".")[0])).size;
  const uniqueRefs = new Set(entries.map(e => e.reference)).size;
  const duplicates = totalEntries - uniqueRefs;
  const withCommentary = entries.filter(e => e.commentaryExcerpt).length;
  const mhCount = entries.filter(e => e.commentarySource === "matthew-henry").length;
  const jfbCount = entries.filter(e => e.commentarySource === "jamieson-fausset-brown").length;

  // Book distribution
  const bookCounts = {};
  for (const e of entries) {
    const b = e.reference.split(".")[0];
    bookCounts[b] = (bookCounts[b] || 0) + 1;
  }
  const topBooks = Object.entries(bookCounts).sort((a,b) => b[1]-a[1]).slice(0, 15);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verse Assignment Review — TruePresence</title>
<style>
:root {
  --bg: #0d1117; --surface: #161b22; --surface2: #1c2128;
  --border: #30363d; --text: #c9d1d9; --text-muted: #8b949e;
  --accent: #58a6ff; --green: #3fb950; --orange: #d29922; --red: #f85149;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background:var(--bg); color:var(--text); line-height:1.6; }
a { color:var(--accent); text-decoration:none; }
a:hover { text-decoration:underline; }
.container { max-width:1100px; margin:0 auto; padding:0 20px; }

header { background:var(--surface); border-bottom:1px solid var(--border); padding:20px 0; }
header h1 { font-size:22px; font-weight:600; }
header h1 span { color:var(--text-muted); font-weight:400; }
header p { color:var(--text-muted); font-size:14px; margin-top:4px; }

.stats-bar { display:flex; gap:12px; flex-wrap:wrap; padding:16px 0; }
.stat { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:12px 18px; text-align:center; min-width:120px; }
.stat .num { font-size:24px; font-weight:700; color:var(--accent); }
.stat .lbl { font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; }

.controls { display:flex; gap:10px; align-items:center; padding:12px 0; flex-wrap:wrap; }
.controls input[type=text] { background:var(--surface); border:1px solid var(--border); color:var(--text); padding:8px 12px; border-radius:6px; font-size:14px; width:260px; }
.controls select { background:var(--surface); border:1px solid var(--border); color:var(--text); padding:8px 10px; border-radius:6px; font-size:13px; }
.controls button { background:var(--surface); border:1px solid var(--border); color:var(--accent); padding:8px 14px; border-radius:6px; font-size:13px; cursor:pointer; }
.controls button:hover { background:var(--surface2); }
.controls button.active { background:var(--accent); color:#0d1117; border-color:var(--accent); }

.book-chart { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:16px; margin:12px 0; }
.book-chart h3 { font-size:14px; color:var(--text-muted); margin-bottom:10px; }
.bar-row { display:flex; align-items:center; gap:8px; margin:3px 0; font-size:12px; }
.bar-label { width:40px; text-align:right; color:var(--text-muted); font-family:monospace; }
.bar { height:18px; background:var(--accent); border-radius:3px; min-width:2px; transition:width .3s; }
.bar-count { color:var(--text-muted); font-size:11px; }

.week-card { background:var(--surface); border:1px solid var(--border); border-radius:8px; margin:8px 0; overflow:hidden; }
.week-header { padding:14px 18px; cursor:pointer; display:flex; align-items:center; gap:10px; flex-wrap:wrap; position:relative; }
.week-header:hover { background:var(--surface2); }
.week-num { font-weight:700; font-size:15px; color:var(--accent); min-width:30px; }
.virtue-name { font-weight:600; font-size:16px; }
.phase-badge { font-size:11px; padding:2px 8px; border-radius:10px; font-weight:500; }
.cardinal-badge { font-size:11px; padding:2px 8px; border-radius:10px; background:#30363d; color:var(--text-muted); }
.week-subtitle { font-size:13px; color:var(--text-muted); flex-basis:100%; margin-top:2px; }
.chevron { position:absolute; right:18px; top:16px; font-size:14px; color:var(--text-muted); transition:transform .2s; }
.chevron.open { transform:rotate(90deg); }

.week-body { padding:0 18px 18px; }
.connection { font-size:13px; color:var(--text-muted); font-style:italic; padding:8px 0 12px; border-bottom:1px solid var(--border); margin-bottom:12px; }

.verse-table { width:100%; border-collapse:collapse; font-size:13px; }
.verse-table th { text-align:left; padding:6px 8px; border-bottom:2px solid var(--border); color:var(--text-muted); font-size:11px; text-transform:uppercase; letter-spacing:.5px; }
.verse-table td { padding:8px 8px; border-bottom:1px solid var(--border); vertical-align:top; }
.verse-table tr:last-child td { border-bottom:none; }
.theme-pill { font-size:11px; padding:2px 8px; border-radius:10px; font-weight:500; white-space:nowrap; }
.ref-cell a { font-weight:600; }
.osis { font-size:10px; color:var(--text-muted); background:var(--surface2); padding:1px 4px; border-radius:3px; }
.text-cell { max-width:320px; font-size:12.5px; line-height:1.5; }
.commentary-cell { max-width:300px; font-size:12.5px; line-height:1.5; color:var(--text); font-style:italic; }
.source-tag { font-style:normal; font-size:11px; color:var(--orange); opacity:0.8; }
.rationale-cell { font-size:12.5px; color:var(--text-muted); }

.dup-warn { color:var(--orange); font-size:12px; }
.hidden { display:none !important; }

@media(max-width:700px) {
  .verse-table { font-size:12px; }
  .controls input[type=text] { width:100%; }
}
</style>
</head>
<body>
<header>
  <div class="container">
    <h1>Verse Assignment Review <span>— TruePresence Bible Verse of the Day</span></h1>
    <p>${totalEntries} assignments across 52 virtue weeks · Source: <code>${source}</code> · ${hasText ? "BSB text included" : "references only (run hydration for text)"} · Generated ${new Date().toISOString().slice(0,10)}</p>
  </div>
</header>
<div class="container">

  <div class="stats-bar">
    <div class="stat"><div class="num">${totalEntries}</div><div class="lbl">Assignments</div></div>
    <div class="stat"><div class="num">52</div><div class="lbl">Virtue Weeks</div></div>
    <div class="stat"><div class="num">${booksUsed}</div><div class="lbl">Books Used</div></div>
    <div class="stat"><div class="num">${uniqueRefs}</div><div class="lbl">Unique Refs</div></div>
    <div class="stat"><div class="num" style="color:${duplicates > 0 ? 'var(--orange)' : 'var(--green)'}">${duplicates}</div><div class="lbl">Duplicates</div></div>
    ${hasCommentary ? `<div class="stat"><div class="num" style="color:${withCommentary === totalEntries ? 'var(--green)' : 'var(--orange)'}">${withCommentary}</div><div class="lbl">With Commentary${mhCount && jfbCount ? ` (${mhCount} MH / ${jfbCount} JFB)` : ''}</div></div>` : ''}
  </div>

  <div class="book-chart">
    <h3>Top ${topBooks.length} Books by Frequency</h3>
    ${topBooks.map(([b, c]) => {
      const pct = Math.round((c / topBooks[0][1]) * 100);
      return `<div class="bar-row"><span class="bar-label">${b}</span><div class="bar" style="width:${pct}%"></div><span class="bar-count">${c}</span></div>`;
    }).join("\n")}
  </div>

  <div class="controls">
    <input type="text" id="search" placeholder="Search virtue, reference, rationale…" oninput="filterWeeks()">
    <select id="phaseFilter" onchange="filterWeeks()">
      <option value="">All phases</option>
      <option>Advent</option><option>Christmas</option><option>Ordinary Time I</option>
      <option>Lent</option><option>Easter</option><option>Ordinary Time II</option>
    </select>
    <select id="cardinalFilter" onchange="filterWeeks()">
      <option value="">All cardinals</option>
      <option>Prudence</option><option>Justice</option><option>Fortitude</option><option>Temperance</option>
    </select>
    <button onclick="expandAll()">Expand All</button>
    <button onclick="collapseAll()">Collapse All</button>
    <button id="dupBtn" onclick="showDuplicates()">Show Duplicates</button>
  </div>

  <div id="weeks">
    ${weekRows}
  </div>

</div>

<script>
const DATA = ${JSON.stringify(entries)};
const VIRTUES = ${JSON.stringify(virtueMap)};

function toggleWeek(w) {
  const b = document.getElementById('body-'+w);
  const c = document.getElementById('chev-'+w);
  if (b.style.display === 'none') { b.style.display='block'; c.classList.add('open'); }
  else { b.style.display='none'; c.classList.remove('open'); }
}
function expandAll() {
  document.querySelectorAll('.week-body').forEach(b => b.style.display='block');
  document.querySelectorAll('.chevron').forEach(c => c.classList.add('open'));
}
function collapseAll() {
  document.querySelectorAll('.week-body').forEach(b => b.style.display='none');
  document.querySelectorAll('.chevron').forEach(c => c.classList.remove('open'));
}
function filterWeeks() {
  const q = document.getElementById('search').value.toLowerCase();
  const phase = document.getElementById('phaseFilter').value;
  const cardinal = document.getElementById('cardinalFilter').value;
  document.querySelectorAll('.week-card').forEach(card => {
    const w = parseInt(card.id.replace('week-',''));
    const v = VIRTUES[w] || {};
    const days = DATA.filter(d => d.weekNumber === w);
    const text = [v.title, v.phase, v.cardinal, v.liturgicalContext, v.connection,
      ...days.map(d => d.reference + ' ' + d.rationale + ' ' + d.dayTheme + ' ' + (d.bsbText||''))
    ].join(' ').toLowerCase();
    const matchQ = !q || text.includes(q);
    const matchP = !phase || (v.phase||'') === phase;
    const matchC = !cardinal || (v.cardinal||'') === cardinal;
    card.classList.toggle('hidden', !(matchQ && matchP && matchC));
  });
}
function showDuplicates() {
  const refCount = {};
  DATA.forEach(e => { refCount[e.reference] = (refCount[e.reference]||0)+1; });
  const dups = new Set(Object.keys(refCount).filter(r => refCount[r] > 1));
  if (dups.size === 0) { alert('No duplicate references found!'); return; }
  // Expand weeks with duplicates, collapse others
  collapseAll();
  const dupWeeks = new Set(DATA.filter(e => dups.has(e.reference)).map(e => e.weekNumber));
  dupWeeks.forEach(w => {
    const b = document.getElementById('body-'+w);
    const c = document.getElementById('chev-'+w);
    if (b) { b.style.display='block'; c.classList.add('open'); }
  });
  // Highlight duplicate cells
  document.querySelectorAll('.ref-cell').forEach(cell => {
    const code = cell.querySelector('code');
    if (code && dups.has(code.textContent)) {
      cell.style.background = 'rgba(210,153,34,0.15)';
    } else {
      cell.style.background = '';
    }
  });
}
</script>
</body>
</html>`;
}

main().catch(err => { console.error(err); process.exit(1); });
