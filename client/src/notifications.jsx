import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from './api.js';
import { Button } from './ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.jsx';
import { EmptyTray } from './illustrations.jsx';
import { cn } from './lib/utils.js';

export const EMPTY_TEXT = 'Nothing new. When someone answers a request of yours, you will see it here.';

/** "5 min ago", "2 hours ago", "yesterday", then a date. */
export function timeAgo(value, now = Date.now()) {
  const then = new Date(value).getTime();
  const mins = Math.max(0, Math.floor((now - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Title, two lines of body, time and an unread dot: shared by the bell and the full page. */
export function NoticeBody({ item }) {
  return (
    <>
      <span aria-hidden="true" className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-brand')} />
      <span className="min-w-0 flex-1 text-left">
        <span className={cn('block text-sm', item.read ? 'font-medium' : 'font-semibold')}>
          {!item.read && <span className="sr-only">Unread. </span>}
          {item.title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{item.body}</span>
        <span className="kicker mt-1 block">{timeAgo(item.createdAt)}</span>
      </span>
    </>
  );
}

/** Loads notices and keeps them fresh: every 60 seconds and whenever the window is focused again. */
export function useNotifications(limit) {
  const [data, setData] = useState({ unread: 0, items: [] });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await api.notifications(limit);
      if (alive.current) {
        setData({ unread: r.unread ?? 0, items: r.items ?? [] });
        setError(null);
      }
    } catch (err) {
      if (alive.current) setError(err);
    } finally {
      if (alive.current) setLoaded(true);
    }
  }, [limit]);

  useEffect(() => {
    alive.current = true;
    load();
    const timer = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const markRead = useCallback(
    async (body) => {
      // Update the screen first so it feels instant, then tell the server.
      setData((d) => {
        const ids = body.all ? null : new Set(body.ids);
        const hit = (n) => !n.read && (!ids || ids.has(n.id));
        const cleared = d.items.filter(hit).length;
        return { items: d.items.map((n) => (hit(n) ? { ...n, read: true } : n)), unread: body.all ? 0 : Math.max(0, d.unread - cleared) };
      });
      try {
        await api.markRead(body);
      } catch (err) {
        if (alive.current) setError(err);
      }
      load();
    },
    [load],
  );

  return { ...data, loaded, error, markRead, reload: load };
}

export function EmptyNotices() {
  return (
    <div className="px-4 py-8 text-center">
      <EmptyTray className="mx-auto" />
      <p className="mx-auto mt-4 max-w-xs text-sm text-muted-foreground">{EMPTY_TEXT}</p>
    </div>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { unread, items, loaded, markRead } = useNotifications(8);
  const open = (n) => {
    if (!n.read) markRead({ ids: [n.id] });
    if (n.leaveId) navigate(`/leaves/${n.leaveId}`);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          title="Notifications"
        >
          <Bell />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="num absolute right-0.5 top-0.5 grid min-w-[1.25rem] place-items-center rounded-full bg-flame px-1 text-[0.7rem] font-bold leading-5 text-flame-foreground"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[24rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <Button variant="ghost" size="sm" disabled={unread === 0} onClick={() => markRead({ all: true })}>
            Mark all as read
          </Button>
        </div>
        <DropdownMenuSeparator className="m-0" />
        {loaded && items.length === 0 ? (
          <EmptyNotices />
        ) : (
          <div className="max-h-[min(26rem,60vh)] overflow-y-auto p-1.5">
            {items.map((n) => (
              <DropdownMenuItem key={n.id} onSelect={() => open(n)} className="items-start gap-3 py-2.5">
                <NoticeBody item={n} />
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="justify-center py-3 font-semibold">
          <Link to="/notifications">See all</Link>
        </DropdownMenuItem>
        <span role="status" className="sr-only">
          {unread} unread {unread === 1 ? 'notification' : 'notifications'}
        </span>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
