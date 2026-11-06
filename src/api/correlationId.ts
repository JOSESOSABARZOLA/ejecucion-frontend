/**
 * Microservicio: ejecucion
 * Módulo: Compartido / HTTP
 * Feature: Identificadores de traza de las peticiones
 * Archivo: correlationId.ts
 * Responsabilidad: Generar y nombrar los dos identificadores de traza que el backend acepta y expone
 *   (Fase 03.11 / Plan 01): el de correlación, que puede atravesar varias peticiones, y el de
 *   petición, que es nuevo en cada una. Sin paquetes nuevos.
 *
 *   `crypto.randomUUID()` SOLO existe en CONTEXTOS SEGUROS (https o localhost). El servidor sirve el
 *   frontend por HTTP contra una IP, así que allí es `undefined` y su llamada directa reventaba el
 *   acceso con «crypto.randomUUID is not a function» (detectado en el despliegue 1.2.0, 2026-08-07).
 *   Por eso se degrada en dos escalones: `randomUUID` → `getRandomValues` (sí disponible fuera de
 *   contexto seguro) → `Math.random`. Los identificadores son de TRAZA, no de seguridad: su requisito
 *   es no colisionar en los logs, no ser impredecibles.
 * Desarrollador: Johan Freire / Andrés Miño (Fase 03.11)
 * Fecha: 2026-08-05 · Modificado por: Andrés Miño — 2026-08-07 (contexto no seguro)
 */

export const CORRELATION_ID_HEADER = "x-correlation-id";
export const REQUEST_ID_HEADER = "x-request-id";

/** Posiciones de la plantilla uuid v4 que NO son aleatorias. */
const UUID_TEMPLATE = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";

/** Un byte por cada dígito hex de la plantilla: 32, no 16 (un uuid v4 son 32 dígitos, no 16 bytes). */
const UUID_HEX_DIGITS = 32;

/**
 * Rellena los bytes con la mejor fuente disponible. `getRandomValues` está disponible también fuera de
 * contexto seguro; `Math.random` es el último recurso para que la app NUNCA deje de funcionar por no
 * poder etiquetar una petición.
 * @returns un byte por dígito hex de la plantilla
 */
function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(UUID_HEX_DIGITS);
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);

    return bytes;
  }

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

/**
 * Genera un uuid v4 sin depender de `crypto.randomUUID`, que no existe fuera de contexto seguro.
 * @returns un uuid v4 en su forma canónica
 */
export function generateUuid(): string {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  const bytes = randomBytes();
  let index = 0;

  return UUID_TEMPLATE.replace(/[xy]/g, (character) => {
    const value = bytes[index] % 16;
    index += 1;

    // 'y' fija los dos bits altos de la variante (RFC 4122): 8, 9, a o b.
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

/**
 * Identificador de correlación: agrupa varias peticiones de un mismo flujo del usuario.
 * @returns un uuid
 */
export function createCorrelationId(): string {
  return generateUuid();
}

/**
 * Identificador de petición: SIEMPRE nuevo, uno por llamada HTTP.
 * @returns un uuid
 */
export function createRequestId(): string {
  return generateUuid();
}
