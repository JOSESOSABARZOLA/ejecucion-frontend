/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Bandeja del director — REVISAR Y FIRMAR[=aprobar]/rechazar lote + EXCUSAS (RECE-05/07)
 * Archivo: AprobacionSorteoPage.tsx
 * Responsabilidad: Las DOS bandejas del director:
 *
 *   1. LOTES esperando la firma del director (SorteoService.lotesPendientes): REVISAR Y FIRMAR
 *      —firmar ES aprobar, un solo acto—, ver el acta D2 (ModalDocumentViewer) o RECHAZAR con motivo
 *      (ModalRechazoLote). El rechazo es REAL contra Asignaciones (exige `reason`) y deja los
 *      expedientes LIBERADOS para re-sortearse.
 *
 *      UN SOLO ACTO (decisión bloqueada, CONTEXT.md 2026-07-17): ya NO hay un botón "Aprobar"
 *      separado de la firma. El botón dispara SorteoService.firmarLote → PATCH /sorteo/:amasId/firmar
 *      (el antiguo /approve dejó de existir en el backend, Plan 03.2-03). Desde la Fase 03.21 la firma
 *      es REAL y va ANTES que la aprobación (D-10, todo o nada): si no se aplica, el lote no se
 *      aprueba y el aviso lo dice. Con el firmador apagado, `firmado:false` y el aviso dice que el
 *      acta quedó SIN firma criptográfica (D-11), sin prometer una firma posterior.
 *
 *      AL ABRIR EL LOTE SE VE EL REPARTO (TablaAsignacionesLote): a QUÉ DECISOR le tocó cada
 *      expediente, con su administrado, materia (deducida de sus infracciones) y plazo. Antes no: la
 *      bandeja decía "3 casos" y
 *      el director decidía SIN VER a quién se asignó cada expediente — que es exactamente el acto
 *      que estaba validando. Por eso "Revisar y firmar" y "Rechazar lote" no viven en la cabecera
 *      sino DEBAJO de la tabla: con el botón arriba, el lote podía firmarse sin haberlo abierto
 *      nunca. Primero se REVISA el reparto (y el acta, que ya existe desde el sorteo — Plan 03.2-01);
 *      después se firma. El orden ES la revisión previa que exige la decisión bloqueada.
 *
 *   2. SOLICITUDES DE REASIGNACIÓN (excusas) pendientes de resolver
 *      (SorteoService.reasignacionesPendientes): el director ve el caso, el decisor y el MOTIVO, y
 *      Aprueba (dispara el re-sorteo, que EXCLUYE al decisor anterior) o Rechaza (el decisor
 *      conserva el caso). Antes el backend permitía aprobar/rechazar excusas pero NO existía ningún
 *      endpoint que las LISTARA: el director podía resolverlas sin poder verlas. Esta es la vista
 *      que faltaba. Respeta el envelope PAGINADO del backend (Pagination).
 *
 *   Solo componentes compartidos (Collapse, Boton, BadgePriority, EmptyState, Alert, Pagination,
 *   ConfirmationDetail, HeaderPage, Loading) — sin tablas/botones/badges a mano, solo tokens daisyUI.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-20
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-17: solo comentarios. La tabla
 *   del reparto enseña la MATERIA deducida de las infracciones del EPAS, no la submateria del
 *   catálogo local. La línea de la excusa no cambia: su `subName` lo manda ASIGNACIONES)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08: el campo de clave recibe el aviso
 *   del firmador apagado del acta y `sesionCentral`.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, CR-01: la clave del director se borra
 *   tras cualquier intento, al cerrar la confirmación y al abrirla para otro lote; escribir en el
 *   campo retira el aviso del fallo anterior y rearma el botón.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-02: se retira la promesa de una firma
 *   «pendiente»; el éxito usa `exitoFirmaActa` y un fallo `APP-FIRMA-*` antepone la consecuencia del
 *   director, con el estado E y el foco si fue la clave.)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la clave rechazada se dice solo bajo el
 *   campo, con el foco, sin el mensaje de la confirmación; el resto de fallos los lleva
 *   ConfirmationDetail al aviso flotante)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import DialogoModal from "../components/common/DialogoModal";
