/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend)
 * Feature: El catálogo de las 12 entradas del `⋮` del EPAS (Fase 03.19, Plan 11 — D-05, D-11, D-12)
 * Archivo: accionesDelEpas.ts
 * Responsabilidad: Declarar, en un solo sitio y como DATO, qué entradas ofrece el submenú de la
 *   bandeja del decisor, en qué orden, en qué grupo y con qué icono; y convertir el veredicto del
 *   motor sobre cada una en la opción de menú que la pantalla pinta.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LAS TRES COSAS QUE ESTE ARCHIVO PROTEGE. Están escritas aquí porque son las tres que se
 * pierden en cuanto alguien añade un `if` «solo para este caso».
 *
 * 1. EL RESOLVER NO RAZONA. `accionesDeLaFila` no mira la fila para deducir si una acción procede:
 *    pasa cada entrada por `aplicarVeredicto` y devuelve LO QUE EL MOTOR DIGA. Si hiciera falta
 *    una condición nueva, su sitio es `POLITICA_ACCIONES` —donde se puede auditar y donde una
 *    prueba la recorre—, no esta función. La única excepción es monótona y está declarada abajo:
 *    la falta de expediente puede APAGAR una entrada, nunca encenderla.
 *
 * 2. UNA ACCIÓN QUE NO PROCEDE SE APAGA CON SU MOTIVO; NUNCA SE OCULTA. Es D-7, heredado sin
 *    renegociar: «el decisor tiene que saber que un paso existe aunque todavía no le toque». Las
 *    doce entradas salen siempre las doce; lo que cambia es cuáles se pueden pulsar.
 *
 * 3. EL MOTIVO VIENE DE FUERA. Lo redacta el catálogo del motor (`MOTIVOS_ACCION`), no esta
 *    pantalla y no el componente del menú. Escribirlo aquí crearía una segunda fuente de verdad
 *    para la misma regla, y el día que discrepara sería la interfaz —la que no sabe nada— la que
 *    estaría explicando el procedimiento.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 POR QUÉ EL CATÁLOGO ES UNA CONSTANTE DE MÓDULO Y NO SE CONSTRUYE POR FILA. Porque las
 * acciones que el motor recibe se COMPARTEN entre filas de la misma tabla, y el motor tiene
 * prohibido mutarlas por eso mismo: apagar una in situ contaminaría filas distintas y el síntoma
 * —un botón apagado en la fila equivocada— no apuntaría nunca a su causa.
 *
 * 🔴 Y POR QUÉ NO IMPORTA NINGÚN MODAL. Las entradas que abren un formulario reciben su disparador
 * POR PARÁMETRO. Así este archivo se puede probar sin montar una página de mil líneas, que es la
 * diferencia entre una prueba que alguien ejecuta al cambiar una regla y una que nadie ejecuta.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */

import type { AccionCaso } from "../components/common/MenuAccionesCaso";
import type { ModalType } from "../interfaces/IModal";
import type { UserActions } from "../interfaces/IUser";
import type { MiEpasAsignado } from "../services/SorteoService";
import { hechosDeObligacionHacer, hechosDelEpas } from "./accionesHechos";
import {
  aplicarVeredicto,
  type ContextoAccion,
  type InboxActionName,
} from "./inboxActionStatusRules";
import { RUTA_GENERAR_DOCUMENTO } from "./rutasGeneracionDocumento";
import { RUTA_OBLIGACION_HACER } from "./rutasObligacionHacer";

/**
 * Los cuatro rótulos de sección del submenú, EN SU ORDEN. El menú emite uno cada vez que cambia de
 * grupo, así que las entradas de un mismo grupo tienen que ir consecutivas: si se separaran, el
 * rótulo se repetiría, que es la señal visible de que el orden está mal.
 */
export const GRUPOS_DEL_EPAS = [
  "Hacerse cargo",
  "El documento",
  "Actos sobre el EPAS",
  "Salidas",
] as const;

/** Un rótulo de sección del submenú. Union CERRADO: un grupo inventado no compila. */
export type GrupoDelEpas = (typeof GRUPOS_DEL_EPAS)[number];

