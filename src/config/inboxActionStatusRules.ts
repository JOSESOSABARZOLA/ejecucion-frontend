/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend) — EL MOTOR DE ACCIONES
 * Archivo: inboxActionStatusRules.ts
 * Responsabilidad: decir, dado un rol, un estado EPAS y una bolsa de hechos derivados, QUÉ ACCIONES
 *   SE OFRECEN y en qué estado se ofrecen —habilitada, o apagada con su motivo—.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15 (Fase 03.18, D-7 · Opción A)
 * Modificado por: Andrés Miño — 2026-09-21 (entradas del submenú del EPAS que hasta hoy se
 *   gateaban con predicados sueltos, D-11)
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 19, gap 4 del UAT: `aceptarCaso` y
 *   `excusarme` RECUPERAN el gate de la aceptación que el paso a tabla del Plan 17 dejó atrás, y el
 *   comentario que afirmaba una exclusión inexistente pasa a describir el código.)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: `ACCIONES_SUSPENDIDAS_POR_IMPUGNACION`;
 *   con el EPAS EN_IMPUGNACION esas acciones salen visibles y apagadas con el motivo de la suspensión)
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 ANTES DE TOCAR ESTA TABLA, LEA SUS TRES LÍMITES. Están escritos para que no los descubra
 * usted solo, y desarrollados en `docs/motor-de-acciones.md` (siete secciones, con el camino de
 * salida y las cifras de la barrera de fase).
 *
 * 1. ESTE GATE ES COSMÉTICO. El motor decide qué se OFRECE; no decide si el acto se EJECUTA. Eso
 *    lo deciden el `@Roles` del endpoint y las reglas de negocio del backend. Una regla mal
 *    escrita aquí puede ofrecer un botón; JAMÁS puede conceder un acto. Es la misma doctrina que
 *    `entradaGating.ts` ya tenía escrita desde el 2026-07-23: «el gating de UI es CONVENIENCIA,
 *    NO seguridad». Si alguna vez lee un cambio que se salte una comprobación del backend «porque
 *    el motor ya lo impide», está leyendo un fallo de seguridad.
 *
 * 2. LO QUE LA OPCIÓN A NO RESUELVE. Sigue habiendo DOS fuentes de verdad sobre qué se puede
 *    hacer —ésta y la del servidor— y PUEDEN DIVERGIR. A redujo los mecanismos de tres a dos; no
 *    eliminó la duplicación. Y estas reglas NO SON EDITABLES SIN REDESPLIEGUE: son TypeScript
 *    compilado, así que quitar un estado de una regla sí retira la acción de la pantalla, pero
 *    exige desplegar. El destino correcto a largo plazo sigue siendo la Opción D —que el BACKEND
 *    calcule las acciones permitidas y el frontend solo pinte—, porque mata la segunda fuente de
 *    verdad en vez de darle mejor forma. A fue una elección de COSTE, no de arquitectura.
 *
 * 3. NO HAY PANTALLA DE ADMINISTRACIÓN DE REGLAS, Y ES UNA DECISIÓN. Bajo A no hay NADA
 *    administrable en tiempo de ejecución: una pantalla que administre constantes compiladas es
 *    una pantalla sin nada detrás. El motor de Instrucción sí tiene tabla en la base y su
 *    pantalla, y hoy no lo consume nadie, lleva el badge «Solo lectura» y ya divergió de su
 *    propio código. Si algún día hay algo administrable de verdad, el modelo es la Fase 03.13 de
 *    ESTE módulo (guard incluso en la lectura, histórico en la bitácora, actor del JWT).
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
import type { ModalType } from "../interfaces/IModal";
import type { UserActions } from "../interfaces/IUser";
import {
  evaluarCondiciones,
  MOTIVOS_ACCION,
  type CondicionAccion,
  type HechosAccion,
} from "./accionesHechos";

/**
 * Rol operativo con acciones en las bandejas de Ejecución. Reutiliza los roles existentes del backend
 * (@Roles del sorteo.controller): secretario abogado (revisa, sortea y devuelve), director (hace
 * triage de entrada y aprueba lotes), funcionario decisor (se excusa). Se comparan en minúsculas
 * (isInboxActionVisible normaliza).
 *
 * Reparto RECE-08 (decisión del usuario, 2026-07-13) — el director NUNCA envía al sorteo:
 *   DIRECTOR   → aprobarEpas ("aprobar y enviar al secretario", sin cambiar de estado) | DEVOLVER_DMR
 *   SECRETARIO → marcarRevisado (VERIFICAR: RECIBIDO → VERIFICADO) → sortear (lote o individual)
 */
export type InboxRole =
  "secretario abogado" | "director" | "funcionario decisor";

/**
 * Estado EPAS que gatea acciones de bandeja. Espeja EpasState del backend (contrato compartido,
 * en MAYÚSCULAS). Se amplía por fase: RECIBIDO habilita DEVOLVER_DMR (RECE-02/03); VERIFICADO habilita
 * el sorteo (revisado); SORTEADO el lote a aprobar; ASIGNADO_DECISOR la excusa del decisor (Fase 3).
 */
export type InboxActionStatus =
  | "RECIBIDO"
  | "VERIFICADO"
  | "SORTEADO"
  | "ASIGNADO_DECISOR"
  // Fase 03.14.1 (act. 16.2 y 17): los dos estados donde el decisor cierra el expediente.
  | "EN_VERIFICACION_PAGO"
  | "EN_TRABAJO_COMUNITARIO"
  // Fase 03.14.5: la coactiva dejó de ser terminal — desde aquí se puede volver mientras la
  // Administración Zonal no la haya iniciado.
  | "PENDIENTE_COACTIVA";

/**
 * "Revisado" = VERIFICADO. Es el gate del sorteo (RECE-08): solo lo que el secretario marcó revisado
 * se puede sortear. Vive aquí —junto al contrato de estados— porque no lo usa solo la página del
 * sorteo: la cabecera del EXPEDIENTE cuenta cuántos de sus casos están revisados para decir si el
 * expediente COMPLETO es sorteable ("2 revisados · 1 por revisar").
 */
export const EPAS_ESTADO_REVISADO: InboxActionStatus = "VERIFICADO";

/**
 * "Por revisar" = RECIBIDO. Es el gemelo de `EPAS_ESTADO_REVISADO`: lo que el secretario todavía no
 * ha marcado revisado, y por tanto lo que aún no es sorteable.
 *
 * Vive aquí, junto al contrato de estados, porque hoy está DUPLICADO como literal suelto en
 * `SorteoPage` para contar «2 revisados · 1 por revisar». Un literal suelto que espeja un contrato
 * es la forma exacta en la que la Fase 03.15 encontró 2 de 20 consumidores de `eejeStatus`
 * silenciosamente rotos: el campo viaja como `string` y equivocarse no da error de compilación.
 */
export const EPAS_ESTADO_POR_REVISAR: InboxActionStatus = "RECIBIDO";

