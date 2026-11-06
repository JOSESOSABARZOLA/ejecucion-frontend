/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME) — frontend
 * Feature: Composición del escrito de excusa (Quick 260916-kwg, D-03)
 * Archivo: escritoExcusaComposicion.ts
 * Responsabilidad: Convertir la plantilla de `t_plantilla_documento` en el HTML que se ve en el
 *   editor y que acaba impreso: tokens resueltos y hecho concreto en su sitio. Sin React y sin red,
 *   para poder fijarlo con tests.
 *
 *   ── POR QUÉ REUTILIZA EL RESOLVEDOR DE LA PROVIDENCIA ────────────────────────────────────────
 *   `resolverTokens` y `tieneContenido` viven en `providenciaComposicion.ts` y se importan tal cual.
 *   Reimplementarlos aquí daría dos mecanismos de tokens con dos filtros y dos sitios donde arreglar
 *   el mismo defecto. Los tres tokens que este escrito necesita —`{Causal}`, `{Decisor}`,
 *   `{Fecha}`— se añadieron al registro compartido y resuelven SOLO desde el contexto, así que la
 *   providencia no se entera.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-16
 */

import type { MiEpasAsignado } from "../services/SorteoService";
import {
  type ContextoTokens,
  resolverTokens,
} from "./providenciaComposicion";

/**
 * Marca de sitio del HECHO CONCRETO dentro de la plantilla.
 *
 * ⚠️ Espeja el literal sembrado en `t_plantilla_documento` (clave `ESCRITO_EXCUSA`) y documentado en
 * la §3 de `ejecucion-backend/docs/BORRADOR-escrito-de-excusa.md`. Si cambia el literal, cambia en
 * los dos o el hecho concreto deja de salir sin decir por qué.
 *
 * 🔴 **NO es un token.** No está en `TOKENS_PROVIDENCIA`, no se ofrece como badge y `resolverTokens`
 * lo deja intacto. Es la marca que dice DÓNDE va el hecho, exactamente igual que `MARCADOR_CUADRO`
 * para la tabla de horas: *«no es un dato que se sustituya por su valor, es la marca de sitio»*.
 *
 * Y, como allí, **su presencia es la SEÑAL**: si la DAJ la borra al reescribir el párrafo, no se
 * injerta nada y eso no es un error.
 */
export const MARCADOR_DETALLE = "{Detalle}";

/**
 * Localiza el párrafo COMPLETO que contiene la marca.
 *
 * El `(?!<\/p>)` impide que la coincidencia salte por encima de un cierre de párrafo: sin él, un
 * `<p>` anterior sin marca y el `</p>` del siguiente formarían una coincidencia gigante y se
 * borraría medio escrito. Se lleva por delante también el salto de línea posterior, para que quitar
 * el párrafo no deje un hueco — la salida tiene que ser determinista porque es el contrato con el
 * backend.
 */
const RE_PARRAFO_DEL_MARCADOR =
  /[ \t]*<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?\{Detalle\}(?:(?!<\/p>)[\s\S])*?<\/p>\n?/;

/**
 * Escapa el texto del decisor para que no rompa el marcado.
 *
 * 🔴 EL ORDEN IMPORTA: el `&` PRIMERO. Al revés, un `<` se convertiría en `&lt;` y el `&` de esa
 * entidad se re-escaparía a `&amp;lt;`, y el PDF imprimiría «&lt;» en crudo donde debía verse «<».
 *
 * No es una defensa contra XSS —este HTML no se renderiza como HTML en ningún sitio: el conversor
 * del backend es una lista blanca que emite objetos pdfmake—. Es una defensa contra un ESCRITO
 * DESMONTADO: un hecho que contenga `<` dejaría párrafos partidos y frases desaparecidas en un acto
 * administrativo.
 */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Compone el escrito que verá el decisor en el editor y que acabará en el PDF.
 *
 * Reglas, en este orden:
 *
 * 1. **Sin marca en la plantilla** → se resuelven los tokens y se acabó. No se borra ni se injerta
 *    nada. La DAJ puede haber reescrito el párrafo y quitado la marca: es una decisión suya sobre su
 *    texto, no un fallo, y por eso **no se avisa en pantalla**.
 * 2. **Con hecho concreto** (tras recortar) → la marca se sustituye por el hecho, escapado.
 * 3. **Sin hecho concreto** → se borra **el párrafo entero** que contiene la marca.
 *
 * 🔴 POR QUÉ LA REGLA 3 SE LLEVA EL PÁRRAFO Y NO SOLO LA MARCA. Porque el rótulo y la marca viven en
 * el MISMO párrafo: quitar solo `{Detalle}` dejaría «SEGUNDO.- Los hechos concretos que sustentan la
 * causal invocada son los siguientes:» colgando sin nada detrás. Es exactamente el defecto que tuvo
 * el cuadro de horas antes del `10b9ba9` —«el cuadro se quedaba huérfano porque su rótulo lo ponía
 * el motor»— y es también la decisión 3 del encargo: *sin detalle, el párrafo SEGUNDO se OMITE; ni un
 * SEGUNDO vacío, ni relleno; nunca fabricar texto*.
 *
 * 🔴 Y POR QUÉ ESTO NO SE ROMPE SI LA DAJ REESCRIBE EL TEXTO. Porque nada de aquí reconoce la
 * palabra «SEGUNDO» ni ninguna otra parte de la redacción: todo cuelga de la marca. La DAJ puede
 * reescribir el párrafo entero, y mientras conserve `{Detalle}` dentro, las tres reglas siguen
 * valiendo. Eso es lo que hace compatible esta composición con D-05, que existe justamente para que
 * la DAJ edite sin desplegar.
 *
 * @param plantillaHtml HTML de `t_plantilla_documento` (clave ESCRITO_EXCUSA).
 * @param caso el caso de la bandeja, del que salen los cuatro tokens del expediente.
 * @param contexto causal, decisor y fecha — los tres que no viven en el caso.
 * @param hecho el hecho concreto que teclea el decisor. Opcional: `ExcusaDto.reason` lo es.
 * @returns el HTML listo para el editor y para el PDF.
 */
export function componerEscritoExcusa(
  plantillaHtml: string,
  caso: MiEpasAsignado,
  contexto: ContextoTokens,
  hecho?: string,
): string {
  if (!plantillaHtml.includes(MARCADOR_DETALLE)) {
    return resolverTokens(plantillaHtml, caso, contexto);
  }

  const hechoLimpio = hecho?.trim();

  const conHecho = hechoLimpio
    ? plantillaHtml.split(MARCADOR_DETALLE).join(escaparHtml(hechoLimpio))
    : // Si la marca no estuviera dentro de un `<p>` —la DAJ podría haberla puesto suelta o dentro de
      // otra etiqueta— no hay párrafo que borrar, y se quita solo la marca. Es la degradación
      // honesta: se pierde la limpieza del párrafo, no el resto del escrito.
      RE_PARRAFO_DEL_MARCADOR.test(plantillaHtml)
      ? plantillaHtml.replace(RE_PARRAFO_DEL_MARCADOR, "")
      : plantillaHtml.split(MARCADOR_DETALLE).join("");

  return resolverTokens(conHecho, caso, contexto);
}
