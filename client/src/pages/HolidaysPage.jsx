import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleAlert, CircleCheck, Plus, Trash2, Upload } from 'lucide-react';
import { todayISO } from '@lms/shared';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, ErrorBox, FieldError, PageHeader, Panel, fmtDate } from '../components.jsx';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label, Select, Textarea } from '../ui/input.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { cn } from '../lib/utils.js';

const weekday = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
const EXAMPLE = 'date,holiday,location\n2026-11-08,Diwali,\n2026-11-01,Kannada Rajyotsava,Bengaluru';
const ROLE = { HOD: 'Head of Department', MANAGER: 'Manager', EMPLOYEE: 'Employee' };

const TABS = [['calendar', 'Calendar'], ['import', 'Import a list'], ['places', 'People and locations']];

function Tabs({ tab, setTab }) {
  return (
    <div role="tablist" aria-label="Holiday settings" className="mb-6 flex gap-1 overflow-x-auto border-b">
      {TABS.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          type="button"
          id={`tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`panel-${id}`}
          onClick={() => setTab(id)}
          className={cn('-mb-px h-11 shrink-0 border-b-[3px] px-4 text-sm font-semibold transition-colors', tab === id ? 'border-flame text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Where({ location }) {
  return location ? <Badge variant="blue">{location}</Badge> : <Badge variant="neutral">Everyone</Badge>;
}

/* ---------- Calendar ---------- */
function Calendar({ isHod, locations, onChanged }) {
  const { user } = useAuth();
  const [view, setView] = useState(isHod ? 'all' : 'mine');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [form, setForm] = useState({ date: '', name: '', location: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = view === 'all' ? { all: 'true' } : view === 'mine' ? {} : { location: view };
    return api.holidays(params).then((r) => setItems(r.items)).catch(setError);
  }, [view]);
  useEffect(() => { setItems(null); load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.addHoliday({ date: form.date, name: form.name, location: form.location });
      setForm({ date: '', name: '', location: form.location });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err);
      setFields(err.fields ?? {});
    } finally {
      setBusy(false);
    }
  };
  const remove = async (h) => {
    setError(null);
    try {
      await api.removeHoliday(h.id);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  };

  const today = todayISO();
  const byYear = (items ?? []).reduce((acc, h) => { (acc[h.date.slice(0, 4)] ??= []).push(h); return acc; }, {});
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {isHod ? (
            <div className="w-full max-w-xs">
              <Label htmlFor="view">Showing</Label>
              <Select id="view" value={view} onChange={(e) => setView(e.target.value)}>
                <option value="all">Every location</option>
                {locations.map((l) => <option key={l.id} value={l.name}>Everyone and {l.name}</option>)}
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This is the calendar your leave is counted with: holidays for everyone{user.location ? `, plus ${user.location}` : ''}.
              {!user.location && ' You have no location set yet, so only the national holidays apply. Ask the HOD to set yours.'}
            </p>
          )}
        </div>
        <ErrorBox error={error} />
        {!items && <div className="space-y-2" role="status" aria-label="Loading holidays">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>}
        {items?.length === 0 && <p className="rounded-lg border border-dashed bg-card/50 py-12 text-center text-muted-foreground">No holidays are listed yet.{isHod ? ' Add the first one on the right.' : ''}</p>}
        {Object.entries(byYear).map(([year, list]) => (
          <Panel key={year} title={year} kicker={`${list.length} holiday${list.length === 1 ? '' : 's'}`}>
            <ul className="-my-2 divide-y">
              {list.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-3 sm:gap-4">
                  <span className="num w-28 shrink-0 font-mono text-sm sm:w-36">{fmtDate(h.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{h.name}</span>
                    <span className="kicker">{weekday(h.date)}{h.date < today ? ', past' : ''}</span>
                  </span>
                  <Where location={h.location} />
                  {isHod && <Button variant="ghost" size="icon" aria-label={`Remove ${h.name}`} title="Remove" onClick={() => remove(h)}><Trash2 /></Button>}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <aside className="lg:sticky lg:top-36">
        {isHod ? (
          <form onSubmit={add} noValidate>
            <Panel title="Add a holiday">
              <p className="-mt-2 text-sm text-muted-foreground">Dates that move each year, such as Diwali or Eid, go here once they are announced.</p>
              <div className="mt-5">
                <Label htmlFor="h-date">Date</Label>
                <Input id="h-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-invalid={Boolean(fields.date)} />
                <FieldError msg={fields.date} />
              </div>
              <div className="mt-4">
                <Label htmlFor="h-name">Name</Label>
                <Input id="h-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="For example: Diwali" aria-invalid={Boolean(fields.name)} />
                <FieldError msg={fields.name} />
              </div>
              <div className="mt-4">
                <Label htmlFor="h-loc">Who it applies to</Label>
                <Select id="h-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} aria-invalid={Boolean(fields.location)}>
                  <option value="">Everyone (national)</option>
                  {locations.map((l) => <option key={l.id} value={l.name}>Only {l.name}</option>)}
                </Select>
                <FieldError msg={fields.location} />
              </div>
              <Button variant="brand" className="mt-6 w-full" disabled={busy}><Plus />{busy ? 'Adding' : 'Add holiday'}</Button>
              <p className="mt-4 text-xs text-muted-foreground">Requests that are already filed keep the day count they had when they were made.</p>
            </Panel>
          </form>
        ) : (
          <Panel title="Missing a holiday?">
            <p className="-mt-2 text-sm text-muted-foreground">Only the Head of Department can change this list. If a holiday is missing, ask them to add it before you apply.</p>
          </Panel>
        )}
      </aside>
    </div>
  );
}

/* ---------- Import ---------- */
const STATUS_LOOK = {
  new: ['green', 'Will be added'],
  duplicate: ['neutral', 'Already there'],
  error: ['red', 'Needs fixing'],
};

function Import({ onChanged }) {
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
      const r = await api.importHolidays(text, apply);
      setResult(r);
      if (r.applied) { setDone(r.summary); setText(''); onChanged?.(); }
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
    if (f.size > 100 * 1024) { setError({ message: 'That file is too big.', hint: 'Import at most about 1,000 lines at a time.' }); return; }
    setText(await f.text());
    setResult(null);
    setDone(null);
    setError(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="space-y-5">
        <ErrorBox error={error} />
        {done && (
          <div role="status" className="flex gap-3 rounded-lg border border-status-green-fg/30 bg-status-green-bg p-4 text-status-green-fg">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="font-semibold">Added {done.new} holiday{done.new === 1 ? '' : 's'}{done.duplicate ? `, skipped ${done.duplicate} that were already there` : ''}.</p>
          </div>
        )}
        <Panel title="Paste a list or choose a file">
          <Label htmlFor="csv">Holidays, one per line</Label>
          <Textarea id="csv" rows={9} value={text} onChange={(e) => { setText(e.target.value); setResult(null); setDone(null); }} className="font-mono text-sm" placeholder={EXAMPLE} spellCheck={false} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={busy || !text.trim()} onClick={() => run(false)}>Check the list</Button>
            <Button variant="brand" disabled={busy || !result || result.summary.errors > 0 || result.summary.new === 0} onClick={() => run(true)}><Upload />Add {result?.summary.new ? `${result.summary.new} ` : ''}to the calendar</Button>
            <label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
              Choose a .csv file
              <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={pickFile} />
            </label>
          </div>
          {result && !result.applied && result.summary.errors === 0 && result.summary.new === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">Everything in this list is already in the calendar.</p>
          )}
        </Panel>

        {result && (
          <Panel title="What we found" kicker={`${result.summary.new} new, ${result.summary.duplicate} already there, ${result.summary.errors} to fix`}>
            {result.summary.errors > 0 && <p className="-mt-2 mb-3 text-sm font-medium text-status-red-fg">Nothing is added until every line is fixed, so one typo never leaves half a calendar behind.</p>}
            <ul className="-my-2 divide-y">
              {result.rows.map((r) => {
                const [variant, label] = STATUS_LOOK[r.status];
                return (
                  <li key={`${r.line}-${r.date}-${r.name}`} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                    <span className="font-mono text-xs text-muted-foreground">Line {r.line}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{r.name || '(no name)'}</span>
                      <span className="num block font-mono text-sm text-muted-foreground">{r.date}{r.location ? `, ${r.location}` : ', everyone'}</span>
                      {r.message && <span className={cn('mt-0.5 block text-sm', r.status === 'error' && 'font-medium text-status-red-fg')}>{r.message}</span>}
                    </span>
                    <Badge variant={variant}>{r.status === 'error' ? <CircleAlert className="size-3" aria-hidden="true" /> : null}{label}</Badge>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </div>

      <aside className="lg:sticky lg:top-36">
        <Panel title="How the list should look">
          <p className="-mt-2 text-sm text-muted-foreground">Three columns: date, name, and where it applies. Leave the last one empty (or write National) for a holiday that applies to everyone. A header line is optional.</p>
          <pre className="mt-4 overflow-x-auto rounded-md bg-secondary p-3 font-mono text-xs leading-relaxed">{EXAMPLE}</pre>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Dates can be 2026-11-08, 08/11/2026 or 8 Nov 2026. Numbers are read day first.</li>
            <li>Copy straight from a spreadsheet, or use commas or semicolons.</li>
            <li>Location names must already exist. Add them on the People and locations tab.</li>
            <li>Dates that are already listed are skipped.</li>
          </ul>
        </Panel>
      </aside>
    </div>
  );
}

/* ---------- Locations and people ---------- */
function Places({ locations, reloadLocations }) {
  const [people, setPeople] = useState(null);
  const [name, setName] = useState('');
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadPeople = useCallback(() => api.people().then((r) => setPeople(r.items)).catch(setError), []);
  useEffect(() => { loadPeople(); }, [loadPeople]);

  const addLocation = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.addLocation(name);
      setName('');
      await reloadLocations();
    } catch (err) {
      setError(err);
      setFields(err.fields ?? {});
    } finally {
      setBusy(false);
    }
  };
  const removeLocation = async (l) => {
    setError(null);
    try {
      await api.removeLocation(l.id);
      await reloadLocations();
    } catch (err) {
      setError(err);
    }
  };
  const refresh = () => Promise.all([loadPeople(), reloadLocations()]);
  const changeManager = async (p, managerId) => {
    setError(null);
    try {
      await api.setManager(p.id, managerId);
      await refresh();
    } catch (err) {
      setError(err);
    }
  };
  const changeRole = async (p, role) => {
    setError(null);
    try {
      await api.setRole(p.id, role);
      await refresh();
    } catch (err) {
      setError(err);
    }
  };
  const managers = (people ?? []).filter((p) => p.role === 'MANAGER');
  const move = async (p, location) => {
    setError(null);
    try {
      await api.setLocation(p.id, location);
      await Promise.all([loadPeople(), reloadLocations()]);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="space-y-6">
        <ErrorBox error={error} />
        <Panel title="People" kicker="Set up who reports to whom, and where they work">
          {!people && <Skeleton className="h-40 rounded-lg" />}
          <ul className="-my-2 divide-y">
            {people?.map((p) => (
              <li key={p.id} className="py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={p.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      {p.needsSetup && <Badge variant="amber">New</Badge>}
                    </span>
                    <span className="block break-all text-sm text-muted-foreground">{p.email}</span>
                    {p.needsSetup && <span className="mt-0.5 block text-sm font-medium">Signed up and waiting for a manager.</span>}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={`role-${p.id}`}>Role</label>
                    {p.role === 'HOD' ? (
                      <p id={`role-${p.id}`} className="flex h-11 items-center text-sm font-semibold">{ROLE.HOD}</p>
                    ) : (
                      <Select id={`role-${p.id}`} value={p.role} onChange={(e) => changeRole(p, e.target.value)}>
                        <option value="EMPLOYEE">Employee</option>
                        <option value="MANAGER">Manager</option>
                      </Select>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={`mgr-${p.id}`}>Manager</label>
                    {p.role === 'EMPLOYEE' ? (
                      <Select id={`mgr-${p.id}`} value={p.managerId ?? ''} onChange={(e) => changeManager(p, e.target.value)}>
                        <option value="" disabled>Choose a manager</option>
                        {managers.filter((m) => m.id !== p.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </Select>
                    ) : (
                      <p id={`mgr-${p.id}`} className="flex h-11 items-center text-sm text-muted-foreground">{p.role === 'HOD' ? 'Head of department' : 'Reports to the HOD'}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={`loc-${p.id}`}>Location</label>
                    <Select id={`loc-${p.id}`} value={p.location ?? ''} onChange={(e) => move(p, e.target.value)}>
                      <option value="">No location</option>
                      {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </Select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Moving someone only affects requests they file from now on. People who still need a manager are listed first.</p>
        </Panel>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-36">
        <Panel title="Locations">
          <ul className="-my-2 divide-y">
            {locations.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{l.name}</span>
                  <span className="kicker">{l.people} {l.people === 1 ? 'person' : 'people'}, {l.holidays} local holiday{l.holidays === 1 ? '' : 's'}</span>
                </span>
                <Button variant="ghost" size="icon" aria-label={`Remove ${l.name}`} title="Remove" onClick={() => removeLocation(l)}><Trash2 /></Button>
              </li>
            ))}
            {locations.length === 0 && <li className="py-3 text-sm text-muted-foreground">No locations yet.</li>}
          </ul>
          <form onSubmit={addLocation} noValidate className="mt-5">
            <Label htmlFor="new-loc">Add a location</Label>
            <div className="flex gap-2">
              <Input id="new-loc" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Pune" aria-invalid={Boolean(fields.name)} />
              <Button variant="brand" disabled={busy} aria-label="Add location"><Plus /></Button>
            </div>
            <FieldError msg={fields.name} />
          </form>
        </Panel>
      </aside>
    </div>
  );
}

export default function HolidaysPage() {
  const { user } = useAuth();
  const isHod = user.role === 'HOD';
  const [search] = useSearchParams();
  const [tab, setTab] = useState(search.get('tab') === 'places' ? 'places' : 'calendar');
  const [locations, setLocations] = useState([]);
  const [version, setVersion] = useState(0);

  const loadLocations = useCallback(() => api.locations().then((r) => setLocations(r.items)).catch(() => {}), []);
  useEffect(() => { loadLocations(); }, [loadLocations]);

  return (
    <section>
      <PageHeader
        kicker="Company calendar"
        title="Public holidays"
        description="Sundays and public holidays are never counted as leave. If a request covers one, it is shortened by that day and the request says so. Some holidays apply to everyone and some only to one location."
      />
      {isHod && <Tabs tab={tab} setTab={setTab} />}
      <div role="tabpanel" id={`panel-${isHod ? tab : 'calendar'}`} aria-labelledby={isHod ? `tab-${tab}` : undefined}>
        {(!isHod || tab === 'calendar') && <Calendar key={version} isHod={isHod} locations={locations} onChanged={loadLocations} />}
        {isHod && tab === 'import' && <Import onChanged={() => { loadLocations(); setVersion((v) => v + 1); }} />}
        {isHod && tab === 'places' && <Places locations={locations} reloadLocations={loadLocations} />}
      </div>
    </section>
  );
}
