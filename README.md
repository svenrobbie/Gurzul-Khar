# GURZÛL KHAR

An independent constructed language (conlang) inspired by the linguistic atmosphere of Tolkien's Black Speech and Mordor, with its own original phonology, writing system, grammar, vocabulary and a public learning/translation platform.

**This is an independent fan creation.** It is not an authentic Tolkien language, is not endorsed by the Tolkien Estate or any rights holder, and does not reproduce Tolkien's actual Black Speech vocabulary or writing systems. See [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) §D4.

Full specification: [Master Development Specification v2.0.md](Master%20Development%20Specification%20v2.0.md)
Current status / what is and isn't done: [BACKLOG.md](BACKLOG.md)

## Repository layout

| Path | Contents |
|---|---|
| `data/` | Single source of truth for all linguistic data (phonology, orthography, morphology/grammar, lexicon) — JSON, validated by schema + tests |
| `engine/` | Deterministic translation engine in TypeScript (tokeniser, morphological analyser, lemmatiser, coiner, EN/NL ⇄ Gurzûl Khar translator, native-script generator) |
| `crates/` | The same engine in Rust. `gkh-core` is the portable, dependency-free core; `gkh-wasm` wraps it for the browser |
| `website/` | The public site (Home, Translator, Dictionary, Grammar, Alphabet, Pronunciation, Learn, Lore, Engine docs, About) |
| `learning/` | Course structure, lesson content and exercise data |
| `alphabet/` | Khargûl script documentation and the procedural glyph generator |
| `lore/` | Fictional in-world history and culture of Gurzûl Khar |
| `tests/` | Automated tests across data validation, engine determinism and translation regression |
| `docs/` | Project-level documentation |
| `.github/workflows/` | CI: test, validate, build, deploy to GitHub Pages |

## Getting started

```powershell
npm install
npm install --prefix website
npm run dev          # starts the website's Vite dev server
```

```powershell
npm test             # engine + data tests (Vitest)
npm run validate     # linguistic data validation report
```

```powershell
npm run build        # typechecks the engine, then builds the website
```

The website uses React Router's `HashRouter` (URLs like `/#/translator`), a deliberate choice so the site works
correctly on GitHub Pages' static hosting — deep links and page refreshes resolve without needing a 404.html
SPA-redirect trick or a base-path-aware browser router. See `website/vite.config.ts` and the Engine docs page.

Deployment to GitHub Pages runs automatically on push to `main` via `.github/workflows/deploy.yml`. The repository
lives at [github.com/svenrobbie/Gurzul-Khar](https://github.com/svenrobbie/Gurzul-Khar) and the site is live.

## Two engines

The engine exists twice on purpose. `engine/` (TypeScript) is the original and is still what the site ships with;
`crates/gkh-core` (Rust) is the port that will replace it and that the Android app will use. They are kept honest by
shared, language-neutral fixtures in `tests/fixtures/*.json` — the same inputs and expected outputs are asserted by
Vitest and by `cargo test`, so a divergence fails a build rather than surfacing months later on a phone.

The Rust crate reads no files at runtime. `scripts/buildRustData.mjs` turns `data/*.json` into Rust constants at build
time, which is why `gkh-core` has zero dependencies and compiles unchanged to WebAssembly. CI regenerates that data and
fails if the checked-in copy is stale, so `data/` stays the single source of truth.

```powershell
npm run rust:data    # regenerate the Rust data + fixtures from data/
npm run rust:test    # cargo test --workspace
```

### Building the site on the Rust engine

The website picks its engine at build time. Without the WebAssembly artifact it builds and runs on TypeScript as
before; with it, `vite.config.ts` aliases the engine adapter to the compiled crate.

```powershell
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
npm run build:wasm        # wasm-pack build crates/gkh-wasm
npm run build:rust-site   # GKH_ENGINE=rust vite build
```

If the WebAssembly module fails to load at runtime, `website/src/engine/index.ts` falls back to the TypeScript engine
rather than leaving the Translator dead.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for how to propose new vocabulary, grammar refinements or lessons. All linguistic changes must go through the `/data` JSON files so the dictionary, grammar reference, and translator stay in sync automatically.

## License

Original linguistic data, artwork and code in this repository are the project owner's work. See [docs/LICENSE_NOTES.md](docs/LICENSE_NOTES.md) for the licensing approach.
