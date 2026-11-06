/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Modal de rechazo del lote de sorteo (motivo requerido ≤800) — RECE-05
 * Archivo: ModalRechazoLote.tsx
 * Responsabilidad: Capturar el MOTIVO del rechazo del lote por el director y enviarlo al backend
 *   (SorteoService.rechazarLote → PATCH /sorteo/:amasId/reject). El motivo es OBLIGATORIO porque el
 *   verbo REAL de Asignaciones (`PATCH /assignments-masters/:id/reject`) exige `{rejectedBy, reason}`:
 *   sin él el rechazo falla. ≤800, igual que RejectAssignmentsMasterDto.reason.
 *
 *   Espeja ModalExcusa (mismo patrón parent-owns-error: el error del servidor sale en el aviso
 *   flotante y el modal permanece abierto; solo se cierra tras éxito; el motivo obligatorio se dice
 *   bajo su campo) y reutiliza Loading — sin markup a mano.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-14
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo del servidor va al aviso
 *   flotante y el motivo obligatorio se dice bajo el campo, con aria-invalid y el foco.)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useId, useRef, useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Loading from "../common/Loading";
import { useToast } from "../../hooks/useToast";
import {
  SorteoService,
  textoCasosSorteados,
  type SorteoLote,
} from "../../services/SorteoService";

/** Máximo del motivo (coincide con RejectLoteDto.reason @MaxLength(800) del backend). */
const MOTIVO_MAX_LENGTH = 800;

interface ModalRechazoLoteProps {
  lote: SorteoLote;
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

const ModalRechazoLote: React.FC<ModalRechazoLoteProps> = ({
  lote,
  onClose,
  refetchFn,
}) => {
  const { addToast } = useToast();

  const [motivo, setMotivo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Error de CAMPO (regla de mensajes 261028-kmg): bajo el motivo, y se retira al escribir.
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const idErrorMotivo = `${useId()}-error-motivo`;

  const motivoValido = motivo.trim().length > 0;

  // Cierre al pulsar fuera (quick 261019-mcf): el motivo escrito es trabajo sin guardar.
  useCierreModal({ hayCambios: motivoValido, ocupado: isSaving });

  const handleConfirm = async () => {
    // Guarda defensiva: el botón ya está apagado sin motivo.
    if (!motivoValido) {
      setErrorMotivo("El motivo del rechazo es requerido.");
      motivoRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      await SorteoService.rechazarLote(lote.amasId, motivo.trim());
      addToast(
        "success",
        "Lote rechazado — los expedientes quedan liberados para volver a sortearse",
      );
      if (refetchFn) await refetchFn();
      onClose();
    } catch (error) {
      addToast(
        "error",
        mensajeParaUsuario(error, "No se pudo rechazar el lote. Intente más tarde."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-box w-fit max-w-lg relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="app-modules-modal-kicker">Aprobación de Sorteos</p>
              <h2 className="app-modules-modal-title">
                Rechazar lote de sorteo
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
        </div>

        <div className="app-modules-modal-body">
          <div className="app-modules-modal-content flex flex-col gap-4">
            <div className="app-modules-review-row">
              <span className="app-modules-review-row-label">Lote</span>
              <span className="app-modules-review-row-value">
                #{lote.amasId}
              </span>
            </div>
            <div className="app-modules-review-row">
              <span className="app-modules-review-row-label">Expedientes</span>
              <span className="app-modules-review-row-value">
                {textoCasosSorteados(lote, "expediente")}
              </span>
            </div>

            <p className="app-modules-review-copy text-sm">
              Indique el motivo del rechazo. Los expedientes del lote quedarán{" "}
              <strong>liberados</strong> y volverán a estar disponibles para un
              nuevo sorteo.
            </p>

            <label className="floating-label">
              <span>Motivo del rechazo (requerido)</span>
              <textarea
                ref={motivoRef}
                className={`textarea textarea-bordered w-full${errorMotivo ? " textarea-error" : ""}`}
                rows={4}
                value={motivo}
                maxLength={MOTIVO_MAX_LENGTH}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setErrorMotivo(null);
                }}
                placeholder="Describa por qué se rechaza este lote de sorteo"
                disabled={isSaving}
                aria-invalid={errorMotivo ? true : undefined}
                aria-describedby={errorMotivo ? idErrorMotivo : undefined}
              />
            </label>
            {errorMotivo && (
              <span id={idErrorMotivo} className="text-sm text-error">
                {errorMotivo}
              </span>
            )}
            <span className="text-xs opacity-70 text-right">
              {motivo.length}/{MOTIVO_MAX_LENGTH}
            </span>
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
              onClick={handleConfirm}
              className="app-modules-modal-submit btn"
              disabled={isSaving || !motivoValido}
            >
              {isSaving ? "Rechazando…" : "Rechazar lote"}
            </button>
          </div>
        </div>
      </div>
      {isSaving && <Loading />}
    </div>
  );
};

export default ModalRechazoLote;
