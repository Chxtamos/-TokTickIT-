# Lab 2 REST API Contract

## 1. Conventions

- Base path: `/api`.
- JSON fields use `camelCase`; enum values use uppercase snake case.
- Timestamps are ISO 8601 UTC strings.
- Numeric IDs are positive base-10 integers.
- Default content type is `application/json`.
- Attachment upload uses `multipart/form-data`; download uses the validated stored media type.
- Unknown JSON fields and unsupported query parameters return `400` to expose client/contract drift.
- Internal errors are logged server-side but no stack trace, SQL detail, filesystem path, or secret is returned.

## 2. Temporary Development Requester Context

Requester-specific endpoints require:

```http
X-Requester-Id: 1
```

This header is a temporary Lab 2 testing context, not authentication.

- Missing/malformed header: `400 REQUESTER_CONTEXT_INVALID`.
- Unknown/inactive Requester: `400 REQUESTER_CONTEXT_INVALID`.
- Existing Ticket or Attachment not owned by the selected Requester: safe `404 RESOURCE_NOT_FOUND`.
- Ticket creation does not accept an editable `requesterId` body field.

Public reference endpoints `/api/health`, `/api/categories`, `/api/related-systems`, and `/api/development-requesters` do not require the header.

## 3. Shared Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Please correct the highlighted fields.",
    "fieldErrors": {
      "summary": ["Summary must contain 5 to 120 characters."]
    },
    "correlationId": "4a116258-c605-4f93-b742-b5e7011c77d7"
  }
}
```

- `fieldErrors` is optional and contains public field names only.
- `correlationId` is required for unexpected `500` responses and optional for expected validation failures.
- User-facing messages must be safe and actionable.

## 4. Resource Shapes

### Reference item

```json
{ "id": 2, "name": "Hardware" }
```

### Development Requester

```json
{
  "id": 1,
  "name": "Anan Srisuk",
  "email": "anan.srisuk@example.test"
}
```

### Ticket summary

```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "summary": "Laptop battery drains quickly",
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "createdAt": "2026-08-24T10:00:00.000Z",
  "updatedAt": "2026-08-24T10:00:00.000Z"
}
```

### Ticket detail

```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "ticketDate": "2026-08-24T10:00:00.000Z",
  "requester": {
    "id": 1,
    "name": "Anan Srisuk",
    "email": "anan.srisuk@example.test"
  },
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "summary": "Laptop battery drains quickly",
  "requestedPriority": "MEDIUM",
  "description": "Battery drops from full to empty in about one hour.",
  "currentStatus": "NEW",
  "createdAt": "2026-08-24T10:00:00.000Z",
  "updatedAt": "2026-08-24T10:00:00.000Z",
  "attachments": []
}
```

### Attachment metadata

```json
{
  "id": 12,
  "originalName": "battery-report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 205120,
  "state": "ACTIVE",
  "uploadedAt": "2026-08-24T10:02:00.000Z",
  "removedAt": null,
  "removedReason": null,
  "downloadUrl": "/api/tickets/42/attachments/12/download"
}
```

Removed metadata uses `state: "REMOVED"`, populated removal fields, and `downloadUrl: null`.

## 5. Reference-Data Endpoints

### `GET /api/development-requesters`

Returns active Requesters ordered by `name asc`, then `id asc`.

- `200`: Requester array; an empty array is valid.
- `500 REFERENCE_DATA_UNAVAILABLE`.

### `GET /api/categories`

Extends the Lab 1 endpoint to return active Categories while preserving Lab 1's `id asc` ordering.

- `200`: reference-item array.
- `500 REFERENCE_DATA_UNAVAILABLE`.

### `GET /api/related-systems`

Returns active Related Systems ordered by `name asc`, then `id asc`.

- `200`: reference-item array.
- `500 REFERENCE_DATA_UNAVAILABLE`.

## 6. Ticket Creation

### `POST /api/tickets`

Headers:

```http
Content-Type: application/json
X-Requester-Id: 1
```

Request:

```json
{
  "clientRequestId": "f13f2298-1153-4cea-966d-3bc466d53d7b",
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "requestedPriority": "MEDIUM",
  "description": "Battery drops from full to empty in about one hour."
}
```

Validation:

- `clientRequestId`: required UUID.
- `categoryId`, `relatedSystemId`: required positive integers referencing active records.
- `summary`: required trimmed string, 5-120 characters.
- `requestedPriority`: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- `description`: required trimmed string, 10-5,000 characters.
- `requesterId`, Ticket Number, Ticket Date, status, IT Priority, and unknown fields are rejected.

First successful request returns `201 Created`:

```json
{
  "ticket": {
    "id": 42,
    "ticketNumber": "TKT-2026-000042",
    "ticketDate": "2026-08-24T10:00:00.000Z",
    "requester": {
      "id": 1,
      "name": "Anan Srisuk",
      "email": "anan.srisuk@example.test"
    },
    "category": { "id": 2, "name": "Hardware" },
    "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
    "summary": "Laptop battery drains quickly",
    "requestedPriority": "MEDIUM",
    "description": "Battery drops from full to empty in about one hour.",
    "currentStatus": "NEW",
    "createdAt": "2026-08-24T10:00:00.000Z",
    "updatedAt": "2026-08-24T10:00:00.000Z"
  },
  "replayed": false
}
```

Idempotency:

- Same Requester, `clientRequestId`, and normalized payload: `200`, original Ticket, `replayed: true`.
- Same Requester/request ID with different normalized payload: `409 IDEMPOTENCY_CONFLICT`.

Other failures:

- `400 VALIDATION_FAILED`.
- `400 REQUESTER_CONTEXT_INVALID`.
- `409 IDEMPOTENCY_CONFLICT`.
- `500 TICKET_CREATE_FAILED`.

Ticket row and official Ticket Number are committed in one database transaction. A transaction failure leaves no Ticket.

## 7. My Tickets

### `GET /api/tickets`

Requires `X-Requester-Id`.

| Parameter | Contract |
| --- | --- |
| `search` | Optional trimmed text, maximum 120; matches Ticket Number or Summary case-insensitively |
| `categoryId` | Optional positive integer |
| `relatedSystemId` | Optional positive integer |
| `requestedPriority` | Optional `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `currentStatus` | Optional `NEW` in Lab 2 |
| `sortBy` | `createdAt`, `updatedAt`, or `ticketNumber`; default `updatedAt` |
| `sortDirection` | `asc` or `desc`; default `desc` |
| `page` | Positive integer; default `1` |
| `pageSize` | `10`, `20`, or `50`; default `10` |

