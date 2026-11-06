/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: Contrato de la rama del correctivo
 * Archivo: IObligacionHacer.ts
 * Responsabilidad: El vocabulario de la rama de OBLIGACIÓN DE HACER en el navegador. Espeja, palabra
 *   por palabra, `ejecucion-backend/src/modules/ejecucion/obligacion-hacer/interfaces/obligacion-hacer.interface.ts`
 *   y el bloque compuesto que la bandeja ya recibe (`epas-list-item.dto.ts`). No añade ni un campo:
 *   todo lo que hay aquí lo envía el servidor.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-jcy: se retira el vocabulario del sello de
 *   clausura, espejo del backend)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: el término de alegación SUSPENDIDO por
 *   la impugnación, con `suspendidoDesde` y `diasHabilesSuspendidos`; el detalle trae `eejeStatus` y
 *   `suspensionImpugnacion`)
 *
 * ── (1) ESTA RAMA NO ES UNA MÁQUINA DE ESTADOS ────────────────────────────────────────────────
 * Es un REGISTRO DE ACTOS con hechos DERIVADOS. No hay `eeje_hacer_status`, no hay guards de
 * transición y no hay orden obligatorio: mientras el expediente lleve correctivo, todas las acciones
 * están disponibles siempre. Por eso `EN_EJECUCION_HACER` sigue en el catálogo de estados SIN
 * cablear, y no se cableará nunca. 🔴 Consecuencia para la pantalla: lo que gatea un botón de esta
 * rama NO es un estado, son los HECHOS DERIVADOS de abajo — `tiene`, `tieneInforme`,
 * `sustitutoriaOrdenada`, `terminoAlegacion.estado` y `peldano.ordinalSiguiente`.
 *
 * ── (2) EL SELLO DE CLAUSURA SE RETIRÓ (quick 261014-jcy) ─────────────────────────────────────
 * Por decisión del usuario, el módulo ya no registra ni deriva actos sobre el precinto físico de
 * clausura: ni la serie de actos, ni el estado «puesto / medida vigente / solicitud pendiente», ni
 * el aviso del retiro definitivo, y nada de eso viaja ya al navegador. Sin migración: la historia
 * queda en la base. Los otros «sellos» del sistema —el del director en RECE-08, el de la
 * devolución, el sello por caso de entrada-lotes— no tienen nada que ver con éste y siguen.
 *
 * ── (3) NINGÚN IDENTIFICADOR DE ACTOR VIAJA DESDE AQUÍ ────────────────────────────────────────
 * 🔴 Quién firma el acto lo deriva el servidor del JWT, NUNCA del cuerpo de la petición. Por eso
 * este archivo declara SOLO lo que se recibe y los cuerpos que se envían, y en ninguno de ellos hay
 * un campo con el identificador del usuario que actúa. Si algún día apareciera, la bitácora del
 * art. 82 CRE dejaría de ser atribuible — que es lo único que la hace valer.
 *
 * ── (4) TODAS LAS MARCAS DE TIEMPO SON CADENAS ISO ────────────────────────────────────────────
 * El backend las tipa como objetos de fecha porque `pg` las convierte antes de que el DTO las vea;
 * por JSON llegan como cadena. Declararlas de otro modo sería mentir sobre lo que hay en memoria —
 * mismo criterio que `registradaAt` en `MultaCompulsoriaService.ts`.
 */
import type { Advertencia } from "../services/ProvidenciaService";
import type { MultaCompulsoria } from "../services/MultaCompulsoriaService";

export type { Advertencia };

/**
 * Lo que añade cualquier respuesta de la rama que pueda traer avisos.
 *
 * 🔴 El campo es OPCIONAL y su AUSENCIA significa «sin avisos». El servidor NUNCA devuelve un array
 * vacío, para que nadie tenga que distinguir «no hay» de «no se calculó».
 *
 * 🔴 UNA ADVERTENCIA NO ES UN ERROR. Viaja en respuestas 2xx, sobre un hecho YA CONSUMADO, y la
 * doctrina del módulo es avisar, no bloquear: quien la recibe la pinta DESPUÉS del éxito.
 */
export type ConAdvertencias = {
  advertencias?: Advertencia[];
};

