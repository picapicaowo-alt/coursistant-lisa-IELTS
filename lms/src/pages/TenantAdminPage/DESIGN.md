---
name: X-Learn Tenant Administration
description: A route-scoped extension of the Calm Learning Desk for institutional operations.
colors:
  action-primary: "#4835EB"
  action-primary-hover: "#3A4FBF"
  surface-canvas: "#FFFFFF"
  surface-subtle: "#F8FAFC"
  surface-muted: "#EDF2F7"
  surface-brand-subtle: "#E6E3FF"
  content-primary: "#2D3748"
  content-secondary: "#5D6B7C"
  content-placeholder: "#667085"
  border-default: "#E2E8F0"
  border-strong: "#CBD5E0"
  feedback-success: "#276749"
  feedback-warning: "#9C4221"
  feedback-danger: "#C53030"
  feedback-info: "#2B6CB0"
typography:
  display:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.75rem, 2.35vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.2
  headline:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.4
  title:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
  body:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: ".875rem"
    fontWeight: 500
rounded:
  sm: ".625rem"
  md: ".9375rem"
  round: "9999px"
spacing:
  2: ".5rem"
  3: ".75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
  10: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.surface-canvas}"
    rounded: "{rounded.sm}"
    padding: ".65rem 1.1rem"
  button-secondary:
    backgroundColor: "{colors.surface-canvas}"
    textColor: "{colors.content-primary}"
    rounded: "{rounded.sm}"
    padding: ".65rem 1.1rem"
  input-search:
    backgroundColor: "{colors.surface-canvas}"
    textColor: "{colors.content-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: ".65rem .85rem .65rem 2.6rem"
  governance-navigation:
    textColor: "{colors.action-primary}"
    padding: "1rem 0"
  badge-neutral:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.content-secondary}"
    padding: ".2rem .65rem"
  dashboard-metric:
    backgroundColor: "{colors.surface-canvas}"
    textColor: "{colors.content-primary}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
  policy-group:
    backgroundColor: "{colors.surface-canvas}"
    textColor: "{colors.content-primary}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
---

# Design System: X-Learn Tenant Administration

## Overview

**Creative North Star: "The Calm Learning Desk"**

Tenant Administration extends the existing X-Learn operational workspace: calm, precise enterprise operations with compact information density, clear record hierarchy, and a visible next action. Cool-gray working space, white outlined surfaces, inherited HarmonyOS Sans TC typography, and violet wayfinding express the supplied Tenant Admin frames without creating a separate brand.

This is an Operate surface. Scanability, honest state, and record continuity outrank spectacle. Dashboard summaries lead into governance, intakes, and assessment records; contextual drawers and explicit draft states preserve the surrounding task.

**Key Characteristics:**

- Cool-gray canvas and white outlined working surfaces.
- One violet action voice with semantic, text-labeled state.
- Wide desktop records with deliberate phone reflow.
- Context-preserving drawers and honest server-versus-local state.

This record applies only to the Tenant Admin Dashboard, Governance, Mock exams, and Intakes surfaces. It supplements, and does not replace, root `DESIGN.md` or `PRODUCT.md`. The ten user-supplied screenshots are this implementation's composition authority. Scope, contracts, and verification remain in `docs/tenant-admin-uiux-2026-09-03.md`.

Source of the extracted values: `lms/src/styles/_tokens.scss`; shared presentation in `lms/src/components/TenantWorkspace/workspace.module.scss`; tenant Header/Sidebar variants; Dashboard styles; Governance audit/rule styles; and `lms/src/pages/MockExamsPage/tenant/tenant.module.scss`. The legacy `TenantAdminPage/index.module.scss` is not the active governance presentation source.

## Colors

The portable frontmatter records the existing semantic values; production SCSS continues to consume the semantic token source, not literals from this document.