/**
 * EL UNION DE ACCIONES DEL MÓDULO. Treinta y ocho nombres: los 16 valores de `ModalType` más 22
 * propios (los dos que colisionan —`DEVOLVER_DMR` y `excusarme`— son el MISMO nombre declarado en
 * los dos sitios, y el union los funde en uno).
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SI USTED VIENE A AÑADIR LA ACCIÓN NÚMERO TREINTA Y NUEVE, LEA ESTO PRIMERO.
 *
 * Añadir el nombre aquí NO BASTA y no compilará: `POLITICA_ACCIONES` es un
 * `Record<InboxActionName, PoliticaAccion>` TOTAL, así que TypeScript le va a exigir decidir qué
 * política le corresponde. Esa exigencia es deliberada y es el corazón de D-5: el defecto de este
 * módulo ya NO es «si no está en la tabla, se muestra». Hoy es al revés —sin política, se niega—,
 * y negar significa DESHABILITAR CON SU MOTIVO, no hacer desaparecer (D-7).
 *
 * Hay exactamente TRES políticas posibles, y una de ellas le toca a su acción:
 *
 *   · `regla`   — el motor la gatea por rol, por estado EPAS y/o por hechos derivados. Es lo
 *                 normal. Una regla VACÍA (`{}`) también es una decisión legítima y explícita:
 *                 dice «a esta no la gatea el motor, la gatea quien la abre» —típico de los
 *                 modales que no son acciones de fila: el visor de documentos, la línea de tiempo,
 *                 el detalle del caso—. Regla vacía NO es lo mismo que sin regla: la primera es
 *                 una decisión escrita, la segunda es un olvido, y el compilador solo puede
 *                 distinguirlas si usted la escribe.
 *   · `oculta`  — la ÚNICA excepción a «apagar y no esconder», y solo cabe cuando la acción NO VA
 *                 A SERVIR NUNCA en este módulo: un botón apagado en un sitio donde jamás se
 *                 encenderá solo genera la duda de qué habría que hacer para encenderlo. Hoy la
 *                 tienen `returnMemo` y `returnCases`, heredadas de Resolución y sin un solo
 *                 consumidor en `src/` ni un solo rastro en el backend de Ejecución (medido en la
 *                 Fase 03.18, Plan 04). Si su acción se puede llegar a ofrecer alguna vez, NO es
 *                 ésta la política que le toca.
 *
 * 🔴 HUBO UNA TERCERA, `externa`, Y EL PLAN 09 LA RETIRÓ. Decía: «el gate de esa acción vive en OTRO
 * mecanismo del módulo, y aquí se declara la EXENCIÓN con su porqué», y la tenían las tres firmas
 * del lote, cuyo turno resolvía `loteTurnActions.ts`. Se retiró del union ENTERO, y no solo de esas
 * tres entradas, a propósito: mientras el tipo existiera, cualquiera podría volver a sacar una
 * acción del motor sin un plan que lo respaldara, y D-7 quiere UN mecanismo. Hoy la ausencia de
 * exenciones la impone el compilador.
 *
 * Y `oculta` lleva `porque` OBLIGATORIO: una decisión sin razón escrita es la que alguien deshace
 * dentro de seis meses sin saber qué está deshaciendo.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export type InboxActionName =
  | ModalType
  | "DEVOLVER_DMR"
  // Acciones de la Fase 3 (sorteo): CTAs de página, no modales del registry.
  | "sortear"
  | "aprobarLote"
  | "excusarme"
  // Triage del director (RECE-08) sobre el MEMORANDO recibido: lo pasa al secretario.
  | "enviarSorteo"
  // Triage del director sobre el EXPEDIENTE COMPLETO (RECE-08): la misma decisión (remitir al
  // secretario / devolver a la DMR) tomada sobre el expediente entero, que es como la DMR se lo
  // remite y como el director razona. No sustituyen a las de caso: conviven con ellas.
  | "aprobarExpediente"
  | "devolverExpediente"
  // Triage del director a nivel de EXPEDIENTE (RECE-08): aprueba el EPAS recibido y lo REMITE AL
  // SECRETARIO. NO transiciona (el EPAS sigue RECIBIDO) y NO envía al sorteo — el director nunca
  // sortea. Es el equivalente por expediente del triage `enviarSorteo` del memorando.
  | "aprobarEpas"
  // "Marcar revisado" del SECRETARIO (RECE-08): transición REAL VERIFICAR (RECIBIDO → VERIFICADO).
  // Es el gate del sorteo y es acto del secretario, NO del director.
  | "marcarRevisado"
  // "Cancelar Revisión" del SECRETARIO (RECE-08 inverso): transición REAL DESHACER_VERIFICACION
  // (VERIFICADO → RECIBIDO). Imagen especular de marcarRevisado; saca al caso del set sorteable. Es
  // acto del secretario, NO del director ni del decisor.
  | "desRevisar"
  // ACEPTACIÓN EXPLÍCITA del caso por el funcionario decisor (RECE-06, Fase 3.5): sella
  // epsor_aceptado_at/_by (actor derivado del JWT). Es POR-CASO y SÍ tiene regla en la tabla (su
  // status ASIGNADO_DECISOR es un estado EPAS real). Aceptar/excusar TODOS los casos del sublote es la
  // compuerta advisory para la firma ORDEN-1 (ver resolveDecisorFirmaGate en loteTurnActions.ts).
  | "aceptarCaso"
  // Fase 03.14.1 — el desenlace del EPAS pecuniario, todas del DECISOR y por ESTADO real (a
  // diferencia del turno de firma, que no cabe en esta tabla):
  //   registrarPago                  → EN_VERIFICACION_PAGO
  //   registrarCumplimiento          → EN_TRABAJO_COMUNITARIO
  | "registrarPago"
  | "registrarCumplimiento"
  // Declarar POR DÓNDE se puede notificar al administrado. Del SECRETARIO, y en la Recepción:
  // ver más abajo, en la regla, por qué ahí y no en la bandeja del decisor.
  | "formasNotificacion"
  | "registrarAcogimiento"
  | "solicitarProrroga"
  | "gestionarCoactiva"
  // TURNO DEL LOTE (firma secuencial del acta D2, Fase 3.5; absorbido en el motor por la Fase 03.18,
  // Plan 09). Donde este comentario decía que estos tres nombres se declaraban «solo para TIPAR» y que
  // su gating vivía en loteTurnActions.ts, hoy tienen REGLA como todas. Lo que no cambió es el motivo
  // de aquella frase: el `status` de esta tabla sigue siendo el enum EPAS y sigue sin poder expresar
  // el turno del lote. El turno no entra por `status` — entra por CONDICIONES sobre hechos derivados.
  | "firmarDecisor"
  | "firmarSecretario"
  | "firmarDirector"
  // Acciones heredadas de Resolución, INERTES (sin regla activa) — conservadas para no romper
  // consumidores existentes (assignmentActionConfig) mientras se limpian en su fase (D-02).
  | "returnMemo"
  | "returnCases"
  | "approveAssignment"
  | "denyAssignment"
  // ───────────────────────────────────────────────────────────────────────────────────────────
  // LA RAMA DE LA OBLIGACIÓN DE HACER (Fase 03.18 — HACER-01..HACER-05, PRO-GEJ-001).
  //
  // Diez actos de escritura, uno por endpoint del `obligacion-hacer.controller`, todos
  // `@Roles('funcionario decisor')`. El undécimo, `registrarMultaCompulsoria`, NO es de esos
  // endpoints —la multa va por el camino que ya existía— pero sí era un gate de botón
  // CRUDO: `MultasCompulsoriasExpediente` recibe hoy `permiteRegistrar` en `true` SIEMPRE desde
  // `MisAsignadosPage`, y eso es exactamente la clase de decisión suelta que este motor existe
  // para recoger.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  | "declararHacer"
  | "deshacerHacer"
  | "adjuntarInforme"
  | "acreditarCumplimiento"
  | "constatarIncumplimiento"
  | "registrarAlegacion"
  | "ordenarSustitutoria"
  | "registrarDiligencia"
  | "registrarRespaldoCostos"
  | "registrarGastosSustitutoria"
  | "registrarMultaCompulsoria"
  // LA ENTRADA A LA RAMA. Es la duodécima y NO es un acto: es la puerta de LECTURA, el gate del
  // enlace que lleva a `ObligacionHacerPage` desde la bandeja del decisor.
  //
  // 🔴 EXISTE PORQUE «¿puedo ENTRAR A LEER el correctivo?» NO ES LA MISMA PREGUNTA que «¿procede
  // un acto de la rama?», y confundirlas cerró la rama entera. Hasta la corrección de CR-01 la
  // entrada reutilizaba la regla del acto sobre el sello de clausura —retirado el 2026-10-14—, que
  // exigía `obligacionHacer.tiene === true`;
  // pero la única acción que puede DECLARAR el correctivo —`declararHacer`— sólo se pinta detrás de
  // esa puerta y exige `tiene === false`. Las dos reglas, cada una correcta, se cerraban en círculo:
  // en el único estado en que procedía declarar, la puerta salía apagada, y la rama no se podía
  // abrir por ninguna vía de interfaz.
  | "verObligacionHacer"
  // ───────────────────────────────────────────────────────────────────────────────────────────
  // LAS CUATRO ENTRADAS DEL SUBMENÚ DEL EPAS (Fase 03.19 — D-11, D-12).
  //
  // El `⋮` de la bandeja del decisor ofrecía nueve entradas y CUATRO de ellas no pasaban por este
  // motor: se gateaban con predicados sueltos escritos en la página. Una decisión de permiso que
  // vive fuera de esta tabla es una decisión que nadie puede auditar y que nada obliga a mantener
  // coherente con el backend — es exactamente lo que D-6 de la Fase 03.18 vino a recoger.
  //
  // 🔴 NINGUNA DECLARA `status`, Y NO ES UN OLVIDO. Ninguno de los predicados que sustituyen
  // miraba el estado del EPAS: miraban la ACEPTACIÓN, que no es un estado sino una marca del
  // sorteo —un caso ASIGNADO_DECISOR está aceptado o no lo está, y el enum es el mismo en los dos
  // casos—. Ponerles un `status` sería inventar una máquina de estados que el módulo no tiene, y
  // apagaría el submenú entero en cuanto el expediente avanzara.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  //
  // «Generar documento» (D-12): el antiguo «Emitir providencia», que ahora NAVEGA.
  //
  // 🔴 SIN ESTA ENTRADA EN EL MAPA TOTAL, LA ACCIÓN SALDRÍA APAGADA PARA TODOS. El nombre no
  // estaba en el union, y el defecto en tiempo de ejecución es negar: renombrar la entrada en la
  // pantalla sin darle política aquí habría apagado el acto central de la bandeja el mismo día.
  | "generarDocumento"
  // «Adjuntar documento»: hasta hoy un botón suelto en la cabecera de la card.
  //
  // 🔴 NO ES EL MISMO NOMBRE QUE `anexarDocumento`, Y LA DISTINCIÓN ES LA DE CR-01. Aquél es el
  // MODAL del anexo libre y conserva su regla VACÍA a propósito: la ventana en que se puede anexar
  // la hace cumplir el BACKEND, y replicarla aquí crearía una segunda verdad que puede divergir de
  // la suya. Éste es la ENTRADA del submenú, y lo que decide es DE QUIÉN ES EL PASO. «¿Se abre el
  // formulario?» y «¿procede ofrecer el acto en el menú del decisor?» son dos preguntas, y
  // confundirlas es lo que cerró la rama del correctivo en círculo.
  | "adjuntarDocumento"
  // «Descargar expediente (ZIP)»: certificar el expediente FUERA del módulo. Su gate era
  // `estaAceptado(row)`, suelto en la página. La única condición real —que exista acta
  // definitiva— la sigue imponiendo el backend.
  | "descargarExpediente"
  // «Recursos» (antes «Acciones de impugnación»; reunión 2026-10-16): la entrada que ABRE la pestaña Recursos de la ficha.
  //
  // ⚠️ EL COMPONENTE DE IMPUGNACIÓN NO ES UNA ACCIÓN, ES UN FORMULARIO: tiene estado propio
  // —fichero, respuesta, calificación del recurso— y varios controles, así que NO CABE en una
  // opción del menú y meterlo dentro rompería el portal. Esta entrada solo ABRE; lo que se pueda
  // hacer una vez abierta lo sigue decidiendo el formulario con el estado del EPAS delante.
  | "accionesImpugnacion";

/**
 * La regla de una acción. TRES FILTROS EN CASCADA, evaluados en este orden: rol, estado y
 * condiciones sobre hechos derivados.
 *
 * 🔴 EL ORDEN ES LA CONDUCTA, no una casualidad de implementación: el motivo que se muestra es el
 * del PRIMER filtro que falla, y ése es el más accionable para quien mira la pantalla. Si a un
 * secretario se le dice «el expediente no está en el estado que este paso requiere» cuando el paso
 * ni siquiera es suyo, se le manda a mirar el expediente en vez de a mirar quién debe actuar.
 *
 * 🔴 `condiciones` SE EVALÚA COMO CONJUNCIÓN. Un caso que necesitara alternativa se resuelve con
 * DOS REGLAS, no con un árbol de expresiones: ver `CondicionAccion` en `accionesHechos.ts`.
 */
export type InboxActionStatusRule = {
  roles?: InboxRole[];
  status?: InboxActionStatus | InboxActionStatus[];
  /**
   * Hechos DERIVADOS que el expediente tiene que reunir, además del rol y del estado. Es la segunda
   * dimensión del motor, y es la única que puede gatear la rama de obligación de hacer: esa rama no
   * es una máquina de estados y está escrito que nunca lo será, así que un `status` literal no
   * gatea — abre.
   *
   * Toda clave cuyo hecho NO venga en el contexto apaga la acción con «falta el dato». Nunca se
   * adivina.
   */
  condiciones?: readonly CondicionAccion[];
  /**
   * Motivo propio de esta regla, que sustituye al del catálogo cuando la acción sale apagada. Para
   * los pasos cuya explicación genérica no basta.
   *
   * Sigue sin haber texto inline en las páginas: el texto vive en la TABLA DE REGLAS, que es donde
   * ya vive la razón por la que el botón se apaga.
   */
  motivoPersonalizado?: string;
};

