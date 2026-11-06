/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Servicio frontend de la ENTRADA lote-céntrica (bandejas por rol + estado de la
 *   sincronización + sello RECE-08) para la Bandeja de Entrada y el modal Resultado del sorteo
 *   (D-06, Fase 3.8).
 * Archivo: EntradaLotesService.ts
 * Responsabilidad: Consumir el backend de Ejecución (:3004) en los endpoints /entrada-lotes/* de la
 *   entrada (GET /entrada-lotes/bandeja-director, GET /entrada-lotes/bandeja-secretario,
 *   GET de la sincronización (…/sincronizacion), PATCH /entrada-lotes/:id/approve-director,
 *   PATCH /entrada-lotes/:id/aprobar-enviar-sorteo), además de los de la salida y los de datos de
 *   prueba. Espeja el patrón de SorteoService: objeto literal con
 *   métodos async que devuelven `data`, todo el HTTP por api/httpClient (nunca axios directo; el
 *   interceptor inyecta Authorization: Bearer desde localStorage.authToken). El ACTOR/ROL NUNCA viaja en
 *   el body: el backend lo deriva del JWT (@CurrentUser) — el sello director→secretario y el actor los
 *   pone el backend, no el cliente (anti-Spoofing T-03.8-09). Los tipos ESPEJAN los DTOs del backend
 *   (envio-lote.dto.ts / envio-lote.interface.ts / entrada-lotes.service.ts), incluido `envlAmasId` (el
 *   amas_id del SORTEO ligado al lote de ENTRADA) que el modal Resultado del sorteo (Plan 04) consume.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-09-17 (reunión del 16-09): las tres bandejas responden
 *   PAGINADAS y aceptan filtros (buscador general + rango de fechas), y el lote trae la URL de su
 *   MEMO (`docUrl`/`docName`) y la ficha del administrado que consume el modal del expediente.
 * Modificado por: Andrés Miño — 2026-10-07 (quick 261007-jrr): el caso del lote trae `expMateria` y
 *   `expSubmateria` del expediente, que la Bandeja de Entrada enseña en la fila.
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 12, D-16/D-17): el caso trae el bloque
 *   `infracciones` y su materia/submateria pasan a ser las DEDUCIDAS del código de infracción; las
 *   bandejas aceptan el filtro de materia por código del CAT v1.3 (retirado en la quick 261104-jh1).
 * Modificado por: Andrés Miño — 2026-10-16 (UAT 03.23-14): el caso trae `coincideFiltro` cuando la
 *   bandeja se pidió con buscador o materia, para enseñar dentro del lote solo los que casan.
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 07, D-09/D-13): la sincronización con
 *   Resolución pasa a ser AUTOMÁTICA. Sale el método de sincronización manual (el backend retiró
 *   POST /entrada-lotes/sync en el Plan 05) y entra `estadoSincronizacion()`, que lee
 *   el GET …/sincronizacion (Plan 13) para la línea de estado de la Bandeja de Entrada.
 *   `SyncResult` y `CasoDiferidoSinEpas` se quedan: los usa el resumen de «Generar datos».
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 11, D-05): el caso trae la lista de
 *   datos de Resolución que faltan, calculada por el servidor (Plan 10), para el aviso
 *   `AvisoDatosResolucion` de la Bandeja de Entrada.
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-01, Plan 24): el caso
 *   trae `reingreso` (`ReingresoResumen`), `porDevolver` se redefine (L-2) y la remisión devuelve
 *   `retenidosPorVerificar`. G-09: el estado de la sincronización trae `casosTardios` y `tardios`.
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 14, D-16/D-24): `despacharSalida` lleva
 *   la clave de firma del director (`signPassword`) y la respuesta dice si el memorando de devolución
 *   salió firmado (`memoFirmado`).
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-08): `despacharSalida` espera
 *   `FIRMA_TIMEOUT_MS` (45 s) y no los 120 s de la siembra, que superaban los 60 s del nginx.
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261029-kl0): el caso trae `remitidoAlSecretario`
 *   y `aprobarEnviarSorteo` se tipa con lo que el servidor responde de verdad
 *   (`AprobarEnviarSorteoResult`, con `sorteados` y `excluidos`).
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1): la materia y la submateria del caso son
 *   las de Sorteo; el filtro de las bandejas es `materiaId` (id de Sorteo); fuera el código del CAT.
 */
import httpClient from "../api/httpClient";
import type { ResumenInfracciones } from "./InfraccionesService";
import type { ObligacionHacerEnBandeja } from "../interfaces/IObligacionHacer";
import { FIRMA_TIMEOUT_MS } from "./SorteoService";

/**
 * Tipo del lote de ENTRADA — espeja el CHECK cerrado `chk_envio_lote_tipo` del backend (Plan 01) y
 * EnvioLoteTipo de envio-lote.interface.ts. Gobierna el ruteo: DEVOLUCION | FINALIZADO | ENVIO.
 */
export type EnvioLoteTipo = "DEVOLUCION" | "FINALIZADO" | "ENVIO";

/**
 * Estados LOCALES del lote de entrada. Espeja EnvioLoteStatus del backend (envio-lote.interface.ts).
 * OJO (verdicto OQ-1): en la BD `envl_status` es TEXTO LIBRE (sin FK ni CHECK); esta unión es el
 * vocabulario PREVISTO compartido, no una restricción de esquema — el default es EN_REVISION.
 */
export type EnvioLoteStatus =
  | "EN_REVISION"
  | "APROBADO"
  | "ENVIADO_SORTEO"
  | "DEVUELTO"
  | "FINALIZADO"
  | "ENVIADO_SG";

/**
 * El RESUMEN DEL REINGRESO de un caso (Fase 03.24, G-01, UI-SPEC §1.7). Espeja, palabra por palabra,
 * `ReingresoResumenDto` del backend (Plan 21). Los cuatro conteos son sobre las observaciones de la
 * devolución anterior que no se desecharon; los calcula el servidor y la pantalla no los recalcula.
 */
export interface ReingresoResumen {
  /** Cuándo se reingresó el EPAS (`eeje_reingresado_at`), en ISO. */
  reingresadoAt: string;
  /** Observaciones de la devolución anterior, en total. `0` = reingresado sin observaciones. */
  total: number;
  /** Las que el director todavía no ha verificado: retienen la remisión al secretario. */
  porVerificar: number;
  /** Las que la DMR subsanó. */
  cumplidas: number;
  /** Las que la DMR NO subsanó: encienden «Por devolver» en el servidor. */
  noCumplidas: number;
}

