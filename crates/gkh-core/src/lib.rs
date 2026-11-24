//! # gkh-core
//!
//! The Gurzûl Khar language engine.
//!
//! This crate is the Rust port of the TypeScript engine in `engine/`, and the
//! two are held to the same behaviour by shared fixtures in `tests/fixtures/`:
//! the same words, the same expected results, asserted by both suites. When
//! they disagree, a build goes red rather than the difference reaching an app.
//!
//! Three properties are deliberate and worth keeping:
//!
//! - **No I/O.** The language data is compiled in (see [`data`]). Nothing
//!   reads a file, so nothing can load the wrong one.
//! - **No dependencies.** Partly forced by the build environment, mostly a
//!   good idea: it compiles to `wasm32` and to Android with nothing to bundle.
//! - **Deterministic.** No clock, no randomness, no floating point in any
//!   seeded path. The same input gives the same output on every platform.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod data;
pub mod lexicon;
pub mod morphology;
pub mod phonology;