/**
 * Cómo acabó la diligencia de la ejecución sustitutoria. UN SOLO TIPO DE ACTO CON RESULTADO.
 *
 * - `EJECUTADA`: la Administración EJECUTÓ el correctivo a costa del obligado. Es el ÚNICO
 *   resultado que genera costo trasladable (art. 239 COA).
 * - `FALLIDA`: acceso negado o imposibilidad material, la cuadrilla fue y no pudo. 🔴 El fallo deja
 *   acto IGUAL: se espera frecuente, y es lo único que sirve si el administrado alega más tarde que
 *   nunca fue una cuadrilla a su predio.
 * - `INNECESARIA`: el administrado cumplió ANTES de que llegara la cuadrilla. No genera costo, y se
 *   registra igual: la salida se produjo y el expediente tiene que poder contarla.
 */
export type ResultadoDiligencia = "EJECUTADA" | "FALLIDA" | "INNECESARIA";

/**
 * En qué situación está el término de alegación. **CUATRO estados, y no dos.**
 *
 * 🔴 Un vencimiento nulo y mudo NO distingue «todavía no se ha corrido traslado» de «el traslado se
 * emitió pero ningún despacho consta notificado», y la segunda situación es FRECUENTE. Colapsarlas
 * escondería justo la que se puede corregir.
 *
 * - `SIN_TRASLADO`: no consta ninguna providencia de traslado del informe sobre el expediente.
 * - `SIN_NOTIFICAR`: el traslado se emitió, pero su notificación NO está cerrada. El término **no ha
 *   arrancado**, y la causa más probable es que el administrado no tenga formas de notificación
 *   declaradas.
 * - `EN_CURSO`: el término corre; la notificación quedó cerrada y el vencimiento aún no ha llegado.
 * - `VENCIDO`: el término se cumplió. Es el estado que HABILITA la multa compulsoria.
 * - `SUSPENDIDO` (quick 261028-mtg): el expediente está EN_IMPUGNACION y el término está detenido.
 *   No corre ni vence: `venceAt` es `null`, `diasHabilesRestantes` son los que le quedaban al
 *   suspenderse y `motivo` lo dice redactado. Vuelve a correr cuando la Procuraduría resuelva.
 */
export type EstadoTermino =
  | "SIN_TRASLADO"
  | "SIN_NOTIFICAR"
  | "EN_CURSO"
  | "VENCIDO"
  | "SUSPENDIDO";

/**
 * El bloque del correctivo. Se resuelve en el SERVIDOR y viaja resuelto: la pantalla PINTA la regla,
 * no la reimplementa. Si cada cliente dedujera «¿puede archivarse?» por su cuenta, el que se
 * equivocaría sería el que enseña un botón que el servidor va a rechazar.
 */
export interface ObligacionHacer {
  /** La resolución de origen impuso un correctivo. */
  tiene: boolean;
  /** Atajo de «hay fecha de cumplimiento», para que la pantalla no repita la comparación. */
  cumplida: boolean;
  /** Cadena ISO, o `null` si no consta cumplida. */
  cumplidaAt: string | null;
  /** Cuántas multas compulsorias lleva la serie del expediente. */
  multasCompulsorias: number;
  /** Ya se adjuntó el informe técnico del control de verificación. */
  tieneInforme: boolean;
  /**
   * `doc_id` del informe de verificación MÁS RECIENTE del expediente, o `null` si no hay ninguno
   * (quick 261014-dmc).
   *
   * OPCIONAL a propósito: el servidor desplegado (1.6.0) todavía no lo manda hasta que se despliegue
   * el backend de este quick, y su ausencia tiene que degradar al comportamiento de siempre (el
   * modal del informe abre en la subida). Además evita tocar los fixtures tipados de `src/config`.
   * NO entra en los hechos del motor (`accionesHechos.ts`): ninguna regla lo usa.
   */
  informeDocId?: number | null;
  /**
   * Hay informe, el correctivo NO consta cumplido y ninguna constatación de incumplimiento cita ese
   * informe: quedó subido SIN conclusión (el decisor cerró el modal sin decidir).
   *
   * Opcional por lo mismo que `informeDocId`. La acción `adjuntarInforme` sigue gobernada por
   * `obligacionHacer.tiene`; este dato solo elige el PASO inicial del modal del informe.
   */
  informeSinConclusion?: boolean;
  /** Se emitió una providencia de EJECUCIÓN SUSTITUTORIA sobre el expediente. */
  sustitutoriaOrdenada: boolean;
}