import { useUser } from "../context/UserContext";
import { useModal } from "../hooks/useModal";
import { useToast } from "../hooks/useToast";
import {
  SorteoService,
  textoCasosSorteados,
  type ReasignacionPendiente,
  type SorteoLote,
} from "../services/SorteoService";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import EmptyState from "../components/common/EmptyState";
import Alert, { type AlertVariant } from "../components/common/Alert";
import Pagination from "../components/common/Pagination";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";
import ModalRechazoLote from "../components/modals/ModalRechazoLote";
import Collapse from "../components/collapse/Collapse";
import Boton from "../components/common/Boton";
import BadgePriority from "../components/common/BadgePriority";
import TablaAsignacionesLote from "../components/sorteo/TablaAsignacionesLote";
import CampoClaveCertificado from "../components/sorteo/CampoClaveCertificado";
import { useClaveDeFirma } from "../hooks/useClaveDeFirma";
import {
  AVISO_SIN_FIRMADOR,
  CONSECUENCIA_FALLO_FIRMA,
  ERROR_CLAVE_INCORRECTA,
  esClaveIncorrecta,
  esErrorDeFirma,
  exitoFirmaActa,
  mensajeDeFalloDeFirma,
} from "../config/firmaCopy";
import { DatetimeUtil } from "../utils/datetime.util";

type ExcusaAccion = "aprobar" | "rechazar";

// Collapse<T> exige permittedActions; estas bandejas renderizan sus propias acciones en el header,
// por lo que pasan los tres contextos vacíos.
const EMPTY_COLLAPSE_ACTIONS = {
  collapseHeader: [],
  collapseBody: [],
  collapseBodyItem: [],
};

