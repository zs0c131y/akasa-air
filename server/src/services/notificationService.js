import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { config } from '../config.js';
import { isMailConfigured, notificationEmail, sendMail } from './mail.js';

/**
 * Addresses that must never be emailed: the demo people (@akasa.demo) and any other made-up domain, so no sending
 * quota is spent on them. Extend with NO_EMAIL_DOMAINS (comma separated).
 */
const NEVER_EMAIL_SUFFIXES = ['.demo', '.test', '.example', '.invalid', '.localhost', '.local'];
const NEVER_EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net'];

export function isDeliverableEmail(email) {
  const domain = String(email ?? '')
    .split('@')[1]
    ?.toLowerCase();
  if (!domain || !domain.includes('.')) return false;
  if (NEVER_EMAIL_DOMAINS.includes(domain)) return false;
  if (NEVER_EMAIL_SUFFIXES.some((s) => domain.endsWith(s))) return false;
  const extra = (process.env.NO_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  return !extra.some((d) => domain === d || domain.endsWith(`.${d}`));
}

const range = (l) => (l.fromDate === l.toDate ? l.fromDate : `${l.fromDate} to ${l.toDate}`);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** One notice for one person: always saved in the app, and emailed too when that is switched on and the address is real. */
export async function notify(user, { kind, title, body = '', leaveId = null }) {
  if (!user) return null;
  const row = await Notification.create({ userId: user._id, kind, title, body, leaveId });
  const wantsEmail =
    user.emailNotifications !== false && user.emailVerified !== false && isMailConfigured() && isDeliverableEmail(user.email);
  if (wantsEmail) {
    const url = leaveId ? `${config.appUrl}/leaves/${leaveId}` : config.appUrl;
    await sendMail({ to: user.email, ...notificationEmail({ name: user.name.split(' ')[0], title, body, url }) }, { link: url });
  }
  return row;
}

const hods = () => User.find({ role: 'HOD' });

/** Who has to answer a request in its current stage. */
async function approversFor(leave) {
  if (leave.status === 'PENDING_MANAGER' && leave.managerId) return [await User.findById(leave.managerId)];
  if (leave.status === 'PENDING_HOD' || leave.status === 'PENDING_MANAGER') return hods();
  return [];
}

/**
 * Called after a request is filed or acted on. Never throws, so a notification problem cannot break the action.
 * `action` is SUBMITTED, APPROVE, REJECT, REQUEST_INFO, REPLY or CANCEL; `actor` is the signed-in user who did it.
 */
export async function notifyLeaveEvent(action, leaveId, actor) {
  try {
    const leave = await LeaveRequest.findById(leaveId).lean();
    if (!leave) return;
    const employee = await User.findById(leave.employeeId);
    const what = `${range(leave)}, ${plural(leave.days, 'leave day')}`;
    const lastComment = leave.timeline?.at(-1)?.comment;
    const by = actor?.name ?? 'Someone';

    if (action === 'SUBMITTED') {
      if (leave.status === 'APPROVED') return; // HOD leave is approved on the spot
      for (const a of await approversFor(leave)) {
        if (a && String(a._id) !== String(actor?.id))
          await notify(a, {
            kind: 'WAITING',
            title: `${leave.employeeName} asked for leave`,
            body: `${what}. It is waiting for you.`,
            leaveId,
          });
      }
      return;
    }
    if (action === 'APPROVE') {
      if (leave.status === 'PENDING_HOD') {
        await notify(employee, {
          kind: 'APPROVED_STEP',
          title: 'Your manager approved your request',
          body: `${what}. It now goes to the head of department.`,
          leaveId,
        });
        for (const a of await hods())
          if (String(a._id) !== String(actor?.id))
            await notify(a, {
              kind: 'WAITING',
              title: `${leave.employeeName}'s request is waiting for you`,
              body: `${what}. Approved by ${by}.`,
              leaveId,
            });
      } else {
        await notify(employee, {
          kind: 'APPROVED',
          title: 'Your leave was approved',
          body: `${what}. Approved by ${by}.${lastComment ? ` They wrote: "${lastComment}"` : ''}`,
          leaveId,
        });
      }
      return;
    }
    if (action === 'REJECT') {
      await notify(employee, {
        kind: 'REJECTED',
        title: 'Your leave was not approved',
        body: `${what}. ${by} wrote: "${lastComment ?? ''}"`,
        leaveId,
      });
      return;
    }
    if (action === 'REQUEST_INFO') {
      await notify(employee, {
        kind: 'QUESTION',
        title: `${by} has a question about your request`,
        body: `${what}. "${lastComment ?? ''}" Reply from the request page.`,
        leaveId,
      });
      return;
    }
    if (action === 'REPLY') {
      for (const a of await approversFor(leave))
        if (a)
          await notify(a, {
            kind: 'WAITING',
            title: `${leave.employeeName} replied`,
            body: `${what}. The request is back with you.`,
            leaveId,
          });
      return;
    }
    if (action === 'CANCEL') {
      for (const a of await approversFor({ ...leave, status: leave.timeline.at(-1)?.fromStatus ?? leave.status })) {
        if (a)
          await notify(a, {
            kind: 'CANCELLED',
            title: `${leave.employeeName} cancelled a request`,
            body: `${what}. You do not need to answer it.`,
            leaveId,
          });
      }
    }
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', event: 'notify_failed', action, error: err?.message }));
  }
}

export async function listFor(userId, { limit = 30 } = {}) {
  const [items, unread] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(Number(limit) || 30, 1), 100))
      .lean(),
    Notification.countDocuments({ userId, readAt: null }),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: String(n._id),
      kind: n.kind,
      title: n.title,
      body: n.body,
      leaveId: n.leaveId ? String(n.leaveId) : null,
      read: Boolean(n.readAt),
      createdAt: n.createdAt,
    })),
  };
}

export async function markRead(userId, { ids, all }) {
  const filter = {
    userId,
    readAt: null,
    ...(all ? {} : { _id: { $in: Array.isArray(ids) ? ids.filter((i) => typeof i === 'string') : [] } }),
  };
  const r = await Notification.updateMany(filter, { readAt: new Date() });
  return { updated: r.modifiedCount };
}
