/**
 * Microservicio: Resolución Frontend
 * Módulo: N/A
 * Feature: Servicio de sorteo / asignación
 * Archivo: AssignmentService.ts
 * Responsabilidad: Aprobar o denegar resultados de sorteo
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-08
 */

import httpClient from "../api/httpClient";
import type { AssignmentResultsByUser } from "../interfaces/IAssignmentResult";
import type { AssignmentMasterResponse } from "../interfaces/ICase";

export const AssignmentService = {

  async approveAssignment(
    assignmentMasterId: number,
  ): Promise<AssignmentMasterResponse> {
    const { data } = await httpClient.patch<AssignmentMasterResponse>(
      `/case-administration/approve-assign-cases/${assignmentMasterId}`,
    );
    return data;
  },


  async denyAssignment(
    assignmentMasterId: number,
  ): Promise<AssignmentMasterResponse> {
    const { data } = await httpClient.patch<AssignmentMasterResponse>(
      `/case-administration/deny-assign-cases/${assignmentMasterId}`,
    );
    return data;
  },

  // Función para obtener los resultados del sorteo
  async getAssignmentResults(
    assignmentMasterId: number,
    docStatus: string,
  ): Promise<AssignmentResultsByUser> {
    const { data } = await httpClient.get<AssignmentResultsByUser>(
      `/case-administration/assign-cases-results/${assignmentMasterId}?docStatus=${docStatus}`,
    );
    return data;
  },
};
