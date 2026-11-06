/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Ficha del expediente de la Bandeja de Entrada (el modal que abre el ojo de cada fila)
 * Archivo: ModalExpedienteLote.tsx
 * Responsabilidad: Enseñar, sobre UN caso del lote, las dos caras que la reunión del 2026-09-16
 *   (punto 5) pidió copiar de Resolución, y ANOTAR SOBRE ELLAS lo que hay que corregir:
 *     · «Información del Expediente» — los datos del administrado y del expediente, cada uno con su
 *       icono de etiqueta para observarlo.
 *     · «Documentación» — el acordeón por Dirección metropolitana a la izquierda y el visor PDF a la
 *       derecha, con el mismo icono en la fila de cada documento.
 *     · El PANEL de observaciones a la derecha, que es donde se escribe, se lista y se guarda.
 *
 *   🔴 HASTA EL 2026-09-18 ESTE MODAL ERA DE SOLO LECTURA, y su cabecera decía que si algún día
 *   Ejecución necesitaba observaciones por campo, el sitio sería este. Ese día llegó. El área pidió
 *   que la devolución al triage diga QUÉ corregir —campo por campo y documento por documento— en vez
 *   de una frase en una caja de texto libre, así que el motivo se captura AQUÍ y el modal de
 *   devolución dejó de preguntarlo: enseña lo anotado y se niega a devolver un expediente que no
 *   tenga nada. No hay dos caminos para el mismo acto; hay uno, y ahora está donde se ve el dato que
 *   está mal.
 *
 *   🔴 A DIFERENCIA DEL REPO HERMANO, AQUÍ NO HAY UN MAPA DE OBSERVACIONES IZADO A LA PÁGINA. En
 *   Resolución la página guarda un `Record<eresId, observaciones>` porque allí las observaciones
 *   viven en memoria hasta que se pulsa «Devolver», que es el mismo gesto que emite el memorando.
 *   Aquí PERSISTEN en el servidor por `eeje_id`: la ficha escribe directamente y la bandeja se entera
 *   por su recarga al cerrar. Esa es la simplificación que compra el diseño, y queda dicha porque
 *   quien venga de leer Resolución va a buscar el mapa.
 *
 *   🔴 SIGUE SIN PEDIR NADA PARA LA PRIMERA PESTAÑA. Todo lo que muestra ya viajó con la bandeja (el
 *   backend lo proyecta en la misma consulta que hidrata los casos). Las únicas peticiones son la de
 *   los documentos —bajo demanda al desplegar una Dirección— y la de las observaciones al abrir.
 *
 *   ── 2026-09-21 (D-10): LA MISMA FICHA, DESDE LAS DOS BANDEJAS ────────────────────────────────
 *   «Mis Expedientes» aplana su fila y lo que vivía en el desplegable del decisor —documentos,
 *   notificaciones, multas compulsorias e impugnación— se muda AQUÍ. Una sola forma de ver el
 *   expediente en todo el módulo, en vez de dos que se parecen y divergen.
 *
 *   Desde el 2026-10-14 (quick 261014-kn3) la serie compulsoria ya NO está en la ficha: por pedido
 *   del usuario se retiró la pestaña de multas compulsorias, y la serie se ve y se registra solo en
 *   la página de la obligación de hacer. La ficha se quedó con las otras dos absorbidas
 *   (notificaciones e impugnación).
 *
 *   La ficha no se duplicó ni se aflojó su contrato: el Plan 03 amplió `MiEpasAsignadoDto` hasta que
 *   la fila del decisor satisface ESTRUCTURALMENTE lo que esta ficha lee, y `caseData` declara la
 *   unión de los dos tipos de fila. **La promesa de la primera pestaña no se rompe:** sigue sin
 *   pedir nada, porque los once campos que le faltaban viajan ahora con la fila.
 *
 *   `bandeja` dice DESDE DÓNDE se abrió, y de ahí cuelgan tres decisiones escritas:
 *
 *   🔴 1. MODO LECTURA DESDE «MIS EXPEDIENTES» (T-03.19-41). Con `bandeja: "decisor"` el panel de
 *   observaciones **no se monta**, los iconos de etiqueta no se pintan y las observaciones ni
 *   siquiera se piden. Es una DECISIÓN, no una omisión: anotar observaciones de triage y darles
 *   veredicto se diseñó para la Bandeja de Entrada —el secretario que revisa lo que llegó de la DMR
 *   y el director que lo consiente—, y un expediente que ya se sorteó salió de ese momento del
 *   procedimiento. Y se apaga AQUÍ, no confiando en que cada punto de montaje pase `false`: una
 *   mitigación que depende de que el llamante se acuerde no es una mitigación.
 *
 *   🔴 2. LOS DOS LISTADOS DE DOCUMENTOS CONVIVEN, Y CADA BANDEJA VE EL SUYO. La Bandeja de Entrada
 *   sigue con el acordeón por Dirección metropolitana (`CaseDirectionDocumentsList`) y su visor al
 *   lado, que es lo que el triage necesita: saber de qué dirección vino cada papel. El decisor ve
 *   `ExpedienteDocumentos`, la lista plana, **porque es la única que acepta `recargaSenal`** — y sin
 *   ella «Adjuntar documento» dejaría de refrescar (Pitfall 10). No se pierde ninguna de las dos.
 *
 *   ⚠️ Consecuencia dicha en voz alta: desde la lista plana, abrir un documento levanta el visor
 *   como modal, y el contenedor de modales sólo sostiene uno — así que la ficha se cierra detrás.
 *   Es la misma restricción del Pitfall 11 (dos modales no se anidan). Hoy no se pierde trabajo
 *   —en esta bandeja la ficha no escribe nada— y se vuelve a ella desde el `👁`.
 *
 *   🔴 3. LA REGLA DE LAS DOS FASES SE MUDÓ CON EL CONTENIDO. Vivía en el desplegable: sin aceptar,
 *   resumen mínimo; aceptado, expediente completo. Si se hubiera quedado allí, la ficha enseñaría el
 *   expediente entero a un decisor que todavía puede excusarse de él.
 *
 *   ⚠️ Y esta ficha NO abre el modal de línea de tiempo desde dentro, por lo mismo del Pitfall 11:
 *   desde la fila se abre una u otra, nunca encadenadas.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado: 2026-09-18 — observaciones por campo y por documento.
 * Modificado por: Andrés Miño — 2026-09-21 (la ficha absorbe el desplegable del decisor, D-10)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: se retira la pestaña de multas
 *   compulsorias, pedido del usuario; la serie se ve y se registra solo en la página de la
 *   obligación de hacer, a la que se llega por la entrada «Obligación de hacer» del `⋮` de la misma
 *   fila)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 13: pestaña «Infracciones», D-16/D-08)
 *
 *   ── 2026-10-16 (Fase 03.23, D-16/D-08): LA PESTAÑA «INFRACCIONES» ─────────────────────────────
 *   La ficha gana una pestaña con las infracciones del EPAS —código, materia y submateria deducidas,
 *   sanción, multa, si admite trabajo comunitario y por qué no, y la obligación de hacer— y los
 *   avisos del servidor. La ven LAS DOS bandejas: no es de las absorbidas, porque saber qué se le
 *   imputa al administrado importa tanto en el triage como en la ejecución.
 *
 *   🔴 La pestaña PIDE la ficha al abrirse (`GET /epas/:eejeId/infracciones`), y esa petición ES el
 *   «uso» que refresca CORE (D-08). Por eso `InfraccionesSeccion` se monta SOLO con la pestaña
 *   activa: la promesa de arriba sigue en pie —abrir la ficha no pide nada para la primera
 *   pestaña— y CORE no se consulta por cada ojo que se pulsa en una bandeja.
 * Modificado por: Andrés Miño — 2026-10-19 (Fase 03.23, UAT del Plan 14: la negativa de «Descargar
 *   expediente» tiene su propio aviso; antes compartía el de las observaciones y el decisor no la veía; y el panel
 *   de observaciones pierde su botón de «añadir»: lo escrito entra con `conBorrador` al cambiar de
 *   objetivo y al pulsar «Guardar observaciones»)
 * Modificado por: Andrés Miño — 2026-10-19 (quick 261019-mcf: el clic fuera y Escape cierran la ficha
 *   con la regla de `DialogoModal`; con observaciones sin guardar, preguntan antes)
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 11, D-05: la pestaña «Información del
 *   Expediente» abre con la alerta «Datos de Resolución incompletos» y su lista cuando el servidor
 *   manda `datosResolucionFaltantes`; se ve sin abrir la pestaña «Infracciones», que sigue igual)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-01)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el éxito al guardar observaciones y los
 *   fallos al guardar, revisar, verificar y descargar se dicen en el aviso flotante; en línea solo
 *   queda el fallo al CARGAR las observaciones y los avisos de estado)
 * Modificado por: Andrés Miño — 2026-10-29 (la Documentación del decisor —«Mis Expedientes»— muestra
 *   el documento en la misma pestaña, con el visor al lado como en el triage: abrirlo en el modal del
 *   visor reemplazaba la ficha y al cerrarlo no se volvía a ella)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261029-kl0: si guardar una observación retira la
 *   remisión al secretario, el aviso lo dice —un solo aviso— y, al secretario, la ficha se cierra; al
 *   director que rechaza la última observación viva de un RECIBIDO sin remitir se le dice que puede
 *   remitirlo de nuevo desde su fila)
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: la Documentación muestra también los
 *   documentos de Inspección, Instrucción, Resolución y Secretaría General —el decisor, bajo los
 *   suyos; el triage, en el acordeón por Dirección— y se abren en el mismo visor de la derecha)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: la pestaña «Documentación» enseña
 *   cuántos documentos no ha abierto el usuario —`DocumentosLecturaService.contar([eejeId])` al abrir
 *   la ficha, nada con 0 o si falla— y el número baja en 1 con cada documento nuevo que se abre,
 *   desde las dos listas. Es la ÚNICA petición que la ficha hace al abrirse y es de la pestaña de
 *   documentos, no de la primera; el resumen mínimo no la hace)
 * Modificado por: Andrés Miño — 2026-11-04 (revisión 261030-m29, IN-04: al cambiar de expediente el
 *   número del anterior se borra en el acto)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — la «Multa Impuesta» con `formatearUsd`,
 *   «USD 2.300,00»; un 0 declarado sale «USD 0,00»)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import { useToast } from "../../hooks/useToast";
