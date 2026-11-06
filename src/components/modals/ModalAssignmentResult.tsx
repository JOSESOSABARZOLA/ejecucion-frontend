/**
 * Microservicio: Resolución Frontend
 * Módulo: N/A
 * Feature: Modal de resultado de sorteo
 * Archivo: ModalAssignmentResult.tsx
 * Responsabilidad: Presentar resultado del sorteo y permitir aprobar o denegar
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-08
 * Modificado por: Andrés Miño — 2026-10-16 (fix sorteo: «Usuarios asignados» recibe el nombre de
 *   cada usuario desde `userNames` y deja «Usuario ( id )» solo como respaldo)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo de la acción se dice en el
 *   aviso flotante, ya no en una caja; el botón de confirmar sigue apagado tras el fallo)
 */

import React, { useCallback, useMemo, useState } from "react";
import EmptyState from "../common/EmptyState";
import CollapseAssignedUsers from "../collapse/CollapseAssignedUsers";
import type { ModalAssignmentResultData } from "../../interfaces/IAssignmentResult";
import type { UserActions } from "../../interfaces/IUser";
import { useToast } from "../../hooks/useToast";
import { useCierreModal } from "../../hooks/useCierreModal";
import { DatetimeUtil } from "../../utils/datetime.util";
import { useUser } from "../../context/UserContext";
import Boton from "../common/Boton";
import { isInboxActionVisible } from "../../config/inboxActionStatusRules";
import {
  getConfirmationCopyForAction,
  isAssignmentActionName,
} from "../../config/assignmentActionConfig";
import { executeAssignmentAction } from "../../utils/assignmentAction.util";
import Loading from "../common/Loading";

export const MODAL_KEY = "seeAssignmentResults" as const;

