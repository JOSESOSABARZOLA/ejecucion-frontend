/**
 * Microservicio: ejecucion
 * Módulo: avisos (frontend)
 * Feature: Bandeja de avisos del usuario
 * Archivo: AvisosPage.tsx
 * Responsabilidad: Listar, paginados, los avisos del usuario. Un fallo al cargar la lista se dice
 *   en su hueco y no se repite en un aviso flotante (regla de mensajes, quick 261028-kmg).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-28
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-m29: el listado ya no inventa avisos
 *   cuando el servidor falla — el error se dice en su hueco —, y cada aviso que lleva a una ruta
 *   interna ofrece «Ir», con el mismo flujo que la campana: marcar leído y navegar)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useEffect, useState, useCallback } from "react";
import CollapseAlert from "../components/collapse/CollapseAlert";
import Pagination from "../components/common/Pagination";
import { AlertService } from "../services/AlertService";
import type { IAlert } from "../interfaces/IAlert";
import EmptyState from "../components/common/EmptyState";
import Alert from "../components/common/Alert";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import { useNavigate } from "react-router-dom";
import { useAlerts } from "../hooks/useAlerts";
import { abrirAlerta, destinoDeAlerta } from "../utils/destinoAlerta";

const AvisosPage = () => {
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const navigate = useNavigate();
  // El panel de la campana enseña solo las no leídas: la que se abre aquí sale también de allí.
  const { removeAlert } = useAlerts();

  /** «Ir»: marca el aviso leído (aquí, en la campana y en el servidor) y navega a su ruta. */
  const irAlDestino = (alerta: IAlert) =>
    abrirAlerta(alerta, {
      marcarLeidaEnVista: (ualeId) => {
        setAlerts((previas) =>
          previas.map((a) =>
            a.ualeId === ualeId
              ? { ...a, ualeRead: true, ualeReadAt: new Date() }
              : a,
          ),
        );
        removeAlert(ualeId);
      },
      marcarLeidaEnServidor: AlertService.markAsRead,
      navegar: navigate,
    });

  // Fetch alerts with pagination
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await AlertService.getAllAlerts(pageIndex, pageSize);
      setAlerts(response.data);
      setTotal(response.total);
      setPages(response.pages);
    } catch (err) {
      const errorMessage =
        mensajeParaUsuario(err, "Error al cargar los avisos");
      // El fallo de CARGA se dice solo en el hueco de la lista (regla 3b de 261028-kmg).
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [pageIndex, pageSize]);

  // Fetch on mount and when pagination changes
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Handle page change
  const handlePageChange = (newPageIndex: number) => {
    setPageIndex(newPageIndex);
  };

  // Handle page size change (reset to first page)
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPageIndex(0);
  };

  return (
    <div className="app-data-container ">
      {/* Header */}
      {/* Header */}
      <HeaderPage
        headerKicker="Alertas de Gestión"
        title="Alertas de Gestión"
        subtitle="Revisa las alertas generadas por el sistema"
        options={[]}
        onOptionClick={undefined}
      />

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="app-section-heading text-sm font-semibold uppercase tracking-[0.18em] text-primary/95">
            Avisos
          </h2>
        </div>
        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          {/* Error State */}
          {error && !loading && (
            <Alert
              variant="error"
              message={error}
              buttonFunction={fetchAlerts}
            />
          )}

          {/* Empty State */}
          {!loading && alerts.length === 0 && !error && (
            <EmptyState text="No hay avisos disponibles en este momento" />
          )}

          {/* Alerts List */}
          {!loading && alerts.length > 0 && (
            <>
              <div className="app-data-list app-avisos-list mb-6">
                {alerts.map((alert, index) => (
                  <CollapseAlert
                    key={`${alert.ualeId}-${pageIndex}-${pageSize}`}
                    alert={alert}
                    index={pageIndex * pageSize + index}
                    accion={
                      destinoDeAlerta(alert) ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          aria-label={`Ir a lo que indica el aviso: ${alert.aresTitle}`}
                          onClick={() => void irAlDestino(alert)}
                        >
                          Ir
                        </button>
                      ) : undefined
                    }
                  />
                ))}
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <Pagination
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  totalPages={pages}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  disabled={loading}
                  totalRecords={total}
                />
              )}
            </>
          )}
        </div>
      </section>

      {loading && <Loading />}
    </div>
  );
};

export default AvisosPage;
