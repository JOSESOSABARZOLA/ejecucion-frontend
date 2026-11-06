/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Bandeja de SORTEADOS — todo lo que el secretario sorteó, con su estado real (RECE-05)
 * Archivo: SorteadosPage.tsx
 * Responsabilidad: Cierra un hueco funcional real. El SECRETARIO dispara el sorteo, pero entre que
 *   sorteaba y el DIRECTOR resolvía, el lote le DESAPARECÍA de la vista: no sabía si seguía
 *   pendiente, si se lo aprobaron o si se lo RECHAZARON — ni por qué. Esta bandeja lista TODOS los
 *   lotes (SorteoService.lotes → GET /sorteo/lotes) con su ESTADO DERIVADO en el backend:
 *
 *     · PENDIENTE  → esperando al director. SIN acciones: no hay nada que hacer más que esperar.
 *     · APROBADO   → cerrado. Se puede abrir su ACTA D2 (ModalDocumentViewer, el visor del director)
 *                    SI el documento existe (`actaDisponible`).
 *     · RECHAZADO  → se muestra el MOTIVO del director (que ahora se PERSISTE: antes se perdía) y se
 *                    deja claro que los casos quedaron LIBERADOS y pueden volver a sortearse desde
 *                    la Bandeja de Sorteo.
 *
 *   Es una bandeja de CONSULTA: no ofrece sortear, devolver, aprobar ni rechazar — esos actos viven
 *   en sus bandejas (y sus @Roles). La ven el SECRETARIO (es su trabajo) y el DIRECTOR (el efecto de
 *   lo que aprobó/rechazó).
 *
 *   APROBADO SIN ACTA — SE DICE, NO SE ESCONDE. El estado del lote ya NO se infiere de que exista el
 *   acta: la aprobación es un HECHO que el backend PERSISTE al aprobar (epsor_aprobado_at), mientras
 *   que el acta es un EFECTO posterior best-effort que puede fallar. Cuando falla, el lote sigue
 *   APROBADO y aquí se muestra como "Aprobado — acta no disponible", sin ofrecer un botón que
 *   prometería un 404. Antes, ese lote desaparecía de las bandejas para siempre.
 *
 *   Solo componentes compartidos (HeaderPage, Collapse, Boton, BadgePriority, EmptyState, Alert,
 *   Loading) — sin tablas/botones/badges a mano, solo tokens daisyUI.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-14
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUser } from "../context/UserContext";
import { useModal } from "../hooks/useModal";
import { useToast } from "../hooks/useToast";
import {
  SorteoService,
  textoCasosSorteados,
  type LoteEstado,
  type SorteoLote,
} from "../services/SorteoService";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import EmptyState from "../components/common/EmptyState";
import Alert from "../components/common/Alert";
import Collapse from "../components/collapse/Collapse";
import Boton from "../components/common/Boton";
import BadgePriority from "../components/common/BadgePriority";
import TablaAsignacionesLote from "../components/sorteo/TablaAsignacionesLote";
import { DatetimeUtil } from "../utils/datetime.util";

/**
 * Collapse<T> exige permittedActions; esta bandeja es de CONSULTA y su única acción ("Ver acta", solo
 * en los aprobados) se renderiza en el header, así que pasa los tres contextos vacíos — igual que la
 * bandeja del director (AprobacionSorteoPage).
 */
const EMPTY_COLLAPSE_ACTIONS = {
  collapseHeader: [],
  collapseBody: [],
  collapseBodyItem: [],
};

/**
 * Estado del lote → clave de color YA MAPEADA en BADGE_GROUPS (BadgePriority). Se reutilizan las
 * claves existentes en vez de tocar el componente compartido: pendiente→warning (media),
 * aprobado→success, rechazado→error. Cero hex, solo tokens daisyUI.
 */
const ESTADO_BADGE: Record<LoteEstado, string> = {
  PENDIENTE: "media",
  PARCIALMENTE_FIRMADO: "media",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
};

