/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/epas (frontend)
 * Feature: Fusión de las TRES trazas de la línea de tiempo del expediente (D-07/D-08) — Fase 03.19,
 *   ampliada en la Fase 03.22 con el historial de órdenes de pago
 * Archivo: lineaDeTiempo.util.ts
 * Responsabilidad: Convertir la bitácora INTERNA del EPAS (`GET /epas/:eejeId/bitacora`, la traza
 *   normativa del art. 82 CRE), el historial del caso en ASIGNACIONES
 *   (`GET /sorteo/caso/:caseId/historial`) y el historial de ÓRDENES DE PAGO del propio módulo
 *   (`GET /ordenes-pago/:eejeId/historial`, anuladas incluidas) en UNA sola lista de eventos
 *   ordenada, que es lo que el usuario entiende por «la vida del expediente».
 *
 *   ── POR QUÉ LA FUSIÓN OCURRE AQUÍ, EN EL CLIENTE ─────────────────────────────────────────────
 *   Fundir en el servidor ataría la traza normativa interna a la disponibilidad de un servicio
 *   EXTERNO: el día que Asignaciones no responda, el expediente se quedaría sin línea de tiempo
 *   aunque su propia bitácora esté intacta. Fundiendo aquí, cada mitad llega —o no— por su cuenta y
 *   la pantalla enseña la que tiene, diciendo cuál le falta.
 *
 *   ── LAS CUATRO REGLAS, CON SU PORQUÉ ─────────────────────────────────────────────────────────
 *   1. ORDEN POR FECHA ASCENDENTE, CON DESEMPATE DETERMINISTA POR `clave`. La fecha interna nace de
 *      un `timestamp without time zone` y las de Asignaciones llegan como cadena ISO de otro
 *      sistema: dos hechos del mismo segundo tienen que quedar en el mismo orden en cada recarga, o
 *      la línea «baila» y deja de servir como prueba de nada.
 *   2. CADA EVENTO CONSERVA SU PROCEDENCIA. TRES fuentes distintas cuentan la vida del mismo
 *      expediente; mezclarlas sin marca haría creer que este módulo escribió lo que no escribió, y
 *      en una traza nominativa eso no es un matiz de presentación. La tercera —las órdenes de pago—
 *      es del propio módulo y aun así va marcada aparte: tiene otro endpoint y otro modo de fallo,
 *      así que puede faltar sola.
 *   3. CADA FECHA NO NULA DE UNA ENTRADA ES UN EVENTO — vale para Asignaciones Y para las órdenes.
 *      Una entrada del historial de Asignaciones lleva hasta ocho fechas (asignación, aprobación,
 *      solicitud de reasignación, resolución, liberación, rechazo…). Aplanarla a un solo punto —el
 *      de `assignedAt`— perdería justo lo que D-07 quiere contar: quién se excusó y cuándo se
 *      resolvió. Una orden de pago lleva dos (su registro y su anulación): aplanarla al registro
 *      borraría la anulación con su motivo, que es lo único que explica por qué un expediente tuvo
 *      dos números.
 *   4. DEGRADACIÓN HONESTA. Actor ausente ⇒ «Sistema», nunca vacío ni el literal de un valor no
 *      definido — y nunca, JAMÁS, otro nombre. El actor de un hecho de Asignaciones es su `*By` y
 *      ninguno más: los ocho vienen anulables, y rellenar el hueco con el decisor asignado
 *      atribuiría el hecho a quien lo padeció. «De quién es el caso» es otra pregunta y se responde
 *      en el detalle. Un título que llegue como la palabra cruda de una actualización automática se
 *      traduce a una etiqueta legible. Un hito sin campos cambiados se conserva SIN diff: importa
 *      por su código, no por un cambio que no existe. Nada se oculta.
 *
 *   🔴 UNIDAD PURA: no monta la interfaz, no llama a servicios y no conoce el modal. Quien pide las
 *   tres partes es `ModalTimeline`; aquí solo se juntan. Por eso TODA importación de este archivo es
 *   `import type`: si alguna vez entra una importación de valor, la promesa dejó de ser cierta.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 03 — D-07)
 */

import type { CambioTraza, OrigenTraza, TimelineEvent } from "../interfaces/ICase";
import type { OrdenPago } from "../services/OrdenPagoService";
import type { HistorialCasoEntry } from "../services/SorteoService";

/**
 * Lo que se escribe cuando un hecho no tiene actor humano detrás: actos internos del módulo y lo
 * que escriba un disparador de base. **Nunca se deja en blanco y nunca se pinta el literal de un
 * valor no definido**: una traza que se lee como prueba no puede tener huecos sin explicar.
 */
