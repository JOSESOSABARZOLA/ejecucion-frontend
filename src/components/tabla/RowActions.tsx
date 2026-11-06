/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Acciones de cada fila
 * Archivo: RowActions.tsx
 * Responsabilidad: Renderizar las funcionalidades permitidas para cada expediente
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado: 2026-04-07 - Integración con ModalContext
 * Modificado: 2026-09-15 - Fase 03.18 / Plan 03 (Andrés Miño): el nombre de la acción deja de ser,
 *   por sí solo, la clave del registro de modales. Se adopta el `actionToModalMap` de
 *   instruccion-frontend components/tabla/RowActions.tsx (Doris Villavicencio), adaptado: allí el
 *   mapa es una constante DENTRO del componente —se reconstruye en cada render y no se puede probar
 *   ni importar desde fuera—, y aquí sube a constante de módulo exportada.
 */

import { useCallback, useMemo, type FC } from "react";
import RowActionMenu from "./RowActionMenu";
import ActionButton from "./ActionButton";
import type { UserActions } from "../../interfaces/IUser";
import { modalRegistry } from "../../interfaces/IModal";
import { useModal, type ModalType } from "../../hooks/useModal";
import { useToast } from "../../hooks/useToast";
// import type { Case } from "../../interfaces/Case";

/**
 * Traducción explícita de **nombre de acción** a **clave de modal**.
 *
 * **Por qué existe.** Sin ella los dos son el mismo dato en dos sitios: el `actiName` que viaja en
 * los datos del backend tiene que ser, letra por letra, una clave de `modalRegistry`. Eso ata dos
 * cosas que cambian por motivos distintos —renombrar un modal es una decisión de esta pantalla;
 * renombrar una actividad es una decisión del catálogo del backend— y hace que tocar cualquiera de
 * las dos rompa a la otra en silencio. Peor: obliga a inventar nombres de modal para acciones que NO
 * abren modal, que es exactamente el casteo `as unknown as ModalType` que hoy hay en
 * `hooks/useEpasInboxActions.tsx` para `aprobarEpas`, `aprobarExpediente` y `devolverExpediente`.
 *
 * **Éste es el único sitio del frontend que conoce las dos cosas a la vez**, y por eso es el único
 * que hay que tocar cuando una de las dos cambia.
 *
 * **Por qué las entradas de hoy son de identidad.** Porque esa es, medida, la correspondencia
 * vigente: hasta hoy el despacho era `openModal(actiName)` directo. Escribirlas no es ceremonia —
 * las hace visibles y versionables, de modo que el día que una deje de ser identidad el cambio se
 * lea en el diff en vez de deducirse de una pantalla que dejó de abrir. Los Planes 05 y 06 añaden
 * aquí las once acciones de la rama del correctivo, varias de las cuales apuntarán al MISMO modal
 * genérico: ésa es la capacidad que esta constante introduce y que antes no existía.
 */
// El mapa y su resolutor viven AQUÍ a propósito: son el despacho de este componente y
// separarlos en otro archivo pondría a tres archivos de acuerdo sobre una sola decisión. La regla
// que se silencia es de ergonomía del recarga-en-caliente del servidor de desarrollo, no de
// correctitud: su coste es que editar este archivo remonte el árbol en vez de refrescarlo en sitio.
// eslint-disable-next-line react-refresh/only-export-components
export const ACCION_A_MODAL: Record<string, ModalType> = {
  // Lectura y consulta del expediente.
  caseReview: "caseReview",
  timeLine: "timeLine",
  resolveUntil: "resolveUntil",
  documentViewer: "documentViewer",
  // Generación documental y prórrogas.
  docsGenerate: "docsGenerate",
  seeExtendedCases: "seeExtendedCases",
  // Sorteo: envío, resultado y actas.
  sendCasesToAssignment: "sendCasesToAssignment",
  seeAssignmentResults: "seeAssignmentResults",
  resultadosSorteos: "resultadosSorteos",
  actaDatos: "actaDatos",
  firmaActa: "firmaActa",
  // Delegación (heredadas de Resolución).
  delegateForReview: "delegateForReview",
  delegateForAssignment: "delegateForAssignment",
  // Devoluciones a la DMR. `DEVOLVER_DMR` va en MAYÚSCULAS porque así se declaró su `MODAL_KEY`;
  // es la única clave del registro que no sigue el camello y por eso se deja anotada.
  DEVOLVER_DMR: "DEVOLVER_DMR",
  returnBatchDmr: "returnBatchDmr",
  // Excusa del decisor.
  excusarme: "excusarme",
  // ── Obligación de hacer — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05) ──────────────────────
  // Los seis actos con que el correctivo nace, se documenta y se cierra —o se declara incumplido—.
  // Los cuatro de la ESCALADA (sustitutoria, diligencia, respaldo y gastos) los añade el
  // Plan 06. Son entradas de identidad, como las de arriba: lo que aportan es que el día que uno
  // de estos nombres cambie en el catálogo del backend, el cambio se lea aquí en el diff en vez de
  // manifestarse como un botón que dejó de abrir.
  declararHacer: "declararHacer",
  deshacerHacer: "deshacerHacer",
  constatarIncumplimiento: "constatarIncumplimiento",
  adjuntarInforme: "adjuntarInforme",
  acreditarCumplimiento: "acreditarCumplimiento",
  registrarAlegacion: "registrarAlegacion",
  // ── Obligación de hacer — tramo de la ESCALADA (Fase 03.18, Plan 06) ────────────────────────
  // Lo que ocurre cuando el correctivo NO se cumple. Con estos cuatro, los DIEZ actos de la rama
  // tienen modal y ninguno cae en «Acción no disponible».
  ordenarSustitutoria: "ordenarSustitutoria",
  registrarDiligencia: "registrarDiligencia",
  registrarRespaldoCostos: "registrarRespaldoCostos",
  registrarGastosSustitutoria: "registrarGastosSustitutoria",
};

