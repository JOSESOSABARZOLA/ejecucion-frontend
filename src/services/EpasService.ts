/**
 * Microservicio: ejecucion
 * Módulo: EPAS
 * Feature: Servicio frontend del Expediente del Procedimiento Administrativo Sancionador (EPAS)
 * Archivo: EpasService.ts
 * Responsabilidad: Consumir el backend de Ejecución (:3004) para listar/filtrar EPAS y
 *   devolverlos a la DMR (individual y por lote). El interceptor de httpClient inyecta el
 *   Authorization: Bearer desde localStorage.authToken; no se cablean headers por llamada.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-08
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, D-07: `bitacora()` — la mitad interna de la
 *   línea de tiempo del expediente, que llevaba desde el principio escribiéndose y sin poderse leer
 *   desde ninguna parte).
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 12, D-14/D-17): `EpasListItem` y
 *   `ExpedienteGrupo` pierden el id de materia del expediente; `expMateria` es la DEDUCIDA del código
 *   de infracción, como en los DTOs del backend.
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-15/D-26): `FirmaDocumento` y
 *   `ExpedienteDocumento.firmas` / `firmaRequerida`, que trae ya `GET /epas/:eejeId/documentos`.
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: `getDocumentosExternos`, los
 *   documentos de Inspección, Instrucción, Resolución y Secretaría General del expediente).
 */
import httpClient from "../api/httpClient";
import { errorDeBlob } from "../utils/blobError.util";
import type { ObligacionHacerEnBandeja } from "../interfaces/IObligacionHacer";
import type { TimelineEvent } from "../interfaces/ICase";
import type { IDocumentosExternosDelExpediente } from "../interfaces/IDocumentosExternos";

/** Estado de notificación de la resolución del EPAS (RECE-03), consultado on-demand a Core. */
export type NotificacionEstado =
  "pendiente" | "notificado" | "rechazado" | "desconocida";

/**
 * Fila del listado de EPAS (GET /epas). Espeja EpasListItemDto del backend (camelCase).
 *
 * Un EPAS es un **caso**: un ADMINISTRADO (admiId) dentro de un EXPEDIENTE (expId/expNumber). Varias
 * filas con el mismo expId son los casos de un mismo expediente — de ahí la agrupación de las
 * bandejas (ExpedienteGrupo).
 */
export interface EpasListItem {
  eejeId: number;
  eejeStatus: string;
  /** Expediente al que pertenece el caso (clave de agrupación de las bandejas). */
  expId?: number;
  expNumber?: string;
  expZone?: string;
  /**
   * NOMBRE de la materia, DEDUCIDA del código de las infracciones del EPAS (Fase 03.23, D-17): si son
   * varias, unidas con « / »; un prefijo desconocido se dice («Materia no reconocida (XYZ)»). Ausente
   * en un EPAS sin infracciones, y la fila se sigue listando. Espeja `EpasListItemDto.expMateria`.
   */
  expMateria?: string;
  /** Medida cautelar del expediente ('Clausura', 'Retiro de bienes/productos', …). Casi siempre null. */
  expMedidaCautelar?: string | null;
  expFojas?: number;
  admiName?: string;
  admiLastname?: string;
  /**
   * Razón social — solo la PERSONA JURÍDICA la tiene. Cuando existe, ES la identidad del administrado:
   * titular ese caso con admiName + admiLastname no describe a una empresa.
   */
  admiBusinessName?: string | null;
  admiIdentification?: string;
  eejeIncomeAt?: string;
  eejeIsLocked?: boolean;
  /**
   * Marca de triage del DIRECTOR (RECE-08): cuándo aprobó el expediente y lo REMITIÓ al secretario.
   * No es un estado: el EPAS sigue RECIBIDO hasta que el SECRETARIO lo marque revisado (VERIFICADO).
   */
  eejeDirectorApprovedAt?: string | null;
  eejeDirectorApprovedBy?: number | null;

  // ── Lo que trae la RESOLUCIÓN DE ORIGEN (2026-09-08) ───────────────────────────────────────
  // Pedido del área usuaria: en las bandejas hay que ver cuánto se impuso y con qué acto llega el
  // expediente, sin abrirlo. Los manda Resolución en el lote de entrada y los persiste la recepción.
  //
  // ⚠️ Opcionales de verdad, no por costumbre: Resolución todavía NO los emite y todo lo aterrizado
  // antes del 08-09 los tiene vacíos. Las cards OMITEN la línea cuando falta — nunca «$ 0,00».

