// Phase 2 §6: a genuinely offline, non-neural, RULE-BASED pronunciation
// prototype, built with the Web Audio API, as an ADDITION alongside (not a
// replacement for) the existing labelled-synthetic SpeechSynthesis aid in
// Pronunciation.tsx. This is not a text-to-speech engine and does not
// attempt real formant synthesis or coarticulation — it renders each phoneme
// token (from engine/phonology/phonemes.ts + syllabify.ts, the SAME data the
// rest of the site uses) as a short, deterministic tone or noise burst whose
// pitch/timbre is derived from that phoneme's own declared features
// (vowel height/backness via id, consonant manner/voicing), one phoneme
// after another. It is honestly labelled "experimental, not real speech" in
// the UI — see BACKLOG.md §6 for exactly what this is and is not.
import { tryTokenizeWord, type PhonemeToken } from "@engine/phonology/phonemes.js";

// Rough, deliberately simplified pitch per vowel quality (NOT real formant
// values) — close front vowels get a higher tone, close back vowels a lower
// one, purely so different vowels are audibly distinguishable from each
// other, which is the only goal of this prototype.
const VOWEL_PITCH: Record<string, number> = {
  i: 420, î: 420,
  e: 380, ê: 380,
  a: 300, â: 300,
  o: 260, ô: 260,
  u: 220, û: 220,
  ai: 350, au: 280, oi: 300,
};

function baseVowelPitch(token: PhonemeToken): number {
  return VOWEL_PITCH[token.id] ?? 300;
}

/** Schedules one phoneme's sound starting at `startTime` in `ctx`, returns the duration consumed. */
function scheduleToken(ctx: AudioContext, token: PhonemeToken, startTime: number, destination: AudioNode): number {
  if (token.kind === "vowel") {
    const dur = token.isLong || token.isDiphthong ? 0.26 : 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseVowelPitch(token), startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    osc.connect(gain).connect(destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
    return dur;
  }

  // Consonants: manner determines the texture; voicing shifts a filtered-noise burst's tone.
  const dur = 0.09;
  const manner = token.manner ?? "plosive";
  if (manner === "nasal") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    osc.connect(gain).connect(destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
    return dur;
  }
  if (manner === "trill" || manner === "approximant" || manner === "lateral") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, startTime);
    osc.frequency.linearRampToValueAtTime(manner === "trill" ? 260 : 200, startTime + dur);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    osc.connect(gain).connect(destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
    return dur;
  }
  // plosive / fricative: filtered white-noise burst. Voiced = lower cutoff (duller "buzz"), voiceless = higher (sharper hiss).
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = manner === "plosive" ? "lowpass" : "bandpass";
  filter.frequency.setValueAtTime(token.voicing === "voiced" ? 900 : 2400, startTime);
  const gain = ctx.createGain();
  const burstDur = manner === "plosive" ? 0.04 : dur;
  gain.gain.setValueAtTime(0.3, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + burstDur);
  noise.connect(filter).connect(gain).connect(destination);
  noise.start(startTime);
  noise.stop(startTime + burstDur + 0.02);
  return burstDur;
}

let sharedCtx: AudioContext | null = null;

/** Plays `word` as a sequence of rule-based phoneme sounds. Returns false if Web Audio isn't available or the word doesn't tokenize. */
export function playRuleBasedPronunciation(word: string): boolean {
  if (typeof window === "undefined") return false;
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtor) return false;
  const tokens = tryTokenizeWord(word);
  if (!tokens || tokens.length === 0) return false;

  if (!sharedCtx) sharedCtx = new AudioCtor();
  const ctx = sharedCtx;
  if (ctx.state === "suspended") ctx.resume();

  let t = ctx.currentTime + 0.05;
  for (const token of tokens) {
    const dur = scheduleToken(ctx, token, t, ctx.destination);
    t += dur * 0.85; // slight overlap between phonemes, closer to continuous speech than isolated beeps
  }
  return true;
}
