/**
 * Microservicio: ejecucion
 * Módulo: documentacion
 * Feature: Direcciones metropolitanas del expediente (pestaña «Documentación» del modal)
 * Archivo: ICaseDirection.ts
 * Responsabilidad: Tipos para agrupar la documentación de un expediente por la Dirección que la
 *   produjo. Portado de Resolución (`features/documentation/types/ICaseDirection.ts`) para que la
 *   pestaña de documentación de Ejecución se vea y se comporte igual.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: quinta Dirección `sg` —Secretaría
 *   General— y `aviso` por Dirección, para lo simulado o deshabilitado)
 */
import type { IDocument } from "./IDocument";

/**
 * Las Direcciones por las que pasa un EPAS, en el orden del procedimiento. El expediente las
 * recorre enteras: inspección levanta el caso, instrucción lo sustancia, resolución lo decide,
 * ejecución lo cumple y Secretaría General lo archiva.
 */
export type CaseDirectionCode =
  | "inspeccion"
  | "instruccion"
  | "resolucion"
  | "ejecucion"
  | "sg";

export interface ICaseDirectionConfig {
  code: CaseDirectionCode;
  label: string;
  order: number;
}

/**
 * Estado de carga de UNA dirección. `loaded` distingue «ya se pidió y no hay documentos» de
 * «todavía no se ha pedido»: sin él, un acordeón abierto y vacío volvería a consultar en cada
 * repintado.
 */
export interface ICaseDirectionDocumentsState {
  documents: IDocument[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /**
   * Aviso NEUTRO (no es un error) sobre la lista: documentos SIMULADOS o la consulta deshabilitada.
   * `null`/ausente ⇒ nada que avisar.
   */
  aviso?: string | null;
}
