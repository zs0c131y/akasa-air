import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ClipboardCheck, FileCheck2, History, Keyboard, LifeBuoy, ShieldCheck, Smartphone, Sun, UserRound, UsersRound, Crown,
} from 'lucide-react';
import { Avatar, StatusChip, Wordmark } from '../components.jsx';
import { TextSizeMenu, ThemeToggle } from '../theme.jsx';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { CONTACT_EMAIL } from '../site.js';
import { cn } from '../lib/utils.js';

const NAV = [['How it works', '#how'], ['Features', '#features'], ['Roles', '#roles'], ['FAQ', '#faq']];

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container flex h-16 items-center gap-6">
        <Link to="/" aria-label="Leave Desk home" className="rounded-md"><Wordmark /></Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">{label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/login">Sign in</Link></Button>
          <Button asChild variant="brand"><Link to="/login">Try the demo</Link></Button>
        </div>
      </div>
    </header>
  );
}

/** A real-looking request, built from the same parts as the app, so the page shows the product and not a drawing of it. */
function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative">
      <div className="rounded-xl border bg-card shadow-lift">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar name="Arjun Sharma" />
            <div>
              <p className="font-semibold leading-tight">Arjun Sharma</p>
              <p className="text-sm text-muted-foreground">26 Nov to 1 Dec · 5 days</p>
            </div>
          </div>
          <StatusChip status="PENDING_HOD" />
        </div>
        <div className="space-y-4 px-5 py-4">
          <p>Surgery and recovery for my father.</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="blue">Long leave</Badge>
            <Badge variant="outline">discharge-summary.pdf</Badge>
          </div>
          <ol className="relative ml-1.5 space-y-4 border-l pl-5 text-sm">
            <li className="relative">
              <span className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full bg-brand" />
              <p><strong className="font-semibold">Submitted</strong> <span className="text-muted-foreground">by Arjun Sharma</span></p>
            </li>
            <li className="relative">
              <span className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full bg-brand" />
              <p><strong className="font-semibold">Approved</strong> <span className="text-muted-foreground">by Rahul Mehta, Manager</span></p>
              <p className="mt-1.5 rounded-md border-l-2 border-brand bg-secondary px-3 py-1.5">Approved at manager level.</p>
            </li>
            <li className="relative text-muted-foreground">
              <span className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-input bg-card" />
              Waiting for Priya Nair, HOD
            </li>
          </ol>
        </div>
        <div className="flex gap-2 border-t bg-secondary/60 px-5 py-4">
          <span className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-status-green-fg text-sm font-medium text-background"><Check className="size-4" />Approve</span>
          <span className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-input bg-card text-sm font-medium">Ask for more information</span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="container grid gap-14 pb-20 pt-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
      <div className="animate-rise">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground">
          <span className="size-2 rounded-full bg-brand" aria-hidden="true" /> Leave management, ready to use
        </p>
        <h1 className="font-display text-[3.4rem] leading-[0.95] tracking-tight sm:text-7xl lg:text-[5.4rem]">
          Leave management you <em className="text-brand">don&rsquo;t</em> have to build.
        </h1>
        <p className="mt-7 max-w-xl text-lg text-muted-foreground">
          Employees ask, managers decide, and the HOD signs off long leave. Documents, approvals and the audit trail are already handled. Open it, invite your people, and you are running.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" variant="brand"><Link to="/login">Try the live demo <ArrowRight /></Link></Button>
          <Button asChild size="lg" variant="outline"><a href="#how">See how it works</a></Button>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {['Nothing to install to try it', 'Your leave policy, built in', 'Works on any phone'].map((t) => (
            <li key={t} className="inline-flex items-center gap-2"><Check className="size-4 text-brand" aria-hidden="true" />{t}</li>
          ))}
        </ul>
      </div>
      <div className="animate-rise [animation-delay:120ms]"><ProductPreview /></div>
    </section>
  );
}

const FACTS = [
  ['More than 3 days', 'Needs a document, and both the manager and the HOD approve.'],
  ['Emergency leave', 'File now, send documents afterwards, within clear limits.'],
  ['Sundays', 'Never counted against anyone’s leave.'],
  ['Every action', 'Written to a log that nobody can edit or delete.'],
];

