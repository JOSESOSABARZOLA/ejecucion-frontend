/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: La notificación al administrado (Fase 03.14.3)
 * Archivo: NotificacionesExpediente.tsx
 * Responsabilidad: Ver por dónde va cada notificación del expediente y REGISTRAR qué pasó con cada
 *   despacho.
 *
 *   ── ESTO NO ENVÍA NADA ───────────────────────────────────────────────────────────────────────
 *   El envío ocurre fuera (el servidor SMTP es otro módulo). Esta pantalla es el ACTA: alguien
 *   intentó notificar por un canal y aquí consta cómo terminó. Por eso el botón dice «Registrar» y
 *   no «Enviar»: prometer un envío que el sistema no hace sería mentir sobre el expediente.
 *
 *   ── LO QUE HAY QUE LEER DE UN VISTAZO ────────────────────────────────────────────────────────
 *   Si la notificación está PERFECCIONADA (alguien la recibió) o no, porque de ahí arrancan los
 *   plazos. Y si se AGOTARON los intentos sin que nadie la recibiera: el proceso sigue igual —no
 *   poder notificar no lo detiene— pero eso no es lo mismo que haber notificado, y la pantalla no
 *   puede dejar que se confundan.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-20
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../hooks/useToast";
import {
  ETIQUETA_FORMA,
  NotificacionEjecucionService,
  type Despacho,
  type EstadoDespacho,
  type Notificacion,
} from "../../services/NotificacionEjecucionService";
import { DatetimeUtil } from "../../utils/datetime.util";

interface Props {
  eejeId: number;
  /**
   * Deja registrar resultados. El DIRECTOR ve pero no registra: el backend solo admite al decisor y
   * al secretario, y ofrecer un botón que va a devolver 403 es peor que no ofrecerlo.
   */
  permiteRegistrar?: boolean;
}

/** Cómo se pinta cada estado de despacho. */
const BADGE: Record<EstadoDespacho, string> = {
  pendiente: "badge-warning",
  notificado: "badge-success",
  rechazado: "badge-error",
};

const ETIQUETA_ESTADO: Record<EstadoDespacho, string> = {
  pendiente: "Pendiente",
  notificado: "Notificado",
  rechazado: "No se pudo",
};

/** Una notificación está CERRADA cuando se recibió o cuando ya no queda intento por resolver. */
const estaCerrada = (n: Notificacion): boolean =>
  !!n.perfeccionadaAt ||
  (n.despachos.length > 0 &&
    n.despachos.every((d) => d.estado !== "pendiente"));

