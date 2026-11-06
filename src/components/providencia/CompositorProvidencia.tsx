/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Composición de providencias (Fase 03.14, Plan 06 · Fase 03.15, Plan 06 · Fase 03.19, Plan 12)
 * Archivo: CompositorProvidencia.tsx
 * Responsabilidad: EL CUERPO del compositor de providencias, sin cascarón: el funcionario decisor
 *   elige el tipo del catálogo, completa los datos de cabecera que el módulo todavía no sabe,
 *   escribe las secciones con formato e inserta los datos del expediente como tokens.
 *
 *   ── POR QUÉ ESTE ARCHIVO EXISTE (Fase 03.19, D-03) ──────────────────────────────────────────
 *   Hasta hoy todo esto vivía dentro de `EmitirProvidenciaModal.tsx`, pegado a su diálogo. La
 *   Fase 03.19 necesita el MISMO cuerpo montado en una PÁGINA de generación de documentos, y un
 *   cuerpo que solo sabe vivir dentro de un diálogo no se puede montar en una página. Así que el
 *   corte fue entre el CASCARÓN y el CUERPO: el cascarón de modal se quedó en
 *   `EmitirProvidenciaModal.tsx` y aquí quedó todo lo demás. Ese modal se RETIRÓ en la Fase 03.21
 *   (D-25): no tenía consumidor vivo, y una vía de emisión sin el paso de firma no puede quedar
 *   abierta. Desde entonces la única superficie que monta este compositor es la página de
 *   generación (`GenerarDocumentoPage`), que pide la clave en su paso 4.
 *
 *   🔴 **ES UN TRASLADO MECÁNICO.** No se tocó un campo, ni un token, ni el cuadro de horas, ni el
 *   bloque de prueba exigida, ni el editor. Lo que este archivo hace es exactamente lo que hacía el
 *   modal; el diff se lee como movimiento de líneas y no como reescritura, y eso es deliberado: lo
 *   que se emite es un acto administrativo y el payload no puede cambiar por un refactor.
 *
 *   ── EL CONTRATO CON QUIEN LO MONTA (léase antes de usarlo desde una página) ──────────────────
 *   · `caso` — el expediente. Es lo único que entra.
 *   · `onCancelar` — «el decisor se va sin emitir». El modal cierra; la página navega atrás.
 *   · `onEmitida` — se emitió. 🔴 Este componente NO cierra nada después de emitir: avisa, y quien
 *     lo monta decide. El modal cierra en su propio manejador; la página navegará a donde toque.
 *   · `paso` — qué parte del cuerpo se VE. Ausente ⇒ se ve todo (es el caso del modal). Los pasos
 *     ocultos se OCULTAN, no se desmontan: desmontarlos perdería lo redactado al volver atrás
 *     (UI-SPEC §4.2).
 *   · `renderBarraAcciones` — la página pone la suya al pie sin duplicar el cuerpo. Ausente ⇒ se
 *     pinta la barra de siempre (`Cancelar` · `Ver borrador` · `Emitir providencia`).
 *   · `onEstado` — canal de SOLO LECTURA hacia la cáscara. Existe porque el cascarón necesita dos
 *     datos que son estado interno de aquí: si el panel del borrador está abierto (el modal
 *     ENSANCHA su caja cuando lo está) y si se está emitiendo (el aspa no puede cerrar a medias).
 *   · `renderExtrasEdicion` — el punto de montaje del paso 2, encima del editor.
 *   · `antesDeEmitir` — 🔴 se ejecuta ANTES del `POST` de emisión y puede abortarlo. Es lo que hace
 *     que las formas de notificación estén persistidas cuando el servidor abre los despachos.
 *   · `confirmacion` — ajustes de la FICHA de la confirmación. Datos, nunca flujo.
 *
 *   ── LO QUE EL DECISOR NO ESCRIBE, Y ES LA MITAD DEL DOCUMENTO ────────────────────────────────
 *   La fórmula de traslado, el avoco, el cierre, LA NUMERACIÓN (1.1 · 2.1 PRIMERO: · 3.2.1) y el
 *   cuadro de horas los pone el backend. Aquí solo se redacta el cuerpo, y por eso la ayuda de cada
 *   sección insiste en escribir listas numeradas SIN teclear los números.
 *
 *   ── LA CONFIRMACIÓN DECLARA EL DESENLACE ────────────────────────────────────────────────────
 *   Emitir ciertos tipos MUEVE el expediente (la providencia es el acto administrativo, decisión del
 *   usuario 2026-08-17). Un «archivo por pago» no genera un PDF: cierra el caso. La confirmación lo
 *   dice con todas las letras ANTES de emitir, porque es irreversible desde esta pantalla.
 *
 *   ── Y AHORA, ADEMÁS, PUEDE LLEVAR LA PRUEBA CONSIGO (Fase 03.15, D-5) ───────────────────────
 *   Eso sigue siendo cierto y lo es MÁS que antes: desde esa fase la providencia es lo ÚNICO que
 *   mueve el expediente — registrar el pago o el cumplimiento ya no lo hace. Y como el acto se
 *   cierra «con los dos» —la providencia MÁS la prueba que la sustenta—, este cuerpo exige esa
 *   prueba: si ya consta en el expediente la CITA y no la pide; si no consta, la pide y la recibe
 *   en el mismo acto. El tipo del remanente pide DOS (D-7).
 *
 *   ── POR QUÉ HAY CAMPOS DE CABECERA QUE SE TECLEAN ───────────────────────────────────────────
 *   La multa, la orden de pago o la dirección de la infracción viven en Core y el módulo aún no los
 *   lee (es la Fase 5). Se piden aquí, vacíos, en vez de inventarlos: lo que no se llene sale «N/A».
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-09-21 (seam de D-03: el cuerpo se extrae para poder montarse
 *   en modal y en página)
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 16 — el MARCO monta este cuerpo). Tres
 *   props opcionales y dos correcciones, ninguna de ellas lógica de composición:
 *     · `renderExtrasEdicion`, `antesDeEmitir` y `confirmacion` — los tres huecos que la página
 *       necesita y que no se pueden resolver desde fuera (ver sus comentarios).
 *     · `EstadoCompositor.cuerpoConContenido` — la condición 2→3 del stepper, que solo aquí se sabe.
 *     · 🔴 La confirmación YA NO SE CIERRA cuando el servidor rechaza: hacía lo contrario de lo que
 *       su propia cabecera decía, y de lo que exigen UI-SPEC §4.8 y §5.8.
 *     · Abrir la confirmación limpia el aviso anterior: con uno viejo dentro, su botón de confirmar
 *       nacía apagado y no había manera de reintentar.
 *   Ni un campo, ni un token, ni el cuadro de horas, ni la prueba exigida, ni el editor, ni el
 *   payload cambiaron.
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-dw9 — UAT 03.15 paso 8: la prueba exigida
 *   se pedía pero no bloqueaba, y «Generar documento» se apagaba sin decir por qué). Dos campos
 *   nuevos, los dos opcionales: `EstadoCompositor.motivoPrueba` —qué hay que adjuntar para salir del
 *   paso 1, publicado por `onEstado`— y `AccionesCompositor.motivosNoEmitir` —un motivo por
 *   condición que falta, con el paso donde se arregla—. `puedeEmitir` pasa a DERIVARSE de esos
 *   motivos sin cambiar su verdad: son las mismas siete condiciones de antes, escritas una sola vez.
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-el5 — el borrador de providencia se guarda
 *   en el SERVIDOR). Dos props nuevas, las dos opcionales, para quien monta:
 *     · `autoguardado` — enciende el borrador en el servidor: se LEE junto con los tipos (el
 *       formulario no se pinta hasta que la lectura termina, así que recuperar no puede pisar nada
 *       tecleado), se guarda solo 2 s después del último cambio, se descarta con confirmación y se
 *       pausa antes de emitir. Ausente ⇒ el modal heredado: ni lee ni escribe (DP-16).
 *     · `onControlBorrador` — entrega hacia arriba un control estable (`guardarYa`) para que la
 *       página guarde lo pendiente antes de irse. Y `EstadoCompositor.estadoBorrador`, un primitivo,
 *       dice por `onEstado` si queda algo sin guardar.
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 13 — la infracción manda, D-04/D-06/
 *   D-13). Se retira la declaración manual de aptitud para trabajo comunitario: su casilla, su
 *   estado, su motivo en «Qué falta para emitir» y su campo en el payload (el backend lo rechaza con
 *   400 desde el Plan 07). En su lugar, con un tipo que AUTORIZA el TC, el compositor pide la ficha
 *   de infracciones del EPAS (`GET /epas/:eejeId/infracciones`): si la evaluación del servidor está
 *   BLOQUEADA, cada motivo entra en `motivosNoEmitir` en el paso 1; si está APTA, un bloque de SOLO
 *   LECTURA enseña qué infracciones entran al TC, cuáles quedan fuera y por qué, y lo compensable.
 *   🔴 El compositor no decide la aptitud: pinta lo que manda el servidor (T-03.23-16).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 10, D-25: la cabecera ya no presenta
 *   `EmitirProvidenciaModal` como ruta de repliegue — se retiró; la página de generación es la
 *   única superficie que monta el compositor. Props `obtenerClaveDeFirma` —la clave se pide en el
 *   instante de emitir y viaja como `signPassword`— y `alFallarFirma` —quien monta se queda con los
 *   fallos de firma y la confirmación se cierra—; el aviso de éxito dice si la providencia salió
 *   firmada, D-04/D-07/D-11).
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo de emitir se dice solo por
 *   la confirmación —en el aviso flotante— y no reaparece en el formulario al cerrarla; el fallo de
 *   carga del catálogo sigue en línea; el de descartar va al aviso flotante)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cc7 — el SBU lo escribe el ejecutor). Con
 *   un tipo que autoriza el TC, o con el cuadro sobre un TC aún sin autorizar, aparece el campo SBU
 *   en formato ecuatoriano («470,75»; «1.234» = mil doscientos treinta y cuatro), SIEMPRE vacío: el
 *   valor de Parámetros (`estadoTc.sbuParametro`) se enseña como referencia con `formatearUsd` y
 *   nunca lo rellena. Sin SBU válido, «Qué falta para emitir» lo dice (paso 2); el error de formato va
 *   bajo el campo; y un SBU de más del doble de la referencia avisa sin bloquear. El payload lleva
 *   `datosCuadro.sbu`, el mismo para emitir y para la vista previa.
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — los importes con `formatearUsd` de
 *   `utils/importe.util`, «USD 2.300,00»: la multa por infracción, lo susceptible de compensación y la
 *   referencia del SBU, que ahora dice «Valor en Parámetros: USD 460,00»)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — «Multa impuesta (USD)» de la cabecera
 *   es una casilla de texto con teclado decimal leída con `parsearImporte`: «2.300,50» viaja como
 *   2300.5; un texto que no es un importe se dice bajo el campo al salir de él y BLOQUEA la emisión
 *   con su motivo —antes se descartaba en silencio y el PDF salía con otra multa—; vacía no bloquea)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-ma6 — las horas de la resolución). Con el TC
 *   sin autorizar y `estadoTc.horasResolucion` > 0, «Horas fijadas por el acto administrativo» se
 *   PROPONE una sola vez por expediente con esas horas (si el campo está vacío), editable y borrable,
 *   con una línea de referencia; viajan por el mismo `datosCuadro.horasAutorizadas` que el cuadro y el
 *   sello. Si el ejecutor las borra, no se vuelven a proponer
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/react";
import { useToast } from "../../hooks/useToast";
import Alert, { type AlertVariant } from "../common/Alert";
import Boton from "../common/Boton";
import { PDFViewer } from "../pdf/PDFViewer";
import Loading from "../common/Loading";
import ConfirmationDetail from "../modals/ConfirmationDetail";
import RichTextEditor from "./RichTextEditor";
import {
  ProvidenciaService,
  ETIQUETA_ACCION_EPAS,
  type BorradorProvidencia,
  type ProvidenciaEmitida,
  type TipoProvidenciaDisponible,
  type EmitirProvidenciaPayload,
} from "../../services/ProvidenciaService";
import {
  horaDeGuardado,
  rotuloRecuperacion,
  useAutoguardadoBorrador,
} from "../../hooks/useAutoguardadoBorrador";
import {
  TrabajoComunitarioService,
  type EstadoTrabajoComunitario,
} from "../../services/TrabajoComunitarioService";
import { PagoService, type EstadoPago } from "../../services/PagoService";
import {
  InfraccionesService,
  type FichaInfracciones,
} from "../../services/InfraccionesService";
import { DatetimeUtil } from "../../utils/datetime.util";
import { formatearUsd, parsearImporte } from "../../utils/importe.util";
import type { MiEpasAsignado } from "../../services/SorteoService";
import OrdenesPagoCabecera from "../ordenes-pago/OrdenesPagoCabecera";
import { exitoProvidencia } from "../../config/firmaCopy";
import {
  MARCADOR_CUADRO,
  SECCION_CUERPO,
  cabeceraDesdeCaso,
  mezclarContextoTokens,
  seccionesParaEnviar,
  tieneContenido,
  tokensDisponibles,
  type BorradorComposicion,
} from "../../config/providenciaComposicion";

/**
 * Los cuatro pasos del stepper de la página de generación (UI-SPEC §4.2).
 *
 * Solo los dos primeros salen de este componente: «Información General» y «Edición del Documento».
 * El 3 (Notificación) y el 4 (Firma) los pone la página alrededor, y por eso aquí lo único que
 * hacen es ocultar el cuerpo entero — que sigue MONTADO, con lo redactado dentro.
 */
export type PasoCompositor = 1 | 2 | 3 | 4;