All search/filters use AND and are applied only within the selected Requester's Tickets.

`200 OK`:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0,
    "hasPreviousPage": false,
    "hasNextPage": false
  },
  "applied": {
    "search": "",
    "categoryId": null,
    "relatedSystemId": null,
    "requestedPriority": null,
    "currentStatus": null,
    "sortBy": "updatedAt",
    "sortDirection": "desc"
  }
}
```

A valid page beyond the final page returns empty `items` with the requested page and accurate totals.

Failures:

- `400 INVALID_QUERY` for unsupported/malformed values.
- `400 REQUESTER_CONTEXT_INVALID`.
- `500 TICKET_LIST_FAILED`.

## 8. Ticket Detail

### `GET /api/tickets/:ticketId`

Requires `X-Requester-Id`.

- `200`: owned Ticket detail with active/removed Attachment metadata ordered by upload time, then ID.
- `400`: malformed Ticket ID or Requester context.
- `404 RESOURCE_NOT_FOUND`: missing or non-owned Ticket.
- `500 TICKET_DETAIL_FAILED`.

The response never includes storage keys, server paths, payload hashes, or another Requester's data.

## 9. Attachment Endpoints

### `POST /api/tickets/:ticketId/attachments`

Requires `X-Requester-Id` and exactly one multipart field named `file`.

Validation order:

1. Validate Requester context and Ticket ID.
2. Confirm Ticket ownership.
3. Require exactly one file.
4. Reject size above 5,242,880 bytes.
5. Validate extension, MIME, and signature.
6. Confirm fewer than five active Attachments while locking/serializing the count update.
7. Generate UUID storage name and write outside the public root while the Ticket lock is held; a request that loses the capacity race must not write a file.
8. Commit metadata; remove a newly written orphan if metadata fails.

| Extensions | MIME |
| --- | --- |
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.webp` | `image/webp` |
| `.pdf` | `application/pdf` |

