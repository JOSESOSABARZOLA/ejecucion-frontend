/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Modal "Ver resultados de sorteos" — RECE-05 / FEND-03
 * Archivo: ModalResultadosSorteos.tsx
 * Responsabilidad: Lista TODOS los lotes de sorteo enviados (GET /sorteo/lotes: master + estado +
 *   decisores/casos) y por cada uno ofrece "Ver acta" del acta D2 (actaDeLote por par amas_id/decisor),
 *   que se abre en el ModalDocumentViewer (visor PDF). Degrada con gracia (vacío / acta no disponible).
 *   Se abre desde el botón "Ver resultados de sorteos" de la Bandeja de Entrada (openModal).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-28
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import React, { useEffect, useState } from "react";
import Alert from "../common/Alert";
import Loading from "../common/Loading";
import EmptyState from "../common/EmptyState";
import { useModal } from "../../hooks/useModal";
import { useToast } from "../../hooks/useToast";
import { SorteoService, type SorteoLote } from "../../services/SorteoService";

export const MODAL_KEY = "resultadosSorteos" as const;

interface ModalResultadosSorteosProps {
  onClose: () => void;
}

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Esperando aprobación",
  PARCIALMENTE_FIRMADO: "Firmado parcialmente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

/**
 * Agrupa la lista PLANA de sublotes (una fila por par amas_id/decisor, Camino Y) por MASTER (amas_id):
 * un solo LOTE de sorteo despliega TODAS sus actas (una por decisor). Preserva el orden de aparición del
 * primer sublote de cada master. Devuelve pares [amasId, sublotes] para iterar en el render.
 */
/** Casos realmente sorteados del sublote (activos); cae al total si el backend no lo trae. */
function casosSorteados(lote: SorteoLote): number {
  return lote.casosActivos ?? lote.totalCasos ?? lote.casos?.length ?? 0;
}

/** Total de casos del sublote (incluye excusados). */
function casosTotales(lote: SorteoLote): number {
  return lote.totalCasos ?? lote.casos?.length ?? 0;
}

function agruparPorMaster(lotes: SorteoLote[]): Array<[number, SorteoLote[]]> {
  const grupos = new Map<number, SorteoLote[]>();
  for (const lote of lotes) {
    const actual = grupos.get(lote.amasId);
    if (actual) actual.push(lote);
    else grupos.set(lote.amasId, [lote]);
  }
  return [...grupos.entries()];
}

const ModalResultadosSorteos: React.FC<ModalResultadosSorteosProps> = ({
  onClose,
}) => {
  const { openModal } = useModal();
  const { addToast } = useToast();
  const [lotes, setLotes] = useState<SorteoLote[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    SorteoService.lotes()
      .then((data) => {
        if (vivo) setLotes(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (vivo)
          setError(
            mensajeParaUsuario(err, "No se pudieron cargar los sorteos. Intente más tarde."),
          );
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Abre el acta D2 del sorteo (por par amas_id/decisor) en el visor PDF. Degrada si no está disponible.
  const handleVerActa = async (lote: SorteoLote) => {
    if (lote.decisorUserId == null) {
      addToast(
        "warning",
        "Este sorteo no tiene un decisor resuelto; no se puede abrir el acta.",
      );
      return;
    }
    try {
      const acta = await SorteoService.actaDeLote(
        lote.amasId,
        lote.decisorUserId,
      );
      openModal("documentViewer", {
        docName: acta.docName ?? "Acta de Sorteo (D2)",
        docUrl: acta.docUrl,
      });
    } catch {
      addToast(
        "info",
        "El acta de este sorteo todavía no está disponible. Intente en unos momentos.",
      );
    }
  };

  return (
    <div className="modal-box max-w-4xl w-11/12 relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">Ejecución — DME</p>
            <h2 className="app-modules-modal-title">Resultados de sorteos</h2>
          </div>
          <div className="app-modules-modal-meta">
            <button
              type="button"
              className="app-modules-modal-close"
              onClick={onClose}
              aria-label="Cerrar modal de resultados de sorteos"
            >
              ×
            </button>
          </div>
        </div>

        <div className="app-modules-modal-body">
          <div className="app-modules-modal-content flex flex-col gap-2">
            {cargando && <Loading />}
            {!cargando && error && <Alert variant="error" message={error} />}
            {!cargando && !error && lotes.length === 0 && (
              <EmptyState text="Aún no hay sorteos enviados." />
            )}
            {!cargando &&
              !error &&
              agruparPorMaster(lotes).map(([amasId, sublotes]) => (
                <details
                  key={amasId}
                  className="app-collapse-alert overflow-hidden rounded-xl border border-base-300 bg-base-100"
                >
                  {/* Encabezado ABATIBLE del LOTE (master): un solo sorteo; se despliega para ver sus actas. */}
                  <summary className="flex cursor-pointer select-none items-center justify-between gap-3 border-b border-base-300 px-4 py-3">
                    <span className="text-sm font-semibold">
                      Sorteo #{amasId}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="badge badge-sm badge-primary badge-outline whitespace-nowrap">
                        {sublotes.length} decisor(es) ·{" "}
                        {sublotes.reduce((n, l) => n + casosSorteados(l), 0)}{" "}
                        sorteado(s)
                      </span>
                      <span className="app-collapse-alert-chevron">
                        <svg
                          className="app-collapse-alert-chevron-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </span>
                    </span>
                  </summary>

                  {/* Una fila por decisor: su acta de sorteo de ESTE lote. */}
                  <div className="flex flex-col divide-y divide-base-200">
                    {sublotes.map((lote) => (
                      <div
                        key={`${lote.amasId}-${lote.decisorUserId ?? "?"}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {lote.decisorName ??
                              (lote.decisorUserId != null
                                ? `Decisor #${lote.decisorUserId}`
                                : "Sin decisor resuelto")}
                          </span>
                          <span className="text-xs text-base-content/70">
                            {ESTADO_LABEL[String(lote.estado)] ??
                              lote.sdetName ??
                              String(lote.estado)}{" "}
                            ·{" "}
                            {casosSorteados(lote) === casosTotales(lote)
                              ? `${casosTotales(lote)} expediente(s)`
                              : `${casosSorteados(lote)} de ${casosTotales(
                                  lote,
                                )} · ${
                                  casosTotales(lote) - casosSorteados(lote)
                                } excusado(s)`}
                          </span>
                        </div>
                        {lote.decisorUserId != null &&
                        lote.actaDisponible !== false ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline btn-primary"
                            onClick={() => void handleVerActa(lote)}
                          >
                            Ver acta
                          </button>
                        ) : (
                          <span className="text-xs italic text-base-content/50">
                            Acta no disponible
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalResultadosSorteos;
