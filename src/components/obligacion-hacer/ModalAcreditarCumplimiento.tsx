/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05)
 * Archivo: ModalAcreditarCumplimiento.tsx
 * Responsabilidad: Acreditar que el correctivo se cumplió, CITANDO el documento que lo prueba.
 *   `POST /obligacion-hacer/:eejeId/acreditar`.
 *
 *   ── POR QUÉ UNA LISTA Y NO UN NÚMERO (T-0318-20) ─────────────────────────────────────────────
 *   🔴 El endpoint exige un `docId`, y este modal **no tiene ni una caja de número**: el documento
 *   se elige de la LISTA de los del expediente (`EpasService.getDocumentos` a través de
 *   `SelectorDocumentoExpediente`). Pedirle a un decisor que teclee un identificador interno es
 *   pedirle que se equivoque en silencio, y lo que se firma aquí es lo que DESBLOQUEA EL ARCHIVO
 *   del expediente. El servidor vuelve a comprobar que el documento sea de este expediente.
 *
 *   ── LA LIMITACIÓN MEDIDA, Y DE QUIÉN ES ──────────────────────────────────────────────────────
 *   ⚠️ El listado **no trae el subtipo documental** —`EpasRepository.findDocumentos` no proyecta
 *   `ts.tsdoc_subtype`—, así que aquí NO se puede filtrar ni preseleccionar el «informe de control
 *   y verificación» aunque su subtipo exista en la base. Se ofrecen todos los documentos del
 *   expediente con su nombre, su tipo y su fecha. Defecto de backend FUERA DE ALCANCE (D-3): esta
 *   fase no toca `ejecucion-backend/src`. Detalle completo en la cabecera del selector.
 *
 *   ── EL INFORME YA NO SE BUSCA AQUÍ (quick 261014-dmc) ────────────────────────────────────────
 *   El bloque de la rama trae ahora `informeDocId` (el informe más reciente), y el flujo del informe
 *   —`ModalAdjuntarInforme`— cita ese documento directamente al registrar qué concluye, sin
 *   selector. Este modal suelto CONSERVA el selector porque se llega a él desde el registro de
 *   acciones de otras bandejas, donde la prueba del cumplimiento puede ser otro papel.
 *
 *   🔴 Este modal NO lee ni compara el estado del EPAS (criterio 7).
 *
 *   ── SIN PANTALLA DE CONFIRMACIÓN (quick 261014-dmc) ──────────────────────────────────────────
 *   «Acreditar el cumplimiento» ejecuta el acto directamente desde el formulario. Antes había un paso intermedio
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
export const MODAL_KEY = "acreditarCumplimiento" as const;

const ModalAcreditarCumplimiento = ({
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

  const acreditar = async () => {
    if (enviando) return;
    if (docId == null) return;
    setEnviando(true);
    try {
      await ObligacionHacerService.acreditar(eejeId, { docId });
      addToast(
        "success",
        `Cumplimiento del correctivo acreditado en el expediente ${expediente}.`,
      );
      if (refetchFn) await refetchFn();
      onClose();
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudo acreditar el cumplimiento del correctivo.",
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
          <h3 className="text-lg font-semibold">Acreditar el cumplimiento</h3>
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
            "Acreditar es la DECISIÓN; el documento que se cita es la PRUEBA. Es el acto que " +
            "desbloquea el archivo del expediente por el lado del correctivo, así que se firma " +
            "señalando el papel en que se apoya. La obligación pecuniaria sigue su propio camino."
          }
        />

        <SelectorDocumentoExpediente
          eejeId={eejeId}
          valor={docId}
          onChange={(id) => setDocId(id)}
          etiqueta="Documento que acredita el cumplimiento (obligatorio)"
          ayuda="Normalmente el informe de control y verificación de la DMIP. Elíjalo de los documentos del expediente: el sistema no le va a pedir ningún número."
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
          onClick={acreditar}
        >
          {enviando ? "Acreditando…" : "Acreditar el cumplimiento"}
        </button>
      </div>
    </div>
  );
};

export default ModalAcreditarCumplimiento;
