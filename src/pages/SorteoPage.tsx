/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Bandeja de Sorteo del secretario (marcar revisado + sortear en lote o individual)
 * Archivo: SorteoPage.tsx
 * Responsabilidad: Bandeja del SECRETARIO, organizada POR EXPEDIENTE. Lista los expedientes que el
 *   DIRECTOR le REMITIÓ (directorApproved) y, DENTRO de cada uno, sus CASOS — un caso = un
 *   administrado de ese expediente (una fila EPAS: exp_id + admi_id). La bandeja NO se divide por
 *   administrado: el expediente es el contenedor y los casos van anidados.
 *
 *   Selección de DOS NIVELES para armar la tanda del sorteo:
 *     - checkbox del EXPEDIENTE → todos sus casos sorteables (indeterminado si solo algunos).
 *     - checkbox del CASO       → ese caso.
 *
 *   El gate RECE-08 se mantiene intacto, y por CASO (no por expediente):
 *     1. "Por revisar" → el caso está en RECIBIDO (el director ya lo remitió). El secretario puede
 *        "Marcar revisado" —transición REAL VERIFICAR (RECIBIDO → VERIFICADO), SU acto— o devolver
 *        el caso a la DMR (ModalReturnToDmr).
 *     2. "Revisado"    → el caso está en VERIFICADO. SOLO estos son sorteables, y solo el secretario
 *        los sortea (POST /sorteo, @Roles('secretario abogado')): en LOTE (los seleccionados, incluso
 *        de varios expedientes) o INDIVIDUAL (acción "Sortear" de la card del caso).
 *   Un caso no revisado aparece con su checkbox DESHABILITADO (visible, con el motivo): no se puede
 *   colar en la tanda, pero el usuario ve por qué.
 *
 *   Gate SORTEAR-vs-DEVOLVER (regla del usuario, 2026-07-13), POR CASO y leído de SU checkbox — las dos
 *   acciones de la card son MUTUAMENTE EXCLUYENTES, porque marcar el checkbox ES declarar "este caso va
 *   al sorteo":
 *     - checkbox NO marcado → "Devolver a DMR" habilitada | "Sortear" deshabilitada.
 *     - checkbox    marcado → "Sortear" habilitada           | "Devolver a DMR" deshabilitada.
 *   El caso sin revisar (RECIBIDO) no puede marcarse (RECE-08) → siempre le queda "Devolver a DMR":
 *   ese es el camino "sin revisar → devolver". La CTA de LOTE de la cabecera no la toca este gate: sigue
 *   habilitándose con ≥1 caso seleccionado (de uno o de varios expedientes).
 *
 *   El DIRECTOR no aparece por aquí: él no verifica y no sortea (su bandeja es la de Entrada, donde
 *   aprueba y remite). La visibilidad de cada acción se decide con isInboxActionVisible (rol +
 *   estado del CASO), mismo mecanismo que Fase 2.
 *
 *   Paginación: va POR EXPEDIENTE (GET /epas/agrupados). Los casos de un expediente nunca se parten
 *   entre páginas — si se paginara por caso y se agrupara aquí, "seleccionar el expediente completo"
 *   podría marcar solo los casos que cayeron en esta página, creyéndolos todos.
 *
 *   ALCANCE (2026-07-14): esta bandeja es SOLO para ARMAR TANDAS. El seguimiento de lo ya sorteado
 *   —el lote, su estado (esperando al director / aprobado / rechazado), su acta y el motivo de un
 *   rechazo— vive en su propia página, la bandeja de SORTEADOS (/home/sorteados, SorteadosPage).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-10
 * Modificado por: Andrés Miño — 2026-09-15 (la cola de reasignaciones muestra la CAUSAL de la excusa
 *   y su detalle por separado — punto 4 del acta del 2026-09-11).
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: el item del sorteo lleva solo `eejeId` y
 *   `caseId`; la submateria la lee el servidor del expediente y ya no se busca en la fila)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: un fallo al cargar la bandeja se dice
 *   en su hueco y ya no se repite en un aviso flotante)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useMemo, useState } from "react";
import DialogoModal from "../components/common/DialogoModal";
import { useUser } from "../context/UserContext";
import { useModal } from "../hooks/useModal";
import { useToast } from "../hooks/useToast";
import {
  EpasService,
  type EpasListItem,
  type ExpedienteGrupo,
} from "../services/EpasService";
import {
  SorteoService,
  type SorteoItem,
  type CasoReasignable,
} from "../services/SorteoService";
import {
  EPAS_ESTADO_POR_REVISAR,
  EPAS_ESTADO_REVISADO,
  isInboxActionVisible,
} from "../config/inboxActionStatusRules";
import { MODAL_KEY as RETURN_TO_DMR } from "../components/modals/ModalReturnToDmr";
import type { UserActions } from "../interfaces/IUser";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import EmptyState from "../components/common/EmptyState";
import Alert, { type AlertVariant } from "../components/common/Alert";
import Pagination from "../components/common/Pagination";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";
import { DatetimeUtil } from "../utils/datetime.util";
import Boton from "../components/common/Boton";
import BadgePriority from "../components/common/BadgePriority";
import { etiquetaEstadoEpas } from "../config/estadosEpas";