/**
 * Un caso del lote (fila del puente `t_envio_lote_caso`, prefijo envlc_). Espeja EnvioLoteCasoDto del
 * backend. Se HIDRATA aparte (sin N+1) y viaja ANIDADO en el lote. `eejeId` puede faltar mientras el
 * caso no haya aterrizado como EPAS local (t_expediente_ejecucion) — OQ-4 diferido.
 */
export interface EnvioLoteCaso {
  /** envlc_id (PK del puente). */
  envlcId?: number;
  /** eeje_id del EPAS local una vez aterrizado; undefined mientras el caso no exista como EPAS. */
  eejeId?: number;
  /** envlc_case_ref: id del caso en el ORIGEN (sin FK cross-module). Clave de sync del caso. */
  envlcCaseRef?: number;
  /**
   * UAT 03.23-14: ¿el caso casa con el buscador o con la materia con que se pidió la bandeja? Solo
   * viene cuando se pidió con alguno de los dos; sin ellos es `undefined` y se enseñan todos. El
   * servidor NO poda la lista —el progreso del sorteo y las acciones del lote cuentan el lote
   * entero—: es la pantalla la que enseña dentro del lote solo los que traen `true`. Espeja
   * `EnvioLoteCasoDto.coincideFiltro` del backend.
   */
  coincideFiltro?: boolean;

  // ── Detalle rico del EPAS aterrizado (hidratado por LEFT JOIN en el backend) ───────────────
  // Presente solo cuando eeje_id NO es undefined (el caso ya existe como EPAS local). Alimenta el
  // detalle por caso de la Bandeja de Entrada (look app-item-list, paridad con Resolución). Un caso
  // sin aterrizar los trae undefined y se muestra thin (referencia de origen).

  /** exp_number del expediente (identificador visible del caso). */
  expNumber?: string;
  /** exp_zone: parroquia/zona del expediente. */
  expZone?: string;
  /**
   * NOMBRE de la materia en SORTEO (quick 261104-jh1): las materias distintas resueltas de las
   * infracciones del EPAS, unidas con « / ». «Sin materia» es `infracciones.sinMateria`, no un nombre. Espeja `EnvioLoteCasoDto.expMateria` del backend. Ausente
   * en un caso THIN (sin EPAS) y en un EPAS sin infracciones.
   */
  expMateria?: string;
  /**
   * NOMBRE de la submateria en Sorteo (quick 261104-jh1): las submaterias distintas resueltas,
   * unidas con «, ». Ausente en los mismos casos que `expMateria`.
   */
  expSubmateria?: string;
  /**
   * Resumen de las infracciones del EPAS (D-16): códigos, estado de la lectura de CORE y las alertas
   * que el SERVIDOR calculó (conflicto, descuadre). Solo viene cuando el caso ya es EPAS; un caso THIN
   * no lo trae. Un EPAS sin infracciones llega con `codigos: []` y `descuadre: true`: lo pinta
   * `CeldaInfracciones`, que dice «Sin infracciones» antes que «Descuadre».
   */
  infracciones?: ResumenInfracciones;
  /**
   * Fase 03.24 (D-05) — LOS DATOS DE RESOLUCIÓN QUE FALTAN: lista de códigos (`MULTA`,
   * `RESOLUCION_NUMERO`, `RESOLUCION_FECHA`, `CORE_ID`, `INFRACCIONES`) calculada por el servidor
   * con el fragmento de `resolucion-faltantes.sql.ts`, en la misma consulta que hidrata la fila.
   *
   * Ausente = caso THIN (aún sin EPAS); `null` = el EPAS no vino de Resolución (demo, «Generar
   * datos») y no lleva aviso; `[]` = vino y no falta nada. El aviso INFORMA, no bloquea: el TC sin
   * infracciones lo sigue bloqueando la 03.23. Lo pinta `AvisoDatosResolucion`.
   */
  datosResolucionFaltantes?: string[] | null;
  /** exp_created_at (ISO): fecha del expediente. */
  expCreatedAt?: string;
  /** eeje_status: estado del EPAS local (la máquina de estados legal). */
  eejeStatus?: string;

