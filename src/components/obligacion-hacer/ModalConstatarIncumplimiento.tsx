/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05)
 * Archivo: ModalConstatarIncumplimiento.tsx
 * Responsabilidad: Dejar constancia de que el correctivo NO se cumplió, citando el documento que lo
 *   prueba. `POST /obligacion-hacer/:eejeId/incumplimiento`.
 *
 *   ── QUÉ ABRE Y QUÉ NO ────────────────────────────────────────────────────────────────────────
 *   🔴 **CONSTATAR EL INCUMPLIMIENTO NO MUEVE EL EXPEDIENTE.** Se ha medido en el servicio del
 *   backend (`ObligacionHacerService.constatarIncumplimiento`): comprueba la pertenencia, escribe
 *   en el repositorio y registra el log. No hay transición de estado, no hay providencia automática
 *   y no hay multa. **Queda en la bitácora.**
 *
 *   Lo que sí hace es dar PIE a la escalada: con el incumplimiento constatado después de la última
 *   multa, el peldaño siguiente del art. 240 queda habilitado, y por ahí siguen la multa
 *   compulsoria y la ejecución sustitutoria. Pero cada uno de esos actos lo
 *   dispone el decisor, uno a uno. El texto del modal dice exactamente eso, porque insinuar una
 *   transición que no ocurre es peor que no decir nada: el decisor cerraría la pantalla creyendo
 *   que el expediente ya se movió.
 *
 *   🔴 Este modal NO lee ni compara el estado del EPAS (criterio 7).
 *
 *   ── SIN PANTALLA DE CONFIRMACIÓN (quick 261014-dmc) ──────────────────────────────────────────
 *   «Registrar la constatación» ejecuta el acto directamente desde el formulario. Antes había un paso intermedio
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
import { SelectorDocumentoExpediente } from "./SelectorDocumentoExpediente";
import { useToast } from "../../hooks/useToast";
import { ObligacionHacerService } from "../../services/ObligacionHacerService";
import {
  describirAdministrado,
  describirExpediente,
  mensajeDeError,
  type PropsModalRama,
} from "./comunes";

/** Mismo valor que el nombre de acción declarado en `POLITICA_ACCIONES` (Plan 04). */
export const MODAL_KEY = "constatarIncumplimiento" as const;

const ModalConstatarIncumplimiento = ({
  caseData,
  onClose,
  refetchFn,
}: PropsModalRama) => {
  const { addToast } = useToast();
  const { eejeId } = caseData;

  const [docId, setDocId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Cierre al pulsar fuera (quick 261019-mcf): el documento elegido es trabajo sin guardar.
  useCierreModal({
    hayCambios: docId !== null,
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

  const constatar = async () => {
    if (enviando) return;
    if (docId == null) return;
    setEnviando(true);
    try {
      await ObligacionHacerService.constatarIncumplimiento(eejeId, { docId });
      addToast(
        "success",
        `Queda constancia del incumplimiento del correctivo en el expediente ${expediente}. El expediente NO cambia de estado.`,
      );
      if (refetchFn) await refetchFn();
      onClose();
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudo registrar la constatación del incumplimiento.",
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
          <h3 className="text-lg font-semibold">Constatar el incumplimiento</h3>
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
            "Qué hace este acto: deja CONSTANCIA del incumplimiento en la bitácora. Qué NO hace: " +
            "no mueve el expediente de estado, no emite providencia y no impone multa. Es lo que " +
            "habilita el peldaño siguiente de la escalada, que se dispone después y por separado."
          }
        />

        <SelectorDocumentoExpediente
          eejeId={eejeId}
          valor={docId}
          onChange={(id) => setDocId(id)}
          etiqueta="Documento que constata el incumplimiento (obligatorio)"
          ayuda="Normalmente el informe desfavorable del control de verificación de la DMIP. Es la prueba de lo que se constata: elíjalo de los documentos del expediente."
        />
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
          disabled={docId == null || enviando}
          onClick={constatar}
        >
          {enviando ? "Registrando…" : "Registrar la constatación"}
        </button>
      </div>
    </div>
  );
};

export default ModalConstatarIncumplimiento;
