# Design

Layover is Akasa Air's leave desk. People use it to ask for time off; managers and the head of department use it to answer. It is also a product we can show to other teams, so the public page has to explain itself and let people try it in one click.

This file is the spec for the interface. Read it before changing a screen.

## Stack
Vite + React 18 (plain JavaScript), Tailwind CSS 3, shadcn/ui-style components in `client/src/ui/` (Radix primitives, `class-variance-authority`, `tailwind-merge`), Lucide icons, GSAP for motion, Three.js for the one 3D piece. Fonts are bundled with Fontsource (Archivo, IBM Plex Mono), so the strict CSP (`default-src 'self'`, no inline `<style>`) holds. Not Next.js: Express serves the built client, so one Node process hosts everything.

## Where the look comes from
Three sources, mixed:
1. **The first redesign we shipped**: warm off-white paper, near-black ink, rounded white cards with hairline borders, status chips with icon + word.
2. **A product page we liked (Tessera)**: a dark hero built around a real piece of product UI that moves, then calm light sections with plain-spoken headlines, flat illustrated people, four-up value rows with a coloured top rule, numbered steps, mock UI panels beside short copy, a "pick a seat" demo picker, small monospace labels.
3. **Akasa Air's colour**: orange. It is the only accent.

What we do not do: gradients, glows, blobs, glassmorphism, emoji as icons, stock illustration, invented customer logos, invented statistics or testimonials, lorem ipsum, centred-everything template layouts, or icon-in-a-rounded-square feature tiles.

## Brand
- Header lockup: Akasa Air logo (file at `client/public/brand/akasa-air-logo.png`, the official mark on a transparent background) + "Akasa Air", then a thin divider and "Layover". `Brand` in `components.jsx`.
- Favicon is a separate generic mark (`client/public/favicon.svg`), deliberately not the Akasa logo.

## Type
- Archivo (variable) for everything readable. Headings use `.font-display` (700, tight tracking). Body 17px base (16px minimum); the text-size control scales all `rem`.
- IBM Plex Mono for small labels, dates, ids (`.kicker`, `font-mono`). Keep it to short strings.
- No serif.

## Colour
Tokens are CSS variables in `client/src/index.css`, mapped in `tailwind.config.js`.
- Light is the default theme (the visitor can switch; the choice is remembered). Light = off-white `background`, white `card`.
- Dark = near-black. Parts of the public page (hero, footer, closing call to action) are always dark: wrap them in an element with `className="dark"` and the tokens flip inside it.
- Accent: `flame` (vivid orange, use as a fill with `flame-foreground` dark text) and `brand` (a darker orange that is safe for text and for buttons with white text in light mode; bright orange in dark).
- Status colours (`status-amber|blue|purple|green|red|grey` with `-fg` and `-bg`) are only for request status and validation. Status is always colour + icon + word (`StatusChip`).

## Shape and depth
12px radius on cards, 9px on buttons and inputs (`rounded-md`), pills (`rounded-full`) for chips and avatars. Cards are white with a 1px `border-border` and, at most, `shadow-soft`. Mock UI panels on the public page may use `shadow-lift`. No heavy 2px outlines.

## People
`Person` / `Avatar` draws a flat illustrated face from a name (stable per name). Use `Avatar` wherever a person appears: lists, request pages, sign-in picker, role cards. Never initials-in-a-circle.

## Motion (GSAP, `client/src/motion.js`)
Purposeful only: the hero mockup plays a short loop (a card moves from the manager's column to the HOD's with a cursor and a name tag, then an activity line appears), sections ease in once on scroll, numbers count up once. Everything stops for `prefers-reduced-motion`; content must be fully readable with no animation. Nothing moves on the signed-in screens except small hover and focus transitions.

## 3D (Three.js, `client/src/Globe.jsx`)
One flat, textureless route globe (graticule + domestic arcs + small travelling dots), lazy-loaded, used in a single dark panel on the public page, never as a background gag. It pauses off-screen and for reduced motion, and renders nothing without WebGL.

## Copy voice
Write like a person at the company explaining it to a colleague.
- Short, concrete sentences. Say what happens, who does it, and when. Use real examples (a wedding in Jaipur, a flight booking, Diwali).
- Second person ("you"). Contractions are fine.
- No filler claims. Do not write "seamless", "streamline", "empower", "effortless", "robust", "powerful", "cutting-edge", "unlock", "elevate", "game-changer", "all-in-one", "ready to use". No "not just X, but Y". No stacks of three adjectives. Avoid em dashes; use a full stop or a comma.
- Do not open sections with a rhetorical question. Do not end headlines with "." on every line as a rhythm trick; vary them.
- Errors and hints explain what to do next in plain words.
- If you cannot say something true and specific, leave it out.

## Accessibility (non-negotiable)
Visible focus ring, skip link, 44px touch targets, labelled fields, errors with `role="alert"`, status never by colour alone, WCAG AA contrast in both themes, full keyboard use, reduced-motion respected, text-size control (Standard / Larger / Largest) and theme switch in every header, no web fonts or scripts from other origins.

## Product behaviour the UI must show (do not change the rules, only present them)
- A request over 3 leave days needs a supporting document and approval from the manager, then the HOD. Up to 3 days: manager only.
- **Sundays and public holidays are never counted.** Show the count and, in words, what was left out ("4 days · 1 Sunday and Gandhi Jayanti are not counted"). Helpers: `leaveBreakdown`, `excludedSummary` (in `@lms/shared`). Requests carry `excluded: { sundays, holidays: [{date,name}] }`.
- The holiday calendar is kept by the HOD (`/api/holidays`: GET all roles; POST and DELETE HOD only). Fixed-date national holidays are seeded; moving ones (Diwali, Eid) are added by the HOD.
- **The document upload box appears only when the leave is long (over 3 counted days).** Never show it for short leave, on the form or on the request page. The server also refuses documents on short leave.
- Emergency leave (long only): can be filed without documents; they fall due before the person is back; two owing block new leave.
- Audit log is HOD-only; entries cannot be edited. New events: `HOLIDAY_ADDED`, `HOLIDAY_REMOVED`.

## Pages
Public: `/` landing, `/login` sign-in with one-click demo people. Signed in: `/apply`, `/leaves/:id/edit`, `/mine`, `/queue`, `/team`, `/leaves/:id`, `/holidays`, `/audit`.

## Placeholders to fill before going public
`client/src/site.js` has `CONTACT_EMAIL`. Empty, the "have it run for you" card links to the demo. There are no prices on purpose.
