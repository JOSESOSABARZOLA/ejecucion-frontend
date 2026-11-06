/**
 * Microservicio: resolucion
 * Módulo: inbox
 * Feature: Ejecución de acciones de sorteo
 * Archivo: assignmentAction.util.ts
 * Responsabilidad: Pipeline genérico approve/deny sin ramas por nombre de acción
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-08
 */

import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import {
  getAssignmentActionConfig,
  type AssignmentActionContext,
  type AssignmentActionName,
} from "../config/assignmentActionConfig";

const MISSING_ASSIGNMENT_MASTER_MESSAGE =
  "No se puede realizar la acción porque el documento no está asignado a un sorteo.";

const INVALID_RESPONSE_MESSAGE = "Error al realizar la acción";

export type AssignmentActionResult =
  | { ok: true; successMessage: string }
  | { ok: false; message: string };

/**
 * Función para ejecutar la acción seleccionada.
 * @param actionName Nombre de la acción seleccionada.
 * @param ctx Contexto de la acción seleccionada.
 * @returns Resultado de la ejecución de la acción seleccionada.
 */
export async function executeAssignmentAction(
  actionName: AssignmentActionName,
  ctx: AssignmentActionContext,
): Promise<AssignmentActionResult> {
  const { document } = ctx;
  const config = getAssignmentActionConfig(actionName);

  if (!document.docMetadata?.assignmentMasterId) {
    return { ok: false, message: MISSING_ASSIGNMENT_MASTER_MESSAGE };
  }

  try {
    const response = await config.execute(Number(document.docMetadata?.assignmentMasterId));

    if (
      !response.sdetName ||
      response.id <= 0 ||
      response.sdetName !== config.expectedStatusName
    ) {
      return { ok: false, message: INVALID_RESPONSE_MESSAGE };
    }

    await config.onSuccess(ctx);

    return { ok: true, successMessage: config.successMessage };
  } catch (error) {
    console.error(`Error ${actionName} assignment:`, error);

    const message =
      mensajeParaUsuario(error, config.errorMessage);

    return { ok: false, message };
  }
}
