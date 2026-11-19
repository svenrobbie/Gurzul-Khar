# GURZÛL KHAR

An independent constructed language (conlang) inspired by the linguistic atmosphere of Tolkien's Black Speech and Mordor, with its own original phonology, writing system, grammar, vocabulary and a public learning/translation platform.

**This is an independent fan creation.** It is not an authentic Tolkien language, is not endorsed by the Tolkien Estate or any rights holder, and does not reproduce Tolkien's actual Black Speech vocabulary or writing systems. See [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) §D4.

Full specification: [Master Development Specification v2.0.md](Master%20Development%20Specification%20v2.0.md)
Current status / what is and isn't done: [BACKLOG.md](BACKLOG.md)

## Repository layout

| Path | Contents |
|---|---|
| `data/` | Single source of truth for all linguistic data (phonology, orthography, morphology/grammar, lexicon) — JSON, validated by schema + tests |
| `engine/` | Deterministic translation engine (tokeniser, morphological analyser, EN/NL ⇄ Gurzûl Khar translator, native-script generator) |
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
npm run dev
```

```powershell
npm test
```

```powershell
npm run build
```

Deployment to GitHub Pages runs automatically on push to `main` via `.github/workflows/deploy.yml`, once this repository has a GitHub remote. That push has not been performed from this environment — see BACKLOG.md.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for how to propose new vocabulary, grammar refinements or lessons. All linguistic changes must go through the `/data` JSON files so the dictionary, grammar reference, and translator stay in sync automatically.

## License

Original linguistic data, artwork and code in this repository are the project owner's work. See [docs/LICENSE_NOTES.md](docs/LICENSE_NOTES.md) for the licensing approach.