/**
 * Estados que llegan a esta bandeja: "por revisar" (RECIBIDO) y "revisado" (VERIFICADO). Los dos
 * nombres salen AHORA del contrato compartido (`config/inboxActionStatusRules`) en vez de declararse
 * aquí a mano. El motivo no es el ahorro de dos líneas: `eejeStatus` viaja como `string`, así que un
 * literal mal escrito NO da error de compilación —es el mecanismo que la Fase 03.15 encontró roto en
 * silencio en 2 de 20 consumidores— y una constante local es un literal mal escrito esperando turno.
 */
const ESTADOS_BANDEJA = `${EPAS_ESTADO_POR_REVISAR},${EPAS_ESTADO_REVISADO}`;

/** Nombres de acción (no son modales del registry: se castean como en el resto de las bandejas). */
const MARCAR_REVISADO = "marcarRevisado";
const DES_REVISAR = "desRevisar";
const SORTEAR = "sortear";

/**
 * "Marcar revisado" (RECE-08): transición REAL VERIFICAR (RECIBIDO → VERIFICADO) sobre UN CASO. Es el
 * acto del SECRETARIO y el gate del sorteo — el director no la ve (y el backend le respondería 403).
 */
const MARCAR_REVISADO_ACTION: UserActions = {
  actiId: -4,
  submId: 9,
  actiName: MARCAR_REVISADO as unknown as UserActions["actiName"],
  actiLabel: "Marcar revisado",
  actiContext: "table",
  actiIconName: "aprobar",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: true,
};

/**
 * "Cancelar Revisión" (RECE-08 inverso): transición REAL DESHACER_VERIFICACION (VERIFICADO → RECIBIDO)
 * sobre UN CASO. Imagen especular de "Marcar revisado": es el acto del SECRETARIO que devuelve un
 * caso YA revisado a "por revisar", sacándolo del conjunto sorteable. El director/decisor no la ven
 * (y el backend les respondería 403).
 */
const DES_REVISAR_ACTION: UserActions = {
  actiId: -6,
  submId: 9,
  actiName: DES_REVISAR as unknown as UserActions["actiName"],
  actiLabel: "Cancelar Revisión",
  actiContext: "table",
  actiIconName: "reloj",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: false,
};

/** "Sortear" INDIVIDUAL: un solo caso ya revisado (el lote va por la CTA de la cabecera). */
const SORTEAR_INDIVIDUAL_ACTION: UserActions = {
  actiId: -5,
  submId: 9,
  actiName: SORTEAR as unknown as UserActions["actiName"],
  actiLabel: "Sortear",
  actiContext: "table",
  actiIconName: "enviar",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: true,
};

/**
 * Devolución individual a la DMR (misma acción inyectada que la bandeja de Recepción). Su visibilidad
 * la gobierna inboxActionStatusRules; aquí solo se ofrece sobre los casos que aún NO están revisados.
 */
const RETURN_TO_DMR_ACTION: UserActions = {
  actiId: -1,
  submId: 9,
  actiName: RETURN_TO_DMR,
  actiLabel: "Devolver a DMR",
  actiContext: "table",
  actiIconName: "rechazar",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: true,
};

