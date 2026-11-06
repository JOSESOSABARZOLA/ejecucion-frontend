/**
 * Microservicio: resolucion
 * M�dulo: N/A
 * Feature: Servicio para la consulta de expediente
 * Archivo: CaseService.ts
 * Responsabilidad: Realizar consultas de información de expedientes para el modulo
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-06
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 09, D-08: SE RETIRA `getTimeline`.)
 *
 *   🔴 POR QUÉ SE BORRA Y NO SE ARREGLA. Dos motivos, y cualquiera de los dos bastaba:
 *
 *   1. **Apuntaba al módulo roto del backlog 999.1.** La ruta de línea de tiempo del módulo heredado
 *      `case-administration` cuelga del árbol de `t_expediente_resolucion`, que está roto, y la
 *      guarda estática del Plan 02 la llevaba anotada como la única deuda conocida de la fase. La
 *      línea de tiempo del expediente se sirve ahora de `GET /epas/:eejeId/bitacora` y
 *      `GET /sorteo/caso/:caseId/historial`, los dos endpoints vivos, y su único consumidor
 *      —`ModalTimeline`— ya los usa.
 *   2. **Volcaba a la consola del navegador el objeto de eventos COMPLETO.** La traza es nominativa:
 *      lleva el nombre del actor y los diffs de campos del administrado. Ese volcado dejaba todo eso
 *      en el historial de cualquier pestaña que abriera la línea de tiempo, al alcance de cualquiera
 *      con acceso al equipo (T-03.19-36).
 *
 *   Se comprobó con `grep` que no quedaba ningún otro consumidor antes de borrarla. Y este comentario
 *   evita citar literalmente la ruta prohibida: la guarda del Plan 02 lee LÍNEAS, no sintaxis, así
 *   que nombrarla aquí la haría fallar explicando por qué ya no existe.
 */
import httpClient from "../api/httpClient";
import { ErrorParaUsuario } from "../api/mensajeParaUsuario";
import type {
  AssignmentMasterResponse,
  Case,
  CaseResponse,
  SendCasesToAssignment,
  // SendCasesToAssignmentResponse,
} from "../interfaces/ICase";
import type { CaseFormValues } from "../config/validationSchemas";
import type { CaseExtendedResponse } from "../interfaces/ICaseExtended";
import type { AssignmentResultsByUser } from "../interfaces/IAssignmentResult";

export const CaseService = {
  /**
   * Obtiene todos los expedientes con paginación y filtros
   */
  async getAllCases(
    pageIndex: number,
    pageSize: number,
    filterParams: Record<string, unknown>,
  ): Promise<CaseResponse> {
    // Creamos objeto con los primeros parametros que siempre llegan para paginacion
    const params: URLSearchParams = new URLSearchParams({
      limit: String(pageSize),
      offset: String(pageIndex),
    });

    // Validamos los filtros que puedan llegar
    for (const [key, value] of Object.entries(filterParams)) {
      if (value !== null && value !== undefined && value !== "") {
        params.append(key, String(value));
      }
    }

    const { data } = await httpClient.get<CaseResponse>(
      `/case-administration?${params.toString()}`,
    );
    return data;
  },

  /**
   * Obtiene un expediente específico por ID
   * @param caseId ID del expediente
   * @returns Datos del expediente
   */
  async getCaseById(caseId: number): Promise<Case> {
    const { data } = await httpClient.get<Case>(
      `/case-administration/${caseId}`,
    );
    return data;
  },

  /**
   * Actualiza un expediente existente
   * @param caseId ID del expediente a actualizar
   * @param values Datos actualizados (parciales o completos)
   * @returns Expediente actualizado
   */
  async updateCase(
    caseId: number,
    values: Partial<Case>,
  ): Promise<Case> {
    const { data } = await httpClient.patch(
      `/case-administration/${caseId}`,
      values,
    );

    if (!data || data?.error)
      throw new ErrorParaUsuario(
        data?.message || "No se pudo actualizar el expediente.",
      );

    return data;
  },

  /**
   * Crea un nuevo expediente
   * @param values Datos del nuevo expediente
   * @returns Expediente creado
   */
  async createCase(values: CaseFormValues): Promise<Case> {
    const { data } = await httpClient.post<Case>(
      `/case-administration`,
      values,
    );
    return data;
  },

  /**
   * Elimina un expediente
   * @param caseId ID del expediente a eliminar
   */
  async deleteCase(caseId: number): Promise<void> {
    await httpClient.delete(`/case-administration/${caseId}`);
  },

  /**
   * Obtiene los expedientes ampliados con paginación y filtros
   * @param pageIndex Índice de página (offset)
   * @param pageSize Tamaño de página (limit)
   * @param filterParams Parámetros de filtrado
   * @returns Datos paginados de expedientes ampliados
   */
  async getAllExtendedCases(
    pageIndex: number,
    pageSize: number,
    filterParams: Record<string, unknown>,
  ): Promise<CaseExtendedResponse> {
    const params: URLSearchParams = new URLSearchParams({
      limit: String(pageSize),
      offset: String(pageIndex),
    });

    // Validamos los filtros que puedan llegar
    for (const [key, value] of Object.entries(filterParams)) {
      if (value !== null && value !== undefined && value !== "") {
        params.append(key, String(value));
      }
    }

    const { data } = await httpClient.get<CaseExtendedResponse>(
      `/case-administration/extended?${params.toString()}`,
    );
    return data;
  },

  async sendCasesToAssignment(
    cases: SendCasesToAssignment,
  ): Promise<AssignmentMasterResponse> {
    const { data } = await httpClient.post(
      `/case-administration/assign-cases`,
      cases,
    );
    return data;
  },

  /**
   * Función para asignar los expedientes a los usuarios
   * @param assignmentResults Resultados de la asignación de expedientes
   * @returns void
   */
  async assignCasesToUser(
    assignmentResults: AssignmentResultsByUser,
  ): Promise<void> {
    const assignments = Object.values(assignmentResults).flat();

    if (assignments.length === 0) {
      return;
    }

    await Promise.all(
      assignments.map((assignment) =>
        CaseService.updateCase(assignment.caseId, {
          usuAssigned: assignment.userId,
          eresStatus: "asignado",
        }),
      ),
    );
  },
};
