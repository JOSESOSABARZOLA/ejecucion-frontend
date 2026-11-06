/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/trabajo-comunitario (frontend)
 * Feature: Trabajo comunitario (Fase 03.14.1, act. 17 · Fase 03.15, D-1)
 * Archivo: RegistrarCumplimientoModal.tsx
 * Responsabilidad: El decisor ACREDITA las horas cumplidas adjuntando el informe del delegado.
 *
 *   ── POR QUÉ CAMBIÓ ESTE TEXTO (Fase 03.15, D-1) ─────────────────────────────────────────────
 *   Decía que registrar el cumplimiento movía el expediente —a CUMPLIDO o a PENDIENTE DE COACTIVA
 *   según las horas— y lo declaraba «antes de ejecutarlo». Ya no hay nada que ejecutar aquí: el
 *   informe **acredita** las horas, y el desenlace lo **dispone la providencia que corresponda**.
 *
 *   ── RECOMIENDA, NO ANUNCIA ──────────────────────────────────────────────────────────────────
 *   El cálculo de horas se conserva entero y cambia de oficio: ya no anuncia el estado al que va el
 *   expediente, sino **cuál de las TRES providencias toca emitir** — archivo por trabajo
 *   comunitario, archivo con el remanente pagado, o envío a coactiva. Sigue siendo ADVISORY: el
 *   valor que vale es el que devuelve el servidor, y la decisión sobre el acto es del decisor.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-14
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al leer el estado se queda
 *   en línea; el fallo al confirmar se dice una vez en el aviso flotante y ya no reaparece en una
 *   caja al volver al formulario)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — `usd` conserva el «—» del valor
 *   ausente y delega en `formatearUsd`; fuera la expresión regular propia)
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useEffect, useMemo, useState } from "react";
import DialogoModal from "../common/DialogoModal";
import { useToast } from "../../hooks/useToast";
import Alert from "../common/Alert";
import Boton from "../common/Boton";
import Loading from "../common/Loading";
import ConfirmationDetail from "../modals/ConfirmationDetail";
import {
  PROVIDENCIA_DEL_DESENLACE,
  TrabajoComunitarioService,
  preverDesenlace,
  preverRemanente,
  type EstadoTrabajoComunitario,
} from "../../services/TrabajoComunitarioService";
import type { MiEpasAsignado } from "../../services/SorteoService";
import { formatearUsd } from "../../utils/importe.util";

interface Props {
  caso: MiEpasAsignado;
  onClose: () => void;
  onRegistrado?: () => void;
}

/** Un importe en pantalla, o «—» si el estado aún no lo trae. */
const usd = (valor?: number) => (valor == null ? "—" : formatearUsd(valor));

