// TranslationPicker.jsx
// Drop-in React component. Reads index.json from GCS_PUBLIC_BASE and lets the
// user pick a translation. Filters deuterocanonical canons depending on user
// config (e.g., TruePresence Catholic vs GraceSteps evangelical).
//
// Usage:
//   <TranslationPicker
//     value={selected}
//     onChange={setSelected}
//     publicBase="https://storage.googleapis.com/truepresence-bible"
//     showDeuterocanon={true}
//   />

import { useEffect, useMemo, useState } from "react";

export default function TranslationPicker({
  value,
  onChange,
  publicBase = "https://storage.googleapis.com/truepresence-bible",
  showDeuterocanon = true,
}) {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${publicBase}/index.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setIndex(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicBase]);

  const options = useMemo(() => {
    if (!index) return [];
    return index
      .filter((t) => (showDeuterocanon ? true : t.canon === 66))
      .slice()
      .sort((a, b) => (b.default ? 1 : 0) - (a.default ? 1 : 0));
  }, [index, showDeuterocanon]);

  // Once options load, default the selection if the parent hasn't.
  useEffect(() => {
    if (!value && options.length) {
      const def = options.find((o) => o.default) || options[0];
      onChange?.(def.id);
    }
  }, [options, value, onChange]);

  if (error) {
    return <div style={{ color: "#b00" }}>Translation list unavailable: {error}</div>;
  }
  if (!index) {
    return <div aria-busy="true">Loading translations…</div>;
  }

  return (
    <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <span>Translation</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        style={{ padding: "4px 8px" }}
      >
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.abbr} — {t.name}
            {t.canon === 73 ? " (incl. deuterocanon)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
