import { useMemo, useState } from "react";
import { phonology } from "../data";
import course from "../../../learning/course.json";
import pronunciationGuide from "../../../learning/pronunciation.json";
import {
  loadProgress,
  markLessonComplete,
  resetProgress,
  recordReview,
  dueReviewItems,
  getReviewState,
  resetReviews,
  type Progress,
} from "../lib/progress";

interface Vocab {
  gkh: string;
  en: string;
  nl: string;
}
interface Example {
  gkh: string;
  en: string;
}
interface Drill {
  prompt: string;
  answer: string;
  kind: string;
}
interface Lesson {
  id: string;
  title: string;
  goal: string;
  grammar: string;
  vocabulary: Vocab[];
  examples: Example[];
  drills: Drill[];
}
interface Principle {
  name: string;
  what: string;
  why: string;
}

const LESSONS = (course as { lessons: Lesson[] }).lessons;
const METHOD = (course as { method: { summary: string; principles: Principle[]; howToUse: string } }).method;
const GUIDE = pronunciationGuide as {
  consonants: Record<string, { en: string; nl: string; how?: string }>;
  vowels: Record<string, { en: string; nl: string; how?: string }>;
};

/** Stable id for one drill, used as its key in the spaced-review schedule. */
const drillId = (lessonId: string, index: number) => `${lessonId}:${index}`;

const ALL_DRILLS: { id: string; lessonId: string; lessonTitle: string; drill: Drill }[] = LESSONS.flatMap((lesson) =>
  lesson.drills.map((drill, i) => ({ id: drillId(lesson.id, i), lessonId: lesson.id, lessonTitle: lesson.title, drill }))
);

