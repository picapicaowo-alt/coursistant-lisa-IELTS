---
name: X-Learn
description: A calm, role-aware learning operations desk with precise violet wayfinding.
colors:
  surface-page: "#FFFFFF"
  surface-navigation: "#F9F9F9"
  surface-canvas: "#FFFFFF"
  surface-subtle: "#F8FAFC"
  surface-muted: "#EDF2F7"
  surface-brand-subtle: "#E6E3FF"
  dashboard-card: "#F3F4F8"
  assistant-start: "#F6F9FF"
  assistant-end: "#F1EFFF"
  content-primary: "#2D3748"
  content-secondary: "#5D6B7C"
  content-placeholder: "#667085"
  content-on-color: "#FFFFFF"
  border-default: "#E2E8F0"
  border-strong: "#CBD5E0"
  action-primary: "#4835EB"
  action-primary-hover: "#3A4FBF"
  action-primary-active: "#2A3A8F"
  action-secondary: "#7F9CF5"
  feedback-success: "#276749"
  feedback-danger: "#C53030"
  feedback-warning: "#9C4221"
  feedback-info: "#2B6CB0"
  exam-navy-deep: "#1F3350"
  exam-navy: "#2F4A6E"
  exam-line: "#D8DEE8"
typography:
  display:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: "2.5rem"
  headline:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: "1.75rem"
  title:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  body:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: ".875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "HarmonyOS Sans TC, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: ".75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  xs: "5px"
  sm: "10px"
  md: "15px"
  lg: "20px"
  round: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.content-on-color}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.action-primary-hover}"
    textColor: "{colors.content-on-color}"
    rounded: "{rounded.md}"
  input-default:
    backgroundColor: "{colors.surface-canvas}"
    textColor: "{colors.content-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "50px"
  card-default:
    backgroundColor: "{colors.surface-canvas}"
    textColor: "{colors.content-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  dashboard-card:
    backgroundColor: "{colors.dashboard-card}"
    textColor: "{colors.content-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  navigation-active:
    backgroundColor: "{colors.surface-brand-subtle}"
    textColor: "{colors.action-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: X-Learn

## Overview

**Creative North Star: "The Calm Learning Desk"**

X-Learn is a quiet operational workspace where students and staff can see their role, current record, and next action without visual noise. A white page canvas, softly tinted navigation, and cool dashboard cards keep the workspace open while violet remains reserved for direction, selection, and decisive action. The story is not “school software decorated with cards,” but one dependable desk connecting learning activity, advising, assessment, and follow-up.

This is an **Operate** system. Scanability, honest state, and record continuity outrank spectacle. Warmth comes from spacious grouping, rounded working surfaces, restrained assistant tints, human profile cues, and concise copy. MockLab is a deliberate compatibility world: its serif exam-paper voice and navy palette signal examination mode without redefining the rest of X-Learn.

The visual authority for the Student Dashboard is the accessible Figma file `qBAAByIXGNIpoOcilCYISR`, node `17:914` (`Dashborad/student`), a 1440×1024 frame inspected exactly after Dev-seat access. The normative tokens and desktop composition below were verified from that node and the implemented dashboard. Any later Figma discrepancy must be resolved in the token layer, never with a page-local patch.

**Key characteristics:**

- Light, calm operational canvas with compact information density.
- One violet action voice, supported by neutral hierarchy and semantic feedback.
- Role-aware navigation and state-rich, record-driven workspaces.
- Desktop and mobile shells that preserve the same route truth.
- Clear compatibility boundaries for exam mode and legacy surfaces.

## Colors

The frontmatter is the normative portable palette. In Sass, the architecture is strictly **primitive → semantic → compatibility/component**:

1. Palette primitives in `lms/src/styles/_tokens.scss` preserve Figma source values and are never consumed by pages.
2. Semantic tokens (`surface-*`, `content-*`, `border-*`, `action-*`, `feedback-*`) express purpose and are the default API for all new UI.
3. Compatibility aliases (`$brand`, `$text`, `$card-bg`, and similar) keep existing modules compiling while they migrate; they are not an extension API.
4. Component styles compose semantic roles. Runtime CSS custom properties in `tokens.global.scss` bridge inline styles and third-party UI; SCSS Modules use the Sass roles directly.

### Primary

- **Guiding Violet** (`action-primary`): active navigation, primary buttons, selected dates/tabs, links, and visible focus.
- **Deep Interaction Violet** (`action-primary-hover`, `action-primary-active`): interaction states only; never alternate brands.
- **Violet Mist** (`surface-brand-subtle`): active navigation backgrounds, selection, and low-emphasis brand context.

### Neutral

- **Open White Canvas** (`surface-page`, `surface-canvas`): page, header, forms, and elevated work surfaces.
- **Soft Navigation** (`surface-navigation`): the Figma-matched desktop navigation rail.
- **Cool Dashboard Card** (`dashboard-card`): nested exam, alert, and compact dashboard record surfaces.
- **Assistant Wash** (`assistant-start` → `assistant-end`): the established diagonal New Chat panel gradient.
- **Ink Slate** (`content-primary`): headings and primary content.
- **Operational Slate** (`content-secondary`): descriptions and metadata.
- **Structure Lines** (`border-default`, `border-strong`): grouping and control boundaries.

### Accessible semantic departures

The Figma palette remains intact at the primitive layer; accessibility corrections happen at the semantic layer. Small secondary and placeholder copy uses deliberately darker semantic text than the lighter source grays, feedback uses the darker success/danger/warning roles, and keyboard focus uses a visible violet outline/ring rather than a subtle color shift. These are intentional WCAG-oriented departures, not palette drift. Data/category colors may encode content type, but must never impersonate action or status.

**The One Violet Voice Rule.** Violet means selected, actionable, or focused. Do not use it as ambient decoration across whole screens.

**The Semantic Contrast Rule.** Change a usage role when contrast fails; never mutate a Figma primitive or add a local “close enough” color.

## Typography

**Display and body font:** HarmonyOS Sans TC with Inter and native UI sans fallbacks.

HarmonyOS Sans TC is the Figma face, but no font binary is shipped in the repository. The fallback order is therefore part of the implementation contract: HarmonyOS Sans TC → Inter → platform UI sans. Do not claim pixel-identical Figma typography unless a licensed, checked-in font asset is added and verified. MockLab alone uses Georgia/Times for its exam masthead and paper-like headings.

### Hierarchy

- **Display:** primary page/auth title; bold, compact, and used once per surface.
- **Headline:** workspace welcome and prominent card headings.
- **Title:** card, panel, and section titles.
- **Body:** controls, records, instructions, and ordinary reading copy.
- **Label:** metadata, eyebrow text, helper copy, and compact navigation captions; uppercase only for deliberate eyebrows and exam kickers.

Use weights 400/500/600/700 for regular, medium, semibold, and bold. Keep operational prose readable and sentence-cased; reserve wide tracking for the X-Learn wordmark, eyebrows, and MockLab’s examination-room kicker.

**The Fallback Is Real Rule.** Test wrapping and truncation with the fallback stack; do not tune layouts to a locally installed HarmonyOS font alone.

## Layout

The app shell owns the viewport. In the authoritative 1440×1024 Student Dashboard frame, the desktop sidebar is exactly 180px and the header is exactly 88px. Dashboard content begins at x=204 and uses three exact columns: 336px New Chat, 558px main work, and 270px schedule/alerts, separated by 23px then 19px gutters. The resulting 1206px dashboard grid is the desktop reference composition, not a proportional approximation.