/**
 * Resuelve qué modal abre una acción: **primero el mapa**, y sólo si no hay entrada, la coincidencia
 * directa del nombre con una clave del registro —que es la conducta que había antes de la Fase 03.18
 * y que se conserva para que una clave nueva del registro funcione aunque nadie se acuerde de
 * anotarla aquí—. Si ninguna de las dos resuelve, devuelve `null`: **no se adivina**.
 *
 * El parámetro `mapa` existe para poder probar la traducción sin plantar entradas de mentira en el
 * mapa de la aplicación.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const resolverModalDeAccion = (
  actiName: string,
  mapa: Record<string, ModalType> = ACCION_A_MODAL,
): ModalType | null => {
  const porTraduccion = Object.prototype.hasOwnProperty.call(mapa, actiName)
    ? mapa[actiName]
    : undefined;

  if (porTraduccion) {
    return porTraduccion;
  }

  if (Object.prototype.hasOwnProperty.call(modalRegistry, actiName)) {
    return actiName as ModalType;
  }

  return null;
};

type RowActionsProps = {
  actions: UserActions[];
  data: any;
  refetchFn?: () => Promise<void> | undefined;
};

const RowActions: FC<RowActionsProps> = ({ actions, data, refetchFn }) => {
  const { addToast } = useToast();

  const { openModal } = useModal();

  // const [disabled, setDisabled] = useState(false);

  // useEffect(() => {
  //     const isRowDisabled = "isDisabled" in data && data.isDisabled;

  //   setDisabled(isRowDisabled || !data.caseResolveUntil ? true : false);
  // }, [data.caseResolveUntil, data.isDisabled]);

  // Filtrar acciones que serán botones (prioritario = true)
  const actionsButtons = useMemo(() => {
    return actions.filter((item) => item?.actiIsPrioritary);
  }, [actions]);

  // Filtrar acciones que irán al menú desplegable (prioritario = false)
  const rowActionsMenu = useMemo(() => {
    return actions.filter((item) => !item?.actiIsPrioritary);
  }, [actions]);

  /**
   * Maneja el click en una acción
   * - Traduce el nombre de la acción a clave de modal (`ACCION_A_MODAL`, y si no, coincidencia directa)
   * - Si la traducción resuelve, abre ese modal
   * - De lo contrario, muestra un warning
   */
  const handleModal = useCallback(
    (actiName: ModalType) => {
      // Una acción apagada no despacha. El botón ya va `disabled`, pero la guardia vive TAMBIÉN aquí
      // porque el despacho es de este componente: quien añada mañana otra forma de disparar la acción
      // —un atajo de teclado, un menú contextual— no tiene por qué acordarse de repetir la condición.
      const accionPulsada = actions.find((item) => item?.actiName === actiName);

      if (accionPulsada?.actiIsDisabled) {
        return;
      }

      const modalType = resolverModalDeAccion(actiName);

      // Si no hay modal configurado para esta acción
      if (!modalType) {
        addToast(
          "error",
          "Acción no disponible, porfavor comuníquese con el administrador",
          "Error de configuración",
        );
        console.warn(
          `No modal configured for action: ${actiName}. This action may require different handling.`,
        );
        return;
      }

      // Abrir modal con los datos del expediente y callbacks
      openModal(modalType, data, {
        onSuccess: () => {
          // Actualizar la fila con los nuevos datos
          // if (onUpdateRow && updatedData) {
          //   onUpdateRow(updatedData);
          // }
          // Ejemplo: refetchCases();
        },
        onError: (error) => {
          console.error("Modal action failed:", error);
          // Ejemplo: mostrar toast de error
        },
        refetchFn,
      });
    },
    [actions, data, openModal, refetchFn, addToast],
  );

  return (
    <div className="flex flex-row">
      {/* Acciones definidas como principales para un acceso más rápido por parte del usuario, se presentan directamente como botones para clickear */}
      <ActionButton
        items={actionsButtons}
        onClick={handleModal}
        // disabled={disabled}
      />

      {/* Acciones que se han definido como secundarias, y se presentarán en un menú desplegable, para no sobrecargar la interfaz con tantas opciones */}
      {rowActionsMenu.length > 0 && (
        <RowActionMenu
          items={rowActionsMenu}
          onClick={handleModal}
          // disabled={disabled}
        />
      )}
    </div>
  );
};

export default RowActions;
