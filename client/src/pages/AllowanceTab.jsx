import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Upload } from 'lucide-react';
import { api } from '../api.js';
import { Avatar, ErrorBox, FieldError, Panel } from '../components.jsx';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label, Select, Textarea } from '../ui/input.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { cn } from '../lib/utils.js';

const EXAMPLE = 'email,allowance,year\nasha.verma@example.com,24,2026\nrohan.mehta@example.com,18\ndefault,30';

const parseDays = (v) => (/^\d{1,3}$/.test(String(v).trim()) ? Number(v) : null);

/* ---------- One person ---------- */
function Row({ p, year, onChanged, onError }) {
  const [draft, setDraft] = useState(String(p.allowance));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  useEffect(() => {
    setDraft(String(p.allowance));
  }, [p.allowance]);

  const save = async () => {
    if (draft.trim() === String(p.allowance)) {
      setProblem(null);
      return;
    }
    const n = parseDays(draft);
    if (n === null || n > 365) {
      setProblem('Use a whole number from 0 to 365.');
      return;
    }
    setProblem(null);
    setBusy(true);
    onError(null);
    try {
      await api.setAllowance(p.id, year, n);
      await onChanged();
    } catch (err) {
      setDraft(String(p.allowance));
      onError(err);
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    onError(null);
    try {
      await api.resetAllowance(p.id, year);
      await onChanged();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };
  const stat = (label, value, strong) => (
    <div className="min-w-0">
      <span className="kicker md:sr-only">{label}</span>
      <span className={cn('num block text-base', strong && 'font-semibold')}>{value}</span>
    </div>
  );
  return (
    <li className="grid grid-cols-3 gap-x-3 gap-y-3 py-4 md:grid-cols-[minmax(0,1.6fr)_15rem_4.5rem_4.5rem_4.5rem] md:items-center md:gap-x-4 md:py-3">
      <div className="col-span-3 flex min-w-0 items-center gap-3 md:col-span-1">
        <Avatar name={p.name} className="size-9 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{p.name}</span>
          <span className="block truncate font-mono text-xs text-muted-foreground">{p.employeeCode}</span>
        </span>
      </div>
      <div className="col-span-3 flex flex-wrap items-center gap-2 md:col-span-1">
        <div className="w-24">
          <label htmlFor={`allow-${p.id}`} className="mb-1 block text-xs font-medium text-muted-foreground md:sr-only">
            Days for {p.name}
          </label>
          <Input
            id={`allow-${p.id}`}
            inputMode="numeric"
            value={draft}
            disabled={busy}
            aria-invalid={Boolean(problem)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
            }}
            className="num"
          />
        </div>
        {p.custom && <Badge variant="blue">Custom</Badge>}
        {p.custom && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={reset}>
            Use default
          </Button>
        )}
      </div>
      {stat('Used', p.used)}
      {stat('Waiting', p.pending)}
      {stat('Left', p.remaining, true)}
      {problem && (
        <div className="col-span-3 md:col-span-5">
          <FieldError msg={problem} />
        </div>
      )}
    </li>
  );
}