interface ModalAssignmentResultProps {
  caseData: ModalAssignmentResultData;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

//Función para formatear la fecha de asignación de un expediente.
const formatAssignmentDate = (value: Date | string): string =>
  DatetimeUtil.formatDate(new Date(value));

//Modal para presentar el resultado del sorteo y permitir aprobar o denegar.
const ModalAssignmentResult: React.FC<ModalAssignmentResultProps> = ({
  caseData,
  onClose,
  refetchFn,
}) => {
  const { user } = useUser();
  const { addToast } = useToast();
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [selectedAction, setSelectedAction] = useState<UserActions | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  /**
   * La última acción falló: su motivo ya salió en el aviso flotante y el botón de confirmar queda
   * apagado hasta volver al detalle o elegir otra acción (la conducta de antes, sin la caja).
   */
  const [fallo, setFallo] = useState(false);
  const userRole = user?.rolName ?? "";
  const { document, assignment, userNames } = caseData;

  const permittedActions = useMemo(
    () =>
      user?.actividades.filter(
        (act: UserActions) => act.actiContext === MODAL_KEY,
      ) ?? [],
    [user],
  );

  //Función para verificar si el stepper está visible según el estado del documento y el rol del usuario. TODO: Para mostrar el stepper estoy usando hardcodeado el nombre de la acción "approveAssignment" pero debería ser dinámico.
  const isStepperVisible = useCallback(
    () =>
      isInboxActionVisible("approveAssignment", document.docStatus, userRole),

    [document.docStatus, userRole],
  );

  //Función para verificar si una acción está visible según el estado del documento y el rol del usuario.
  const isActionVisible = useCallback(
    (action: UserActions) =>
      isInboxActionVisible(action.actiName, document.docStatus, userRole),

    [document.docStatus, userRole],
  );

  //Función para obtener los usuarios asignados al expediente, con su nombre si el llamador lo conoce.
  const assignedUserEntries = useMemo(
    () =>
      Object.entries(assignment)
        .map(([userId, results]) => ({
          userId: Number(userId),
          userName: userNames?.[Number(userId)],
          results,
        }))
        .filter((entry) => entry.results.length > 0),
    [assignment, userNames],
  );

  //Función para obtener el texto de confirmación de la acción seleccionada.
  const confirmationCopy = selectedAction
    ? getConfirmationCopyForAction(selectedAction)
    : null;

  // Cierre al pulsar fuera (quick 261019-mcf): nada que perder, salvo una acción en curso.
  useCierreModal({ ocupado: isProcessing });

  if (!user) {
    return null;
  }

  //Función para ejecutar la acción seleccionada.
  const runAssignmentAction = async (actionName: string) => {
    if (!isAssignmentActionName(actionName)) {
      addToast("error", "La acción seleccionada no está disponible.");
      setFallo(true);
      return;
    }

    setFallo(false);
    setIsProcessing(true);

    try {
      const result = await executeAssignmentAction(actionName, {
        document,
        assignment,
      });

      if (!result.ok) {
        addToast("error", result.message);
        setFallo(true);
        return;
      }

      addToast("success", result.successMessage);
      onClose();
      await refetchFn?.();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = (action: UserActions) => {
    setFallo(false);
    setSelectedAction(action);
    setIsConfirmStep(true);
  };

  const handleBackToDetail = () => {
    setIsConfirmStep(false);
    setSelectedAction(null);
    setFallo(false);
  };

  const handleConfirmAction = async () => {
    if (!selectedAction) return;
    await runAssignmentAction(selectedAction.actiName);
  };

  if (isProcessing) {
    return <Loading />;
  }

  return (
    <div className="modal-box max-w-4xl w-11/12 relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">Bandeja de ingreso</p>
            <h2 className="app-modules-modal-title">Resultado del sorteo</h2>
          </div>
          <div className="app-modules-modal-meta">
            {isStepperVisible() && (
              <div
                className="app-modules-stepper"
                aria-label={isConfirmStep ? "Paso 2 de 2" : "Paso 1 de 2"}
              >
                <div
                  className={`app-modules-step ${
                    isConfirmStep ? "is-complete" : "is-active"
                  }`}
                >
                  <span className="app-modules-step-dot">
                    {isConfirmStep ? "✓" : "1"}
                  </span>
                  <span className="app-modules-step-label">
                    Resultado del sorteo
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className={`app-modules-step-line ${
                    isConfirmStep ? "is-complete" : ""
                  }`}
                />
                <div
                  className={`app-modules-step ${
                    isConfirmStep ? "is-active" : "is-pending"
                  }`}
                >
                  <span className="app-modules-step-dot">2</span>
                  <span className="app-modules-step-label">Confirmación</span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-close"
              aria-label="Cerrar modal de resultado del sorteo"
              disabled={isProcessing}
            >
              ×
            </button>
          </div>
        </div>

        {!isConfirmStep ? (
          <div className="app-modules-modal-body app-modules-modal-body-review">
            <div className="app-modules-modal-content app-modules-modal-content-review">
              <div className="app-modules-review-card">
                <h3 className="app-modules-modal-title text-base mb-3">
                  Datos del documento
                </h3>

                <div className="app-modules-review-list">
                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">
                      Documento
                    </span>

                    <span className="app-modules-review-row-value">
                      {document.docName}
                    </span>
                  </div>

                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">Fecha</span>

                    <span className="app-modules-review-row-value">
                      {formatAssignmentDate(document.docUploadedAt)}
                    </span>
                  </div>

                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">
                      Tipo de documento
                    </span>

                    <span className="app-modules-review-row-value">
                      {document.tdocTypeName}
                    </span>
                  </div>

                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">Estado</span>

                    <span className="app-modules-review-row-value capitalize">
                      {document.docStatus ?? "desconocido"}
                    </span>
                  </div>

                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">
                      Expedientes relacionados
                    </span>

                    <span className="app-modules-review-row-value">
                      {document.casesRelated.length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="app-modules-review-card mt-6">
                <h3 className="app-modules-modal-title text-base mb-3">
                  Usuarios asignados
                </h3>

                {assignedUserEntries.length === 0 ? (
                  <EmptyState text="No hay usuarios asignados en este sorteo." />
                ) : (
                  <div className="flex flex-col gap-2">
                    {assignedUserEntries.map((entry, index) => (
                      <CollapseAssignedUsers
                        key={entry.userId}
                        item={entry}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="app-modules-modal-actions">
              {permittedActions.filter(isActionVisible).map((action) => (
                <Boton
                  key={action.actiName}
                  deshabilitado={isProcessing}
                  estilos="btn btn-outline btn-primary"
                  icono={action.actiIconName}
                  texto={action.actiLabel}
                  onClick={() => handleAction(action)}
                />
              ))}

              <Boton
                deshabilitado={isProcessing}
                estilos="btn btn-error"
                texto="Cancelar"
                onClick={onClose}
              />
            </div>
          </div>
        ) : (
          <div className="app-modules-modal-body app-modules-modal-body-review">
            <div className="app-modules-modal-content app-modules-modal-content-review">
              <div className="app-modules-review-card">
                <div className="app-modules-review-status">
                  <span
                    aria-hidden="true"
                    className="app-modules-review-status-icon"
                  >
                    ✓
                  </span>

                  <span className="app-modules-review-status-copy">
                    {confirmationCopy?.statusCopy}
                  </span>
                </div>

                <p className="app-modules-review-copy">
                  {confirmationCopy?.descriptionCopy}
                </p>

                <div className="app-modules-review-list">
                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">
                      Documento
                    </span>

                    <span className="app-modules-review-row-value">
                      {document.docName}
                    </span>
                  </div>

                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">Fecha</span>

                    <span className="app-modules-review-row-value">
                      {formatAssignmentDate(document.docUploadedAt)}
                    </span>
                  </div>

                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">Acción</span>

                    <span className="app-modules-review-row-value">
                      {selectedAction?.actiLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="app-modules-modal-actions">
              <Boton
                deshabilitado={isProcessing}
                estilos="app-modules-modal-secondary btn"
                texto="Volver"
                onClick={handleBackToDetail}
              />

              <Boton
                deshabilitado={isProcessing || fallo}
                estilos={
                  confirmationCopy?.isDestructive
                    ? "btn btn-error"
                    : "app-modules-modal-submit btn"
                }
                texto={
                  isProcessing
                    ? confirmationCopy?.loadingText
                    : confirmationCopy?.confirmButtonText
                }
                onClick={handleConfirmAction}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalAssignmentResult;
