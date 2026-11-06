/**
 * Microservicio: ejecucion
 * Módulo: Compartido / HTTP
 * Feature: Errores sin texto técnico en pantalla
 * Archivo: mensajeParaUsuario.ts
 * Responsabilidad: Decidir QUÉ texto de un error se le enseña al usuario. Regla del sitio: en el
 *   panel solo van mensajes claros, genéricos y accionables en castellano; el detalle técnico va a
 *   la consola. El mensaje de un `HttpClientError` es seguro por construcción —o es el del sobre del
 *   servidor, que ya viene pensado para el usuario, o es el genérico que puso el normalizador—; el
 *   de un error JS cualquiera (TypeError, etc.) NO lo es y nunca se pinta.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 */

import type { CausaErrorHttp, HttpClientError } from "./httpClient";

/**
 * Mensajes en castellano para cuando el servidor no dio el suyo (los pone el normalizador del
 * `httpClient` según la `causa`). Se pintan tal cual. Viven aquí —y no en `httpClient`— para que los
 * tests que mockean el cliente HTTP entero puedan seguir usándolos.
 */
export const MENSAJES_ERROR_HTTP: Record<CausaErrorHttp, string> = {
  red: "No se pudo conectar con el servidor. Revise su conexión e inténtelo de nuevo.",
  tiempo:
    "El servidor tardó demasiado en responder. Actualice la página para comprobar si la operación se completó antes de repetirla.",
  servidor:
    "Ocurrió un error inesperado en el servidor. Inténtelo de nuevo; si el problema persiste, avise al administrador.",
  otro: "No se pudo completar la operación.",
};

/**
 * Error con un texto escrito PARA el usuario por el propio cliente (una regla de negocio que el
 * frontend comprueba antes de llamar). Su mensaje se pinta tal cual, como el del servidor.
 */
export class ErrorParaUsuario extends Error {
  readonly esParaUsuario = true as const;

  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorParaUsuario";
  }
}

/** ¿Es un error ya normalizado por el `httpClient`? */
export function esHttpClientError(error: unknown): error is HttpClientError {
  return (
    error instanceof Error &&
    (error as Partial<HttpClientError>).isHttpClientError === true
  );
}

/** Longitud de la referencia que se enseña: basta para buscar la traza en los logs. */
const LARGO_REFERENCIA = 8;

/**
 * ¿Hay que darle al usuario una referencia para que avise? Solo cuando el fallo NO es suyo ni del
 * negocio: el servidor reventó (5xx), no hubo conexión o se agotó el tiempo.
 */
function llevaReferencia(error: HttpClientError): boolean {
  return (
    (error.status !== undefined && error.status >= 500) ||
    error.causa === "red" ||
    error.causa === "tiempo"
  );
}

/**
 * El texto que se le enseña al usuario por un error.
 *
 * · `HttpClientError`: su mensaje (seguro: el del servidor o el genérico del normalizador). Si el
 *   fallo es del servidor o de la red, se le añade «(ref. xxxxxxxx)» con el `correlationId` para
 *   que el usuario pueda reportarlo y se busque en los logs.
 * · `ErrorParaUsuario`: su mensaje, tal cual.
 * · Cualquier otro error (TypeError, un `throw` del código…): `porDefecto`, y el original va a la
 *   consola. Su texto es técnico y nunca se pinta.
 *
 * @param error lo capturado en el `catch`.
 * @param porDefecto la frase genérica de la pantalla («No se pudo guardar.»).
 * @returns el texto que se puede pintar.
 */
export function mensajeParaUsuario(error: unknown, porDefecto: string): string {
  if (error instanceof ErrorParaUsuario) {
    return error.message || porDefecto;
  }

  if (esHttpClientError(error)) {
    if (error.causa) {
      console.error("[http] fallo sin mensaje del servidor:", {
        causa: error.causa,
        status: error.status,
        code: error.code,
        correlationId: error.correlationId,
        detalle: error.detalle,
      });
    }
    const base = error.message?.trim() || porDefecto;
    if (llevaReferencia(error) && error.correlationId) {
      return `${base} (ref. ${error.correlationId.slice(0, LARGO_REFERENCIA)})`;
    }
    return base;
  }

  console.error("[error] fallo no controlado:", error);
  return porDefecto;
}
