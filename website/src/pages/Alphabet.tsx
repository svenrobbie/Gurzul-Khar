import { useState } from "react";
import { alphabet, phonology } from "@engine/data.js";
import { generateConsonantGlyph, generateVowelGlyph } from "@engine/phonology/glyphGenerator.js";
import { latinToNative, nativeToLatin } from "@engine/generator/transliteration.js";
import { tryTokenizeWord } from "@engine/phonology/phonemes.js";

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

  return (
    <div>
      <h1>Alphabet — the {alphabet.name}</h1>
      <p className="notice">{alphabet.designPhilosophy}</p>
      <p className="notice">{alphabet.rendering.fontStatus}</p>

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
        <h2>Punctuation &amp; numerals</h2>
        <p>Word boundary: {alphabet.punctuation.wordBoundary} · Clause pause: {alphabet.punctuation.clausePause} · Sentence end: {alphabet.punctuation.sentenceEnd} · Question: {alphabet.punctuation.question}</p>
        <p className="notice">{alphabet.numerals.system}</p>
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
