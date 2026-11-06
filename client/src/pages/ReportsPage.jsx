import { useEffect, useState } from 'react';
import { CircleCheck, Download, Table2 } from 'lucide-react';
import { STATUSES, STATUS_LABELS } from '@lms/shared';
import { api } from '../api.js';
import { ErrorBox, PageHeader, Panel } from '../components.jsx';
import { useAuth } from '../auth.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label, Select } from '../ui/input.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { cn } from '../lib/utils.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Tile({ label, value, note }) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-soft">
      <p className="kicker">{label}</p>
      <p className="num font-display mt-2 text-4xl leading-none">{value}</p>
      {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

const barLabel = (m) =>
  `${m.name}: ${plural(m.approvedDays, 'day')} approved, ${plural(m.waitingDays, 'day')} waiting for an answer, ${plural(m.requests, 'request')}`;

/** Bars are plain divs. Each has a text label, and the table below the chart holds the same numbers. */
function MonthlyChart({ data }) {
  const [asTable, setAsTable] = useState(false);
  const peak = Math.max(1, ...data.months.map((m) => m.approvedDays + m.waitingDays));
  const pct = (n) => `${(n / peak) * 100}%`;
  return (
    <Panel title="Days away by month" kicker={String(data.year)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Chart key">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-4 rounded-sm bg-status-green-fg" />
            Approved days (solid)
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-4 rounded-sm border-2 border-dashed border-status-amber-fg bg-status-amber-bg" />
            Waiting for an answer (dashed)
          </li>
        </ul>
        <Button variant="outline" size="sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          <Table2 />
          {asTable ? 'Show as chart' : 'Show as table'}
        </Button>
      </div>

      <div className={cn('overflow-x-auto rounded-md border bg-background p-3', asTable && 'hidden')}>
        <ol className="flex min-w-[34rem] items-end gap-2" aria-label="Days away by month">
          {data.months.map((m) => {
            const total = m.approvedDays + m.waitingDays;
            return (
              <li key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="num text-xs font-semibold" aria-hidden="true">
                  {total || ''}
                </span>
                <div role="img" aria-label={barLabel(m)} className="flex h-40 w-full flex-col justify-end">
                  <div
                    className="w-full rounded-t-sm border-2 border-b-0 border-dashed border-status-amber-fg bg-status-amber-bg"
                    style={{ height: pct(m.waitingDays), display: m.waitingDays ? undefined : 'none' }}
                  />
                  <div
                    className={cn('w-full bg-status-green-fg', m.waitingDays ? '' : 'rounded-t-sm')}
                    style={{ height: pct(m.approvedDays), minHeight: m.approvedDays ? '2px' : 0 }}
                  />
                </div>
                <span className="kicker" aria-hidden="true">
                  {m.name.slice(0, 3)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={cn(!asTable && 'sr-only')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="sr-only">Leave by month in {data.year}, counted in the month each request starts</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Month
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Approved days
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Waiting days
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Requests
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Rejected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.months.map((m) => (
                <tr key={m.month}>
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {m.name}
                  </th>
                  <td className="num py-2 pr-3 text-right">{m.approvedDays}</td>
                  <td className="num py-2 pr-3 text-right">{m.waitingDays}</td>
                  <td className="num py-2 pr-3 text-right">{m.requests}</td>
                  <td className="num py-2 text-right">{m.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">A request is counted in the month it starts, even if it runs into the next one.</p>
    </Panel>
  );
}

function ExportCard({ canSeeAll }) {
  const [scope, setScope] = useState('mine');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState('');

  const download = async () => {
    setBusy(true);
    setError(null);
    setSaved('');
    try {
      const name = await api.exportCsv({ scope, ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) });
      setSaved(name || 'leave-requests.csv');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Export" kicker="Spreadsheet">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="export-scope">Which requests</Label>
          <Select id="export-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="mine">Mine</option>
            {canSeeAll && <option value="all">Everyone I can see</option>}
          </Select>
        </div>
        <div>
          <Label htmlFor="export-status">Status</Label>
          <Select id="export-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="export-from">From (optional)</Label>
          <Input id="export-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="export-to">To (optional)</Label>
          <Input id="export-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="brand" disabled={busy} onClick={download}>
          <Download />
          {busy ? 'Preparing the file' : 'Download CSV'}
        </Button>
        <p role="status" className="text-sm font-medium text-status-green-fg">
          {saved && (
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="size-4" aria-hidden="true" />
              Saved as {saved}
            </span>
          )}
        </p>
      </div>
      <ErrorBox error={error} className="mt-4" />
      <p className="mt-5 text-sm text-muted-foreground">
        Each row is one request: the request and employee IDs, the person, the dates, the days counted as leave, the days in a row, the
        status, whether it was long or an emergency, the reason, when it was filed, and who made the last decision and what they said. It
        opens in Excel or Google Sheets.
      </p>
    </Panel>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setError(null);
    api
      .monthly(year)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [year]);

  const scopeText =
    user.role === 'HOD'
      ? 'Everyone in the department.'
      : user.role === 'MANAGER'
        ? 'You and your team.'
        : 'These are your own numbers. Nobody else is included.';
  const shown = data && data.year === year ? data : null;

  return (
    <section>
      <PageHeader kicker="Numbers" title="Reports" description={`Days away and requests, month by month. ${scopeText}`}>
        <div>
          <Label htmlFor="report-year">Year</Label>
          <Select id="report-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-36">
            <option value={thisYear}>{thisYear}</option>
            <option value={thisYear - 1}>{thisYear - 1}</option>
          </Select>
        </div>
      </PageHeader>
      <ErrorBox error={error} className="mb-4" />
      <div className="space-y-6">
        {!shown && !error && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading report">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        )}
        {shown && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
              <Tile label="Approved days" value={shown.totals.approvedDays} note={`In ${shown.year}.`} />
              <Tile label="Waiting days" value={shown.totals.waitingDays} note="Still waiting for an answer." />
              <Tile label="Requests" value={shown.totals.requests} />
              <Tile
                label="Busiest month"
                value={shown.busiest ?? 'None yet'}
                note={shown.busiest ? 'Most days away.' : 'No leave this year.'}
              />
            </div>
            <MonthlyChart data={shown} />
          </>
        )}
        <ExportCard canSeeAll={user.role !== 'EMPLOYEE'} />
      </div>
    </section>
  );
}
