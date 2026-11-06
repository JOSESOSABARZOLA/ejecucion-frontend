/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Emisión de providencias (Fase 03.14, Plan 06 · Fase 03.15, Plan 06)
 * Archivo: ProvidenciaService.ts
 * Responsabilidad: Consumir `/providencias` del backend. El ACTOR sale del JWT y el DESENLACE sobre
 *   el EPAS lo declara el catálogo: ninguno de los dos viaja desde aquí.
 *
 *   ── LOS DOS MÉTODOS DEJARON DE MANDAR LO MISMO (Fase 03.15, D-5) ────────────────────────────
 *   `emitir` viaja como MULTIPART, porque la providencia puede traer la prueba consigo. La VISTA
 *   PREVIA se queda en JSON, y eso NO es una inconsistencia que alguien deba venir a arreglar: el
 *   modal calcula la firma del borrador serializando el payload y lo relanza con `JSON.parse` para
 *   refrescar la vista previa sola. **Un `File` no sobrevive a ese viaje.** Pasar también la vista
 *   previa a FormData rompería el refresco automático entero — y además no le haría falta: la vista
 *   previa no persiste nada, así que nunca necesita el fichero.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-14
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-el5 — el borrador de providencia se guarda
 *   en el SERVIDOR: `leerBorrador`, `guardarBorrador` y `descartarBorrador` sobre
 *   `/providencias/borrador/:eejeId`. Viajan SOLO el cuerpo y el tipo, D-01).
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 13, D-06: se retira la declaración de
 *   aptitud para trabajo comunitario —su tipo y su campo del payload—. La aptitud la decide la
 *   infracción en CORE y la evalúa el servidor, que rechaza el campo con 400 desde el Plan 07.)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 10, D-16: `emitir` recibe la clave de
 *   firma y la manda como `signPassword`, campo HERMANO de `payload` y nunca dentro; `vistaPrevia`
 *   no la conoce. `ProvidenciaEmitida` gana `firma: { aplicada }`.)
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cc7: `DatosCuadroProvidencia.sbu`, el SBU
 *   que escribe el ejecutor en dólares)
 */
import httpClient from "../api/httpClient";
import { errorDeBlob } from "../utils/blobError.util";
import { SUBIDA_TIMEOUT_MS } from "./TrabajoComunitarioService";
import type { BandejaPaginada } from "./EntradaLotesService";

/** Un tipo del catálogo (t_tipo_providencia). Solo llegan los EMITIBLES. */
export interface TipoProvidencia {
  codigo: string;
  nombre: string;
  /** Definición literal del glosario DME: es lo que permite elegir con criterio. */
  definicion?: string;
  activo: boolean;
  /** Borrador HTML precargado del tipo. Ausente ⇒ el editor arranca en blanco. */
  borrador?: string;
  /**
   * Acción que emitir este tipo aplicará sobre el EPAS. La pantalla la ADVIERTE antes de emitir:
   * un «archivo por pago» no solo genera un PDF, cierra el expediente.
   */
  accionEpas?:
    | "MARCAR_CUMPLIDO"
    | "INICIAR_COACTIVA"
    | "INICIAR_TRABAJO_COMUNITARIO"
    | "ARCHIVAR"
    | "DEVOLVER_POR_NULIDAD";
}

/**
 * Un tipo dicho para UN expediente: si se puede emitir AHORA y, si no, qué falta.
 *
 * Lo calcula el backend, que es donde vive el grafo de estados. Aquí no se replica la regla: una
 * copia en la pantalla es como acaban divergiendo las dos versiones de la misma verdad.
 */
export interface TipoProvidenciaDisponible extends TipoProvidencia {
  disponible: boolean;
  motivoNoDisponible?: string;
}

