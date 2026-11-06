/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Servicio frontend del sorteo, firma SECUENCIAL del acta D2 (3 firmas por sublote),
 *   aceptación explícita y excusa/reasignación (FEND-03)
 * Archivo: SorteoService.ts
 * Responsabilidad: Consumir el backend de Ejecución (:3004) en los endpoints /sorteo/* construidos en
 *   los Planes 02–07 (POST /sorteo, POST /sorteo/:cassId/aceptar,
 *   PATCH /sorteo/:amasId/:decisorUserId/firmar, GET /sorteo/:amasId/:decisorUserId/acta,
 *   GET /sorteo/mis-asignados, GET /sorteo/causales-excusa, POST /sorteo/:cassId/excusa,
 *   PATCH /sorteo/:cassId/approve|reject-reassignment) y el COMBO de firma de la Fase 3.12
 *   (PATCH /sorteo/firmar-lotes, ADITIVO: no reemplaza la firma individual). La firma es SECUENCIAL por sublote
 *   `(amasId, decisorUserId)` (Camino Y): 1) decisor → 2) secretario → 3) director; el rol firmante y
 *   el actor los deriva el backend del JWT, NO el cliente. Todo el HTTP pasa por api/httpClient (nunca
 *   axios directo); el interceptor inyecta Authorization: Bearer desde localStorage.authToken. El
 *   actor/rol (assignedBy/firmante/aprobador/requestedBy) NUNCA viaja en el body (anti-Spoofing
 *   T-03-24, T-3.4-21). LA UX DEL TURNO SECUENCIAL (a quién se le muestra "firmar" según estado/rol)
 *   queda FUERA DE ALCANCE de este servicio: se acota a un componente de UI futuro (ver firmarLote).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-22
 * Modificado por: Andrés Miño — 2026-09-15 (la excusa se sustenta con una CAUSAL del catálogo y un
 *   detalle opcional; nuevo GET /sorteo/causales-excusa — punto 4 del acta del 2026-09-11).
 * Modificado por: Andrés Miño — 2026-09-16 (excusar() manda las cabeceras multipart, que le faltaban
 *   desde el 2026-09-01: sin ellas axios convertía el FormData a JSON y el POST moría en 400).
 * Modificado por: Andrés Miño — 2026-09-16 (Quick 260916-kwg, D-03: `excusar()` VUELVE A JSON y
 *   entra `vistaPreviaEscritoExcusa()`).
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, D-09/D-10: `MiEpasAsignado` declara los 11
 *   campos que el backend YA devuelve desde el Plan 03 — `caseId` y los diez del administrado y del
 *   expediente. Sólo crece el TIPO DE LA FILA: la firma de `misAsignados()` —filtros y sobre
 *   paginado— la cambia el Plan 17, que es el dueño de ese método).
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-g35: `MiEpasAsignado` declara
 *   el id y el nombre (`expMateria`) de la materia DEL EXPEDIENTE que el backend ya proyecta;
 *   `submateria` queda documentada como la del reparto. Ningún método cambia.)
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: `MiEpasAsignado` documenta ese id como
 *   id de SUBMATERIA y `expMateria` como la materia PADRE, y declara `expSubmateria`.)
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 02 — D-06: entran `OrdenEnBandeja` y
 *   `OrdenesEnBandeja`, y `MiEpasAsignado` declara el campo `ordenes` que el backend ya proyecta
 *   desde el Plan 01 de esta fase. Sólo crece el TIPO DE LA FILA: ningún método cambia.)
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 17, D-09: `misAsignados()` acepta los
 *   parámetros de tabla y devuelve el SOBRE paginado `{data,total,limit,offset,page,pages}`. Es un
 *   cambio ROMPEDOR de contrato, y llevaba roto desde el Plan 03: el endpoint dejó de devolver un
 *   array ese día y este método seguía declarándolo. El serializador de filtros vive fuera del
 *   método —`paramsDeMisAsignados`— y emite SOLO los nombres de la allowlist del backend.)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-14/D-17: `MiEpasAsignado` pierde
 *   el id de submateria del catálogo local y la submateria del reparto; `expMateria`/`expSubmateria`
 *   pasan a ser las DEDUCIDAS del código de las infracciones y entra `infracciones?:
 *   ResumenInfracciones`. Los filtros de «Mis expedientes» se declaran en `FiltrosMisAsignados`
 *   (`materiaCod`, `submateriaCod`, `infraccion`). La fila del lote y la de reasignables cambian
 *   `submateria` por `materia`. Ningún método cambia.)
 *
 *   ── 🔴 DÓNDE FUE A PARAR `OPCIONES_SUBIDA`, Y POR QUÉ NO ESTÁ ────────────────────────────────
 *   Se BORRÓ, junto con el import de `SUBIDA_TIMEOUT_MS`, que era su único origen. Existía por el
 *   arreglo del `89bf440`: la excusa viajaba como multipart y sin esa cabecera el `transformRequest`
 *   de axios 1.x convertía el `FormData` a JSON, el `File` se iba como `{}` y el backend respondía
 *   400 «property file should not exist».
 *
 *   Con el endpoint en JSON **no hay nada que forzar**: `httpClient` ya nace con
 *   `Content-Type: application/json`, que es justo lo que este cuerpo necesita. Mantener el objeto
 *   «por si acaso» dejaría un cepo esperando a que alguien se lo aplicara por simetría con los otros
 *   siete multipart del módulo — y volvería a romper el POST, esta vez al revés. Lo que cerró aquel
 *   defecto de verdad no fue la cabecera: fue quitar el multipart.
 *
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 11, D-05): `MiEpasAsignado` trae la
 *   lista de datos de Resolución que faltan, calculada por el servidor (Plan 10), para el aviso
 *   `AvisoDatosResolucion` de «Mis expedientes» y de la ficha. Ningún método cambia.
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08 — D-12/D-16/D-19: `ModoDeFirma`
 *   con `sesionCentral`; `excusar` acepta la clave de firma y la manda en el JSON solo si la hay;
 *   `excusar` y `firmarLote` esperan `FIRMA_TIMEOUT_MS` (45 s) en vez de los 5 s globales.)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 15 — D-10/D-20: `ComboMotivo` espeja los
 *   dos motivos nuevos del backend, `FIRMA_FALLIDA` y `FIRMA_NO_INTENTADA`, y `FirmarLotesOmitido`
 *   declara `causaFirma`, la causa cerrada que viaja con ellos.)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: la materia y la submateria son las de
 *   Sorteo; los filtros de «Mis expedientes» pasan a `materiaId`/`submateriaId` —ids de Sorteo— y
 *   «Sin materia» viaja como flag en `infracciones.sinMateria`, nunca en los nombres)
 */
import httpClient from "../api/httpClient";
import { errorDeBlob } from "../utils/blobError.util";
import type { ObligacionHacerEnBandeja } from "../interfaces/IObligacionHacer";
import type { ResumenInfracciones } from "./InfraccionesService";
import { appendTableFilterParams } from "../utils/tableFilterParams.util";
// El sobre paginado se REUTILIZA: `entrada-lotes` ya lo declaró y el backend devuelve el mismo en
// los dos sitios. Es un import SOLO DE TIPO entre servicios, que es lo que ya hace
// `ProvidenciaService.ts:22` — declarar aquí una segunda copia de `{data,total,limit,offset,…}`
// dejaría dos contratos que acabarían divergiendo y que el frontend tendría que aprenderse los dos.
import type { BandejaPaginada } from "./EntradaLotesService";
// La causa de un fallo de firma tiene UN solo espejo en el frontend (`firmaCopy.ts`): redeclararla
// aquí dejaría dos listas de siete literales que acabarían divergiendo.
import type { CausaFirma } from "../config/firmaCopy";
// Los dos literales de la orden de pago se REUTILIZAN, no se redeclaran: dos copias del mismo tipo
// acaban divergiendo, y es el mismo criterio por el que este archivo ya reutiliza `BandejaPaginada`
// y `ObligacionHacerEnBandeja` en vez de copiarlos. `import type` porque sólo se usan como tipos.
import type {
  EstadoOrdenPago,
  TipoOrdenPago,
} from "./OrdenPagoService";

/**
 * Una orden de pago VIGENTE tal como la trae cada fila de `GET /sorteo/mis-asignados`.
 *
 * Espeja `OrdenEnBandeja` del backend (`ordenes-pago/infrastructure/orden-pago.sql.ts`, Fase 03.22
 * Plan 01). Es ESTRECHO a propósito: no lleva los campos de anulación (`anuladaAt`, `anuladaBy`,
 * `anuladaMotivo`) porque la celda no los pinta y el histórico completo viaja por
 * `GET /ordenes-pago/:eejeId/historial`, que desde D-07 se lee en la línea de tiempo.
 *
 * ⚠️ `registradaAt` viaja como cadena ISO aunque en el backend sea `Date`: cruzar HTTP lo serializa,
 * igual que en `OrdenPago` (`OrdenPagoService.ts:35`).
 */
export interface OrdenEnBandeja {
  ordpId: number;
  tipo: TipoOrdenPago;
  numero: string;
  estado: EstadoOrdenPago;
  registradaAt: string;
  registradaBy: number;
}

/**
 * El bloque `ordenes` de una fila de la bandeja: las dos órdenes vigentes y la marca de escritura.
 *
 * 🔴 `editable` LO RESUELVE EL SERVIDOR, desde `ee.usu_assigned` — la MISMA columna que lee el guard
 * de pertenencia `assertEsSuDecisor` (D-04, doctrina CH-5). La pantalla lo PINTA y no reimplementa
 * la regla: si la derivara, un día diría que sí donde el backend dice que no.
 *
 * Va DENTRO del bloque y no en la raíz de la fila porque es este bloque el que autoriza; las demás
 * acciones del EPAS las gobierna el motor de condiciones de `CeldaAcciones`.
 */
export interface OrdenesEnBandeja {
  multa?: OrdenEnBandeja;
  remanente?: OrdenEnBandeja;
  editable: boolean;
}

/**
 * Un expediente de la tanda del sorteo. Espeja SorteoItemDto del backend (create-sorteo.dto).
 *
 * 🔴 SIN submateria (quick 261006-kys, F-02): el reparto va por la submateria DEL EXPEDIENTE y la
 * lee el servidor. El backend ya no declara `subId` ni `materia`, así que mandarlos es un 400.
 */
