import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { changePassword, clearInMemoryAuth, createTicket, CreatedTicket, downloadTicketAttachment, getCategories, getCurrentUser, getEligibleTicketOwners, getRelatedSystems, getStaffTickets, getTicketDetail, getTickets, indicateResolution, login, logout, ReferenceItem, removeTicketAttachment, type ApiValidationError, type AuthUser, type EligibleOwner, type Priority, type StaffQueueQuery, type StaffTicketListResponse, type StaffTicketSummary, TicketAttachmentMetadata, TicketDetail, TicketListQuery, TicketListResponse, TicketStatus, TicketSummary, uploadTicketAttachment } from "./api.js";
import "./App.css";

const LEGACY_REQUESTER_STORAGE_KEY = "toktickit.requesterId";
const ALL_STATUSES: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];

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

type CreateScreenProps = { requester: AuthUser; onBack: () => void };
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
    const firstInvalid = ["categoryId", "relatedSystemId", "summary", "description"].find((field) => fieldErrors[field]);
    const controlId = firstInvalid === "categoryId" ? "category-id" : firstInvalid === "relatedSystemId" ? "related-system-id" : firstInvalid;
    if (controlId) document.getElementById(controlId)?.focus();
  }, [fieldErrors]);

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
    return Object.keys(errors).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validateForm()) return;
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      const created = await createTicket({
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
      await uploadTicketAttachment(ticketId, selected.file);
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
      <button className="back-button" onClick={onBack}>← Back to My Tickets</button>
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

function MyTicketsScreen({ requester, onCreate, onViewTicket, initialQuery, onQueryChange }: { requester: AuthUser; onCreate: () => void; onViewTicket: (ticketId: number) => void; initialQuery: TicketListQuery; onQueryChange: (query: TicketListQuery) => void }) {
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
    Promise.all([getCategories(), getRelatedSystems(), getTickets(query)])
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
  }, [query, retryToken]);

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
        <label htmlFor="ticket-status">Current Status<select id="ticket-status" value={query.currentStatus ?? ""} onChange={(event) => updateQuery({ currentStatus: (event.target.value || null) as TicketListQuery["currentStatus"] })}><option value="">All Statuses</option>{ALL_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
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

const DEFAULT_STAFF_QUEUE_QUERY: StaffQueueQuery = {
  search: "",
  categoryId: null,
  relatedSystemId: null,
  requestedPriority: null,
  itPriority: null,
  currentStatus: null,
  owner: "all",
  sortBy: "updatedAt",
  sortDirection: "desc",
  page: 1,
  pageSize: 10,
};

function StaffTicketQueueScreen({ initialQuery, onQueryChange, onOpen }: { initialQuery: StaffQueueQuery; onQueryChange: (query: StaffQueueQuery) => void; onOpen: (ticketId: number) => void }) {
  const [query, setQueryState] = useState(initialQuery);
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [systems, setSystems] = useState<ReferenceItem[]>([]);
  const [owners, setOwners] = useState<EligibleOwner[]>([]);
  const [data, setData] = useState<StaffTicketListResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "invalid-query" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [optionsState, setOptionsState] = useState<"loading" | "ready" | "error">("loading");
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsRetryToken, setOptionsRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setOptionsState("loading");
    setOptionsError(null);
    Promise.all([getCategories(), getRelatedSystems(), getEligibleTicketOwners()])
      .then(([loadedCategories, loadedSystems, loadedOwners]) => {
        if (cancelled) return;
        setCategories(loadedCategories);
        setSystems(loadedSystems);
        setOwners(loadedOwners);
        setOptionsState("ready");
      })
      .catch((cause) => {
        if (cancelled) return;
        setOptionsError(cause instanceof Error ? cause.message : "Unable to load Queue filters.");
        setOptionsState("error");
      });
    return () => { cancelled = true; };
  }, [optionsRetryToken]);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setData(null);
    setMessage(null);
    getStaffTickets(query)
      .then((loadedQueue) => {
        if (cancelled) return;
        setData(loadedQueue);
        setState("ready");
      })
      .catch((cause) => {
        if (cancelled) return;
        const apiError = cause as ApiValidationError;
        setMessage(apiError.message || "Unable to load the Ticket Queue.");
        if (apiError.statusCode === 403) setState("forbidden");
        else if (apiError.statusCode === 400 && apiError.code === "INVALID_QUERY") setState("invalid-query");
        else setState("error");
      });
    return () => { cancelled = true; };
  }, [query, retryToken]);

  const applyQuery = (next: StaffQueueQuery) => { setQueryState(next); onQueryChange(next); };
  const updateQuery = (change: Partial<StaffQueueQuery>) => applyQuery({ ...query, ...change, page: 1 });
  const clearFilters = () => applyQuery({ ...DEFAULT_STAFF_QUEUE_QUERY });
  const hasCriteria = query.search.trim() !== "" || query.categoryId !== null || query.relatedSystemId !== null || query.requestedPriority !== null || query.itPriority !== null || query.currentStatus !== null || query.owner !== "all";
  const differsFromDefaults = hasCriteria || query.sortBy !== "updatedAt" || query.sortDirection !== "desc" || query.pageSize !== 10 || query.page !== 1;
  const isBeyondEnd = Boolean(data && data.items.length === 0 && data.pagination.page > 1 && data.pagination.page > data.pagination.totalPages);
  const badgeText = (value: string) => value.replaceAll("_", " ");
  const renderBadge = (value: string, kind: "priority" | "status") => <span className={`queue-badge queue-badge-${kind} queue-badge-${value.toLowerCase().replaceAll("_", "-")}`}>{badgeText(value)}</span>;
  const ownerName = (ticket: StaffTicketSummary) => ticket.ticketOwner?.name ?? "Unassigned";
  const openButton = (ticket: StaffTicketSummary) => <button type="button" className="button button-secondary" aria-label={`Open ${ticket.ticketNumber}`} onClick={() => onOpen(ticket.id)}>Open</button>;

  return <main className="shell-content staff-queue-page" aria-busy={state === "loading" || optionsState === "loading"}>
    <p className="eyebrow">Shared IT workspace</p>
    <div className="page-heading"><div><h1>Ticket Queue</h1><p>Shared work for IT Staff and Administrators. Filters apply across every Ticket.</p></div></div>
    <form className="staff-queue-controls" onSubmit={(event) => event.preventDefault()} aria-label="Ticket Queue controls">
      <fieldset><legend>Search and filters</legend><div className="queue-control-grid">
        <label htmlFor="staff-ticket-search">Ticket Number/Summary search<input id="staff-ticket-search" value={query.search} maxLength={120} placeholder="Ticket number or summary" onChange={(event) => updateQuery({ search: event.target.value })} /></label>
        <label htmlFor="staff-ticket-category">Category<select id="staff-ticket-category" value={query.categoryId ?? ""} onChange={(event) => updateQuery({ categoryId: event.target.value ? Number(event.target.value) : null })}><option value="">All Categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label htmlFor="staff-ticket-system">Related System<select id="staff-ticket-system" value={query.relatedSystemId ?? ""} onChange={(event) => updateQuery({ relatedSystemId: event.target.value ? Number(event.target.value) : null })}><option value="">All Systems</option>{systems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label htmlFor="staff-requested-priority">Requested Priority<select id="staff-requested-priority" value={query.requestedPriority ?? ""} onChange={(event) => updateQuery({ requestedPriority: (event.target.value || null) as Priority | null })}><option value="">All Requested Priorities</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
        <label htmlFor="staff-it-priority">IT Priority<select id="staff-it-priority" value={query.itPriority ?? ""} onChange={(event) => updateQuery({ itPriority: (event.target.value || null) as Priority | null })}><option value="">All IT Priorities</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
        <label htmlFor="staff-ticket-status">Status<select id="staff-ticket-status" value={query.currentStatus ?? ""} onChange={(event) => updateQuery({ currentStatus: (event.target.value || null) as TicketStatus | null })}><option value="">All Statuses</option>{ALL_STATUSES.map((status) => <option key={status} value={status}>{badgeText(status)}</option>)}</select></label>
        <label htmlFor="staff-ticket-owner">Owner<select id="staff-ticket-owner" value={String(query.owner)} onChange={(event) => updateQuery({ owner: /^\d+$/.test(event.target.value) ? Number(event.target.value) : event.target.value as StaffQueueQuery["owner"] })}><option value="all">All</option><option value="unassigned">Unassigned</option><option value="mine">Mine</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
      </div></fieldset>
      <fieldset><legend>Sort and page size</legend><div className="queue-sort-grid">
        <label htmlFor="staff-ticket-sort">Sort by<select id="staff-ticket-sort" value={query.sortBy} onChange={(event) => updateQuery({ sortBy: event.target.value as StaffQueueQuery["sortBy"] })}><option value="updatedAt">Last updated</option><option value="createdAt">Created date</option><option value="ticketNumber">Ticket number</option><option value="itPriority">IT Priority</option></select></label>
        <label htmlFor="staff-ticket-direction">Direction<select id="staff-ticket-direction" value={query.sortDirection} onChange={(event) => updateQuery({ sortDirection: event.target.value as StaffQueueQuery["sortDirection"] })}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        <label htmlFor="staff-ticket-page-size">Page size<select id="staff-ticket-page-size" value={query.pageSize} onChange={(event) => updateQuery({ pageSize: Number(event.target.value) as StaffQueueQuery["pageSize"] })}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
        <button type="button" className="button button-secondary clear-filters" disabled={!differsFromDefaults} onClick={clearFilters}>Clear Filters</button>
      </div></fieldset>
    </form>

    <div aria-live="polite">
      {state === "loading" && <p className="loading-message" role="status">Loading Ticket Queue…</p>}
      {optionsState === "loading" && <p className="loading-message" role="status">Loading Queue filters…</p>}
      {optionsState === "error" && <div className="alert alert-error" role="alert">{optionsError ?? "Unable to load Queue filters."}<button type="button" className="button button-secondary retry-button" onClick={() => setOptionsRetryToken((value) => value + 1)}>Retry filters</button></div>}
      {state === "forbidden" && <div className="alert alert-error" role="alert"><strong>Forbidden.</strong> This account cannot access the shared Ticket Queue.</div>}
      {state === "invalid-query" && <div className="alert alert-error" role="alert">The Queue query is invalid. Reset it to the documented defaults.<button type="button" className="button button-secondary retry-button" onClick={clearFilters}>Reset Queue</button></div>}
      {state === "error" && <div className="alert alert-error" role="alert">{message ?? "Unable to load the Ticket Queue."}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button></div>}
      {state === "ready" && data && <p className="result-count" role="status">{data.pagination.totalItems} matching {data.pagination.totalItems === 1 ? "Ticket" : "Tickets"}</p>}
    </div>

    {state === "ready" && data && data.items.length === 0 && data.pagination.totalItems === 0 && !hasCriteria && !isBeyondEnd && <div className="alert alert-warning" role="status">The shared Ticket Queue is empty. New Requester Tickets will appear here.</div>}
    {state === "ready" && data && data.items.length === 0 && data.pagination.totalItems === 0 && hasCriteria && !isBeyondEnd && <div className="alert alert-warning" role="status">No Tickets match the current search or filters.<button type="button" className="button button-secondary retry-button" onClick={clearFilters}>Clear Filters</button></div>}
    {state === "ready" && data && isBeyondEnd && <div className="alert alert-warning" role="status">This page is beyond the available Queue results.<button type="button" className="button button-secondary retry-button" onClick={() => applyQuery({ ...query, page: 1 })}>First Page</button><button type="button" className="button button-secondary retry-button" onClick={() => applyQuery({ ...query, page: query.page - 1 })}>Previous Page</button></div>}

    {state === "ready" && data && data.items.length > 0 && <>
      <div className="staff-queue-table-wrap"><table className="staff-queue-table"><caption className="visually-hidden">Shared Ticket Queue sorted by {query.sortBy}, {query.sortDirection}</caption><thead><tr><th scope="col">Ticket Number</th><th scope="col">Summary</th><th scope="col">Category</th><th scope="col">Requested Priority</th><th scope="col">IT Priority</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col">Open</th></tr></thead><tbody>{data.items.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.ticketNumber}</strong></td><td>{ticket.summary}<small className="queue-requester">Requester: {ticket.requester.name}</small></td><td>{ticket.category.name}</td><td>{renderBadge(ticket.requestedPriority, "priority")}</td><td>{renderBadge(ticket.itPriority, "priority")}</td><td>{renderBadge(ticket.currentStatus, "status")}</td><td>{ownerName(ticket)}</td><td>{openButton(ticket)}</td></tr>)}</tbody></table></div>
      <div className="staff-queue-cards" aria-label="Shared Ticket Queue cards">{data.items.map((ticket) => <article className="ticket-card" key={ticket.id}><h2>{ticket.ticketNumber}</h2><p className="queue-card-summary">{ticket.summary}</p><p className="queue-requester">Requester: {ticket.requester.name}</p><dl><div><dt>Category</dt><dd>{ticket.category.name}</dd></div><div><dt>Requested Priority</dt><dd>{renderBadge(ticket.requestedPriority, "priority")}</dd></div><div><dt>IT Priority</dt><dd>{renderBadge(ticket.itPriority, "priority")}</dd></div><div><dt>Status</dt><dd>{renderBadge(ticket.currentStatus, "status")}</dd></div><div><dt>Owner</dt><dd>{ownerName(ticket)}</dd></div></dl>{openButton(ticket)}</article>)}</div>
    </>}

    {state === "ready" && data && <nav className="pagination" aria-label="Ticket Queue pagination"><button type="button" className="button button-secondary" disabled={!data.pagination.hasPreviousPage} onClick={() => applyQuery({ ...query, page: query.page - 1 })}>Previous</button><span>Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)}</span><button type="button" className="button button-secondary" disabled={!data.pagination.hasNextPage} onClick={() => applyQuery({ ...query, page: query.page + 1 })}>Next</button></nav>}
  </main>;
}

