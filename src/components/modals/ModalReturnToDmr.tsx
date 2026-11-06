/**
 * Microservicio: ejecucion
 * Módulo: Recepción (DME)
 * Feature: Modal de devolución de un EPAS a la DMR (un CASO o el EXPEDIENTE COMPLETO)
 * Archivo: ModalReturnToDmr.tsx
 * Responsabilidad: Consultar el estado de notificación on-demand (RECE-03) para informar la
 *   decisión, ENSEÑAR las observaciones ya anotadas y devolver a la DMR (returnToDmr).
 *
 *   🔴 YA NO PIDE UN MOTIVO EN TEXTO LIBRE (2026-09-18). Hasta ese día este modal tenía un
 *   `<textarea>` y lo que se escribiera ahí era todo lo que la DMR recibía: una frase que no decía
 *   dónde estaba el defecto. Ahora el motivo se anota en la FICHA del expediente, campo por campo y
 *   documento por documento, y aquí solo se lee. El botón de confirmar se apaga mientras no haya
 *   ninguna observación, y lo dice: devolver sin explicar qué corregir es la práctica que este
 *   cambio existe para terminar.
 *
 *   Sirve a los DOS niveles de la bandeja con el MISMO diálogo, porque el acto es el mismo: sin
 *   `expedienteScope` devuelve UN CASO; con él, devuelve el EXPEDIENTE COMPLETO — y ahí el backend
 *   devuelve los casos MARCADOS y omite los que no tengan observaciones, porque las observaciones
 *   son de cada administrado. El estado de notificación se consulta con un caso representativo: es
 *   del EXPEDIENTE (exp_core_id vive en t_expediente), así que es el mismo para todos sus casos.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-08
 * Modificado: 2026-09-18 — el motivo libre lo sustituyen las observaciones estructuradas.
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al devolver se dice en el
 *   aviso flotante, ya no en una caja del modal)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useEffect, useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import Loading from "../common/Loading";
import { useToast } from "../../hooks/useToast";
import {
  EpasService,
  type EpasListItem,
  type NotificacionEstado,
} from "../../services/EpasService";
import { ObservacionesService } from "../../services/ObservacionesService";
import type { IObservacion } from "../../interfaces/ICaseObservations";

export const MODAL_KEY = "DEVOLVER_DMR" as const;

/**
 * Alcance EXPEDIENTE COMPLETO de la devolución (triage del DIRECTOR, RECE-08). Cuando viene, el modal
 * devuelve todos los casos elegibles del expediente en una sola llamada, con un único motivo.
 */
export interface ExpedienteScope {
  expId: number;
  expNumber?: string;
  /** Cuántos casos del expediente se devolverán (los elegibles, calculados por la bandeja). */
  casosElegibles: number;
}

