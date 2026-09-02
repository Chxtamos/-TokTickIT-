import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createTicket, CreatedTicket, DevelopmentRequester, downloadTicketAttachment, getCategories, getDevelopmentRequesters, getRelatedSystems, getTicketDetail, getTickets, ReferenceItem, removeTicketAttachment, TicketAttachmentMetadata, TicketDetail, TicketListQuery, TicketListResponse, TicketSummary, uploadTicketAttachment } from "./api.js";
import "./App.css";

const REQUESTER_STORAGE_KEY = "toktickit.requesterId";
type RequesterLoadState = "loading" | "ready" | "empty" | "error";

function createClientRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function RequesterSelector({
  requesters,
  state,
  selectedId,
  onSelect,
  onContinue,
  onRetry,
  validating,
  selectionError,
}: {
  requesters: DevelopmentRequester[];
  state: RequesterLoadState;
  selectedId: string;
  onSelect: (value: string) => void;
  onContinue: () => void;
  onRetry: () => void;
  validating: boolean;
  selectionError: string | null;
}) {
  return (
    <main className="selector-page" aria-busy={state === "loading" || validating}>
      <section className="selector-card" aria-labelledby="requester-title">
        <p className="eyebrow">TokTickIT · Lab 2</p>
        <h1 id="requester-title">Select a Development Requester</h1>
        <p className="intro">Choose a seeded requester for this Lab 2 test session. This is temporary testing context, not login or authentication.</p>
        {state === "loading" && <p className="loading-message" role="status">Loading Requesters…</p>}
        {state === "error" && (
          <div className="alert alert-error" role="alert">
            Unable to load Development Requesters. Please try again.
            <button className="button button-secondary retry-button" onClick={onRetry}>Retry</button>
          </div>
        )}
        {state === "empty" && (
          <div className="alert alert-warning" role="status">
            No active Development Requesters are available.
            <button className="button button-secondary retry-button" onClick={onRetry}>Retry</button>
          </div>
        )}
        {state === "ready" && (
          <>
            <label htmlFor="requester-select">Development Requester</label>
            <select id="requester-select" value={selectedId} onChange={(event) => onSelect(event.target.value)} disabled={validating}>
              <option value="">Select a requester…</option>
              {requesters.map((requester) => <option key={requester.id} value={requester.id}>{requester.name}</option>)}
            </select>
            <button className="button button-primary continue-button" onClick={onContinue} disabled={!selectedId || validating}>
              {validating ? "Validating…" : "Continue"}
            </button>
          </>
        )}
        {selectionError && <div className="alert alert-error" role="alert">{selectionError}</div>}
      </section>
    </main>
  );
}

type CreateScreenProps = { requester: DevelopmentRequester; onBack: () => void };
type AttachmentStatus = "pending" | "invalid" | "uploading" | "uploaded" | "failed";
type SelectedFile = { id: string; file: File; status: AttachmentStatus; error?: string; message?: string };
const EMPTY_TICKET_FORM = { categoryId: "", relatedSystemId: "", requestedPriority: "MEDIUM", summary: "", description: "" };

