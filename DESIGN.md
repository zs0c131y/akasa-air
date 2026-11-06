# Design

Leave Desk is a work tool used by people who want to finish a task and leave. The design aims for calm, readable and predictable, not decorative.

## Principles
1. **Status is never colour alone.** Every status shows colour, an icon and a word (`StatusChip`). This also covers colour-blind users and print.
2. **One action per screen.** Each page has one primary button; secondary actions are outlined, destructive ones are red.
3. **Say what happened and what to do next.** Errors show a plain message plus a hint (`ErrorBox`, `ErrorScreen`).
4. **Large targets.** Buttons and inputs are at least 44px tall.
5. **Works without hover, mouse or a wide screen.**

## Tokens (`client/src/styles.css`)
All colours, radii and shadows are CSS variables on `:root`, so a theme is a single block.

| Token group | Notes |
|---|---|
| Surfaces | `--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong` |
| Text | `--ink`, `--muted` (still 4.5:1 on its background) |
| Brand | `--accent` (deep teal-blue), `--accent-hover`, `--focus` |
| Status | amber, blue, purple, green, red, grey; each has a text colour and a tint, 4.5:1 or better together |
| Shape | `--radius` 12px, `--radius-sm` 8px; two shadow levels |
| Type | system sans for UI; a serif stack for headings and the brand to give some character without loading web fonts |

Dark theme is automatic via `prefers-color-scheme`; the status colours are re-picked (lighter text on dark tints), not just inverted.

## Status colours
| Status | Colour | Icon |
|---|---|---|
| Pending manager | Amber | ◔ |
| Awaiting HOD | Blue | ◑ |
| Info requested | Purple | ? |
| Approved | Green | ✓ |
| Rejected | Red | ✕ |
| Cancelled | Grey | – |

Request cards repeat the colour as a left border. Badges mark long leave (blue), emergency (red) and documents due (amber).

## Layout
- Content column max 920px; forms 660px; sign-in 460px.
- Sticky header with brand, navigation, and the signed-in person (initials avatar, role pill).
- Request list = stacked cards; detail page = summary card, document list, timeline, then actions.
- One breakpoint at 560px: forms go single column, button groups go full width, header wraps.

## Accessibility built into the design
- Visible 3px focus ring on every control; skip-to-content link.
- Labels attached to every input; errors announced with `role="alert"`.
- `prefers-reduced-motion` turns transitions off. Print hides navigation and action buttons.
- No web fonts or external assets, so the strict CSP stays tight and the page paints fast.

## Possible next steps
Text-size control, a high-contrast theme, and an automated axe audit (see backlog in the README).