const SorteoPage = () => {
  const { user } = useUser();
  const { openModal } = useModal();
  const { addToast } = useToast();

  if (!user) {
    return null;
  }

  const { rolName } = user;

  const [grupos, setGrupos] = useState<ExpedienteGrupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  // OJO: total/pages cuentan EXPEDIENTES (el paginado es por expediente), no casos.
  const [total, setTotal] = useState(0);
  // Tanda del sorteo EN LOTE: eeje_id de los CASOS seleccionados (posiblemente de varios expedientes).
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  // Casos que se van a sortear (lote o individual) pendientes de confirmación. `null` = sin diálogo.
  // Patrón parent-owns-error de ConfirmationDetail.
  const [porSortear, setPorSortear] = useState<EpasListItem[] | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);
  // Caso cuyo "Marcar revisado" está en vuelo (deshabilita su acción mientras tanto).
  const [revisandoId, setRevisandoId] = useState<number | null>(null);
  // Caso cuyo "Cancelar Revisión" está en vuelo (congela sus acciones mientras la reversión resuelve).
  const [desrevisandoId, setDesrevisandoId] = useState<number | null>(null);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  // Carga paginada (POR EXPEDIENTE) de lo que el DIRECTOR remitió al secretario: casos RECIBIDO (por
  // revisar) + VERIFICADO (revisados). El filtro directorApproved es el gate RECE-08: lo que el
  // director no aprobó no llega. Cada expediente viene con TODOS sus casos que pasan el filtro.
  const fetchEpas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await EpasService.getEpasAgrupados(
        pageIndex * pageSize,
        pageSize,
        {
          directorApproved: true,
          estados: ESTADOS_BANDEJA,
        },
      );
      setGrupos(res.data);
      setTotal(res.total);
    } catch (err) {
      const msg =
        mensajeParaUsuario(err, "No se pudo cargar la bandeja. Verifique su conexión e intente nuevamente.");
      // El fallo de CARGA se dice solo en el hueco de la lista (regla 3b de 261028-kmg).
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [pageIndex, pageSize]);

  useEffect(() => {
    void fetchEpas();
  }, [fetchEpas]);

  // --- Casos REASIGNABLES (excusas aprobadas por el director, pendientes de re-sorteo). Cola propia,
  // arriba de los expedientes remitidos. ---
  const [reasignables, setReasignables] = useState<CasoReasignable[]>([]);
  const [resorteandoId, setResorteandoId] = useState<number | null>(null);

  const fetchReasignables = useCallback(async () => {
    try {
      setReasignables(await SorteoService.casosReasignables());
    } catch {
      // Silencioso: es una cola secundaria; el error de la bandeja principal ya se muestra.
      setReasignables([]);
    }
  }, []);

  useEffect(() => {
    void fetchReasignables();
  }, [fetchReasignables]);

  const refreshBandeja = useCallback(async () => {
    setSeleccion(new Set());
    await Promise.all([fetchEpas(), fetchReasignables()]);
  }, [fetchEpas, fetchReasignables]);

  /** Re-sortea un caso reasignable (excusa aprobada). Nuevo sorteo → sale de la cola al refrescar. */
  const handleReSortear = async (caso: CasoReasignable) => {
    if (caso.eejeId == null) return;
    setResorteandoId(caso.eejeId);
    try {
      await SorteoService.sortear({
        items: [{ eejeId: caso.eejeId, caseId: caso.caseId ?? caso.eejeId }],
      });
      addToast(
        "success",
        `Caso ${caso.expNumber ?? `#${caso.eejeId}`} re-sorteado.`,
      );
      await refreshBandeja();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo re-sortear el caso."),
      );
    } finally {
      setResorteandoId(null);
    }
  };

  // Todos los casos de la página (aplanados) — para los contadores y para resolver la tanda.
  const casos = useMemo(
    () => grupos.flatMap((grupo) => grupo.casos),
    [grupos],
  );

  // ¿El secretario puede sortear? (rol + estado VERIFICADO, gobernado por inboxActionStatusRules.)
  const puedeSortear = isInboxActionVisible(SORTEAR, EPAS_ESTADO_REVISADO, rolName);

  /* ───────────────────────────────────────────────────────────────────────────────────────────────
   * EL PERÍMETRO DEL MOTOR DE ACCIONES (D-6 de la Fase 03.18), escrito donde se lee.
   *
   * Lo que decide **qué acciones se ofrecen** —y desde la Fase 03.18, si se ofrecen apagadas y con
   * qué motivo— pasa por el motor: `INBOX_ACTION_STATUS_RULES` y su evaluador. Ahí arriba,
   * `puedeSortear` es exactamente eso y por eso pregunta al motor.
   *
   * Lo que viene a continuación NO lo es, y quien lo lea dentro de un año merece saber que la
   * diferencia se midió en vez de olvidarse:
   *
   *   · `esSorteable` es un **predicado de seleccionabilidad** de una casilla, no una acción. No hay
   *     botón que apagar ni motivo que enseñar: hay una fila que entra o no entra en la tanda.
   *   · `porRevisar` es un **contador** de cabecera. Menos todavía.
   *
   *   Los dos se quedan FUERA del motor, pero tipados contra el contrato compartido: el riesgo real
   *   que tenían no era estar fuera —era comparar `eejeStatus`, que viaja como `string`, contra un
   *   literal escrito a mano que ningún compilador revisa. Eso es lo que esta tarea pagó.
   *
   * Y los otros dos que tampoco gobierna, por razones distintas:
   *
   *   · `components/impugnacion/ImpugnacionAcciones.tsx` **ramifica el render entero** del componente.
   *     No cabe en el modelo «habilitada / deshabilitada con motivo», que presupone que hay algo que
   *     habilitar. Además la impugnación está fuera de alcance desde D-4 de la Fase 03.15.
   *   · `config/entradaGating.ts` y `config/salidaGating.ts` resuelven **otra cosa**: son solo-rol
   *     sobre un universo cerrado de acciones y ya **niegan por defecto**, que es justo la propiedad
   *     que a esta tabla todavía le falta. Absorberlos triplicaría la superficie de la fase y tocaría
   *     bandejas que hoy funcionan, a cambio de nada que no tengan ya.
   *
   * Un límite que no se declara se lee después como defecto, y alguien "arregla" lo que era una
   * decisión. Por eso está aquí y no sólo en un documento de planificación.
   * ─────────────────────────────────────────────────────────────────────────────────────────────── */

  /**
   * Un caso es SORTEABLE (y por tanto seleccionable) solo si está revisado (VERIFICADO) y el rol
   * puede sortear. Es el gate RECE-08 aplicado por CASO: el checkbox del expediente completo también
   * lo respeta, así que nunca puede colar un caso sin revisar en la tanda.
   */
  const esSorteable = useCallback(
    (caso: EpasListItem) =>
      puedeSortear && caso.eejeStatus === EPAS_ESTADO_REVISADO,
    [puedeSortear],
  );

  const porRevisar = useMemo(
    () => casos.filter((caso) => caso.eejeStatus === EPAS_ESTADO_POR_REVISAR),
    [casos],
  );
  const revisados = useMemo(() => casos.filter(esSorteable), [casos, esSorteable]);

  // Tanda del sorteo EN LOTE = los casos revisados seleccionados en la página actual.
  const seleccionados = useMemo(
    () => revisados.filter((caso) => seleccion.has(caso.eejeId)),
    [revisados, seleccion],
  );

  // Cuántos EXPEDIENTES aporta la tanda (un lote puede cruzar varios expedientes).
  const expedientesEnTanda = useMemo(
    () => new Set(seleccionados.map((caso) => caso.expNumber ?? caso.expId)).size,
    [seleccionados],
  );

  const sortearLoteHabilitado =
    puedeSortear && seleccionados.length > 0 && !loading;

  /** Alterna la selección de UN caso revisado. */
  const toggleCaso = useCallback((caso: EpasListItem) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(caso.eejeId)) {
        next.delete(caso.eejeId);
      } else {
        next.add(caso.eejeId);
      }
      return next;
    });
  }, []);

  /**
   * Alterna el EXPEDIENTE COMPLETO: marca/desmarca de golpe TODOS los casos sorteables del
   * expediente. Los no sorteables (aún sin revisar) quedan fuera por construcción — el gate RECE-08
   * no se puede saltar seleccionando "el expediente completo".
   */
  const toggleExpediente = useCallback(
    (grupo: ExpedienteGrupo, seleccionar: boolean) => {
      const sorteables = grupo.casos.filter(esSorteable);
      setSeleccion((prev) => {
        const next = new Set(prev);
        for (const caso of sorteables) {
          if (seleccionar) {
            next.add(caso.eejeId);
          } else {
            next.delete(caso.eejeId);
          }
        }
        return next;
      });
    },
    [esSorteable],
  );

  /**
   * "Marcar revisado" de UN CASO: transición REAL VERIFICAR (RECIBIDO → VERIFICADO). Tras el refetch,
   * el caso pasa a ser sorteable por sí solo (su checkbox se habilita) porque el gate se deriva del
   * ESTADO REAL del caso, no de un check local.
   */
  const handleMarcarRevisado = async (caso: EpasListItem) => {
    setRevisandoId(caso.eejeId);
    try {
      await EpasService.marcarRevisado(caso.eejeId);
      addToast(
        "success",
        `Caso de ${[caso.admiName, caso.admiLastname].filter(Boolean).join(" ") || `#${caso.eejeId}`} marcado como revisado`,
      );
      await fetchEpas();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo marcar el caso como revisado."),
      );
    } finally {
      setRevisandoId(null);
    }
  };

  /**
   * "Cancelar Revisión" de UN CASO: transición REAL DESHACER_VERIFICACION (VERIFICADO → RECIBIDO), inversa
   * de handleMarcarRevisado. Tras el refetch el caso vuelve a RECIBIDO: su checkbox se deshabilita
   * solo (esSorteable exige VERIFICADO) y sale de la tanda — no hace falta lógica extra para
   * "sacarlo del sorteo".
   */
  const handleDesRevisar = async (caso: EpasListItem) => {
    setDesrevisandoId(caso.eejeId);
    try {
      await EpasService.desRevisar(caso.eejeId);
      // Si el caso estaba seleccionado en la tanda, retíralo: ya no es sorteable.
      setSeleccion((prev) => {
        if (!prev.has(caso.eejeId)) return prev;
        const next = new Set(prev);
        next.delete(caso.eejeId);
        return next;
      });
      addToast(
        "success",
        `Revisado revertido: el caso de ${[caso.admiName, caso.admiLastname].filter(Boolean).join(" ") || `#${caso.eejeId}`} vuelve a "por revisar"`,
      );
      await fetchEpas();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo revertir el revisado del caso."),
      );
    } finally {
      setDesrevisandoId(null);
    }
  };

  // Devuelve el case_id de Asignaciones asociado; el GET /epas aún puede no traerlo (R-03-01-G,
  // mapeo [ASSUMED]) → fallback al eeje_id para no bloquear la tanda en el slice vertical.
  const resolveCaseId = (caso: EpasListItem): number =>
    (caso as EpasListItem & { caseId?: number }).caseId ?? caso.eejeId;

  // Confirma y dispara el sorteo. MISMA ruta para el lote y para el individual: cambia el tamaño de
  // `porSortear` (varios casos seleccionados vs. uno solo), no el contrato. El payload siempre lleva
  // los CASOS (eejeIds), nunca el expediente: sortear es asignar cada caso a un decisor.
  const handleSortearConfirm = async () => {
    if (!porSortear?.length) return;
    setConfirmMessage(null);

    // Quick 261006-kys: el item lleva SOLO el caso. La submateria del reparto la lee el servidor del
    // expediente (`exp_materia_id`); el backend rechaza con 400 un `subId` o una `materia` del body.
    const items: SorteoItem[] = porSortear.map((caso) => ({
      eejeId: caso.eejeId,
      caseId: resolveCaseId(caso),
    }));

    try {
      await SorteoService.sortear({ items });
      addToast(
        "success",
        porSortear.length === 1
          ? `Caso del expediente ${porSortear[0].expNumber ?? `#${porSortear[0].eejeId}`} enviado al sorteo`
          : `${porSortear.length} casos enviados al sorteo`,
      );
      setPorSortear(null);
      await refreshBandeja();
    } catch (err) {
      setConfirmMessage({
        variant: "error",
        message:
          mensajeParaUsuario(err, "El servicio de sorteo no está disponible en este momento. Intente más tarde."),
      });
    }
  };

  // Abre la devolución individual a la DMR (reusa ModalReturnToDmr — solo para los NO revisados).
  const handleDevolver = (caso: EpasListItem) => {
    openModal(RETURN_TO_DMR, caso, {
      onError: (e: unknown) => console.error("Devolución fallida:", e),
      refetchFn: refreshBandeja,
    });
  };

  /**
   * Acciones de un CASO, gateadas por rol + SU estado (isInboxActionVisible):
   *   - RECIBIDO   → "Marcar revisado" + "Devolver a DMR".
   *   - VERIFICADO → "Sortear" (individual) + "Devolver a DMR".
   *
   * Sobre esa visibilidad se aplica el gate SORTEAR-vs-DEVOLVER (regla del usuario, 2026-07-13), que es
   * POR CASO y se lee de SU checkbox: las dos acciones son MUTUAMENTE EXCLUYENTES.
   *
   *   checkbox NO marcado → "Devolver a DMR" HABILITADA, "Sortear" DESHABILITADA.
   *   checkbox    marcado → "Sortear" HABILITADA,            "Devolver a DMR" DESHABILITADA.
   *
   * El checkbox ES la declaración de intención del secretario: marcar un caso es decir "este va al
   * sorteo", así que devolverlo sería contradictorio (y viceversa). El caso aún NO revisado (RECIBIDO)
   * tiene su checkbox deshabilitado por el gate RECE-08 → nunca está marcado → le queda "Devolver a la
   * DMR" habilitada: ese es, precisamente, el camino "sin revisar → devolver".
   *
   * Cada deshabilitación viaja con SU motivo (actiDisabledHint) para que el usuario vea POR QUÉ no
   * puede pulsarla, igual que el checkbox no seleccionable lleva su `casoNoSeleccionableHint`.
   */
  const casoActions = useCallback(
    (caso: EpasListItem): UserActions[] => {
      // "En la tanda" = ese caso está marcado. Se re-valida contra esSorteable para que una selección
      // residual (un caso que dejó de ser VERIFICADO tras un refetch) no habilite un sorteo imposible.
      const enTanda = esSorteable(caso) && seleccion.has(caso.eejeId);
      // "Marcar revisado" / "Cancelar Revisión" en vuelo sobre este caso: se congelan TODAS sus acciones
      // hasta que resuelva la transición.
      const revisando = revisandoId === caso.eejeId;
      const desrevisando = desrevisandoId === caso.eejeId;
      const enVuelo = revisando || desrevisando;

      return [
        MARCAR_REVISADO_ACTION,
        DES_REVISAR_ACTION,
        SORTEAR_INDIVIDUAL_ACTION,
        RETURN_TO_DMR_ACTION,
      ]
        .filter((action) =>
          isInboxActionVisible(action.actiName, caso.eejeStatus, rolName),
        )
        .map((action) => {
          if (enVuelo) {
            return {
              ...action,
              actiIsDisabled: true,
              actiDisabledHint: revisando
                ? "Marcando el caso como revisado…"
                : "Revirtiendo el revisado del caso…",
            };
          }

          const nombre = String(action.actiName);

          // Sortear: SOLO con el caso seleccionado.
          if (nombre === SORTEAR) {
            return {
              ...action,
              actiIsDisabled: !enTanda,
              actiDisabledHint: enTanda
                ? undefined
                : "Seleccione el caso (marque su checkbox) para poder sortearlo.",
            };
          }

          // Devolver a DMR: SOLO con el caso NO seleccionado (si está en la tanda, va al sorteo).
          if (nombre === RETURN_TO_DMR) {
            return {
              ...action,
              actiIsDisabled: enTanda,
              actiDisabledHint: enTanda
                ? "El caso está seleccionado para el sorteo. Desmárquelo para poder devolverlo a la DMR."
                : undefined,
            };
          }

          // "Marcar revisado" y "Cancelar Revisión": no los toca el gate SORTEAR-vs-DEVOLVER. Son los pasos
          // simétricos PREVIO/INVERSO a poder seleccionar el caso, habilitados sobre su propio estado.
          return { ...action, actiIsDisabled: false };
        });
    },
    [rolName, revisandoId, desrevisandoId, seleccion, esSorteable],
  );

  /** Despacha la acción de un caso según su nombre. */
  const handleCasoAction = (actiName: string, caso: EpasListItem) => {
    if (actiName === MARCAR_REVISADO) {
      void handleMarcarRevisado(caso);
      return;
    }
    if (actiName === DES_REVISAR) {
      void handleDesRevisar(caso);
      return;
    }
    if (actiName === SORTEAR) {
      // Sorteo INDIVIDUAL: misma confirmación que el lote, con un único caso.
      setConfirmMessage(null);
      setPorSortear([caso]);
      return;
    }
    handleDevolver(caso);
  };

  const sinExpedientes = !loading && !error && grupos.length === 0;

  return (
    <div className="app-data-container">
      <HeaderPage
        headerKicker="Ejecución — DME"
        title="Reasignaciones"
        subtitle="Revise los casos de cada expediente que el director aprobó como excusados y envíelos al sorteo."
      />

      {/* COLA DE REASIGNACIONES: casos cuya excusa aprobó el director y esperan re-sorteo (RECE-07). */}
      {reasignables.length > 0 && (
        <section className="app-modules-panel app-data-panel app-shell-surface mb-4 overflow-visible rounded-3xl border border-warning/40 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
          <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-warning">
                Expedientes reasignables (excusas aprobadas)
              </h2>
              <span className="badge badge-warning badge-outline whitespace-nowrap">
                {reasignables.length} caso(s)
              </span>
            </div>
          </div>

          <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
            <div className="app-data-list flex flex-col gap-2">
              {reasignables.map((caso, idx) => {
                const nombre =
                  caso.administrado?.trim() || `EPAS #${caso.eejeId}`;
                return (
                  <div
                    key={`reasg-${caso.eejeId ?? idx}`}
                    className="app-item-list-row app-item-list-row--with-actions rounded border border-base-300"
                  >
                    <span className="app-item-list-index">{idx + 1}.</span>
                    <div className="app-item-list-primary">
                      <div className="app-item-list-identifying">
                        {caso.expNumber ?? `EPAS #${caso.eejeId}`}
                      </div>
                      {/* CAUSAL y DETALLE por separado (punto 4 del acta del 2026-09-11). La
                          causal es lo que hace contables las excusas; el detalle es el color. Van
                          separados y no concatenados porque el secretario lee esta fila para saber
                          POR QUÉ el caso volvió, y el detalle casi nunca está: el backend vacía
                          `motivo` al resolverse la excusa, mientras que la causal sobrevive. Las
                          excusas anteriores al catálogo se muestran «sin clasificar» —no se les
                          adivina una causal a posteriori— y por eso esa etiqueta existe. */}
                      {(caso.causal || caso.motivo) && (
                        <div className="app-item-list-complementary">
                          Causal: {caso.causal || "sin clasificar"}
                          {caso.motivo && ` · Detalle: ${caso.motivo}`}
                        </div>
                      )}
                    </div>
                    <div className="app-item-list-secondary">
                      <span className="app-item-list-info--alta">{nombre}</span>
                      {caso.cedula && (
                        <span className="app-item-list-info--baja">
                          {caso.cedula}
                        </span>
                      )}
                      {caso.decisorAnteriorName && (
                        <span className="app-item-list-info--baja">
                          Excusó: {caso.decisorAnteriorName}
                        </span>
                      )}
                      {/* El estado, con su etiqueta legible y su chip (quick 260929-mbo). */}
                      <BadgePriority
                        text={etiquetaEstadoEpas(caso.eejeStatus)}
                        priority={caso.eejeStatus ?? ""}
                        size="md"
                        capitalize={false}
                      />
                    </div>
                    <div className="app-item-list-actions">
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        disabled={resorteandoId === caso.eejeId}
                        onClick={() => void handleReSortear(caso)}
                      >
                        {resorteandoId === caso.eejeId
                          ? "Re-sorteando…"
                          : "Re-sortear"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-primary/95">
              Expedientes remitidos por el director
            </h2>
            {/* Resumen de la página: por revisar / listos para sortear / en la tanda. */}
            <span className="badge badge-outline whitespace-nowrap">
              {porRevisar.length} caso(s) por revisar
            </span>
            <span className="badge badge-outline whitespace-nowrap">
              {revisados.length} listo(s) para sortear
            </span>
            <span className="badge badge-primary badge-outline whitespace-nowrap">
              {seleccionados.length} caso(s) en la tanda
            </span>
          </div>

          {/* CTA primaria (accent único de la pantalla): sortear EN LOTE los casos seleccionados —
              pueden ser de varios expedientes. El sorteo individual vive en la acción "Sortear" de
              cada caso revisado. */}
          <span
            title={
              sortearLoteHabilitado
                ? "Sortear los casos seleccionados"
                : "Marque los casos como revisados y selecciónelos para habilitar el sorteo en lote."
            }
          >
            <Boton
              estilos="btn btn-primary"
              texto="Sortear seleccionados"
              deshabilitado={!sortearLoteHabilitado}
              onClick={() => {
                setConfirmMessage(null);
                setPorSortear(seleccionados);
              }}
            />
          </span>
        </div>

        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          {error && !loading && <Alert variant="error" message={error} />}

          {sinExpedientes && (
            <EmptyState text="No hay expedientes remitidos por el director" />
          )}

          {/* La bandeja se divide por EXPEDIENTE; los CASOS van DENTRO de su expediente. El checkbox
              del expediente selecciona todos sus casos sorteables (indeterminado si solo algunos);
              el de cada caso lo selecciona a él. Solo los revisados (VERIFICADO) son seleccionables. */}
          {grupos.length > 0 && (
            <>
              {/* Mismo look que la Bandeja de Entrada (primitivo app-item-list) con datos ricos por
                  caso, conservando el checkbox de dos niveles y las acciones (marcar revisado / sortear /
                  devolver). Agrupado por EXPEDIENTE. */}
              <div className="app-data-list mb-6 flex flex-col gap-6">
                {grupos.map((grupo, i) => {
                  const sorteables = grupo.casos.filter(esSorteable);
                  const selDelGrupo = sorteables.filter((c) =>
                    seleccion.has(c.eejeId),
                  );
                  const todosSel =
                    sorteables.length > 0 &&
                    selDelGrupo.length === sorteables.length;
                  const algunosSel = selDelGrupo.length > 0 && !todosSel;
                  return (
                    <div
                      key={grupo.expId}
                      className="app-inbox-alert-row flex items-start gap-3"
                    >
                      {/* Checkbox del expediente en el GUTTER (fuera del summary: no pliega el details). */}
                      {sorteables.length > 0 && (
                        <span className="inline-flex shrink-0 items-center pt-4">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary checkbox-sm"
                            checked={todosSel}
                            ref={(el) => {
                              if (el) el.indeterminate = algunosSel;
                            }}
                            onChange={() => toggleExpediente(grupo, !todosSel)}
                            aria-label={`Seleccionar el expediente ${
                              grupo.expNumber ?? grupo.expId
                            }`}
                          />
                        </span>
                      )}

                      {/* Expediente ABATIBLE: details cerrado por defecto (como los lotes de Entrada). */}
                      <details className="app-collapse-alert app-inbox-alert-card min-w-0 flex-1">
                        <summary className="app-collapse-alert-summary cursor-pointer select-none">
                          <div className="app-collapse-alert-header">
                            <div className="app-inbox-document-header-left flex min-w-0 flex-row items-center gap-3">
                              <div className="app-inbox-document-info">
                                <h3 className="app-collapse-alert-title app-inbox-document-name">
                                  <span className="app-collapse-alert-index">
                                    {i + 1}.
                                  </span>{" "}
                                  {grupo.expNumber ??
                                    `Expediente #${grupo.expId}`}
                                </h3>
                                <div className="app-inbox-document-meta">
                                  <span className="app-inbox-document-type">
                                    {[grupo.expZone, grupo.expMateria]
                                      .filter(Boolean)
                                      .join(" · ") || "—"}
                                  </span>
                                  <span className="badge badge-outline whitespace-nowrap">
                                    {grupo.casos.length} caso(s)
                                  </span>
                                </div>
                              </div>
                            </div>
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
                        </summary>

                        <div className="app-collapse-alert-content">
                          <div className="app-item-list">
                        {grupo.casos.map((caso, idx) => {
                          const sorteable = esSorteable(caso);
                          const marcado = seleccion.has(caso.eejeId);
                          const nombre =
                            caso.admiBusinessName?.trim() ||
                            [caso.admiName, caso.admiLastname]
                              .filter(Boolean)
                              .join(" ");
                          const acciones = casoActions(caso);
                          return (
                            <div
                              key={caso.eejeId}
                              className="flex items-start gap-2"
                            >
                              <span
                                className="pt-3"
                                title={
                                  sorteable
                                    ? undefined
                                    : "Marque el caso como revisado para poder sortearlo."
                                }
                              >
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-primary checkbox-sm"
                                  checked={marcado}
                                  disabled={!sorteable}
                                  onChange={() => toggleCaso(caso)}
                                  aria-label={`Seleccionar el caso de ${
                                    nombre || `#${caso.eejeId}`
                                  }`}
                                />
                              </span>

                              <div className="app-item-list-row app-item-list-row--with-actions flex-1 rounded border border-base-300">
                                <span className="app-item-list-index">
                                  {idx + 1}.
                                </span>
                                <div className="app-item-list-primary">
                                  <div className="app-item-list-identifying">
                                    {caso.expNumber ?? `EPAS #${caso.eejeId}`}
                                  </div>
                                  {caso.eejeIncomeAt && (
                                    <div className="app-item-list-complementary">
                                      {DatetimeUtil.formatDate(caso.eejeIncomeAt)}
                                    </div>
                                  )}
                                </div>
                                <div className="app-item-list-secondary">
                                  {nombre && (
                                    <span className="app-item-list-info--alta">
                                      {nombre}
                                    </span>
                                  )}
                                  {caso.admiIdentification && (
                                    <span className="app-item-list-info--baja">
                                      {caso.admiIdentification}
                                    </span>
                                  )}
                                  {caso.expZone && (
                                    <span className="app-item-list-info--baja">
                                      {caso.expZone}
                                    </span>
                                  )}
                                  {/* Ídem (quick 260929-mbo). */}
                                  <BadgePriority
                                    text={etiquetaEstadoEpas(caso.eejeStatus)}
                                    priority={caso.eejeStatus ?? ""}
                                    size="md"
                                    capitalize={false}
                                  />
                                </div>
                                <div className="app-item-list-actions">
                                  {acciones.map((action) => (
                                    <span
                                      key={action.actiName}
                                      title={
                                        action.actiIsDisabled
                                          ? action.actiDisabledHint
                                          : undefined
                                      }
                                    >
                                      <button
                                        type="button"
                                        className="btn btn-xs btn-outline"
                                        disabled={action.actiIsDisabled ?? false}
                                        onClick={() =>
                                          handleCasoAction(
                                            action.actiName,
                                            caso,
                                          )
                                        }
                                      >
                                        {action.actiLabel}
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                })}
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

      {/* Confirmación del sorteo (accent, no destructiva). Sirve al lote y al individual. */}
      {porSortear && porSortear.length > 0 && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setPorSortear(null)}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle={
              porSortear.length === 1
                ? "Confirmar sorteo del caso"
                : "Confirmar sorteo en lote"
            }
            statusCopy="Listo para sortear"
            descriptionCopy={
              porSortear.length === 1
                ? "¿Confirma enviar este caso al sorteo? Solo se sortean los casos revisados."
                : `¿Confirma enviar ${porSortear.length} casos al sorteo? Solo se sortean los casos revisados.`
            }
            informationData={
              porSortear.length === 1
                ? {
                    Expediente:
                      porSortear[0].expNumber ?? `EPAS #${porSortear[0].eejeId}`,
                    Administrado:
                      [porSortear[0].admiName, porSortear[0].admiLastname]
                        .filter(Boolean)
                        .join(" ") || "Sin administrado",
                    "Estado actual": porSortear[0].eejeStatus,
                  }
                : {
                    "Expedientes en la tanda": porSortear.length,
                    "Expedientes involucrados": expedientesEnTanda,
                  }
            }
            onConfirm={handleSortearConfirm}
            onClose={() => setPorSortear(null)}
            message={confirmMessage ?? undefined}
            confirmButtonText="Sí, sortear"
            confirmButtonLoadingText="Sorteando…"
          />
        </DialogoModal>
      )}

      {loading && <Loading />}
    </div>
  );
};

export default SorteoPage;
