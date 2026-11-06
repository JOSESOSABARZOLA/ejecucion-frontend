/**
 * Microservicio: ejecucion
 * Módulo: inbox (frontend)
 * Feature: Contrato del modal de resultado de sorteo
 * Archivo: IAssignmentResult.ts
 * Responsabilidad: Tipar los datos que pinta el ModalAssignmentResult: la cabecera del documento, los
 *   casos agrupados por usuario asignado y, si se conocen, los nombres de esos usuarios.
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-12
 * Modificado por: Andrés Miño — 2026-10-16 (fix sorteo: `userNames` para que «Usuarios asignados»
 *   enseñe el nombre del decisor y no «Usuario ( id )»)
 */

import type { IInboxCases } from "./IInboxCases";

export interface ModalAssignmentResultData {
  document: IInboxCases;
  assignment: AssignmentResultsByUser;
  /**
   * Nombre completo de cada usuario asignado, indexado por su `userId` (la misma clave que
   * `assignment`). Es opcional: quien no lo conozca no lo manda, y un usuario sin entrada se pinta con
   * su id («Usuario ( id )») en lugar de desaparecer o de llevar un nombre inventado.
   */
  userNames?: Record<number, string>;
}

export interface AssignmentResult {
  id: number;
  assignmentMasterId: number;
  masterStatusId: number;
  masterStatusName: string;
  parentId: number;
  assignmentStatusId: number;
  assignmentStatusName: string;
  subId: number;
  subName: string;
  caseId: number;
  userId: number;
  assignedAt: Date;
  unassignedAt: null;
  assignedBy: number;
  reason: null;
  casePoints: number;
  requestedBy: null;
  requestedAt: null;
  approvedBy: number;
  approvedAt: Date;
  rejectedBy: null;
  rejectedAt: null;
}

export interface AssignmentResultsByUser {
  [userId: number]: AssignmentResult[];
}



