/**
 * Microservicio: ejecucion
 * Módulo: App Shell — Fase 03.11 / Plan 03
 * Feature: Costura única de navegación dura del navegador
 * Archivo: navigation.ts
 * Responsabilidad: Concentrar en UN solo módulo toda navegación de documento (`window.location`) del
 *   frontend. El guard, el logout y el redirect al portal de Auth central navegan por aquí y NUNCA
 *   llamando a `window.location` directamente: así los tests pueden sustituir este módulo con `vi.mock`
 *   sin pelearse con jsdom, que trata `window.location` como no configurable en varios entornos.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

/**
 * Navega el documento completo a `url`, reemplazando la entrada actual del historial.
 * Es navegación DURA (recarga la app): nunca usar para rutas internas, para eso está el router.
 * @param url URL absoluta a la que navegar
 */
export function replaceLocation(url: string): void {
  window.location.replace(url);
}

/**
 * Origen (`protocolo://host:puerto`) del navegador actual.
 * Es la ÚNICA fuente admitida para construir el `redirectUri` del portal de Auth central: derivarlo
 * de un query param entrante abriría un open redirect (T-0311-12).
 * @returns el origen actual
 */
export function currentOrigin(): string {
  return window.location.origin;
}