/**
 * La POLÍTICA de una acción: qué decide el módulo sobre ella. Union discriminado de EXACTAMENTE
 * DOS formas, y no hay una tercera a propósito —«no lo he decidido» no es una política—.
 *
 * 🔴 ERAN TRES HASTA EL PLAN 09, que retiró `externa` (la EXENCIÓN declarada para las acciones cuyo
 * gate vivía en otro mecanismo). No queda ninguna: gatear o no gatear se decide AQUÍ.
 *
 * 🔴 `porque` ES OBLIGATORIO en la forma que no es regla. Una decisión sin razón escrita es la que
 * alguien deshace dentro de seis meses sin saber qué está deshaciendo: quien encuentre un botón que
 * no aparece tiene derecho a leer aquí por qué se decidió así y quién lo hereda.
 */
export type PoliticaAccion =
  /**
   * El motor la gatea. La regla puede estar VACÍA (`{}`), y eso también es una decisión: dice «a
   * ésta no la gatea el motor, la gatea quien la abre». Regla vacía NO es lo mismo que sin regla —
   * la primera está escrita, la segunda es un olvido— y el compilador solo puede distinguirlas
   * porque `POLITICA_ACCIONES` es total.
   */
  /**
   * ⟳ 2026-09-29 (quick 260929-kfg) — ADMITE UNA LISTA, y las listas son ALTERNATIVAS (OR).
   *
   * El comentario de `InboxActionStatusRule` ya prometía que «un caso que necesitara alternativa se
   * resuelve con DOS REGLAS», pero el tipo solo admitía una y no había forma de escribirlas. El
   * primer caso real llegó con `descargarExpediente`: el decisor la tiene sobre SUS expedientes YA
   * ACEPTADOS, y el secretario abogado y el director sobre CUALQUIERA —sin condición de
   * aceptación, que es un hecho del decisor sobre su propio caso y para ellos ni viene ni
   * significa nada—.
   *
   * 🔴 SIGUE SIN HABER ÁRBOL DE EXPRESIONES, y es deliberado: dentro de una regla las condiciones
   * son CONJUNCIÓN, y entre reglas hay disyunción. Dos niveles, ninguno anidado. Con eso se
   * escriben los casos reales sin convertir la tabla en un lenguaje.
   */
  | {
      tipo: "regla";
      regla: InboxActionStatusRule | readonly InboxActionStatusRule[];
    }
  /**
   * No se muestra. La ÚNICA excepción a «apagar y no esconder», y solo cabe cuando la acción no va
   * a servir NUNCA en este módulo: un botón apagado en un sitio donde jamás se encenderá solo
   * genera la duda de qué habría que hacer para encenderlo.
   */
  | { tipo: "oculta"; porque: string };

/**
 * 🔴 EL MAPA TOTAL: una política por cada nombre del union, y el compilador lo impone.
 *
 * Éste es el giro de D-5. El defecto de este módulo ERA «si una acción no está en la tabla, se
 * muestra siempre que el backend la entregue» —escrito textualmente donde ahora está este
 * comentario—, y ese defecto convierte el olvido de un desarrollador en una acción ofrecida a todos
 * los roles en todos los estados. Hoy el defecto es el contrario: sin política, se niega. Y negar
 * es DESHABILITAR CON SU MOTIVO (D-7), no hacer desaparecer.
 *
 * `Record<InboxActionName, PoliticaAccion>` y no `Partial<...>`: la totalidad es el gate de
 * compilación. Añadir un nombre al union sin decidir su política NO COMPILA, que es la única forma
 * de que esto no dependa de que alguien se acuerde. El defecto en tiempo de EJECUCIÓN sigue
 * existiendo —apagar con motivo— para la cadena que ni siquiera esté en el union.
 *
 * 🔴 Y ES LA ÚNICA LISTA. `INBOX_ACTION_STATUS_RULES` y `ACCIONES_OCULTAS` se DERIVAN de aquí. Dos
 * listas de reglas en el mismo módulo es exactamente el fallo que Instrucción tiene hoy —tres
 * acciones en su código que no están en su seed, y dos sembradas con trece estados que su código
 * oculta en todos—: no se reproduce aquí.
 */
