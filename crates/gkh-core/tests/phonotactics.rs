//! The first real gate of the port.
//!
//! These are the SAME cases `tests/phonotacticFixture.test.ts` asserts on the
//! TypeScript side, generated into Rust by `scripts/buildRustData.mjs` from
//! `tests/fixtures/phonotactics.json`. Both engines check the same words and
//! must produce the same violation codes in the same order.
//!
//! If one of them changes its mind about a word, one of the two suites goes
//! red — which is the entire reason the fixtures are data rather than code.

use gkh_core::phonology::{check_word_phonotactics, is_phonotactically_valid, try_tokenize_word};

mod generated {
    include!("generated/phonotactics.rs");
}

#[test]
fn reproduces_every_shared_fixture() {
    let mut failures: Vec<String> = Vec::new();

    for case in generated::PHONOTACTIC_CASES {
        let actual: Vec<&str> = check_word_phonotactics(case.word)
            .iter()
            .map(|v| v.code.as_str())
            .collect();

        if actual != case.codes {
            failures.push(format!(
                "{:?}: expected [{}], got [{}]",
                case.word,
                case.codes.join(", "),
                actual.join(", ")
            ));
        }

        let valid = is_phonotactically_valid(case.word);
        if valid != case.valid {
            failures.push(format!(
                "{:?}: expected valid={}, got valid={}",
                case.word, case.valid, valid
            ));
        }
    }

    assert!(
        failures.is_empty(),
        "Rust and TypeScript disagree about {} word(s):\n  {}",
        failures.len(),
        failures.join("\n  ")
    );
}

#[test]
fn fixture_set_is_not_empty() {
    assert!(generated::PHONOTACTIC_CASES.len() >= 30);
}

#[test]
fn digraphs_are_single_phonemes() {
    // The whole language depends on this: without longest-match-first, "khar"
    // would tokenize as k-h-a-r and mean nothing.
    let tokens = try_tokenize_word("khar").expect("khar must tokenize");
    assert_eq!(tokens.len(), 3, "khar is kh + a + r");
    assert_eq!(tokens[0].id, "kh");
    assert_eq!(tokens[1].id, "a");
    assert_eq!(tokens[2].id, "r");
}

#[test]
fn written_variants_resolve_to_the_same_vowel() {
    // "ü" is an accepted spelling of long "û": ük and ûk are one word.
    let with_variant = try_tokenize_word("ük").expect("ük must tokenize");
    let canonical = try_tokenize_word("ûk").expect("ûk must tokenize");
    assert_eq!(with_variant[0].id, canonical[0].id);
    assert_eq!(with_variant[0].ipa, canonical[0].ipa);
    assert!(with_variant[0].is_long, "the vowel in ük is long");
}

#[test]
fn a_word_outside_the_inventory_is_refused_not_guessed() {
    assert!(try_tokenize_word("xyzzyq").is_none());
}