/** Lo que la cáscara necesita saber del interior para decidir su propio aspecto. Solo lectura. */
export interface EstadoCompositor {
  /** El panel del borrador está abierto. El modal ENSANCHA su caja mientras lo esté. */
  previaAbierta: boolean;
  /** Se está emitiendo. Mientras dure, la cáscara no puede dejar cerrar a medias. */
  emitiendo: boolean;
  /** Ya hay un tipo elegido: es la condición de «Ver borrador». */
  tipoElegido: boolean;
  /** Se cumplen todas las reglas del acto: es la condición de «Emitir providencia». */
  puedeEmitir: boolean;
  /**
   * El cuerpo tiene TEXTO REAL, no un párrafo hueco. Es la condición 2→3 de UI-SPEC §4.2, y la
   * publica este componente porque el cuerpo vive aquí: la página que gobierna el stepper no tiene
   * manera de mirarlo sin duplicar el estado del editor.
   *
   * ⚠️ OPCIONAL A PROPÓSITO. `BarraAccionesGeneracion.test.tsx` (Fase 03.19, Plan 13) construye un
   * `AccionesCompositor` literal para que el COMPILADOR compruebe que la barra sigue encajando con
   * este contrato. Declararlo obligatorio rompería esa comprobación —que es justamente la que hay
   * que conservar— sin que nada estuviera mal.
   */
  cuerpoConContenido?: boolean;
  /**
   * Qué hay que adjuntar para poder salir del paso 1, o `undefined` si no falta ninguna prueba
   * (quick 261006-dw9, UAT 03.15 paso 8). Es la condición de salida del paso 1 POR LA PRUEBA, y la
   * publica este componente por lo mismo que `cuerpoConContenido`: la prueba vive aquí, y la página
   * que gobierna el stepper no puede mirarla sin duplicar su estado. Ya viene redactada en español
   * («Adjunte … para continuar.»): la página la pinta tal cual, no la compone.
   *
   * ⚠️ OPCIONAL A PROPÓSITO, por la misma razón que `cuerpoConContenido`: el literal de
   * `BarraAccionesGeneracion.test.tsx` tiene que seguir compilando.
   */
  motivoPrueba?: string;
  /**
   * Si lo redactado está a salvo en el servidor (quick 261006-el5). Un PRIMITIVO, así que viaja por
   * `onEstado` sin bucles. Ausente ⇒ el compositor no autoguarda (el modal heredado).
   *
   * ⚠️ OPCIONAL A PROPÓSITO, por la misma razón que `cuerpoConContenido`.
   */
  estadoBorrador?: EstadoBorradorServidor;
}

/**
 * Qué tiene el servidor respecto de lo que se ve (quick 261006-el5):
 * · `sin-cambios` — nada que guardar: lo que se ve es lo guardado (o no hay nada redactado).
 * · `pendiente` — hay un cambio que el autoguardado todavía no escribió (o lo está escribiendo).
 * · `sin-guardar` — hay texto que NO está a salvo y el autoguardado no lo va a salvar solo: falló
 *   el último guardado, o la lectura inicial falló y el autoguardado quedó apagado (DP-9).
 */
export type EstadoBorradorServidor = "sin-cambios" | "pendiente" | "sin-guardar";

/** El control que el compositor entrega hacia arriba (mismo patrón que `onEditorReady`). Estable. */
export interface ControlBorrador {
  /** Escribe YA lo pendiente. `true` si queda a salvo; `false` si el servidor no lo aceptó. */
  guardarYa: () => Promise<boolean>;
}

/**
 * Una condición que falta para poder emitir, dicha a una persona (quick 261006-dw9).
 *
 * Lleva el PASO donde se arregla porque en la página el decisor la lee en el paso 4, y los campos del
 * paso 1 ya no están a la vista: decir «falta X» sin decir dónde obliga a buscar. El `texto` es
 * NEUTRO de superficie —no dice «revise el paso…»—: ese remate lo pone quien lo pinta, porque el
 * modal no tiene pasos.
 */
export interface MotivoNoEmitir {
  paso: PasoCompositor;
  texto: string;
}

/** El estado, más las tres acciones que una barra de acciones propia necesita disparar. */
export interface AccionesCompositor extends EstadoCompositor {
  /**
   * Un motivo por cada condición que falta para emitir, en el orden de los pasos; vacío ⇒ no falta
   * nada (quick 261006-dw9). `puedeEmitir` se DERIVA de esta lista, así que las dos no pueden
   * divergir.
   *
   * 🔴 NO viaja por `onEstado`, a diferencia de `motivoPrueba`: es un arreglo, y un arreglo en las
   * dependencias del efecto de `onEstado` haría un bucle onEstado → setState → render. Llega a la
   * barra en el MISMO render, igual que `puedeEmitir`. Opcional por el literal de la barra.
   */
  motivosNoEmitir?: readonly MotivoNoEmitir[];
  /** Se va sin emitir. Es `onCancelar` tal cual. */
  cancelar: () => void;
  /** Abre el panel del borrador, o lo cierra soltando la URL del PDF. */
  alternarPrevia: () => void;
  /** Abre la confirmación. NO emite: emitir es lo que se confirma dentro. */
  pedirConfirmacion: () => void;
}

/**
 * Lo que se le entrega a quien monta algo DENTRO del paso 2, encima del editor (Fase 03.19, Plan 16).
 *
 * 🔴 POR QUÉ ES UN CONTEXTO Y NO UN `ReactNode` SUELTO. La sección «basarse en un documento
 * anterior» necesita tres cosas que solo existen aquí dentro: la CLASE elegida en el paso 1, el
 * cuerpo VIVO del editor y la manera de volcarle el texto importado. Si la página las tuviera que
 * poner por su cuenta, tendría que duplicar el estado del editor — y el handoff del Plan 15 avisa de
 * que pasar una cadena vacía por comodidad apaga en silencio la confirmación de reemplazo
 * (T-03.19-68) sin que nada lo delate. Entregándolas desde aquí, ese error no se puede cometer.
 */
export interface ContextoEdicion {
  /** La clase de providencia elegida en el paso 1. Cadena vacía = todavía no eligió. */
  tipoCodigo: string;
  /** Cómo se llama esa clase en el catálogo. */
  nombreTipo?: string;
  /** 🔴 El cuerpo VIVO del editor, tal y como está en este render. */
  cuerpoActual: string;
  /** Vuelca HTML en el cuerpo. Es lo mismo que teclearlo: el editor lo recibe y lo sanea. */
  importarCuerpo: (html: string) => void;
  /** Hay una emisión en vuelo. */
  emitiendo: boolean;
}

/**
 * Ajustes de la FICHA de la confirmación. Son DATOS: ni una decisión de flujo viaja por aquí.
 *
 * Existe porque la confirmación de la PÁGINA tiene que decir cosas que el cuerpo no conoce
 * (UI-SPEC §4.8): las formas de notificación elegidas en el paso 3 y si el documento saldrá o no
 * con firma criptográfica, que lo decide el paso 4. Ausente, la confirmación es exactamente la de
 * siempre y el modal no cambia.
 */
export interface AjustesConfirmacion {
  headerKicker?: string;
  headerTitle?: string;
  statusCopy?: string;
  descriptionCopy?: string;
  /** Filas que se AÑADEN a la ficha, después de las que arma el cuerpo. */
  informacionExtra?: Record<string, string>;
  /** Rótulo del botón que confirma. En la página es la CTA de la fase (UI-SPEC §5, §5.8). */
  confirmButtonText?: string;
  confirmButtonLoadingText?: string;
}

export interface PropsCompositorProvidencia {
  caso: MiEpasAsignado;
  /** El decisor se va sin emitir. */
  onCancelar: () => void;
  /** Se emitió. Quien monta decide qué hacer después; este componente no cierra nada. */
  onEmitida?: (resultado: ProvidenciaEmitida) => void;
  /** Qué parte del cuerpo se ve. Ausente ⇒ todo (el caso del modal). */
  paso?: PasoCompositor;
  /** Barra de acciones propia. Ausente ⇒ la de siempre. */
  renderBarraAcciones?: (acciones: AccionesCompositor) => ReactNode;
  /**
   * Envoltorio de la confirmación de emisión. Ausente ⇒ una superposición corriente
   * (`div.modal.modal-open`), que es lo que sirve en una PÁGINA.
   *
   * 🔴 **POR QUÉ ES UN PARÁMETRO Y NO UNA DECISIÓN DE AQUÍ (Pitfall 11).** La confirmación se
   * dibujaba como un segundo diálogo nativo, hermano del primero. En una página no hay primero, y
   * un diálogo nativo suelto no se vería. Pero al modal ese envoltorio sí le sirve —y además lo
   * necesita en un portal, porque dentro de la caja del modal quedaría recortado—. La forma del
   * envoltorio depende, pues, de la superficie: la pone quien monta, y este componente se queda
   * sin saber en cuál vive. Aquí dentro no hay ningún elemento de diálogo nativo, y esa ausencia se
   * comprueba.
   */
  envolverConfirmacion?: (contenido: ReactNode) => ReactNode;
  /** Canal de solo lectura hacia la cáscara. */
  onEstado?: (estado: EstadoCompositor) => void;
  /**
   * PUNTO DE MONTAJE del paso 2, encima del editor. Ausente ⇒ no se pinta nada y el paso 2 es el de
   * siempre. Es lo único que la Fase 03.19 / Plan 16 añade al CONTENIDO de este componente.
   */
  renderExtrasEdicion?: (contexto: ContextoEdicion) => ReactNode;
  /**
   * 🔴 SE EJECUTA ANTES DEL `POST` DE EMISIÓN, y si rechaza NO se emite (Fase 03.19, Plan 16 — D-05).
   *
   * POR QUÉ ES UN PARÁMETRO Y NO ALGO QUE HAGA LA PÁGINA POR SU CUENTA. El servidor abre un despacho
   * de notificación por cada forma **ya persistida** en el momento de emitir: si las formas se
   * guardaran después, el acto quedaría emitido y nadie notificado, y ningún plazo arrancaría
   * (T-03.19-70). La página no puede intercalarse sola, porque quien llama a `ProvidenciaService.emitir`
   * es este componente. Con este gancho el orden deja de depender de que alguien se acuerde: es
   * ESTRUCTURAL, y un fallo al guardar aborta la emisión en vez de dejarla a medias.
   *
   * ⚠️ No recibe ni devuelve nada del acto: no es un sitio donde tocar el payload.
   */
  antesDeEmitir?: () => Promise<void>;
  /**
   * 🔴 LA CLAVE DE FIRMA, PEDIDA EN EL INSTANTE DE EMITIR (Fase 03.21, D-04/D-16). Se llama UNA vez,
   * DESPUÉS de `antesDeEmitir` y justo antes del `POST`, y lo que devuelve viaja como tercer
   * argumento de `ProvidenciaService.emitir` (el campo `signPassword`, hermano de `payload`).
   *
   * Es un GETTER, simétrico a `antesDeEmitir`, y no un valor: así la clave no pasa por el estado de
   * este componente ni por el de quien lo monta, y no hay ningún render que la lleve consigo. El
   * compositor no sabe de claves; la pide y la entrega. Ausente o `undefined` ⇒ se emite sin clave
   * (firmador apagado).
   */
  obtenerClaveDeFirma?: () => string | undefined;
  /**
   * Quien monta decide qué hacer con un fallo de la emisión (Fase 03.21, D-07, UI-SPEC §3.3). Si
   * responde `true`, el fallo es SUYO —la página lo pinta junto al campo de la clave—: la
   * confirmación se cierra y aquí no se pinta nada. Si responde `false`, o si la prop no está, la
   * conducta de la 03.19: la confirmación queda abierta con el mensaje del servidor.
   *
   * Por qué es un parámetro: el compositor no sabe en qué superficie vive; la página sí, y sabe
   * dónde está el remedio de un fallo de firma (el campo de la clave, detrás de la confirmación).
   */
  alFallarFirma?: (err: unknown) => boolean;
  /** Ajustes de la ficha de la confirmación (UI-SPEC §4.8). Ausente ⇒ la de siempre. */
  confirmacion?: AjustesConfirmacion;
  /**
   * Enciende el borrador guardado en el SERVIDOR (quick 261006-el5). Ausente ⇒ ni se lee ni se
   * escribe: es el modal heredado, y el autoguardado es opt-in a propósito (DP-16).
   */
  autoguardado?: boolean;
  /** Recibe el control estable del borrador, para guardar lo pendiente antes de salir. */
  onControlBorrador?: (control: ControlBorrador) => void;
}

/**
 * Campos de cabecera que el expediente todavía no provee y que el decisor completa a mano.
 *
 * 🔴 El NÚMERO DE ORDEN DE PAGO ya no está aquí (2026-09-03). Se tecleaba en cada providencia y solo
 * vivía dentro de ese PDF: ahora es un hecho del expediente —se registra en la bandeja «Órdenes de
 * pago»— y el backend lo imprime leyéndolo de ahí. Volver a ponerlo en esta lista devolvería el
 * problema: dos sitios donde teclear el mismo dato y ninguno que mande.
 */
const CAMPOS_CABECERA: ReadonlyArray<{
  clave: string;
  etiqueta: string;
  /** «importe»: dinero en formato ecuatoriano, leído con `parsearImporte` (quick 261105-cvq). */
  tipo?: "importe";
}> = [
  { clave: "asunto", etiqueta: "Asunto" },
  { clave: "administracionZonal", etiqueta: "Administración zonal" },
  { clave: "direccionInfraccion", etiqueta: "Dirección de la infracción" },
  { clave: "correos", etiqueta: "Correo electrónico" },
  { clave: "multaImpuesta", etiqueta: "Multa impuesta (USD)", tipo: "importe" },
] as const;

/** Id del error bajo la casilla de la multa de la cabecera (aria-describedby). */
const ID_ERROR_MULTA_CABECERA = "compositor-multa-cabecera-error";

/** El papel que sustenta cada desenlace. Espeja `PruebaRequerida` del backend. */
type PruebaRequerida =
  | "COMPROBANTE_PAGO"
  | "INFORME_TC"
  | "COMPROBANTE_REMANENTE";

/**
 * Qué prueba exige cada tipo de providencia.
 *
 * 🔴 **Es un ESPEJO declarado de `PRUEBA_EXIGIDA` de
 * `ejecucion-backend/src/modules/ejecucion/providencias/application/providencia.service.ts`, y la
 * verdad la impone el servidor.** Si esta tabla se equivocara —de más o de menos—, la emisión se
 * rechaza allí: la pantalla NO reimplementa la regla, la ANTICIPA para no hacer teclear en balde ni
 * pedir un papel que el expediente ya tiene. Si cambia allí, cambia aquí.
 *
 * ⚠️ El tipo 4 (`ARCHIVO_POR_ENVIO_A_COACTIVA`) no figura, igual que en el backend: lo que dispone
 * la coactiva es el SILENCIO del administrado, y del silencio no hay comprobante.
 */
const PRUEBA_EXIGIDA: Record<string, readonly PruebaRequerida[]> = {
  /** Tipo 3 — archivo por pago de la multa. */
  ARCHIVO_POR_PAGO_O_CONVENIO_DE_PAGO: ["COMPROBANTE_PAGO"],
  /** Tipo 9 — archivo por cumplimiento TOTAL del trabajo comunitario (D-8). */
  ARCHIVO_POR_TRABAJO_COMUNITARIO: ["INFORME_TC"],
  /** Tipo 30 — 🔴 el único con DOS: el informe Y el comprobante del remanente (D-7). */
  ARCHIVO_POR_TRABAJO_COMUNITARIO_PAGO_REMANENTE_O_CONVENIO_DE: [
    "INFORME_TC",
    "COMPROBANTE_REMANENTE",
  ],
  /** Tipo 31 — archivo por trabajo comunitario con envío a coactiva (D-8). */
  ARCHIVO_POR_TRABAJO_COMUNITARIO_ENVIO_A_COACTIVA: ["INFORME_TC"],
};

