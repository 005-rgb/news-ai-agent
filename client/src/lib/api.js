import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — unwrap .data, handle 401
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data?.error || err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  login:  (u, p) => api.post('/auth/login',  { username: u, password: p }),
  logout: ()      => api.post('/auth/logout'),
  me:     ()      => api.get('/auth/me'),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analytics = {
  overview:  ()          => api.get('/analytics/overview'),
  production:(params)    => api.get('/analytics/production', { params }),
  pipeline:  ()          => api.get('/analytics/pipeline'),
  providers: ()          => api.get('/analytics/providers'),
  logs:      (params)    => api.get('/analytics/logs', { params }),
  activity:  ()          => api.get('/analytics/activity'),
};

// ── Sites ─────────────────────────────────────────────────────────────────────
export const sites = {
  list:   ()        => api.get('/sites'),
  get:    (id)      => api.get(`/sites/${id}`),
  create: (data)    => api.post('/sites', data),
  update: (id,data) => api.patch(`/sites/${id}`, data),
  delete: (id)      => api.delete(`/sites/${id}`),
  test:   (id)      => api.post(`/sites/${id}/test`),
};

// ── API Keys ──────────────────────────────────────────────────────────────────
export const apiKeys = {
  list:      ()        => api.get('/keys'),
  alerts:    ()        => api.get('/keys/alerts'),
  stats:     ()        => api.get('/keys/stats'),
  order:     ()        => api.get('/keys/order'),
  saveOrder: (chain)   => api.put('/keys/order', { chain }),
  create:    (data)    => api.post('/keys', data),
  update:    (id,data) => api.patch(`/keys/${id}`, data),
  delete:    (id)      => api.delete(`/keys/${id}`, { data: { confirm: true } }),
  test:      (id)      => api.post(`/keys/${id}/test`),
};

// ── Sources ───────────────────────────────────────────────────────────────────
export const sources = {
  list:   (params)  => api.get('/sources', { params }),
  create: (data)    => api.post('/sources', data),
  update: (id,data) => api.patch(`/sources/${id}`, data),
  delete: (id)      => api.delete(`/sources/${id}`),
  toggle: (id)      => api.patch(`/sources/${id}/toggle`),
  test:   (id)      => api.post(`/sources/${id}/test`),
};

// ── Articles ──────────────────────────────────────────────────────────────────
export const articles = {
  list:         (params)  => api.get('/articles', { params }),
  get:          (id)      => api.get(`/articles/${id}`),
  delete:       (id)      => api.delete(`/articles/${id}`, { data: { confirm: true } }),
  forcePublish: (id)      => api.post(`/articles/${id}/force-publish`),
  regenerate:   (id,step) => api.post(`/articles/${id}/regenerate`, { from_step: step }),
};

// ── Queue ─────────────────────────────────────────────────────────────────────
export const queue = {
  list:       (params)  => api.get('/queue', { params }),
  dead:       ()        => api.get('/queue/dead'),
  retryDead:  (id)      => api.post(`/queue/dead/${id}/retry`),
  deleteJob:  (id)      => api.delete(`/queue/${id}`),
  run:        (data)    => api.post('/queue/run', data),
};

// ── Calendar ──────────────────────────────────────────────────────────────────
export const calendar = {
  list:   (params)  => api.get('/calendar', { params }),
  create: (data)    => api.post('/calendar', data),
  update: (id,data) => api.patch(`/calendar/${id}`, data),
  delete: (id)      => api.delete(`/calendar/${id}`),
};

// ── Rapat ─────────────────────────────────────────────────────────────────────
export const rapat = {
  list:        ()   => api.get('/rapat'),
  latest:      ()   => api.get('/rapat/latest'),
  get:         (id) => api.get(`/rapat/${id}`),
  predictions: ()   => api.get('/rapat/trends/predictions'),
  trigger:     ()   => api.post('/rapat/trigger'),
};

// ── Settings ──────────────────────────────────────────────────────────────────
export const settings = {
  get:                 ()          => api.get('/settings'),
  export:              ()          => api.get('/settings/export'),
  changePassword:      (data)      => api.post('/settings/change-password', data),
  promptTemplates:     ()          => api.get('/settings/prompt-templates'),
  createTemplate:      (data)      => api.post('/settings/prompt-templates', data),
  updateTemplate:      (id,data)   => api.patch(`/settings/prompt-templates/${id}`, data),
};