- **Guiding Violet** (`action-primary`) identifies actions, links, focus, selection, and the assigned portion of the intake distribution. **Deep Interaction Violet** (`action-primary-hover`) is an interaction state, not a second brand.
- **Violet Mist** (`surface-brand-subtle`) supports selected navigation, selected parts, and compact icon context.
- **Open White Canvas** (`surface-canvas`) forms the header, tenant rail, cards, fields, and drawers. **Cool Working Canvas** (`surface-subtle`) separates the page and nested action areas; **Muted Slate Surface** (`surface-muted`) supports neutral chips and unavailable distribution space.
- **Ink Slate**, **Operational Slate**, and **Placeholder Slate** distinguish primary content, metadata, and input hints. **Structure Lines** (`border-default`, `border-strong`) make boundaries legible without heavy depth.
- Success, warning, danger, and information colors retain the shared semantic roles. Existing badges also use explicitly labeled role/intake categories; their color alone must not be interpreted as account status. Account activity has its own labeled dot treatment.

**The One Violet Voice Rule.** Violet means selected, actionable, or focused. Do not use it as ambient decoration across whole screens.

## Typography

The display and body family remains HarmonyOS Sans TC with Inter and native UI sans fallbacks. No font binary is shipped; the fallback is the actual supported rendering path, not a claim of pixel-identical Figma typography.

Page titles use the fluid display scale. Surface headings use the headline scale; policy-group titles use the title scale. Body-sized records and controls remain easy to scan, while labels and metadata step down once rather than introducing a new type family. Dashboard totals use bold tabular figures (2.6rem, line-height 1.2); absent counts remain a dash with explanatory text. Question-payload entry retains a UI-monospace stack because it is contract JSON.

## Layout

- **Shell:** the expanded tenant rail is `clamp(13.5rem, 16vw, 17.5rem)` wide above 700px. Its four destinations are Dashboard, Governance, Mock exams, and Intakes. The white Administration header and rail frame the cool-gray content area; existing collapsed-navigation behavior remains intact.
- **Working area:** desktop padding is `clamp(1.5rem, 3.3vw, 3.5rem)` vertically and `clamp(1rem, 3.3vw, 3.5rem)` horizontally, with 4rem bottom space. Shared white surfaces use `clamp(1rem, 2vw, 2rem)` padding. Main headings, filters, and records share the same broad alignment.
- **Dashboard:** four summary cards precede paired Recent activity and Quick actions regions, followed by the intake pipeline. At 1100px the metrics become two columns and the paired regions stack. Below 480px quick actions become a single column; summary cards keep their two-column scan.
- **Governance and intakes:** inline desktop filters sit above full-width tables. People creation/management and ownership transfer use contextual drawers. Governance header shortcuts wrap below 1150px.
- **Mock exams:** templates form a two-column library. The version view uses an 8+4 primary/supporting split with a sticky details region; below 1100px it relaxes to 7+4, and below 850px both library and editor become one column. The composer separates Listening, Reading, and Writing, then Part/Passage/Task navigation within each section.
- **Phones, at 700px and below:** the existing shell becomes bottom navigation. Content padding becomes 1.5rem 1rem 2.5rem. Governance uses compact header shortcuts and a 2×2 section navigation; header prose and shortcut descriptions are hidden. People keeps create/search/filter controls and a usable first record visible in the reviewed phone frame. Secondary People/Audit filters use explicit More filters / Hide filters controls, while desktop filters stay inline. Audit date-time fields fill the available row and reserve calendar-button space. Tables become labeled records, not shrunken desktop columns; drawers and multi-column form fields become full-width. The composer footer becomes static.

These compositions are local to the named Tenant Admin surfaces, not new layout mandates for other roles.

## Elevation & Depth

Borders and tonal layering do the grouping. Tenant working cards are flat at rest. Native dialog drawers use the existing popover shadow and modal backdrop; their right-edge entrance is a short 200ms translation and is removed under reduced motion. Shared button and shortcut color/border changes take 160ms. Keyboard focus is an explicit 2px violet outline with 3px offset.