export const ACTOR_DESCONOCIDO = "Sistema";

/** Un evento de la línea de tiempo, ya fundido y listo para pintarse. */
export interface EventoLinea {
  /**
   * Identificador ESTABLE del evento, formado por origen e id (`interna:115`,
   * `asignaciones:7001:assignedAt`). Es la `key` de React de la lista **y** el desempate del orden:
   * por eso tiene que ser única y no depender de la posición.
   */
  clave: string;
  /** De cuál de las dos trazas viene. La interfaz lo enseña con etiqueta de texto, no solo color. */
  origen: OrigenTraza;
  /** Instante del hecho, normalizado a ISO para que las dos trazas sean comparables. */
  fecha: string;
  /** La frase del hecho, ya legible. */
  titulo: string;
  /** Quién lo hizo. Siempre presente: `ACTOR_DESCONOCIDO` cuando no hay actor humano. */
  actor: string;
  /** Contexto del hecho cuando lo hay (motivo de la excusa, resolución de la reasignación…). */
  detalle?: string;
  /** Diff legible. `undefined` —nunca un arreglo vacío— cuando el hecho no cambió ningún campo. */
  cambios?: CambioTraza[];
}

/**
 * Palabras crudas que un disparador de base escribe en `log_event`. Son valores VÁLIDOS que hay que
 * saber mostrar: en una traza que se lee como prueba, «UPDATE» no le dice nada a nadie.
 */
const TITULOS_CRUDOS: Record<string, string> = {
  INSERT: "Registro creado (cambio automático)",
  UPDATE: "Registro actualizado (cambio automático)",
  DELETE: "Registro eliminado (cambio automático)",
};

/**
 * LAS FECHAS DE UNA ENTRADA DE ASIGNACIONES, cada una con su etiqueta, el identificador del actor
 * que le corresponde y el campo del que sale su detalle.
 *
 * El orden de esta lista NO manda: manda la fecha. Está escrito en el orden natural del trámite
 * solo para que se lea como lo que es — el recorrido posible de un caso por el sorteo.
 */
const FECHAS_DE_ASIGNACIONES: Array<{
  campo: keyof HistorialCasoEntry;
  titulo: string;
  actor?: keyof HistorialCasoEntry;
  detalle?: keyof HistorialCasoEntry;
}> = [
  {
    campo: "assignedAt",
    titulo: "Asignado al decisor",
    actor: "assignedBy",
    detalle: "assignmentStatusName",
  },
  {
    campo: "assignmentApprovedAt",
    titulo: "Asignación aprobada",
    actor: "assignmentApprovedBy",
    detalle: "masterStatusName",
  },
  {
    campo: "reassignmentRequestedAt",
    titulo: "Reasignación solicitada",
    actor: "reassignmentRequestedBy",
    detalle: "reason",
  },
  {
    campo: "reassignmentResolvedAt",
    titulo: "Reasignación resuelta",
    actor: "reassignmentResolvedBy",
    detalle: "reassignmentResolution",
  },
  {
    campo: "reassignmentApprovedAt",
    titulo: "Reasignación aprobada",
    actor: "reassignmentApprovedBy",
    detalle: "reassignmentResolution",
  },
  {
    campo: "reassignmentRejectedAt",
    titulo: "Reasignación rechazada",
    actor: "reassignmentRejectedBy",
    detalle: "reassignmentResolution",
  },
  {
    campo: "unassignedAt",
    titulo: "Liberado del decisor",
    actor: "unassignedBy",
    detalle: "reason",
  },
  {
    campo: "caseRejectedAt",
    titulo: "Caso rechazado",
    actor: "caseRejectedBy",
    detalle: "reason",
  },
];

/**
 * Normaliza un instante a ISO. Si no se puede interpretar, **se devuelve tal cual**: un hecho con
 * una fecha rara sigue siendo un hecho, y esconderlo sería peor que enseñarlo mal fechado.
 */
const aIso = (valor: string | Date): string => {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? String(valor) : fecha.toISOString();
};

/**
 * Instante comparable. Lo ilegible se va al final —y allí lo ordena la `clave`—, en vez de producir
 * un `NaN` que haría el orden dependiente del algoritmo de `sort` del motor.
 */
const instante = (iso: string): number => {
  const milisegundos = Date.parse(iso);
  return Number.isNaN(milisegundos) ? Number.POSITIVE_INFINITY : milisegundos;
};

/** Texto no vacío, o `undefined`. Evita pintar cajas con una cadena en blanco dentro. */
const textoOpcional = (valor: unknown): string | undefined => {
  if (typeof valor !== "string") return undefined;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : undefined;
};

