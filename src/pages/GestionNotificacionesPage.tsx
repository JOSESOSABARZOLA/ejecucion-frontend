/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: El Gestor de Notificaciones — la pantalla (Fase 03.20, Plan 07, §1 del contrato de UI)
 * Archivo: GestionNotificacionesPage.tsx
 * Responsabilidad: Enseñar al secretario abogado y al director TODAS las notificaciones del módulo
 *   —es una lectura TRANSVERSAL, no una bandeja de rol— en la tabla de `docs/gestion-notificaciones.jpeg`:
 *   once columnas con su fila de filtros y su paginado de servidor, el anillo de progreso de los
 *   despachos de cada notificación, y la fila expandible con las tres formas de notificación.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-28
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-09: la tarjeta recibe
 *   `despachoBloqueadoPorFirma` de la fila. Ni columna ni chip nuevos en la tabla, UI-SPEC §9.)
 *
 * ── DE DÓNDE SALE, Y QUÉ NO SE COPIÓ ─────────────────────────────────────────────────────────
 * El encargo del usuario fue literal: «Este submenú debe ser igual al que tiene resolución. copia
 * estilos y funcionamiento». El analog de ASPECTO y de columnas es `NotificationPage.tsx` de
 * `resolucion-frontend`; el analog ESTRUCTURAL —el que manda— es `MisAsignadosPage.tsx` de ESTE
 * repositorio. Lo que NO se copió, cada cosa con su razón, está escrito junto a cada pieza:
 *
 *   · El DOMINIO de las dos columnas traducidas: los valores de la captura («De excusa», «Nulidad
 *     parcial») son actos de la DMR y aquí saldrían columnas siempre vacías (D-12).
 *   · Los cuatro chips de estatus de la captura: no existen en Ejecución. El catálogo son los quince
 *     estados del EPAS.
 *   · El color de acento y de semántica de esas dos columnas (D-22, ver el memo de `columnas`).
 *   · La franja azul marino del rótulo del panel (ver el bloque del cascarón, más abajo).
 *
 * ── 🔴 LO QUE NO SE PUEDE ROMPER AL TOCAR ESTE ARCHIVO ───────────────────────────────────────
 * 1. `columnas` y `buscarNotificaciones` van MEMOIZADAS con dependencias estables. El efecto de
 *    carga de `Table.tsx` depende de las DOS (C7 de la Fase 03.19, Plan 06): una identidad nueva en
 *    cada render es un BUCLE DE PETICIONES contra un endpoint que lleva cédula, nombres y apellidos
 *    del administrado en cada página (T-03.20-38). Por eso la función de recarga vive en un `useRef`
 *    y no en estado, y por eso `columnas` no depende de nada.
 * 2. NINGÚN VOLCADO A CONSOLA del listado ni de la fila (T-03.20-36). El detalle de un fallo se
 *    enseña EN PANTALLA, que es donde tiene que verse; por la consola del navegador pasaría la fila
 *    entera.
 * 3. 🔴 EL INTERRUPTOR DEL ENVÍO LO RESUELVE EL SERVIDOR (D-20 / CH-5). Viaja UNA vez, en la RAÍZ
 *    del sobre, y se guarda tal cual en estado de la página. No se deduce, no se sustituye por un
 *    valor por defecto y no se deriva del rol: un botón encendido en un entorno donde el envío está
 *    apagado ofrece mandar una notificación jurídica que no va a salir.
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useMemo, useRef, useState } from "react";
import DialogoModal from "../components/common/DialogoModal";
import type { ColumnDef } from "@tanstack/react-table";
import Table, { type PaginationAndFilters } from "../components/tabla/Table";
// 🔴 Import POR EFECTO SECUNDARIO: `ITableFilter.ts` lleva el `declare module` que añade
// `filterType` y `catalogKey` al `ColumnMeta` de TanStack. Sin esta línea el archivo no entra en la
// compilación de este módulo, el `meta` de las columnas de abajo deja de tipar y TODA la fila de
// filtros cae a «texto» en silencio: el catálogo de ESTATUS y el rango de fechas desaparecen.
import "../interfaces/ITableFilter";
import HeaderPage from "../components/common/HeaderPage";
import Alert, { type AlertVariant } from "../components/common/Alert";
import Boton from "../components/common/Boton";
import BadgePriority from "../components/common/BadgePriority";
import RadialProgress from "../components/common/RadialProgress";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";
import TarjetaFormaNotificacion from "../components/notificacion/TarjetaFormaNotificacion";
import FormasNotificacionModal from "../components/notificacion/FormasNotificacionModal";
import { useToast } from "../hooks/useToast";
import { etiquetaEstadoEpas } from "../config/estadosEpas";
import { DatetimeUtil } from "../utils/datetime.util";
import {
  ESTADOS_DESPACHO_RESUELTOS,
  ORDEN_FORMAS_NOTIFICACION,
  porcentajeDespachosResueltos,
} from "../utils/notificacionEjecucion.util";
import type {
  DespachoGestor,
  GestorNotificacion,
} from "../services/NotificacionEjecucionService";
import NotificacionEjecucionService from "../services/NotificacionEjecucionService";

/**
 * Los estilos de la tabla.
 *
 * 🔴 ALTO MÁXIMO, NO ALTO FIJO, y ésa es la única diferencia con la bandeja del decisor (§1.7): la
 * fila expandida cambia la altura de la tabla. Con `h-` fijo, ocho filas dejarían hueco muerto
 * debajo y desplegar una fila recortaría el panel contra el borde del contenedor.
 */
const ESTILOS_TABLA = {
  containerStyle: "relative overflow-x-auto min-h-96",
  tableStyle: "table mt-0 w-full text-sm md:text-base",
};

/**
 * Esta pantalla NO tiene columna de acciones —la captura no la tiene y D-18 deja el Gestor en solo
 * mostrar—, así que la de la tabla se oculta y no hay ninguna acción que resolver por fila. Las dos
 * son CONSTANTES DE MÓDULO y no literales en el render: `resolveActionsPerRow` se llama por fila, y
 * un array nuevo por render sería trabajo tirado en cada pulsación de un filtro.
 */
const SIN_ACCIONES_DE_TABLA: never[] = [];
const SIN_RESOLVER_DE_FILA = (): never[] => [];