function Facts() {
  return (
    <section aria-label="Rules built in" className="border-y bg-card">
      <dl className="container grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map(([t, d]) => (
          <div key={t} className="py-7 sm:px-6 sm:first:pl-0 lg:py-9">
            <dt className="font-display text-3xl tracking-tight">{t}</dt>
            <dd className="mt-2 text-sm text-muted-foreground">{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SectionHead({ eyebrow, title, children }) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
      <h2 className="font-display text-4xl leading-[1.02] tracking-tight sm:text-6xl">{title}</h2>
      {children && <p className="mt-5 text-lg text-muted-foreground">{children}</p>}
    </div>
  );
}

const STEPS = [
  ['01', 'Someone asks', 'They pick dates, give a reason and attach a document if the leave is long. The day count and what happens next update as they type.', 'PENDING_MANAGER'],
  ['02', 'The manager decides', 'Approve, reject with a reason, or ask a question. For anything over 3 days the request moves on to the HOD.', 'PENDING_HOD'],
  ['03', 'Everyone knows', 'The employee sees the outcome and the comments. Every step is already in the audit log.', 'APPROVED'],
];

function HowItWorks() {
  return (
    <section id="how" className="container py-24 lg:py-32">
      <SectionHead eyebrow="How it works" title="Three steps, no chasing.">
        The request carries its own status, so nobody has to ask where it is.
      </SectionHead>
      <ol className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
        {STEPS.map(([n, t, d, s]) => (
          <li key={n} className="flex flex-col bg-card p-7 lg:p-9">
            <span className="font-display text-6xl leading-none text-muted-foreground/60" aria-hidden="true">{n}</span>
            <h3 className="mt-8 text-xl font-semibold tracking-tight">{t}</h3>
            <p className="mt-2 flex-1 text-muted-foreground">{d}</p>
            <div className="mt-6"><StatusChip status={s} /></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tile({ className, icon: Icon, title, children }) {
  return (
    <div className={cn('flex flex-col rounded-xl border bg-card p-6 shadow-soft lg:p-8', className)}>
      <span className="mb-5 grid size-10 place-items-center rounded-lg bg-secondary text-brand"><Icon className="size-5" aria-hidden="true" /></span>
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="border-y bg-secondary/50 py-24 lg:py-32">
      <div className="container">
        <SectionHead eyebrow="What you get" title="The rules are the product.">
          Most of the work in leave management is the edge cases. They are handled, tested, and explained to the person in front of the screen.
        </SectionHead>
        <div className="grid gap-4 md:grid-cols-6">
          <Tile className="md:col-span-4" icon={ClipboardCheck} title="Two-level approval that enforces itself">
            <p className="mt-2 max-w-lg text-muted-foreground">Short leave needs the manager. Anything over 3 days goes to the HOD after the manager. Managers’ own leave goes straight to the HOD. Nobody can skip a step or approve their own request.</p>
            <div aria-hidden="true" className="mt-7 flex flex-wrap items-center gap-2.5">
              <Badge variant="outline" className="h-8 px-3 text-sm">Employee</Badge><ArrowRight className="size-4 text-muted-foreground" />
              <StatusChip status="PENDING_MANAGER" /><ArrowRight className="size-4 text-muted-foreground" />
              <StatusChip status="PENDING_HOD" /><ArrowRight className="size-4 text-muted-foreground" />
              <StatusChip status="APPROVED" />
            </div>
          </Tile>
          <Tile className="md:col-span-2" icon={FileCheck2} title="Documents, checked up front">
            <p className="mt-2 text-muted-foreground">A friendly message appears before the request is sent, not a rejection days later.</p>
            <p aria-hidden="true" className="mt-5 rounded-lg border-l-2 border-status-red-fg bg-status-red-bg p-3 text-sm text-status-red-fg">Leave longer than 3 days needs a supporting document. Please attach one, for example a medical certificate.</p>
          </Tile>
          <Tile className="md:col-span-2" icon={LifeBuoy} title="Emergency leave, with limits">
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />Over 3 days can be filed without documents.</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />Documents are due before the person is back.</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />Two leaves owing documents block any more.</li>
            </ul>
          </Tile>
          <Tile className="md:col-span-2" icon={History} title="An audit log you can trust">
            <p className="mt-2 text-muted-foreground">Sign-ins, decisions, document views and denied attempts, with who and when. The HOD can search it. Nobody can change it.</p>
          </Tile>
          <Tile className="md:col-span-2" icon={ShieldCheck} title="Private by default">
            <p className="mt-2 text-muted-foreground">People only see what their role allows. Sessions use protected cookies, accounts lock after repeated failures, and files are checked by content, not name.</p>
          </Tile>
          <Tile className="md:col-span-6" icon={Keyboard} title="Comfortable for everyone">
            <div className="mt-2 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
              <p className="max-w-2xl text-muted-foreground">Light and dark themes, three text sizes, full keyboard use, large tap targets, and status shown with words and icons, never colour alone. It reads well on a phone between meetings.</p>
              <div aria-hidden="true" className="flex items-center gap-2">
                <Badge variant="outline" className="h-9 px-3 text-sm"><Sun className="size-4" />Light and dark</Badge>
                <Badge variant="outline" className="h-9 px-3 text-sm"><Smartphone className="size-4" />Phone ready</Badge>
              </div>
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}

const ROLES = [
  [UserRound, 'Employee', ['Apply with a live day count', 'Attach documents', 'Follow every request and its history', 'Answer questions from the approver', 'Edit or cancel while it is pending']],
  [UsersRound, 'Manager', ['A queue of what needs deciding', 'Approve, reject with a reason, or ask', 'Open attached documents', 'See your team’s requests', 'Your own leave goes to the HOD']],
  [Crown, 'Head of Department', ['Final approval on long leave', 'See every request', 'Search the full audit log', 'Own leave is approved automatically and flagged', 'One place to see what happened']],
];

function Roles() {
  return (
    <section id="roles" className="container py-24 lg:py-32">
      <SectionHead eyebrow="Who uses it" title="One tool, three views." />
      <div className="grid gap-4 md:grid-cols-3">
        {ROLES.map(([Icon, name, items]) => (
          <div key={name} className="rounded-xl border bg-card p-7 shadow-soft">
            <Icon className="size-6 text-brand" aria-hidden="true" />
            <h3 className="mt-5 font-display text-3xl tracking-tight">{name}</h3>
            <ul className="mt-5 space-y-3">
              {items.map((i) => (
                <li key={i} className="flex gap-2.5 text-muted-foreground"><Check className="mt-1 size-4 shrink-0 text-brand" aria-hidden="true" />{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Offer() {
  const cta = CONTACT_EMAIL
    ? <Button asChild variant="outline"><a href={`mailto:${CONTACT_EMAIL}`}>Get in touch</a></Button>
    : <Button asChild variant="outline"><Link to="/login">See it first</Link></Button>;
  return (
    <section className="border-y bg-secondary/50 py-24 lg:py-32">
      <div className="container">
        <SectionHead eyebrow="Get started" title="Use it your way." />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col rounded-xl border bg-card p-7 shadow-soft">
            <h3 className="text-xl font-semibold tracking-tight">Try it now</h3>
            <p className="mt-2 flex-1 text-muted-foreground">Nine demo people with requests in every state. Click a name and you are in.</p>
            <Button asChild variant="brand" className="mt-7"><Link to="/login">Open the demo <ArrowRight /></Link></Button>
          </div>
          <div className="flex flex-col rounded-xl border bg-card p-7 shadow-soft">
            <h3 className="text-xl font-semibold tracking-tight">Run it yourself</h3>
            <p className="mt-2 flex-1 text-muted-foreground">Open source MERN code with a Docker setup, a hosting guide, and a full test suite. Bring your own MongoDB.</p>
            <code className="mt-7 block rounded-md bg-secondary px-3 py-2.5 text-sm">docker compose up</code>
          </div>
          <div className="flex flex-col rounded-xl border bg-card p-7 shadow-soft">
            <h3 className="text-xl font-semibold tracking-tight">We run it for you</h3>
            <p className="mt-2 flex-1 text-muted-foreground">Your own space for your team, with your people loaded in, so there is nothing to set up or look after.</p>
            <div className="mt-7">{cta}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ['Do we have to build or configure anything?', 'No. The approval flow, document rules, emergency rules and audit log are already in place. To try it, open the demo. To use it, add your people.'],
  ['Who approves what?', 'The manager approves leave of up to 3 days. Longer leave needs the manager and then the HOD. Managers’ own leave is approved by the HOD.'],
  ['How are days counted?', 'Every calendar day from the start date to the end date, including both, except Sundays. A request that only covers Sundays is not accepted.'],
  ['What if it is a real emergency?', 'The person can submit leave over 3 days without documents and send them afterwards. If two such leaves are still waiting on documents, no more leave can be filed until they are sent.'],
  ['Is our data safe?', 'People only see what their role allows. Sign-in uses protected cookies and rotating tokens, repeated failed sign-ins lock the account for a while, uploads are checked, and every action is written to an audit log.'],
];

function Faq() {
  return (
    <section id="faq" className="container py-24 lg:py-32">
      <SectionHead eyebrow="Questions" title="Good to know." />
      <div className="max-w-3xl divide-y border-y">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border text-lg leading-none transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 max-w-2xl text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="container pb-24">
      <div className="grain rounded-2xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-12 lg:py-24">
        <h2 className="mx-auto max-w-3xl font-display text-4xl leading-[1.02] tracking-tight sm:text-6xl">See a full approval in two minutes.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg opacity-75">Sign in as an employee, apply for leave, then switch to the manager and the HOD to approve it.</p>
        <Button asChild size="lg" variant="secondary" className="mt-9"><Link to="/login">Try the live demo <ArrowRight /></Link></Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="container flex flex-wrap items-center justify-between gap-6 py-8">
        <Wordmark />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {NAV.map(([label, href]) => <a key={href} href={href} className="py-2 hover:text-foreground">{label}</a>)}
          <Link to="/login" className="py-2 hover:text-foreground">Sign in</Link>
        </nav>
        <div className="flex items-center gap-1"><TextSizeMenu /><ThemeToggle /></div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Hero />
        <Facts />
        <HowItWorks />
        <Features />
        <Roles />
        <Offer />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
