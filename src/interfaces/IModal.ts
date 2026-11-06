/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Interfaces y tipos de modales
 * Archivo: Modal.ts
 * Responsabilidad: Definir tipos, interfaces y registro de modales
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-07
 * Modificado por: Andrés Miño — 2026-09-17 (quick 260917-anx: entra `anexarDocumento`, el modal del
 *   anexo libre al expediente).
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 09, D-08: los datos que recibe el modal
 *   `timeLine` se declaran, y dejan de ser el `Case` de Resolución.)
 */

import ModalCase from "../components/modals/ModalCase";
import { ModalTimeline } from "../components/modals/ModalTimeline";
import { ModalResolveUntil } from "../components/modals/ModalResolveUntil";
import ModalDocsGenerate, {
  MODAL_KEY as DOCS_GENERATE_KEY,
} from "../components/modals/ModalDocsGenerate";
import ModalExtendedCases, {
  MODAL_KEY as EXTENDED_CASES_KEY,
} from "../components/modals/ModalExtendedCases";
import ModalAssignmentConfirmation, {
  MODAL_KEY as SEND_ASSIGNMENT_CASES,
} from "../components/modals/ModalAssignmentConfirmation";
import ModalSendForReview, {
  MODAL_KEY as SEND_FOR_REVIEW,
} from "../components/modals/ModalSendForReview";
import ModalSendForAssignment, {
  MODAL_KEY as SEND_FOR_ASSIGNMENT,
} from "../components/modals/ModalSendForAssignment";
import { ModalDocumentViewer } from "../components/modals/ModalDocumentViewer";
import ModalAssignmentResult, {
  MODAL_KEY as SEE_ASSIGNMENT_RESULTS,
} from "../components/modals/ModalAssignmentResult";
import ModalReturnToDmr, {
  MODAL_KEY as RETURN_TO_DMR,
} from "../components/modals/ModalReturnToDmr";
import ModalReturnBatch, {
  MODAL_KEY as RETURN_BATCH,
} from "../components/modals/ModalReturnBatch";
import ModalExcusa, {
  MODAL_KEY as EXCUSARME,
} from "../components/modals/ModalExcusa";
import ModalActaDatos, {
  MODAL_KEY as ACTA_DATOS,
} from "../components/modals/ModalActaDatos";
import ModalFirmaActa, {
  MODAL_KEY as FIRMA_ACTA,
} from "../components/modals/ModalFirmaActa";
import ModalResultadosSorteos, {
  MODAL_KEY as RESULTADOS_SORTEOS,
} from "../components/modals/ModalResultadosSorteos";
// Quick 260917-anx — el anexo libre al expediente dejó de ser un formulario incrustado bajo la
// lista de documentos y pasó a este modal, que se abre desde la cabecera de la fila.
import ModalAnexarDocumento, {
  MODAL_KEY as ANEXAR_DOCUMENTO,
} from "../components/modals/ModalAnexarDocumento";
// Reunión del 2026-09-16 (punto 5) — la ficha del expediente que abre el ojo de cada fila de la
// Bandeja de Entrada: «Información del Expediente» + «Documentación» por Dirección, como Resolución.
import ModalExpedienteLote, {
  MODAL_KEY as EXPEDIENTE_LOTE,
} from "../components/modals/ModalExpedienteLote";

// ── Fase 03.18 / Plan 05 — la rama de OBLIGACIÓN DE HACER, tramo del CUMPLIMIENTO ──────────────
// Los seis actos con que el correctivo nace, se documenta y se cierra —o se declara incumplido—.
// El tramo de la ESCALADA (sustitutoria, diligencia, respaldo y gastos) lo añade el Plan 06.
import ModalDeclararHacer, {
  MODAL_KEY as DECLARAR_HACER,
} from "../components/obligacion-hacer/ModalDeclararHacer";
import ModalDeshacerHacer, {
  MODAL_KEY as DESHACER_HACER,
} from "../components/obligacion-hacer/ModalDeshacerHacer";
import ModalConstatarIncumplimiento, {
  MODAL_KEY as CONSTATAR_INCUMPLIMIENTO,
} from "../components/obligacion-hacer/ModalConstatarIncumplimiento";
import ModalAdjuntarInforme, {
  MODAL_KEY as ADJUNTAR_INFORME,
} from "../components/obligacion-hacer/ModalAdjuntarInforme";
import ModalAcreditarCumplimiento, {
  MODAL_KEY as ACREDITAR_CUMPLIMIENTO,
} from "../components/obligacion-hacer/ModalAcreditarCumplimiento";
import ModalRegistrarAlegacion, {
  MODAL_KEY as REGISTRAR_ALEGACION,
} from "../components/obligacion-hacer/ModalRegistrarAlegacion";