/** Etiqueta de respaldo si el backend no mandara `sdetName` (degradación limpia). */
const ESTADO_LABEL: Record<LoteEstado, string> = {
  PENDIENTE: "Esperando aprobación",
  PARCIALMENTE_FIRMADO: "Firma parcial — esperando al director",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

/** Estado efectivo del lote: si el backend no lo trae, se asume PENDIENTE (nunca rompe la vista). */
const estadoDe = (lote: SorteoLote): LoteEstado => lote.estado ?? "PENDIENTE";

/**
 * ¿Lote APROBADO pero SIN acta? El acta se genera post-commit BEST-EFFORT: puede fallar sin
 * invalidar la aprobación (que ahora es un HECHO persistido, no algo que se infiera del documento).
 * Cuando pasa, esta bandeja lo DICE — "Aprobado — acta no disponible" — en vez de esconder el lote o
 * fingir que hay un acta que abrir. Se compara con `=== false` a propósito: si el backend no manda
 * el flag, no se afirma que falte (degradación limpia hacia el comportamiento anterior).
 */
const esAprobadoSinActa = (lote: SorteoLote): boolean =>
  estadoDe(lote) === "APROBADO" && lote.actaDisponible === false;

/** Solo hay acta que abrir si el lote está APROBADO y el documento EXISTE. Si no, no se ofrece. */
const tieneActa = (lote: SorteoLote): boolean =>
  estadoDe(lote) === "APROBADO" && lote.actaDisponible !== false;

const SorteadosPage = () => {
  const { user } = useUser();
  const { openModal } = useModal();
  const { addToast } = useToast();

  if (!user) {
    return null;
  }

  const [lotes, setLotes] = useState<SorteoLote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await SorteoService.lotes();
      setLotes(data);
    } catch (err) {
      setError(
        mensajeParaUsuario(err, "No se pudieron cargar los lotes sorteados. Intente más tarde."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLotes();
  }, [fetchLotes]);

  // Contadores por estado (resumen de la cabecera): de un vistazo, qué pasó con lo que sorteó.
  const conteo = useMemo(
    () =>
      lotes.reduce(
        (acc, lote) => {
          acc[estadoDe(lote)] += 1;
          return acc;
        },
        { PENDIENTE: 0, APROBADO: 0, RECHAZADO: 0 } as Record<
          LoteEstado,
          number
        >,
      ),
    [lotes],
  );

  /**
   * Abre el acta D2 del lote APROBADO en el visor PDF compartido (ModalDocumentViewer, el mismo que
   * usa el director). Solo se ofrece cuando `actaDisponible` dice que el documento EXISTE; aun así
   * se conserva la degradación (404 → aviso) por si el acta se borrara entre la carga de la bandeja
   * y el clic: nunca una pantalla rota.
   */
  const handleVerActa = async (lote: SorteoLote) => {
    // GUARDA de par faltante (Camino Y, Fase 3.4): el acta se abre por el par (amasId, decisorUserId).
    // Sin decisor resuelto no se dispara la llamada (evita GET /sorteo/:amasId/undefined/acta →
    // segmento faltante). Esta bandeja es solo consulta: el visor simplemente no se abre, con aviso
    // honesto por el toast ya presente.
    if (lote.decisorUserId == null) {
      addToast(
        "warning",
        `El acta del lote #${lote.amasId} no tiene un decisor resuelto y no puede abrirse por par.`,
      );
      return;
    }
    try {
      const acta = await SorteoService.actaDeLote(lote.amasId, lote.decisorUserId);
      openModal("documentViewer", {
        docName: acta.docName ?? `Acta de Sorteo (D2) — Lote #${lote.amasId}`,
        docUrl: acta.docUrl,
      });
    } catch {
      addToast(
        "info",
        `El acta del lote #${lote.amasId} aún no está disponible. Intente en unos momentos.`,
      );
    }
  };

  /**
   * Cabecera de la card del lote: identificación + estado + (solo si el ACTA EXISTE) "Ver acta".
   * Un lote PENDIENTE o RECHAZADO no tiene acta — y un lote APROBADO cuya acta falló, tampoco:
   * ofrecer el botón en cualquiera de esos casos sería prometer un 404. En su lugar, el badge lo
   * dice: "Aprobado — acta no disponible".
   */
  const renderLoteHeader = (lote: SorteoLote, i: number): ReactNode => {
    const estado = estadoDe(lote);

    return (
      <div className="app-collapse-alert-header">
        <div className="app-inbox-document-header-left">
          <div className="app-inbox-document-info">
            <h3 className="app-collapse-alert-title app-inbox-document-name">
              <span className="app-collapse-alert-index">{i + 1}.</span>
              Lote #{lote.amasId}
            </h3>
            {/* La identidad del lote vive SOLO aquí (no se repite en el cuerpo): nº de casos y las
                fechas que lo marcan. Las fechas van ETIQUETADAS — una fecha suelta no dice si es la
                del sorteo o la del cierre. La de cierre depende del desenlace: los estados son
                excluyentes, así que nunca se pintan las dos. */}
            <div className="app-inbox-document-meta">
              <span className="app-inbox-document-count">
                {textoCasosSorteados(lote, "caso")}
              </span>
              {lote.sorteoAt && (
                <span className="app-inbox-document-date">
                  Sorteado: {DatetimeUtil.formatDate(lote.sorteoAt)}
                </span>
              )}
              {estado === "APROBADO" && lote.aprobadoAt && (
                <span className="app-inbox-document-date">
                  Aprobado: {DatetimeUtil.formatDate(lote.aprobadoAt)}
                </span>
              )}
              {estado === "RECHAZADO" && lote.liberadoAt && (
                <span className="app-inbox-document-date">
                  Liberado: {DatetimeUtil.formatDate(lote.liberadoAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="app-collapse-alert-header-right app-inbox-document-header-right">
          {/* Única acción de la bandeja, y SOLO donde el documento EXISTE: el acta del lote cerrado.
              Si el lote está aprobado pero su acta falló, no se ofrece el botón (sería un 404): lo
              dice el badge. */}
          {tieneActa(lote) && (
            <div className="flex flex-wrap gap-2">
              <Boton
                estilos="btn btn-sm btn-ghost text-primary"
                texto="Ver acta"
                deshabilitado={false}
                onClick={(e) => {
                  e?.preventDefault();
                  e?.stopPropagation();
                  void handleVerActa(lote);
                }}
              />
            </div>
          )}
          <BadgePriority
            text={
              esAprobadoSinActa(lote)
                ? "Aprobado — acta no disponible"
                : (lote.sdetName ?? ESTADO_LABEL[estado])
            }
            priority={ESTADO_BADGE[estado]}
            size="md"
            capitalize={false}
          />
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
        </div>
      </div>
    );
  };

  /**
   * Cuerpo de la card: lo que el secretario necesita saber de SU lote, según cómo acabó.
   *   - RECHAZADO → el MOTIVO (lo que se perdía) + qué pasó con sus casos (quedaron liberados).
   *   - APROBADO  → cerrado; el acta está en la cabecera SI EXISTE. Si su generación falló, se dice
   *                 sin rodeos: la aprobación es válida (es un hecho sellado), lo que falta es el
   *                 DOCUMENTO. Antes este lote directamente desaparecía de la bandeja.
   *   - PENDIENTE → está esperando al director. No hay nada que hacer.
   *
   * Y EN LOS TRES: EL REPARTO (TablaAsignacionesLote) — a qué decisor le tocó cada expediente. Es el
   * MISMO componente que ve el director en su bandeja de aprobación, a propósito: las dos vistas
   * dicen LO MISMO del mismo lote (una decide, esta consulta). El secretario es quien disparó el
   * sorteo y hasta ahora no podía ver su resultado más que como un número ("3 casos").
   *
   * Sigue siendo una bandeja de CONSULTA: la tabla no habilita ninguna acción sobre el lote.
   */
  const renderLoteContent = (lote: SorteoLote): ReactNode => {
    const estado = estadoDe(lote);

    return (
      <div className="app-collapse-alert-body">
        {/* flex-col, NO flex-row: el aviso del desenlace va ARRIBA, en su propia fila, y la tabla del
            reparto debajo. En fila los dos compiten por el ancho y la tabla queda estrujada. */}
        {/* SIN `app-inbox-case-details`: esa clase es para la fila de detalle de un CASO dentro de un
            grid — trae `flex-direction: row` y `grid-column: 2` propios, que pisaban el flex-col y
            metían una columna de grid inexistente aquí. El layout lo dan las utilidades. */}
        <div className="flex flex-col gap-3 p-3 text-sm">
          {estado === "RECHAZADO" && (
            <>
              <div className="app-modules-review-row">
                <span className="app-modules-review-row-label">
                  Motivo del rechazo
                </span>
                <span className="app-modules-review-row-value">
                  {lote.rechazoReason?.trim() || "Sin motivo registrado"}
                </span>
              </div>
              <Alert
                variant="warning"
                message="El director rechazó este lote. Sus casos quedaron LIBERADOS y volvieron a estar disponibles: puede volver a sortearlos desde la Bandeja de Sorteo."
              />
            </>
          )}

          {estado === "PENDIENTE" && (
            <Alert
              variant="info"
              message="El lote está sorteado y espera la aprobación del director. No hay ninguna acción pendiente de su parte."
            />
          )}

          {estado === "APROBADO" && !esAprobadoSinActa(lote) && (
            <Alert
              variant="success"
              message="El director aprobó este lote: los casos quedaron asignados a sus decisores. Puede consultar el acta de sorteo (D2)."
            />
          )}

          {/* Aprobado SIN acta: se dice la verdad. La aprobación es un hecho registrado y sigue
              siendo válida; lo que falló fue la generación del PDF del acta. */}
          {esAprobadoSinActa(lote) && (
            <Alert
              variant="warning"
              message="El director APROBÓ este lote y los casos quedaron asignados a sus decisores: la aprobación es válida y está registrada. Lo que no está disponible es el DOCUMENTO del acta (D2). Si el lote acaba de aprobarse, actualice en unos segundos; si sigue sin aparecer, su generación falló y debe pedir a soporte que se regenere (la aprobación NO se pierde por eso)."
            />
          )}


          {/* EL REPARTO: a quién le tocó cada expediente. El mismo componente que ve el director
              antes de aprobar — aquí en modo consulta. En un lote RECHAZADO enseña el reparto que se
              rechazó (esos casos ya quedaron liberados y se re-sortearán a otros decisores). */}
          <TablaAsignacionesLote
            casos={lote.casos ?? []}
            totalCasos={lote.totalCasos}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="app-data-container">
      <HeaderPage
        headerKicker="Ejecución — DME"
        title="Sorteados"
        subtitle="Todo lo que usted envió al sorteo y en qué quedó: esperando al director, aprobado (con su acta) o rechazado (con el motivo)."
      />

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-primary/95">
              Lotes sorteados
            </h2>
            <span className="badge badge-outline whitespace-nowrap">
              Solo consulta
            </span>
            {/* Resumen: qué pasó con lo que sorteó, sin abrir nada. */}
            <span className="badge badge-warning badge-outline whitespace-nowrap">
              {conteo.PENDIENTE} esperando al director
            </span>
            <span className="badge badge-success badge-outline whitespace-nowrap">
              {conteo.APROBADO} aprobado(s)
            </span>
            <span className="badge badge-error badge-outline whitespace-nowrap">
              {conteo.RECHAZADO} rechazado(s)
            </span>
          </div>

          <Boton
            estilos="btn btn-sm btn-ghost text-primary"
            texto="Actualizar"
            deshabilitado={loading}
            onClick={() => {
              void fetchLotes();
            }}
          />
        </div>

        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          {error && !loading && <Alert variant="error" message={error} />}

          {!loading && !error && lotes.length === 0 && (
            <EmptyState text="Todavía no ha sorteado ningún lote" />
          )}

          {lotes.length > 0 && (
            <div className="app-data-list mb-2">
              {lotes.map((lote, i) => (
                <Collapse<SorteoLote>
                  key={lote.amasId}
                  data={lote}
                  index={i}
                  permittedActions={EMPTY_COLLAPSE_ACTIONS}
                  headerRender={renderLoteHeader}
                  contentRender={renderLoteContent}
                  className="app-collapse-alert app-inbox-alert-item"
                  summaryClassName="app-collapse-alert-summary"
                  contentClassName="app-collapse-alert-content"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {loading && <Loading />}
    </div>
  );
};

export default SorteadosPage;
