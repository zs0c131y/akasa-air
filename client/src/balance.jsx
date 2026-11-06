import { cn } from './lib/utils.js';

export const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** "N of M days left" for a balance object from the API. */
export const leftText = (b) => `${b.remaining} of ${b.allowance} days left`;

/** A simple used / waiting / left bar. The bar is decorative: the legend under it says the same in words. */
export function BalanceBar({ balance }) {
  const total = Math.max(balance.allowance, balance.used + balance.pending, 1);
  const pct = (n) => `${Math.min(100, (n / total) * 100)}%`;
  return (
    <div>
      <div aria-hidden="true" className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-foreground" style={{ width: pct(balance.used) }} />
        <div className="h-full bg-status-amber-fg" style={{ width: pct(balance.pending) }} />
        <div className="h-full bg-flame" style={{ width: pct(Math.max(balance.remaining, 0)) }} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Legend swatch="bg-foreground" label="Used" value={balance.used} />
        <Legend swatch="bg-status-amber-fg" label="Waiting for an answer" value={balance.pending} />
        <Legend swatch="bg-flame" label="Left" value={balance.remaining} />
      </dl>
    </div>
  );
}

function Legend({ swatch, label, value }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', swatch)} />
        {label}
      </dt>
      <dd className="num mt-1 font-display text-2xl leading-none">
        {value}
        <span className="sr-only"> {value === 1 ? 'day' : 'days'}</span>
      </dd>
    </div>
  );
}
