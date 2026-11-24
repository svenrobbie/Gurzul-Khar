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

// ---------------------------------------------------------------------------
// Spaced review.
//
// Successive relearning — recalling an item correctly across several separated
// sessions — is what moves vocabulary into memory that lasts. A Leitner
// schedule is the simplest honest implementation: an item answered correctly
// moves up a box and comes back later, an item missed drops to the bottom and
// comes back tomorrow.
//
// Intervals are in days, indexed by box.
// ---------------------------------------------------------------------------
const REVIEW_KEY = "gkh-learn-review-v1";
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 21, 60];

export interface ReviewItem {
  box: number;
  dueAt: number;
  seen: number;
}

export type ReviewState = Record<string, ReviewItem>;

function loadReviewState(): ReviewState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(REVIEW_KEY) ?? "{}") as ReviewState;
  } catch {
    return {};
  }
}

function saveReviewState(state: ReviewState): void {
  try {
    window.localStorage.setItem(REVIEW_KEY, JSON.stringify(state));
  } catch {
    /* private browsing / quota — reviews just won't persist */
  }
}

export function getReviewState(): ReviewState {
  return loadReviewState();
}

/** Records one recall attempt and schedules the item's next appearance. */
export function recordReview(itemId: string, correct: boolean, now = Date.now()): ReviewState {
  const state = loadReviewState();
  const current = state[itemId] ?? { box: 0, dueAt: now, seen: 0 };
  const box = correct ? Math.min(current.box + 1, REVIEW_INTERVALS_DAYS.length - 1) : 0;
  state[itemId] = { box, dueAt: now + REVIEW_INTERVALS_DAYS[box] * 86400000, seen: current.seen + 1 };
  saveReviewState(state);
  return state;
}

/**
 * Items due for review, oldest first — and deliberately INTERLEAVED across
 * lessons rather than grouped, because mixed practice retains better even
 * though it feels harder at the time.
 */
export function dueReviewItems(allItemIds: string[], now = Date.now()): string[] {
  const state = loadReviewState();
  return allItemIds
    .filter((id) => state[id] && state[id].dueAt <= now)
    .sort((a, b) => state[a].dueAt - state[b].dueAt);
}

/** Items never attempted yet, in course order. */
export function unseenReviewItems(allItemIds: string[]): string[] {
  const state = loadReviewState();
  return allItemIds.filter((id) => !state[id]);
}

export function resetReviews(): void {
  saveReviewState({});
}
