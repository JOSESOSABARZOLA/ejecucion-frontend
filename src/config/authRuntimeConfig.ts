/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 03
 * Feature: Armado de las URLs del portal de Auth central
 * Archivo: authRuntimeConfig.ts
 * Responsabilidad: Ser el ÚNICO lugar donde se construye la URL del portal de Auth central
 *   (`<PORTAL>?redirectUri=<origen>/auth/callback&module=<CODIGO>`) y donde se resuelve la URL de
 *   logout. El `redirectUri` se deriva SIEMPRE del origen del propio navegador y jamás de un query
 *   param entrante (T-0311-12, open redirect). La navegación al portal es de documento, no de router,
 *   y pasa por la costura `replaceLocation` de `utils/navigation`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { currentOrigin, replaceLocation } from "../utils/navigation";
import { env } from "./env";

/** Ruta interna a la que Auth central devuelve al usuario tras autenticarlo. */
const CALLBACK_PATH = "/auth/callback";

/**
 * Arma la URL del portal a partir de sus tres piezas. Función pura, sin `env` ni `window`: es la que
 * concentra la codificación de los parámetros, de modo que si el portal exigiera el `redirectUri` sin
 * codificar el cambio sería de una sola línea.
 * @param portalUrl URL base del portal (puede traer query propia)
 * @param moduleCode código del módulo registrado en Auth central
 * @param origin origen del navegador (`protocolo://host:puerto`)
 * @returns la URL completa del portal
 */
export function buildPortalUrl(
  portalUrl: string,
  moduleCode: string,
  origin: string,
): string {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const query = new URLSearchParams({
    redirectUri: `${normalizedOrigin}${CALLBACK_PATH}`,
    module: moduleCode,
  });
  const separator = portalUrl.includes("?") ? "&" : "?";

  return `${portalUrl}${separator}${query.toString()}`;
}

/**
 * URL del portal de Auth central a la que se envía a un usuario sin sesión.
 * @param origin origen a usar; por defecto, el del navegador actual
 * @returns la URL completa del portal
 */
export function buildCentralAuthPortalUrl(origin?: string): string {
  return buildPortalUrl(
    env.authPortalUrl,
    env.authModuleCode,
    origin ?? currentOrigin(),
  );
}

/**
 * URL de cierre de sesión de Auth central.
 * @returns la URL de logout configurada
 */
export function getCentralAuthLogoutUrl(): string {
  return env.authLogoutUrl;
}

/**
 * Envía el documento completo al portal de Auth central. Es navegación dura, no de router.
 */
export function redirectToCentralAuthPortal(): void {
  replaceLocation(buildCentralAuthPortalUrl());
}