export interface SorteoItem {
  /** eeje_id del EPAS local a reflejar tras el sorteo. */
  eejeId: number;
  /** case_id de Asignaciones/Core que consume assign-cases. */
  caseId: number;
}

/** Contrato de entrada de POST /sorteo. La tanda llega como items; sin campo de actor. */
export interface SortearPayload {
  items: SorteoItem[];
  observaciones?: string;
}

/** Resultado por expediente del sorteo (éxito parcial estilo returnBatch del backend). */
export interface SorteoItemResult {
  eejeId: number;
  ok: boolean;
  error?: string;
}

/** Resultado del sorteo (forma laxa: el backend devuelve amasId + resultados por caso). */
export interface SorteoResult {
  amasId?: number;
  results?: SorteoItemResult[];
}

/** Fila de la bandeja del decisor. Espeja MiEpasAsignadoDto del backend (camelCase). */
export interface MiEpasAsignado {
  eejeId?: number;
  eejeStatus?: string;
  expNumber?: string;
  amasId?: number;
  /** cass_id del case-assignment; base de la excusa/reasignación (RECE-07). */
  cassId?: number;
  /**
   * case_id del caso en ASIGNACIONES. Gatea la mitad de Asignaciones de la línea de tiempo (D-07):
   * sin él no se puede pedir `/sorteo/caso/:caseId/historial` y el modal degrada a media traza.
   *
   * 🔴 NO ES `cassId` Y NO LO SUSTITUYE: aquél identifica UNA asignación concreta, éste identifica
   * el CASO a lo largo de todas sus asignaciones. `undefined` en los reflejos anteriores a la
   * columna `case_id` — que hoy son la mayoría (63 de 72 medidos el 2026-09-21): ésos conservan su
   * bitácora interna y pierden sólo la traza externa, y eso es lo que la pantalla debe DECIR.
   */
  caseId?: number;
  /**
   * `t_subject` de Asignaciones con el que se repartió el caso (D-18). Es un id CRUDO y no tiene
   * nombre local: la materia que se pinta es `expMateria`, deducida de las infracciones.
   */
  subId?: number;
  userId?: number;
  /** Inicio del plazo de aceptación implícita. */
  sorteoAt?: string;
  /** Plazo de aceptación implícita en días (D-06). */
  plazoDias?: number;
  /** Instante en que vence el plazo (derivado en SQL por el backend). */
  plazoVenceAt?: string;
  /** Veredicto computed-on-read: true cuando el plazo venció y el reflejo sigue activo. */
  aceptadoImplicito?: boolean;
  /** VEREDICTO EFECTIVO: aceptado explícita O implícitamente. Gatea las dos fases de la bandeja del
   * decisor (resumen previo → expediente completo) y la visibilidad del botón de firmar. */
  aceptado?: boolean;
  /** true si el decisor aceptó EXPLÍCITAMENTE (epsor_aceptado_at). Distingue "aceptado a mano" de
   * "aceptado automáticamente por vencimiento del plazo" en el badge. */
  aceptadoExplicito?: boolean;
  /** true si el decisor se excusó y el director aún NO resolvió la excusa: oculta Excusar/Aceptar. */
  excusaPendiente?: boolean;
  /** true si el EPAS trae impugnación (recurso de apelación): gatea la rama de impugnación tras aceptar. */
  tieneImpugnacion?: boolean;
  /**
   * ESTADO DEL TRÁMITE INTERNO: nombre de la ÚLTIMA providencia emitida sobre el expediente.
   *
   * No sustituye a `eejeStatus` —la máquina de estados legal, que solo mueven tres acciones—, lo
   * acompaña: emitir cualquiera de las otras 29 providencias no cambiaba nada visible, y ahora sí
   * dice por dónde va el trámite. `undefined` = todavía no se emitió ninguna.
   */
  estadoTramite?: string;
  /** Cuándo se emitió esa providencia (ISO). */
  estadoTramiteAt?: string;
  /** Instante de la aceptación explícita (undefined si nunca se aceptó a mano). */
  aceptadoAt?: string;
  /** Administrado (razón social o nombre+apellido). Resumen previo (fase 1) + expediente rico (fase 2). */
  administrado?: string;
  /** Cédula/RUC del administrado. Parte del resumen mínimo previo a aceptar. */
  cedula?: string;
  /**
   * MATERIA del expediente en SORTEO (quick 261104-jh1): los nombres resueltos por la submateria de
   * cada infracción, unidos con « / » si hay varias (D-00b). SOLO nombres resueltos: «Sin materia»
   * es el flag `infracciones.sinMateria`, nunca un nombre.
   *
   * Gatea la columna «Materia». Ausente cuando ninguna infracción tiene materia, y la celda pinta
   * «—» o «Sin materia». Espeja `MiEpasAsignadoDto` del backend (Plan 18).
   */
  expMateria?: string;
  /**
   * SUBMATERIA del expediente en Sorteo (quick 261104-jh1). Es una LISTA: los nombres distintos,
   * ordenados y unidos con «, ». Gatea la columna «Submateria»; ausente en los
   * mismos casos que `expMateria`.
   */
  expSubmateria?: string;
  /**
   * Fase 03.23, Plan 18 (D-08/D-16) — EL RESUMEN DE INFRACCIONES del EPAS: sus códigos, los ids de
   * Sorteo de sus materias y submaterias (los de los filtros), si alguna está «sin materia», el estado de la última lectura de CORE
   * y los avisos de conflicto y descuadre, decididos en el servidor con las MISMAS reglas que la
   * ficha. Sale de la foto: la bandeja no llama a CORE.
   *
   * ⚠️ Un EPAS sin infracciones llega con `descuadre: true`: la celda debe decir «sin
   * infracciones», no «descuadre» (mirar `codigos.length` primero).
   */
  infracciones?: ResumenInfracciones;
  /**
   * Fase 03.24 (D-05) — LOS DATOS DE RESOLUCIÓN QUE FALTAN: lista de códigos (`MULTA`,
   * `RESOLUCION_NUMERO`, `RESOLUCION_FECHA`, `CORE_ID`, `INFRACCIONES`) calculada por el servidor
   * con el fragmento de `resolucion-faltantes.sql.ts`, en la misma consulta que hidrata la fila.
   *
   * `null` = el EPAS no vino de Resolución (demo, «Generar datos») y no lleva aviso; `[]` = vino y
   * no falta nada. El aviso INFORMA, no bloquea: el TC sin infracciones lo sigue bloqueando la 03.23.
   * Lo pinta `AvisoDatosResolucion`.
   */
  datosResolucionFaltantes?: string[] | null;

  // ── 2026-09-21 (D-09/D-10): las columnas de la BANDEJA y las que rellenan la FICHA del `👁` ──
  //
  // `administrado` (arriba) llega ya CONCATENADO, y eso sirve para leer pero no para filtrar por
  // columna ni para rellenar la ficha: la tabla tiene una caja bajo NOMBRES y otra bajo APELLIDOS.
  // Éstos son los mismos joins que el backend ya hacía, proyectados sin fundir — ni tabla nueva ni
  // consulta nueva. Los nombres son los del DTO PALABRA POR PALABRA (`mi-epas-asignado.dto.ts`):
  // el contrato es el de la red, y una letra distinta aquí sería un campo que llega y nadie lee.
  //
  // 🔴 CUATRO DE ELLOS NO SE VEN EN LA BANDEJA Y AUN ASÍ ENTRAN. `admiEmail`, `expFojas` y
  // `expMedidaCautelar` gatean que la FICHA del `👁` no tenga que pedir nada —lee el mismo contrato
  // que `EnvioLoteCaso`, y sin ellos sale con huecos—; `caseId` (arriba) gatea la línea de tiempo.

  /** NOMBRES del administrado. Gatea la columna NOMBRES de la bandeja, su filtro y la ficha. */
  admiName?: string;
  /** APELLIDOS del administrado. Gatea la columna APELLIDOS, su filtro y la ficha. */
  admiLastname?: string;
  /** TELÉFONO del administrado. Gatea la columna TELEFONO y el contacto de la ficha. */
  admiTelephone?: string;
  /** NEGOCIO / razón social. Gatea la columna NEGOCIO y, en la ficha, que el administrado se
   * identifique por su razón social en vez de por nombre + apellido. */
  admiBusinessName?: string;
  /** DIRECCIÓN del administrado. Gatea la columna DIRECCION y el domicilio de la ficha. */
  admiAddress?: string;
  /** CORREO del administrado. Gatea la ficha del `👁` y decide si la notificación electrónica es
   * posible; no se pinta como columna de la bandeja. */
  admiEmail?: string;
  /** ZONAL del expediente. Gatea la columna ZONAL y su filtro (texto libre, no catálogo). */
  expZone?: string;
  /** Fecha de CREACIÓN del expediente (ISO). Gatea la columna «Creado…» y su filtro de RANGO
   * (`expCreatedAtFrom`/`expCreatedAtTo`), el único filtro de la bandeja que no es texto. */
  expCreatedAt?: string;
  /** FOJAS del expediente. Gatea la ficha del `👁`, que cuenta el físico; no es columna. */
  expFojas?: number;
  /** MEDIDA CAUTELAR del expediente, si la hay. Gatea la ficha, y es alta señal: cambia lo que el
   * decisor puede hacer con el expediente. */
  expMedidaCautelar?: string;

  // ── Lo que trae la RESOLUCIÓN DE ORIGEN (2026-09-08) ───────────────────────────────────────
  // Pedido del área usuaria: ver la multa y el acto con el que llega el expediente sin abrir el PDF.
  // Los tres son opcionales y lo van a ser un tiempo — Resolución todavía no los emite y todo lo
  // aterrizado antes del 08-09 los tiene vacíos. La pantalla OMITE la línea cuando falta el dato.

  /** Multa impuesta por la resolución sancionadora, en dólares. */
  multaImpuesta?: number;
  /** Número de la resolución sancionadora con la que llegó el expediente. */
  resolucionNumero?: string;
  /** Fecha de esa resolución (ISO). */
  resolucionFecha?: string;

