import { useEffect, useRef, useState } from 'react';
import { Avatar, StatusChip } from '../components.jsx';
import { heroBoardLoop, reducedMotion } from '../motion.js';
import { cn } from '../lib/utils.js';
import { ARJUN, BOARD, plural, shortRange } from './sample.js';

const chip = 'max-w-full gap-1 whitespace-nowrap px-1 py-0.5 text-[0.6rem] sm:gap-1.5 sm:px-1.5 sm:text-[0.66rem] [&_svg]:size-3';

function Card({ leave, status, className, moving = false, ...rest }) {
  return (
    <div
      className={cn('relative min-w-0 overflow-hidden rounded-md border border-border bg-card p-2 shadow-soft sm:p-2.5', className)}
      {...rest}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Avatar name={leave.name} className="size-7" />
        <span className="truncate text-[0.8rem] font-semibold leading-tight">{leave.name}</span>
      </div>
      <p className="mt-2 font-mono text-[0.64rem] uppercase tracking-[0.06em] text-muted-foreground">
        {shortRange(leave.from, leave.to)} · <span className="num">{plural(leave.days, 'day')}</span>
      </p>
      <div className="relative mt-2">
        {moving ? (
          <>
            <span data-chip-a className="block">
              <StatusChip status="PENDING_MANAGER" className={chip} />
            </span>
            <span data-chip-b className="absolute left-0 top-0 block opacity-0">
              <StatusChip status="PENDING_HOD" className={chip} />
            </span>
          </>
        ) : (
          <StatusChip status={status} className={chip} />
        )}
      </div>
    </div>
  );
}

function Column({ title, count, countKey, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md bg-muted/70 p-2">
      <div className="flex items-baseline justify-between gap-2 px-1 pb-0.5 pt-1">
        <span className="text-[0.72rem] font-semibold leading-tight">{title}</span>
        <span data-col-count={countKey} className="num font-mono text-[0.68rem] text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

/** The hero's product mockup: a board of leave requests, with one request moving on from the manager to the HOD. */
export function HeroBoard() {
  const root = useRef(null);
  const [still] = useState(reducedMotion);
  useEffect(() => heroBoardLoop(root.current), []);

  return (
    <figure data-hero-board className="m-0 w-full">
      <figcaption className="sr-only">
        Example of the request board. Arjun Sharma has asked for {plural(ARJUN.days, 'day')}, {ARJUN.note}. His manager, Rahul, approves it,
        and because it is longer than 3 days it moves on to the head of department.
      </figcaption>
      <div
        ref={root}
        aria-hidden="true"
        className="relative select-none overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lift"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Team requests</p>
          <p className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted-foreground">
            <Avatar name="Rahul Mehta" className="size-6" />
            <span className="hidden min-[400px]:inline">Rahul Mehta · Manager</span>
          </p>
        </div>

        <div className="grid grid-cols-2 items-start gap-2 p-2.5 sm:grid-cols-4">
          <Column title="With the manager" count={2} countKey="from">
            <Card leave={ARJUN} moving data-move-card />
            {BOARD.manager.map((l) => (
              <Card key={l.name} leave={l} status="PENDING_MANAGER" data-move-below />
            ))}
          </Column>
          <Column title="With the HOD" count={1} countKey="to">
            {!still && <Card leave={ARJUN} status="PENDING_HOD" data-move-slot className="invisible" />}
            {BOARD.hod.map((l) => (
              <Card key={l.name} leave={l} status="PENDING_HOD" />
            ))}
          </Column>
          <Column title="Approved" count={BOARD.approved.length}>
            {BOARD.approved.map((l) => (
              <Card key={l.name} leave={l} status="APPROVED" />
            ))}
          </Column>
          <Column title="Needs info" count={BOARD.info.length}>
            {BOARD.info.map((l) => (
              <Card key={l.name} leave={l} status="INFO_REQUESTED" />
            ))}
          </Column>
        </div>

        <div className="flex items-start gap-2.5 border-t border-border px-4 py-3 text-[0.8rem]">
          <span className="mt-[0.4rem] size-1.5 shrink-0 rounded-full bg-flame" />
          <p className="grid min-w-0 flex-1 [grid-template-areas:'line']">
            <span data-line-a className="[grid-area:line]">
              Arjun asked for {plural(ARJUN.days, 'day')}, {shortRange(ARJUN.from, ARJUN.to)}. The invitation is attached.
            </span>
            <span data-line-b className="opacity-0 [grid-area:line]">
              Rahul approved Arjun&rsquo;s request, just now. It goes to the head of department next.
            </span>
          </p>
        </div>

        {!still && (
          <div data-cursor className="pointer-events-none absolute left-0 top-0 z-10 opacity-0">
            <svg viewBox="0 0 20 22" className="size-5 drop-shadow-sm" aria-hidden="true">
              <path
                d="M2 1.5 17 11l-6.6 1.3L7 19 2 1.5Z"
                fill="hsl(var(--foreground))"
                stroke="hsl(var(--background))"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span className="ml-3 mt-0.5 inline-block rounded-full bg-flame px-2 py-0.5 text-[0.7rem] font-semibold text-flame-foreground">
              Rahul
            </span>
          </div>
        )}
      </div>
    </figure>
  );
}
