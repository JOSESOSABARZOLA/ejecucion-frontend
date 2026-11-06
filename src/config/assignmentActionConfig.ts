/**
 * Microservicio: resolucion
 * Módulo: inbox
 * Feature: Configuración de acciones de sorteo
 * Archivo: assignmentActionConfig.ts
 * Responsabilidad: Registry declarativo de approve/deny assignment con textos y side effects
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-08
 */

import type { AssignmentResultsByUser } from "../interfaces/IAssignmentResult";
import type { AssignmentMasterResponse } from "../interfaces/ICase";
import type { IInboxCases } from "../interfaces/IInboxCases";
import type { UserActions } from "../interfaces/IUser";
import { AssignmentService } from "../services/AssignmentService";
import { CaseService } from "../services/CaseService";
import { DocumentService } from "../services/DocumentService";
import type { InboxActionName } from "./inboxActionStatusRules";

export type AssignmentActionName = Extract<
  InboxActionName,
  "approveAssignment" | "denyAssignment"
>;

export interface AssignmentActionContext {
  document: IInboxCases;
  assignment: AssignmentResultsByUser;
}

export interface AssignmentActionDefinition {
  execute: (assignmentMasterId: number) => Promise<AssignmentMasterResponse>;
  expectedStatusName: string;
  onSuccess: (ctx: AssignmentActionContext) => Promise<void>;
  loadingText: string;
  successMessage: string;
  errorMessage: string;
  isDestructive: boolean;
}

export interface ConfirmationCopy {
  statusCopy: string;
  descriptionCopy: string;
  confirmButtonText: string;
  loadingText: string;
  successFallback: string;
  isDestructive: boolean;
}

/**
 * Función para definir la acción de asignación.
 * @param config Configuracion de la accion.
 * @returns Configuracion de la accion.
 */
const defineAssignmentAction = (
  config: AssignmentActionDefinition,
): AssignmentActionDefinition => config;

// Registro de acciones de asignación, con las configuraciones para cada acción.
export const ASSIGNMENT_ACTION_REGISTRY = {
  approveAssignment: defineAssignmentAction({
    execute: AssignmentService.approveAssignment,
    expectedStatusName: "Aprobado",
    onSuccess: async ({ document, assignment }) => {
      await DocumentService.updateDocument(document.docId, {
        docStatus: "aprobado",
      });
      await CaseService.assignCasesToUser(assignment);
    },
    loadingText: "Aprobando...",
    successMessage: "Sorteo aprobado correctamente",
    errorMessage: "Error al aprobar el sorteo",
    isDestructive: false,
  }),
  denyAssignment: defineAssignmentAction({
    execute: AssignmentService.denyAssignment,
    expectedStatusName: "Rechazado",
    onSuccess: async ({ document }) => {
      await DocumentService.updateDocument(document.docId, {
        docStatus: "rechazado",
      });
    },
    loadingText: "Denegando...",
    successMessage: "Sorteo denegado correctamente",
    errorMessage: "Error al denegar el sorteo",
    isDestructive: true,
  }),
} as const satisfies Record<AssignmentActionName, AssignmentActionDefinition>;


// Función para verificar si una acción es de asignación.
export const isAssignmentActionName = (
  actiName: string,
): actiName is AssignmentActionName =>
  actiName in ASSIGNMENT_ACTION_REGISTRY;

// Función para obtener la configuración de la acción de asignación.
export const getAssignmentActionConfig = (
  name: AssignmentActionName,
): AssignmentActionDefinition => ASSIGNMENT_ACTION_REGISTRY[name];

/**
 * Función para construir la configuración de la confirmación.
 * @param action Accion a confirmar.
 * @param config Configuracion de la accion.
 * @returns Configuracion de la confirmacion.
 */
export const buildConfirmationCopy = (
  action: UserActions,
  config: AssignmentActionDefinition,
): ConfirmationCopy => {
  const labelLower = action.actiLabel.toLowerCase();

  return {
    statusCopy: `Listo para ${labelLower}`,
    descriptionCopy: `¿Está seguro de que desea ${labelLower}?`,
    confirmButtonText: `Sí, ${labelLower}`,
    loadingText: config.loadingText,
    successFallback: config.successMessage,
    isDestructive: config.isDestructive,
  };
};

/**
 * Función para obtener la configuración de la confirmación para una acción.
 * @param action Accion a confirmar.
 * @returns Configuracion de la confirmacion.
 */
export const getConfirmationCopyForAction = (
  action: UserActions,
): ConfirmationCopy | null => {
  if (!isAssignmentActionName(action.actiName)) {
    return null;
  }

  return buildConfirmationCopy(
    action,
    getAssignmentActionConfig(action.actiName),
  );
};
