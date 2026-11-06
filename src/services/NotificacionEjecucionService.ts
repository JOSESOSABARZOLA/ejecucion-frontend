/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: La notificación al administrado (Fase 03.14.3)
 * Archivo: NotificacionEjecucionService.ts
 * Responsabilidad: Consumir `/notificacion`.
 *
 *   ⚠️ **EL AVISO ORIGINAL, QUE SIGUE SIENDO CIERTO EN LO QUE IMPORTA.** Cuando este archivo se
 *   escribió (Fase 03.14.3) el módulo **no enviaba nada** —el servidor de correo era otro módulo— y
 *   la notificación la creaba la EMISIÓN de la providencia. Aquí se declaraba por dónde se puede
 *   notificar y se registraba qué pasó con cada despacho, y nada más.
 *
 *   🔴 **LO QUE CAMBIÓ CON LA FASE 03.20 (D-09/D-17): el módulo SÍ ENVÍA, y existe el reenvío
 *   manual.** Con tres precisiones que hay que leer juntas, porque por separado cada una miente:
 *
 *     1. **El envío es AUTOMÁTICO al emitir** (D-04) y al registrar una multa compulsoria (D-15).
 *        Lo dispara el backend dentro de esos dos actos; **esta pantalla no lo dispara** y este
 *        archivo no tiene método para pedirlo.
 *     2. **El reenvío manual SÍ sale de aquí**: `reenviarCorreo`, que es la única llamada de este
 *        archivo con consecuencia jurídica. Lo pulsa el secretario abogado sobre un despacho de
 *        correo que quedó pendiente.
 *     3. 🔴 **El envío nace APAGADO** (`NOTIFICACIONES_ENVIO_ENABLED`, por defecto `false`, D-20).
 *        Con el interruptor en falso **no se intenta nada** y el despacho se queda pendiente con su
 *        motivo a la vista: mientras esté así, lo que el aviso viejo decía sigue siendo literalmente
 *        cierto. El interruptor lo resuelve el SERVIDOR y viaja en la raíz de la respuesta del
 *        Gestor (`correoEnvioHabilitado`); **este archivo no lo deduce, no lo sustituye y no lo
 *        cablea**.
 *
 *   El nombre lleva «Ejecucion» porque el clon traía un `NotificationService` heredado que apuntaba
 *   a un backend que respondía 500. ⚠️ Ese servicio **ya no existe**: lo retiró la Fase 03.14.3. La
 *   frase que decía «se retira en esta misma fase» quedó falsa el día que se cumplió, y un
 *   comentario que nombra un archivo inexistente manda a buscar algo que no está.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-20
 * Modificado por: Andrés Miño — 2026-09-28 (Fase 03.20, Plan 06 — D-09/D-17: el módulo SÍ envía, y
 *   existe el reenvío manual)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-05: `FormasAceptadas.direccion`
 *   pasa a opcional, como en el servidor: el administrado de Resolución llega sin dirección).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-09/D-21):
 *   `GestorNotificacion.despachoBloqueadoPorFirma`, que decide el servidor por fila.
 */
import httpClient from "../api/httpClient";
import { appendTableFilterParams } from "../utils/tableFilterParams.util";
// El sobre paginado se REUTILIZA por composición, no se copia: dos copias del mismo contrato acaban
// divergiendo, y es el criterio que `SorteoService` y `ProvidenciaService` ya aplican con él.
import type { BandejaPaginada } from "./EntradaLotesService";

export type FormaNotificacion = "CORREO" | "CASILLERO" | "FISICO";
export type EstadoDespacho = "pendiente" | "notificado" | "rechazado";

/**
 * Una dirección de notificación. `procedencia` dice DE DÓNDE salió —lo que hay que poder responder
 * cuando alguien alega que nunca le llegó— y `vigente` en false NO se borra: las notificaciones que
 * ya salieron ahí siguen apuntando a algo.
 */
export interface CorreoAdministrado {
  corrId: number;
  email: string;
  procedencia: string;
  vigente: boolean;
}

export interface FormasAceptadas {
  admiId: number;
  nombre: string;
  /** Todas sus direcciones. Se despacha a las VIGENTES, una por cada una. */
  correos: CorreoAdministrado[];
  casillero?: string;
  /**
   * Domicilio, si lo tiene. Ausente cuando el administrado no tiene dirección (NULL desde la Fase
   * 03.24, D-04): el servidor no manda nunca el texto «null» (G-05).
   */
  direccion?: string;
  aceptaCorreo: boolean;
  aceptaCasillero: boolean;
  aceptaFisico: boolean;
}

