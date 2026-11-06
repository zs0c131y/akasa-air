import { AuditLog } from '../models/AuditLog.js';

/**
 * Appends an audit entry. The actor defaults to the signed-in user on req.
 * Never throws: a failure to log must not break the user's action.
 */
export async function audit(req, { action, actor, entityId, employeeName, fromStatus, toStatus, detail }) {
  try {
    const who = actor ?? req.user ?? null;
    await AuditLog.create({
      actorId: who?.id ?? null,
      actorName: who?.name ?? 'Anonymous',
      actorRole: who?.role ?? null,
      action,
      entityId: entityId ?? null,
      employeeName: employeeName ?? null,
      fromStatus: fromStatus ?? null,
      toStatus: toStatus ?? null,
      detail: detail ? String(detail).slice(0, 500) : null,
      ip: req.ip ?? null,
    });
  } catch (err) {
    console.error('[audit] failed to write entry:', err.message);
  }
}

export async function listAudit({ page = 1, pageSize = 25, action, q }) {
  const filter = {};
  if (action) filter.action = String(action);
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ actorName: rx }, { employeeName: rx }, { detail: rx }];
  }
  const size = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const pg = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip((pg - 1) * size).limit(size).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    items: items.map((i) => ({ ...i, id: String(i._id), _id: undefined, actorId: i.actorId ? String(i.actorId) : null })),
    total,
    page: pg,
    pageSize: size,
  };
}