  /**
   * EL CORRECTIVO, junto a la pecuniaria. Espeja `MiEpasAsignadoDto.obligacionHacer` del backend.
   *
   * 🔴 2026-09-15 — ESTE CAMPO YA VIAJABA Y SE ESTABA TIRANDO. Lo incrustó la Fase 03.16 (D-04) por
   * los fragmentos SQL compartidos de `obligacion-hacer.sql.ts`: el bloque llega por la red desde
   * entonces y `httpClient` lo entrega intacto. Lo que faltaba era esta línea — sin declararlo,
   * TypeScript no lo conocía y la bandeja del decisor no podía leerlo. La fecha del hallazgo queda
   * escrita a propósito: un campo que llega y nadie lee se vuelve a descubrir dentro de un año.
   *
   * ⚠️ OPCIONAL DE VERDAD: un expediente sin correctivo no trae el bloque. Presente con
   * `tiene: false` es «se miró y no lleva»; ausente es «esta respuesta no lo trae».
   *
   * 🔴 NO TRAE EL PELDAÑO (`PeldanoCompulsorio`): sólo viaja en `GET /obligacion-hacer/:eejeId`,
   * porque derivarlo exige contar la serie de multas y la bandeja no la trae. Una condición sobre
   * él es INDECIDIBLE en una fila, y lo indecidible se apaga. `ObligacionHacerEnBandeja` lo hace
   * cumplir: leer el peldaño de una fila no compila.
   */
  obligacionHacer?: ObligacionHacerEnBandeja;

  /**
   * LAS ÓRDENES DE PAGO VIGENTES del expediente (Fase 03.22, D-06). Espeja
   * `MiEpasAsignadoDto.ordenes` del backend, que lo proyecta desde el Plan 01 de esta fase.
   *
   * 🔴 `editable` lo resuelve el SERVIDOR desde `usu_assigned`, la misma columna que lee el guard de
   * pertenencia (D-04, doctrina CH-5), y la pantalla lo PINTA sin reimplementar la regla.
   *
   * ⚠️ OPCIONAL DE VERDAD, y sus dos mitades también: un expediente sin orden de multa llega SIN la
   * clave `multa` —no con una orden vacía—, que es lo que permite a la celda distinguir «no hay
   * orden» de «hay una orden sin número».
   */
  ordenes?: OrdenesEnBandeja;
}

/**
 * Una causal del catálogo de excusa (`t_causal_excusa`), tal como la sirve
 * `GET /sorteo/causales-excusa`. Espeja `CausalExcusa` del backend campo por campo.
 *
 * Las seis vigentes salen del catálogo `RAZONES_EXCUSA` del módulo de Instrucción, adoptado por la
 * «Resolución de Protocolo de Recusación y Excusa». Los códigos se conservan IDÉNTICOS a los de
 * Instrucción a propósito: es lo que permitirá sumar las dos direcciones en un reporte conjunto de
 * la AMC sin una tabla de equivalencias. El desplegable NUNCA los muestra —muestra `titulo`—, pero
 * es `codigo` lo que se persiste.
 */
export interface CausalExcusa {
  /** Código estable de la causal (`caus_codigo`). Es lo que viaja al backend y lo que se guarda. */
  codigo: string;
  /** Texto de la causal tal como lo fija el Protocolo. Es lo único que el decisor lee. */
  titulo: string;
  /** Orden de presentación. El backend ya las devuelve ordenadas; el cliente no reordena. */
  orden: number;
}

/**
 * Caso REASIGNABLE (RECE-07): el director aprobó su excusa y espera que el secretario lo vuelva a
 * sortear (cola de Reasignaciones). Trae el decisor ANTERIOR y el motivo de la excusa.
 */
export interface CasoReasignable {
  /**
   * TEXTO de la causal de excusa (`caus_titulo`), no su código — el backend ya lo resuelve contra el
   * catálogo (acta del 11-09). A diferencia de `motivo`, que el backend vacía al resolverse la
   * excusa y por eso casi siempre llega vacío a esta cola, la causal sobrevive: es lo único que el
   * secretario alcanza a ver de por qué el caso volvió a estar reasignable. Ausente en las excusas
   * anteriores al catálogo, que quedaron sin clasificar a propósito.
   */
  causal?: string;
  eejeId?: number;
  caseId?: number;
  eejeStatus?: string;
  expNumber?: string;
  administrado?: string;
  cedula?: string;
  /**
   * MATERIA del EPAS en Sorteo (quick 261104-jh1): nombres resueltos, varias unidas con « / ».
   * Ausente si ninguna infracción tiene materia.
   */
  materia?: string;
  amasId?: number;
  decisorAnteriorUserId?: number;
  decisorAnteriorName?: string;
  motivo?: string;
  reasignacionAprobadaAt?: string;
}

/**
 * ESTADO DERIVADO de un lote sorteado. Es el CONTRATO que comparte con el backend palabra por
 * palabra (LoteEstado de sorteo.interface.ts). El backend lo deriva EN SQL, en un solo recorrido y
 * desde HECHOS PERSISTIDOS, así que las tres bandejas no pueden contradecirse.
 *
 * PRECEDENCIA (Fase 3.4, firma secuencial): RECHAZADO > APROBADO > PARCIALMENTE_FIRMADO > PENDIENTE.
 *
 *   - PENDIENTE            → sorteado, esperando la PRIMERA firma (funcionario decisor).
 *   - PARCIALMENTE_FIRMADO → la firma ORDEN-1 (decisor) ya está aplicada (`firmaDecisorAt`) pero AÚN
 *                            falta la ORDEN-3 del director (`aprobadoAt` IS NULL). Estado intermedio
 *                            de la secuencia decisor → secretario → director.
 *   - APROBADO             → el director aplicó la firma ORDEN-3 (epsor_aprobado_at). FIRMAR YA NO ES
 *                            APROBAR salvo en esta orden-3 (revierte 3.2). El ACTA es un efecto
 *                            POSTERIOR que puede fallar: un lote APROBADO puede no tenerla → ver
 *                            `actaDisponible`.
 *   - RECHAZADO            → el director lo rechazó: los casos quedaron LIBERADOS y hay `rechazoReason`.
 *
 * OJO: el estado ya NO se infiere de que exista el acta (antes sí, y por eso un lote aprobado cuya
 * acta fallaba desaparecía de las bandejas, y un lote nuevo que reusara un expediente con un acta
 * vieja nacía "aprobado" sin que el director lo aprobara).
 */
export type LoteEstado =
  "PENDIENTE" | "PARCIALMENTE_FIRMADO" | "APROBADO" | "RECHAZADO";

/**
 * UN CASO del lote CON SU ASIGNACIÓN: A QUIÉN LE TOCÓ. Espeja SorteoLoteCaso del backend
 * (sorteo.interface.ts) palabra por palabra.
 *
 * Es el acto que el DIRECTOR está validando cuando aprueba el lote — y era justamente lo único que
 * NO veía: la bandeja le decía "3 casos" y nada más. El acta D2 que se genera al aprobar SÍ lleva los
 * nombres, así que el único que no los veía era QUIEN APRUEBA.
 *
 * DEGRADACIÓN HONESTA (R-03-01-F): el backend resuelve el nombre del decisor con un LEFT JOIN contra
 * t_usuario. En modo REAL el user_id lo emite ASIGNACIONES y su mapeo con nuestro catálogo está SIN
 * VERIFICAR: si no resuelve, `decisorName` llega undefined pero el CASO SIGUE EN LA LISTA (con un
 * INNER JOIN habría desaparecido, y el director aprobaría un lote incompleto sin enterarse). La UI
 * muestra entonces "Decisor #<id> — nombre no disponible": ni se oculta el caso, ni se inventa un
 * nombre. Lo mismo vale para la MATERIA (Fase 03.23): se deduce de las infracciones del EPAS, y un
 * EPAS sin infracciones sale sin materia, nunca fuera de la lista.
 */
export interface SorteoLoteCaso {
  /** eeje_id del EPAS (identidad del caso dentro del lote). */
  eejeId: number;
  /** Número del expediente. */
  expNumber?: string;
  /** Identidad del administrado: razón social si es persona jurídica; si no, nombre + apellido. */
  administrado?: string;
  /** user_id del decisor al que le TOCÓ este caso. */
  decisorUserId?: number;
  /** NOMBRE del decisor. undefined ⇒ el id no resolvió: se muestra el id, no se inventa el nombre. */
  decisorName?: string;
  /**
   * `t_subject` de Asignaciones con el que se repartió el caso (D-18). Id CRUDO, sin nombre local:
   * lo que se pinta es `materia`.
   */
  subId?: number;
  /**
   * MATERIA del EPAS en Sorteo (quick 261104-jh1): nombres resueltos (`LICENCIAMIENTO`), varias
   * unidas con « / ». `undefined` si ninguna infracción tiene materia: la UI pinta «—».
   */
  materia?: string;
  /** Plazo de aceptación implícita del caso, en días. */
  plazoDias?: number;
}

/**
 * Lote de sorteo con su estado real. Identidad del lote (Camino Y, Fase 3.4): el par
 * `(amasId, decisorUserId)` — un master de Asignaciones reparte a VARIOS decisores y cada uno firma
 * SU sublote; todas las firmas/aceptaciones se sellan por ese par.
 */
