//! The last gate of the port: all four translation directions.
//!
//! The SAME 52 cases `tests/regression.test.ts` asserts, generated from
//! `tests/fixtures/translation.json`. Every supported grammatical pattern is
//! represented — declaratives, negation, both kinds of question, possession,
//! plurals, comparatives, coordination, postpositional phrases, modals,
//! imperatives, relative clauses and subordinate clauses — plus the
//! word-for-word fallback and the cases that must still be refused.

use gkh_core::translator::{translate, Direction, Translation};

mod generated {
    include!("generated/translation.rs");
}

struct Case<'a> {
    name: &'a str,
    direction: Direction,
    input: &'a str,
    expect: &'a str,
    output: &'a str,
    unknown_word: &'a str,
    never_unknown: Vec<&'a str>,
    coined: Vec<(&'a str, &'a str)>,
}

fn cases() -> Vec<Case<'static>> {
    generated::TRANSLATION_TSV
        .lines()
        .map(|line| {
            let f: Vec<&str> = line.split('\t').collect();
            assert_eq!(f.len(), 8, "malformed row: {line:?}");
            Case {
                name: f[0],
                direction: Direction::from_code(f[1]).expect("known direction"),
                input: f[2],
                expect: f[3],
                output: f[4],
                unknown_word: f[5],
                never_unknown: if f[6].is_empty() { Vec::new() } else { f[6].split('|').collect() },
                coined: if f[7].is_empty() {
                    Vec::new()
                } else {
                    f[7].split('|')
                        .map(|p| {
                            let mut it = p.splitn(2, '>');
                            (it.next().unwrap_or(""), it.next().unwrap_or(""))
                        })
                        .collect()
                },
            }
        })
        .collect()
}

#[test]
fn the_fixture_covers_the_supported_grammar() {
    assert!(cases().len() >= 50);
}

#[test]
fn reproduces_every_shared_translation() {
    let mut failures: Vec<String> = Vec::new();

    for case in cases() {
        let result = translate(case.input, case.direction);

        match case.expect {
            "fail" => {
                // A refusal means refused, not "translated word for word".
                // Every word here is known; the pattern is what is missing, and
                // a word-for-word gloss would read as a translation while
                // silently dropping the grammar.
                if let Translation::Ok(ok) = &result {
                    failures.push(format!(
                        "{}: expected a refusal, got {:?}{}",
                        case.name,
                        ok.output,
                        if ok.partial { " (word-for-word)" } else { "" }
                    ));
                }
            }
            "output" => match &result {
                Translation::Ok(ok) if !ok.partial => {
                    if ok.output != case.output {
                        failures.push(format!("{}: expected {:?}, got {:?}", case.name, case.output, ok.output));
                    }
                }
                Translation::Ok(ok) => failures.push(format!(
                    "{}: expected a full parse giving {:?}, got a word-for-word {:?}",
                    case.name, case.output, ok.output
                )),
                Translation::Failed { reason } => {
                    failures.push(format!("{}: expected {:?}, but it was refused ({reason:?})", case.name, case.output))
                }
            },
            "partial" => match &result {
                Translation::Ok(ok) => {
                    if !ok.partial {
                        failures.push(format!("{}: expected a word-for-word translation", case.name));
                    }
                    if !case.unknown_word.is_empty() && !ok.unknown_words.iter().any(|w| w == case.unknown_word) {
                        failures.push(format!(
                            "{}: expected {:?} among the unknown words, got {:?}",
                            case.name, case.unknown_word, ok.unknown_words
                        ));
                    }
                    for never in &case.never_unknown {
                        if ok.unknown_words.iter().any(|w| w == never) {
                            failures.push(format!("{}: {:?} must never be reported unknown", case.name, never));
                        }
                    }
                    if !case.output.is_empty() && ok.output != case.output {
                        failures.push(format!("{}: expected {:?}, got {:?}", case.name, case.output, ok.output));
                    }
                    let actual: Vec<(String, String)> =
                        ok.coined_words.iter().map(|c| (c.source.clone(), c.gkh.clone())).collect();
                    let expected: Vec<(String, String)> =
                        case.coined.iter().map(|(s, g)| (s.to_string(), g.to_string())).collect();
                    if !case.coined.is_empty() && actual != expected {
                        failures.push(format!("{}: expected coined {:?}, got {:?}", case.name, expected, actual));
                    }
                }
                Translation::Failed { reason } => {
                    failures.push(format!("{}: expected a partial translation, got {reason:?}", case.name))
                }
            },
            other => panic!("unknown expectation {other:?}"),
        }
    }

    assert!(
        failures.is_empty(),
        "Rust and TypeScript disagree on {} of {} cases:\n  {}",
        failures.len(),
        cases().len(),
        failures.join("\n  ")
    );
}