const AprobacionSorteoPage = () => {
  const { user } = useUser();
  const { openModal } = useModal();
  const { addToast } = useToast();

  if (!user) {
    return null;
  }

  // --- Bandeja 1: lotes esperando aprobación ---
  const [lotes, setLotes] = useState<SorteoLote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Confirmación de la FIRMA[=aprobación] del lote (el rechazo va por ModalRechazoLote: exige motivo).
  const [confirmFirmar, setConfirmFirmar] = useState<SorteoLote | null>(null);
  // Clave del certificado del DIRECTOR para la firma de ORDEN 3 (solo si el firmador está activo).
  const clave = useClaveDeFirma();
  /** Estado E del campo: la última firma se rechazó por la clave (`APP-FIRMA-CLAVE-001`). */
  const [errorClave, setErrorClave] = useState(false);
  /**
   * Tras un rechazo de la clave, el foco vuelve al campo. Por ref de callback y no por efecto:
   * mientras confirma, `ConfirmationDetail` desmonta su contenido, así que el campo VUELVE A MONTARSE
   * al terminar y es en ese montaje cuando hay que enfocarlo (mismo patrón que BandejaSalidaPage).
   */
  const pedirFocoClaveRef = useRef(false);
  const refCampoClave = useCallback((campo: HTMLInputElement | null) => {
    if (campo && pedirFocoClaveRef.current) {
      pedirFocoClaveRef.current = false;
      campo.focus();
    }
  }, []);
  const [rechazarLote, setRechazarLote] = useState<SorteoLote | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);

  // --- Bandeja 2: excusas (solicitudes de reasignación) pendientes ---
  const [excusas, setExcusas] = useState<ReasignacionPendiente[]>([]);
  const [excusasPage, setExcusasPage] = useState(0); // 0-based (Pagination)
  const [excusasTotalPages, setExcusasTotalPages] = useState(0);
  const [excusasTotal, setExcusasTotal] = useState(0);
  const [excusasPageSize, setExcusasPageSize] = useState(10);
  const [excusasLoading, setExcusasLoading] = useState(false);
  const [excusasError, setExcusasError] = useState<string | null>(null);
  const [confirmExcusa, setConfirmExcusa] = useState<{
    excusa: ReasignacionPendiente;
    accion: ExcusaAccion;
  } | null>(null);
  const [excusaMessage, setExcusaMessage] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await SorteoService.lotesPendientes();
      setLotes(data);
    } catch (err) {
      setError(
        mensajeParaUsuario(err, "El servicio de sorteo no está disponible en este momento. Intente más tarde."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // El backend devuelve el envelope paginado 1-based; Pagination trabaja 0-based.
  const fetchExcusas = useCallback(async (pageIndex: number) => {
    setExcusasLoading(true);
    setExcusasError(null);
    try {
      const data = await SorteoService.reasignacionesPendientes(pageIndex + 1);
      setExcusas(data.items ?? []);
      setExcusasTotalPages(data.totalPages ?? 0);
      setExcusasTotal(data.totalCount ?? 0);
      setExcusasPageSize(data.pageSize ?? 10);
    } catch (err) {
      setExcusasError(
        mensajeParaUsuario(err, "No se pudieron cargar las solicitudes de reasignación. Intente más tarde."),
      );
    } finally {
      setExcusasLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLotes();
  }, [fetchLotes]);

  useEffect(() => {
    void fetchExcusas(excusasPage);
  }, [fetchExcusas, excusasPage]);

  const refreshLotes = useCallback(async () => {
    await fetchLotes();
  }, [fetchLotes]);

  const refreshExcusas = useCallback(async () => {
    await fetchExcusas(excusasPage);
  }, [fetchExcusas, excusasPage]);

  /**
   * Abre la confirmación de la firma de un lote con el campo VACÍO: la clave tecleada para otro lote
   * (o en un intento anterior) no se hereda (UI-SPEC §2.3).
   */
  const abrirConfirmFirmar = (lote: SorteoLote) => {
    clave.limpiar();
    setConfirmMessage(null);
    setErrorClave(false);
    setConfirmFirmar(lote);
  };

  /** Cierra la confirmación y olvida la clave tecleada y el fallo anterior (UI-SPEC §2.3). */
  const cerrarConfirmFirmar = () => {
    setConfirmFirmar(null);
    setConfirmMessage(null);
    setErrorClave(false);
    clave.limpiar();
  };

  /**
   * Escribir en el campo es un intento nuevo: retira el aviso, que es lo único que rearma el botón
   * de `ConfirmationDetail` (lo apaga mientras hay `message`). Sin esto, tras un fallo la única
   * salida era cerrar y volver a abrir.
   */
  const editarClave = (valor: string) => {
    clave.setClave(valor);
    setConfirmMessage(null);
    setErrorClave(false);
  };

  // --- Lotes: FIRMAR = APROBAR (un solo acto del director) ---
  const handleFirmarLote = async () => {
    if (!confirmFirmar) return;
    setConfirmMessage(null);
    setErrorClave(false);
    // GUARDA de par faltante (Camino Y, Fase 3.4): la firma se sella por el par
    // (amasId, decisorUserId). Si el lote no trae decisor resuelto NO se dispara la llamada —
    // enviarla produciría PATCH /sorteo/:amasId/undefined/firmar (segmento faltante → 400). Se dice
    // honesto, no se finge.
    if (confirmFirmar.decisorUserId == null) {
      clave.limpiar();
      setConfirmMessage({
        variant: "error",
        message:
          "Este lote no tiene un decisor resuelto; no se puede firmar por par. Actualice la bandeja o contacte a soporte.",
      });
      return;
    }
    try {
      const resultado = await SorteoService.firmarLote(
        confirmFirmar.amasId,
        confirmFirmar.decisorUserId,
        undefined,
        clave.claveParaEnviar,
      );
      // NO SE MIENTE SOBRE LA FIRMA (UI-SPEC §10.7, D-10/D-11). Con el firmador encendido rige el
      // todo o nada: si la firma no se aplica, el backend NO aprueba y responde con un error, así que
      // aquí solo se llega con el lote aprobado. `firmado:false` solo ocurre con el firmador apagado, y
      // entonces el acta queda SIN firma criptográfica — ya no se promete una firma posterior (C6).
      addToast("success", exitoFirmaActa(resultado?.firmado === true, true));
      setConfirmFirmar(null);
      await refreshLotes();
    } catch (err) {
      if (esClaveIncorrecta(err)) {
        // Todo o nada (D-10): ni el acta se firmó ni el lote se aprobó. Regla de mensajes
        // 261028-kmg: la clave rechazada se dice SOLO bajo el campo, que vuelve vacío, marcado y con
        // el foco (estado E), sin el mensaje de la confirmación. El botón queda apagado igual —la
        // clave se vacía en el `finally` y `confirmDisabled` lo apaga— y escribir lo rearma.
        pedirFocoClaveRef.current = true;
        setErrorClave(true);
      } else if (esErrorDeFirma(err)) {
        // Todo o nada (D-10): ni el acta se firmó ni el lote se aprobó en Asignaciones. La frase del
        // director va delante del texto del servidor (UI-SPEC §10.1), en el aviso flotante.
        setConfirmMessage({
          variant: "error",
          message: mensajeDeFalloDeFirma(CONSECUENCIA_FALLO_FIRMA.actaDirector, err),
        });
      } else {
        setConfirmMessage({
          variant: "error",
          message:
            mensajeParaUsuario(err, "No se pudo firmar el lote. Intente más tarde."),
        });
      }
    } finally {
      // 🔴 La clave no sobrevive al intento, con éxito O con error (UI-SPEC §2.3 regla 2): tras un
      // fallo el campo queda vacío y para reintentar se escribe de nuevo.
      clave.limpiar();
    }
  };

  /**
   * Ver/descargar el acta D2 del lote (visor PDF). Es LA REVISIÓN PREVIA a la firma: desde el
   * reorden (Plan 03.2-01) el acta se genera cuando el SECRETARIO sortea, no al aprobar, así que el
   * director puede leerla ANTES de firmar — que es justamente lo que la decisión bloqueada pide.
   * Degrada con gracia si el acta no está: su generación es post-commit best-effort.
   */
  const handleVerActa = async (lote: SorteoLote) => {
    // GUARDA de par faltante: el acta se abre por el par (amasId, decisorUserId). Sin decisor
    // resuelto no se dispara la llamada (evita GET /sorteo/:amasId/undefined/acta → segmento
    // faltante). Se degrada honesto con el toast ya presente.
    if (lote.decisorUserId == null) {
      addToast(
        "warning",
        "Este lote no tiene un decisor resuelto; no se puede abrir el acta por par.",
      );
      return;
    }
    try {
      const acta = await SorteoService.actaDeLote(lote.amasId, lote.decisorUserId);
      openModal("documentViewer", {
        docName: acta.docName ?? "Acta de Sorteo (D2)",
        docUrl: acta.docUrl,
      });
    } catch {
      addToast(
        "info",
        "El acta de este lote todavía no está disponible. Intente en unos momentos.",
      );
    }
  };

  /**
   * Abrir el ESCRITO con que el decisor sustentó su excusa (pedido del usuario, 2026-09-17).
   *
   * Mismo gesto que `handleVerActa` en la bandeja de arriba, y por la misma razón: el director lee
   * el documento ANTES de resolver. Se pide al pulsar el ojo, no al pintar la lista.
   *
   * 🔴 El 404 NO es un error del sistema y por eso el aviso es informativo, no de fallo: las excusas
   * anteriores al 2026-09-01 se presentaron sin documento y no se les puede inventar uno.
   */
  const handleVerEscritoExcusa = async (excusa: ReasignacionPendiente) => {
    try {
      const escrito = await SorteoService.escritoDeExcusa(excusa.id);
      openModal("documentViewer", {
        docName: escrito.docName ?? "Escrito de excusa",
        docUrl: escrito.docUrl,
      });
    } catch {
      addToast(
        "info",
        "Esta solicitud no tiene un escrito adjunto. Las excusas anteriores al 01/09/2026 se presentaron sin documento.",
      );
    }
  };

  // --- Excusas: aprobar (re-sortea excluyendo al decisor anterior) / rechazar (lo conserva) ---
  const handleResolverExcusa = async () => {
    if (!confirmExcusa) return;
    setExcusaMessage(null);
    const { excusa, accion } = confirmExcusa;
    try {
      if (accion === "aprobar") {
        await SorteoService.aprobarReasignacion(excusa.id);
        addToast(
          "success",
          "Reasignación aprobada — el expediente se re-sorteó excluyendo al decisor anterior",
        );
      } else {
        await SorteoService.rechazarReasignacion(excusa.id);
        addToast("success", "Excusa rechazada — el decisor conserva el expediente");
      }
      setConfirmExcusa(null);
      await refreshExcusas();
    } catch (err) {
      setExcusaMessage({
        variant: "error",
        message:
          mensajeParaUsuario(err, "No se pudo resolver la solicitud de reasignación. Intente más tarde."),
      });
    }
  };

  /**
   * Cabecera de la card del lote: identificación + estado. SIN acciones de decisión.
   *
   * Aprobar y Rechazar VIVEN EN EL CUERPO, DESPUÉS de la tabla de asignaciones (renderLoteContent).
   * No es cosmético: con el botón aquí arriba, el director podía APROBAR el lote SIN HABERLO ABIERTO
   * NUNCA — sin ver a qué decisor se asignó cada expediente, que es exactamente el acto que estaba
   * validando. Ahora el orden lo obliga: primero ves el reparto, luego decides. Se conserva "Ver
   * acta" (una LECTURA, no una decisión) y solo si el documento existe.
   */
  const renderLoteHeader = (lote: SorteoLote, i: number): ReactNode => (
    <div className="app-collapse-alert-header">
      <div className="app-inbox-document-header-left">
        <div className="app-inbox-document-info">
          <h3 className="app-collapse-alert-title app-inbox-document-name">
            <span className="app-collapse-alert-index">{i + 1}.</span>
            Lote #{lote.amasId}
          </h3>
          <div className="app-inbox-document-meta">
            <span className="app-inbox-document-count">
              {textoCasosSorteados(lote, "expediente")}
            </span>
            {lote.sorteoAt && (
              <span className="app-inbox-document-date">
                {DatetimeUtil.formatDate(lote.sorteoAt)}
              </span>
            )}
            {/* La card ya no lleva las acciones: hay que decirle al director dónde están y por qué. */}
            <span className="app-inbox-document-count font-semibold">
              Abra el lote para revisar a quién le tocó cada expediente y
              firmarlo
            </span>
          </div>
        </div>
      </div>

      <div className="app-collapse-alert-header-right app-inbox-document-header-right">
        {/* "Ver acta" SOLO si el documento existe (actaDisponible): sin el gate, el botón prometía un
            404 y solo devolvía un aviso. Con el reorden (Plan 03.2-01) el acta se genera AL SORTEAR,
            así que en esta bandeja de PENDIENTES ya suele existir — y por eso el director puede
            REVISARLA antes de firmar, que es el punto del reorden. */}
        {lote.actaDisponible && (
          <div className="flex flex-wrap gap-2">
            <Boton
              estilos="btn btn-sm btn-ghost text-primary"
              texto="Ver acta"
              deshabilitado={false}
              onClick={(e) => {
                // El botón vive dentro del <summary>: sin preventDefault su click desplegaría la card.
                e?.preventDefault();
                e?.stopPropagation();
                void handleVerActa(lote);
              }}
            />
          </div>
        )}
        <BadgePriority
          text={lote.sdetName ?? "Esperando firma"}
          priority={String(lote.sdetName ?? "").toLowerCase()}
          size="md"
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

  /**
   * Cuerpo de la card: EL REPARTO (a quién le tocó cada expediente) y, DEBAJO, la decisión.
   *
   * Este orden ES la corrección. El director aprobaba viendo "3 casos" y nada más; el acta D2 que se
   * genera al aprobar sí lleva los nombres de los decisores — el único que no los veía era quien
   * aprueba. Ahora la evidencia va primero y los botones después: se aprueba lo que se acaba de ver.
   *
   * Los botones viven FUERA del <summary> (Collapse los renderiza en el <div> del contenido), así que
   * NO necesitan preventDefault: aquí un click no despliega ni pliega la card.
   */
  const renderLoteContent = (lote: SorteoLote): ReactNode => (
    <div className="app-collapse-alert-body">
      {/* SIN `app-inbox-case-details`: trae `flex-direction: row` + `grid-column: 2` propios (es para
          la fila de detalle de un CASO dentro de un grid) y pisaba este flex-col. */}
      <div className="flex flex-col gap-4 p-3 text-sm">
        {/* La identidad del lote (nº, casos, fecha, estado) vive SOLO en la cabecera: repetirla aquí
            era ruido y empujaba hacia abajo lo único que importa, que es el reparto. */}

        {/* EL ACTO QUE SE ESTÁ VALIDANDO: el reparto, expediente por expediente. */}
        <TablaAsignacionesLote
          casos={lote.casos ?? []}
          totalCasos={lote.totalCasos}
        />

        {/* La decisión, DESPUÉS del reparto. */}
        <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 pt-3">
          <Boton
            estilos="btn btn-sm btn-ghost text-error"
            texto="Rechazar lote"
            deshabilitado={false}
            onClick={() => setRechazarLote(lote)}
          />
          {/* Acción primaria (accent único de la card): FIRMAR = APROBAR, un solo acto. Va DESPUÉS
              del reparto y del acta: lo que se firma es lo que se acaba de revisar. */}
          <Boton
            estilos="btn btn-sm btn-primary"
            texto="Revisar y firmar"
            deshabilitado={false}
            onClick={() => abrirConfirmFirmar(lote)}
          />
        </div>
      </div>
    </div>
  );

  // Cabecera de la card de la excusa: caso + decisor + acciones (aprobar/rechazar).
  /**
   * UNA FILA de solicitud de reasignación. **No es desplegable, y es deliberado** (pedido del
   * usuario, 2026-09-17): antes había que abrir cada tarjeta para leer el motivo, y el motivo es
   * justo lo que el director necesita para decidir. Ahora se ve de entrada, y el ESCRITO se abre con
   * el icono de ojo — el mismo gesto que el acta en la bandeja de arriba.
   *
   * Lo que se conserva del cuerpo desplegable: el motivo y la submateria. Lo que se retira: el eco de
   * `caseId` y del decisor, que ya están en el título y en la meta de la propia fila.
   *
   * Esa submateria NO es la del catálogo local retirado en la Fase 03.23: el `subName`/`subId` de la
   * excusa lo manda ASIGNACIONES (`ReassignmentRequestItem`), y por eso esta línea no cambió.
   */
  const renderExcusaFila = (
    excusa: ReasignacionPendiente,
    i: number,
  ): ReactNode => (
    <div className="app-collapse-alert-header">
      <div className="app-inbox-document-header-left">
        <div className="app-inbox-document-info">
          <h3 className="app-collapse-alert-title app-inbox-document-name">
            <span className="app-collapse-alert-index">
              {excusasPage * excusasPageSize + i + 1}.
            </span>
            Caso #{excusa.caseId}
          </h3>
          <div className="app-inbox-document-meta">
            <span className="app-inbox-document-count">
              Decisor: {excusa.assignedUserId}
            </span>
            <span className="app-inbox-document-count">
              Lote #{excusa.assignmentMasterId}
            </span>
            {excusa.requestedAt && (
              <span className="app-inbox-document-date">
                {DatetimeUtil.formatDate(excusa.requestedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="app-collapse-alert-header-right app-inbox-document-header-right">
        <div className="flex flex-wrap gap-2">
          {/* Aprobar = re-sortear EXCLUYENDO al decisor anterior (lo hace el SP de Asignaciones). */}
          <Boton
            estilos="btn btn-sm btn-primary"
            texto="Aprobar excusa"
            deshabilitado={false}
            onClick={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              setExcusaMessage(null);
              setConfirmExcusa({ excusa, accion: "aprobar" });
            }}
          />
          <Boton
            estilos="btn btn-sm btn-ghost text-error"
            texto="Rechazar excusa"
            deshabilitado={false}
            onClick={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              setExcusaMessage(null);
              setConfirmExcusa({ excusa, accion: "rechazar" });
            }}
          />
        </div>
        <BadgePriority
          text={excusa.assignmentStatusName ?? "Reasignación solicitada"}
          priority="alta"
          size="md"
        />
        {/* El OJO sustituye al chevron: antes esto abría la tarjeta, ahora abre el DOCUMENTO. Es un
            <button> de verdad y no un <span> decorativo — se alcanza con el tabulador y se anuncia,
            que es lo mínimo para un control que abre un acto administrativo. */}
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-circle"
          aria-label="Ver el escrito de la excusa"
          title="Ver el escrito de la excusa"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleVerEscritoExcusa(excusa);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
  );

  /**
   * El MOTIVO, visible sin abrir nada. Es lo que el director necesita para decidir, y tenerlo
   * detrás de un clic era la queja que originó este cambio.
   */
  const renderExcusaMotivo = (excusa: ReasignacionPendiente): ReactNode => (
    <div className="app-collapse-alert-content">
      <div className="flex flex-col gap-2 p-3 text-sm">
        <div className="app-modules-review-row">
          <span className="app-modules-review-row-label">
            Motivo de la excusa
          </span>
          <span className="app-modules-review-row-value">
            {excusa.reason?.trim() || "Sin motivo registrado"}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 opacity-70">
          <span>Submateria: {excusa.subName ?? excusa.subId ?? "—"}</span>
          <span>Solicitada: {DatetimeUtil.formatDate(excusa.requestedAt)}</span>
        </div>
      </div>
    </div>
  );

  const excusaCopy =
    confirmExcusa?.accion === "aprobar"
      ? {
          headerTitle: "Aprobar solicitud de reasignación",
          statusCopy: "Listo para reasignar",
          descriptionCopy:
            "¿Confirma aprobar la excusa? El expediente se volverá a sortear EXCLUYENDO al decisor actual.",
          confirmButtonText: "Sí, aprobar",
          confirmButtonLoadingText: "Aprobando…",
        }
      : {
          headerTitle: "Rechazar solicitud de reasignación",
          statusCopy: "Rechazar excusa",
          descriptionCopy:
            "¿Confirma rechazar la excusa? El decisor conservará el expediente asignado.",
          confirmButtonText: "Sí, rechazar",
          confirmButtonLoadingText: "Rechazando…",
        };

  return (
    <div className="app-data-container">
      {/* El título espeja el label de navigation.ts ("Aprobación de Sorteos"): renombrarlo aquí y no
          allí desalinearía el menú. Y no es falso — firmar ES aprobar, y el subtítulo lo dice. */}
      <HeaderPage
        headerKicker="Ejecución — DME"
        title="Aprobación de Sorteos"
        subtitle="Revise el reparto y el acta del lote sorteado, y fírmelo: la firma asienta la aprobación. Resuelva las excusas de los decisores."
      />

      {/* ── Bandeja 1: lotes esperando aprobación ───────────────────────────────────── */}
      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-primary/95">
            Lotes esperando su firma
          </h2>
          <span className="badge badge-primary badge-outline whitespace-nowrap">
            {lotes.length} lote(s)
          </span>
        </div>

        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          {error && !loading && (
            <Alert
              variant="error"
              message={error}
            />
          )}

          {!loading && !error && lotes.length === 0 && (
            <EmptyState text="No hay lotes pendientes de firma" />
          )}

          {lotes.length > 0 && (
            <div className="app-data-list mb-2">
              {lotes.map((lote, i) => (
                <Collapse<SorteoLote>
                  // 🔴 La clave es el PAR, no el lote. Esta bandeja es por SUBLOTE —el Camino Y de
                  // la Fase 3.4 reparte un mismo `amasId` entre varios decisores—, así que
                  // `key={lote.amasId}` se repetía y React avisaba «two children with the same key».
                  // No era cosmético: con claves duplicadas React puede duplicar u OMITIR filas, y
                  // aquí una fila omitida es un lote que el director no llega a ver ni a firmar.
                  // Detectado en consola el 2026-09-17.
                  key={`${lote.amasId}-${lote.decisorUserId ?? "sin-decisor"}`}
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

      {/* ── Bandeja 2: excusas (solicitudes de reasignación) pendientes ─────────────── */}
      <section className="app-modules-panel app-data-panel app-shell-surface mt-6 overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-primary/95">
            Solicitudes de reasignación (excusas)
          </h2>
          <span className="badge badge-primary badge-outline whitespace-nowrap">
            {excusasTotal} solicitud(es)
          </span>
        </div>

        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          {excusasError && !excusasLoading && (
            <Alert
              variant="error"
              message={excusasError}
            />
          )}

          {!excusasLoading && !excusasError && excusas.length === 0 && (
            <EmptyState text="No hay solicitudes de reasignación pendientes" />
          )}

          {excusas.length > 0 && (
            <>
              <div className="app-data-list mb-2">
                {excusas.map((excusa, i) => (
                  /* Fila PLANA: ni <details> ni <summary>. El motivo se lee de entrada y el escrito
                     se abre con el ojo (usuario, 2026-09-17). */
                  <div
                    key={excusa.id}
                    className="app-collapse-alert app-inbox-alert-item"
                  >
                    {renderExcusaFila(excusa, i)}
                    {renderExcusaMotivo(excusa)}
                  </div>
                ))}
              </div>

              {excusasTotalPages > 1 && (
                <Pagination
                  pageIndex={excusasPage}
                  pageSize={excusasPageSize}
                  totalPages={excusasTotalPages}
                  totalRecords={excusasTotal}
                  disabled={excusasLoading}
                  onPageChange={setExcusasPage}
                  // El tamaño de página lo fija Asignaciones (10): no es configurable desde aquí.
                  onPageSizeChange={() => undefined}
                />
              )}
            </>
          )}
        </div>
      </section>

      {/* Confirmación de la FIRMA[=aprobación] del lote (el rechazo exige motivo → ModalRechazoLote).
          El copy dice que firmar ASIENTA la aprobación (es el hecho, es definitivo) y, con el
          firmador encendido, que la firma va ANTES que la aprobación (D-10): si la firma no se
          aplica, el lote no se aprueba. Con el firmador apagado el campo ya dice que el acta saldrá
          SIN firma criptográfica (D-11); no se promete una firma posterior (C6). */}
      {confirmFirmar && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={cerrarConfirmFirmar}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle="Revisar y firmar el lote"
            statusCopy="Listo para firmar"
            descriptionCopy={
              clave.requerida
                ? "¿Confirma firmar el lote? El acta se firmará con su certificado y la firma ASIENTA la aprobación de forma definitiva: los expedientes quedan asignados a sus decisores. Si la firma no se aplica, el lote no se aprueba."
                : "¿Confirma firmar el lote? La firma ASIENTA la aprobación de forma definitiva: los expedientes quedan asignados a sus decisores."
            }
            informationData={{
              Lote: `#${confirmFirmar.amasId}`,
              Expedientes: textoCasosSorteados(confirmFirmar, "expediente"),
            }}
            onConfirm={handleFirmarLote}
            onClose={cerrarConfirmFirmar}
            message={confirmMessage ?? undefined}
            confirmButtonText="Sí, firmar"
            confirmButtonLoadingText="Firmando…"
            confirmDisabled={!clave.listaParaEnviar}
          >
            {/* Solo aparece si el firmador está encendido (GET /sorteo/firma/modo). */}
            <CampoClaveCertificado
              requerida={clave.requerida}
              value={clave.clave}
              onChange={editarClave}
              error={errorClave ? ERROR_CLAVE_INCORRECTA : undefined}
              inputRef={refCampoClave}
              avisoSinFirmador={AVISO_SIN_FIRMADOR.acta}
              sesionCentral={clave.sesionCentral}
              cargando={clave.cargando}
              errorModo={clave.errorModo}
              onReintentarModo={clave.reintentarModo}
            />
          </ConfirmationDetail>
        </DialogoModal>
      )}

      {/* RECHAZO del lote: el motivo es OBLIGATORIO (lo exige el reject real de Asignaciones). */}
      {rechazarLote && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setRechazarLote(null)}
        >
          <ModalRechazoLote
            lote={rechazarLote}
            onClose={() => setRechazarLote(null)}
            refetchFn={refreshLotes}
          />
        </DialogoModal>
      )}

      {/* Confirmación de la resolución de una excusa (aprobar → re-sorteo / rechazar → conserva). */}
      {confirmExcusa && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setConfirmExcusa(null)}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle={excusaCopy.headerTitle}
            statusCopy={excusaCopy.statusCopy}
            descriptionCopy={excusaCopy.descriptionCopy}
            informationData={{
              Caso: `#${confirmExcusa.excusa.caseId}`,
              "Decisor actual": confirmExcusa.excusa.assignedUserId,
              Motivo:
                confirmExcusa.excusa.reason?.trim() || "Sin motivo registrado",
            }}
            onConfirm={handleResolverExcusa}
            onClose={() => setConfirmExcusa(null)}
            message={excusaMessage ?? undefined}
            confirmButtonText={excusaCopy.confirmButtonText}
            confirmButtonLoadingText={excusaCopy.confirmButtonLoadingText}
          />
        </DialogoModal>
      )}

      {(loading || excusasLoading) && <Loading />}
    </div>
  );
};

export default AprobacionSorteoPage;
