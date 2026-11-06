# Design

Leave Desk is sold as a product (leave management a team does not have to build) and used as a daily work tool. The design has to look credible on the landing page and stay out of the way inside the app.

## Stack
Vite + React 18, Tailwind CSS 3, and shadcn/ui-style components (Radix primitives, `class-variance-authority`, `tailwind-merge`) in `client/src/ui/`. Icons are Lucide. Fonts are self-hosted through Fontsource, so the strict Content-Security-Policy (`font-src 'self'`, no third-party requests) is untouched.

This is deliberately not Next.js. The Express server serves the built client, so a single Node process hosts everything (Railway, Docker); Next.js would add a second server for a product with one public page.

## Direction
Warm paper and ink, one accent, an editorial serif for big headlines and a precise sans for everything you read or click. The reference points were Linear and Cal.com for restraint, Stripe for clear product storytelling, and GOV.UK for plain language. The landing page shows the real product (a request card built from the app's own components) instead of illustrations.

What it avoids on purpose: gradients, glows and blurred blobs, glassmorphism, emoji as icons, stock illustrations, invented logos, testimonials or statistics, and filler text.

## Type
- Display: Instrument Serif, for page titles and landing headlines only.
- Body and UI: Geist Variable.
- Base size 17px. A text-size control (Standard, Larger, Largest) scales the whole interface because all sizes are `rem`.

## Colour (CSS variables in `client/src/index.css`)
- Neutrals are warm: paper `#faf8f4`-ish background in light, near-black warm grey in dark.
- Primary action is ink (the foreground colour). The single brand accent is a deep teal, used for the brand mark, focus ring, key buttons and small highlights.
- Status colours (amber, blue, purple, green, red, grey) each have a text colour and a tint, re-chosen for dark mode, and always appear with an icon and a word:

| Status | Colour | Icon |
|---|---|---|
| Pending manager | Amber | Clock |
| Awaiting HOD | Blue | Hourglass |
| Info requested | Purple | Question |
| Approved | Green | Check |
| Rejected | Red | Cross |
| Cancelled | Grey | Ban |

## Themes
Light and dark, with a header button to flip between them. The first visit follows the operating system; the choice is then remembered. A tiny script (`public/theme-init.js`) applies the saved theme before first paint, so there is no flash. Text size is remembered the same way.

## Layout
- Landing: hero with a live-looking request, rules strip, three-step explainer, feature grid, roles, three ways to get started, FAQ, closing call to action.
- Sign-in: form first, one-click demo accounts below it, each with a one-line description of what that person can show.
- App: sticky header (brand, navigation, text size, theme, account menu); lists as cards with a status-coloured edge; detail pages with the decision panel beside the story; apply page with a live summary (day count, what happens next, document rule).
- One breakpoint set (`sm`, `md`, `lg`); navigation becomes a scrolling row on phones.

## Accessibility built in
- Visible focus ring everywhere, skip links, 44px touch targets, labels on every field, errors announced with `role="alert"`.
- Colour is never the only signal; contrast is chosen for WCAG AA or better in both themes.
- Motion is limited to a short entrance and small hover movement, and is disabled for `prefers-reduced-motion`.
- The account and text-size menus use Radix with `modal={false}` so no inline style tags are injected (the CSP forbids them).

## Placeholders to fill before going public
`client/src/site.js` has `CONTACT_EMAIL`. Empty, the "We run it for you" card links to the demo; set it and the card becomes a "Get in touch" email link. There are no prices on purpose; add a pricing section when real plans exist.
