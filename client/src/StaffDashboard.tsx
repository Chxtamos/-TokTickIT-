import { useEffect, useState } from "react";
import { getStaffDashboard, type ApiValidationError, type Priority, type StaffDashboardResponse, type StaffQueueQuery, type TicketStatus } from "./api.js";

const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const label = (value: string) => value.replaceAll("_", " ");
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function StaffDashboardScreen({
  onFilterQueue,
  onOpenTicket,
}: {
  onFilterQueue: (filter: Partial<StaffQueueQuery>) => void;
  onOpenTicket: (ticketId: number) => void;
}) {
  const [data, setData] = useState<StaffDashboardResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setData(null);
    setMessage(null);
    getStaffDashboard()
      .then((dashboard) => {
        if (cancelled) return;
        setData(dashboard);
        setState("ready");
      })
      .catch((cause) => {
        if (cancelled) return;
        const error = cause as ApiValidationError;
        setMessage(error.message || "Unable to load Staff Dashboard.");
        setState(error.statusCode === 403 ? "forbidden" : "error");
      });
    return () => { cancelled = true; };
  }, [retryToken]);

  return <main className="shell-content staff-dashboard-page" aria-busy={state === "loading"}>
    <p className="eyebrow">Shared IT workspace</p>
    <div className="page-heading"><div><h1>IT Staff Dashboard</h1><p>Authoritative operational counts and the work that needs attention now.</p></div></div>

    {state === "loading" && <p className="loading-message" role="status">Loading Staff Dashboard…</p>}
    {state === "forbidden" && <div className="alert alert-error" role="alert"><strong>Forbidden.</strong> This account cannot access the Staff Dashboard.</div>}
    {state === "error" && <div className="alert alert-error" role="alert">{message ?? "Unable to load Staff Dashboard."}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button></div>}

    {state === "ready" && data && <>
      <section className="dashboard-metrics" aria-label="Operational metrics">
        <button type="button" className="dashboard-metric-card" onClick={() => onFilterQueue({ owner: "unassigned" })}><span>Unassigned Tickets</span><strong className="dashboard-metric-value">{data.metrics.unassignedTickets}</strong><small>Non-terminal Tickets with no owner</small></button>
        <button type="button" className="dashboard-metric-card" onClick={() => onFilterQueue({ owner: "mine" })}><span>My Tickets</span><strong className="dashboard-metric-value">{data.metrics.myTickets}</strong><small>My non-terminal owned Tickets</small></button>
        <a className="dashboard-metric-card" href="#my-open-actions"><span>My Open Actions</span><strong className="dashboard-metric-value">{data.metrics.myOpenActions}</strong><small>Assigned Pending or In Progress Actions</small></a>
      </section>

      {data.metrics.unassignedTickets === 0 && data.metrics.myTickets === 0 && data.metrics.myOpenActions === 0 && data.recentOrUrgent.length === 0 && data.myRecentActions.length === 0
        && <div className="alert alert-success" role="status">No active Ticket or Action work needs attention right now.</div>}

      <div className="dashboard-distributions">
        <section className="detail-card" aria-labelledby="dashboard-status-heading"><h2 id="dashboard-status-heading">Tickets by Status</h2><div className="dashboard-chip-grid">{statuses.map((status) => <button key={status} type="button" className="dashboard-chip" onClick={() => onFilterQueue({ currentStatus: status })}><span>{label(status)}</span><strong>{data.byStatus[status]}</strong></button>)}</div></section>
        <section className="detail-card" aria-labelledby="dashboard-priority-heading"><h2 id="dashboard-priority-heading">Active Tickets by IT Priority</h2><div className="dashboard-chip-grid">{priorities.map((priority) => <button key={priority} type="button" className="dashboard-chip" onClick={() => onFilterQueue({ itPriority: priority })}><span>{priority}</span><strong>{data.byItPriority[priority]}</strong></button>)}</div></section>
      </div>

      <section className="detail-card" aria-labelledby="dashboard-recent-heading"><h2 id="dashboard-recent-heading">Recent or Urgent Tickets</h2><p className="section-hint">Up to 10 active Tickets; URGENT first, then most recently updated.</p>{data.recentOrUrgent.length === 0 ? <p className="empty-detail">No active Tickets.</p> : <div className="dashboard-list">{data.recentOrUrgent.map((ticket) => <article key={ticket.id} className="dashboard-list-item"><div><strong>{ticket.ticketNumber}</strong><p>{ticket.summary}</p><small>{label(ticket.currentStatus)} · {ticket.itPriority} · Updated {formatDate(ticket.updatedAt)}</small></div><button type="button" className="button button-secondary" onClick={() => onOpenTicket(ticket.id)}>Open Ticket</button></article>)}</div>}</section>

      <section id="my-open-actions" className="detail-card" aria-labelledby="dashboard-open-actions-heading"><h2 id="dashboard-open-actions-heading">My Open Actions</h2><p className="section-hint">Assigned to you and currently Pending or In Progress. Up to 10 most recently updated Actions are shown.</p>{data.myOpenActionItems.length === 0 ? <p className="empty-detail">No open Actions assigned to you.</p> : <div className="dashboard-list">{data.myOpenActionItems.map((action) => <article key={action.id} className="dashboard-list-item"><div><strong>{action.description}</strong><p>{label(action.status)} · Ticket #{action.ticketId}</p><small>Updated {formatDate(action.updatedAt)}</small></div><button type="button" className="button button-secondary" onClick={() => onOpenTicket(action.ticketId)}>Open Ticket</button></article>)}</div>}</section>

      <section id="my-actions" className="detail-card" aria-labelledby="dashboard-actions-heading"><h2 id="dashboard-actions-heading">My Recent Actions</h2><p className="section-hint">Up to 5 Actions performed by or assigned to you.</p>{data.myRecentActions.length === 0 ? <p className="empty-detail">No recent Actions.</p> : <div className="dashboard-list">{data.myRecentActions.map((action) => <article key={action.id} className="dashboard-list-item"><div><strong>{action.description}</strong><p>{label(action.status)} · Ticket #{action.ticketId}</p><small>Updated {formatDate(action.updatedAt)}</small></div><button type="button" className="button button-secondary" onClick={() => onOpenTicket(action.ticketId)}>Open Ticket</button></article>)}</div>}</section>
    </>}
  </main>;
}