export const POLITICA_ACCIONES: Record<InboxActionName, PoliticaAccion> = {
  // ───────────────────────────────────────────────────────────────────────────────────────────
  // (1) LAS 18 CON REGLA VIGENTE. Copiadas TAL CUAL de la tabla anterior: esta parte del archivo
  // no cambia ni una condición, solo cambia de casa. Es lo que hace que la anti-regresión de 432
  // celdas siga verde.
  // ───────────────────────────────────────────────────────────────────────────────────────────

  // "Aprobar y enviar al secretario" (triage del DIRECTOR, nivel EPAS): solo el director, sobre el
  // EPAS RECIBIDO. Aprobar NO es transicionar: el EPAS SIGUE en RECIBIDO y solo se sella la marca de
  // remisión (eeje_director_approved_at) — el director NO verifica y NO sortea. Como el estado no
  // cambia, la acción no se oculta sola: la bandeja del director filtra por `directorApproved=false`
  // para que el expediente ya remitido desaparezca de su cola de triage.
  aprobarEpas: { tipo: "regla", regla: { roles: ["director"], status: "RECIBIDO" } },
  // Triage del DIRECTOR sobre el EXPEDIENTE COMPLETO (RECE-08). Deliberadamente SIN `status`: el
  // expediente no tiene estado propio — lo tienen sus CASOS. Aquí solo se gatea el ROL; qué casos son
  // elegibles (y por tanto si la acción va habilitada o deshabilitada-con-motivo) lo decide el
  // consumidor evaluando la regla POR CASO (aprobarEpas / DEVOLVER_DMR) sobre cada caso del grupo.
  // Así ambos niveles gatean con la MISMA máquina y no pueden divergir.
  aprobarExpediente: { tipo: "regla", regla: { roles: ["director"] } },
  devolverExpediente: { tipo: "regla", regla: { roles: ["director"] } },
  // "Marcar revisado" (RECE-08): acto del SECRETARIO sobre lo que el director le remitió. Es la
  // transición REAL VERIFICAR (RECIBIDO → VERIFICADO) y es el gate del sorteo. El director NO la ve
  // (el backend además le responde 403: EPAS_ACTION_ROLES.VERIFICAR = ['secretario abogado']).
  marcarRevisado: {
    tipo: "regla",
    regla: { roles: ["secretario abogado"], status: "RECIBIDO" },
  },
  // "Cancelar Revisión" (RECE-08 inverso): imagen especular de marcarRevisado. Solo el SECRETARIO, y solo
  // sobre lo YA revisado (VERIFICADO): revertir el revisado devuelve el caso a RECIBIDO y lo saca del
  // sorteo. El director/decisor no la ven (el backend además responde 403:
  // EPAS_ACTION_ROLES.DESHACER_VERIFICACION = ['secretario abogado']).
  desRevisar: {
    tipo: "regla",
    regla: { roles: ["secretario abogado"], status: "VERIFICADO" },
  },
  // Devolver a DMR: visible para el secretario cuando el EPAS está RECIBIDO (RECE-02/03) o
  // VERIFICADO (bandeja de sorteo, cuando NO se marcó revisado — UI-SPEC gate revisado). También
  // para el DIRECTOR: en su triage de entrada puede devolver el expediente en vez de aprobarlo
  // (misma ruta DEVUELTO_DMR, mismo modal). El backend ya lo permite: PATCH /epas/:id/transition
  // está gateado con @Roles('secretario abogado', 'director', 'funcionario decisor').
  DEVOLVER_DMR: {
    tipo: "regla",
    regla: {
      roles: ["secretario abogado", "director"],
      status: ["RECIBIDO", "VERIFICADO"],
    },
  },
  // Devolver lote a la DMR (acción de página): visible solo para el secretario (RECE-02).
  returnBatchDmr: {
    tipo: "regla",
    regla: { roles: ["secretario abogado"], status: "RECIBIDO" },
  },
  // Sortear (RECE-08, D-11): SOLO el secretario, y solo con el expediente revisado (= VERIFICADO,
  // que él mismo produjo al marcarlo revisado). Vale tanto para el lote (varios seleccionados) como
  // para el envío individual. El DIRECTOR nunca sortea: POST /sorteo es @Roles('secretario abogado').
  sortear: {
    tipo: "regla",
    regla: { roles: ["secretario abogado"], status: "VERIFICADO" },
  },
  // Aprobar lote → asienta el acta D2 (D-04): solo el director, con el lote SORTEADO.
  aprobarLote: { tipo: "regla", regla: { roles: ["director"], status: "SORTEADO" } },
  // Excusarme (RECE-07): solo el decisor asignado, con el EPAS ASIGNADO_DECISOR, y solo mientras el
  // caso siga sin aceptar y sin excusa esperando al director.
  //
  // 🔴 EL GATE DE LA ACEPTACIÓN NO SE AÑADE: SE RESTITUYE (Fase 03.19, Plan 19 — gap 4 del UAT del
  // 2026-09-22). La versión de TARJETAS de la bandeja lo tenía escrito a mano en `renderHeader`
  // (`git show 3f87a5f^:src/pages/MisAsignadosPage.tsx`, líneas 536-552):
  //
  //     aceptarVisible = isInboxActionVisible("aceptarCaso", row.eejeStatus, rolName)
  //                      && !aceptado && !excusaPendiente
  //     excusarVisible = isInboxActionVisible(EXCUSARME,     row.eejeStatus, rolName)
  //                      && !aceptado && !excusaPendiente
  //
  // con `aceptado = row.aceptado ?? row.aceptadoImplicito ?? false`. El paso a tabla del Plan 17
  // trasladó al `⋮` la mitad de rol y estado y dejó atrás el resto del predicado, y como aceptar NO
  // cambia el estado del EPAS —`ASIGNADO_DECISOR` está aceptado o no lo está y el enum es el mismo—,
  // un gate escrito solo con rol y estado nunca deja de cumplirse: las dos se ofrecían para siempre.
  //
  // 🔴 LAS DOS CONDICIONES VAN EN LAS DOS REGLAS, y la autoridad es aquel predicado, que exigía
  // `!excusaPendiente` también para ACEPTAR. El propio DTO lo declara: `excusaPendiente` es «true si
  // el decisor se excusó y el director aún NO resolvió la excusa: oculta Excusar/Aceptar»
  // (`SorteoService.ts:125`). Con una excusa en manos del director, el caso no está esperando una
  // aceptación.
  //
  // 🔴 EL ORDEN DE LAS DOS CONDICIONES ES CONDUCTA, NO ESTÉTICA. `resolverRegla` pinta el motivo de
  // la PRIMERA condición incumplida, y cuando el caso ya está aceptado lo accionable que hay que
  // decir es eso y no la excusa.
  //
  // 🔴 SIN `motivoPersonalizado`, y no por ahorro: `resolverRegla` lo aplica a TODOS los apagados
  // —`regla?.motivoPersonalizado ?? motivo`—, incluidos el de rol y el de estado, y estas dos SÍ
  // gatean por los dos. Un secretario leería el texto de la aceptación en lugar de «Su rol no
  // interviene en este paso», y hay pruebas vigentes que fijan ese orden porque el orden de los
  // filtros ES la conducta. Por eso la condición se dice con una clave declarada EN POSITIVO
  // (`epas.sinAceptar`) en vez de con `{ hecho: "epas.aceptado", es: false }`.
  //
  // 🔴 LA ÚNICA CELDA EN QUE EL MOTOR SE APARTA DEL PREDICADO HISTÓRICO: aquél hacía `?? false` y
  // trataba «no lo sé» como «no» —ofrecía Aceptar—; el motor lo trata como INDECIDIBLE y apaga con
  // `DATO_AUSENTE`. Es la misma decisión que el Plan 11 tomó para las tres vecinas y se sostiene en
  // lo mismo: el backend deriva `aceptado` en SQL sobre `t_epas_sorteo` con `epsor_sorteo_at`,
  // `epsor_plazo_dias` y `epsor_is_active` NOT NULL (`sorteo.repository.ts:558-566`), así que envía
  // SIEMPRE un booleano y esa celda no se puede dar con el backend vigente.
  //
  // 🔴 Y SIGUE SIENDO CONVENIENCIA, NO AUTORIZACIÓN. El backend ya rechazaba las dos: `aceptarCaso`
  // sella con `AND epsor_aceptado_at IS NULL` —idempotente— y `excusar` tiene `estaAceptado(cassId)`
  // como gate («un caso ya aceptado no puede excusarse»). La pantalla deja de ofrecer un acto que el
  // servidor ya negaba: menos 400 sin explicación, no menos control.
  excusarme: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      status: "ASIGNADO_DECISOR",
      condiciones: [
        { hecho: "epas.sinAceptar", es: true },
        { hecho: "epas.sinExcusaPendiente", es: true },
      ],
    },
  },
  // Fase 03.14.1: el decisor resuelve el pago (act. 16.2) o cierra el trabajo comunitario (act. 17).
  // El gate por estado es CONVENIENCIA — el backend rechaza fuera de estado y fuera de rol—, pero
  // evita ofrecer un acto que va a fallar.
  registrarPago: {
    tipo: "regla",
    regla: { roles: ["funcionario decisor"], status: "EN_VERIFICACION_PAGO" },
  },
  registrarCumplimiento: {
    tipo: "regla",
    regla: { roles: ["funcionario decisor"], status: "EN_TRABAJO_COMUNITARIO" },
  },
  // Fase 03.14.2 (act. 16): la respuesta del administrado se recoge mientras el expediente está en
  // verificación de pago, que es el precedente 7.2 del procedimiento. El «no» no lo saca de ahí.
  registrarAcogimiento: {
    tipo: "regla",
    regla: { roles: ["funcionario decisor"], status: "EN_VERIFICACION_PAGO" },
  },
  // Fase 03.14.4: la solicitud de prórroga se registra mientras el trabajo comunitario está en
  // curso. Que además llegue a tiempo —antes del vencimiento— lo comprueba el backend con la fecha
  // real: esta tabla solo sabe de estados, y un plazo no es un estado.
  solicitarProrroga: {
    tipo: "regla",
    regla: { roles: ["funcionario decisor"], status: "EN_TRABAJO_COMUNITARIO" },
  },
  // Fase 03.14.5: el tramo de la coactiva —marcar que la Zonal inició, y la baja mientras no lo
  // haya hecho—. Si YA está iniciada, el modal lo dice y no ofrece la baja: esa condición depende
  // de un dato del expediente y esta tabla solo sabe de estados.
  gestionarCoactiva: {
    tipo: "regla",
    regla: { roles: ["funcionario decisor"], status: "PENDIENTE_COACTIVA" },
  },
  // Aceptar caso (RECE-06, Fase 3.5): SOLO el funcionario decisor, con el EPAS ASIGNADO_DECISOR. Es la
  // ÚNICA acción de aceptación/firma que entra en esta tabla (gate por-caso, status EPAS real). El TURNO
  // DEL LOTE (firmar*) NO va aquí: ver su exención declarada más abajo.
  //
  // Sus dos condiciones son las MISMAS que las de `excusarme` y por el mismo motivo: el predicado
  // histórico que el Plan 17 dejó atrás las exigía en las dos. El porqué entero, con el commit y con
  // la única celda en que el motor se aparta de aquel predicado, está sobre `excusarme`.
  aceptarCaso: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      status: "ASIGNADO_DECISOR",
      condiciones: [
        { hecho: "epas.sinAceptar", es: true },
        { hecho: "epas.sinExcusaPendiente", es: true },
      ],
    },
  },
  // Formas de notificación desde el SECRETARIO (pedido del área usuaria, 2026-08-28). El backend ya
  // lo permitía —`notificacion.controller.ts` declara los tres roles en todos los endpoints de
  // formas, porque «el dato lo trae quien atienda al administrado»—: lo que faltaba era la pantalla,
  // que solo se abría desde la bandeja del DECISOR.
  //
  // 🔴 Y ES EL MOMENTO CORRECTO, no solo un permiso que sobraba. Las formas nacen todas en «no»;
  // mientras nadie las declare, cada providencia que se emite crea su notificación SIN despachos:
  // el acto existe, nadie queda notificado y NINGÚN plazo arranca (D-12; medido el 2026-08-20:
  // 0 de 17 administrados las tenían). Declararlas en RECEPCIÓN es declararlas ANTES de que haya
  // una providencia que despachar, en vez de descubrir el hueco cuando ya se emitió.
  //
  // Solo el secretario a propósito: es lo que se pidió. El backend admite también al director, así
  // que sumarlo es añadir su rol a esta lista y nada más.
  formasNotificacion: {
    tipo: "regla",
    regla: {
      roles: ["secretario abogado"],
      status: ["RECIBIDO", "VERIFICADO"],
    },
  },
  // Triage del MEMORANDO (RECE-08): solo el director, sobre el memorando en estado de triage. Lo
  // pasa al secretario (el memorando queda 'en sorteo' = "en manos del secretario"); el director no
  // dispara el sorteo. El docStatus ('recibido') se normaliza a MAYÚSCULAS por isInboxActionVisible
  // y coincide con "RECIBIDO"; tras el triage pasa a 'en sorteo' y la acción se oculta sola.
  enviarSorteo: { tipo: "regla", regla: { roles: ["director"], status: "RECIBIDO" } },

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // (2) LAS QUE EL MOTOR NO GATEA: REGLA VACÍA, QUE ES UNA DECISIÓN Y NO UN OLVIDO.
  //
  // Son los valores de `ModalType` que NO son acciones de fila —el visor de documentos, la línea de
  // tiempo, el detalle del caso, «resolver hasta»— y los modales que abre directamente una página
  // con `openModal(...)`, sin pasar por el evaluador. A éstas las gatea QUIEN LAS ABRE: el botón que
  // las lanza ya decidió que procedían, y el backend decide aparte qué actividades entrega en
  // `user.actividades`.
  //
  // 🔴 POR QUÉ REGLA VACÍA Y NO OCULTAR. Medido en la Tarea 1: varias de éstas SÍ llegan al
  // evaluador cuando el backend las entrega como actividad —`CollapseInboxDocument` filtra la lista
  // entera de acciones del documento con `isInboxActionVisible`—. Ocultarlas o apagarlas al invertir
  // el defecto las habría hecho desaparecer el mismo día, que es justo lo que el criterio de
  // aceptación de D-5 prohíbe.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  caseReview: { tipo: "regla", regla: {} },
  // Ficha del expediente de la Bandeja de Entrada (reunión del 2026-09-16, punto 5). Regla VACÍA
  // como su hermana `caseReview`: es una LECTURA — abrir un expediente para mirarlo no depende del
  // rol ni del estado, y quien no deba verlo no llega a esta bandeja. Está aquí porque el `Record`
  // es total y no compila sin ella, no porque haya una condición que decidir.
  expedienteLote: { tipo: "regla", regla: {} },
  timeLine: { tipo: "regla", regla: {} },
  resolveUntil: { tipo: "regla", regla: {} },
  documentViewer: { tipo: "regla", regla: {} },
  sendCasesToAssignment: { tipo: "regla", regla: {} },
  docsGenerate: { tipo: "regla", regla: {} },
  seeExtendedCases: { tipo: "regla", regla: {} },
  delegateForReview: { tipo: "regla", regla: {} },
  delegateForAssignment: { tipo: "regla", regla: {} },
  seeAssignmentResults: { tipo: "regla", regla: {} },
  actaDatos: { tipo: "regla", regla: {} },
  firmaActa: { tipo: "regla", regla: {} },
  resultadosSorteos: { tipo: "regla", regla: {} },
  // «Adjuntar documento» (quick 260917-anx). Regla VACÍA a propósito: la ventana en que se puede
  // anexar (desde que hay decisor asignado hasta la remisión a SG) la hace cumplir el BACKEND, y
  // replicarla aquí crearía una segunda verdad que puede divergir de la suya. La página que pinta
  // el botón decide si lo ofrece; el modal enseña el motivo que devuelve el servidor cuando no.
  anexarDocumento: { tipo: "regla", regla: {} },

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // (3) LAS TRES FIRMAS DEL LOTE: REGLA, YA NO EXENCIÓN (Fase 03.18, Plan 09).
  // ───────────────────────────────────────────────────────────────────────────────────────────
  //
  // 🔴 QUÉ DECÍA ESTA NOTA Y POR QUÉ SIGUE SIENDO CIERTA. Hasta el Plan 09 estas tres llevaban
  // `tipo: "externa"` con este porqué, escrito el 2026-07-23 y copiado aquí literalmente:
  //
  //     «El turno de la firma del acta D2 se deriva del estado del acta y de las marcas de firma,
  //      no del estado EPAS: lo resuelve resolveLoteTurnActions. El Plan 09 lo absorbe en el motor.»
  //
  // La afirmación de fondo —que el `status` de ESTA tabla es el enum EPAS y no puede expresar el
  // turno del lote— NO se contradice: sigue siendo verdad y por eso ninguna de las tres declara
  // `status`. Lo que cambió no es la afirmación, es el MECANISMO: cuando se escribió, la tabla solo
  // sabía gatear por rol y por estado. El Plan 01 de esta fase le añadió una segunda dimensión
  // —CONDICIONES SOBRE HECHOS DERIVADOS— y el turno es exactamente esa clase de condición. No entra
  // por `status`; entra por `condiciones`.
  //
  // 🔴 LA SECUENCIA, TRASLADADA DEL JSDoc ORIGINAL DE `resolveLoteTurnActions`, palabra por palabra:
  //     - funcionario decisor  → firmarDecisor     si estado==='PENDIENTE' && !firmaDecisorAt
  //     - secretario abogado   → firmarSecretario  si estado==='PARCIALMENTE_FIRMADO'
  //                              && !!firmaDecisorAt && !firmaSecretarioAt
  //     - director             → firmarDirector    si estado==='PARCIALMENTE_FIRMADO'
  //                              && !!firmaSecretarioAt && !aprobadoAt
  // `APROBADO` / `RECHAZADO` (y el estado ausente) no habilitan a nadie: ninguna condición de estado
  // se satisface. Un rol fuera de su turno, o desconocido, tampoco: el filtro de rol lo apaga. Es el
  // mismo «default deny» de antes, ahora dicho con el lenguaje del motor.
  //
  // 🔴 EL GATING DE UI ES CONVENIENCIA, NO SEGURIDAD, y eso tampoco cambió: el backend deriva orden
  // y actor del JWT y rechaza fuera de turno (T-3.4-18 / T-3.5-05). Estas reglas solo deciden qué
  // botón se enciende.
  //
  // 🔴 POR QUÉ LAS TRES LLEVAN `motivoPersonalizado`. Las plantillas del catálogo están redactadas en
  // indicativo AFIRMATIVO («esta acción solo procede si consta la firma del decisor»), y dos de estas
  // condiciones son NEGATIVAS —«que NO conste todavía»—: el motivo saldría del revés y le diría al
  // decisor que le falta su propia firma para poder firmar. Lo que un funcionario necesita leer aquí
  // no es qué hecho falló, sino DE QUIÉN es el paso y en qué orden va.
  firmarDecisor: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "lote.estado", es: "PENDIENTE" },
        { hecho: "lote.firmaDecisor", es: false },
      ],
      motivoPersonalizado:
        "La orden-1 del acta la firma el funcionario decisor, y solo mientras el acta siga pendiente y él no la haya firmado. La secuencia es decisor → secretario → director.",
    },
  },
  firmarSecretario: {
    tipo: "regla",
    regla: {
      roles: ["secretario abogado"],
      condiciones: [
        { hecho: "lote.estado", es: "PARCIALMENTE_FIRMADO" },
        { hecho: "lote.firmaDecisor", es: true },
        { hecho: "lote.firmaSecretario", es: false },
      ],
      motivoPersonalizado:
        "La orden-2 del acta la firma el secretario abogado, y solo después de la firma del decisor. La secuencia es decisor → secretario → director.",
    },
  },
  firmarDirector: {
    tipo: "regla",
    regla: {
      roles: ["director"],
      condiciones: [
        { hecho: "lote.estado", es: "PARCIALMENTE_FIRMADO" },
        { hecho: "lote.firmaSecretario", es: true },
        { hecho: "lote.aprobado", es: false },
      ],
      // SOLO LA ORDEN-3 APRUEBA: es la única de las tres que cierra el lote.
      motivoPersonalizado:
        "La orden-3 del acta la firma el director, que es quien la aprueba, y solo después de la firma del secretario. La secuencia es decisor → secretario → director.",
    },
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // (4) LAS HEREDADAS DE RESOLUCIÓN. Cuatro nombres, DOS decisiones distintas, y la diferencia
  // salió de MEDIR quién las consume, no de suponerlo (Tarea 1).
  // ───────────────────────────────────────────────────────────────────────────────────────────
  //
  // 🔴 `approveAssignment` y `denyAssignment` NO SON INERTES. `ModalAssignmentResult` SÍ es
  // alcanzable en Ejecución: `BandejaEntradaPage.handleVerResultado` lo abre con
  // `openModal("seeAssignmentResults", ...)` desde el botón «Ver resultado» del lote sorteado. Y
  // dentro de ese modal, `isStepperVisible()` llama a `isInboxActionVisible("approveAssignment", …)`
  // para decidir si se pinta el stepper, además de filtrar con el evaluador las actividades que el
  // backend entrega con `actiContext === "seeAssignmentResults"`. Ocultarlas —o apagarlas— habría
  // hecho desaparecer ese stepper al invertir el defecto.
  //
  // Se les da REGLA VACÍA y no una regla de rol o de estado porque el dato con el que se gatearían
  // es el `docStatus` del LOTE ('recibido' / 'en sorteo' / 'aprobado' / 'rechazado'), que no es un
  // `InboxActionStatus` y no cabe en esta tabla. Inventarle un rol («solo el director aprueba»)
  // apagaría el stepper para el secretario que consulta el resultado, y eso no está medido ni
  // pedido. Quien las gatea de verdad es el backend con las actividades que entrega. Su limpieza
  // definitiva es la fase D-02.
  approveAssignment: { tipo: "regla", regla: {} },
  denyAssignment: { tipo: "regla", regla: {} },
  //
  // 🔴 `returnMemo` y `returnCases` SÍ SON INERTES, y se OCULTAN. Evidencia: cero apariciones en
  // todo `src/` fuera de esta declaración —ninguna pantalla las inyecta, ningún registro las
  // define, `assignmentActionConfig` solo conoce approve/deny— y cero apariciones en
  // `ejecucion-backend/src`, que es quien tendría que entregarlas como actividad.
  //
  // Es la excepción deliberada a «apagar y no esconder»: apagadas solo generarían la duda de qué
  // habría que hacer para encenderlas, y la respuesta es «nada, este módulo no las tiene».
  returnMemo: {
    tipo: "oculta",
    porque:
      "Heredada de Resolución. Medido en la Fase 03.18 Plan 04: cero consumidores en src/ del frontend y cero rastro en ejecucion-backend/src. Nunca va a servir en Ejecución, y un botón apagado que jamás se encenderá solo genera la duda de cómo encenderlo. Se elimina en la fase D-02.",
  },
  returnCases: {
    tipo: "oculta",
    porque:
      "Heredada de Resolución. Medido en la Fase 03.18 Plan 04: cero consumidores en src/ del frontend y cero rastro en ejecucion-backend/src. Nunca va a servir en Ejecución, y un botón apagado que jamás se encenderá solo genera la duda de cómo encenderlo. Se elimina en la fase D-02.",
  },
  // ───────────────────────────────────────────────────────────────────────────────────────────
  // (5) LA RAMA DE LA OBLIGACIÓN DE HACER. Doce reglas de ACTO, todas del DECISOR, todas SIN
  // `status`, más la decimotercera regla que gatea LA ENTRADA a la pantalla (`verObligacionHacer`).
  //
  // 🔴 POR QUÉ NINGUNA LLEVA `status`, Y NO ES UN OLVIDO. Lo declara el muro del propio
  // `obligacion-hacer.interface.ts` del backend: «ESTA RAMA NO ES UNA MÁQUINA DE ESTADOS… mientras
  // el expediente lleve correctivo, todas las acciones están disponibles siempre», y
  // `EN_EJECUCION_HACER` «no se cableará nunca». Un estado EPAS aquí no gatea: ABRE. Poner un
  // `status` sería inventar una máquina de estados que el módulo decidió no tener, y apagaría los
  // botones en cuanto el expediente pasara a cualquier otro estado.
  //
  // 🔴 EL ROL SALE DEL CONTROLADOR, NO DE UNA PREFERENCIA: los once endpoints de escritura de
  // `obligacion-hacer.controller.ts` son `@Roles('funcionario decisor')`. Las cuatro lecturas
  // admiten los tres roles, y por eso la ÚNICA acción de lectura de esta lista —`verObligacionHacer`,
  // la puerta de la pantalla— lleva esos tres y ninguna condición sobre hechos.
  //
  // Y el gate sigue siendo COSMÉTICO: quien decide de verdad es el backend con sus `@Roles` y su
  // `assertEsSuDecisor`. Esta tabla lo aproxima para no ofrecer un acto que va a fallar.
  // ───────────────────────────────────────────────────────────────────────────────────────────

  // Declarar que la resolución impuso un correctivo. 🔴 Es la ÚNICA de las doce que exige que el
  // expediente NO lo lleve todavía: es la que lo declara, y exigirle lo contrario la haría
  // inalcanzable para siempre.
  declararHacer: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [{ hecho: "obligacionHacer.tiene", es: false }],
    },
  },
  // Deshacer la declaración. Lleva correctivo y no está cumplida: deshacer lo ya cumplido borraría
  // el rastro de un hecho que ocurrió, y este módulo pasó de impedir a REGISTRAR FIELMENTE.
  deshacerHacer: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "obligacionHacer.tiene", es: true },
        { hecho: "obligacionHacer.cumplida", es: false },
      ],
    },
  },
  // Adjuntar el informe técnico del control de verificación (`ObligacionHacer.tieneInforme`).
  adjuntarInforme: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [{ hecho: "obligacionHacer.tiene", es: true }],
    },
  },
  // Acreditar el cumplimiento. 🔴 EXIGE EL INFORME: el endpoint pide `docId`, y sin informe no hay
  // documento que citar — ofrecer el botón sería ofrecer un acto que no se puede completar.
  acreditarCumplimiento: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "obligacionHacer.tiene", es: true },
        { hecho: "obligacionHacer.tieneInforme", es: true },
        { hecho: "obligacionHacer.cumplida", es: false },
      ],
    },
  },
  // Constatar el incumplimiento: lo contrario de acreditar, y por eso presupone no cumplida.
  constatarIncumplimiento: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "obligacionHacer.tiene", es: true },
        { hecho: "obligacionHacer.cumplida", es: false },
      ],
    },
  },
  // Registrar el escrito de alegación del administrado. Solo con el término EN CURSO: antes del
  // traslado no hay término que usar, y `TerminoAlegacion.estado` es el hecho que el backend deriva
  // precisamente para eso.
  registrarAlegacion: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "obligacionHacer.tiene", es: true },
        { hecho: "obligacionHacer.terminoAlegacion.estado", es: "EN_CURSO" },
      ],
    },
  },
  // Ordenar la ejecución sustitutoria: solo mientras la obligación siga sin cumplirse.
  ordenarSustitutoria: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "obligacionHacer.tiene", es: true },
        { hecho: "obligacionHacer.cumplida", es: false },
      ],
    },
  },
  // Registrar una diligencia de la sustitutoria.
  //
  // 🔴 NO SE CONDICIONA SOBRE `sustitutoriaOrdenada`, Y ES DELIBERADO. El backend, ante una
  // diligencia sin sustitutoria ordenada, AVISA y NUNCA BLOQUEA: devuelve la advertencia como dato
  // de éxito. Convertir esa advertencia en una puerta cerrada sería reimplementar en pantalla una
  // regla que el servidor decidió no tener —y la pantalla perdería el caso real que la advertencia
  // existe para cubrir: la diligencia que se ejecutó antes de que la orden constara registrada—.
  registrarDiligencia: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [{ hecho: "obligacionHacer.tiene", es: true }],
    },
  },
  // Respaldo de costos y gastos de la sustitutoria: éstos SÍ exigen la orden, porque sin
  // sustitutoria ordenada no hay costo que trasladar al administrado (art. 239).
  registrarRespaldoCostos: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "obligacionHacer.tiene", es: true },
        { hecho: "obligacionHacer.sustitutoriaOrdenada", es: true },
      ],
    },
  },
  registrarGastosSustitutoria: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "obligacionHacer.tiene", es: true },
        { hecho: "obligacionHacer.sustitutoriaOrdenada", es: true },
      ],
    },
  },
  // Registrar la multa compulsoria del art. 240. Se apoya en el booleano que el servidor ya derivó
  // —`habilitaMultaCompulsoria`— en vez de comparar el enum del término, para no reimplementar en
  // la pantalla una regla que el backend ya decidió.
  //
  // 🔴 HABILITA; NO LA DISPARA. La frase es del propio interface del backend: no hay job, no hay
  // planificador y nadie emite nada por su cuenta. Este hecho solo le dice al decisor que el plazo
  // de defensa se cumplió y que ya PUEDE imponerla. Esta condición abre un botón; jamás ejecuta un
  // acto.
  //
  // 🔴 Y NO SE CONDICIONA SOBRE EL PELDAÑO. `PeldanoCompulsorio` NO VIAJA EN LAS BANDEJAS —solo en
  // `GET /obligacion-hacer/:eejeId`—, así que una condición sobre él quedaría INDECIDIBLE en la
  // fila y apagaría el botón en la única pantalla donde hoy se usa. Además `serieAgotada` es
  // INFORMATIVO y no una puerta: nada impide registrar una cuarta multa, porque si la DME la
  // impuso, el hecho ocurrió. El peldaño se PINTA como información en la página de la rama
  // (Plan 07); no es puerta.
  registrarMultaCompulsoria: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "obligacionHacer.tiene", es: true },
        {
          hecho: "obligacionHacer.terminoAlegacion.habilitaMultaCompulsoria",
          es: true,
        },
      ],
    },
  },
  // ENTRAR A LEER EL CORRECTIVO. Los tres roles que admiten las cuatro lecturas del controlador.
  //
  // 🔴 NO CONDICIONA SOBRE `obligacionHacer.tiene`, Y ES EL CORAZÓN DE LA CORRECCIÓN (CR-01). Ésta
  // es la única puerta desde la que se DECLARA el correctivo —`declararHacer` sólo se pinta dentro
  // de `ObligacionHacerPage`—, así que exigir que el correctivo ya exista para poder entrar la haría
  // inalcanzable para siempre. Es la misma razón, en espejo, por la que `declararHacer` exige
  // `tiene === false`.
  //
  // 🔴 Y TAMPOCO CONDICIONA SOBRE EL DATO. Una condición sobre `obligacionHacer.tiene` quedaría
  // además INDECIDIBLE en las filas que no traen el bloque, y apagaría la puerta con «falta el dato»
  // justo donde el decisor necesita entrar. Se verificó contra
  // `obligacion-hacer.service.ts` que `GET /obligacion-hacer/:eejeId` NO falla para un expediente
  // sin correctivo: devuelve `tiene: false` y la pantalla funciona. Entrar a leer siempre es legítimo;
  // lo que se pueda hacer una vez dentro lo siguen decidiendo las doce reglas de acto.
  verObligacionHacer: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor", "secretario abogado", "director"],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // (6) LAS CUATRO ENTRADAS DEL SUBMENÚ DEL EPAS (Fase 03.19, Plan 11 — D-11, D-12).
  //
  // Las cuatro decisiones que hasta hoy se tomaban FUERA del motor, con predicados sueltos de
  // `MisAsignadosPage`. Aquí no se cambia ninguna: se TRASLADAN, y su paridad contra los
  // predicados originales —copiados a mano, celda a celda sobre las doce formas que puede tener
  // una fila— la mide `politicaAcciones.test.ts`.
  //
  // 🔴 LAS CUATRO SON DEL DECISOR Y NINGUNA DECLARA `status`. El rol sale de la bandeja en la que
  // viven: el `⋮` es el del funcionario decisor sobre SUS expedientes. Y lo que las gatea no es el
  // estado del EPAS sino la ACEPTACIÓN, que es un hecho derivado y no un estado —ver
  // `epas.aceptado` en el catálogo de hechos—.
  //
  // 🔴 Y EL GATE SIGUE SIENDO COSMÉTICO. Quien decide de verdad es el backend con sus `@Roles` y
  // sus reglas de negocio; esta tabla lo aproxima para no ofrecer un acto que va a fallar.
  // ───────────────────────────────────────────────────────────────────────────────────────────

  // «Generar documento» (D-12) — el antiguo «Emitir providencia», que ahora navega a su página.
  //
  // Su gate era `puedeEmitirProvidencia(row)`: aceptado y sin excusa pendiente. Las dos mitades
  // siguen aquí, cada una como su condición, y con las dos claves declaradas EN POSITIVO para que
  // el motivo que se pinta salga en indicativo afirmativo y no del revés.
  //
  // 🔴 LA SEGUNDA MITAD NO SOBRA, Y DESDE EL 2026-09-22 YA NO SE APOYA EN NADA QUE NO EXISTA. Este
  // comentario decía: «En la pantalla, aceptar y excusarse se excluyen: la excusa solo se ofrece
  // antes de aceptar». No era cierto —documentaba la INTENCIÓN, no la implementación—: hasta el Plan
  // 19 de esta fase `aceptarCaso` y `excusarme` se gateaban solo por rol y estado, así que las dos
  // se ofrecían también sobre un caso ya aceptado (gap 4 del UAT). Desde ese plan la exclusión SÍ
  // está escrita: las dos reglas exigen `epas.sinAceptar`, unas líneas más arriba.
  //
  // Y aun así la comprobación se queda, porque su valor nunca fue la exclusión de pantalla: el
  // predicado original comprobaba las dos mitades, este bloque traslada y no rediseña, y quitar una
  // comprobación «porque no puede pasar» es apostar a que el backend nunca entregue esa combinación
  // —una apuesta que no la gana nadie, y que ahora además dependería de un gate de INTERFAZ—.
  generarDocumento: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [
        { hecho: "epas.aceptado", es: true },
        { hecho: "epas.sinExcusaPendiente", es: true },
      ],
    },
  },
  // «Adjuntar documento» — la ENTRADA del submenú, no el modal (ver `anexarDocumento`, que
  // conserva su regla vacía).
  //
  // 🔴 SOLO EL ROL, Y NINGUNA CONDICIÓN. La ventana real en que se puede anexar —desde que hay
  // decisor asignado hasta la remisión a Secretaría General— la impone el BACKEND, y reescribirla
  // aquí crearía una segunda verdad que puede divergir de la suya. La regla del motor ANTICIPA de
  // quién es el paso; no decide si el anexo procede. Que el caso tenga expediente al que anexar es
  // condición de la FILA, y la resuelve el catálogo que pinta la entrada.
  adjuntarDocumento: {
    tipo: "regla",
    regla: { roles: ["funcionario decisor"] },
  },
  // «Descargar expediente (ZIP)» — su gate era `estaAceptado(row)`, suelto en la página.
  //
  // Antes de aceptar, la card enseña un resumen mínimo a propósito (fase 1 de la bandeja): ofrecer
  // ahí la descarga del expediente completo contradiría esa decisión. Que exista acta definitiva
  // —la única condición real— la sigue imponiendo el backend.
  // ⟳ 2026-09-29 (quick 260929-kfg) — DOS REGLAS ALTERNATIVAS, y la del secretario va PRIMERA.
  //
  // 🔴 EL SECRETARIO ABOGADO Y EL DIRECTOR DESCARGAN CUALQUIER EXPEDIENTE, SIN CONDICIÓN. Es la
  // actividad 18 de PRO-GEJ-001 («Enviar EPAS para certificación»): el paso previo al oficio de
  // coactiva lo hace el secretario sobre expedientes que NO son suyos. El backend ya lo autorizaba
  // desde 2026-08-25 —`@Roles` con los tres roles, y la pertenencia con su exención de lectura para
  // secretario y director—; lo que faltaba era que la UI lo ofreciera.
  //
  // 🔴 Y NO BASTABA CON ENSANCHAR `roles`: `epas.aceptado` es un hecho del DECISOR sobre SU caso, y
  // toda clave ausente del contexto apaga la acción con «falta el dato». Dejar la condición y sumar
  // los roles le habría dejado el botón apagado al secretario, que es peor que no ofrecérselo —
  // parece un permiso que existe y no funciona.
  //
  // La condición del decisor SE CONSERVA tal cual. Su razón sigue vigente y es de su bandeja, no de
  // la ficha: antes de aceptar, la card enseña un resumen mínimo a propósito (fase 1 de la
  // bandeja), y ofrecer ahí la descarga del expediente completo contradiría esa decisión. Que exista
  // acta definitiva —la única condición real— la sigue imponiendo el backend.
  descargarExpediente: {
    tipo: "regla",
    regla: [
      { roles: ["secretario abogado", "director"] },
      {
        roles: ["funcionario decisor"],
        condiciones: [{ hecho: "epas.aceptado", es: true }],
      },
    ],
  },
  // «Recursos» — la entrada que abre la pestaña Recursos de la ficha.
  //
  // Misma condición que la descarga, y por el mismo motivo: el formulario de impugnación solo se
  // monta en la fase 2 de la bandeja, la del expediente ya aceptado. Lo que se pueda hacer DENTRO
  // —gestionar el recurso, adjuntar la resolución de la Procuraduría, calificarlo— lo sigue
  // decidiendo el formulario con el estado del EPAS delante: esta entrada solo abre.
  accionesImpugnacion: {
    tipo: "regla",
    regla: {
      roles: ["funcionario decisor"],
      condiciones: [{ hecho: "epas.aceptado", es: true }],
    },
  },
};