Responsive dashboard transitions are fixed at 1280px, 900px, and 620px. At 1280px and below, New Chat and the main work column form two fluid columns while the former right rail spans both and becomes a wide/narrow two-column row. At 900px and below, every dashboard region becomes one column in source order. At 620px and below, panels become content-height, assignment/task metadata is progressively removed from the visual grid, and exams stack one per row. Preserve the underlying labels and destinations when compacting.

At 700px and below, the sidebar becomes a fixed bottom navigation with safe-area padding and the header compresses to 4.75rem. Main content reserves the same bottom height so actions and records are never hidden. Header metadata progressively collapses: the “Workspace” eyebrow and email disappear first; the account name may disappear below 430px.

Student navigation follows the inspected Figma order exactly: **Dashboard, My Courses, Study Plan, Exams, AI ChatBot, Calendar**. This list controls navigation exposure; it is not an authorization allowlist, and other role-authorized direct routes remain routable.

Mobile navigation is route-driven, not a separate information architecture. For the six Student destinations, Dashboard, My Courses, and Study Plan remain visible; **More** occupies the fourth slot; Exams remains in the fifth slot; and More contains AI ChatBot and Calendar. The panel is a two-column, scrollable surface above the navigation with a backdrop, explicit close control, active-route treatment, a 65dvh/30rem height ceiling, and automatic close after navigation. Never silently drop a role-authorized destination to make the bar fit.

Dense desktop structures must adapt, not merely shrink: grids become stacks, calendar months become day cards, two-column auth forms become one column, and side-by-side workspaces become vertical sections. Preserve document order, route meaning, and the 44px interaction floor.

**The One Scroll Owner Rule.** The shell main element is the application scroll container; nested scrolling is reserved for bounded lists, conversations, and popovers.

## Elevation & Depth

Depth is restrained and structural. Borders and tonal layering do most of the work; shadows distinguish movable, selected, or raised surfaces rather than decorating every container.

### Shadow vocabulary

- **Small surface:** `0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.10)` for compact cards and pagination containers.
- **Raised card:** `0 4px 6px -2px rgba(0,0,0,.05), 0 10px 15px -3px rgba(0,0,0,.05)` for substantial cards, auth panels, and profile surfaces.
- **Popover:** `0 12px 32px rgba(45,55,72,.14)` for profile menus and the mobile More panel.
- **Selected:** violet 1px ring plus a faint violet 8px ambient shadow for selected objects that need more than a fill.

**The Flat-Until-Meaningful Rule.** A surface earns elevation through hierarchy or temporary overlay behavior. Prefer a border or tonal change for ordinary grouping.

## Shapes

The system uses gently curved geometry: 5px for tiny details, 10px for compact controls and navigation, 15px for standard inputs/cards, 20px for prominent surfaces and overlays, and full pills/circles for avatars, status chips, and compact filters. Borders are usually 1px and neutral; dashed borders indicate placeholders or intentionally empty drop zones, not decoration.

Large gradients are rare and purposeful: the profile cover signals identity, assistant tints distinguish AI workspaces, and MockLab’s navy paper family signals exam mode. Do not introduce a new silhouette, corner scale, or gradient family within a page.

## Components

### Buttons

- Primary buttons use Guiding Violet, white text, semibold body type, the standard 50px control height, and a 15px radius. Hover deepens and lifts by 1px; active returns to rest; disabled keeps the label readable while visibly reducing emphasis.
- Secondary buttons use a working-white or subtle surface with a neutral border. Ghost actions are reserved for low-emphasis utilities and must retain a visible hover/focus state.
- Destructive buttons use the danger semantic role and explicit language; never recolor the primary action without changing its meaning.

### Cards / Containers

- Standard cards use Working White, a neutral 1px border, 15px or 20px corners, and 16–24px internal padding.
- Use subtle fills for nested records instead of stacking shadows. Assistant cards may use the established cool tint; exam cards use only the `exam-*` compatibility family.
- Loading, empty, error, and partial-data states occupy the same structural region as successful content so the layout does not jump or misrepresent absence.

### Inputs / Fields