  /**
   * ¿Está abierta la ventana para anexar documentos a este expediente? (2026-09-17)
   *
   * 🔴 Lo calcula el BACKEND con la MISMA condición que lo impone
   * (`usu_assigned IS NOT NULL AND eeje_sg_remitido_at IS NULL`), y por eso viaja en vez de
   * deducirse aquí: `eejeStatus` no basta —el estado en que el expediente se reparte y aquel en que
   * ya tiene decisor son distintos, y la remisión a Secretaría General no tiene estado propio—, así
   * que la pantalla solo podría aproximar. Una regla aproximada aquí y la de verdad allá divergen en
   * cuanto una de las dos cambie.
   *
   * `undefined` en un caso que todavía NO aterrizó como EPAS: no hay expediente al que anexar nada,
   * y se trata como cerrado.
   */
  puedeAnexar?: boolean;
  /**
   * Cuántas OBSERVACIONES por campo y por documento tiene el expediente (2026-09-18). Mayor que
   * cero ⇒ la fila se pinta con la marca «Por devolver» en rojo.
   *
   * Lo calcula el SERVIDOR y viaja resuelto, igual que `puedeAnexar`: la pantalla no puede deducirlo
   * de ningún dato que ya tenga, y pedirlo por fila serían cincuenta peticiones en una bandeja que
   * carga cincuenta lotes. La consulta que hidrata la bandeja lo trae en la misma pasada.
   *
   * `undefined` en un caso que todavía NO aterrizó como EPAS: ahí no hay expediente que observar, y
   * decir «cero observaciones» sería opinar sobre algo que aún no existe.
   */
  observacionesTotal?: number;
  /**
   * ¿Está PENDIENTE DE DEVOLVER? Es lo que decide la marca «Por devolver» de la fila — y NO es
   * `observacionesTotal > 0` (2026-09-18).
   *
   * 🔴 REDEFINIDO EN LA FASE 03.24 (G-01, regla L-2): es verdadero si el expediente tiene
   * observaciones NUEVAS vivas o alguna observación de la devolución anterior verificada como NO
   * cumplida. Las anteriores «por verificar» o «cumplidas» NO lo encienden: lo que está por
   * verificar se lee en `reingreso.porVerificar`, y pintarlo como «Por devolver» era el defecto que
   * señaló el usuario.
   *
   * 🔴 LA MARCA ES UNA INTENCIÓN; EL ESTADO ES UN HECHO. Un expediente ya devuelto conserva sus
   * observaciones —son el motivo con el que salió— pero ya no está pendiente de nada: pintarle la
   * marca junto a su `DEVUELTO_DMR` le pone dos estados a la misma fila. Lo resuelve el SERVIDOR
   * para que la pantalla no tenga que enumerar aquí los estados devueltos del EPAS: el día que
   * aparezca un tercero, esa lista se quedaría corta sin que nadie lo note.
   */
  porDevolver?: boolean;
  /**
   * quick 261029-kl0 — ¿Lo REMITIÓ el director al secretario? Espeja
   * `EnvioLoteCasoDto.remitidoAlSecretario` del backend (`eeje_director_approved_at` puesto). Lo
   * lee la fila del director para ofrecer «Remitir al secretario» por caso: ya remitido el lote, lo
   * que se quedó con él (retenido, devuelto por una observación cuyas observaciones rechazó, o
   * aterrizado tarde) se remite de uno en uno. `undefined` en un caso THIN.
   */
  remitidoAlSecretario?: boolean;
  /**
   * Fase 03.24 (G-01, UI-SPEC §1.7) — EL RESUMEN DEL REINGRESO. Espeja `EnvioLoteCasoDto.reingreso`
   * del backend (Plan 21), que lo arma al hidratar la bandeja.
   *
   * `null` (o ausente) = el EPAS nunca se reingresó. Con `total = 0`, Resolución lo volvió a enviar
   * sin observaciones de la devolución anterior. La pantalla solo lo pinta: la precedencia de la
   * fila la decide `marcaDeLaFila` (`components/entrada/reingreso.ts`) leyendo estas cifras tal cual.
   */
  reingreso?: ReingresoResumen | null;
  /**
   * ESTADO DEL TRÁMITE INTERNO: nombre de la ÚLTIMA providencia emitida sobre el caso.
   *
   * Acompaña a `eejeStatus`, no lo sustituye: 29 de los 32 tipos de providencia no mueven la
   * máquina de estados, así que emitirlas no se veía desde ninguna bandeja. Desde el 2026-09-03
   * viaja también a la del director y la del secretario.
   */
  estadoTramite?: string;
  /** Cuándo se emitió esa providencia (ISO). */
  estadoTramiteAt?: string;

  // ── Lo que trae la RESOLUCIÓN DE ORIGEN (2026-09-08) ───────────────────────────────────────
  // Se decide en esta bandeja qué se remite y qué se devuelve a la DMR, y las dos cifras son parte
  // de esa decisión. Opcionales: Resolución todavía no las emite y lo aterrizado antes no las tiene.

  /** Multa impuesta por la resolución sancionadora, en dólares. */
  multaImpuesta?: number;
  /** Número de la resolución sancionadora con la que llegó el expediente. */
  resolucionNumero?: string;
  /** Fecha de esa resolución (ISO corto, `YYYY-MM-DD`). */
  resolucionFecha?: string;
  /** admi_name del administrado (persona natural). */
  admiName?: string;
  /** admi_lastname del administrado (persona natural). */
  admiLastname?: string;
  /** admi_business_name: razón social si es persona jurídica (identidad propia). */
  admiBusinessName?: string;
  /** admi_identification: cédula/RUC del administrado. */
  admiIdentification?: string;

  // ── FICHA DEL EXPEDIENTE (2026-09-17, punto 5 de la reunión del 16-09) ──────────────────────
  // Lo que enseña la pestaña «Información del Expediente» del modal que abre el ojo de la fila.
  // Viajan con el resto del detalle rico —no hay una petición por expediente abierto— y solo las
  // traen los casos ATERRIZADOS. El modal omite sola cada línea ausente.

  /** admi_telephone del administrado. */
  admiTelephone?: string;
  /** admi_email del administrado. */
  admiEmail?: string;
  /** admi_address: dirección física del administrado. */
  admiAddress?: string;
  /** admi_judicial_locker: casillero judicial (opcional también en la BD). */
  admiJudicialLocker?: string;
  /** exp_fojas: número de folios del expediente. */
  expFojas?: number;
  /** exp_medida_cautelar: la medida cautelar del expediente, si la hay. */
  expMedidaCautelar?: string;

  /**
   * EL CORRECTIVO, junto a la pecuniaria. Espeja `EnvioLoteCasoDto.obligacionHacer` del backend.
   *
   * 🔴 2026-09-15 — ESTE CAMPO YA VIAJABA Y SE ESTABA TIRANDO. Lo incrustó la Fase 03.16 (D-04) por
   * los fragmentos SQL compartidos de `obligacion-hacer.sql.ts`: llega por la red desde entonces y
   * `httpClient` lo entrega intacto. Faltaba esta línea — sin declararlo, TypeScript no lo conocía
   * y las dos bandejas de entrada (director y secretario) no podían leerlo. Aquí pesa: en esta
   * bandeja se decide qué se remite y qué se devuelve a la DMR, y un expediente que arrastra
   * correctivo pendiente no es el mismo expediente que uno que sólo debe dinero.
   *
   * ⚠️ OPCIONAL DE VERDAD: un caso sin correctivo no trae el bloque. Y sólo lo traen los casos ya
   * ATERRIZADOS —los que tienen `eejeId`—, por la misma razón que el resto del detalle rico: sin
   * EPAS local no hay expediente sobre el que derivar nada.
   *
   * 🔴 NO TRAE EL PELDAÑO (`PeldanoCompulsorio`): sólo viaja en `GET /obligacion-hacer/:eejeId`.
   * Una condición sobre él es INDECIDIBLE en una fila, y lo indecidible se apaga.
   */
  obligacionHacer?: ObligacionHacerEnBandeja;
}

/**
 * Lote de ENTRADA. Espeja EnvioLoteDto del backend (envio-lote.dto.ts) palabra por palabra. Se usa como
 * fila de las dos bandejas (director/secretario) y como fuente del gate de apertura del modal Resultado
 * del sorteo vía `envlAmasId`.
 */