/** Nombre del actor a partir de un identificador de Asignaciones, que no viaja resuelto a nombre. */
const actorPorId = (valor: unknown): string | undefined =>
  typeof valor === "number" && Number.isFinite(valor)
    ? `Usuario ${valor}`
    : undefined;

/** Una entrada de la bitácora interna → un evento. */
const deTrazaInterna = (entrada: TimelineEvent): EventoLinea => {
  const titulo = textoOpcional(entrada.logEvent) ?? "";
  const cambios = entrada.cambios?.length ? entrada.cambios : undefined;

  return {
    clave: `interna:${entrada.logId}`,
    origen: "interna",
    fecha: aIso(entrada.logCreatedAt),
    titulo:
      TITULOS_CRUDOS[titulo.toUpperCase()] ??
      (titulo || "Movimiento registrado en el expediente"),
    actor: textoOpcional(entrada.usuFullName) ?? ACTOR_DESCONOCIDO,
    cambios,
  };
};

/**
 * Una entrada del historial de Asignaciones → TANTOS eventos como fechas no nulas traiga. Ésta es
 * la regla 3, y es la que hace que la línea cuente la excusa en vez de resumirla.
 */
const deHistorialAsignaciones = (
  entrada: HistorialCasoEntry,
): EventoLinea[] => {
  const eventos: EventoLinea[] = [];

  // El titular de la asignación: de quién es el caso en esta entrada. NO es quien hizo cada hecho,
  // y por eso viaja en el detalle (ver abajo).
  const titular = actorPorId(entrada.userId);

  for (const fecha of FECHAS_DE_ASIGNACIONES) {
    const valor = textoOpcional(entrada[fecha.campo]);
    if (!valor) continue;

    const contexto = fecha.detalle
      ? textoOpcional(entrada[fecha.detalle])
      : undefined;

    eventos.push({
      clave: `asignaciones:${entrada.id}:${String(fecha.campo)}`,
      origen: "asignaciones",
      fecha: aIso(valor),
      titulo: fecha.titulo,
      /**
       * 🔴 O EL `*By` QUE CORRESPONDE A ESTE HECHO, O «Sistema». No hay tercer eslabón.
       *
       * Aquí había uno: cuando el `*By` específico venía nulo —y los ocho se declaran
       * `?: number | null`—, el actor caía al `userId` de la fila, que es el DECISOR ASIGNADO.
       * Eso atribuía cada hecho a quien lo había PADECIDO en vez de a quien lo hizo: una
       * «Reasignación resuelta» aparecía firmada por el decisor que pidió excusarse, no por el
       * director que la resolvió. En una traza nominativa del art. 82 CRE que se lee como prueba,
       * un actor FALSO es peor que uno ausente: el ausente se ve y se pregunta; el falso se cree.
       * Es la regla 4 de la cabecera de este archivo, y la violaba en silencio.
       */
      actor:
        (fecha.actor ? actorPorId(entrada[fecha.actor]) : undefined) ??
        ACTOR_DESCONOCIDO,
      /**
       * El titular sí vale la pena y no se pierde: se cuenta como CONTEXTO, que es lo que es.
       * «De quién era el caso» y «quién hizo esto» son dos preguntas distintas, y la línea de
       * tiempo tiene que poder responder las dos sin confundirlas.
       */
      detalle:
        [contexto, titular ? `Asignación de ${titular}` : undefined]
          .filter((parte): parte is string => parte !== undefined)
          .join(" · ") || undefined,
    });
  }

  return eventos;
};

/**
 * Cómo se lee cada tipo de orden DENTRO del título del evento: minúsculas y castellano, porque va
 * incrustado en una frase («Orden de pago (multa) registrada…») y no es un rótulo suelto.
 *
 * 🔴 CON RESPALDO A PROPÓSITO. El tipo que declara el cliente es `MULTA | REMANENTE`, pero el enum
 * del backend tiene además `MULTA_COMPULSORIA` y `GASTOS_SUSTITUTORIA`, y el historial los
 * devolvería tal cual el día que se emitan. Sin respaldo, un tipo no previsto imprimiría el literal
 * de un valor no definido en una traza que se usa como prueba — justo lo que prohíbe la regla 4.
 */
const ETIQUETA_TIPO_ORDEN: Record<string, string> = {
  MULTA: "multa",
  REMANENTE: "remanente",
  MULTA_COMPULSORIA: "multa compulsoria",
  GASTOS_SUSTITUTORIA: "gastos de sustitutoria",
};

/** Lo que se escribe cuando el tipo de la orden no llega o no se reconoce. Nunca en blanco. */
const TIPO_ORDEN_DESCONOCIDO = "tipo no especificado";

