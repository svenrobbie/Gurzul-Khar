import { useEffect, useState } from "react";
import { lexicon } from "@engine/data.js";
import { alphabet } from "@engine/data.js";
import { generateConsonantGlyph } from "@engine/phonology/glyphGenerator.js";
import { phonology } from "@engine/data.js";
import { translate } from "@engine/translator/index.js";
import { loadProgress, markLessonComplete, recordQuizScore, resetProgress, type Progress } from "../lib/progress";

const GREETING_WORDS = lexicon.entries.filter((e) => ["grt-001", "grt-002", "grt-003", "ukh-001", "tuu-001", "zha-001"].includes(e.id));

const LEVELS = [
  { id: "level-1", title: "Level 1 — Foundations", status: "available" as const },
  { id: "level-2", title: "Level 2 — Basic communication", status: "coming-soon" as const },
  { id: "level-3", title: "Level 3 — Grammar", status: "coming-soon" as const },
  { id: "level-4", title: "Level 4 — Intermediate communication", status: "coming-soon" as const },
  { id: "level-5", title: "Level 5 — Advanced", status: "coming-soon" as const },
];

const QUIZ_QUESTIONS = [
  { id: "q1", prompt: "What does \"ük\" mean?", choices: ["you", "I", "he/she/it", "we"], answer: "I" },
  { id: "q2", prompt: "What does \"ash\" mean (as a particle)?", choices: ["no", "yes", "very", "this"], answer: "yes" },
  { id: "q3", prompt: "What is the Gurzûl Khar word for \"strength / power\"?", choices: ["dor", "khar", "waz", "mor"], answer: "khar" },
  { id: "q4", prompt: "How do you say \"hail / greetings\"?", choices: ["na", "nâzgam", "tar", "zan"], answer: "nâzgam" },
];

function FillInTranslation() {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  function check() {
    const result = translate(value.trim(), "en-gkh");
    if (result.ok && result.output === "ük selu dor") {
      setFeedback("Correct! \"ük selu dor\" — well done.");
    } else if (result.ok) {
      setFeedback(`Not quite. The engine translated this as "${result.output}", but the target answer is "ük selu dor". Try: "I see the land".`);
    } else {
      setFeedback(`The translator could not process that: ${result.error}`);
    }
  }

  return (
    <div className="card">
      <h3>Exercise: translation fill-in</h3>
      <p>Translate into English: type a sentence that means "I see the land" and the translator will check it.</p>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="I see the land" style={{ width: "100%" }} />
      <div style={{ marginTop: "0.5rem" }}>
        <button type="button" onClick={check}>
          Check
        </button>
      </div>
      {feedback && <p className="notice" style={{ marginTop: "0.5rem" }}>{feedback}</p>}
    </div>
  );
}

function Quiz({ onDone }: { onDone: (correct: number, total: number) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    const correct = QUIZ_QUESTIONS.filter((q) => answers[q.id] === q.answer).length;
    setSubmitted(true);
    onDone(correct, QUIZ_QUESTIONS.length);
  }

  return (
    <div className="card">
      <h3>Exercise: multiple choice quiz</h3>
      {QUIZ_QUESTIONS.map((q) => (
        <fieldset key={q.id} style={{ border: "none", marginBottom: "0.75rem", padding: 0 }}>
          <legend>{q.prompt}</legend>
          {q.choices.map((choice) => (
            <label key={choice} style={{ display: "block" }}>
              <input
                type="radio"
                name={q.id}
                value={choice}
                checked={answers[q.id] === choice}
                onChange={() => setAnswers((a) => ({ ...a, [q.id]: choice }))}
                disabled={submitted}
              />{" "}
              {choice}
              {submitted && choice === q.answer && " ✓"}
            </label>
          ))}
        </fieldset>
      ))}
      {!submitted ? (
        <button type="button" onClick={submit} disabled={Object.keys(answers).length < QUIZ_QUESTIONS.length}>
          Submit quiz
        </button>
      ) : (
        <p>
          Score: {QUIZ_QUESTIONS.filter((q) => answers[q.id] === q.answer).length} / {QUIZ_QUESTIONS.length}
        </p>
      )}
    </div>
  );
}

export default function Learn() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  function complete(lessonId: string) {
    setProgress(markLessonComplete(lessonId));
  }

  function handleReset() {
    setProgress(resetProgress());
  }

  const k = phonology.consonants.find((c: any) => c.id === "k")!;

  return (
    <div>
      <h1>Learn Gurzûl Khar</h1>
      <p className="notice">
        No account needed. Progress is stored only in your browser (localStorage) — nothing is sent anywhere.
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <strong>Your progress:</strong> {progress.completedLessons.length} lesson(s) completed.{" "}
        <button className="secondary" onClick={handleReset} type="button">
          Reset progress
        </button>
      </div>

      <section className="card">
        <h2>Level 1 — Foundations</h2>

        <article style={{ marginBottom: "1.5rem" }}>
          <h3>1. Introduction to Gurzûl Khar</h3>
          <p>
            Gurzûl Khar is written left-to-right. In the Khargûl script, every consonant is a vertical "stem" with a
            stroke marking how it is pronounced. Here is the letter <code>k</code>, generated procedurally from its
            own phonological features:
          </p>
          <div className="glyph-row" dangerouslySetInnerHTML={{ __html: generateConsonantGlyph(k) }} />
          <p className="notice">{alphabet.designPhilosophy}</p>
          {!progress.completedLessons.includes("intro") && (
            <button type="button" onClick={() => complete("intro")}>
              Mark complete
            </button>
          )}
        </article>

        <article style={{ marginBottom: "1.5rem" }}>
          <h3>2. First vocabulary: greetings &amp; basics</h3>
          <table>
            <thead>
              <tr>
                <th>Gurzûl Khar</th>
                <th>English</th>
                <th>Dutch</th>
              </tr>
            </thead>
            <tbody>
              {GREETING_WORDS.map((w) => (
                <tr key={w.id}>
                  <td>{w.gkh}</td>
                  <td>{w.en}</td>
                  <td>{w.nl}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!progress.completedLessons.includes("vocab") && (
            <button type="button" onClick={() => complete("vocab")}>
              Mark complete
            </button>
          )}
        </article>

        <article style={{ marginBottom: "1.5rem" }}>
          <h3>3. Exercises</h3>
          <div className="grid grid-2">
            <Quiz onDone={(c, t) => setProgress(recordQuizScore("level1-quiz", c, t))} />
            <FillInTranslation />
          </div>
          {progress.quizScores["level1-quiz"] && !progress.completedLessons.includes("exercises") && (
            <div style={{ marginTop: "0.5rem" }}>
              <button type="button" onClick={() => complete("exercises")}>
                Mark lesson complete
              </button>
            </div>
          )}
        </article>
      </section>

      <section className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Course roadmap</h2>
        <ul>
          {LEVELS.map((lvl) => (
            <li key={lvl.id}>
              {lvl.title} —{" "}
              {lvl.status === "available" ? (
                <span className="pill">available</span>
              ) : (
                <span className="pill">coming soon</span>
              )}
            </li>
          ))}
        </ul>
        <p className="notice">
          Levels 2–5 are planned (see the Master Development Specification §9.1) but not yet built into interactive
          lessons — this is tracked honestly in BACKLOG.md, not hidden behind non-functional buttons.
        </p>
      </section>
    </div>
  );
}
