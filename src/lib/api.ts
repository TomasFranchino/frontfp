import axios from 'axios';
import { toast } from 'sonner';

axios.defaults.withCredentials = true;
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// CSRF Token Management (compatible con same-origin y cross-origin)
// ---------------------------------------------------------------------------

/** Token cacheado en memoria para evitar requests extras al endpoint */
let cachedCsrfToken: string | null = null;

/** Promesa en vuelo para evitar requests duplicados al endpoint CSRF */
let csrfFetchPromise: Promise<string | null> | null = null;

function getCookieValue(cookieName: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookiePrefix = `${cookieName}=`;

  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(cookiePrefix))
    ?.slice(cookiePrefix.length) ?? null;
}

/**
 * Obtiene el CSRF token con la siguiente prioridad:
 * 1. Cookie (funciona en desarrollo same-origin)
 * 2. Caché en memoria (evita requests repetidas en producción)
 * 3. Endpoint /csrf/token (producción cross-origin)
 */
async function getCSRFToken(): Promise<string | null> {
  // 1. Intentar leer de la cookie (funciona en desarrollo same-origin)
  const fromCookie = getCookieValue('csrftoken');
  if (fromCookie) {
    cachedCsrfToken = fromCookie;
    return fromCookie;
  }

  // 2. Si ya lo tenemos cacheado en memoria (producción cross-origin)
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  // 3. Obtener del endpoint (primera vez en producción cross-origin)
  //    Usamos una promesa compartida para evitar requests duplicados
  //    si múltiples peticiones se disparan al mismo tiempo.
  if (!csrfFetchPromise) {
    csrfFetchPromise = axios
      .get<{ csrftoken: string }>(`${import.meta.env.VITE_API_URL}/csrf/token`, {
        withCredentials: true,
      })
      .then(({ data }) => {
        cachedCsrfToken = data.csrftoken;
        return cachedCsrfToken;
      })
      .catch(() => null)
      .finally(() => {
        csrfFetchPromise = null;
      });
  }

  return csrfFetchPromise;
}

/**
 * Invalida el token CSRF cacheado.
 * Se llama cuando el servidor rechaza con 403 para forzar un refresh.
 */
export function invalidateCsrfToken(): void {
  cachedCsrfToken = null;
}

/**
 * Precarga el CSRF token desde el endpoint del backend.
 * 
 * DEBE llamarse inmediatamente después del login exitoso y cuando la app
 * detecta una sesión existente (GET /auth/me retorna usuario).
 * 
 * Esto asegura que:
 * 1. El token se cachea en memoria para inyectarlo en el header X-CSRFToken.
 * 2. La cookie `csrftoken` se establece en el navegador (vía Set-Cookie del
 *    response), de modo que estará disponible para cuando Django la compare
 *    con el header en la próxima petición POST.
 * 
 * Sin esta precarga, la primera petición POST falla con 403 porque el
 * navegador no ha procesado aún el Set-Cookie de la fetch concurrent.
 */
export async function prefetchCsrfToken(): Promise<void> {
  try {
    const { data } = await axios.get<{ csrftoken: string }>(
      `${import.meta.env.VITE_API_URL}/csrf/token`,
      { withCredentials: true }
    );
    cachedCsrfToken = data.csrftoken;
  } catch {
    // Silenciar — se reintentará en el interceptor cuando sea necesario
  }
}

// ---------------------------------------------------------------------------
// Error Formatting
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Request Interceptor — Inyecta X-CSRFToken en métodos unsafe
// ---------------------------------------------------------------------------

api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase() ?? 'GET';
  const isUnsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isUnsafeMethod) {
    const csrfToken = await getCSRFToken();

    if (csrfToken) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }

  return config;
});

// ---------------------------------------------------------------------------
// Response Interceptor — Manejo de 401 y errores globales
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url;

    const isAuthEndpoint = typeof url === 'string' && /(?:^|\/)auth\//.test(url);

    if (status === 401 && !isAuthEndpoint) {

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }

      return Promise.reject(error);
    }

    // Si el servidor rechaza con 403 CSRF, invalidamos el token cacheado
    // para que la próxima petición obtenga uno nuevo.
    if (status === 403) {
      invalidateCsrfToken();
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