/**
 * Una entrada del catálogo.
 *
 * 🔴 `icono` Y `grupo` SON OBLIGATORIOS, y ahí está la mitad de la totalidad de este archivo. En
 * `AccionCaso` los dos son opcionales —el menú tolera una entrada sin icono y sin sección—, y esa
 * tolerancia es correcta para un componente compartido y ruinosa para este catálogo: una entrada
 * sin grupo se pintaría bajo el rótulo de la anterior, diciendo que es algo que no es. Aquí el
 * compilador los exige, así que la entrada número trece no puede nacer a medias.
 */
type EntradaDelEpas = {
  /** Identificador estable de la ENTRADA. Es la `key` del menú y el nombre en las pruebas. */
  id: string;
  label: string;
  /** Nombre del `iconoMap`. Obligatorio: ver arriba. */
  icono: string;
  /** Rótulo de la sección. Obligatorio: ver arriba. */
  grupo: GrupoDelEpas;
  /**
   * El nombre con el que el MOTOR conoce esta acción. No siempre coincide con `id`: el submenú
   * nombra las entradas como las lee el funcionario —«pago», «acogimiento»— y el motor las nombra
   * como el acto del procedimiento —`registrarPago`, `registrarAcogimiento`—.
   */
  accion: InboxActionName;
  /** Clase de daisyUI para los actos que hay que mirar dos veces. */
  tono?: string;
  /**
   * Construye la ruta cuando la entrada NAVEGA en vez de actuar. Su presencia es lo que distingue
   * una entrada-enlace de una entrada-acto: las que la tienen no reciben disparador.
   */
  navega?: (eejeId: number) => string;
  /**
   * El motivo con el que la entrada se apaga cuando la fila no trae expediente resuelto. **Su
   * presencia ES la exigencia**: una entrada sin este campo no necesita expediente, y así no cabe
   * la combinación inválida de exigirlo sin decir por qué.
   *
   * 🔴 ES EL ÚNICO MOTIVO QUE REDACTA ESTE ARCHIVO, y es deliberado: el motor no puede darlo. Su
   * contexto son el rol, el estado y los hechos derivados; «esta fila no trae identificador de
   * expediente» no es un hecho del procedimiento, es una carencia de la RESPUESTA. Decirlo aquí es
   * decirlo donde se sabe.
   */
  exigeExpediente?: string;
};

/**
 * EL CATÁLOGO: las doce entradas, en el orden y los cuatro grupos del contrato de interfaz.
 *
 * ── EL ORDEN, RAZONADO ───────────────────────────────────────────────────────────────────────
 * · «Aceptar» y «Excusarme» PRIMERO. Son la decisión que esta bandeja existe para pedir, y
 *   mientras no se toman casi todo lo demás está apagado: ponerlas arriba hace que la primera cosa
 *   que el decisor lee sea la única que puede hacer.
 * · «Adjuntar documento» ANTES que «Generar documento», que es el orden literal de la captura del
 *   área usuaria — la única evidencia que dio sobre el orden del menú, y se respeta.
 * · «Obligación de hacer» dentro del grupo de actos, sin moverla ni re-gatearla.
 * · «Coactiva» la última, en ámbar. Es la escalada: se busca a propósito, no se tropieza con ella.
 *
 * 🔴 «FORMAS DE NOTIFICACIÓN» NO ESTÁ (D-05). Su sitio es el paso 3 de la página de generación, y
 * retirarla de aquí no contradice la regla del motor: esa regla ya decía que es acto del
 * SECRETARIO y en la recepción. Lo que esta ausencia hace es ALINEAR la pantalla con la regla.
 *
 * 🔴 «EMITIR PROVIDENCIA» SE LLAMA AHORA «GENERAR DOCUMENTO» (D-12) y NAVEGA, con la ruta del
 * literal único. Navega como ENLACE y no con un hook de navegación a propósito: la bandeja arrastra
 * deuda de reglas de hooks por un retorno anticipado situado encima de los suyos, y cada hook nuevo
 * suma un error de lint. Además, un enlace de verdad se puede abrir en otra pestaña.
 *
 * ⚠️ «CONSTANCIA DE PAGO» NO SE VUELVE A RENOMBRAR. El pedido del área usuaria cambió la etiqueta,
 * no el paso: la actividad del procedimiento normativo sigue llamándose «verificar pago», y
 * cambiarla más rompe la trazabilidad contra la norma aprobada.
 */
