import { todayISO, parseISODate } from '@lms/shared';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { countAwaitingSetup } from './holidayService.js';

const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const OPEN = ['PENDING_MANAGER', 'PENDING_HOD', 'INFO_REQUESTED'];

const median = (nums) => {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Which requests a person looks after: all (HOD), their team plus themselves (manager), only their own (employee). */
function scopeFilter(user) {
  if (user.role === 'HOD') return {};
  if (user.role === 'MANAGER') return { $or: [{ managerId: user.id }, { employeeId: user.id }] };
  return { employeeId: user.id };
}

/**
 * Numbers for the home screen. Everyone gets `mine`. Managers and the HOD also get `queue`, `team` and `decisions`.
 * Nothing here exposes a request a person could not already open.
 */
export async function dashboardStats(user) {
  const today = todayISO();
  const weekEnd = iso(parseISODate(today) + 6 * DAY);
  const year = today.slice(0, 4);

  const mineRows = await LeaveRequest.find({ employeeId: user.id }, { status: 1, days: 1, fromDate: 1, toDate: 1, reason: 1, isEmergency: 1 }).lean();
  const byStatus = {};
  for (const r of mineRows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const upcoming = mineRows
    .filter((r) => r.status === 'APPROVED' && r.toDate >= today)
    .sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1))[0];
  const out = {
    mine: {
      byStatus,
      open: mineRows.filter((r) => OPEN.includes(r.status)).length,
      approvedDaysThisYear: mineRows.filter((r) => r.status === 'APPROVED' && r.fromDate.startsWith(year)).reduce((n, r) => n + r.days, 0),
      next: upcoming ? { id: String(upcoming._id), fromDate: upcoming.fromDate, toDate: upcoming.toDate, days: upcoming.days } : null,
    },
  };
  if (user.role === 'EMPLOYEE') return out;

  const queueFilter = user.role === 'HOD' ? { status: 'PENDING_HOD' } : { status: 'PENDING_MANAGER', managerId: user.id };
  const [waiting, away, finished] = await Promise.all([
    LeaveRequest.find(queueFilter, { createdAt: 1, updatedAt: 1, employeeName: 1, days: 1, isLong: 1 }).sort({ updatedAt: 1 }).limit(200).lean(),
    LeaveRequest.find({ ...scopeFilter(user), status: 'APPROVED', fromDate: { $lte: weekEnd }, toDate: { $gte: today } }, { employeeId: 1, fromDate: 1, toDate: 1 }).lean(),
    LeaveRequest.find({ ...scopeFilter(user), status: { $in: ['APPROVED', 'REJECTED'] }, createdAt: { $gte: new Date(Date.now() - 90 * DAY) } }, { timeline: 1 }).limit(300).lean(),
  ]);

  const oldest = waiting[0];
  out.queue = {
    waiting: waiting.length,
    long: waiting.filter((w) => w.isLong).length,
    oldestWaitingDays: oldest ? Math.floor((Date.now() - new Date(oldest.updatedAt).getTime()) / DAY) : 0,
    oldestWaitingHours: oldest ? Math.floor((Date.now() - new Date(oldest.updatedAt).getTime()) / 3600000) : 0,
    oldestSince: oldest ? new Date(oldest.updatedAt).toISOString() : null,
    oldestName: oldest?.employeeName ?? null,
  };
  const people = (rows) => new Set(rows.map((r) => String(r.employeeId))).size;
  out.team = {
    awayToday: people(away.filter((r) => r.fromDate <= today && r.toDate >= today)),
    awayThisWeek: people(away),
  };

  // Hours from "submitted" to the first approve or reject, over the last 90 days.
  const hours = [];
  for (const d of finished) {
    const sub = d.timeline.find((t) => t.action === 'SUBMITTED');
    const dec = d.timeline.find((t) => t.action === 'APPROVE' || t.action === 'REJECT');
    if (sub && dec) hours.push((new Date(dec.at) - new Date(sub.at)) / 3600000);
  }
  const med = median(hours);
  out.decisions = { decided: hours.length, medianHours: med === null ? null : Math.round(med * 10) / 10 };
  if (user.role === 'HOD') out.awaitingSetup = await countAwaitingSetup();
  return out;
}