export interface EnvioLoteDto {
  /** envl_id (PK del lote de entrada). */
  envlId: number;
  /** envl_numero_lote: identidad de la ENTRADA. NO es el amas_id del sorteo. */
  envlNumeroLote: string;
  /** envl_source_ref: id del lote en el ORIGEN (clave de sync idempotente). NULL en lotes locales. */
  envlSourceRef?: number | null;
  /** doc_id: memo de entrada opcional. NO es el acta de sorteo D2. */
  docId?: number | null;
  /**
   * URL del MEMO con el que la DMR remite el lote (reunión del 2026-09-16, punto 4). Es lo que abre
   * el botón del ojo de la cabecera del lote.
   *
   * ⚠️ OPCIONAL DE VERDAD, y hoy casi siempre ausente: el contrato con Resolución sigue [ASSUMED] y
   * el sync real no trae documento. Los lotes de PRUEBA sí lo traen (el reseed genera el memo). Sin
   * URL, la cabecera NO pinta el botón — no se ofrece una acción que abriría una pantalla en blanco.
   */
  docUrl?: string | null;
  /** Nombre del memo, para el título del visor. Ausente si el lote no trae memo. */
  docName?: string | null;
  /** envl_expediente_ref: memo/expediente (texto) opcional. */
  envlExpedienteRef?: string | null;
  /** envl_status: estado LOCAL del lote (texto libre, verdicto OQ-1). Default 'EN_REVISION'. */
  envlStatus: EnvioLoteStatus | string;
  /** envl_tipo: gobierna el ruteo (DEVOLUCION | FINALIZADO | ENVIO). CHECK cerrado en la BD. */
  envlTipo: EnvioLoteTipo | string;
  /**
   * envl_amas_id: amas_id del master de SORTEO ligado a este lote de ENTRADA (Asignaciones, cross-DB SIN
   * FK). NULL hasta que el secretario lo aprueba+envía a sorteo. Lo consume el modal Resultado del
   * sorteo (Plan 04). NO es envl_numero_lote (entrada != sorteo: universos distintos, no fusionar).
   */
  envlAmasId?: number | null;
  /**
   * ¿El master de sorteo del lote ya fue APROBADO por el director? Derivado en el backend. Distingue el
   * badge "Sorteado" (true) de "En Sorteo" (false) sobre un lote ENVIADO_SORTEO.
   */
  sorteoAprobado?: boolean;
  /**
   * envl_director_approved_at: instante del sello del reenvío director→secretario (patrón RECE-08).
   * NULL → el director aún lo ve; NOT NULL → el secretario ya lo acciona.
   */
  envlDirectorApprovedAt?: string | null;
  /** envl_director_approved_by: usu_id LOCAL del director que selló (derivado del JWT, nunca del body). */
  envlDirectorApprovedBy?: number | null;
  /** envl_income_at: instante en que el lote ingresó (sincronizó). */
  envlIncomeAt?: string;
  /**
   * Casos del lote (hidratados aparte, sin N+1, y adjuntados tras validar la fila del lote). El backend
   * SIEMPRE manda una lista (vacía si no hay casos): los consumidores usan `casos ?? []`.
   */
  casos?: EnvioLoteCaso[];
}

/**
 * Un caso DIFERIDO sin EPAS (OQ-4): no se pudo transicionar por faltar `eeje_id`. Espeja
 * CasoDiferidoSinEpas de entrada-lotes.service.ts. Es un dato CONSULTABLE del resumen de sync.
 */
export interface CasoDiferidoSinEpas {
  /** envl_id del lote persistido al que pertenece el caso. */
  envlId: number;
  /** envlc_case_ref: id del caso en el ORIGEN (clave de sync del puente). */
  envlcCaseRef: number;
  /** Tipo del lote (gobierna qué ruteo se difirió). */
  tipo: string;
}

/**
 * Resumen CONSULTABLE de una sincronización de lotes. Espeja SyncResult de entrada-lotes.service.ts:
 * cuántos lotes/casos se sincronizaron, cuántos se devolvieron (DEVUELTO_DMR) y la LISTA de casos
 * diferidos sin EPAS (OQ-4). Hoy lo devuelve la generación de datos de prueba (`GenerarLotesResult`);
 * la sincronización manual que también lo devolvía se retiró en la Fase 03.24 (D-09).
 */
export interface SyncResult {
  /** Lotes persistidos (INSERT o UPDATE idempotente) en esta corrida. */
  lotesSincronizados: number;
  /** Casos del puente persistidos en esta corrida (todos los lotes). */
  casosSincronizados: number;
  /** Casos de lotes DEVOLUCION transicionados a DEVUELTO_DMR (solo los aterrizados). */
  casosDevueltos: number;
  /** Casos SIN eeje_id (OQ-4 diferido): no se transicionaron; quedan para "aterrizar". */
  casosDiferidosSinEpas: CasoDiferidoSinEpas[];
}

/**
 * Resultado del envío a Secretaría General. ESPEJA la respuesta real de
 * PATCH /entrada-lotes/:id/enviar-sg (Plan 02: enviarASecretariaGeneral devuelve
 * { envlId, status, enviado } y, en el no-op idempotente, además alreadySent=true). NO es un
 * EnvioLoteDto completo — el endpoint responde solo el desenlace del envío, no el lote entero
 * (corrige la nota de RESEARCH Q4 que decía Promise<EnvioLoteDto>).
 */
export interface EnviarSgResult {
  /** envl_id del lote enviado a SG. */
  envlId: number;
  /** envl_status resultante (típicamente 'ENVIADO_SG'); texto libre (verdicto OQ-1). */
  status: EnvioLoteStatus | string;
  /** true si este llamado efectuó el envío (camino feliz); false si fue un no-op idempotente. */
  enviado: boolean;
  /** true cuando el lote YA estaba en 'ENVIADO_SG' y el envío fue un no-op idempotente. */
  alreadySent?: boolean;
}

/**
 * Lo que responde «Aprobar y enviar a sorteo» (PATCH :id/aprobar-enviar-sorteo). Espeja
 * `aprobarYEnviarASorteo` del backend, que NUNCA devolvió un `EnvioLoteDto` (quick 261029-kl0).
 */
export interface AprobarEnviarSorteoResult {
  envlId: number;
  /** ENVIADO_SORTEO si se envió todo; APROBADO si algún expediente se quedó con el director. */
  status: string;
  /** Master de sorteo creado (o el ya ligado, en el no-op idempotente). */
  amasId: number;
  /** true en el no-op idempotente: el lote ya estaba ligado y no se re-sorteó. */
  alreadyLinked?: boolean;
  /** Expedientes que viajaron al sorteo en esta llamada. */
  sorteados?: number;
  /**
   * 🔴 Expedientes pendientes que NO se sortearon por estar con el director —con observaciones por
   * revisar o sin remitir al secretario—. Con alguno, el lote sigue abierto (APROBADO).
   */
  excluidos?: number;
}

