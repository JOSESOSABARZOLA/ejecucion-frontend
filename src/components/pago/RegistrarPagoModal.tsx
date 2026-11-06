/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/pago (frontend)
 * Feature: Verificación de pago (Fase 03.14.1, act. 16.2 · Fase 03.15, D-1)
 * Archivo: RegistrarPagoModal.tsx
 * Responsabilidad: El decisor ACREDITA el pago adjuntando su comprobante. El comprobante sigue
 *   siendo obligatorio: dar un expediente por pagado sin prueba es lo que la fase 03.14.1 vino a
 *   cerrar.
 *
 *   ── POR QUÉ CAMBIÓ ESTE TEXTO (Fase 03.15, D-1) ─────────────────────────────────────────────
 *   Decía que registrar el pago movía el expediente a CUMPLIDO, y era verdad hasta esta fase. Ya
 *   no: **quien mueve el EPAS es la providencia**. Esta pantalla deja el hecho acreditado y nombra
 *   el paso que falta —emitir «Archivo por pago o convenio de pago»—, porque el riesgo real del
 *   cambio no es técnico: es que el decisor crea que el expediente quedó cerrado y nadie emita la
 *   providencia que de verdad lo cierra.
 *
 *   ⚠️ Desde la misma fase el comprobante también se puede aportar DENTRO del modal de emisión: si
 *   no consta, la providencia lo pide y lo recibe en el mismo acto. Esta puerta se conserva porque
 *   el pago es un hecho del mundo y suele constar antes de que el decisor se siente a redactar.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-14
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al leer el estado se queda
 *   en línea; el fallo al confirmar se dice una vez en el aviso flotante y ya no reaparece en una
 *   caja al volver al formulario)
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useEffect, useState } from "react";
import DialogoModal from "../common/DialogoModal";
import { useToast } from "../../hooks/useToast";
import Alert from "../common/Alert";
import Boton from "../common/Boton";
import Loading from "../common/Loading";
import ConfirmationDetail from "../modals/ConfirmationDetail";
import { PagoService, type EstadoPago } from "../../services/PagoService";
import { DatetimeUtil } from "../../utils/datetime.util";
import type { MiEpasAsignado } from "../../services/SorteoService";

interface Props {
  caso: MiEpasAsignado;
  onClose: () => void;
  onResuelto?: () => void;
}

const RegistrarPagoModal = ({ caso, onClose, onResuelto }: Props) => {
  const { addToast } = useToast();
  const [estado, setEstado] = useState<EstadoPago | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pagoAt, setPagoAt] = useState("");
  const [transaccion, setTransaccion] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  /** Fallo al CARGAR el estado: se dice en línea, en su hueco (regla 3b de 261028-kmg). */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const datos = await PagoService.estado(caso.eejeId ?? 0);
        if (vivo) setEstado(datos);
      } catch (err) {
        if (vivo)
          setErrorCarga(
            mensajeParaUsuario(err, "No se pudo leer el estado del pago."),
          );
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [caso.eejeId]);

  /**
   * 🔴 ¿YA CONSTA? Antes esta pregunta no hacía falta: registrar el pago movía el EPAS a CUMPLIDO y
   * la acción desaparecía sola de la bandeja. Desde la Fase 03.15 el expediente **no se mueve**, así
   * que la fila sigue ofreciendo «Constancia de pago» con el pago ya acreditado — y el servidor
   * rechaza el segundo intento. Sin este aviso, el decisor rellenaría el formulario entero para
   * descubrirlo al confirmar.
   */
  const yaConsta = !!estado?.pagoAt;

  const puedeConfirmar =
    !enviando &&
    !yaConsta &&
    !!comprobante &&
    !!pagoAt &&
    transaccion.trim().length > 0;

  const resolver = async () => {
    if (caso.eejeId == null) return;
    setEnviando(true);
    try {
      if (!comprobante) return;
      await PagoService.registrar(
        caso.eejeId,
        { pagoAt, transaccion: transaccion.trim() },
        comprobante,
      );
      addToast(
        "success",
        "Pago acreditado y comprobante adjunto. El expediente NO se cierra con esto: " +
          "el paso siguiente es emitir la providencia «Archivo por pago o convenio de pago», " +
          "que es la que lo archiva y cita este comprobante.",
      );
      onResuelto?.();
      setConfirmando(false);
      onClose();
    } catch (err) {
      addToast("error", mensajeParaUsuario(err, "No se pudo resolver el pago."));
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
        hayCambios={pagoAt !== "" || transaccion.trim() !== "" || comprobante !== null}
        ocupado={enviando}
      >
        <div className="modal-box max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">Verificación de pago</h3>
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
              {yaConsta && (
                <Alert
                  variant="info"
                  message={`El pago de este expediente ya está acreditado (${DatetimeUtil.formatDate(
                    estado.pagoAt,
                  )}${estado.transaccion ? `, transacción ${estado.transaccion}` : ""}). Lo que falta es emitir la providencia «Archivo por pago o convenio de pago», que es la que archiva el expediente y cita este comprobante.`}
                />
              )}
              <label className="flex flex-col gap-1">
                <span className="font-medium">Fecha del pago</span>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={pagoAt}
                  disabled={enviando}
                  onChange={(e) => setPagoAt(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">Nro. de transacción</span>
                <input
                  className="input input-bordered w-full"
                  value={transaccion}
                  disabled={enviando}
                  onChange={(e) => setTransaccion(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">
                  Comprobante (PDF, obligatorio)
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="file-input file-input-bordered w-full"
                  disabled={enviando}
                  onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                />
                <span className="text-sm opacity-70">
                  No se da por pagado un expediente sin la prueba del pago.
                </span>
              </label>

              {/* Aquí había un «Declarar impago» que mandaba el expediente a coactiva con un motivo
                  a mano y NINGÚN documento. Se retiró (2026-08-19): la coactiva la dispone la
                  providencia «Archivo por envío a coactiva», que además ordena la remisión del
                  expediente y el oficio a la Administración Zonal. Este modal se queda con lo suyo:
                  registrar el pago con su comprobante. */}
            </div>
          )}

          <div className="modal-action">
            <Boton
              estilos="btn btn-ghost"
              texto="Cancelar"
              deshabilitado={enviando}
              onClick={onClose}
            />
            <Boton
              estilos="btn btn-primary"
              texto="Registrar pago"
              deshabilitado={!puedeConfirmar}
              onClick={() => setConfirmando(true)}
            />
          </div>
        </div>
      </DialogoModal>

      {confirmando && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setConfirmando(false)}
          ocupado={enviando}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle="Registrar el pago"
            statusCopy="Revise antes de continuar"
            descriptionCopy="El comprobante queda adjunto al expediente y el pago queda acreditado. El expediente NO cambia de estado: para archivarlo hay que emitir después la providencia «Archivo por pago o convenio de pago». Registrar el pago no se deshace desde esta pantalla."
            informationData={{
              Expediente: caso.expNumber ?? `EPAS ${caso.eejeId ?? ""}`,
              Fecha: pagoAt || "—",
              Transacción: transaccion || "—",
              Comprobante: comprobante?.name ?? "—",
            }}
            confirmButtonText="Registrar"
            confirmButtonLoadingText="Enviando…"
            onConfirm={resolver}
            onClose={() => setConfirmando(false)}
          />
        </DialogoModal>
      )}
    </>
  );
};

export default RegistrarPagoModal;
