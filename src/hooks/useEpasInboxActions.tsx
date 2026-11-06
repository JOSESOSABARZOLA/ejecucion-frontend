/**
 * Microservicio: ejecucion
 * Módulo: Recepción / Sorteo (DME)
 * Feature: Acciones de bandeja por expediente (gating por rol + estado)
 * Archivo: useEpasInboxActions.tsx
 * Responsabilidad: ÚNICA fuente de las acciones que una bandeja ofrece sobre un EPAS y de cómo se
 *   ejecutan. Resuelve qué acciones ve cada rol (isInboxActionVisible: rol + estado del EPAS) y las
 *   despacha: "Aprobar y enviar al secretario" (triage del DIRECTOR) confirmando con
 *   ConfirmationDetail; el resto (p. ej. DEVOLVER_DMR) abre su modal del registry (ModalReturnToDmr).
 *   Lo comparten la Bandeja de Entrada y la Bandeja de Recepción para que ambas gateen igual.
 *
 *   DOS NIVELES, la misma máquina: `resolveActions`/`handleAction` sobre un CASO, y
 *   `resolveGrupoActions`/`handleGrupoAction` sobre el EXPEDIENTE COMPLETO. El director decide por
 *   expediente —es como la DMR se lo remite—, pero conserva el caso a caso: el nivel de expediente
 *   AÑADE una vía, no cierra la otra. Un expediente ofrece la acción sobre exactamente los casos que
 *   la aceptarían individualmente (ACCION_POR_CASO), así que ambos niveles no pueden divergir.
 *
 *   RECE-08 — el DIRECTOR NO envía al sorteo y NO verifica: aprobar solo REMITE el expediente al
 *   secretario (PATCH /epas/:id/approve-director) y el EPAS SIGUE en RECIBIDO. Quien lo marca
 *   "revisado" (VERIFICAR: RECIBIDO → VERIFICADO) y quien lo sortea es el SECRETARIO, en su Bandeja
 *   de Sorteo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-13
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useState } from "react";
import DialogoModal from "../components/common/DialogoModal";
import { useModal, type ModalType } from "./useModal";
import { useToast } from "./useToast";
import {
  EpasService,
  type EpasListItem,
  type ExpedienteGrupo,
} from "../services/EpasService";
import { isInboxActionVisible } from "../config/inboxActionStatusRules";
import { MODAL_KEY as RETURN_TO_DMR } from "../components/modals/ModalReturnToDmr";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";
import type { AlertVariant } from "../components/common/Alert";
import type { UserActions } from "../interfaces/IUser";

/**
 * Nombre de la acción de triage del director sobre el expediente. NO es un modal del registry
 * (se confirma con ConfirmationDetail), por eso se castea al entrar en UserActions.actiName sin
 * ampliar el union ModalType con algo que no es un modal — mismo patrón que `enviarSorteo`.
 */
export const APROBAR_EPAS = "aprobarEpas";

/** "Aprobar y enviar al secretario": visible solo para el DIRECTOR con el EPAS RECIBIDO. */
export const APROBAR_EPAS_ACTION: UserActions = {
  actiId: -3,
  submId: 9,
  actiName: APROBAR_EPAS as unknown as ModalType,
  actiLabel: "Aprobar y enviar al secretario",
  actiContext: "table",
  actiIconName: "enviarExpediente",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: true,
};

