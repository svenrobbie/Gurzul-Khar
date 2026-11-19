import { useEffect, useState } from "react";
import type { LexiconEntry, ProposalEntry } from "@engine/data.js";

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/lexicon/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

/**
 * Local, single-owner "review" tool (Phase 2 brief §2). This talks to the
 * same dev-server-only /api/lexicon/* endpoints as Propose.tsx — there is no
 * authentication because there is no second user: whoever can run
 * `npm run dev` on this machine IS the reviewer. See BACKLOG.md §2 for what
 * this does and does not simulate, and why it cannot work on a static
 * deployed build.
 */
export default function Admin() {
  const [lex, setLex] = useState<{ entries: LexiconEntry[] } | null>(null);
  const [proposals, setProposals] = useState<ProposalEntry[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deprecateId, setDeprecateId] = useState("");

  async function refresh() {
    try {
      const data = await api<{ lexicon: { entries: LexiconEntry[] }; proposals: { proposals: ProposalEntry[] } }>("vocabulary");
      setLex(data.lexicon);
      setProposals(data.proposals.proposals);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setNotice(null);
    try {
      const data = await api<{ ok: boolean; error?: string }>("review", { id, action });
      setNotice(data.ok ? `${action === "approve" ? "Approved" : "Rejected"} ${id}.` : data.error ?? "Could not complete review.");
      await refresh();
    } catch {
      setOffline(true);
    } finally {
      setBusyId(null);
    }
  }

  async function deprecate() {
    if (!deprecateId) return;
    setBusyId(deprecateId);
    setNotice(null);
    try {
      const data = await api<{ ok: boolean; error?: string }>("deprecate", { id: deprecateId });
      setNotice(data.ok ? `Deprecated ${deprecateId}.` : data.error ?? "Could not deprecate.");
      setDeprecateId("");
      await refresh();
    } catch {
      setOffline(true);
    } finally {
      setBusyId(null);
    }
  }

  if (offline) {
    return (
      <div>
        <h1>Review pending proposals</h1>
        <div className="error-box">
          This admin tool talks to the local dev-server-only API at <code>/api/lexicon/*</code>. It is not reachable
          here — either the dev server isn't running (<code>npm run dev</code>), or this is the static production
          build, which has no backend at all. See BACKLOG.md §2.
        </div>
      </div>
    );
  }

  const pending = proposals?.filter((p) => p.status === "proposed") ?? [];
  const deprecated = proposals?.filter((p) => p.status === "deprecated") ?? [];
  const rejected = proposals?.filter((p) => p.status === "rejected") ?? [];

  return (
    <div>
      <h1>Review pending proposals</h1>
      <p className="notice">
        Approving moves a word out of <code>data/lexicon/proposals.json</code> and into{" "}
        <code>data/lexicon/lexicon.json</code> for real — it becomes official vocabulary on disk immediately, and the
        translator/dictionary will use it on their next data read (restart the dev server if you don't see it reflected
        right away — see BACKLOG.md §2 for exactly what "immediately available" means in this environment).
      </p>
      {notice && <p className="notice">{notice}</p>}

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Pending ({pending.length})</h2>
        {pending.length === 0 && <p>Nothing waiting for review.</p>}
        {pending.map((p) => (
          <div key={p.id} className="card" style={{ marginBottom: "0.5rem" }}>
            <p style={{ fontSize: "1.1rem" }}>
              <strong>{p.gkh}</strong> <span className="pill">/{p.ipa}/</span> <span className="pill">{p.pos}</span>{" "}
              <span className="pill">{p.origin}</span>
            </p>
            <p>
              EN: {p.en} &nbsp; NL: {p.nl} &nbsp; Domain: {p.domain}
            </p>
            {p.notes && <p className="notice">{p.notes}</p>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" disabled={busyId === p.id} onClick={() => review(p.id, "approve")}>
                Approve
              </button>
              <button type="button" className="secondary" disabled={busyId === p.id} onClick={() => review(p.id, "reject")}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Deprecate an official word</h2>
        <p className="notice">Moves a word OUT of lexicon.json and into proposals.json as "deprecated" — kept for history/compatibility, no longer active.</p>
        <select value={deprecateId} onChange={(e) => setDeprecateId(e.target.value)} style={{ minWidth: "16rem" }}>
          <option value="">Choose an official entry…</option>
          {lex?.entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.gkh} — {e.en} ({e.id})
            </option>
          ))}
        </select>
        <button type="button" onClick={deprecate} disabled={!deprecateId || busyId === deprecateId} style={{ marginLeft: "0.5rem" }}>
          Deprecate
        </button>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>History</h2>
        <p>
          <strong>Deprecated ({deprecated.length}):</strong>{" "}
          {deprecated.length ? deprecated.map((d) => `${d.gkh} (was "${d.en}")`).join(", ") : "none"}
        </p>
        <p style={{ marginTop: "0.5rem" }}>
          <strong>Rejected ({rejected.length}):</strong>{" "}
          {rejected.length ? rejected.map((d) => `${d.gkh} ("${d.en}")`).join(", ") : "none"}
        </p>
      </section>
    </div>
  );
}
