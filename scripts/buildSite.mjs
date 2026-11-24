// Builds the website against a chosen engine, without depending on a shell's
// env syntax — `GKH_ENGINE=rust vite build` is not a thing on Windows, and
// pulling in cross-env for one variable is not worth a dependency.
//
//   node scripts/buildSite.mjs rust
//   node scripts/buildSite.mjs rust --pages
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engine = process.argv[2] ?? "rust";
const pages = process.argv.includes("--pages");

const result = spawnSync("npm", ["run", "build"], {
  cwd: path.join(root, "website"),
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    GKH_ENGINE: engine,
    ...(pages ? { GITHUB_PAGES: "true" } : {}),
  },
});

process.exit(result.status ?? 1);
