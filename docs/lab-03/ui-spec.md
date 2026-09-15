# Lab 3 Zen Green UI Specification

Version 1.0, prepared 2026-09-15 for review. [specification.md](specification.md) and [api-spec.md](api-spec.md) define access and data behavior. New UI is planned; no screenshots or passing visual checks are claimed here.

## 1. Existing design foundation

Reuse the Lab 2 tokens in client/src/App.css and docs/lab-02/ui-spec.md: primary #006B3C, secondary #0B7A46, pale #EAF6EF, page #F5F7F6, surface #FFFFFF, text #173B2C, muted #52685E, border #C9D6CF, readonly #EFF3F0, error #9B1C1C, warning #9A6700/#FFF4CE and focus #0B7A46. Keep the Inter/Segoe UI/system font stack, 16px body, at least 14px metadata, 4/8/12/16/24/32/48px spacing, 8-12px cards, 6-8px controls and practical 44px touch targets. Verify actual contrast, rather than assuming token names guarantee accessibility.

Extract reusable Shell, Field, Button, Badge, Feedback, Dialog, Pagination, AttachmentSection and Ticket information groups from the current single-file App.tsx where needed. Proposed module names are organizational choices, not a requirement to rewrite all existing code. Share styling/components across roles; keep authorization in backend middleware/services as well as screen guards.

## 2. Routes, shell and session behavior

Proposed browser routes (use the existing navigation mechanism or a small router; ensure refresh/back/direct routes work):

| Route | Permitted session | Main mode/default destination |
| --- | --- | --- |
| /login | public | sign in |
| /change-password | authenticated, including initial-password | mandatory or voluntary password change |
| /requester/tickets | normal Requester | owned list/default Requester landing |
| /requester/tickets/new | normal Requester | create |
| /requester/tickets/:id | normal Requester | read-only Ticket with permitted actions |
| /staff/tickets | normal IT Staff/Administrator | shared queue/default IT Staff landing |
| /staff/tickets/:id | normal IT Staff/Administrator | operational detail |
| /admin/users | normal Administrator | list/create/edit/default Administrator landing |

- At startup GET /auth/me; while pending show a labelled loading surface without cached protected content. No session -> Login. mustChangePassword -> Change Password before any normal screen/navigation.
- Header retains TokTickIT branding, accessible active navigation and current name/role. Requester navigation: My Tickets/Create Ticket. IT Staff: Ticket Queue. Administrator: User Management/Ticket Queue, reflecting its explicit matrix permission.
- User menu provides Change Password and Logout. Restricted sessions expose only Change Password and Logout. No Development Requester selector, Change Requester or persisted requester identity.
- Refresh retrieves me/CSRF; all API fetches use credentials=include. Clear Ticket/user/draft/list account state on logout, reauthenticationRequired, revoked session or account switch via a new login; abort/discard old pending responses so they cannot populate another account's UI.
- Wrong-role direct route: Forbidden with a link to the permitted landing screen and no protected data. Missing/non-owned Ticket: identical Not Found. 401 -> clear protected state and Login; initial-password 403 -> mandatory screen.
- Logout is busy until the empty `204` response, including repeated/expired-session attempts; then clear local auth state and return to Login. For an active session, invalid CSRF/Origin returns `403` without deleting it. If logout fails through network/500, keep session state and show Retry so UI does not claim server invalidation that has not occurred.

## 3. Main screen modes and common feedback

Mode describes the screen's purpose, not a separate formal state for every error.

| Screen | Modes | Required feedback |
| --- | --- | --- |
| Login | sign in | field validation; signing in; generic credential failure/inactive handling; rate limit; safe network/server failure |
| Change Password | mandatory/voluntary | policy/current/confirmation errors; saving; success; session expiration; safe failure |
| My Tickets | list | loading; empty; no results; invalid-query reset; safe failure |
| Create Ticket | create/saved confirmation | loading references; validation; submitting; Ticket success; per-file partial failure/retry |
| Requester detail | view plus Attachment/comment/indication actions | loading/not-found; busy; validation; comment empty; safe failure/conflict |
| Ticket Queue | list | loading; empty; no results; forbidden; invalid query; safe failure |
| Staff detail | view/operational field edit | loading/not-found/forbidden; saving; conflict/refresh; comment/note empty; validation; safe failure |
| User Management | list/create/edit/reset | loading; empty/no results; saving; duplicate email; admin-safety/stale conflict; validation; success; forbidden/failure |

Use inline labelled alerts near affected actions, aria-live for async status, aria-busy while processing and disabled repeat controls. Preserve non-secret drafts/filters after safe failure. Clear password controls on credential failure/success and when leaving a credential form. Move invalid submit focus to the first invalid field. Conflict messaging explains refresh/review; do not silently overwrite concurrent changes.

## 4. Login and Change Password

Centered Zen Green surface, maximum width about 560px, natural mobile stacking.

