import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  assignStaffTicketOwner,
  claimStaffTicket,
  downloadTicketAttachment,
  getEligibleTicketOwners,
  getStaffTicketDetail,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
  type ApiValidationError,
  type AuthUser,
  type EligibleOwner,
  type Priority,
  type TicketAttachmentMetadata,
  type TicketDetail,
  type TicketStatus,
} from "./api.js";
import { TicketConversation } from "./TicketConversation.js";

const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  CANCELLED: [],
};

function labelStatus(status: TicketStatus): string { return status.replaceAll("_", " "); }
function formatDate(value: string | null | undefined): string { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not recorded"; }
function formatBytes(bytes: number): string { return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

function ConfirmDialog({ title, description, confirmLabel, busy, onConfirm, onCancel, children }: { title: string; description: string; confirmLabel: string; busy: boolean; onConfirm: () => void; onCancel: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"));
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); onCancel(); return; }
      if (event.key !== "Tab") return;
      const items = controls();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);
  return <div className="dialog-backdrop"><section ref={ref} className="remove-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-confirm-heading"><h2 id="staff-confirm-heading">{title}</h2><p>{description}</p>{children}<div className="form-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="button button-primary" disabled={busy} onClick={onConfirm}>{busy ? "Saving..." : confirmLabel}</button></div></section></div>;
}