/**
 * Etiqueta legible del tipo. Lo no previsto se deriva del valor crudo en vez de ocultarse: una
 * orden con un tipo nuevo sigue siendo un hecho, y esconderla sería peor que enseñarla así.
 */
const etiquetaTipoOrden = (tipo: unknown): string => {
  const crudo = textoOpcional(tipo);
  if (!crudo) return TIPO_ORDEN_DESCONOCIDO;
  return (
    ETIQUETA_TIPO_ORDEN[crudo.toUpperCase()] ??
    crudo.toLowerCase().replace(/_/g, " ")
  );
};

/**
 * Una orden de pago del historial → UNO o DOS eventos, uno por cada fecha no nula. Es la regla 3
 * otra vez, y aquí es la que hace que la línea CUENTE la anulación en vez de resumirla: en la fila
 * de la bandeja solo se ve la orden vigente, así que éste es el único sitio donde una orden anulada
 * vuelve a ser visible con su motivo.
 */
const deHistorialOrdenes = (orden: OrdenPago): EventoLinea[] => {
  const eventos: EventoLinea[] = [];

  const tipo = etiquetaTipoOrden(orden.tipo);
  const numero = textoOpcional(orden.numero);
  // Sin número no se inventa uno ni se pinta un hueco: se omite el sufijo y el hecho se cuenta igual.
  const sufijo = numero ? ` — N.º ${numero}` : "";

  const registrada = textoOpcional(orden.registradaAt);
  if (registrada) {
    eventos.push({
      clave: `ordenes:${orden.ordpId}:registrada`,
      origen: "ordenes",
      fecha: aIso(registrada),
      titulo: `Orden de pago (${tipo}) registrada${sufijo}`,
      // `registradaPor` viaja resuelto a nombre cuando el JOIN lo encuentra; si no, «Sistema».
      actor: textoOpcional(orden.registradaPor) ?? ACTOR_DESCONOCIDO,
    });
  }

  const anulada = textoOpcional(orden.anuladaAt);
  if (anulada) {
    eventos.push({
      clave: `ordenes:${orden.ordpId}:anulada`,
      origen: "ordenes",
      fecha: aIso(anulada),
      titulo: `Orden de pago (${tipo}) anulada${sufijo}`,
      // El motivo va LITERAL, sin prefijo ni comillas añadidas: es texto de un funcionario y la
      // traza lo cita, no lo glosa. React lo escapa al pintarlo; nunca se construye marcado con él.
      detalle: textoOpcional(orden.anuladaMotivo),
      /**
       * 🔴 SIEMPRE «Sistema», y no por descuido: el historial NO trae el nombre de quien anula
       * (`anuladaBy` es un identificador y no viaja resuelto). Rellenarlo con `registradaPor`
       * firmaría la anulación con quien registró la orden — la regla 4, que ya costó un defecto en
       * la 03.19: un hecho firmado por quien lo padeció.
       */
      actor: ACTOR_DESCONOCIDO,
    });
  }

  return eventos;
};

/**
 * Funde las TRES trazas en una sola línea ordenada.
 *
 * Las tres entradas son independientes: pasar `[]` en cualquiera de ellas es el CAMINO NORMAL —un
 * expediente sin `case_id` no tiene mitad de Asignaciones, y 156 de 157 no tienen ninguna orden—, no
 * un error. Quien llama es el que sabe si la parte que falta es «no la hay» o «no se pudo traer», y
 * es quien tiene que decirlo en pantalla: aquí las tres se tratan igual.
 *
 * ⚠️ El tercer parámetro es OPCIONAL porque este cambio es ADITIVO: llamar con dos argumentos sigue
 * devolviendo exactamente lo mismo que antes de la Fase 03.22.
 */
export const fundirLineaDeTiempo = (
  internos: TimelineEvent[],
  asignaciones: HistorialCasoEntry[],
  ordenes: OrdenPago[] = [],
): EventoLinea[] => {
  const eventos: EventoLinea[] = [
    ...internos.map(deTrazaInterna),
    ...asignaciones.flatMap(deHistorialAsignaciones),
    ...ordenes.flatMap(deHistorialOrdenes),
  ];

  return eventos.sort((a, b) => {
    const instanteA = instante(a.fecha);
    const instanteB = instante(b.fecha);
    if (instanteA !== instanteB) return instanteA < instanteB ? -1 : 1;
    // Desempate por clave con comparación de código, NO con `localeCompare`: el orden de la línea
    // no puede depender del idioma del navegador de quien la mire.
    if (a.clave === b.clave) return 0;
    return a.clave < b.clave ? -1 : 1;
  });
};