export interface SorteoLote {
  amasId: number;
  /**
   * user_id del decisor cuyo SUBLOTE es este (Camino Y, Fase 3.4). Todas las firmas/aceptaciones se
   * sellan por el par `(amasId, decisorUserId)`. Opcional para no romper a los consumidores actuales
   * agrupados solo por amasId.
   */
  decisorUserId?: number;
  /** NOMBRE del decisor del sublote (LEFT JOIN a t_usuario). undefined ⇒ el id no resolvió. */
  decisorName?: string;
  /** Estado derivado del lote (contrato: PENDIENTE | PARCIALMENTE_FIRMADO | APROBADO | RECHAZADO). */
  estado?: LoteEstado;
  /** Etiqueta humana del estado (p. ej. "Esperando aprobación"). */
  sdetName?: string;
  /** Cantidad de expedientes de la tanda (incluye excusados). */
  totalCasos?: number;
  /** Casos REALMENTE sorteados (activos): excluye los excusados. "N de totalCasos". */
  casosActivos?: number;
  /** Fecha del sorteo del lote. */
  sorteoAt?: string;
  /** Instante en que los casos quedaron LIBERADOS por el rechazo (solo RECHAZADO). */
  liberadoAt?: string;
  /**
   * Instante de la firma ORDEN-1 (funcionario decisor), ISO string (epsor_firma_decisor_at). Presente
   * desde PARCIALMENTE_FIRMADO en adelante.
   */
  firmaDecisorAt?: string;
  /**
   * Instante de la firma ORDEN-2 (secretario/abogado), ISO string (epsor_firma_secretario_at).
   * Presente una vez aplicada la segunda firma de la secuencia.
   */
  firmaSecretarioAt?: string;
  /**
   * Instante en que el DIRECTOR aprobó el lote (solo APROBADO). Es el HECHO, no el acta, y es la firma
   * ORDEN-3 de la secuencia: reusa epsor_aprobado_at (autoritativa en Asignaciones).
   */
  aprobadoAt?: string;
  /**
   * ¿EXISTE el documento del acta D2 de este lote? Es INDEPENDIENTE del estado: el acta se genera
   * best-effort y puede fallar sin invalidar la aprobación. Sirve para NO MENTIR en la UI:
   *   · APROBADO + actaDisponible=true  → se ofrece "Ver acta".
   *   · APROBADO + actaDisponible=false → "Aprobado — acta no disponible" (el lote NO se esconde y
   *     el botón NO se ofrece: prometería un 404).
   */
  actaDisponible?: boolean;
  /**
   * MOTIVO con el que el director rechazó el lote (solo RECHAZADO). Es la razón de ser de la
   * bandeja de Sorteados: sin esto el secretario veía desaparecer su lote sin saber por qué.
   */
  rechazoReason?: string;
  /**
   * LOS CASOS DEL LOTE CON SU ASIGNACIÓN: a quién le tocó cada expediente. Viaja ANIDADO en el lote
   * (el backend lo hidrata con UNA consulta para todos los lotes, sin N+1), así que las tres bandejas
   * —pendientes del director, sorteados y aprobados— lo reciben sin pedir nada extra.
   *
   * El backend SIEMPRE manda una lista (vacía si no hay reflejo), pero se declara opcional para no
   * romper con una respuesta antigua en caché: los consumidores usan `casos ?? []`.
   */
  casos?: SorteoLoteCaso[];
}

/**
 * Resultado de UNA firma de la secuencia sobre el sublote `(amasId, decisorUserId)`. Espeja
 * `FirmarLoteResult` del backend (sorteo.interface.ts) palabra por palabra.
 *
 * Fase 3.4 REVIERTE la decisión de 3.2 ("firmar = aprobar, un solo acto"): FIRMAR YA NO ES APROBAR
 * salvo en la ORDEN-3 (director). La firma es secuencial — 1) funcionario decisor → 2) secretario/
 * abogado → 3) director — y solo la orden-3 dispara la aprobación en Asignaciones y sella
 * `epsor_aprobado_at`.
 *
 * El actor y el ROL FIRMANTE NO viajan en el body: el backend los deriva del JWT. Aquí se REPORTAN de
 * vuelta (`rolFirmante`, `ordenAplicado`, `rolSiguiente`) para que la UI sepa de quién fue el turno y
 * a quién le toca ahora — el DATO con el que un componente de turno (fuera de alcance de este servicio)
 * decidirá a quién mostrar el botón firmar.
 *
 * `firmado`/`motivoFirma` reportan el seam del firmador, hoy DIFERIDO: `firmado: false` es el camino
 * NORMAL, no un error, y NO invalida la firma/aprobación (el sellado del hecho ya ocurrió).
 */
export interface FirmarLoteResult {
  /** amas_id del lote firmado. */
  amasId: number;
  /** Actor efectivo enviado a Asignaciones (derivado del JWT por el backend). */
  approvedBy: number;
  /**
   * Rol firmante DERIVADO del JWT que ejecutó ESTA firma: decisor | secretario | director. Nunca del
   * body; se reporta de vuelta. Opcional: lo puebla la firma secuencial.
   */
  rolFirmante?: string;
  /**
   * Orden de la firma APLICADA en esta llamada: 1 (decisor), 2 (secretario) o 3 (director). Fija qué
   * columna se selló y si hubo aprobación (solo 3).
   */
  ordenAplicado?: 1 | 2 | 3;
  /**
   * Rol que debe firmar A CONTINUACIÓN: 'secretario' tras la orden-1, 'director' tras la orden-2.
   * `undefined` tras la orden-3 (secuencia completa, lote aprobado).
   */
  rolSiguiente?: string;
  /**
   * Reflejos (expedientes) del lote sellados como APROBADOS. >0 SOLO en la orden-3 (director); 0 en
   * las órdenes 1 y 2 (el lote queda PARCIALMENTE_FIRMADO).
   */
  expedientesSellados: number;
  /**
   * true si la firma digital del acta quedó APLICADA (firmador encendido). Con el firmador encendido
   * una firma que falla NO llega aquí: la petición responde con un error `APP-FIRMA-*` y nada se sella
   * (D-10). `false` solo ocurre con el firmador apagado en el despliegue (D-11).
   */
  firmado: boolean;
  /** Por qué no se firmó (firmador apagado). Nunca contiene credenciales. */
  motivoFirma?: string;
}

/* ────────────────────────── COMBO DE FIRMA (Fase 3.12) ────────────────────────── */

/**
 * Taxonomía CERRADA por la que un par pedido NO se firmó. Espeja `ComboMotivo` del backend
 * (`sorteo.interface.ts`) PALABRA POR PALABRA: no se inventan sinónimos ni se traduce aquí. La
 * traducción a copy de usuario vive en `config/comboFirma.ts` (`etiquetaMotivo`).
 *
 * · `FUERA_DE_TURNO`     — la firma previa de la secuencia todavía no está aplicada.
 * · `YA_FIRMADO`         — ese orden ya se selló antes (idempotencia, no error).
 * · `RECHAZADO`          — el lote fue rechazado; sus expedientes quedaron liberados.
 * · `CASOS_SIN_ACEPTAR`  — al decisor le quedan casos activos sin aceptar ni excusar.
 * · `EXCUSA_PENDIENTE`   — hay una excusa sin resolver: los casos del acta todavia pueden cambiar,
 *                          asi que no se firma en ningun orden hasta que el director la resuelva.
 * · `SIN_CASOS_ACTIVOS`  — el sublote existe pero TODOS sus casos fueron excusados: el acta que se
 *                          firmaría estaría vacía, así que no lo puede firmar ningún rol de la
 *                          secuencia. NO es `YA_FIRMADO` (nadie lo firmó) ni `PAR_INEXISTENTE`
 *                          (el par sí existe) — quick 260806-m7u.
 * · `PAR_INEXISTENTE`    — el par `(amasId, decisorUserId)` no existe.
 * · `ERROR_ASIGNACIONES` — el servicio externo de Asignaciones respondió con error.
 * · `ERROR_INTERNO`      — fallo capturado del propio backend.
 * · `FIRMA_FALLIDA`      — (Fase 03.21) se llamó al firmador por ese par y la firma no se aplicó: el
 *                          acta no se firmó y, en la orden 3, el lote no se aprobó (la firma va antes
 *                          del approve, D-10). Viaja con `causaFirma`. NO es `ERROR_ASIGNACIONES`:
 *                          Asignaciones no se tocó, así que `intentado` es siempre `false`.
 * · `FIRMA_NO_INTENTADA` — (Fase 03.21) corte de D-20: una causa que no depende del acta (la clave, la
 *                          sesión, el certificado, la falta de clave o el firmador caído) falló en un
 *                          par anterior de la misma petición; este par no se intentó y viaja con esa
 *                          misma `causaFirma`. Puede reenviarse tal cual cuando la causa se resuelva.
 */
export type ComboMotivo =
  | "FUERA_DE_TURNO"
  | "YA_FIRMADO"
  | "RECHAZADO"
  | "CASOS_SIN_ACEPTAR"
  | "SIN_CASOS_ACTIVOS"
  | "EXCUSA_PENDIENTE"
  | "PAR_INEXISTENTE"
  | "ERROR_ASIGNACIONES"
  | "ERROR_INTERNO"
  | "FIRMA_FALLIDA"
  | "FIRMA_NO_INTENTADA";

/**
 * UN sublote a firmar en el combo: la identidad del Camino Y. Ambos campos son enteros >= 1 y
 * OBLIGATORIOS — el DTO del backend rechaza con 400 un par incompleto, así que un lote sin
 * `decisorUserId` resuelto NUNCA puede convertirse en un par (ver `paresDesdeSeleccion`).
 */
export interface FirmarLotesPar {
  amasId: number;
  decisorUserId: number;
}

/** Un par que SÍ se firmó en esta petición. */
export interface FirmarLotesFirmado {
  /** El par tal como se pidió. */
  par: FirmarLotesPar;
  /** Orden de la firma aplicada: 1 (decisor), 2 (secretario) o 3 (director). */
  ordenAplicado: 1 | 2 | 3;
  /** Reflejos sellados como APROBADOS. >0 SOLO en la orden 3; 0 en las órdenes 1 y 2. */
  expedientesSellados: number;
  /**
   * ¿Se llegó a TOCAR Asignaciones por este par en ESTA petición? `true` significa que el sistema
   * externo ya recibió la operación y por tanto **hay que ir a revisar allá** antes de reintentar:
   * un reintento a ciegas podría duplicar una aprobación que allá ya se aplicó.
   */
  intentado: boolean;
}

/** Un par que NO se firmó, con la razón. Un 200 con omitidos es un desenlace NORMAL. */
export interface FirmarLotesOmitido {
  /** El par tal como se pidió. */
  par: FirmarLotesPar;
  /** Razón del catálogo cerrado. Es lo único que se traduce a copy (nunca `detalle`). */
  motivo: ComboMotivo;
  /** Copy PROPIO del dominio, en español. Nunca es el mensaje crudo del servicio externo. */
  detalle: string;
  /**
   * ¿Se llegó a TOCAR Asignaciones por este par en ESTA petición? `true` con un omitido es el caso
   * que MÁS importa señalar: la firma no quedó aplicada localmente pero el externo sí se tocó.
   */
  intentado: boolean;
  /** OPCIONAL: solo con motivo `CASOS_SIN_ACEPTAR` — cuántos casos siguen sin aceptar. */
  casosPendientes?: number;
  /** OPCIONAL: solo con motivo `ERROR_ASIGNACIONES` — el status con el que respondió el externo. */
  statusCode?: number;
  /**
   * OPCIONAL: solo con `FIRMA_FALLIDA` y `FIRMA_NO_INTENTADA` — la causa CERRADA del fallo de la firma
   * (Fase 03.21). Es un literal del catálogo, nunca el texto del firmador; su copy de usuario sale de
   * `etiquetaCausaFirma` (`config/comboFirma.ts`), jamás del `detalle`.
   */
  causaFirma?: CausaFirma;
}