/**
 * EL UNION, ENUMERABLE EN TIEMPO DE EJECUCIÓN. Sin esto, «una prueba que recorra el union entero»
 * —que es el criterio de aceptación literal de D-5— no se puede escribir: un union de TypeScript no
 * existe después de compilar. `POLITICA_ACCIONES` es total, así que sus claves SON el union.
 */
export const INBOX_ACTION_NAMES: readonly InboxActionName[] = Object.keys(
  POLITICA_ACCIONES,
) as InboxActionName[];

/** ¿Esta regla restringe algo? Una sin rol, sin estado y sin condiciones no gatea: abre. */
function reglaRestringe(regla: InboxActionStatusRule): boolean {
  return (
    regla.roles !== undefined ||
    regla.status !== undefined ||
    (regla.condiciones !== undefined && regla.condiciones.length > 0)
  );
}

/**
 * Las reglas de una política, SIEMPRE como lista. Un solo sitio normaliza la forma, para que ni el
 * evaluador ni las derivaciones tengan que preguntarse si les llegó una o varias.
 */
function reglasDe(
  regla: InboxActionStatusRule | readonly InboxActionStatusRule[],
): readonly InboxActionStatusRule[] {
  return Array.isArray(regla)
    ? (regla as readonly InboxActionStatusRule[])
    : [regla as InboxActionStatusRule];
}