interface ModalReturnToDmrProps {
  /** El caso a devolver; con `expedienteScope`, además, es el representante de su expediente. */
  caseData: EpasListItem & { expedienteScope?: ExpedienteScope };
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

const ModalReturnToDmr: React.FC<ModalReturnToDmrProps> = ({
  caseData,
  onClose,
  refetchFn,
}) => {
  const { addToast } = useToast();
  const { eejeId, expNumber, expedienteScope } = caseData;

  const [notif, setNotif] = useState<NotificacionEstado | null>(null);
  const [notifLoading, setNotifLoading] = useState(true);
  const [observaciones, setObservaciones] = useState<IObservacion[]>([]);
  const [observacionesLoading, setObservacionesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estado de notificación on-demand (RECE-03): informa la decisión, no la bloquea. Se consulta con
  // este caso aunque el alcance sea el expediente completo: el exp_core_id vive en t_expediente, así
  // que el estado es del EXPEDIENTE y consultarlo por caso daría N veces la misma respuesta.
  useEffect(() => {
    let active = true;
    EpasService.getNotificacionEstado(eejeId)
      .then((res) => active && setNotif(res.estado))
      .catch(() => active && setNotif("desconocida"))
      .finally(() => active && setNotifLoading(false));
    return () => {
      active = false;
    };
  }, [eejeId]);

  // Lo ANOTADO en la ficha. Se lee del expediente REPRESENTANTE incluso con alcance de expediente
  // completo: es lo que hay que enseñar para que quien confirma vea por qué devuelve. El backend
  // vuelve a comprobarlas por caso al devolver —y omite los que no tengan—, así que esta lectura
  // informa la decisión, no la sustituye.
  useEffect(() => {
    let active = true;
    ObservacionesService.listar(eejeId)
      .then((lista) => active && setObservaciones(lista))
      .catch(() => active && setObservaciones([]))
      .finally(() => active && setObservacionesLoading(false));
    return () => {
      active = false;
    };
  }, [eejeId]);

  const sinObservaciones = !observacionesLoading && observaciones.length === 0;

  // Cierre al pulsar fuera (quick 261019-mcf): es una confirmación, solo se protege el envío.
  useCierreModal({ ocupado: isSaving });

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      if (expedienteScope) {
        // EXPEDIENTE COMPLETO: una sola llamada. El motivo NO viaja — lo compone el backend por
        // caso, con las observaciones de cada administrado.
        const res = await EpasService.devolverExpedienteADmr(
          expedienteScope.expId,
        );
        const n = res.devueltos ?? 0;
        addToast(
          "success",
          `${n} ${n === 1 ? "administrado" : "administrados"} del expediente ${
            expedienteScope.expNumber ?? `#${expedienteScope.expId}`
          } ${n === 1 ? "devuelto" : "devueltos"} a DMR`,
        );
      } else {
        await EpasService.returnToDmr(eejeId);
        addToast("success", "EPAS devuelto a DMR");
      }

      if (refetchFn) await refetchFn();
      onClose();
    } catch (error) {
      addToast(
        "error",
        mensajeParaUsuario(
          error,
          expedienteScope
            ? "No se pudo devolver el expediente a DMR"
            : "No se pudo devolver el EPAS a DMR",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-box w-fit max-w-lg relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="app-modules-modal-kicker">Recepción de EPAS</p>
              <h2 className="app-modules-modal-title">
                {expedienteScope
                  ? "Devolver el expediente a DMR"
                  : "Devolver a DMR"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-close shrink-0"
              aria-label="Cerrar modal"
              disabled={isSaving}
            >
              ×
            </button>
          </div>
        </div>

        <div className="app-modules-modal-body">
          <div className="app-modules-modal-content flex flex-col gap-4">
            <div className="app-modules-review-row">
              <span className="app-modules-review-row-label">Expediente</span>
              <span className="app-modules-review-row-value">
                {expedienteScope
                  ? (expedienteScope.expNumber ?? `#${expedienteScope.expId}`)
                  : (expNumber ?? `EPAS #${eejeId}`)}
              </span>
            </div>
            {/* Con alcance de expediente, lo que se devuelve son los N administrados que van dentro:
                dígalo antes de confirmar. */}
            {expedienteScope && (
              <div className="app-modules-review-row">
                <span className="app-modules-review-row-label">
                  Administrados a devolver
                </span>
                <span className="app-modules-review-row-value">
                  {expedienteScope.casosElegibles}{" "}
                  {expedienteScope.casosElegibles === 1
                    ? "administrado"
                    : "administrados"}
                </span>
              </div>
            )}
            <div className="app-modules-review-row">
              <span className="app-modules-review-row-label">
                Estado de notificación
              </span>
              <span className="app-modules-review-row-value capitalize">
                {notifLoading ? "consultando..." : notif}
              </span>
            </div>

            {/* LAS OBSERVACIONES, EN SOLO LECTURA. Aquí ya no se escribe: se lee lo que se anotó en
                la ficha, que es donde se ve el dato que está mal. */}
            <div className="flex flex-col gap-2">
              <span className="app-modules-review-row-label">
                Observaciones por corregir
              </span>

              {observacionesLoading ? (
                <p className="text-sm opacity-70">
                  Consultando las observaciones del expediente…
                </p>
              ) : sinObservaciones ? (
                <Alert
                  variant="warning"
                  message="Este expediente no tiene observaciones. Anótelas en su ficha antes de devolverlo."
                />
              ) : (
                <ul className="app-item-list border border-gray-200 rounded">
                  {observaciones.map((observacion, indice) => (
                    <li
                      key={`${observacion.tipo}-${observacion.clave}`}
                      className="app-item-list-row"
                    >
                      <span className="app-item-list-index">{indice + 1}.</span>
                      <div className="app-item-list-primary">
                        <div className="app-item-list-identifying">
                          {observacion.etiqueta}
                        </div>
                        <div className="app-item-list-complementary">
                          {observacion.texto}
                        </div>
                      </div>
                      <div className="app-item-list-secondary">
                        <span className="app-item-list-info--media">
                          {observacion.tipo}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="app-modules-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-cancel btn"
              disabled={isSaving}
            >
              Cancelar
            </button>
            {/* 🔴 SE APAGA, NO SE ESCONDE (criterio 7 de la Fase 03.18): quien abra este modal sin
                haber observado nada tiene que ver que la acción existe y leer por qué no puede
                usarla todavía. El aviso de arriba dice dónde se anota. */}
            <button
              type="button"
              onClick={handleConfirm}
              className="app-modules-modal-submit btn"
              disabled={isSaving || observacionesLoading || sinObservaciones}
            >
              {isSaving
                ? "Devolviendo..."
                : expedienteScope
                  ? "Devolver el expediente"
                  : "Devolver a DMR"}
            </button>
          </div>
        </div>
      </div>
      {isSaving && <Loading />}
    </div>
  );
};

export default ModalReturnToDmr;
