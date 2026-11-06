/**
 * Microservicio: ejecucion
 * Módulo: documentacion
 * Feature: Catálogo de Direcciones metropolitanas para la pestaña «Documentación»
 * Archivo: caseDirections.ts
 * Responsabilidad: Enumerar, EN EL ORDEN DEL PROCEDIMIENTO, las cinco Direcciones por las que pasa
 *   un expediente. Es lo que ordena el acordeón del modal del expediente. Portado de Resolución
 *   (`features/documentation/config/caseDirectionsConfig.ts`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: quinta entrada, Secretaría General)
 */
import type { ICaseDirectionConfig } from "../interfaces/ICaseDirection";

export const CASE_DIRECTIONS: ICaseDirectionConfig[] = [
  {
    code: "inspeccion",
    label: "Dirección Metropolitana de Inspección",
    order: 1,
  },
  {
    code: "instruccion",
    label: "Dirección Metropolitana de Instrucción",
    order: 2,
  },
  {
    code: "resolucion",
    label: "Dirección Metropolitana de Resolución",
    order: 3,
  },
  {
    code: "ejecucion",
    label: "Dirección Metropolitana de Ejecución",
    order: 4,
  },
  {
    code: "sg",
    label: "Secretaría General",
    order: 5,
  },
];