/** "Devolver a DMR": visible para el secretario y para el director (RECIBIDO/VERIFICADO). */
export const RETURN_TO_DMR_ACTION: UserActions = {
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

/** Acciones inyectadas por la UI sobre cada EPAS (no vienen del backend de permisos). */
export const EPAS_ROW_ACTIONS: UserActions[] = [
  APROBAR_EPAS_ACTION,
  RETURN_TO_DMR_ACTION,
];

/**
 * Nombres de las acciones del EXPEDIENTE COMPLETO (RECE-08). El director razona por expediente —es
 * como la DMR se lo remite—, así que decide sobre el expediente entero; el caso a caso sigue ahí para
 * cuando quiera desglosar. Cada una es la MISMA decisión que su gemela por caso, un nivel más arriba.
 */
export const APROBAR_EXPEDIENTE = "aprobarExpediente";
export const DEVOLVER_EXPEDIENTE = "devolverExpediente";

/** "Aprobar y enviar al secretario" el EXPEDIENTE COMPLETO: solo el DIRECTOR. */
export const APROBAR_EXPEDIENTE_ACTION: UserActions = {
  actiId: -4,
  submId: 9,
  actiName: APROBAR_EXPEDIENTE as unknown as ModalType,
  actiLabel: "Aprobar y enviar al secretario",
  actiContext: "collapseHeader",
  actiIconName: "enviarExpediente",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: true,
};

/** "Devolver a DMR" el EXPEDIENTE COMPLETO: solo el DIRECTOR (su alternativa a aprobarlo). */
export const DEVOLVER_EXPEDIENTE_ACTION: UserActions = {
  actiId: -5,
  submId: 9,
  actiName: DEVOLVER_EXPEDIENTE as unknown as ModalType,
  actiLabel: "Devolver a DMR",
  actiContext: "collapseHeader",
  actiIconName: "rechazar",
  actiCreatedAt: null,
  actiUpdatedAt: null,
  actiIsPrioritary: false,
};

/** Acciones que la UI ofrece sobre el EXPEDIENTE COMPLETO (cabecera del grupo). */
export const EXPEDIENTE_ACTIONS: UserActions[] = [
  APROBAR_EXPEDIENTE_ACTION,
  DEVOLVER_EXPEDIENTE_ACTION,
];

/**
 * Acción POR CASO equivalente a cada acción de EXPEDIENTE. Es lo que hace que ambos niveles gateen con
 * la MISMA máquina (isInboxActionVisible) y no puedan divergir: un expediente ofrece la acción sobre
 * los casos que la aceptarían individualmente — ni uno más.
 */
const ACCION_POR_CASO: Record<string, string> = {
  [APROBAR_EXPEDIENTE]: APROBAR_EPAS,
  [DEVOLVER_EXPEDIENTE]: RETURN_TO_DMR,
};

/** Motivo (tooltip) por el que una acción de expediente va deshabilitada — nunca texto inline. */
const SIN_CASOS_ELEGIBLES: Record<string, string> = {
  [APROBAR_EXPEDIENTE]:
    "Este expediente no tiene administrados por remitir: ya fueron enviados al secretario o no están en RECIBIDO.",
  [DEVOLVER_EXPEDIENTE]:
    "Este expediente no tiene administrados por devolver: ya fueron enviados al secretario o no están en RECIBIDO.",
};

/**
 * Acciones de bandeja sobre un EPAS, gateadas por rol + estado.
 * @param rolName rol del usuario autenticado (user.rolName).
 * @param refetch recarga de la bandeja tras una acción exitosa.
 */
export function useEpasInboxActions(
  rolName: string,
  refetch: () => Promise<void>,
) {
  const { openModal } = useModal();
  const { addToast } = useToast();

  // EPAS pendiente de confirmación de aprobación (patrón parent-owns-error de ConfirmationDetail).
  const [porAprobar, setPorAprobar] = useState<EpasListItem | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);

  /**
   * Acciones visibles para una fila. El gating es el mismo mecanismo de la Fase 2
   * (isInboxActionVisible: rol + estado); un EPAS bloqueado las muestra deshabilitadas.
   * @param row EPAS de la fila.
   * @param extra acciones adicionales de la página (p. ej. las que entrega el backend de permisos).
   */
  const resolveActions = useCallback(
    (row: EpasListItem, extra: UserActions[] = []): UserActions[] => {
      const visibles = [...extra, ...EPAS_ROW_ACTIONS].filter((action) =>
        isInboxActionVisible(action.actiName, row.eejeStatus, rolName),
      );
      return row.eejeIsLocked
        ? visibles.map((action) => ({ ...action, actiIsDisabled: true }))
        : visibles;
    },
    [rolName],
  );

  /** Despacha la acción de la fila: aprobar pide confirmación; el resto abre su modal. */
  const handleAction = useCallback(
    (actiName: string, row: EpasListItem) => {
      if (actiName === APROBAR_EPAS) {
        setConfirmMessage(null);
        setPorAprobar(row);
        return;
      }
      openModal(actiName as ModalType, row, {
        onError: (e: unknown) => console.error("Acción de bandeja fallida:", e),
        refetchFn: refetch,
      });
    },
    [openModal, refetch],
  );

  // Confirma la aprobación del DIRECTOR: PATCH /epas/:id/approve-director. NO transiciona — el EPAS
  // sigue RECIBIDO y solo queda remitido al secretario. Si falla, el error se muestra inline y el
  // modal permanece abierto (el padre es dueño del error — contrato de ConfirmationDetail).
  const confirmarAprobacion = async () => {
    if (!porAprobar) return;
    setConfirmMessage(null);
    try {
      await EpasService.aprobarPorDirector(porAprobar.eejeId);
      addToast(
        "success",
        `Expediente ${porAprobar.expNumber ?? `#${porAprobar.eejeId}`} aprobado y enviado al secretario`,
      );
      setPorAprobar(null);
      await refetch();
    } catch (error) {
      setConfirmMessage({
        variant: "error",
        message:
          mensajeParaUsuario(error, "No se pudo aprobar el expediente. Intente nuevamente."),
      });
    }
  };

  /** Diálogo de confirmación de la aprobación (se renderiza en la página que use el hook). */
  const aprobacionConfirmDialog = porAprobar ? (
    <DialogoModal
      className="modal modal-open"
      onCerrar={() => setPorAprobar(null)}
    >
      <ConfirmationDetail
        headerKicker="Ejecución — DME"
        headerTitle="Aprobar y enviar al secretario"
        statusCopy="Pasa al secretario"
        descriptionCopy="¿Confirma aprobar el expediente y enviarlo al secretario? Pasará a su Bandeja de Sorteo, donde él lo marcará como revisado y lo enviará al sorteo. El expediente permanece en estado RECIBIDO."
        informationData={{
          Expediente: porAprobar.expNumber ?? `EPAS #${porAprobar.eejeId}`,
          Administrado:
            [porAprobar.admiName, porAprobar.admiLastname]
              .filter(Boolean)
              .join(" ") || "Sin administrado",
          "Estado actual": porAprobar.eejeStatus,
        }}
        onConfirm={confirmarAprobacion}
        onClose={() => setPorAprobar(null)}
        message={confirmMessage ?? undefined}
        confirmButtonText="Sí, aprobar"
        confirmButtonLoadingText="Aprobando…"
      />
    </DialogoModal>
  ) : null;

  // -----------------------------------------------------------------------------------------------
  // Nivel EXPEDIENTE (RECE-08): el director aprueba/remite —o devuelve— el expediente COMPLETO.
  // Espejo exacto del nivel de caso: mismas decisiones, misma máquina de gating, un nivel más arriba.
  // -----------------------------------------------------------------------------------------------

  /** Expediente pendiente de confirmación de aprobación (parent-owns-error, como el de caso). */
  const [grupoPorAprobar, setGrupoPorAprobar] =
    useState<ExpedienteGrupo | null>(null);

  /**
   * Casos del expediente que ACEPTARÍAN la acción individualmente: los no bloqueados, aún no remitidos
   * al secretario, y cuyo estado la regla por caso admite (isInboxActionVisible). Es la definición de
   * "elegible" del backend, evaluada aquí para poder anticipar el conteo y deshabilitar con motivo.
   * @param grupo Expediente con sus casos.
   * @param actiName Acción de EXPEDIENTE (se traduce a su gemela por caso).
   */
  const casosElegibles = useCallback(
    (grupo: ExpedienteGrupo, actiName: string): EpasListItem[] => {
      const porCaso = ACCION_POR_CASO[actiName];
      return grupo.casos.filter(
        (caso) =>
          !caso.eejeIsLocked &&
          !caso.eejeDirectorApprovedAt &&
          isInboxActionVisible(porCaso, caso.eejeStatus, rolName),
      );
    },
    [rolName],
  );

  /**
   * Acciones visibles del EXPEDIENTE COMPLETO. La visibilidad la gatea el ROL (regla sin `status`: el
   * expediente no tiene estado propio, lo tienen sus casos). Sin casos elegibles la acción NO se
   * oculta: se muestra DESHABILITADA con su motivo en el tooltip — esconderla dejaría al director sin
   * saber por qué no puede actuar.
   * @param grupo Expediente con sus casos.
   */
  const resolveGrupoActions = useCallback(
    (grupo: ExpedienteGrupo): UserActions[] =>
      EXPEDIENTE_ACTIONS.filter((action) =>
        isInboxActionVisible(action.actiName, undefined, rolName),
      ).map((action) => {
        const elegibles = casosElegibles(grupo, action.actiName);
        return elegibles.length === 0
          ? {
              ...action,
              actiIsDisabled: true,
              actiDisabledHint: SIN_CASOS_ELEGIBLES[action.actiName],
            }
          : action;
      }),
    [rolName, casosElegibles],
  );

  /**
   * Despacha la acción del EXPEDIENTE: aprobar pide confirmación (ConfirmationDetail); devolver abre
   * ModalReturnToDmr con alcance de expediente (mismo modal, un único motivo para todos sus casos).
   */
  const handleGrupoAction = useCallback(
    (actiName: string, grupo: ExpedienteGrupo) => {
      const elegibles = casosElegibles(grupo, actiName);
      if (elegibles.length === 0) return;

      if (actiName === APROBAR_EXPEDIENTE) {
        setConfirmMessage(null);
        setGrupoPorAprobar(grupo);
        return;
      }

      if (actiName === DEVOLVER_EXPEDIENTE) {
        // El modal recibe un caso REPRESENTANTE (para el estado de notificación, que es del
        // expediente) + el alcance: qué expediente y cuántos casos se devuelven con este motivo.
        openModal(RETURN_TO_DMR, {
          ...elegibles[0],
          expedienteScope: {
            expId: grupo.expId,
            expNumber: grupo.expNumber,
            casosElegibles: elegibles.length,
          },
        }, {
          onError: (e: unknown) =>
            console.error("Acción de expediente fallida:", e),
          refetchFn: refetch,
        });
      }
    },
    [casosElegibles, openModal, refetch],
  );

  // Confirma la aprobación del EXPEDIENTE COMPLETO: PATCH /epas/expediente/:expId/approve-director.
  // Como en el caso a caso, NO transiciona: sus EPAS siguen RECIBIDO y solo quedan remitidos.
  const confirmarAprobacionExpediente = async () => {
    if (!grupoPorAprobar) return;
    setConfirmMessage(null);
    try {
      const res = await EpasService.aprobarExpedientePorDirector(
        grupoPorAprobar.expId,
      );
      const n = res.aprobados ?? 0;
      addToast(
        "success",
        `${n} ${n === 1 ? "administrado" : "administrados"} del expediente ${
          grupoPorAprobar.expNumber ?? `#${grupoPorAprobar.expId}`
        } ${n === 1 ? "enviado" : "enviados"} al secretario`,
      );
      setGrupoPorAprobar(null);
      await refetch();
    } catch (error) {
      setConfirmMessage({
        variant: "error",
        message:
          mensajeParaUsuario(error, "No se pudo aprobar el expediente. Intente nuevamente."),
      });
    }
  };

  /** Diálogo de confirmación de la aprobación del EXPEDIENTE COMPLETO (dice CUÁNTOS casos se remiten). */
  const expedienteConfirmDialog = grupoPorAprobar
    ? (() => {
        const elegibles = casosElegibles(grupoPorAprobar, APROBAR_EXPEDIENTE);
        return (
          <DialogoModal
            className="modal modal-open"
            onCerrar={() => setGrupoPorAprobar(null)}
          >
            <ConfirmationDetail
              headerKicker="Ejecución — DME"
              headerTitle="Aprobar y enviar el expediente al secretario"
              statusCopy="Pasa al secretario"
              descriptionCopy={`¿Confirma aprobar el expediente COMPLETO y enviarlo al secretario? Se remitirán ${elegibles.length} ${
                elegibles.length === 1 ? "administrado" : "administrados"
              } en una sola acción. Pasarán a su Bandeja de Sorteo, donde él los marcará como revisados y los enviará al sorteo. Los expedientes permanecen en estado RECIBIDO.`}
              informationData={{
                Expediente:
                  grupoPorAprobar.expNumber ?? `#${grupoPorAprobar.expId}`,
                "Expedientes a enviar": `${elegibles.length} de ${grupoPorAprobar.totalCasos}`,
                Zonal: grupoPorAprobar.expZone ?? "—",
              }}
              onConfirm={confirmarAprobacionExpediente}
              onClose={() => setGrupoPorAprobar(null)}
              message={confirmMessage ?? undefined}
              confirmButtonText="Sí, aprobar el expediente"
              confirmButtonLoadingText="Aprobando…"
            />
          </DialogoModal>
        );
      })()
    : null;

  return {
    resolveActions,
    handleAction,
    aprobacionConfirmDialog,
    resolveGrupoActions,
    handleGrupoAction,
    expedienteConfirmDialog,
  };
}

export default useEpasInboxActions;