  /** Multa impuesta por la resolución sancionadora, en dólares. */
  eejeMultaImpuesta?: number;
  /** Número de la resolución sancionadora con la que llegó el expediente desde la DMR. */
  eejeResolucionNumero?: string;
  /** Fecha de esa resolución (ISO). */
  eejeResolucionFecha?: string;

  /**
   * EL CORRECTIVO, junto a la pecuniaria. Espeja `EpasListItemDto.obligacionHacer` del backend.
   *
   * 🔴 2026-09-15 — ESTE CAMPO YA VIAJABA Y SE ESTABA TIRANDO. Lo incrustó la Fase 03.16 (D-04) en
   * los fragmentos SQL compartidos de `obligacion-hacer.sql.ts`, así que el bloque llega por la red
   * y `httpClient` lo entrega intacto desde entonces. Lo que faltaba era esta línea: sin declararlo,
   * TypeScript no lo conocía y ninguna pantalla podía leerlo. Se deja escrita la fecha del hallazgo
   * a propósito — un campo que llega y nadie lee es exactamente la clase de cosa que se vuelve a
   * descubrir dentro de un año y se «arregla» pidiéndoselo otra vez al backend.
   *
   * ⚠️ OPCIONAL DE VERDAD: un expediente sin correctivo no trae el bloque. Presente con
   * `tiene: false` significa «se miró y no lleva»; ausente significa «esta respuesta no lo trae».
   *
   * 🔴 NO TRAE EL PELDAÑO (`PeldanoCompulsorio`). Derivarlo exige contar la serie de multas del
   * expediente, y la bandeja no la trae: el peldaño sólo existe en `GET /obligacion-hacer/:eejeId`.
   * Consecuencia directa: cualquier condición sobre `peldano.ordinalSiguiente` es INDECIDIBLE sobre
   * una fila, y lo indecidible se apaga — no se adivina. El tipo `ObligacionHacerEnBandeja` lo hace
   * cumplir: leer el peldaño de una fila no compila.
   */
  obligacionHacer?: ObligacionHacerEnBandeja;
}

export interface EpasListResponse {
  data: EpasListItem[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
}

/**
 * Un EXPEDIENTE con sus CASOS anidados (GET /epas/agrupados). Espeja ExpedienteGrupoDto del backend.
 *
 * El EPAS (EpasListItem) es un **caso**: un administrado DENTRO de un expediente (su fila tiene
 * exp_id Y admi_id). Varios casos comparten el mismo expediente. Las bandejas muestran el EXPEDIENTE
 * como contenedor y sus casos dentro — no una tarjeta plana por administrado.
 */
export interface ExpedienteGrupo {
  expId: number;
  expNumber?: string;
  expZone?: string;
  /**
   * NOMBRE de la materia, DEDUCIDA del código de las infracciones (Fase 03.23, D-17) y copiada del
   * caso cabeza del grupo. Ausente sin infracciones, sin ocultar el grupo. Espeja
   * `ExpedienteGrupoDto.expMateria`.
   */
  expMateria?: string;
  /**
   * Medida cautelar del expediente. ALTA SEÑAL: cambia la prioridad con la que se trata el expediente,
   * por eso la cabecera la pinta como badge de alerta — pero SOLO cuando existe (casi nunca).
   */
  expMedidaCautelar?: string | null;
  expFojas?: number;
  expCoreId?: number;
  /** Los casos del expediente que pasan el filtro de la bandeja (nunca un subconjunto por paginado). */
  casos: EpasListItem[];
  totalCasos: number;