export interface DatosCuadroProvidencia {
  ordenRemanente?: string;
  plazoCumplimiento?: string;
  valorCompensadoSolicitado?: number;
  /**
   * Horas fijadas por el ACTO ADMINISTRATIVO (nota de la act. 16.1). Ausentes ⇒ las calcula el
   * servidor desde el SBU que escribe el ejecutor (`sbu`), que es el camino normal.
   */
  horasAutorizadas?: number;
  /** Plazo en meses. Es lo que se CONGELA; `plazoCumplimiento` es solo cómo se imprime. */
  plazoMeses?: number;
  /**
   * SBU con el que se calcula el trabajo comunitario, en dólares, que ESCRIBE el ejecutor (quick
   * 261105-cc7). El servidor lo exige cuando calcula el cuadro o congela cifras; el de Parámetros
   * nunca lo sustituye.
   */
  sbu?: number;
}

export interface EmitirProvidenciaPayload {
  eejeId: number;
  tipoCodigo: string;
  cabecera?: Record<string, unknown>;
  avoco?: {
    variante: "decisor" | "directivo";
    cargoFirmante: string;
    memorandoSorteo?: string;
    memorandoFecha?: string;
  };
  secciones: Array<{ clave: string; html?: string }>;
  datosCuadro?: DatosCuadroProvidencia;
  /**
   * Decisión sobre la prórroga. Solo la mira el tipo «Trabajo comunitario – prórroga», que es el
   * mismo para conceder y para negar. Los MESES no viajan: los calcula el servidor.
   */
  prorroga?: { concedida: boolean; motivo: string };
  /**
   * Los DATOS del comprobante aportado en el mismo acto (Fase 03.15, D-5). El fichero no viaja
   * aquí: va aparte, en su campo del multipart. Éstos sí van dentro del `payload`, y por eso la
   * VISTA PREVIA también los ve — que es justo lo que hace falta para que los tokens
   * `{Fecha de pago}` y `{Transacción}` se impriman en el borrador mientras se teclean.
   *
   * ⚠️ El backend los IGNORA en la vista previa: ahí no persiste nada.
   */
  pruebaPago?: { pagoAt: string; transaccion: string };
  /** Las horas que acredita el informe del TC aportado en el mismo acto (D-8). Ídem. */
  pruebaTc?: { horasCumplidas: number };
  /**
   * A qué dirección vuelve el expediente. Lo mira UN SOLO tipo —el de devolución por nulidad de
   * autoridad competente, el único cuyo destino no está decidido de antemano—, y para ése el
   * servidor lo EXIGE antes de generar el PDF.
   *
   * Opcional en el tipo por el mismo motivo que `pruebaPago`: este payload lo comparten EMITIR y la
   * VISTA PREVIA, y quien está redactando el borrador todavía no ha elegido a dónde lo manda.
   */
  devolucionDestino?: "DMR" | "DMIT";
}

/**
 * Un aviso del servidor: se muestra, no bloquea.
 *
 * Espeja `Advertencia` de `ejecucion-backend/src/common/interfaces/advertencia.interface.ts`. El
 * `codigo` es lo ESTABLE —por él se decide cómo pintarlo—; el `mensaje` se puede reescribir en el
 * servidor sin romper nada aquí.
 */
export interface Advertencia {
  codigo: string;
  mensaje: string;
}

export interface ProvidenciaEmitida {
  docId: number;
  docName: string;
  docUrl: string;
  paginas: number;
  tipoCodigo: string;
  /** Lo que REALMENTE le pasó al expediente, o null si el tipo no declara desenlace. */
  accionEpasAplicada: string | null;
  /**
   * Avisos del servidor sobre el acto que se acaba de emitir (Fase 03.15, D-6).
   *
   * 🔴 **AUSENTE significa «sin avisos»**: el backend nunca manda un array vacío, para que nadie
   * tenga que distinguir «no hay» de «no se calculó». El caso vivo es el archivo por trabajo
   * comunitario TOTAL emitido sobre un cumplimiento PARCIAL: el servidor calcula las horas,
   * ADVIERTE y **deja emitir** — la última palabra sobre el propio acto es del decisor, y la
   * pantalla no puede convertir el aviso en un bloqueo.
   */
  advertencias?: Advertencia[];
  /**
   * Si la providencia salió FIRMADA (Fase 03.21, D-11). `aplicada: false` solo con el firmador
   * apagado: con el firmador encendido, si la firma no se aplica no se emite nada y la respuesta
   * es un error `APP-FIRMA-*`. La pantalla lo usa para que el aviso de éxito diga la verdad.
   */
  firma: { aplicada: boolean };
}