/**
 * Reglas de visibilidad por actiName. DERIVADO de `POLITICA_ACCIONES`, nunca escrito a mano: es lo
 * que impide que este módulo tenga dos listas de reglas que puedan divergir.
 *
 * 🔴 EL DEFECTO YA NO ES EL QUE DECÍA ESTE COMENTARIO. Donde antes se leía «si una acción no está
 * aquí, se muestra siempre que el backend la entregue», hoy hay que leer lo contrario: sin política
 * escrita en `POLITICA_ACCIONES`, la acción se NIEGA —apagada y con su motivo— (D-5 matizado por
 * D-7). Este export sobrevive porque sus consumidores no tienen por qué cambiar.
 *
 * Solo entran las reglas que RESTRINGEN algo. Las de regla vacía no aparecen aquí, y es correcto:
 * esta tabla siempre significó «lo que el motor gatea», y una regla vacía no gatea nada. Su decisión
 * está escrita igualmente, en `POLITICA_ACCIONES`, que es la única fuente.
 *
 * ⚠️ 2026-09-29 — DE UNA ACCIÓN CON ALTERNATIVAS SOLO ASOMA LA PRIMERA REGLA. Esta tabla es un
 * `Record` de una regla por acción y sus consumidores la leen así; ensancharla arrastraría a todos
 * por un dato que ninguno usa hoy (medido: fuera de este archivo solo la lee su propio test). Quien
 * necesite la política COMPLETA tiene que leer `POLITICA_ACCIONES`, que es y sigue siendo la única
 * fuente.
 */