export const ACCIONES_DEL_EPAS = [
  // ── Hacerse cargo ──────────────────────────────────────────────────────────────────────────
  {
    id: "aceptarCaso",
    label: "Aceptar",
    icono: "aceptar",
    grupo: "Hacerse cargo",
    accion: "aceptarCaso",
  },
  {
    id: "excusarme",
    label: "Excusarme",
    icono: "excusarme",
    grupo: "Hacerse cargo",
    accion: "excusarme",
  },
  // ── El documento ───────────────────────────────────────────────────────────────────────────
  {
    id: "adjuntarDocumento",
    label: "Adjuntar documento",
    icono: "adjuntar",
    grupo: "El documento",
    accion: "adjuntarDocumento",
    exigeExpediente:
      "Este caso todavía no tiene un expediente resuelto: no hay expediente al que anexar el documento.",
  },
  {
    id: "generarDocumento",
    label: "Generar documento",
    icono: "providencia",
    grupo: "El documento",
    accion: "generarDocumento",
    navega: RUTA_GENERAR_DOCUMENTO,
    exigeExpediente:
      "Este caso todavía no tiene un expediente resuelto: no hay expediente sobre el que generar un documento.",
  },
  // ── Actos sobre el EPAS ────────────────────────────────────────────────────────────────────
  {
    id: "pago",
    label: "Constancia de pago",
    icono: "pago",
    grupo: "Actos sobre el EPAS",
    accion: "registrarPago",
  },
  {
    id: "acogimiento",
    label: "Respuesta a trabajo comunitario",
    icono: "acogimiento",
    grupo: "Actos sobre el EPAS",
    accion: "registrarAcogimiento",
  },
  {
    id: "trabajoComunitario",
    label: "Registrar cumplimiento",
    icono: "cumplimiento",
    grupo: "Actos sobre el EPAS",
    accion: "registrarCumplimiento",
  },
  {
    id: "prorroga",
    label: "Solicitud de prórroga",
    icono: "reloj",
    grupo: "Actos sobre el EPAS",
    accion: "solicitarProrroga",
  },
  // 🔴 LA ENTRADA AL CORRECTIVO, TRASLADADA TAL CUAL —regla, ruta, exigencia de expediente y sus
  // DOS motivos—. Su comentario original documenta un fallo ya ocurrido (CR-01): la puerta
  // reutilizaba la regla de un ACTO, que exige que el correctivo ya exista, mientras que la única
  // acción capaz de declararlo exige lo contrario y solo se pinta detrás de la puerta. Las dos
  // reglas, cada una correcta, se cerraban en círculo y la rama no se podía abrir por ninguna vía
  // de interfaz. `verObligacionHacer` existe porque «¿puedo entrar a LEER?» no es «¿procede
  // registrar un acto?». Re-gatearla aquí repetiría el fallo.
  {
    id: "obligacionHacer",
    label: "Obligación de hacer",
    icono: "obligacionHacer",
    grupo: "Actos sobre el EPAS",
    accion: "verObligacionHacer",
    navega: RUTA_OBLIGACION_HACER,
    exigeExpediente:
      "Este caso todavía no tiene un expediente resuelto: no hay correctivo que abrir.",
  },
  // ⚠️ El componente de impugnación NO es una acción: es un FORMULARIO con estado propio y varios
  // controles, así que no cabe en una opción del menú y meterlo dentro rompería el portal. Esta
  // entrada solo ABRE la pestaña; lo que se pueda hacer dentro lo decide el formulario.
  {
    id: "impugnacion",
    label: "Recursos",
    icono: "impugnacion",
    grupo: "Actos sobre el EPAS",
    accion: "accionesImpugnacion",
    exigeExpediente:
      "Este caso todavía no tiene un expediente resuelto: no hay recurso que gestionar.",
  },
  // ── Salidas ────────────────────────────────────────────────────────────────────────────────
  {
    id: "descargarExpediente",
    label: "Descargar expediente (PDF)",
    icono: "descargar",
    grupo: "Salidas",
    accion: "descargarExpediente",
    exigeExpediente:
      "Este caso todavía no tiene un expediente resuelto: no hay expediente que descargar.",
  },
  {
    id: "coactiva",
    label: "Coactiva",
    icono: "coactiva",
    grupo: "Salidas",
    accion: "gestionarCoactiva",
    // En ámbar: la coactiva la llevan las Administraciones Zonales y marcar su inicio cierra la
    // puerta al trabajo comunitario.
    tono: "text-warning",
  },
] as const satisfies readonly EntradaDelEpas[];

