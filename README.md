# GURZÛL KHAR

An independent constructed language (conlang) inspired by the linguistic atmosphere of Tolkien's Black Speech and Mordor, with its own original phonology, writing system, grammar, vocabulary and a public learning/translation platform.

**This is an independent fan creation.** It is not an authentic Tolkien language, is not endorsed by the Tolkien Estate or any rights holder, and does not reproduce Tolkien's actual Black Speech vocabulary or writing systems. See [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) §D4.

Full specification: [Master Development Specification v2.0.md](Master%20Development%20Specification%20v2.0.md)
Current status / what is and isn't done: [BACKLOG.md](BACKLOG.md)

## Repository layout

| Path | Contents |
|---|---|
| `data/` | Single source of truth for all linguistic data (phonology, orthography, morphology/grammar, lexicon) — JSON, validated by schema + tests |
| `crates/` | The language engine. `gkh-core` is the portable, dependency-free core — phonology, morphology, lexicon, coiner, translator; `gkh-wasm` wraps it for the browser |
| `fixtures/` | Language-neutral test data: translations, phonotactics, lemmatisation, and the 10,549-case coiner golden file |
| `scripts/` | Build and maintenance tools, all running against the same WebAssembly engine the site uses |
| `website/` | The public site (Home, Translator, Dictionary, Grammar, Alphabet, Pronunciation, Learn, Lore, Engine docs, About) |
| `learning/` | Course structure, lesson content and exercise data |
| `alphabet/` | Khargûl script documentation and the procedural glyph generator |
| `lore/` | Fictional in-world history and culture of Gurzûl Khar |
| `docs/` | Project-level documentation |
| `.github/workflows/` | CI: test, validate, build, deploy to GitHub Pages |

## Getting started

```powershell
npm run install:all
npm run build:wasm   # the site cannot run without this
npm run dev          # starts the website's Vite dev server
```

The website uses React Router's `HashRouter` (URLs like `/#/translator`), a deliberate choice so the site works
correctly on GitHub Pages' static hosting — deep links and page refreshes resolve without needing a 404.html
SPA-redirect trick or a base-path-aware browser router. See `website/vite.config.ts` and the Engine docs page.

Deployment to GitHub Pages runs automatically on push to `main` via `.github/workflows/deploy.yml`. The repository
lives at [github.com/svenrobbie/Gurzul-Khar](https://github.com/svenrobbie/Gurzul-Khar) and the site is live.

## The engine

Everything about the language lives in `crates/gkh-core`: phonology, morphology, the lexicon, the coiner and the
translator. It compiles to WebAssembly for this site, and the same crate will back the Android app and the
command-line tooling, so a bug fixed in the translator is fixed everywhere at once.

The crate has no dependencies and reads no files at runtime. `scripts/buildRustData.mjs` turns `data/*.json` into
Rust constants at build time, which is what keeps `data/` the single source of truth while making the engine
impossible to start with the wrong data. CI regenerates that data and fails if the checked-in copy is stale.

There was a TypeScript engine first. The port was held to shared fixtures in `fixtures/*.json` — the same inputs
and expected outputs asserted by both suites while both existed — and the TypeScript engine was deleted once the
Rust one reproduced every case. The fixtures stayed, and are now what pins the language against future changes.

```powershell
npm run rust:data    # regenerate the compiled-in language data from data/
npm test             # cargo test --workspace
npm run validate     # lexicon + learning content, checked against the engine
```

### Building

The site has one engine, so the WebAssembly artifact is not optional: without it the build fails and says so.

```powershell
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
npm run build        # builds the crate to wasm, then builds the site against it
```

`npm run dev` needs the artifact too — run `npm run build:wasm` once first.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for how to propose new vocabulary, grammar refinements or lessons. All linguistic changes must go through the `/data` JSON files so the dictionary, grammar reference, and translator stay in sync automatically.

## License

Original linguistic data, artwork and code in this repository are the project owner's work. See [docs/LICENSE_NOTES.md](docs/LICENSE_NOTES.md) for the licensing approach.