/**
 * Retorno de la REMISIÓN del lote al secretario (PATCH :id/approve-director). Espeja
 * `remitirAlSecretario` del backend — que NUNCA devolvió un `EnvioLoteDto`, aunque este archivo lo
 * tipara así hasta el 2026-09-18.
 */
export interface RemisionDirectorResult {
  envlId: number;
  /** true si este llamado selló la remisión; false si el lote ya estaba remitido (no-op). */
  remitido: boolean;
  /**
   * 🔴 Expedientes del lote que NO se remitieron por estar marcados «Por devolver» (2026-09-18).
   *
   * El lote viaja entero, pero los expedientes que el director marcó se quedan: remitirlos los
   * metería en el flujo del que quería sacarlos. Se dice en el aviso — que tres de treinta no salgan
   * en silencio es lo que se descubre semanas después, cuando alguien pregunta por un expediente que
   * no llegó a ninguna parte.
   */
  retenidos: number;
  /**
   * Fase 03.24 (G-01, UI-SPEC §1.6): expedientes reingresados que NO se remitieron por tener
   * observaciones de la devolución anterior todavía por verificar. Los cuenta el servidor aparte de
   * `retenidos`. Opcional para tolerar un backend anterior: sin el campo, el aviso no añade nada y
   * la cifra NO se calcula en el navegador.
   */
  retenidosPorVerificar?: number;
}

/**
 * Retorno de la DEVOLUCIÓN a la DMR (PATCH :id/devolver-dmr). Espeja devolverALaDmr del backend.
 */
export interface DevolverDmrResult {
  /** envl_id del lote devuelto. */
  envlId: number;
  /** envl_status resultante ('DEVUELTO'); texto libre (verdicto OQ-1). */
  status: EnvioLoteStatus | string;
  /** Casos ATERRIZADOS transicionados a DEVUELTO_DMR (los thin se difieren, OQ-4). */
  casosDevueltos: number;
}

/**
 * Conteos de la PURGA DEV de la Bandeja de Entrada (datos de prueba). Espeja el retorno de
 * repo.purgarLotesDePrueba: filas borradas en t_envio_lote (lotes) y t_envio_lote_caso (casos).
 */
export interface PurgeLotesResult {
  /** Lotes borrados de t_envio_lote. */
  lotes: number;
  /** Casos borrados del puente t_envio_lote_caso. */
  casos: number;
}

/**
 * Cómo acabó la última pasada de la sincronización con Resolución. Espeja, palabra por palabra, el
 * `resultado` de `EstadoSincronizacionResolucion` del backend (Fase 03.24, Plan 13):
 *   - `NUNCA`    → desde que arrancó el proceso no ha terminado ninguna pasada.
 *   - `CORRECTA` → la pasada leyó todo y no anotó ningún fallo.
 *   - `PARCIAL`  → la pasada ingresó lo que pudo, con fallos anotados o páginas sin leer.
 *   - `FALLIDA`  → la pasada no llegó a leer nada (credencial rechazada, Resolución caída…).
 */
export type ResultadoSincronizacion = "NUNCA" | "CORRECTA" | "PARCIAL" | "FALLIDA";

/**
 * Un fallo anotado por la sincronización. Espeja `FalloSincronizacion` del backend (Plan 12). El
 * `motivo` llega YA SANEADO por el servidor (código HTTP + texto propio): nunca cuerpos de respuesta,
 * URLs con parámetros ni tokens (T-03.24-23).
 */
export interface FalloSincronizacion {
  /** Página de `/internal/case-movement` en la que falló, si el fallo fue de página. */
  pagina: number | null;
  /** `enlo_id` del lote de Resolución, si el fallo fue de un lote o de uno de sus casos. */
  enloId: number | null;
  /** Id del caso en Resolución, si el fallo fue de un caso concreto. */
  resolucionCasoId: number | null;
  motivo: string;
}

/**
 * Estado de la última sincronización con Resolución, tal como lo devuelve
 * el GET …/sincronizacion (backend, Fase 03.24, Plan 13). El estado vive en la memoria del
 * proceso del backend: tras un reinicio vuelve a `NUNCA` hasta la primera pasada.
 */
export interface EstadoSincronizacionResolucion {
  /** `false` con la integración apagada: la Bandeja no pinta nada (D-10). */
  habilitada: boolean;
  /** Cada cuántos minutos corre la sincronización automática. */
  intervaloMinutos: number;
  /** Hay una pasada corriendo ahora mismo. */
  enCurso: boolean;
  resultado: ResultadoSincronizacion;
  /** Inicio de la última pasada (ISO), o null si nunca hubo. */
  inicio: string | null;
  /** Fin de la última pasada (ISO), o null si nunca terminó ninguna. */
  fin: string | null;
  /** Motivo saneado del corte cuando la pasada falló; null si no lo hay. */
  motivo: string | null;
  lotes: number;
  casosNuevos: number;
  casosActualizados: number;
  reingresados: number;
  /** Como mucho 20 fallos; el total real va en `fallosTotales`. */
  fallos: FalloSincronizacion[];
  fallosTotales: number;
  /** Había más páginas de las que se leen en una pasada; el resto entra en la siguiente. */
  truncado: boolean;
  /**
   * G-09 (Plan 23): cuántos casos TARDÍOS hubo en la última pasada —llegaron a un lote que ya salió
   * a sorteo en Ejecución—; puede ser más que `tardios.length`. NO son fallos: no suman a
   * `fallosTotales` ni vuelven PARCIAL la pasada, y se repiten en cada pasada hasta que Resolución
   * mande el caso en un lote nuevo. Opcional para tolerar un backend anterior.
   */
  casosTardios?: number;
  /**
   * G-09 (Plan 23): los primeros 20 casos tardíos, con el motivo ya saneado por el servidor. NO son
   * fallos (ver `casosTardios`): la línea los enseña solo en su `title`, en un bloque propio.
   * Opcional para tolerar un backend anterior.
   */
  tardios?: FalloSincronizacion[];
}

/**
 * Resultado de GENERAR datos de prueba → POST /entrada-lotes/dev/generar. Espeja
 * generarLotesDePrueba del backend.
 *
 * 🔴 YA NO TRAE `purgados` (2026-09-17): el verbo dejó de purgar. Antes empezaba borrando la bandeja
 * entera y devolvía cuántos lotes se había llevado por delante; ahora SUMA a lo que ya hay y no hay
 * nada que contar. Para vaciar está `purgarLotesDePrueba`, que sigue devolviendo sus conteos.
 */
