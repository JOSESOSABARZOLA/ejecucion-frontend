/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Bandeja "Actas de Sorteo" — TURNO de firma secuencial del acta D2 por rol (FEND-03 / RECE-05), Fase 3.5
 * Archivo: ActasSorteoPage.tsx
 * Responsabilidad: Reemplaza el PlaceholderPage de `/home/actas` por la bandeja REAL de turno de firma.
 *   Es UNA sola bandeja gateada por ROL, no una vista por rol distinta: el turno de cada lote-por-par
 *   `(amasId, decisorUserId)` se DERIVA en cliente con `resolveLoteTurnActions` (Plan 03) desde HECHOS
 *   persistidos (estado + marcas de firma), NUNCA se recalcula aquí. Diferencias por rol:
 *
 *     · SECRETARIO ABOGADO → en su turno (`firmarSecretario`) ve "Revisar y firmar (secretario)", que
 *       abre `ModalFirmaActa` (preview + firmar) vía handleAbrirFirmaActa: previsualiza el acta y aplica
 *       la firma ORDEN-2. Los datos del acta se AUTO-derivan en el backend (ya no hay captura manual).
 *     · DIRECTOR → en su turno (`firmarDirector`) ve "Revisar y firmar (director)", que confirma con
 *       ConfirmationDetail y en onConfirm llama `SorteoService.firmarLote(amasId, decisorUserId)`
 *       (firma ORDEN-3 = aprobación). El PADRE es dueño del error inline; cierra + toast + refetch SOLO
 *       en éxito; copy HONESTO según `res.firmado` (firma criptográfica DIFERIDA → nunca finge la firma).
 *     · FUNCIONARIO DECISOR → está EXCLUIDO de `GET /sorteo/lotes` (su firma ORDEN-1 vive en "Mis
 *       expedientes"). NO se llama `lotes()` para él (evita un 403): se muestra un EmptyState que lo
 *       remite a `/home/mis-asignados`.
 *
 *   🔴 LOS TRES PASOS SE VEN SIEMPRE, Y EL QUE NO TOCA SALE APAGADO CON SU MOTIVO (Fase 03.18, Plan
 *   09). Donde antes la card mostraba ÚNICAMENTE el botón del turno de ese rol y los otros dos no
 *   existían, hoy las tres acciones de firma pasan por `aplicarVeredicto` —el mismo motor que gatea el
 *   resto del módulo— y las que no proceden se pintan deshabilitadas con la razón («la orden-2 la firma
 *   el secretario, y solo después de la firma del decisor»). Es el cambio de conducta VISIBLE de este
 *   plan y es deliberado: el funcionario tiene que saber que un paso del procedimiento existe aunque
 *   todavía no le toque. Lo que NO cambió: la bandeja sigue listando solo los lotes en los que este rol
 *   tiene turno (el filtro `lotesEnTurno` es un PREDICADO, no un gate, y por D-6 se queda fuera del
 *   motor), así que un lote en estado terminal sigue sin aparecer y sus botones sin pintarse.
 *
 *   VISOR DE ACTA BORRADOR gateado al TURNO: "Ver acta (borrador)" aparece SOLO si es el turno de ESE
 *   rol (`acciones.length > 0`) Y `lote.actaDisponible`; un lote fuera de turno NO ofrece el borrador
 *   (T-3.5-03). El acta se abre POR-PAR con guarda de par faltante (T-3.5-06: sin decisor resuelto no se
 *   dispara la llamada, evita `/sorteo/:amasId/undefined/acta`). La DEFINITIVA se consulta en las
 *   bandejas de Sorteados/Aprobados tras la firma del director.
 *
 *   FIRMA EN COMBO (Fase 03.12, RECE-05): además de la firma individual, la bandeja permite MARCAR
 *   varios sublotes y firmarlos en UNA sola petición (`SorteoService.firmarLotes`). Conviven a
 *   propósito (D-11): el combo NO reemplaza al botón de cada card — la firma de a uno sigue intacta y
 *   es el camino cuando algo hay que revisar despacio. Del combo, esta página solo pone el ESTADO y el
 *   RENDER; las reglas viven en `config/comboFirma` (qué se puede marcar, qué payload sale de las
 *   marcas, cómo se lee el reporte) y el tope de pares en `SorteoService` — aquí no se reescribe
 *   ningún número ni se recalcula el turno.
 *
 *     · La casilla vive en un GUTTER a la izquierda, FUERA del <summary> del <details>: dentro habría
 *       que llamar preventDefault para que el click no desplegara la card, y eso cancelaría también el
 *       toggle nativo de la casilla y su evento `change` (mismo layout que CollapseExpediente).
 *     · El DIRECTOR recibe una confirmación REFORZADA (D-05): el número que se le muestra es el de
 *       LOTES MASTER que va a aprobar en Asignaciones (`contarMasters`), no el de sublotes marcados.
 *     · Un 200 NO significa "todo firmado" (D-01/D-04): se ramifica por el REPORTE —firmados frente a
 *       omitidos— nunca por el status. El resumen del reporte sale en el aviso flotante (quick
 *       261028-kmg) y, si hubo omitidos, su detalle se pinta sobre la lista como CONTENIDO del
 *       resultado, con el motivo por par y la marca de los que alcanzaron a tocar Asignaciones.
 *
 *   El gating de UI es CONVENIENCIA, no seguridad: el backend deriva orden/actor del JWT y rechaza fuera
 *   de turno (T-3.5-05). Solo componentes compartidos del kit de Resolución (HeaderPage, Collapse, Boton,
 *   BadgePriority, EmptyState, Alert, ConfirmationDetail, Loading, DatetimeUtil) — sin tablas/botones/hex
 *   a mano, solo tokens daisyUI.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-24
 * Modificado por: Andrés Miño — 2026-08-06 (Fase 03.12: selección múltiple y firma en combo respetando
 *   el orden secuencial)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08: el campo de clave recibe el aviso
 *   del firmador apagado del acta y `sesionCentral`.)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 15 — D-10/D-20: el reporte pinta la
 *   causa de un fallo de firma (`etiquetaCausaFirma`) en una línea propia bajo el motivo; si la
 *   petición entera del combo falla por la firma, el aviso antepone «No se firmó ninguna acta.»; la
 *   clave se borra también tras un error y escribir en el campo retira el aviso.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, CR-02: la clave del combo se borra
 *   también al abrir y al cerrar su confirmación.)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el combo gana el estado E del campo —la
 *   clave rechazada se dice solo bajo él, con el foco—; el resumen del reporte va al aviso flotante y
 *   el panel de omitidos solo se pinta si los hay.)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import DialogoModal from "../components/common/DialogoModal";