// ── Fase 03.18 / Plan 06 — la rama de OBLIGACIÓN DE HACER, tramo de la ESCALADA ────────────────
// Lo que ocurre cuando el correctivo NO se cumple: la orden de ejecución sustitutoria, la
// diligencia física con su acta, y los dos pasos del traslado de costos del art. 239. Con éstos,
// los DIEZ actos de la rama están en pantalla.
import ModalOrdenarSustitutoria, {
  MODAL_KEY as ORDENAR_SUSTITUTORIA,
} from "../components/obligacion-hacer/ModalOrdenarSustitutoria";
import ModalRegistrarDiligencia, {
  MODAL_KEY as REGISTRAR_DILIGENCIA,
} from "../components/obligacion-hacer/ModalRegistrarDiligencia";
import ModalRespaldoCostos, {
  MODAL_KEY as REGISTRAR_RESPALDO_COSTOS,
} from "../components/obligacion-hacer/ModalRespaldoCostos";
import ModalGastosSustitutoria, {
  MODAL_KEY as REGISTRAR_GASTOS_SUSTITUTORIA,
} from "../components/obligacion-hacer/ModalGastosSustitutoria";

/**
 * Tipos de modales disponibles en la aplicación
 * Se agrega un nuevo tipo cada vez que hay un nuevo modal
 */
export type ModalType =
  | "caseReview"
  | "timeLine"
  | "resolveUntil"
  | "documentViewer"
  | typeof SEND_ASSIGNMENT_CASES
  | typeof DOCS_GENERATE_KEY
  | typeof EXTENDED_CASES_KEY
  | typeof SEND_FOR_REVIEW
  | typeof SEND_FOR_ASSIGNMENT
  | typeof SEE_ASSIGNMENT_RESULTS
  | typeof RETURN_TO_DMR
  | typeof RETURN_BATCH
  | typeof EXCUSARME
  | typeof ACTA_DATOS
  | typeof FIRMA_ACTA
  | typeof RESULTADOS_SORTEOS
  | typeof ANEXAR_DOCUMENTO
  | typeof EXPEDIENTE_LOTE
  // Obligación de hacer — tramo del cumplimiento (Fase 03.18, Plan 05).
  | typeof DECLARAR_HACER
  | typeof DESHACER_HACER
  | typeof CONSTATAR_INCUMPLIMIENTO
  | typeof ADJUNTAR_INFORME
  | typeof ACREDITAR_CUMPLIMIENTO
  | typeof REGISTRAR_ALEGACION
  // Obligación de hacer — tramo de la ESCALADA (Fase 03.18, Plan 06).
  | typeof ORDENAR_SUSTITUTORIA
  | typeof REGISTRAR_DILIGENCIA
  | typeof REGISTRAR_RESPALDO_COSTOS
  | typeof REGISTRAR_GASTOS_SUSTITUTORIA;

/**
 * Lo que el modal `timeLine` necesita saber del expediente cuya línea de tiempo abre.
 *
 * ── POR QUÉ ESTOS TRES CAMPOS Y NINGUNO MÁS ───────────────────────────────────────────────────
 * Hasta hoy este modal pedía un `Case` ENTERO —el tipo de Resolución, con sus cuarenta campos— para
 * leer uno solo. Eso ataba la línea de tiempo a la única pantalla que sabe construir ese objeto, y
 * la bandeja del decisor no lo tiene ni tiene por qué tenerlo. Se declara el mínimo, como ya hace
 * `ExpedienteANotificar` (`components/notificacion/FormasNotificacionModal.tsx`): cualquier fila que
 * satisfaga esta forma puede abrirlo, y la satisface estructuralmente `MiEpasAsignado`.
 *
 * 🔴 `caseId` ES OPCIONAL Y ESO NO ES UN DESCUIDO: es el estado NORMAL. Medido sobre EjecucionDB el
 * 2026-09-21, solo 9 de 72 reflejos de sorteo tienen `case_id` —los del flujo real del 21-09; los 63
 * sembrados el 16-09 no—. Sin él no hay mitad de Asignaciones que pedir, y el modal lo DICE en vez
 * de romperse o de fingir que la traza está completa.
 *
 * La clave `timeLine` del registro y su política de lectura NO cambian: cambia lo que se le pasa.
 */
