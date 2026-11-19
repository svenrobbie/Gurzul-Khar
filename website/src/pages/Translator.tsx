import { useMemo, useState } from "react";
import { translate, type Direction, type TranslationResult } from "@engine/translator/index.js";

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "en-gkh", label: "English → Gurzûl Khar" },
  { value: "nl-gkh", label: "Nederlands → Gurzûl Khar" },
  { value: "gkh-en", label: "Gurzûl Khar → English" },
  { value: "gkh-nl", label: "Gurzûl Khar → Nederlands" },
];

const EXAMPLES: Record<Direction, string> = {
  "en-gkh": "I see the land",
  "nl-gkh": "Ik zie het land",
  "gkh-en": "ük pâku ag tû magu",
  "gkh-nl": "shak ash zan khargûl",
};

export default function Translator() {
  const [direction, setDirection] = useState<Direction>("en-gkh");
  const [input, setInput] = useState(EXAMPLES["en-gkh"]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [copied, setCopied] = useState(false);

  const result: TranslationResult | null = useMemo(() => {
    if (!input.trim()) return null;
    return translate(input, direction);
  }, [input, direction]);

  function handleDirectionChange(next: Direction) {
    setDirection(next);
    setInput(EXAMPLES[next]);
    setCopied(false);
  }

  async function copyOutput() {
    if (result?.ok) {
      try {
        await navigator.clipboard.writeText(result.output);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard API can be unavailable (permissions/non-secure context) — fail silently, UI already shows the text.
      }
    }
  }

  return (
    <div>
      <h1>Translator</h1>
      <p className="notice">
        Deterministic, rule-based translation for the grammatical subset currently documented in{" "}
        <code>data/morphology/grammar.json</code>: simple declaratives, negatives, yes/no and content questions,
        possession, plurals, comparative/superlative, and basic coordination. Unsupported sentences or unknown words
        are reported honestly rather than guessed — see <a href="#/engine">how the engine works</a>.
      </p>

      <div className="card" style={{ marginTop: "1rem" }}>
        <label htmlFor="direction-select">Direction</label>
        <br />
        <select id="direction-select" value={direction} onChange={(e) => handleDirectionChange(e.target.value as Direction)}>
          {DIRECTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="input-text">Input</label>
          <br />
          <textarea
            id="input-text"
            rows={3}
            style={{ width: "100%", marginTop: "0.3rem" }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <strong>Output</strong>
          {result?.ok ? (
            <div className="card" style={{ marginTop: "0.5rem", background: "var(--bg-ash-raised)" }}>
              <p style={{ fontSize: "1.2rem", marginBottom: "0.3rem" }}>{result.output}</p>
              {result.pronunciation && (
                <p className="pill" style={{ fontFamily: "var(--font-mono)" }}>
                  {result.pronunciation}
                </p>
              )}
              {result.nativeScript && (
                <div className="glyph-row" dangerouslySetInnerHTML={{ __html: result.nativeScript }} aria-label="Khargûl native script rendering" />
              )}
              <div style={{ marginTop: "0.5rem" }}>
                <button className="secondary" onClick={copyOutput} type="button">
                  {copied ? "Copied!" : "Copy output"}
                </button>
              </div>
            </div>
          ) : result && !result.ok ? (
            <div className="error-box" style={{ marginTop: "0.5rem" }}>
              <strong>Cannot translate reliably.</strong>
              <p>{result.error}</p>
            </div>
          ) : (
            <p className="notice" style={{ marginTop: "0.5rem" }}>
              Type something to translate.
            </p>
          )}
        </div>

        {result && (
          <div style={{ marginTop: "1rem" }}>
            <label>
              <input type="checkbox" checked={showAnalysis} onChange={(e) => setShowAnalysis(e.target.checked)} /> Show
              word-by-word analysis
            </label>
            {showAnalysis && (
              <div className="card" style={{ marginTop: "0.5rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Surface</th>
                      <th>Root</th>
                      <th>Gloss</th>
                      <th>POS</th>
                      <th>Affixes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.explanation.words.map((w, i) => (
                      <tr key={i}>
                        <td>{w.surface}</td>
                        <td>{w.root}</td>
                        <td>{w.gloss}</td>
                        <td>{w.pos ?? "—"}</td>
                        <td>{w.affixes.length ? w.affixes.map((a) => `${a.suffix} (${a.gloss})`).join(", ") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.explanation.transformations.length > 0 && (
                  <>
                    <h3>Grammatical transformations applied</h3>
                    <ul>
                      {result.explanation.transformations.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
