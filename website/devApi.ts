// Local, dev-server-only "backend" for the Phase 2 word-proposal / review
// flow (brief §2). This is a Vite plugin: it only runs inside `npm run dev`
// (vite's own Node process), never in the static production build, and it
// never calls out to any network service — it reads/writes the two JSON
// files under /data/lexicon directly on this machine. That is the whole
// "approval step" for a single-owner project: there is no multi-user auth,
// no deployed server, just a local review tool a developer runs on their own
// machine. See BACKLOG.md §2 for exactly what this does and does not cover,
// and why it cannot work on the static GitHub Pages build.
import type { Plugin, ViteDevServer } from "vite";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const LEXICON_PATH = path.resolve(here, "../data/lexicon/lexicon.json");
const PROPOSALS_PATH = path.resolve(here, "../data/lexicon/proposals.json");

async function readJson(p: string): Promise<any> {
  return JSON.parse(await fs.readFile(p, "utf-8"));
}
async function writeJson(p: string, data: any): Promise<void> {
  await fs.writeFile(p, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function bumpPatch(version: string): string {
  const parts = version.split(".").map((n) => parseInt(n, 10) || 0);
  parts[2] = (parts[2] ?? 0) + 1;
  return parts.join(".");
}

function nextProposalId(proposals: any[]): string {
  const n = proposals.length + 1;
  return `prop-${String(n).padStart(4, "0")}-${Date.now().toString(36)}`;
}

function nextLexiconId(entries: any[], domain: string): string {
  const prefix = (domain || "gen").slice(0, 3).toLowerCase();
  const existing = entries.filter((e) => e.id.startsWith(prefix)).length;
  return `${prefix}-${String(existing + 1).padStart(3, "0")}-p2`;
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req: import("node:http").IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/** Vite plugin registering the /api/lexicon/* dev-only endpoints. */
export function lexiconDevApiPlugin(): Plugin {
  return {
    name: "gurzul-khar-lexicon-dev-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/lexicon/")) return next();
        res.setHeader("access-control-allow-origin", "*");

        try {
          // Lazy import so this module tree-shakes cleanly out of any accidental client bundle.
          const { checkWordPhonotactics } = await import("../engine/phonology/phonotacticValidator.js");
          const { findConflicts } = await import("../engine/lexicon/conflicts.js");

          if (req.method === "GET" && req.url === "/api/lexicon/vocabulary") {
            const [lex, prop] = await Promise.all([readJson(LEXICON_PATH), readJson(PROPOSALS_PATH)]);
            return sendJson(res, 200, { lexicon: lex, proposals: prop });
          }

          if (req.method === "POST" && req.url === "/api/lexicon/suggest") {
            const body = await readBody(req);
            const { suggestWord } = await import("../engine/lexicon/wordGenerator.js");
            const candidate = suggestWord({ en: body.en, nl: body.nl }, body.pos, body.rootHint);
            return sendJson(res, 200, { candidate });
          }

          if (req.method === "POST" && req.url === "/api/lexicon/propose") {
            const body = await readBody(req);
            const gkh = String(body.gkh || "").trim();
            const en = String(body.en || "").trim();
            const nl = String(body.nl || "").trim();
            const pos = String(body.pos || "").trim();
            const domain = String(body.domain || "general").trim();
            if (!gkh || !en || !pos) return sendJson(res, 400, { ok: false, error: "gkh, en and pos are required." });

            const violations = checkWordPhonotactics(gkh.replace(/-/g, ""));
            if (violations.length > 0) {
              return sendJson(res, 200, { ok: false, violations, conflicts: [] });
            }
            const propData = await readJson(PROPOSALS_PATH);
            const activeProposals = propData.proposals.filter((p: any) => p.status === "proposed");
            const conflicts = findConflicts({ gkh, en, nl, pos }, activeProposals);
            if (conflicts.length > 0 && !body.force) {
              return sendJson(res, 200, { ok: false, violations: [], conflicts });
            }

            const entry = {
              id: nextProposalId(propData.proposals),
              gkh,
              ipa: body.ipa || "",
              pos,
              en,
              nl,
              domain,
              root: body.root || undefined,
              notes: body.notes || undefined,
              status: "proposed",
              origin: body.origin === "suggested" ? "suggested" : "manual",
              submittedAt: new Date().toISOString(),
            };
            propData.proposals.push(entry);
            await writeJson(PROPOSALS_PATH, propData);
            return sendJson(res, 200, { ok: true, entry, conflicts });
          }

          if (req.method === "POST" && req.url === "/api/lexicon/review") {
            const body = await readBody(req);
            const id = String(body.id || "");
            const action = body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : null;
            if (!id || !action) return sendJson(res, 400, { ok: false, error: "id and action ('approve'|'reject') are required." });

            const propData = await readJson(PROPOSALS_PATH);
            const idx = propData.proposals.findIndex((p: any) => p.id === id);
            if (idx === -1) return sendJson(res, 404, { ok: false, error: "No such proposal." });
            const proposal = propData.proposals[idx];
            if (proposal.status !== "proposed") {
              return sendJson(res, 400, { ok: false, error: `Proposal is already "${proposal.status}", not pending.` });
            }

            if (action === "reject") {
              proposal.status = "rejected";
              proposal.reviewedAt = new Date().toISOString();
              proposal.reviewNote = body.reviewNote || undefined;
              await writeJson(PROPOSALS_PATH, propData);
              return sendJson(res, 200, { ok: true, proposal });
            }

            // approve: re-validate before writing to the single source of truth.
            const violations = checkWordPhonotactics(proposal.gkh.replace(/-/g, ""));
            if (violations.length > 0) {
              return sendJson(res, 200, { ok: false, error: "Cannot approve: this proposal no longer passes phonotactic validation.", violations });
            }
            const lex = await readJson(LEXICON_PATH);
            const otherActive = propData.proposals.filter((p: any) => p.status === "proposed" && p.id !== id);
            const conflicts = findConflicts({ gkh: proposal.gkh, en: proposal.en, nl: proposal.nl, pos: proposal.pos }, otherActive);
            const homographConflicts = conflicts.filter((c: any) => c.kind !== "same-gloss-different-spelling");
            if (homographConflicts.length > 0 && !body.force) {
              return sendJson(res, 200, { ok: false, error: "Cannot approve: unresolved homograph conflict.", conflicts: homographConflicts });
            }

            const newEntry = {
              id: nextLexiconId(lex.entries, proposal.domain),
              gkh: proposal.gkh,
              ipa: proposal.ipa,
              pos: proposal.pos,
              en: proposal.en,
              nl: proposal.nl,
              domain: proposal.domain,
              ...(proposal.root ? { root: proposal.root } : {}),
              ...(proposal.notes ? { notes: proposal.notes } : {}),
            };
            lex.entries.push(newEntry);
            lex.version = bumpPatch(lex.version);
            propData.proposals.splice(idx, 1); // approved proposals are removed; they now live in lexicon.json itself.
            await Promise.all([writeJson(LEXICON_PATH, lex), writeJson(PROPOSALS_PATH, propData)]);
            return sendJson(res, 200, { ok: true, entry: newEntry });
          }

          if (req.method === "POST" && req.url === "/api/lexicon/deprecate") {
            const body = await readBody(req);
            const id = String(body.id || "");
            const lex = await readJson(LEXICON_PATH);
            const idx = lex.entries.findIndex((e: any) => e.id === id);
            if (idx === -1) return sendJson(res, 404, { ok: false, error: "No such official entry." });
            const [official] = lex.entries.splice(idx, 1);
            lex.version = bumpPatch(lex.version);
            const propData = await readJson(PROPOSALS_PATH);
            propData.proposals.push({
              ...official,
              id: nextProposalId(propData.proposals),
              status: "deprecated",
              origin: "manual",
              submittedAt: new Date().toISOString(),
              reviewedAt: new Date().toISOString(),
              reviewNote: body.reviewNote || "Retired from official vocabulary; kept for history/compatibility.",
              originalLexiconId: official.id,
            });
            await Promise.all([writeJson(LEXICON_PATH, lex), writeJson(PROPOSALS_PATH, propData)]);
            return sendJson(res, 200, { ok: true });
          }

          return sendJson(res, 404, { ok: false, error: "Unknown /api/lexicon endpoint." });
        } catch (err: any) {
          return sendJson(res, 500, { ok: false, error: String(err?.message || err) });
        }
      });
    },
  };
}
