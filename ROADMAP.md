# Gurzûl Khar — Rust core, web + Android roadmap

Nov 23, 2026 · Sven van de Lagemaat

*Living version, with the drawn diagrams and the comment threads: [claude.ai/artifact/F4sFE37yc96esT43Xagb99](https://claude.ai/artifact/F4sFE37yc96esT43Xagb99)*

One `gkh-core` Rust crate becomes the single source of truth for the language — phonology, morphology, lexicon, translator — and ships to three surfaces: the website via WASM, an Android app via UniFFI/Kotlin, and a CLI. Word coverage is solved by a hybrid: the hand-authored lexicon wins, and anything it doesn't cover gets a seeded coinage that is byte-identical on every run, on every platform.

## Where it stands today

For one night's work the foundation is better than it needs to be. The linguistic data is already separated from the code in `data/` as validated JSON, and the engine reads only from there — that single decision is what makes the rest of this plan cheap. A rewrite in another language reimplements `engine/`, not the language itself.

What exists and works:

| Part | State | Notes |
| --- | --- | --- |
| `data/` JSON (phonology, orthography, grammar, lexicon) | Solid | 292 lexicon entries, 3 derivational affixes, schema-validated by tests |
| `engine/phonology` | Solid | Tokeniser, syllabifier, stress, and one shared `checkWordPhonotactics` used by both the lexicon and the tests |
| `engine/lexicon/wordGenerator.ts` | Working prototype | FNV-1a hash → xorshift PRNG, seeded on `gloss + pos`, re-validated against the real phonotactics |
| `engine/translator` | Working, shallow | Clause reordering, closed-class handling, EN/NL lookup |
| `website/` (React + Vite, HashRouter) | Working | Translator, Dictionary, Grammar, Alphabet, Learn, Lore, Propose, Admin |
| Android app | Does not exist | — |

Three things are actually wrong, and they are the three you named:

1. **Coverage.** 292 entries against a Dutch vocabulary of 100,000+ words. Most input hits nothing, so the translator leaks untranslated words.
2. **The generator is a suggester, not a translator.** `suggestWord` is wired into the "propose a word" admin flow, not into translation. It also picks a syllable count from the PRNG, so changing the generator's constants silently changes every coined word ever produced — there is no stability guarantee across versions.
3. **One platform.** The engine is TypeScript-only, so Android means either a WebView or a second implementation that will drift from the first.

## Every word, always the same

The dictionary route is a dead end: Dutch has well over 100,000 lemmas and every one would need a hand-authored, phonotactically valid, non-colliding Gurzûl Khar form. That is years of work and it still fails on the first compound or proper noun a user types. The generator route alone is also wrong — it would overwrite `khar`, `ük`, `pâk` and every other word you chose on purpose.

So: **the lexicon wins, the generator catches the rest.** Any word resolves through four tiers, in order, and the first hit stops the search.

1. **Curated lexicon.** A hand-authored entry in `data/lexicon/lexicon.json`. Always wins, always wins forever.
2. **Morphological derivation.** The input lemmatises to a known root plus a known affix — `sterkte` → `khar` + `-dûm`. Produced by rule, not by hash, so derived words stay transparent to a reader who knows the root.
3. **Compound decomposition.** Dutch compounds split into parts the lexicon knows: `nachtwacht` → night + watch, joined by the language's own compounding rule. This is where Dutch pays off — compounding covers a large slice of the long tail for free.
4. **Deterministic coinage.** Everything left. The gloss is hashed into a seed, the seed drives a syllable template, and the result is checked against `checkWordPhonotactics` before it is returned.

### The determinism contract

"Always the same word" is a promise that has to survive a refactor, a new Rust version and a different CPU. The current prototype does not: its PRNG draws decide the syllable count, so tweaking a probability constant reshuffles every coined word. Four rules fix that, and they are the part of this plan worth being strict about.

- **Freeze the algorithm behind a version number.** `coiner_v1` is immutable once shipped. Improvements land as `coiner_v2`, and `v2` applies only to glosses that have no `v1` form recorded.
- **Normalise the seed input.** Lowercase, NFC-normalise, strip punctuation, and seed on `lemma + "|" + pos + "|" + lang`, nothing else. Not on the surface form — `huizen` and `huis` must coin the same word.
- **No floating point anywhere in the seeded path.** Use integer arithmetic on a `u64` state; float rounding differs between platforms and `f64 / 2^32` is exactly the kind of thing that bites on ARM.
- **A golden file in the repo.** 10,000 glosses with their expected output, asserted in CI. If a change to the coiner moves one of them, the build fails. This is the only real guarantee, and it is cheap.

### Collisions

Two different glosses can hash to the same spelling, and a language where `blood` and `bread` are the same word is broken. The coiner checks its candidate against the lexicon and against an index of already-coined forms; on a hit it re-seeds with an attempt counter and tries again. The attempt counter goes into the golden file too, so the resolution is itself deterministic.

### Coined words are second-class, visibly

The UI marks a coined word differently from a curated one — a dotted underline, a tooltip saying it was generated. Coined words accumulate in a frequency-ranked list, and promoting the top of that list into the hand-authored lexicon becomes the ongoing vocabulary work. That turns "expand the dictionary" from an impossible 100,000-word slog into a steady, demand-driven trickle, and the `Propose` page you already built is the front end for it.

One consequence worth accepting up front: promoting a coined word changes its spelling, because the curated form is chosen by you rather than by the hash. Record both in the entry (`gkh` and `coined_v1`) so old text can still be read.

## Architecture

```
         ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
         │   Website    │   │ Android app  │   │ CLI and tooling  │
         │ React, WASM  │   │ Kotlin/UniFFI│   │ golden tests     │
         └──────▲───────┘   └──────▲───────┘   └────────▲─────────┘
                │                  │                    │
         ┌──────┴──────────────────┴────────────────────┴─────────┐
         │  gkh-core (Rust) — no I/O, fully deterministic         │
         │  phonology │ lexicon+coiner │ morphology │ translator  │
         └───────────────────────────▲────────────────────────────┘
                                     │
         ┌───────────────────────────┴────────────────────────────┐
         │  data/ — phonology, orthography, grammar, lexicon JSON │
         │          embedded at compile time                      │
         └────────────────────────────────────────────────────────┘
```

The crate has no file I/O and no clock: the JSON is compiled in, so the same input gives the same output on every platform, which is exactly the property the determinism promise needs. The website, the app and the CLI are interchangeable front ends over one implementation — a bug fixed in the translator is fixed everywhere at once.

## The port

Do not start a Rust rewrite from an empty directory. The TypeScript engine is your specification, and the way to port it safely is to make the Rust version pass the tests the TypeScript version already passes, module by module, bottom up.

The order follows the dependency graph, so each layer is finished and tested before the next one needs it:

| Order | Module | Ports from | Done when |
| --- | --- | --- | --- |
| 1 | Data loading + schemas | `engine/data.ts` | `serde` structs deserialise every file in `data/`, validation test passes |
| 2 | Phonemes, syllabify, stress | `engine/phonology/*` | Same syllabification for all 292 lexicon entries |
| 3 | Phonotactic validator | `phonotacticValidator.ts` | Byte-identical violations on a shared fixture file |
| 4 | Coiner (`coiner_v1`) | `wordGenerator.ts`, rewritten | Golden file of 10,000 glosses passes; no floats |
| 5 | Transliteration + IPA | `generator/`, `translator/ipa.ts` | Existing transliteration tests pass |
| 6 | Morphology + translator | `engine/morphology/*`, `engine/translator/*` | Regression suite passes identically |
| 7 | WASM bindings | new | Website runs on the WASM engine behind a feature flag |
| 8 | UniFFI bindings | new | Kotlin sample app translates a sentence offline |

### Keeping both engines honest during the port

Move `tests/regression.test.ts` fixtures into a language-neutral `tests/fixtures/*.json` — input, expected output, nothing else. Both the Vitest suite and the Rust `#[test]`s read the same files. While both engines exist, CI runs both against the same fixtures, and a divergence is a build failure rather than something you find three months later in the app.

The website switches over last, behind a flag. Only once the WASM build is passing the full fixture set does the TypeScript engine get deleted — and `data/` never moves, it is just read by Rust instead of by Node.

### What you will actually hit in Rust

Some honest warnings, since this is your first real Rust project:

- **Strings.** Gurzûl Khar uses `û`, `â`, `ü`, so `s.len()` is bytes and `s[0..1]` will panic. Work in `Vec<char>` or on your own tokenised phoneme type, never on raw byte slices.
- **Don't fight the borrow checker with the lexicon.** Load it once into an `Arc<Lexicon>` at startup, with `HashMap` indexes built alongside it. Clone the `Arc`, not the data.
- **WASM has no filesystem.** The JSON gets embedded at compile time with `include_str!`, which also means the engine has no I/O at all — good for determinism, and it makes the crate trivially testable.
- **UniFFI over hand-written JNI.** Hand-rolled JNI is where this kind of project usually dies. UniFFI generates the Kotlin bindings from your Rust signatures and keeps them in sync.

## Roadmap

| Phase | Work | Gate that ends it |
| --- | --- | --- |
| 1 · Lock the contract — **done** | Shared JSON fixtures, the 10,549-case golden file, `coiner_v1` measured from the lexicon, tuned by ear and frozen | **Passed 2026-11-23.** The coined words read like Gurzûl Khar, and the algorithm is versioned and frozen |
| 2 · Finish the language — **lemmatiser, grammar and reverse coining done; see BACKLOG.md** | Lemmatiser and Dutch compound splitting, the four open grammar patterns (prepositional phrases, imperatives and modals, relative clauses, subordinate clauses), reverse coining through a coinage index | Ordinary Dutch and English sentences translate in full, both directions, nothing bracketed |
| 3 · Port the engine to Rust | `gkh-core` bottom-up: data loading, phonology, coiner, transliteration, lemmatiser, morphology, translator | Rust and TypeScript return identical output on every fixture, checked in CI |
| 4 · Move the website onto WASM | wasm-bindgen build behind a flag; React pages call the crate | The site runs on the Rust engine and the TypeScript engine is deleted |
| 5 · Build the Android app | UniFFI bindings, Kotlin + Compose: translator, dictionary, alphabet | A phone in flight mode translates a sentence and shows it in Khargûl |
| 6 · Grow the language | Promote the most-used coined words into the lexicon; extend lessons, lore, script | Ongoing — no end gate |

Phase 1 is done: the fixtures, the golden file and a frozen `coiner_v1` exist, so the language's behaviour is pinned rather than remembered. The port then moved behind phase 2 deliberately — porting a half-finished language means porting it twice, and every grammar pattern added after the port has to be written in Rust by someone still learning Rust. Finish the language in TypeScript, where it is cheap to change, and the port becomes mechanical. Phase 6 runs in parallel with everything from phase 3 onward — it needs no code, only words.

## Risks and open questions

The three things most likely to go wrong, in order of how much they would cost:

**The coiner's output is ugly.** A hash-driven word generator produces phonotactically legal words that still sound wrong — flat, repetitive, nothing like the hand-picked ones. This is the real risk, and it is aesthetic rather than technical. Mitigation: before committing to `coiner_v1`, generate 500 words, read them aloud, and tune the syllable templates and consonant weights until they sit alongside `gurzûl`, `khar` and `pâk` without standing out. Do that tuning *before* the version is frozen, because afterwards it is expensive.

**Dutch lemmatisation is harder than it looks.** Tiers 2 and 3 need to know that `huizen` is `huis` and that `nachtwacht` splits into two words. Dutch is the primary input language and English the second, so this sits on the critical path rather than beside it. Pure-Rust options exist but none are as good as the Python NLP stack. If this turns into a project of its own, the fallback is a precompiled lemma table for the most common 20,000 Dutch words shipped as a data file, and tier 4 catching the rest — worse quality, far less work, and it keeps the engine offline.

**Scope.** There is a website, an Android app, a language, a course and a lore bible here. The language and the engine are the thing only you can build; the rest is ordinary software. If time gets short, the Android app waits — the website works on a phone.

### Open questions

- [ ] Does the Android app need to be offline-first, or is a thin client acceptable for v1? (Offline-first is assumed throughout this plan.)
- [ ] Should coined words be shared across users, or generated locally? Local generation is simpler and matches the determinism promise, but means no central record of what has been coined.
- [ ] Does the Khargûl script need a real font, or does the procedural glyph generator stay the rendering path? A font is a large, separate piece of work.
- [ ] Is the website staying on GitHub Pages? That constrains anything needing a backend — which, if the engine is fully client-side, may not matter at all.
