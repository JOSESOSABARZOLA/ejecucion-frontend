/**
 * Microservicio: ejecucion
 * Módulo: utils
 * Feature: descargas binarias
 * Archivo: blobError.util.ts
 * Responsabilidad: Rescatar el mensaje real de un error cuya respuesta vino como Blob.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-25
 * Modificado por: Andrés Miño — 2026-10-21 (devuelve el ERROR, no un texto: el servicio lo relanza
 *   conservando `status`, `code` y `correlationId`, y la pantalla lo pinta con
 *   `mensajeParaUsuario`. Antes se relanzaba un `new Error(texto)` que perdía la traza.)
 */

import type { HttpClientError } from "../api/httpClient";
import {
  MENSAJES_ERROR_HTTP,
  esHttpClientError,
} from "../api/mensajeParaUsuario";

/**
 * Devuelve el error listo para relanzar: si la respuesta vino como Blob y trae el sobre del
 * servidor, con el mensaje de ese sobre; si no, el mismo error tal cual (su mensaje ya es seguro).
 *
 * 🔴 POR QUÉ EXISTE: con `responseType: "blob"` el cuerpo del ERROR también llega como Blob, así que
 * el normalizador del `httpClient` no encuentra el mensaje del servidor y cae en un genérico. En una
 * descarga que el backend puede rechazar por una regla de negocio —el expediente sin acta
 * definitiva, por ejemplo— ese genérico convertiría una negativa explicada en un error mudo.
 *
 * Vive aquí y no dentro de un servicio porque lo necesitan varios: la vista previa de providencias,
 * el borrador del acta y la descarga del expediente.
 *
 * @param err error capturado del `httpClient`.
 * @param generico mensaje de reserva cuando el error no es del `httpClient` (no debería pasar).
 */
export async function errorDeBlob(
  err: unknown,
  generico = MENSAJES_ERROR_HTTP.otro,
): Promise<Error> {
  if (!esHttpClientError(err)) return err instanceof Error ? err : new Error(generico);

  const cuerpo = (err.originalError as { response?: { data?: unknown } })
    ?.response?.data;
  if (!(cuerpo instanceof Blob)) return err;

  let mensaje: string | undefined;
  try {
    const json: unknown = JSON.parse(await cuerpo.text());
    const sobre = json as { error?: { message?: unknown; code?: unknown }; message?: unknown };
    const candidato = sobre?.error?.message ?? sobre?.message;
    if (typeof candidato === "string" && candidato.trim()) mensaje = candidato;
    if (typeof sobre?.error?.code === "string") err.code = sobre.error.code;
  } catch {
    // El Blob no era JSON (un PDF a medias, un HTML de proxy): se queda el genérico.
  }
  if (!mensaje) return err;

  const conMensaje = new Error(mensaje) as HttpClientError;
  Object.assign(conMensaje, err, { message: mensaje, causa: undefined });
  conMensaje.name = err.name;
  return conMensaje;
}