function CreateTicketScreen({ requester, onBack }: CreateScreenProps) {
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<ReferenceItem[]>([]);
  const [referenceState, setReferenceState] = useState<"loading" | "ready" | "error">("loading");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceRetryToken, setReferenceRetryToken] = useState(0);
  const [form, setForm] = useState(EMPTY_TICKET_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [ticket, setTicket] = useState<CreatedTicket | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState(() => createClientRequestId());
  const fileId = useRef(0);

  useEffect(() => {
    setReferenceState("loading");
    setReferenceError(null);
    Promise.all([getCategories(), getRelatedSystems()])
      .then(([loadedCategories, loadedSystems]) => { setCategories(loadedCategories); setRelatedSystems(loadedSystems); setReferenceState("ready"); })
      .catch(() => { setCategories([]); setRelatedSystems([]); setReferenceState("error"); setReferenceError("Unable to load Ticket reference data. Please try again."); });
  }, [referenceRetryToken]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setFiles((current) => {
      let validCount = current.filter((item) => item.status !== "invalid").length;
      const additions = selected.map((file) => {
        const extension = file.name.toLowerCase().split(".").pop();
        const expectedMime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : extension === "pdf" ? "application/pdf" : null;
        let error: string | undefined;
        if (!expectedMime) error = "Unsupported file type.";
        else if (file.type !== expectedMime) error = `MIME type must be ${expectedMime}.`;
        else if (file.size > 5_242_880) error = "File exceeds 5 MiB.";
        else if (validCount >= 5) error = "Maximum five valid files can be uploaded.";
        else validCount += 1;
        return { id: `${file.name}-${file.lastModified}-${fileId.current++}`, file, status: error ? "invalid" as const : "pending" as const, error };
      });
      return [...current, ...additions];
    });
    event.target.value = "";
  }

  function removeSelectedFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function startNewTicket() {
    setForm(EMPTY_TICKET_FORM);
    setFieldErrors({});
    setFiles([]);
    setTicket(null);
    setSubmitError(null);
    setSubmitState("idle");
    setClientRequestId(createClientRequestId());
  }

  function validateForm() {
    const errors: Record<string, string> = {};
    if (!form.categoryId) errors.categoryId = "Category is required.";
    if (!form.relatedSystemId) errors.relatedSystemId = "Related System is required.";
    if (form.summary.trim().length < 5 || form.summary.trim().length > 120) errors.summary = "Summary must contain 5 to 120 characters.";
    if (form.description.trim().length < 10 || form.description.trim().length > 5000) errors.description = "Description must contain 10 to 5,000 characters.";
    setFieldErrors(errors);
    const firstInvalid = ["categoryId", "relatedSystemId", "summary", "description"].find((field) => errors[field]);
    if (firstInvalid) window.setTimeout(() => document.getElementById(firstInvalid)?.focus(), 0);
    return Object.keys(errors).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validateForm()) return;
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      const created = await createTicket(requester.id, {
        clientRequestId,
        categoryId: Number(form.categoryId),
        relatedSystemId: Number(form.relatedSystemId),
        requestedPriority: form.requestedPriority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        summary: form.summary.trim(),
        description: form.description.trim(),
      });
      setTicket(created.ticket);
      setSubmitState("success");
      await Promise.all(files.filter((item) => item.status !== "invalid").map((item) => uploadAttachment(item, created.ticket.id)));
    } catch (error) {
      setSubmitState("error");
      const apiError = error as { message?: string; fieldErrors?: Record<string, string[]> };
      setSubmitError(apiError.message ?? "Unable to create Ticket. Please try again.");
      if (apiError.fieldErrors) setFieldErrors(Object.fromEntries(Object.entries(apiError.fieldErrors).map(([key, messages]) => [key, messages[0]])));
    }
  }

  async function uploadAttachment(selected: SelectedFile, ticketId: number) {
    setFiles((current) => current.map((item) => item.id === selected.id ? { ...item, status: "uploading", message: undefined } : item));
    try {
      await uploadTicketAttachment(requester.id, ticketId, selected.file);
      setFiles((current) => current.map((item) => item.id === selected.id ? { ...item, status: "uploaded", message: undefined } : item));
    } catch (error) {
      setFiles((current) => current.map((item) => item.id === selected.id ? { ...item, status: "failed", message: error instanceof Error ? error.message : "Upload failed." } : item));
    }
  }

  async function retryAttachment(id: string) {
    if (!ticket) return;
    const selected = files.find((item) => item.id === id);
    if (selected?.status === "failed") await uploadAttachment(selected, ticket.id);
  }

  if (submitState === "success" && ticket) return (
    <main className="shell-content" id="create-ticket">
      <div className="alert alert-success" role="status"><h1>Ticket created</h1><p>Official Ticket Number: <strong>{ticket.ticketNumber}</strong></p></div>
      {files.length > 0 && <section className="context-card"><h2>Attachment results</h2><ul>{files.map((selected) => <li key={selected.id}>{selected.file.name}: {selected.status === "uploaded" ? "Uploaded" : selected.status === "invalid" ? selected.error : selected.status === "uploading" ? "Uploading…" : selected.message}{selected.status === "failed" && <button className="button button-secondary file-retry" type="button" onClick={() => retryAttachment(selected.id)}>Retry</button>}</li>)}</ul></section>}
      <div className="form-actions"><button className="button button-secondary" onClick={onBack}>Back to workspace</button><button className="button button-primary" onClick={startNewTicket}>Create another Ticket</button></div>
    </main>
  );

  return (
    <main className="shell-content" id="create-ticket">
      <button className="back-button" onClick={onBack}>← Back to workspace</button>
      <p className="eyebrow">Requester workspace</p>
      <h1>Create Ticket</h1>
      <p className="intro">Describe your IT request. Fields marked <span aria-hidden="true">*</span> are required.</p>
      {referenceState === "loading" && <div className="alert" role="status">Loading Ticket reference data…</div>}
      {referenceError && <div className="alert alert-error" role="alert">{referenceError}<button className="button button-secondary retry-button" type="button" onClick={() => setReferenceRetryToken((token) => token + 1)}>Retry</button></div>}
      {submitError && <div className="alert alert-error" role="alert">{submitError}<button className="button button-secondary retry-button" type="button" onClick={() => { setSubmitError(null); setSubmitState("idle"); }}>Retry</button></div>}
      <form className="ticket-form" onSubmit={submit} noValidate aria-busy={referenceState === "loading" || submitState === "submitting"}>
        <div className="readonly-grid"><label>Ticket Number<input value="Generated after submission" readOnly /></label><label>Ticket Date<input value="Recorded after submission" readOnly /></label><label>Requester<input value={requester.name} readOnly /></label></div>
        <div className="form-grid">
          <label htmlFor="category-id">Category <span aria-hidden="true">*</span><select id="category-id" value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)} disabled={referenceState !== "ready" || submitState === "submitting"} aria-invalid={Boolean(fieldErrors.categoryId)} aria-describedby={fieldErrors.categoryId ? "category-error" : undefined} required><option value="">Select Category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.categoryId && <small id="category-error" className="field-error">{fieldErrors.categoryId}</small>}</label>
          <label htmlFor="related-system-id">Related System <span aria-hidden="true">*</span><select id="related-system-id" value={form.relatedSystemId} onChange={(event) => updateField("relatedSystemId", event.target.value)} disabled={referenceState !== "ready" || submitState === "submitting"} aria-invalid={Boolean(fieldErrors.relatedSystemId)} aria-describedby={fieldErrors.relatedSystemId ? "related-system-error" : undefined} required><option value="">Select Related System</option>{relatedSystems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.relatedSystemId && <small id="related-system-error" className="field-error">{fieldErrors.relatedSystemId}</small>}</label>
          <label htmlFor="requested-priority">Requested Priority <select id="requested-priority" value={form.requestedPriority} onChange={(event) => updateField("requestedPriority", event.target.value)} disabled={submitState === "submitting"}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
        </div>
        <label htmlFor="summary">Summary <span aria-hidden="true">*</span><input id="summary" value={form.summary} maxLength={120} onChange={(event) => updateField("summary", event.target.value)} disabled={submitState === "submitting"} aria-invalid={Boolean(fieldErrors.summary)} aria-describedby={fieldErrors.summary ? "summary-error summary-count" : "summary-count"} required />{fieldErrors.summary && <small id="summary-error" className="field-error">{fieldErrors.summary}</small>}<small id="summary-count">{form.summary.length}/120</small></label>
        <label htmlFor="description">Description <span aria-hidden="true">*</span><textarea id="description" value={form.description} maxLength={5000} onChange={(event) => updateField("description", event.target.value)} disabled={submitState === "submitting"} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "description-error description-count" : "description-count"} required />{fieldErrors.description && <small id="description-error" className="field-error">{fieldErrors.description}</small>}<small id="description-count">{form.description.length}/5000</small></label>
        <label htmlFor="attachments">Attachments<input id="attachments" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={selectFiles} disabled={submitState === "submitting"} /><small>JPG, JPEG, PNG, WEBP, or PDF; maximum 5 MiB each; maximum 5 files</small></label>
        {files.length > 0 && <ul className="file-list">{files.map(({ id, file, error }, index) => <li key={id}>{file.name} ({Math.ceil(file.size / 1024)} KiB){error && <span className="field-error"> — {error}</span>}<button type="button" className="file-remove" onClick={() => removeSelectedFile(index)} disabled={submitState === "submitting"}>Remove</button></li>)}</ul>}
        <div className="form-actions"><button type="button" className="button button-secondary" onClick={onBack} disabled={submitState === "submitting"}>Cancel</button><button type="submit" className="button button-primary submit-button" disabled={referenceState !== "ready" || submitState === "submitting"}>{submitState === "submitting" ? "Submitting…" : "Submit Ticket"}</button></div>
      </form>
    </main>
  );
}