export interface Despacho {
  despId: number;
  forma: FormaNotificacion;
  /** Dirección a la que salió, congelada. */
  correo?: string;
  estado: EstadoDespacho;
  resueltoAt?: string;
  observacion?: string;
  razonDocId?: number;
}

export interface Notificacion {
  notiId: number;
  eejeId: number;
  docId: number;
  /** El nombre del documento notificado: la pantalla dice QUÉ se notificó, no un número. */
  docName: string;
  emitidaAt: string;
  /** Cuándo surtió efecto. Sin ella **no hay plazo corriendo**. */
  perfeccionadaAt?: string;
  despachos: Despacho[];
}

/* ────────────────────────────────────────────────────────────────────────────────────────────────
 * EL GESTOR DE NOTIFICACIONES (Fase 03.20, Planes 04 y 05)
 *
 * Los tipos de abajo son el ESPEJO del contrato que los SUMMARY de los Planes 04 y 05 escriben
 * campo por campo. Dos cosas que hay que leer dos veces, porque las dos han producido defectos:
 *
 *   1. 🔴 **Las fechas cruzan HTTP como CADENA**, no como `Date`. En el servidor son `Date`; la
 *      serialización de la respuesta las convierte a ISO. Aquí se declaran `string`, igual que ya
 *      hacen `Notificacion.emitidaAt` y las órdenes de pago en su propio servicio.
 *   2. 🔴 **Los opcionales de la FILA y los del DESPACHO no se comportan igual.** Los de la fila
 *      llegan como `null` —la clave viene, con el valor vacío, porque los conserva la conversión de
 *      la base a la respuesta— y los del despacho llegan **AUSENTES** (`undefined`), porque el
 *      repositorio los construye a mano con `?? undefined`. Por eso los primeros se declaran
 *      `T | null` (la clave siempre está y el consumidor necesita su `?? "—"`) y los segundos con
 *      `?`. Unificarlos en una sola forma haría que el consumidor tratara mal una de las dos.
 * ──────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Un despacho visto desde el GESTOR: el `Despacho` de siempre **más** los tres datos que la Fase
 * 03.20 añadió (`direccion`, `intentos`, `enviadoAt`).
 *
 * 🔴 Se EXTIENDE, no se duplica. Redeclarar los siete campos comunes daría dos copias del mismo
 * contrato, que acaban divergiendo a la primera columna nueva.
 *
 * ⚠️ En el backend **no hay un tipo aparte**: `Despacho` ganó los tres campos y lo comparten las
 * TRES lecturas del módulo (Plan 04, decisión 3). Aquí se declara la extensión porque el Gestor es
 * el único consumidor que **necesita** `intentos` como dato presente —su tarjeta decide con él si
 * pinta la meta—, y porque las otras dos lecturas de este archivo tienen consumidores escritos
 * contra el `Despacho` corto que no deben cambiar de tipo por esta fase.
 */
export interface DespachoGestor extends Despacho {
  /** La dirección física a la que salió, congelada. Ausente en los que no son físicos. */
  direccion?: string;
  /** Cuántas veces se ha intentado. **0** cuando no hubo ninguno: nunca ausente. */
  intentos: number;
  /**
   * Cuándo se MANDÓ (solo correo), en ISO. Ausente mientras no haya salido ninguno.
   *
   * 🔴 No es `resueltoAt` y no se sustituye por él: «se envió» y «se resolvió» no son el mismo
   * instante —el registro manual admite fecha del pasado— y en un procedimiento sancionador cuyos
   * términos corren desde la notificación, confundirlos mete una fecha falsa en el expediente.
   */
  enviadoAt?: string;
}

/**
 * La FILA del Gestor: una notificación con sus despachos, más los datos del expediente y del
 * administrado que la tabla pinta en sus columnas.
 *
 * ⚠️ `despachos` es **siempre** una lista, nunca `undefined`: una fila sin ningún despacho —el caso
 * NORMAL de hoy, 156 de 157 administrados sin formas declaradas— trae `[]`, para que la tarjeta
 * pueda distinguir «no hay canales» de «no me llegaron».
 */