/* ---------- People list and default ---------- */
function People({ year, setYear, years, reloadKey, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [defaultDraft, setDefaultDraft] = useState('');
  const [defaultProblem, setDefaultProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

  const load = useCallback(
    () =>
      api
        .allowances(year)
        .then((r) => {
          setData(r);
          setDefaultDraft(String(r.defaultDays));
        })
        .catch(setError),
    [year],
  );
  useEffect(() => {
    setData(null);
    load();
  }, [load, reloadKey]);

  const changed = async () => {
    await load();
    onChanged?.();
  };
  const updateDefault = async (e) => {
    e.preventDefault();
    setSavedMsg(null);
    const n = parseDays(defaultDraft);
    if (n === null || n > 365) {
      setDefaultProblem('Use a whole number from 0 to 365.');
      return;
    }
    setDefaultProblem(null);
    setBusy(true);
    setError(null);
    try {
      await api.setDefaultAllowance(n);
      await changed();
      setSavedMsg(`Everyone without a custom number now has ${n} ${n === 1 ? 'day' : 'days'}.`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="max-w-xs">
          <Label htmlFor="allow-year">Year</Label>
          <Select id="allow-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <ErrorBox error={error} />
      <Panel title="Default for everyone" kicker="Applies to anyone without a custom number">
        <form onSubmit={updateDefault} noValidate className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Label htmlFor="allow-default">Days per year</Label>
            <Input
              id="allow-default"
              inputMode="numeric"
              value={defaultDraft}
              onChange={(e) => setDefaultDraft(e.target.value)}
              aria-invalid={Boolean(defaultProblem)}
              className="num"
            />
          </div>
          <Button variant="brand" disabled={busy || !data}>
            {busy ? 'Updating' : 'Update'}
          </Button>
        </form>
        <FieldError msg={defaultProblem} />
        {savedMsg && (
          <p role="status" className="mt-3 text-sm font-medium text-status-green-fg">
            {savedMsg}
          </p>
        )}
      </Panel>

      <Panel title="People" kicker={`Allowance for ${year}`}>
        {!data && !error && <Skeleton className="h-40 rounded-lg" />}
        {data && (
          <>
            <div
              aria-hidden="true"
              className="kicker hidden grid-cols-[minmax(0,1.6fr)_15rem_4.5rem_4.5rem_4.5rem] gap-x-4 border-b pb-2 md:grid"
            >
              <span>Person</span>
              <span>Allowance</span>
              <span>Used</span>
              <span>Waiting</span>
              <span>Left</span>
            </div>
            <ul className="divide-y md:-mb-3">
              {data.items.map((p) => (
                <Row key={p.id} p={p} year={year} onChanged={changed} onError={setError} />
              ))}
            </ul>
            {data.items.length === 0 && <p className="text-sm text-muted-foreground">No one is here yet.</p>}
            <p className="mt-4 text-xs text-muted-foreground">
              Change a number and press Enter, or move to the next field, to save it. Waiting means days on requests that have not been
              answered yet.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}

/* ---------- Import ---------- */
const STATUS_LOOK = {
  new: ['green', 'Will be set'],
  changed: ['blue', 'Will change'],
  same: ['neutral', 'No change'],
  error: ['red', 'Needs fixing'],
};

export function AllowanceImport({ onChanged }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const run = async (apply) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await api.importAllowances(text, apply);
      setResult(r);
      if (r.applied) {
        setDone(r.summary);
        setText('');
        onChanged?.();
      }
    } catch (err) {
      setResult(null);
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 100 * 1024) {
      setError({ message: 'That file is too big.', hint: 'Import at most about 1,000 lines at a time.' });
      return;
    }
    setText(await f.text());
    setResult(null);
    setDone(null);
    setError(null);
  };
  const changes = result ? result.summary.new + result.summary.changed : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="space-y-5">
        <ErrorBox error={error} />
        {done && (
          <div role="status" className="flex gap-3 rounded-lg border border-status-green-fg/30 bg-status-green-bg p-4 text-status-green-fg">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="font-semibold">
              Saved {done.new + done.changed} allowance{done.new + done.changed === 1 ? '' : 's'}
              {done.same ? `, skipped ${done.same} that already matched` : ''}.
            </p>
          </div>
        )}
        <Panel title="Paste a list or choose a file">
          <Label htmlFor="allow-csv">Allowances, one per line</Label>
          <Textarea
            id="allow-csv"
            rows={9}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
              setDone(null);
            }}
            className="font-mono text-sm"
            placeholder={EXAMPLE}
            spellCheck={false}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={busy || !text.trim()} onClick={() => run(false)}>
              Check the list
            </Button>
            <Button variant="brand" disabled={busy || !result || result.summary.errors > 0 || changes === 0} onClick={() => run(true)}>
              <Upload />
              Apply {changes ? `${changes} ` : ''}to the allowances
            </Button>
            <label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
              Choose a .csv file
              <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={pickFile} />
            </label>
          </div>
          {result && !result.applied && result.summary.errors === 0 && changes === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">Everything in this list already matches the current allowances.</p>
          )}
        </Panel>

        {result && (
          <Panel
            title="What we found"
            kicker={`${result.summary.new} new, ${result.summary.changed} changed, ${result.summary.same} the same, ${result.summary.errors} to fix`}
          >
            {result.summary.errors > 0 && (
              <p role="alert" className="-mt-2 mb-3 text-sm font-medium text-status-red-fg">
                Nothing is saved until every line is fixed, so one typo never leaves half a list behind.
              </p>
            )}
            <ul className="-my-2 divide-y">
              {result.rows.map((r) => {
                const [variant, label] = STATUS_LOOK[r.status];
                return (
                  <li key={`${r.line}-${r.email}`} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                    <span className="font-mono text-xs text-muted-foreground">Line {r.line}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{r.who || r.email || '(no one)'}</span>
                      <span className="num block break-all font-mono text-sm text-muted-foreground">
                        {r.email}
                        {r.days !== undefined && r.days !== null ? `, ${r.days} days` : ''}
                        {r.year ? `, ${r.year}` : ''}
                      </span>
                      {r.message && (
                        <span className={cn('mt-0.5 block text-sm', r.status === 'error' && 'font-medium text-status-red-fg')}>
                          {r.message}
                        </span>
                      )}
                    </span>
                    <Badge variant={variant}>
                      {r.status === 'error' ? <CircleAlert className="size-3" aria-hidden="true" /> : null}
                      {label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </div>

      <aside className="lg:sticky lg:top-36">
        <Panel title="How the list should look">
          <p className="-mt-2 text-sm text-muted-foreground">
            Three columns: the person's email, their allowance in days, and the year. The year is optional and defaults to this year. A
            header line is optional.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md bg-secondary p-3 font-mono text-xs leading-relaxed">{EXAMPLE}</pre>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>A line that starts with default or everyone sets the number for all the people who have no custom one.</li>
            <li>Copy straight from a spreadsheet, or use commas or semicolons.</li>
            <li>Emails must belong to people who have already signed up.</li>
            <li>If any line has a problem, nothing is saved.</li>
          </ul>
        </Panel>
      </aside>
    </div>
  );
}

/* ---------- The tab ---------- */
export default function AllowanceTab() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState('people');
  return (
    <div className="space-y-6">
      <div role="group" aria-label="Allowance view" className="flex gap-2">
        {[
          ['people', 'People'],
          ['import', 'Import a list'],
        ].map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={view === id ? 'brand' : 'outline'}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      {view === 'people' && <People year={year} setYear={setYear} years={[thisYear, thisYear + 1]} reloadKey={reloadKey} />}
      {view === 'import' && <AllowanceImport onChanged={() => setReloadKey((k) => k + 1)} />}
    </div>
  );
}
