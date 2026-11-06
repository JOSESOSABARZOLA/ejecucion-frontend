/**
 * Microservicio: ejecucion
 * Módulo: Compartido / HTTP — Fase 03.11 / Plan 03
 * Feature: Rutas de sesión excluidas de la reacción global a 401
 * Archivo: authPaths.ts
 * Responsabilidad: Declarar la lista ÚNICA de rutas cuyo 401 NO debe disparar la reacción global de
 *   sesión caída. Son los endpoints que se consultan justamente cuando todavía no hay sesión: sin esta
 *   exclusión, el bootstrap de un usuario anónimo entraría en bucle de redirección (P-01). `/auth/me`
 *   NO está en la lista a propósito: un 401 ahí sí significa que la sesión murió (T-0311-13).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

/** Rutas de sesión: su 401 es una respuesta normal, no una sesión caída. */
export const AUTH_SESSION_PATHS = [
  "/auth/session",
  "/auth/session/exchange",
  "/auth/session/logout",
  "/auth/mode",
] as const;

/**
 * Normaliza una url de petición a un pathname comparable: descarta el origen si es absoluta, recorta
 * query y fragmento, quita el prefijo `/api` del proxy de producción y la barra final sobrante.
 * @param url url tal como la recibió axios
 * @returns el pathname normalizado
 */
function normalizePath(url: string): string {
  let path = url;

  if (path.startsWith("http")) {
    try {
      path = new URL(path).pathname;
    } catch {
      return "";
    }
  }

  const queryOrHash = path.search(/[?#]/);

  if (queryOrHash >= 0) {
    path = path.slice(0, queryOrHash);
  }

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  if (path.startsWith("/api/")) {
    path = path.slice("/api".length);
  }

  if (path.length > 1) {
    path = path.replace(/\/+$/, "");
  }

  return path;
}

/**
 * Indica si una url corresponde a un endpoint de sesión, cuyo 401 debe ignorar la reacción global.
 * La comparación es por IGUALDAD exacta, nunca por prefijo: así `/auth/sessionfoo` no queda excluida
 * por accidente.
 * @param url url de la petición (relativa o absoluta)
 * @returns true si es una ruta de sesión
 */
export function isAuthSessionPath(url?: string): boolean {
  if (!url) {
    return false;
  }

  const path = normalizePath(url);

  return (AUTH_SESSION_PATHS as readonly string[]).includes(path);
}