function StaffTicketPlaceholder({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  return <main className="shell-content detail-page"><button type="button" className="back-button" onClick={onBack}>← Back to Queue</button><p className="eyebrow">Shared IT workspace</p><h1>Ticket Detail</h1><div className="context-card" role="status"><p>Ticket ID {ticketId}</p><p>The operational read model is available from Issue #62; the integrated Staff Detail UI and workflow controls remain reserved for Issue #75.</p></div></main>;
}

type PendingAttachment = { id: string; file: File; status: "queued" | "uploading" | "error"; error: string | null; canUpload: boolean };

const attachmentRules: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" };

function attachmentQueueId(file: File): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`;
}

function attachmentFingerprint(file: File): string {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
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

function AttachmentSection({ ticketId, attachments, onRefresh }: { ticketId: number; attachments: TicketAttachmentMetadata[]; onRefresh: () => void }) {
  const [queue, setQueue] = useState<PendingAttachment[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TicketAttachmentMetadata | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const removeDialogRef = useRef<HTMLElement | null>(null);
  const removeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activeCount = attachments.filter((attachment) => attachment.state === "ACTIVE").length;

  const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    let reserved = activeCount + queue.filter((item) => item.canUpload).length;
    const fingerprints = new Set(queue.map((item) => attachmentFingerprint(item.file)));
    const next = selected.map((file): PendingAttachment => {
      const fingerprint = attachmentFingerprint(file);
      const duplicate = fingerprints.has(fingerprint);
      if (!duplicate) fingerprints.add(fingerprint);
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
      await uploadTicketAttachment(ticketId, item.file);
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
      const blob = await downloadTicketAttachment(ticketId, attachment.id);
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

  const openRemove = (attachment: TicketAttachmentMetadata, trigger: HTMLButtonElement) => { removeTriggerRef.current = trigger; setRemoveTarget(attachment); setRemoveReason(""); setRemoveError(null); setActionError(null); };
  const restoreRemoveFocus = () => { removeTriggerRef.current?.focus(); };
  const closeRemove = () => { if (removingId === null) { setRemoveTarget(null); setRemoveReason(""); setRemoveError(null); restoreRemoveFocus(); } };

  useEffect(() => {
    if (!removeTarget || !removeDialogRef.current) return;
    const dialog = removeDialogRef.current;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex=\"-1\"])"));
    dialog.querySelector<HTMLElement>("#remove-reason")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRemove(); return; }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [removeTarget, removingId]);
  const confirmRemove = async () => {
    if (!removeTarget) return;
    const trimmed = removeReason.trim();
    if (trimmed.length < 5 || trimmed.length > 250) { setRemoveError("Reason must be between 5 and 250 characters."); return; }
    setRemovingId(removeTarget.id);
    setRemoveError(null);
    try {
      await removeTicketAttachment(ticketId, removeTarget.id, trimmed);
      setRemoveTarget(null);
      setRemoveReason("");
      restoreRemoveFocus();
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
    {attachments.length === 0 ? <p className="empty-detail">No Attachments on this Ticket.</p> : <ul className="attachment-metadata-list">{attachments.map((attachment) => <li key={attachment.id}><div><strong>{attachment.originalName}</strong><span>{attachment.mimeType} · {formatSize(attachment.sizeBytes)}</span><span>Uploaded {formatDate(attachment.uploadedAt)}</span>{attachment.state === "REMOVED" ? <><span className="status-badge status-removed">Removed · {attachment.removedReason ?? "No reason provided"}</span>{attachment.removedAt && <span>Removed at {formatDate(attachment.removedAt)}</span>}</> : <><span className="status-badge">Active</span><span className="attachment-actions"><button type="button" className="button button-secondary" onClick={() => download(attachment)} disabled={downloadingId === attachment.id}>{downloadingId === attachment.id ? "Downloading…" : "Download"}</button><button type="button" className="button button-secondary" onClick={(event) => openRemove(attachment, event.currentTarget)}>Remove</button></span></>}</div></li>)}</ul>}
    {removeTarget && <div className="dialog-backdrop"><section ref={removeDialogRef} className="remove-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-dialog-heading"><h2 id="remove-dialog-heading">Remove {removeTarget.originalName}?</h2><p>This will hide the file while retaining its metadata.</p><label htmlFor="remove-reason">Reason<textarea id="remove-reason" value={removeReason} minLength={5} maxLength={250} onChange={(event) => setRemoveReason(event.target.value)} aria-invalid={removeError ? "true" : "false"} /></label>{removeError && <p className="field-error" role="alert">{removeError}</p>}<div className="form-actions"><button type="button" className="button button-secondary" onClick={closeRemove} disabled={removingId !== null}>Cancel</button><button type="button" className="button button-primary remove-confirm" onClick={confirmRemove} disabled={removingId !== null}>{removingId !== null ? "Removing…" : "Confirm removal"}</button></div></section></div>}
  </section>;
}

function TicketDetailScreen({ requester, ticketId, onBack }: { requester: AuthUser; ticketId: number; onBack: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "not-found">("loading");
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [showResolutionConfirm, setShowResolutionConfirm] = useState(false);
  const [resolutionState, setResolutionState] = useState<"idle" | "saving" | "error">("idle");
  const resolutionButtonRef = useRef<HTMLButtonElement | null>(null);
  const resolutionDialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setDetail(null);
    setError(null);
    getTicketDetail(ticketId)
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
  }, [ticketId, retryToken]);

  const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const resolutionEligible = detail && ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(detail.currentStatus) && !detail.requesterResolvedAt;

  useEffect(() => {
    if (!showResolutionConfirm || !resolutionDialogRef.current) return;
    const dialog = resolutionDialogRef.current;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex]:not([tabindex=\"-1\"])") );
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && resolutionState !== "saving") {
        event.preventDefault();
        setShowResolutionConfirm(false);
        resolutionButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [showResolutionConfirm, resolutionState]);

  async function confirmResolutionIndication() {
    if (!detail || typeof detail.version !== "number") return;
    setResolutionState("saving");
    setError(null);
    try {
      setDetail(await indicateResolution(detail.id, detail.version));
      setShowResolutionConfirm(false);
      setResolutionState("idle");
      resolutionButtonRef.current?.focus();
    } catch (cause) {
      const apiError = cause as ApiValidationError;
      setResolutionState("error");
      setShowResolutionConfirm(false);
      setError(apiError.statusCode === 409 ? "The Ticket changed. Refresh and review it before trying again." : apiError.message || "Unable to save the resolution indication.");
    }
  }

  return (
    <main className="shell-content detail-page" id="ticket-detail" aria-busy={state === "loading"}>
      <button type="button" className="back-button" onClick={onBack}>← Back to My Tickets</button>
      {state === "loading" && <p className="loading-message" role="status">Loading Ticket Detail…</p>}
      {state === "error" && <div className="alert alert-error" role="alert">{error ?? "Unable to load Ticket Detail."}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((token) => token + 1)}>Retry</button></div>}
      {state === "not-found" && <div className="alert alert-warning" role="alert">{error ?? "Ticket not found or unavailable."}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((token) => token + 1)}>Retry</button></div>}
      {state === "ready" && detail && <>
        <div className="page-heading detail-heading"><div><p className="eyebrow">Requester workspace</p><h1>{detail.ticketNumber}</h1><p>Ticket Detail for {requester.name}</p></div><span className="status-badge">{detail.currentStatus}</span></div>
        {resolutionState === "error" && error && <div className="alert alert-error" role="alert">{error}<button type="button" className="button button-secondary retry-button" onClick={() => setRetryToken((token) => token + 1)}>Refresh Ticket</button></div>}
        <section className="detail-card" aria-labelledby="ticket-information-heading"><h2 id="ticket-information-heading">Ticket Information</h2><dl className="detail-grid"><div><dt>Ticket Number</dt><dd>{detail.ticketNumber}</dd></div><div><dt>Ticket Date</dt><dd>{formatDate(detail.ticketDate)}</dd></div><div><dt>Requester</dt><dd>{detail.requester.name} ({detail.requester.email})</dd></div><div><dt>Category</dt><dd>{detail.category.name}</dd></div><div><dt>Related System</dt><dd>{detail.relatedSystem.name}</dd></div><div><dt>Requested Priority</dt><dd>{detail.requestedPriority}</dd></div><div><dt>IT Priority</dt><dd className="readonly-value">{detail.itPriority ?? detail.requestedPriority}</dd></div><div><dt>Current Status</dt><dd>{detail.currentStatus}</dd></div><div><dt>Last Updated</dt><dd>{formatDate(detail.updatedAt)}</dd></div><div className="detail-wide"><dt>Summary</dt><dd>{detail.summary}</dd></div><div className="detail-wide"><dt>Description</dt><dd className="preserve-whitespace">{detail.description}</dd></div>{detail.resolutionSummary && <div className="detail-wide"><dt>Resolution Summary</dt><dd className="preserve-whitespace">{detail.resolutionSummary}</dd></div>}{detail.lastStatusReason && <div className="detail-wide"><dt>Latest Status Reason</dt><dd className="preserve-whitespace">{detail.lastStatusReason}</dd></div>}</dl></section>
        <section className="detail-card" aria-labelledby="resolution-indication-heading"><h2 id="resolution-indication-heading">Resolution indication</h2>{detail.requesterResolvedAt ? <p role="status">You indicated that the problem appeared resolved on {formatDate(detail.requesterResolvedAt)}. IT Staff will decide when to formally resolve or close the Ticket.</p> : resolutionEligible ? <><p>If the problem appears fixed, you can notify IT Staff without changing the Ticket status.</p><button ref={resolutionButtonRef} type="button" className="button button-primary" onClick={() => setShowResolutionConfirm(true)}>Problem Appears Resolved</button></> : <p>This action is not available for the current Ticket status.</p>}</section>
        <AttachmentSection ticketId={detail.id} attachments={detail.attachments} onRefresh={() => setRetryToken((token) => token + 1)} />
        <section className="detail-card" aria-labelledby="public-comments-heading"><h2 id="public-comments-heading">Public Comments</h2><div className="alert alert-warning" role="status">Public Comments are pending Issue #58 and are not available in this build.</div></section>
        {showResolutionConfirm && <div className="dialog-backdrop"><section ref={resolutionDialogRef} className="remove-dialog" role="dialog" aria-modal="true" aria-labelledby="resolution-confirm-heading"><h2 id="resolution-confirm-heading">Indicate that the problem appears resolved?</h2><p>This informs IT Staff. They will decide when to formally resolve or close the Ticket.</p><div className="form-actions"><button type="button" className="button button-secondary" disabled={resolutionState === "saving"} onClick={() => { setShowResolutionConfirm(false); resolutionButtonRef.current?.focus(); }}>Cancel</button><button type="button" className="button button-primary" disabled={resolutionState === "saving"} onClick={confirmResolutionIndication}>{resolutionState === "saving" ? "Saving…" : "Confirm indication"}</button></div></section></div>}
      </>}
    </main>
  );
}

function roleLabel(role: AuthUser["role"]): string {
  return role === "IT_STAFF" ? "IT Staff" : role === "ADMINISTRATOR" ? "Administrator" : "Requester";
}

function roleLanding(role: AuthUser["role"]): string {
  return role === "REQUESTER" ? "/requester/tickets" : role === "IT_STAFF" ? "/staff/tickets" : "/admin/users";
}

function LoginScreen({ onAuthenticated, notice }: { onAuthenticated: (user: AuthUser) => void; notice: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Password is required.";
    else if (new TextEncoder().encode(password).length > 512) errors.password = "Password must not exceed 512 UTF-8 bytes.";
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) {
      (errors.email ? emailRef.current : passwordRef.current)?.focus();
      return;
    }
    setBusy(true);
    try {
      const authenticated = await login(normalizedEmail, password);
      setPassword("");
      onAuthenticated(authenticated.user);
    } catch (cause) {
      const apiError = cause as ApiValidationError;
      setPassword("");
      setError(apiError.statusCode === 429 && apiError.retryAfter ? `Too many sign-in attempts. Try again in ${apiError.retryAfter} seconds.` : apiError.message || "Unable to sign in. Please try again.");
      passwordRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page" aria-busy={busy}>
    <section className="auth-card" aria-labelledby="login-heading">
      <p className="eyebrow">TokTickIT · Secure access</p>
      <h1 id="login-heading">Sign in</h1>
      <p className="intro">Use the account provided by your administrator.</p>
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={submit} noValidate>
        <label htmlFor="login-email">Email<input ref={emailRef} id="login-email" type="email" autoComplete="username" value={email} disabled={busy} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "login-email-error" : undefined} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: "" })); }} /></label>
        {fieldErrors.email && <small id="login-email-error" className="field-error">{fieldErrors.email}</small>}
        <label htmlFor="login-password">Password<input ref={passwordRef} id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} disabled={busy} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "login-password-error" : undefined} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: "" })); }} /></label>
        {fieldErrors.password && <small id="login-password-error" className="field-error">{fieldErrors.password}</small>}
        <button type="button" className="show-password" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)} disabled={busy}>{showPassword ? "Hide password" : "Show password"}</button>
        <button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy ? "Signing In…" : "Sign In"}</button>
      </form>
    </section>
  </main>;
}

function ChangePasswordScreen({ user, onAuthenticated, onCancel, onLogout, logoutBusy, logoutError, onAmbiguousFailure }: { user: AuthUser; onAuthenticated: (user: AuthUser) => void; onCancel: () => void; onLogout: () => void; logoutBusy: boolean; logoutError: string | null; onAmbiguousFailure: () => void }) {
  const mandatory = user.mustChangePassword;
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = { currentPassword: useRef<HTMLInputElement | null>(null), newPassword: useRef<HTMLInputElement | null>(null), confirmPassword: useRef<HTMLInputElement | null>(null) };

  function clearSecrets() { setForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); }
  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); setFieldErrors((current) => ({ ...current, [field]: "" })); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const codePoints = Array.from(form.newPassword).length;
    if (!form.currentPassword) errors.currentPassword = "Current Password is required.";
    if (codePoints < 15 || codePoints > 128 || /^\s*$/.test(form.newPassword) || new TextEncoder().encode(form.newPassword).length > 512) errors.newPassword = "New Password must be 15-128 characters, not whitespace-only, and at most 512 UTF-8 bytes.";
    else if (form.newPassword === form.currentPassword) errors.newPassword = "New Password must differ from the current password.";
    if (form.confirmPassword !== form.newPassword) errors.confirmPassword = "Passwords must match exactly.";
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) {
      const first = ["currentPassword", "newPassword", "confirmPassword"].find((field) => errors[field]) as keyof typeof refs;
      refs[first]?.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const authenticated = await changePassword(form.currentPassword, form.newPassword, form.confirmPassword);
      clearSecrets();
      onAuthenticated(authenticated.user);
    } catch (cause) {
      const apiError = cause as ApiValidationError;
      clearSecrets();
      if (apiError.statusCode === undefined) { onAmbiguousFailure(); return; }
      setError(apiError.message || "Unable to change the password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page" aria-busy={busy || logoutBusy}><section className="auth-card" aria-labelledby="change-password-heading">
    <p className="eyebrow">{mandatory ? "First sign-in security" : "Account security"}</p>
    <h1 id="change-password-heading">{mandatory ? "Change your initial password" : "Change Password"}</h1>
    {mandatory && <p className="intro">You must choose a new password before using TokTickIT. This initial session expires 15 minutes after sign-in and activity does not extend it.</p>}
    {!mandatory && <p className="intro">Update the password for {user.email}.</p>}
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {logoutError && <div className="alert alert-error" role="alert">{logoutError}</div>}
    <form onSubmit={submit} noValidate>
      <label htmlFor="current-password">Current Password<input ref={refs.currentPassword} id="current-password" type="password" autoComplete="current-password" value={form.currentPassword} disabled={busy} onChange={(event) => update("currentPassword", event.target.value)} aria-invalid={Boolean(fieldErrors.currentPassword)} /></label>{fieldErrors.currentPassword && <small className="field-error">{fieldErrors.currentPassword}</small>}
      <label htmlFor="new-password">New Password<input ref={refs.newPassword} id="new-password" type="password" autoComplete="new-password" value={form.newPassword} disabled={busy} onChange={(event) => update("newPassword", event.target.value)} aria-invalid={Boolean(fieldErrors.newPassword)} aria-describedby="password-policy" /></label>{fieldErrors.newPassword && <small className="field-error">{fieldErrors.newPassword}</small>}
      <small id="password-policy">15-128 characters; spaces and Unicode are allowed; not whitespace-only; maximum 512 UTF-8 bytes.</small>
      <label htmlFor="confirm-password">Confirm New Password<input ref={refs.confirmPassword} id="confirm-password" type="password" autoComplete="new-password" value={form.confirmPassword} disabled={busy} onChange={(event) => update("confirmPassword", event.target.value)} aria-invalid={Boolean(fieldErrors.confirmPassword)} /></label>{fieldErrors.confirmPassword && <small className="field-error">{fieldErrors.confirmPassword}</small>}
      <div className="form-actions">{!mandatory && <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel</button>}<button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save Password"}</button></div>
    </form>
    {mandatory && <button type="button" className="button button-secondary logout-auth" onClick={onLogout} disabled={logoutBusy}>{logoutBusy ? "Logging Out…" : "Logout"}</button>}
  </section></main>;
}

function ForbiddenScreen({ landing, navigate }: { landing: string; navigate: (path: string) => void }) {
  return <main className="shell-content"><p className="eyebrow">Access denied</p><h1>Forbidden</h1><p>Your role is not permitted to open this page.</p><button type="button" className="button button-primary" onClick={() => navigate(landing)}>Go to your workspace</button></main>;
}

function RolePlaceholder({ title, message }: { title: string; message: string }) {
  return <main className="shell-content"><p className="eyebrow">Authenticated workspace</p><h1>{title}</h1><div className="context-card" role="status">{message}</div></main>;
}

function ApplicationShell({ user, route, navigate, onChangePassword, onLogout, logoutBusy, logoutError }: { user: AuthUser; route: string; navigate: (path: string) => void; onChangePassword: () => void; onLogout: () => void; logoutBusy: boolean; logoutError: string | null }) {
  const [ticketQuery, setTicketQuery] = useState(DEFAULT_TICKET_QUERY);
  const [staffQueueQuery, setStaffQueueQuery] = useState(DEFAULT_STAFF_QUEUE_QUERY);
  const landing = roleLanding(user.role);
  const requesterDetailMatch = route.match(/^\/requester\/tickets\/([1-9]\d*)$/);
  const requesterRoute = user.role === "REQUESTER" && (route === "/requester/tickets" || route === "/requester/tickets/new" || requesterDetailMatch);
  const staffDetailMatch = route.match(/^\/staff\/tickets\/([1-9]\d*)$/);
  const staffRoute = (user.role === "IT_STAFF" || user.role === "ADMINISTRATOR") && (route === "/staff/tickets" || Boolean(staffDetailMatch));
  const adminRoute = user.role === "ADMINISTRATOR" && route === "/admin/users";
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href={landing} onClick={(event) => { event.preventDefault(); navigate(landing); }}>TokTickIT</a>
          <nav aria-label="Primary navigation">
            {user.role === "REQUESTER" && <><a href="/requester/tickets" aria-current={route === "/requester/tickets" || Boolean(requesterDetailMatch) ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/requester/tickets"); }}>My Tickets</a><a href="/requester/tickets/new" aria-current={route === "/requester/tickets/new" ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/requester/tickets/new"); }}>Create Ticket</a></>}
            {user.role === "IT_STAFF" && <a href="/staff/tickets" aria-current={staffRoute ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/staff/tickets"); }}>Ticket Queue</a>}
            {user.role === "ADMINISTRATOR" && <><a href="/admin/users" aria-current={route === "/admin/users" ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/admin/users"); }}>User Management</a><a href="/staff/tickets" aria-current={staffRoute ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/staff/tickets"); }}>Ticket Queue</a></>}
          </nav>
          <div className="account-context">
            <span>{user.name} · {roleLabel(user.role)}</span>
            <button className="account-action" onClick={onChangePassword}>Change Password</button>
            <button className="account-action" onClick={onLogout} disabled={logoutBusy}>{logoutBusy ? "Logging Out…" : "Logout"}</button>
          </div>
        </div>
      </header>
      {logoutError && <div className="shell-content shell-alert"><div className="alert alert-error" role="alert">{logoutError}<button className="button button-secondary retry-button" type="button" onClick={onLogout}>Retry logout</button></div></div>}
      {requesterRoute && route === "/requester/tickets/new" ? <CreateTicketScreen requester={user} onBack={() => navigate("/requester/tickets")} /> : requesterRoute && route === "/requester/tickets" ? <MyTicketsScreen requester={user} onCreate={() => navigate("/requester/tickets/new")} onViewTicket={(ticketId) => navigate(`/requester/tickets/${ticketId}`)} initialQuery={ticketQuery} onQueryChange={setTicketQuery} /> : requesterRoute && requesterDetailMatch ? <TicketDetailScreen requester={user} ticketId={Number(requesterDetailMatch[1])} onBack={() => navigate("/requester/tickets")} /> : staffRoute && route === "/staff/tickets" ? <StaffTicketQueueScreen initialQuery={staffQueueQuery} onQueryChange={setStaffQueueQuery} onOpen={(ticketId) => navigate(`/staff/tickets/${ticketId}`)} /> : staffRoute && staffDetailMatch ? <StaffTicketPlaceholder ticketId={Number(staffDetailMatch[1])} onBack={() => navigate("/staff/tickets")} /> : adminRoute ? <RolePlaceholder title="User Management" message="Authenticated Administrator access is ready. User management is reserved for its dedicated Lab 3 implementation issue." /> : <ForbiddenScreen landing={landing} navigate={navigate} />}
    </div>
  );
}

export default function App() {
  const [bootstrapState, setBootstrapState] = useState<"loading" | "ready">("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [route, setRoute] = useState(window.location.pathname);
  const [notice, setNotice] = useState<string | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  function navigate(path: string, replace = false) {
    if (window.location.pathname !== path) window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    setRoute(path);
  }

  useEffect(() => {
    sessionStorage.removeItem(LEGACY_REQUESTER_STORAGE_KEY);
    let cancelled = false;
    getCurrentUser()
      .then((authenticated) => {
        if (!cancelled) setUser(authenticated.user);
      })
      .catch((cause) => { if (!cancelled && (cause as ApiValidationError).statusCode !== 401) setNotice("Unable to restore the previous session. Sign in to continue."); })
      .finally(() => { if (!cancelled) setBootstrapState("ready"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    const onSessionInvalid = (event: Event) => {
      const code = (event as CustomEvent<{ code?: string }>).detail?.code;
      if (code === "PASSWORD_CHANGE_REQUIRED" && user) {
        setUser({ ...user, mustChangePassword: true });
        navigate("/change-password", true);
      } else {
        clearInMemoryAuth();
        setUser(null);
        setNotice("Your session ended. Please sign in again.");
        navigate("/login", true);
      }
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("toktickit:session-invalid", onSessionInvalid);
    return () => { window.removeEventListener("popstate", onPopState); window.removeEventListener("toktickit:session-invalid", onSessionInvalid); };
  }, [user]);

  useEffect(() => {
    if (bootstrapState !== "ready") return;
    if (!user) {
      if (route !== "/login") navigate("/login", true);
    } else if (user.mustChangePassword) {
      if (route !== "/change-password") navigate("/change-password", true);
    } else if (route === "/" || route === "/login") {
      navigate(roleLanding(user.role), true);
    }
  }, [bootstrapState, user, route]);

  function handleAuthenticated(nextUser: AuthUser) {
    setUser(nextUser);
    setNotice(null);
    setLogoutError(null);
    navigate(nextUser.mustChangePassword ? "/change-password" : roleLanding(nextUser.role), true);
  }

  async function handleLogout() {
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      await logout();
      setUser(null);
      setNotice("You have been logged out.");
      navigate("/login", true);
    } catch (cause) {
      setLogoutError((cause as Error).message || "Unable to log out. Please try again.");
    } finally {
      setLogoutBusy(false);
    }
  }

  if (bootstrapState === "loading") return <main className="auth-page" aria-busy="true"><section className="auth-card"><p className="eyebrow">TokTickIT</p><h1>Restoring your session</h1><p className="loading-message" role="status">Loading secure workspace…</p></section></main>;
  if (!user) return <LoginScreen onAuthenticated={handleAuthenticated} notice={notice} />;
  if (user.mustChangePassword || route === "/change-password") return <ChangePasswordScreen user={user} onAuthenticated={handleAuthenticated} onCancel={() => navigate(roleLanding(user.role))} onLogout={handleLogout} logoutBusy={logoutBusy} logoutError={logoutError} onAmbiguousFailure={() => { clearInMemoryAuth(); setUser(null); setNotice("The password-change result could not be confirmed. Sign in with the new password to continue."); navigate("/login", true); }} />;
  return <ApplicationShell key={user.id} user={user} route={route} navigate={navigate} onChangePassword={() => navigate("/change-password")} onLogout={handleLogout} logoutBusy={logoutBusy} logoutError={logoutError} />;
}