Login: labelled email and password, accessible show/hide control, autocomplete=username/current-password, Sign In, inline field errors and generic credential alert. Do not expose separate inactive/unknown-email messages. A generic contact-administrator hint covers inactive accounts. No self-registration or forgot-password email/reset-link flow from the sample image. Rate-limit feedback shows Retry-After duration without account-existence hints; preserve email and clear password.

Change Password: explain mandatory first-login requirement when applicable; Current Password, New Password, Confirm New Password; plain policy hint (15-128 characters, spaces/Unicode allowed, max512 UTF-8 bytes, not whitespace-only); match validation; autocomplete=current-password/new-password; Save Password. Mandatory mode has no skip/normal-navigation control. Successful save clears secrets and opens the role landing screen with the new session; voluntary mode may cancel back to its landing screen. Expiration returns to Login. Do not render the sample composition checklist as an instructor requirement.

## 5. Requester regression and detail additions

Preserve Create Ticket's backend-generated number/date, current Requester read-only display, existing editable fields, validation, five-file/5MiB hints, idempotency and per-file retry. Preserve My Tickets search/filter/sort/page controls and desktop table/mobile cards. Include all eight status labels in filters/badges; show IT Priority as read-only information on detail, not an editable Requester field.

Requester detail keeps submitted Ticket fields read-only; active/removed Attachment metadata/actions remain. Add a Public Comments section with author/name/role/time, plain-text content, labelled textarea/character hint and Post Public Comment. Include a clear empty state. No Internal Note tab/composer/count exists for a Requester, even if a backend response is malformed.

Problem Appears Resolved action appears only for eligible statuses and before indication. Confirmation explains `This informs IT Staff. They will decide when to formally resolve or close the Ticket.` After success show backend indication time; staff resolution/closure is separate. Stale version -> Refresh/review. Display public resolutionSummary/lastStatusReason when present, without exposing private notes.

## 6. IT Staff Ticket Queue

Title Ticket Queue, shared-work context and total matching Ticket count. Toolbar contains labelled search (Ticket Number/Summary), Category, Related System, Requested Priority, IT Priority, Status and Owner filters. Owner choices All/Unassigned/Mine/specific eligible owner. Allow filters in an accessible collapsible panel to keep the main toolbar readable. Search/filter/sort/page-size changes reset page=1; Clear Filters restores defaults.

Desktop >=992px table columns: Ticket Number, Summary (Requester name as secondary text), Category, Requested Priority, IT Priority, Status, Owner and explicit Open action. Related System and dates remain available in detail; default updatedAt sorting and sort controls do not require adding an unreadable mega-grid. Sort controls offer updatedAt/createdAt/ticketNumber/itPriority with directions. Expose text/aria-sort where a table header itself sorts.

Tablet/mobile <992px use readable cards or a reduced table only if all controls/content remain reachable. Each card shows Ticket Number/Summary, requester, category, both priorities, status, owner/unassigned and Open; filter/sort/pagination remain equivalent. Count/page information always visible; Previous/Next boundaries disabled; page sizes 10/20/50. Invalid query has Reset; beyond-end empty page has Previous/First Page recovery.

Empty queue differs from current-filter no-results; both expose sensible recovery. Failure keeps query controls and Retry. Loading never mislabels stale account data as current. Assigned owners show readable name; unassigned has text, not a blank cell. No KPI dashboard beyond matching counts.

## 7. Operational Ticket Detail

Reuse Ticket/Attachment groups from Lab 2. Top: official number, status and Back to Queue preserving the same account's query. Submitted information (Requester, date, category/system, summary/description, Requested Priority) stays read-only. Operational area: owner selection, Claim when unassigned, Assign/Reassign/Unassign confirmation, editable IT Priority and only permitted next statuses.

- Fetch eligible owners from the role-limited API. Inactive/demoted owner refresh handling removes invalid selections and surfaces ASSIGNEE_INVALID. CLOSED/CANCELLED hide/disable ownership/priority saves with a reason; reopen is available only from the matrix.
- Each save uses the loaded expectedVersion. Do not let separate operational saves race within the same screen; after success replace authoritative detail/version. 409 offers Refresh and retains an unsaved non-secret draft for deliberate re-entry. A CLOSED/CANCELLED Ticket whose owner was deactivated/demoted by Admin may show `Unassigned`; this is account-safety cleanup, not an editable terminal owner control. Former attribution remains in TicketOwnerChange backend records; no owner-history screen is added.
- Confirm every status transition. RESOLVED requires public resolution summary 10-2000; REOPENED/CANCELLED require public reason 5-250; CLOSED displays existing summary. Show these values as requester-visible, not Internal Notes. No Actions Taken/Service Actions tab or blocking rule.
- Show Requester indication time separately from formal status. Existing files can be downloaded by staff, but no staff upload/removal controls under this contract. Removed metadata has no preview/download action.
- Public Comments and Internal Notes use separate clearly labelled sections/tabs and independent drafts/buttons. Public heading/composer says `Visible to the Requester`; private heading/composer says `Internal Note - visible only to IT Staff and Administrators`, includes an icon plus text, and its button is `Save Internal Note`. Switching tabs never changes a pending draft's destination or posts automatically.
- Both conversations show deterministic author/time/content, empty/loading/failure feedback. Plain-text content wraps, preserves line breaks and cannot execute HTML. No edit/delete menu. Disable repeated activation while posting. If the network response is ambiguous, reload the list and tell the user to check whether the entry appears before manually retrying; no backend conversation deduplication is promised in Lab 3.

