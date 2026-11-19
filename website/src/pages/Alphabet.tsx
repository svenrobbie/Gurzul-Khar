import { useState } from "react";
import { alphabet, phonology } from "@engine/data.js";
import { generateConsonantGlyph, generateVowelGlyph, generateNumeralGlyph, generatePunctuationGlyph } from "@engine/phonology/glyphGenerator.js";
import { latinToNative, nativeToLatin } from "@engine/generator/transliteration.js";
import { tryTokenizeWord } from "@engine/phonology/phonemes.js";

// A real sentence from the regression test suite (tests/regression.test.ts,
// "compound sentence"), rendered live in the new Thornscript, per the
// Phase 2 brief's request for a rendered sample text.
const SAMPLE_SENTENCE = { gkh: "ük pâku ag tû magu", gloss: "I go and you follow" };

export default function Alphabet() {
  const [latinInput, setLatinInput] = useState("khar shak dor");
  const [nativeRoundTrip, setNativeRoundTrip] = useState<string | null>(null);
  const [svg, setSvg] = useState("");
  const [toolError, setToolError] = useState<string | null>(null);

  function runTransliteration() {
    try {
      const result = latinToNative(latinInput);
      setSvg(result.nativeSvg);
      setNativeRoundTrip(nativeToLatin(result.words));
      setToolError(null);
    } catch (e) {
      setToolError(e instanceof Error ? e.message : "Could not transliterate this input.");
      setSvg("");
      setNativeRoundTrip(null);
    }
  }

  let sampleSvg = "";
  try {
    sampleSvg = latinToNative(SAMPLE_SENTENCE.gkh).nativeSvg;
  } catch {
    sampleSvg = "";
  }

  return (
    <div>
      <h1>
        Alphabet — the {alphabet.name} ({alphabet.displayName}, v{alphabet.version})
      </h1>
      <p className="notice">{alphabet.designPhilosophy}</p>
      <p className="notice">{alphabet.designHistory}</p>
      <p className="notice">{alphabet.rendering.fontStatus}</p>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Sample text</h2>
        <p>
          <em>"{SAMPLE_SENTENCE.gloss}"</em> — "{SAMPLE_SENTENCE.gkh}" rendered in {alphabet.displayName}:
        </p>
        {sampleSvg && <div className="glyph-row" dangerouslySetInnerHTML={{ __html: sampleSvg }} aria-label="Sample sentence in Thornscript" />}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Consonants</h2>
        <p>Every glyph below is generated procedurally from its place/manner/voicing features — none are hand-drawn.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}>
          {phonology.consonants.map((c: any) => (
            <div key={c.id} className="card" style={{ textAlign: "center", padding: "0.5rem" }}>
              <div className="glyph-row" style={{ justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: generateConsonantGlyph(c) }} />
              <div style={{ fontFamily: "var(--font-mono)" }}>{c.latin}</div>
              <div className="pill">/{c.ipa}/</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Vowels</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}>
          {[...phonology.vowels.short, ...phonology.vowels.long, ...phonology.vowels.diphthongs].map((v: any) => (
            <div key={v.id} className="card" style={{ textAlign: "center", padding: "0.5rem" }}>
              <div className="glyph-row" style={{ justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: generateVowelGlyph(v) }} />
              <div style={{ fontFamily: "var(--font-mono)" }}>{v.latin}</div>
              <div className="pill">/{v.ipa}/</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Numerals</h2>
        <p className="notice">{alphabet.numerals.system}</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))" }}>
          {Array.from({ length: 10 }, (_, d) => d).map((d) => (
            <div key={d} className="card" style={{ textAlign: "center", padding: "0.5rem" }}>
              <div className="glyph-row" style={{ justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: generateNumeralGlyph(d) }} />
              <div style={{ fontFamily: "var(--font-mono)" }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Punctuation</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}>
          {(
            [
              ["wordBoundary", "Word boundary"],
              ["clausePause", "Clause pause (comma)"],
              ["sentenceEnd", "Sentence end (full stop)"],
              ["question", "Yes/no question"],
            ] as const
          ).map(([kind, label]) => (
            <div key={kind} className="card" style={{ textAlign: "center", padding: "0.5rem" }}>
              <div className="glyph-row" style={{ justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: generatePunctuationGlyph(kind) }} />
              <div style={{ fontSize: "0.85rem" }}>{label}</div>
            </div>
          ))}
        </div>
        <p className="notice">
          Quotation marks use the nested angle brackets ⟨ ⟩ directly (spec: {alphabet.punctuation.quotation}); capitalization is shown with{" "}
          {alphabet.capitalization}
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Transliteration tool</h2>
        <p>Enter Latin-transliterated Gurzûl Khar text to see it rendered in the native script, and verify the round trip back to Latin.</p>
        <label htmlFor="translit-input">Latin text</label>
        <br />
        <input id="translit-input" value={latinInput} onChange={(e) => setLatinInput(e.target.value)} style={{ width: "100%" }} />
        <div style={{ marginTop: "0.5rem" }}>
          <button onClick={runTransliteration} type="button">
            Convert to native script
          </button>
        </div>
        {toolError && (
          <div className="error-box" style={{ marginTop: "0.5rem" }}>
            {toolError}
          </div>
        )}
        {svg && (
          <div style={{ marginTop: "0.75rem" }}>
            <div className="glyph-row" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="notice">Round-trip back to Latin: {nativeRoundTrip}</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function isValidLatinWord(word: string): boolean {
  return tryTokenizeWord(word) !== null;
}