/** Los dos vacíos, con el copy literal de §5.5. */
const VACIO_SIN_FILTROS = {
  texto: "No hay notificaciones registradas",
  pista:
    "Las notificaciones se crean al emitir una providencia u otro documento dirigido al administrado.",
};

const VACIO_CON_FILTROS = {
  texto: "Ninguna notificación coincide con los filtros",
  pista:
    "Revise los filtros de las columnas; puede haber alguno puesto en una que no esté a la vista.",
};

/**
 * EL FALLO DE CARGA (§1.8 y §5.5), copiado del bloque de la bandeja del decisor.
 *
 * 🔴 QUÉ PASA SIN ESTO (T-03.20-37): cuando la lectura RECHAZA, el `.then()` de `Table.tsx` no
 * corre, el `.finally()` apaga el indicador y la tabla se queda enseñando su estado VACÍO — es
 * decir, **un fallo de red se lee como «no hay notificaciones registradas»**. En una pantalla cuyo
 * objeto es saber a quién se ha notificado, ésa es la afirmación más peligrosa que se puede hacer.
 */
const ERROR_DE_CARGA_ENCABEZADO = "No se pudieron cargar las notificaciones.";
const ERROR_DE_CARGA_PISTA =
  "Vuelva a intentarlo; si persiste, avise a soporte.";

/**
 * EL AVISO DEL ENVÍO APAGADO (§5.7, D-11 / D-20 / D-25).
 *
 * 🔴 Se pinta UNA VEZ POR PÁGINA —no por fila— y NO SE PUEDE CERRAR. La decisión del usuario es que
 * el modo quede «visible, no disimulado»: un `logger.warn` en el servidor no es visible para el
 * secretario. Y la frase dice las DOS cosas que importan: que los despachos existen (se abren y
 * quedan pendientes) y que nadie recibió nada.
 */
const AVISO_ENVIO_APAGADO =
  "El envío automático de correo está desactivado en este entorno. Los despachos de correo se abren y quedan pendientes; no se ha enviado ningún correo al administrado.";

/** §5.6 — el texto de la celda de progreso cuando no hay ningún canal que despachar. */
const PROGRESO_SIN_DESPACHOS = "Sin despachos";
const PROGRESO_SIN_DESPACHOS_BURBUJA =
  "El administrado no ha declarado ninguna forma de notificación";

/** Cuántos de los despachos de una notificación están RESUELTOS (D-16). */
const contarResueltos = (despachos: DespachoGestor[]): number =>
  despachos.filter((despacho) =>
    (ESTADOS_DESPACHO_RESUELTOS as readonly string[]).includes(
      String(despacho.estado ?? "").toLowerCase(),
    ),
  ).length;

/**
 * La celda de la columna PROGRESO.
 *
 * 🔴 CON CERO DESPACHOS NO SE PINTA ANILLO (§1.4 / A11). `porcentajeDespachosResueltos` devuelve `0`
 * con la lista vacía por compatibilidad aritmética, y un anillo de 0 % sale ROJO: diría «nadie ha
 * hecho nada, actúe», que es falso —no hay ningún canal que despachar— y además accionable por
 * error. Medido el 2026-09-25: **156 de 157** administrados no tienen ninguna forma aceptada, así
 * que éste es el caso NORMAL, no el borde. En su lugar se pinta el texto que lo explica.
 *
 * 🔴 EL ANILLO NO SE CREA AQUÍ: `RadialProgress` ya existe, sus tres cortes producen exactamente
 * los colores de la captura y **no se toca ni una línea suya**. Lo único que esta pantalla escribe
 * es de dónde sale el porcentaje, y sale de la ÚNICA función que lo calcula (D-16).
 *
 * ⚠️ El número de dentro del anillo FALLA contraste AA en un tema y en tramos opuestos (2,53:1 el
 * naranja en claro, 4,15:1 el rojo en oscuro). La causa son dos tokens del módulo, no dos clases de
 * esta pantalla, y arreglarlos repintaría veinticuatro pantallas: queda como deuda registrada
 * (D-24). Lo que sí se hace para que el dato no se pierda es la burbuja de aquí abajo, que dice el
 * conteo EN PALABRAS, más los chips legibles de las tarjetas.
 */
const CeldaProgreso = ({ despachos }: { despachos: DespachoGestor[] }) => {
  const total = despachos.length;

  if (total === 0) {
    return (
      <div className="flex justify-center">
        <div
          className="tooltip tooltip-right"
          data-tip={PROGRESO_SIN_DESPACHOS_BURBUJA}
        >
          <span className="whitespace-nowrap text-xs text-base-content/70">
            {PROGRESO_SIN_DESPACHOS}
          </span>
        </div>
      </div>
    );
  }

  const resueltos = contarResueltos(despachos);

  return (
    <div className="flex justify-center">
      <div
        className="tooltip tooltip-right"
        data-tip={`${resueltos} de ${total} despachos resueltos`}
      >
        <RadialProgress
          resolvePercentage={() => porcentajeDespachosResueltos(despachos)}
        />
      </div>
    </div>
  );
};

/**
 * §5.6 — EL AVISO DEL PANEL, cuando las TRES formas están sin declarar.
 *
 * 🔴 NO ES ADORNO: es el hueco que hay que VER y no disimular (D-12 de la 03.14.3), dicho en la
 * pantalla en vez de en un registro del servidor. Y es el caso de **156 de 157** administrados,
 * medido el 2026-09-25: sin él, la fila expandida del caso NORMAL sería tres tarjetas vacías sin
 * ninguna explicación de por qué lo están ni de quién lo cambia.
 *
 * La frase dice las dos cosas: qué falta, y quién lo cambia (acta de Secretaría General). No dice
 * «error», ni «fallo», ni «sin datos» — nada de eso es cierto aquí.
 */
const AVISO_SIN_NINGUNA_FORMA =
  "Este administrado no ha declarado ninguna forma de notificación, así que no se abrió ningún despacho. Las formas se actualizan mediante acta por Secretaría General; no se declaran desde esta pantalla.";

/** §3 — lo que el diálogo del reenvío dice ANTES de que el secretario confirme. */
const REENVIO_ESTADO = "El despacho está pendiente";
const REENVIO_DESCRIPCION =
  "Se enviará el documento al correo del administrado. Si el envío se acepta, la notificación queda perfeccionada y los términos empiezan a correr desde hoy.";

