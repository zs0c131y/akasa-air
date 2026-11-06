// Sessions live in httpOnly cookies set by the server; no token is ever stored in JavaScript.

export class ApiError extends Error {
  constructor({ code, message, hint, fields, status }) {
    super(message);
    Object.assign(this, { code, hint, fields: fields ?? {}, status });
  }
}

let refreshing = null;

async function request(path, { method = 'GET', json, form, raw, retry = true } = {}) {
  const headers = { 'X-Requested-With': 'lms' };
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) body = form;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body });
  } catch {
    throw new ApiError({
      code: 'NETWORK',
      message: 'We could not reach the server.',
      hint: 'Check your internet connection and try again.',
    });
  }
  if (res.status === 401 && retry && (!path.startsWith('/auth/') || path === '/auth/me')) {
    // Access token expired: renew it once (shared between parallel calls), then retry.
    refreshing ??= request('/auth/refresh', { method: 'POST', retry: false }).finally(() => {
      refreshing = null;
    });
    try {
      await refreshing;
      return request(path, { method, json, form, raw, retry: false });
    } catch {
      /* fall through to the original 401 */
    }
  }
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError({
      ...(data?.error ?? { code: 'UNKNOWN', message: 'Something went wrong.', hint: 'Please try again.' }),
      status: res.status,
    });
  }
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', json: { email, password } }),
  authOptions: () => request('/auth/options'),
  signup: (json) => request('/auth/signup', { method: 'POST', json }),
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', json: { token } }),
  resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', json: { email } }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', json: { email } }),
  checkReset: (token) => request('/auth/check-reset', { method: 'POST', json: { token } }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', json: { token, password } }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', json: { currentPassword, newPassword } }),
  setManager: (id, managerId) => request(`/people/${id}/manager`, { method: 'PATCH', json: { managerId } }),
  setRole: (id, role) => request(`/people/${id}/role`, { method: 'PATCH', json: { role } }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  chain: (from, to, excludeId) => request(`/leaves/chain?${new URLSearchParams({ from, to, ...(excludeId ? { excludeId } : {}) })}`),
  stats: () => request('/stats'),
  calendar: (from, to) => request(`/leaves/calendar?${new URLSearchParams({ from, to })}`),
  holidays: (params = {}) => request(`/holidays${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''}`),
  addHoliday: (json) => request('/holidays', { method: 'POST', json }),
  removeHoliday: (id) => request(`/holidays/${id}`, { method: 'DELETE' }),
  importHolidays: (csv, apply) => request('/holidays/import', { method: 'POST', json: { csv, apply } }),
  setPreferences: (json) => request('/preferences', { method: 'PATCH', json }),
  balance: (year) => request(`/balance?${new URLSearchParams({ year })}`),
  allowances: (year) => request(`/allowances?${new URLSearchParams({ year })}`),
  setDefaultAllowance: (days) => request('/allowances/default', { method: 'PUT', json: { days } }),
  setAllowance: (userId, year, days) => request(`/allowances/${userId}`, { method: 'PUT', json: { year, days } }),
  resetAllowance: (userId, year) => request(`/allowances/${userId}?${new URLSearchParams({ year })}`, { method: 'DELETE' }),
  importAllowances: (csv, apply) => request('/allowances/import', { method: 'POST', json: { csv, apply } }),
  notifications: (limit = 8) => request(`/notifications?${new URLSearchParams({ limit })}`),
  markRead: (body) => request('/notifications/read', { method: 'POST', json: body }),
  locations: () => request('/locations'),
  addLocation: (name) => request('/locations', { method: 'POST', json: { name } }),
  removeLocation: (id) => request(`/locations/${id}`, { method: 'DELETE' }),
  people: () => request('/people'),
  setLocation: (id, location) => request(`/people/${id}/location`, { method: 'PATCH', json: { location } }),
  audit: (params) => request(`/audit?${new URLSearchParams(params)}`),
  list: (params) => request(`/leaves?${new URLSearchParams(params)}`),
  get: (id) => request(`/leaves/${id}`),
  obligations: () => request('/leaves/obligations'),
  create: (form) => request('/leaves', { method: 'POST', form }),
  update: (id, form) => request(`/leaves/${id}`, { method: 'PATCH', form }),
  act: (id, action, json = {}) => request(`/leaves/${id}/${action}`, { method: 'POST', json }),
  reply: (id, form) => request(`/leaves/${id}/reply`, { method: 'POST', form }),
  attach: (id, form) => request(`/leaves/${id}/documents`, { method: 'POST', form }),
  monthly: (year) => request(`/stats/monthly?${new URLSearchParams({ year })}`),
  /** Downloads the CSV through the cookie session and saves it with a temporary link. */
  async exportCsv(params) {
    const res = await request(`/leaves/export.csv?${new URLSearchParams(params)}`, { raw: true });
    const name = /filename="?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'leave-requests.csv';
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return name;
  },
  async openDocument(id, docId) {
    const res = await request(`/leaves/${id}/documents/${docId}`, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};
