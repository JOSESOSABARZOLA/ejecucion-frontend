/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05)
 * Archivo: ModalDeclararHacer.tsx
 * Responsabilidad: Declarar que la resolución de origen impuso, además de la multa, una OBLIGACIÓN
 *   DE HACER — el correctivo— sobre este expediente. `POST /obligacion-hacer/:eejeId/declarar`.
 *
 *   ── QUÉ SIGNIFICA DECLARAR ───────────────────────────────────────────────────────────────────
 *   No sustituye a la obligación pecuniaria: CONVIVE con ella. A partir de la declaración el
 *   expediente lleva DOS obligaciones a la vez, y el archivo va a exigir que el correctivo conste
 *   cumplido —o que conste el desenlace de su incumplimiento—, no solo que la multa esté pagada.
 *
 *   ── EL MODAL NO DECIDE SI LA ACCIÓN PROCEDE ──────────────────────────────────────────────────
 *   🔴 Eso ya lo decidió el motor de reglas antes de ofrecer el botón: `declararHacer` exige
 *   `tiene === false` (Plan 04). Aquí no se lee ni se compara el estado del EPAS (criterio 7).
 *
 *   ── SIN PANTALLA DE CONFIRMACIÓN (quick 261014-dmc) ──────────────────────────────────────────
 *   «Declarar» ejecuta el acto directamente desde el formulario. Antes había un paso intermedio
 *   («Continuar» → revisar → confirmar) que el usuario pidió quitar el 2026-10-14 por exceso de
 *   confirmaciones: la consecuencia jurídica ya la dice la alerta del formulario, el error sale en
 *   el aviso flotante y el acto queda en la bitácora con su fecha y su autor. `enviando` impide el doble envío.
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
export const MODAL_KEY = "declararHacer" as const;

/** Tope del `@MaxLength(300)` de `DeclararObligacionHacerDto.observaciones`. */
const MAX_OBSERVACIONES = 300;

const ModalDeclararHacer = ({
  caseData,
  onClose,
  refetchFn,
}: PropsModalRama) => {
  const { addToast } = useToast();
  const { eejeId } = caseData;

  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Cierre al pulsar fuera (quick 261019-mcf): las observaciones escritas son trabajo sin guardar.
  useCierreModal({
    hayCambios: observaciones.trim() !== "",
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

  /**
   * *Parent-owns-error*: si el envío falla, el error se pinta DENTRO y el modal NO se cierra —lo
   * escrito no se pierde—. Solo el éxito llama a `onClose`, y antes recarga la bandeja con
   * `refetchFn`.
   */
  const declarar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const texto = observaciones.trim();
      await ObligacionHacerService.declarar(
        eejeId,
        texto ? { observaciones: texto } : {},
      );
      addToast(
        "success",
        `El expediente ${expediente} queda con obligación de hacer declarada.`,
      );
      if (refetchFn) await refetchFn();
      onClose();
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudo declarar la obligación de hacer.",
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
          <h3 className="text-lg font-semibold">
            Declarar la obligación de hacer
          </h3>
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
          variant="info"
          message={
            "Declarar el correctivo NO sustituye a la multa: el expediente pasa a llevar las dos " +
            "obligaciones a la vez. Desde ahora el archivo exigirá que el correctivo conste " +
            "cumplido, no solo que la multa esté pagada. El acto se registra en la bitácora con su " +
            "fecha y su autor."
          }
        />

        <label className="flex flex-col gap-1">
          <span className="font-medium">Observaciones (opcional)</span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            maxLength={MAX_OBSERVACIONES}
            value={observaciones}
            placeholder="Qué correctivo impuso la resolución (contexto libre para quien lea el expediente después)"
            disabled={enviando}
            onChange={(e) => setObservaciones(e.target.value)}
          />
          <span className="text-sm opacity-70">
            Va a la bitácora del acto, no a una columna del expediente. Máximo{" "}
            {MAX_OBSERVACIONES} caracteres; quedan{" "}
            {MAX_OBSERVACIONES - observaciones.length}.
          </span>
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
          disabled={enviando}
          onClick={declarar}
        >
          {enviando ? "Declarando…" : "Declarar"}
        </button>
      </div>
    </div>
  );
};

export default ModalDeclararHacer;
