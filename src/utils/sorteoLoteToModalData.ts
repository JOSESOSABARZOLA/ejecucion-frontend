/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Adapter SorteoLote[]+EnvioLoteDto → ModalAssignmentResultData (D-08, Fase 3.8)
 * Archivo: sorteoLoteToModalData.ts
 * Responsabilidad: ALIMENTAR el ModalAssignmentResult EXISTENTE (reuse, NO rebuild) combinando DOS
 *   identidades (RESEARCH §"Backend linkage design § 3"):
 *     · el HEADER sale de la ENTRADA — `document.docName` = nº de memo (`envlNumeroLote`, cierra el gap
 *       de fidelidad del header Q1), `tdocTypeName` derivado de `envlTipo`, `docUploadedAt` = `envlIncomeAt`;
 *     · "Usuarios asignados" sale del SORTEO — `assignment` agrupa los casos de `SorteoService.lotes()`
 *       (ya filtrados por `lote.envlAmasId`) por `decisorUserId`.
 *   El único join válido es `envl_amas_id` (Plan 01): el llamador filtra los `SorteoLote[]` por ese
 *   amas_id ANTES de llamar aquí — este adapter NO fabrica ningún match por numero_lote/counts.
 *   El NOMBRE de cada decisor viaja aparte, en `userNames` (userId → nombre), tomado del caso
 *   (`caso.decisorName`, que el backend resuelve con un LEFT JOIN a `t_usuario`) o, en su defecto, del
 *   sublote. DEGRADACIÓN HONESTA (R-03-01-F): un decisor cuyo nombre no resolvió (decisorName
 *   undefined) NO desaparece — su grupo se conserva con su id y no entra en `userNames`. `masterStatusName` es la etiqueta ESTÁTICA "En espera"
 *   (D-08/Q2): en la entrada no hay un campo de aceptación por-caso que reflejar.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-17: `subName` lee la materia
 *   DEDUCIDA del EPAS (`caso.materia`), no la submateria del catálogo local retirado); 2026-10-16 (fix
 *   sorteo: `userNames` lleva el nombre del decisor al modal, que antes solo enseñaba «Usuario ( id )»)
 */

import type {
  AssignmentResult,
  AssignmentResultsByUser,
  ModalAssignmentResultData,
} from "../interfaces/IAssignmentResult";
import type { IInboxCases } from "../interfaces/IInboxCases";
import type { Case } from "../interfaces/ICase";
import type { EnvioLoteDto } from "../services/EntradaLotesService";
import type { SorteoLote, SorteoLoteCaso } from "../services/SorteoService";

/**
 * Etiqueta ESTÁTICA del estado de cada caso en el modal (D-08/Q2). La ENTRADA no tiene un estado de
 * aceptación por-caso que reflejar aquí, así que se muestra "En espera" y no se inventa un veredicto.
 */
const MASTER_STATUS_EN_ESPERA = "En espera" as const;

/**
 * Deriva el `tdocTypeName` del header a partir de `envl_tipo`. Los 3 tipos del CHECK cerrado (Plan 01)
 * tienen un nombre humano; un tipo desconocido DEGRADA al valor crudo (no se oculta ni se inventa).
 */
const TIPO_TO_TDOC_TYPE_NAME: Record<string, string> = {
  ENVIO: "Memorando de Envío",
  DEVOLUCION: "Memorando de Devolución",
  FINALIZADO: "Memorando de Finalización",
};

/** Coacciona un ISO string opcional a Date para los campos `Date` del contrato del modal. */
const toDate = (value?: string): Date =>
  value ? new Date(value) : new Date(0);

/**
 * Mapea UN caso del sorteo → `AssignmentResult` que consume `CollapseAssignedUsers`. Solo `subName`,
 * `masterStatusName`, `assignmentStatusName`, `userId`, `assignmentMasterId`, `assignedAt` y
 * `approvedAt` se pintan; el resto son defaults inertes que satisfacen el contrato sin afirmar nada.
 */