## 8. Minimalist Administrator User Management

One screen with user list and create/edit form (drawer/dialog or adjacent panel). List fields Name, Email, Role, Status and Edit; search name/email and one optional role dropdown; default name asc/id asc. No required pagination/multi-sort/bulk controls.

Create fields: Name, Email, one Role dropdown, Active checkbox/switch with semantic label, Initial Password plus policy hint. Edit fields: Name, Email, one Role, Active; separate Set New Initial Password action/form. Do not prefill stored passwords; never display password hashes. On create/reset success provide an instruction to manually give the entered initial password to the user, then clear secret fields. No send-email checkbox or reset-link workflow despite the sample image.

Confirm activation changes/reset. Explain deactivation rather than deletion. Self-deactivation is disabled with text and still backend-protected. Last-admin demotion/deactivation conflict appears as an actionable alert; no false success. Duplicate-email field error also covers inactive accounts. expectedVersion handles simultaneous edits; stale form must refresh/review. If own account update/reset returns reauthenticationRequired, clear local session state and return to Login with a safe account-updated message.

Mobile list becomes cards with the same five fields/action; create/edit panel stacks or uses an accessible full-width dialog. Email/name wrap. Save/Cancel/Reset actions stay reachable on short/zoomed displays. Unsaved non-secret account edits require discard confirmation on closing; no extended profile/history feature.

## 9. Badge and control rules

Priority labels Low/Medium/High/Urgent; status labels New/Open/In Progress/Waiting for Requester/Resolved/Closed/Reopened/Cancelled; roles Requester/IT Staff/Administrator; account states Active/Inactive. Use shared text-bearing Badge variants and existing Zen Green surfaces. Provide calm neutral styling for Closed/Cancelled, emphasis for Urgent, and explicit readable labels for all states. Never use color alone.

Readonly fields use definition lists or clearly styled values; editable fields use white controls; invalid errors stay directly below labels/controls; visible focus ring; destructive confirmations use restrained dark red. Do not make all operational changes look destructive. Busy buttons retain their size and explain the action (Signing In/Saving/Posting/Logging Out).

## 10. Responsive and accessibility requirements

Retain Lab 2 form breakpoints: desktop >=992px, tablet 768-991px, mobile <768px; queue cards may begin below992px for readability. Centered max width about1200px. Form fields stack where necessary; no page-level horizontal scroll; dialogs have bounded height with internal scrolling and visible actions. Verify 1440x900 desktop, 768x1024 tablet, 390x844 mobile and narrow360px plus 200% browser zoom.

Logical headings/landmarks; labels and aria-describedby for policy/errors; required/invalid semantics; keyboard-only operation; visible focus; aria-current navigation; live async feedback; dialog initial focus/trap/Escape/return focus; reduced motion; semantic headers/sort labels; WCAG2.1 AA contrast. Icon-only show/hide/close controls have accessible names. Error focus moves to the first invalid field; success/route change focuses a meaningful heading without trapping the user.

## 11. Visual evidence and checklist

Proposed screenshot directories under artifacts/lab-03/screenshots/: authentication/, requester-regression/, staff-queue/, staff-ticket-detail/, user-management/. Capture desktop/tablet/mobile for every major screen (Login, Change Password, Create Ticket, My Tickets, Requester Detail, Queue, Staff Detail, User Management). Capture meaningful busy/validation/failure/conflict and role-denial states, Comments vs Notes, removed files, indication and admin safety. Do not capture entered passwords, raw cookies/CSRF/connection URLs; redact sensitive traces before sharing.

- [ ] Tokens, typography, spacing and button hierarchy match Lab 2.
- [ ] Current identity/role and allowed navigation are correct; no protected content flashes.
- [ ] Read-only/submitted vs operational editable fields are clear.
- [ ] Priority/status/role/account badges include readable text.
- [ ] Public/Private destinations and author/time are unmistakable.
- [ ] Password policy, validation location, busy states and recovery match the contract.
- [ ] Empty vs no-results, not-found, forbidden and stale conflict are distinguishable.
- [ ] Keyboard focus/labels/dialog behavior and contrast were inspected.
- [ ] All major screens work at desktop/tablet/mobile/360px/200% zoom; no clipping, overlap, unreachable control or page overflow.
- [ ] Screenshots and evidence contain no credentials or private notes on Requester screens.
- [ ] Human visual inspection is recorded with actual revision/date/observations.

All checks remain unchecked until implementation and inspection; a prepared UI contract is not approval or visual-completion evidence.