/** El identificador de una de las doce entradas. Union CERRADO, derivado del propio catálogo. */
export type IdAccionEpas = (typeof ACCIONES_DEL_EPAS)[number]["id"];

/**
 * Las entradas que NAVEGAN: son enlaces y por eso no reciben disparador.
 *
 * Se DERIVA del propio catálogo —qué entradas declaran `navega`— y no se escribe a mano: una lista
 * escrita a mano se desincroniza el día en que alguien convierta un acto en un enlace, y el síntoma
 * sería una opción que pide un disparador que nadie va a usar.
 */
type IdQueNavega = Extract<
  (typeof ACCIONES_DEL_EPAS)[number],
  { navega: unknown }
>["id"];

/** Las diez entradas que ACTÚAN: abren un formulario o lanzan un acto. */
export type IdQueActua = Exclude<IdAccionEpas, IdQueNavega>;

/**
 * Lo que la pantalla tiene que entregar para que el submenú actúe: un disparador por cada entrada
 * que no navega.
 *
 * 🔴 ES UN `Record` TOTAL, Y ÉSA ES LA OTRA MITAD DE LA TOTALIDAD DE ESTE ARCHIVO. Una entrada
 * nueva que actúe obliga a la pantalla a declarar qué hace, y el compilador lo cobra. Sin esto, el
 * modo de fallo sería una opción que se pinta, se puede pulsar y no hace nada — el peor de todos,
 * porque no se distingue de un fallo del servidor.
 */
export type DisparadoresDelEpas = Record<
  IdQueActua,
  (row: MiEpasAsignado) => void
>;

/**
 * 🔴 LA TOTALIDAD, IMPUESTA POR EL COMPILADOR. Si el union de identificadores y el array se
 * separaran —porque alguien añadiera un id sin entrada, o una entrada con un id que nadie declara—,
 * este tipo se evaluaría a `never` y la constante de abajo NO COMPILARÍA.
 */
type MismoConjunto<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

/**
 * La prueba de compilación de que el catálogo está completo. No es decorativa: es la que impide que
 * este archivo crezca un agujero en silencio.
 */
export const CATALOGO_COMPLETO: MismoConjunto<
  IdAccionEpas,
  (typeof ACCIONES_DEL_EPAS)[number]["id"]
> = true;

/**
 * Las doce acciones TAL Y COMO EL MOTOR LAS CONSUME, construidas UNA sola vez al cargar el módulo.
 *
 * 🔴 `actiId` NEGATIVO porque no vienen del backend de permisos: las inyecta la interfaz, igual que
 * ya hacía la entrada del correctivo. Y el `as ModalType` NO es cosmético: estos nombres no son
 * —ni van a ser— claves del registro de modales; el catálogo de modales lo abre la pantalla con su
 * disparador, y dos de estas entradas ni siquiera abren modal, navegan.
 */
const ACCIONES_PARA_EL_MOTOR: readonly UserActions[] = ACCIONES_DEL_EPAS.map(
  (entrada, indice): UserActions => ({
    actiId: -900 - indice,
    submId: 9,
    actiName: entrada.accion as ModalType,
    actiLabel: entrada.label,
    actiContext: "row",
    actiIconName: entrada.icono,
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  }),
);

