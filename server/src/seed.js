import bcrypt from 'bcryptjs';
import { countLeaveDays, absenceDays, isLongLeave, todayISO, parseISODate } from '@lms/shared';
import { User } from './models/User.js';
import { LeaveRequest } from './models/LeaveRequest.js';
import { storage } from './storage/index.js';

export const DEMO_PASSWORD = 'Password@123';

export const DEMO_USERS = [
  { key: 'hod', location: 'Bengaluru', name: 'Priya Nair', email: 'priya.nair@akasa.demo', role: 'HOD' },
  { key: 'rahul', location: 'Bengaluru', name: 'Rahul Mehta', email: 'rahul.mehta@akasa.demo', role: 'MANAGER', boss: 'hod' },
  { key: 'ananya', location: 'Mumbai', name: 'Ananya Iyer', email: 'ananya.iyer@akasa.demo', role: 'MANAGER', boss: 'hod' },
  { key: 'arjun', location: 'Bengaluru', name: 'Arjun Sharma', email: 'arjun.sharma@akasa.demo', role: 'EMPLOYEE', boss: 'rahul' },
  { key: 'kavya', location: 'Bengaluru', name: 'Kavya Reddy', email: 'kavya.reddy@akasa.demo', role: 'EMPLOYEE', boss: 'rahul' },
  { key: 'rohan', location: 'Bengaluru', name: 'Rohan Das', email: 'rohan.das@akasa.demo', role: 'EMPLOYEE', boss: 'rahul' },
  { key: 'sneha', location: 'Mumbai', name: 'Sneha Kulkarni', email: 'sneha.kulkarni@akasa.demo', role: 'EMPLOYEE', boss: 'ananya' },
  { key: 'imran', location: 'Mumbai', name: 'Imran Khan', email: 'imran.khan@akasa.demo', role: 'EMPLOYEE', boss: 'ananya' },
  { key: 'meera', location: 'Mumbai', name: 'Meera Joshi', email: 'meera.joshi@akasa.demo', role: 'EMPLOYEE', boss: 'ananya' },
];

/** Demo dates never start or end on a Sunday (Sundays are not counted as leave). */
const nonSunday = (t) => (new Date(t).getUTCDay() === 0 ? t + 86400000 : t);
const offset = (n) => new Date(nonSunday(parseISODate(todayISO()) + n * 86400000)).toISOString().slice(0, 10);

const SAMPLE_PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

/** Creates demo users and sample requests in every status. Safe to call repeatedly (no-op if users exist). */
export async function seedIfEmpty() {
  if ((await User.countDocuments()) > 0) return false;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const byKey = {};
  for (const u of DEMO_USERS) {
    byKey[u.key] = await User.create({
      name: u.name,
      email: u.email,
      role: u.role,
      passwordHash,
      managerId: u.boss ? byKey[u.boss]._id : null,
      location: u.location ?? null,
    });
  }
  const key = await storage.save(SAMPLE_PDF);
  const doc = (who, name) => ({ key, originalName: name, mimeType: 'application/pdf', size: SAMPLE_PDF.length, uploadedBy: byKey[who]._id });

  const step = (who, action, from, to, comment, daysAgo = 1) => ({
    at: new Date(Date.now() - daysAgo * 86400000),
    actorId: byKey[who]._id,
    actorName: byKey[who].name,
    actorRole: byKey[who].role,
    action,
    fromStatus: from,
    toStatus: to,
    comment,
  });

  const make = async (who, from, to, reason, status, steps, opts = {}) => {
    const user = byKey[who];
    const days = countLeaveDays(offset(from), offset(to));
    await LeaveRequest.create({
      employeeId: user._id,
      employeeName: user.name,
      managerId: user.role === 'EMPLOYEE' ? user.managerId : null,
      fromDate: offset(from),
      toDate: offset(to),
      days,
      absenceDays: absenceDays(offset(from), offset(to)),
      isLong: isLongLeave(absenceDays(offset(from), offset(to))),
      reason,
      isEmergency: opts.emergency ?? false,
      status,
      infoRequestedFrom: opts.infoFrom ?? null,
      documents: opts.docName ? [doc(who, opts.docName)] : [],
      timeline: [step(who, 'SUBMITTED', null, opts.start ?? 'PENDING_MANAGER', reason, 5), ...steps],
    });
  };
  const M = 'PENDING_MANAGER';
  const H = 'PENDING_HOD';

  await make('arjun', 10, 11, 'Cousin\'s wedding in Jaipur', M, []);
  await make('arjun', 20, 25, 'Surgery and recovery for my father', M, [], { docName: 'discharge-summary.pdf' });
  await make('kavya', 15, 16, 'Passport renewal appointment', 'INFO_REQUESTED',
    [step('rahul', 'REQUEST_INFO', M, 'INFO_REQUESTED', 'Which day is the appointment? Please confirm so I can plan cover.', 2)], { infoFrom: 'MANAGER' });
  await make('rohan', 30, 34, 'Family trip to Kerala', H,
    [step('rahul', 'APPROVE', M, H, 'Fine from my side, pending HOD.', 2)], { docName: 'flight-booking.pdf' });
  await make('rohan', -20, -19, 'Dental procedure', 'REJECTED',
    [step('rahul', 'REJECT', M, 'REJECTED', 'Release week, we are short on cover. Please pick another date.', 15)]);
  await make('sneha', -10, -9, 'Moving house', 'APPROVED', [step('ananya', 'APPROVE', M, 'APPROVED', 'Approved, good luck with the move.', 12)]);
  await make('sneha', 40, 45, 'Medical treatment', H,
    [step('ananya', 'APPROVE', M, H, 'Approved at manager level.', 2)], { docName: 'medical-certificate.pdf' });
  await make('imran', -35, -30, 'Higher studies exam', 'APPROVED', [
    step('ananya', 'APPROVE', M, H, 'Approved at manager level.', 40),
    step('hod', 'APPROVE', H, 'APPROVED', 'Approved. All the best.', 38),
  ], { docName: 'exam-hall-ticket.pdf' });
  await make('imran', -8, -4, 'Sudden family emergency out of town', 'APPROVED', [
    step('ananya', 'APPROVE', M, H, 'Approved at manager level, documents to follow.', 7),
    step('hod', 'APPROVE', H, 'APPROVED', 'Approved. Please send documents on return.', 6),
  ], { emergency: true });
  await make('imran', 50, 51, 'Personal errand', 'CANCELLED', [step('imran', 'CANCEL', M, 'CANCELLED', 'Plans changed.', 1)]);
  await make('meera', 60, 66, 'Visiting family abroad', 'INFO_REQUESTED', [
    step('ananya', 'APPROVE', M, H, 'Approved at manager level.', 6),
    step('hod', 'REQUEST_INFO', H, 'INFO_REQUESTED', 'Please attach the return ticket as well.', 3),
  ], { docName: 'outbound-ticket.pdf', infoFrom: 'HOD' });
  await make('rahul', 70, 71, 'Annual health check-up', H, [], { start: H });
  await make('hod', 80, 81, 'Conference travel (personal extension)', 'APPROVED',
    [step('hod', 'AUTO_APPROVED', 'APPROVED', 'APPROVED', 'HOD leave is auto-approved and flagged for audit.', 4)], { start: 'APPROVED' });
  return true;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('seed.js')) {
  const { connectDb, disconnectDb } = await import('./db.js');
  await connectDb();
  console.log((await seedIfEmpty()) ? 'Seeded demo data.' : 'Database already has users; skipped.');
  await disconnectDb();
}
