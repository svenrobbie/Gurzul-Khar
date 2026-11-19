import { useState } from "react";
import { checkWordPhonotactics } from "@engine/phonology/phonotacticValidator.js";
import { lexicon } from "@engine/data.js";

const POS_OPTIONS = ["noun", "verb", "adjective", "adverb", "pronoun", "particle", "conjunction", "postposition", "numeral", "interjection"];
const DOMAINS = Array.from(new Set(lexicon.entries.map((e) => e.domain))).sort();

interface Candidate {
  gkh: string;
  ipa: string;
  phonotacticallyValid: boolean;
  derivation?: { suffix: string; function: string; rootEntry: string };
}
interface Conflict {
  kind: string;
  message: string;
  withGkh: string;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/lexicon/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status >= 500) throw new Error(`Server error (${res.status})`);
  return res.json();
}

export default function Propose() {
  const [mode, setMode] = useState<"manual" | "suggested">("suggested");
  const [en, setEn] = useState("");
  const [nl, setNl] = useState("");
  const [pos, setPos] = useState("noun");
  const [domain, setDomain] = useState("everyday");
  const [notes, setNotes] = useState("");
  const [manualGkh, setManualGkh] = useState("");
  const [manualIpa, setManualIpa] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [rootHintGkh, setRootHintGkh] = useState("");
  const [rootHintSuffix, setRootHintSuffix] = useState("-dûm");
  const [useRootHint, setUseRootHint] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [violations, setViolations] = useState<string[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "submitted" | "offline">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const manualViolations = manualGkh ? checkWordPhonotactics(manualGkh.replace(/-/g, "")).map((v) => v.rule) : [];

  async function requestSuggestion() {
    setStatus("loading");
    setMessage(null);
    try {
      const body: any = { en, nl, pos };
      if (useRootHint && rootHintGkh) body.rootHint = { rootGkh: rootHintGkh, suffix: rootHintSuffix };
      const data = await api<{ candidate: Candidate }>("suggest", body);
      setCandidate(data.candidate);
      setStatus("idle");
    } catch {
      setStatus("offline");
      setMessage(
        "Could not reach the local word-suggestion tool. This feature runs only inside the Vite dev server (`npm run dev`) — it is not available in the static production build, since it has no backend to generate or store a word."
      );
    }
  }

  async function submit(force = false) {
    setStatus("loading");
    setMessage(null);
    setConflicts(null);
    setViolations(null);
    const gkh = mode === "manual" ? manualGkh.trim() : candidate?.gkh ?? "";
    const ipa = mode === "manual" ? manualIpa.trim() : candidate?.ipa ?? "";
    if (!gkh || !en.trim() || !pos) {
      setStatus("idle");
      setMessage("Please provide at least an English gloss, a part of speech, and a Gurzûl Khar spelling.");
      return;
    }
    try {
      const data = await api<{ ok: boolean; violations?: { rule: string }[]; conflicts?: Conflict[]; entry?: unknown }>("propose", {
        gkh,
        ipa,
        pos,
        en: en.trim(),
        nl: nl.trim(),
        domain,
        notes: notes.trim() || undefined,
        origin: mode,
        force,
      });
      if (!data.ok) {
        if (data.violations && data.violations.length) {
          setViolations(data.violations.map((v) => v.rule));
          setMessage("This spelling violates documented phonotactic rules and cannot be proposed as-is.");
        } else if (data.conflicts && data.conflicts.length) {
          setConflicts(data.conflicts);
          setMessage("This conflicts with existing vocabulary. Review below, then submit anyway if you still want to propose it.");
        }
        setStatus("idle");
        return;
      }
      setStatus("submitted");
      setMessage(`Proposed "${gkh}" for review. It will not affect the translator or dictionary until an admin approves it on the /admin page.`);
    } catch {
      setStatus("offline");
      setMessage(
        "Could not reach the local proposal tool. This feature runs only inside the Vite dev server (`npm run dev`) — the static production build has no backend to persist a proposal to."
      );
    }
  }

  return (
    <div>
      <h1>Propose a word</h1>
      <p className="notice">
        New Gurzûl Khar vocabulary never becomes official automatically. A proposal is validated against the
        language's own phonotactic rules and checked for conflicts with existing vocabulary, then stored in{" "}
        <code>data/lexicon/proposals.json</code> with status "proposed" until a reviewer approves it on the{" "}
        <a href="#/admin">pending proposals</a> page — see BACKLOG.md §2 for exactly what is real here and what is a
        deliberately simulated single-owner review flow.
      </p>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          <label>
            <input type="radio" checked={mode === "suggested"} onChange={() => setMode("suggested")} /> Ask the engine
            to suggest a word
          </label>
          <label>
            <input type="radio" checked={mode === "manual"} onChange={() => setMode("manual")} /> Coin my own word
          </label>
        </div>

        <div className="grid grid-2">
          <div>
            <label htmlFor="prop-en">English meaning</label>
            <br />
            <input id="prop-en" value={en} onChange={(e) => setEn(e.target.value)} style={{ width: "100%" }} placeholder="e.g. mountain pass" />
          </div>
          <div>
            <label htmlFor="prop-nl">Dutch meaning (optional)</label>
            <br />
            <input id="prop-nl" value={nl} onChange={(e) => setNl(e.target.value)} style={{ width: "100%" }} placeholder="e.g. bergpas" />
          </div>
          <div>
            <label htmlFor="prop-pos">Part of speech</label>
            <br />
            <select id="prop-pos" value={pos} onChange={(e) => setPos(e.target.value)} style={{ width: "100%" }}>
              {POS_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prop-domain">Semantic domain</label>
            <br />
            <input id="prop-domain" list="domain-options" value={domain} onChange={(e) => setDomain(e.target.value)} style={{ width: "100%" }} />
            <datalist id="domain-options">
              {DOMAINS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
        </div>

        {mode === "manual" ? (
          <div className="grid grid-2" style={{ marginTop: "1rem" }}>
            <div>
              <label htmlFor="prop-gkh">Gurzûl Khar spelling (Latin transliteration)</label>
              <br />
              <input id="prop-gkh" value={manualGkh} onChange={(e) => setManualGkh(e.target.value)} style={{ width: "100%" }} placeholder="e.g. dornath" />
              {manualGkh && (
                <p className={manualViolations.length ? "error-box" : "notice"} style={{ marginTop: "0.4rem" }}>
                  {manualViolations.length
                    ? `Phonotactic issues: ${manualViolations.join("; ")}`
                    : "Phonotactically valid against the documented rules in phonology.json."}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="prop-ipa">IPA (optional — leave blank and it will still be checked)</label>
              <br />
              <input id="prop-ipa" value={manualIpa} onChange={(e) => setManualIpa(e.target.value)} style={{ width: "100%" }} placeholder="e.g. dɔrnaθ" />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "1rem" }}>
            <label>
              <input type="checkbox" checked={useRootHint} onChange={(e) => setUseRootHint(e.target.checked)} /> Derive this from an existing root
              instead of coining a new one
            </label>
            {useRootHint && (
              <div className="grid grid-2" style={{ marginTop: "0.5rem" }}>
                <div>
                  <label htmlFor="root-gkh">Existing root (Gurzûl Khar)</label>
                  <br />
                  <input id="root-gkh" value={rootHintGkh} onChange={(e) => setRootHintGkh(e.target.value)} style={{ width: "100%" }} placeholder="e.g. khar" />
                </div>
                <div>
                  <label htmlFor="root-suffix">Derivational suffix</label>
                  <br />
                  <select id="root-suffix" value={rootHintSuffix} onChange={(e) => setRootHintSuffix(e.target.value)} style={{ width: "100%" }}>
                    {lexicon.derivationalAffixes.map((a) => (
                      <option key={a.suffix} value={a.suffix}>
                        {a.suffix} — {a.function}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div style={{ marginTop: "0.75rem" }}>
              <button type="button" onClick={requestSuggestion} disabled={status === "loading" || !en.trim()}>
                Suggest a word
              </button>
            </div>
            {candidate && (
              <div className="card" style={{ marginTop: "0.75rem", background: "var(--bg-ash-raised)" }}>
                <p style={{ fontSize: "1.2rem" }}>
                  <strong>{candidate.gkh}</strong> <span className="pill">/{candidate.ipa}/</span>{" "}
                  <span className="pill">{pos}</span>
                </p>
                <p className={candidate.phonotacticallyValid ? "notice" : "error-box"}>
                  {candidate.phonotacticallyValid ? "Phonotactically valid." : "This candidate did not pass validation — try again."}
                </p>
                {candidate.derivation && (
                  <p className="notice">
                    Derived from "{candidate.derivation.rootEntry}" + {candidate.derivation.suffix} ({candidate.derivation.function}).
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="prop-notes">Notes (optional)</label>
          <br />
          <textarea id="prop-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: "100%" }} />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button type="button" onClick={() => submit(false)} disabled={status === "loading"}>
            Submit proposal
          </button>
        </div>

        {violations && (
          <div className="error-box" style={{ marginTop: "1rem" }}>
            <strong>Blocked — phonotactic violations:</strong>
            <ul>
              {violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        )}
        {conflicts && (
          <div className="error-box" style={{ marginTop: "1rem" }}>
            <strong>Conflicts found:</strong>
            <ul>
              {conflicts.map((c, i) => (
                <li key={i}>{c.message}</li>
              ))}
            </ul>
            <button type="button" className="secondary" onClick={() => submit(true)} style={{ marginTop: "0.5rem" }}>
              Submit anyway
            </button>
          </div>
        )}
        {message && !violations && !conflicts && (
          <p className={status === "submitted" ? "notice" : "error-box"} style={{ marginTop: "1rem" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
