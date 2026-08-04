import React from "react";
import { Lock } from "lucide-react";

// A locked specification is the thing production is judged against, so it reads as a document,
// not as another table: bronze rule down the side, version stamped in mono, critical rows marked.
export function SpecificationCard({ spec, compact = false }) {
  if (!spec) return null;
  const locked = spec.status === "locked";
  const superseded = spec.status === "superseded";
  return (
    <div className="n-card" style={{ borderLeft: `3px solid ${locked ? "var(--bronze)" : "var(--border-strong)"}`, opacity: superseded ? 0.6 : 1 }}>
      <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3"
        style={{ borderColor: "var(--border)", background: locked ? "var(--bronze-light)" : "var(--subtle)" }}>
        <div className="flex items-center gap-2">
          {locked && <Lock size={13} style={{ color: "var(--bronze)" }}/>}
          <span className="n-label" style={{ color: locked ? "var(--bronze)" : "var(--muted)" }}>
            Production specification
          </span>
          <span className="mono text-[11px]" style={{ color: "var(--ink)" }}>v{spec.version}</span>
        </div>
        <span className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {locked ? `Locked ${(spec.locked_at || "").slice(0, 10)}` : spec.status}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
            <th className="text-left px-5 py-3">Attribute</th>
            <th className="text-left px-5">Target</th>
            <th className="text-left px-5">Tolerance</th>
            <th className="text-right px-5">Critical</th>
          </tr></thead>
          <tbody>{(spec.rows || []).map((r, i) => (
            <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="px-5 py-2.5">{r.name.replace(/_/g, " ")}</td>
              <td className="px-5">{r.target || "—"}</td>
              <td className="px-5 mono text-[12px]">{r.tolerance || "—"}</td>
              <td className="text-right px-5">
                {r.critical
                  ? <span className="mono text-[10px] px-2 py-0.5" style={{ border: "1px solid var(--bronze)", color: "var(--bronze)" }}>CRITICAL</span>
                  : <span className="mono text-[10px]" style={{ color: "var(--muted)" }}>—</span>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {!compact && (
        <div className="px-5 py-3 border-t text-[12px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          {locked
            ? "Locked on buyer approval. Any change is a new version requiring buyer re-approval; inspection results are recorded against the version in force."
            : "Not binding until the buyer approves it."}
        </div>
      )}
    </div>
  );
}