export const INBOX_ACTION_STATUS_RULES: Partial<
  Record<InboxActionName, InboxActionStatusRule>
> = Object.fromEntries(
  Object.entries(POLITICA_ACCIONES).flatMap(([nombre, politica]) => {
    if (politica.tipo !== "regla") return [];
    const primera = reglasDe(politica.regla)[0];
    return primera && reglaRestringe(primera)
      ? [[nombre, primera] as const]
      : [];
  }),
);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL EVALUADOR (Fase 03.18, Plan 01 — D-7 opción A)
//
// 🔴 APAGAR Y NO ESCONDER. El evaluador ya no devuelve un booleano: devuelve un VEREDICTO con
// visible, habilitada y motivo. Su razón, textual en Instrucción: «el Instructor tiene que saber
// que un paso existe aunque todavía no le toque». En un procedimiento administrativo eso es más
// defendible que esconder — el decisor tiene derecho a ver el procedimiento entero.
//
// Con UNA excepción deliberada: el botón que NUNCA va a servir en ese punto sí se oculta, porque
// apagado solo genera la duda de qué habría que hacer para encenderlo. Ese es `ACCIONES_OCULTAS`.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** El veredicto sobre una acción: si se muestra, si se puede pulsar, y por qué no si no se puede. */
export type VeredictoAccion = {
  visible: boolean;
  habilitada: boolean;
  motivo?: string;
};

/**
 * Lo que el evaluador necesita saber del contexto. `hechos` es opcional a propósito: un consumidor
 * que solo tenga rol y estado no tiene que fabricar una bolsa vacía, y una regla con condiciones
 * sobre una pantalla que no trae los hechos sale apagada —que es exactamente lo correcto—.
 */
export type ContextoAccion = {
  rol: string;
  estado?: string | null;
  hechos?: HechosAccion;
};

/**
 * Acciones que se OCULTAN en vez de apagarse: la excepción deliberada a «apagar y no esconder».
 *
 * DERIVADO de `POLITICA_ACCIONES` (Plan 04): las entradas de `tipo: "oculta"`. No es una segunda
 * lista que mantener, y por eso no puede divergir de la política escrita.
 *
 * Hoy son dos —`returnMemo` y `returnCases`—, y se ocultan porque se MIDIÓ que no las consume
 * nadie ni las entrega el backend de Ejecución: ver el porqué escrito en cada entrada. Cualquier
 * otra acción que alguna vez pueda ofrecerse NO va aquí: va apagada con su motivo.
 */
export const ACCIONES_OCULTAS: readonly InboxActionName[] = Object.entries(
  POLITICA_ACCIONES,
).flatMap(([nombre, politica]) =>
  politica.tipo === "oculta" ? [nombre as InboxActionName] : [],
);

/**
 * El núcleo del evaluador, sobre una regla YA RESUELTA. Se expone aparte de `resolverAccion` para
 * que la conducta de cada filtro sea comprobable sin tener que meter reglas de mentira en la tabla
 * vigente: la tabla es el contrato de la aplicación, no un banco de pruebas.
 *
 * Orden de los filtros —y por tanto de los motivos—: ocultación, ausencia de regla, rol, estado,
 * condiciones.
 *
 * @param regla La regla de la acción, o nada si no tiene.
 * @param ctx Rol, estado del expediente y bolsa de hechos derivados.
 * @param oculta Si la acción pertenece al catálogo de ocultas.
 * @returns El veredicto, con su motivo cuando niega.
 */
export function resolverRegla(
  regla: InboxActionStatusRule | undefined,
  ctx: ContextoAccion,
  oculta: boolean,
): VeredictoAccion {
  // (1) La excepción: ni siquiera se muestra.
  if (oculta) return { visible: false, habilitada: false };

  /** Apaga con el motivo de la regla si lo tiene, y con el del catálogo si no. */
  const apagar = (motivo: string): VeredictoAccion => ({
    visible: true,
    habilitada: false,
    motivo: regla?.motivoPersonalizado ?? motivo,
  });

  // (2) Sin regla escrita = NEGAR (D-5), y negar es APAGAR CON SU MOTIVO (D-7), no hacer
  // desaparecer: un olvido de regla se ve en pantalla como un botón apagado —visible, preguntable,
  // depurable— en lugar de como un botón que se esfumó sin que nadie sepa que existía.
  if (!regla) return apagar(MOTIVOS_ACCION.SIN_REGLA);

  // (3) Rol. La normalización a minúsculas es conducta observable desde la Fase 2 y NO se toca.
  const rolNormalizado = ctx.rol.trim().toLowerCase();
  if (regla.roles && !regla.roles.includes(rolNormalizado as InboxRole)) {
    return apagar(MOTIVOS_ACCION.FUERA_DE_ROL);
  }

  // (4) Estado. La normalización a MAYÚSCULAS también es conducta observable y tampoco se toca.
  if (regla.status) {
    const permitidos = Array.isArray(regla.status)
      ? regla.status
      : [regla.status];
    const estadoNormalizado = (ctx.estado ?? "").trim().toUpperCase();
    if (!permitidos.includes(estadoNormalizado as InboxActionStatus)) {
      return apagar(MOTIVOS_ACCION.FUERA_DE_ESTADO);
    }
  }

  // (5) Condiciones sobre hechos derivados. El dato ausente manda sobre el incumplido: si no se
  // sabe, no se decide — y decirle al usuario «no procede» cuando en realidad no se sabe sería
  // afirmar algo que el sistema no puede sostener.
  const { cumple, faltan, incumplidas } = evaluarCondiciones(
    regla.condiciones,
    ctx.hechos ?? {},
  );
  if (!cumple) {
    return apagar(
      faltan.length > 0
        ? MOTIVOS_ACCION.DATO_AUSENTE(faltan[0])
        : MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA(incumplidas[0]),
    );
  }

  return { visible: true, habilitada: true };
}

/**
 * EL evaluador del módulo: dado el nombre de una acción y el contexto, qué hay que pintar.
 *
 * @param actiName Nombre de la acción (`actiName` de `UserActions`, o CTA de página).
 * @param ctx Rol, estado del expediente y bolsa de hechos derivados.
 * @returns El veredicto, con su motivo cuando niega.
 */
export function resolverAccion(
  actiName: string,
  ctx: ContextoAccion,
): VeredictoAccion {
  const veredicto = resolverAccionSinSuspension(actiName, ctx);

  // ⟳ quick 261028-mtg (D-2): EL ÚLTIMO PASO, sobre el veredicto ya resuelto. Con el EPAS
  // EN_IMPUGNACION, toda acción de la lista sale VISIBLE y APAGADA con el motivo de la suspensión,
  // diga lo que diga la cascada: el estado ya la apagaba con «no está en el estado que este paso
  // requiere», que es cierto pero no dice ni por qué ni dónde se resuelve. Se conservan dos cosas:
  // lo oculto sigue oculto, y «su rol no interviene» sigue siendo el motivo de quien no es el
  // decisor —a él la suspensión no le cambia nada, el paso nunca fue suyo—.
  const estadoNormalizado = (ctx.estado ?? "").trim().toUpperCase();
  if (
    estadoNormalizado === EN_IMPUGNACION &&
    ACCIONES_SUSPENDIDAS_POR_IMPUGNACION.has(actiName as InboxActionName) &&
    veredicto.visible &&
    veredicto.motivo !== MOTIVOS_ACCION.FUERA_DE_ROL
  ) {
    return {
      visible: true,
      habilitada: false,
      motivo: MOTIVOS_ACCION.SUSPENDIDA_POR_IMPUGNACION,
    };
  }
  return veredicto;
}

