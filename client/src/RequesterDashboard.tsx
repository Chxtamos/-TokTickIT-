import { useEffect, useState } from "react";
import { getRequesterDashboard, type ApiValidationError, type RequesterDashboardResponse, type TicketListQuery } from "./api.js";

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const label = (value: string) => value.replaceAll("_", " ");

export function RequesterDashboardScreen({
  onFilterTickets,
  onOpenTicket,
}: {
  onFilterTickets: (filter: Partial<TicketListQuery>) => void;
  onOpenTicket: (ticketId: number) => void;
}) {
  const [data, setData] = useState<RequesterDashboardResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setData(null);
    setMessage(null);
    getRequesterDashboard().then((dashboard) => {
      if (cancelled) return;
      setData(dashboard);
      setState("ready");
    }).catch((cause) => {
      if (cancelled) return;
      const error = cause as ApiValidationError;
      setMessage(error.message || "Unable to load Requester Dashboard.");
      setState(error.statusCode === 403 ? "forbidden" : "error");
    });
    return () => { cancelled = true; };
  }, [retryToken]);

  return <main className="shell-content requester-dashboard-page" aria-busy={state === "loading"}>
    <p className="eyebrow">Requester workspace</p>
    <div className="page-heading"><div><h1>Requester Dashboard</h1><p>A concise summary of your own Ticket activity.</p></div></div>
    {state === "loading" && <p className="loading-message" role="status">Loading Requester Dashboard…</p>}
    {state === "forbidden" && <div className="alert alert-error" role="alert">This account cannot access the Requester Dashboard.</div>}
    {state === "error" && <div className="alert alert-error" role="alert">{message ?? "Unable to load Requester Dashboard."}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button></div>}
    {state === "ready" && data && <>
      <section className="dashboard-metrics" aria-label="Requester metrics">
        <button type="button" className="dashboard-metric-card" onClick={() => onFilterTickets({ state: "open", currentStatus: null })}><span>Open Tickets</span><strong className="dashboard-metric-value">{data.metrics.openTickets}</strong><small>Not Resolved, Closed or Cancelled</small></button>
        <button type="button" className="dashboard-metric-card" onClick={() => onFilterTickets({ state: null, currentStatus: "WAITING_FOR_REQUESTER" })}><span>Waiting for Requester</span><strong className="dashboard-metric-value">{data.metrics.waitingForRequester}</strong><small>Tickets waiting for your response</small></button>
      </section>
      {data.metrics.openTickets === 0 && data.metrics.waitingForRequester === 0 && data.recentlyUpdated.length === 0 && data.recentlyResolved.length === 0 && <div className="alert alert-success" role="status">No Ticket work needs your attention right now.</div>}
      <div className="dashboard-distributions">
        <section className="detail-card" aria-labelledby="requester-updated-heading"><h2 id="requester-updated-heading">Recently Updated</h2>{data.recentlyUpdated.length === 0 ? <p className="empty-detail">No recently updated Tickets.</p> : <div className="dashboard-list">{data.recentlyUpdated.map((ticket) => <article key={ticket.id} className="dashboard-list-item"><div><strong>{ticket.ticketNumber}</strong><p>{ticket.summary}</p><small>{label(ticket.currentStatus)} · Updated {formatDate(ticket.updatedAt)}</small></div><button type="button" className="button button-secondary" aria-label={`Open ${ticket.ticketNumber}`} onClick={() => onOpenTicket(ticket.id)}>Open Ticket</button></article>)}</div>}</section>
        <section className="detail-card" aria-labelledby="requester-resolved-heading"><h2 id="requester-resolved-heading">Recently Resolved</h2>{data.recentlyResolved.length === 0 ? <p className="empty-detail">No recently resolved Tickets.</p> : <div className="dashboard-list">{data.recentlyResolved.map((ticket) => <article key={ticket.id} className="dashboard-list-item"><div><strong>{ticket.ticketNumber}</strong><p>{ticket.summary}</p><small>{label(ticket.currentStatus)} · Updated {formatDate(ticket.updatedAt)}</small></div><button type="button" className="button button-secondary" aria-label={`Open ${ticket.ticketNumber}`} onClick={() => onOpenTicket(ticket.id)}>Open Ticket</button></article>)}</div>}</section>
      </div>
    </>}
  </main>;
}
