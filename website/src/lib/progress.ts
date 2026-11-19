// localStorage-based progress tracking for the Learn section. No account/login required.
// Spec §9.4: completed lessons, exercise results, and a reset option.
const STORAGE_KEY = "gkh-learn-progress-v1";

export interface Progress {
  completedLessons: string[];
  quizScores: Record<string, { correct: number; total: number }>;
}

function emptyProgress(): Progress {
  return { completedLessons: [], quizScores: {} };
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    return { completedLessons: parsed.completedLessons ?? [], quizScores: parsed.quizScores ?? {} };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // localStorage can throw in private browsing / storage-full situations — progress just won't persist.
  }
}

export function markLessonComplete(lessonId: string) {
  const p = loadProgress();
  if (!p.completedLessons.includes(lessonId)) p.completedLessons.push(lessonId);
  saveProgress(p);
  return p;
}

export function recordQuizScore(quizId: string, correct: number, total: number) {
  const p = loadProgress();
  p.quizScores[quizId] = { correct, total };
  saveProgress(p);
  return p;
}

export function resetProgress() {
  saveProgress(emptyProgress());
  return emptyProgress();
}