/**
 * Reporte del combo. Espeja `FirmarLotesResult` del backend palabra por palabra. **NO viene envuelto**:
 * no hay interceptor ni envelope, Nest lo serializa tal cual con **200**.
 *
 * 🔴 UN 200 NO SIGNIFICA "TODO FIRMADO". La operación es de MEJOR ESFUERZO: hay que ramificar por
 * `firmados.length` frente a `omitidos.length` (todo / parcial / nada). `firmados.length === 0` con
 * status 200 es un resultado normal y frecuente, no un error.
 */
export interface FirmarLotesResult {
  /** Orden aplicado a TODA la petición: 1 | 2 | 3. Lo deriva el backend del ROL del JWT. */
  ordenAplicado: 1 | 2 | 3;
  /** Rol firmante derivado del JWT. Se REPORTA de vuelta; nunca se acepta del cliente. */
  rolFirmante: string;
  /** Pares pedidos. Siempre === `firmados.length + omitidos.length`. */
  solicitados: number;
  firmados: FirmarLotesFirmado[];
  omitidos: FirmarLotesOmitido[];
  /**
   * `amasId` DISTINTOS aprobados en Asignaciones (vacío salvo en la orden 3). Es el número que
   * importa al director: el approve del externo es por MASTER, no por sublote.
   */
  mastersAprobados: number[];
}

/**
 * Timeout **por petición** del combo de firma, en milisegundos.
 *
 * `httpClient` fija `timeout: 5000` para TODAS las peticiones y ese techo NO se toca: subirlo
 * globalmente degradaría cada llamada de la aplicación. Solo esta llamada lo eleva, pasándolo en la
 * config de la petición.
 *
 * De dónde sale el 45: el presupuesto de pared real es el `proxy_read_timeout` por defecto de nginx
 * en `/api/` (60 s, no declarado en `nginx.conf`); 45 s deja un 25 por ciento de margen.
 *
 * ✅ **VERIFICADO 2026-08-13 (Q3, quick `260813-t2r`).** Las dos mitades del supuesto se comprobaron:
 * (1) el `nginx.conf` del frontend proxya `/api/` SIN `proxy_read_timeout` —el bloque `/socket.io/`
 * sí lo declara (3600 s), lo que confirma que la omisión es real y no está sobrescrita en otro
 * sitio— y no hay ningún otro proxy delante; en desarrollo Vite ni siquiera proxya la API.
 * (2) Un combo de 20 pares en la orden 3 cuesta **~1,4 s** de trabajo local medido (66-76 ms por par)
 * más un viaje al externo por master; contra el Asignaciones REAL, 20 lecturas secuenciales suman
 * 121 ms (mediana 5,4 ms). Estimado total: **~3 s con el approve costando 10 veces una lectura**.
 * El margen frente a estos 45 s es de más de 15 veces.
 *
 * 🔴 **REGLA QUE NO SE PUEDE ROMPER:** este número debe quedarse POR DEBAJO de 60000. El orden
 * correcto es que aborte el navegador (y el usuario vea el mensaje de timeout de la app) y no nginx
 * (que devolvería un 504 opaco). Si alguna vez hiciera falta subirlo, hay que declarar antes un
 * `proxy_read_timeout` mayor en el bloque `/api/` del `nginx.conf`.
 */
export const COMBO_FIRMA_TIMEOUT_MS = 45000;

/**
 * Timeout POR PETICIÓN de los actos que firman UN documento con la clave del usuario (Fase 03.21,
 * D-19): `firmarLote` (el acta D2) y `excusar` (el escrito de excusa).
 *
 * La firma real llama a auth-amc, y el backend corta esa llamada a los 25 s
 * (`APP-FIRMA-NO-RESPONDE-001`). 45 s deja margen para el `approveMaster` de la orden 3 y el sello,
 * y coincide con el resto de subidas del módulo. Con los 5 s globales de `httpClient` el navegador
 * abortaría con la firma todavía en curso, y el usuario vería el mensaje genérico de tiempo en vez del
 * del firmador. Mismo techo que {@link COMBO_FIRMA_TIMEOUT_MS}, y por la misma regla: por debajo de
 * los 60 s del `proxy_read_timeout` de nginx.
 */
export const FIRMA_TIMEOUT_MS = 45000;

/**
 * Respuesta de `GET /sorteo/firma/modo`.
 *
 * `sesionCentral` solo llega con el firmador ENCENDIDO: dice si la sesión del usuario se abrió con
 * el Auth central, que es lo único que permite firmar (D-12). Si el servidor no lo informa, la UI
 * degrada: no pinta el estado C y la falta de sesión llega como `APP-FIRMA-SESION-001` al enviar.
 */
export type ModoDeFirma = {
  firmadorHabilitado: boolean;
  sesionCentral?: boolean;
};

/**
 * Tope de pares por combo. Es el MISMO número que valida el DTO del backend (más de 20 ⇒ 400), y se
 * exporta para que la página deshabilite el botón con esta constante y no aparezca un segundo 20
 * escrito a mano en la UI.
 *
 * De dónde salía el 20: 45 s de presupuesto divididos entre el peor caso por par de la orden 3 —2,1 s
 * (2000 ms de timeout hacia Asignaciones más la base)— redondeado a la baja.
 *
 * ✅ **MEDIDO 2026-08-13 (Q3, quick `260813-t2r`): aquel 2,1 s era ~30 veces pesimista.** El coste
 * real por par es de **66-76 ms** (contexto Nest real, base de datos real, acta D2 generada y
 * persistida), lineal hasta 20 pares y casi insensible al tamaño del sublote: de 2 a 19 casos por
 * sublote el par solo sube de 67 a 76 ms, porque lo que domina el PDF es el coste fijo (fuentes y
 * fondo), no las filas de la tabla.
 *
 * Por tanto **el tiempo ya NO es lo que limita este tope**: con 45 s de presupuesto cabrían cientos
 * de pares. El 20 se CONSERVA por otros dos motivos, que son los que hay que discutir si alguien
 * quiere cambiarlo: (a) cada par de la orden 3 dispara un efecto EXTERNO e irreversible en
 * Asignaciones, y un combo enorme convierte un error de selección en un estropicio grande; (b) es el
 * mismo número que valida el DTO del backend, así que subirlo aquí sin subirlo allá da un 400.
 */
export const COMBO_FIRMA_MAX_PARES = 20;

/** Documento del acta de sorteo (D2) para el visor PDF. */
export interface ActaDocumento {
  docId?: number;
  docName: string;
  docUrl: string;
}

/**
 * Texto de conteo de un sublote de sorteo que distingue lo REALMENTE sorteado (casosActivos) del total
 * (totalCasos, que incluye excusados). Fuente ÚNICA para que todas las bandejas digan lo mismo tras una
 * excusa. Si el backend no trae `casosActivos` (dist viejo), cae al total (comportamiento previo).
 *
 * @param lote sublote de sorteo.
 * @param sustantivo unidad a pluralizar ("caso" | "expediente").
 */
export function textoCasosSorteados(
  lote: Pick<SorteoLote, "casosActivos" | "totalCasos" | "casos">,
  sustantivo: "caso" | "expediente" = "caso",
): string {
  const total = lote.totalCasos ?? lote.casos?.length ?? 0;
  const sorteados = lote.casosActivos ?? total;
  if (sorteados === total) return `${total} ${sustantivo}(s)`;
  return `${sorteados} de ${total} sorteado(s) · ${total - sorteados} excusado(s)`;
}

/**
 * Solicitud de reasignación (EXCUSA) pendiente de resolver por el director. Espeja
 * `ReassignmentRequestItem` del backend, que a su vez espeja el DTO real de Asignaciones.
 * `id` es el cass_id: es sobre él que se llama aprobar/rechazar reasignación.
 */
export interface ReasignacionPendiente {
  /** cass_id — el id sobre el que el director aprueba/rechaza. */
  id: number;
  caseId: number;
  assignmentMasterId: number;
  /** Decisor que hoy tiene el caso y pidió excusarse. */
  assignedUserId: number;
  /** Motivo de la excusa declarado por el decisor. */
  reason?: string | null;
  requestedBy?: number | null;
  requestedAt?: string | null;
  subId?: number | null;
  subName?: string | null;
  assignmentStatusName?: string;
  masterStatusName?: string;
}

/**
 * Envelope PAGINADO de las excusas pendientes. El backend devuelve EXACTAMENTE esta forma tanto
 * contra el servicio real como en modo simulado — por eso encender el flag no cambia esta vista.
 */
export interface ReasignacionesPendientesPage {
  moduleId: number;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  items: ReasignacionPendiente[];
}

/** Caso LIBERADO: quedó sin decisor tras el rechazo de un lote y puede volver a sortearse. */
export interface CasoLiberado {
  caseId: number;
  subId: number;
  subName?: string;
  previousUserId?: number;
  parentAssignmentMasterId?: number;
  releaseStatusName?: string;
  releaseReason?: string;
}

/**
 * Entrada de la TRAZA cronológica de un caso (auditabilidad normativa, art. 82 CRE).
 *
 * 🔴 UNA ENTRADA NO TIENE UNA FECHA: TIENE OCHO. Esta interfaz declaraba solo tres, y con tres la
 * línea de tiempo no podría contar la excusa —quién la pidió, quién la resolvió y cuándo—, que es
 * justo lo que D-07 pide. Se completa contra el espejo del backend
 * (`sorteo/interfaces/asignaciones.interface.ts` → `CaseAssignmentHistoryEntry`), del que este tipo
 * es el reflejo en el cliente: el controlador de Ejecución devuelve esa forma tal cual, sin
 * proyectar. Añadir campos aquí no cambia ninguna petición; deja de ESCONDER lo que ya llegaba.
 *
 * Cada fecha no nula es un EVENTO distinto de la línea de tiempo, no un campo de uno solo
 * (`utils/lineaDeTiempo.util.ts`). Los `*By` son identificadores de usuario SIN resolver a nombre:
 * Asignaciones no los resuelve y este módulo no tiene esa tabla.
 */