import type { EnvioLoteCaso } from "../../services/EntradaLotesService";
import type { MiEpasAsignado } from "../../services/SorteoService";
import type { IDocument } from "../../interfaces/IDocument";
import CaseDirectionDocumentsList from "../documentation/CaseDirectionDocumentsList";
import ObservacionesSeccion from "./ObservacionesSeccion";
import Boton from "../common/Boton";
import BadgePriority from "../common/BadgePriority";
import Alert from "../common/Alert";
import { PDFViewer } from "../pdf/PDFViewer";
import { ExpedienteDocumentos } from "../expediente/ExpedienteDocumentos";
import { DocumentosLecturaService } from "../../services/DocumentosLecturaService";
import { NotificacionesExpediente } from "../notificacion/NotificacionesExpediente";
import { ImpugnacionAcciones } from "../impugnacion/ImpugnacionAcciones";
import InfraccionesSeccion from "../infracciones/InfraccionesSeccion";
import AvisoDatosResolucion from "../infracciones/AvisoDatosResolucion";
import { resolverAccion } from "../../config/inboxActionStatusRules";
import { hechosDelEpas } from "../../config/accionesHechos";
import EpasService from "../../services/EpasService";
import { etiquetaEstadoEpas } from "../../config/estadosEpas";
import { DatetimeUtil } from "../../utils/datetime.util";
import { formatearUsd } from "../../utils/importe.util";
import {
  ObservacionesService,
  quedanObservacionesVivas,
} from "../../services/ObservacionesService";
import { EPAS_ESTADO_POR_REVISAR } from "../../config/inboxActionStatusRules";
import {
  AVISO_PUEDE_REMITIRSE,
  avisoRemisionRetiradaDirector,
  avisoRemisionRetiradaSecretario,
} from "../entrada/remisionCaso";
import {
  buscarObjetivo,
  conBorrador,
  contarVerificaciones,
  crearBorradorVacio,
  separarObservaciones,
  sonIguales,
  type IObservacion,
  type IObservacionBorrador,
  type ObservacionTipo,
} from "../../interfaces/ICaseObservations";

export const MODAL_KEY = "expedienteLote" as const;

// ── Avisos del reingreso (Fase 03.24, G-01), con los textos EXACTOS de UI-SPEC §6.1 ─────────────

/** Aviso 4 (`warning`, `rol="status"`): alguna observación anterior no se cumplió. */
export const AVISO_NO_CUMPLIDAS =
  "Hay observaciones de la devolución anterior sin cumplir: el expediente pasa a «Por devolver». Devuélvalo a la DMR desde su fila.";
/** Aviso 5 (`info`, `rol="note"`): reingresado con observaciones por verificar. Solo al director. */
export const AVISO_REINGRESO_POR_VERIFICAR =
  "Expediente reingresado: Resolución lo volvió a enviar tras su devolución a la DMR. Verifique si se cumplió cada observación de la devolución anterior.";
/** Aviso 6 (`success`, `rol="status"`): todas las anteriores cumplidas. */
export const AVISO_TODAS_CUMPLIDAS =
  "Todas las observaciones de la devolución anterior están cumplidas: el expediente sigue su curso y puede remitirse al secretario.";
/** Error de verificación cuando el servidor no manda mensaje. */
export const ERROR_VERIFICACION =
  "No se pudo guardar la verificación de la observación. Vuelva a intentarlo.";

/**
 * DESDE DÓNDE se abrió la ficha. No es cosmético: decide qué listado de documentos se monta, si
 * aparecen las dos pestañas absorbidas y si la ficha admite escribir observaciones de triage.
 *
 * `"entrada"` por defecto, y a propósito: la Bandeja de Entrada es quien tenía esta ficha antes de
 * que existiera este campo, así que el valor omitido conserva su conducta entera.
 */
export type BandejaDeOrigen = "entrada" | "decisor";

