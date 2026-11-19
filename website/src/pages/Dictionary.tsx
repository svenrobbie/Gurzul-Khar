import { useMemo, useState } from "react";
import { lexicon, type LexiconEntry } from "@engine/data.js";
import { latinToNative } from "@engine/generator/transliteration.js";
import { ipaOfWord } from "@engine/translator/ipa.js";

const POS_OPTIONS = Array.from(new Set(lexicon.entries.map((e) => e.pos))).sort();
const DOMAIN_OPTIONS = Array.from(new Set(lexicon.entries.map((e) => e.domain))).sort();

function relatedEntries(entry: LexiconEntry): LexiconEntry[] {
  const rootKey = entry.root ?? entry.gkh;
  return lexicon.entries.filter((e) => e.id !== entry.id && (e.root === rootKey || e.gkh === rootKey || e.root === entry.root));
}

export default function Dictionary() {
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("");
  const [domain, setDomain] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lexicon.entries.filter((e) => {
      if (pos && e.pos !== pos) return false;
      if (domain && e.domain !== domain) return false;
      if (!q) return true;
      return e.gkh.toLowerCase().includes(q) || e.en.toLowerCase().includes(q) || e.nl.toLowerCase().includes(q);
    });
  }, [query, pos, domain]);

  return (
    <div>
      <h1>Dictionary</h1>
      <p className="notice">
        {lexicon.entries.length} entries. Search in English, Dutch or Gurzûl Khar; filter by part of speech or
        semantic domain. Data source: <code>data/lexicon/lexicon.json</code> — the dictionary never duplicates this
        data, it only renders it.
      </p>

      <div className="card grid grid-2" style={{ marginTop: "1rem" }}>
        <div>
          <label htmlFor="dict-search">Search</label>
          <br />
          <input id="dict-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. strength, kracht, khar" style={{ width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <div>
            <label htmlFor="dict-pos">Part of speech</label>
            <br />
            <select id="dict-pos" value={pos} onChange={(e) => setPos(e.target.value)}>
              <option value="">All</option>
              {POS_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dict-domain">Domain</label>
            <br />
            <select id="dict-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="">All</option>
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <p style={{ marginTop: "1rem" }}>
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>

      <div className="grid grid-2">
        {results.map((entry) => {
          const related = relatedEntries(entry);
          let svg = "";
          try {
            svg = latinToNative(entry.gkh.replace(/-/g, "")).nativeSvg;
          } catch {
            svg = "";
          }
          return (
            <article className="card" key={entry.id}>
              <h3 style={{ margin: "0 0 0.3rem" }}>{entry.gkh}</h3>
              {svg && <div className="glyph-row" dangerouslySetInnerHTML={{ __html: svg }} />}
              <p className="pill">{entry.pos}</p> <p className="pill">{entry.domain}</p>
              <p style={{ fontFamily: "var(--font-mono)" }}>/{ipaOfWord(entry.gkh.replace(/-/g, ""))}/</p>
              <p>
                <strong>EN:</strong> {entry.en} &nbsp; <strong>NL:</strong> {entry.nl}
              </p>
              {entry.notes && <p className="notice">{entry.notes}</p>}
              {related.length > 0 && (
                <p>
                  <strong>Word family:</strong> {related.map((r) => r.gkh).join(", ")}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
