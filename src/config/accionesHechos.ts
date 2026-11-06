/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend)
 * Feature: Catálogo cerrado de hechos derivados para el motor de acciones
 * Archivo: accionesHechos.ts
 * Responsabilidad: Dar al motor de acciones su SEGUNDA dimensión. `INBOX_ACTION_STATUS_RULES` sabe
 *   gatear por rol y por estado EPAS; la rama de obligación de hacer NO TIENE estados que permitir
 *   —su propia interfaz declara que `EN_EJECUCION_HACER` no se cableará nunca—, así que un `status`
 *   literal no gatea: abre. Lo que de verdad gatea son HECHOS DERIVADOS que el backend ya resuelve
 *   y ya envía en el bloque `obligacionHacer` de las cuatro bandejas.
 *
 *   Este archivo declara ese catálogo y su evaluador, y nada más: no conoce reglas, no conoce
 *   acciones y no toca React.
 *
 *   🔴 CATÁLOGO CERRADO Y TIPADO, NO JSON LIBRE (D-7, decisión A1). Un JSONB sin esquema parece
 *   datos pero no se puede comprobar, y es exactamente la vía por la que las reglas de Instrucción
 *   acabaron divergiendo de su código: su matriz de administración muestra 13 ✓ para acciones que
 *   su propio `reglasAcciones.ts` oculta en todos los estados. Aquí una clave inventada NO COMPILA.
 *
 *   🔴 LO INDECIDIBLE SE APAGA (convención adoptada de Instrucción). Su `plazoVencido()` devuelve
 *   `null` cuando no hay fecha y el evaluador lo trata como apagado: «sin fecha no se puede
 *   decidir». Misma regla aquí, y por eso `leerHecho` distingue «la clave NO VIENE» de «la clave
 *   viene con valor nulo»: lo primero es indecidible, lo segundo es un hecho conocido.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 19: entra `epas.sinAceptar`, la
 *   aceptación dicha en positivo, para gatear «Aceptar» y «Excusarme» — gap 4 del UAT.)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-jcy: salen los tres hechos del sello de
 *   clausura: ninguna regla los usaba)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: el motivo SUSPENDIDA_POR_IMPUGNACION y
 *   el valor SUSPENDIDO del término de alegación)
 */

import type {
  ObligacionHacerDetalle,
  ObligacionHacerEnBandeja,
} from "../interfaces/IObligacionHacer";
// Importación de SOLO TIPOS: se borra al compilar, así que este catálogo sigue sin arrastrar el
// servicio —ni axios, ni React— a ninguna de las unidades puras que lo consumen.
import type { MiEpasAsignado, SorteoLote } from "../services/SorteoService";

/**
 * Todo opcional, hasta el fondo. NO ES LAXITUD: es la declaración exacta del contrato de este
 * adaptador —«copia SOLO las claves presentes»—, y sin ella ese contrato no se podría ni probar,
 * porque un fixture al que le falte una clave a propósito no compilaría. Lo que sí se conserva es
 * la protección que importa: una clave MAL ESCRITA sigue sin compilar.
 */
type ParcialProfundo<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? ParcialProfundo<T[K]>
      : T[K];
};

/**
 * Lo que el adaptador acepta: las DOS formas reales en que el bloque de la rama llega al frontend,
 * declaradas por el Plan 02 a partir del contrato del backend.
 *
 * 🔴 SON DOS FORMAS DISTINTAS, no una con campos de menos. En la FILA de bandeja los campos de la
 * obligación van PLANOS y NO HAY PELDAÑO; en el DETALLE van anidados bajo `obligacionHacer` y el
 * peldaño vive dentro de `serieCompulsorias`. Quien escriba una condición sobre el peldaño tiene
 * que saber que en la bandeja quedará INDECIDIBLE.
 */
export type BloqueObligacionHacer =
  | ParcialProfundo<ObligacionHacerEnBandeja>
  | ParcialProfundo<ObligacionHacerDetalle>
  | null;

/**
 * Las claves de hecho derivado que una regla de acción puede exigir. Union CERRADO: escribir una
 * clave que no esté aquí es un error de compilación, no un dato que se evalúa a `undefined` en
 * producción.
 *
 * Notación de ruta (`bloque.sub.campo`) a propósito: cada clave nombra el camino REAL del dato en
 * el DTO del backend, de modo que quien lea una condición pueda ir a buscar el campo sin traductor
 * de por medio. Si una clave no corresponde a un campo real del DTO, la condición no se puede
 * evaluar nunca — y eso es justamente lo que este union impide.
 *
 * 🔴 LAS CLAVES DE TURNO YA ESTÁN AQUÍ, Y LLEGARON LAS ÚLTIMAS. Donde este comentario decía «no hay
 * claves de turno aquí: ese gate se absorbe en el Plan 09, al final de la fase y a propósito, porque
 * toca código que hoy funciona», hoy están las cuatro del lote. Llegaron por migración declarada y
 * al final del todo, que era el plan: cuando entraron, la rama del correctivo ya estaba entregada.
 */
