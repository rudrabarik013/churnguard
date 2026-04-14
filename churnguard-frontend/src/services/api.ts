/**
 * ChurnGuard API Service
 * Axios instance with JWT interceptor and global error handling.
 */
import axios, { AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// ── Request interceptor: inject JWT ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cg_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: global error handling ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (!error.response) {
      // Network error — backend offline
      const event = new CustomEvent('backend-offline');
      window.dispatchEvent(event);
    } else if (error.response.status === 401) {
      // Token expired — redirect to login
      localStorage.removeItem('cg_token');
      localStorage.removeItem('cg_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email: string, password: string) =>
    api.post('/api/auth/login',    { email, password }),
  register: (email: string, password: string, role: string) =>
    api.post('/api/auth/register', { email, password, role }),
  me:       () => api.get('/api/auth/me'),
};

// ── Metrics ───────────────────────────────────────────────────────────────────
export const metricsApi = {
  kpi:      () => api.get('/api/metrics/kpi'),
  insights: () => api.get('/api/metrics/insights'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  churnDistribution: () => api.get('/api/dashboard/churn-distribution'),
  geography:         () => api.get('/api/dashboard/geography'),
  demographics:      () => api.get('/api/dashboard/demographics'),
  productsActivity:  () => api.get('/api/dashboard/products-activity'),
  financials:        () => api.get('/api/dashboard/financials'),
  correlations:      () => api.get('/api/dashboard/correlations'),
  featureImportance: () => api.get('/api/dashboard/feature-importance'),
  modelComparison:   () => api.get('/api/dashboard/model-comparison'),
};

// ── Retention ─────────────────────────────────────────────────────────────────
export const retentionApi = {
  segments: () => api.get('/api/retention/segments'),
};

// ── Simulation ────────────────────────────────────────────────────────────────
export const simulationApi = {
  scenarios: () => api.get('/api/simulation/scenarios'),
  run:       (scenario_name: string) => api.post('/api/simulation/run', { scenario_name }),
  logs:      () => api.get('/api/simulation/logs'),
};

// ── Predict ───────────────────────────────────────────────────────────────────
export const predictApi = {
  single: (data: object) => api.post('/api/predict/single', data),
  batch:  (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/predict/batch', form, {
      responseType: 'blob',
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:   () => api.get('/api/users'),
  delete: (id: string) => api.delete(`/api/users/${id}`),
};

// ── Health ────────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/api/health'),
};