export interface GenerarLotesResult {
  /** Resumen de los lotes de prueba generados (el shape de `SyncResult`). */
  sincronizados: SyncResult;
}

/**
 * Timeout PROPIO de la generación de datos de prueba. El global del httpClient es de 5 s y aquí no
 * alcanza: se ATERRIZA un EPAS por cada caso generado, uno detrás de otro, y desde el 2026-09-02 un
 * lote trae hasta 20 casos (CASOS_POR_LOTE en el backend) — del orden de 60–90 por corrida. Con los
 * 5 s globales el navegador aborta la petición A MEDIAS: el backend sigue sembrando y el usuario ve
 * un error sobre una siembra que en realidad terminó bien. Mismo patrón que la descarga del
 * expediente y la subida del oficio de coactiva.
 */
export const GENERAR_TIMEOUT_MS = 120_000;

/**
 * FILTROS + PAGINADO de las bandejas (reunión del 2026-09-16, puntos 1, 3 y 7). Espeja
 * `BandejaFiltros` del backend palabra por palabra. Todos los campos son opcionales: sin ninguno, la
 * bandeja responde su primera página completa.
 */
export interface BandejaFiltros {
  /**
   * Buscador general: nº de lote, nº de expediente, código de infracción (Fase 03.23), nombre del
   * administrado y cédula/RUC.
   */
  search?: string;
  /**
   * Materia por su ID de Sorteo (subId, p. ej. `"26"` = LICENCIAMIENTO; quick 261104-jh1). El
   * backend lo valida como entero ≥ 1 y deja los lotes con algún caso de esa materia. Vacío = todas.
   */
  materiaId?: string;
  /** Inicio del rango sobre la fecha de ingreso del lote (`YYYY-MM-DD`), inclusive. */
  fechaDesde?: string;
  /** Fin del rango, INCLUSIVE (el backend compara por día, no por instante). */
  fechaHasta?: string;
  /** Tamaño de página. El backend lo acota a 100. */
  limit?: number;
  /** Nº de lotes a saltar. */
  offset?: number;
}

/**
 * Respuesta PAGINADA de una bandeja. Misma forma que el resto de listados del proyecto
 * (`EpasListResponse`, etc.), para que la pantalla no aprenda una forma nueva.
 */
export interface BandejaPaginada<T> {
  /** Los lotes de ESTA página, con sus casos. */
  data: T[];
  /** Total de lotes que cumplen el filtro (NO los de la página). */
  total: number;
  /** Tamaño de página aplicado. */
  limit: number;
  /** Desplazamiento aplicado. */
  offset: number;
  /** Página actual, base 1. */
  page: number;
  /** Total de páginas. 0 si no hay resultados. */
  pages: number;
}

/**
 * Convierte los filtros en query params, OMITIENDO los vacíos.
 *
 * 🔴 Omitir y no mandar en blanco: el `ValidationPipe` del backend corre con `whitelist: true` y
 * `forbidNonWhitelisted: true`, pero además `fechaDesde: ""` fallaría el `@Matches` del DTO y la
 * bandeja respondería 400 por un campo que el usuario nunca rellenó. Un filtro sin valor no es un
 * filtro vacío: es un filtro que no está.
 */
function toQueryParams(filtros: BandejaFiltros): Record<string, string> {
  const params: Record<string, string> = {};
  const search = (filtros.search ?? "").trim();
  if (search.length > 0) params.search = search;
  if (filtros.materiaId) params.materiaId = filtros.materiaId;
  if (filtros.fechaDesde) params.fechaDesde = filtros.fechaDesde;
  if (filtros.fechaHasta) params.fechaHasta = filtros.fechaHasta;
  if (filtros.limit != null) params.limit = String(filtros.limit);
  if (filtros.offset != null) params.offset = String(filtros.offset);
  return params;
}