export type HechoAccionKey =
  /**
   * `ObligacionHacer.tiene` — la resolución de origen impuso un correctivo. Es la puerta de entrada
   * de la rama entera: sin esto, ninguna de las diez acciones de hacer tiene objeto.
   */
  | "obligacionHacer.tiene"
  /**
   * `ObligacionHacer.cumplida` — atajo de `cumplidaAt != null`. Habilita el cierre del correctivo e
   * inhabilita todo lo que presupone incumplimiento.
   */
  | "obligacionHacer.cumplida"
  /**
   * `ObligacionHacer.tieneInforme` — ya se adjuntó el informe técnico del control de verificación.
   * Es lo que habilita trasladar el informe y, por esa vía, arrancar el término del art. 10.
   */
  | "obligacionHacer.tieneInforme"
  /**
   * `ObligacionHacer.sustitutoriaOrdenada` — consta una providencia de EJECUCIÓN SUSTITUTORIA sobre
   * el expediente. Habilita registrar diligencias y gastos de la sustitutoria.
   */
  | "obligacionHacer.sustitutoriaOrdenada"
  /**
   * `TerminoAlegacion.estado` — uno de `SIN_TRASLADO` | `SIN_NOTIFICAR` | `EN_CURSO` | `VENCIDO` |
   * `SUSPENDIDO`.
   *
   * ⟳ quick 261028-mtg: `SUSPENDIDO` es el término detenido por una impugnación abierta. No corre ni
   * vence, y por eso no habilita registrar la alegación (que exige `EN_CURSO`) ni la multa (el
   * servidor manda `habilitaMultaCompulsoria: false`).
   *
   * 🔴 CARGA JURÍDICA: `VENCIDO` **HABILITA** la emisión de la multa compulsoria del art. 240; NO
   * la dispara. El campo DESCRIBE: no hay job, no hay planificador y nadie emite nada por su
   * cuenta. La multa la emite el DECISOR, y este valor solo le dice que el plazo de defensa se
   * cumplió y que ya puede hacerlo. Una condición sobre esta clave abre un botón; jamás ejecuta un
   * acto.
   */
  | "obligacionHacer.terminoAlegacion.estado"
  /**
   * `TerminoAlegacion.habilitaMultaCompulsoria` — el mismo hecho anterior, ya resuelto por el
   * servidor en un booleano. Se prefiere a comparar el enum cuando la condición es exactamente
   * «¿ya se puede imponer la multa?», para no reimplementar en la pantalla una regla que el backend
   * ya decidió. Vale lo mismo que arriba: HABILITA, no dispara.
   */
  | "obligacionHacer.terminoAlegacion.habilitaMultaCompulsoria"
  /**
   * `TerminoAlegacion.alegacionPendiente` — consta escrito de alegación y NO consta providencia que
   * lo resuelva. Es un AVISO, nunca un bloqueo (D-08 de la Fase 03.17): habilita resolver la
   * alegación, y no impide imponer la multa.
   */
  | "obligacionHacer.terminoAlegacion.alegacionPendiente"
  /**
   * `PeldanoCompulsorio.ordinalSiguiente` — qué ordinal le tocaría a la siguiente multa
   * compulsoria.
   *
   * 🔴 CARGA JURÍDICA: el valor nulo significa que NO HAY PELDAÑO PREVISTO QUE OFRECER porque la
   * serie del art. 240 (tres) ya está agotada. No significa «se desconoce»: es un hecho conocido
   * con valor nulo, y por eso `leerHecho` lo reporta como conocido.
   *
   * 🔴 `peldano` NO VIAJA EN LAS BANDEJAS: solo en `GET /obligacion-hacer/:eejeId`. En una fila de
   * bandeja esta clave queda AUSENTE, y una acción que la exija sale apagada con su motivo. Esa
   * asimetría es la razón de ser de «lo indecidible se apaga».
   */
  | "obligacionHacer.peldano.ordinalSiguiente"
  /**
   * `PeldanoCompulsorio.serieAgotada` — `registradas >= PELDANOS_SERIE_COMPULSORIA`.
   *
   * 🔴 CARGA JURÍDICA: es INFORMATIVO Y NO UNA PUERTA. Nada impide registrar una cuarta multa: el
   * módulo pasó de impedir a REGISTRAR FIELMENTE, y si la DME impuso una cuarta, el hecho ocurrió.
   * Usarlo para CERRAR una acción contradiría esa doctrina; se ofrece para ADVERTIR.
   */
  | "obligacionHacer.peldano.serieAgotada"
  /**
   * `EpasListItem.eejeIsLocked` — el expediente está bloqueado. No sale del bloque de la rama: es
   * el espejo de lo que hoy `useEpasInboxActions.resolveActions` aplica a mano sobre TODA la fila
   * (`row.eejeIsLocked ? visibles.map(deshabilitar) : visibles`). Entra al catálogo para que esa
   * regla deje de ser un `if` suelto y pueda escribirse como condición.
   */
  | "epas.bloqueado"
  /**
   * `MiEpasAsignado.aceptado` — el funcionario decisor YA SE HIZO CARGO del caso, a mano o por
   * vencimiento del plazo (`aceptadoImplicito`). Es la marca que parte la bandeja del decisor en
   * dos fases: antes de ella la card enseña un resumen mínimo a propósito, y casi ningún acto sobre
   * el expediente procede todavía.
   *
   * 🔴 NO ES UN ESTADO EPAS, Y POR ESO ES UN HECHO. `status` no puede expresarla: un caso
   * ASIGNADO_DECISOR está aceptado o no lo está, y el enum es el mismo en los dos casos. Era
   * exactamente la clase de decisión que hasta la Fase 03.19 vivía en predicados sueltos de la
   * página (`estaAceptado`, `puedeEmitirProvidencia`).
   */
  | "epas.aceptado"
  /**
   * El caso TODAVÍA NO ha sido aceptado por su decisor. Es la NEGACIÓN EXACTA de `epas.aceptado`,
   * derivada del mismo campo del DTO —`MiEpasAsignado.aceptado ?? aceptadoImplicito`— y escrita en
   * el mismo `if` que ella, para que las dos aparezcan juntas o falten juntas.
   *
   * 🔴 SE DECLARA EN POSITIVO POR EL MISMO MOTIVO QUE `epas.sinExcusaPendiente` —ver su comentario,
   * unas líneas más abajo, que lo explica entero y no se repite aquí—. En corto: con
   * `{ hecho: "epas.aceptado", es: false }` el motivo que se pinta sale DEL REVÉS y le diría al
   * decisor que «Aceptar» solo procede si él ya aceptó el caso, que es lo contrario de lo que le
   * falta.
   *
   * 🔴 ES LA CLAVE CON LA QUE SE GATEAN «Aceptar» y «Excusarme» (gap 4 del UAT del 2026-09-22). Las
   * dos se ofrecían para siempre porque su gate era solo rol + estado y aceptar NO cambia el estado
   * del EPAS. El predicado que faltaba existía a mano en la versión de TARJETAS de la bandeja
   * (`!aceptado && !excusaPendiente`) y el paso a tabla del Plan 17 lo dejó atrás; este hecho es lo
   * que permite trasladarlo al motor, que es donde tenía que haber ido.
   */
  | "epas.sinAceptar"
  /**
   * El caso NO tiene una excusa del decisor esperando al director. Derivado de
   * `MiEpasAsignado.excusaPendiente`.
   *
   * 🔴 SE DECLARA EN POSITIVO —«no hay excusa esperando»— Y NO COMO `excusaPendiente`, Y NO ES UNA
   * preferencia de estilo. `DESCRIPCION_HECHO` promete describir el hecho «tal y como sería SI SE
   * CUMPLIERA», y las dos plantillas de motivo encajan esa frase en indicativo AFIRMATIVO. Una
   * clave declarada en negativo obliga a escribir la regla con `es: false`, y entonces el motivo
   * sale DEL REVÉS: le diría al decisor que su acción «solo procede si hay una excusa esperando al
   * director», que es lo contrario de lo que le falta. Las tres firmas del lote pagaron ese precio
   * con `motivoPersonalizado`, pero un motivo personalizado sustituye TAMBIÉN al de rol, y aquí eso
   * haría que un secretario leyera un texto sobre una excusa que nunca va a presentar.
   */
  | "epas.sinExcusaPendiente"
  /**
   * `SorteoLote.estado` — uno de `PENDIENTE` | `PARCIALMENTE_FIRMADO` | `APROBADO` | `RECHAZADO`.
   * NO es el estado del EPAS: es el del LOTE, y por eso no cabía —ni cabe— en la dimensión `status`
   * de la tabla de reglas, que es el enum EPAS. Cabe aquí, que es otra dimensión (Plan 09).
   */
  | "lote.estado"
  /**
   * ¿Consta la firma ORDEN-1 del funcionario decisor en el acta? Derivado de `firmaDecisorAt`.
   *
   * 🔴 BOOLEANO Y NO LA MARCA DE TIEMPO. El lenguaje de condiciones tiene DOS operadores —igualdad
   * y pertenencia— a propósito; añadir un tercero («presente») para este caso ampliaría el lenguaje
   * por una comodidad. Además «hay firma» es lo que la regla quiere decir: la hora en que se firmó
   * no gatea nada.
   */
  | "lote.firmaDecisor"
  /** ¿Consta la firma ORDEN-2 del secretario abogado? Derivado de `firmaSecretarioAt`. */
  | "lote.firmaSecretario"
  /**
   * ¿Consta la aprobación ORDEN-3 del director? Derivado de `aprobadoAt`. Es la que CIERRA la
   * secuencia: solo la orden-3 aprueba.
   */
  | "lote.aprobado";