/** Copy de cada desenlace, para decirlo con palabras en la confirmación y en el aviso de éxito. */
export const ETIQUETA_ACCION_EPAS: Record<string, string> = {
  MARCAR_CUMPLIDO: "el expediente pasará a CUMPLIDO",
  INICIAR_COACTIVA: "el expediente pasará a PENDIENTE DE COACTIVA",
  // Fase 03.14.2: faltaba, y por eso estas providencias caían en el copy genérico ("el expediente
  // cambió de estado") justo cuando más hay que decir — porque además CONGELAN las cifras.
  INICIAR_TRABAJO_COMUNITARIO:
    "el expediente pasará a EN TRABAJO COMUNITARIO y sus cifras quedarán congeladas",
  ARCHIVAR: "el expediente quedará ARCHIVADO",
  // 2026-09-18: el más irreversible de los cinco, y el que más falta hacía decir. Sin esta entrada
  // la advertencia previa y el aviso de éxito caían al genérico «el expediente cambió de estado»
  // justo en el acto que saca el expediente del módulo y lo pone en manos de otra dirección.
  DEVOLVER_POR_NULIDAD:
    "el expediente SALDRÁ de Ejecución y volverá a la dirección que se elija",
};

/**
 * Una sección del contenido almacenado de una providencia ya emitida. Hoy solo hay una —el
 * cuerpo—, pero llega como array porque así lo grabó el plan 05.
 */
export interface SeccionAlmacenada {
  clave: string;
  /** El HTML tal y como lo dejó el editor. Puede faltar: el decisor pudo dejar la sección vacía. */
  html?: string;
}

/**
 * El CONTENIDO REUTILIZABLE de una providencia emitida, tal y como lo guarda el backend en
 * `t_documento.doc_structure` (Fase 03.19, Plan 05).
 *
 * 🔴 **NO lleva `cabecera` ni `avoco`, y es una decisión de diseño, no un olvido.** La cabecera
 * contiene el nº de expediente, la multa impuesta y los datos del administrado de SU expediente: si
 * viajara, «basarse en la anterior» arrastraría al borrador nuevo los datos de un tercero.
 *
 * ⚠️ **`secciones[].html` es HTML REDACTADO POR UN USUARIO Y ALMACENADO** (T-03.19-20). Vuelve al
 * editor, que lo sanea al montarlo. **Prohibido pintarlo como marcado interpretado fuera del
 * editor**: ni en una vista previa, ni en un resumen, ni «solo para enseñar las primeras líneas».
 */
export interface ProvidenciaDocStructure {
  /** Versión del formato. Se comprueba ANTES de importar; ver `similarDocumentImport.util.ts`. */
  version: number;
  tipoCodigo: string;
  secciones: SeccionAlmacenada[];
  /** Lo que el decisor tecleó para el cuadro. Ausente es el caso MAYORITARIO. */
  datosCuadro?: DatosCuadroProvidencia;
}

/**
 * El borrador de providencia guardado en el servidor (quick 261006-el5): lo que el decisor lleva
 * escrito en la página de generación de UN expediente. Es SUYO —el dueño sale del JWT— y solo lleva
 * el cuerpo y el tipo (D-01): ni la prueba, ni las formas de notificación, ni la clave de firma.
 *
 * ⚠️ **`cuerpo` es HTML REDACTADO POR UN USUARIO Y ALMACENADO**, igual que
 * `ProvidenciaDocStructure`. Vuelve SOLO al editor, que lo sanea al montarlo. **Prohibido pintarlo
 * como marcado interpretado fuera del editor.**
 */