/**
 * El peldaño siguiente de la serie de multas compulsorias (art. 240 COA), DERIVADO.
 *
 * 🔴 `ordinalSiguiente` SALE DE CONTAR. No hay columna de ordinal y no la va a haber: el bloque de
 * cabecera del PDF lo deriva de la POSICIÓN en la serie, y el ordinal que se imprime en un acto
 * notificado tiene que ser uno solo. La pantalla NO lo calcula ni deja teclearlo.
 *
 * ⚠️ `serieAgotada` ES INFORMATIVO, NO UNA PUERTA. Nada impide registrar una cuarta multa: la
 * escalera DESCRIBE lo que la norma prevé. Con la serie agotada, `ordinalSiguiente` es `null`.
 */
export interface PeldanoCompulsorio {
  /** Cuántas consta que se impusieron. Puede pasar de tres. */
  registradas: number;
  /** Qué ordinal le tocaría a la siguiente, o `null` si la serie del COA ya está agotada. */
  ordinalSiguiente: number | null;
  /** La serie del COA está completa. Informativo: no bloquea nada. */
  serieAgotada: boolean;
  /**
   * ¿Consta el informe que HABILITA el peldaño siguiente? Es lo que cierra la ventana ciega entre el
   * informe desfavorable y la multa.
   */
  incumplimientoConstatadoDespuesDeLaUltimaMulta: boolean;
}

/**
 * Un acto de la serie de diligencias de la ejecución sustitutoria.
 *
 * 🔴 `docId` NO es opcional: sin papel no hay fila. El acta
 * —o la razón del intento fallido— es obligatoria porque este acto termina cobrándose por coactiva.
 */
export interface DiligenciaSustitutoria {
  dsusId: number;
  eejeId: number;
  resultado: ResultadoDiligencia;
  /** En `FALLIDA` el motivo ES el contenido del acto: por qué no se pudo. Siempre viene. */
  motivo: string;
  /** Cadena ISO. */
  actoAt: string;
  registradaBy: number;
  /** El acta de la diligencia, o la razón del intento fallido. Siempre hay una. */
  docId: number;
}

/**
 * El DESGLOSE persistido del costo de la sustitutoria.
 *
 * ⚠️ `total` es gastos + 20 %. **NO es el total adeudado**: el interés legal y la indemnización del
 * art. 239 los liquida la DME a mano, fuera del módulo.
 */
export interface GastoSustitutoria {
  gsusId: number;
  eejeId: number;
  /** La orden `GASTOS_SUSTITUTORIA` que cobra este desglose. */
  ordpId: number;
  base: number;
  /** PUNTOS PORCENTUALES (20.00), no la fracción. Congelado con la orden. */
  recargoPct: number;
  recargoValor: number;
  total: number;
  /** El respaldo documental del COSTO. */
  docId: number;
  /** Cadena ISO. */
  registradoAt: string;
  registradoBy: number;
}

/**
 * El término de alegación del art. 10, DERIVADO EN CADA LECTURA.
 *
 * 🔴 **NINGUNO DE ESTOS CAMPOS ES UNA COLUMNA Y NINGUNO SE GUARDA.** La pantalla los PINTA y **no
 * resta fechas**: los días son HÁBILES y se cuentan contra el calendario de feriados del SERVIDOR.
 * Restar dos cadenas ISO en el navegador daría un número distinto del que el expediente sostiene, y
 * un término que miente en pantalla es peor que no tener término.
 *
 * 🔴 Tampoco se cachea de forma que pueda envejecer: llega calculado al leer, y se vuelve a leer.
 *
 * Viaja en el detalle Y en las cuatro bandejas, por lo que el propio módulo dejó escrito: «si el
 * plazo no se ve, el administrado pierde el derecho porque nadie miró el calendario, no porque no lo
 * pidiera».
 */
