import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const SKIP_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/me'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestPath = originalRequest?.url || '';

    const shouldSkip =
      originalRequest._retry ||
      SKIP_REFRESH.some((p) => requestPath.includes(p));

    if (error.response?.status === 401 && !shouldSkip) {
      originalRequest._retry = true;
      try {
        await api.post('/auth/refresh');
        return api(originalRequest);
      } catch {
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