/** Cómo se llama cada prueba cuando hay que pedírsela a una persona (mismas palabras del backend). */
const NOMBRE_PRUEBA: Record<PruebaRequerida, string> = {
  COMPROBANTE_PAGO: "el comprobante del pago de la multa",
  INFORME_TC: "el informe del trabajo comunitario",
  COMPROBANTE_REMANENTE: "el comprobante del pago del remanente",
};

/**
 * Qué hay que aportar de cada papel, en palabras de quien lo teclea (quick 261006-dw9). Acompaña a
 * `NOMBRE_PRUEBA` en los motivos: «falta el comprobante» no basta si sin la fecha y la transacción
 * tampoco se puede seguir.
 */
const DETALLE_PRUEBA: Record<PruebaRequerida, string> = {
  COMPROBANTE_PAGO: "con su fecha y su número de transacción",
  INFORME_TC: "con las horas cumplidas",
  COMPROBANTE_REMANENTE: "con su fecha y su número de transacción",
};

/** Tope del servidor (`limits.fileSize`), por fichero. Aquí se anticipa para no subir en balde. */
const LIMITE_PRUEBA_BYTES = 10 * 1024 * 1024;

/**
 * Qué le pasa a este PDF, si es que le pasa algo. `null` = sirve.
 *
 * Es la MISMA comprobación que hace el servidor (`soloPdf` + `limits.fileSize`), adelantada aquí
 * por lo mismo que la tabla de arriba: que nadie espere a que suban 30 MB para que se los rechacen.
 */
const problemaDelPdf = (archivo: File | null): string | null => {
  if (!archivo) return null;
  if (archivo.type !== "application/pdf")
    return "Solo se admiten archivos PDF.";
  if (archivo.size > LIMITE_PRUEBA_BYTES)
    return "El archivo supera los 10 MB que admite el servidor.";
  return null;
};

/** Fecha legible para imprimir en el acto; `undefined` si no hay dato (no «Sin fecha»). */
const fechaImprimible = (valor?: string): string | undefined =>
  valor ? DatetimeUtil.formatDate(valor) : undefined;

