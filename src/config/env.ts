/**
 * Microservicio: ejecucion
 * Módulo: Compartido — Fase 03.11 / Plan 03
 * Feature: Configuración pública del frontend, runtime-first
 * Archivo: env.ts
 * Responsabilidad: Resolver la configuración pública del frontend campo a campo con el orden
 *   configuración runtime inyectada en `window.__APP_CONFIG__` > variables `VITE_*` de build > default
 *   por modo. El orden runtime-first permite que UN MISMO bundle sirva a varios ambientes sin
 *   recompilar. Aquí NO puede vivir ningún secreto: todo lo que entre en este archivo queda legible en
 *   el bundle público (T-0311-14).
 * Desarrollador: Johan Freire / Andrés Miño (Fase 03.11)
 * Fecha: 2026-08-05
 */

/** Configuración inyectada en tiempo de ejecución por el servidor que sirve el bundle. */
export interface AppRuntimeConfig {
  API_URL?: string;
  AUTH_PORTAL_URL?: string;
  AUTH_LOGOUT_URL?: string;
  AUTH_MODULE_CODE?: string;
}

/** Subconjunto tipado de `import.meta.env` que este módulo consume. */
export interface ViteEnvVars {
  VITE_API_URL?: string;
  /** Alias histórico de `VITE_API_URL`; se acepta por compatibilidad con `.env.template`. */
  VITE_API_BASE_URL?: string;
  VITE_AUTH_PORTAL_URL?: string;
  VITE_AUTH_LOGOUT_URL?: string;
  VITE_AUTH_MODULE_CODE?: string;
}

/** Configuración pública resuelta que consume la app. */
export interface AppEnv {
  readonly apiBaseUrl: string;
  readonly authPortalUrl: string;
  readonly authLogoutUrl: string;
  readonly authModuleCode: string;
}

/** Fuentes de configuración, en el orden en que se consultan. */
export interface EnvSources {
  runtime?: AppRuntimeConfig;
  viteEnv?: ViteEnvVars;
  mode?: string;
}

const DEFAULT_API_BASE_URL_DEV = "http://localhost:3004";
const DEFAULT_API_BASE_URL_PROD = "/api";

// [ASSUMED Q-01/Q-03] confirmar en el checkpoint del Plan 08: el portal sale de un EJEMPLO de la guía
// de integración, no de configuración propia del módulo.
const DEFAULT_AUTH_PORTAL_URL = "http://172.20.136.127:10006/login";
// [ASSUMED Q-01/Q-03] confirmar en el checkpoint del Plan 08.
const DEFAULT_AUTH_LOGOUT_URL = "http://172.20.136.127:10006/login";
// [ASSUMED Q-01/Q-03] confirmar en el checkpoint del Plan 08: el código real de módulo lo debe
// confirmar el equipo de Auth central.
const DEFAULT_AUTH_MODULE_CODE = "EJECUCION";

/**
 * Devuelve el primer candidato que sea una cadena no vacía, ya recortada.
 * @param candidates valores en orden de prioridad
 * @returns el primero utilizable, o undefined si ninguno lo es
 */
function firstDefined(
  ...candidates: (string | undefined)[]
): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }

  return undefined;
}

/**
 * Resuelve la configuración pública a partir de sus fuentes. Función pura: no lee `window` ni
 * `import.meta`, por eso su orden de precedencia es aseverable por unidad.
 * @param sources configuración runtime, variables de build y modo
 * @returns la configuración pública congelada
 */
export function resolveEnv(sources: EnvSources = {}): AppEnv {
  const runtime = sources.runtime ?? {};
  const viteEnv = sources.viteEnv ?? {};
  const mode = sources.mode ?? "development";

  const defaultApiBaseUrl =
    mode === "production" ? DEFAULT_API_BASE_URL_PROD : DEFAULT_API_BASE_URL_DEV;

  return Object.freeze({
    apiBaseUrl:
      firstDefined(
        runtime.API_URL,
        viteEnv.VITE_API_URL,
        viteEnv.VITE_API_BASE_URL,
      ) ?? defaultApiBaseUrl,
    authPortalUrl:
      firstDefined(runtime.AUTH_PORTAL_URL, viteEnv.VITE_AUTH_PORTAL_URL) ??
      DEFAULT_AUTH_PORTAL_URL,
    authLogoutUrl:
      firstDefined(runtime.AUTH_LOGOUT_URL, viteEnv.VITE_AUTH_LOGOUT_URL) ??
      DEFAULT_AUTH_LOGOUT_URL,
    authModuleCode:
      firstDefined(runtime.AUTH_MODULE_CODE, viteEnv.VITE_AUTH_MODULE_CODE) ??
      DEFAULT_AUTH_MODULE_CODE,
  });
}

/**
 * Lee la configuración runtime que el servidor haya inyectado en `window.__APP_CONFIG__`.
 * @returns la configuración runtime, o un objeto vacío si no hay ninguna
 */
function readRuntimeConfig(): AppRuntimeConfig {
  if (typeof window === "undefined") {
    return {};
  }

  const scope = window as Window & { __APP_CONFIG__?: AppRuntimeConfig };

  return scope.__APP_CONFIG__ ?? {};
}

export const env: AppEnv = resolveEnv({
  runtime: readRuntimeConfig(),
  viteEnv: import.meta.env as unknown as ViteEnvVars,
  mode: import.meta.env.MODE || "development",
});