/** El estado del EPAS suspendido por impugnación. No es un `InboxActionStatus`: no abre nada. */
const EN_IMPUGNACION = "EN_IMPUGNACION";

/**
 * ⟳ quick 261028-mtg (D-2) — LO QUE QUEDA EN PAUSA MIENTRAS LA PROCURADURÍA RESUELVE EL RECURSO.
 *
 * Las dieciséis acciones que hacen AVANZAR la ejecución: las cinco de la rama pecuniaria (pago,
 * acogimiento al trabajo comunitario, su cumplimiento, su prórroga y la coactiva) y los once actos de
 * la rama de obligación de hacer. El backend las rechaza con 400 en EN_IMPUGNACION (plan 02 del
 * quick); aquí se apagan con el motivo para que el decisor no tenga que pulsar para enterarse.
 *
 * 🔴 LAS QUE NO ESTÁN, Y POR QUÉ (P-8):
 *   · `accionesImpugnacion` («Recursos») — es donde se resuelve la suspensión; apagarla dejaría el
 *     expediente sin salida.
 *   · `generarDocumento` — el selector de providencias ya solo ofrece, durante la suspensión, las del
 *     recurso y la nulidad (el servidor apaga el resto con su motivo); apagar la entrada impediría
 *     emitir justo las que el recurso necesita.
 *   · `adjuntarDocumento` y `descargarExpediente` — no hacen avanzar nada: el anexo genérico y la
 *     descarga siguen permitidos por el servidor (P-6).
 *   · `verObligacionHacer` — leer siempre es legítimo, y la página de la rama es también donde se
 *     resuelve el recurso cuando el expediente tiene obligación de hacer (D-5).
 */
export const ACCIONES_SUSPENDIDAS_POR_IMPUGNACION: ReadonlySet<InboxActionName> =
  new Set<InboxActionName>([
    // ── Rama pecuniaria ──
    "registrarPago",
    "registrarAcogimiento",
    "registrarCumplimiento",
    "solicitarProrroga",
    "gestionarCoactiva",
    // ── Rama de obligación de hacer ──
    "declararHacer",
    "deshacerHacer",
    "adjuntarInforme",
    "acreditarCumplimiento",
    "constatarIncumplimiento",
    "registrarAlegacion",
    "ordenarSustitutoria",
    "registrarDiligencia",
    "registrarRespaldoCostos",
    "registrarGastosSustitutoria",
    "registrarMultaCompulsoria",
  ]);

/** La cascada de `resolverAccion` antes de aplicar la suspensión por impugnación. */
function resolverAccionSinSuspension(
  actiName: string,
  ctx: ContextoAccion,
): VeredictoAccion {
  const politica = POLITICA_ACCIONES[actiName as InboxActionName];

  // (a) Sin política = la cadena ni siquiera está en el union. Es el defecto de D-5 en tiempo de
  // EJECUCIÓN, el que atrapa lo que el compilador no puede ver: se niega, y negar es apagar con su
  // motivo. `resolverRegla` sin regla ya hace exactamente eso.
  if (!politica) return resolverRegla(undefined, ctx, false);

  // (b) La ocultación corta primero: no se muestra, y no hay motivo que dar porque no hay botón
  // sobre el que darlo.
  if (politica.tipo === "oculta") return { visible: false, habilitada: false };

  // (c) Aquí vivía la EXENCIÓN: `if (politica.tipo === "externa") return { visible: true,
  // habilitada: true };`, la rendija por la que las tres firmas del lote pasaban sin que el motor
  // opinara. El Plan 09 la cerró absorbiendo su gate en `condiciones`. No queda ningún camino por el
  // que una acción llegue a pintarse sin haber pasado por `resolverRegla`.

  // (d) ALTERNATIVAS (2026-09-29): basta con que UNA regla pase. El caso de una sola regla recorre
  // exactamente el mismo camino, así que no hay dos conductas que mantener.
  //
  // 🔴 CUÁL DE LOS MOTIVOS SE MUESTRA, Y POR QUÉ NO ES «EL PRIMERO».
  //
  // Este archivo declara en mayúsculas que «el motivo que se muestra es el del PRIMER filtro que
  // falla, y ése es el más accionable para quien mira la pantalla», y lo ilustra con el caso del
  // secretario: a él se le dice que el paso no es suyo, NO que acepte un caso que nunca va a poder
  // aceptar. Con alternativas, quedarse literalmente con el primer RECHAZO rompe esa doctrina por
  // el otro lado: a un decisor le saldría «su rol no interviene» —el motivo de la regla del
  // secretario, que no es la suya— en vez del que puede accionar.
  //
  // Así que se prefiere el motivo de una regla que SÍ era la de su rol, y solo si ninguna lo era se
  // cae al primero. Dicho de otro modo: se le explica lo que le falta a ÉL; y si el paso no es de
  // nadie con su rol, entonces sí, que no es suyo.
  const reglas = reglasDe(politica.regla);
  const rechazos: VeredictoAccion[] = [];

  for (const regla of reglas) {
    const veredicto = resolverRegla(regla, ctx, false);
    if (veredicto.habilitada) return veredicto;
    rechazos.push(veredicto);
  }

  return (
    rechazos.find((v) => v.motivo !== MOTIVOS_ACCION.FUERA_DE_ROL) ??
    rechazos[0] ??
    resolverRegla(undefined, ctx, false)
  );
}

/**
 * El contexto de quien SOLO tiene rol y estado. Para que ninguna página tenga que escribir una
 * bolsa de hechos vacía a mano ni acordarse de que `hechos` es opcional.
 *
 * @param rol Rol operativo del usuario, sin normalizar.
 * @param estado Estado del EPAS, o nada si la acción es de nivel expediente.
 */
export const CONTEXTO_SIN_HECHOS = (
  rol: string,
  estado?: string | null,
): ContextoAccion => ({ rol, estado });

/**
 * Proyecta un veredicto YA RESUELTO sobre una acción del menú. Es la pieza pura de
 * `aplicarVeredicto`, y la que fija las tres invariantes que importan.
 *
 * 🔴 NUNCA MUTA LA ACCIÓN RECIBIDA. `EPAS_ROW_ACTIONS` y `EXPEDIENTE_ACTIONS` son constantes de
 * módulo COMPARTIDAS: apagar una in situ contaminaría filas distintas de la misma tabla, y el
 * síntoma —un botón apagado en la fila equivocada— no apuntaría nunca a su causa.
 *
 * 🔴 NUNCA REHABILITA. Si la acción llega ya deshabilitada por otra causa —el EPAS bloqueado, el
 * lote sin casos elegibles—, se conserva apagada y se conserva su pista original: quien la apagó
 * sabía algo que este motor no sabe, y encenderla ofrecería un acto que el backend va a rechazar.
 *
 * @param accion La acción tal y como viaja en `UserActions`.
 * @param veredicto El veredicto del evaluador.
 * @returns La acción intacta, una copia apagada con su motivo, o `null` si no se muestra.
 */
export function proyectarVeredicto(
  accion: UserActions,
  veredicto: VeredictoAccion,
): UserActions | null {
  if (!veredicto.visible) return null;
  if (veredicto.habilitada && !accion.actiIsDisabled) return accion;
  if (accion.actiIsDisabled) return accion;
  return {
    ...accion,
    actiIsDisabled: true,
    actiDisabledHint: veredicto.motivo,
  };
}

/**
 * Aplica el motor a una acción del menú. Es lo que sustituye al `.filter(isInboxActionVisible(...))`
 * de hoy, y el patrón de consumo para las páginas nuevas es:
 *
 * ```ts
 * const acciones = EPAS_ROW_ACTIONS.flatMap((a) => aplicarVeredicto(a, ctx) ?? []);
 * ```
 *
 * Con `flatMap` y no con `map(...).filter(Boolean)` porque el tipo sobrevive: `filter(Boolean)` deja
 * `(UserActions | null)[]` y obliga a un cast que es justo donde se cuelan los nulos.
 *
 * Eleva a regla del motor lo que `resolveGrupoActions` ya hacía a mano en `useEpasInboxActions`
 * —deshabilitar con motivo en vez de ocultar, porque «esconderla dejaría al director sin saber por
 * qué no puede actuar»—.
 *
 * @param accion La acción tal y como viaja en `UserActions`.
 * @param ctx Rol, estado del expediente y bolsa de hechos derivados.
 * @returns La acción intacta, una copia apagada con su motivo, o `null` si no se muestra.
 */
export function aplicarVeredicto(
  accion: UserActions,
  ctx: ContextoAccion,
): UserActions | null {
  return proyectarVeredicto(accion, resolverAccion(accion.actiName, ctx));
}

/**
 * ADAPTADOR DE COMPATIBILIDAD. El código nuevo consume `resolverAccion` / `aplicarVeredicto`; esto
 * existe para que los 14 puntos de llamada vigentes sigan compilando y —sobre todo— sigan
 * decidiendo BIT A BIT lo mismo que antes de esta fase.
 *
 * 🔴 DEVUELVE `habilitada`, NO `visible`, Y NO ES UN DESCUIDO. Con «apagar y no esconder»,
 * `visible` pasó a significar «no está en el catálogo de ocultas», que es verdadero casi siempre;
 * lo que este booleano significaba hasta hoy —«rol y estado encajan»— es exactamente `habilitada`.
 * Devolver `visible` haría aparecer en cada bandeja las acciones de los otros roles el mismo día
 * del refactor, y esta ola no cambia la conducta de ninguna pantalla.
 *
 * 🔴 LA CUÑA DEL PLAN 01 YA NO ESTÁ, Y QUITARLA FUE EL ACTO EXPLÍCITO DEL PLAN 04. Este adaptador
 * llevaba un `if (!INBOX_ACTION_STATUS_RULES[actiName]) return true;` que mantenía vivo el defecto
 * viejo —«sin regla, se ofrece»— porque quitarlo ANTES de enumerar el union habría hecho
 * desaparecer sin aviso las tres firmas del lote y las cuatro heredadas de Resolución. Hoy no hace
 * falta: `POLITICA_ACCIONES` es total, las firmas tienen exención declarada y las heredadas tienen
 * su decisión medida, así que lo que este adaptador devuelve para cada una de las 38 es exactamente
 * lo que devolvía con la cuña puesta. Lo único que cambió de conducta es lo que NO está en el
 * union: eso ya no se ofrece, que es justamente lo que D-5 pedía.
 */
export function isInboxActionVisible(
  actiName: string, docStatus: string | null | undefined, userRole: string,
): boolean {
  const veredicto = resolverAccion(actiName, {
    rol: userRole,
    estado: docStatus,
  });
  return veredicto.habilitada;
}