export interface GestorNotificacion {
  notiId: number;
  eejeId: number;
  docId: number;
  /** El nombre del documento notificado: la tarjeta dice QUÉ se notificó, no un número. */
  docName: string;
  /** El tipo de documento, traducido (D-12). Por ejemplo `Providencia`. */
  justificacion: string;
  /** El subtipo, traducido (D-12). Por ejemplo `Archivo`. Llega `null` cuando no hay. */
  especificacion: string | null;
  /** Número del expediente. Llega `null` cuando la notificación no cuelga de ninguno. */
  expNumber: string | null;
  /** Estado del EPAS, con el valor crudo de `EpasState` (mayúsculas y guiones bajos). */
  eejeStatus: string;
  admiIdentification: string;
  admiName: string;
  admiLastname: string;
  emitidaAt: string;
  /** Cuándo surtió efecto. `null` mientras **no haya plazo corriendo**. */
  perfeccionadaAt: string | null;
  despachos: DespachoGestor[];
  /**
   * 🔴 `true` cuando el documento NOTIFICADO requería firma y no la tiene (Fase 03.21, D-09/D-21).
   *
   * Lo calcula el SERVIDOR en el SQL del Gestor (doctrina CH-5, igual que `correoEnvioHabilitado`)
   * y lo hace cumplir además en los verbos del despacho. Este frontend lo usa TAL CUAL: **no lo
   * deduce de las firmas, ni de la fecha, ni de nada**. Lo emitido con el firmador apagado o antes
   * de encenderlo llega en `false` y nada cambia en pantalla. Nunca llega `null`.
   */
  despachoBloqueadoPorFirma: boolean;
}

/**
 * El sobre del Gestor: el paginado de siempre **más** el interruptor del envío.
 *
 * 🔴 `correoEnvioHabilitado` viaja en la RAÍZ, una vez por página y nunca por fila, y lo resuelve
 * el SERVIDOR (doctrina CH-5). El cliente lo usa TAL CUAL: deducirlo, sustituirlo con un valor por
 * defecto o derivarlo del rol ofrecería un botón que manda notificaciones jurídicas en un entorno
 * donde el envío está apagado.
 */
export interface BandejaGestorNotificaciones<T = GestorNotificacion>
  extends BandejaPaginada<T> {
  correoEnvioHabilitado: boolean;
}

/**
 * Lo que la tabla le pide al Gestor: la página que está mostrando y los filtros que tiene puestos,
 * tal y como se los entrega `Table.tsx` en `PaginationAndFilters`.
 *
 * `filterParams` llega YA SERIALIZADO por `serializeColumnFilters`: las claves son los NUEVE
 * nombres que `FiltroGestorDto` declara —incluidos `notiEmitidaAtFrom`/`notiEmitidaAtTo`, que el
 * filtro de rango genera a partir del `id` de la columna— y los valores son cadenas o arrays.
 */
export interface GestorParams {
  /** Índice de página BASE 0, el de `Table.tsx`. Se traduce a desplazamiento aquí. */
  pageIndex?: number;
  /** Tamaño de página PEDIDO. El backend lo acota a 100 y declara el aplicado en el sobre. */
  pageSize?: number;
  /** Filtros ya serializados. Lo vacío se omite. */
  filterParams?: Record<string, unknown>;
}

/**
 * El desenlace de un reenvío manual (Plan 05). Los tres valores de `resultado` son los que el
 * backend nombra, y cada uno significa algo distinto para el expediente:
 *
 *   · `notificado` — el envío se aceptó: el despacho queda notificado, consta su razón de envío y
 *     🔴 **la notificación queda PERFECCIONADA, así que los términos empiezan a correr**.
 *   · `rechazado`  — el servicio rechazó la dirección: la vía queda agotada con su razón de
 *     imposibilidad emitida.
 *   · `parcial`    — no se pudo confirmar: el despacho sigue **pendiente** y el intento se contó.
 *
 * ⚠️ El cuarto desenlace —el servicio de correo caído— **no llega por aquí**: en el camino manual
 * el error del transporte sube como error HTTP y esta promesa se RECHAZA. Ver `reenviarCorreo`.
 */
export interface ResultadoReenvio {
  resultado: "notificado" | "rechazado" | "parcial";
  /** El contador YA subido: el intento queda registrado aunque el envío no saliera. */
  intentos: number;
  /** La dirección CONGELADA a la que se intentó. La pantalla la nombra en sus cuatro avisos. */
  correo: string;
  /** El documento de la razón. AUSENTE cuando el desenlace no permitió emitirla (`parcial`). */
  razonDocId?: number;
}