export interface DatosLineaDeTiempo {
  /** PK de `t_expediente_ejecucion`. Es la identidad con la que se lee la bitácora interna. */
  eejeId: number;
  /** Identidad del caso en ASIGNACIONES. Ausente ⇒ no se pide esa mitad y se avisa. */
  caseId?: number;
  /** Número del expediente, solo para la cabecera: sin él el modal no dice de cuál habla. */
  expNumber?: string;
  /**
   * Desde dónde se mira el expediente (Fase 03.24, Plan 20 — G-04).
   *
   * `"antesDelSorteo"` lo pone la Bandeja de Entrada cuando el EPAS todavía no se ha sorteado. En
   * ese momento no hay `caseId` que resolver —no le falta nada a nadie—, así que el aviso de «sin
   * identificador de asignación» sería FALSO y en su lugar se enseña una nota neutra.
   *
   * Solo decide qué frase se enseña: no es una regla de negocio y no cambia lo que se pide.
   */
  momento?: "antesDelSorteo";
}

/**
 * Callbacks que se ejecutan cuando un modal completa o falla una acción
 */
export interface ModalCallbacks {
  onSuccess?: (data?: any) => void;
  onError?: (error?: any) => void;
  refetchFn?: () => Promise<void> | undefined;
}

/**
 * Estado del modal actual
 */
export interface ModalState {
  isOpen: boolean;
  type: ModalType | null;
  data: any;
  callbacks?: ModalCallbacks;
}

/**
 * Interfaz del contexto de modales
 */
export interface ModalContextProps {
  modal: ModalState;
  openModal: (type: ModalType, data?: any, callbacks?: ModalCallbacks) => void;
  closeModal: () => void;
  triggerSuccess: (data?: any) => void;
  triggerError: (error?: any) => void;
}

/**
 * Registro de componentes de modales
 * Mapea tipos de modal al componente correspondiente
 * Se actualiza cuando se agrega un nuevo modal
 *
 * ⟳ 2026-09-15 (Fase 03.18, Plan 05) — **SE QUITÓ EL `as any` DEL CIERRE**, que anulaba la única
 * garantía que este `Record` da: que ningún miembro de `ModalType` se quede sin componente. Con el
 * casteo puesto, olvidarse de una entrada compilaba igual y el fallo solo aparecía al pulsar el
 * botón, como «Modal type not found in registry» en la consola. Sin él, el olvido es un error de
 * compilación (`TS2741`). Comprobado quitando a mano una entrada y volviéndola a poner.
 */
export const modalRegistry: Record<ModalType, React.ComponentType<any>> = {
  caseReview: ModalCase,
  timeLine: ModalTimeline,
  resolveUntil: ModalResolveUntil,
  documentViewer: ModalDocumentViewer,
  [SEND_ASSIGNMENT_CASES]: ModalAssignmentConfirmation,
  [DOCS_GENERATE_KEY]: ModalDocsGenerate,
  [EXTENDED_CASES_KEY]: ModalExtendedCases,
  [SEND_FOR_REVIEW]: ModalSendForReview,
  [SEND_FOR_ASSIGNMENT]: ModalSendForAssignment,
  [SEE_ASSIGNMENT_RESULTS]: ModalAssignmentResult,
  [RETURN_TO_DMR]: ModalReturnToDmr,
  [RETURN_BATCH]: ModalReturnBatch,
  [EXCUSARME]: ModalExcusa,
  [ACTA_DATOS]: ModalActaDatos,
  [FIRMA_ACTA]: ModalFirmaActa,
  [RESULTADOS_SORTEOS]: ModalResultadosSorteos,
  [ANEXAR_DOCUMENTO]: ModalAnexarDocumento,
  [EXPEDIENTE_LOTE]: ModalExpedienteLote,
  // Obligación de hacer — tramo del cumplimiento (Fase 03.18, Plan 05).
  [DECLARAR_HACER]: ModalDeclararHacer,
  [DESHACER_HACER]: ModalDeshacerHacer,
  [CONSTATAR_INCUMPLIMIENTO]: ModalConstatarIncumplimiento,
  [ADJUNTAR_INFORME]: ModalAdjuntarInforme,
  [ACREDITAR_CUMPLIMIENTO]: ModalAcreditarCumplimiento,
  [REGISTRAR_ALEGACION]: ModalRegistrarAlegacion,
  // Obligación de hacer — tramo de la ESCALADA (Fase 03.18, Plan 06).
  [ORDENAR_SUSTITUTORIA]: ModalOrdenarSustitutoria,
  [REGISTRAR_DILIGENCIA]: ModalRegistrarDiligencia,
  [REGISTRAR_RESPALDO_COSTOS]: ModalRespaldoCostos,
  [REGISTRAR_GASTOS_SUSTITUTORIA]: ModalGastosSustitutoria,
};
