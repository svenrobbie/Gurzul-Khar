//! The hardest gate in the port.
//!
//! coiner_v1 is frozen, and these are the SAME 10,549 coinages
//! `tests/coinerGolden.test.ts` pins on the TypeScript side. Reproducing them
//! in Rust proves the parts of the port most likely to be subtly wrong:
//!
//!  * FNV-1a over UTF-8 bytes, where BigInt masking became u64 wrapping
//!  * the hex-padded sub-seed labels, where a different width or case would
//!    silently change every coined word
//!  * character-counted candidate length, where Rust's byte `len()` would
//!    reject valid two-letter words containing a diacritic
//!  * integer-only weighted draws, with no float rounding to diverge
//!
//! If this fails, the two engines have stopped speaking the same language.
//! Do not regenerate the fixture to make it pass.

use gkh_core::lexicon::{coin, normalise_seed, CoinInput, COINER_VERSION};

mod generated {
    include!("generated/coiner_golden.rs");
}

struct Case<'a> {
    lemma: &'a str,
    pos: &'a str,
    lang: &'a str,
    gkh: &'a str,
    attempt: u32,
}

fn cases() -> Vec<Case<'static>> {
    generated::GOLDEN_TSV
        .lines()
        .map(|line| {
            let f: Vec<&str> = line.split('\t').collect();
            assert_eq!(f.len(), 5, "malformed golden row: {line:?}");
            Case {
                lemma: f[0],
                pos: f[1],
                lang: f[2],
                gkh: f[3],
                attempt: f[4].parse().expect("attempt must be a number"),
            }
        })
        .collect()
}

#[test]
fn the_fixture_is_the_whole_set() {
    assert!(cases().len() > 10_000, "expected the full golden set");
    assert_eq!(COINER_VERSION, "v1");
}

#[test]
fn reproduces_every_pinned_coinage_in_order() {
    // Coined in file order with each result reserved against the next, exactly
    // as the TypeScript generator did — so `attempt` is part of the contract,
    // not an incidental.
    let mut taken: Vec<String> = Vec::new();
    let mut drifted: Vec<String> = Vec::new();

    for case in cases() {
        let input = CoinInput {
            lemma: case.lemma.to_string(),
            pos: case.pos.to_string(),
            lang: case.lang.to_string(),
        };
        let result = coin(&input, &taken).expect("coiner must find a candidate");
        taken.push(result.gkh.clone());

        if result.gkh != case.gkh || result.attempt != case.attempt {
            drifted.push(format!(
                "{} ({}, {}): expected {}#{}, got {}#{}",
                case.lemma, case.pos, case.lang, case.gkh, case.attempt, result.gkh, result.attempt
            ));
            if drifted.len() >= 10 {
                break;
            }
        }
    }

    assert!(
        drifted.is_empty(),
        "Rust and TypeScript disagree on {} coinage(s):\n  {}",
        drifted.len(),
        drifted.join("\n  ")
    );
}

#[test]
fn every_pinned_gloss_gets_a_distinct_form() {
    let mut forms: Vec<&str> = cases().iter().map(|c| c.gkh).collect();
    let total = forms.len();
    forms.sort_unstable();
    forms.dedup();
    assert_eq!(forms.len(), total, "two glosses share a spelling");
}

#[test]
fn is_a_pure_function_of_lemma_pos_and_lang() {
    let input = CoinInput { lemma: "huis".into(), pos: "noun".into(), lang: "nl".into() };
    let a = coin(&input, &[]).unwrap();
    let b = coin(&input, &[]).unwrap();
    assert_eq!(a.gkh, b.gkh);
}

#[test]
fn ignores_case_and_surrounding_punctuation() {
    let base = coin(&CoinInput { lemma: "huis".into(), pos: "noun".into(), lang: "nl".into() }, &[]).unwrap();
    let noisy = coin(&CoinInput { lemma: "  HUIS! ".into(), pos: "noun".into(), lang: "nl".into() }, &[]).unwrap();
    assert_eq!(base.gkh, noisy.gkh);

    assert_eq!(
        normalise_seed(&CoinInput { lemma: "Huis.".into(), pos: "Noun".into(), lang: "nl".into() }),
        "huis|noun|nl"
    );
}

#[test]
fn distinguishes_part_of_speech() {
    let noun = coin(&CoinInput { lemma: "work".into(), pos: "noun".into(), lang: "en".into() }, &[]).unwrap();
    let verb = coin(&CoinInput { lemma: "work".into(), pos: "verb".into(), lang: "en".into() }, &[]).unwrap();
    assert_ne!(noun.gkh, verb.gkh);
}