/**
 * Lo que un hecho puede valer. Deliberadamente escalar: los hechos que el backend deriva son
 * booleanos, enums en cadena y ordinales. Admitir objetos o listas obligaría al evaluador a navegar
 * estructuras, y navegar es el primer paso hacia interpretar.
 */
export type ValorHecho = boolean | string | number | null;

/**
 * Una condición sobre un hecho. EXACTAMENTE DOS FORMAS, sin anidamiento y sin disyunción: igualdad
 * (`es`) y pertenencia (`en`).
 *
 * 🔴 POR QUÉ NO HAY CONJUNCIONES NI DISYUNCIONES ANIDADAS. Una lista de condiciones se evalúa como
 * CONJUNCIÓN, y un caso que necesitara alternativa se resuelve con DOS REGLAS, no con un árbol. Un
 * árbol de expresiones es el primer paso hacia un intérprete, y un intérprete en el navegador es
 * exactamente la superficie que este diseño existe para no tener: nada aquí construye funciones ni
 * interpreta cadenas en tiempo de ejecución, y un criterio de aceptación lo comprueba con un grep
 * negativo.
 */
export type CondicionAccion =
  | { hecho: HechoAccionKey; es: ValorHecho }
  | { hecho: HechoAccionKey; en: readonly ValorHecho[] };