/**
 * Traduce los parámetros de tabla a la query que el Gestor admite. Vive FUERA del método, como el
 * `paramsDeMisAsignados` de `SorteoService`, para poder leerse sin abrir el servicio entero.
 *
 * 🔴 DOS REGLAS, Y LAS DOS SON EL CONTRATO CON UNA ALLOWLIST:
 *
 * 1. **Lo vacío se OMITE.** De eso se encarga `appendTableFilterParams`, que salta los nulos, los
 *    indefinidos y las cadenas en blanco, y que repite la clave para cada elemento de un array
 *    —que es como el catálogo de ESTATUS manda varias selecciones—. No se monta la query a mano:
 *    esa utilidad es la que tiene prueba de unidad contra los nombres del DTO.
 * 2. **No se inventa ninguna clave.** Las que salen de aquí son las nueve del filtro más `limit` y
 *    `offset`. El `ValidationPipe` del backend corre con `forbidNonWhitelisted: true`: una clave
 *    que `FiltroGestorDto` no declare no se ignora, devuelve **400 — y el 400 no dice cuál fue**.
 *    ⚠️ En particular `docName` y `progreso` **NO son filtrables** (Plan 04): una petición que los
 *    lleve falla entera.
 *
 * El paginado se emite SOLO si hay tamaño de página. Sin él, el backend aplica su propio defecto, y
 * mandar `limit=undefined` sería exactamente el blanco que la regla 1 prohíbe.
 */
const paramsDelGestor = (params: GestorParams): URLSearchParams => {
  const query = new URLSearchParams();

  appendTableFilterParams(query, params.filterParams ?? {});

  const { pageSize } = params;
  if (pageSize != null) {
    query.append("limit", String(pageSize));
    query.append("offset", String((params.pageIndex ?? 0) * pageSize));
  }

  return query;
};

/** Cómo se llama cada forma en pantalla. */
export const ETIQUETA_FORMA: Record<FormaNotificacion, string> = {
  CORREO: "Correo electrónico",
  CASILLERO: "Casillero judicial",
  FISICO: "Físico (domicilio)",
};