const DEFAULT_TICKET_QUERY: TicketListQuery = { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc", page: 1, pageSize: 10 };

function MyTicketsScreen({ requester, onCreate, onViewTicket, initialQuery, onQueryChange }: { requester: DevelopmentRequester; onCreate: () => void; onViewTicket: (ticketId: number) => void; initialQuery: TicketListQuery; onQueryChange: (query: TicketListQuery) => void }) {
  const [query, setQueryState] = useState(initialQuery);
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<ReferenceItem[]>([]);
  const [data, setData] = useState<TicketListResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setData(null);
    setError(null);
    Promise.all([getCategories(), getRelatedSystems(), getTickets(requester.id, query)])
      .then(([loadedCategories, loadedSystems, loadedTickets]) => {
        if (cancelled) return;
        setCategories(loadedCategories);
        setRelatedSystems(loadedSystems);
        setData(loadedTickets);
        setState("ready");
      })
      .catch((cause) => {
        if (!cancelled) { setState("error"); setError(cause instanceof Error ? cause.message : "Unable to load Tickets. Please try again."); }
      });
    return () => { cancelled = true; };
  }, [requester.id, query, retryToken]);

  const applyQuery = (next: TicketListQuery) => { setQueryState(next); onQueryChange(next); };
  const updateQuery = (change: Partial<TicketListQuery>) => applyQuery({ ...query, ...change, page: 1 });
  const clearFilters = () => applyQuery(DEFAULT_TICKET_QUERY);
  const hasFilters = query.search !== "" || query.categoryId !== null || query.relatedSystemId !== null || query.requestedPriority !== null || query.currentStatus !== null || query.sortBy !== "updatedAt" || query.sortDirection !== "desc" || query.pageSize !== 10;
  const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const sortAria = (field: TicketListQuery["sortBy"]): "ascending" | "descending" | "none" => query.sortBy === field ? (query.sortDirection === "asc" ? "ascending" : "descending") : "none";
  const renderTicket = (ticket: TicketSummary) => <tr key={ticket.id}><td><strong>{ticket.ticketNumber}</strong></td><td>{ticket.summary}</td><td>{ticket.category.name}</td><td>{ticket.relatedSystem.name}</td><td>{ticket.requestedPriority}</td><td>{ticket.currentStatus}</td><td>{formatDate(ticket.updatedAt)}</td><td><button type="button" className="button button-secondary" onClick={() => onViewTicket(ticket.id)}>View Ticket</button></td></tr>;
  const renderTicketCard = (ticket: TicketSummary) => <article className="ticket-card" key={ticket.id}><h2>{ticket.ticketNumber}</h2><dl><div><dt>Summary</dt><dd>{ticket.summary}</dd></div><div><dt>Category</dt><dd>{ticket.category.name}</dd></div><div><dt>Related System</dt><dd>{ticket.relatedSystem.name}</dd></div><div><dt>Requested Priority</dt><dd>{ticket.requestedPriority}</dd></div><div><dt>Current Status</dt><dd>{ticket.currentStatus}</dd></div><div><dt>Last Updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></div></dl><button type="button" className="button button-secondary" onClick={() => onViewTicket(ticket.id)}>View Ticket</button></article>;

  return (
    <main className="shell-content tickets-page" id="my-tickets" aria-busy={state === "loading"}>
      <p className="eyebrow">Requester workspace</p>
      <div className="page-heading"><div><h1>My Tickets</h1><p>Tickets created by {requester.name}.</p></div><button className="button button-primary" type="button" onClick={onCreate}>Create Ticket</button></div>
      <form className="ticket-filters" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="ticket-search">Search<input id="ticket-search" value={query.search} maxLength={120} placeholder="Ticket number or summary" onChange={(event) => updateQuery({ search: event.target.value })} /></label>
        <label htmlFor="ticket-category">Category<select id="ticket-category" value={query.categoryId ?? ""} onChange={(event) => updateQuery({ categoryId: event.target.value ? Number(event.target.value) : null })}><option value="">All Categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label htmlFor="ticket-system">Related System<select id="ticket-system" value={query.relatedSystemId ?? ""} onChange={(event) => updateQuery({ relatedSystemId: event.target.value ? Number(event.target.value) : null })}><option value="">All Systems</option>{relatedSystems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label htmlFor="ticket-priority">Requested Priority<select id="ticket-priority" value={query.requestedPriority ?? ""} onChange={(event) => updateQuery({ requestedPriority: (event.target.value || null) as TicketListQuery["requestedPriority"] })}><option value="">All Priorities</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        <label htmlFor="ticket-status">Current Status<select id="ticket-status" value={query.currentStatus ?? ""} onChange={(event) => updateQuery({ currentStatus: event.target.value || null })}><option value="">All Statuses</option><option>NEW</option></select></label>
        <label htmlFor="ticket-sort">Sort by<select id="ticket-sort" value={query.sortBy} onChange={(event) => updateQuery({ sortBy: event.target.value as TicketListQuery["sortBy"] })}><option value="updatedAt">Last updated</option><option value="createdAt">Created date</option><option value="ticketNumber">Ticket number</option></select></label>
        <label htmlFor="ticket-direction">Direction<select id="ticket-direction" value={query.sortDirection} onChange={(event) => updateQuery({ sortDirection: event.target.value as TicketListQuery["sortDirection"] })}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></label>
        <label htmlFor="ticket-page-size">Page size<select id="ticket-page-size" value={query.pageSize} onChange={(event) => updateQuery({ pageSize: Number(event.target.value) as TicketListQuery["pageSize"] })}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
        {hasFilters && <button type="button" className="button button-secondary clear-filters" onClick={clearFilters}>Clear Filters</button>}
      </form>
      {state === "loading" && <p className="loading-message" role="status">Loading Tickets…</p>}
      {state === "error" && <div className="alert alert-error" role="alert">{error ?? "Unable to load Tickets. Please try again."}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((token) => token + 1)}>Retry</button>{hasFilters && <button type="button" className="button button-secondary retry-button" onClick={clearFilters}>Reset filters</button>}</div>}
      {state === "ready" && data && data.items.length === 0 && data.pagination.totalItems === 0 && <div className="alert alert-warning" role="status">You have not created any tickets yet.<button type="button" className="button button-primary" onClick={onCreate}>Create Ticket</button></div>}
      {state === "ready" && data && data.items.length === 0 && data.pagination.totalItems > 0 && <div className="alert alert-warning" role="status">No tickets match the current search or filters.<button type="button" className="button button-secondary" onClick={clearFilters}>Clear Filters</button></div>}
      {state === "ready" && data && data.items.length > 0 && <>
        <p className="result-count" role="status">Showing {data.items.length} of {data.pagination.totalItems} Tickets</p>
        <div className="tickets-table-wrap"><table className="tickets-table"><caption className="visually-hidden">Tickets created by {requester.name}. Sorted by {query.sortBy}, {query.sortDirection === "asc" ? "ascending" : "descending"}.</caption><thead><tr><th scope="col" aria-sort={sortAria("ticketNumber")}>Ticket Number</th><th scope="col">Summary</th><th scope="col">Category</th><th scope="col">Related System</th><th scope="col">Requested Priority</th><th scope="col">Current Status</th><th scope="col" aria-sort={query.sortBy === "createdAt" ? sortAria("createdAt") : sortAria("updatedAt")}>Last Updated</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{data.items.map(renderTicket)}</tbody></table></div>
        <div className="tickets-cards" aria-label={`Tickets created by ${requester.name}`}>{data.items.map(renderTicketCard)}</div>
        <nav className="pagination" aria-label="Ticket pagination"><button type="button" className="button button-secondary" disabled={!data.pagination.hasPreviousPage} onClick={() => applyQuery({ ...query, page: query.page - 1 })}>Previous</button><span>Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)}</span><button type="button" className="button button-secondary" disabled={!data.pagination.hasNextPage} onClick={() => applyQuery({ ...query, page: query.page + 1 })}>Next</button></nav>
      </>}
    </main>
  );
}