import { useUser } from "../context/UserContext";
import { useModal } from "../hooks/useModal";
import { useToast } from "../hooks/useToast";
import {
  SorteoService,
  textoCasosSorteados,
  COMBO_FIRMA_MAX_PARES,
  type FirmarLotesPar,
  type FirmarLotesResult,
  type LoteEstado,
  type SorteoLote,
  type SorteoLoteCaso,
} from "../services/SorteoService";
import { ExpedienteDocumentos } from "../components/expediente/ExpedienteDocumentos";
import {
  ACCIONES_FIRMA_LOTE,
  resolveLoteTurnActions,
  type LoteTurnAction,
} from "../config/loteTurnActions";
import { aplicarVeredicto } from "../config/inboxActionStatusRules";
import { hechosDeLote } from "../config/accionesHechos";
import type { UserActions } from "../interfaces/IUser";
import type { ModalType } from "../interfaces/IModal";
import {
  clavePar,
  contarMasters,
  esSeleccionable,
  etiquetaCausaFirma,
  etiquetaMotivo,
  motivoNoSeleccionable,
  paresDesdeSeleccion,
  resumenReporte,
} from "../config/comboFirma";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import EmptyState from "../components/common/EmptyState";
import Alert, { type AlertVariant } from "../components/common/Alert";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";
import Collapse from "../components/collapse/Collapse";
import Boton from "../components/common/Boton";
import BadgePriority from "../components/common/BadgePriority";
import { MODAL_KEY as MODAL_FIRMA_ACTA } from "../components/modals/ModalFirmaActa";
import TablaAsignacionesLote from "../components/sorteo/TablaAsignacionesLote";
import CampoClaveCertificado from "../components/sorteo/CampoClaveCertificado";
import { useClaveDeFirma } from "../hooks/useClaveDeFirma";
import {
  AVISO_SIN_FIRMADOR,
  CONSECUENCIA_FALLO_FIRMA,
  ERROR_CLAVE_INCORRECTA,
  esClaveIncorrecta,
  esErrorDeFirma,
  mensajeDeFalloDeFirma,
} from "../config/firmaCopy";
import { DatetimeUtil } from "../utils/datetime.util";

// Collapse<T> exige permittedActions; esta bandeja renderiza sus propias acciones (por turno), así que
// pasa los tres contextos vacíos (igual que BandejaSalidaPage / SorteadosPage / AprobacionSorteoPage).
const EMPTY_COLLAPSE_ACTIONS = {
  collapseHeader: [],
  collapseBody: [],
  collapseBodyItem: [],
};

/**
 * Estado del lote → clave de color YA MAPEADA en BADGE_GROUPS (BadgePriority). Se reutilizan las claves
 * existentes (mismo mapeo que SorteadosPage) en vez de tocar el componente compartido. Cero hex.
 */
const ESTADO_BADGE: Record<LoteEstado, string> = {
  PENDIENTE: "media",
  PARCIALMENTE_FIRMADO: "media",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
};