/**
 * La bolsa PLANA de hechos que un consumidor entrega al evaluador.
 *
 * Plana a propósito: quien la construye es quien sabe qué trajo la pantalla —una fila de bandeja no
 * trae lo mismo que el detalle del expediente—, y así el evaluador nunca navega objetos que pueden
 * no existir. `Partial` no es laxitud: es la forma de que «la clave no está» sea representable, que
 * es la mitad del contrato de este archivo.
 */
export type HechosAccion = Partial<Record<HechoAccionKey, ValorHecho>>;

/** La bolsa vacía: ningún hecho conocido. Toda condición sobre ella resulta indecidible. */
export const HECHOS_VACIOS: HechosAccion = {};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// El adaptador: del bloque que envía el backend a la bolsa plana.
// ─────────────────────────────────────────────────────────────────────────────────────────────

type RegistroDesconocido = Record<string, unknown>;

/** ¿Es un objeto navegable? El valor nulo no lo es, y los escalares tampoco. */
function esObjeto(valor: unknown): valor is RegistroDesconocido {
  return typeof valor === "object" && valor !== null;
}

/** ¿Es un valor de hecho admisible? Cualquier otra cosa (objeto, lista, función) se descarta. */
function esValorHecho(valor: unknown): valor is ValorHecho {
  return (
    valor === null ||
    typeof valor === "boolean" ||
    typeof valor === "string" ||
    typeof valor === "number"
  );
}

/**
 * Copia un campo del origen a la bolsa SOLO SI ESTÁ PRESENTE. Un campo ausente —o presente sin
 * valor definido, que es lo mismo que el servidor no lo envíe— no deja rastro en la bolsa.
 */
function copiarSiPresente(
  destino: HechosAccion,
  origen: RegistroDesconocido | undefined,
  campo: string,
  clave: HechoAccionKey,
): void {
  if (!origen || !(campo in origen)) return;
  const valor = origen[campo];
  if (!esValorHecho(valor)) return;
  destino[clave] = valor;
}

/**
 * Traduce el bloque `obligacionHacer` tal y como llega del backend a la bolsa plana de hechos. Es
 * el ÚNICO adaptador: si mañana el DTO cambia de forma, cambia aquí y en ningún otro sitio.
 *
 * 🔴 YA NO RECIBE `unknown`. Cuando se escribió, el bloque viajaba sin tipo propio en el frontend;
 * el Plan 02 de esta fase declaró los tipos espejo, así que la firma se estrecha a las DOS formas
 * reales en que el bloque llega —la FILA de bandeja y el DETALLE— más la ausencia. Lo que se gana
 * no es cosmético: una clave mal escrita o un campo que el backend renombre dejan de compilar aquí,
 * en el único sitio que traduce el DTO, en vez de evaluarse a `undefined` en producción.
 *
 * 🔴 Y SON DOS FORMAS DISTINTAS, no una con campos de menos. En la fila los campos van PLANOS
 * (`tiene`, `cumplida`…) y no hay peldaño; en el detalle van anidados bajo `obligacionHacer` y el
 * peldaño vive en `serieCompulsorias.peldano`. El adaptador normaliza las dos a la misma bolsa, que
 * es justo para lo que existe: si no lo hiciera, las dos claves de peldaño serían ILEGIBLES en todas
 * las pantallas y la distinción entre «ausente» y «nulo» no describiría nada.
 *
 * La comprobación defensiva se conserva: el dato lo entrega la red, y un tipo no es garantía de
 * runtime.
 *
 * 🔴 DEVUELVE SOLO LAS CLAVES PRESENTES. Sin bloque devuelve la bolsa vacía. Si `peldano` no viene
 * —el caso de las CUATRO bandejas, donde solo viaja en `GET /obligacion-hacer/:eejeId`— las dos
 * claves de peldaño quedan AUSENTES, **no con valor nulo**. La diferencia entre «ausente» y «nulo»
 * es la que separa «no se puede decidir» de «no hay peldaño que ofrecer», y esa distinción es todo
 * el punto de este archivo.
 *
 * @param bloque El bloque `obligacionHacer` de una fila de bandeja o del detalle, o nada.
 * @returns La bolsa de hechos con exactamente las claves que el bloque traía.
 */
