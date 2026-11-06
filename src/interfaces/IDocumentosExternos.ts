/**
 * Microservicio: ejecucion
 * Módulo: expediente
 * Feature: Documentos del expediente de los OTROS módulos (Inspección, Instrucción, Resolución y
 *   Secretaría General)
 * Archivo: IDocumentosExternos.ts
 * Responsabilidad: Los tipos de `GET /epas/:eejeId/documentos-externos`, copiados palabra por
 *   palabra de `documentos-expediente.interface.ts` del backend.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-30
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: `nuevo` por documento)
 */

/** Módulo ajeno: los mismos cuatro códigos que usa el backend. */
export type ModuloExternoCodigo = "inspeccion" | "dmit" | "resolucion" | "sg";

/** Quién firmó, con el rol LEGIBLE («Director», «Inspector»…), y cuándo (ISO-8601). */
export interface IFirmanteExterno {
  nombre: string | null;
  rol: string | null;
  fecha: string | null;
}

export interface IAdministradoExterno {
  identificacion: string | null;
  nombre: string | null;
}

/** Un documento EMITIDO de otro módulo. */
export interface IDocumentoExterno {
  /** Identificador opaco en su módulo (texto). */
  docId: string;
  nombre: string;
  tipo: string | null;
  subtipo: string | null;
  fecha: string | null;
  estado: string | null;
  firmado: boolean;
  firmantes: IFirmanteExterno[];
  administrados: IAdministradoExterno[];
  /** Ruta del proxy de Ejecución (`/api/epas/…/archivo`): se abre como un documento propio. */
  archivoUrl: string;
  /**
   * `true` si el usuario de la sesión todavía no lo abrió y llegó después de la línea base (quick
   * 261030-m29). Con el simulador siempre es `false`. Opcional: un backend sin la Task 3b no lo manda.
   */
  nuevo?: boolean;
}

export type EstadoModuloExterno = "ok" | "error" | "deshabilitado";

/** Lo que llega de UN módulo. */
export interface IModuloDocumentosExternos {
  modulo: ModuloExternoCodigo;
  nombre: string;
  estado: EstadoModuloExterno;
  /** `true` si los documentos son del simulador (el módulo aún no publica su servicio). */
  simulado: boolean;
  /** Motivo legible en 'error' o 'deshabilitado'; `null` en 'ok'. */
  mensaje: string | null;
  documentos: IDocumentoExterno[];
}

export interface IDocumentosExternosDelExpediente {
  eejeId: number;
  /** Id de caso de Core; `null` si el expediente no tiene enlace a Core. */
  caseId: number | null;
  modulos: IModuloDocumentosExternos[];
}