export interface HistorialCasoEntry {
  historyOrder: number;
  id: number;
  parentId?: number | null;
  caseId: number;
  assignmentMasterId: number;
  userId: number;
  masterStatusName?: string;
  assignmentStatusName?: string | null;
  reason?: string | null;
  assignedAt?: string | null;
  assignedBy?: number | null;
  assignmentApprovedAt?: string | null;
  assignmentApprovedBy?: number | null;
  reassignmentRequestedAt?: string | null;
  reassignmentRequestedBy?: number | null;
  reassignmentResolvedAt?: string | null;
  reassignmentResolvedBy?: number | null;
  reassignmentResolution?: string | null;
  reassignmentApprovedAt?: string | null;
  reassignmentApprovedBy?: number | null;
  reassignmentRejectedAt?: string | null;
  reassignmentRejectedBy?: number | null;
  unassignedAt?: string | null;
  unassignedBy?: number | null;
  caseRejectedAt?: string | null;
  caseRejectedBy?: number | null;
}

/**
 * Los filtros que ADMITE `GET /sorteo/mis-asignados`: espejo de `FilterMisAsignadosDto` del backend
 * (Plan 18), sin el paginado. Es la allowlist: una clave que no esté aquí es un 400 del
 * `ValidationPipe` (`forbidNonWhitelisted`), y por eso los ids de columna de la tabla tienen que
 * llamarse exactamente así.
 *
 * Quick 261104-jh1: la materia y la submateria se filtran por ID de Sorteo (`materiaId`: subId de la
 * materia; `submateriaId`: id de la submateria = ssubId de CORE), enteros en texto, aplicados por
 * PERTENENCIA sobre las infracciones del EPAS; `infraccion` es texto libre (≤ 60) sobre los códigos
 * de infracción. Los filtros por código (`materiaCod`/`submateriaCod`) se retiraron: mandarlos es un
 * 400.
 */
export interface FiltrosMisAsignados {
  admiName?: string;
  admiLastname?: string;
  admiIdentification?: string;
  admiTelephone?: string;
  admiBusinessName?: string;
  admiAddress?: string;
  expZone?: string;
  expNumber?: string;
  eejeStatus?: string[];
  /** ids de materia de Sorteo (subId), en texto. */
  materiaId?: string[];
  /** ids de submateria de Sorteo (ssubId de CORE), en texto. */
  submateriaId?: string[];
  infraccion?: string;
  /** Inicio del rango de creación del expediente (`YYYY-MM-DD`), inclusive. */
  expCreatedAtFrom?: string;
  /** Fin del rango, inclusive. */
  expCreatedAtTo?: string;
}

/**
 * Lo que la tabla le pide a la bandeja del decisor: la página que está mostrando y los filtros que
 * tiene puestos, tal y como se los entrega `Table.tsx` en `PaginationAndFilters`.
 *
 * `filterParams` llega YA SERIALIZADO por `serializeColumnFilters`: las claves son los nombres que
 * `FilterMisAsignadosDto` declara —incluidos `expCreatedAtFrom`/`expCreatedAtTo`, que el filtro de
 * rango genera a partir del `id` de la columna— y los valores son cadenas o arrays de cadenas.
 */
export interface MisAsignadosParams {
  /** Índice de página BASE 0, el de `Table.tsx`. Se traduce a desplazamiento aquí. */
  pageIndex?: number;
  /** Tamaño de página PEDIDO. El backend lo acota a 100 y declara el aplicado en el sobre. */
  pageSize?: number;
  /**
   * Filtros ya serializados. Lo vacío se omite. Las claves válidas son las de `FiltrosMisAsignados`;
   * el tipo sigue siendo abierto porque llega tal cual de `serializeColumnFilters`.
   */
  filterParams?: Record<string, unknown>;
}

/**
 * Traduce los parámetros de tabla a la query que el backend admite. Vive FUERA del método, como el
 * `toQueryParams` de `EntradaLotesService`, para poder leerse sin abrir el servicio entero.
 *
 * 🔴 DOS REGLAS, Y LAS DOS SON EL CONTRATO CON UNA ALLOWLIST:
 *
 * 1. **Lo vacío se OMITE.** De eso se encarga `appendTableFilterParams`, que salta los nulos, los
 *    indefinidos y las cadenas en blanco, y que repite la clave para cada elemento de un array
 *    —que es como el catálogo de ESTATUS manda varias selecciones—. No se monta el query a mano:
 *    esa utilidad es la que tiene prueba de unidad contra los nombres del DTO.
 * 2. **No se inventa ninguna clave.** Las que salen de aquí son las del filtro más `limit` y
 *    `offset`. El `ValidationPipe` del backend corre con `forbidNonWhitelisted: true`: una clave
 *    que el DTO no declare no se ignora, devuelve 400 — y el 400 no dice cuál fue.
 *
 * El paginado se emite SOLO si hay tamaño de página. Sin él, el backend aplica su propio defecto, y
 * mandar `limit=undefined` sería exactamente el blanco que la regla 1 prohíbe.
 */
const paramsDeMisAsignados = (params: MisAsignadosParams): URLSearchParams => {
  const query = new URLSearchParams();

  appendTableFilterParams(query, params.filterParams ?? {});

  const { pageSize } = params;
  if (pageSize != null) {
    query.append("limit", String(pageSize));
    query.append("offset", String((params.pageIndex ?? 0) * pageSize));
  }

  return query;
};

