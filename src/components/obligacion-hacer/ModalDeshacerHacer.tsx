/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05)
 * Archivo: ModalDeshacerHacer.tsx
 * Responsabilidad: Deshacer la declaración del correctivo cuando se declaró POR ERROR.
 *   `POST /obligacion-hacer/:eejeId/deshacer`.
 *
 *   ── DESHACER NO BORRA HISTORIA ───────────────────────────────────────────────────────────────
 *   Lo que se quita es la MARCA de que el expediente lleva correctivo; el acto de deshacer queda
 *   registrado con su fecha, su autor y su motivo. Por eso el motivo es OBLIGATORIO y con longitud
 *   mínima: sin él, la bitácora solo diría que alguien borró un hecho del expediente.
 *
 *   ── LA VALIDACIÓN VIVE EN EL FORMULARIO, NO EN EL 400 ────────────────────────────────────────
 *   El DTO (`DeshacerObligacionHacerDto`) exige `@MinLength(10)` y `@MaxLength(300)`. Se comprueba
 *   aquí ANTES de enviar para que el decisor lo lea junto al campo, y no después de un viaje de ida
 *   y vuelta que le devuelve un mensaje de validación de un servidor.
 *
 *   🔴 Este modal NO lee ni compara el estado del EPAS (criterio 7): que la acción proceda lo
 *   decidió el motor (`tiene` ∧ ¬`cumplida`, Plan 04) antes de ofrecer el botón.
 *
 *   ── SIN PANTALLA DE CONFIRMACIÓN (quick 261014-dmc) ──────────────────────────────────────────
 *   «Deshacer la declaración» ejecuta el acto directamente desde el formulario. Antes había un paso intermedio
 *   («Continuar» → revisar → confirmar) que el usuario pidió quitar el 2026-10-14 por exceso de
 *   confirmaciones: la validación ya ocurre en el formulario, la consecuencia jurídica la dice su
 *   alerta, el error sale en el aviso flotante y el acto queda en la bitácora. `enviando` impide el doble
 *   envío y bloquea Cancelar y la × mientras corre.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo del servidor al registrar se
 *   dice en el aviso flotante, ya no en una caja del modal)
 */
import { useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import { useToast } from "../../hooks/useToast";
import { ObligacionHacerService } from "../../services/ObligacionHacerService";
import {
  describirAdministrado,
  describirExpediente,
  mensajeDeError,
  type PropsModalRama,
} from "./comunes";

/** Mismo valor que el nombre de acción declarado en `POLITICA_ACCIONES` (Plan 04). */
export const MODAL_KEY = "deshacerHacer" as const;

/** `@MinLength(10)` del DTO. El mínimo es lo que separa un motivo de un tecleo. */
export const MOTIVO_MINIMO = 10;
/** `@MaxLength(300)` del DTO. */
export const MOTIVO_MAXIMO = 300;

const ModalDeshacerHacer = ({
  caseData,
  onClose,
  refetchFn,
}: PropsModalRama) => {
  const { addToast } = useToast();
  const { eejeId } = caseData;

  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Cierre al pulsar fuera (quick 261019-mcf): el motivo escrito es trabajo sin guardar.
  useCierreModal({
    hayCambios: motivo.trim() !== "",
    ocupado: enviando,
  });

  if (eejeId == null) {
    return (
      <div className="modal-box max-w-lg">
        <Alert
          variant="error"
          message="No se pudo identificar el expediente. Cierre y vuelva a abrir la acción desde la ficha."
        />
        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const expediente = describirExpediente(caseData);
  const administrado = describirAdministrado(caseData);

  const motivoLimpio = motivo.trim();
  const motivoValido = motivoLimpio.length >= MOTIVO_MINIMO;
  /** El aviso solo aparece cuando el decisor YA escribió algo: no se le regaña antes de empezar. */
  const avisoMotivo =
    motivo !== "" && !motivoValido
      ? `El motivo tiene que explicar el error: mínimo ${MOTIVO_MINIMO} caracteres (lleva ${motivoLimpio.length}).`
      : null;

  const deshacer = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      await ObligacionHacerService.deshacer(eejeId, { motivo: motivoLimpio });
      addToast(
        "success",
        `Se deshizo la declaración de obligación de hacer del expediente ${expediente}. El acto queda en la bitácora.`,
      );
      if (refetchFn) await refetchFn();
      onClose();
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudo deshacer la declaración de obligación de hacer.",
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-box max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="app-modules-modal-kicker">
            Ejecución — DME · Obligación de hacer
          </p>
          <h3 className="text-lg font-semibold">Deshacer la declaración</h3>
          <p className="text-sm opacity-70">
            {expediente} · {administrado}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={enviando}
          className="app-modules-modal-close shrink-0"
          aria-label="Cerrar modal"
        >
          ×
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <Alert
          variant="warning"
          message={
            "Deshacer es para lo que se declaró POR ERROR, no para dar por terminado un correctivo " +
            "que sí se impuso. Si el correctivo se cumplió, lo que toca es acreditar el cumplimiento. " +
            "NO se borra historia: el acto de deshacer queda registrado con su fecha, su autor y el " +
            "motivo."
          }
        />

        <label className="flex flex-col gap-1">
          <span className="font-medium">Motivo (obligatorio)</span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            maxLength={MOTIVO_MAXIMO}
            value={motivo}
            placeholder="Por qué se declaró por error (mínimo 10 caracteres)"
            disabled={enviando}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {avisoMotivo ? (
            <span className="text-sm text-error">{avisoMotivo}</span>
          ) : (
            <span className="text-sm opacity-70">
              Entre {MOTIVO_MINIMO} y {MOTIVO_MAXIMO} caracteres. Es lo único
              que va a explicar el borrado a quien lea la bitácora después.
            </span>
          )}
        </label>
      </div>

      <div className="modal-action">
        <button
          type="button"
          className="app-modules-modal-cancel btn"
          disabled={enviando}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="app-modules-modal-submit btn"
          disabled={!motivoValido || enviando}
          onClick={deshacer}
        >
          {enviando ? "Deshaciendo…" : "Deshacer la declaración"}
        </button>
      </div>
    </div>
  );
};

export default ModalDeshacerHacer;