/**
 * §5.4 — EL COPY DE LOS CUATRO DESENLACES, verbatim del contrato **enmendado el 2026-09-28**
 * (CR-05: la línea del rechazo que §5.4 traía era anterior a que el Plan 05 hiciera `rechazado` un
 * desenlace RESOLUTIVO, y afirmaba lo contrario de lo que el backend hace).
 *
 * 🔴 Los cuatro dicen **qué pasó Y qué hacer**, y los tres últimos dicen explícitamente **que nadie
 * quedó notificado** — que es la pregunta que el secretario se hace, y la que tiene consecuencias
 * jurídicas. Van a constantes y no en línea para que cambiarlos sea un diff de este bloque.
 *
 * ⚠️ El CUARTO no nombra ninguna dirección, y no es una omisión: cuando el transporte está caído la
 * promesa RECHAZA y no hay respuesta de la que sacar el correo congelado. Inventarlo con el del
 * despacho diría que se intentó con ésa, y no se intentó con ninguna.
 */
const avisoAceptado = (correo: string) =>
  `Notificación enviada a ${correo}. El despacho queda notificado y consta la razón de envío en el expediente.`;
/**
 * 🔴 CR-05 (revisión de la Fase 03.20, 2026-09-28) — ESTE TEXTO DECÍA TRES COSAS FALSAS.
 *
 * Decía «el despacho sigue pendiente» cuando el backend lo RESUELVE (`desp_status = 'rechazado'`,
 * `desp_resuelto_at` escrito, razón de imposibilidad emitida, asiento `DESPACHO_RECHAZADO`), decía
 * que el intento «quedó registrado» como si eso fuera todo lo que pasó, e invitaba a «volver a
 * intentarlo» sobre una vía que la cuarta guarda de `reenviarCorreo` RECHAZA con un 400 —reintentar
 * una vía resuelta reabriría un plazo ya arrancado—.
 *
 * Venía copiado de `03.20-UI-SPEC.md` §5.4, que se escribió ANTES de que el Plan 05 decidiera que
 * `rechazado` resuelve (D-08/D-16). El backend es el correcto y el contrato era el desactualizado:
 * §5.4 queda enmendada con su nota fechada, para que el código no divergir en silencio de un
 * contrato que afirma algo falso — que es exactamente cómo se produjo este defecto.
 *
 * Lo que sí hay que hacer se dice con nombre: la vía corregida es un despacho NUEVO, que nace de
 * corregir la dirección en las formas de notificación, no un reintento de éste.
 */
const avisoRechazado = (correo: string) =>
  `El servicio de correo rechazó ${correo}. La vía queda AGOTADA: el despacho pasa a «rechazado» y consta su razón de imposibilidad en el expediente. Nadie quedó notificado por correo. Si la dirección era incorrecta, corríjala en las formas de notificación: la vía corregida es un despacho NUEVO, no un reintento de éste.`;
/**
 * 🔴 WR-07 (revisión de la Fase 03.20, 2026-09-28) — DECÍA «VUELVA A INTENTARLO» CON EL BOTÓN
 * APAGADO. `ConfirmationDetail` deshabilita su botón de confirmar en cuanto hay mensaje
 * (`disabled={isConfirming || !!message || confirmDisabled}`) y esta pantalla deja el diálogo
 * ABIERTO a propósito en los tres desenlaces que no son el éxito. Así, el secretario leía una
 * instrucción cuyo único control estaba gris, y tenía que ADIVINAR que cancelar y volver a abrir la
 * fila rearma la acción.
 *
 * Se corrige la copy y no el componente: `ConfirmationDetail` lo montan una veintena de pantallas de
 * otras fases, y darle una puerta para dejar el botón vivo con un mensaje presente es un cambio de
 * contrato de un componente compartido — alcance que esta corrección no tiene. La copy dice ahora lo
 * que de verdad hay que hacer, y el desenlace sigue siendo recuperable: el despacho está pendiente.
 */
const avisoNoConfirmable = (correo: string) =>
  `No se pudo confirmar el envío a ${correo}. El intento quedó contado y el despacho sigue pendiente: nadie quedó notificado. Cierre este aviso y vuelva a pulsar «Enviar correo» en unos minutos.`;
const AVISO_SERVICIO_CAIDO =
  "No se pudo contactar con el servicio de correo. El despacho sigue pendiente y no se ha notificado a nadie. Vuelva a intentarlo más tarde.";

/**
 * Cómo se nombra la notificación de una fila en los nombres accesibles y en las fichas de datos.
 *
 * Cae al identificador de la notificación cuando el expediente no viene: un nombre accesible que
 * dijera «del expediente null» es peor que uno que diga cuál es el registro.
 */
const describirNotificacion = (fila: GestorNotificacion): string =>
  fila.expNumber
    ? `del expediente ${fila.expNumber}`
    : `número ${fila.notiId}`;

/**
 * La identidad del administrado, sólo para el encabezado del diálogo de formas.
 *
 * `|| undefined` y no `??`: juntar dos campos vacíos da CADENA VACÍA, no `null`, y una cadena vacía
 * pasaría el `??` del modal y dejaría su encabezado en blanco. Es la misma precaución que la Bandeja
 * de Recepción ya dejó escrita.
 */
const describirAdministrado = (fila: GestorNotificacion): string | undefined =>
  [fila.admiName, fila.admiLastname].filter(Boolean).join(" ") || undefined;