export interface TerminoAlegacion {
  estado: EstadoTermino;
  /**
   * La frase que explica POR QUÉ el término no ha arrancado o no corre. Se llena en `SIN_TRASLADO`,
   * `SIN_NOTIFICAR` y `SUSPENDIDO`; cuando el plazo corre no hay nada que excusar y vale `null`.
   */
  motivo: string | null;
  /**
   * Cadena ISO de desde cuándo está suspendido por la impugnación. Solo tiene valor en `SUSPENDIDO`.
   *
   * ⚠️ OPCIONAL a propósito (quick 261028-mtg): el servidor anterior al plan 02 no lo manda, y su
   * ausencia tiene que degradar a «no suspendido». El servidor nuevo lo manda siempre.
   */
  suspendidoDesde?: string | null;
  /**
   * Días HÁBILES que las suspensiones ya CERRADAS corrieron el vencimiento. `venceAt` ya los incluye:
   * la pantalla lo dice, no lo suma. Opcional por lo mismo que `suspendidoDesde`.
   */
  diasHabilesSuspendidos?: number;
  /** La providencia de traslado más reciente del expediente, o `null` si no hay ninguna. */
  trasladoDocId: number | null;
  /** Cadena ISO de cuándo se emitió esa providencia. NO es de donde arranca el plazo. */
  trasladoEmitidoAt: string | null;
  /**
   * 🔴 DE DONDE ARRANCA EL RELOJ: cadena ISO de la fecha en que la notificación del traslado quedó
   * CERRADA, no la de su despacho. El plazo de defensa empieza cuando hay defensa posible.
   */
  arrancaAt: string | null;
  /**
   * El término arrancó porque se AGOTARON los intentos de notificación, no porque alguien la
   * recibiera. Corre igual, pero **se DECLARA**: dar por arrancado un plazo de defensa contra quien
   * no se pudo notificar y no decirlo es otra cosa.
   */
  arrancoPorAgotamiento: boolean;
  /** Días HÁBILES del término. `null` si no ha arrancado. */
  plazoDias: number | null;
  /** Cadena ISO del vencimiento, o `null`. */
  venceAt: string | null;
  vencido: boolean;
  /** Días hábiles que quedan, con el mismo calendario. `null` si ya venció o no ha arrancado. */
  diasHabilesRestantes: number | null;
  /**
   * 🔴 HASTA QUÉ AÑO HAY CALENDARIO DE FERIADOS CARGADO, o `null` si está vacío.
   *
   * Viaja SIEMPRE, incluso cuando el término no ha arrancado. Es lo único que impide que contar sin
   * feriados sea silencioso: quien lee el término tiene derecho a saber con qué contó el sistema.
   */
  calendarioCargadoHasta: number | null;
  /**
   * 🔴 VENCER **HABILITA** LA EMISIÓN DE LA MULTA COMPULSORIA; NO LA DISPARA.
   *
   * DESCRIBE, no acciona: no hay job ni planificador. La multa del art. 240 la emite el DECISOR.
   */
  habilitaMultaCompulsoria: boolean;
  /** El ÚLTIMO escrito de alegación del expediente, o `null` si el administrado no alegó. */
  alegacionDocId: number | null;
  /** Cadena ISO de cuándo entró ese escrito. Es la fecha contra la que se mide todo. */
  alegacionIngresadaAt: string | null;
  /**
   * 🔴 EL TÉRMINO SE USÓ: consta un escrito de alegación POSTERIOR al arranque del término VIGENTE.
   * Una alegación de la vuelta anterior NO es uso del término nuevo.
   */
  terminoUsado: boolean;
  /** Cadena ISO de cuándo se resolvió la alegación, o `null` si sigue sin resolver. */
  alegacionResueltaAt: string | null;
  /**
   * 🔴 HAY UNA DEFENSA SIN CONTESTAR. Consta escrito y NO consta providencia que lo resuelva. Es lo
   * que dispara el aviso al imponer la multa compulsoria — un AVISO, nunca un bloqueo.
   */
  alegacionPendiente: boolean;
}

/**
 * Lo que devuelve `GET /obligacion-hacer/:eejeId`.
 *
 * ⚠️ **ES LA ÚNICA FORMA QUE TRAE EL PELDAÑO.** Ver `ObligacionHacerEnBandeja`.
 */