export const SorteoService = {
  /** Dispara el sorteo de la tanda revisada (secretario) → POST /sorteo. */
  async sortear(payload: SortearPayload): Promise<SorteoResult> {
    const { data } = await httpClient.post<SorteoResult>(`/sorteo`, payload);
    return data;
  },

  /**
   * Aplica UNA firma de la secuencia sobre el sublote `(amasId, decisorUserId)` (Camino Y) →
   * PATCH /sorteo/:amasId/:decisorUserId/firmar. REEMPLAZA el acto único del director de 3.2.
   *
   * SECUENCIA (Fase 3.4, revierte 3.2 "firmar = aprobar"): 1) funcionario decisor → 2) secretario/
   * abogado → 3) director. El ROL FIRMANTE y el actor NUNCA viajan en el body: el backend los deriva
   * del JWT (@CurrentUser('roles'/'userId')) y de ahí infiere el ORDEN — el cliente no lo envía. Solo
   * la ORDEN-3 (director) dispara `approveMaster` en Asignaciones y sella `epsor_aprobado_at`; las
   * órdenes 1 y 2 registran la firma y dejan el lote PARCIALMENTE_FIRMADO. El resultado REPORTA
   * `rolFirmante`/`ordenAplicado`/`rolSiguiente`.
   *
   * FUERA DE ALCANCE DE ESTE SERVICIO (plan de componente futuro): decidir DE QUIÉN ES EL TURNO / a
   * quién se le muestra el botón "firmar" según `estado` (PARCIALMENTE_FIRMADO), `rolSiguiente` y el
   * rol del usuario. El servicio solo EXPONE el dato (`estado`, `firmaDecisorAt`, `firmaSecretarioAt`,
   * `rolSiguiente`); la lógica visual del turno secuencial la implementará un componente de UI aparte.
   *
   * FIRMA CRIPTOGRÁFICA DIFERIDA: el seam del firmador es hoy un no-op → `firmado: false` +
   * `motivoFirma` es CAMINO NORMAL (el sellado del hecho ya ocurrió), no un error.
   *
   * @param amasId        master/lote del sorteo (Asignaciones).
   * @param decisorUserId decisor cuyo SUBLOTE se firma — parte de la RUTA (Camino Y), no del body. Lo
   *                      provee el componente de turno; opcional en la firma para no romper a los
   *                      llamadores transitorios del flujo previo a 3.4 mientras ese componente llega.
   * @param type          variante de plantilla opcional (NO lleva actor ni rol).
   * @param signPassword  clave de firma del usuario, solo con el firmador encendido.
   *
   * ⟳ Fase 03.21 (D-19): espera {@link FIRMA_TIMEOUT_MS}, no los 5 s globales.
   */
  async firmarLote(
    amasId: number,
    decisorUserId?: number,
    type?: string,
    signPassword?: string,
  ): Promise<FirmarLoteResult> {
    const { data } = await httpClient.patch<FirmarLoteResult>(
      `/sorteo/${amasId}/${decisorUserId}/firmar`,
      {
        ...(type ? { type } : {}),
        // 🔴 La clave del certificado viaja SOLO en el cuerpo de esta petición y solo cuando el
        // firmador está encendido. Nunca en la URL (quedaría en logs de proxy e historial), nunca en
        // almacenamiento del navegador, y el llamador la descarta en cuanto la envía.
        ...(signPassword ? { signPassword } : {}),
      },
      { timeout: FIRMA_TIMEOUT_MS },
    );
    return data;
  },

  /**
   * ¿Hay que pedirle al firmante la clave de su certificado? → GET /sorteo/firma/modo.
   *
   * La bandera vive en el BACKEND y se pregunta, igual que `GET /auth/mode` para el modo de sesión:
   * duplicarla en un `VITE_*` garantizaría que algún día difieran. Mientras el firmador esté apagado
   * —hoy— la respuesta es `false` y la pantalla NO pide ninguna clave: teclear la clave de un
   * certificado en un formulario que la descarta es una costumbre que no conviene enseñar.
   *
   * ⟳ Fase 03.21 (D-12): con el firmador encendido llega además `sesionCentral`, y se devuelve tal
   * cual (ausente si el servidor no lo informa). Ver {@link ModoDeFirma}.
   */
  async readModoDeFirma(): Promise<ModoDeFirma> {
    const { data } = await httpClient.get<ModoDeFirma>("/sorteo/firma/modo");
    return data;
  },

  /**
   * FIRMA EN COMBO de VARIOS sublotes en UNA petición → PATCH /sorteo/firmar-lotes. Es ADITIVA:
   * `firmarLote` (la firma individual, arriba) SIGUE EXISTIENDO y NO se toca — el combo no la
   * reemplaza ni la envuelve.
   *
   * El rol firmante y el actor los deriva el backend del JWT (como en la firma individual): el cuerpo
   * transporta SOLO los pares y, opcionalmente, la variante de plantilla. Un campo extra lo rechaza el
   * `ValidationPipe` con 400 (`forbidNonWhitelisted`).
   *
   * 🔴 **UN 200 NO SIGNIFICA "TODO FIRMADO".** Es una operación de MEJOR ESFUERZO y **el REPORTE es el
   * producto, no el código de estado**: el llamador debe ramificar por `firmados.length` frente a
   * `omitidos.length` y pintar el `detalle` de cada omitido. `firmados.length === 0` con 200 es un
   * desenlace normal.
   *
   * 🔴 **TIMEOUT POR PETICIÓN, NO GLOBAL.** `httpClient` aborta a los 5 s por defecto. Un combo
   * abortado en el navegador deja al backend firmando y al usuario SIN EL REPORTE — que es exactamente
   * lo que esta fase existe para entregar; con 5 s, 2 o 3 pares de la orden 3 ya dan timeout aunque el
   * servidor complete la operación. Por eso el timeout se eleva a {@link COMBO_FIRMA_TIMEOUT_MS} en la
   * config de ESTA petición (tercer argumento de `patch`) y `src/api/httpClient.ts` NO se modifica:
   * subir el techo global degradaría todas las demás llamadas.
   *
   * El 45 sale del presupuesto de pared de 60 s (`proxy_read_timeout` por defecto de nginx en `/api/`,
   * no declarado en `nginx.conf`) menos un 25 por ciento de margen; los dos extremos quedaron
   * VERIFICADOS el 2026-08-13 (Q3). El tope de {@link COMBO_FIRMA_MAX_PARES} nació de dividir esos
   * 45 s entre un peor caso teórico de 2,1 s por par que resultó ser ~30 veces pesimista —el coste
   * real medido es de 66-76 ms por par—, así que hoy ese tope lo sostiene la prudencia frente al
   * efecto externo, no el reloj. El backend lo valida igual en su DTO.
   *
   * @param pares sublotes `(amasId, decisorUserId)` a firmar: entre 1 y {@link COMBO_FIRMA_MAX_PARES}.
   *              Ambos campos son obligatorios y enteros >= 1 (un lote sin decisor resuelto NO es un
   *              par válido; `config/comboFirma.paresDesdeSeleccion` los filtra antes de llegar aquí).
   * @param type  variante de plantilla opcional (NO lleva actor ni rol).
   */
  async firmarLotes(
    pares: FirmarLotesPar[],
    type?: string,
    signPassword?: string,
  ): Promise<FirmarLotesResult> {
    const { data } = await httpClient.patch<FirmarLotesResult>(
      "/sorteo/firmar-lotes",
      {
        pares,
        ...(type ? { type } : {}),
        // Una sola clave para los N sublotes del combo: mismo firmante, mismo certificado. Viaja en
        // el cuerpo, nunca en la URL, y el llamador la descarta al enviar.
        ...(signPassword ? { signPassword } : {}),
      },
      { timeout: COMBO_FIRMA_TIMEOUT_MS },
    );
    return data;
  },

  /**
   * ACEPTACIÓN EXPLÍCITA del caso por el funcionario decisor → POST /sorteo/:cassId/aceptar.
   *
   * Sella `epsor_aceptado_at/_by` con el actor DERIVADO DEL JWT (nunca del body: el cuerpo va VACÍO,
   * defensa anti-Spoofing bajo whitelist en el backend). CONVIVE con la aceptación IMPLÍCITA
   * computed-on-read (plazo vencido + caso activo = auto-aceptado). Aceptar/excusar TODOS los casos
   * del sublote es la COMPUERTA para la firma ORDEN-1 del decisor.
   *
   * @param cassId cass_id del case-assignment a aceptar.
   */
  async aceptarCaso(cassId: number): Promise<unknown> {
    const { data } = await httpClient.post(`/sorteo/${cassId}/aceptar`, {});
    return data;
  },

  /**
   * RECHAZA el lote de sorteo (director) → PATCH /sorteo/:amasId/reject.
   * El MOTIVO es OBLIGATORIO: el backend lo reenvía a Asignaciones, cuyo verbo real de rechazo
   * (`PATCH /assignments-masters/:id/reject`) exige `{ rejectedBy, reason }`. Sin motivo, el rechazo
   * real falla. Tras el rechazo los casos quedan LIBERADOS y los EPAS vuelven a VERIFICADO.
   */
  async rechazarLote(amasId: number, reason: string): Promise<unknown> {
    const { data } = await httpClient.patch(`/sorteo/${amasId}/reject`, {
      reason,
    });
    return data;
  },

  /**
   * Bandeja de EXCUSAS del director (RECE-07) → GET /sorteo/reasignaciones-pendientes.
   * Devuelve el envelope PAGINADO de Asignaciones. Hasta ahora el director podía aprobar/rechazar
   * una excusa pero NO tenía por dónde verlas — esta es la vista que faltaba.
   *
   * @param page página 1-based (el backend/Asignaciones paginan de a 10).
   */
  async reasignacionesPendientes(
    page = 1,
  ): Promise<ReasignacionesPendientesPage> {
    const { data } = await httpClient.get<ReasignacionesPendientesPage>(
      `/sorteo/reasignaciones-pendientes`,
      { params: { page } },
    );
    return data;
  },

  /** Casos LIBERADOS tras el rechazo de un lote → GET /sorteo/casos-liberados. */
  async casosLiberados(): Promise<CasoLiberado[]> {
    const { data } = await httpClient.get<CasoLiberado[]>(
      `/sorteo/casos-liberados`,
    );
    return data;
  },

  /**
   * TRAZA cronológica del caso → GET /sorteo/caso/:caseId/historial.
   * Auditabilidad NORMATIVA (art. 82 CRE): quién tuvo el caso, quién se excusó y quién resolvió.
   */
  async historialCaso(caseId: number): Promise<HistorialCasoEntry[]> {
    const { data } = await httpClient.get<HistorialCasoEntry[]>(
      `/sorteo/caso/${caseId}/historial`,
    );
    return data;
  },

  /**
   * Bandeja del decisor, FILTRADA Y PAGINADA POR EL SERVIDOR → GET /sorteo/mis-asignados.
   *
   * 🔴 CAMBIO ROMPEDOR DE CONTRATO, Y LLEVA ROTO DESDE EL PLAN 03. Este método devolvía
   * `MiEpasAsignado[]`; el endpoint devuelve el SOBRE desde entonces, así que la bandeja del decisor
   * estaba leyendo un array donde llega un objeto. Aquí se salda: el tipo pasa a ser el sobre y el
   * único consumidor —`MisAsignadosPage`— se adapta en el mismo commit que lo consume.
   *
   * 🔴 EL `limit` DEL SOBRE ES EL APLICADO, NO EL PEDIDO. El backend lo acota a 100 (`acotarLimit`)
   * y lo declara de vuelta. Quien pagine tiene que LEER el del sobre: dar por bueno el que mandó
   * produciría un paginador que cuenta páginas que no existen y filas que se quedan fuera sin que
   * nadie se entere.
   *
   * @param params página que se muestra y filtros puestos; todos opcionales.
   */
  async misAsignados(
    params: MisAsignadosParams = {},
  ): Promise<BandejaPaginada<MiEpasAsignado>> {
    const { data } = await httpClient.get<BandejaPaginada<MiEpasAsignado>>(
      `/sorteo/mis-asignados`,
      { params: paramsDeMisAsignados(params) },
    );
    return data;
  },

  /**
   * Catálogo de causales de excusa VIGENTES → GET /sorteo/causales-excusa.
   *
   * Lectura pura: no filtra por rol ni por caso, así que la misma lista se ve desde cualquier
   * bandeja — que es justamente lo que vuelve comparables las excusas entre expedientes. El backend
   * devuelve solo las activas y ya ordenadas: aquí no se reordena ni se filtra nada.
   */
  async causalesExcusa(): Promise<CausalExcusa[]> {
    const { data } = await httpClient.get<CausalExcusa[]>(
      `/sorteo/causales-excusa`,
    );
    return data;
  },

  /**
   * Declara la excusa del decisor → POST /sorteo/:cassId/excusa.
   *
   * ⟳ 2026-09-16 (D-03): **JSON, con un objeto plano**. El ESCRITO sigue acompañando siempre a la
   * declaración (acta del 2026-08-28) — lo que cambia es que ya no es un PDF que sube el decisor,
   * sino el HTML que redactó sobre la plantilla, y el PDF lo genera el servidor.
   *
   * 🔴 EL TERCER ARGUMENTO DE `post` ES SOLO `{ timeout }`, SIN CABECERAS. Es deliberado: `httpClient`
   * ya trae `Content-Type: application/json`, que es lo que este cuerpo necesita. Añadir aquí las
   * opciones de subida por simetría con los otros siete multipart del módulo volvería a romper el
   * POST, esta vez al revés. Hay una prueba que lo vigila. El timeout es {@link FIRMA_TIMEOUT_MS}
   * (Fase 03.21, D-19): el escrito se firma con la clave del decisor y eso espera a auth-amc.
   *
   * 🔴 LA CLAVE DE FIRMA VIAJA SOLO AQUÍ (D-16), como `signPassword` del JSON y solo si no está en
   * blanco. NUNCA en `vistaPreviaEscritoExcusa`, cuya firma ni siquiera la admite: el borrador no se
   * firma, y una clave que viaja de más es una clave que puede quedarse en algún sitio.
   *
   * CAUSAL + DETALLE desde el punto 4 del acta del 2026-09-11. El motivo tecleado se partió en dos
   * campos con papeles distintos: la CAUSAL la fija la norma y es lo único agrupable —sin ella no
   * hay forma de contar excusas—, y el DETALLE es el hecho concreto, que lo cuenta quien se excusa.
   * Por eso el detalle es opcional y la causal no. El texto que llega a Asignaciones lo compone el
   * BACKEND (título de la causal + detalle): este cliente no arma frases.
   *
   * 🔴 El detalle no se adjunta cuando está vacío, en vez de adjuntarse en blanco. El DTO lo marca
   * `@IsOptional()`, y esa regla de class-validator solo se salta con `undefined` o `null`: un
   * `reason: ""` pasaría la validación y quedaría persistido como detalle vacío.
   *
   * @param cassId cass_id del case-assignment a excusar.
   * @param causalId código de la causal elegida del catálogo (`CausalExcusa.codigo`), requerido.
   * @param escritoHtml HTML del escrito ya compuesto en el modal. El orden del parámetro se
   *   conserva —tercero, donde antes iba el `File`—: cambia el tipo, no la posición.
   * @param detalle hecho concreto que sustenta la causal (≤500), opcional.
   * @param signPassword clave de firma del decisor, solo con el firmador encendido. Opcional.
   */
  async excusar(
    cassId: number,
    causalId: string,
    escritoHtml: string,
    detalle?: string,
    signPassword?: string,
  ): Promise<unknown> {
    const detalleLimpio = detalle?.trim();
    const { data } = await httpClient.post(
      `/sorteo/${cassId}/excusa`,
      {
        causalId,
        // La clave NO se incluye cuando no hay detalle, en vez de incluirse en blanco (ver arriba).
        ...(detalleLimpio ? { reason: detalleLimpio } : {}),
        escritoHtml,
        // Mismo patrón: una clave en blanco no viaja. Se manda tal cual se tecleó, sin recortar:
        // la clave es la que es, espacios incluidos.
        ...(signPassword?.trim() ? { signPassword } : {}),
      },
      { timeout: FIRMA_TIMEOUT_MS },
    );
    return data;
  },

  /**
   * El MISMO escrito que se presentaría, sin presentarlo → POST /sorteo/:cassId/excusa/vista-previa.
   *
   * Devuelve una URL de blob para el visor, marcada como BORRADOR sobre todas las páginas.
   *
   * 🔴 QUIEN LA PIDE ES DUEÑO DE LA URL: hay que soltarla con `URL.revokeObjectURL` al cerrar, o
   * cada vistazo deja un PDF retenido en memoria.
   *
   * `signal` cancela la petición en vuelo, y hace falta con el refresco automático: sin él,
   * escribir rápido deja varias peticiones compitiendo y **puede llegar antes la vieja**, dejando en
   * pantalla un borrador anterior al texto que ya se ve en el editor.
   *
   * ⚠️ Que el borrador salga NO significa que la excusa se pueda enviar: el backend no comprueba
   * aquí ninguna regla del acto. Eso lo dice `excusar`.
   *
   * @param cassId cass_id del case-assignment (solo da nombre al fichero; no se persiste nada).
   * @param escritoHtml HTML del borrador tal y como se está redactando.
   * @param signal para cancelar la petición anterior cuando llega otra.
   */
  async vistaPreviaEscritoExcusa(
    cassId: number,
    escritoHtml: string,
    signal?: AbortSignal,
  ): Promise<string> {
    try {
      const { data } = await httpClient.post<Blob>(
        `/sorteo/${cassId}/excusa/vista-previa`,
        { escritoHtml },
        { responseType: "blob", signal },
      );
      return URL.createObjectURL(data);
    } catch (err) {
      // 🔴 Con `responseType: "blob"` el cuerpo del ERROR también llega como Blob, así que el
      // normalizador del httpClient no encuentra el mensaje del servidor y cae en un «Request failed
      // with status code 400» que no dice nada. Se rescata aquí: si el borrador falla, quien lo pidió
      // tiene que poder leer por qué.
      throw await errorDeBlob(err, "No se pudo generar el borrador.");
    }
  },

  /** Aprueba la solicitud de reasignación (director) → PATCH /sorteo/:cassId/approve-reassignment. */
  async aprobarReasignacion(cassId: number): Promise<unknown> {
    const { data } = await httpClient.patch(
      `/sorteo/${cassId}/approve-reassignment`,
      {},
    );
    return data;
  },

  /** Rechaza la solicitud de reasignación (director) → PATCH /sorteo/:cassId/reject-reassignment. */
  async rechazarReasignacion(cassId: number): Promise<unknown> {
    const { data } = await httpClient.patch(
      `/sorteo/${cassId}/reject-reassignment`,
      {},
    );
    return data;
  },

  /**
   * BANDEJA DE SORTEADOS → GET /sorteo/lotes.
   * TODOS los lotes con su ESTADO REAL derivado (PENDIENTE / APROBADO / RECHAZADO) y, en los
   * rechazados, el MOTIVO. La consumen el SECRETARIO —que dispara el sorteo y, entre que sorteaba y
   * el director resolvía, veía DESAPARECER el lote sin enterarse de un rechazo— y el DIRECTOR.
   * Es una LECTURA: no habilita sortear, aprobar ni rechazar.
   */
  async lotes(): Promise<SorteoLote[]> {
    const { data } = await httpClient.get<SorteoLote[]>(`/sorteo/lotes`);
    return data;
  },

  /**
   * BANDEJA DE ACTAS del DECISOR → GET /sorteo/mis-lotes.
   * SUS sublotes `(amasId, decisorUserId=self)` para firmar el acta (orden-1) viéndola en «Actas de
   * Sorteo». Acotado al decisor autenticado por el backend (userId del JWT): a diferencia de `lotes()`
   * (todos, secretario/director), aquí el decisor solo ve LO SUYO.
   */
  async misLotes(): Promise<SorteoLote[]> {
    const { data } = await httpClient.get<SorteoLote[]>(`/sorteo/mis-lotes`);
    return data;
  },

  /**
   * Lotes de sorteo esperando aprobación (director) → GET /sorteo/lotes-pendientes.
   * Es el filtro PENDIENTE de la misma consulta que sirve `lotes()` (el backend deriva el estado una
   * sola vez): las bandejas no pueden divergir.
   */
  async lotesPendientes(): Promise<SorteoLote[]> {
    const { data } = await httpClient.get<SorteoLote[]>(
      `/sorteo/lotes-pendientes`,
    );
    return data;
  },

  /**
   * Lotes YA APROBADOS por el director → GET /sorteo/lotes-aprobados.
   * Es el INVERSO EXACTO de lotesPendientes (el backend comparte el PREDICADO ÚNICO de la aprobación
   * —el hecho persistido— entre las dos consultas, así que no pueden divergir): aquí están los lotes
   * CERRADOS. Un lote aprobado cuya ACTA falló también sale aquí, con actaDisponible=false (antes
   * desaparecía). Lo consumen el SECRETARIO —que dispara el sorteo y hasta ahora no veía el resultado
   * aprobado ni podía abrir el acta— y el director. Es una LECTURA: no habilita ninguna acción.
   */
  async lotesAprobados(): Promise<SorteoLote[]> {
    const { data } = await httpClient.get<SorteoLote[]>(
      `/sorteo/lotes-aprobados`,
    );
    return data;
  },

  /**
   * Casos REASIGNABLES por el secretario → GET /sorteo/casos-reasignables. Los que el director aprobó su
   * excusa y esperan re-sorteo manual (cola de Reasignaciones). Solo el secretario.
   */
  async casosReasignables(): Promise<CasoReasignable[]> {
    const { data } = await httpClient.get<CasoReasignable[]>(
      `/sorteo/casos-reasignables`,
    );
    return data;
  },

  /**
   * Acta de sorteo (D2) del sublote `(amasId, decisorUserId)` para el visor →
   * GET /sorteo/:amasId/:decisorUserId/acta. La leen el DIRECTOR (que la asienta en la orden-3) y el
   * SECRETARIO. El acta se genera best-effort: un sublote recién firmado puede no tenerla todavía →
   * 404, y el consumidor degrada con gracia ("el acta no está disponible").
   *
   * @param amasId        master/lote del sorteo (Asignaciones).
   * @param decisorUserId sublote (Camino Y) — parte de la RUTA. Lo provee el componente de turno;
   *                      opcional para no romper a los llamadores transitorios previos a 3.4.
   */
  async actaDeLote(
    amasId: number,
    decisorUserId?: number,
  ): Promise<ActaDocumento> {
    const { data } = await httpClient.get<ActaDocumento>(
      `/sorteo/${amasId}/${decisorUserId}/acta`,
    );
    return data;
  },

  /**
   * El ESCRITO que sustenta una excusa → GET /sorteo/:cassId/excusa/escrito. Solo DIRECTOR.
   *
   * Lo consume el icono de ojo de la bandeja de solicitudes de reasignación (pedido del usuario del
   * 2026-09-17). Se pide al PULSAR, no al pintar la lista: una consulta por fila para un documento
   * que se abre de uno en uno no compensa.
   *
   * 🔴 Responde 404 cuando la excusa no trae escrito, y eso NO es un defecto: las excusas anteriores
   * al 2026-09-01 se presentaron sin documento. Quien llama debe degradar con un aviso, no tratarlo
   * como un error del sistema.
   */
  async escritoDeExcusa(cassId: number): Promise<ActaDocumento> {
    const { data } = await httpClient.get<ActaDocumento>(
      `/sorteo/${cassId}/excusa/escrito`,
    );
    return data;
  },

  /**
   * CAPTURA de los DATOS del acta D2 por el SECRETARIO sobre el sublote `(amasId, decisorUserId)`
   * (Camino Y, Fase 3.4/3.5) → PATCH /sorteo/:amasId/:decisorUserId/acta-datos. UPSERT por-par: el
   * backend persiste el blob `datos` en `t_epas_acta_datos` (jsonb AGNÓSTICO de campos, Plan 01/02) y la
   * DEFINITIVA lo imprime en el PDF antes de las 3 anclas de firma.
   *
   * CONTRATO POR-PAR: ambos segmentos de la ruta son numéricos (regresión del bug `/sorteo/:amasId//…`);
   * el par identifica el sublote. Solo el SECRETARIO en su turno abre esta captura (gating de UI en el
   * componente/página; el backend además gatea `@Roles('secretario abogado')`).
   *
   * ANTI-SPOOFING (T-3.5-01): el body lleva ÚNICAMENTE `{ datos }` — el ROL y el ACTOR
   * (`epad_capturado_by`) NUNCA viajan en el cuerpo; el backend los deriva del JWT (`@CurrentUser`) bajo
   * whitelist (los campos extra se rechazan). `datos` es agnóstico (`Record<string, unknown>`): la lista
   * EXACTA de campos de PRO-GEJ-001 vive en el slot declarativo `actaFieldsRegistry`, no aquí.
   *
   * @param amasId        master/lote del sorteo (Asignaciones).
   * @param decisorUserId decisor cuyo SUBLOTE se documenta — parte de la RUTA (Camino Y), no del body.
   * @param datos         blob de datos capturados del acta (agnóstico; lo arma `toActaDatosPayload`).
   */
  async actaDatos(
    amasId: number,
    decisorUserId: number,
    datos: Record<string, unknown>,
  ): Promise<unknown> {
    const { data } = await httpClient.patch(
      `/sorteo/${amasId}/${decisorUserId}/acta-datos`,
      { datos },
    );
    return data;
  },
};

export default SorteoService;
