import { useMemo, useState } from "react";
import { engine, type Direction, type TranslationResult } from "../engine";

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "en-gkh", label: "English → Gurzûl Khar" },
  { value: "nl-gkh", label: "Nederlands → Gurzûl Khar" },
  { value: "gkh-en", label: "Gurzûl Khar → English" },
  { value: "gkh-nl", label: "Gurzûl Khar → Nederlands" },
];

const EXAMPLES: Record<Direction, string> = {
  "en-gkh": "I carry the sword to the tower",
  "nl-gkh": "Ik ga omdat de koning sterk is",
  "gkh-en": "ük selu shak kha khar dûnu",
  "gkh-nl": "tû dâku pâk",
};

/** Sentences that show off one pattern each, so the page is explorable without knowing what to type. */
const SHOWCASE: { direction: Direction; input: string; shows: string }[] = [
  { direction: "en-gkh", input: "I carry the sword to the tower", shows: "postpositional phrase" },
  { direction: "en-gkh", input: "You must go", shows: "modal" },
  { direction: "en-gkh", input: "Go to the tower", shows: "imperative" },
  { direction: "en-gkh", input: "the king who has strength", shows: "relative clause" },
  { direction: "nl-gkh", input: "Ik ga omdat de koning sterk is", shows: "subordinate clause, verb-final" },
  { direction: "nl-gkh", input: "Ik zie de nachtwacht", shows: "compound built from known roots" },
  { direction: "nl-gkh", input: "Ik zie de draak", shows: "coined word" },
];

/** Splits the output so coined words can be marked without touching the rest of the text. */
function markCoined(output: string, coined: { gkh: string; source: string }[]) {
  if (coined.length === 0) return output;
  const bySpelling = new Map(coined.map((c) => [c.gkh, c.source]));
  return output.split(" ").map((token, i) => {
    const source = bySpelling.get(token);
    const space = i === 0 ? "" : " ";
    if (!source) return <span key={i}>{space}{token}</span>;
    return (
      <span key={i}>
        {space}
        <span className="coined" title={`Generated for "${source}" — not a hand-authored word`}>
          {token}
        </span>
      </span>
    );
  });
}

export default function Translator() {
  const [direction, setDirection] = useState<Direction>("en-gkh");
  const [input, setInput] = useState(EXAMPLES["en-gkh"]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [copied, setCopied] = useState(false);

  const result: TranslationResult | null = useMemo(() => {
    if (!input.trim()) return null;
    return engine().translate(input, direction);
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
        Deterministic, rule-based translation for the grammatical subset documented in{" "}
        <code>data/morphology/grammar.json</code>: declaratives, negatives, yes/no and content questions, possession,
        plurals, comparative and superlative, coordination, <strong>postpositional phrases</strong>,{" "}
        <strong>modals</strong>, <strong>imperatives</strong>, <strong>relative clauses</strong> and{" "}
        <strong>subordinate clauses</strong>. A sentence that matches no supported pattern is refused rather than
        guessed — see <a href="#/engine">how the engine works</a>.
      </p>
      <p className="notice">
        Every word gets a Gurzûl Khar form. The lexicon is tried first, then inflection, then compounding from roots
        that already exist — <code>nachtwacht</code> becomes <code>nacht</code> + <code>wacht</code>. Only a word none
        of those can account for is <em>coined</em>: given a generated form that is the same every single time.
        Coined words are <span className="coined">marked like this</span> so they are never mistaken for established
        vocabulary.
      </p>

      <div className="card" style={{ marginTop: "1rem" }}>
        <strong>Try one</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
          {SHOWCASE.map((example) => (
            <button
              key={example.input}
              type="button"
              className="secondary"
              onClick={() => {
                setDirection(example.direction);
                setInput(example.input);
                setCopied(false);
              }}
              title={example.shows}
            >
              {example.input}
            </button>
          ))}
        </div>
      </div>

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
              {result.partial && (
                <div className="notice" style={{ marginBottom: "0.5rem" }}>
                  <strong>Word-for-word translation.</strong>
                  <p style={{ marginTop: "0.3rem" }}>
                    This sentence did not match a full grammatical pattern, so each word was translated on its own:
                    tense, plural and word order were not reliably applied. Nothing was dropped.
                  </p>
                </div>
              )}
              <p style={{ fontSize: "1.2rem", marginBottom: "0.3rem" }}>
                {markCoined(result.output, result.coinedWords ?? [])}
              </p>
              {result.coinedWords && result.coinedWords.length > 0 && (
                <div className="notice" style={{ marginBottom: "0.5rem" }}>
                  <strong>
                    {result.coinedWords.length === 1 ? "One word was coined" : `${result.coinedWords.length} words were coined`}
                  </strong>{" "}
                  — generated because the lexicon has no entry for{" "}
                  {result.coinedWords.length === 1 ? "it" : "them"}, not chosen by hand. The same input always produces
                  the same form.
                  <table style={{ marginTop: "0.4rem" }}>
                    <tbody>
                      {result.coinedWords.map((c) => (
                        <tr key={c.gkh}>
                          <td style={{ width: "40%" }}>{c.source}</td>
                          <td>
                            <span className="coined">{c.gkh}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ marginTop: "0.3rem" }}>
                    Think one deserves a real word? <a href="#/propose">Propose one</a> and it becomes part of the
                    lexicon instead.
                  </p>
                </div>
              )}
              {result.pronunciation && (
                <p className="pill" style={{ fontFamily: "var(--font-mono)" }}>
                  {result.pronunciation}
                </p>
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
                    {engine()
                      .analyze(input, direction)
                      .map((w, i) => (
                        <tr key={i}>
                          <td>{w.surface}</td>
                          <td>{w.root}</td>
                          <td>{w.gloss}</td>
                          <td>{w.pos ?? "—"}</td>
                          <td>{w.affixes.length ? w.affixes.join(", ") : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {result.ok && result.transformations.length > 0 && (
                  <>
                    <h3>Grammatical transformations applied</h3>
                    <ul>
                      {result.transformations.map((t: string, i: number) => (
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