Responses:

- `201`: active Attachment metadata.
- `400 ATTACHMENT_REQUIRED` or malformed ID/context.
- `404 RESOURCE_NOT_FOUND`: missing/non-owned Ticket.
- `409 ATTACHMENT_LIMIT_REACHED`.
- `413 ATTACHMENT_TOO_LARGE`.
- `415 ATTACHMENT_TYPE_UNSUPPORTED`.
- `500 ATTACHMENT_UPLOAD_FAILED`; no active metadata/orphan file remains.

Unsafe path, control, and reserved filename characters are sanitized to `_` for display. The client path is never stored or used as the storage name; filenames are truncated by Unicode code point while preserving the extension.

### `GET /api/tickets/:ticketId/attachments`

Returns active and removed metadata for an owned Ticket.

- `200`: metadata array.
- `400`: malformed ID/context.
- `404`: missing/non-owned Ticket.
- `500 ATTACHMENT_LIST_FAILED`.

### `GET /api/tickets/:ticketId/attachments/:attachmentId/download`

For an active owned Attachment:

- `200` with stored bytes.
- `Content-Type` is the validated MIME.
- `Content-Disposition` uses a safely encoded display filename.
- `X-Content-Type-Options: nosniff`.

Failures:

- `400`: malformed ID/context.
- `404 RESOURCE_NOT_FOUND`: missing, non-owned, removed, or wrong-Ticket Attachment.
- `500 ATTACHMENT_DOWNLOAD_FAILED`: storage unavailable; safe message only.

### `DELETE /api/tickets/:ticketId/attachments/:attachmentId`

Request:

```json
{ "reason": "The uploaded screenshot contains outdated information." }
```

Rules:

- Reason is required, trimmed, and 5-250 characters.
- Ticket and Attachment must be owned by the selected Requester.
- Attachment must belong to the path Ticket and be active.

Success: `200` with removed metadata, `state: "REMOVED"`, and `downloadUrl: null`.

Failures:

- `400 VALIDATION_FAILED`.
- `404 RESOURCE_NOT_FOUND` for missing, non-owned, wrong-Ticket, or already removed Attachment.
- `500 ATTACHMENT_REMOVE_FAILED`; no partial removal fields are committed.

## 10. HTTP Status Matrix

| Status | Use |
| --- | --- |
| `200` | Retrieval, idempotent replay, download, successful soft removal |
| `201` | First Ticket creation or Attachment upload |
| `400` | Invalid body/query/path/header or inactive/invalid temporary context |
| `404` | Missing/non-owned Ticket/Attachment and removed Attachment access |
| `409` | Idempotency conflict or active Attachment limit |
| `413` | File exceeds 5 MiB |
| `415` | Extension/MIME/signature unsupported or inconsistent |
| `500` | Safe unexpected database/storage/server failure |

## 11. Consistency and Security Boundaries

- Every owner-scoped database query includes the selected `requesterId`.
- Reference records are rechecked for active state during Ticket creation.
- File bytes are never exposed through static hosting.
- Client filenames never become server paths.
- Database/storage errors use the documented compensation behavior.
- CORS does not make the Requester header authentication.
- Lab 3 replaces the temporary header with server-resolved authenticated identity while retaining Ticket ownership rules.

## 12. Human Approval Items

**Approval status (2026-08-24): Approved by the student.**

The student confirmed the context header, safe `404` policy, field limits, idempotency behavior, query fields, pagination, Ticket Number format, file-signature validation, storage strategy, and removal response semantics as written in this contract.
