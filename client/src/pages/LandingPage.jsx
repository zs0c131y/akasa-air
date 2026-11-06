import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { LONG_LEAVE_THRESHOLD_DAYS } from '@lms/shared';
import { Avatar, Brand } from '../components.jsx';
import { TextSizeMenu, ThemeToggle } from '../theme.jsx';
import { Button } from '../ui/button.jsx';
import { CONTACT_EMAIL } from '../site.js';
import { heroIntro, useLandingMotion } from '../motion.js';
import { cn } from '../lib/utils.js';
import { HeroBoard } from '../landing/HeroBoard.jsx';
import { ApplyPanel, ApprovalPanel, CalendarPanel, NetworkPanel } from '../landing/panels.jsx';
import { DemoPicker } from '../landing/DemoPicker.jsx';
import { ARJUN, dayLabel } from '../landing/sample.js';

const NAV = [['How it works', '#how'], ['Roles', '#roles'], ['Questions', '#faq']];
const LIMIT = LONG_LEAVE_THRESHOLD_DAYS;

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-background">
      <div className="container flex h-[4.25rem] items-center gap-4">
        <Link to="/" aria-label="Layover by Akasa Air, home" className="shrink-0 rounded-sm">
          <Brand compact className="sm:hidden" />
          <Brand className="hidden sm:inline-flex" />
        </Link>
        <nav aria-label="Sections" className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">{label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/login">Sign in</Link></Button>
          <Button asChild variant="brand" className="px-4"><a href="#demo">Try the demo</a></Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const root = useRef(null);
  useEffect(() => heroIntro(root.current), []);
  return (
    <div className="dark">
      <section ref={root} aria-labelledby="hero-title" className="relative overflow-hidden bg-background text-foreground">
        <div className="gridlines pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="container relative grid gap-12 pb-20 pt-14 sm:pt-20 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-center xl:gap-14 xl:pb-28 xl:pt-24">
          <div className="max-w-2xl">
            <p data-hero-fade className="kicker mb-6">Leave desk for Akasa Air teams</p>
            <h1 id="hero-title" data-hero-fade className="font-display text-[2.55rem] leading-[1.02] sm:text-6xl xl:text-[4.25rem]">
              Ask for leave and see exactly where it is
            </h1>
            <p data-hero-fade className="mt-6 max-w-xl text-lg text-muted-foreground">
              Layover is where Akasa Air teams ask for time off. You pick the dates, your manager answers, and anything over {LIMIT} days goes to the head of department next.
            </p>
            <div data-hero-fade className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="brand"><a href="#demo">Try the demo <ArrowRight /></a></Button>
              <Button asChild size="lg" variant="outline"><a href="#how">How it works</a></Button>
            </div>
            <p data-hero-fade className="mt-5 text-sm text-muted-foreground">No sign-up. Pick a person and look around.</p>
          </div>
          <HeroBoard />
        </div>
      </section>
    </div>
  );
}

function SectionHead({ id, kicker, title, children, className }) {
  return (
    <div data-reveal className={cn('mb-12 max-w-3xl lg:mb-16', className)}>
      <p className="kicker mb-4">{kicker}</p>
      <h2 id={id} className="font-display text-4xl leading-[1.05] sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{children}</p>}
    </div>
  );
}

const VALUES = [
  ['Days counted for you', 'Sundays and public holidays are left out, and the form names the ones it skipped.'],
  ['Documents only when needed', `Up to ${LIMIT} days, there is nothing to attach. For longer leave you add something like a medical certificate or a flight booking.`],
  ['A second yes for long leave', `Your manager answers first. Anything over ${LIMIT} days then goes to the head of department.`],
  ['A log nobody can edit', 'Every request, decision and opened document is written down. The HOD can read it. Nobody can change it.'],
];