interface ModalExpedienteLoteProps {
  /**
   * El expediente, tal y como lo tiene la bandeja que abrió la ficha. Debe estar ATERRIZADO
   * (`eejeId`).
   *
   * 🔴 ES LA UNIÓN DE LAS DOS FILAS, Y ESO NO AFLOJA NADA. Todos los campos de las dos son
   * opcionales, así que tanto un `EnvioLoteCaso` como un `MiEpasAsignado` la satisfacen tal cual —y
   * los que ambas declaran (`expNumber`, `admiName`, `expFojas`…) tienen el MISMO tipo en las dos,
   * porque salen del mismo join del backend. Declararla así, en vez de inventar una tercera
   * interfaz mínima, deja que el compilador siga sabiendo qué campo trae cada bandeja.
   */
  caseData: EnvioLoteCaso &
    MiEpasAsignado & {
    /**
     * Señal de recarga de la lista de documentos. La sube la página cuando se anexa uno, para que la
     * pestaña «Documentación» vuelva a pedirlos sin cerrar y reabrir el modal.
     */
    recargaSenal?: number;
    /**
     * ¿Quien abre la ficha es DIRECTOR? Entonces el panel de observaciones ofrece el VEREDICTO
     * (2026-09-18, encargo del área: «cuando el director revisa las observaciones, se le debe
     * levantar el mismo modal que cuando se agregan»).
     *
     * 🔴 ES LA MISMA FICHA Y NO UN DIÁLOGO APARTE. La revisión nació en un modal propio de la
     * Bandeja de Salida y duró unas horas: partía en dos pantallas un acto que es uno solo, y dejaba
     * al director decidiendo sobre una lista de frases sin el expediente delante. Aquí tiene el campo
     * mal escrito y el documento ilegible a la vista mientras decide.
     *
     * ⚠️ Viaja DENTRO de `caseData` y no como prop suelta porque `ModalContainer` solo reparte tres
     * props (`caseData`, `onClose`, `refetchFn`): lo demás entra por aquí, como ya hace `recargaSenal`.
     */
    puedeRevisar?: boolean;
    /** `usu_id` de quien mira: sobre lo que él mismo anotó no hay veredicto que dar. */
    usuarioId?: number;
    /**
     * DESDE QUÉ BANDEJA se abrió (2026-09-21, D-10). Omitido = `"entrada"`, la conducta de siempre.
     *
     * ⚠️ Viaja DENTRO de `caseData` por la misma razón que `recargaSenal` y `puedeRevisar`:
     * `ModalContainer` sólo reparte tres props (`caseData`, `onClose`, `refetchFn`).
     */
    bandeja?: BandejaDeOrigen;
    /**
     * Rol de quien mira, para que el MOTOR decida la descarga del expediente completo.
     *
     * 🔴 LA FICHA NO DECIDE, PREGUNTA. El veredicto sale de la regla `descargarExpediente` sobre los
     * hechos de la fila — la misma que lo decide en la bandeja. Si la ficha dedujera el permiso por
     * su cuenta habría dos versiones de una regla que ya tiene dueño, y un día dirían cosas
     * distintas. Ausente ⇒ rol vacío ⇒ el motor NIEGA con su motivo, que es la degradación
     * correcta: apagado y explicado, nunca encendido por defecto. (Hasta el quick 261014-kn3
     * decidía también la multa compulsoria, cuya pestaña salió de la ficha.)
     */
    rolName?: string;
    /**
     * Pestaña en la que la ficha ABRE. Omitida ⇒ «informacion», que es lo que hacía siempre.
     *
     * Existe por una entrada del `⋮`: «Recursos» no es una acción —es un formulario
     * con estado propio y varios controles, y no cabe en una opción de menú—, así que esa entrada
     * no puede hacer más que traer al decisor hasta donde vive el formulario. Sin esta prop lo
     * dejaría en «Información» y con la pestaña por encontrar: una entrada que promete un sitio y
     * deposita en otro. Es de SOLO APERTURA —después manda el usuario—, y por eso se lee una vez
     * como estado inicial y no se vigila.
     */
    pestanaInicial?: TabFicha;
  };
  onClose: () => void;
  /**
   * Recarga de la bandeja. Se llama AL CERRAR: el badge «Por devolver» de la fila lo calcula el
   * servidor, así que la lista no se entera de lo que se acaba de anotar hasta que vuelve a pedirlo.
   */
  refetchFn?: () => Promise<void>;
}

/** Fallback VISIBLE de un dato que el expediente no trae. Nunca se inventa nada. */
const SIN_DATO = "—";

/**
 * Las pestañas de la ficha. Las tres primeras las ven las dos bandejas; las dos últimas son las que
 * D-10 absorbió del desplegable y sólo se ofrecen desde «Mis Expedientes» — montarlas en el triage
 * daría a la Bandeja de Entrada capacidades de ejecución sobre un expediente que aún no se sorteó.
 * (La de multas compulsorias se retiró el 2026-10-14: la serie vive solo en la página de la
 * obligación de hacer.)
 *
 * `"infracciones"` (Fase 03.23, D-16) es de las comunes y la única que, al abrirse, refresca CORE
 * (D-08): su contenido se monta solo mientras está activa.
 */
export type TabFicha =
  | "informacion"
  | "documentos"
  | "infracciones"
  | "notificaciones"
  | "impugnacion";

/**
 * Una línea etiqueta/valor de la ficha. Se pinta SIEMPRE, con "—" cuando falta: una ficha con huecos
 * declarados dice más que una ficha corta, donde no se distingue «no lo tenemos» de «no aplica».
 *
 * Con `onObservar` pinta además el icono de etiqueta que abre el panel anclado a ESTE campo. Es
 * opcional a propósito: hay campos que no se observan (no todos los de la ficha viajan a la DMR) y
 * la línea tiene que poder existir sin el icono.
 */
const Dato: FC<{
  label: string;
  children?: ReactNode;
  onObservar?: () => void;
  observado?: boolean;
}> = ({ label, children, onObservar, observado = false }) => (
  <div className="flex flex-col gap-1">
    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
      {label}
      {onObservar && (
        /* El `title` va en un <span> envolvente y no en el botón porque `Boton` no expone `title`
           ni `aria-label`, y un botón que es solo un icono sin nombre accesible no se puede usar con
           lector de pantalla. Es el mismo apaño que el ojo de la fila de esta bandeja. */
        <span
          title={
            observado
              ? `«${label}» ya tiene una observación`
              : `Observar «${label}»`
          }
        >
          {/* Observado: botón suave ROJO (fondo y icono), visible de un vistazo. Con solo
              `text-error` sobre `btn-ghost` el icono xs apenas se distinguía (usuario, 2026-10-21). */}
          <Boton
            deshabilitado={false}
            estilos={`btn btn-xs ${
              observado ? "btn-soft btn-error" : "btn-ghost text-primary"
            }`}
            icono="etiqueta"
            onClick={onObservar}
          />
        </span>
      )}
    </span>
    <span className="break-words text-sm">{children ?? SIN_DATO}</span>
  </div>
);

/** Título de una sección de la ficha, con la raya inferior del resto de modales. */
const Seccion: FC<{ titulo: string; children: ReactNode }> = ({
  titulo,
  children,
}) => (
  <div className="space-y-4">
    <p className="page-heading-kicker border-b pb-2 text-sm font-semibold uppercase tracking-[0.18em]">
      {titulo}
    </p>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
  </div>
);