**The Flat-Until-Meaningful Rule.** A surface earns elevation through hierarchy or temporary overlay behavior. Prefer a border or tonal change for ordinary grouping.

## Shapes

Shared tenant controls use gently curved small corners; cards and policy groups use medium corners. Existing status badges have compact rectangular rounding (.4rem); Part/Passage/Task controls are full pills. Avatar silhouettes remain circular. Controls have at least a 2.75rem target; text inputs are at least 2.875rem high. These are observed tenant variants, not replacements for the global control defaults.

Drawers use the right viewport edge, `min(42rem, 100vw)` width, and full dynamic-viewport height. Media upload regions use a dashed strong border to signify the actual drop/input region, not decorative card treatment.

## Components

- **Buttons:** semibold violet primary actions, white outlined secondary actions, low-emphasis violet text utilities, and separate danger feedback. Primary hover deepens; secondary hover uses the subtle surface and stronger border. Disabled actions reduce opacity and retain their reason in the surrounding content.
- **Fields and filters:** visible labels, neutral strokes, white fill, and explicit focus. People uses the accessible label “Search by name or email” and the placeholder “Name or email.” Responsive secondary-filter disclosure exposes expanded/control relationships. Audit has contracted selectors/date-time filters, not invented free-text search.
- **Navigation:** underline-selected Governance sections are People, Course ownership, Alert rules, and Audit, with `aria-current` on the current section. Shell navigation retains violet-on-mist selection and the four tenant destinations. Paths are owned by `tenantNavigation.ts`, not by this document or the sidecar specimens.
- **Records and drawers:** name/email hierarchy, real identity badges, account-state text, and contextual actions support scanning. Phone records retain their field labels. Native dialog drawers restore trigger focus; server pagination stays separate from the record body.
- **Dashboard cards:** Total users, Active student accounts, Open intakes, and Published templates use returned totals. Recent activity comes from governance records; pipeline segments describe assigned/unassigned intakes. Missing or partial counts are unavailable, never zero-filled or invented.
- **Policy groups:** three policy modes precede eight expandable groups. Collapsed summaries show actual thresholds or check states; each changed group shows Unsaved changes. Unreturned system values stay unavailable, and a pending switch to system mode never relabels prior custom values as platform defaults.
- **Exam workspace:** version lifecycle controls accompany the section list. Multiple Part/Passage/Task drafts are validated and reviewed before one complete-section POST. Saved sections are visibly read-only because the consumed API is create-only. Browser-tab draft retention is explicitly local, keyed to the account/template/version, and distinct from a server save. Media controls send media IDs; generic question payloads remain explicit contract JSON.

The companion `.impeccable/design.json` contains seven self-contained, static component specimens. It is a design-reference preview, not application code, live records, or evidence of successful persistence.

## Do's and Don'ts

### Do

- **Do** reuse the current semantic tokens and preserve the supplied Tenant Admin composition.
- **Do** keep loading, unavailable, error, empty, unsaved, and saved states visibly distinct.
- **Do** preserve mobile record labels, visible focus, and explicit secondary-filter disclosure.
- **Do** keep screenshot fidelity, frontend contract behavior, and authenticated live acceptance separate.

### Don't

- **Don't** infer learning activity from active accounts or count published versions as published templates.
- **Don't** fabricate people photographs, statistics, recent-login dates, or portal versions.
- **Don't** invent arbitrary alert rules, Speaking authoring, or saved-section editing.
- **Don't** promote this route-scoped composition into new global design rules.

The documented independent finish disposition is **ship**, limited to resolution of the three reported mobile-record, date-time-readability, and policy-summary issues. It is not a fresh whole-surface audit or authenticated workflow acceptance. Review captures use synthetic identities at 1714×1216 and 390×844; the detailed test record and live-access limits remain in the scope document. This documentation pass does not add a new testing or deployment claim.
