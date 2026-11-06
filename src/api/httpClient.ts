/**
 * Microservicio: ejecucion
 * Módulo: Compartido / HTTP — Fase 03.11 / Plan 03
 * Feature: Cliente HTTP con sesión por cookie
 * Archivo: httpClient.ts
 * Responsabilidad: Cliente HTTP centralizado de la aplicación. La credencial es SIEMPRE la cookie
 *   HttpOnly de sesión (`withCredentials`), en los dos modos de autenticación: el navegador no tiene
 *   —ni debe tener— el token, así que aquí no se lee almacenamiento del navegador ni se arma ninguna
 *   cabecera de autorización (T-0311-11). Añade los dos identificadores de traza a cada petición,
 *   normaliza los errores con el sobre homologado del ecosistema (Plan 01) y avisa UNA sola vez al
 *   manejador de sesión caída cuando un 401 llega fuera de las rutas de sesión (P-01 / T-0311-13).
 * Desarrollador: Johan Freire / Andrés Miño (Fase 03.11)
 * Fecha: 2026-08-05
 * Modificado por: Andrés Miño — 2026-10-21 (errores sin texto técnico en pantalla: si el servidor
 *   no da su mensaje —red caída, tiempo agotado, 5xx sin sobre, cuerpo Blob o HTML— el error lleva
 *   un mensaje genérico en castellano según su `causa`, y el texto crudo de axios queda en `detalle`
 *   para la consola. Un error que no es de axios ya no conserva su texto.)
 */

import axios, { AxiosHeaders } from "axios";
import { env } from "../config/env";
import { isAuthSessionPath } from "./authPaths";
import { MENSAJES_ERROR_HTTP } from "./mensajeParaUsuario";
import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  createCorrelationId,
  createRequestId,
} from "./correlationId";

/**
 * Por qué falló una petición cuando el servidor NO dio un mensaje propio:
 *   · `red`      — no hubo respuesta (servidor caído, sin conexión, CORS).
 *   · `tiempo`   — se agotó el tiempo de espera del cliente.
 *   · `servidor` — respondió 5xx sin el sobre homologado (por ejemplo, el HTML de un proxy).
 *   · `otro`     — cualquier otra respuesta sin mensaje legible.
 * Si el servidor dio su mensaje, `causa` queda sin definir: el texto del sobre ya viene pensado
 * para el usuario.
 */
export type CausaErrorHttp = "red" | "tiempo" | "servidor" | "otro";

export type HttpClientError = Error & {
  isHttpClientError: true;
  status?: number;
  code?: string;
  correlationId?: string;
  /** Sin mensaje del servidor: por qué falló (ver `CausaErrorHttp`). */
  causa?: CausaErrorHttp;
  /** Texto técnico original (el de axios o el del error JS). Solo para la consola; NUNCA se pinta. */
  detalle?: string;
  originalError: unknown;
};

/** Códigos de axios (y de Node) que significan «se agotó el tiempo». */
const CODIGOS_TIEMPO = new Set(["ECONNABORTED", "ETIMEDOUT"]);

/**
 * Clasifica un error de axios SIN mensaje del servidor.
 * @param code código de axios (`ERR_NETWORK`, `ECONNABORTED`…)
 * @param message texto crudo de axios
 * @param status estado HTTP, si hubo respuesta
 */
function clasificarSinMensaje(
  code: string | undefined,
  message: string | undefined,
  status: number | undefined,
): CausaErrorHttp {
  if (
    (code && CODIGOS_TIEMPO.has(code)) ||
    /timeout/i.test(message ?? "")
  ) {
    return "tiempo";
  }
  if (status === undefined) return "red";
  if (status >= 500) return "servidor";
  return "otro";
}

/** El primer texto no vacío entre los candidatos, o `undefined`. */
function primerTexto(...candidatos: unknown[]): string | undefined {
  for (const candidato of candidatos) {
    if (typeof candidato === "string" && candidato.trim()) return candidato;
  }
  return undefined;
}

/** Cuerpo de error del backend: sobre homologado del ecosistema y las formas heredadas. */
interface ErrorResponseBody {
  error?: { code?: string; message?: string };
  message?: string;
  details?: { message?: string };
}

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler = () => {};

