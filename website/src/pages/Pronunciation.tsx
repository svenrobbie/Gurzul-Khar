import { useState } from "react";
import { phonology } from "@engine/data.js";
import { ipaOfWord } from "@engine/translator/ipa.js";
import { playRuleBasedPronunciation } from "../lib/audioSynth.js";

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US"; // no Gurzûl Khar voice exists; this is an approximation, see notice below
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export default function Pronunciation() {
  const [practiceWord, setPracticeWord] = useState("khardûm");
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [audioOk, setAudioOk] = useState<boolean | null>(null);

  return (
    <div>
      <h1>Pronunciation</h1>

      <div className="error-box" style={{ marginBottom: "1rem" }}>
        <strong>Synthetic approximation, not authentic pronunciation.</strong> The "Play" buttons on this page use
        your browser's built-in text-to-speech engine as a rough developmental aid only. No recorded human audio for
        Gurzûl Khar exists yet (see BACKLOG.md). The browser's speech synthesizer has no idea how Gurzûl Khar
        actually sounds — it just reads the Latin letters using its closest English approximation.
      </div>

      <section className="card">
        <h2>Consonants (IPA)</h2>
        <table>
          <thead>
            <tr>
              <th>Letter</th>
              <th>IPA</th>
              <th>Place</th>
              <th>Manner</th>
              <th>Voicing</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            {phonology.consonants.map((c: any) => (
              <tr key={c.id}>
                <td>{c.latin}</td>
                <td>/{c.ipa}/</td>
                <td>{c.place}</td>
                <td>{c.manner}</td>
                <td>{c.voicing}</td>
                <td>{c.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Vowels (IPA)</h2>
        <table>
          <thead>
            <tr>
              <th>Letter</th>
              <th>IPA</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {phonology.vowels.short.map((v: any) => (
              <tr key={v.id}>
                <td>{v.latin}</td>
                <td>/{v.ipa}/</td>
                <td>short</td>
              </tr>
            ))}
            {phonology.vowels.long.map((v: any) => (
              <tr key={v.id}>
                <td>{v.latin}</td>
                <td>/{v.ipa}/</td>
                <td>long</td>
              </tr>
            ))}
            {phonology.vowels.diphthongs.map((v: any) => (
              <tr key={v.id}>
                <td>{v.latin}</td>
                <td>/{v.ipa}/</td>
                <td>diphthong ({v.example})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Stress</h2>
        <p>{phonology.stress.defaultRule}</p>
        <ul>
          {phonology.stress.exceptions.map((e: string, i: number) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
        <p>
          <strong>Sentence stress:</strong> {phonology.stress.sentenceStress}
        </p>
        <p>
          <strong>Questions:</strong> {phonology.stress.questionIntonation}
        </p>
        <p>
          <strong>Commands:</strong> {phonology.stress.commandIntonation}
        </p>
        <p>
          <strong>Emphasis:</strong> {phonology.stress.emphasis}
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Practice a word</h2>
        <label htmlFor="practice-word">Word (Latin transliteration)</label>
        <br />
        <input id="practice-word" value={practiceWord} onChange={(e) => setPracticeWord(e.target.value)} />
        <div style={{ marginTop: "0.5rem" }}>
          <p className="pill" style={{ fontFamily: "var(--font-mono)" }}>
            /{ipaOfWord(practiceWord)}/
          </p>
          <button type="button" onClick={() => speak(practiceWord)} disabled={!supported}>
            ▶ Play (SpeechSynthesis approximation)
          </button>{" "}
          <button type="button" onClick={() => setAudioOk(playRuleBasedPronunciation(practiceWord))}>
            ▶ Play (rule-based phoneme synthesis — experimental)
          </button>
          {!supported && <p className="notice">Your browser does not support speech synthesis.</p>}
          {audioOk === false && (
            <p className="notice">
              Could not play the rule-based synthesis for this word (Web Audio API unavailable, or the word doesn't tokenize).
            </p>
          )}
        </div>
        <p className="notice" style={{ marginTop: "0.5rem" }}>
          The second button is a separate, genuinely offline prototype (Web Audio API oscillators/filtered noise per
          phoneme, driven by each sound's own place/manner/voicing — see <code>website/src/lib/audioSynth.ts</code>).
          It is NOT real speech and does not model coarticulation; it exists to explore whether a non-neural, rule-based
          approximation is feasible at all, and is clearly experimental — see BACKLOG.md §6.
        </p>
      </section>
    </div>
  );
}
