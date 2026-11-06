/**
 * Microservicio: ejecucion
 * Módulo: Infraestructura de tests
 * Feature: Errores sin texto técnico en pantalla
 * Archivo: errores.ts
 * Responsabilidad: Fabricar, en los tests, el error que de verdad le llega a una pantalla cuando el
 *   servidor rechaza una petición: un `HttpClientError` normalizado por el `httpClient`, con el
 *   mensaje del sobre homologado. Un `new Error("texto")` ya NO sirve para simular un rechazo del
 *   servidor: `mensajeParaUsuario` no pinta el texto de un error JS cualquiera.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 */

import type { HttpClientError } from "../api/httpClient";
import { MENSAJES_ERROR_HTTP } from "../api/mensajeParaUsuario";

/**
 * Un fallo de red (sin respuesta del servidor), tal y como sale del interceptor del `httpClient`:
 * mensaje genérico en castellano y el texto crudo de axios solo en `detalle`.
 */
export function errorDeRed(): HttpClientError {
  const error = new Error(MENSAJES_ERROR_HTTP.red) as HttpClientError;
  error.name = "HttpClientError";
  error.isHttpClientError = true;
  error.code = "ERR_NETWORK";
  error.causa = "red";
  error.correlationId = "corr-test-0001";
  error.detalle = "Network Error";
  error.originalError = undefined;
  return error;
}

/**
 * Un rechazo del servidor con su mensaje, tal y como sale del interceptor del `httpClient`.
 * @param mensaje el texto del sobre (`error.message`).
 * @param status estado HTTP (por omisión 400, una regla de negocio).
 * @param code código del sobre, si el test lo necesita.
 */
export function errorDelServidor(
  mensaje: string,
  status = 400,
  code?: string,
): HttpClientError {
  // Se arma a mano —con la misma forma que deja `normalizeHttpClientError`— para que sirva también
  // en los tests que mockean el módulo `httpClient` entero.
  const error = new Error(mensaje) as HttpClientError;
  error.name = "HttpClientError";
  error.isHttpClientError = true;
  error.status = status;
  error.code = code ?? "ERR_BAD_REQUEST";
  error.correlationId = "corr-test-0001";
  error.detalle = `Request failed with status code ${status}`;
  error.originalError = undefined;
  return error;
}