const RegistrarCumplimientoModal = ({ caso, onClose, onRegistrado }: Props) => {
  const { addToast } = useToast();
  const [estado, setEstado] = useState<EstadoTrabajoComunitario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [horas, setHoras] = useState("");
  const [informe, setInforme] = useState<File | null>(null);
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
            mensajeParaUsuario(err, "No se pudieron leer las cifras del trabajo comunitario."),
          );
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [caso.eejeId]);

  const horasNum = Number(horas);
  const horasValidas = Number.isInteger(horasNum) && horasNum >= 0;

  const prevision = useMemo(() => {
    if (!estado?.horasAutorizadas || !horasValidas) return null;
    return {
      desenlace: preverDesenlace(horasNum, estado.horasAutorizadas),
      remanente: preverRemanente(horasNum, estado),
    };
  }, [estado, horasNum, horasValidas]);

  /**
   * 🔴 ¿YA CONSTA un informe? Antes no hacía falta preguntarlo: registrar el cumplimiento movía el
   * EPAS y la acción desaparecía sola de la bandeja. Desde la Fase 03.15 el expediente **no se
   * mueve**, así que la fila sigue ofreciendo «Registrar cumplimiento» con el informe ya
   * acreditado.
   *
   * Aquí NO se bloquea —a diferencia del pago, el servidor sí admite volver a registrarlo, y ése es
   * el camino para corregir unas horas mal tecleadas—: se avisa de que se va a sustituir.
   */
  const yaConsta = !!estado?.informeDocId;

  const puedeRegistrar = !!informe && horasValidas && !!estado && !enviando;

  const registrar = async () => {
    if (!informe || caso.eejeId == null) return;
    setEnviando(true);
    try {
      const cierre = await TrabajoComunitarioService.registrarCumplimiento(
        caso.eejeId,
        horasNum,
        informe,
      );
      addToast(
        "success",
        `Horas acreditadas (${cierre.horasReconocidas} h). El expediente NO cambia de estado: ` +
          `${PROVIDENCIA_DEL_DESENLACE[cierre.desenlace]}.`,
      );
      onRegistrado?.();
      setConfirmando(false);
      onClose();
    } catch (err) {
      addToast("error", mensajeParaUsuario(err, "No se pudo registrar el cumplimiento."));
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
        hayCambios={horas.trim() !== "" || informe !== null}
        ocupado={enviando}
      >
        <div className="modal-box max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">Registrar cumplimiento</h3>
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
                  message={`Este expediente ya tiene informe acreditado (${estado.horasCumplidas ?? "—"} h). Volver a registrarlo SUSTITUYE las horas anteriores; si lo que falta es cerrar el expediente, lo que toca es emitir la providencia.`}
                />
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="opacity-70">Horas autorizadas</span>
                <span>{estado.horasAutorizadas ?? "—"}</span>
                <span className="opacity-70">Plazo</span>
                <span>
                  {estado.plazoMeses ? `${estado.plazoMeses} meses` : "—"}
                </span>
                <span className="opacity-70">Compensado autorizado</span>
                <span>{usd(estado.valorCompensado)}</span>
              </div>

              <label className="flex flex-col gap-1">
                <span className="font-medium">
                  Horas efectivamente cumplidas
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input input-bordered w-full"
                  value={horas}
                  disabled={enviando}
                  onChange={(e) => setHoras(e.target.value)}
                />
                {!horasValidas && horas !== "" && (
                  <span className="text-sm text-error">
                    Deben ser horas enteras, cero o más.
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-medium">
                  Informe del delegado (PDF, obligatorio)
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="file-input file-input-bordered w-full"
                  disabled={enviando}
                  onChange={(e) => setInforme(e.target.files?.[0] ?? null)}
                />
                <span className="text-sm opacity-70">
                  Sin el informe no se acreditan horas: es lo que sustenta el
                  cierre. El cierre en sí lo dispone la providencia, que lo
                  cita.
                </span>
              </label>

              {/* La RECOMENDACIÓN, no el efecto: registrar esto no mueve el expediente. Es lo único
                  que le dice al decisor cuál de las tres providencias del trabajo comunitario
                  emitir después, y por eso se enseña aquí y no al final. */}
              {prevision && (
                <Alert
                  variant={prevision.desenlace === "TOTAL" ? "info" : "warning"}
                  message={
                    `Con ${horasNum} de ${estado.horasAutorizadas} horas ` +
                    (prevision.desenlace === "TOTAL"
                      ? ""
                      : `y un remanente de ${usd(prevision.remanente)}, `) +
                    `${PROVIDENCIA_DEL_DESENLACE[prevision.desenlace]}. ` +
                    "El expediente no se mueve al registrar: lo mueve esa providencia."
                  }
                />
              )}
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
              texto="Registrar cumplimiento"
              deshabilitado={!puedeRegistrar}
              onClick={() => setConfirmando(true)}
            />
          </div>
        </div>
      </DialogoModal>

      {confirmando && estado && prevision && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setConfirmando(false)}
          ocupado={enviando}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle="Acreditar el trabajo comunitario"
            statusCopy="Revise antes de registrar"
            descriptionCopy={`El informe queda adjunto y las horas acreditadas. El expediente NO cambia de estado: después, ${PROVIDENCIA_DEL_DESENLACE[prevision.desenlace]}.`}
            informationData={{
              Expediente: caso.expNumber ?? `EPAS ${caso.eejeId ?? ""}`,
              "Horas cumplidas": `${horasNum} de ${estado.horasAutorizadas ?? "—"}`,
              "Remanente a cobrar": usd(prevision.remanente),
              Informe: informe?.name ?? "—",
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

export default RegistrarCumplimientoModal;
