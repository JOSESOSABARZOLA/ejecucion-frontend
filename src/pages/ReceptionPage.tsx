/**
 * Microservicio: ejecucion
 * Módulo: Recepción (DME)
 * Feature: Bandeja de Recepción de EPAS (cards colapsables, estilo Resolución)
 * Archivo: ReceptionPage.tsx
 * Responsabilidad: Listar/filtrar/paginar EPAS AGRUPADOS POR EXPEDIENTE (GET /epas/agrupados) como
 *   cards colapsables: cada EXPEDIENTE con sus CASOS anidados (un caso = un administrado de ese
 *   expediente), y cada CASO con las acciones que su ROL habilita (useEpasInboxActions: el director
 *   aprueba y lo ENVÍA AL SECRETARIO —sin cambiar de estado— o lo devuelve; el secretario devuelve —
 *   individual RECE-03 / por lote RECE-02) y sus documentos (módulo de Resolución) al expandir. El
 *   sorteo NO se dispara desde aquí: es acto del secretario en su Bandeja de Sorteo (RECE-08).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-09
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: un fallo al cargar la lista se dice
 *   en su hueco y ya no se repite en un aviso flotante)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import { useModal, type ModalType } from "../hooks/useModal";
import { useToast } from "../hooks/useToast";
import {
  EpasService,
  type EpasListItem,
  type ExpedienteGrupo,
} from "../services/EpasService";
import type { UserActions } from "../interfaces/IUser";
import { isInboxActionVisible } from "../config/inboxActionStatusRules";
import { useEpasInboxActions } from "../hooks/useEpasInboxActions";
import { MODAL_KEY as RETURN_BATCH } from "../components/modals/ModalReturnBatch";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import EmptyState from "../components/common/EmptyState";
import Alert from "../components/common/Alert";
import Pagination from "../components/common/Pagination";
import CollapseExpedienteGrupo from "../components/collapse/CollapseExpedienteGrupo";
import CollapseInboxDocument from "../components/collapse/CollapseInboxDocument";
import { InboxCasesService } from "../services/InboxCasesService";
import type { IInboxCases } from "../interfaces/IInboxCases";
import FormasNotificacionModal from "../components/notificacion/FormasNotificacionModal";
import type { ModalType as ModalTypeName } from "../interfaces/IModal";

// Contexto para filtrar las actividades del usuario (acti_context).
export const CONTEXT_TABLE_ACTIONS = "table" as const;
export const CONTEXT_PAGE_ACTIONS = "page" as const;

/**
 * "Formas de notificación" (pedido del área usuaria, 2026-08-28). El nombre de la acción está en la
 * tabla de gating (`inboxActionStatusRules`), que la limita al SECRETARIO sobre RECIBIDO/VERIFICADO.
 *
 * No es un modal del registry —se monta abajo, con estado local, igual que hace la bandeja del
 * decisor con este mismo componente—, así que su `actiName` se castea al entrar en `UserActions`:
 * mismo patrón que `aprobarEpas` y `enviarSorteo`.
 */
export const FORMAS_NOTIFICACION = "formasNotificacion";

const FORMAS_NOTIFICACION_ACTION: UserActions = {
  actiId: -6,
  submId: 9,
  actiName: FORMAS_NOTIFICACION as unknown as ModalTypeName,
  actiLabel: "Formas de notificación",
  actiContext: CONTEXT_TABLE_ACTIONS,
  actiIconName: "notificacion",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: false,
};

// Estados EPAS del camino v1 para el filtro de estado.
const ESTADOS_EPAS = [
  "RECIBIDO",
  "VERIFICADO",
  "SORTEADO",
  "ASIGNADO_DECISOR",
  "EN_VERIFICACION_PAGO",
  "CUMPLIDO",
  "PENDIENTE_COACTIVA",
  "ARCHIVADO",
  "DEVUELTO_DMR",
];

// Las acciones POR EXPEDIENTE (Aprobar y enviar al secretario / Devolver a DMR) no provienen del
// backend de permisos: las inyecta useEpasInboxActions, que también decide su visibilidad por
// rol + estado (isInboxActionVisible). Ver EPAS_ROW_ACTIONS en el hook.

// Acción de devolución por lote a nivel de página (solo secretario).
const RETURN_BATCH_ACTION: UserActions = {
  actiId: -2,
  submId: 9,
  actiName: RETURN_BATCH,
  actiLabel: "Devolver lote a la DMR",
  actiContext: CONTEXT_PAGE_ACTIONS,
  actiIconName: "rechazar",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: true,
};