const casoToAssignmentResult = (
  caso: SorteoLoteCaso,
  decisorUserId: number,
  amasId: number,
  sorteoAt: string | undefined,
  seq: number,
): AssignmentResult => ({
  id: seq,
  assignmentMasterId: amasId,
  masterStatusId: 0,
  masterStatusName: MASTER_STATUS_EN_ESPERA,
  parentId: 0,
  assignmentStatusId: 0,
  assignmentStatusName: "",
  subId: caso.subId ?? 0,
  // subName = la materia DEDUCIDA de las infracciones del EPAS (Fase 03.23, D-17). Un EPAS sin
  // infracciones no tiene materia: se dice, no se oculta ni se pinta el id crudo del reparto.
  subName: caso.materia ?? "materia no disponible",
  caseId: caso.eejeId,
  userId: decisorUserId,
  assignedAt: toDate(sorteoAt),
  unassignedAt: null,
  assignedBy: 0,
  reason: null,
  casePoints: 0,
  requestedBy: null,
  requestedAt: null,
  approvedBy: 0,
  approvedAt: toDate(sorteoAt),
  rejectedBy: null,
  rejectedAt: null,
});

/**
 * Adapter (D-08): combina la identidad de ENTRADA (header) con la asignación del SORTEO (usuarios) en
 * el shape `{ document, assignment }` del ModalAssignmentResult EXISTENTE.
 *
 * @param lote        el lote de ENTRADA — de aquí sale el HEADER (nº de memo, tipo, fecha).
 * @param sorteoLotes los `SorteoLote` del master, YA FILTRADOS por `lote.envlAmasId` por el llamador
 *                    (un `SorteoLote` por decisor). NO se filtra ni se re-matchea aquí.
 */
export function sorteoLoteToModalData(
  lote: EnvioLoteDto,
  sorteoLotes: SorteoLote[],
): ModalAssignmentResultData {
  const tipo = String(lote.envlTipo);

  // "Usuarios asignados": agrupa los casos por decisorUserId (el id del sublote, con fallback al del
  // caso). El grupo se conserva por ID — así un decisor SIN nombre no desaparece (R-03-01-F).
  const assignment: AssignmentResultsByUser = {};
  // Nombre de cada decisor que SÍ resolvió. Quien no resolvió no entra: el modal pinta su id.
  const userNames: Record<number, string> = {};
  const casesRelated: Case[] = [];
  let seq = 0;

  for (const sublote of sorteoLotes) {
    const casos = sublote.casos ?? [];
    for (const caso of casos) {
      const decisorUserId = caso.decisorUserId ?? sublote.decisorUserId ?? 0;
      if (!assignment[decisorUserId]) {
        assignment[decisorUserId] = [];
      }
      // El nombre llega en el CASO (LEFT JOIN del backend); el del sublote es solo el respaldo.
      const decisorName = (caso.decisorName ?? sublote.decisorName)?.trim();
      if (decisorName && !userNames[decisorUserId]) {
        userNames[decisorUserId] = decisorName;
      }
      assignment[decisorUserId].push(
        casoToAssignmentResult(
          caso,
          decisorUserId,
          sublote.amasId,
          sublote.sorteoAt,
          ++seq,
        ),
      );
      // casesRelated solo se usa por su LENGTH en el modal → total de casos del lote (suma de pares).
      casesRelated.push({ expNumber: caso.expNumber ?? "" } as Case);
    }
  }

  const document: IInboxCases = {
    // Header D-08: la identidad de ENTRADA (nº de memo), NO el amas_id del sorteo.
    docName: lote.envlNumeroLote,
    tdocTypeName: TIPO_TO_TDOC_TYPE_NAME[tipo] ?? tipo,
    docUploadedAt: toDate(lote.envlIncomeAt),
    docStatus: "sorteado",
    casesRelated,
    // Defaults inertes del resto del contrato IDocument (el modal no los pinta).
    tsdocId: 0,
    tdocType: tipo,
    tsdocSubtypeName: "",
    tsdocSubtype: "",
    docId: 0,
    docSize: 0,
    docUploadedBy: 0,
    docIsActive: true,
    docUrl: "",
    docIsLocked: false,
    docVersion: 1,
    docIsCurrent: true,
    docMetadata: {},
    docParentId: 0,
  };

  return { document, assignment, userNames };
}

export default sorteoLoteToModalData;