export interface BorradorProvidencia {
  /** Código del tipo elegido; `null` = todavía sin tipo. */
  tipoCodigo: string | null;
  cuerpo: string;
  /** ISO del último guardado. Lo pone el servidor, no el reloj de este navegador. */
  actualizadoAt: string;
}

/** Una providencia anterior de la misma clase, con su contenido reutilizable. */
export interface ProvidenciaSimilar {
  docId: number;
  docName: string;
  /** ISO. Es la fecha que se le enseña al decisor para reconocer el documento. */
  docCreatedAt: string;
  tipoCodigo: string;
  /**
   * ⚠️ **OPCIONAL de verdad**: el plan 05 midió que 9 de 258 documentos reales no tienen fila en
   * `t_expediente_documento`. La pantalla DEGRADA («expediente no disponible»); nunca pinta
   * `undefined` ni esconde la entrada por esto.
   */
  expNumber?: string;
  docStructure: ProvidenciaDocStructure;
}

/** Filtros de `GET /providencias/similares`. `tipoCodigo` es OBLIGATORIO: sin él, 400. */
export interface FiltroProvidenciasSimilares {
  /**
   * La CLASE de providencia, no el subtipo de documento. Todas las providencias comparten el mismo
   * subtipo (`tsdoc_id = 11`): filtrar por él devolvería las 32 clases mezcladas.
   */
  tipoCodigo: string;
  limit?: number;
  offset?: number;
}

/**
 * Serializa los filtros OMITIENDO lo vacío.
 *
 * 🔴 Omitir, no mandar en blanco. El `ValidationPipe` del backend corre con `whitelist: true` y
 * `forbidNonWhitelisted: true`: una clave desconocida —o una conocida con valor vacío que no pase
 * su `@IsInt()`— **no se ignora, devuelve 400**, y el decisor vería «no se pudieron consultar las
 * providencias anteriores» por un parámetro que nunca rellenó.
 */
function queryDeSimilares(filtro: FiltroProvidenciasSimilares): string {
  const params = new URLSearchParams({ tipoCodigo: filtro.tipoCodigo });

  for (const [clave, valor] of [
    ["limit", filtro.limit],
    ["offset", filtro.offset],
  ] as const) {
    if (valor !== null && valor !== undefined) {
      params.append(clave, String(valor));
    }
  }

  return params.toString();
}