const ModalExpedienteLote: FC<ModalExpedienteLoteProps> = ({
  caseData,
  onClose,
  refetchFn,
}) => {
  const { usuarioId, bandeja = "entrada" } = caseData;
  const { addToast } = useToast();

  /** ¿La abrió el decisor desde «Mis Expedientes»? De aquí cuelgan las tres decisiones de D-10. */
  const esDelDecisor = bandeja === "decisor";

  /**
   * 🔴 LAS OBSERVACIONES DE TRIAGE SE APAGAN AQUÍ (T-03.19-41), no en quien llama.
   *
   * Desde «Mis Expedientes» la ficha no anota, no lista y no da veredicto: ese acto pertenece a la
   * Bandeja de Entrada, donde el secretario dice qué está mal en lo que llegó de la DMR y el
   * director lo consiente. Un expediente sorteado ya salió de ese momento. Se fuerza en el
   * componente porque una mitigación que dependa de que cada punto de montaje pase `false` se
   * rompe con el primer punto de montaje nuevo que nadie revise.
   */
  const puedeObservar = !esDelDecisor;
  const puedeRevisar = puedeObservar && (caseData.puedeRevisar ?? false);

  /**
   * VEREDICTO EFECTIVO de aceptación: manual O automática por vencimiento del plazo. Es el mismo
   * criterio —y la misma caída a `aceptadoImplicito`— que usaba la bandeja del decisor.
   */
  const aceptado = caseData.aceptado ?? caseData.aceptadoImplicito ?? false;

  /**
   * 🔴 LA REGLA DE LAS DOS FASES, mudada con el contenido que gateaba (RESEARCH §7.1, pérdida 2).
   *
   * Sin aceptar, el decisor ve lo justo para decidir si acepta o se excusa —quién es el administrado
   * y cuánto le queda de plazo—, no el expediente. La Bandeja de Entrada no tiene fases: allí el
   * expediente se revisa precisamente para decidir si entra, así que la regla no la alcanza.
   */
  const soloResumen = esDelDecisor && !aceptado;

  // Sólo la pestaña de APERTURA: a partir de ahí manda quien mira. Las dos absorbidas sólo se
  // pintan con `bandeja: "decisor"` y el caso aceptado, así que pedir una de ellas desde la Bandeja
  // de Entrada no abre nada que no debiera — simplemente no hay pestaña que seleccionar.
  const [activeTab, setActiveTab] = useState<TabFicha>(
    caseData.pestanaInicial ?? "informacion",
  );
  const [selectedDocument, setSelectedDocument] = useState<IDocument | null>(
    null,
  );

  const eejeId = caseData.eejeId;

  /**
   * Documentos del expediente que el usuario aún no abrió (quick 261030-m29), para el número de la
   * pestaña «Documentación». `null` = sin dato (cargando, sin expediente o el conteo falló): no se
   * pinta nada. Best-effort: su fallo no se le dice al usuario, la ficha funciona igual.
   */
  const [noLeidos, setNoLeidos] = useState<number | null>(null);
  const recargaDocs = caseData.recargaSenal;
  // IN-04 (revisión 261030-m29): al cambiar de expediente con la ficha montada, el número del
  // anterior se borra en el acto; si no, seguía a la vista hasta que llegaba el conteo nuevo.
  useEffect(() => {
    setNoLeidos(null);
  }, [eejeId]);
  useEffect(() => {
    // El resumen mínimo no tiene pestaña de documentos: no hay dónde enseñar el número.
    if (eejeId == null || soloResumen) return;
    let vivo = true;
    DocumentosLecturaService.contar([eejeId])
      .then((mapa) => {
        if (vivo) setNoLeidos(mapa[eejeId] ?? 0);
      })
      .catch(() => {
        if (vivo) setNoLeidos(null);
      });
    return () => {
      vivo = false;
    };
  }, [eejeId, soloResumen, recargaDocs]);

  /** Un documento nuevo se abrió en cualquiera de las dos listas: el número baja en 1, sin pasar de 0. */
  const alLeerDocumento = useCallback(() => {
    setNoLeidos((previo) => (previo == null ? previo : Math.max(0, previo - 1)));
  }, []);

  // Lo que la ficha MUESTRA (puede llevar cambios sin guardar) y la INSTANTÁNEA de lo que está en el
  // servidor. Dos estados y no uno: la diferencia entre ambos es exactamente lo que el aviso de
  // arriba tiene que contar, y con un solo estado no habría contra qué compararlo.
  const [observaciones, setObservaciones] = useState<IObservacion[]>([]);
  const [persistidas, setPersistidas] = useState<IObservacion[]>([]);
  const [borrador, setBorrador] = useState<IObservacionBorrador>(
    crearBorradorVacio(),
  );
  const [panelVisible, setPanelVisible] = useState(true);
  const [guardando, setGuardando] = useState(false);
  /**
   * Fallo al CARGAR las observaciones: se dice en línea, en el hueco del aviso (regla 3b de
   * 261028-kmg). Los fallos de guardar, revisar y verificar van al aviso flotante.
   */
  const [error, setError] = useState<string | null>(null);
  /** Veredicto en vuelo, y si el último rechazo dejó al expediente sin devolución que sostener. */
  const [revisando, setRevisando] = useState(false);
  const [revertido, setRevertido] = useState(false);
  /**
   * Las observaciones de la DEVOLUCIÓN ANTERIOR de un reingresado (Fase 03.24, G-01). Viven aparte
   * de `observaciones`/`persistidas`, que desde aquí son SOLO las nuevas: las anteriores no se
   * editan ni se borran, así que ni cuentan como «sin guardar» ni viajan al guardar.
   */
  const [anteriores, setAnteriores] = useState<IObservacion[]>([]);
  /** Verificación en vuelo: apaga el grupo y bloquea el cierre de la ficha. */
  const [verificando, setVerificando] = useState(false);

  // Al abrir, lo que ya estuviera anotado. Sin esto, reabrir la ficha empezaría de cero y el usuario
  // creería que lo suyo se perdió — que es justo la conducta que el área pidió que NO ocurriera.
  useEffect(() => {
    // Sin eejeId no hay expediente al que anclar nada; sin `puedeObservar` no hay a quién
    // enseñárselo, y pedirlas «por si acaso» sería una petición por ficha abierta que nadie lee.
    if (eejeId == null || !puedeObservar) return;
    let vivo = true;
    ObservacionesService.listar(eejeId)
      .then((lista) => {
        if (!vivo) return;
        const { anteriores: previas, nuevas } = separarObservaciones(lista);
        setAnteriores(previas);
        setObservaciones(nuevas);
        setPersistidas(nuevas);
      })
      .catch(() => {
        if (!vivo) return;
        setError("No se pudieron cargar las observaciones del expediente.");
      });
    return () => {
      vivo = false;
    };
  }, [eejeId, puedeObservar]);

  /**
   * Apunta el panel a un objetivo: el campo o el documento que se acaba de pulsar.
   *
   * Lo que estuviera escrito para el objetivo anterior pasa ANTES a la lista (`conBorrador`): el
   * panel ya no tiene botón de «añadir», y cambiar de campo no puede tirar lo escrito.
   */
  const observar = useCallback(
    (tipo: ObservacionTipo, clave: string, etiqueta: string) => {
      setPanelVisible(true);
      const lista = conBorrador(observaciones, borrador);
      if (lista !== observaciones) setObservaciones(lista);
      const existente = buscarObjetivo(lista, tipo, clave);
      setBorrador({
        tipo,
        clave,
        etiqueta,
        // Un objetivo ya observado enseña su texto, en lugar de una caja vacía que haría pensar que
        // se perdió. El panel la deja deshabilitada y explica por qué.
        texto: existente?.texto ?? "",
      });
    },
    [observaciones, borrador],
  );

  const borrarObservacion = useCallback(
    (tipo: ObservacionTipo, clave: string) => {
      setObservaciones((previas) =>
        previas.filter((o) => !(o.tipo === tipo && o.clave === clave)),
      );
    },
    [],
  );

  /**
   * Cerrar refresca la bandeja. El badge «Por devolver» lo calcula el servidor y viaja con la
   * consulta que hidrata los lotes, así que la lista no se entera de lo anotado hasta que vuelve a
   * pedirla. Sin esto, el usuario observa, cierra, y la fila sigue igual.
   */
  const cerrar = useCallback(() => {
    if (refetchFn) void refetchFn();
    onClose();
  }, [onClose, refetchFn]);

  /**
   * Manda el conjunto entero al servidor y actualiza la instantánea de lo persistido. Es la ÚNICA
   * escritura: «Borrar observaciones» es esta misma llamada con una lista vacía.
   *
   * ⟳ quick 261029-kl0: si el servidor RETIRÓ LA REMISIÓN al secretario (la observación dejó
   * retenido un expediente remitido y sin sortear), se dice UNA sola vez en el aviso flotante, en
   * lugar del aviso de siempre. Al secretario, además, se le cierra la ficha: el expediente volvió al
   * director y la recarga quita su fila. El director se queda en la ficha: el expediente es suyo.
   */
  const persistir = useCallback(
    async (lista: IObservacion[]) => {
      if (eejeId == null) return;
      setGuardando(true);
      try {
        // `lista` son solo las nuevas; la respuesta trae la lista entera y se vuelve a separar.
        const { observaciones: guardadas, remisionRetirada } =
          await ObservacionesService.guardar(eejeId, lista);
        const { anteriores: previas, nuevas } = separarObservaciones(guardadas);
        setAnteriores(previas);
        setObservaciones(nuevas);
        setPersistidas(nuevas);
        setBorrador(crearBorradorVacio());
        if (remisionRetirada) {
          addToast(
            "success",
            puedeRevisar
              ? avisoRemisionRetiradaDirector(nuevas.length)
              : avisoRemisionRetiradaSecretario(nuevas.length),
          );
          if (!puedeRevisar) cerrar();
        } else if (nuevas.length > 0) {
          addToast(
            "success",
            `Se han guardado ${nuevas.length} ${
              nuevas.length === 1 ? "observación" : "observaciones"
            } correctamente`,
          );
        }
      } catch (err) {
        addToast(
          "error",
          mensajeParaUsuario(err, "No se pudieron guardar las observaciones."),
        );
      } finally {
        setGuardando(false);
      }
    },
    [eejeId, addToast, puedeRevisar, cerrar],
  );

  /**
   * EL VEREDICTO DEL DIRECTOR sobre UNA observación (2026-09-18).
   *
   * Va de una en una y no en bloque: el director decide leyendo la ficha, observación por
   * observación, y un botón «Guardar revisión» al final obligaría a recordar lo que pulsó en cada
   * fila —y perdería todo si cerrara sin pulsarlo—. Cada veredicto viaja solo y vuelve con la lista
   * entera, que es la que el servidor acaba de dejar.
   *
   * ⚠️ `revertido` significa que el director rechazó la ÚLTIMA observación viva: el expediente sale
   * de la devolución y vuelve al triage. La ficha lo dice y se cierra, porque lo que se estaba
   * mirando dejó de ser un expediente por devolver — y la bandeja tiene que releerse para que su
   * fila deje de decir que lo es.
   */
  const revisar = useCallback(
    async (obseId: number, estado: "APROBADA" | "RECHAZADA", motivo?: string) => {
      if (eejeId == null) return;
      setRevisando(true);
      try {
        const res = await ObservacionesService.revisar(eejeId, [
          { obseId, estado, motivoRechazo: motivo },
        ]);
        const { anteriores: previas, nuevas } = separarObservaciones(
          res.observaciones,
        );
        setAnteriores(previas);
        setObservaciones(nuevas);
        setPersistidas(nuevas);
        if (res.revertido) {
          setRevertido(true);
        } else if (
          // quick 261029-kl0: el director rechazó la última observación viva de un expediente que
          // una observación había devuelto (RECIBIDO, sin remitir). No hay transición: se remite de
          // nuevo, a mano, desde su fila.
          caseData.eejeStatus === EPAS_ESTADO_POR_REVISAR &&
          caseData.remitidoAlSecretario === false &&
          !quedanObservacionesVivas(res.observaciones)
        ) {
          addToast("info", AVISO_PUEDE_REMITIRSE);
        }
      } catch (err) {
        addToast(
          "error",
          mensajeParaUsuario(err, "No se pudo guardar el veredicto sobre la observación."),
        );
      } finally {
        setRevisando(false);
      }
    },
    [eejeId, addToast, caseData.eejeStatus, caseData.remitidoAlSecretario],
  );

  /**
   * LA VERIFICACIÓN DEL DIRECTOR sobre UNA observación de la devolución anterior (Fase 03.24, G-01,
   * UI-SPEC §1.4): ¿cumplió la DMR lo que se le pidió? Mismo patrón que `revisar`: una por llamada,
   * sin confirmación y sin cambios optimistas; si falla, la lista se queda como estaba.
   *
   * La respuesta trae la lista ENTERA y se vuelve a separar. De ella se toman las anteriores y la
   * instantánea de las nuevas; lo que el usuario esté escribiendo en las nuevas no se toca, porque
   * verificar no las cambia y pisarlas tiraría lo que aún no se guardó.
   */
  const verificar = useCallback(
    async (obseId: number, verificacion: "CUMPLIDA" | "NO_CUMPLIDA") => {
      if (eejeId == null) return;
      setVerificando(true);
      try {
        const lista = await ObservacionesService.verificar(
          eejeId,
          obseId,
          verificacion,
        );
        const { anteriores: previas, nuevas } = separarObservaciones(lista);
        setAnteriores(previas);
        setPersistidas(nuevas);
      } catch (err) {
        addToast("error", mensajeParaUsuario(err, ERROR_VERIFICACION));
      } finally {
        setVerificando(false);
      }
    },
    [eejeId, addToast],
  );

  // Persona jurídica → su razón social ES su identidad; si no, nombre + apellido. Mismo criterio que
  // la fila de la bandeja, para que el modal no llame «Gabriela Díaz» a quien la lista llama «XYZ S.A.».
  const esJuridica = Boolean(caseData.admiBusinessName);

  /**
   * Props del icono de etiqueta de un campo. Se arma aquí para no repetirlo trece veces.
   *
   * Sin `puedeObservar` devuelve el objeto VACÍO, y `Dato` deja de pintar el icono: un icono que
   * abriera un panel que no está montado sería un botón que no hace nada.
   */
  // Lo que marca en ROJO el icono de etiqueta: lo guardado, lo que se está escribiendo (en cuanto la
  // caja tiene texto) y las de la devolución anterior. Pedido del usuario el 2026-10-21: «para saber
  // en qué campos se agregó una observación».
  const observacionesConBorrador = conBorrador(observaciones, borrador);
  const tieneObservacion = (tipo: "CAMPO" | "DOCUMENTO", clave: string) =>
    Boolean(
      buscarObjetivo(observacionesConBorrador, tipo, clave) ??
        buscarObjetivo(anteriores, tipo, clave),
    );

  const campo = (
    clave: string,
    etiqueta: string,
  ): { onObservar?: () => void; observado?: boolean } =>
    puedeObservar
      ? {
          onObservar: () => observar("CAMPO", clave, etiqueta),
          observado: tieneObservacion("CAMPO", clave),
        }
      : {};

  // Lo escrito en la caja cuenta como «sin guardar»: es lo que «Guardar observaciones» va a mandar.
  // Solo compara las NUEVAS: las anteriores no se editan y no pueden quedar sin guardar.
  const sinGuardar = !sonIguales(conBorrador(observaciones, borrador), persistidas);

  // Para PINTAR los avisos 4-6, no para decidir: «Por devolver» lo decide el servidor (UI-SPEC §1.5).
  const verificaciones = contarVerificaciones(anteriores);

  /**
   * DESCARGA DEL EXPEDIENTE COMPLETO, desde la FICHA (quick 260929-kfg, decisión del usuario).
   *
   * 🔴 ESTÁ AQUÍ PORQUE EL SECRETARIO ABOGADO NO TIENE «Mis expedientes». Hasta hoy la descarga solo
   * vivía en la bandeja del decisor, y la actividad 18 de PRO-GEJ-001 —«Enviar EPAS para
   * certificación», el paso previo al oficio de coactiva— es trabajo SUYO sobre expedientes que no
   * son suyos. La ficha es la única superficie que los tres roles comparten.
   *
   * ⚠️ Se añade UN BOTÓN, no el menú de acciones entero: montar `MenuAccionesCaso` aquí sería
   * rediseñar la ficha, y eso no es este encargo.
   *
   * Quién puede lo decide el motor, con la misma regla que la bandeja. Al decisor se le exige la
   * aceptación —la ficha la trae, así que la decisión no queda indecidible—; al secretario y al
   * director, no: certificar expedientes ajenos es su trabajo.
   */
  const veredictoDescarga = resolverAccion("descargarExpediente", {
    rol: caseData.rolName ?? "",
    hechos: hechosDelEpas({
      aceptado: caseData.aceptado ?? caseData.aceptadoImplicito,
      excusaPendiente: false,
    }),
  });

  const [descargando, setDescargando] = useState(false);

  // 🔴 La negativa va al aviso flotante, que ve TODO el que descarga: el aviso de las observaciones
  // solo se pinta a quien puede observar, y el decisor —que es quien más descarga— se quedaba con la
  // negativa solo en consola.
  const descargarExpediente = useCallback(async () => {
    if (eejeId == null || descargando) return;
    setDescargando(true);
    try {
      const { blob, nombreArchivo } =
        await EpasService.descargarExpediente(eejeId);
      // Enlace efímero: la URL se suelta en cuanto el navegador la toma, o cada expediente bajado
      // deja su PDF retenido en memoria.
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (fallo) {
      // La negativa del backend se muestra TAL CUAL: la regla —«sin acta definitiva no hay
      // paquete»— vive en un solo sitio, el servidor.
      addToast(
        "error",
        mensajeParaUsuario(fallo, "No se pudo descargar el expediente."),
      );
    } finally {
      setDescargando(false);
    }
  }, [eejeId, descargando, addToast]);

  /**
   * CERRAR AL PULSAR FUERA (quick 261019-mcf). El `<dialog>` no es de la ficha —es de
   * `ModalContainer`, o del diálogo de la Bandeja de Salida—, así que la ficha le DECLARA lo suyo:
   * las observaciones sin guardar (`sinGuardar`, el mismo aviso ámbar) piden confirmación antes de
   * tirarse; guardar, dar un veredicto o descargar bloquean el cierre; y cerrar es `cerrar`, que
   * además refresca la bandeja.
   */
  const solicitarCierre = useCierreModal({
    hayCambios: sinGuardar,
    ocupado: guardando || revisando || verificando || descargando,
    onCerrar: cerrar,
  });
  // En una ref: `solicitarCierre` cambia con cada cambio de las observaciones, y si fuera dependencia
  // del efecto de abajo, cada re-suscripción devolvería el foco al disparador a mitad de la edición.
  const solicitarCierreRef = useRef(solicitarCierre);
  useEffect(() => {
    solicitarCierreRef.current = solicitarCierre;
  }, [solicitarCierre]);

  /**
   * ESCAPE CIERRA, Y EL FOCO VUELVE AL DISPARADOR.
   *
   * 🔴 `preventDefault()` no sobra. `ModalContainer` monta la ficha dentro de un `<dialog>` abierto
   * con `showModal()`, y ahí Escape tiene conducta NATIVA: cierra el elemento sin avisar a React.
   * El resultado era un modal invisible que el estado seguía creyendo abierto —y que por tanto no
   * se podía volver a abrir—. Se ataja el gesto y se cierra por el camino de siempre, el mismo que
   * el aspa: refrescar la bandeja y avisar al contenedor.
   *
   * Desde el quick 261019-mcf Escape pasa por `solicitarCierre`, la MISMA regla que el clic en el
   * fondo: con observaciones sin guardar pregunta antes, y mientras se guarda o se descarga no cierra.
   * Con el foco dentro de la ficha lo ataja antes `DialogoModal` (y este oyente no llega a enterarse);
   * este cubre el foco fuera del `<dialog>`, p. ej. en el `<body>`.
   *
   * Y al desmontar, el foco regresa a quien abrió la ficha (el `👁` de su fila). Sin esto, cerrar
   * con el teclado deja el foco en el `<body>` y quien navega sin ratón tiene que recorrer la tabla
   * entera para volver donde estaba. Es el mismo criterio que `MenuAccionesCaso`.
   */
  useEffect(() => {
    const disparador = document.activeElement as HTMLElement | null;

    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      evento.preventDefault();
      solicitarCierreRef.current();
    };

    document.addEventListener("keydown", alPulsar);
    return () => {
      document.removeEventListener("keydown", alPulsar);
      if (disparador && typeof disparador.focus === "function") {
        disparador.focus();
      }
    };
  }, []);

  return (
    <div className="modal-box app-modules-case-modal relative p-0">
      <div className="app-modules-case-modal-shell">
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            {/* El rótulo dice desde dónde se está mirando: es la misma ficha, pero no es el mismo
                momento del procedimiento, y quien la abre tiene que reconocer de cuál viene. */}
            <p className="app-modules-modal-kicker">
              {esDelDecisor ? "Mis expedientes" : "Bandeja de ingreso"}
            </p>
            <h2 className="app-modules-modal-title">
              {`Expediente # ${
                caseData.expNumber ?? `EPAS ${caseData.eejeId ?? SIN_DATO}`
              }`}
            </h2>
          </div>
          <div className="app-modules-modal-meta">
            <button
              type="button"
              onClick={cerrar}
              className="app-modules-modal-close"
              aria-label="Cerrar modal de expediente"
            >
              ×
            </button>
          </div>
        </div>

        {/* El aviso de ESTADO de las observaciones: ámbar mientras haya cambios sin guardar —es lo
            que distingue «lo anoté» de «lo anoté y lo mandé», y esa diferencia importa: el memorando
            lee el servidor, no la pantalla—. Que se guardaron lo dice el aviso flotante al guardar
            (quick 261028-kmg); aquí el error es solo el de CARGA. */}
        {!puedeObservar ? null : error ? (
          <Alert variant="error" message={error} />
        ) : revertido ? (
          /* 🔴 El director rechazó la ÚLTIMA observación viva: la devolución se quedó sin motivo y
             el expediente volvió al triage. Se dice AQUÍ y no con un toast que se va: es un cambio
             de estado del expediente que se está mirando, y quien lo provocó tiene que saber que ya
             no está delante de un expediente por devolver. */
          <Alert
            variant="info"
            message="Se rechazaron todas las observaciones: este expediente sale de la devolución y vuelve a la Bandeja de Entrada."
          />
        ) : sinGuardar ? (
          <Alert
            variant="warning"
            message="Hay observaciones sin guardar. Pulse «Guardar observaciones» para que viajen con la devolución."
          />
        ) : verificaciones.noCumplidas > 0 ? (
          /* Avisos 4-6 del reingreso (Fase 03.24, G-01, UI-SPEC §1.5): salen del estado del
             servidor, no de lo último pulsado, y al reabrir la ficha dicen lo mismo. Ninguno es
             asertivo (IN-02): el 5 ya está al abrir y es `note`; el 4 y el 6 cambian por lo que el
             director acaba de pulsar y van como `status`. */
          <Alert variant="warning" rol="status" message={AVISO_NO_CUMPLIDAS} />
        ) : verificaciones.porVerificar > 0 && puedeRevisar ? (
          <Alert
            variant="info"
            rol="note"
            message={AVISO_REINGRESO_POR_VERIFICAR}
          />
        ) : verificaciones.total > 0 &&
          verificaciones.cumplidas === verificaciones.total ? (
          <Alert variant="success" rol="status" message={AVISO_TODAS_CUMPLIDAS} />
        ) : null}

        {/* `--split` es lo que convierte el layout en la rejilla 65/35 de las capturas. Solo cuando
            el panel está a la vista: sin él, la ficha vuelve a ocupar el ancho entero, que es lo que
            tiene que hacer cuando el panel se oculta o el caso no ha aterrizado. */}
        <div
          className={`app-modules-case-layout ${
            eejeId != null && panelVisible && puedeObservar
              ? "app-modules-case-layout--split"
              : ""
          }`}
        >
          <div className="app-modules-case-main-column">
            {/* 🔴 FASE 1 — el RESUMEN MÍNIMO del expediente todavía no aceptado. Lo que el decisor
                necesita para decidir si acepta o se excusa, y nada más: el expediente se revela al
                aceptarlo. Es la regla que vivía en el desplegable, mudada junto con lo que gateaba. */}
            {soloResumen ? (
              <div className="app-modules-tab-content app-modules-case-modal-tab-content">
                <div className="app-modules-modal-body">
                  <div className="app-modules-modal-content space-y-8">
                    <Seccion titulo="Resumen previo a la aceptación">
                      <Dato label="Administrado">{caseData.administrado}</Dato>
                      <Dato label="Cédula de Identidad / RUC">
                        {caseData.cedula ?? caseData.admiIdentification}
                      </Dato>
                      <Dato label="Sorteado">
                        {caseData.sorteoAt
                          ? DatetimeUtil.formatDate(caseData.sorteoAt)
                          : undefined}
                      </Dato>
                      <Dato label="Vence">
                        {caseData.plazoVenceAt
                          ? DatetimeUtil.formatDate(caseData.plazoVenceAt)
                          : undefined}
                      </Dato>
                      <Dato label="Plazo">
                        {caseData.plazoDias != null
                          ? `${caseData.plazoDias} día(s)`
                          : undefined}
                      </Dato>
                      <Dato label="Situación">Pendiente de aceptación</Dato>
                    </Seccion>
                  </div>
                </div>
              </div>
            ) : (
            <div className="app-modules-tabs-container app-modules-case-modal-tabs border-b border-transparent">
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setActiveTab("informacion")}
                  className={`app-modules-tab-label ${
                    activeTab === "informacion" ? "active" : ""
                  }`}
                >
                  Información del Expediente
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("documentos")}
                  aria-label={
                    noLeidos != null && noLeidos > 0
                      ? `Documentación, ${noLeidos} sin leer`
                      : undefined
                  }
                  className={`app-modules-tab-label ${
                    activeTab === "documentos" ? "active" : ""
                  }`}
                >
                  Documentación
                  {/* El número es visual; el nombre accesible lo dice entero en `aria-label`. */}
                  {noLeidos != null && noLeidos > 0 && (
                    <span
                      className="badge badge-accent badge-sm ml-2"
                      aria-hidden="true"
                    >
                      {noLeidos}
                    </span>
                  )}
                </button>
                {/* INFRACCIONES (Fase 03.23, D-16): de las dos bandejas, no de las absorbidas. */}
                <button
                  type="button"
                  onClick={() => setActiveTab("infracciones")}
                  className={`app-modules-tab-label ${
                    activeTab === "infracciones" ? "active" : ""
                  }`}
                >
                  Infracciones
                </button>
                {/* Las DOS ABSORBIDAS (D-10). Sólo desde «Mis Expedientes»: son actos de la
                    ejecución, y el triage de la Bandeja de Entrada decide si el expediente entra,
                    no qué se hace con él una vez dentro. */}
                {esDelDecisor && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveTab("notificaciones")}
                      className={`app-modules-tab-label ${
                        activeTab === "notificaciones" ? "active" : ""
                      }`}
                    >
                      Notificaciones
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("impugnacion")}
                      className={`app-modules-tab-label ${
                        activeTab === "impugnacion" ? "active" : ""
                      }`}
                    >
                      Recursos
                    </button>
                  </>
                )}
              </div>

              {activeTab === "informacion" && (
                <div className="app-modules-tab-content app-modules-case-modal-tab-content pt-0!">
                  <div className="app-modules-modal-body">
                    <div className="app-modules-modal-content space-y-8">
                      {/* D-05 (Fase 03.24): lo que Resolución no mandó, a la vista al abrir la
                          ficha. Traduce el campo del servidor; no pinta nada si no falta nada. */}
                      <AvisoDatosResolucion
                        faltantes={caseData.datosResolucionFaltantes}
                        variante="alerta"
                      />
                      <Seccion titulo="Datos del Administrado">
                        {esJuridica ? (
                          <Dato
                            label="Razón Social"
                            {...campo("admiBusinessName", "Razón Social")}
                          >
                            {caseData.admiBusinessName}
                          </Dato>
                        ) : (
                          <>
                            <Dato
                              label="Nombre"
                              {...campo("admiName", "Nombre")}
                            >
                              {caseData.admiName}
                            </Dato>
                            <Dato
                              label="Apellido"
                              {...campo("admiLastname", "Apellido")}
                            >
                              {caseData.admiLastname}
                            </Dato>
                          </>
                        )}
                        <Dato
                          label="Cédula de Identidad / RUC"
                          {...campo(
                            "admiIdentification",
                            "Cédula de Identidad / RUC",
                          )}
                        >
                          {caseData.admiIdentification}
                        </Dato>
                        <Dato
                          label="Teléfono"
                          {...campo("admiTelephone", "Teléfono")}
                        >
                          {caseData.admiTelephone}
                        </Dato>
                        <Dato
                          label="Correo Electrónico"
                          {...campo("admiEmail", "Correo Electrónico")}
                        >
                          {caseData.admiEmail}
                        </Dato>
                        <Dato
                          label="Dirección"
                          {...campo("admiAddress", "Dirección")}
                        >
                          {caseData.admiAddress}
                        </Dato>
                        <Dato
                          label="Casilla Judicial"
                          {...campo("admiJudicialLocker", "Casilla Judicial")}
                        >
                          {caseData.admiJudicialLocker}
                        </Dato>
                      </Seccion>

                      <Seccion titulo="Información del Expediente">
                        <Dato
                          label="Número de Expediente"
                          {...campo("expNumber", "Número de Expediente")}
                        >
                          {caseData.expNumber}
                        </Dato>
                        {/* El ESTADO no lleva icono: no es un dato del expediente que la DMR pueda
                            corregir, es dónde está en su máquina de estados. Observarlo sería pedir
                            que arreglen algo que no escribieron ellos. */}
                        <Dato label="Estado del Expediente">
                          {/* El estado, con su etiqueta legible y su chip — la misma pareja que la
                              columna ESTATUS de «Mis expedientes» (quick 260929-mbo). El valor
                              CRUDO va en `priority`: es lo que colorea. */}
                          <BadgePriority
                            text={etiquetaEstadoEpas(caseData.eejeStatus)}
                            priority={caseData.eejeStatus ?? ""}
                            size="md"
                            capitalize={false}
                          />
                        </Dato>
                        <Dato label="Zonal" {...campo("expZone", "Zonal")}>
                          {caseData.expZone}
                        </Dato>
                        <Dato
                          label="Número de Folios"
                          {...campo("expFojas", "Número de Folios")}
                        >
                          {caseData.expFojas}
                        </Dato>
                        <Dato
                          label="Medida Cautelar"
                          {...campo("expMedidaCautelar", "Medida Cautelar")}
                        >
                          {caseData.expMedidaCautelar}
                        </Dato>
                        <Dato
                          label="Fecha del Expediente"
                          {...campo("expCreatedAt", "Fecha del Expediente")}
                        >
                          {caseData.expCreatedAt
                            ? DatetimeUtil.formatDate(caseData.expCreatedAt)
                            : undefined}
                        </Dato>
                        {/* El estado del TRÁMITE es distinto del estado legal: aquel dice dónde
                            está el expediente en derecho; este, qué se hizo por última vez. Tampoco
                            se observa: lo escribe Ejecución, no la dirección de origen. */}
                        <Dato label="Última Providencia">
                          {caseData.estadoTramite}
                        </Dato>
                      </Seccion>

                      <Seccion titulo="Resolución de Origen">
                        <Dato
                          label="Número de Resolución"
                          {...campo(
                            "resolucionNumero",
                            "Número de Resolución",
                          )}
                        >
                          {caseData.resolucionNumero}
                        </Dato>
                        <Dato
                          label="Fecha de Resolución"
                          {...campo("resolucionFecha", "Fecha de Resolución")}
                        >
                          {caseData.resolucionFecha
                            ? DatetimeUtil.formatDate(caseData.resolucionFecha)
                            : undefined}
                        </Dato>
                        <Dato
                          label="Multa Impuesta"
                          {...campo("multaImpuesta", "Multa Impuesta")}
                        >
                          {/* `!= null` y no un `&&`: una multa DECLARADA de 0 se imprime «USD 0,00»,
                              que no es lo mismo que no saberla. */}
                          {caseData.multaImpuesta != null
                            ? formatearUsd(caseData.multaImpuesta)
                            : undefined}
                        </Dato>
                        <Dato label="Obligación de Hacer">
                          {caseData.obligacionHacer?.tiene ? "Sí" : "No"}
                        </Dato>
                      </Seccion>
                    </div>
                  </div>
                </div>
              )}

              {/* 🔴 DOS LISTADOS QUE CONVIVEN, uno por bandeja, y ninguno se pierde.
                  El decisor ve la LISTA PLANA porque es la única que acepta `recargaSenal`: es el
                  hilo por el que «Adjuntar documento» refresca la lista de SU expediente y sólo la
                  suya. El triage sigue con el acordeón por Dirección metropolitana y su visor al
                  lado, que es lo que necesita para saber de dónde vino cada papel. */}
              {activeTab === "documentos" && esDelDecisor && (
                <div className="app-modules-tab-content app-modules-case-modal-tab-content app-modules-case-modal-tab-content--docs pt-0!">
                  {/* El documento se ve AQUÍ, en el hueco de la derecha, y no en el modal del
                      visor: `ModalProvider` sostiene un solo modal, y abrir el visor reemplazaba la
                      ficha sin camino de vuelta (2026-10-29). Mismo reparto que el triage. */}
                  <div className="app-modules-case-modal-docs-layout">
                    <div className="app-modules-case-modal-docs-list">
                      {caseData.eejeId != null ? (
                        <ExpedienteDocumentos
                          eejeId={caseData.eejeId}
                          recargaSenal={caseData.recargaSenal}
                          docIdAbierto={selectedDocument?.docId}
                          onAbrirDocumento={(doc) =>
                            // El visor solo lee nombre y URL; el resto de IDocument no viaja en
                            // esta lista (mismo contrato que el modal del visor).
                            setSelectedDocument({
                              docId: doc.docId,
                              docName: doc.docName,
                              docUrl: doc.docUrl ?? "",
                            } as IDocument)
                          }
                          // Quick 261030-dun: debajo, los documentos de los otros módulos, que se
                          // abren en el MISMO hueco. docId -1 no coincide con ningún documento
                          // propio, así que `docIdAbierto` no resalta nada propio; el externo se
                          // resalta por su URL.
                          mostrarOtrosModulos
                          onAbrirDocumentoExterno={(doc) =>
                            setSelectedDocument({
                              docId: -1,
                              docName: doc.nombre,
                              docUrl: doc.archivoUrl,
                            } as IDocument)
                          }
                          urlExternaAbierta={selectedDocument?.docUrl}
                          onLeido={alLeerDocumento}
                        />
                      ) : (
                        <p className="app-modules-case-modal-direction-error">
                          El caso todavía no aterrizó como expediente de
                          Ejecución: no hay documentación que listar.
                        </p>
                      )}
                    </div>

                    <div className="app-modules-case-modal-docs-preview">
                      {selectedDocument ? (
                        <PDFViewer
                          document={selectedDocument}
                          loading={false}
                        />
                      ) : (
                        <div className="app-modules-case-modal-docs-empty">
                          Selecciona un documento para visualizarlo
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "documentos" && !esDelDecisor && (
                <div className="app-modules-tab-content app-modules-case-modal-tab-content app-modules-case-modal-tab-content--docs pt-0!">
                  <div className="app-modules-case-modal-docs-layout">
                    <div className="app-modules-case-modal-docs-list">
                      {caseData.eejeId != null ? (
                        <CaseDirectionDocumentsList
                          eejeId={caseData.eejeId}
                          selectedDocumentId={selectedDocument?.docId}
                          // Quick 261030-dun: los documentos de otros módulos llevan ids negativos
                          // que se repiten entre Direcciones; la URL decide cuál resaltar.
                          selectedDocumentUrl={selectedDocument?.docUrl}
                          onSelectDocument={setSelectedDocument}
                          recargaSenal={caseData.recargaSenal}
                          onLeido={alLeerDocumento}
                          accionPorDocumento={(documento) => {
                            // 🔴 LA CLAVE ES EL doc_id EN TEXTO y la etiqueta es el NOMBRE del
                            // documento tal y como se ve. El backend lo guarda así —sin clave
                            // foránea— porque la lectura de documentos está declarada INTERINA y el
                            // día que lleguen de Resolución la foránea habría que tirarla; la
                            // etiqueta es la instantánea que hace legible el memorando aunque el
                            // documento cambie de origen.
                            const clave = String(documento.docId);
                            const observado = tieneObservacion("DOCUMENTO", clave);
                            return (
                              <span
                                title={
                                  observado
                                    ? `«${documento.docName}» ya tiene una observación`
                                    : `Observar «${documento.docName}»`
                                }
                              >
                                <Boton
                                  deshabilitado={false}
                                  estilos={`btn btn-xs ${
                                    observado
                                      ? "btn-soft btn-error"
                                      : "btn-ghost text-primary"
                                  }`}
                                  icono="etiqueta"
                                  onClick={() =>
                                    observar(
                                      "DOCUMENTO",
                                      clave,
                                      documento.docName,
                                    )
                                  }
                                />
                              </span>
                            );
                          }}
                        />
                      ) : (
                        <p className="app-modules-case-modal-direction-error">
                          El caso todavía no aterrizó como expediente de
                          Ejecución: no hay documentación que listar.
                        </p>
                      )}
                    </div>

                    <div className="app-modules-case-modal-docs-preview">
                      {selectedDocument ? (
                        <PDFViewer
                          document={selectedDocument}
                          loading={false}
                        />
                      ) : (
                        <div className="app-modules-case-modal-docs-empty">
                          Selecciona un documento para visualizarlo
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* INFRACCIONES (Fase 03.23, D-16/D-08). Se MONTA solo con la pestaña activa: pedir la
                  ficha refresca CORE, y eso solo debe pasar cuando alguien la mira. */}
              {activeTab === "infracciones" && (
                <div className="app-modules-tab-content app-modules-case-modal-tab-content pt-0!">
                  <div className="app-modules-modal-body">
                    <div className="app-modules-modal-content space-y-4">
                      {eejeId != null ? (
                        <InfraccionesSeccion eejeId={eejeId} />
                      ) : (
                        <p className="app-modules-case-modal-direction-error">
                          El caso todavía no aterrizó como expediente de
                          Ejecución: no hay infracciones que listar.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* NOTIFICACIONES (D-10). Aquí arrancan los plazos —la fecha del primer despacho
                  recibido— y aquí consta que se agotaron los medios sin lograrlo, que NO detiene el
                  procedimiento. `permiteRegistrar` va en firme porque a esta ficha sólo llega el
                  decisor; el backend lo hace cumplir de todas formas. */}
              {activeTab === "notificaciones" && esDelDecisor && (
                <div className="app-modules-tab-content app-modules-case-modal-tab-content pt-0!">
                  <div className="app-modules-modal-body">
                    <div className="app-modules-modal-content space-y-4">
                      {caseData.eejeId != null ? (
                        <NotificacionesExpediente
                          eejeId={caseData.eejeId}
                          permiteRegistrar
                        />
                      ) : (
                        <p className="app-modules-case-modal-direction-error">
                          Sin EPAS aterrizado: no hay notificaciones que listar.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* IMPUGNACIÓN (D-10, act. 7 de PRO-GEJ-001). `onChanged` es la MISMA recarga de la
                  bandeja que ya reparte el contenedor: las acciones de esta rama cambian el estado
                  del EPAS, así que la fila de atrás deja de ser cierta en cuanto se pulsa una. */}
              {activeTab === "impugnacion" && esDelDecisor && (
                <div className="app-modules-tab-content app-modules-case-modal-tab-content pt-0!">
                  <div className="app-modules-modal-body">
                    <div className="app-modules-modal-content space-y-4">
                      <ImpugnacionAcciones
                        row={caseData}
                        onChanged={() => refetchFn?.()}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

          {/* EL PANEL, a la derecha y compartido por las dos pestañas: se observa un campo de la
              ficha o un documento de la otra pestaña, y lo anotado se ve en el mismo sitio. Solo
              tiene sentido sobre un caso ATERRIZADO — sin `eejeId` no hay expediente al que anclar
              una observación ni endpoint al que mandarla.
              🔴 Y sólo desde la Bandeja de Entrada (`puedeObservar`): es el acto del triage. */}
          {eejeId != null && panelVisible && puedeObservar && (
            <ObservacionesSeccion
              borrador={borrador}
              observaciones={observaciones}
              onBorradorChange={setBorrador}
              onOcultar={() => setPanelVisible(false)}
              onBorrar={borrarObservacion}
              onGuardar={() => void persistir(conBorrador(observaciones, borrador))}
              onBorrarTodas={() => void persistir([])}
              guardando={guardando}
              puedeRevisar={puedeRevisar}
              usuarioId={usuarioId}
              onAprobar={(obseId) => void revisar(obseId, "APROBADA")}
              onRechazar={(obseId, motivo) =>
                void revisar(obseId, "RECHAZADA", motivo)
              }
              revisando={revisando}
              anteriores={anteriores}
              onVerificar={(obseId, verificacion) =>
                void verificar(obseId, verificacion)
              }
              verificando={verificando}
            />
          )}

          {eejeId != null &&
            (veredictoDescarga.visible ||
              (!panelVisible && puedeObservar)) && (
              <div className="flex justify-end gap-2 px-4 pb-2">
                {/* APAGAR Y NO ESCONDER: si el motor la niega, el botón sale visible con su motivo
                    en el `title`. Es la doctrina del módulo —quien mira tiene derecho a saber que
                    el paso existe y por qué no le toca— y aquí importa el doble, porque este es el
                    único sitio donde el secretario abogado puede hacerlo. */}
                {veredictoDescarga.visible && (
                  <Boton
                    deshabilitado={!veredictoDescarga.habilitada || descargando}
                    estilos="btn btn-sm btn-outline"
                    icono="descargar"
                    texto={
                      descargando
                        ? "Descargando…"
                        : "Descargar expediente (PDF)"
                    }
                    titulo={veredictoDescarga.motivo}
                    onClick={() => void descargarExpediente()}
                  />
                )}
                {!panelVisible && puedeObservar && (
                  <Boton
                    deshabilitado={false}
                    estilos="btn btn-sm btn-outline btn-primary"
                    icono="etiqueta"
                    texto="Observaciones"
                    onClick={() => setPanelVisible(true)}
                  />
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ModalExpedienteLote;