/** Convierte un campo de texto opcional a número; vacío o inválido ⇒ `undefined` (lo calcula el servidor). */
const numeroOpcional = (valor: string): number | undefined => {
  const n = Number(valor);
  return valor.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Quick 261105-ma6: las horas de trabajo comunitario que fijó la RESOLUCIÓN, solo si se pueden
 * proponer como las del acto administrativo — entero mayor que cero y TC todavía SIN autorizar (con
 * el TC autorizado el cuadro reimprime lo sellado). Si no, `undefined`.
 */
const horasResolucionPositivas = (
  estado: EstadoTrabajoComunitario | null,
): number | undefined => {
  const horas = estado?.horasResolucion;
  return estado != null &&
    !estado.autorizadoAt &&
    horas !== undefined &&
    Number.isInteger(horas) &&
    horas > 0
    ? horas
    : undefined;
};

/**
 * Clase del grupo de un paso.
 *
 * Oculto es `display:none` y NO desmontado, que es la regla de UI-SPEC §4.2: al volver atrás, lo
 * redactado sigue ahí. Visible reparte con el mismo `gap-4` del contenedor, así que la agrupación
 * en pasos no cambia el espaciado de la superficie que no usa pasos.
 *
 * 🔴 La clase con NOMBRE, y no la utilidad `hidden` (Fase 03.19, Plan 13 — salda el pendiente §30).
 * El plan 12 necesitaba el mecanismo antes de que existiera su CSS y dejó la utilidad como
 * sustituto declarado. `app-modules-docs-page-step-hidden` ya existe —
 * `src/styles/administration/administration-docs-generate-page.css`— y es la que UI-SPEC §4.2
 * nombra, así que el sustituto se retira: un contrato de diseño que nombra una clase inexistente
 * manda a buscar algo que no está. La conducta es la misma (`display: none !important`) y las
 * pruebas del plan 12 la siguen afirmando, ahora por el nombre bueno.
 */
const claseGrupo = (visible: boolean): string =>
  visible ? "flex flex-col gap-4" : "app-modules-docs-page-step-hidden";

const CompositorProvidencia = ({
  caso,
  onCancelar,
  onEmitida,
  paso,
  renderBarraAcciones,
  envolverConfirmacion,
  onEstado,
  renderExtrasEdicion,
  antesDeEmitir,
  obtenerClaveDeFirma,
  alFallarFirma,
  confirmacion: ajustesConfirmacion,
  autoguardado = false,
  onControlBorrador,
}: PropsCompositorProvidencia) => {
  const { addToast } = useToast();
  const [tipos, setTipos] = useState<TipoProvidenciaDisponible[]>([]);
  const [tipoCodigo, setTipoCodigo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [emitiendo, setEmitiendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  /**
   * Si la columna del borrador está abierta. Mientras lo esté, se refresca sola al dejar de escribir.
   *
   * Arranca ABIERTA (decisión del usuario, 2026-08-21): el borrador es la referencia mientras se
   * redacta, no algo que se consulta al final. Teniendo que pedirlo, se escribe la providencia
   * entera a ciegas y se mira una vez —que es justo lo que la vista previa venía a evitar—.
   * Se puede ocultar; entonces deja de generarse.
   */
  const [previaAbierta, setPreviaAbierta] = useState(true);
  /** URL de blob del borrador que se está viendo. */
  const [previa, setPrevia] = useState<string | null>(null);
  /**
   * Contador que sube cada vez que cambia algo del EXPEDIENTE que la providencia lee por su cuenta
   * (hoy: la orden de pago registrada desde la cabecera).
   *
   * Hace falta porque el refresco automático se dispara con `firmaDelBorrador`, que es el payload
   * que se envía — y la orden NO va en el payload: la lee el servidor al armar el PDF. Sin este
   * contador, registrar una orden no cambiaría la firma y el borrador seguiría enseñando la
   * cabecera sin número justo después de que el decisor lo acabara de teclear.
   */
  const [revisionExpediente, setRevisionExpediente] = useState(0);
  const [generandoPrevia, setGenerandoPrevia] = useState(false);
  /** Por qué el borrador que se ve no refleja lo último escrito. `null` = está al día. */
  const [previaDesfasada, setPreviaDesfasada] = useState<string | null>(null);
  /**
   * El fallo de la EMISIÓN: va SOLO como `message` de la confirmación, que lo dice en el aviso
   * flotante y bloquea el reintento (quick 261028-kmg). No se pinta en el formulario.
   */
  const [mensajeEmision, setMensajeEmision] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);
  /** Fallo al CARGAR el catálogo de tipos: se dice en línea, en su hueco (regla 3b). */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [borrador, setBorrador] = useState<BorradorComposicion>({});
  /**
   * ¿Lleva cuadro de horas? Lo dice el TEXTO, no una casilla aparte: el marcador dentro del cuerpo
   * es la única señal, aquí y en el backend. Si el decisor lo borra al editar, el cuadro desaparece
   * — que es lo coherente con «manda el editor», y evita la contradicción de una casilla marcada
   * sobre un documento donde el cuadro ya no está.
   */
  const incluyeCuadro = (borrador.cuerpo ?? "").includes(MARCADOR_CUADRO);
  const [datosCuadro, setDatosCuadro] = useState({
    ordenRemanente: "",
    plazoCumplimiento: "",
    // Fase 03.14.2: las horas y el plazo pueden venir del ACTO ADMINISTRATIVO (nota de la act. 16.1).
    // Vacíos = los calcula el servidor desde el SBU, que es el camino normal.
    // Quick 261105-ma6: las horas del acto administrativo se PROPONEN con las de la resolución
    // (`estadoTc.horasResolucion`), una vez y solo con el TC sin autorizar; el ejecutor puede
    // corregirlas o borrarlas. Viajan por el mismo `datosCuadro.horasAutorizadas` que el cuadro y el
    // sello: una sola entrada. A diferencia del SBU (261105-cc7), es el dato del propio acto de este
    // expediente, no un valor genérico de Parámetros.
    horasAutorizadas: "",
    plazoMeses: "",
    // Quick 261105-cc7: el SBU lo ESCRIBE el ejecutor, en formato ecuatoriano. 🔴 NUNCA se rellena
    // con datos del servidor —ni con `estadoTc.sbuParametro` ni con otra providencia—: el de
    // Parámetros es el de 2024 y aceptarlo por descuido es justo lo que la decisión evita.
    sbu: "",
  });
  /**
   * El campo SBU ya se visitó (se marca al salir de él y se apaga al editar). El error de formato
   * solo se pinta entonces: mientras se teclea «470,» no es un error todavía (quick 261028-kmg).
   */
  const [sbuTocado, setSbuTocado] = useState(false);
  /**
   * Quick 261105-ma6: el `eejeId` al que ya se le PROPUSIERON las horas de la resolución. Garantiza
   * una sola propuesta por expediente: si el ejecutor borra el campo, no vuelve a rellenarse.
   */
  const horasResolucionPropuestas = useRef<number | null>(null);
  /** Lo mismo para la «Multa impuesta (USD)» de la cabecera (quick 261105-cvq). */
  const [multaCabeceraTocada, setMultaCabeceraTocada] = useState(false);
  /**
   * La lectura de la ficha de infracciones para el TC (Fase 03.23, D-04/D-13), atada al EPAS por el
   * que se preguntó. `null` = todavía no hay respuesta. Sustituye a la declaración manual de aptitud
   * (D-06): ahora la aptitud la decide la infracción en CORE, y el servidor.
   */
  const [lecturaInfracciones, setLecturaInfracciones] = useState<{
    eejeId: number;
    ficha: FichaInfracciones | null;
    fallo: boolean;
  } | null>(null);
  /**
   * Decisión sobre la prórroga (Fase 03.14.4). `null` = todavía no eligió: no se preselecciona
   * ninguna, porque conceder y negar pesan lo mismo y proponer una sesgaría la decisión.
   */
  const [prorroga, setProrroga] = useState<{
    concedida: boolean | null;
    motivo: string;
  }>({ concedida: null, motivo: "" });
  /**
   * A qué dirección vuelve el expediente en la devolución por NULIDAD (2026-09-18).
   *
   * 🔴 ARRANCA EN `null`, SIN PRESELECCIONAR LA DMR. Es el mismo argumento que el de la prórroga y
   * pesa más aquí: un valor por defecto en el campo que decide a dónde SALE un expediente del módulo
   * es una respuesta que nadie dio. La DMR sería la opción cómoda —es de donde vienen casi todos—,
   * y justo por eso pasaría desapercibida el día que el acto anulado lo hubiera dictado Instrucción.
   */
  const [destinoDevolucion, setDestinoDevolucion] = useState<
    "DMR" | "DMIT" | null
  >(null);
  /** Lo que el SERVIDOR dice que se concedería. No se calcula aquí. */
  const [estadoTc, setEstadoTc] = useState<EstadoTrabajoComunitario | null>(
    null,
  );
  /**
   * ORIGEN A de la prueba: lo que YA consta en el expediente (Fase 03.15, D-5, puerta 1).
   *
   * `estadoPago` trae el comprobante de la multa; `estadoTc`, el informe y el pago del remanente.
   */
  const [estadoPago, setEstadoPago] = useState<EstadoPago | null>(null);
  /**
   * ORIGEN B: la prueba que el decisor está aportando AHORA, en este mismo acto (puerta 2).
   *
   * Los mismos campos sirven al comprobante de la MULTA y al del REMANENTE: el destino lo decide el
   * tipo que se esté emitiendo, y lo enruta el servidor — aquí no se ramifica.
   */
  const [pruebaPago, setPruebaPago] = useState<{
    pagoAt: string;
    transaccion: string;
    archivo: File | null;
  }>({ pagoAt: "", transaccion: "", archivo: null });
  const [pruebaTc, setPruebaTc] = useState<{
    horasCumplidas: string;
    archivo: File | null;
  }>({ horasCumplidas: "", archivo: null });
  const [cabeceraExtra, setCabeceraExtra] = useState<Record<string, string>>(
    {},
  );

  // El editor del cuerpo: es donde se insertan los tokens que se pulsen.
  const editorCuerpo = useRef<Editor | null>(null);

  // ── EL BORRADOR GUARDADO EN EL SERVIDOR (quick 261006-el5) ──────────────────────────────────
  // Sin `autoguardado` el motor recibe `eejeId: null` y es INERTE: el modal heredado no lee ni
  // escribe borradores (DP-16).
  const motor = useAutoguardadoBorrador({
    eejeId: autoguardado ? (caso.eejeId ?? null) : null,
    cuerpo: borrador.cuerpo ?? "",
    tipoCodigo,
  });
  const { armar, pausar, reanudar, guardarYa } = motor;
  /** El aviso «Se recuperó el borrador del…» y si el tipo guardado se tuvo que descartar (DP-13). */
  const [avisoRecuperacion, setAvisoRecuperacion] = useState<{
    rotulo: string;
    tipoDescartado: boolean;
  } | null>(null);
  /** La lectura del borrador falló: el autoguardado queda APAGADO en esta sesión (DP-9). */
  const [lecturaBorradorFallida, setLecturaBorradorFallida] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [descartando, setDescartando] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Solo con `autoguardado` y un expediente: si no, la lectura del borrador ni se pide.
    const eejeIdBorrador = autoguardado ? (caso.eejeId ?? null) : null;
    void (async () => {
      // Los tipos y el borrador, a la vez (DP-8): la recuperación necesita la lista para saber si el
      // tipo guardado sigue disponible, y ninguno de los dos debe esperar al otro.
      const [lecturaTipos, lecturaBorrador] = await Promise.allSettled([
        // Con el expediente: cada tipo llega diciendo si ESTE caso lo admite ahora.
        ProvidenciaService.tipos(caso.eejeId ?? undefined),
        eejeIdBorrador != null
          ? ProvidenciaService.leerBorrador(eejeIdBorrador)
          : Promise.resolve<BorradorProvidencia | null>(null),
      ]);
      if (!vivo) return;

      let lista: TipoProvidenciaDisponible[] = [];
      if (lecturaTipos.status === "fulfilled") {
        lista = lecturaTipos.value;
        setTipos(lista);
      } else {
        const err: unknown = lecturaTipos.reason;
        setErrorCarga(
          mensajeParaUsuario(err, "No se pudo cargar el catálogo de tipos de providencia."),
        );
      }

      // 🔴 LA RECUPERACIÓN (D-04). El formulario está OCULTO mientras `cargando`, así que aquí no
      // existe nada tecleado en esta sesión que la recuperación pueda pisar; y se aplica UNA sola
      // vez por montaje, en esta continuación. El tipo se pone con `setTipoCodigo` DIRECTAMENTE y
      // nunca con `elegirTipo`, que precargaría la plantilla del tipo encima del texto guardado.
      if (eejeIdBorrador != null) {
        if (lecturaBorrador.status === "fulfilled") {
          const guardado = lecturaBorrador.value;
          if (guardado) {
            const delCatalogo = guardado.tipoCodigo
              ? lista.find((t) => t.codigo === guardado.tipoCodigo)
              : undefined;
            // DP-13: un tipo que ya no está o no está disponible NO se restaura (saltaría el
            // `disabled` del selector); el cuerpo sí, y el aviso lo dice.
            const tipoVale = !!delCatalogo && delCatalogo.disponible !== false;
            const tipoRecuperado = tipoVale ? guardado.tipoCodigo : null;
            setBorrador((previo) => ({ ...previo, cuerpo: guardado.cuerpo }));
            if (tipoRecuperado) setTipoCodigo(tipoRecuperado);
            setAvisoRecuperacion({
              rotulo: rotuloRecuperacion(guardado.actualizadoAt),
              tipoDescartado: !!guardado.tipoCodigo && !tipoVale,
            });
            // Se arma con lo que QUEDA en pantalla: recuperar no vuelve a guardar.
            armar({ ...guardado, tipoCodigo: tipoRecuperado });
          } else {
            armar(null);
          }
        } else {
          // DP-9: sin saber qué hay en el servidor, guardar podría pisar un borrador que no se
          // pudo ver. El motor NO se arma.
          setLecturaBorradorFallida(true);
        }
      }
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
    // `caso.eejeId` entra en las dependencias porque la disponibilidad de cada tipo depende de
    // ESE expediente: el compositor se monta por caso, pero dejar la lista vacía sería mentir sobre
    // de qué depende esta carga. `armar` es estable.
  }, [caso.eejeId, autoguardado, armar]);

  const tipo = useMemo(
    () => tipos.find((t) => t.codigo === tipoCodigo),
    [tipos, tipoCodigo],
  );

  // ── LA PRUEBA QUE ESTE ACTO EXIGE (Fase 03.15, D-5) ─────────────────────────────────────────
  const exigidas = useMemo<readonly PruebaRequerida[]>(
    () => PRUEBA_EXIGIDA[tipo?.codigo ?? ""] ?? [],
    [tipo],
  );

  /** ¿Consta ya en el expediente? Entonces la providencia la CITA y no la vuelve a pedir. */
  const consta = useCallback(
    (prueba: PruebaRequerida): boolean => {
      if (prueba === "COMPROBANTE_PAGO") return !!estadoPago?.pagoAt;
      if (prueba === "INFORME_TC") return !!estadoTc?.informeDocId;
      return !!estadoTc?.remanentePagoAt;
    },
    [estadoPago, estadoTc],
  );

  /** Las que hay que PEDIR: exigidas por el tipo y sin constar todavía. */
  const porAportar = useMemo(
    () => exigidas.filter((p) => !consta(p)),
    [exigidas, consta],
  );
  /** Las que solo se CITAN: exigidas y ya en el expediente. */
  const citadas = useMemo(
    () => exigidas.filter((p) => consta(p)),
    [exigidas, consta],
  );

  const pideComprobante =
    porAportar.includes("COMPROBANTE_PAGO") ||
    porAportar.includes("COMPROBANTE_REMANENTE");
  const pideInforme = porAportar.includes("INFORME_TC");
  /** El comprobante que toca es el del REMANENTE, no el de la multa (tipo 30). */
  const comprobanteEsDelRemanente = porAportar.includes(
    "COMPROBANTE_REMANENTE",
  );

  const problemaComprobante = problemaDelPdf(pruebaPago.archivo);
  const problemaInforme = problemaDelPdf(pruebaTc.archivo);
  const horasTc = Number(pruebaTc.horasCumplidas);
  // Cero horas es un valor LEGÍTIMO: es el incumplimiento, y tiene su propia providencia (tipo 31).
  const horasTcValidas =
    pruebaTc.horasCumplidas.trim() !== "" &&
    Number.isInteger(horasTc) &&
    horasTc >= 0;

  const comprobanteCompleto =
    !!pruebaPago.archivo &&
    !problemaComprobante &&
    !!pruebaPago.pagoAt &&
    pruebaPago.transaccion.trim().length > 0;
  const informeCompleto =
    !!pruebaTc.archivo && !problemaInforme && horasTcValidas;

  /** Lo que el acto exige y todavía no tiene: ni consta, ni se está aportando. */
  const pruebasQueFaltan = useMemo(
    () =>
      porAportar.filter((p) =>
        p === "INFORME_TC" ? !informeCompleto : !comprobanteCompleto,
      ),
    [porAportar, informeCompleto, comprobanteCompleto],
  );

  /**
   * Qué hay que adjuntar para salir del paso 1 (quick 261006-dw9, D-01). Una CADENA y no la lista:
   * viaja por `onEstado`, y un primitivo no dispara el efecto si no cambió. Se deriva de
   * `pruebasQueFaltan` —la misma lista que bloquea la emisión— para que la puerta del paso 1 y la
   * del botón final no puedan contar dos cosas distintas.
   */
  const motivoPrueba =
    pruebasQueFaltan.length === 0
      ? undefined
      : `Adjunte ${pruebasQueFaltan
          .map((p) => `${NOMBRE_PRUEBA[p]}, ${DETALLE_PRUEBA[p]},`)
          .join(" y ")} para continuar.`;

  /**
   * CONTEXTO DE LOS TOKENS — los dos orígenes, ya mezclados y con la precedencia de D-5.
   *
   * Para el tipo del remanente el origen A es el pago del REMANENTE, no el de la multa: son dos
   * pagos distintos del mismo expediente y confundirlos imprimiría en el acto la transacción
   * equivocada.
   */
  const contextoTokens = useMemo(
    () =>
      mezclarContextoTokens(
        comprobanteEsDelRemanente || consta("COMPROBANTE_REMANENTE")
          ? {
              pagoAt: fechaImprimible(estadoTc?.remanentePagoAt),
              transaccion: estadoTc?.remanenteTransaccion,
            }
          : {
              pagoAt: fechaImprimible(estadoPago?.pagoAt),
              transaccion: estadoPago?.transaccion,
            },
        {
          pagoAt: fechaImprimible(pruebaPago.pagoAt),
          transaccion: pruebaPago.transaccion,
        },
      ),
    [
      comprobanteEsDelRemanente,
      consta,
      estadoTc,
      estadoPago,
      pruebaPago.pagoAt,
      pruebaPago.transaccion,
    ],
  );

  /**
   * 🔴 `contextoTokens` ESTÁ en las dependencias, y tiene que estar: la paleta filtra los tokens
   * sin valor, y con la prueba aportada en el mismo acto el valor aparece MIENTRAS SE TECLEA. Con
   * las dependencias de antes —solo `caso`— los dos tokens de la prueba no aparecerían nunca, sin
   * error y sin que nada se pusiera rojo.
   */
  const tokens = useMemo(
    () => tokensDisponibles(caso, contextoTokens),
    [caso, contextoTokens],
  );

  /**
   * Al elegir el tipo se precarga su borrador en DISPOSICIONES: es la parte formularia por tipo
   * («se dispone el archivo…»), mientras que los antecedentes son propios de cada expediente. Solo
   * se precarga si esa sección está vacía: nunca se pisa lo que el decisor ya escribió.
   */
  const elegirTipo = (codigo: string) => {
    setTipoCodigo(codigo);
    const elegido = tipos.find((t) => t.codigo === codigo);
    if (elegido?.borrador && !tieneContenido(borrador.cuerpo)) {
      setBorrador((previo) => ({
        ...previo,
        cuerpo: elegido.borrador,
      }));
    }
  };

  const insertarToken = useCallback((token: string) => {
    const editor = editorCuerpo.current;
    if (!editor) return;
    editor.chain().focus().insertContent(`${token} `).run();
  }, []);

  /**
   * Pone o quita el cuadro de horas, que es poner o quitar su MARCADOR.
   *
   * Al ponerlo se inserta en un párrafo propio al final del cuerpo —no en el cursor— porque el sitio
   * habitual es tras el texto que lo anuncia y así nunca parte una frase por la mitad; luego se
   * mueve como cualquier otro texto. Al quitarlo se borran TODAS sus apariciones: dejar una sola
   * imprimiría «{Cuadro de horas}» tal cual en el acto.
   */
  const alternarCuadro = useCallback(() => {
    const editor = editorCuerpo.current;
    if (!editor) return;

    if (editor.getHTML().includes(MARCADOR_CUADRO)) {
      const limpio = editor
        .getHTML()
        .split(MARCADOR_CUADRO)
        .join("")
        .replace(new RegExp("<p></p>", "g"), "");
      editor.commands.setContent(limpio);
      setBorrador((previo) => ({ ...previo, cuerpo: limpio }));
      return;
    }

    editor
      .chain()
      .focus("end")
      .insertContent(`<p>${MARCADOR_CUADRO}</p>`)
      .run();
  }, []);

  const secciones = useMemo(
    () => seccionesParaEnviar(borrador, caso, contextoTokens),
    [borrador, caso, contextoTokens],
  );

  /** Los que este expediente no admite ahora, con su motivo. Se listan, no se esconden. */
  const noDisponibles = useMemo(
    () => tipos.filter((t) => !t.disponible),
    [tipos],
  );

  /** ¿El tipo elegido RESUELVE una prórroga? Es el mismo para conceder y para negar. */
  const resuelveProrroga = tipo?.codigo === "TRABAJO_COMUNITARIO_PRORROGA";

  /**
   * ORIGEN A — lo que el expediente YA sabe de su prueba, leído al montar el compositor.
   *
   * Antes esta lectura estaba gateada por «¿resuelve una prórroga?», porque solo servía para la
   * previsión del nuevo vencimiento —que calcula el servidor, y derivar aquí el 50 % dejaría dos
   * versiones de la misma regla—. Desde la Fase 03.15 hace falta SIEMPRE: es lo que decide si la
   * providencia CITA la prueba o se la pide al decisor, y eso se sabe antes de elegir el tipo.
   *
   * ⚠️ Los dos fallos se tragan a propósito. Un EPAS que nunca pasó por pago o por trabajo
   * comunitario no tiene qué devolver, y eso no es un error que mostrar. El precio de tragarlos es
   * conocido y acotado: si la lectura falla habiendo dato, se pedirá una prueba que ya constaba y el
   * servidor rechazará con su mensaje —que nombra la fecha del pago ya registrado—, que es
   * exactamente lo que el decisor necesita leer.
   */
  useEffect(() => {
    if (caso.eejeId == null) return;
    const eejeId = caso.eejeId;
    let vivo = true;

    void PagoService.estado(eejeId)
      .then((datos) => {
        if (vivo) setEstadoPago(datos);
      })
      .catch(() => undefined);
    void TrabajoComunitarioService.estado(eejeId)
      .then((datos) => {
        if (!vivo) return;
        setEstadoTc(datos);
        // Quick 261105-ma6: PROPUESTA ÚNICA de las horas de la resolución como las del acto
        // administrativo. Solo con el TC sin autorizar (autorizado, el cuadro reimprime lo sellado)
        // y solo si el campo está vacío: lo que haya escrito el ejecutor gana.
        const horas = horasResolucionPositivas(datos);
        if (
          horas !== undefined &&
          horasResolucionPropuestas.current !== eejeId
        ) {
          horasResolucionPropuestas.current = eejeId;
          setDatosCuadro((p) =>
            p.horasAutorizadas.trim() === ""
              ? { ...p, horasAutorizadas: String(horas) }
              : p,
          );
        }
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, [caso.eejeId]);

  /** ¿El tipo elegido AUTORIZA trabajo comunitario? Es el que congela cifras y exige aptitud. */
  const autorizaTrabajoComunitario =
    tipo?.accionEpas === "INICIAR_TRABAJO_COMUNITARIO";

  /**
   * ── ¿HAY QUE ESCRIBIR EL SBU? (quick 261105-cc7) ─────────────────────────────────────────────
   * Espejo de `faltaSbuParaCalcular` del backend: hace falta cuando se CALCULA un cuadro o se
   * CONGELAN cifras —el tipo autoriza el TC (lleve o no el cuadro), o el cuadro va incluido y el TC
   * todavía no está autorizado—. Con el TC ya autorizado el cuadro reimprime lo sellado y no se pide.
   * La regla manda en el servidor; aquí solo se adelanta para no componer a ciegas.
   */
  const pideSbu =
    autorizaTrabajoComunitario || (incluyeCuadro && !estadoTc?.autorizadoAt);
  /** Quick 261105-ma6: las horas que fijó la resolución, si se proponen (TC sin autorizar, > 0). */
  const horasResolucion = horasResolucionPositivas(estadoTc);
  const sbuParseado = parsearImporte(datosCuadro.sbu);
  /** El SBU escrito, si es un importe válido mayor que cero; si no, `undefined`. */
  const sbuValido =
    sbuParseado !== undefined && sbuParseado > 0 ? sbuParseado : undefined;
  const sbuEscrito = datosCuadro.sbu.trim() !== "";
  const errorSbuVisible = sbuTocado && sbuEscrito && sbuValido === undefined;
  /** Centinela contra erratas (DD-9): un SBU sin la coma compensaría casi toda la multa. */
  const sbuSospechoso =
    sbuValido !== undefined &&
    estadoTc?.sbuParametro != null &&
    sbuValido > 2 * estadoTc.sbuParametro;

  // «Multa impuesta (USD)» de la cabecera (quick 261105-cvq). Es OPCIONAL —vacía, el servidor usa
  // la del expediente—, pero lo escrito tiene que ser un importe mayor que cero en formato
  // ecuatoriano: antes, un texto mal formado se descartaba en silencio y el PDF salía con otra multa.
  const multaCabeceraTexto = cabeceraExtra.multaImpuesta ?? "";
  const multaCabeceraEscrita = multaCabeceraTexto.trim() !== "";
  const multaCabeceraParseada = parsearImporte(multaCabeceraTexto);
  /** La multa escrita, si es un importe válido mayor que cero; si no, `undefined`. */
  const multaCabeceraValida =
    multaCabeceraParseada !== undefined && multaCabeceraParseada > 0
      ? multaCabeceraParseada
      : undefined;
  const multaCabeceraInvalida =
    multaCabeceraEscrita && multaCabeceraValida === undefined;
  const errorMultaCabeceraVisible =
    multaCabeceraTocada && multaCabeceraInvalida;

  /**
   * ── LA APTITUD LA DICE EL SERVIDOR (Fase 03.23, D-04/D-13) ──────────────────────────────────
   * Solo con un tipo que AUTORIZA el TC se pide la ficha de infracciones: pedirla refresca CORE
   * (D-08), y en las otras providencias no hay nada que decidir con ella. Mismo patrón `vivo` que la
   * lectura de pago y TC de arriba.
   *
   * 🔴 A DIFERENCIA DE ESA LECTURA, EL FALLO NO SE TRAGA. Allí un fallo solo hace pedir una prueba de
   * más; aquí dejaría emitir a ciegas un acto que el servidor rechazaría igual. Se convierte en un
   * motivo de no emitir con su frase.
   */
  useEffect(() => {
    if (!autorizaTrabajoComunitario || caso.eejeId == null) return;
    const eejeId = caso.eejeId;
    let vivo = true;

    InfraccionesService.ficha(eejeId)
      .then((ficha) => {
        if (vivo) setLecturaInfracciones({ eejeId, ficha, fallo: false });
      })
      .catch(() => {
        if (vivo) setLecturaInfracciones({ eejeId, ficha: null, fallo: true });
      });

    return () => {
      vivo = false;
    };
  }, [caso.eejeId, autorizaTrabajoComunitario]);

  /** ¿Hay que mirar las infracciones? Solo con un tipo que autoriza el TC y un EPAS aterrizado. */
  const miraInfracciones =
    autorizaTrabajoComunitario && caso.eejeId != null;
  /** Lo leído para ESTE expediente; lo de otro expediente no cuenta como respuesta. */
  const lecturaVigente =
    miraInfracciones && lecturaInfracciones?.eejeId === caso.eejeId
      ? lecturaInfracciones
      : null;
  const comprobandoInfracciones = miraInfracciones && lecturaVigente === null;
  const fichaInfracciones = lecturaVigente?.ficha ?? null;
  const falloInfracciones = lecturaVigente?.fallo ?? false;

  /**
   * ¿El tipo elegido DEVUELVE el expediente por nulidad? Es el único acto del módulo cuya dirección
   * de vuelta no está decidida de antemano: el expediente regresa a la dirección que dictó el acto
   * que la Procuraduría anuló (encargo del área, 2026-09-18).
   */
  const devuelvePorNulidad = tipo?.accionEpas === "DEVOLVER_POR_NULIDAD";

  // La providencia de prórroga TIENE que decir si concede o niega, y por qué: es lo que dispone.
  const decisionProrrogaIncompleta =
    resuelveProrroga &&
    (prorroga.concedida === null || prorroga.motivo.trim().length < 10);

  /**
   * ── LO QUE FALTA PARA EMITIR, DICHO A UNA PERSONA (quick 261006-dw9, D-03) ──────────────────
   * Un motivo por condición, en el orden de los pasos y con el paso donde se arregla. Es la ÚNICA
   * fuente de esas condiciones: `puedeEmitir`, justo debajo, se deriva de esta lista.
   */
  const motivosNoEmitir = useMemo<readonly MotivoNoEmitir[]>(() => {
    const motivos: MotivoNoEmitir[] = [];
    if (!tipo)
      motivos.push({ paso: 1, texto: "Falta elegir el tipo de providencia." });
    // Fase 03.23 (D-13): con un tipo que autoriza el TC, los motivos de bloqueo SON los del
    // servidor, palabra por palabra. Mientras se comprueba, o si no se pudo comprobar, tampoco se
    // emite: el servidor bloquearía igual, y el decisor lo descubriría al final.
    if (comprobandoInfracciones)
      motivos.push({
        paso: 1,
        texto: "Comprobando las infracciones del expediente…",
      });
    else if (falloInfracciones)
      motivos.push({
        paso: 1,
        texto:
          "No se pudo comprobar si las infracciones admiten trabajo comunitario.",
      });
    else if (fichaInfracciones?.evaluacionTc.estado === "BLOQUEADA")
      for (const motivo of fichaInfracciones.evaluacionTc.motivos)
        motivos.push({ paso: 1, texto: motivo.mensaje });
    // Quick 261105-cvq: una multa de cabecera mal escrita no se descarta en silencio, se dice.
    if (multaCabeceraInvalida)
      motivos.push({
        paso: 1,
        texto:
          "La multa impuesta de «Datos de la cabecera» no es un importe válido: use la coma para los centavos, por ejemplo 2.300,00.",
      });
    // La providencia de prórroga TIENE que decir si concede o niega, y por qué.
    if (decisionProrrogaIncompleta)
      motivos.push({
        paso: 1,
        texto:
          "Falta decidir si se concede o se niega la prórroga, con su motivo (mínimo 10 caracteres).",
      });
    // La devolución por nulidad no se emite sin decir a QUÉ dirección vuelve el expediente. Mismo
    // argumento que los dos de arriba: el servidor lo rechazaría igual, y bloquearlo aquí evita
    // componer la providencia entera para descubrirlo al final.
    if (devuelvePorNulidad && destinoDevolucion === null)
      motivos.push({
        paso: 1,
        texto: "Falta elegir a qué dirección vuelve el expediente.",
      });
    // «Se cierra con los dos»: sin la prueba que lo sustenta, este acto no se emite. El servidor
    // lo rechazaría igual; aquí se evita componer la providencia entera para descubrirlo al final.
    for (const p of pruebasQueFaltan)
      motivos.push({
        paso: 1,
        texto: `Falta ${NOMBRE_PRUEBA[p]}, ${DETALLE_PRUEBA[p]}.`,
      });
    if (secciones.length === 0)
      motivos.push({
        paso: 2,
        texto: "Falta escribir el cuerpo de la providencia.",
      });
    // Quick 261105-cc7: sin el SBU que escribe el ejecutor, el servidor rechaza el acto antes de
    // escribir nada. Aquí se dice antes, y en el paso donde está el campo.
    if (pideSbu && !sbuEscrito)
      motivos.push({
        paso: 2,
        texto:
          "Falta escribir el SBU en dólares con el que se calcula el trabajo comunitario.",
      });
    else if (pideSbu && sbuValido === undefined)
      motivos.push({
        paso: 2,
        texto:
          "El SBU escrito no es un importe válido: use la coma para los centavos, por ejemplo 470,75.",
      });
    return motivos;
  }, [
    tipo,
    comprobandoInfracciones,
    falloInfracciones,
    fichaInfracciones,
    multaCabeceraInvalida,
    decisionProrrogaIncompleta,
    devuelvePorNulidad,
    destinoDevolucion,
    pruebasQueFaltan,
    secciones,
    pideSbu,
    sbuEscrito,
    sbuValido,
  ]);

  // 🔴 ESTA es LA definición de «se puede emitir»: sin motivos, y ni emitiendo ni cargando. La
  // equivalencia con la que había antes del quick 261006-dw9 es EXACTA —son las mismas siete
  // condiciones, cinco de ellas ahora dentro de `motivosNoEmitir`—. Quien añada una regla la añade
  // ALLÍ, con su texto, nunca aquí: un bloqueo sin motivo es justo el «se apaga y no dice por qué»
  // que el UAT 03.15 (paso 8) denunció.
  const puedeEmitir = motivosNoEmitir.length === 0 && !emitiendo && !cargando;

  /**
   * El borrador tal y como viaja al backend.
   *
   * 🔴 Lo comparten EMITIR y la VISTA PREVIA, y tiene que seguir siendo así: si cada uno armara su
   * payload, la vista previa acabaría enseñando un documento distinto del que se emite, que es
   * exactamente lo que una vista previa no puede hacer.
   */
  const armarPayload = (eejeId: number, codigo: string) => {
    const cabecera = { ...cabeceraDesdeCaso(caso), ...cabeceraExtra };

    return {
      eejeId,
      tipoCodigo: codigo,
      cabecera: {
        ...cabecera,
        // Quick 261105-cvq: leída con `parsearImporte` («2.300,50» ⇒ 2300.5); solo viaja si es un
        // importe mayor que cero. Si está mal escrita, `motivosNoEmitir` ya impide emitir.
        multaImpuesta: multaCabeceraValida,
      },
      secciones,
      // Quick 261105-cc7: el SBU viaja como NÚMERO (el backend no sabe de comas) y solo cuando se
      // pide. Un tipo que autoriza el TC sin cuadro también lo lleva: congela cifras con él.
      datosCuadro: incluyeCuadro
        ? {
            ordenRemanente: datosCuadro.ordenRemanente || undefined,
            plazoCumplimiento: datosCuadro.plazoCumplimiento || undefined,
            horasAutorizadas: numeroOpcional(datosCuadro.horasAutorizadas),
            plazoMeses: numeroOpcional(datosCuadro.plazoMeses),
            sbu: pideSbu ? sbuValido : undefined,
          }
        : pideSbu
          ? { sbu: sbuValido }
          : undefined,
      prorroga:
        prorroga.concedida === null
          ? undefined
          : { concedida: prorroga.concedida, motivo: prorroga.motivo.trim() },
      // Fase 03.23 (D-06): la aptitud para trabajo comunitario NO viaja. La decide la infracción en
      // CORE y la evalúa el servidor; un campo de declaración aquí lo rechazaría con 400.
      // ── LOS DATOS DE LA PRUEBA, DENTRO DEL PAYLOAD (Fase 03.15, D-5) ───────────────────────
      // Van aquí y no aparte para que la VISTA PREVIA también los vea: es lo que permite que el
      // borrador imprima la fecha y la transacción mientras se teclean. El backend los ignora en
      // la vista previa —no persiste nada—, así que mandarlos no tiene coste.
      // 🔴 El FICHERO no entra: ver la nota junto a `firmaDelBorrador`.
      pruebaPago:
        pideComprobante && comprobanteCompleto
          ? {
              pagoAt: pruebaPago.pagoAt,
              transaccion: pruebaPago.transaccion.trim(),
            }
          : undefined,
      pruebaTc:
        pideInforme && informeCompleto
          ? { horasCumplidas: horasTc }
          : undefined,
      // 🔴 LA DIRECCIÓN DE VUELTA VA DENTRO DE `armarPayload`, NO APARTE EN `emitir`. Este payload lo
      // comparten EMITIR y la VISTA PREVIA (ver el aviso de arriba), y sacarlo de aquí lo dejaría
      // fuera del borrador que el decisor está mirando. Solo viaja cuando el tipo lo pide y hay
      // valor: en las otras treinta providencias el backend lo rechazaría como campo desconocido.
      devolucionDestino:
        devuelvePorNulidad && destinoDevolucion ? destinoDevolucion : undefined,
    };
  };

  /**
   * El borrador, en una cadena estable. Es lo que dispara el refresco: si no cambia, no se vuelve a
   * pedir nada — mover el cursor o abrir un desplegable no gasta una generación de PDF.
   *
   * 🔴 **POR QUÉ LOS FICHEROS DE LA PRUEBA QUEDAN FUERA DE ESTA FIRMA, Y TIENEN QUE SEGUIR FUERA.**
   * Esto se serializa con `JSON.stringify` y el efecto de abajo lo relanza con `JSON.parse`. **Un
   * `File` no sobrevive a ese viaje**: metido aquí se convertiría en `{}`, la firma dejaría de
   * cambiar al cambiar de archivo y —peor— la vista previa recibiría un payload mutilado. Por eso
   * `emitir` es lo único que pasó a FormData: los ficheros viajan APARTE, como segundo argumento
   * del servicio, y el payload sigue siendo un objeto serializable de punta a punta.
   */
  const firmaDelBorrador =
    tipo && caso.eejeId != null
      ? JSON.stringify(armarPayload(caso.eejeId, tipo.codigo))
      : null;

  /**
   * REFRESCO AUTOMÁTICO del borrador, 1,5 s después de dejar de escribir.
   *
   * ── POR QUÉ CON RETARDO Y NO EN CADA TECLA ───────────────────────────────────────────────────
   * Cada borrador es un PDF de ~175 KB que el backend arma entero (la mayor parte es la imagen de
   * fondo institucional). Pedirlo por pulsación seria una peticion por letra.
   *
   * ── POR QUÉ SOLO CON EL PANEL ABIERTO ────────────────────────────────────────────────────────
   * Generar borradores que nadie está mirando es trabajo tirado.
   *
   * 🔴 LA PETICIÓN VIEJA SE CANCELA. Escribiendo rápido llegan a solaparse varias, y sin cancelar
   * **puede llegar la última la primera**: quedaría en pantalla un borrador ANTERIOR al texto que
   * ya se ve en el editor, que es peor que no refrescar — el decisor creería estar viendo lo que
   * escribió.
   */
  useEffect(() => {
    if (!previaAbierta || !firmaDelBorrador) return;

    const control = new AbortController();
    const temporizador = setTimeout(() => {
      setGenerandoPrevia(true);
      ProvidenciaService.vistaPrevia(
        JSON.parse(firmaDelBorrador) as EmitirProvidenciaPayload,
        control.signal,
      )
        .then((url) => {
          setPrevia((anterior) => {
            if (anterior) URL.revokeObjectURL(anterior);
            return url;
          });
          setPreviaDesfasada(null);
        })
        .catch((err: unknown) => {
          if (control.signal.aborted) return;
          // ⚠️ El borrador anterior se QUEDA en pantalla. Vaciarlo por un fallo pasajero —o porque
          // el texto está a medio escribir— seria castigar al que escribe; se avisa de que lo que
          // se ve no es lo último y ya está.
          setPreviaDesfasada(
            mensajeParaUsuario(err, "No se pudo actualizar."),
          );
        })
        .finally(() => {
          if (!control.signal.aborted) setGenerandoPrevia(false);
        });
    }, 1500);

    return () => {
      clearTimeout(temporizador);
      control.abort();
    };
    // `revisionExpediente` NO se usa dentro del efecto y aun así es dependencia: es un disparador,
    // no un dato. Ver su declaración — lo que cambió está en el servidor, no en el payload.
  }, [previaAbierta, firmaDelBorrador, revisionExpediente]);

  /** Suelta el blob al cerrar: cada borrador retiene ~175 KB hasta que se revoca. */
  const cerrarPrevia = () => {
    setPreviaAbierta(false);
    setPreviaDesfasada(null);
    setPrevia((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return null;
    });
  };

  /**
   * 🔴 LA URL TAMBIÉN SE SUELTA AL DESMONTAR, y no solo al cerrar el panel (Pitfall 12).
   *
   * Cerrar el panel era suficiente mientras la única superficie era un modal que el decisor cerraba
   * con su aspa. Con dos superficies ya no: de una PÁGINA se sale con el botón «atrás» del
   * navegador, que desmonta sin pasar por `cerrarPrevia`, y cada salida así dejaría retenido el PDF
   * del último borrador. El espejo del estado en un `ref` existe porque la función de limpieza se
   * crea una sola vez —al montar— y tiene que poder leer el valor ÚLTIMO, no el de entonces.
   */
  const previaRef = useRef<string | null>(null);
  useEffect(() => {
    previaRef.current = previa;
  }, [previa]);
  useEffect(
    () => () => {
      if (previaRef.current) URL.revokeObjectURL(previaRef.current);
    },
    [],
  );

  /**
   * ¿Hay TEXTO REAL en el cuerpo? `seccionesParaEnviar` ya filtra por `tieneContenido`, así que un
   * `<p></p>` huérfano no cuenta — que es exactamente la condición 2→3 de UI-SPEC §4.2. Se deriva de
   * lo que se ENVÍA y no de una segunda regla escrita aparte, para que las dos no puedan divergir.
   */
  const cuerpoConContenido = secciones.length > 0;

  /**
   * Si lo redactado está a salvo en el servidor (quick 261006-el5). Sin `autoguardado`, ausente.
   * Con la lectura fallida o el motor sin armar, lo que haya escrito NO está a salvo y nada lo va a
   * salvar solo: «sin-guardar» si hay texto.
   */
  const hayTextoEnElCuerpo = tieneContenido(borrador.cuerpo);
  let estadoBorrador: EstadoBorradorServidor | undefined;
  if (!autoguardado) estadoBorrador = undefined;
  else if (lecturaBorradorFallida || motor.estado === "inactivo")
    estadoBorrador = hayTextoEnElCuerpo ? "sin-guardar" : "sin-cambios";
  else if (motor.estado === "pendiente" || motor.estado === "guardando")
    estadoBorrador = "pendiente";
  else if (motor.estado === "error") estadoBorrador = "sin-guardar";
  else estadoBorrador = "sin-cambios";

  /** El canal de solo lectura hacia la cáscara. Ver `EstadoCompositor`. */
  useEffect(() => {
    onEstado?.({
      previaAbierta,
      emitiendo,
      tipoElegido: !!tipo,
      puedeEmitir,
      cuerpoConContenido,
      motivoPrueba,
      estadoBorrador,
    });
  }, [
    onEstado,
    previaAbierta,
    emitiendo,
    tipo,
    puedeEmitir,
    cuerpoConContenido,
    motivoPrueba,
    estadoBorrador,
  ]);

  /** El control del borrador, hacia arriba. `guardarYa` es estable: esto corre una vez. */
  useEffect(() => {
    onControlBorrador?.({ guardarYa });
  }, [onControlBorrador, guardarYa]);

  const emitir = async () => {
    if (!tipo || caso.eejeId == null) return;
    setEmitiendo(true);
    try {
      // 🔴 ANTES DE NADA, SE PAUSA EL AUTOGUARDADO Y SE ESPERA EL PUT EN VUELO (quick 261006-el5,
      // DP-11). El servidor BORRA el borrador al emitir con éxito; un PUT tardío que llegara
      // después lo RESUCITARÍA, y el decisor encontraría al volver el texto de un acto ya emitido.
      // Si la emisión falla, el `catch` reanuda.
      await pausar();

      // 🔴 PRIMERO lo que la página exija (hoy: persistir las formas de notificación), y DESPUÉS
      // emitir. Si esto rechaza, no se emite: se cae al `catch` con el mensaje del servidor y la
      // confirmación se queda abierta. Ver `antesDeEmitir`.
      await antesDeEmitir?.();

      // 🔴 La clave se pide AHORA, después de `antesDeEmitir` y justo antes del `POST` (D-04/D-16):
      // no se guarda en ninguna variable de estado, solo viaja en esta llamada.
      const signPassword = obtenerClaveDeFirma?.();

      const resultado = await ProvidenciaService.emitir(
        armarPayload(caso.eejeId, tipo.codigo),
        {
          // Solo lo que este acto EXIGE y no consta: si la prueba ya estaba en el expediente no se
          // manda nada — la providencia la cita, y el servidor rechaza la segunda carga.
          comprobante: pideComprobante
            ? (pruebaPago.archivo ?? undefined)
            : undefined,
          informe: pideInforme ? (pruebaTc.archivo ?? undefined) : undefined,
        },
        signPassword,
      );

      // El aviso dice si la providencia salió FIRMADA (Fase 03.21, D-11, UI-SPEC §10.7). Si la
      // respuesta no lo informa, no se afirma una firma que nadie confirmó.
      addToast(
        "success",
        exitoProvidencia(
          resultado.firma?.aplicada === true,
          resultado.accionEpasAplicada
            ? (ETIQUETA_ACCION_EPAS[resultado.accionEpasAplicada] ??
                "el expediente cambió de estado")
            : undefined,
        ),
      );

      // 🔴 Las advertencias del servidor SE MUESTRAN Y NO BLOQUEAN (D-6). El caso vivo es el
      // archivo por trabajo comunitario TOTAL emitido sobre un cumplimiento PARCIAL: el servidor
      // calcula las horas y avisa, pero la última palabra sobre el propio acto es del decisor. Van
      // después del aviso de éxito, y en ámbar, para que no se lean como un fallo de la emisión.
      resultado.advertencias?.forEach((a) => addToast("warning", a.mensaje));
      setConfirmando(false);
      // 🔴 Aquí NO se cierra nada: quien monta decide. El modal cierra en su propio manejador de
      // `onEmitida`; una página navegará. Cerrar desde dentro obligaría a este componente a saber
      // en qué superficie vive, que es justo lo que la extracción vino a quitarle.
      onEmitida?.(resultado);
    } catch (err) {
      // 🔴 LA CONFIRMACIÓN NO SE CIERRA (Fase 03.19, Plan 16). Hasta hoy este `catch` hacía
      // `setConfirmando(false)`, que CONTRADECÍA lo que la cabecera de `confirmacion` —tres pantallas
      // más abajo— dice que hace: «pinta el mensaje del servidor en `message` cuando falla (y la
      // confirmación PERMANECE abierta) y solo la cierra con éxito». Es el patrón obligatorio de
      // `ConfirmationDetail` y lo que UI-SPEC §4.8 y §5.8 exigen: el decisor tiene que poder LEER
      // qué rechazó el servidor sin que la puerta se le cierre en la cara, y con la confirmación
      // cerrada el aviso quedaba detrás de un formulario de cuatro pantallas de alto.
      //
      // 🔴 EXCEPCIÓN DE LA FASE 03.21 (D-07, UI-SPEC §3.3): si quien monta reconoce el fallo como
      // suyo (`alFallarFirma` responde `true` — hoy, un fallo de firma `APP-FIRMA-*` en la página),
      // la confirmación SÍ se cierra y aquí no se pinta nada. El remedio de un fallo de firma es el
      // campo de la clave, que está DETRÁS de la confirmación, y `ConfirmationDetail` apaga su botón
      // mientras haya un mensaje: dejarla abierta atraparía al decisor. La página lo dice: la clave
      // rechazada bajo su campo y el resto en el aviso flotante. El borrador no se pierde: se
      // reanuda igual.
      if (alFallarFirma?.(err) === true) {
        setConfirmando(false);
        reanudar();
        return;
      }
      setMensajeEmision({
        variant: "error",
        message: mensajeParaUsuario(err, "No se pudo emitir la providencia."),
      });
      // No se emitió: el borrador sigue siendo el trabajo en curso y vuelve a guardarse solo.
      reanudar();
    } finally {
      setEmitiendo(false);
    }
  };

  /**
   * «Sí, descartar» (D-05b). Borra en el servidor y deja vacío lo que el borrador guarda —cuerpo y
   * tipo—; la cabecera tecleada y la prueba NO son borrador (D-01) y se quedan (DP-14). Si el DELETE
   * falla, el contenido queda intacto, la confirmación sigue abierta y el motivo sale en el aviso
   * flotante, que va por encima (quick 261028-kmg). En los dos casos el motor se reanuda al final.
   */
  const confirmarDescarte = async () => {
    setDescartando(true);
    try {
      await motor.descartar();
      setBorrador({});
      setTipoCodigo("");
      setAvisoRecuperacion(null);
      setConfirmandoDescarte(false);
    } catch (err) {
      addToast(
        "error",
        `No se pudo descartar el borrador: ${
          mensajeParaUsuario(err, "error desconocido")
        }`,
      );
    } finally {
      setDescartando(false);
      reanudar();
    }
  };

  /** El estado del guardado, en una línea discreta junto a la barra (D-03). `null` = nada. */
  const textoEstadoGuardado = ((): string | null => {
    if (!autoguardado) return null;
    switch (motor.estado) {
      case "pendiente":
        return "Cambios sin guardar…";
      case "guardando":
        return "Guardando el borrador…";
      case "al-dia":
        return motor.guardadoAt
          ? `Borrador guardado a las ${horaDeGuardado(motor.guardadoAt)}`
          : null;
      case "error":
        return `No se pudo guardar el borrador: ${(motor.error ?? "error desconocido").replace(/\.+$/, "")}. Se volverá a intentar con el próximo cambio.`;
      default:
        return null;
    }
  })();

  /** «Descartar borrador» se ofrece con el motor armado y algo que descartar (DP-14). */
  const puedeOfrecerDescarte =
    autoguardado &&
    motor.estado !== "inactivo" &&
    (motor.hayBorradorEnServidor || hayTextoEnElCuerpo);

  const alternarPrevia = () =>
    previaAbierta ? cerrarPrevia() : setPreviaAbierta(true);

  /** Los dos grupos del cuerpo, repartidos como manda el stepper (UI-SPEC §4.2). */
  const verInformacionGeneral = paso === undefined || paso === 1;
  const verEdicion = paso === undefined || paso === 2;

  const acciones: AccionesCompositor = {
    previaAbierta,
    emitiendo,
    tipoElegido: !!tipo,
    puedeEmitir,
    cuerpoConContenido,
    motivoPrueba,
    estadoBorrador,
    motivosNoEmitir,
    cancelar: onCancelar,
    alternarPrevia,
    // Se limpia el aviso anterior al ABRIR: `ConfirmationDetail` apaga su botón de confirmar
    // mientras haya `message`, así que sin esto un intento fallido dejaba la confirmación
    // inutilizable para siempre — se abría ya con el error de la vez pasada y sin poder reintentar.
    pedirConfirmacion: () => {
      setMensajeEmision(null);
      setConfirmando(true);
    },
  };

  const barraAcciones = renderBarraAcciones ? (
    renderBarraAcciones(acciones)
  ) : (
    <div className="modal-action">
      <Boton
        estilos="btn btn-ghost"
        texto="Cancelar"
        deshabilitado={emitiendo}
        onClick={onCancelar}
      />
      {/* Abre el panel del borrador; a partir de ahí se refresca solo al dejar de escribir.
      Basta con haber elegido el tipo: se previsualiza un borrador a medio llenar, que es
      justo para lo que sirve. Ojo — que salga NO significa que se pueda emitir: la vista
      previa no comprueba las reglas del acto. */}
      <Boton
        estilos="btn btn-outline"
        texto={previaAbierta ? "Ocultar borrador" : "Ver borrador"}
        deshabilitado={!tipo || emitiendo}
        onClick={alternarPrevia}
      />
      <Boton
        estilos="btn btn-primary"
        texto="Emitir providencia"
        deshabilitado={!puedeEmitir}
        onClick={acciones.pedirConfirmacion}
      />
    </div>
  );

  /**
   * LA CONFIRMACIÓN, con el envoltorio que ponga quien monta.
   *
   * El patrón de `ConfirmationDetail` se conserva intacto: el PADRE —que es este componente—
   * interpreta la respuesta, pinta el mensaje del servidor en `message` cuando falla (y la
   * confirmación PERMANECE abierta) y solo la cierra con éxito. Ver `emitir`.
   */
  const confirmacion =
    confirmando && tipo ? (
      <ConfirmationDetail
        headerKicker={ajustesConfirmacion?.headerKicker ?? "Ejecución — DME"}
        headerTitle={
          ajustesConfirmacion?.headerTitle ?? "Emitir la providencia"
        }
        statusCopy={ajustesConfirmacion?.statusCopy ?? "Revise antes de emitir"}
        descriptionCopy={
          ajustesConfirmacion?.descriptionCopy ??
          (tipo.accionEpas
            ? `La providencia se adjunta al expediente Y ${ETIQUETA_ACCION_EPAS[tipo.accionEpas] ?? "cambia su estado"}. Desde esta pantalla no se deshace.`
            : "La providencia se genera y queda adjunta al expediente. El estado del expediente no cambia.")
        }
        informationData={{
          Expediente: caso.expNumber ?? `EPAS ${caso.eejeId ?? ""}`,
          Tipo: tipo.nombre,
          Secciones: secciones.map((s) => s.clave).join(", "),
          "Cuadro de horas": incluyeCuadro ? "sí" : "no",
          // «Se cierra con los dos»: la prueba se revisa junto al acto, no después.
          ...(exigidas.length > 0
            ? {
                Prueba: [
                  ...citadas.map((p) => `${NOMBRE_PRUEBA[p]} (ya consta)`),
                  ...(pideComprobante && pruebaPago.archivo
                    ? [pruebaPago.archivo.name]
                    : []),
                  ...(pideInforme && pruebaTc.archivo
                    ? [`${pruebaTc.archivo.name} · ${horasTc} h`]
                    : []),
                ].join(" · "),
              }
            : {}),
          // Lo que solo la PÁGINA sabe (UI-SPEC §4.8): el administrado, las formas elegidas en el
          // paso 3 y si el documento saldrá o no con firma criptográfica. Van al final para no
          // desordenar la ficha que el modal lleva enseñando desde la Fase 03.14.
          ...(ajustesConfirmacion?.informacionExtra ?? {}),
        }}
        message={mensajeEmision ?? undefined}
        confirmButtonText={ajustesConfirmacion?.confirmButtonText ?? "Emitir"}
        confirmButtonLoadingText={
          ajustesConfirmacion?.confirmButtonLoadingText ?? "Emitiendo…"
        }
        onConfirm={emitir}
        onClose={() => setConfirmando(false)}
      />
    ) : null;

  const confirmacionMontada =
    confirmacion &&
    (envolverConfirmacion ? (
      envolverConfirmacion(confirmacion)
    ) : (
      // El envoltorio de una PÁGINA: una superposición corriente. `.modal` ya es `position: fixed`
      // e `inset: 0`, así que cubre la ventana sin ayuda de ningún elemento nativo de diálogo.
      <div className="modal modal-open">{confirmacion}</div>
    ));

  return (
    <>
      {/* 🔴 Las dos columnas: el borrador va AL LADO y no encima. Encima tapaba justo el
          editor, así que el refresco automático ocurría donde no se veía — que es como no
          tenerlo. En pantallas estrechas se apila debajo (`flex-col lg:flex-row`). */}
      <div
        className={
          previaAbierta
            ? "mt-2 flex max-h-[72vh] flex-col gap-4 lg:flex-row"
            : ""
        }
      >
        <div
          className={previaAbierta ? "min-w-0 flex-1 overflow-y-auto pr-1" : ""}
        >
          {/* Aquí solo el fallo al CARGAR el catálogo (regla 3b de 261028-kmg). El de la emisión lo
              dice la confirmación en el aviso flotante, una vez, y no reaparece al cerrarla. */}
          {errorCarga && <Alert variant="error" message={errorCarga} />}
          {cargando && <Loading />}

          {!cargando && (
            <div className="mt-4 flex flex-col gap-4">
              {/* ── PASO 1 · INFORMACIÓN GENERAL ─────────────────────────────────────────── */}
              <div className={claseGrupo(verInformacionGeneral)}>
                {/* ── EL BORRADOR GUARDADO EN EL SERVIDOR (quick 261006-el5) ────────────────
                    Arriba del selector, que es donde se empieza (o se vuelve a empezar). */}
                {autoguardado && avisoRecuperacion && (
                  <div className="flex flex-col gap-1">
                    <Alert
                      variant="info"
                      message={`Se recuperó el borrador del ${avisoRecuperacion.rotulo}`}
                    />
                    {avisoRecuperacion.tipoDescartado && (
                      <p className="text-sm">
                        El tipo de providencia que tenía elegido ya no está
                        disponible para este expediente: elija otro.
                      </p>
                    )}
                  </div>
                )}
                {autoguardado && lecturaBorradorFallida && (
                  <Alert
                    variant="warning"
                    message="No se pudo comprobar si había un borrador guardado de este expediente. Para no pisarlo, lo que escriba ahora no se guardará automáticamente."
                  />
                )}
                {puedeOfrecerDescarte && (
                  <div>
                    <Boton
                      estilos="btn btn-ghost btn-sm"
                      texto="Descartar borrador"
                      deshabilitado={emitiendo || descartando}
                      onClick={() => setConfirmandoDescarte(true)}
                    />
                  </div>
                )}

                <fieldset className="flex flex-col gap-1">
                  <label className="font-medium" htmlFor="providencia-tipo">
                    Tipo de providencia
                  </label>
                  <select
                    id="providencia-tipo"
                    className="select select-bordered w-full"
                    value={tipoCodigo}
                    disabled={emitiendo}
                    onChange={(e) => elegirTipo(e.target.value)}
                  >
                    <option value="">Elija el tipo…</option>
                    {tipos.map((t) => (
                      <option
                        key={t.codigo}
                        value={t.codigo}
                        // Se DESHABILITAN en vez de ocultarse: que el tipo existe es información, y
                        // esconderlo dejaría al decisor buscando una providencia que sí está en el
                        // glosario. El porqué se explica debajo, al pasar por él.
                        disabled={!t.disponible}
                      >
                        {t.nombre}
                        {t.disponible ? "" : " — no disponible ahora"}
                      </option>
                    ))}
                  </select>
                  {tipo?.definicion && (
                    <span className="text-sm opacity-70">{tipo.definicion}</span>
                  )}

                  {/* Los no disponibles, listados con su motivo: el decisor ve qué le falta para
                  poder emitirlos, en vez de descubrirlo al confirmar. */}
                  {noDisponibles.length > 0 && (
                    <details className="text-sm opacity-70">
                      <summary className="cursor-pointer">
                        Hay {noDisponibles.length} tipo(s) que este expediente no
                        admite todavía
                      </summary>
                      <ul className="mt-2 flex flex-col gap-1 pl-4">
                        {noDisponibles.map((t) => (
                          <li key={t.codigo}>
                            <span className="font-medium">{t.nombre}</span>:{" "}
                            {t.motivoNoDisponible}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {/* El desenlace se advierte al elegir, no al final: cambia lo que el acto significa. */}
                  {tipo?.accionEpas && (
                    <Alert
                      variant="warning"
                      message={`Al emitir esta providencia, ${ETIQUETA_ACCION_EPAS[tipo.accionEpas] ?? "el expediente cambiará de estado"}.`}
                    />
                  )}

                  {/* Fase 03.14.4: esta providencia RESUELVE la solicitud de prórroga —conceda o
                  niegue— y, si concede, corre el vencimiento. Los meses los calcula el servidor:
                  aquí solo se muestran. */}
                  {resuelveProrroga && (
                    <div className="flex flex-col gap-2 rounded-lg border border-base-300 p-3">
                      <span className="font-medium">
                        Resolución de la prórroga
                      </span>

                      {estadoTc?.venceAt && (
                        <span className="text-sm opacity-70">
                          Vence actualmente el{" "}
                          {new Date(estadoTc.venceAt).toLocaleDateString(
                            "es-EC",
                          )}
                          {estadoTc.prorrogaVenceAtPrevisto && (
                            <>
                              {" "}
                              · si concede, pasará al{" "}
                              <strong>
                                {new Date(
                                  estadoTc.prorrogaVenceAtPrevisto,
                                ).toLocaleDateString("es-EC")}
                              </strong>{" "}
                              (el 50 % del plazo inicial, contado desde el
                              vencimiento)
                            </>
                          )}
                        </span>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="prorroga"
                            className="radio radio-sm"
                            checked={prorroga.concedida === true}
                            disabled={emitiendo}
                            onChange={() =>
                              setProrroga((p) => ({ ...p, concedida: true }))
                            }
                          />
                          <span>Conceder la prórroga</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="prorroga"
                            className="radio radio-sm"
                            checked={prorroga.concedida === false}
                            disabled={emitiendo}
                            onChange={() =>
                              setProrroga((p) => ({ ...p, concedida: false }))
                            }
                          />
                          <span>Negarla</span>
                        </label>
                      </div>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm">
                          Motivo de la decisión (mínimo 10 caracteres)
                        </span>
                        <textarea
                          className="textarea textarea-bordered w-full"
                          rows={2}
                          value={prorroga.motivo}
                          disabled={emitiendo}
                          onChange={(e) =>
                            setProrroga((p) => ({
                              ...p,
                              motivo: e.target.value,
                            }))
                          }
                        />
                        <span className="text-sm opacity-70">
                          Obligatorio también al negarla: es lo que después
                          justifica la coactiva frente a quien pidió tiempo.
                        </span>
                      </label>
                    </div>
                  )}

                  {/* 2026-09-18: la devolución por NULIDAD es el único acto del módulo cuyo destino
                  no está decidido de antemano — el expediente vuelve a la dirección que dictó el
                  acto que la Procuraduría anuló. Ninguna opción viene marcada: elegirla es parte
                  del acto, no un ajuste. Este bloque solo aparece en esa providencia. */}
                  {devuelvePorNulidad && (
                    <div className="flex flex-col gap-2 rounded-lg border border-base-300 p-3">
                      <span className="font-medium">
                        ¿A qué dirección vuelve el expediente?
                      </span>
                      <span className="text-sm opacity-70">
                        A la que dictó el acto anulado. El expediente saldrá de
                        Ejecución y se remitirá con el memorando del lote de
                        devolución.
                      </span>
                      {(
                        [
                          {
                            valor: "DMR",
                            texto:
                              "Dirección Metropolitana de Resolución de Casos (DMR)",
                          },
                          {
                            valor: "DMIT",
                            texto: "Dirección Metropolitana de Instrucción (DMIT)",
                          },
                        ] as const
                      ).map((opcion) => (
                        <label
                          key={opcion.valor}
                          className="flex items-center gap-3"
                        >
                          <input
                            type="radio"
                            className="radio radio-sm"
                            name="devolucion-destino"
                            value={opcion.valor}
                            checked={destinoDevolucion === opcion.valor}
                            disabled={emitiendo}
                            onChange={() => setDestinoDevolucion(opcion.valor)}
                          />
                          <span>{opcion.texto}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Act. 16: el trabajo comunitario solo procede si la sanción admite alternabilidad.
                  🔴 DESDE LA FASE 03.23 (D-06) ESO LO DECIDE LA INFRACCIÓN EN CORE, no el decisor:
                  la casilla «declaro que admite» se retiró con su motivo, y el servidor rechaza el
                  campo. Lo que queda aquí es la EXPLICACIÓN de D-04 —qué infracciones entran al TC,
                  cuáles quedan fuera y por qué (p. ej. «RUC de sociedad»), y el total conmutable—, o
                  los motivos si está bloqueado.
                  ALCANCE ACOTADO (decisión del orquestador, 2026-10-16): es de SOLO LECTURA, vive
                  DENTRO de este compositor y pinta campos de la ficha del servidor
                  (`infracciones[].admiteTc`/`motivoNoAdmite`, `evaluacionTc`). NO es la «pantalla
                  de acogimiento con el desglose» —que sigue diferida, igual que los dos tokens de
                  providencia nuevos—: no hay pantalla, ruta, modal ni token nuevos. El desglose
                  IMPRESO es el del cuadro del PDF (D-03, Plan 07). Solo aparece en las providencias
                  que AUTORIZAN; en el resto no pinta nada. */}
                  {miraInfracciones && (
                    <div className="flex flex-col gap-2 rounded-lg border border-base-300 p-3">
                      <span className="font-medium">
                        Trabajo comunitario por infracción
                      </span>

                      {comprobandoInfracciones && (
                        <span className="text-sm opacity-70">
                          Comprobando las infracciones del expediente…
                        </span>
                      )}

                      {falloInfracciones && (
                        <Alert
                          variant="warning"
                          message="No se pudo comprobar si las infracciones admiten trabajo comunitario."
                        />
                      )}

                      {fichaInfracciones && (
                        <>
                          {fichaInfracciones.infracciones.length > 0 && (
                            <ul className="flex flex-col gap-1 text-sm">
                              {fichaInfracciones.infracciones.map((inf) => (
                                <li
                                  key={inf.codigo}
                                  className="flex flex-wrap items-baseline gap-x-3"
                                >
                                  <span className="font-mono">
                                    {inf.codigo}
                                  </span>
                                  <span>
                                    {inf.multa == null
                                      ? "—"
                                      : formatearUsd(inf.multa)}
                                  </span>
                                  <span
                                    className={
                                      inf.admiteTc ? "" : "opacity-70"
                                    }
                                  >
                                    {inf.admiteTc
                                      ? "Admite TC"
                                      : inf.motivoNoAdmite
                                        ? `No admite: ${inf.motivoNoAdmite}`
                                        : "No admite"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {fichaInfracciones.evaluacionTc.estado === "APTA" ? (
                            <span className="text-sm font-semibold">
                              {`Susceptible de compensación: ${
                                fichaInfracciones.evaluacionTc
                                  .multaConmutable == null
                                  ? "—"
                                  : formatearUsd(
                                      fichaInfracciones.evaluacionTc
                                        .multaConmutable,
                                    )
                              }`}
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1 text-sm">
                              <span className="font-semibold">
                                El trabajo comunitario no procede:
                              </span>
                              <ul className="list-disc pl-5">
                                {fichaInfracciones.evaluacionTc.motivos.map(
                                  (motivo) => (
                                    <li
                                      key={`${motivo.codigo}-${motivo.mensaje}`}
                                    >
                                      {motivo.mensaje}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {/* ── LA PRUEBA QUE SUSTENTA EL ACTO (Fase 03.15, D-5, D-7 y D-8) ─────────
                  «Siempre debe haber una providencia de prueba […]. Se cierra con los DOS»
                  (área usuaria, 2026-08-31). Este bloque solo aparece en los cuatro tipos que
                  exigen papel; en los otros veintiocho no pinta nada. Lo que ya consta se CITA;
                  lo que falta se recibe aquí mismo, sin salir de la pantalla ni perder lo escrito. */}
                  {exigidas.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-lg border border-base-300 p-3">
                      <span className="font-medium">
                        Prueba que sustenta este acto
                      </span>

                      {citadas.length > 0 && (
                        <Alert
                          variant="info"
                          message={`Ya consta en el expediente: ${citadas
                            .map((p) => NOMBRE_PRUEBA[p])
                            .join(" y ")}. La providencia lo cita; no hace falta volver a subirlo.`}
                        />
                      )}

                      {pideComprobante && (
                        <div className="flex flex-col gap-3">
                          <span className="text-sm opacity-70">
                            No consta {NOMBRE_PRUEBA[
                              comprobanteEsDelRemanente
                                ? "COMPROBANTE_REMANENTE"
                                : "COMPROBANTE_PAGO"
                            ]}
                            : apórtelo aquí y quedará adjunto al expediente con
                            este mismo acto.
                          </span>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="flex flex-col gap-1">
                              <span className="text-sm">Fecha del pago</span>
                              <input
                                type="date"
                                className="input input-bordered w-full"
                                value={pruebaPago.pagoAt}
                                disabled={emitiendo}
                                onChange={(e) =>
                                  setPruebaPago((prev) => ({
                                    ...prev,
                                    pagoAt: e.target.value,
                                  }))
                                }
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-sm">
                                Nro. de transacción
                              </span>
                              <input
                                className="input input-bordered w-full"
                                maxLength={60}
                                value={pruebaPago.transaccion}
                                disabled={emitiendo}
                                onChange={(e) =>
                                  setPruebaPago((prev) => ({
                                    ...prev,
                                    transaccion: e.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <label className="flex flex-col gap-1">
                            <span className="text-sm">
                              Comprobante (PDF, máx. 10 MB)
                            </span>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="file-input file-input-bordered w-full"
                              disabled={emitiendo}
                              onChange={(e) =>
                                setPruebaPago((prev) => ({
                                  ...prev,
                                  archivo: e.target.files?.[0] ?? null,
                                }))
                              }
                            />
                            {problemaComprobante && (
                              <span className="text-sm text-error">
                                {problemaComprobante}
                              </span>
                            )}
                            <span className="text-sm opacity-70">
                              Los datos que teclee aquí se pueden insertar en el
                              texto con los tokens{" "}
                              <code>{"{Fecha de pago}"}</code> y{" "}
                              <code>{"{Transacción}"}</code>.
                            </span>
                          </label>
                        </div>
                      )}

                      {pideInforme && (
                        <div className="flex flex-col gap-3">
                          <span className="text-sm opacity-70">
                            No consta {NOMBRE_PRUEBA.INFORME_TC}: apórtelo aquí
                            con las horas que acredita.
                          </span>
                          <label className="flex flex-col gap-1">
                            <span className="text-sm">
                              Horas efectivamente cumplidas
                            </span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              className="input input-bordered w-full"
                              value={pruebaTc.horasCumplidas}
                              disabled={emitiendo}
                              onChange={(e) =>
                                setPruebaTc((prev) => ({
                                  ...prev,
                                  horasCumplidas: e.target.value,
                                }))
                              }
                            />
                            {!horasTcValidas &&
                              pruebaTc.horasCumplidas !== "" && (
                                <span className="text-sm text-error">
                                  Deben ser horas enteras, cero o más.
                                </span>
                              )}
                            {/* Cero NO es un error: es el incumplimiento, y tiene su propia
                                providencia (archivo por TC con envío a coactiva). */}
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-sm">
                              Informe del delegado (PDF, máx. 10 MB)
                            </span>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="file-input file-input-bordered w-full"
                              disabled={emitiendo}
                              onChange={(e) =>
                                setPruebaTc((prev) => ({
                                  ...prev,
                                  archivo: e.target.files?.[0] ?? null,
                                }))
                              }
                            />
                            {problemaInforme && (
                              <span className="text-sm text-error">
                                {problemaInforme}
                              </span>
                            )}
                          </label>
                        </div>
                      )}

                      {/* Lo que falta, dicho con el nombre del papel — nunca con el
                          identificador interno: quien lo lee es el decisor. */}
                      {pruebasQueFaltan.length > 0 && (
                        <Alert
                          variant="warning"
                          message={`Para emitir esta providencia falta ${pruebasQueFaltan
                            .map((p) => NOMBRE_PRUEBA[p])
                            .join(" y ")}.`}
                        />
                      )}
                    </div>
                  )}
                </fieldset>

                <details className="collapse collapse-arrow border border-base-300">
                  <summary className="collapse-title font-medium">
                    Datos de la cabecera
                  </summary>
                  <div className="collapse-content grid grid-cols-1 gap-3 md:grid-cols-2">
                    {CAMPOS_CABECERA.map((campo) => {
                      // Quick 261105-cvq: el único campo de importe es la multa; texto con teclado
                      // decimal (el tipo numérico del navegador no lee bien «2.300,50»).
                      const esImporte = campo.tipo === "importe";
                      const conError = esImporte && errorMultaCabeceraVisible;
                      return (
                      <label key={campo.clave} className="flex flex-col gap-1">
                        <span className="text-sm">{campo.etiqueta}</span>
                        <input
                          type="text"
                          inputMode={esImporte ? "decimal" : undefined}
                          autoComplete={esImporte ? "off" : undefined}
                          placeholder={esImporte ? "2.300,00" : undefined}
                          className={`input input-bordered w-full${conError ? " input-error" : ""}`}
                          value={cabeceraExtra[campo.clave] ?? ""}
                          disabled={emitiendo}
                          aria-invalid={conError || undefined}
                          aria-describedby={
                            conError ? ID_ERROR_MULTA_CABECERA : undefined
                          }
                          onChange={(e) => {
                            if (esImporte) setMultaCabeceraTocada(false);
                            setCabeceraExtra((previo) => ({
                              ...previo,
                              [campo.clave]: e.target.value,
                            }));
                          }}
                          onBlur={
                            esImporte
                              ? () => setMultaCabeceraTocada(true)
                              : undefined
                          }
                        />
                        {conError && (
                          <span
                            id={ID_ERROR_MULTA_CABECERA}
                            className="text-sm text-error"
                          >
                            Escriba la multa en dólares con coma para los
                            centavos, por ejemplo 2.300,00 (el punto separa los
                            miles).
                          </span>
                        )}
                      </label>
                      );
                    })}
                    {/* 2026-09-08: la orden de pago se registra AQUÍ MISMO cuando falta. No es un
                        campo de la cabecera —el dato sigue viviendo en el expediente y la
                        providencia lo lee de ahí—, es el atajo para no tener que abandonar la
                        pantalla, y perder lo escrito, solo para teclear un número. */}
                    {caso.eejeId != null && (
                      <OrdenesPagoCabecera
                        eejeId={caso.eejeId}
                        permiteRegistrar
                        onRegistrada={() => setRevisionExpediente((n) => n + 1)}
                      />
                    )}
                    <p className="text-sm opacity-70 md:col-span-2">
                      Expediente, administrado/a, identificación y materia salen
                      del caso. Lo que se deje vacío NO se imprime: la línea
                      entera se omite de la providencia.
                    </p>
                  </div>
                </details>
              </div>

              {/* ── PASO 2 · EDICIÓN DEL DOCUMENTO ───────────────────────────────────────── */}
              <div className={claseGrupo(verEdicion)}>
                {/* EL PUNTO DE MONTAJE de la Fase 03.19 / Plan 16: «basarse en un documento
                    anterior», ENCIMA del editor (UI-SPEC §4.5). Aquí no hay ni una línea de lógica
                    de composición: lo único que este componente hace es entregar lo que solo él
                    tiene —la clase elegida, el cuerpo VIVO y la manera de volcarle texto— y pintar
                    lo que le devuelvan. Sin la prop, el paso 2 es exactamente el de siempre. */}
                {renderExtrasEdicion?.({
                  tipoCodigo,
                  nombreTipo: tipo?.nombre,
                  cuerpoActual: borrador.cuerpo ?? "",
                  importarCuerpo: (html: string) =>
                    setBorrador((previo) => ({ ...previo, cuerpo: html })),
                  emitiendo,
                })}

                {tokens.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                      Insertar dato del expediente en el cuerpo
                    </span>
                    <div className="app-token-badges">
                      {tokens.map((t) => (
                        <button
                          key={t.token}
                          type="button"
                          className="app-token-badge tooltip"
                          data-tip={t.resolver(caso)}
                          onClick={() => insertarToken(t.token)}
                        >
                          {t.etiqueta}
                        </button>
                      ))}
                      {/* El del CUADRO no es un dato que se sustituya por su valor: es la marca de
                          sitio donde el backend injerta la tabla generada. Por eso se ofrece aquí
                          solo cuando el cuadro ya está puesto — para poder MOVERLO— y se pone y se
                          quita con la casilla de abajo. */}
                      {incluyeCuadro && (
                        <button
                          type="button"
                          className="app-token-badge tooltip"
                          data-tip="Mueve la tabla de horas al punto donde esté el cursor"
                          onClick={() => insertarToken(MARCADOR_CUADRO)}
                        >
                          Cuadro de horas
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{SECCION_CUERPO.etiqueta}</span>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={incluyeCuadro}
                        disabled={emitiendo}
                        onChange={alternarCuadro}
                      />
                      <span className="text-sm">
                        Incluir cuadro de horas autorizadas (trabajo
                        comunitario)
                      </span>
                    </label>
                  </div>
                  <span className="text-sm opacity-70">
                    {SECCION_CUERPO.ayuda}
                  </span>

                  {/* Quick 261105-cc7: el SBU lo ESCRIBE el ejecutor. Va antes de la rejilla del
                      cuadro para que aparezca también con un tipo que autoriza sin cuadro. Siempre
                      arranca vacío: el de Parámetros es solo una referencia. */}
                  {pideSbu && (
                    <div className="flex flex-col gap-1">
                      <label
                        className="text-sm"
                        htmlFor="compositor-sbu-trabajo-comunitario"
                      >
                        SBU con el que se calcula el trabajo comunitario (en
                        dólares)
                      </label>
                      <input
                        id="compositor-sbu-trabajo-comunitario"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className={`input input-bordered w-full md:w-64 ${
                          errorSbuVisible ? "input-error" : ""
                        }`}
                        value={datosCuadro.sbu}
                        disabled={emitiendo}
                        aria-invalid={errorSbuVisible || undefined}
                        aria-describedby={
                          [
                            estadoTc?.sbuParametro != null
                              ? "compositor-sbu-referencia"
                              : null,
                            errorSbuVisible ? "compositor-sbu-error" : null,
                            sbuSospechoso ? "compositor-sbu-aviso" : null,
                          ]
                            .filter(Boolean)
                            .join(" ") || undefined
                        }
                        onChange={(e) => {
                          setSbuTocado(false);
                          setDatosCuadro((p) => ({ ...p, sbu: e.target.value }));
                        }}
                        onBlur={() => setSbuTocado(true)}
                      />
                      {estadoTc?.sbuParametro != null && (
                        <span
                          id="compositor-sbu-referencia"
                          className="text-sm opacity-70"
                        >
                          {`Valor en Parámetros: ${formatearUsd(estadoTc.sbuParametro)} — solo referencia: escriba el SBU que corresponde al caso.`}
                        </span>
                      )}
                      {errorSbuVisible && (
                        <span
                          id="compositor-sbu-error"
                          className="text-sm text-error"
                        >
                          Escriba el SBU en dólares con coma para los centavos,
                          por ejemplo 470,75 (el punto separa los miles).
                        </span>
                      )}
                      {sbuSospechoso && (
                        <span
                          id="compositor-sbu-aviso"
                          className="text-sm text-warning"
                        >
                          El SBU escrito es más del doble del valor de
                          Parámetros: revise que no falte la coma de los
                          centavos.
                        </span>
                      )}
                    </div>
                  )}

                  {incluyeCuadro && estadoTc?.autorizadoAt && (
                    <p className="text-sm opacity-70">
                      Este expediente ya tiene sus cifras de trabajo
                      comunitario autorizadas: el cuadro las reimprime tal como
                      se sellaron.
                    </p>
                  )}

                  {incluyeCuadro && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <p className="text-sm opacity-70 md:col-span-2">
                        La tabla la genera el sistema con el SBU que usted
                        escriba y aparece donde esté{" "}
                        <code>{MARCADOR_CUADRO}</code> en el texto.
                      </p>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">
                          Orden para el pago del remanente
                        </span>
                        <input
                          className="input input-bordered w-full"
                          value={datosCuadro.ordenRemanente}
                          disabled={emitiendo}
                          onChange={(e) =>
                            setDatosCuadro((p) => ({
                              ...p,
                              ordenRemanente: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">
                          Plazo para cumplir las horas
                        </span>
                        <input
                          className="input input-bordered w-full"
                          value={datosCuadro.plazoCumplimiento}
                          disabled={emitiendo}
                          onChange={(e) =>
                            setDatosCuadro((p) => ({
                              ...p,
                              plazoCumplimiento: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">
                          Horas fijadas por el acto administrativo
                        </span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="input input-bordered w-full"
                          value={datosCuadro.horasAutorizadas}
                          disabled={emitiendo}
                          onChange={(e) =>
                            setDatosCuadro((p) => ({
                              ...p,
                              horasAutorizadas: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">
                          Plazo en meses (se congela en el expediente)
                        </span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="input input-bordered w-full"
                          value={datosCuadro.plazoMeses}
                          disabled={emitiendo}
                          onChange={(e) =>
                            setDatosCuadro((p) => ({
                              ...p,
                              plazoMeses: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <p className="text-sm opacity-70 md:col-span-2">
                        Deje las horas <strong>vacías</strong> y las calcula el
                        sistema con el SBU que usted escriba y la multa impuesta,
                        que es lo normal. Rellénelas solo si la resolución ya las
                        determinó: entonces mandan ellas, y el expediente
                        registra que vinieron del acto administrativo.
                      </p>
                      {/* Quick 261105-ma6: FUERA del <label> del campo, para no cambiar su nombre
                          accesible. */}
                      {horasResolucion !== undefined && (
                        <p className="text-sm opacity-70 md:col-span-2">
                          La resolución fijó {horasResolucion} horas de trabajo
                          comunitario: se proponen como las del acto
                          administrativo. Bórrelas si quiere que las calcule el
                          sistema.
                        </p>
                      )}
                    </div>
                  )}

                  <RichTextEditor
                    value={borrador.cuerpo ?? ""}
                    onChange={(html) =>
                      setBorrador((previo) => ({ ...previo, cuerpo: html }))
                    }
                    onEditorReady={(editor) => {
                      editorCuerpo.current = editor;
                    }}
                    placeholder="Escriba o pegue aquí la providencia completa…"
                  />
                </div>
              </div>
            </div>
          )}

          {/* D-03: el estado del guardado, discreto y junto a la barra, en los cuatro pasos. Un
              fallo se LEE aquí: nunca un modal que corte la escritura. */}
          {textoEstadoGuardado && (
            <p
              role="status"
              className={`px-4 pb-1 text-right text-sm ${
                motor.estado === "error" ? "text-error" : "opacity-70"
              }`}
            >
              {textoEstadoGuardado}
            </p>
          )}
          {barraAcciones}
        </div>

        {/* COLUMNA DERECHA — el borrador, siempre visible mientras se escribe. */}
        {previaAbierta && (
          <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-base-300 lg:w-[46%]">
            <div className="flex items-center justify-between gap-2 border-b border-base-300 bg-base-200 px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-warning">
                Borrador — todavía NO emitido
                {generandoPrevia && " · actualizando…"}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={cerrarPrevia}
                aria-label="Ocultar la vista previa"
              >
                Ocultar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {/* 🔴 Cuando el refresco falla, el borrador anterior SIGUE en pantalla — y
                  entonces hay que decir que lo que se ve no es lo último escrito. Callarlo
                  dejaría al decisor mirando un documento viejo creyendo que es el suyo. */}
              {previaDesfasada && (
                <Alert
                  variant="error"
                  message={`Lo que se ve NO refleja lo último escrito: ${previaDesfasada}`}
                />
              )}

              {previa ? (
                <div className="overflow-x-auto">
                  <PDFViewer
                    document={
                      {
                        docName: `${tipo?.nombre ?? "Providencia"} (borrador)`,
                        docUrl: previa,
                      } as never
                    }
                    loading={false}
                    width={430}
                  />
                </div>
              ) : (
                <p className="p-6 text-sm text-base-content/70">
                  {tipo
                    ? "Armando el borrador…"
                    : "Elija el tipo de providencia: el borrador se arma solo, y se rehace cada vez que deje de escribir."}
                </p>
              )}

              <p className="mt-2 px-2 text-[11px] leading-snug text-base-content/70">
                No se ha emitido ni consta en el expediente. Que se vea bien no
                significa que se pueda emitir — eso lo comprueba «Emitir
                providencia».
              </p>
            </div>
          </aside>
        )}
      </div>

      {confirmacionMontada}

      {/* D-05b: descartar pide confirmación. Superposición corriente, sin elemento de diálogo
          nativo, por lo mismo que la confirmación de emisión en una página. */}
      {confirmandoDescarte && (
        <div className="modal modal-open">
          <div
            role="alertdialog"
            aria-labelledby="descarte-borrador-titulo"
            aria-describedby="descarte-borrador-cuerpo"
            className="modal-box"
          >
            <h2 id="descarte-borrador-titulo" className="text-lg font-bold">
              Descartar el borrador
            </h2>
            <p id="descarte-borrador-cuerpo" className="py-4">
              Se borrará el borrador guardado de este expediente y el documento
              volverá a empezar de cero: sin tipo y sin texto. No se puede
              deshacer.
            </p>
            <div className="modal-action">
              <Boton
                estilos="btn btn-ghost"
                texto="Conservar el borrador"
                deshabilitado={descartando}
                onClick={() => setConfirmandoDescarte(false)}
              />
              <Boton
                estilos="btn btn-error"
                texto="Sí, descartar"
                deshabilitado={descartando}
                onClick={() => void confirmarDescarte()}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CompositorProvidencia;