/**
 * El contexto con el que se juzga UNA fila: rol, estado del EPAS y las dos bolsas de hechos que la
 * fila trae —la de la aceptación y la del correctivo—.
 *
 * Se le pasan las dos SIEMPRE, aunque una regla concreta no pregunte por ninguna: el motor es quien
 * decide qué mira, no este punto de llamada.
 */
const contextoDeLaFila = (
  row: MiEpasAsignado,
  rolName: string,
): ContextoAccion => ({
  rol: rolName,
  estado: row.eejeStatus,
  hechos: {
    ...hechosDelEpas(row),
    ...hechosDeObligacionHacer(row.obligacionHacer),
  },
});

/**
 * Resuelve el submenú de UNA fila: pasa las doce entradas por el motor y devuelve lo que el motor
 * diga, convertido en opciones de menú.
 *
 * 🔴 CON `flatMap` Y NO CON `map(...).filter(Boolean)`, porque con `flatMap` el tipo sobrevive:
 * `filter(Boolean)` deja una lista que todavía admite nulos y obliga a un cast, que es justo por
 * donde se cuelan.
 *
 * 🔴 LA ÚNICA DECISIÓN QUE ESTA FUNCIÓN TOMA ES MONÓTONA. La falta de expediente resuelto puede
 * APAGAR una entrada —no hay identificador con el que construir la ruta ni con el que llamar al
 * endpoint—, y jamás encender ninguna. Sumar apagados no puede rehabilitar lo que el motor apagó,
 * que es la invariante que importa; si esto fuera al revés, la pantalla estaría concediendo actos.
 *
 * @param row Fila de la bandeja del decisor.
 * @param rolName Rol operativo del usuario, sin normalizar.
 * @param disparadores Qué hace cada entrada que actúa. Total: la pantalla no puede olvidar ninguna.
 * @returns Las doce opciones, en orden, cada una con su veredicto ya aplicado.
 */
export function accionesDeLaFila(
  row: MiEpasAsignado,
  rolName: string,
  disparadores: DisparadoresDelEpas,
): AccionCaso[] {
  const ctx = contextoDeLaFila(row, rolName);

  const eejeId = row.eejeId;

  return ACCIONES_DEL_EPAS.flatMap((declarada, indice): AccionCaso[] => {
    // Se ensancha al tipo de la entrada a propósito: el catálogo se declara con literales para que
    // el union de identificadores salga de él, y ese literal no expone las claves opcionales que la
    // entrada concreta no declaró.
    const entrada: EntradaDelEpas = declarada;

    const proyectada = aplicarVeredicto(ACCIONES_PARA_EL_MOTOR[indice], ctx);
    // Hoy no se oculta ninguna de las doce —ninguna está en el catálogo de ocultas—, pero se
    // respeta el contrato del motor en vez de darlo por hecho: si algún día una se ocultara, esta
    // función no la pintaría.
    if (!proyectada) return [];

    const sinExpediente = eejeId == null && entrada.exigeExpediente !== undefined;
    const deshabilitado = sinExpediente || (proyectada.actiIsDisabled ?? false);
    const motivo = sinExpediente
      ? entrada.exigeExpediente
      : proyectada.actiDisabledHint;

    return [
      {
        id: entrada.id,
        label: entrada.label,
        icono: entrada.icono,
        grupo: entrada.grupo,
        tono: entrada.tono,
        deshabilitado,
        motivo,
        ...(entrada.navega
          ? // Enlace. Sin expediente no hay ruta que construir, y la entrada queda apagada con su
            // motivo: un enlace a una ruta a medias caería en el comodín del enrutador.
            { to: eejeId == null ? undefined : entrada.navega(eejeId) }
          : // Acto. El identificador está en `IdQueActua` justamente porque la entrada no declara
            // `navega`, que es lo que el compilador no puede seguir a través del ensanchado.
            { onSelect: () => disparadores[entrada.id as IdQueActua](row) }),
      },
    ];
  });
}