export const ProvidenciaService = {
  /**
   * Tipos que se pueden emitir hoy (los deshabilitados del glosario no llegan).
   *
   * Con `eejeId`, cada tipo viene además diciendo si ESE expediente lo admite ahora. Se pasa siempre
   * desde el modal de emisión: sin él, el selector ofrecía los 31 tipos del glosario y el decisor
   * componía la providencia entera antes de que la emisión la rechazara.
   */
  async tipos(eejeId?: number): Promise<TipoProvidenciaDisponible[]> {
    const query = eejeId != null ? `?eejeId=${eejeId}` : "";
    const { data } = await httpClient.get<TipoProvidenciaDisponible[]>(
      `/providencias/tipos${query}`,
    );
    return data;
  },

  /**
   * Providencias ANTERIORES de la misma clase, del propio decisor, con su contenido reutilizable
   * (Fase 03.19, D-04). Es lo que alimenta «Basarse en un documento anterior».
   *
   * Devuelve el MISMO sobre paginado que las bandejas (`BandejaPaginada`), con `pages = 0` cuando
   * no hay resultados.
   *
   * 🔴 **EL `limit` QUE VALE ES EL DE LA RESPUESTA, NO EL QUE SE MANDÓ.** El backend lo acota a 100
   * en silencio: quien pagine tiene que leer `limit` de lo que volvió, o pedirá la página siguiente
   * con un tamaño que el servidor no aplicó y se saltará registros.
   *
   * 🔴 **Hoy esto devuelve `{data: [], total: 0, pages: 0}` en la base desplegada**, porque no hay
   * ni una providencia emitida con el formato nuevo (medido por el plan 05: 258 documentos, 0 con
   * contenido). Una lista vacía es el resultado ESPERADO, no un fallo de integración — y por eso la
   * sección que la consume tiene que distinguir «no hay» de «no se pudo consultar».
   *
   * Solo lo puede pedir un `funcionario decisor`: director y secretario reciben 403. El dueño sale
   * del JWT y **no es negociable desde aquí** — mandar `actorUserId` o `roles` como query no amplía
   * nada, devuelve 400.
   */
  async similares(
    filtro: FiltroProvidenciasSimilares,
  ): Promise<BandejaPaginada<ProvidenciaSimilar>> {
    const { data } = await httpClient.get<BandejaPaginada<ProvidenciaSimilar>>(
      `/providencias/similares?${queryDeSimilares(filtro)}`,
    );
    return data;
  },

  /**
   * Emite la providencia. ⚠️ Puede MOVER el estado del EPAS: la providencia es el acto
   * administrativo, y qué acción dispara cada tipo lo declara el catálogo (`accionEpas`).
   *
   * ── VIAJA COMO MULTIPART, Y EL BORRADOR ENTERO EN UN SOLO CAMPO ───────────────────────────
   * `payload` es UNA cadena JSON, no un campo por dato. Es lo que permite reutilizar `armarPayload`
   * del modal **tal cual** —el mismo objeto que arma la vista previa— y, sobre todo, no tocar la
   * firma del borrador: si el cuerpo se desplegara en campos sueltos del FormData, el modal tendría
   * que armar dos payloads distintos y la vista previa acabaría enseñando un documento que no es el
   * que se emite.
   *
   * 🔴 El `Content-Type` SE DECLARA `multipart/form-data`, como en el resto de subidas del repo. El
   * `httpClient` lleva `application/json` por defecto y, con ese encabezado, axios convierte el
   * `FormData` en JSON: el PDF llegaba como `comprobante: {}` y el servidor respondía 400 «property
   * comprobante should not exist» (127, 2026-10-28). El `boundary` no se pierde: con un `FormData`
   * axios retira el encabezado en el navegador y lo pone el navegador con su `boundary`.
   *
   * ── 🔴 LA CLAVE DE FIRMA TIENE UN SOLO CANAL (Fase 03.21, D-16) ─────────────────────────────
   * Con el firmador encendido la providencia se firma en el mismo acto de emitir, y la clave del
   * certificado del decisor viaja como el campo `signPassword` del multipart, HERMANO de `payload`.
   * Nunca dentro de `payload`: ese objeto es el mismo que arma la vista previa y el que se guarda
   * como borrador, así que una clave dentro acabaría en el servidor como borrador, en un log o en
   * el historial del navegador. `vistaPrevia` no admite la clave en absoluto.
   *
   * @param pruebas el comprobante y/o el informe, cuando se aportan EN EL MISMO ACTO (D-5, D-8). Si
   *   la prueba ya consta en el expediente no se manda nada: la providencia la CITA.
   * @param signPassword la clave del certificado, solo con el firmador encendido. En blanco o
   *   ausente no se manda el campo: una clave vacía sería pedirle al firmador que lo intente con
   *   nada. Se manda tal cual, sin recortar: la clave es la que es.
   */
  async emitir(
    payload: EmitirProvidenciaPayload,
    pruebas?: { comprobante?: File; informe?: File },
    signPassword?: string,
  ): Promise<ProvidenciaEmitida> {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (pruebas?.comprobante)
      formData.append("comprobante", pruebas.comprobante);
    if (pruebas?.informe) formData.append("informe", pruebas.informe);
    if (signPassword && signPassword.trim().length > 0)
      formData.append("signPassword", signPassword);

    const { data } = await httpClient.post<ProvidenciaEmitida>(
      "/providencias",
      formData,
      // El timeout global del httpClient son 5 s. Emitir ya era lo más lento del módulo —el
      // servidor arma el PDF entero— y ahora, además, sube hasta dos comprobantes escaneados por
      // una red municipal. Mismo timeout por petición que el resto de subidas del módulo.
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: SUBIDA_TIMEOUT_MS,
      },
    );
    return data;
  },

  /**
   * El borrador del usuario en el EPAS, o `null` si no tiene ninguno (quick 261006-el5).
   *
   * El backend responde `{ borrador: null }` y no un 404 cuando no hay: el 404 significa que el
   * EPAS no existe, y un fallo de la lectura NO es «no hay borrador» — quien llama tiene que poder
   * distinguirlo para no pisar uno que no pudo ver.
   */
  async leerBorrador(eejeId: number): Promise<BorradorProvidencia | null> {
    const { data } = await httpClient.get<{
      borrador: BorradorProvidencia | null;
    }>(`/providencias/borrador/${eejeId}`);
    return data?.borrador ?? null;
  },

  /**
   * Guarda (crea o pisa) el borrador del usuario en el EPAS.
   *
   * 🔴 Manda EXACTAMENTE `{ cuerpo, tipoCodigo }` y nada más (D-01): el pipe del backend rechaza
   * cualquier otra clave con un 400. Un tipo vacío viaja como `null`.
   */
  async guardarBorrador(
    eejeId: number,
    borrador: { cuerpo: string; tipoCodigo?: string | null },
  ): Promise<BorradorProvidencia> {
    const { data } = await httpClient.put<BorradorProvidencia>(
      `/providencias/borrador/${eejeId}`,
      { cuerpo: borrador.cuerpo, tipoCodigo: borrador.tipoCodigo || null },
    );
    return data;
  },

  /** Descarta el borrador del usuario en el EPAS. Idempotente: sin borrador, `eliminado: false`. */
  async descartarBorrador(eejeId: number): Promise<{ eliminado: boolean }> {
    const { data } = await httpClient.delete<{ eliminado: boolean }>(
      `/providencias/borrador/${eejeId}`,
    );
    return data;
  },

  /**
   * El MISMO documento que se emitiría, sin emitirlo: lo arma el backend con la misma plantilla,
   * así que lo que se ve es lo que se va a emitir. Devuelve una URL de blob para el visor.
   *
   * ⚠️ Que salga NO significa que se pueda emitir: la vista previa no comprueba las reglas del
   * acto —se previsualiza un borrador a medio llenar—. Eso lo dice `emitir`.
   *
   * 🔴 Quien la pide es dueño de la URL: hay que soltarla con `URL.revokeObjectURL` al cerrar, o
   * cada vistazo deja un PDF de ~175 KB retenido en memoria.
   *
   * `signal` cancela la petición en vuelo. Hace falta con el refresco automático: sin él, escribir
   * rápido deja varias peticiones compitiendo y **puede llegar antes la vieja**, dejando en
   * pantalla un borrador anterior al texto que ya se ve en el editor.
   *
   * 🔴 **SIGUE MANDANDO JSON, y no es un descuido** (Fase 03.15). Ver la cabecera del archivo: el
   * refresco automático serializa este payload y lo relanza con `JSON.parse`, y un `File` no
   * sobrevive a ese viaje. Los DATOS de la prueba (`pruebaPago`, `pruebaTc`) sí viajan aquí —van
   * dentro del payload— y por eso el borrador puede imprimir los tokens de la prueba mientras se
   * teclean; el FICHERO no hace falta, porque la vista previa no persiste nada.
   */
  async vistaPrevia(
    payload: EmitirProvidenciaPayload,
    signal?: AbortSignal,
  ): Promise<string> {
    try {
      const { data } = await httpClient.post<Blob>(
        "/providencias/vista-previa",
        payload,
        { responseType: "blob", signal },
      );
      return URL.createObjectURL(data);
    } catch (err) {
      // 🔴 Con `responseType: "blob"` el cuerpo del ERROR también llega como Blob, así que el
      // normalizador del httpClient no encuentra el mensaje del servidor y cae en un
      // «Request failed with status code 400» que no dice nada. Se rescata aquí: si la vista previa
      // falla, quien la pidió tiene que poder leer por qué.
      throw await errorDeBlob(err, "No se pudo generar la vista previa.");
    }
  },
};