function Values() {
  return (
    <section aria-labelledby="values-title" className="container py-16 lg:py-24">
      <h2 id="values-title" className="sr-only">What Layover does</h2>
      <ul data-stagger className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {VALUES.map(([title, text]) => (
          <li key={title} className="border-t-2 border-flame pt-5">
            <h3 className="text-lg font-bold tracking-tight">{title}</h3>
            <p className="mt-2 text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Feature({ kicker, title, children, points, panel, flip = false }) {
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
      <div data-reveal className={cn('max-w-xl', flip && 'lg:order-last lg:justify-self-end')}>
        <p className="kicker mb-3">{kicker}</p>
        <h3 className="font-display text-3xl leading-[1.1] sm:text-4xl">{title}</h3>
        <p className="mt-4 text-muted-foreground">{children}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2.75} aria-hidden="true" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div data-reveal className="min-w-0">{panel}</div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="border-t border-rule py-20 lg:py-28">
      <div className="container">
        <SectionHead id="how-title" kicker="How it works" title="From the form to the final answer">
          These are mock-ups of the real screens, filled in with one example: Arjun asking for time off for his cousin&rsquo;s wedding in Jaipur.
        </SectionHead>
        <div className="space-y-24 lg:space-y-32">
          <Feature
            kicker="Applying"
            title="The form counts the days and tells you what it skipped"
            panel={<ApplyPanel />}
            points={[
              'The count changes as soon as you change a date',
              `The upload box only appears for leave over ${LIMIT} days`,
              'In an emergency, send the request now and the documents before you are back',
            ]}
          >
            Arjun picks {dayLabel(ARJUN.from)} to {dayLabel(ARJUN.to)}. That&rsquo;s {ARJUN.calendarDays} days on the calendar, but Gandhi Jayanti falls on the Saturday and Sundays never count, so he&rsquo;s charged {ARJUN.days}. The server counts with the same code, so the number on the form is the number that gets saved.
          </Feature>
          <Feature
            flip
            kicker="Approving"
            title="Your manager first. The HOD for anything longer."
            panel={<ApprovalPanel />}
            points={[
              'Turning a request down always needs a reason',
              'A question puts the request on hold until the person replies',
              'A manager’s own leave goes straight to the HOD',
            ]}
          >
            Rahul finds Arjun&rsquo;s request in his queue with the dates, the reason and the invitation. He can approve it, turn it down, or ask a question. Here he asked who was covering Arjun&rsquo;s shifts, got an answer and approved. Because it&rsquo;s {ARJUN.days} days, it now waits for Priya, the head of department.
          </Feature>
          <Feature
            kicker="Holidays and records"
            title="The HOD keeps the holiday list"
            panel={<CalendarPanel />}
            points={[
              'Everyone can see the calendar. Only the HOD can change it',
              'Adding or removing a holiday is written to the audit log',
              'Only the HOD can open the log, and its entries can’t be edited',
            ]}
          >
            Republic Day, Independence Day, Gandhi Jayanti and Christmas are in the calendar from the start, because their dates don&rsquo;t move. Diwali and Eid change every year, so Priya adds them once the dates are announced. New requests leave them out from then on.
          </Feature>
          <Feature
            flip
            kicker="Across locations"
            title="One leave desk for people in many places"
            panel={<NetworkPanel />}
            points={[
              'Works in the browser, on a phone or a laptop',
              'One holiday list, and it counts for everyone',
              'People see their own requests. Managers see their team’s',
            ]}
          >
            An airline&rsquo;s people don&rsquo;t sit in one office. Layover gives all of them the same rules and the same way to ask, whichever city they work from. A request filed from one airport reaches the right manager the same way as one filed from another.
          </Feature>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  ['You ask', `Pick the dates and write a reason, like “Cousin’s wedding in Jaipur”. Over ${LIMIT} days, attach a document.`],
  ['Your manager answers', `Approve, turn it down with a reason, or ask you something. For ${LIMIT} days or fewer, that’s the final answer.`],
  ['The HOD signs off', 'Longer leave goes to the head of department once your manager has approved it.'],
  ['You see the outcome', 'The request shows who decided, when, and what they wrote. You can still cancel it until the leave starts.'],
];

function Steps() {
  return (
    <section aria-labelledby="steps-title" className="border-y border-rule bg-secondary/50 py-20 lg:py-28">
      <div className="container">
        <SectionHead id="steps-title" kicker="Start to finish" title="What happens to one request" />
        <ol data-stagger className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="border-t border-rule pt-5">
              <span className="font-mono text-sm font-medium text-brand" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-xl font-bold tracking-tight">{title}</h3>
              <p className="mt-2 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const ROLES = [
  ['Employee', 'Asks', 'Arjun Sharma', ['Apply, with the days counted as you type', 'Reply to questions and send documents', 'Edit until someone approves, cancel until the leave starts']],
  ['Manager', 'Decides', 'Rahul Mehta', ['A queue of what’s waiting, oldest first', 'Approve, turn down with a reason, or ask', 'Open the documents attached to a request']],
  ['Head of Department', 'Oversees', 'Priya Nair', [`The final say on leave over ${LIMIT} days`, 'Keeps the holiday calendar', 'Reads the audit log']],
];

function Roles() {
  return (
    <section id="roles" aria-labelledby="roles-title" className="py-20 lg:py-28">
      <div className="container">
        <SectionHead id="roles-title" kicker="Roles" title="Who does what">
          Everyone signs in to the same app. What you see depends on your role.
        </SectionHead>
        <ul data-stagger className="grid gap-5 md:grid-cols-3">
          {ROLES.map(([role, tagline, person, can]) => (
            <li key={role} className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-4">
                <Avatar name={person} className="size-16" />
                <p className="text-sm text-muted-foreground">For example<span className="block font-semibold text-foreground">{person}</span></p>
              </div>
              <h3 className="mt-6">
                <span className="inline-block rounded-sm bg-secondary px-2 py-1 font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-secondary-foreground">{role}</span>
                <span className="mt-3 block font-display text-3xl">{tagline}</span>
              </h3>
              <ul className="mt-4 space-y-2.5 border-t border-border pt-4">
                {can.map((c) => (
                  <li key={c} className="flex gap-3 text-[0.95rem]">
                    <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2.75} aria-hidden="true" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Demo() {
  return (
    <section id="demo" aria-labelledby="demo-title" className="border-t border-rule bg-secondary/50 py-20 lg:py-28">
      <div className="container">
        <SectionHead id="demo-title" kicker="Pick a seat" title="Sign in as one of nine people">
          Each person already has requests in different states, so every screen has something on it. To see both sides, start as Arjun, then come back as Rahul. The people and their requests are made up.
        </SectionHead>
        <DemoPicker />
      </div>
    </section>
  );
}

function Offer() {
  const third = CONTACT_EMAIL
    ? ['If you’d rather not host it, write to us and we’ll talk about setting it up for your team.', <Button key="c" asChild variant="outline"><a href={`mailto:${CONTACT_EMAIL}`}>Email us <ArrowUpRight /></a></Button>]
    : ['If you’d rather not host it, we can talk about setting it up for your team. Until a contact address is listed here, the demo is the place to start.', <Button key="c" asChild variant="outline"><a href="#demo">Start with the demo</a></Button>];
  const cards = [
    ['Try the demo', 'Sign in as one of the nine people above. Nothing to install and nothing to fill in.', <Button key="a" asChild variant="brand"><a href="#demo">Pick a person <ArrowRight /></a></Button>],
    ['Run it yourself', 'It’s plain JavaScript: Node and Express on the server, React in the browser, MongoDB for storage. Clone the repository and start it with Docker. A hosting guide is included.', <code key="b" className="block rounded-md border border-border bg-secondary px-3 py-2.5 font-mono text-sm">docker compose up</code>],
    ['Have it run for you', ...third],
  ];
  return (
    <section aria-labelledby="offer-title" className="py-20 lg:py-28">
      <div className="container">
        <SectionHead id="offer-title" kicker="Using it" title="Three ways to start" />
        <ul data-stagger className="grid gap-5 md:grid-cols-3">
          {cards.map(([title, text, action]) => (
            <li key={title} className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-soft">
              <h3 className="text-xl font-bold tracking-tight">{title}</h3>
              <p className="mt-2 flex-1 text-muted-foreground">{text}</p>
              <div className="mt-6">{action}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const FAQ = [
  ['Who approves my leave?', `Your manager. If it’s more than ${LIMIT} days, the head of department approves it after your manager. A manager’s own leave goes straight to the HOD. The HOD’s own leave is approved automatically and marked as such on the request.`],
  ['How are the days counted?', 'Every day from the start date to the end date, both included, except Sundays and public holidays. A request that only covers those days can’t be sent, because it has no leave days in it.'],
  ['When do I need to attach a document?', `Only when the leave is more than ${LIMIT} counted days. A medical certificate, a flight booking or an invitation all work. Files can be PDF, JPG or PNG, up to 5 MB each. For shorter leave the upload box doesn’t appear at all.`],
  ['What if it’s an emergency?', `Leave over ${LIMIT} days can be sent as an emergency without documents. You send them before you’re back at work. If two emergency leaves are still waiting on documents, you can’t ask for more leave until you upload them.`],
  ['Who decides which days are holidays?', 'The HOD. Republic Day, Independence Day, Gandhi Jayanti and Christmas are there from the start. Holidays whose dates move each year, like Diwali and Eid, are added by the HOD.'],
  ['Who can see my request?', 'You, your manager and the HOD. Other employees can’t. Only the HOD can open the audit log.'],
  ['Is the demo data real?', 'No. The nine people and their requests are made up so you can try every step without touching anyone’s real leave.'],
];

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-rule py-20 lg:py-28">
      <div className="container grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <SectionHead id="faq-title" kicker="Questions" title="Good to know" className="mb-0 lg:mb-0" />
        <div data-reveal className="border-t border-rule">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-border">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-4 text-lg font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-rule font-mono text-lg leading-none transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-2xl pb-5 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <div className="dark">
      <section aria-labelledby="closing-title" className="relative overflow-hidden bg-background text-foreground">
        <div className="gridlines pointer-events-none absolute inset-0" aria-hidden="true" />
        <div data-reveal className="container relative py-20 lg:py-28">
          <h2 id="closing-title" className="max-w-3xl font-display text-4xl leading-[1.05] sm:text-6xl">See it from both sides</h2>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">Sign in as Arjun and ask for a few days off. Then sign in as Rahul and answer it.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="brand"><a href="#demo">Pick a person <ArrowRight /></a></Button>
            <Button asChild size="lg" variant="outline"><Link to="/login">Sign in</Link></Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Footer() {
  return (
    <footer className="dark border-t border-border bg-background text-foreground">
      <div className="container grid gap-8 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div>
          <Brand />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">The leave desk for Akasa Air teams. The people in the demo are made up.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 text-sm text-muted-foreground">
            {NAV.map(([label, href]) => <a key={href} href={href} className="inline-flex min-h-11 items-center hover:text-foreground">{label}</a>)}
            <Link to="/login" className="inline-flex min-h-11 items-center hover:text-foreground">Sign in</Link>
          </nav>
          <div className="flex items-center gap-1"><TextSizeMenu /><ThemeToggle /></div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const page = useRef(null);
  useLandingMotion(page);
  return (
    <div ref={page} className="min-h-screen">
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Values />
        <HowItWorks />
        <Steps />
        <Roles />
        <Demo />
        <Offer />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