#[test]
fn a_coined_word_reads_back_through_the_index() {
    use gkh_core::translator::{translate, Direction, Translation};

    // "draak" is not in the lexicon, so the coiner supplies a form.
    let out = match translate("Ik zie de draak", Direction::NlToGkh) {
        Translation::Ok(ok) => ok,
        Translation::Failed { reason } => panic!("expected a translation, got {reason:?}"),
    };
    let coined = out
        .coined_words
        .iter()
        .find(|c| c.source == "draak")
        .unwrap_or_else(|| panic!("expected \"draak\" to be coined, got {:?}", out.coined_words));

    // The hash cannot be inverted, so the way back is the recorded pairing.
    let back = match translate(&format!("ük sel {}", coined.gkh), Direction::GkhToNl) {
        Translation::Ok(ok) => ok,
        Translation::Failed { reason } => panic!("expected a translation back, got {reason:?}"),
    };
    assert!(
        back.output.contains("draak"),
        "a coined word must read back as what it was coined for, got {:?}",
        back.output
    );
    assert!(
        !back.output.contains('⟦'),
        "nothing should be bracketed here, got {:?}",
        back.output
    );
}

#[test]
fn a_word_nobody_has_coined_is_still_bracketed() {
    use gkh_core::translator::{translate, Direction, Translation};

    // The index is a record, not an inversion. A spelling that was never
    // issued has no gloss, and saying so is the honest answer.
    match translate("ük sel zorbuth", Direction::GkhToNl) {
        Translation::Ok(ok) => assert!(
            ok.output.contains('⟦'),
            "an unrecorded spelling must not be given a meaning, got {:?}",
            ok.output
        ),
        Translation::Failed { .. } => {}
    }
}

#[test]
fn the_same_input_always_gives_the_same_output() {
    use gkh_core::translator::{translate, Direction, Translation};

    // "Always the same word" is the promise the whole project is built on, so
    // it is asserted rather than assumed — including for a sentence that
    // coins, where a stray bit of state would show up first.
    let cases = [
        ("Ik zie de draak", Direction::NlToGkh),
        ("the king who has strength", Direction::EnToGkh),
        ("ük pâku", Direction::GkhToNl),
        ("shak kha khar dûnu", Direction::GkhToEn),
    ];

    for (input, dir) in cases {
        let first = translate(input, dir);
        for _ in 0..3 {
            let again = translate(input, dir);
            match (&first, &again) {
                (Translation::Ok(a), Translation::Ok(b)) => {
                    assert_eq!(a.output, b.output, "{input:?} translated differently on a second run");
                    assert_eq!(a.pronunciation, b.pronunciation, "{input:?} changed pronunciation");
                    assert_eq!(
                        a.coined_words.iter().map(|c| &c.gkh).collect::<Vec<_>>(),
                        b.coined_words.iter().map(|c| &c.gkh).collect::<Vec<_>>(),
                        "{input:?} coined differently on a second run"
                    );
                }
                (Translation::Failed { reason: a }, Translation::Failed { reason: b }) => {
                    assert_eq!(format!("{a:?}"), format!("{b:?}"), "{input:?} failed for a different reason");
                }
                _ => panic!("{input:?} succeeded on one run and failed on another"),
            }
        }
    }
}
