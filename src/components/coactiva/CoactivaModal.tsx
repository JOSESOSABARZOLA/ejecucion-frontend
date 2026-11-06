/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/coactiva (frontend)
 * Feature: El tramo de la coactiva (Fase 03.14.5)
 * Archivo: CoactivaModal.tsx
 * Responsabilidad: Registrar que la Administración Zonal inició la coactiva, y —mientras no lo haya
 *   hecho— dar de baja la coactiva a petición del administrado.
 *
 *   ── LO QUE ESTA PANTALLA TIENE QUE DEJAR CLARO ───────────────────────────────────────────────
 *   Que la coactiva **no la ejecuta este módulo**: la llevan las Zonales y pueden tardar hasta un
 *   año. Aquí solo se anota lo que ellas informan.
 *
 *   Y que marcar el inicio **no se deshace**: cierra el derecho del administrado a volver, que la
 *   ordenanza le reconoce «hasta antes del inicio». Un funcionario que lo marque por adelantado
 *   —«total, ya va a empezar»— le quita un derecho sin querer.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-20
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
import {
  CoactivaService,
  EFECTO_BAJA,
  type DestinoBaja,
  type EstadoCoactiva,
} from "../../services/CoactivaService";
import type { MiEpasAsignado } from "../../services/SorteoService";

interface Props {
  caso: MiEpasAsignado;
  onClose: () => void;
  onCambiado?: () => void;
}

const fecha = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("es-EC") : "—";

