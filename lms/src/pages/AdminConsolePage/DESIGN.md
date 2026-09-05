# System administration

## Overview

Mode: Operate. This surface manages system identities and audited operations;
it is separate from Tenant Admin governance. The requested direction is a quiet,
spacious extension of the existing X-Learn workspace, with no new visual theme.

There is no approved System Admin comp. The incumbent tokens and the requested
low-density direction govern this page; the Student Dashboard Figma frame does
not establish a separate System Admin composition. The root `DESIGN.md` remains
the shared token authority; this page-local contract introduces no palette,
type scale or global design-system extension.

## Colors

Use existing page and card surfaces, neutral structure lines, primary and muted
text, and violet action/selection roles. Active account status uses the existing
success treatment with a text label. Course-role badges retain labels and their
established treatments; color never supplies identity alone.

## Typography

Inherit the shared font stack. Use the workspace title token for the page title,
card-title token for section headings, and body/caption roles for forms and
metadata. Names precede email and secondary record details. Long identifiers
and email addresses wrap within their available column.

## Layout

The first viewport presents a full-width people directory with name and email,
identity, tenant, status and a single Manage action. Ten rows per page; creation
and identity changes use the existing TeachingDialog focus boundary. Filters are
local to the system users response, not an invented server search contract.

Visible search, institution and status labels precede the records; a result
count and pagination frame the list. Four section controls switch between users,
course access, represented institutions and operations.

Course access uses a 4+8 desktop grid with a quiet course context alongside the
roster. Enrollment is on demand. Course search and institution scope use the
same shared SystemCourseFilters as the course catalogue. Operations use a 3+9
layout: task navigation followed by one active form or directory. Small screens
collapse in reading order. Tenant rows describe only institutions represented in
the loaded accounts and link to their filtered directory, with an explicit note
that a complete registry and tenant CRUD are unavailable.

The system mock exam surface uses the same restrained spacing in a 4+8 directory
and content layout, with on-demand section and protected-media reads. Other exam
roles retain their existing workspaces.

At widths up to 1100px, directory records reflow below their person identity and
card padding reduces. At 760px, the console's membership, operations and nested
administrator-detail grids stack; section controls become two columns, and
search occupies the full filter row. At 420px, membership search and its action
stack. The separate system exam directory/content grid stacks at 850px.

## Elevation & Depth

Page-local cards use neutral borders and shared surfaces without added card
shadows. Selected navigation and records use the existing violet tint. Shared
dialogs retain their own overlay treatment and focus boundary.

## Shapes

Use shared card and control radii, with pills for statuses and course roles.
Dividers separate records without wrapping every person in another card.
Actions retain the shared touch-target minimum and a visible focus outline.

## Components

- **People directory:** `PersonCell` supplies the shared person hierarchy. Each
  row exposes one Manage action; creation and account management open
  `TeachingDialog`. Search and paging operate on the loaded users array.
- **Course access:** `SystemCourseFilters` applies the existing course query
  and optional institution ID scope. The selected course supplies membership
  context. Enrollment opens on demand; member search and 20-record paging remain
  course-scoped. Student/TA changes expose an inline review before submission.
- **Operations:** navigation selects the administrator directory, digest,
  instructor reassignment or grade correction. Directory results and selected
  administrator facts use a nested 5+7 layout. Reassignment and grade correction
  show a review step, with mutation feedback adjacent to the active operation.
- **System exams:** the related `SystemWorkspace` uses a searchable 10-record
  directory, selected-exam context, and listening/reading/writing controls.
  Detail is requested after selection, section content after successful detail,
  and protected media through the existing media component.
- **State and language:** use shared `TeachingState` where implemented and
  explicit inline mutation feedback elsewhere. Loading, empty and failure states
  remain distinct. Frontend copy uses shared i18next resources; display numbers
  use shared locale-aware formatting.

Use the existing semantic SCSS tokens. Components own presentation and local
form state; services own requests and TanStack Query owns response state. No
tenant API or role rules are inherited by reusing visual components.

## Do's and Don'ts

- **Do** preserve spacious record grouping, visible form labels and one active
  operational task at a time.
- **Do** reuse shared visual components while retaining each caller's existing
  queries, mutations and authorization boundary.
- **Do** describe represented institutions as a view of loaded accounts, with
  the existing limitation on registry completeness and tenant CRUD visible.
- **Don't** turn local user filtering into a claim of server search or infer
  tenant permissions from a shared component.
- **Don't** introduce a new theme, fabricated operational metrics or unsupported
  management actions to fill whitespace.
- **Don't** treat this source-based design record as authenticated live
  acceptance, deployment evidence or approval of a visual comp.