/**
 * EL CUERPO DE LA FILA EXPANDIDA (§2.2 / §2.5.3).
 *
 * 🔴 **LAS TRES TARJETAS SIEMPRE, Y LAS GOBIERNA EL CATÁLOGO, NO EL ARRAY.** Se recorre
 * `ORDEN_FORMAS_NOTIFICACION` —orden fijo, el de la captura— y `despachos[]` sólo decide qué hay
 * DENTRO de cada tarjeta. Medido el 2026-09-25: **156 de 157** administrados no tienen ninguna forma
 * aceptada, así que la tarjeta vacía es el caso NORMAL. Recorrer el array —que es lo que hace el
 * analog de Resolución— daría en esas 156 filas una fila expandida con CERO tarjetas y un vacío
 * genérico que no explica nada y parece una pantalla rota.
 *
 * 🔴 **EL REPARTO LO HACE ESTA PIEZA, NO LA TARJETA.** La tarjeta del Plan 06 es tonta a propósito:
 * recibe los despachos de SU forma. Si filtrara ella, tres tarjetas recorrerían tres veces el mismo
 * array y el criterio de reparto viviría en tres sitios.
 *
 * ⚠️ **COMPONENTE DE MÓDULO, NO UNA FUNCIÓN DENTRO DE LA PÁGINA.** Vive fuera del cuerpo del
 * componente de página para que su identidad sea estable de por vida: dentro, cada render de la
 * página crearía un tipo de componente nuevo y React desmontaría y remontaría el panel entero —y con
 * él las tres tarjetas— en cada pulsación de un filtro.
 *
 * 🔴 **LA REJILLA VA EN UN HIJO Y NO EN EL PANEL**, que es la única diferencia con el marcado de
 * §2.2: el aviso de arriba es hermano de las tarjetas, y con la rejilla en el panel se convertiría en
 * una CUARTA celda de la rejilla —se pintaría a un tercio de ancho, en la primera columna, con las
 * tarjetas desplazadas—. Las tres columnas y el apilado por debajo de 768px son los del contrato:
 * `grid-cols-1 md:grid-cols-3 gap-2` más la clase portada por el Plan 02. La rejilla de DOS columnas
 * del analog no sirve: con tres formas deja una tarjeta huérfana ocupando media fila.
 */
const PanelDespachosDeLaFila = ({
  fila,
  correoEnvioHabilitado,
  onEnviarCorreo,
  onVerFormas,
}: {
  fila: GestorNotificacion;
  correoEnvioHabilitado: boolean;
  onEnviarCorreo: (fila: GestorNotificacion, despacho: DespachoGestor) => void;
  onVerFormas: (fila: GestorNotificacion) => void;
}) => {
  const despachos = fila.despachos ?? [];
  const sinNingunaForma = despachos.length === 0;

  return (
    <div className="app-table-expanded-panel mx-1 my-1 flex flex-col gap-3 rounded-2xl border border-base-300/70 px-4 py-3">
      {/*
        UNA SOLA VEZ Y ARRIBA, y sólo cuando NO hay ningún despacho: con alguna forma declarada la
        frase de la tarjeta vacía ya dice lo suyo, y repetir la explicación general sería ruido.
      */}
      {sinNingunaForma && (
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs leading-snug text-base-content/80">
            {AVISO_SIN_NINGUNA_FORMA}
          </p>
          {/*
            D-21 — EL SALTO, y no sólo la frase. Sin control, en 156 de 157 filas el secretario
            leería la explicación sin nada que pulsar.

            🔴 POR QUÉ NO CONTRADICE D-01: las formas siguen viniendo del Core y cambiándose por acta
            de Secretaría General. Esto no declara nada: lleva AL SITIO donde se ven y se registran,
            que ya existe y que hoy vive en otras dos pantallas. Quien monta el diálogo es la página,
            no este panel — aquí sólo se pide.
          */}
          <Boton
            deshabilitado={false}
            estilos="btn btn-link btn-sm h-auto min-h-0 justify-start p-0 text-xs"
            texto="Ver formas de notificación"
            etiquetaAccesible={`Ver las formas de notificación aceptadas ${describirNotificacion(fila)}`}
            titulo="Ver las formas de notificación aceptadas del administrado"
            onClick={() => onVerFormas(fila)}
          />
        </div>
      )}

      <div className="app-table-expanded-type-grid grid grid-cols-1 gap-2 md:grid-cols-3">
        {ORDEN_FORMAS_NOTIFICACION.map((forma) => (
          <TarjetaFormaNotificacion
            key={forma}
            forma={forma}
            despachos={despachos.filter(
              (despacho) => despacho.forma === forma,
            )}
            // 🔴 `?? undefined`: la fila trae `string | null` y la tarjeta pide `string | undefined`.
            // Un `null` colado ahí pintaría «, expediente null» en hasta 30 nombres accesibles.
            expNumber={fila.expNumber ?? undefined}
            correoEnvioHabilitado={correoEnvioHabilitado}
            // Fase 03.21, D-09: lo decide el servidor por fila; la página solo lo pasa.
            despachoBloqueadoPorFirma={fila.despachoBloqueadoPorFirma}
            onEnviarCorreo={(despacho) => onEnviarCorreo(fila, despacho)}
            onVerFormas={() => onVerFormas(fila)}
          />
        ))}
      </div>
    </div>
  );
};

