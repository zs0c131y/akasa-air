import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { ErrorBox, PageHeader, Panel } from '../components.jsx';
import { EmptyNotices, NoticeBody, useNotifications } from '../notifications.jsx';
import { Button } from '../ui/button.jsx';
import { Skeleton } from '../ui/skeleton.jsx';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { items, unread, loaded, error, markRead } = useNotifications(100);
  const open = (n) => {
    if (!n.read) markRead({ ids: [n.id] });
    if (n.leaveId) navigate(`/leaves/${n.leaveId}`);
  };
  return (
    <section>
      <PageHeader
        kicker="Your notices"
        title="Notifications"
        description="The latest 100 things that happened on your requests, or that are waiting for you."
      >
        <Button variant="outline" disabled={unread === 0} onClick={() => markRead({ all: true })}>
          <CheckCheck />
          Mark all as read
        </Button>
      </PageHeader>
      <ErrorBox error={error} className="mb-4" />
      {!loaded && <Skeleton className="h-40 rounded-lg" />}
      {loaded && items.length === 0 && (
        <Panel>
          <EmptyNotices />
        </Panel>
      )}
      {items.length > 0 && (
        <Panel className="p-2 sm:p-3">
          <p aria-live="polite" className="sr-only">
            {unread} unread
          </p>
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className="flex min-h-11 w-full items-start gap-3 rounded-md px-3 py-3 hover:bg-accent/50"
                >
                  <NoticeBody item={n} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </section>
  );
}