// Triage del MEMORANDO por el director (RECE-08): lo aprueba y lo pasa al SECRETARIO (el memorando
// queda 'en sorteo', es decir, en manos del secretario — el director no dispara el sorteo).
// No es un modal del registry sino una llamada directa (PATCH + toast), por eso se ejecuta vía
// `directActions` de CollapseInboxDocument. Su visibilidad la gobierna isInboxActionVisible
// (director + memorando RECIBIDO), igual que cualquier otra acción de la bandeja.
const ENVIAR_SORTEO_ACTION: UserActions = {
  actiId: -1,
  submId: 10,
  // "enviarSorteo" es un InboxActionName (no un modal del registry); se castea para encajar en el
  // contrato UserActions.actiName sin ampliar el union ModalType con algo que no es un modal.
  actiName: "enviarSorteo" as unknown as UserActions["actiName"],
  actiLabel: "Enviar al secretario",
  actiContext: "collapseHeader",
  actiIconName: "enviar",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: true,
};

const ReceptionPage = () => {
  const { user } = useUser();
  const { openModal } = useModal();
  const { addToast } = useToast();

  if (!user) {
    return null;
  }

  const { actividades, rolName } = user;
  // El DIRECTOR usa esta bandeja como su COLA DE TRIAGE: solo los casos que aún no remitió al
  // secretario (directorApproved:false). Aprobar NO cambia el estado (el EPAS sigue RECIBIDO), así
  // que sin este filtro un caso ya remitido seguiría apareciendo.
  const isDirector = rolName.trim().toLowerCase() === "director";

  // Expedientes con sus CASOS anidados (la bandeja se divide por expediente, no por administrado).
  const [grupos, setGrupos] = useState<ExpedienteGrupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  // OJO: total/pages cuentan EXPEDIENTES (el paginado es por expediente), no casos.
  const [total, setTotal] = useState(0);
  const [estado, setEstado] = useState("");
  const [zona, setZona] = useState("");
  const [zonaInput, setZonaInput] = useState("");

  // Triage de MEMORANDOS del director (RECE-08): complementa la lista de EPAS sin alterarla; solo se
  // activa para el rol director.
  /** Caso cuyo modal de formas de notificación está abierto. `null` = cerrado. */
  const [formasDe, setFormasDe] = useState<EpasListItem | null>(null);
  const [memos, setMemos] = useState<IInboxCases[]>([]);
  const [memosLoading, setMemosLoading] = useState(false);
  const [triagingId, setTriagingId] = useState<number | null>(null);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  // Acciones de card que SÍ vienen del backend de permisos (table context). Las acciones de
  // Ejecución sobre el EPAS (aprobar/devolver) las añade el hook.
  //
  // FORMAS_NOTIFICACION_ACTION se inyecta AQUÍ, por el parámetro `extra` de resolveActions, y NO en
  // el `EPAS_ROW_ACTIONS` del hook: esa lista la comparte la Bandeja de Entrada, que no monta este
  // modal y ofrecería un botón muerto. El gating por rol y estado lo sigue haciendo la misma tabla
  // (isInboxActionVisible), así que la acción no se cuela por inyectarse desde la página.
  const cardOptions: UserActions[] = [
    ...actividades
      .filter(
        (act: UserActions) =>
          act.actiContext === CONTEXT_TABLE_ACTIONS && act.submId === 9,
      )
      .map((act: UserActions) => ({ ...act, actiIsDisabled: false })),
    FORMAS_NOTIFICACION_ACTION,
  ];

  // Acciones de página: backend (page context) + devolución por lote (solo secretario).
  const pageOptions: UserActions[] = [
    ...actividades
      .filter(
        (act: UserActions) =>
          act.actiContext === CONTEXT_PAGE_ACTIONS && act.submId === 9,
      )
      .map((act: UserActions) => ({ ...act, actiIsDisabled: false })),
    ...(isInboxActionVisible(RETURN_BATCH_ACTION.actiName, "RECIBIDO", rolName)
      ? [RETURN_BATCH_ACTION]
      : []),
  ];

  // Consulta paginada/filtrada de EPAS reales del backend :3004, AGRUPADOS POR EXPEDIENTE: cada
  // expediente trae los casos que pasan el filtro (y todos ellos — el paginado es por expediente).
  const fetchEpas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await EpasService.getEpasAgrupados(
        pageIndex * pageSize,
        pageSize,
        { estado, zona, ...(isDirector ? { directorApproved: false } : {}) },
      );
      setGrupos(res.data);
      setTotal(res.total);
    } catch (err) {
      const msg =
        mensajeParaUsuario(err, "Error al cargar los EPAS");
      // El fallo de CARGA se dice solo en el hueco de la lista (regla 3b de 261028-kmg).
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [pageIndex, pageSize, estado, zona, isDirector]);

  useEffect(() => {
    void fetchEpas();
  }, [fetchEpas]);

  // Carga los memorandos en triage del director (solo los que su regla de acción habilita: recibido).
  const fetchMemos = useCallback(async () => {
    if (!isDirector) return;
    setMemosLoading(true);
    try {
      const data = await InboxCasesService.getInboxCases(0, 50, {});
      setMemos(
        data.filter((memo) =>
          isInboxActionVisible("enviarSorteo", memo.docStatus, rolName),
        ),
      );
    } catch {
      // La bandeja de triage es complementaria: un fallo no bloquea la lista de EPAS.
      setMemos([]);
    } finally {
      setMemosLoading(false);
    }
  }, [isDirector, rolName]);

  useEffect(() => {
    void fetchMemos();
  }, [fetchMemos]);

  // Refresca la bandeja tras una devolución/aprobación (individual o por lote).
  const refreshBandeja = useCallback(async () => {
    await fetchEpas();
  }, [fetchEpas]);

  // Acciones por expediente gateadas por rol + estado (fuente única compartida): el DIRECTOR ve
  // "Aprobar y enviar al secretario" (NO transiciona — el EPAS sigue RECIBIDO; solo queda remitido y
  // aparece en la Bandeja de Sorteo del secretario) y "Devolver a la DMR"; el SECRETARIO solo la
  // devolución. En DOS NIVELES: por CASO (resolveActions/handleAction) y por EXPEDIENTE COMPLETO
  // (resolveGrupoActions/handleGrupoAction), que es como la DMR le remite el trabajo al director.
  const {
    resolveActions,
    handleAction,
    aprobacionConfirmDialog,
    resolveGrupoActions,
    handleGrupoAction,
    expedienteConfirmDialog,
  } = useEpasInboxActions(rolName, refreshBandeja);

  // "Formas de notificación": el único acto de esta bandeja que NO pasa por el registry de modales.
  // Se intercepta ANTES de `handleAction` —que abriría un modal inexistente— y se monta abajo con
  // estado local, igual que la bandeja del decisor monta este mismo componente.
  const handleCasoAction = useCallback(
    (actiName: string, row: EpasListItem) => {
      if (actiName === FORMAS_NOTIFICACION) {
        setFormasDe(row);
        return;
      }
      handleAction(actiName, row);
    },
    [handleAction],
  );

  // Acción de página (p. ej. devolución por lote): abre su modal sin caseData.
  const handlePageAction = useCallback(
    (modalType: ModalType) => {
      openModal(
        modalType,
        {},
        {
          onError: (e: unknown) => console.error("Modal action failed:", e),
          refetchFn: refreshBandeja,
        },
      );
    },
    [openModal, refreshBandeja],
  );

  // Aprobar un memorando y pasarlo al SECRETARIO (triage del director). Refresca al terminar.
  const handleEnviarSorteo = async (memo: IInboxCases) => {
    setTriagingId(memo.docId);
    try {
      await InboxCasesService.enviarASorteo(memo.docId);
      addToast("success", `Memorando "${memo.docName}" enviado al secretario`);
      await fetchMemos();
    } catch (err) {
      const msg =
        mensajeParaUsuario(err, "No se pudo enviar el memorando al secretario");
      addToast("error", msg);
    } finally {
      setTriagingId(null);
    }
  };

  return (
    <div className="app-data-container">
      <HeaderPage
        headerKicker="Ejecución / Recepción"
        title="Bandeja de Recepción"
        subtitle={
          isDirector
            ? "Apruebe los EPAS recibidos para enviarlos al secretario, o devuélvalos a la DMR"
            : "Revisa, filtra y devuelve a la DMR los EPAS recibidos en la DME"
        }
        options={pageOptions}
        onOptionClick={handlePageAction}
      />

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="app-section-heading text-sm font-semibold uppercase tracking-[0.18em] text-primary/95">
              {isDirector
                ? "Expedientes por aprobar"
                : "Bandeja de EPAS"}
            </h2>
            {/* Cantidad de EXPEDIENTES que le llegaron al secretario (total del filtro actual).
                El paginado es por expediente, así que `total` cuenta expedientes, no casos. */}
            <span className="badge badge-primary badge-outline whitespace-nowrap">
              {total} expediente(s)
              {estado === "RECIBIDO" ? " recibidos" : ""}
            </span>
          </div>

          {/* Filtros (estado por igualdad, zonal por ILIKE). El zonal se aplica con Enter. */}
          <div className="flex  items-center gap-2">
            <select
              className="select select-bordered select-sm"
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value);
                setPageIndex(0);
              }}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_EPAS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              className="input input-bordered input-sm"
              placeholder="Filtrar por zonal (Enter)"
              value={zonaInput}
              onChange={(e) => setZonaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setZona(zonaInput.trim());
                  setPageIndex(0);
                }
              }}
            />
          </div>
        </div>

        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          {error && !loading && (
            <Alert
              variant="error"
              message={error}
            />
          )}

          {!loading && !error && grupos.length === 0 && (
            <EmptyState text="No hay EPAS disponibles en este momento" />
          )}

          {grupos.length > 0 && (
            <>
              {/* Un card por EXPEDIENTE, con sus CASOS dentro. Las acciones (aprobar y enviar al
                  secretario / Devolver a DMR) viven en DOS niveles: en la cabecera del expediente
                  (todo el expediente de una vez) y dentro, en cada caso (triage caso a caso). */}
              <div className="app-data-list mb-6">
                {grupos.map((grupo, i) => (
                  <CollapseExpedienteGrupo
                    key={grupo.expId}
                    grupo={grupo}
                    index={i}
                    casoActions={(caso) => resolveActions(caso, cardOptions)}
                    onCasoAction={handleCasoAction}
                    grupoActions={resolveGrupoActions}
                    onGrupoAction={handleGrupoAction}
                  />
                ))}
              </div>

              {pages > 1 && (
                <Pagination
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  totalPages={pages}
                  onPageChange={setPageIndex}
                  onPageSizeChange={(s) => {
                    setPageSize(s);
                    setPageIndex(0);
                  }}
                  disabled={loading}
                  totalRecords={total}
                />
              )}
            </>
          )}
        </div>
      </section>

      {/* Triage de MEMORANDOS del director (RECE-08): aprobar y enviar al secretario. */}
      {isDirector && (
        <section className="app-modules-panel app-data-panel app-shell-surface mb-6 overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
          <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="app-section-heading text-sm font-semibold uppercase tracking-[0.18em] text-primary/95">
              Memorandos por enviar
            </h2>
          </div>

          <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
            {memos.length === 0 && !memosLoading && (
              <EmptyState text="No hay memorandos recibidos pendientes de enviar al secretario" />
            )}

            {memos.length > 0 && (
              <div className="app-data-list mb-2">
                {memos.map((memo, i) => (
                  <CollapseInboxDocument
                    key={memo.docId}
                    document={memo}
                    index={i}
                    permittedActions={{
                      collapseHeader: [
                        {
                          ...ENVIAR_SORTEO_ACTION,
                          actiIsDisabled: triagingId === memo.docId,
                        },
                      ],
                      collapseBody: [],
                      collapseBodyItem: [],
                    }}
                    directActions={{ enviarSorteo: handleEnviarSorteo }}
                    refetchInboxCases={fetchMemos}
                  />
                ))}
              </div>
            )}
          </div>

          {memosLoading && <Loading />}
        </section>
      )}

      {/* Confirmación de "Aprobar y enviar al secretario" (ConfirmationDetail, reusado): por CASO y
          por EXPEDIENTE COMPLETO (esta última dice cuántos casos se remiten). */}
      {aprobacionConfirmDialog}
      {expedienteConfirmDialog}

      {formasDe && (
        <FormasNotificacionModal
          caso={{
            eejeId: formasDe.eejeId,
            expNumber: formasDe.expNumber,
            // La identidad del administrado: la razón social MANDA cuando existe (persona
            // jurídica), como en el resto de la bandeja. Si no hay ninguna, el modal cae al nombre
            // que le devuelve el backend junto con las formas.
            // `|| undefined` y no `??`: juntar dos campos vacíos da CADENA VACÍA, no null, y una
            // cadena vacía pasaría el `??` del modal y dejaría el encabezado en blanco.
            administrado:
              formasDe.admiBusinessName ||
              [formasDe.admiName, formasDe.admiLastname]
                .filter(Boolean)
                .join(" ") ||
              undefined,
          }}
          onClose={() => setFormasDe(null)}
          // NO se refresca la bandeja: declarar las formas no cambia el estado del EPAS ni ninguna
          // columna que esta lista pinte. Recargar sería trabajo y parpadeo por nada.
          onGuardado={undefined}
        />
      )}

      {loading && <Loading />}
    </div>
  );
};

export default ReceptionPage;