const GestionNotificacionesPage = () => {
  const { addToast } = useToast();

  /** Detalle del último fallo de carga. `null` = la última lectura respondió. */
  const [falloDeCarga, setFalloDeCarga] = useState<string | null>(null);

  /**
   * 🔴 EL INTERRUPTOR DEL ENVÍO, TAL Y COMO LO MANDA EL SERVIDOR (D-20 / CH-5).
   *
   * Es TRI-ESTADO a propósito: `null` significa «el servidor todavía no lo ha dicho», y no es lo
   * mismo que «está apagado». Sin esa distinción, el aviso permanente de §5.7 asomaría durante la
   * primera carga en un entorno donde el envío SÍ está encendido —un parpadeo que afirma algo falso
   * sobre un procedimiento sancionador— y luego desaparecería.
   *
   * Las dos lecturas se hacen por comparación EXPLÍCITA contra el valor del servidor
   * (`=== false` para el aviso, `=== true` para las tarjetas): ni un valor por defecto, ni un `??`,
   * ni un `||`, ni una comparación con el rol.
   */
  const [correoEnvioHabilitado, setCorreoEnvioHabilitado] = useState<
    boolean | null
  >(null);

  /**
   * La función con la que la tabla vuelve a pedir SIN REMONTARSE. Remontarla perdería los filtros
   * puestos y la página en la que se estaba, así que reintentar tras un fallo de red devolvería al
   * secretario a la primera página sin filtros — castigándole por el fallo.
   *
   * 🔴 EN UNA `ref` Y NO EN ESTADO: nadie la pinta, y en estado entraría en las dependencias de los
   * manejadores, de ahí en las de `columnas`, y de ahí en el efecto de carga de la tabla.
   */
  const recargarRef = useRef<(() => Promise<void>) | null>(null);

  const recibirRecarga = useCallback((refetch: () => Promise<void>) => {
    recargarRef.current = refetch;
  }, []);

  const recargarBandeja = useCallback(async () => {
    await recargarRef.current?.();
  }, []);

  /**
   * EL DESPACHO CUYO REENVÍO SE ESTÁ CONFIRMANDO, con su fila.
   *
   * Se guarda la FILA y no sólo el despacho porque la ficha del diálogo nombra el expediente y el
   * documento, que son de la fila; el `despId` con el que se llama al servicio y el correo y los
   * intentos que se enseñan son del despacho.
   */
  const [reenvio, setReenvio] = useState<{
    fila: GestorNotificacion;
    despacho: DespachoGestor;
  } | null>(null);

  /**
   * El aviso EN LÍNEA del diálogo del reenvío.
   *
   * 🔴 ES EL CONTRATO ESCRITO DE `ConfirmationDetail`: el padre ejecuta, interpreta la respuesta,
   * pone este aviso si hubo error y llama a cerrar **sólo** si hubo éxito. Sacar el fallo por un
   * avisador flotante y cerrar el diálogo dejaría al secretario sin el sitio donde reintentar y con
   * un mensaje que se va solo — sobre una acción que arranca términos.
   */
  const [avisoReenvio, setAvisoReenvio] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);

  /** La fila cuyas formas aceptadas se están mirando (D-21). */
  const [formasDe, setFormasDe] = useState<GestorNotificacion | null>(null);

  const pedirReenvio = useCallback(
    (fila: GestorNotificacion, despacho: DespachoGestor) => {
      // El aviso del intento ANTERIOR no se hereda: `ConfirmationDetail` apaga su botón de confirmar
      // mientras haya mensaje, así que un aviso viejo dejaría el diálogo nuevo nacido inerte.
      setAvisoReenvio(null);
      setReenvio({ fila, despacho });
    },
    [],
  );

  const cerrarReenvio = useCallback(() => {
    setReenvio(null);
    setAvisoReenvio(null);
  }, []);

  /**
   * LOS CUATRO DESENLACES DEL REENVÍO (§5.4).
   *
   * 🔴 SON CUATRO Y NO TRES, y el cuarto NO llega por el valor de retorno: en el camino manual un
   * transporte caído responde con error HTTP, así que la promesa **se rechaza**. Quien sólo mirase
   * `resultado` se quedaría sin enterarse del caso en el que con más razón hay que decir que nadie
   * quedó notificado.
   *
   * 🔴 NO PROPAGA NADA. Si esta función lanzara, `ConfirmationDetail` lo atraparía y lo volcaría a la
   * CONSOLA del navegador —donde no lo ve el secretario y sí pasaría el detalle del fallo—, y el
   * diálogo se quedaría abierto sin decir nada.
   *
   * 🔴 SÓLO EL ÉXITO CIERRA. Los otros tres dejan el diálogo abierto con su aviso, porque es el
   * aviso lo que hay que leer.
   *
   * 🔴 RECARGAN DOS, NO UNO (CR-05). El aceptado y el RECHAZADO, porque los dos **resuelven** el
   * despacho: `rechazado` escribe `desp_resuelto_at`, emite su razón de imposibilidad y el anillo lo
   * cuenta como resuelto (D-16). Sin recargar, la tarjeta seguía diciendo «Pendiente» sobre una vía
   * agotada. Los otros dos no recargan porque de verdad nada cambió de sitio: el despacho sigue
   * pendiente y solo subió su contador —que el propio aviso nombra—. Recargar borra la fila, no el
   * aviso: son estados distintos.
   */
  const confirmarReenvio = useCallback(async () => {
    if (!reenvio) {
      return;
    }

    try {
      const resultado = await NotificacionEjecucionService.reenviarCorreo(
        reenvio.despacho.despId,
      );

      if (resultado.resultado === "notificado") {
        addToast("success", avisoAceptado(resultado.correo));
        setReenvio(null);
        setAvisoReenvio(null);
        // Con la función de recarga de la tabla, NO remontando: remontar perdería los filtros
        // puestos y la página en la que se estaba.
        await recargarBandeja();
        return;
      }

      if (resultado.resultado === "rechazado") {
        setAvisoReenvio({
          variant: "error",
          message: avisoRechazado(resultado.correo),
        });
        // 🔴 CR-05 — AQUÍ SÍ SE RECARGA, y el diálogo se queda abierto con su aviso. El despacho
        // quedó RESUELTO: su chip pasa a «Rechazado», su fecha de resolución aparece y el anillo
        // cuenta la vía como resuelta (D-16). Sin esta recarga la tarjeta seguía diciendo
        // «Pendiente» mientras la base decía que la vía estaba agotada, y el Gestor existe
        // precisamente para decir la verdad sobre la notificación.
        await recargarBandeja();
        return;
      }

      setAvisoReenvio({
        variant: "warning",
        message: avisoNoConfirmable(resultado.correo),
      });
    } catch {
      // El motivo técnico NO se pinta ni se vuelca: aquí el secretario necesita saber que nadie
      // quedó notificado y qué hacer, y el detalle de un `ECONNREFUSED` no le dice ninguna de las
      // dos. Del volcado a consola, además, colgaría la fila entera (T-03.20-36).
      setAvisoReenvio({ variant: "error", message: AVISO_SERVICIO_CAIDO });
    }
  }, [addToast, recargarBandeja, reenvio]);

  const verFormas = useCallback((fila: GestorNotificacion) => {
    setFormasDe(fila);
  }, []);

  /**
   * La lectura del listado. 🔴 MEMOIZADA CON DEPENDENCIAS VACÍAS: entra en el efecto de carga de la
   * tabla y una identidad nueva por render sería un bucle de peticiones.
   *
   * 🔴 NO PROPAGA EL FALLO: lo convierte en bandera de estado y devuelve una página vacía. Es lo que
   * permite distinguir «no hay notificaciones» de «no me respondieron» sin tocar `Table.tsx`, que no
   * tiene estado de error y cuyo `.then()` simplemente no corre cuando la promesa rechaza.
   */
  const buscarNotificaciones = useCallback(
    async (
      params: PaginationAndFilters,
    ): Promise<{ data: GestorNotificacion[]; total: number }> => {
      try {
        const sobre = await NotificacionEjecucionService.gestor({
          pageIndex: params.pageIndex,
          pageSize: params.pageSize,
          filterParams: params.filterParams,
        });

        setFalloDeCarga(null);
        // El interruptor baja del sobre al estado de la página, y de ahí al aviso y a las tarjetas.
        setCorreoEnvioHabilitado(sobre.correoEnvioHabilitado);

        return { data: sobre.data, total: sobre.total };
      } catch (err) {
        // El detalle del servidor se guarda para enseñarlo COMO DETALLE, debajo del encabezado. No
        // se manda a la consola: por ese canal pasaría la fila entera (T-03.20-36).
        setFalloDeCarga(
          mensajeParaUsuario(err, "El servidor no dio un motivo."),
        );
        return { data: [], total: 0 };
      }
    },
    [],
  );

  /**
   * LAS NUEVE COLUMNAS QUE DECLARA LA PÁGINA (§1.2). `Table.tsx` antepone dos por su cuenta —la de
   * expansión y la de numeración—, así que se pintan ONCE.
   *
   * 🔴 `Nro.` NO SE DECLARA AQUÍ. La antepone `numberColumn` de `Table.tsx`, que además calcula el
   * índice global con el desplazamiento de página; declararla pintaría dos cabeceras iguales.
   *
   * 🔴 EL ORDEN ES EL DE LA CAPTURA, LITERAL, y no se reordena.
   *
   * 🔴 LOS `id` SON LOS NOMBRES DE PARÁMETRO DEL BACKEND. `serializeColumnFilters` emite el `id` de
   * la columna como clave del filtro y `FiltroGestorDto` es una allowlist bajo
   * `forbidNonWhitelisted`: una letra distinta es un 400 que **no dice qué clave falló**. Por eso la
   * columna de la fecha se llama `notiEmitidaAt` —de donde salen `notiEmitidaAtFrom` y
   * `notiEmitidaAtTo`— aunque el campo de la fila se llame `emitidaAt`.
   *
   * ⚠️ EL PRESUPUESTO DE ANCHO SON ~1290px Y NO ES DECORATIVO: es lo que hace que las once columnas
   * quepan sin desplazamiento horizontal a 1440px de ventana con la barra lateral. Si alguien sube
   * un ancho, tiene que bajar otro.
   *
   * ── 🔴 NINGUNA COLUMNA DECLARA FIJACIÓN, Y NO ES UNA OMISIÓN (§1.7) ──────────────────────────
   * La bandeja de la Fase 03.22 fija la numeración y el expediente a la izquierda, y la tentación de
   * «hacerlo como la otra bandeja» es inmediata. No se hace, porque el mecanismo de fijación a la
   * izquierda de `Table.tsx` es CIEGO a la columna de expansión: su ayudante tiene rama para la
   * columna de la derecha, para la de numeración y para la declarada por la página, y **ninguna para
   * la de expansión**, que va delante de todas. Declarar fijación pegaría la numeración al borde y
   * dejaría el disparador de la fila DESPLAZÁNDOSE por debajo de ella: el control con el que se abre
   * la fila sería el primero en perderse. Es un defecto HEREDADO de la 03.22 —ninguna pantalla del
   * módulo había usado la expansión hasta hoy—, no una regresión de esta fase, y queda anotado en el
   * registro de diferidos.
   *
   * ── 🔴 D-22 — EL AZUL Y EL MARINO DE LA CAPTURA SE RETIRAN ───────────────────────────────────
   * El analog pinta `Justificación` con el color de acento y `Especificación` con el de semántica, y
   * es lo que se ve en la captura. Se retira, por dos defectos medidos:
   *   1. Rompe la reserva del acento: el acento es el 10 %, y una columna entera en las diez filas
   *      de la página deja de señalar nada.
   *   2. 🔴 MIENTE SOBRE LA AFORDANCIA. Azul y semifuerte en una tabla ES un enlace, y aquí no
   *      navega, no abre nada y no pasa nada al pulsarlo. La prueba de que miente es que el propio
   *      documento de planificación de este proyecto lo leyó como enlace.
   * Se conserva el PESO relativo que la captura da a la primera de las dos, que es lo único que
   * hacía falta para ordenarlas, y está dentro de los dos pesos que el sistema declara.
   *
   * ⚠️ El rótulo del panel tampoco lleva la utilidad del color de acento que sí escribe la bandeja
   * del decisor, y es un no-op medido: `panels-theme.css` fija el color de `.app-section-heading`
   * con `!important` en los DOS temas, así que esa utilidad no se aplica nunca. Omitirla no cambia
   * un píxel y deja la reserva del acento en cero para todo el archivo.
   */
  const columnas = useMemo<ColumnDef<GestorNotificacion>[]>(
    () => [
      {
        id: "progreso",
        header: "Progreso",
        size: 100,
        // NO ES FILTRABLE: es derivada en el cliente a partir de los despachos. Declararla
        // obligaría al servidor a una subconsulta agregada y el secretario filtraría por algo que
        // nadie calcula. Precedente exacto en este repo: la columna de plazo de «Mis Expedientes».
        enableColumnFilter: false,
        cell: (info) => (
          <CeldaProgreso despachos={info.row.original.despachos} />
        ),
      },
      {
        id: "justificacion",
        header: "Justificación",
        size: 130,
        accessorFn: (fila) => fila.justificacion ?? "",
        // Peso fuerte y SIN color. Ver D-22 en el memo de arriba.
        cell: (info) => (
          <span className="font-bold">
            {info.row.original.justificacion ?? "—"}
          </span>
        ),
      },
      {
        // Filtro de TEXTO y no catálogo, aunque su origen tenga 33 filas: el valor sale de una caída
        // entre dos orígenes —el catálogo de providencias y el subtipo del documento— y un
        // desplegable cerrado esconderÍa SIN AVISAR las filas que caen por esa caída. Es el mismo
        // razonamiento con el que el catálogo se le negó a la columna de zonal: un filtro que miente
        // es peor que un filtro tosco.
        id: "especificacion",
        header: "Especificación",
        size: 190,
        accessorFn: (fila) => fila.especificacion ?? "",
        // Sin clase: es el detalle de la anterior, y el peso de aquélla ya las ordena.
        cell: (info) => info.row.original.especificacion ?? "—",
      },
      {
        id: "expNumber",
        header: "Expediente",
        size: 110,
        accessorFn: (fila) => fila.expNumber ?? "",
        cell: (info) => (
          <span className="font-mono whitespace-nowrap">
            {info.row.original.expNumber ?? "—"}
          </span>
        ),
      },
      {
        id: "eejeStatus",
        header: "Estatus",
        size: 150,
        // El único filtro de catálogo de la pantalla. 🔴 La clave YA EXISTE y su `Record` es total:
        // cero trabajo, y el valor que viaja es el del enum del backend.
        meta: {
          filterType: "catalog",
          catalogKey: "eejeStatus",
          filterParamKey: "eejeStatus",
        },
        accessorFn: (fila) => fila.eejeStatus ?? "",
        cell: (info) => (
          <BadgePriority
            text={etiquetaEstadoEpas(info.row.original.eejeStatus)}
            // 🔴 EL VALOR CRUDO, EN MAYÚSCULAS: el mapa de chips lleva los quince estados con sus
            // guiones bajos. En minúsculas caerían todos al chip por defecto.
            priority={info.row.original.eejeStatus ?? ""}
            // 🔴 OBLIGATORIO: varias etiquetas son frases («En verificación de pago») y con el
            // `capitalize` por defecto el CSS las rompe en «En Verificación De Pago».
            capitalize={false}
          />
        ),
      },
      {
        id: "admiIdentification",
        header: "CI/RUC",
        size: 120,
        accessorFn: (fila) => fila.admiIdentification ?? "",
        cell: (info) => info.row.original.admiIdentification ?? "—",
      },
      {
        id: "admiName",
        header: "Nombres",
        size: 130,
        accessorFn: (fila) => fila.admiName ?? "",
        cell: (info) => info.row.original.admiName ?? "—",
      },
      {
        id: "admiLastname",
        header: "Apellidos",
        size: 130,
        accessorFn: (fila) => fila.admiLastname ?? "",
        cell: (info) => info.row.original.admiLastname ?? "—",
      },
      {
        // ⚠️ El `id` es el del BACKEND (`notiEmitidaAt`), no el del campo de la fila (`emitidaAt`):
        // de él salen las dos claves del rango, y son exactamente las dos que el DTO declara.
        id: "notiEmitidaAt",
        header: "Fecha creación",
        size: 130,
        meta: { filterType: "dateRange" },
        accessorFn: (fila) => fila.emitidaAt ?? "",
        // El formato DENSO de la columna, no la fecha corta de la tarjeta. Los dos conviven porque
        // los dos están en la captura: la columna se escanea en vertical, la tarjeta es prosa.
        cell: (info) =>
          info.row.original.emitidaAt
            ? DatetimeUtil.formatDate(info.row.original.emitidaAt)
            : "—",
      },
    ],
    [],
  );

  /**
   * EL CUERPO DE LA FILA EXPANDIDA. Sólo monta el panel de módulo: el JSX vive fuera para que su
   * identidad de componente no cambie nunca (ver el memo de `PanelDespachosDeLaFila`).
   *
   * ⚠️ NO entra en el efecto de carga de `Table.tsx` —sus dependencias son `findRecordsFn` y
   * `columns`—, así que un cambio del interruptor del envío repinta las tarjetas sin volver a pedir.
   * Va memoizada igualmente: es lo que evita repintar el panel abierto en cada tecla de un filtro.
   */
  const renderExpandedRow = useCallback(
    (fila: GestorNotificacion) => (
      <PanelDespachosDeLaFila
        fila={fila}
        // 🔴 COMPARACIÓN EXPLÍCITA CONTRA `true`: con `null` —el servidor todavía no lo ha dicho— el
        // botón de correo nace APAGADO. Un `??` o un `||` aquí ofrecería mandar una notificación
        // jurídica en un entorno donde el envío está apagado.
        correoEnvioHabilitado={correoEnvioHabilitado === true}
        onEnviarCorreo={pedirReenvio}
        onVerFormas={verFormas}
      />
    ),
    [correoEnvioHabilitado, pedirReenvio, verFormas],
  );

  /**
   * EL NOMBRE ACCESIBLE DEL DISPARADOR DE LA FILA (§2.1).
   *
   * 🔴 Sin esto el botón se anuncia literalmente «botón», DIEZ VECES POR PÁGINA: es el mismo defecto
   * que la Fase 03.19 arregló en la columna ACCIONES, y la razón de que la prop exista. La tabla no
   * conoce el dominio; la página sí, así que es ella la que nombra el expediente. Y el texto CAMBIA
   * al abrir: un nombre fijo diría «Ver» sobre un control que ya está abierto.
   */
  const etiquetaFilaExpandible = useCallback(
    (fila: GestorNotificacion, expandida: boolean) =>
      `${expandida ? "Ocultar" : "Ver"} despachos de la notificación ${describirNotificacion(fila)}`,
    [],
  );

  const hayFallo = falloDeCarga !== null;

  return (
    <div className="app-data-container">
      <HeaderPage
        // El kicker NO es decorativo: es la ruta del menú lateral, y el menú lo siembra la base. Se
        // escribe CON TILDES: la falta de tildes en la siembra es un defecto del dato, no un estilo
        // que propagar.
        headerKicker="Seguimiento y Control / Gestión de Notificaciones"
        title="Gestión de Notificaciones"
        subtitle="Revisa las notificaciones registradas en el sistema"
      />

      {/*
        🔴 EL RÓTULO DEL PANEL USA EL ESTILO DEL MÓDULO, NO LA FRANJA AZUL MARINO DE LA CAPTURA, y es
        la ÚNICA diferencia de cascarón con ella. Esa franja aquí es `app-section-header` +
        `app-section-heading`, que VEINTICINCO pantallas comparten y que `panels-theme.css` viste por
        tema: repintarla sólo aquí crearía un segundo estilo de panel dentro del mismo módulo. Es lo
        que el contrato de la Fase 03.19 ya decidió para todas las bandejas.

        ⚠️ Y el distintivo naranja del rol que se ve en la esquina de la captura es del CASCARÓN de la
        aplicación (Fase 03.7), no de esta pantalla: aquí no se pinta.
      */}
      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em]">
            Notificaciones
          </h2>
        </div>

        <div className="app-data-panel-body relative px-2 pb-4 pt-2 md:px-4">
          {hayFallo && (
            <div className="mb-3 flex flex-col items-start gap-2">
              <Alert
                variant="error"
                message={`${ERROR_DE_CARGA_ENCABEZADO} ${ERROR_DE_CARGA_PISTA}`}
              />
              <p className="text-xs text-base-content/70">
                Detalle del servidor: {falloDeCarga}
              </p>
              {/*
                El único botón sólido de la pantalla, y sólo existe en el estado de fallo: es la
                única acción disponible en ese momento, así que ocupa exactamente el hueco que la
                reserva del acento concede («un solo botón primario sólido por pantalla»). El bloque
                entero se copia del de la bandeja del decisor, como manda §1.8.
              */}
              <Boton
                estilos="btn btn-sm btn-primary"
                texto="Reintentar"
                deshabilitado={false}
                onClick={() => void recargarBandeja()}
              />
            </div>
          )}

          {/*
            🔴 EL AVISO DEL ENVÍO APAGADO, UNA VEZ POR PÁGINA (§5.7). La comparación es EXPLÍCITA
            contra `false`: con `null` —el servidor todavía no ha respondido— no se afirma nada.
          */}
          {correoEnvioHabilitado === false && (
            <div className="mb-3">
              <Alert variant="warning" message={AVISO_ENVIO_APAGADO} />
            </div>
          )}

          {/*
            🔴 LA TABLA SE OCULTA, NO SE DESMONTA, MIENTRAS HAY FALLO. Desmontarla perdería los
            filtros y la página, así que «Reintentar» volvería a la página 1 sin filtros. Oculta,
            sigue viva y reintentar vuelve a pedir EXACTAMENTE lo mismo. Y se oculta con el atributo
            `hidden` y no con una clase: `hidden` sale del árbol de accesibilidad, así que el lector
            de pantalla tampoco oye «No hay notificaciones registradas» encima del aviso de fallo.
          */}
          <div hidden={hayFallo}>
            <Table<GestorNotificacion>
              styles={ESTILOS_TABLA}
              dataT={[]}
              columns={columnas}
              findRecordsFn={buscarNotificaciones}
              resolveActionsPerRow={SIN_RESOLVER_DE_FILA}
              tableOptions={SIN_ACCIONES_DE_TABLA}
              hideActionsColumn
              isExpandible
              renderExpandedRow={renderExpandedRow}
              etiquetaFilaExpandible={etiquetaFilaExpandible}
              onRefetchReady={recibirRecarga}
              vacioSinFiltros={VACIO_SIN_FILTROS}
              vacioConFiltros={VACIO_CON_FILTROS}
            />
          </div>
        </div>
      </section>

      {/*
        🔴 LA CONFIRMACIÓN DEL REENVÍO (§3, T-03.20-35). Es la ÚNICA acción con consecuencia de esta
        fase: si el envío se acepta, el despacho pasa a notificado, se emite la razón de envío y
        `noti_perfeccionada_at` ARRANCA LOS TÉRMINOS. Por eso la consecuencia se dice ANTES, en la
        descripción, y por eso es el diálogo del módulo y no una ventana del navegador —que no se
        puede vestir, no se puede leer con lector de pantalla y no admite la ficha de datos con la
        que el secretario comprueba que va a mandar lo que cree—.
      */}
      {reenvio && (
        /*
          🔴 `open` ADEMÁS DE `modal-open`, y NO es redundante. daisyUI 5 viste `&[open]` con
          EXACTAMENTE las mismas reglas que `&.modal-open` (`components/modal.css`), así que no
          cambia un píxel; lo que cambia es el árbol de ACCESIBILIDAD. Un `<dialog>` sin `open` es
          `display: none` por la hoja del navegador, y aunque la clase de daisyUI lo vuelva visible,
          `FormasNotificacionModal.test.tsx` dejó medido que en jsdom el contenido queda FUERA del
          árbol de accesibilidad y ninguna consulta por rol lo encuentra — y esa medición es la
          señal: lo que no se puede nombrar por su rol en la prueba es lo que un lector de pantalla
          tampoco tiene garantizado. En el diálogo que arranca términos jurídicos se paga el atributo
          en vez de relajar la prueba con `hidden: true`.
        */
        <DialogoModal
          open
          className="modal modal-open"
          onCerrar={cerrarReenvio}
        >
          <ConfirmationDetail
            headerKicker="Gestión de Notificaciones"
            headerTitle="Reenviar la notificación por correo"
            statusCopy={REENVIO_ESTADO}
            descriptionCopy={REENVIO_DESCRIPCION}
            informationData={{
              Expediente: reenvio.fila.expNumber ?? `EPAS #${reenvio.fila.eejeId}`,
              Documento: reenvio.fila.docName ?? "Sin nombre de documento",
              // La dirección CONGELADA en el despacho, que es a la que se va a intentar. No se
              // busca otra: el despacho guarda la que había cuando se abrió.
              Correo: reenvio.despacho.correo ?? "Sin dirección registrada",
              Intentos: reenvio.despacho.intentos,
            }}
            message={avisoReenvio ?? undefined}
            cancelButtonText="Cancelar"
            confirmButtonText="Sí, reenviar"
            confirmButtonLoadingText="Reenviando…"
            onConfirm={confirmarReenvio}
            onClose={cerrarReenvio}
          />
        </DialogoModal>
      )}

      {/*
        D-21 — LA PANTALLA DE FORMAS ACEPTADAS, QUE YA EXISTE. Se monta aquí, en la página, y no en la
        tarjeta: la tarjeta es tonta a propósito y no conoce ningún diálogo, así que se puede montar
        en prueba con todas sus combinaciones sin tocar la red.

        🔴 Y NO CONTRADICE D-01: las formas siguen viniendo del Core y cambiándose por acta de
        Secretaría General. Esto sólo lleva al sitio donde se ven y se registran, que hoy vive en la
        Bandeja de Recepción y en el paso 3 de la generación. Sin el salto, en 156 de 157 filas el
        secretario leería la explicación del hueco sin ningún control para actuar.
      */}
      {formasDe && (
        <FormasNotificacionModal
          caso={{
            eejeId: formasDe.eejeId,
            // `?? undefined` porque la fila trae `string | null` y el tipo mínimo del diálogo pide
            // `string | undefined`; con `null` su encabezado caería al «EPAS n.º».
            expNumber: formasDe.expNumber ?? undefined,
            administrado: describirAdministrado(formasDe),
          }}
          onClose={() => setFormasDe(null)}
          // 🔴 AQUÍ SÍ SE RECARGA —y la Bandeja de Recepción no lo hace—, porque declarar una forma
          // ABRE DESPACHOS: cambia el array de la fila, y con él las tres tarjetas, el anillo de la
          // columna PROGRESO y el botón de correo. Sin recargar, el secretario declararía la forma y
          // vería la misma fila vacía que le hizo entrar.
          onGuardado={() => void recargarBandeja()}
        />
      )}
    </div>
  );
};

export default GestionNotificacionesPage;