- Standard inputs are 50px high with 16px horizontal padding, a 1px neutral border, and 15px corners.
- Focus changes the border to Guiding Violet and adds the semantic focus ring. Error changes the border/message to danger and connects help/error copy with `aria-describedby`.
- Labels remain visible. Placeholder text is an example or hint, never the only label. Icon controls retain a 44px target and an accessible name.

### Chips / Tabs

- Pills filter or describe; they do not substitute for primary actions. Selected tabs use violet text plus an underline or filled state and expose `aria-pressed`, `aria-selected`, or equivalent semantics.
- Category colors encode stable course/content categories only. Always pair them with text or another non-color cue.

### Navigation

- Desktop navigation uses line icons, medium body labels, 10px corners, and violet-on-mist active state with `aria-current="page"`.
- The Student desktop order is Dashboard, My Courses, Study Plan, Exams, AI ChatBot, Calendar; keep labels and order aligned with Figma while leaving authorized direct routes reachable.
- Header profile navigation exposes expanded/control relationships, closes on outside pointer or Escape, and restores focus after Escape.
- Mobile More follows the shell behavior in Layout. The backdrop and close button are real controls; opening state must be programmatically exposed.

### Status and feedback

- Loading is explicit and sets busy/live semantics where content updates. Error is not styled as empty; actionable failures use `role="alert"` or an appropriate live region and expose retry when supported.
- Empty states state what is absent and, when allowed, the next action. Disabled actions preserve the reason nearby. Never display a success state before the underlying record succeeds.

### MockLab compatibility surface

MockLab may use its `exam-*` navy, paper wash, serif typography, and examination-room kicker. It still inherits shell navigation, semantic feedback, touch targets, focus behavior, and reduced-motion support. Do not spread MockLab typography or navy into ordinary X-Learn workspaces.

## Do's and Don'ts

### Do

- **Do** add a new primitive only when a real source value is missing, then expose a purpose-named semantic role before component use.
- **Do** consume semantic Sass tokens in SCSS Modules and `--xl-*` semantic custom properties in inline/third-party contexts.
- **Do** preserve separate loading, empty, partial, error, disabled, selected, and success states with text and accessible semantics.
- **Do** verify desktop and mobile composition, keyboard focus, zoom/reflow, long labels, reduced motion, and role-specific navigation whenever extending a shared shell or component.
- **Do** keep Figma authority, frontend API truth, and live-environment acceptance as separate evidence boundaries.

### Don't

- **Don't** add raw colors, shadow literals, one-off radii, or scattered responsive patches to a page. Add or reuse a semantic token and a coherent breakpoint rule.
- **Don't** create new compatibility aliases. Existing aliases are migration bridges; when touching a legacy module, prefer moving it toward semantic roles.
- **Don't** treat data/category colors as actions, or use violet decoratively until its interaction meaning becomes ambiguous.
- **Don't** hide authorized routes on mobile, shrink controls below 44px, remove visible labels, or rely on hover/color alone.
- **Don't** generalize a page-specific visual family—especially MockLab, profile gradients, or assistant tints—into a system-wide default.

### QA and evidence boundary

The checked-in review set covers desktop and mobile rendering for login, signup, dashboard, courses, calendar, AI Workplace, MockLab, profile, and study plan, plus the mobile More panel. It demonstrates responsive composition and representative loading/error/empty states, not exhaustive role, browser, keyboard, screen-reader, zoom, localization, or real-data acceptance.

The review routes use mock fixtures. Several screenshots intentionally show unavailable or “No preview fixture” responses; these are honest state evidence, not backend defects proven by this frontend review. Screenshot success does not prove authenticated business workflows, contract completeness, persistence, authorization, or Dev/Prod behavior. Validate those separately against the intended real environment and role account. Figma node `17:914` was inspected exactly and is authoritative for the Student Dashboard; that exact inspection does not imply that unrelated role frames or every component variant were part of this dashboard review.
