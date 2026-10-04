# Lab 4 REST API Contract

Status: Issue #91 specification baseline. Existing Lab 3 authentication/session/CSRF/error rules remain authoritative unless this document explicitly extends them.

## Common rules

- JSON endpoints use `Content-Type: application/json`; authenticated mutations require the existing trusted Origin and `X-CSRF-Token`.
- Anonymous protected access: `401 SESSION_REQUIRED`; wrong role: `403 ROLE_FORBIDDEN`.
- Requester non-owned Ticket resources return safe `404 RESOURCE_NOT_FOUND` without existence hints.
- Unsupported JSON fields/query parameters return `400 VALIDATION_FAILED`.
- Optimistic concurrency conflicts return `409 VERSION_CONFLICT`.
- Unexpected failures return a safe correlated `500` without stack/database details.

## Action Taken DTO

```text
ActionTaken {
  id, ticketId, description, result,
  performedBy: { id, name },
  assignee: { id, name } | null,
  status: PENDING | IN_PROGRESS | COMPLETED | CANCELLED,
  followUpRequired, followUpNote, attachmentNotes,
  version, createdAt, updatedAt
}
```

`performedBy`, timestamps and version are server-owned. Requesters receive this safe operational DTO for owned Tickets; no account credentials/private notes are included.

## Actions Taken endpoints

### GET `/api/tickets/:ticketId/actions`

Requester: owned Ticket only. IT Staff/Administrator: operational access. Returns `{ items: ActionTaken[] }` ordered `createdAt ASC, id ASC`. Empty history returns `200 { items: [] }`.

### POST `/api/staff/tickets/:ticketId/actions`

IT Staff/Administrator only.

Request:
```json
{
  "clientRequestId": "uuid",
  "description": "...",
  "result": null,
  "assigneeId": 12,
  "followUpRequired": true,
  "followUpNote": "...",
  "attachmentNotes": "..."
}
```

Status is initially `PENDING`; creator/time are backend-owned. `201` creates. Repeated identical `(ticketId, clientRequestId)` returns the original representation without a second row. Reuse with different normalized payload returns `409 IDEMPOTENCY_CONFLICT`. Inactive/ineligible assignee returns `409 ASSIGNEE_INELIGIBLE`.

### PATCH `/api/staff/tickets/:ticketId/actions/:actionId`

IT Staff/Administrator only. Request may contain `description`, `result`, `assigneeId`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `status`, and mandatory `expectedVersion`. Creator/time cannot be changed. Terminal Actions reject further edits with `409 ACTION_TERMINAL`. Invalid lifecycle transition returns `409 ACTION_TRANSITION_INVALID`.

## Ticket workflow extension

Existing Lab 3 status endpoint/path and `expectedVersion` contract are retained. Transition to RESOLVED additionally checks the Lab 4 resolution gate: at least one Action exists and every Action is COMPLETED/CANCELLED. Failure returns `409 RESOLUTION_ACTIONS_INCOMPLETE` without changing Ticket status/version.

## Requester Dashboard

### GET `/api/requester/dashboard`

Requester only. No requesterId parameter is accepted.

```text
{
  metrics: { openTickets, waitingForRequester },
  recentlyUpdated: TicketSummary[0..5],
  recentlyResolved: TicketSummary[0..5],
  drillDown: {
    openTickets: "/my-tickets?state=open",
    waitingForRequester: "/my-tickets?status=WAITING_FOR_REQUESTER"
  }
}
```

All queries are scoped by authenticated requester ID. Zero metrics are `0`; empty lists are `[]`.

## Staff Dashboard

### GET `/api/staff/dashboard`

IT Staff/Administrator only.

```text
{
  metrics: { unassignedTickets, myTickets, myOpenActions },
  byStatus: { NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED },
  byItPriority: { LOW, MEDIUM, HIGH, URGENT },
  recentOrUrgent: TicketSummary[0..10],
  myRecentActions: ActionTaken[0..5],
  drillDown: { ...documented queue/detail query targets... }
}
```

Counts/calculations follow specification BR-23/24. Endpoint returns summaries only, never the entire Ticket collection.

## Validation and conflicts

Action text/follow-up/result limits follow specification BR-05/06. IDs must be safe positive integers. `expectedVersion` must be a positive integer. Create UUID must be syntactically valid. Resource IDs are validated before database lookup where possible. Authorization is role-first; Requester ownership lookup remains non-enumerating.

## Compatibility

All approved Labs 2-3 routes continue. Lab 4 does not weaken login/session expiration, password-change, CSRF, ownership, Attachment, conversation, Staff Queue/Detail, workflow, or Administrator safety behavior.
