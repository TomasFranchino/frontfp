import axios from 'axios';
import { toast } from 'sonner';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

function getCookieValue(cookieName: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookiePrefix = `${cookieName}=`;

  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(cookiePrefix))
    ?.slice(cookiePrefix.length) ?? null;
}

function getApiErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return 'Ocurrió un error inesperado.';
  }

  const data = error.response?.data;

  if (data && typeof data === 'object' && !(data instanceof Blob)) {
    const payload = data as { mensaje?: unknown; detail?: unknown; message?: unknown; error?: unknown };
    const backendMessage = payload.mensaje ?? payload.detail ?? payload.message ?? payload.error;

    if (typeof backendMessage === 'string' && backendMessage.trim()) {
      return backendMessage;
    }
  }

  if (error.response?.status) {
    return `Error ${error.response.status}: no se pudo completar la operación.`;
  }

  return 'No se pudo conectar con el servidor.';
}

api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase() ?? 'GET';
  const isUnsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isUnsafeMethod) {
    const csrfToken = getCookieValue('csrftoken');

    if (csrfToken) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url;

    const isAuthEndpoint = typeof url === 'string' && url.startsWith('/auth/');

    if (status === 401 && !isAuthEndpoint) {

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }

      return Promise.reject(error);
    }

    if (status >= 400 || !status) {
      if (!error?.config?.headers?.['X-Skip-Toast']) {
        toast.error(getApiErrorMessage(error));
      }
    }

    return Promise.reject(error);
  },
);

export default api;
