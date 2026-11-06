/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/trabajo-comunitario (frontend)
 * Feature: Prórroga del plazo (Fase 03.14.4)
 * Archivo: SolicitarProrrogaModal.tsx
 * Responsabilidad: Registrar la SOLICITUD de prórroga que presenta el administrado, con su escrito.
 *
 *   ── LO QUE ESTA PANTALLA TIENE QUE DEJAR CLARO ───────────────────────────────────────────────
 *   Registrar la solicitud **no la concede**: la resuelve el ejecutor emitiendo la providencia
 *   «Trabajo comunitario – prórroga». Si la pantalla no lo dijera, un funcionario podría creer que
 *   con registrarla ya está dado el plazo — y el administrado se quedaría esperando un tiempo que
 *   nadie le concedió.
 *
 *   La regla temporal —solo antes de vencer, una sola vez— la hace cumplir el backend; su mensaje
 *   incluye la fecha de vencimiento, así que se muestra tal cual.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-19
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al leer el estado se queda
 *   en línea; el fallo al confirmar se dice una vez en el aviso flotante y ya no reaparece en una
 *   caja al volver al formulario)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: dice cuántos días corrió el plazo la
 *   impugnación y, con la suspensión abierta, que el plazo está detenido en vez de culpar a una
 *   solicitud previa que no existe)
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useEffect, useState } from "react";
import DialogoModal from "../common/DialogoModal";
import { useToast } from "../../hooks/useToast";
import Alert from "../common/Alert";
import Boton from "../common/Boton";
import Loading from "../common/Loading";
import ConfirmationDetail from "../modals/ConfirmationDetail";
import {
  TrabajoComunitarioService,
  type EstadoTrabajoComunitario,
} from "../../services/TrabajoComunitarioService";
import type { MiEpasAsignado } from "../../services/SorteoService";

interface Props {
  caso: MiEpasAsignado;
  onClose: () => void;
  onSolicitada?: () => void;
}

const fecha = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("es-EC") : "—";

/** «2,5 meses» se lee mejor que «2.5». */
const meses = (n?: number) =>
  n == null
    ? "—"
    : `${String(n).replace(".", ",")} ${n === 1 ? "mes" : "meses"}`;

