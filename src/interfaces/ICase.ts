// import type { Document } from './Document';

/**
 * De cuál de las TRES trazas del expediente viene un hecho.
 *
 * 🔴 ES UN DISCRIMINANTE, NO UNA DECORACIÓN. La línea de tiempo funde la bitácora interna del
 * módulo (art. 82 CRE) con el historial del caso en Asignaciones, que es otro sistema y de otro
 * dueño. Sin esta marca, un hecho escrito por Asignaciones se leería como si lo hubiera escrito
 * este módulo — y en una traza nominativa eso no es un matiz de presentación.
 *
 * 🔴 `"ordenes"` (Fase 03.22, D-07) es el historial de órdenes de pago del PROPIO módulo
 * (`GET /ordenes-pago/:eejeId/historial`) y aun así NO se funde con `"interna"`: es otra fuente,
 * con otro endpoint y otro modo de fallo, y trae las órdenes ANULADAS —lo único que explica por qué
 * un expediente tuvo dos números—. Que sea del mismo dueño no la hace el mismo hecho.
 */
export type OrigenTraza = "interna" | "asignaciones" | "ordenes";

/**
 * Un cambio LEGIBLE de una entrada de bitácora. Espeja `CambioBitacora` del backend.
 *
 * 🔴 NO es el diff crudo. `log_valor_antiguo` / `log_valor_nuevo` son jsonb ARBITRARIOS de columnas
 * internas —motivos de excusa, observaciones, identificadores de documento, números de transacción
 * bancaria del administrado— y **no salen del servidor**: el repositorio los proyecta contra una
 * lista blanca antes de responder. Lo que llega aquí ya pasó esa aduana.
 */
export interface CambioTraza {
  /** Etiqueta humana del campo («Estado del EPAS»), no el nombre de la columna. */
  campo: string;
  /** Valor anterior, ya normalizado a texto. */
  antes: string;
  /** Valor nuevo, ya normalizado a texto. */
  despues: string;
}

/**
 * Una entrada de la bitácora INTERNA del EPAS, tal como la devuelve `GET /epas/:eejeId/bitacora`.
 * Es la mitad normativa de la línea de tiempo (D-07); la otra la sirve
 * `GET /sorteo/caso/:caseId/historial` y las funde `utils/lineaDeTiempo.util.ts`.
 *
 * ⚠️ TOLERA LO DEGRADADO A PROPÓSITO, porque el endpoint lo hace:
 *  · `logUserId`/`usuFullName` son OPCIONALES — `log_user_id` admite NULL (actos internos y lo que
 *    escriba el disparador de base) y el JOIN al usuario es `LEFT`, nunca `INNER`: un acto sin
 *    actor humano no puede desaparecer de la traza. La pantalla lo pinta «Sistema».
 *  · `cambios` puede faltar o venir vacío: hay hechos REALES sin ningún campo cambiado —la
 *    constatación del incumplimiento, la orden de sustitutoria—, y valen por su código.
 *  · `logCreatedAt` viaja como cadena ISO. El backend lo declara `Date`, pero entre los dos hay un
 *    `JSON.stringify`: tiparlo `Date` aquí prometía un objeto que nunca llega.
 */
export interface TimelineEvent {
  logId: number;
  logCreatedAt: string;
  logUserId?: number;
  usuFullName?: string;
  logTableName: string;
  logRecordId: number;
  /** La FRASE del hecho, para leer. Es texto libre y se puede reescribir: no sirve para agrupar. */
  logEvent: string;
  /** El CÓDIGO estable del hecho (`CodigoAuditoria`), por el que se agrupa y se elige el icono. */
  logEventCodigo?: string;
  cambios?: CambioTraza[];
}

export interface CaseResponse {
  data: Case[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
}

export interface Case {
  expId: number;
  expNumber: string;
  expCreatedAt: Date;
  expFojas: number;
  expZone: string;
  expMedidaCautelar: string;
  eresId: number;
  admiId: number;
  eresIncomeAt: Date;
  eresHasAppeal: boolean;
  eresResolveAt: Date;
  eresIsactive: boolean;
  eresFojas: number;
  eresStatus: string;
  eresResolveUntil: Date | null;
  usuAssigned: number | null;
  admiName: string;
  admiLastname: string;
  admiBusinessName: null;
  admiIdentification: string;
  admiTelephone: string;
  admiAddress: string;
  admiJudicialLocker: string;
  admiEmail: string;
  eresResolve: string;
  eresPenalty: string;
  eresArticle: number;
  eresMedidaCautelar: string | null;
  eresIsLocked: boolean;
  expCoreId: null;
  totalCount: string;
}

export interface CasesToAssignment {
  caseId: number;
  /**
   * Opcional, como en `AssignCaseItemDto` del backend. Fase 03.23 (D-14): el frontend ya no lo
   * manda — el expediente no tiene id de materia del que sacarlo.
   */
  subId?: number;
}

export interface SendCasesToAssignment {
  cases: CasesToAssignment[];
}

export interface SendCasesToAssignmentResponse {
  moduleId: number;
  assignedCasesCount: number;
  message: string;
}

export interface AssignmentMasterResponse {
  id: number;
  modId: number;
  sdetId: number;
  sdetName: string;
  type: string;
  parentId: number | null;
  workDate: Date;
  reason: string | null;
  createdBy: number;
  createdAt: Date;
  approvedBy: number | null;
  approvedAt: Date | null;
  rejectedBy: number | null;
  rejectedAt: Date | null;
}

// export interface SendCasesToAssignmentError {
//   statusCode: number;
//   error:      string;
//   message:    string;
//   timestamp:  Date;
//   path:       string;
// }


// export type ResultAssignment<T, E> = { success: true; data: T } | { success: false; error: E };