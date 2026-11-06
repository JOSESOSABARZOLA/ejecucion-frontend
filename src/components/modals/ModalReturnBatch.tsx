/**
 * Microservicio: ejecucion
 * Módulo: Recepción (DME)
 * Feature: Modal de devolución por lote de EPAS a la DMR
 * Archivo: ModalReturnBatch.tsx
 * Responsabilidad: Seleccionar varios EPAS en RECIBIDO, capturar la cantidad esperada y las
 *   observaciones, y devolver el lote a la DMR (returnBatch, RECE-02). La reconciliación
 *   cantidad esperada vs. recibida la decide el backend; la UI muestra su mensaje.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-08
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo de carga se dice en el hueco
 *   de la lista; la selección y la cantidad que faltan, bajo su campo; el fallo al devolver, en el
 *   aviso flotante)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useEffect, useId, useRef, useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import Alert from "../common/Alert";
import Loading from "../common/Loading";
import EmptyState from "../common/EmptyState";
import { useToast } from "../../hooks/useToast";
import { EpasService, type EpasListItem } from "../../services/EpasService";

export const MODAL_KEY = "returnBatchDmr" as const;

interface ModalReturnBatchProps {
  onClose: () => void;
  refetchFn?: () => Promise<void>;
}

const ModalReturnBatch: React.FC<ModalReturnBatchProps> = ({
  onClose,
  refetchFn,
}) => {
  const { addToast } = useToast();

  const [epas, setEpas] = useState<EpasListItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cantidadEsperada, setCantidadEsperada] = useState<string>("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  /** Fallo al CARGAR los EPAS: se dice en el hueco de la lista (regla 3b de 261028-kmg). */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  // Errores de CAMPO: bajo la lista y bajo la cantidad; se retiran al editar.
  const [errorSeleccion, setErrorSeleccion] = useState<string | null>(null);
  const [errorCantidad, setErrorCantidad] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);
  const idBase = useId();
  const idErrorSeleccion = `${idBase}-error-seleccion`;
  const idErrorCantidad = `${idBase}-error-cantidad`;

  // EPAS candidatos a devolución: los que están en RECIBIDO.
  useEffect(() => {
    let active = true;
    EpasService.getEpas(0, 100, { estado: "RECIBIDO" })
      .then((res) => active && setEpas(res.data))
      .catch(
        (error) =>
          active &&
          setErrorCarga(
            mensajeParaUsuario(error, "No se pudieron cargar los EPAS"),
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const toggle = (eejeId: number) => {
    setErrorSeleccion(null);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(eejeId) ? next.delete(eejeId) : next.add(eejeId);
      return next;
    });
  };

  const recibida = selected.size;

  // Cierre al pulsar fuera (quick 261019-mcf): lo marcado o escrito es trabajo sin guardar.
  useCierreModal({
    hayCambios:
      selected.size > 0 ||
      cantidadEsperada.trim() !== "" ||
      observaciones.trim() !== "",
    ocupado: isSaving,
  });

  const handleConfirm = async () => {
    const esperada = Number(cantidadEsperada);
    const faltaSeleccion = recibida === 0;
    const cantidadInvalida =
      cantidadEsperada === "" || Number.isNaN(esperada) || esperada < 0;
    setErrorSeleccion(faltaSeleccion ? "Selecciona al menos un EPAS" : null);
    setErrorCantidad(
      cantidadInvalida ? "Ingresa una cantidad esperada válida" : null,
    );
    if (faltaSeleccion) {
      listaRef.current?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    if (cantidadInvalida) {
      cantidadRef.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      await EpasService.returnBatch(
        [...selected],
        esperada,
        observaciones.trim() || undefined,
      );
      addToast("success", "Lote devuelto a la DMR");
      if (refetchFn) await refetchFn();
      onClose();
    } catch (error) {
      // El backend rechaza si la cantidad esperada coincide con la recibida (RECE-02).
      addToast(
        "error",
        mensajeParaUsuario(error, "No se pudo devolver el lote a la DMR"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-box w-fit max-w-2xl relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="app-modules-modal-kicker">Recepción de EPAS</p>
              <h2 className="app-modules-modal-title">
                Devolver lote a la DMR
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
            {/* Mientras la carga falla no se afirma el vacío: el fallo va en el hueco de la lista. */}
            {errorCarga ? (
              <Alert variant="error" message={errorCarga} />
            ) : epas.length === 0 && !loading ? (
              <EmptyState text="No hay EPAS en estado RECIBIDO" />
            ) : (
              <div
                ref={listaRef}
                role="group"
                aria-label="EPAS a devolver"
                aria-invalid={errorSeleccion ? true : undefined}
                aria-describedby={errorSeleccion ? idErrorSeleccion : undefined}
                className="max-h-64 overflow-y-auto rounded-xl border border-base-300"
              >
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Expediente</th>
                      <th>Administrado</th>
                      <th>CI/RUC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {epas.map((row) => (
                      <tr key={row.eejeId}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={selected.has(row.eejeId)}
                            onChange={() => toggle(row.eejeId)}
                            disabled={isSaving}
                          />
                        </td>
                        <td>{row.expNumber ?? `#${row.eejeId}`}</td>
                        <td>
                          {[row.admiName, row.admiLastname]
                            .filter(Boolean)
                            .join(" ")}
                        </td>
                        <td>{row.admiIdentification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {errorSeleccion && (
              <span id={idErrorSeleccion} className="text-sm text-error">
                {errorSeleccion}
              </span>
            )}

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-base-content/70">
                  Cantidad recibida
                </span>
                <span className="text-2xl font-semibold">{recibida}</span>
              </div>
              <label className="floating-label">
                <span>Cantidad esperada</span>
                <input
                  ref={cantidadRef}
                  type="number"
                  min={0}
                  className={`input input-bordered w-40${errorCantidad ? " input-error" : ""}`}
                  value={cantidadEsperada}
                  onChange={(e) => {
                    setCantidadEsperada(e.target.value);
                    setErrorCantidad(null);
                  }}
                  placeholder="Cantidad esperada"
                  disabled={isSaving}
                  aria-invalid={errorCantidad ? true : undefined}
                  aria-describedby={errorCantidad ? idErrorCantidad : undefined}
                />
              </label>
            </div>
            {errorCantidad && (
              <span id={idErrorCantidad} className="text-sm text-error">
                {errorCantidad}
              </span>
            )}

            <label className="floating-label">
              <span>Observaciones (informe de devolución)</span>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Motivo de la devolución del lote"
                disabled={isSaving}
              />
            </label>
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
            <button
              type="button"
              onClick={handleConfirm}
              className="app-modules-modal-submit btn"
              disabled={isSaving}
            >
              {isSaving ? "Devolviendo..." : "Devolver lote"}
            </button>
          </div>
        </div>
      </div>
      {(isSaving || loading) && <Loading />}
    </div>
  );
};

export default ModalReturnBatch;