export function hechosDeObligacionHacer(
  bloque?: BloqueObligacionHacer,
): HechosAccion {
  const hechos: HechosAccion = {};
  if (!esObjeto(bloque)) return hechos;

  // La forma del DETALLE anida los campos de la obligación y esconde el peldaño dentro de la serie;
  // la de la FILA los lleva planos y no trae peldaño. Se resuelven las dos raíces aquí, y el resto
  // del adaptador no vuelve a saber de qué pantalla vino el dato.
  const registro: RegistroDesconocido = bloque;
  const raiz = esObjeto(registro.obligacionHacer)
    ? registro.obligacionHacer
    : registro;
  const serie = esObjeto(registro.serieCompulsorias)
    ? registro.serieCompulsorias
    : undefined;

  copiarSiPresente(hechos, raiz, "tiene", "obligacionHacer.tiene");
  copiarSiPresente(hechos, raiz, "cumplida", "obligacionHacer.cumplida");
  copiarSiPresente(hechos, raiz, "tieneInforme", "obligacionHacer.tieneInforme");
  copiarSiPresente(
    hechos,
    raiz,
    "sustitutoriaOrdenada",
    "obligacionHacer.sustitutoriaOrdenada",
  );

  const termino = esObjeto(registro.terminoAlegacion)
    ? registro.terminoAlegacion
    : undefined;
  copiarSiPresente(
    hechos,
    termino,
    "estado",
    "obligacionHacer.terminoAlegacion.estado",
  );
  copiarSiPresente(
    hechos,
    termino,
    "habilitaMultaCompulsoria",
    "obligacionHacer.terminoAlegacion.habilitaMultaCompulsoria",
  );
  copiarSiPresente(
    hechos,
    termino,
    "alegacionPendiente",
    "obligacionHacer.terminoAlegacion.alegacionPendiente",
  );

  // `peldano` NO viaja en las bandejas: solo en el DETALLE, y allí dentro de `serieCompulsorias`.
  // Si no viene, las dos claves quedan AUSENTES —no en nulo—, y toda condición sobre ellas resulta
  // indecidible. Por eso NINGUNA regla de la rama condiciona sobre el peldaño: lo haría indecidible
  // en la fila de bandeja, que es la única pantalla donde hoy se usa.
  const peldano = esObjeto(serie?.peldano) ? serie.peldano : undefined;
  copiarSiPresente(
    hechos,
    peldano,
    "ordinalSiguiente",
    "obligacionHacer.peldano.ordinalSiguiente",
  );
  copiarSiPresente(
    hechos,
    peldano,
    "serieAgotada",
    "obligacionHacer.peldano.serieAgotada",
  );

  return hechos;
}

/**
 * Lo que `hechosDeLote` necesita de una fila de lote: su estado y las tres marcas de firma. Se
 * declara como `Pick` de `SorteoLote` —y no como una forma propia— para que renombrar un campo en el
 * servicio deje de compilar AQUÍ, en el único sitio que traduce la fila.
 */
export type BloqueLote = Pick<
  SorteoLote,
  "estado" | "firmaDecisorAt" | "firmaSecretarioAt" | "aprobadoAt"
>;

/**
 * Traduce una fila de LOTE a la bolsa plana de hechos. Es el gemelo de `hechosDeObligacionHacer`
 * para la firma secuencial del acta D2, y el que permite que el turno lo decida el MISMO motor que
 * el resto de las acciones (Plan 09).
 *
 * 🔴 LOS TRES BOOLEANOS SIEMPRE SE ESCRIBEN; EL ESTADO SOLO SI VIENE. Es la única asimetría de este
 * archivo y es deliberada:
 *
 *   · `estado` ausente es INDECIDIBLE de verdad —la fila no dice en qué punto está el acta— y una
 *     condición sobre él tiene que apagar con «no se puede decidir aquí».
 *   · Una marca de firma ausente NO es ignorancia: es el hecho de que NADIE FIRMÓ. Así lo leía el
 *     resolver original (`!lote.firmaDecisorAt`), y copiar la marca «solo si está presente» habría
 *     dejado al decisor de un lote PENDIENTE recién sorteado —que por definición no tiene ninguna
 *     marca— mirando su propio botón apagado por falta de dato. Ésa es exactamente la regresión que
 *     la matriz de paridad de 160 celdas existe para impedir.
 *
 * 🔴 NINGUNA OPERACIÓN SOBRE FECHAS. Solo se comprueba que la marca exista. Comparar horas en el
 * navegador para deducir un orden que el backend ya impuso sería fabricar una segunda verdad sobre
 * la secuencia, y el gating de UI aquí es CONVENIENCIA: el backend deriva orden y actor del JWT.
 *
 * @param lote Fila de lote de las bandejas de actas (`SorteoLote`).
 * @returns La bolsa con `lote.estado` (si viene) y los tres booleanos de firma.
 */
