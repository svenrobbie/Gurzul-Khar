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