/**
 * Registra el manejador que se invoca cuando el backend responde 401 en una ruta que NO es de sesión.
 * Es el punto por el que el contexto de usuario se entera de que la sesión murió, sin que este módulo
 * dependa de React.
 * @param handler función a invocar ante una sesión caída
 */
export function registerUnauthorizedHandler(handler: UnauthorizedHandler) {
  onUnauthorized = handler;
}

/**
 * Función para obtener el valor de un header específico, normalizando los headers si es necesario.
 * @param headers headers del request
 * @param headerName nombre del header a obtener
 * @returns valor del header o undefined si no existe
 */
function getHeaderValue(headers: unknown, headerName: string) {
  if (!headers) {
    return undefined;
  }

  const normalizedHeaders = AxiosHeaders.from(headers as AxiosHeaders);
  const headerValue = normalizedHeaders.get(headerName);

  return typeof headerValue === "string" ? headerValue : undefined;
}

/**
 * Normaliza los errores del cliente HTTP a una estructura consistente. El mensaje sale del sobre
 * homologado (`data.error.message`) y sólo si no existe se cae a las formas heredadas; el código sale
 * de `data.error.code` (por ejemplo `APP-UNAUTHORIZED-001`), al que la aplicación debe reaccionar en
 * vez de al texto del mensaje. Sin mensaje del servidor, el texto es el genérico de su `causa`
 * (`MENSAJES_ERROR_HTTP`) y el de axios queda en `detalle`, que nunca se pinta.
 * @param error error http client
 * @returns error normalizado
 */
export function normalizeHttpClientError(error: unknown): HttpClientError {
  if (axios.isAxiosError(error)) {
    // Solo un objeto JSON trae sobre: un Blob, un HTML de proxy o una cadena no son mensajes.
    const data: unknown = error.response?.data;
    const body =
      data && typeof data === "object" && !(data instanceof Blob)
        ? (data as ErrorResponseBody)
        : undefined;
    const mensajeDelServidor = primerTexto(
      body?.error?.message,
      body?.message,
      body?.details?.message,
    );
    const status = error.response?.status;
    const causa = mensajeDelServidor
      ? undefined
      : clasificarSinMensaje(error.code, error.message, status);

    const normalizedError = new Error(
      mensajeDelServidor ?? MENSAJES_ERROR_HTTP[causa ?? "otro"],
    ) as HttpClientError;
    normalizedError.causa = causa;
    normalizedError.detalle = error.message;
    const responseCorrelationId = getHeaderValue(
      error.response?.headers,
      CORRELATION_ID_HEADER,
    );
    const requestCorrelationId = getHeaderValue(
      error.config?.headers,
      CORRELATION_ID_HEADER,
    );

    normalizedError.name = "HttpClientError";
    normalizedError.isHttpClientError = true;
    normalizedError.status = status;
    normalizedError.code = body?.error?.code ?? error.code;
    normalizedError.correlationId =
      responseCorrelationId ?? requestCorrelationId;
    normalizedError.originalError = error;

    return normalizedError;
  }

  // Cualquier otra cosa (un error JS del propio cliente, un valor lanzado): su texto es técnico y no
  // se enseña; se conserva en `detalle` para la consola.
  const normalizedError = new Error(MENSAJES_ERROR_HTTP.otro) as HttpClientError;

  normalizedError.name = "HttpClientError";
  normalizedError.isHttpClientError = true;
  normalizedError.causa = "otro";
  normalizedError.detalle =
    error instanceof Error ? error.message : String(error);
  normalizedError.originalError = error;

  return normalizedError;
}

/**
 * Cliente HTTP centralizado. `withCredentials` es lo que hace que la cookie de sesión viaje: sin él
 * NINGUNA llamada autentica.
 */
export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 5000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

httpClient.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers);

  if (!headers.has(CORRELATION_ID_HEADER)) {
    headers.set(CORRELATION_ID_HEADER, createCorrelationId());
  }

  headers.set(REQUEST_ID_HEADER, createRequestId());

  config.headers = headers;

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const normalizedError = normalizeHttpClientError(error);

    if (
      normalizedError.status === 401 &&
      !isAuthSessionPath(
        axios.isAxiosError(error) ? error.config?.url : undefined,
      )
    ) {
      onUnauthorized();
    }

    return Promise.reject(normalizedError);
  },
);

export default httpClient;