export interface ObligacionHacerDetalle {
  /**
   * El estado del EPAS (quick 261028-mtg), para que la página juzgue sus actos con el MISMO motor que
   * la bandeja: en EN_IMPUGNACION salen apagados con el motivo de la suspensión. Opcional: el servidor
   * anterior al plan 02 no lo manda, y sin él la página se comporta como siempre.
   */
  eejeStatus?: string | null;
  /** La suspensión abierta por la impugnación, o `null` si no está suspendido. Opcional, ídem. */
  suspensionImpugnacion?: {
    /** Cadena ISO. */
    desde: string;
    estadoPrevio: string;
  } | null;
  obligacionHacer: ObligacionHacer;
  serieCompulsorias: {
    serie: MultaCompulsoria[];
    peldano: PeldanoCompulsorio;
  };
  diligencias: DiligenciaSustitutoria[];
  terminoAlegacion: TerminoAlegacion;
}

/**
 * El bloque compuesto que viaja en la FILA de las cuatro bandejas (`epas-list-item.dto.ts`).
 *
 * 🔴 **ASIMETRÍA DELIBERADA: AQUÍ NO HAY PELDAÑO.** `PeldanoCompulsorio` viaja SOLO en el detalle,
 * porque derivarlo exige contar la serie del expediente y la bandeja no la trae. Consecuencia
 * directa para quien escriba una condición de visibilidad: **cualquier regla que dependa de
 * `peldano.ordinalSiguiente` es INDECIDIBLE sobre una fila de bandeja**, y lo indecidible se apaga —
 * no se adivina. El tipo lo hace visible en vez de dejar que alguien lo suponga: si intenta leer el
 * peldaño de una fila, no compila.
 */
export type ObligacionHacerEnBandeja = ObligacionHacer & {
  terminoAlegacion: TerminoAlegacion;
};

/** Lo que devuelven los cuatro endpoints que solo suben un PDF y crean su documento. */
export interface ResultadoAdjuntarDocumento {
  docId: number;
}

/** Lo que devuelve ordenar la sustitutoria. Puede traer avisos. */
export interface ResultadoOrdenarSustitutoria {
  /**
   * Cuántas multas compulsorias constan en el expediente. Viaja aunque no haya aviso: la pantalla
   * puede pintar «constan 2 de 3» sin volver a preguntar.
   */
  multasCompulsoriasRegistradas: number;
}

/** Lo que devuelve registrar la diligencia. Puede traer avisos. */
export interface ResultadoRegistrarDiligencia {
  dsusId: number;
  /** El acta recién creada. Viaja para que la pantalla pueda enlazarla sin volver a preguntar. */
  docId: number;
}

/**
 * Lo que devuelve ingresar el escrito de alegación.
 *
 * 🔴 NO trae avisos, y no es un olvido: recibir la defensa del administrado no es un acto anómalo.
 */
export interface ResultadoRegistrarAlegacion {
  docId: number;
}

/**
 * Lo que devuelve liquidar los gastos de la sustitutoria (art. 239 COA).
 *
 * 🔴 **LAS CUATRO CIFRAS LAS CALCULA EL SERVIDOR.** La pantalla las pinta tal cual: no multiplica
 * `base` por nada ni suma el recargo por su cuenta. Dos cálculos serían dos importes para una deuda
 * que se cobra por coactiva.
 *
 * ⚠️ `total` es `base + recargoValor` y **NO ES EL TOTAL ADEUDADO**: no incluye el interés legal ni
 * la indemnización del art. 239, que la DME liquida a mano fuera del módulo.
 */
export interface ResultadoGastosSustitutoria {
  /** La orden de pago recién creada, de tipo `GASTOS_SUSTITUTORIA`. */
  ordpId: number;
  /**
   * ¿Se disparó la reapertura del EPAS? `false` NO es un fallo: solo se reabre desde `CUMPLIDO`.
   * Un `false` CON aviso no es lo mismo que uno SIN él.
   */
  epasReabierto: boolean;
  /** Los gastos de la diligencia, tal y como los tecleó el decisor. */
  base: number;
  /** PUNTOS PORCENTUALES (20.00), no la fracción. Se congela con la orden. */
  recargoPct: number;
  /** Lo que el servidor calculó de recargo. Redondeado a dos decimales. */
  recargoValor: number;
  /** `base + recargoValor`. Es lo que se imprime y lo que se notifica. */
  total: number;
}