export function hechosDeLote(lote: BloqueLote): HechosAccion {
  const hechos: HechosAccion = {};

  if (lote.estado !== undefined && lote.estado !== null) {
    hechos["lote.estado"] = lote.estado;
  }

  hechos["lote.firmaDecisor"] = !!lote.firmaDecisorAt;
  hechos["lote.firmaSecretario"] = !!lote.firmaSecretarioAt;
  hechos["lote.aprobado"] = !!lote.aprobadoAt;

  return hechos;
}

/**
 * Lo que `hechosDelEpas` necesita de una fila de la bandeja del decisor: las tres marcas de la
 * aceptación. Se declara como `Pick` de `MiEpasAsignado` —y no como una forma propia— para que
 * renombrar un campo en el servicio deje de compilar AQUÍ, en el único sitio que traduce la fila.
 */
export type BloqueAceptacionEpas = Pick<
  MiEpasAsignado,
  "aceptado" | "aceptadoImplicito" | "excusaPendiente"
>;

/**
 * Traduce una fila de la bandeja del decisor a la bolsa plana de hechos. Es el tercer gemelo de
 * `hechosDeObligacionHacer` y `hechosDeLote`, y el que permite que las cuatro entradas del submenú
 * del EPAS las decida el MISMO motor que el resto de las acciones (Fase 03.19, Plan 11 — D-11).
 *
 * 🔴 LA MISMA ASIMETRÍA DELIBERADA QUE `hechosDeLote`, y por la misma razón:
 *
 *   · La ACEPTACIÓN ausente es indecidible de verdad. La fila no dice si el decisor se hizo cargo,
 *     y una condición sobre ella tiene que apagar con «no se puede decidir aquí». Donde la página
 *     escribía `row.aceptado ?? row.aceptadoImplicito ?? false` —que trata «no lo sé» como «no»—,
 *     el motor distingue las dos cosas: apaga igual, pero por el motivo correcto.
 *   · La EXCUSA ausente NO es ignorancia: es el hecho de que NO HAY excusa esperando. Así lo leía
 *     el gate original (`row.excusaPendiente ?? false`), y copiar la marca «solo si viene» habría
 *     dejado al decisor de un caso recién sorteado —que por definición no tiene excusa ninguna—
 *     mirando su propio botón apagado por falta de dato.
 *
 * 🔴 NO INTERPRETA NADA MÁS. No mira el estado del EPAS, no mira el plazo y no deduce una
 * aceptación a partir de una fecha: la aceptación por vencimiento la deriva el BACKEND y viaja en
 * `aceptadoImplicito`. Recalcularla en el navegador sería fabricar una segunda verdad sobre el
 * mismo hecho.
 *
 * @param fila Fila de la bandeja del decisor (`MiEpasAsignado`).
 * @returns La bolsa con `epas.aceptado` y su negación `epas.sinAceptar` —las dos, o ninguna, según
 *   la fila lo diga o no— y `epas.sinExcusaPendiente`, que se escribe siempre.
 */