  /**
   * EL CORRECTIVO DEL EXPEDIENTE. Espeja `ExpedienteGrupoDto.obligacionHacer` del backend.
   *
   * ⚠️ VA EN EL EXPEDIENTE, NO EN EL CASO, y así lo manda el backend: el correctivo lo impuso la
   * resolución sobre el expediente, no sobre un administrado suelto. Por eso el director y el
   * secretario lo tienen delante al decidir el archivo — un expediente con obligación de hacer
   * pendiente NO se archiva, aunque la multa esté pagada.
   *
   * 🔴 2026-09-15 — YA VIAJABA Y SE ESTABA TIRANDO, por lo mismo que en `EpasListItem`: el bloque lo
   * incrustó la Fase 03.16 (D-04) en los fragmentos SQL compartidos y nadie lo declaró aquí.
   *
   * ⚠️ Opcional: un expediente sin correctivo no lo trae. 🔴 Y NO TRAE EL PELDAÑO — ver la nota de
   * `EpasListItem.obligacionHacer`.
   */
  obligacionHacer?: ObligacionHacerEnBandeja;
}

/** Envelope de GET /epas/agrupados. OJO: `total`/`pages` cuentan EXPEDIENTES, no casos. */
export interface ExpedienteGrupoListResponse {
  data: ExpedienteGrupo[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
}

/**
 * Resultado del triage del DIRECTOR sobre un EXPEDIENTE COMPLETO (RECE-08): cuántos de sus casos se
 * remitieron/devolvieron y cuántos quedaron OMITIDOS (no elegibles: ya remitidos o fuera de RECIBIDO).
 * Los omitidos NO son un error — la operación es idempotente por diseño.
 */
export interface TriageExpedienteResult {
  expId: number;
  aprobados?: number;
  devueltos?: number;
  omitidos: number;
}

/**
 * Una firma aplicada a un documento, tal y como la proyecta `GET /epas/:eejeId/documentos`
 * (Fase 03.21, Plan 07: `FirmaDeDocumento` del backend, palabra por palabra).
 *
 * Son solo tres claves a propósito (D-16): el rol con el que se firmó, el nombre del firmante y el
 * instante. El servidor NO manda el id del usuario ni nada del certificado.
 */
export interface FirmaDocumento {
  rol: "decisor" | "secretario" | "director" | "revisor";
  /** `null` cuando el firmante ya no existe en la base: el sello lo dice en vez de dejar un hueco. */
  nombre: string | null;
  /** ISO del instante en que se aplicó la firma. */
  at: string;
}

/** Documento del expediente asociado al EPAS. Proviene del módulo de Resolución (vía proxy de Ejecución). */
export interface ExpedienteDocumento {
  docId: number;
  docName: string;
  tdocTypeName?: string;
  docUploadedAt?: string;
  docStatus?: string | null;
  docUrl?: string;
  /**
   * Las firmas aplicadas, en el orden en que se aplicaron (D-15). Vacío cuando no tiene ninguna.
   *
   * 🔴 «Firmado» se DERIVA de aquí, NUNCA de `docStatus`: ése sigue siendo el ciclo borrador /
   * emitida del acta, y pintar el sello leyéndolo lo pondría y lo quitaría por razones que no
   * tienen nada que ver con la firma.
   *
   * Opcional porque otras lecturas reutilizan este tipo y no lo traen.
   */
  firmas?: FirmaDocumento[];
  /**
   * `true` cuando el documento se emitió con el firmador encendido y por tanto DEBÍA salir firmado
   * (D-21/D-26). Con `firmas` vacío es el chip «Sin firma». Ausente en lo emitido con el firmador
   * apagado, antes de encenderlo, y en los documentos subidos.
   */
  firmaRequerida?: boolean;
}

/** Serializa filtros a query string, descartando los vacíos (compartido por las dos lecturas). */
function buildQuery(
  offset: number,
  limit: number,
  filterParams: Record<string, unknown>,
): string {
  const params: URLSearchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  for (const [key, value] of Object.entries(filterParams)) {
    if (value !== null && value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  }

  return params.toString();
}

export const EpasService = {
  /**
   * Lista/pagina/filtra EPAS por CASO (fila plana). `offset` es un OFFSET de registros
   * (= pageIndex * pageSize), NO el índice de página.
   *
   * Para las bandejas prefiera getEpasAgrupados: agrupa por expediente y garantiza que sus casos no
   * se parten entre páginas.
   */
  async getEpas(
    offset: number,
    limit: number,
    filterParams: Record<string, unknown>,
  ): Promise<EpasListResponse> {
    const { data } = await httpClient.get<EpasListResponse>(
      `/epas?${buildQuery(offset, limit, filterParams)}`,
    );
    return data;
  },

  /**
   * Lista los EPAS AGRUPADOS POR EXPEDIENTE (GET /epas/agrupados): cada expediente con sus CASOS
   * anidados. Es la lectura de las bandejas.
   *
   * El paginado va POR EXPEDIENTE (el backend aplica el LIMIT/OFFSET sobre los grupos), así que los
   * casos de un expediente NUNCA quedan partidos entre páginas: cuando un expediente aparece,
   * aparece con todos sus casos. Eso es lo que hace fiable la selección de "expediente completo".
   *
   * @param offset OFFSET de EXPEDIENTES (= pageIndex * pageSize), no de casos.
   * @param limit Expedientes por página.
   */
  async getEpasAgrupados(
    offset: number,
    limit: number,
    filterParams: Record<string, unknown>,
  ): Promise<ExpedienteGrupoListResponse> {
    const { data } = await httpClient.get<ExpedienteGrupoListResponse>(
      `/epas/agrupados?${buildQuery(offset, limit, filterParams)}`,
    );
    return data;
  },

  /** Estado de notificación de un EPAS on-demand (RECE-03) → GET /epas/:id/notificacion. */
  async getNotificacionEstado(
    eejeId: number,
  ): Promise<{ eejeId: number; estado: NotificacionEstado }> {
    const { data } = await httpClient.get<{
      eejeId: number;
      estado: NotificacionEstado;
    }>(`/epas/${eejeId}/notificacion`);
    return data;
  },

  /**
   * BITÁCORA INTERNA del expediente → GET /epas/:eejeId/bitacora.
   *
   * Es la mitad NORMATIVA de la línea de tiempo (art. 82 CRE, D-07): quién cambió qué y cuándo
   * dentro de este módulo. La otra mitad —el paso del caso por el sorteo— la sirve
   * `SorteoService.historialCaso` y las funde `utils/lineaDeTiempo.util.ts`, en el cliente.
   *
   * 🔴 LECTURA NOMINATIVA Y CERRADA. El endpoint nace con `@Roles` (los tres del flujo) Y con
   * comprobación de PERTENENCIA: el decisor solo alcanza sus expedientes. Aquí no se replica esa
   * regla —si se dedujera por cuenta propia, un día diría que sí y el backend respondería que no—:
   * se deja que el servidor la aplique y se muestra lo que responda.
   *
   * Lo que llega ya viene PROYECTADO contra una lista blanca: los dos jsonb crudos de la bitácora
   * —que llevan motivos, observaciones y números de transacción bancaria del administrado— no
   * salen del servidor. Esta pantalla nunca los ve, y por eso tampoco puede filtrarlos.
   *
   * Orden: `log_created_at ASC, log_id ASC`, ya determinista desde el servidor. El defecto de
   * página es 100 (el tope): una línea de tiempo se LEE ENTERA, no se navega.
   */
  async bitacora(eejeId: number): Promise<TimelineEvent[]> {
    const { data } = await httpClient.get<TimelineEvent[]>(
      `/epas/${eejeId}/bitacora`,
    );
    return data;
  },

  /**
   * Documentos del expediente asociado al EPAS. Proxy de Ejecución hacia el módulo de Resolución
   * (que busca por exp_id). GET /epas/:eejeId/documentos. Aún NO cableado en backend → puede 404;
   * el consumidor debe degradar con gracia (estado "integración pendiente").
   */
  async getDocumentos(eejeId: number): Promise<ExpedienteDocumento[]> {
    const { data } = await httpClient.get<ExpedienteDocumento[]>(
      `/epas/${eejeId}/documentos`,
    );
    return data;
  },

  /**
   * Documentos EMITIDOS del expediente en los OTROS módulos (Inspección, Instrucción, Resolución y
   * Secretaría General), agregados por el backend: una entrada por módulo con su estado (`ok`,
   * `error`, `deshabilitado`) y la marca `simulado` mientras ese módulo no publique su servicio.
   * Cada documento trae su `archivoUrl` hacia el proxy de Ejecución. GET /epas/:eejeId/documentos-externos.
   */
  async getDocumentosExternos(
    eejeId: number,
  ): Promise<IDocumentosExternosDelExpediente> {
    const { data } = await httpClient.get<IDocumentosExternosDelExpediente>(
      `/epas/${eejeId}/documentos-externos`,
    );
    return data;
  },

  /**
   * Adjunta un ANEXO libre al expediente (quick 260819-anx).
   *
   * La ventana la hace cumplir el backend —desde que hay decisor asignado hasta que se remite a
   * Secretaría General—; aquí no se replica, para no tener dos versiones de la misma regla.
   * Timeout propio: subir un escaneo por una red municipal tarda más que cualquier lectura, y el
   * `timeout` global de 5 s del httpClient se queda intacto.
   */
  async adjuntarAnexo(
    eejeId: number,
    descripcion: string,
    archivo: File,
  ): Promise<{ docId: number }> {
    const formData = new FormData();
    formData.append("file", archivo);
    formData.append("descripcion", descripcion);

    const { data } = await httpClient.post<{ docId: number }>(
      `/epas/${eejeId}/documentos`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 45000,
      },
    );
    return data;
  },

  /**
   * Triage del DIRECTOR (RECE-08): aprueba el EPAS recibido y lo REMITE AL SECRETARIO.
   *
   * NO transiciona: el EPAS sigue RECIBIDO. El director no verifica y NO envía al sorteo — solo
   * decide qué expedientes pasan al secretario (o los devuelve a la DMR). A partir de aquí el
   * expediente aparece en la Bandeja de Sorteo del SECRETARIO, que es quien lo marca "revisado"
   * (VERIFICAR) y quien lo sortea.
   */
  async aprobarPorDirector(eejeId: number): Promise<void> {
    await httpClient.patch(`/epas/${eejeId}/approve-director`);
  },

  /**
   * Triage del DIRECTOR sobre el EXPEDIENTE COMPLETO (RECE-08): aprueba y REMITE AL SECRETARIO todos
   * los casos elegibles del expediente de una sola vez (PATCH /epas/expediente/:expId/approve-director).
   *
   * El director decide por expediente — es lo que la DMR le remite—, sin perder el caso a caso
   * (aprobarPorDirector). Idempotente: los casos ya remitidos se OMITEN, no fallan. Como en el caso a
   * caso, NO transiciona: los EPAS siguen RECIBIDO hasta que el SECRETARIO los marque revisados.
   *
   * @param expId ID del EXPEDIENTE (exp_id), no del caso.
   * @returns Cuántos casos se remitieron y cuántos quedaron fuera.
   */
  async aprobarExpedientePorDirector(
    expId: number,
  ): Promise<TriageExpedienteResult> {
    const { data } = await httpClient.patch<TriageExpedienteResult>(
      `/epas/expediente/${expId}/approve-director`,
    );
    return data;
  },

  /**
   * Contraparte de la anterior: DEVUELVE A LA DMR el EXPEDIENTE COMPLETO (triage del DIRECTOR).
   * PATCH /epas/expediente/:expId/return-dmr.
   *
   * 🔴 NO LLEVA MOTIVO (2026-09-18). Lo compone el BACKEND, POR CASO, con las observaciones que se
   * anotaron en la ficha: son de cada administrado, y aplicarle a uno las del otro sería falsear el
   * expediente. Los casos sin observaciones se OMITEN —vuelven en `omitidos`— en vez de abortar la
   * devolución de los demás.
   *
   * @param expId ID del EXPEDIENTE (exp_id).
   * @returns { expId, devueltos, omitidos }.
   */
  async devolverExpedienteADmr(
    expId: number,
  ): Promise<TriageExpedienteResult> {
    const { data } = await httpClient.patch<TriageExpedienteResult>(
      `/epas/expediente/${expId}/return-dmr`,
      {},
    );
    return data;
  },

  /**
   * "Marcar revisado" del SECRETARIO (RECE-08): es la transición REAL
   * RECIBIDO --VERIFICAR--> VERIFICADO, y es SU acto (el backend devuelve 403 a un director).
   * VERIFICADO es el gate del sorteo: solo lo revisado se puede sortear.
   */
  async marcarRevisado(eejeId: number, observaciones?: string): Promise<void> {
    await httpClient.patch(`/epas/${eejeId}/transition`, {
      action: "VERIFICAR",
      observaciones,
    });
  },

  /**
   * "Cancelar Revisión" del SECRETARIO (RECE-08 inverso): revierte "marcar revisado". Es la transición
   * REAL VERIFICADO --DESHACER_VERIFICACION--> RECIBIDO, imagen especular de marcarRevisado, y es SU
   * acto (el backend responde 403 a un director o decisor). Al devolver el caso a RECIBIDO lo SACA
   * del conjunto sorteable (SORTEAR solo es legal desde VERIFICADO). Reusa el mismo endpoint
   * genérico de transición que marcarRevisado; no hay endpoint dedicado.
   */
  async desRevisar(eejeId: number, observaciones?: string): Promise<void> {
    await httpClient.patch(`/epas/${eejeId}/transition`, {
      action: "DESHACER_VERIFICACION",
      observaciones,
    });
  },

  /**
   * Devuelve un EPAS a la DMR (transición RECIBIDO --DEVOLVER_DMR--> DEVUELTO_DMR).
   *
   * 🔴 NO LLEVA MOTIVO (2026-09-18). Lo compone el BACKEND con las observaciones por campo y por
   * documento que se anotaron en la ficha, y RECHAZA la devolución de un expediente que no tenga
   * ninguna: devolver sin decir qué corregir es lo que este cambio existe para terminar.
   */
  async returnToDmr(eejeId: number): Promise<void> {
    await httpClient.patch(`/epas/${eejeId}/transition`, {
      action: "DEVOLVER_DMR",
    });
  },

  /**
   * Devuelve un lote de EPAS a la DMR. El backend (Plan 04) EXIGE cantidadEsperada para la
   * verificación de cantidad recibida vs. esperada (RECE-02).
   */
  async returnBatch(
    eejeIds: number[],
    cantidadEsperada: number,
    observaciones?: string,
  ): Promise<void> {
    await httpClient.post(`/epas/return-batch`, {
      eejeIds,
      cantidadEsperada,
      observaciones,
    });
  },

  /**
   * Descarga el expediente COMPLETO en un ZIP, para certificarlo FUERA del módulo y remitirlo a la
   * Procuraduría. No mueve el estado del EPAS: el expediente sigue su ciclo donde esté.
   *
   * 🔴 Timeout POR PETICIÓN. El `timeout: 5000` global de `httpClient` es el techo correcto para una
   * respuesta JSON, pero aquí el servidor comprime N PDFs escaneados: un expediente con veinte
   * folios lo rebasa de sobra y el navegador abortaría una descarga que el backend está sirviendo
   * bien. Mismo remedio que el combo de firma (`COMBO_FIRMA_TIMEOUT_MS`), y por la misma razón.
   *
   * El nombre sale de `Content-Disposition`, que el backend expone por CORS a propósito. Si aun así
   * no llega, se cae a un nombre derivado del id: es preferible un nombre pobre a una descarga sin
   * nombre.
   *
   * @returns el PDF foliado y el nombre con el que debe guardarse.
   */
  async descargarExpediente(
    eejeId: number,
  ): Promise<{ blob: Blob; nombreArchivo: string }> {
    try {
      const respuesta = await httpClient.get<Blob>(
        `/epas/${eejeId}/expediente/descargar`,
        { responseType: "blob", timeout: DESCARGA_EXPEDIENTE_TIMEOUT_MS },
      );
      return {
        blob: respuesta.data,
        nombreArchivo:
          nombreDesdeContentDisposition(
            respuesta.headers?.["content-disposition"],
          ) ?? `expediente-${eejeId}.pdf`,
      };
    } catch (err) {
      // Sin esto, la negativa explicada del backend ("no tiene acta de sorteo definitiva") llegaría
      // al usuario como un "Request failed with status code 400" que no dice nada.
      throw await errorDeBlob(err, "No se pudo descargar el expediente.");
    }
  },
};

/** Techo de la descarga del expediente: comprimir N PDFs no cabe en los 5 s del cliente global. */
export const DESCARGA_EXPEDIENTE_TIMEOUT_MS = 60000;

/**
 * Extrae el nombre de fichero de una cabecera `Content-Disposition`. Devuelve `null` si la cabecera
 * no viene o no trae nombre — el llamador decide con qué reemplazarlo.
 */
function nombreDesdeContentDisposition(
  cabecera: unknown,
): string | null {
  if (typeof cabecera !== "string") return null;
  const entrecomillado = /filename="([^"]+)"/.exec(cabecera);
  if (entrecomillado?.[1]) return entrecomillado[1];
  const suelto = /filename=([^;]+)/.exec(cabecera);
  return suelto?.[1]?.trim() || null;
}

export default EpasService;