/** One recall-first drill: the answer is hidden until you have committed to one. */
function DrillCard({
  id,
  drill,
  context,
  onGraded,
}: {
  id: string;
  drill: Drill;
  context?: string;
  onGraded: (correct: boolean) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<null | boolean>(null);

  function grade(correct: boolean) {
    setGraded(correct);
    recordReview(id, correct);
    onGraded(correct);
  }

  return (
    <div className="card" style={{ marginTop: "0.5rem" }}>
      {context && (
        <p className="pill" style={{ marginBottom: "0.4rem" }}>
          {context}
        </p>
      )}
      <p style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>{drill.prompt}</p>
      {!revealed ? (
        <>
          <p className="notice" style={{ marginBottom: "0.5rem" }}>
            Answer it in your head — or out loud — before you reveal it. Looking first feels like learning and is not.
          </p>
          <button type="button" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>
            <strong>{drill.answer}</strong>
          </p>
          {graded === null ? (
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button type="button" onClick={() => grade(true)}>
                I had it
              </button>
              <button type="button" className="secondary" onClick={() => grade(false)}>
                Not yet
              </button>
            </div>
          ) : (
            <p className="pill">{graded ? "Scheduled further out." : "Back tomorrow."}</p>
          )}
        </>
      )}
    </div>
  );
}

export default function Learn() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [openLesson, setOpenLesson] = useState<string | null>(LESSONS[0]?.id ?? null);
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [reviewTick, setReviewTick] = useState(0);

  const due = useMemo(() => {
    void reviewTick;
    const ids = new Set(dueReviewItems(ALL_DRILLS.map((d) => d.id)));
    return ALL_DRILLS.filter((d) => ids.has(d.id));
  }, [reviewTick]);

  const reviewState = useMemo(() => {
    void reviewTick;
    return getReviewState();
  }, [reviewTick]);

  const attempted = Object.keys(reviewState).length;
  const learned = Object.values(reviewState).filter((item) => item.box >= 2).length;

  function complete(lessonId: string) {
    setProgress(markLessonComplete(lessonId));
  }

  return (
    <div>
      <h1>Learn Gurzûl Khar</h1>
      <p className="notice">
        Ten short lessons. Each one is sized for a single sitting of about ten minutes, because ten minutes a day
        across a week beats an hour in one go — that is the single biggest lever you have, and it costs nothing.
      </p>

      <div className="card" style={{ marginTop: "1rem" }}>
        <button type="button" className="secondary" onClick={() => setShowMethod((v) => !v)}>
          {showMethod ? "Hide the method" : "How this course works, and why"}
        </button>
        {showMethod && (
          <div style={{ marginTop: "0.75rem" }}>
            <p>{METHOD.summary}</p>
            {METHOD.principles.map((principle) => (
              <div key={principle.name} style={{ marginTop: "0.75rem" }}>
                <strong>{principle.name}</strong>
                <p style={{ marginTop: "0.2rem" }}>{principle.what}</p>
                <p className="notice" style={{ marginTop: "0.2rem" }}>
                  {principle.why}
                </p>
              </div>
            ))}
            <p style={{ marginTop: "0.75rem" }}>{METHOD.howToUse}</p>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2>Your progress</h2>
        <p>
          <strong>{progress.completedLessons.length}</strong> of {LESSONS.length} lessons marked done ·{" "}
          <strong>{attempted}</strong> drills attempted · <strong>{learned}</strong> recalled correctly at least twice
          across separate sessions.
        </p>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setProgress(resetProgress());
            resetReviews();
            setReviewTick((t) => t + 1);
          }}
        >
          Reset everything
        </button>
      </div>

      {due.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>Due for review ({due.length})</h2>
          <p className="notice">
            Drawn from across the lessons rather than grouped by lesson. Mixed review feels harder and that is the
            point — it is what makes the words stick.
          </p>
          {due.slice(0, 8).map((item) => (
            <DrillCard
              key={item.id}
              id={item.id}
              drill={item.drill}
              context={item.lessonTitle}
              onGraded={() => setReviewTick((t) => t + 1)}
            />
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <button type="button" className="secondary" onClick={() => setShowPronunciation((v) => !v)}>
          {showPronunciation ? "Hide pronunciation guide" : "Pronunciation guide"}
        </button>
        {showPronunciation && (
          <div style={{ marginTop: "0.75rem" }}>
            <p>
              Gurzûl Khar is spelled as it sounds. Each letter has one value, and the pairs <code>kh</code>,{" "}
              <code>gh</code>, <code>sh</code>, <code>zh</code>, <code>th</code> and <code>ng</code> are single sounds,
              not two.
            </p>
            <h3>Consonants</h3>
            <table>
              <thead>
                <tr>
                  <th>Letter</th>
                  <th>IPA</th>
                  <th>English</th>
                  <th>Nederlands</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                {phonology.consonants.map((c) => {
                  const help = GUIDE.consonants[c.id];
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.latin}</strong>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{c.ipa}</td>
                      <td>
                        {help?.en}
                        {help?.how && <div className="notice">{help.how}</div>}
                      </td>
                      <td>{help?.nl}</td>
                      <td>{c.example}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3>Vowels</h3>
            <p className="notice">
              A circumflex marks a <strong>long</strong> vowel, and length is meaningful — it can be the only
              difference between two words. Hold the long ones.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Letter</th>
                  <th>IPA</th>
                  <th>English</th>
                  <th>Nederlands</th>
                </tr>
              </thead>
              <tbody>
                {[...phonology.vowels.short, ...phonology.vowels.long, ...phonology.vowels.diphthongs].map((v) => {
                  const help = GUIDE.vowels[v.id];
                  return (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.latin}</strong>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{v.ipa}</td>
                      <td>
                        {help?.en}
                        {help?.how && <div className="notice">{help.how}</div>}
                      </td>
                      <td>{help?.nl}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3>Stress</h3>
            <p>{phonology.stress.defaultRule}</p>
            <ul>
              {phonology.stress.exceptions.map((e: string) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <h2 style={{ marginTop: "1.5rem" }}>Lessons</h2>
      {LESSONS.map((lesson, lessonIndex) => {
        const done = progress.completedLessons.includes(lesson.id);
        const open = openLesson === lesson.id;
        return (
          <div className="card" key={lesson.id} style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setOpenLesson(open ? null : lesson.id)}
              style={{ width: "100%", textAlign: "left" }}
            >
              {done ? "✓ " : ""}
              {lessonIndex + 1}. {lesson.title}
            </button>
            {open && (
              <div style={{ marginTop: "0.75rem" }}>
                <p>
                  <strong>Goal:</strong> {lesson.goal}
                </p>
                <p>{lesson.grammar}</p>

                {lesson.vocabulary.length > 0 && (
                  <>
                    <h3>New words</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Gurzûl Khar</th>
                          <th>English</th>
                          <th>Nederlands</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lesson.vocabulary.map((word) => (
                          <tr key={word.gkh}>
                            <td>
                              <strong>{word.gkh}</strong>
                            </td>
                            <td>{word.en}</td>
                            <td>{word.nl}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {lesson.examples.length > 0 && (
                  <>
                    <h3>Examples</h3>
                    <p className="notice">
                      Say each one out loud. Every example here is checked against the translator on every build, so
                      none of them is a sentence the language cannot actually produce.
                    </p>
                    <table>
                      <tbody>
                        {lesson.examples.map((example) => (
                          <tr key={example.gkh}>
                            <td style={{ width: "50%" }}>
                              <strong>{example.gkh}</strong>
                            </td>
                            <td>{example.en}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                <h3>Practice</h3>
                {lesson.drills.map((drill, i) => (
                  <DrillCard
                    key={drillId(lesson.id, i)}
                    id={drillId(lesson.id, i)}
                    drill={drill}
                    onGraded={() => setReviewTick((t) => t + 1)}
                  />
                ))}

                <div style={{ marginTop: "0.75rem" }}>
                  <button type="button" onClick={() => complete(lesson.id)} disabled={done}>
                    {done ? "Marked done" : "Mark lesson done"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