/** Etiqueta de respaldo si el backend no mandara `sdetName` (degradación limpia). */
const ESTADO_LABEL: Record<LoteEstado, string> = {
  PENDIENTE: "Esperando la firma del decisor",
  PARCIALMENTE_FIRMADO: "Firma en curso",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

/** Estado efectivo del lote: si el backend no lo trae, se asume PENDIENTE (nunca rompe la vista). */
const estadoDe = (lote: SorteoLote): LoteEstado => lote.estado ?? "PENDIENTE";

/**
 * Las TRES acciones de firma de la secuencia, como acciones del menú, para que el motor pueda
 * pronunciarse sobre ellas igual que sobre las demás (Fase 03.18, Plan 09).
 *
 * 🔴 `as unknown as ModalType` CON EL MISMO MOTIVO QUE EN `useEpasInboxActions`: estos tres nombres
 * están en el union de ACCIONES del módulo, pero NO son modales del registry —la firma la abre
 * `ModalFirmaActa`, que es otro nombre—, y ampliar `ModalType` con algo que no es un modal rompería
 * la totalidad de `modalRegistry`.
 *
 * 🔴 `actiId` NEGATIVO: no vienen del backend de permisos, las inyecta la interfaz. Mismo patrón que
 * `APROBAR_EPAS_ACTION` y que la entrada al correctivo de `MisAsignadosPage`.
 *
 * Las etiquetas son LAS DE SIEMPRE, palabra por palabra: esta bandeja no estrena texto.
 */
const ACCIONES_FIRMA_ACTA: Record<LoteTurnAction, UserActions> = {
  firmarDecisor: {
    actiId: -190,
    submId: 9,
    actiName: "firmarDecisor" as unknown as ModalType,
    actiLabel: "Firmar el acta (decisor)",
    actiContext: "collapseBody",
    actiIconName: "firmar",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: true,
  },
  firmarSecretario: {
    actiId: -191,
    submId: 9,
    actiName: "firmarSecretario" as unknown as ModalType,
    actiLabel: "Revisar y firmar (secretario)",
    actiContext: "collapseBody",
    actiIconName: "firmar",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: true,
  },
  firmarDirector: {
    actiId: -192,
    submId: 9,
    actiName: "firmarDirector" as unknown as ModalType,
    actiLabel: "Revisar y firmar (director)",
    actiContext: "collapseBody",
    actiIconName: "firmar",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: true,
  },
};

/** Etiqueta de conteo del sublote (fuente única en SorteoService): distingue sorteados de excusados. */
const casosLabel = (lote: SorteoLote): string =>
  textoCasosSorteados(lote, "expediente");

/**
 * Variante del aviso flotante del reporte del combo. Se ramifica por el REPORTE, NUNCA por el status HTTP:
 * `firmados.length === 0` con un 200 es un desenlace NORMAL —todas fuera de turno, todas ya firmadas—
 * y pintarlo de rojo enseñaría al usuario a desconfiar de un resultado correcto. Lo único que merece
 * error es que algún omitido lleve `intentado`: ahí Asignaciones YA se tocó y hay que ir a revisarlo
 * allá antes de reintentar (D-04).
 */
const varianteReporte = (res: FirmarLotesResult): AlertVariant => {
  if (res.omitidos.some((o) => o.intentado)) return "error";
  return res.omitidos.length > 0 ? "warning" : "success";
};

/** Roles que tienen un turno en ESTA bandeja (el decisor firma en "Mis expedientes"). */
const SECRETARIO = "secretario abogado";
const DIRECTOR = "director";
const DECISOR = "funcionario decisor";

// Documentos del expediente de UN caso, para que el decisor los verifique ANTES de firmar. Encabezado
// del caso + la lista compartida ExpedienteDocumentos (que abre cada doc en el ModalDocumentViewer).
const CasoDocumentos = ({ caso }: { caso: SorteoLoteCaso }) => (
  <div className="rounded-xl border border-base-300 bg-base-100 p-3">
    <div className="mb-1 text-sm font-semibold">
      {caso.expNumber ?? `EPAS #${caso.eejeId ?? "—"}`}
      {caso.administrado && (
        <span className="ml-2 font-normal text-base-content/70">
          · {caso.administrado}
        </span>
      )}
    </div>
    {caso.eejeId != null ? (
      <ExpedienteDocumentos eejeId={caso.eejeId} />
    ) : (
      <span className="text-xs text-base-content/70">Sin EPAS aterrizado.</span>
    )}
  </div>
);

const ActasSorteoPage = () => {
  const { user } = useUser();
  const { openModal } = useModal();
  const { addToast } = useToast();
  // Estos tres van ANTES del retorno temprano para no sumar hooks condicionales (quick 261028-kmg).
  /** Estado E del campo del combo: la petición entera se rechazó por la clave (`APP-FIRMA-CLAVE-001`). */
  const [errorClaveCombo, setErrorClaveCombo] = useState(false);
  /**
   * Tras un rechazo de la clave, el foco vuelve al campo. Por ref de callback y no por efecto:
   * mientras confirma, `ConfirmationDetail` desmonta su contenido, así que el campo VUELVE A MONTARSE
   * al terminar y es en ese montaje cuando hay que enfocarlo (mismo patrón que AprobacionSorteoPage).
   */
  const pedirFocoClaveRef = useRef(false);
  const refCampoClave = useCallback((campo: HTMLInputElement | null) => {
    if (campo && pedirFocoClaveRef.current) {
      pedirFocoClaveRef.current = false;
      campo.focus();
    }
  }, []);

  if (!user) {
    return null;
  }

  const rolName = user.rolName ?? "";
  const role = rolName.trim().toLowerCase();

  const isSecretario = role === SECRETARIO;
  const isDirector = role === DIRECTOR;
  const isDecisor = role === DECISOR;

  // Los tres roles de la firma tienen cola aquí. El decisor usa un endpoint ACOTADO a SUS sublotes
  // (GET /sorteo/mis-lotes), no la bandeja completa del secretario/director (GET /sorteo/lotes).
  const tieneBandeja = isSecretario || isDirector || isDecisor;

  const [lotes, setLotes] = useState<SorteoLote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- COMBO DE FIRMA (Fase 03.12) ---
  // Selección por CLAVE DE PAR (`clavePar`), no por índice ni por objeto: la misma cadena que ya usa el
  // `key` de cada Collapse, para que un refetch que reordene la bandeja no mueva las marcas de sitio.
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [enviandoCombo, setEnviandoCombo] = useState(false);
  // Clave del certificado del firmante: UNA para todo el combo (mismo firmante, mismo certificado).
  const clave = useClaveDeFirma();
  const [confirmCombo, setConfirmCombo] = useState(false);
  // Error del envío: lo pone el padre en ConfirmationDetail (contrato parent-owns-error), que lo dice en
  // el aviso flotante y bloquea el reintento.
  const [comboMessage, setComboMessage] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);
  // Reporte del último combo. Su RESUMEN sale en el aviso flotante; el detalle de los omitidos se pinta
  // sobre la lista y persiste hasta que el usuario lo descarta: con hasta veinte pares y un motivo por
  // par, un aviso flotante no alcanza (T-3.12-23).
  const [reporte, setReporte] = useState<FirmarLotesResult | null>(null);

  const fetchLotes = useCallback(async () => {
    if (!tieneBandeja) {
      setLotes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // El decisor pide SOLO lo suyo (mis-lotes); el secretario/director, todos (lotes).
      const data = isDecisor
        ? await SorteoService.misLotes()
        : await SorteoService.lotes();
      setLotes(data);
    } catch (err) {
      setError(
        mensajeParaUsuario(err, "No se pudieron cargar las actas de sorteo. Intente más tarde."),
      );
    } finally {
      setLoading(false);
    }
  }, [tieneBandeja, isDecisor]);

  useEffect(() => {
    void fetchLotes();
  }, [fetchLotes]);

  const refreshLotes = useCallback(async () => {
    await fetchLotes();
  }, [fetchLotes]);

  // Solo entran a la lista los lotes en los que ESTE rol tiene turno (o, para el director, todos los que
  // ve su bandeja): la bandeja de actas es la superficie de firma, no una consulta. El resto (aprobados/
  // rechazados/fuera de turno) se sigue viendo en Sorteados/Aprobados.
  const lotesEnTurno = useMemo(
    () =>
      lotes.filter((lote) => resolveLoteTurnActions(lote, rolName).length > 0),
    [lotes, rolName],
  );

  // ACTAS FINALES: lotes ya cerrados por la firma del director (estado APROBADO = orden-3 sellada). Es una
  // sección de SOLO CONSULTA con el acta DEFINITIVA (readActaByLote ya la prefiere). Aparece para el rol
  // según lo que ya cargó (decisor: misLotes; secretario/director: lotes).
  const lotesFinales = useMemo(
    () => lotes.filter((lote) => estadoDe(lote) === "APROBADO"),
    [lotes],
  );

  // Los lotes que el usuario PUEDE marcar: `esSeleccionable` (comboFirma) = está en su turno Y tiene
  // decisor resuelto. Es también el conjunto exacto de «seleccionar todo lo de mi turno».
  const lotesSeleccionables = useMemo(
    () => lotesEnTurno.filter((lote) => esSeleccionable(lote, rolName)),
    [lotesEnTurno, rolName],
  );

  // EL PAYLOAD. El contador que ve el usuario sale de ESTA MISMA lista, no de `seleccion.size`: si
  // divergieran, sería porque hay una marca que no produce par válido (huérfana tras un refetch, o un
  // lote que dejó de ser elegible) y el usuario estaría viendo un número que no se va a enviar.
  const paresSeleccionados = useMemo(
    () => paresDesdeSeleccion(lotesEnTurno, seleccion, rolName),
    [lotesEnTurno, seleccion, rolName],
  );
  const totalSeleccionados = paresSeleccionados.length;

  // ¿Ya está marcado TODO lo seleccionable? Entonces el mismo botón limpia en vez de volver a marcar.
  const todoMiTurnoMarcado =
    lotesSeleccionables.length > 0 &&
    lotesSeleccionables.every((lote) => seleccion.has(clavePar(lote)));

  // El tope es el del servicio (el MISMO número que valida el DTO del backend), nunca uno propio.
  const excedeTope = totalSeleccionados > COMBO_FIRMA_MAX_PARES;

  /** Marca/desmarca UN sublote. Set INMUTABLE: se copia, se muta la copia y se devuelve (nunca en sitio). */
  const toggleSeleccion = (clave: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  };

  /** «Seleccionar todo lo de mi turno» / «Quitar la selección», según lo que ya esté marcado. */
  const handleSeleccionarTodoMiTurno = () => {
    setSeleccion(
      todoMiTurnoMarcado
        ? new Set()
        : new Set(lotesSeleccionables.map((lote) => clavePar(lote))),
    );
  };

  /**
   * Copy de la confirmación, DISTINTO por rol (mismo precedente que `firmaCopyPorRol` de ModalFirmaActa).
   *
   * La del DIRECTOR es REFORZADA (D-05) y no por énfasis retórico: su firma es la orden 3 y dispara el
   * `approveMaster` de Asignaciones, que opera por MASTER y no por sublote. Por eso el número destacado
   * es `contarMasters(pares)` y no la cantidad de marcas: tres casillas pueden cerrar tres masters
   * COMPLETOS que incluyan sublotes de otros decisores. Los otros dos roles no aprueban nada en el
   * sistema externo, así que su confirmación es la normal.
   */
  const comboCopy = useMemo(() => {
    const n = paresSeleccionados.length;
    const masters = contarMasters(paresSeleccionados);
    const actas = `${n} ${n === 1 ? "acta" : "actas"}`;

    if (isDirector) {
      return {
        headerTitle: "Aprobar y firmar en combo (director)",
        statusCopy: `Va a aprobar ${masters} ${masters === 1 ? "lote master" : "lotes master"} en Asignaciones`,
        descriptionCopy:
          `Firmar como director es la orden 3 de 3: cierra el acta y APRUEBA en Asignaciones los lotes master de ${actas}. ` +
          "Aprobar en Asignaciones es un efecto en OTRO sistema y es IRREVERSIBLE. " +
          "Aprobar un master cierra ese master COMPLETO, incluidos los sublotes de otros decisores que pudiera contener. " +
          "Si algo falla a mitad del envío, lo que ya se aprobó allá se queda aprobado: por eso el reporte final indica, lote por lote, cuáles alcanzaron a tocar Asignaciones.",
        informationData: {
          "Sublotes seleccionados": n,
          "Lotes master que se aprobarán en Asignaciones": masters,
          "Orden de la secuencia": "3 de 3 — director (cierra el acta)",
        } as Record<string, string | number>,
        confirmButtonText: "Sí, aprobar y firmar",
        confirmButtonLoadingText: "Aprobando y firmando…",
      };
    }

    if (isSecretario) {
      return {
        headerTitle: "Firmar en combo (secretario)",
        statusCopy: `Va a firmar ${actas}`,
        descriptionCopy:
          "Se aplicará la firma de la orden 2 de 3 (secretario abogado) sobre las actas seleccionadas. " +
          "Después le toca al director, cuya firma aprueba el lote master en Asignaciones. " +
          "El servidor procesa acta por acta: las que no correspondan se omiten con su motivo y el resto sí se firma.",
        informationData: {
          "Actas seleccionadas": n,
          "Orden de la secuencia": "2 de 3 — secretario abogado",
          "Después firma": "El director (su firma aprueba en Asignaciones)",
        } as Record<string, string | number>,
        confirmButtonText: "Sí, firmar",
        confirmButtonLoadingText: "Firmando…",
      };
    }

    return {
      headerTitle: "Firmar en combo (decisor)",
      statusCopy: `Va a firmar ${actas}`,
      descriptionCopy:
        "Se aplicará la firma de la orden 1 de 3 (funcionario decisor) sobre las actas seleccionadas. " +
        "Después le toca al secretario abogado y, por último, al director. " +
        "El servidor procesa acta por acta: las que no correspondan se omiten con su motivo y el resto sí se firma.",
      informationData: {
        "Actas seleccionadas": n,
        "Orden de la secuencia": "1 de 3 — funcionario decisor",
        "Después firma": "El secretario abogado",
      } as Record<string, string | number>,
      confirmButtonText: "Sí, firmar",
      confirmButtonLoadingText: "Firmando…",
    };
  }, [paresSeleccionados, isDirector, isSecretario]);

  /**
   * Abre la confirmación del combo con el campo VACÍO y sin el error previo: una clave tecleada en
   * una apertura anterior no se hereda (UI-SPEC §2.3).
   */
  const handleAbrirConfirmacionCombo = () => {
    if (paresSeleccionados.length === 0) return;
    clave.limpiar();
    setComboMessage(null);
    setErrorClaveCombo(false);
    setConfirmCombo(true);
  };

  /**
   * Cierra la confirmación del combo y olvida la clave tecleada y el fallo anterior (UI-SPEC §2.3),
   * igual que `BandejaSalidaPage.cerrarConfirmacion`. Sin esto, cancelar dejaba la clave en el estado
   * de la página el resto de su vida, lista para la siguiente apertura.
   */
  const cerrarConfirmCombo = () => {
    setConfirmCombo(false);
    setComboMessage(null);
    setErrorClaveCombo(false);
    clave.limpiar();
  };

  /**
   * Envía el combo. Contrato parent-owns-error: el ERROR REAL (4xx de validación/rol/guards, o red)
   * deja el modal ABIERTO con su mensaje (aviso flotante); la clave rechazada, solo en el campo. El
   * ÉXITO cierra, limpia la selección, dice el resumen del reporte en el aviso flotante, guarda el
   * detalle de omitidos y REFRESCA la bandeja (los `firmados` cambian de estado y deben desaparecer
   * de la cola).
   *
   * 🔴 Un 200 con `firmados.length === 0` NO entra por aquí como error: es un desenlace normal y se
   * publica como reporte, igual que un parcial. El `catch` es SOLO para los 4xx de verdad.
   */
  const handleConfirmarCombo = async () => {
    setComboMessage(null);
    setErrorClaveCombo(false);
    setReporte(null);
    setEnviandoCombo(true);
    try {
      const res = await SorteoService.firmarLotes(
        paresSeleccionados,
        undefined,
        clave.claveParaEnviar,
      );
      setConfirmCombo(false);
      setSeleccion(new Set());
      addToast(varianteReporte(res), resumenReporte(res));
      setReporte(res);
      await refreshLotes();
    } catch (err) {
      if (esClaveIncorrecta(err)) {
        // Regla de mensajes 261028-kmg: la clave rechazada se dice SOLO bajo el campo (estado E, con
        // el foco), sin el mensaje de la confirmación. El botón queda apagado igual —la clave se
        // vacía en el `finally` y `confirmDisabled` lo apaga— y escribir lo rearma.
        pedirFocoClaveRef.current = true;
        setErrorClaveCombo(true);
        return;
      }
      setComboMessage({
        variant: "error",
        // Petición rechazada ENTERA por la firma (p. ej. 409 de sesión): no se firmó NINGUNA acta, y
        // el aviso lo dice antes de la causa (UI-SPEC §7.2, §10.1).
        message: esErrorDeFirma(err)
          ? mensajeDeFalloDeFirma(CONSECUENCIA_FALLO_FIRMA.combo, err)
          : mensajeParaUsuario(err, "No se pudo enviar la firma en combo. Intente más tarde."),
      });
    } finally {
      // Una sola clave para N actas: se descarta al terminar el envío, con éxito O con error
      // (UI-SPEC §2.3 regla 2). Para reintentar se escribe de nuevo.
      clave.limpiar();
      setEnviandoCombo(false);
    }
  };

  /**
   * Escribir en el campo de clave retira el mensaje de la petición rechazada y la línea del estado E:
   * `ConfirmationDetail` apaga su botón mientras haya mensaje, y es lo único que vuelve a armarlo
   * (UI-SPEC §7.2, §6).
   */
  const editarClaveCombo = (valor: string) => {
    clave.setClave(valor);
    setComboMessage(null);
    setErrorClaveCombo(false);
  };

  /** Nombre del decisor de un par del reporte, buscado en la bandeja ya cargada (degradación limpia). */
  const decisorDelPar = (par: FirmarLotesPar): string => {
    const lote = lotes.find(
      (l) => l.amasId === par.amasId && l.decisorUserId === par.decisorUserId,
    );
    return lote?.decisorName ?? `Decisor #${par.decisorUserId}`;
  };

  // --- Abre el ModalFirmaActa (vista previa del acta + firmar) para CUALQUIER rol en su turno: DECISOR
  // (orden-1), SECRETARIO (orden-2) o DIRECTOR (orden-3). El backend deriva el ORDEN del rol del JWT; el
  // copy honesto (firmado:false = firmador diferido) vive en el modal. GUARDA de par faltante (Camino Y):
  // sin decisor resuelto no se abre el modal (evita PATCH /sorteo/:amasId/undefined/firmar). ---
  const handleAbrirFirmaActa = (lote: SorteoLote) => {
    if (lote.decisorUserId == null) {
      addToast(
        "warning",
        "Este lote no tiene un decisor resuelto; no se puede firmar por par.",
      );
      return;
    }
    openModal(
      MODAL_FIRMA_ACTA,
      { amasId: lote.amasId, decisorUserId: lote.decisorUserId },
      { refetchFn: refreshLotes },
    );
  };

  /**
   * Abre el acta BORRADOR del lote en el visor PDF compartido, POR-PAR. Solo se ofrece cuando es el
   * TURNO de ESTE rol y el documento existe (`actaDisponible`); aun así se conserva la degradación
   * (404 → aviso) y la guarda de par faltante (sin decisor → no se dispara la llamada).
   */
  const handleVerActaBorrador = async (lote: SorteoLote) => {
    if (lote.decisorUserId == null) {
      addToast(
        "warning",
        `El acta del lote #${lote.amasId} no tiene un decisor resuelto y no puede abrirse por par.`,
      );
      return;
    }
    try {
      const acta = await SorteoService.actaDeLote(
        lote.amasId,
        lote.decisorUserId,
      );
      openModal("documentViewer", {
        docName: acta.docName ?? `Acta de Sorteo (D2, borrador) — Lote #${lote.amasId}`,
        docUrl: acta.docUrl,
      });
    } catch {
      addToast(
        "info",
        `El acta (borrador) del lote #${lote.amasId} todavía no está disponible. Intente en unos momentos.`,
      );
    }
  };

  /**
   * Abre el acta FINAL (definitiva) de un lote ya cerrado (estado APROBADO). readActaByLote prefiere la
   * definitiva, así que se sirve la versión final. Solo consulta; misma guarda de par + degradación 404.
   */
  const handleVerActaFinal = async (lote: SorteoLote) => {
    if (lote.decisorUserId == null) {
      addToast(
        "warning",
        `El acta del lote #${lote.amasId} no tiene un decisor resuelto y no puede abrirse por par.`,
      );
      return;
    }
    try {
      const acta = await SorteoService.actaDeLote(
        lote.amasId,
        lote.decisorUserId,
      );
      openModal("documentViewer", {
        docName:
          acta.docName ?? `Acta de Sorteo (D2, final) — Lote #${lote.amasId}`,
        docUrl: acta.docUrl,
      });
    } catch {
      addToast(
        "info",
        `El acta final del lote #${lote.amasId} todavía no está disponible.`,
      );
    }
  };

  /**
   * Cabecera de la card del lote: identificación (nº de lote, decisor del sublote, casos, fecha) +
   * badge de estado + (solo en TURNO y con acta) el visor del borrador. La firma vive en el CUERPO,
   * después del reparto: primero se revisa a quién le tocó cada expediente, luego se firma.
   */
  const renderLoteHeader = (
    lote: SorteoLote,
    i: number,
    acciones: LoteTurnAction[],
  ): ReactNode => {
    const estado = estadoDe(lote);
    // Borrador gateado al TURNO (T-3.5-03): solo si es el turno de ESTE rol y el documento existe.
    const puedeVerBorrador = acciones.length > 0 && lote.actaDisponible;

    return (
      <div className="app-collapse-alert-header">
        <div className="app-inbox-document-header-left">
          <div className="app-inbox-document-info">
            <h3 className="app-collapse-alert-title app-inbox-document-name">
              <span className="app-collapse-alert-index">{i + 1}.</span>
              Lote #{lote.amasId}
            </h3>
            <div className="app-inbox-document-meta">
              <span className="app-inbox-document-count">
                {lote.decisorName ??
                  (lote.decisorUserId != null
                    ? `Decisor #${lote.decisorUserId} — nombre no disponible`
                    : "Decisor no resuelto")}
              </span>
              <span className="app-inbox-document-count">
                {casosLabel(lote)}
              </span>
              {lote.sorteoAt && (
                <span className="app-inbox-document-date">
                  Sorteado: {DatetimeUtil.formatDate(lote.sorteoAt)}
                </span>
              )}
              <span className="app-inbox-document-count font-semibold">
                Abra el lote para revisar el reparto y firmar el acta
              </span>
            </div>
          </div>
        </div>

        <div className="app-collapse-alert-header-right app-inbox-document-header-right">
          {/* Ver acta (borrador) SOLO en el turno de ESTE rol y si el documento existe: sin el gate
              prometería un 404 y filtraría el borrador fuera de turno (T-3.5-03). */}
          {puedeVerBorrador && (
            <div className="flex flex-wrap gap-2">
              <Boton
                estilos="btn btn-sm btn-ghost text-primary"
                texto="Ver acta (borrador)"
                deshabilitado={false}
                onClick={(e) => {
                  // El botón vive dentro del <summary>: sin preventDefault su click desplegaría la card.
                  e?.preventDefault();
                  e?.stopPropagation();
                  void handleVerActaBorrador(lote);
                }}
              />
            </div>
          )}
          <BadgePriority
            text={lote.sdetName ?? ESTADO_LABEL[estado]}
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
   * Cuerpo de la card: EL REPARTO (a quién le tocó cada expediente) y, DEBAJO, la acción de firma del
   * TURNO. El orden ES la revisión previa: primero se ve el reparto, luego se firma.
   *   · secretario en turno → "Revisar y firmar (secretario)" abre ModalFirmaActa (preview + firma
   *     orden-2) vía handleAbrirFirmaActa; los datos del acta se auto-derivan en el backend.
   *   · director en turno → "Revisar y firmar (director)" abre ModalFirmaActa (preview + firma orden-3).
   * Los botones viven FUERA del <summary> (Collapse los renderiza en el contenido): sin preventDefault.
   */
  const renderLoteContent = (lote: SorteoLote): ReactNode => {
    // 🔴 EL ÚNICO GATE DE BOTÓN DE LOS TRES CONSUMIDORES DEL TURNO, Y EL ÚNICO QUE CAMBIA DE CONDUCTA
    // (Fase 03.18, Plan 09). Antes se leía `acciones.includes("firmarSecretario")` y el botón que no
    // tocaba NO EXISTÍA; ahora cada una de las tres pasa por `aplicarVeredicto` y la que no toca sale
    // APAGADA CON SU MOTIVO. La razón es la de toda la fase: un funcionario tiene que saber que un
    // paso del procedimiento existe aunque todavía no le toque.
    //
    // El que no va a servir NUNCA en este punto —los lotes en estado terminal— sigue sin mostrarse,
    // porque un lote terminal no entra en `lotesEnTurno` y esta card no llega a pintarse.
    //
    // 🔴 EL FILTRO DE LA BANDEJA NO SE TOCA (`lotesEnTurno`, más arriba) NI LA SELECCIÓN DEL COMBO:
    // son PREDICADO y no gate, y por D-6 se quedan fuera del motor. Si el filtro dejara de filtrar,
    // la bandeja pasaría a listar lotes que no son de nadie.
    const ctxFirma = { rol: rolName, hechos: hechosDeLote(lote) };
    const firmas = ACCIONES_FIRMA_LOTE.flatMap((nombre) => {
      const pintada = aplicarVeredicto(ACCIONES_FIRMA_ACTA[nombre], ctxFirma);
      return pintada ? [{ nombre, pintada }] : [];
    });

    // Es su turno SII el motor la deja HABILITADA — nunca «visible», que hoy es casi siempre.
    const enTurno = (nombre: LoteTurnAction): boolean =>
      firmas.some((f) => f.nombre === nombre && f.pintada.actiIsDisabled !== true);
    const esDecisor = enTurno("firmarDecisor");
    const casos = lote.casos ?? [];

    return (
      <div className="app-collapse-alert-body">
        {/* SIN `app-inbox-case-details`: trae flex-row + grid-column propios y pisaría este flex-col. */}
        <div className="flex flex-col gap-4 p-3 text-sm">
          {/* EL ACTO QUE SE VA A FIRMAR: el reparto, expediente por expediente. Mismo componente que ve
              el director en su bandeja de aprobación. */}
          <TablaAsignacionesLote casos={casos} totalCasos={lote.totalCasos} />

          {/* Verificación de DOCUMENTOS del expediente por caso — el decisor los revisa antes de firmar. */}
          {esDecisor && casos.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary/90">
                Documentos del expediente
              </span>
              {casos.map((caso) => (
                <CasoDocumentos
                  key={caso.eejeId ?? caso.expNumber}
                  caso={caso}
                />
              ))}
            </div>
          )}

          {/* La decisión, DESPUÉS del reparto: LOS TRES PASOS de la secuencia, en su orden, con el
              que toca encendido y los que no, apagados con su motivo. */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-base-300 pt-3">
            {firmas.map(({ nombre, pintada }) => {
              const apagada = pintada.actiIsDisabled === true;
              return (
                // El `title` va en el <span> y no en el <button>: un botón deshabilitado no recibe
                // eventos de puntero y su propio tooltip nunca llegaría a mostrarse (mismo motivo por
                // el que la casilla del combo lleva su motivo en el <span> que la envuelve).
                <span
                  key={nombre}
                  className="inline-flex"
                  title={apagada ? pintada.actiDisabledHint : undefined}
                >
                  <Boton
                    estilos={`btn btn-sm ${apagada ? "btn-ghost" : "btn-primary"}`}
                    texto={pintada.actiLabel}
                    deshabilitado={apagada}
                    onClick={() => handleAbrirFirmaActa(lote)}
                  />
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-data-container">
      <HeaderPage
        headerKicker="Ejecución — DME"
        title="Actas de Sorteo"
        subtitle="Los lotes sorteados que esperan su firma del acta D2."
      />

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-primary/95">
              Lotes esperando su firma
            </h2>
            <span className="badge badge-primary badge-outline whitespace-nowrap">
              {lotesEnTurno.length} lote(s)
            </span>
            {/* El contador sale de `paresSeleccionados`, la MISMA lista que se envía. */}
            {totalSeleccionados > 0 && (
              <span className="badge badge-secondary badge-outline whitespace-nowrap">
                {totalSeleccionados} seleccionada(s)
              </span>
            )}
          </div>

          {tieneBandeja && (
            <div className="flex flex-wrap gap-2">
              {/* El combo vive en la CABECERA porque la selección abarca varias cards (mismo sitio que
                  «Sortear seleccionados» de la Bandeja de Entrada). La firma INDIVIDUAL sigue en el
                  cuerpo de cada card, intacta: conviven (D-11). */}
              <Boton
                estilos="btn btn-sm btn-ghost text-primary"
                texto={
                  todoMiTurnoMarcado
                    ? "Quitar la selección"
                    : "Seleccionar todo lo de mi turno"
                }
                deshabilitado={lotesSeleccionables.length === 0 || enviandoCombo}
                onClick={handleSeleccionarTodoMiTurno}
              />
              {/* El tope NO se reescribe aquí: es COMBO_FIRMA_MAX_PARES, el mismo que valida el DTO
                  del backend. Por encima, el botón se apaga y el aviso explica cómo enviar en tandas. */}
              <Boton
                estilos="btn btn-sm btn-primary"
                texto={`Firmar seleccionadas${
                  totalSeleccionados > 0 ? ` (${totalSeleccionados})` : ""
                }`}
                deshabilitado={
                  totalSeleccionados === 0 || enviandoCombo || excedeTope
                }
                onClick={handleAbrirConfirmacionCombo}
              />
              <Boton
                estilos="btn btn-sm btn-ghost text-primary"
                texto="Actualizar"
                deshabilitado={loading || enviandoCombo}
                onClick={() => {
                  void refreshLotes();
                }}
              />
            </div>
          )}
        </div>

        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          {!tieneBandeja && (
            <EmptyState text="Su rol no participa en la firma del acta de sorteo." />
          )}

          {/* Tope por envío: NO es un límite estético ni un número propio de la pantalla. Es
              COMBO_FIRMA_MAX_PARES del servicio, el mismo que valida el DTO del backend, y sale de
              dividir el timeout de la petición entre el peor caso por par. */}
          {excedeTope && (
            <div className="mb-3">
              <Alert
                variant="warning"
                message={`Seleccionó ${totalSeleccionados} actas y el máximo por envío es ${COMBO_FIRMA_MAX_PARES}. Cada lote del director dispara una llamada al servicio externo de Asignaciones y el navegador tiene un tiempo máximo de espera, así que hay que enviarlas en tandas: desmarque hasta quedar en ${COMBO_FIRMA_MAX_PARES} o menos y repita la operación con el resto.`}
              />
            </div>
          )}

          {/* REPORTE DEL COMBO (D-01): su resumen ya salió en el aviso flotante (quick 261028-kmg). Aquí
              queda el DETALLE de lo que no se firmó —contenido del resultado, no un aviso—, solo si
              hubo omitidos; va sobre la lista y persiste hasta que el usuario lo descarta. */}
          {reporte && reporte.omitidos.length > 0 && (
            <div className="mb-3 flex flex-col gap-2">
              <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary/90">
                  Actas que no se firmaron
                </span>
                <div className="mt-2 flex flex-col gap-2">
                  {reporte.omitidos.map((omitido) => (
                    <div
                      key={`omitido-${omitido.par.amasId}-${omitido.par.decisorUserId}`}
                      className="flex flex-col gap-1 border-t border-base-300 pt-2 first:border-t-0 first:pt-0"
                    >
                      <span className="text-sm font-semibold">
                        Lote #{omitido.par.amasId}
                        <span className="ml-2 font-normal text-base-content/70">
                          · {decisorDelPar(omitido.par)}
                        </span>
                      </span>
                      {/* El copy sale del catálogo CERRADO de motivos; el `detalle` del backend se
                          muestra aparte como texto plano, nunca interpolado (T-3.12-19). */}
                      <span className="text-xs">
                        {etiquetaMotivo(omitido.motivo)}
                      </span>
                      {/* La CAUSA de un fallo de firma (FIRMA_FALLIDA / FIRMA_NO_INTENTADA), en su
                          propia línea y también de catálogo cerrado: nunca sale del `detalle`. */}
                      {omitido.causaFirma && (
                        <span className="text-xs">
                          {etiquetaCausaFirma(omitido.causaFirma)}
                        </span>
                      )}
                      {omitido.detalle && (
                        <span className="text-xs text-base-content/70">
                          {omitido.detalle}
                        </span>
                      )}
                      {omitido.motivo === "CASOS_SIN_ACEPTAR" &&
                        omitido.casosPendientes != null && (
                          <span className="text-xs text-base-content/70">
                            Expedientes pendientes de aceptar o excusar:{" "}
                            {omitido.casosPendientes}
                          </span>
                        )}
                      {/* El código HTTP de Asignaciones (`statusCode`) NO se pinta: es detalle
                          técnico y va a la consola/los logs, no al panel. */}
                      {/* Lo que NO puede pasar desapercibido: el externo ya se tocó por este par.
                          Un fallo de firma nunca lo pinta: la firma va antes del approve y viaja
                          con `intentado: false`. */}
                      {omitido.intentado && (
                        <span className="badge badge-error badge-outline h-auto whitespace-normal py-1 text-left">
                          Asignaciones ya se tocó por este lote: revíselo allá
                          antes de reintentar
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Boton
                  estilos="btn btn-sm btn-ghost"
                  texto="Descartar el reporte"
                  deshabilitado={false}
                  onClick={() => setReporte(null)}
                />
              </div>
            </div>
          )}

          {tieneBandeja && error && !loading && (
            <Alert variant="error" message={error} />
          )}

          {tieneBandeja && !loading && !error && lotesEnTurno.length === 0 && (
            <EmptyState text="No hay lotes esperando su firma en este momento." />
          )}

          {tieneBandeja && lotesEnTurno.length > 0 && (
            <div className="app-data-list mb-2">
              {lotesEnTurno.map((lote, i) => {
                // El turno se LEE de resolveLoteTurnActions (Plan 03), NO se recalcula aquí. Desde el
                // Plan 09 ese resolver es un adaptador sobre el motor, pero lo que devuelve sigue
                // siendo lo mismo: las acciones de firma HABILITADAS para este rol.
                //
                // 🔴 SIGUE ALIMENTANDO AL ENCABEZADO Y NO A LOS BOTONES DE FIRMA. Aquí se conserva
                // porque `renderLoteHeader` lo usa para gatear «Ver acta (borrador)» al TURNO
                // (T-3.5-03): sin ese gate se prometería un 404 y se filtraría el borrador fuera de
                // turno. Ése es un límite de contenido, no el paso del procedimiento que esta fase
                // saca a la luz, y por eso no cambia de conducta.
                const acciones = resolveLoteTurnActions(lote, rolName);
                const clave = clavePar(lote);
                const marcable = esSeleccionable(lote, rolName);
                const motivo = motivoNoSeleccionable(lote, rolName);
                const decisor =
                  lote.decisorName ??
                  (lote.decisorUserId != null
                    ? `decisor #${lote.decisorUserId}`
                    : "decisor no resuelto");

                return (
                  // FILA = [casilla en el gutter izquierdo] + [card ocupando el resto del ancho].
                  // La casilla queda FUERA del <details> a propósito: dentro del <summary> habría que
                  // llamar preventDefault para que su click no desplegara la card, y eso cancelaría
                  // también su propio toggle nativo y su evento `change`. Es el mismo layout que
                  // CollapseExpediente, y es el motivo por el que «Ver acta (borrador)» —que sí vive
                  // dentro del <summary>— necesita preventDefault y una casilla ahí no funcionaría.
                  <div
                    key={clave}
                    className="app-inbox-alert-row flex items-center gap-3"
                  >
                    {/* El `title` va en el <span>, no en el <input>: un input deshabilitado no recibe
                        eventos de puntero y su propio tooltip nunca llegaría a mostrarse. */}
                    <span
                      className="app-collapse-select inline-flex shrink-0 items-center"
                      title={motivo}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm"
                        checked={seleccion.has(clave)}
                        disabled={!marcable || enviandoCombo}
                        aria-label={`Seleccionar el acta del lote #${lote.amasId} — ${decisor}`}
                        onChange={() => {
                          if (!marcable || enviandoCombo) return;
                          toggleSeleccion(clave);
                        }}
                      />
                    </span>

                    <Collapse<SorteoLote>
                      data={lote}
                      index={i}
                      permittedActions={EMPTY_COLLAPSE_ACTIONS}
                      headerRender={(l, idx) =>
                        renderLoteHeader(l, idx, acciones)
                      }
                      contentRender={(l) => renderLoteContent(l)}
                      className="app-collapse-alert app-inbox-alert-item min-w-0 flex-1"
                      summaryClassName="app-collapse-alert-summary"
                      contentClassName="app-collapse-alert-content"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ACTAS FINALES FIRMADAS: sección de SOLO CONSULTA con los lotes ya cerrados por la firma del
          director (estado APROBADO). Ofrece el acta DEFINITIVA (readActaByLote la prefiere). */}
      {tieneBandeja && lotesFinales.length > 0 && (
        <section className="app-modules-panel app-data-panel app-shell-surface mt-4 overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
          <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-primary/95">
                Actas finales firmadas
              </h2>
              <span className="badge badge-success badge-outline whitespace-nowrap">
                {lotesFinales.length} acta(s)
              </span>
            </div>
          </div>

          <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
            <div className="app-data-list mb-2 flex flex-col gap-2">
              {lotesFinales.map((lote) => (
                <div
                  key={`final-${lote.amasId}-${lote.decisorUserId ?? "?"}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-100 px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">
                      Lote #{lote.amasId}
                      <span className="ml-2 font-normal text-base-content/70">
                        ·{" "}
                        {lote.decisorName ??
                          (lote.decisorUserId != null
                            ? `Decisor #${lote.decisorUserId}`
                            : "Decisor no resuelto")}
                      </span>
                    </span>
                    <span className="text-xs text-base-content/70">
                      {casosLabel(lote)}
                      {lote.sorteoAt &&
                        ` · Sorteado: ${DatetimeUtil.formatDate(lote.sorteoAt)}`}
                    </span>
                  </div>
                  {lote.decisorUserId != null && lote.actaDisponible !== false ? (
                    <Boton
                      estilos="btn btn-sm btn-outline btn-primary"
                      texto="Ver acta (final)"
                      deshabilitado={false}
                      onClick={() => void handleVerActaFinal(lote)}
                    />
                  ) : (
                    <span className="text-xs italic text-base-content/50">
                      Acta no disponible
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONFIRMACIÓN DEL COMBO. El padre es dueño del error: ante un 4xx real el modal se queda abierto
          y el mensaje sale en el aviso flotante; solo el éxito lo cierra. El copy del DIRECTOR es
          reforzado (D-05). */}
      {confirmCombo && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={cerrarConfirmCombo}
          ocupado={enviandoCombo}
        >
          <ConfirmationDetail
            headerKicker="Actas de Sorteo — firma en combo"
            headerTitle={comboCopy.headerTitle}
            statusCopy={comboCopy.statusCopy}
            descriptionCopy={comboCopy.descriptionCopy}
            informationData={comboCopy.informationData}
            onConfirm={handleConfirmarCombo}
            onClose={cerrarConfirmCombo}
            message={comboMessage ?? undefined}
            confirmButtonText={comboCopy.confirmButtonText}
            confirmButtonLoadingText={comboCopy.confirmButtonLoadingText}
            confirmDisabled={!clave.listaParaEnviar}
          >
            {/* Una sola clave para los N sublotes: mismo firmante, mismo certificado. Solo aparece
                si el firmador está encendido (GET /sorteo/firma/modo). */}
            <CampoClaveCertificado
              requerida={clave.requerida}
              value={clave.clave}
              onChange={editarClaveCombo}
              disabled={enviandoCombo}
              avisoSinFirmador={AVISO_SIN_FIRMADOR.acta}
              sesionCentral={clave.sesionCentral}
              cargando={clave.cargando}
              errorModo={clave.errorModo}
              onReintentarModo={clave.reintentarModo}
              error={errorClaveCombo ? ERROR_CLAVE_INCORRECTA : undefined}
              inputRef={refCampoClave}
            />
          </ConfirmationDetail>
        </DialogoModal>
      )}

      {/* La firma de TODOS los roles (decisor orden-1, secretario orden-2, director orden-3) vive en el
          ModalFirmaActa (vista previa del acta + firmar), abierto por handleAbrirFirmaActa vía
          openModal("firmaActa", ...). Los datos del acta se auto-derivan en el backend. */}

      {loading && <Loading />}
    </div>
  );
};

export default ActasSorteoPage;