type PendingAttachment = { id: string; file: File; status: "queued" | "uploading" | "error"; error: string | null; canUpload: boolean };

const attachmentRules: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" };

function attachmentQueueId(file: File): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`;
}

function validateAttachmentFile(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!attachmentRules[extension]) return "Unsupported file type. Use JPG, JPEG, PNG, WEBP, or PDF.";
  if (file.type !== attachmentRules[extension]) return "File extension and MIME type do not match.";
  if (file.size > 5 * 1024 * 1024) return "File exceeds the 5 MiB limit.";
  return null;
}

function formatAttachmentError(cause: unknown, fallback: string): string {
  const statusCode = typeof cause === "object" && cause !== null && "statusCode" in cause ? cause.statusCode : undefined;
  if (statusCode === 409) return "Maximum 5 active Attachments reached.";
  if (statusCode === 413) return "File exceeds the 5 MiB limit.";
  if (statusCode === 415) return "Unsupported Attachment type.";
  if (statusCode === 500) return "File temporarily unavailable.";
  return cause instanceof Error ? cause.message : fallback;
}

function AttachmentSection({ requesterId, ticketId, attachments, onRefresh }: { requesterId: number; ticketId: number; attachments: TicketAttachmentMetadata[]; onRefresh: () => void }) {
  const [queue, setQueue] = useState<PendingAttachment[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TicketAttachmentMetadata | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const activeCount = attachments.filter((attachment) => attachment.state === "ACTIVE").length;

  const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    let reserved = activeCount + queue.filter((item) => item.canUpload).length;
    const next = selected.map((file): PendingAttachment => {
      const duplicate = queue.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified) || attachments.some((item) => item.state === "ACTIVE" && item.originalName === file.name);
      const validationError = duplicate ? "This file is already selected." : validateAttachmentFile(file);
      const quotaError = !validationError && reserved >= 5 ? "Maximum 5 active Attachments reached." : null;
      if (!validationError && !quotaError) reserved += 1;
      const error = validationError ?? quotaError;
      return { id: attachmentQueueId(file), file, status: error ? "error" as const : "queued" as const, error, canUpload: !error };
    });
    setQueue((current) => [...current, ...next]);
  };

  const removeQueued = (id: string) => setQueue((current) => current.filter((item) => item.id !== id));

  const upload = async (item: PendingAttachment) => {
    if (!item.canUpload || item.status === "uploading") return;
    setActionError(null);
    setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "uploading", error: null } : entry));
    try {
      await uploadTicketAttachment(requesterId, ticketId, item.file);
      setQueue((current) => current.filter((entry) => entry.id !== item.id));
      onRefresh();
    } catch (cause) {
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "error", error: formatAttachmentError(cause, "Unable to upload Attachment.") } : entry));
    }
  };

  const download = async (attachment: TicketAttachmentMetadata) => {
    setActionError(null);
    setDownloadingId(attachment.id);
    try {
      const blob = await downloadTicketAttachment(requesterId, ticketId, attachment.id);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = attachment.originalName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (cause) {
      setActionError(formatAttachmentError(cause, "Unable to download Attachment."));
    } finally {
      setDownloadingId(null);
    }
  };

  const openRemove = (attachment: TicketAttachmentMetadata) => { setRemoveTarget(attachment); setRemoveReason(""); setRemoveError(null); setActionError(null); };
  const closeRemove = () => { if (removingId === null) { setRemoveTarget(null); setRemoveReason(""); setRemoveError(null); } };
  const confirmRemove = async () => {
    if (!removeTarget) return;
    const trimmed = removeReason.trim();
    if (trimmed.length < 5 || trimmed.length > 250) { setRemoveError("Reason must be between 5 and 250 characters."); return; }
    setRemovingId(removeTarget.id);
    setRemoveError(null);
    try {
      await removeTicketAttachment(requesterId, ticketId, removeTarget.id, trimmed);
      setRemoveTarget(null);
      setRemoveReason("");
      onRefresh();
    } catch (cause) {
      setActionError(formatAttachmentError(cause, "Unable to remove Attachment."));
    } finally {
      setRemovingId(null);
    }
  };

  return <section className="detail-card attachment-section" aria-labelledby="attachment-heading">
    <h2 id="attachment-heading">Attachments</h2>
    {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
    <label htmlFor="detail-attachments">Add Attachment<input id="detail-attachments" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" multiple onChange={selectFiles} /><small>JPG, JPEG, PNG, WEBP, or PDF; maximum 5 MiB each; maximum 5 active files</small></label>
    {queue.length > 0 && <ul className="attachment-queue" aria-label="Pending Attachments">{queue.map((item) => <li key={item.id}><strong>{item.file.name}</strong><span>{formatSize(item.file.size)}</span>{item.status === "uploading" && <span role="status">Uploading…</span>}{item.error && <span className="field-error">{item.error}</span>}<span className="attachment-actions">{item.canUpload && item.status !== "uploading" && <button type="button" className="button button-secondary" onClick={() => upload(item)}>{item.status === "error" ? "Retry" : "Upload"}</button>}<button type="button" className="file-remove" onClick={() => removeQueued(item.id)} disabled={item.status === "uploading"}>Remove</button></span></li>)}</ul>}
    {attachments.length === 0 ? <p className="empty-detail">No Attachments on this Ticket.</p> : <ul className="attachment-metadata-list">{attachments.map((attachment) => <li key={attachment.id}><div><strong>{attachment.originalName}</strong><span>{attachment.mimeType} · {formatSize(attachment.sizeBytes)}</span><span>Uploaded {formatDate(attachment.uploadedAt)}</span>{attachment.state === "REMOVED" ? <><span className="status-badge status-removed">Removed · {attachment.removedReason ?? "No reason provided"}</span>{attachment.removedAt && <span>Removed at {formatDate(attachment.removedAt)}</span>}</> : <><span className="status-badge">Active</span><span className="attachment-actions"><button type="button" className="button button-secondary" onClick={() => download(attachment)} disabled={downloadingId === attachment.id}>{downloadingId === attachment.id ? "Downloading…" : "Download"}</button><button type="button" className="button button-secondary" onClick={() => openRemove(attachment)}>Remove</button></span></>}</div></li>)}</ul>}
    {removeTarget && <div className="dialog-backdrop"><section className="remove-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-dialog-heading"><h2 id="remove-dialog-heading">Remove {removeTarget.originalName}?</h2><p>This will hide the file while retaining its metadata.</p><label htmlFor="remove-reason">Reason<textarea id="remove-reason" value={removeReason} minLength={5} maxLength={250} autoFocus onChange={(event) => setRemoveReason(event.target.value)} aria-invalid={removeError ? "true" : "false"} /></label>{removeError && <p className="field-error" role="alert">{removeError}</p>}<div className="form-actions"><button type="button" className="button button-secondary" onClick={closeRemove} disabled={removingId !== null}>Cancel</button><button type="button" className="button button-primary remove-confirm" onClick={confirmRemove} disabled={removingId !== null}>{removingId !== null ? "Removing…" : "Confirm removal"}</button></div></section></div>}
  </section>;
}

function TicketDetailScreen({ requester, ticketId, onBack }: { requester: DevelopmentRequester; ticketId: number; onBack: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "not-found">("loading");
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setDetail(null);
    setError(null);
    getTicketDetail(requester.id, ticketId)
      .then((loaded) => { if (!cancelled) { setDetail(loaded); setState("ready"); } })
      .catch((cause) => {
        if (cancelled) return;
        const statusCode = typeof cause === "object" && cause !== null && "statusCode" in cause ? cause.statusCode : undefined;
        if (statusCode === 404) {
          setState("not-found");
          setError("Ticket not found or unavailable.");
        } else {
          setState("error");
          setError(cause instanceof Error ? cause.message : "Unable to load Ticket Detail.");
        }
      });
    return () => { cancelled = true; };
  }, [requester.id, ticketId, retryToken]);

  const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;

  return (
    <main className="shell-content detail-page" id="ticket-detail" aria-busy={state === "loading"}>
      <button type="button" className="back-button" onClick={onBack}>← Back to My Tickets</button>
      {state === "loading" && <p className="loading-message" role="status">Loading Ticket Detail…</p>}
      {state === "error" && <div className="alert alert-error" role="alert">{error ?? "Unable to load Ticket Detail."}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((token) => token + 1)}>Retry</button></div>}
      {state === "not-found" && <div className="alert alert-warning" role="alert">{error ?? "Ticket not found or unavailable."}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((token) => token + 1)}>Retry</button></div>}
      {state === "ready" && detail && <>
        <div className="page-heading detail-heading"><div><p className="eyebrow">Requester workspace</p><h1>{detail.ticketNumber}</h1><p>Ticket Detail for {requester.name}</p></div><span className="status-badge">{detail.currentStatus}</span></div>
        <section className="detail-card" aria-labelledby="ticket-information-heading"><h2 id="ticket-information-heading">Ticket Information</h2><dl className="detail-grid"><div><dt>Ticket Number</dt><dd>{detail.ticketNumber}</dd></div><div><dt>Ticket Date</dt><dd>{formatDate(detail.ticketDate)}</dd></div><div><dt>Requester</dt><dd>{detail.requester.name} ({detail.requester.email})</dd></div><div><dt>Category</dt><dd>{detail.category.name}</dd></div><div><dt>Related System</dt><dd>{detail.relatedSystem.name}</dd></div><div><dt>Requested Priority</dt><dd>{detail.requestedPriority}</dd></div><div><dt>Current Status</dt><dd>{detail.currentStatus}</dd></div><div><dt>Last Updated</dt><dd>{formatDate(detail.updatedAt)}</dd></div><div className="detail-wide"><dt>Summary</dt><dd>{detail.summary}</dd></div><div className="detail-wide"><dt>Description</dt><dd className="preserve-whitespace">{detail.description}</dd></div></dl></section>
        <AttachmentSection requesterId={requester.id} ticketId={detail.id} attachments={detail.attachments} onRefresh={() => setRetryToken((token) => token + 1)} />
      </>}
    </main>
  );
}

function ApplicationShell({ requester, onChangeRequester }: { requester: DevelopmentRequester; onChangeRequester: () => void }) {
  const [screen, setScreen] = useState<"home" | "create" | "tickets" | "detail">("home");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketQuery, setTicketQuery] = useState(DEFAULT_TICKET_QUERY);
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#home">TokTickIT</a>
          <nav aria-label="Primary navigation">
            <a href="#home" aria-current="page">Workspace</a>
            <button className={screen === "tickets" || screen === "detail" ? "nav-create active" : "nav-create"} type="button" onClick={() => setScreen("tickets")} aria-current={screen === "tickets" || screen === "detail" ? "page" : undefined}>My Tickets</button>
            <button className={screen === "create" ? "nav-create active" : "nav-create"} type="button" onClick={() => setScreen("create")} aria-current={screen === "create" ? "page" : undefined}>Create Ticket</button>
          </nav>
          <div className="requester-context">
            <span>Requester: {requester.name}</span>
            <button className="change-requester" onClick={onChangeRequester}>Change Requester</button>
          </div>
        </div>
      </header>
      {screen === "create" ? <CreateTicketScreen requester={requester} onBack={() => setScreen("home")} /> : screen === "tickets" ? <MyTicketsScreen requester={requester} onCreate={() => setScreen("create")} onViewTicket={(ticketId) => { setSelectedTicketId(ticketId); setScreen("detail"); }} initialQuery={ticketQuery} onQueryChange={setTicketQuery} /> : screen === "detail" && selectedTicketId !== null ? <TicketDetailScreen requester={requester} ticketId={selectedTicketId} onBack={() => setScreen("tickets")} /> : <main className="shell-content" id="home">
        <p className="eyebrow">Requester workspace</p>
        <h1>Welcome to TokTickIT</h1>
        <p>Your requester context is ready. Choose an action from the navigation when the corresponding Lab 2 screen is available.</p>
        <div className="context-card" role="status">Testing as <strong>{requester.name}</strong></div>
      </main>}
    </div>
  );
}

export default function App() {
  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [loadState, setLoadState] = useState<RequesterLoadState>("loading");
  const [selectedId, setSelectedId] = useState("");
  const [currentRequester, setCurrentRequester] = useState<DevelopmentRequester | null>(null);
  const [validating, setValidating] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    getDevelopmentRequesters()
      .then((loaded) => {
        if (cancelled) return;
        setRequesters(loaded);
        const storedId = sessionStorage.getItem(REQUESTER_STORAGE_KEY) ?? "";
        const restored = loaded.find((requester) => String(requester.id) === storedId);
        if (restored) {
          setSelectedId(String(restored.id));
          setCurrentRequester(restored);
        } else {
          sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
          setSelectedId("");
          setCurrentRequester(null);
        }
        setLoadState(loaded.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) {
          setRequesters([]);
          setCurrentRequester(null);
          setLoadState("error");
        }
      });
    return () => { cancelled = true; };
  }, [retryToken]);

  function handleContinue() {
    if (!requesters.some((item) => String(item.id) === selectedId)) return;
    setValidating(true);
    setSelectionError(null);
    getDevelopmentRequesters()
      .then((freshRequesters) => {
        setRequesters(freshRequesters);
        const requester = freshRequesters.find((item) => String(item.id) === selectedId);
        if (!requester) {
          sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
          setSelectedId("");
          setCurrentRequester(null);
          setLoadState(freshRequesters.length > 0 ? "ready" : "empty");
          setSelectionError("That Development Requester is no longer active. Please select another.");
          return;
        }
        sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(requester.id));
        setCurrentRequester(requester);
      })
      .catch(() => setSelectionError("Unable to validate the selected Requester. Please try again."))
      .finally(() => setValidating(false));
  }

  function handleChangeRequester() {
    sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
    setCurrentRequester(null);
    setSelectedId("");
  }

  if (currentRequester) return <ApplicationShell requester={currentRequester} onChangeRequester={handleChangeRequester} />;
  return <RequesterSelector requesters={requesters} state={loadState} selectedId={selectedId} onSelect={(value) => { setSelectionError(null); setSelectedId(value); }} onContinue={handleContinue} onRetry={() => setRetryToken((token) => token + 1)} validating={validating} selectionError={selectionError} />;
}