const CoactivaModal = ({ caso, onClose, onCambiado }: Props) => {
  const { addToast } = useToast();
  const [estado, setEstado] = useState<EstadoCoactiva | null>(null);
  const [cargando, setCargando] = useState(true);
  const [destino, setDestino] = useState<DestinoBaja | null>(null);
  const [oficio, setOficio] = useState<File | null>(null);
  const [confirmando, setConfirmando] = useState<"baja" | "inicio" | null>(
    null,
  );
  const [enviando, setEnviando] = useState(false);
  /** Fallo al CARGAR el estado: se dice en línea, en su hueco (regla 3b de 261028-kmg). */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const datos = await CoactivaService.estado(caso.eejeId ?? 0);
        if (vivo) setEstado(datos);
      } catch (err) {
        if (vivo)
          setErrorCarga(
            mensajeParaUsuario(err, "No se pudo leer el estado de la coactiva."),
          );
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [caso.eejeId]);

  const yaTuvoTc = !!estado?.tcYaAutorizadoAt;
  const puedeDarDeBaja =
    !!estado && !estado.iniciada && !!destino && !!oficio && !enviando;

  const ejecutar = async () => {
    if (caso.eejeId == null) return;
    setEnviando(true);
    try {
      if (confirmando === "inicio") {
        const nuevo = await CoactivaService.marcarIniciada(caso.eejeId);
        setEstado(nuevo);
        addToast(
          "success",
          "Registrado: la Administración Zonal inició la coactiva.",
        );
      } else if (destino && oficio) {
        const r = await CoactivaService.registrarBaja(
          caso.eejeId,
          destino,
          oficio,
        );
        addToast("success", `Baja registrada: ${EFECTO_BAJA[r.destino]}.`);
        onClose();
      }
      onCambiado?.();
      setConfirmando(null);
    } catch (err) {
      // El mensaje del backend se muestra TAL CUAL: es el que dice desde cuándo está iniciada o en
      // qué fecha se autorizó el trabajo comunitario, y esas fechas son lo que el funcionario
      // necesita para explicárselo al administrado que tiene delante.
      addToast("error", mensajeParaUsuario(err, "No se pudo completar."));
      setConfirmando(null);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <DialogoModal
        className="modal modal-open"
        onCerrar={onClose}
        hayCambios={destino !== null || oficio !== null}
        ocupado={enviando}
      >
        <div className="modal-box max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">Coactiva</h3>
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
              <Alert
                variant="info"
                message="La coactiva la ejecutan las Administraciones Zonales, no este módulo: pueden tardar hasta un año en iniciarla. Aquí solo se registra lo que ellas informan."
              />

              {estado.iniciada ? (
                <Alert
                  variant="warning"
                  message={`La Zonal inició la coactiva el ${fecha(estado.iniciadaAt)}. A partir de ese momento el administrado ya no puede pedir la baja ni acogerse al trabajo comunitario.`}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-2 rounded-lg border border-base-300 p-3">
                    <span className="font-medium">
                      Baja a petición del administrado
                    </span>
                    <span className="text-sm opacity-70">
                      Mientras la Zonal no la inicie, puede ingresar un oficio y
                      volver.
                    </span>

                    <label className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="destino"
                        className="radio radio-sm mt-1"
                        checked={destino === "PAGO"}
                        disabled={enviando}
                        onChange={() => setDestino("PAGO")}
                      />
                      <span>
                        <span className="font-medium">Quiere pagar</span>
                        <span className="block text-sm opacity-70">
                          {EFECTO_BAJA.PAGO}.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="destino"
                        className="radio radio-sm mt-1"
                        checked={destino === "TRABAJO_COMUNITARIO"}
                        disabled={enviando || yaTuvoTc}
                        onChange={() => setDestino("TRABAJO_COMUNITARIO")}
                      />
                      <span>
                        <span className="font-medium">
                          Pide trabajo comunitario
                        </span>
                        {/* No se oculta: se deshabilita CON su motivo. Ocultarlo dejaría al
                            funcionario preguntándose si la opción existe. */}
                        <span className="block text-sm opacity-70">
                          {yaTuvoTc
                            ? `No disponible: ya se le autorizó el ${fecha(estado.tcYaAutorizadoAt)} y no lo cumplió. Una sola oportunidad por expediente.`
                            : `${EFECTO_BAJA.TRABAJO_COMUNITARIO}.`}
                        </span>
                      </span>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-sm">
                        Oficio del administrado (PDF, obligatorio)
                      </span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="file-input file-input-bordered file-input-sm w-full"
                        disabled={enviando}
                        onChange={(e) => setOficio(e.target.files?.[0] ?? null)}
                      />
                    </label>

                    <Boton
                      estilos="btn btn-sm btn-primary self-start"
                      texto="Registrar la baja"
                      deshabilitado={!puedeDarDeBaja}
                      onClick={() => setConfirmando("baja")}
                    />
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border border-warning/40 p-3">
                    <span className="font-medium">
                      La Zonal ya inició la coactiva
                    </span>
                    <span className="text-sm opacity-70">
                      Márquelo <strong>solo cuando la Zonal lo informe</strong>.
                      No se deshace, y cierra el derecho del administrado a
                      volver.
                    </span>
                    <Boton
                      estilos="btn btn-sm btn-outline btn-warning self-start"
                      texto="Marcar como iniciada"
                      deshabilitado={enviando}
                      onClick={() => setConfirmando("inicio")}
                    />
                  </div>
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
          </div>
        </div>
      </DialogoModal>

      {confirmando && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setConfirmando(null)}
          ocupado={enviando}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle={
              confirmando === "inicio"
                ? "Registrar que la Zonal inició la coactiva"
                : "Registrar la baja de la coactiva"
            }
            statusCopy="Revise antes de confirmar"
            descriptionCopy={
              confirmando === "inicio"
                ? "🔴 Esto NO se deshace: a partir de aquí el administrado ya no puede pedir la baja ni acogerse al trabajo comunitario. Márquelo solo cuando la Zonal lo haya informado."
                : `Al registrar, ${destino ? EFECTO_BAJA[destino] : ""}.`
            }
            informationData={
              confirmando === "inicio"
                ? {
                    Expediente: caso.expNumber ?? `EPAS ${caso.eejeId ?? ""}`,
                    Efecto: "Se cierra el derecho a volver",
                  }
                : {
                    Expediente: caso.expNumber ?? `EPAS ${caso.eejeId ?? ""}`,
                    Pide: destino === "PAGO" ? "Pagar" : "Trabajo comunitario",
                    Oficio: oficio?.name ?? "—",
                  }
            }
            confirmButtonText="Confirmar"
            confirmButtonLoadingText="Registrando…"
            onConfirm={ejecutar}
            onClose={() => setConfirmando(null)}
          />
        </DialogoModal>
      )}
    </>
  );
};

export default CoactivaModal;
