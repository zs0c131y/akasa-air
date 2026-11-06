import { describe, it, expect } from 'vitest';
import { applyAction, allowedActions, initialStatus, ACTIONS } from '../src/workflow.js';

const TODAY = '2026-11-06';
const base = {
  employeeId: 'emp',
  managerId: 'mgr',
  status: 'PENDING_MANAGER',
  infoRequestedFrom: null,
  isLong: false,
  fromDate: '2026-12-01',
  hasApproval: false,
};
const emp = { id: 'emp', role: 'EMPLOYEE' };
const mgr = { id: 'mgr', role: 'MANAGER' };
const otherMgr = { id: 'mgr2', role: 'MANAGER' };
const hod = { id: 'hod', role: 'HOD' };
const run = (s, a, actor) => applyAction({ ...base, ...s }, a, actor, TODAY);

describe('happy paths', () => {
  it('short leave: manager approve -> APPROVED', () => {
    expect(run({}, 'APPROVE', mgr).status).toBe('APPROVED');
  });
  it('long leave: manager approve -> PENDING_HOD -> HOD approve -> APPROVED', () => {
    expect(run({ isLong: true }, 'APPROVE', mgr).status).toBe('PENDING_HOD');
    expect(run({ isLong: true, status: 'PENDING_HOD' }, 'APPROVE', hod).status).toBe('APPROVED');
  });
  it('reject at either level ends the request', () => {
    expect(run({}, 'REJECT', mgr).status).toBe('REJECTED');
    expect(run({ status: 'PENDING_HOD' }, 'REJECT', hod).status).toBe('REJECTED');
  });
  it('info request returns to the stage that asked', () => {
    const asked = run({}, 'REQUEST_INFO', mgr);
    expect(asked).toEqual({ status: 'INFO_REQUESTED', infoRequestedFrom: 'MANAGER' });
    expect(run({ status: 'INFO_REQUESTED', infoRequestedFrom: 'MANAGER' }, 'REPLY', emp).status).toBe('PENDING_MANAGER');
    const askedHod = run({ status: 'PENDING_HOD' }, 'REQUEST_INFO', hod);
    expect(askedHod.infoRequestedFrom).toBe('HOD');
    expect(run({ status: 'INFO_REQUESTED', infoRequestedFrom: 'HOD' }, 'REPLY', emp).status).toBe('PENDING_HOD');
  });
  it('initial status by role', () => {
    expect(initialStatus('EMPLOYEE')).toBe('PENDING_MANAGER');
    expect(initialStatus('MANAGER')).toBe('PENDING_HOD');
    expect(initialStatus('HOD')).toBe('APPROVED');
  });
});

describe('illegal transitions (409)', () => {
  for (const status of ['APPROVED', 'REJECTED', 'CANCELLED']) {
    for (const action of ['APPROVE', 'REJECT', 'REQUEST_INFO', 'REPLY']) {
      it(`${action} on ${status}`, () => {
        expect(() => run({ status }, action, action === 'REPLY' ? emp : mgr)).toThrow(expect.objectContaining({ status: 409 }));
      });
    }
  }
  it('approver actions while INFO_REQUESTED', () => {
    expect(() => run({ status: 'INFO_REQUESTED', infoRequestedFrom: 'MANAGER' }, 'APPROVE', mgr)).toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });
  it('reply when not info-requested', () => {
    expect(() => run({}, 'REPLY', emp)).toThrow(expect.objectContaining({ status: 409 }));
  });
  it('cancel of a started/finished leave', () => {
    expect(() => run({ status: 'REJECTED' }, 'CANCEL', emp)).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => run({ status: 'APPROVED', fromDate: '2026-11-01' }, 'CANCEL', emp)).toThrow(expect.objectContaining({ status: 409 }));
  });
  it('edit after an approval', () => {
    expect(() => run({ status: 'PENDING_HOD', hasApproval: true }, 'EDIT', emp)).toThrow(expect.objectContaining({ status: 409 }));
  });
});

describe('who may act (403)', () => {
  it('nobody approves their own request', () => {
    expect(() => run({ employeeId: 'mgr', managerId: null, status: 'PENDING_HOD' }, 'APPROVE', { id: 'mgr', role: 'MANAGER' })).toThrow(
      expect.objectContaining({ status: 403 }),
    );
    expect(() => run({ employeeId: 'hod', status: 'PENDING_HOD' }, 'APPROVE', hod)).toThrow(expect.objectContaining({ status: 403 }));
  });
  it('another manager, the employee and the HOD cannot decide at manager stage', () => {
    expect(() => run({}, 'APPROVE', otherMgr)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => run({}, 'APPROVE', emp)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => run({}, 'APPROVE', hod)).toThrow(expect.objectContaining({ status: 403 }));
  });
  it('a manager cannot decide at HOD stage', () => {
    expect(() => run({ status: 'PENDING_HOD' }, 'APPROVE', mgr)).toThrow(expect.objectContaining({ status: 403 }));
  });
  it('only the owner can reply, cancel or edit', () => {
    expect(() => run({ status: 'INFO_REQUESTED', infoRequestedFrom: 'MANAGER' }, 'REPLY', mgr)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => run({}, 'CANCEL', mgr)).toThrow(expect.objectContaining({ status: 403 }));
  });
  it('a future approved leave can be cancelled by its owner', () => {
    expect(run({ status: 'APPROVED' }, 'CANCEL', emp).status).toBe('CANCELLED');
  });
});

describe('allowedActions', () => {
  it('lists exactly what each actor can do', () => {
    expect(allowedActions(base, mgr, TODAY).sort()).toEqual(['APPROVE', 'REJECT', 'REQUEST_INFO']);
    expect(allowedActions(base, emp, TODAY).sort()).toEqual(['CANCEL', 'EDIT']); // short leave: no document upload
    expect(allowedActions({ ...base, isLong: true }, emp, TODAY).sort()).toEqual(['ATTACH', 'CANCEL', 'EDIT']);
    expect(allowedActions(base, otherMgr, TODAY)).toEqual([]);
    expect(ACTIONS.length).toBe(7);
  });
});