export function hechosDelEpas(fila: BloqueAceptacionEpas): HechosAccion {
  const hechos: HechosAccion = {};

  const aceptado = fila.aceptado ?? fila.aceptadoImplicito;
  if (aceptado !== undefined && aceptado !== null) {
    hechos["epas.aceptado"] = aceptado;
    // 🔴 LA NEGACIÓN VA DENTRO DEL MISMO `if`, Y NO ES COMODIDAD: es lo que garantiza que las dos
    // claves aparezcan juntas o falten juntas. Escrita fuera, el caso «no lo sé» se convertiría en
    // «no está aceptado» y el motor encendería «Aceptar» sobre una fila que no dice nada de la
    // aceptación —afirmando lo que no sabe, que es precisamente lo que este archivo existe para no
    // hacer—. Con la clave ausente, `evaluarCondiciones` la manda a `faltan` y la acción se apaga
    // diciendo que no se puede decidir aquí.
    hechos["epas.sinAceptar"] = !aceptado;
  }

  hechos["epas.sinExcusaPendiente"] = !(fila.excusaPendiente ?? false);

  return hechos;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// La lectura y la evaluación.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lee un hecho de la bolsa distinguiendo lo desconocido de lo nulo.
 *
 * `conocido` es falso SI Y SOLO SI la clave no está presente en la bolsa. Un valor nulo presente SÍ
 * es conocido: `ordinalSiguiente` nulo no es ignorancia, es «la serie está agotada y no hay peldaño
 * que ofrecer».
 *
 * @param hechos Bolsa de hechos del consumidor.
 * @param clave Clave del catálogo cerrado.
 * @returns `conocido` y el valor (nulo si no se conoce, que el llamador no debe interpretar).
 */
export function leerHecho(
  hechos: HechosAccion,
  clave: HechoAccionKey,
): { conocido: boolean; valor: ValorHecho } {
  const presente =
    Object.prototype.hasOwnProperty.call(hechos, clave) &&
    hechos[clave] !== undefined;
  return {
    conocido: presente,
    valor: presente ? (hechos[clave] ?? null) : null,
  };
}

/**
 * El resultado de evaluar una lista de condiciones. Ni `faltan` ni `incumplidas` son diagnóstico de
 * programador: son lo que da el MOTIVO que se pinta en pantalla cuando la acción sale apagada.
 *
 * 🔴 POR QUÉ SON DOS LISTAS Y NO UNA. «No se cumple» y «no se sabe» apagan igual pero se explican
 * distinto —«esta acción solo procede si X» frente a «esta pantalla no trae el dato de si X»—, y
 * quien mira el botón necesita saber cuál de las dos le ha tocado: una se arregla actuando sobre el
 * expediente, y la otra abriendo la pantalla que sí trae el dato.
 */
export type ResultadoCondiciones = {
  cumple: boolean;
  /** Claves INDECIDIBLES: no vinieron en la bolsa. */
  faltan: HechoAccionKey[];
  /** Claves conocidas cuyo valor NO satisface la condición. */
  incumplidas: HechoAccionKey[];
};

/**
 * Evalúa una lista de condiciones como CONJUNCIÓN PURA: se cumplen todas o no se cumple.
 *
 * 🔴 TODA CLAVE NO CONOCIDA SE ACUMULA EN `faltan` Y FUERZA `cumple` a falso. Nunca se adivina y
 * nunca se asume cumplida por omisión: con el dato ausente, la acción se apaga con su motivo. Es la
 * convención de `plazoVencido()` de Instrucción elevada a regla del motor.
 *
 * Se recorren TODAS las condiciones aunque una ya haya fallado, para que las dos listas contengan
 * el inventario completo y no solo lo primero: quien mire la pantalla tiene derecho a saber todo lo
 * que le falta, no a descubrirlo de uno en uno.
 *
 * Sin condiciones, `cumple` es verdadero y las dos listas quedan vacías: una regla que no exige
 * hechos no los echa de menos.
 *
 * @param condiciones Lista de condiciones de la regla, o nada si la regla no exige hechos.
 * @param hechos Bolsa de hechos del consumidor.
 * @returns `cumple`, las claves indecidibles y las claves incumplidas.
 */
export function evaluarCondiciones(
  condiciones: readonly CondicionAccion[] | undefined,
  hechos: HechosAccion,
): ResultadoCondiciones {
  const faltan: HechoAccionKey[] = [];
  const incumplidas: HechoAccionKey[] = [];
  if (!condiciones || condiciones.length === 0) {
    return { cumple: true, faltan, incumplidas };
  }

  for (const condicion of condiciones) {
    const { conocido, valor } = leerHecho(hechos, condicion.hecho);
    if (!conocido) {
      faltan.push(condicion.hecho);
      continue;
    }
    const satisface =
      "en" in condicion ? condicion.en.includes(valor) : valor === condicion.es;
    if (!satisface) incumplidas.push(condicion.hecho);
  }

  return {
    cumple: faltan.length === 0 && incumplidas.length === 0,
    faltan,
    incumplidas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Los motivos. «Apagar y no esconder» exige que apagar venga con su porqué.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Cada hecho, dicho como lo diría un decisor. En INDICATIVO AFIRMATIVO, describiendo el hecho tal y
 * como sería SI SE CUMPLIERA, para que las dos plantillas de motivo lo encajen sin romper la
 * gramática: «Esta acción solo procede si X» y «no trae el dato de si X».
 *
 * `Record<HechoAccionKey, string>` y no un objeto suelto: añadir una clave al catálogo sin darle
 * frase NO COMPILA. Un motivo olvidado es un botón apagado sin explicación, que es justo lo que la
 * convención adoptada prohíbe.
 */
const DESCRIPCION_HECHO: Record<HechoAccionKey, string> = {
  "obligacionHacer.tiene":
    "el expediente lleva una obligación de hacer declarada",
  "obligacionHacer.cumplida": "la obligación de hacer consta cumplida",
  "obligacionHacer.tieneInforme":
    "consta el informe técnico del control de verificación",
  "obligacionHacer.sustitutoriaOrdenada":
    "consta ordenada la ejecución sustitutoria",
  "obligacionHacer.terminoAlegacion.estado":
    "el término de alegación está en la situación que este paso requiere",
  "obligacionHacer.terminoAlegacion.habilitaMultaCompulsoria":
    "el término de alegación ya venció",
  "obligacionHacer.terminoAlegacion.alegacionPendiente":
    "hay una alegación del administrado sin resolver",
  "obligacionHacer.peldano.ordinalSiguiente":
    "queda un peldaño de la serie del art. 240 que ofrecer",
  "obligacionHacer.peldano.serieAgotada":
    "la serie de multas compulsorias del art. 240 está agotada",
  "epas.bloqueado": "el expediente está bloqueado",
  "epas.aceptado": "el decisor ya aceptó el caso",
  // 🔴 REDACTADA PARA QUE LAS DOS PLANTILLAS QUEDEN GRAMATICALES, y comprobado a mano:
  //   · CONDICION_NO_CUMPLIDA → «Esta acción solo procede si el caso sigue sin aceptar.»
  //   · DATO_AUSENTE          → «No se puede decidir aquí: esta pantalla no trae el dato de si el
  //                              caso sigue sin aceptar.»
  // Ni una ni otra puede leerse como «solo procede si el decisor ya aceptó el caso», que es la
  // frase invertida que motivó declarar esta clave en positivo.
  "epas.sinAceptar": "el caso sigue sin aceptar",
  "epas.sinExcusaPendiente":
    "la excusa del decisor ya está resuelta o nunca se presentó",
  "lote.estado": "el acta del lote está en el punto que este paso requiere",
  "lote.firmaDecisor": "consta la firma del funcionario decisor en el acta",
  "lote.firmaSecretario": "consta la firma del secretario abogado en el acta",
  "lote.aprobado": "consta la aprobación del director en el acta",
};

/**
 * Traduce una clave técnica del catálogo a una frase que un decisor entiende.
 *
 * 🔴 NUNCA SE PINTA LA CLAVE TAL CUAL. `actiDisabledHint` va a la pantalla de un funcionario, no al
 * registro de un programador: «obligacionHacer.tieneInforme» no explica nada y además filtra la
 * forma interna del DTO.
 *
 * @param clave Clave del catálogo cerrado.
 * @returns La descripción del hecho, en indicativo afirmativo.
 */
export function motivoDeHecho(clave: HechoAccionKey): string {
  return DESCRIPCION_HECHO[clave];
}

/**
 * Catálogo CERRADO de motivos por los que una acción sale apagada. Cinco, uno por cada filtro que
 * puede negar: sin regla escrita, fuera de rol, fuera de estado, condición no cumplida y dato
 * ausente.
 *
 * 🔴 NUNCA TEXTO INLINE EN LAS PÁGINAS. El motivo sale siempre de aquí, igual que
 * `SIN_CASOS_ELEGIBLES` en `useEpasInboxActions`: un mismo apagado explicado de dos maneras en dos
 * pantallas es una tercera fuente de verdad, y esta fase existe para tener menos, no más.
 *
 * Los dos últimos son funciones porque su texto depende del hecho concreto que falló: apagar con
 * «no procede» a secas es apagar escondiendo el porqué, que es la mitad de lo que la convención
 * adoptada prohíbe.
 */
export const MOTIVOS_ACCION = {
  /**
   * El defecto de D-5 matizado por D-7: negar es APAGAR CON SU MOTIVO, no hacer desaparecer. Un
   * olvido de regla se ve así en pantalla —visible, preguntable, depurable— en vez de esfumarse sin
   * que nadie sepa que la acción existía.
   */
  SIN_REGLA:
    "Esta acción todavía no tiene regla escrita en el módulo: no se puede ofrecer.",
  FUERA_DE_ROL: "Su rol no interviene en este paso del procedimiento.",
  FUERA_DE_ESTADO: "El expediente no está en el estado que este paso requiere.",
  CONDICION_NO_CUMPLIDA: (clave: HechoAccionKey): string =>
    `Esta acción solo procede si ${motivoDeHecho(clave)}.`,
  DATO_AUSENTE: (clave: HechoAccionKey): string =>
    `No se puede decidir aquí: esta pantalla no trae el dato de si ${motivoDeHecho(clave)}.`,
  /**
   * ⟳ quick 261028-mtg (D-2): el expediente está EN_IMPUGNACION y todo lo que estaba en curso queda
   * en pausa. No es un sexto filtro de la cascada: lo aplica `resolverAccion` AL FINAL, sobre las
   * acciones de `ACCIONES_SUSPENDIDAS_POR_IMPUGNACION`, para que el decisor lea POR QUÉ no puede
   * actuar y DÓNDE se resuelve, en vez de un «no está en el estado que este paso requiere».
   */
  SUSPENDIDA_POR_IMPUGNACION:
    "El expediente está suspendido por la impugnación: hasta que la Procuraduría resuelva el recurso solo se puede adjuntar su resolución y resolver el recurso, en la pestaña «Recursos».",
} as const;