export const EntradaLotesService = {
  /**
   * Bandeja del DIRECTOR: lotes del flujo interno aún no remitidos →
   * GET /entrada-lotes/bandeja-director. Es su cola de triage de entrada.
   *
   * @param filtros buscador general, rango de fechas y paginado; todos opcionales.
   */
  async bandejaDirector(
    filtros: BandejaFiltros = {},
  ): Promise<BandejaPaginada<EnvioLoteDto>> {
    const { data } = await httpClient.get<BandejaPaginada<EnvioLoteDto>>(
      "/entrada-lotes/bandeja-director",
      { params: toQueryParams(filtros) },
    );
    return data;
  },

  /**
   * Bandeja del SECRETARIO: lotes ya sellados por el director (director→secretario) →
   * GET /entrada-lotes/bandeja-secretario. Es lo que el secretario acciona (aprobar-enviar-sorteo).
   *
   * @param filtros buscador general, rango de fechas y paginado; todos opcionales.
   */
  async bandejaSecretario(
    filtros: BandejaFiltros = {},
  ): Promise<BandejaPaginada<EnvioLoteDto>> {
    const { data } = await httpClient.get<BandejaPaginada<EnvioLoteDto>>(
      "/entrada-lotes/bandeja-secretario",
      { params: toQueryParams(filtros) },
    );
    return data;
  },

  /**
   * Estado de la ÚLTIMA sincronización automática con Resolución → el GET …/sincronizacion
   * (Fase 03.24, Plan 13; roles director y secretario abogado). Es una lectura: no dispara ninguna
   * pasada — desde la Fase 03.24 (D-09) nadie sincroniza a mano. Con la integración apagada llega
   * `habilitada: false` y la Bandeja no pinta nada (D-10).
   */
  async estadoSincronizacion(): Promise<EstadoSincronizacionResolucion> {
    const { data } = await httpClient.get<EstadoSincronizacionResolucion>(
      "/entrada-lotes/sincronizacion",
    );
    return data;
  },

  /**
   * Sello del reenvío director→secretario (patrón RECE-08) → PATCH /entrada-lotes/:id/approve-director.
   * Body VACÍO: el actor (usu_id del director) lo deriva el backend del JWT (@CurrentUser), NUNCA del
   * body (anti-Spoofing T-03.8-09). Aprobar aquí NO envía al sorteo — solo sella la remisión.
   *
   * @param envlId envl_id del lote a sellar.
   */
  async approveDirector(envlId: number): Promise<RemisionDirectorResult> {
    const { data } = await httpClient.patch<RemisionDirectorResult>(
      `/entrada-lotes/${envlId}/approve-director`,
      {},
    );
    return data;
  },

  /**
   * Aprueba y ENVÍA el lote al sorteo (acto del SECRETARIO) →
   * PATCH /entrada-lotes/:id/aprobar-enviar-sorteo. Body VACÍO: el actor lo deriva el backend del JWT.
   * Es el paso que liga la ENTRADA con el SORTEO (puebla envl_amas_id), consumido luego por el modal
   * Resultado del sorteo (Plan 04).
   *
   * ⟳ quick 261029-kl0: deja fuera lo que está con el director y lo dice en `excluidos`.
   *
   * @param envlId envl_id del lote a aprobar y remitir al sorteo.
   */
  async aprobarEnviarSorteo(
    envlId: number,
  ): Promise<AprobarEnviarSorteoResult> {
    const { data } = await httpClient.patch<AprobarEnviarSorteoResult>(
      `/entrada-lotes/${envlId}/aprobar-enviar-sorteo`,
      {},
    );
    return data;
  },

  /**
   * DEVUELVE el lote a la DMR → PATCH /entrada-lotes/:id/devolver-dmr. A DIFERENCIA de los otros verbos,
   * el body NO es vacío: exige `observaciones` (el motivo/informe de la devolución). El actor lo deriva
   * el backend del JWT. Compartida por director y secretario abogado.
   *
   * @param envlId envl_id del lote a devolver.
   * @param observaciones motivo OBLIGATORIO de la devolución.
   */
  async devolverDmr(
    envlId: number,
    observaciones: string,
  ): Promise<DevolverDmrResult> {
    const { data } = await httpClient.patch<DevolverDmrResult>(
      `/entrada-lotes/${envlId}/devolver-dmr`,
      { observaciones },
    );
    return data;
  },

  /**
   * Bandeja de SALIDA: lotes remisibles a Secretaría General (envl_tipo IN ('FINALIZADO','ENVIO'))
   * → GET /entrada-lotes/bandeja-salida. Es la cola COMPARTIDA por director y secretario (a diferencia
   * del reparto exclusivo de la entrada). Espeja el estilo de bandejaSecretario.
   */
  async bandejaSalida(
    filtros: BandejaFiltros = {},
  ): Promise<BandejaPaginada<EnvioLoteDto>> {
    const { data } = await httpClient.get<BandejaPaginada<EnvioLoteDto>>(
      "/entrada-lotes/bandeja-salida",
      { params: toQueryParams(filtros) },
    );
    return data;
  },

  /**
   * Envía el lote a Secretaría General (cierra el flujo local) →
   * PATCH /entrada-lotes/:id/enviar-sg. Body VACÍO ({}): el actor (usu_id) y el rol los deriva el
   * backend del JWT (@CurrentUser), NUNCA del body (anti-Spoofing T-03.9-02). El envío es IDEMPOTENTE
   * en el backend: si el lote ya está en 'ENVIADO_SG' devuelve un no-op (enviado=false, alreadySent=true)
   * sin re-disparar el seam de SG.
   *
   * @param envlId envl_id del lote a remitir a Secretaría General.
   */
  async enviarSg(envlId: number): Promise<EnviarSgResult> {
    const { data } = await httpClient.patch<EnviarSgResult>(
      `/entrada-lotes/${envlId}/enviar-sg`,
      {},
    );
    return data;
  },

  /**
   * GENERA datos de prueba en la Bandeja de Entrada → POST /entrada-lotes/dev/generar. AÑADE lotes
   * nuevos a los que ya hay. Body VACÍO ({}): el actor lo deriva el backend del JWT (@CurrentUser).
   * El gate REAL del efecto es SEED_ENABLED en el backend (default OFF).
   *
   * 🔴 ES ADITIVO (2026-09-17, encargo del usuario). La ruta cambió de `dev/reseed` a `dev/generar`
   * porque el verbo cambió: antes purgaba la bandeja entera antes de sembrar, y «reseed» decía
   * justamente eso. Ahora SUMA. Para vaciar, `purgarLotesDePrueba`.
   */
  async generarLotesDePrueba(): Promise<GenerarLotesResult> {
    const { data } = await httpClient.post<GenerarLotesResult>(
      "/entrada-lotes/dev/generar",
      {},
      { timeout: GENERAR_TIMEOUT_MS },
    );
    return data;
  },

  /**
   * PURGA DEV de la Bandeja de Entrada (datos de prueba) → PATCH /entrada-lotes/dev/purge. Borra TODOS los
   * lotes/casos SIN re-sincronizar (deja la bandeja vacía). REEMPLAZA al viejo
   * InboxCasesService.resetInboxCases (que purgaba EXPEDIENTES/EPAS del modelo anterior). Body VACÍO ({}).
   * El gate REAL del efecto es SEED_ENABLED en el backend (default OFF).
   */
  async purgarLotesDePrueba(): Promise<PurgeLotesResult> {
    const { data } = await httpClient.patch<PurgeLotesResult>(
      "/entrada-lotes/dev/purge",
      {},
    );
    return data;
  },
  /**
   * Expedientes PENDIENTES de una de las tres pestañas → GET /entrada-lotes/salida/pendientes.
   *
   * @param destino SG (pendientes de archivo), DMR o DMIT (devueltos pendientes de remitir).
   */
  async pendientesSalida(
    destino: DestinoSalida,
    filtros: BandejaFiltros = {},
  ): Promise<BandejaPaginada<ExpedientePendienteSalida>> {
    const { data } = await httpClient.get<
      BandejaPaginada<ExpedientePendienteSalida>
    >("/entrada-lotes/salida/pendientes", {
      params: { ...toQueryParams(filtros), destino },
    });
    return data;
  },

  /**
   * DESPACHA los expedientes elegidos → POST /entrada-lotes/salida/despachar. Crea el lote y ejecuta
   * la acción del destino. El actor lo deriva el backend del JWT; aquí solo viajan los expedientes.
   *
   * Espera {@link FIRMA_TIMEOUT_MS} (45 s), el mismo techo que los demás actos que firman:
   * archivar un lote de treinta expedientes transiciona treinta EPAS uno detrás de otro, y los 5 s
   * del httpClient abortarían la petición a medias; y hacia DMR/DMIT el memorando se firma en
   * auth-amc, que el backend corta a los 25 s (`APP-FIRMA-NO-RESPONDE-001`).
   *
   * 🔴 POR DEBAJO DE LOS 60 s DEL NGINX (revisión 03.21, WR-08). Antes compartía los 120 s de la
   * siembra, pero el bloque `/api/` del `nginx.conf` corta a los 60 s (`proxy_read_timeout`): pasado
   * ese punto llegaba un 504 opaco —pintado como fallo del servidor— mientras el backend podía estar
   * terminando de crear el lote y de firmar el memorando. Con 45 s aborta el navegador y el usuario
   * ve el aviso de tiempo de la app, que le dice que actualice para comprobar si se completó antes de
   * repetirlo: el resultado es DESCONOCIDO, no «no se hizo nada». Subirlo exige antes subir el
   * `proxy_read_timeout`.
   *
   * 🔴 LA CLAVE DE FIRMA (Fase 03.21, D-16/D-24). Hacia la DMR o la DMIT el memorando de devolución
   * se firma con la clave del DIRECTOR en el mismo acto (solo él despacha esas devoluciones; el
   * backend rechaza a cualquier otro rol). Viaja como `signPassword` del CUERPO, nunca en la query,
   * y solo si no está en blanco: una clave vacía sería pedirle al firmador que lo intente con nada.
   * Se manda tal cual se tecleó, sin recortar. Hacia SG no hay memorando y no se pasa.
   *
   * @param destino SG, DMR o DMIT.
   * @param eejeIds los expedientes elegidos.
   * @param signPassword clave de firma del director, solo con el firmador encendido. Opcional.
   */
  async despacharSalida(
    destino: DestinoSalida,
    eejeIds: number[],
    signPassword?: string,
  ): Promise<DespachoSalidaResult> {
    const { data } = await httpClient.post<DespachoSalidaResult>(
      "/entrada-lotes/salida/despachar",
      {
        eejeIds,
        ...(signPassword?.trim() ? { signPassword } : {}),
      },
      { params: { destino }, timeout: FIRMA_TIMEOUT_MS },
    );
    return data;
  },
};