const SolicitarProrrogaModal = ({ caso, onClose, onSolicitada }: Props) => {
  const { addToast } = useToast();
  const [estado, setEstado] = useState<EstadoTrabajoComunitario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [escrito, setEscrito] = useState<File | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  /** Fallo al CARGAR el estado: se dice en línea, en su hueco (regla 3b de 261028-kmg). */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const datos = await TrabajoComunitarioService.estado(caso.eejeId ?? 0);
        if (vivo) setEstado(datos);
      } catch (err) {
        if (vivo)
          setErrorCarga(
            mensajeParaUsuario(err, "No se pudo leer el plazo del trabajo comunitario."),
          );
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [caso.eejeId]);

  const puedeSolicitar = !!escrito && !!estado?.prorrogaDisponible && !enviando;

  const solicitar = async () => {
    if (!escrito || caso.eejeId == null) return;
    setEnviando(true);
    try {
      await TrabajoComunitarioService.solicitarProrroga(caso.eejeId, escrito);
      addToast(
        "success",
        "Solicitud de prórroga registrada. Queda pendiente de que usted la resuelva con su providencia.",
      );
      onSolicitada?.();
      setConfirmando(false);
      onClose();
    } catch (err) {
      addToast("error", mensajeParaUsuario(err, "No se pudo registrar la solicitud."));
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
        hayCambios={escrito !== null}
        ocupado={enviando}
      >
        <div className="modal-box max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">Solicitud de prórroga</h3>
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

          {errorCarga && <Alert variant="error" message={errorCarga} />}
          {cargando && <Loading />}

          {!cargando && estado && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="opacity-70">Plazo autorizado</span>
                <span>{meses(estado.plazoMeses)}</span>
                <span className="opacity-70">Vence</span>
                <span
                  className={estado.vencido ? "text-error font-medium" : ""}
                >
                  {fecha(estado.venceAt)}
                  {estado.vencido && " — ya venció"}
                  {estado.plazoSuspendidoDesde && " (provisional: el plazo está suspendido)"}
                </span>
                {/* quick 261028-mtg: lo que una impugnación ya resuelta corrió el vencimiento. El
                    servidor lo sumó a `venceAt`; aquí solo se dice, para que la fecha se entienda. */}
                {(estado.diasSuspendidos ?? 0) > 0 && (
                  <>
                    <span className="opacity-70">Impugnación</span>
                    <span>
                      Plazo corrido {estado.diasSuspendidos}{" "}
                      {estado.diasSuspendidos === 1 ? "día" : "días"} por la
                      impugnación
                    </span>
                  </>
                )}
                {estado.prorrogaMesesPrevistos != null && (
                  <>
                    <span className="opacity-70">Si se concede</span>
                    <span>
                      {meses(estado.prorrogaMesesPrevistos)} más, hasta el{" "}
                      {fecha(estado.prorrogaVenceAtPrevisto)}
                    </span>
                  </>
                )}
              </div>

              {/* Por qué no se puede, cuando no se puede. Un botón gris sin explicación obliga a
                  adivinar si es un permiso, un estado o una fecha. */}
              {!estado.prorrogaDisponible && (
                <Alert
                  variant="warning"
                  message={
                    estado.plazoSuspendidoDesde
                      ? `El plazo está suspendido por la impugnación desde el ${fecha(estado.plazoSuspendidoDesde)}${
                          estado.diasRestantesAlSuspender != null
                            ? ` (le quedaban ${estado.diasRestantesAlSuspender} días)`
                            : ""
                        }: la prórroga se podrá solicitar cuando la Procuraduría resuelva el recurso.`
                      : estado.vencido
                        ? `El plazo venció el ${fecha(estado.venceAt)}: la prórroga solo se puede solicitar antes del vencimiento.`
                        : `Ya se presentó una solicitud el ${fecha(estado.prorrogaSolicitadaAt)}: solo se admite una.`
                  }
                />
              )}

              {estado.prorrogaDisponible && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium">
                      Escrito del administrado (PDF, obligatorio)
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="file-input file-input-bordered w-full"
                      disabled={enviando}
                      onChange={(e) => setEscrito(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  <Alert
                    variant="info"
                    message="Registrar la solicitud NO concede la prórroga: la resuelve usted emitiendo la providencia «Trabajo comunitario – prórroga», que puede concederla o negarla."
                  />
                </>
              )}
            </div>
          )}

          <div className="modal-action">
            <Boton
              estilos="btn btn-ghost"
              texto="Cerrar"
              deshabilitado={enviando}
              onClick={onClose}
            />
            {estado?.prorrogaDisponible && (
              <Boton
                estilos="btn btn-primary"
                texto="Registrar solicitud"
                deshabilitado={!puedeSolicitar}
                onClick={() => setConfirmando(true)}
              />
            )}
          </div>
        </div>
      </DialogoModal>

      {confirmando && estado && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setConfirmando(false)}
          ocupado={enviando}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle="Registrar la solicitud de prórroga"
            statusCopy="Revise antes de registrar"
            descriptionCopy="Queda constancia de que el administrado la pidió. El plazo NO se mueve hasta que usted la resuelva con su providencia."
            informationData={{
              Expediente: caso.expNumber ?? `EPAS ${caso.eejeId ?? ""}`,
              "Vence actualmente": fecha(estado.venceAt),
              "Si se concede": `${meses(estado.prorrogaMesesPrevistos)} más, hasta el ${fecha(estado.prorrogaVenceAtPrevisto)}`,
              Escrito: escrito?.name ?? "—",
            }}
            confirmButtonText="Registrar"
            confirmButtonLoadingText="Registrando…"
            onConfirm={solicitar}
            onClose={() => setConfirmando(false)}
          />
        </DialogoModal>
      )}
    </>
  );
};

export default SolicitarProrrogaModal;
