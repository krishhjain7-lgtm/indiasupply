// Status vocabulary. The backend owns it — RFQ_STATUS_FLOW in server.py is the single
// definition, served at /api/meta/rfq-statuses — so the dashboard cannot offer a transition
// the API will refuse. Fetched once per session and cached.
import api from "../lib/api";

let pending = null;

export function fetchStatusFlow() {
  if (!pending) {
    pending = api.get("/meta/rfq-statuses")
      .then(r => r.data)
      .catch(() => { pending = null; return { statuses: [], transitions: {} }; });
  }
  return pending;
}

// Presentation only: snake_case reads badly in a table.
export function statusLabel(s) {
  return (s || "—").replace(/_/g, " ");
}
