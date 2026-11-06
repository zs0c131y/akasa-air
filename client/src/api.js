const TOKEN_KEY = 'lms_token';

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor({ code, message, hint, fields, status }) {
    super(message);
    Object.assign(this, { code, hint, fields: fields ?? {}, status });
  }
}

async function request(path, { method = 'GET', json, form, raw } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
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
  me: () => request('/auth/me'),
  audit: (params) => request(`/audit?${new URLSearchParams(params)}`),
  list: (params) => request(`/leaves?${new URLSearchParams(params)}`),
  get: (id) => request(`/leaves/${id}`),
  obligations: () => request('/leaves/obligations'),
  create: (form) => request('/leaves', { method: 'POST', form }),
  update: (id, form) => request(`/leaves/${id}`, { method: 'PATCH', form }),
  act: (id, action, json = {}) => request(`/leaves/${id}/${action}`, { method: 'POST', json }),
  reply: (id, form) => request(`/leaves/${id}/reply`, { method: 'POST', form }),
  attach: (id, form) => request(`/leaves/${id}/documents`, { method: 'POST', form }),
  async openDocument(id, docId) {
    const res = await request(`/leaves/${id}/documents/${docId}`, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};