function StaffAttachmentSection({ ticketId, attachments }: { ticketId: number; attachments: TicketAttachmentMetadata[] }) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function download(attachment: TicketAttachmentMetadata) {
    if (attachment.state !== "ACTIVE") return;
    setDownloadingId(attachment.id); setError(null);
    try {
      const blob = await downloadTicketAttachment(ticketId, attachment.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = attachment.originalName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to download Attachment."); }
    finally { setDownloadingId(null); }
  }
  return <section className="detail-card" aria-labelledby="staff-attachments-heading"><h2 id="staff-attachments-heading">Attachments</h2><p className="section-hint">Staff can download active Requester Attachments. Upload and removal remain Requester actions.</p>{error && <div className="alert alert-error" role="alert">{error}</div>}{attachments.length === 0 ? <p className="empty-detail">No Attachments.</p> : <ul className="attachment-metadata-list">{attachments.map((attachment) => <li key={attachment.id}><div><strong>{attachment.originalName}</strong><span className={`status-badge ${attachment.state === "REMOVED" ? "status-removed" : ""}`}>{attachment.state}</span><span>{attachment.mimeType}</span><span>{formatBytes(attachment.sizeBytes)}</span><span>Uploaded {formatDate(attachment.uploadedAt)}</span>{attachment.state === "REMOVED" && <><span>Removed {formatDate(attachment.removedAt)}</span>{attachment.removedReason && <span>Reason: {attachment.removedReason}</span>}</>}{attachment.state === "ACTIVE" && <span className="attachment-actions"><button type="button" className="button button-secondary" disabled={downloadingId === attachment.id} onClick={() => download(attachment)}>{downloadingId === attachment.id ? "Downloading..." : `Download ${attachment.originalName}`}</button></span>}</div></li>)}</ul>}</section>;
}

export function StaffTicketDetailScreen({ user, ticketId, onBack }: { user: AuthUser; ticketId: number; onBack: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "not-found" | "forbidden" | "error">("loading");
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [owners, setOwners] = useState<EligibleOwner[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ownerDraft, setOwnerDraft] = useState("");
  const [priorityDraft, setPriorityDraft] = useState<Priority>("MEDIUM");
  const [statusDraft, setStatusDraft] = useState<TicketStatus | "">("");
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<null | "claim" | "owner" | "priority" | "status">(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "conflict"; message: string; refreshInvalidOwner?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<null | "owner" | "status">(null);
  const [returnFocus, setReturnFocus] = useState<null | "owner" | "status">(null);
  const preserveDraftsOnRefresh = useRef(false);
  const ownerButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusButtonRef = useRef<HTMLButtonElement | null>(null);
  const resolutionRef = useRef<HTMLTextAreaElement | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const operationsHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (busyAction !== null || confirm !== null || returnFocus === null) return;
    operationsHeadingRef.current?.focus();
    setReturnFocus(null);
  }, [busyAction, confirm, returnFocus]);

  async function load(preserveDrafts = false) {
    setState("loading"); setLoadError(null);
    try {
      const [loadedDetail, loadedOwners] = await Promise.all([getStaffTicketDetail(ticketId), getEligibleTicketOwners()]);
      setDetail(loadedDetail); setOwners(loadedOwners); setState("ready");
      if (!preserveDrafts) {
        setOwnerDraft(loadedDetail.ticketOwner ? String(loadedDetail.ticketOwner.id) : "");
        setPriorityDraft((loadedDetail.itPriority ?? loadedDetail.requestedPriority) as Priority);
        setStatusDraft(""); setResolutionDraft(""); setReasonDraft(""); setFieldErrors({});
      }
    } catch (cause) {
      const error = cause as ApiValidationError;
      if (error.statusCode === 404) setState("not-found");
      else if (error.statusCode === 403) setState("forbidden");
      else setState("error");
      setLoadError(error.message || "Unable to load Staff Ticket Detail.");
    }
  }

  useEffect(() => { void load(preserveDraftsOnRefresh.current); preserveDraftsOnRefresh.current = false; }, [ticketId]);

  function applyAuthoritative(next: TicketDetail, message: string) {
    setDetail(next);
    setOwnerDraft(next.ticketOwner ? String(next.ticketOwner.id) : "");
    setPriorityDraft((next.itPriority ?? next.requestedPriority) as Priority);
    setStatusDraft(""); setResolutionDraft(""); setReasonDraft(""); setFieldErrors({});
    setFeedback({ kind: "success", message });
  }

  function handleMutationError(cause: unknown, fallback: string) {
    const error = cause as ApiValidationError;
    if (error.statusCode === 409) setFeedback({ kind: "conflict", message: "The Ticket changed while you were editing. Refresh the authoritative Ticket and review your retained draft before saving again." });
    else if (error.code === "ASSIGNEE_INVALID") setFeedback({ kind: "error", message: "The selected owner is no longer eligible. Refresh the Ticket and owner list before choosing again.", refreshInvalidOwner: true });
    else setFeedback({ kind: "error", message: error.message || fallback });
    if (error.fieldErrors) setFieldErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([key, messages]) => [key, messages[0] ?? "Invalid value."])));
  }

  async function refreshAfterConflict() {
    preserveDraftsOnRefresh.current = true;
    setFeedback(null);
    await load(true);
  }

  async function claim() {
    if (!detail || typeof detail.version !== "number") return;
    setBusyAction("claim"); setFeedback(null);
    try { applyAuthoritative(await claimStaffTicket(detail.id, detail.version), "Ticket claimed. Status was not changed."); }
    catch (cause) { handleMutationError(cause, "Unable to claim this Ticket."); }
    finally { setBusyAction(null); }
  }

  async function saveOwner() {
    if (!detail || typeof detail.version !== "number" || !ownerDraft) return;
    setBusyAction("owner"); setFeedback(null);
    try { applyAuthoritative(await assignStaffTicketOwner(detail.id, Number(ownerDraft), detail.version), detail.ticketOwner ? "Ticket owner reassigned." : "Ticket owner assigned."); setConfirm(null); setReturnFocus("owner"); }
    catch (cause) { setConfirm(null); setReturnFocus("owner"); handleMutationError(cause, "Unable to update the Ticket owner."); }
    finally { setBusyAction(null); }
  }

  async function savePriority() {
    if (!detail || typeof detail.version !== "number") return;
    setBusyAction("priority"); setFeedback(null);
    try { applyAuthoritative(await updateStaffTicketPriority(detail.id, priorityDraft, detail.version), "IT Priority updated. Requested Priority remains unchanged."); }
    catch (cause) { handleMutationError(cause, "Unable to update IT Priority."); }
    finally { setBusyAction(null); }
  }

  function validateStatusDraft(): boolean {
    const errors: Record<string, string> = {};
    if (!statusDraft) errors.currentStatus = "Choose a permitted next status.";
    if (statusDraft === "RESOLVED") {
      const trimmed = resolutionDraft.trim(); if (trimmed.length < 10 || trimmed.length > 2000) errors.resolutionSummary = "Resolution Summary must be 10 to 2,000 characters.";
    }
    if (statusDraft === "REOPENED" || statusDraft === "CANCELLED") {
      const trimmed = reasonDraft.trim(); if (trimmed.length < 5 || trimmed.length > 250) errors.reason = "Reason must be 5 to 250 characters.";
    }
    setFieldErrors(errors);
    if (errors.resolutionSummary) resolutionRef.current?.focus(); else if (errors.reason) reasonRef.current?.focus();
    return Object.keys(errors).length === 0;
  }

  async function saveStatus() {
    if (!detail || typeof detail.version !== "number" || !statusDraft || !validateStatusDraft()) return;
    setBusyAction("status"); setFeedback(null);
    const input = { currentStatus: statusDraft, expectedVersion: detail.version, ...(statusDraft === "RESOLVED" ? { resolutionSummary: resolutionDraft.trim() } : {}), ...((statusDraft === "REOPENED" || statusDraft === "CANCELLED") ? { reason: reasonDraft.trim() } : {}) };
    try { applyAuthoritative(await updateStaffTicketStatus(detail.id, input), `Status changed to ${labelStatus(statusDraft)}.`); setConfirm(null); setReturnFocus("status"); }
    catch (cause) { setConfirm(null); setReturnFocus("status"); handleMutationError(cause, "Unable to update Ticket status."); }
    finally { setBusyAction(null); }
  }

  const terminal = detail ? detail.currentStatus === "CLOSED" || detail.currentStatus === "CANCELLED" : false;
  const ownerChanged = detail ? ownerDraft !== (detail.ticketOwner ? String(detail.ticketOwner.id) : "") && ownerDraft !== "" : false;
  const priorityChanged = detail ? priorityDraft !== (detail.itPriority ?? detail.requestedPriority) : false;
  const allowedStatuses = detail ? NEXT_STATUSES[detail.currentStatus] : [];
  const currentOwnerEligible = detail?.ticketOwner && !owners.some((owner) => owner.id === detail.ticketOwner?.id) ? detail.ticketOwner : null;

  return <main className="shell-content detail-page staff-detail-page" aria-busy={state === "loading" || busyAction !== null}>
    <button type="button" className="back-button" onClick={onBack}>{"<- Back to Queue"}</button>
    {state === "loading" && <p className="loading-message" role="status">Loading Staff Ticket Detail...</p>}
    {state === "error" && <div className="alert alert-error" role="alert">{loadError}<button type="button" className="button button-secondary retry-button" onClick={() => load(false)}>Retry</button></div>}
    {state === "not-found" && <div className="alert alert-warning" role="alert">Ticket not found or unavailable.<button type="button" className="button button-secondary retry-button" onClick={() => load(false)}>Retry</button></div>}
    {state === "forbidden" && <div className="alert alert-error" role="alert">Forbidden. Your current role cannot access Staff Ticket Detail.</div>}
    {state === "ready" && detail && <>
      <div className="page-heading detail-heading"><div><p className="eyebrow">Shared IT workspace</p><h1>{detail.ticketNumber}</h1><p>Operational Ticket Detail - version {detail.version}</p></div><span className={`queue-badge queue-badge-${detail.currentStatus.toLowerCase().replaceAll("_", "-")}`}>{labelStatus(detail.currentStatus)}</span></div>
      {feedback && <div className={`alert ${feedback.kind === "success" ? "alert-success" : feedback.kind === "conflict" ? "alert-warning" : "alert-error"}`} role={feedback.kind === "success" ? "status" : "alert"}>{feedback.message}{feedback.kind === "conflict" && <button type="button" className="button button-secondary retry-button" onClick={refreshAfterConflict}>Refresh Ticket</button>}{feedback.refreshInvalidOwner && <button type="button" className="button button-secondary retry-button" onClick={() => load(false)}>Refresh owners and Ticket</button>}</div>}

      <section className="detail-card" aria-labelledby="staff-submitted-heading"><h2 id="staff-submitted-heading">Submitted Ticket Information</h2><p className="section-hint">Requester-submitted values are read-only.</p><dl className="detail-grid"><div><dt>Ticket Number</dt><dd>{detail.ticketNumber}</dd></div><div><dt>Ticket Date</dt><dd>{formatDate(detail.ticketDate)}</dd></div><div><dt>Requester</dt><dd>{detail.requester.name} ({detail.requester.email})</dd></div><div><dt>Category</dt><dd>{detail.category.name}</dd></div><div><dt>Related System</dt><dd>{detail.relatedSystem.name}</dd></div><div><dt>Requested Priority</dt><dd><span className={`queue-badge queue-badge-${detail.requestedPriority.toLowerCase()}`}>{detail.requestedPriority}</span></dd></div><div className="detail-wide"><dt>Summary</dt><dd>{detail.summary}</dd></div><div className="detail-wide"><dt>Description</dt><dd className="preserve-whitespace">{detail.description}</dd></div></dl></section>

      <section className="detail-card operational-card" aria-labelledby="staff-operations-heading"><h2 ref={operationsHeadingRef} tabIndex={-1} id="staff-operations-heading">Operational Controls</h2><p className="section-hint">Each save uses loaded version {detail.version}. Only one operational save can run at a time.</p>{terminal && <div className="alert alert-warning" role="status">{detail.currentStatus === "CLOSED" ? "Closed Tickets cannot be assigned or reprioritized. Reopen is the only permitted workflow action." : "Cancelled Tickets are terminal and cannot be assigned, reprioritized, or transitioned."}</div>}
        <div className="operational-grid">
          <fieldset><legend>Ticket Owner</legend><p>Current owner: <strong>{detail.ticketOwner?.name ?? "Unassigned"}</strong></p>{!terminal && <><label htmlFor="staff-owner">Eligible owner<select id="staff-owner" value={ownerDraft} disabled={busyAction !== null} onChange={(event) => { setOwnerDraft(event.target.value); setFieldErrors((current) => ({ ...current, ticketOwnerId: "" })); }}>{!detail.ticketOwner && <option value="">Select an eligible owner</option>}{currentOwnerEligible && <option value={currentOwnerEligible.id} disabled>{currentOwnerEligible.name} (no longer eligible)</option>}{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} - {owner.role.replaceAll("_", " ")}</option>)}</select></label>{fieldErrors.ticketOwnerId && <small className="field-error">{fieldErrors.ticketOwnerId}</small>}<div className="inline-actions">{!detail.ticketOwner && <button type="button" className="button button-secondary" disabled={busyAction !== null} onClick={claim}>{busyAction === "claim" ? "Claiming..." : "Claim Ticket"}</button>}<button ref={ownerButtonRef} type="button" className="button button-primary" disabled={busyAction !== null || !ownerChanged} onClick={() => setConfirm("owner")}>{detail.ticketOwner ? "Reassign Owner" : "Assign Owner"}</button></div></>}</fieldset>
          <fieldset><legend>IT Priority</legend><p>Requested Priority: <strong>{detail.requestedPriority}</strong></p><label htmlFor="staff-it-priority">IT Priority<select id="staff-it-priority" value={priorityDraft} disabled={busyAction !== null || terminal} onChange={(event) => setPriorityDraft(event.target.value as Priority)}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label><button type="button" className="button button-primary" disabled={busyAction !== null || terminal || !priorityChanged} onClick={savePriority}>{busyAction === "priority" ? "Saving..." : "Save IT Priority"}</button></fieldset>
          <fieldset className="status-fieldset"><legend>Status Workflow</legend><p>Current status: <strong>{labelStatus(detail.currentStatus)}</strong></p>{allowedStatuses.length === 0 ? <p>No further transitions are permitted.</p> : <><label htmlFor="staff-next-status">Next status<select id="staff-next-status" value={statusDraft} disabled={busyAction !== null} onChange={(event) => { setStatusDraft(event.target.value as TicketStatus | ""); setFieldErrors({}); }}><option value="">Choose next status</option>{allowedStatuses.map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select></label>{fieldErrors.currentStatus && <small className="field-error">{fieldErrors.currentStatus}</small>}{statusDraft === "RESOLVED" && <label htmlFor="staff-resolution-summary">Resolution Summary<textarea ref={resolutionRef} id="staff-resolution-summary" value={resolutionDraft} maxLength={2000} aria-invalid={Boolean(fieldErrors.resolutionSummary)} onChange={(event) => { setResolutionDraft(event.target.value); setFieldErrors((current) => ({ ...current, resolutionSummary: "" })); }} /><small>10-2,000 characters. Visible to the Requester.</small>{fieldErrors.resolutionSummary && <small className="field-error">{fieldErrors.resolutionSummary}</small>}</label>}{(statusDraft === "REOPENED" || statusDraft === "CANCELLED") && <label htmlFor="staff-status-reason">Reason<textarea ref={reasonRef} id="staff-status-reason" value={reasonDraft} maxLength={250} aria-invalid={Boolean(fieldErrors.reason)} onChange={(event) => { setReasonDraft(event.target.value); setFieldErrors((current) => ({ ...current, reason: "" })); }} /><small>5-250 characters. Visible to the Requester.</small>{fieldErrors.reason && <small className="field-error">{fieldErrors.reason}</small>}</label>}{statusDraft === "CLOSED" && <p>Existing Resolution Summary: <strong>{detail.resolutionSummary ?? "Unavailable"}</strong></p>}<button ref={statusButtonRef} type="button" className="button button-primary" disabled={busyAction !== null || !statusDraft} onClick={() => { if (validateStatusDraft()) setConfirm("status"); }}>Change Status</button></>}</fieldset>
        </div>
      </section>

      <section className="detail-card" aria-labelledby="staff-resolution-heading"><h2 id="staff-resolution-heading">Resolution and Requester Indication</h2><dl className="detail-grid"><div><dt>Requester indication</dt><dd>{detail.requesterResolvedAt ? `${formatDate(detail.requesterResolvedAt)} by ${detail.requesterResolvedBy?.name ?? "Requester"}` : "Not indicated"}</dd></div><div><dt>Resolved at</dt><dd>{formatDate(detail.resolvedAt)}</dd></div><div><dt>Closed at</dt><dd>{formatDate(detail.closedAt)}</dd></div>{detail.resolutionSummary && <div className="detail-wide"><dt>Resolution Summary</dt><dd className="preserve-whitespace">{detail.resolutionSummary}</dd></div>}{detail.lastStatusReason && <div className="detail-wide"><dt>Latest Status Reason</dt><dd className="preserve-whitespace">{detail.lastStatusReason}</dd></div>}</dl></section>

      <StaffAttachmentSection ticketId={detail.id} attachments={detail.attachments} />
      <TicketConversation ticketId={detail.id} kind="public" />
      <TicketConversation ticketId={detail.id} kind="internal" />

      {confirm === "owner" && <ConfirmDialog title={detail.ticketOwner ? "Reassign Ticket owner?" : "Assign Ticket owner?"} description={`This will ${detail.ticketOwner ? "reassign" : "assign"} ${detail.ticketNumber} to ${owners.find((owner) => String(owner.id) === ownerDraft)?.name ?? "the selected owner"}.`} confirmLabel={detail.ticketOwner ? "Confirm Reassignment" : "Confirm Assignment"} busy={busyAction === "owner"} onCancel={() => { setConfirm(null); setTimeout(() => ownerButtonRef.current?.focus(), 0); }} onConfirm={saveOwner} />}
      {confirm === "status" && statusDraft && <ConfirmDialog title={`Change status to ${labelStatus(statusDraft)}?`} description={`Confirm the workflow transition from ${labelStatus(detail.currentStatus)} to ${labelStatus(statusDraft)}.`} confirmLabel="Confirm Status Change" busy={busyAction === "status"} onCancel={() => { setConfirm(null); setTimeout(() => statusButtonRef.current?.focus(), 0); }} onConfirm={saveStatus}>{statusDraft === "RESOLVED" && <p><strong>Resolution Summary:</strong> {resolutionDraft.trim()}</p>}{(statusDraft === "REOPENED" || statusDraft === "CANCELLED") && <p><strong>Reason:</strong> {reasonDraft.trim()}</p>}</ConfirmDialog>}
    </>}
  </main>;
}