export default EntradaLotesService;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// BANDEJA DE SALIDA por EXPEDIENTE (reunión del 2026-09-17)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A dónde va el lote de salida. Espeja `DestinoSalida` del backend PALABRA POR PALABRA: es el valor
 * que viaja en el query param `destino` y el backend lo acota con un `@IsIn` a estos tres. Añadir
 * aquí uno que allí no exista devuelve un 400; quitar uno que allí sí exista deja una pestaña que
 * nadie puede abrir.
 */
export type DestinoSalida = "SG" | "DMR" | "DMIT";

/**
 * Un EXPEDIENTE pendiente de despacho. Espeja `ExpedientePendienteSalida` del backend.
 *
 * 🔴 NO es un lote. La unidad que el usuario elige en la Bandeja de Salida es el EXPEDIENTE; el
 * lote es lo que se crea DESPUÉS con lo elegido.
 */
export interface ExpedientePendienteSalida {
  eejeId: number;
  eejeStatus: string;
  expNumber?: string;
  expZone?: string;
  expCreatedAt?: string;
  admiName?: string;
  admiLastname?: string;
  admiBusinessName?: string;
  admiIdentification?: string;
  multaImpuesta?: number;
  resolucionNumero?: string;
  /** Cuándo se selló la remisión a SG (providencia del acto 21). Solo en la pestaña de SG. */
  sgRemitidoAt?: string;
  /**
   * Cuándo se SELLÓ la devolución: el botón «Devolver a DMR» de la Bandeja de Entrada, o la
   * providencia de devolución por nulidad. Solo en las pestañas de devolución, y ahí NUNCA viene
   * vacío: es la mitad del criterio de la pestaña, no un dato adjunto. El estado no basta —lo
   * alcanzan también el ruteo del sync y la siembra de datos de prueba—, así que el backend exige
   * el sello (encargo del 2026-09-17).
   *
   * 🔴 Se llamaba `dmrDevueltoAt` y dejó de hacerlo el 2026-09-18, a la vez que la columna y que el
   * campo del backend: el sello ya no es de la DMR, es de la devolución.
   */
  devueltoAt?: string;
  /**
   * A qué dirección se devolvió. La OTRA mitad del criterio: con tres pestañas, el sello dice que
   * alguien devolvió y esto dice a quién. Nunca es `"SG"` — archivar no es devolver.
   */
  devueltoDestino?: Exclude<DestinoSalida, "SG">;
  /**
   * Cuántas observaciones esperan todavía el veredicto del director (2026-09-18).
   *
   * 🔴 MIENTRAS SEA > 0, EL EXPEDIENTE NO SE PUEDE DESPACHAR: lo rechaza el backend. Esta cifra es
   * lo que permite a la pantalla decirlo ANTES —apagando la casilla— en vez de dejar elegir treinta
   * expedientes y soltar el error al confirmar.
   */
  observacionesPendientes: number;
  /** Las que el director hizo suyas: son las que imprimirá el memorando de devolución. */
  observacionesAprobadas: number;
  /** Las que desechó. No viajan a la otra dirección; se quedan en la ficha con su motivo. */
  observacionesRechazadas: number;
}

/** Desenlace del despacho: el lote creado y si además se pudo remitir. */
export interface DespachoSalidaResult {
  envlId: number;
  numeroLote: string;
  casos: number;
  /**
   * `false` cuando el lote SE CREÓ pero el envío a SG falló. No es un error del todo: los
   * expedientes quedan dentro del lote y se puede reintentar. `detalle` dice por qué.
   */
  despachado: boolean;
  detalle?: string;
  /**
   * URL del MEMORANDO DE DEVOLUCIÓN con el que el lote sale hacia la DMR — el espejo del memo con
   * el que ellos nos remiten (encargo del 2026-09-17). Solo en el destino DMR.
   *
   * `null` significa que el despacho SÍ se hizo pero el PDF no se pudo generar: la devolución no se
   * deshace por un documento, y el memo puede regenerarse contra el lote que quedó.
   *
   * 🔴 Desde la Fase 03.21 (D-07) eso SOLO puede darse con el firmador APAGADO. Con el firmador
   * encendido rige el todo o nada: si el memorando no se firma, el lote se elimina y el despacho
   * responde con un error `APP-FIRMA-*`, así que un `null` describiría un estado imposible.
   */
  memoUrl?: string | null;
  /**
   * Si el memorando de devolución salió FIRMADO por el director (Fase 03.21, D-19). Solo en DMR/DMIT;
   * `false` con el firmador apagado. Es lo que permite al aviso de éxito decir si se firmó.
   */
  memoFirmado?: boolean;
}

