/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/trabajo-comunitario (frontend)
 * Feature: Acogimiento al trabajo comunitario (Fase 03.14.2, act. 16)
 * Archivo: RegistrarAcogimientoModal.tsx
 * Responsabilidad: El decisor registra lo que respondió el administrado a la posibilidad de
 *   trabajo comunitario.
 *
 *   ── LO QUE ESTA PANTALLA EXISTE PARA EVITAR ──────────────────────────────────────────────────
 *   Hasta la Fase 03.14.2, el trabajo comunitario se autorizaba sin que constara que el administrado
 *   lo había pedido. El procedimiento lo dice al revés (act. 16): se informa la posibilidad y **él
 *   decide**. Aquí se recoge esa decisión, con el escrito que la contiene.
 *
 *   ── EL «NO» TAMBIÉN SE REGISTRA, Y NO MUEVE NADA ─────────────────────────────────────────────
 *   La rama del «no» continúa en la actividad 16.2, *verificar pago*, que es donde el expediente ya
 *   está. Se dice en la propia pantalla: quien responde por el administrado tiene que saber qué pasa
 *   después, no descubrirlo al confirmar.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-18
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al registrar se dice una vez
 *   en el aviso flotante y ya no reaparece en una caja al volver al formulario)
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useState } from "react";
import DialogoModal from "../common/DialogoModal";
import { useToast } from "../../hooks/useToast";
import Alert from "../common/Alert";
import Boton from "../common/Boton";
import ConfirmationDetail from "../modals/ConfirmationDetail";
import { TrabajoComunitarioService } from "../../services/TrabajoComunitarioService";
import type { MiEpasAsignado } from "../../services/SorteoService";

interface Props {
  caso: MiEpasAsignado;
  onClose: () => void;
  onRegistrado?: () => void;
}

/** El efecto de cada respuesta, dicho antes de ejecutarla. */
const EFECTO = {
  si: "el expediente quedará listo para que usted emita la providencia que autoriza el trabajo comunitario y congela sus cifras",
  no: "el expediente seguirá en verificación de pago, que es donde continúa el procedimiento (act. 16.2)",
} as const;

const RegistrarAcogimientoModal = ({ caso, onClose, onRegistrado }: Props) => {
  const { addToast } = useToast();
  // `null` = todavía no ha elegido en la pantalla. No se preselecciona ninguna opción: la respuesta
  // es del administrado, y un valor por defecto sería poner palabras en su boca.
  const [seAcoge, setSeAcoge] = useState<boolean | null>(null);
  const [fecha, setFecha] = useState("");
  const [escrito, setEscrito] = useState<File | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // El escrito es obligatorio SOLO al acogerse: es una petición y sin el papel no existe. El «no» es
  // una respuesta, y exigirle documento impediría dejar constancia de que respondió.
  const faltaEscrito = seAcoge === true && !escrito;
  const puedeRegistrar = seAcoge !== null && !faltaEscrito && !enviando;

  const registrar = async () => {
    if (seAcoge === null || caso.eejeId == null) return;
    setEnviando(true);
    try {
      await TrabajoComunitarioService.registrarAcogimiento(
        caso.eejeId,
        { seAcoge, acogidoAt: fecha || undefined },
        escrito ?? undefined,
      );
      addToast(
        "success",
        seAcoge
          ? "Registrado: el administrado se acoge al trabajo comunitario."
          : "Registrado: el administrado no se acoge. El expediente sigue en verificación de pago.",
      );
      onRegistrado?.();
      setConfirmando(false);
      onClose();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo registrar la respuesta del administrado."),
      );
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <DialogoModal
        className="modal modal-open"
        onCerrar={onClose}
        hayCambios={seAcoge !== null || fecha !== "" || escrito !== null}
        ocupado={enviando}
      >
        <div className="modal-box max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">
                Respuesta al trabajo comunitario
              </h3>
              <p className="text-sm opacity-70">
                {caso.expNumber ?? `EPAS ${caso.eejeId ?? ""}`} ·{" "}
                {caso.administrado ?? "administrado/a sin nombre"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-close shrink-0"
              aria-label="Cerrar modal"
              disabled={enviando}
            >
              ×
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="font-medium">
                ¿El administrado se acoge al trabajo comunitario?
              </legend>

              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  name="acogimiento"
                  className="radio radio-primary mt-1"
                  checked={seAcoge === true}
                  disabled={enviando}
                  onChange={() => setSeAcoge(true)}
                />
                <span>
                  <span className="font-medium">Sí, se acoge</span>
                  <span className="block text-sm opacity-70">{EFECTO.si}.</span>
                </span>
              </label>

              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  name="acogimiento"
                  className="radio radio-primary mt-1"
                  checked={seAcoge === false}
                  disabled={enviando}
                  onChange={() => setSeAcoge(false)}
                />
                <span>
                  <span className="font-medium">No se acoge</span>
                  <span className="block text-sm opacity-70">{EFECTO.no}.</span>
                </span>
              </label>
            </fieldset>

            <label className="flex flex-col gap-1">
              <span className="font-medium">Fecha de la respuesta</span>
              <input
                type="date"
                className="input input-bordered w-full"
                value={fecha}
                disabled={enviando}
                onChange={(e) => setFecha(e.target.value)}
              />
              <span className="text-sm opacity-70">
                Si la deja vacía se registra la de hoy.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium">
                Escrito del administrado (PDF
                {seAcoge === true ? ", obligatorio" : ", opcional"})
              </span>
              <input
                type="file"
                accept="application/pdf"
                className="file-input file-input-bordered w-full"
                disabled={enviando}
                onChange={(e) => setEscrito(e.target.files?.[0] ?? null)}
              />
              <span className="text-sm opacity-70">
                {seAcoge === false
                  ? "Adjúntelo si el administrado respondió por escrito."
                  : "Es la petición con la que se acoge: sin ella no se puede autorizar."}
              </span>
            </label>

            {seAcoge !== null && (
              <Alert
                variant={seAcoge ? "info" : "warning"}
                message={`Al registrar, ${seAcoge ? EFECTO.si : EFECTO.no}.`}
              />
            )}
          </div>

          <div className="modal-action">
            <Boton
              estilos="btn btn-ghost"
              texto="Cancelar"
              deshabilitado={enviando}
              onClick={onClose}
            />
            <Boton
              estilos="btn btn-primary"
              texto="Registrar respuesta"
              deshabilitado={!puedeRegistrar}
              onClick={() => setConfirmando(true)}
            />
          </div>
        </div>
      </DialogoModal>

      {confirmando && seAcoge !== null && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setConfirmando(false)}
          ocupado={enviando}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle="Registrar la respuesta del administrado"
            statusCopy="Revise antes de registrar"
            descriptionCopy={`Al registrar, ${seAcoge ? EFECTO.si : EFECTO.no}. La respuesta no se puede cambiar desde esta pantalla: rectificarla es otro acto.`}
            informationData={{
              Expediente: caso.expNumber ?? `EPAS ${caso.eejeId ?? ""}`,
              Respuesta: seAcoge ? "Se acoge" : "No se acoge",
              Fecha: fecha || "hoy",
              Escrito: escrito?.name ?? "—",
            }}
            confirmButtonText="Registrar"
            confirmButtonLoadingText="Registrando…"
            onConfirm={registrar}
            onClose={() => setConfirmando(false)}
          />
        </DialogoModal>
      )}
    </>
  );
};

export default RegistrarAcogimientoModal;