export const NotificacionEjecucionService = {
  async formas(eejeId: number): Promise<FormasAceptadas> {
    const { data } = await httpClient.get<FormasAceptadas>(
      `/notificacion/formas/${eejeId}`,
    );
    return data;
  },

  async guardarFormas(
    eejeId: number,
    datos: {
      aceptaCorreo: boolean;
      aceptaCasillero: boolean;
      aceptaFisico: boolean;
      casillero?: string;
      /** Omitirla la deja como está: no mandarla nunca significa borrarla. */
      direccion?: string;
    },
  ): Promise<FormasAceptadas> {
    const { data } = await httpClient.put<FormasAceptadas>(
      `/notificacion/formas/${eejeId}`,
      datos,
    );
    return data;
  },

  /** Añade una dirección. La procedencia es obligatoria: es la trazabilidad del correo. */
  async agregarCorreo(
    eejeId: number,
    email: string,
    procedencia: string,
  ): Promise<FormasAceptadas> {
    const { data } = await httpClient.post<FormasAceptadas>(
      `/notificacion/formas/${eejeId}/correos`,
      { email, procedencia },
    );
    return data;
  },

  /** Marca una dirección como NO vigente. ⚠️ No la borra, y esa es la idea. */
  async desactivarCorreo(
    eejeId: number,
    corrId: number,
  ): Promise<FormasAceptadas> {
    const { data } = await httpClient.delete<FormasAceptadas>(
      `/notificacion/formas/${eejeId}/correos/${corrId}`,
    );
    return data;
  },

  /**
   * Todas las notificaciones del expediente, la más reciente primero. Una sola llamada: la lista
   * no puede preguntar documento por documento.
   */
  async porExpediente(eejeId: number): Promise<Notificacion[]> {
    const { data } = await httpClient.get<Notificacion[]>(
      `/notificacion/expediente/${eejeId}`,
    );
    return Array.isArray(data) ? data : [];
  },

  /**
   * Abre los despachos que falten en una notificación que nació SIN ninguno —la providencia se
   * emitió cuando el administrado aún no tenía formas declaradas—. Devuelve cuántos se abrieron.
   */
  async abrirDespachos(notiId: number): Promise<number> {
    const { data } = await httpClient.post<number>(
      `/notificacion/${notiId}/despachos`,
    );
    return Number(data ?? 0);
  },

  async porDocumento(docId: number): Promise<Notificacion | undefined> {
    const { data } = await httpClient.get<Notificacion | undefined>(
      `/notificacion/documento/${docId}`,
    );
    return data;
  },

  /** Registra qué pasó con un despacho. El primero notificado arranca los plazos. */
  async resolverDespacho(
    despId: number,
    estado: Exclude<EstadoDespacho, "pendiente">,
    datos: { fecha?: string; observacion?: string } = {},
  ): Promise<{ razonDocId?: number }> {
    const { data } = await httpClient.patch<{ razonDocId?: number }>(
      `/notificacion/despacho/${despId}`,
      { estado, ...datos },
    );
    return data;
  },

  /**
   * El listado TRANSVERSAL del Gestor de Notificaciones → GET /notificacion/gestor.
   *
   * Es la única lectura del módulo que no cuelga de un expediente: pagina sobre TODAS las
   * notificaciones y trae, por fila, sus despachos con sus intentos y su fecha de envío. Devuelve el
   * sobre COMPLETO, incluido `correoEnvioHabilitado`, que va en la raíz y que la página baja tal cual
   * a las tarjetas.
   *
   * ⚠️ Roles del endpoint: `secretario abogado` y `director`. Cualquier otro recibe 403 — el menú
   * ausente **no es** control de acceso.
   *
   * @param params página y filtros ya serializados por la tabla; todos opcionales.
   */
  async gestor(params: GestorParams = {}): Promise<BandejaGestorNotificaciones> {
    const { data } = await httpClient.get<BandejaGestorNotificaciones>(
      `/notificacion/gestor`,
      { params: paramsDelGestor(params) },
    );
    return data;
  },

  /**
   * Reintenta el envío de un despacho de CORREO pendiente →
   * POST /notificacion/despacho/:despId/reenviar.
   *
   * 🔴 **QUÉ SIGNIFICA PULSARLO.** No es una recarga ni un reintento técnico: manda una notificación
   * jurídica. Si el envío se acepta, el despacho queda **notificado**, se emite la razón de envío y
   * **la notificación queda PERFECCIONADA — los términos empiezan a correr**. Por eso la pantalla lo
   * confirma antes (Plan 07) y por eso este servicio **no lo reintenta solo**: un reintento
   * automático arrancaría plazos sin que nadie lo pidiera.
   *
   * 🔴 **SIN CUERPO, y no es un olvido.** La dirección sale del despacho CONGELADO en la base: el
   * endpoint no declara `@Body` y no hay DTO. Mandar una dirección desde el cliente sería dejarle
   * elegir a quién se notifica.
   *
   * ⚠️ **Un servicio de correo caído RECHAZA esta promesa, no devuelve un desenlace.** Es la
   * asimetría del camino manual frente al automático: allí el fallo se captura para no tumbar la
   * emisión, aquí SUBE, porque hay una persona esperando la respuesta. El intento ya quedó contado
   * en la base, así que al recargar la tarjeta el contador habrá subido. Quien llame tiene que
   * distinguir los tres desenlaces de `ResultadoReenvio` del rechazo de la promesa: son cuatro
   * mensajes distintos, y los tres últimos dicen que **nadie quedó notificado**.
   *
   * @param despId el despacho de correo a reintentar.
   */
  async reenviarCorreo(despId: number): Promise<ResultadoReenvio> {
    const { data } = await httpClient.post<ResultadoReenvio>(
      `/notificacion/despacho/${despId}/reenviar`,
    );
    return data;
  },
};

export default NotificacionEjecucionService;

/**
 * De dónde puede salir una dirección. Texto libre en la base —las fuentes del ecosistema crecen—
 * pero la pantalla ofrece las conocidas para que no se escriban de diez formas distintas.
 */
export const PROCEDENCIAS = [
  { valor: "EXPEDIENTE", etiqueta: "Del expediente" },
  { valor: "ESCRITO", etiqueta: "La señaló en un escrito" },
  { valor: "PORTAL", etiqueta: "Portal del administrado" },
  { valor: "SIGOC", etiqueta: "SIGOC" },
] as const;