export const NotificacionesExpediente = ({
  eejeId,
  permiteRegistrar = false,
}: Props) => {
  const { addToast } = useToast();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Despacho cuyo formulario de registro está abierto. */
  const [registrando, setRegistrando] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [observacion, setObservacion] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setNotificaciones(
        await NotificacionEjecucionService.porExpediente(eejeId),
      );
    } catch (err) {
      setError(
        mensajeParaUsuario(err, "No se pudieron cargar las notificaciones."),
      );
    } finally {
      setCargando(false);
    }
  }, [eejeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resolver = async (
    desp: Despacho,
    estado: "notificado" | "rechazado",
  ) => {
    setOcupado(true);
    try {
      const { razonDocId } =
        await NotificacionEjecucionService.resolverDespacho(
          desp.despId,
          estado,
          { observacion: observacion.trim() || undefined },
        );
      addToast(
        estado === "notificado" ? "success" : "info",
        estado === "notificado"
          ? `Notificado por ${ETIQUETA_FORMA[desp.forma].toLowerCase()}.` +
              (razonDocId ? " Se generó la razón de notificación." : "")
          : `Registrado: no se pudo notificar por ${ETIQUETA_FORMA[
              desp.forma
            ].toLowerCase()}.` +
              (razonDocId ? " Se generó la razón que lo prueba." : ""),
      );
      setRegistrando(null);
      setObservacion("");
      await cargar();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo registrar."),
      );
    } finally {
      setOcupado(false);
    }
  };

  const abrirDespachos = async (notiId: number) => {
    setOcupado(true);
    try {
      const abiertos =
        await NotificacionEjecucionService.abrirDespachos(notiId);
      addToast(
        abiertos > 0 ? "success" : "warning",
        abiertos > 0
          ? `Se abrieron ${abiertos} despacho(s): ya se puede notificar.`
          : "El administrado sigue sin formas de notificación declaradas: decláreselas primero.",
      );
      await cargar();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudieron abrir."),
      );
    } finally {
      setOcupado(false);
    }
  };

  if (cargando) {
    return (
      <span className="text-xs text-base-content/70">
        Cargando notificaciones…
      </span>
    );
  }
  if (error) {
    return <span className="text-xs text-error">{error}</span>;
  }
  if (notificaciones.length === 0) {
    return (
      <span className="text-xs text-base-content/70">
        Todavía no se ha emitido ninguna providencia que notificar.
      </span>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {notificaciones.map((noti) => {
        const cerrada = estaCerrada(noti);
        const agotada = cerrada && !noti.perfeccionadaAt;

        return (
          <li
            key={noti.notiId}
            className="rounded-lg border border-base-300 p-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{noti.docName}</span>

              {noti.perfeccionadaAt ? (
                <span className="badge badge-success badge-sm">
                  Notificada el {DatetimeUtil.formatDate(noti.perfeccionadaAt)}
                </span>
              ) : agotada ? (
                <span className="badge badge-error badge-sm">
                  Sin poder notificar
                </span>
              ) : (
                <span className="badge badge-warning badge-sm">
                  Sin notificar
                </span>
              )}
            </div>

            {/* La consecuencia, dicha en la pantalla y no solo en el código: de la fecha de
                perfeccionamiento arrancan los plazos, y agotar los intentos NO detiene el proceso. */}
            {agotada && (
              <p className="mt-1 text-xs text-base-content/70">
                Se agotaron todos los medios aceptados. El proceso continúa: no
                haber podido notificar no lo detiene.
              </p>
            )}

            {noti.despachos.length === 0 ? (
              <div className="mt-2 flex flex-col gap-1">
                <span className="text-xs text-warning">
                  Se emitió cuando el administrado no tenía ninguna forma de
                  notificación declarada, así que no salió por ningún canal.
                </span>
                {permiteRegistrar && (
                  <button
                    type="button"
                    className="btn btn-xs btn-outline self-start"
                    disabled={ocupado}
                    onClick={() => void abrirDespachos(noti.notiId)}
                  >
                    Notificar ahora
                  </button>
                )}
              </div>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {noti.despachos.map((desp) => (
                  <li key={desp.despId} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`badge badge-sm ${BADGE[desp.estado]}`}>
                        {ETIQUETA_ESTADO[desp.estado]}
                      </span>
                      <span>{ETIQUETA_FORMA[desp.forma]}</span>
                      {desp.correo && (
                        <span className="text-base-content/70">
                          {desp.correo}
                        </span>
                      )}
                      {desp.resueltoAt && (
                        <span className="text-base-content/70">
                          {DatetimeUtil.formatDate(desp.resueltoAt)}
                        </span>
                      )}
                      {permiteRegistrar && desp.estado === "pendiente" && (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          disabled={ocupado}
                          onClick={() =>
                            setRegistrando(
                              registrando === desp.despId ? null : desp.despId,
                            )
                          }
                        >
                          Registrar resultado
                        </button>
                      )}
                    </div>

                    {desp.observacion && (
                      <span className="text-xs text-base-content/70">
                        {desp.observacion}
                      </span>
                    )}

                    {registrando === desp.despId && (
                      <div className="flex flex-col gap-1 rounded-md bg-base-200 p-2">
                        <input
                          type="text"
                          className="input input-bordered input-xs w-full"
                          placeholder="Observación (opcional): qué ocurrió"
                          value={observacion}
                          disabled={ocupado}
                          onChange={(e) => setObservacion(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-xs btn-success"
                            disabled={ocupado}
                            onClick={() => void resolver(desp, "notificado")}
                          >
                            La recibió
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-error btn-outline"
                            disabled={ocupado}
                            onClick={() => void resolver(desp, "rechazado")}
                          >
                            No se pudo entregar
                          </button>
                        </div>
                        <span className="text-[11px] text-base-content/70">
                          Se registra con la fecha de hoy y genera la razón de
                          notificación que lo prueba.
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default NotificacionesExpediente;
