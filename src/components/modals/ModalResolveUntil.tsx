/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Modal de fecha máxima para resolver
 * Archivo: ModalResolveUntil.tsx
 * Responsabilidad: Gestionar la selección y actualización de eresResolveUntil
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-12
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la fecha inválida se dice bajo el
 *   calendario y el fallo del servidor en el aviso flotante; ya no hay caja de aviso)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useId, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import Loading from "../common/Loading";
import { CaseService } from "../../services/CaseService";
import { useModal } from "../../hooks/useModal";
import { useToast } from "../../hooks/useToast";
import { useCierreModal } from "../../hooks/useCierreModal";

import type { Case } from "../../interfaces/ICase";

interface ModalResolveUntilProps {
  caseData: Case;
  // isOpen: boolean;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
  // onSave?: (updatedCase: Case) => void;
}

export const ModalResolveUntil: React.FC<ModalResolveUntilProps> = ({
  caseData,
  onClose,
  refetchFn,
}) => {
  const { eresId, eresResolveUntil } = caseData;
  const { triggerSuccess } = useModal();
  const { addToast } = useToast();
  const [selected, setSelected] = useState<Date | undefined>(
    eresResolveUntil ? new Date(eresResolveUntil) : undefined,
  );

  // Guarda la fecha original para comparación
  const originalDate = eresResolveUntil
    ? new Date(eresResolveUntil)
    : undefined;

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  const isReadOnly = !!eresResolveUntil;
  const [isConfirmStep, setIsConfirmStep] = useState(isReadOnly);

  // Función para verificar si la fecha ha cambiado en los casos que requiera el usuario modificar la fecha establecida
  const hasDateChanged = (): boolean => {
    if (!selected || !originalDate) return false;
    const selectedDate = new Date(selected);
    selectedDate.setHours(0, 0, 0, 0);
    const original = new Date(originalDate);
    original.setHours(0, 0, 0, 0);
    return selectedDate.getTime() !== original.getTime();
  };

  // Error de CAMPO de la fecha (regla de mensajes 261028-kmg): se dice bajo el calendario y se
  // retira al elegir una fecha válida. El fallo del servidor va al aviso flotante.
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const idErrorFecha = `${useId()}-error-fecha`;

  // Cierre al pulsar fuera (quick 261019-mcf): una fecha elegida y aún no guardada es un cambio.
  useCierreModal({
    hayCambios: originalDate ? hasDateChanged() : selected !== undefined,
    ocupado: isSaving,
  });

  // Función para validar que la fecha no sea anterior a hoy
  const validateDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToValidate = new Date(date);
    dateToValidate.setHours(0, 0, 0, 0);

    if (dateToValidate < today) {
      setErrorFecha("Seleccione una fecha posterior a hoy");
      return false;
    }

    setErrorFecha(null);
    return true;
  };

  // Maneja la selección de fecha con validación inmediata
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    if (validateDate(date)) {
      setSelected(date);
      setHasSaveError(false);
    }
  };

  //Funcion para guardar la fecha seleccionada, actualizando el caso a través del servicio
  const handleSaveDate = async () => {
    if (!selected) return;

    try {
      setIsSaving(true);
      const response = await CaseService.updateCase(eresId, {
        eresResolveUntil: selected,
      });

      if (response?.eresId) {
        addToast("success", "Fecha actualizada correctamente");

        if (refetchFn) {
          await refetchFn();
        }

        triggerSuccess(response);
      }
    } catch (error) {
      setHasSaveError(true);
      addToast(
        "error",
        `No se pudo actualizar la fecha máxima para resolver: ${mensajeParaUsuario(error, "inténtelo de nuevo.")}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (selected) {
      setIsConfirmStep(true);
    }
  };

  const handleBackToForm = () => {
    setIsConfirmStep(false);
    setHasSaveError(false);
  };

  return (
    <div className="modal-box w-fit relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        {/* Encabezado del modal con stepper */}
        <div className="app-modules-modal-header flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="app-modules-modal-kicker">Expediente</p>
              <h2 className="app-modules-modal-title">
                Tiempo máximo para resolver
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-close shrink-0"
              aria-label="Cerrar modal"
              disabled={isSaving}
            >
              ×
            </button>
          </div>
          {!isReadOnly && (
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
                  Seleccionar fecha
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
        </div>

        {/* Paso 1: Seleccionar fecha */}
        {!isConfirmStep ? (
          <div className="app-modules-modal-body">
            <div
              className="app-modules-modal-content"
              aria-invalid={errorFecha ? true : undefined}
              aria-describedby={errorFecha ? idErrorFecha : undefined}
            >
              <DayPicker
                className="flex flex-col items-center w-full"
                mode="single"
                selected={selected}
                animate={true}
                fixedWeeks={true}
                captionLayout="dropdown"
                onSelect={handleDateSelect}
                disabled={false}
              />
              {errorFecha && (
                <span id={idErrorFecha} className="text-sm text-error">
                  {errorFecha}
                </span>
              )}
            </div>
            <div className="app-modules-modal-actions">
              <button
                type="button"
                onClick={onClose}
                className="app-modules-modal-cancel btn"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="app-modules-modal-submit btn"
                disabled={!selected || !!errorFecha}
              >
                Continuar
              </button>
            </div>
          </div>
        ) : (
          /* Paso 2: Confirmación */
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
                    {!isReadOnly || hasDateChanged()
                      ? "Listo para guardar"
                      : "Actualización realizada"}
                  </span>
                </div>
                <p className="app-modules-review-copy">
                  {!isReadOnly || hasDateChanged()
                    ? "La fecha máxima para resolver este expediente será actualizada"
                    : "La fecha máxima para resolver este expediente ya está establecida"}
                </p>
                <div className="app-modules-review-list">
                  <div className="app-modules-review-row">
                    <span className="app-modules-review-row-label">
                      Fecha seleccionada
                    </span>
                    <span className="app-modules-review-row-value">
                      {selected?.toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="app-modules-modal-actions">
              <button
                type="button"
                onClick={handleBackToForm}
                className="app-modules-modal-secondary btn"
                disabled={isSaving}
              >
                {isReadOnly ? "Modificar fecha" : "Volver"}
              </button>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleSaveDate}
                  className="app-modules-modal-submit btn"
                  disabled={isSaving || hasSaveError}
                >
                  {isSaving ? "Guardando..." : "Sí, guardar"}
                </button>
              )}
              {isReadOnly && hasDateChanged() && (
                <button
                  type="button"
                  onClick={handleSaveDate}
                  className="app-modules-modal-submit btn"
                  disabled={isSaving || hasSaveError}
                >
                  {isSaving ? "Guardando..." : "Sí, guardar"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {isSaving && <Loading />}
    </div>
  );
};
