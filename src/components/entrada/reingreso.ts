/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend)
 * Feature: El reingreso con observaciones en la fila de la Bandeja de Entrada (Fase 03.24, Plan 24, G-01)
 * Archivo: reingreso.ts
 * Responsabilidad: Decidir, con los campos que manda el servidor, qué ÚNICO estado pinta la fila de la
 *   Bandeja de Entrada (UI-SPEC §1.2) y guardar los textos de §6.1 para la fila y para el aviso de la
 *   remisión al secretario (§1.6). Módulo puro, sin React.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 *
 * ── EL NAVEGADOR NO DEDUCE NADA ───────────────────────────────────────────────────────────────
 * «Por devolver» y «por verificar» los decide el servidor (`porDevolver` y `reingreso`, Plan 21). Este
 * módulo no lee la lista de observaciones ni recuenta: pinta las cifras tal como llegan (doctrina
 * 03.19/03.22, UI-SPEC §0.1).
 */
import type {
  EnvioLoteCaso,
  ReingresoResumen,
} from "../../services/EntradaLotesService";

/** El chip ámbar de la fila. Va LITERAL: no se abrevia y el `·` es parte del texto (L-3). */
export const CHIP_REINGRESO_POR_VERIFICAR =
  "Reingresado · observaciones por verificar";

/** La etiqueta baja que acompaña al chip de estado de un expediente reingresado. */
export const ETIQUETA_REINGRESADO = "Reingresado";

/** Lo que pinta la fila en el sitio del estado. */
export type MarcaDeLaFila =
  "POR_DEVOLVER" | "REINGRESO_POR_VERIFICAR" | "ESTADO";

/**
 * EL ESTADO DE LA FILA, Y ES UNO SOLO (regla del 2026-09-21, UI-SPEC §1.2). Cuando hay una marca, la
 * marca sustituye al chip de estado y el estado legal se lee en el `title`. Gana la primera condición
 * que se cumpla, y CADA CONDICIÓN LA DECIDE EL SERVIDOR:
 *   1. `porDevolver` ⇒ «Por devolver» (rojo): el expediente va a salir hacia la DMR pase lo que pase
 *      con lo que queda por verificar.
 *   2. `reingreso.porVerificar > 0` ⇒ el chip `CHIP_REINGRESO_POR_VERIFICAR` (ámbar).
 *   3. Si no, el chip de estado de siempre (más la etiqueta baja «Reingresado» si `reingreso != null`).
 */
export const marcaDeLaFila = (
  caso: Pick<EnvioLoteCaso, "porDevolver" | "reingreso">,
): MarcaDeLaFila => {
  if (caso.porDevolver === true) return "POR_DEVOLVER";
  if ((caso.reingreso?.porVerificar ?? 0) > 0) return "REINGRESO_POR_VERIFICAR";
  return "ESTADO";
};

const VOLVIO_A_ENVIAR =
  "Resolución volvió a enviar este expediente tras su devolución a la DMR.";

/** El `title` del chip ámbar: el estado legal y las cifras del servidor. */
export const tituloChipReingreso = (
  estadoLegible: string,
  r: Pick<ReingresoResumen, "porVerificar" | "total">,
): string =>
  `Estado: ${estadoLegible}. ${VOLVIO_A_ENVIAR} Faltan por verificar ${r.porVerificar} de ${r.total} observaciones de la devolución anterior.`;

/** El `title` de la etiqueta baja «Reingresado». */
export const tituloReingresadoBaja = (
  r: Pick<ReingresoResumen, "total">,
): string =>
  r.total > 0
    ? `${VOLVIO_A_ENVIAR} Observaciones de la devolución anterior: todas cumplidas.`
    : VOLVIO_A_ENVIAR;

/** El `title` de «Por devolver» cuando lo encienden observaciones anteriores no cumplidas. */
export const tituloPorDevolverNoCumplidas = (
  estadoLegible: string,
  noCumplidas: number,
): string =>
  `Estado: ${estadoLegible}. ${noCumplidas} observación(es) de la devolución anterior no se cumplieron, así que se devuelve a la DMR.`;

/**
 * La frase que se añade al aviso de la remisión cuando el servidor retuvo reingresados con
 * observaciones por verificar (UI-SPEC §1.6). Sin la cifra, o con 0, no se añade nada: la cifra NO se
 * calcula en el navegador.
 */
export const fraseRetenidosPorVerificar = (n: number | undefined): string =>
  n !== undefined && n > 0
    ? ` ${n} expediente(s) reingresado(s) con observaciones por verificar NO se remitieron: verifíquelas en su ficha.`
    : "";
