/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo de la ESCALADA (Fase 03.18, Plan 06)
 * Archivo: ModalRespaldoCostos.tsx
 * Responsabilidad: `HACER-05`, primer paso — subir el documento que RESPALDA EL COSTO de la
 *   ejecución sustitutoria. `POST /obligacion-hacer/:eejeId/respaldo-costos`.
 *
 *   ── 🔴 NO SE LLAMA «FACTURA», Y ES DELIBERADO ────────────────────────────────────────────────
 *   La ejecución sustitutoria municipal la ejecuta muchas veces OTRA ENTIDAD del Municipio, y lo
 *   que llega entonces es un oficio o un informe de liquidación. También vale una planilla o un
 *   acta de entrega-recepción, y sí, a veces llega el comprobante de un contratista privado — pero
 *   bautizar el campo con el nombre del caso privado dejaría fuera el inter-institucional, que
 *   probablemente sea el más frecuente. La pantalla copia el lenguaje del backend, que ya tomó esa
 *   decisión: «respaldo del costo».
 *
 *   ── PRIMER PASO DE UN TRÁMITE DE DOS ─────────────────────────────────────────────────────────
 *   Esto sube el papel y devuelve un identificador de documento. El SEGUNDO paso —«Registrar los
 *   gastos de la sustitutoria»— exige ese identificador como `respaldoDocId`, que es OTRO documento
 *   que la providencia de cobro: aquélla dice QUÉ SE DISPONE, éste dice QUÉ COSTÓ. Por eso el
 *   identificador se canta al terminar y el modal NO se cierra solo: es el dato que hace falta a
 *   continuación, y perderlo obliga a reconocer el documento por su nombre en una lista.
 *
 *   🔴 Este modal NO lee ni compara el estado del EPAS (criterio 7), y el nombre del fichero no
 *   viaja: la única clave del multipart es `file` y el nombre servido lo genera el servidor.
 *
 *   ── SIN PANTALLA DE CONFIRMACIÓN (quick 261014-dmc) ──────────────────────────────────────────
 *   «Subir el respaldo» ejecuta el acto directamente desde el formulario. Antes había un paso intermedio
 *   («Continuar» → revisar → confirmar) que el usuario pidió quitar el 2026-10-14 por exceso de
 *   confirmaciones: la validación ya ocurre en el formulario, la consecuencia jurídica la dice su
 *   alerta, el error sale en el aviso flotante y el acto queda en la bitácora. `enviando` impide el doble
 *   envío y bloquea Cancelar y la × mientras corre.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-lhu: el resultado se cierra con «Volver a la
 *   ficha» o la ×)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo del servidor al registrar se
 *   dice en el aviso flotante, ya no en una caja del modal)
 */
import { useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import { useToast } from "../../hooks/useToast";
import { ObligacionHacerService } from "../../services/ObligacionHacerService";
import {
  TIPO_PDF,
  describirAdministrado,
  describirExpediente,
  mensajeDeError,
  validarPdf,
  type PropsModalRama,
} from "./comunes";

/** Mismo valor que el nombre de acción declarado en `POLITICA_ACCIONES` (Plan 04). */
export const MODAL_KEY = "registrarRespaldoCostos" as const;

const ModalRespaldoCostos = ({
  caseData,
  onClose,
  refetchFn,
}: PropsModalRama) => {
  const { addToast } = useToast();
  const { eejeId } = caseData;

  const [respaldo, setRespaldo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [docIdCreado, setDocIdCreado] = useState<number | null>(null);

  // Cierre al pulsar fuera (quick 261019-mcf): el respaldo elegido y aún no subido es trabajo sin
  // guardar.
  useCierreModal({
    hayCambios: respaldo !== null && docIdCreado == null,
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

  const avisoArchivo = respaldo
    ? validarPdf(respaldo, "El respaldo del costo")
    : null;
  const puedeContinuar = !!respaldo && !avisoArchivo;

  const subir = async () => {
    if (enviando) return;
    if (!respaldo) return;
    setEnviando(true);
    try {
      const { docId } = await ObligacionHacerService.respaldoCostos(
        eejeId,
        respaldo,
      );
      addToast(
        "success",
        `Respaldo del costo incorporado al expediente ${expediente} (documento ${docId}).`,
      );
      if (refetchFn) await refetchFn();

      // 🔴 NO SE CIERRA AL TERMINAR. El identificador que acaba de nacer es lo que el segundo paso
      // va a exigir; cerrar en silencio obligaría al decisor a reconocer su propio documento por el
      // nombre en una lista de todo el expediente.
      setDocIdCreado(docId);
    } catch (error) {
      addToast(
        "error",
        mensajeDeError(
          error,
          "No se pudo subir el respaldo del costo.",
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  if (docIdCreado != null) {
    return (
      <div className="modal-box max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">
              Ejecución — DME · Costos de la sustitutoria
            </p>
            <h3 className="text-lg font-semibold">
              Paso 1 de 2 · El respaldo quedó incorporado
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-modules-modal-close shrink-0"
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-base-300 p-3 text-sm">
          <p>
            El respaldo del costo es ahora el documento{" "}
            <strong>{docIdCreado}</strong> del expediente {expediente}.
          </p>
          <p className="mt-2">
            <strong>Falta el paso 2:</strong> «Registrar los gastos de la
            sustitutoria», en el menú de acciones de esta ficha. Ahí se teclea la base de los
            gastos y se cita <strong>este</strong> documento como respaldo del
            costo — es distinto de la providencia que ordena el traslado, y el
            servidor comprueba los dos.
          </p>
          <p className="mt-2 opacity-70">
            Subir el respaldo no crea ninguna deuda por sí solo: la orden de
            pago nace en el paso 2.
          </p>
        </div>

        <div className="modal-action">
          {/* El acto YA está registrado: no hay vuelta al formulario. «La ficha» porque
              este modal solo se abre desde la página de la obligación de hacer. */}
          <button
            type="button"
            className="app-modules-modal-submit btn"
            onClick={onClose}
          >
            Volver a la ficha
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-box max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="app-modules-modal-kicker">
            Ejecución — DME · Costos de la sustitutoria
          </p>
          <h3 className="text-lg font-semibold">
            Paso 1 de 2 · Subir el respaldo del costo
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
            "Es el papel que acredita QUÉ COSTÓ la diligencia. Cuando la sustitutoria la ejecuta " +
            "otra entidad del Municipio, lo que llega es un oficio o un informe de liquidación; " +
            "también vale una planilla o un acta de entrega-recepción. Es el PRIMER paso de dos: " +
            "subirlo no crea ninguna deuda por sí solo."
          }
        />

        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Respaldo del costo (PDF, obligatorio)
          </span>
          <input
            type="file"
            accept={TIPO_PDF}
            className="file-input file-input-bordered w-full"
            disabled={enviando}
            onChange={(e) => setRespaldo(e.target.files?.[0] ?? null)}
          />
          {avisoArchivo ? (
            <span className="text-sm text-error">{avisoArchivo}</span>
          ) : (
            <span className="text-sm opacity-70">
              Solo PDF, hasta 10 MB. El nombre con que se guarda lo pone el
              sistema. La subida puede tardar: no cierre la ventana mientras
              corre.
            </span>
          )}
          <span className="text-sm opacity-80">
            Al terminar se le dará el identificador del documento. Guárdelo: es
            lo que pide el paso 2, «Registrar los gastos de la sustitutoria».
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
          disabled={!puedeContinuar || enviando}
          onClick={subir}
        >
          {enviando ? "Subiendo… (puede tardar)" : "Subir el respaldo"}
        </button>
      </div>
    </div>
  );
};

export default ModalRespaldoCostos;
