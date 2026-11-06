/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: Unidad pura de la FORMA de URL POR-PAR de SorteoService (FEND-03/RECE-06) — Fase 3.5
 * Archivo: SorteoService.test.ts
 * Responsabilidad: Fijar con aserciones EJECUTABLES el CONTRATO por-par `(amasId, decisorUserId)` de la
 *   Fase 3.4: `firmarLote(amasId, decisorUserId)` → PATCH /sorteo/:amasId/:decisorUserId/firmar y
 *   `actaDeLote(amasId, decisorUserId)` → GET /sorteo/:amasId/:decisorUserId/acta, con AMBOS segmentos
 *   numéricos y SIN segmento vacío. Es la REGRESIÓN del bug de la ruta con segmento faltante (que producía
 *   la URL `/sorteo/:amasId//firmar` o `/undefined` → 400) corregida en el Plan 04: cuando se pasa el par
 *   completo, el segundo segmento es el `decisorUserId` numérico y la URL no contiene `//` ni un literal de
 *   valor no definido. También ancla `aceptarCaso(cassId)` → POST /sorteo/:cassId/aceptar. No monta React
 *   ni hace red real: mockea api/httpClient y ejerce solo las URL shapes.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-09-15 (contrato de la excusa con CAUSAL del catálogo y detalle
 *   opcional: `causalesExcusa()` y la nueva forma de `excusar()`, punto 4 del acta del 2026-09-11).
 * Modificado por: Andrés Miño — 2026-09-16 (Quick 260916-kwg, D-03: `excusar()` vuelve a JSON y
 *   entra `vistaPreviaEscritoExcusa()`).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08: `readModoDeFirma` con
 *   `sesionCentral`, la clave de la excusa por su canal y el timeout de firma de 45 s en `excusar` y
 *   `firmarLote`; la guarda «post con DOS argumentos» pasa a «el tercero es SOLO el timeout»).
 *
 *   ── 🔴 LA HISTORIA DE LA PRUEBA DE LA CABECERA MULTIPART, QUE AQUÍ SE RETIRA ─────────────────
 *   El 2026-09-01 la excusa pasó a multipart y `excusar()` se quedó SIN las cabeceras de subida.
 *   `httpClient` nace con `Content-Type: application/json`, y el `transformRequest` de axios 1.x
 *   hace `return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data`: convertía el
 *   `FormData` a JSON, el `File` se iba como `{}` y el backend respondía 400 «property file should
 *   not exist». **El defecto vivió del 2026-09-01 al 2026-09-16 sin que una sola prueba se pusiera
 *   roja** — las que había afirmaban lo que se le ENTREGA a axios, no lo que axios manda por el
 *   cable, y con el cliente mockeado `transformRequest` nunca corre.
 *
 *   El `89bf440` lo tapó añadiendo la cabecera, y se escribió una prueba que la afirmaba. Esa prueba
 *   **se RETIRA aquí, no se reescribe**: afirmaba una propiedad DEL TRANSPORTE MULTIPART, y con el
 *   endpoint en JSON no hay transporte multipart — la afirmación se queda sin sujeto. Mantenerla
 *   adaptada sería peor: una prueba verde protegiendo un camino que ya no existe.
 *
 *   En su lugar queda la GUARDA INVERSA (ver el caso correspondiente): `excusar()` llama a `post`
 *   con DOS argumentos y no toca el `Content-Type`. Y la lección de fondo es la que cierra el
 *   asunto de verdad: lo que arregló esto no fue la cabecera, **fue quitar el multipart**.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock del cliente HTTP centralizado: solo capturamos verbo/path/body, sin red real.
vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
    patch: vi.fn(async () => ({ data: {} })),
  },
}));

import httpClient from "../api/httpClient";
import {
  COMBO_FIRMA_TIMEOUT_MS,
  FIRMA_TIMEOUT_MS,
  SorteoService,
} from "./SorteoService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = httpClient.post as unknown as ReturnType<typeof vi.fn>;
const mockPatch = httpClient.patch as unknown as ReturnType<typeof vi.fn>;

/** El escrito ya compuesto en el modal: lo que hoy viaja donde antes iba el File. */
const ESCRITO_HTML =
  "<p>Quito D.M., 16 de septiembre de 2026</p><p><strong>PRIMERO.-</strong> Me excuso.</p>";

describe("SorteoService (forma de URL por-par — regresión Fase 3.4/Plan 04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("firmarLote(900, 33) → PATCH /sorteo/900/33/firmar con body {}", async () => {
    await SorteoService.firmarLote(900, 33);
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      "/sorteo/900/33/firmar",
      {},
      { timeout: FIRMA_TIMEOUT_MS },
    );
  });

  it("firmarLote(900, 33, type) → PATCH /sorteo/900/33/firmar con body { type }", async () => {
    await SorteoService.firmarLote(900, 33, "D2");
    expect(mockPatch).toHaveBeenCalledWith(
      "/sorteo/900/33/firmar",
      { type: "D2" },
      { timeout: FIRMA_TIMEOUT_MS },
    );
  });

  it("🔴 firmarLote espera lo que tarda una firma real: 45 s, no los 5 s globales", async () => {
    // La firma real llama a auth-amc (que el backend corta a los 25 s) y, en la orden 3, además
    // aprueba en Asignaciones. Con el techo global de 5 s el navegador abortaría con la firma
    // todavía en curso y el usuario vería el mensaje genérico de tiempo.
    expect(FIRMA_TIMEOUT_MS).toBe(45000);
    await SorteoService.firmarLote(900, 33, undefined, "x");
    expect(mockPatch.mock.calls[0][2]).toEqual({ timeout: 45000 });
  });

  it("firmarLotes (combo) conserva su propio COMBO_FIRMA_TIMEOUT_MS", async () => {
    await SorteoService.firmarLotes([{ amasId: 900, decisorUserId: 33 }]);
    expect(mockPatch.mock.calls[0][2]).toEqual({
      timeout: COMBO_FIRMA_TIMEOUT_MS,
    });
  });

  it("readModoDeFirma devuelve { firmadorHabilitado, sesionCentral } tal cual llega", async () => {
    mockGet.mockResolvedValueOnce({
      data: { firmadorHabilitado: true, sesionCentral: false },
    });
    await expect(SorteoService.readModoDeFirma()).resolves.toEqual({
      firmadorHabilitado: true,
      sesionCentral: false,
    });
    expect(mockGet).toHaveBeenCalledWith("/sorteo/firma/modo");
  });

  it("readModoDeFirma sin sesionCentral no se lo inventa", async () => {
    mockGet.mockResolvedValueOnce({ data: { firmadorHabilitado: false } });
    const modo = await SorteoService.readModoDeFirma();
    expect(modo).toEqual({ firmadorHabilitado: false });
    expect("sesionCentral" in modo).toBe(false);
  });

  it("actaDeLote(900, 33) → GET /sorteo/900/33/acta", async () => {
    await SorteoService.actaDeLote(900, 33);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("/sorteo/900/33/acta");
  });

  it("aceptarCaso(555) → POST /sorteo/555/aceptar con body {}", async () => {
    await SorteoService.aceptarCaso(555);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/sorteo/555/aceptar", {});
  });

  it("REGRESIÓN: con el par completo la URL de firmarLote tiene AMBOS segmentos numéricos y NO un segmento vacío", async () => {
    await SorteoService.firmarLote(900, 33);
    const url = mockPatch.mock.calls[0][0] as string;
    // El segundo segmento es el decisorUserId numérico (par completo), no vacío ni "undefined".
    expect(url).toMatch(/^\/sorteo\/900\/33\/firmar$/);
    // Ningún par de barras consecutivas (segmento faltante) ni el literal de valor no definido.
    expect(url).not.toMatch(/\/\//);
    expect(url).not.toContain("undefined");
  });

  it("REGRESIÓN: con el par completo la URL de actaDeLote tiene AMBOS segmentos numéricos y NO un segmento vacío", async () => {
    await SorteoService.actaDeLote(900, 33);
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/sorteo\/900\/33\/acta$/);
    expect(url).not.toMatch(/\/\//);
    expect(url).not.toContain("undefined");
  });
});

/**
 * CAUSAL + DETALLE de la excusa — punto 4 del acta del 2026-09-11.
 *
 * Lo que se protege aquí es que la causal VIAJE y que el detalle sepa quedarse en casa. El backend
 * declara `causalId` requerido y `reason` con `@IsOptional()`, y `@IsOptional()` de class-validator
 * solo se salta cuando el valor es `undefined` o `null`: un `reason: ""` enviado "por si acaso" SÍ
 * entra a validarse y se guarda como detalle vacío. Por eso el campo no se adjunta cuando no hay
 * detalle, en lugar de adjuntarse en blanco — y por eso hay un test que lo mira.
 */
describe("SorteoService — excusa con causal del catálogo (acta del 2026-09-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("causalesExcusa() → GET /sorteo/causales-excusa", async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ codigo: "parentesco", titulo: "Ser pariente…", orden: 3 }],
    });

    const causales = await SorteoService.causalesExcusa();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("/sorteo/causales-excusa");
    expect(causales).toEqual([
      { codigo: "parentesco", titulo: "Ser pariente…", orden: 3 },
    ]);
  });

  it("excusar(555, causal, escritoHtml, detalle) → POST JSON /sorteo/555/excusa con un OBJETO PLANO", async () => {
    await SorteoService.excusar(
      555,
      "parentesco",
      ESCRITO_HTML,
      "Es mi cuñado.",
    );

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockPost.mock.calls[0] as [string, unknown];
    expect(url).toBe("/sorteo/555/excusa");
    expect(body).not.toBeInstanceOf(FormData);
    expect(body).toEqual({
      causalId: "parentesco",
      reason: "Es mi cuñado.",
      escritoHtml: ESCRITO_HTML,
    });
  });

  it("🔴 excusar() no sobrescribe el Content-Type: su tercer argumento es SOLO el timeout de firma", () => {
    // ── LA GUARDA INVERSA, y por qué sustituye a la prueba del arreglo `89bf440` ────────────────
    // Aquella afirmaba que se mandara `Content-Type: multipart/form-data`, para que el
    // `transformRequest` de axios no convirtiera el FormData a JSON. Con el endpoint en JSON **no
    // hay transporte multipart**: la afirmación se queda sin sujeto, y por eso se RETIRÓ.
    //
    // Lo que se conserva es la LECCIÓN. `httpClient` ya nace con `Content-Type: application/json`
    // (`api/httpClient.ts`), que es exactamente lo que este cuerpo necesita. El fallo posible es el
    // simétrico: que alguien vuelva a colar un `OPCIONES_SUBIDA` "por simetría" con los otros siete
    // multipart del módulo, y con él la cabecera que rompería este POST.
    //
    // ⟳ Fase 03.21 (D-19): la excusa firma el escrito con la clave del decisor y espera a auth-amc,
    // así que ahora SÍ lleva tercer argumento. La guarda se afina en vez de retirarse: ese objeto es
    // EXACTAMENTE `{ timeout }` — sin `headers` — y se pondría roja el día que alguien le añadiera
    // una cabecera.
    void SorteoService.excusar(555, "parentesco", ESCRITO_HTML, "Es mi cuñado.");

    expect(mockPost.mock.calls[0]).toHaveLength(3);
    expect(mockPost.mock.calls[0][2]).toEqual({ timeout: FIRMA_TIMEOUT_MS });
  });

  it("🔴 excusar con clave → la clave viaja en el JSON como signPassword", async () => {
    await SorteoService.excusar(7, "parentesco", "<p>x</p>", "detalle", "clave");

    expect(mockPost).toHaveBeenCalledWith(
      "/sorteo/7/excusa",
      {
        causalId: "parentesco",
        reason: "detalle",
        escritoHtml: "<p>x</p>",
        signPassword: "clave",
      },
      { timeout: 45000 },
    );
  });

  it("🔴 excusar sin clave (o con una en blanco) → el cuerpo NO lleva signPassword", async () => {
    await SorteoService.excusar(7, "parentesco", "<p>x</p>", "detalle");
    expect(
      "signPassword" in (mockPost.mock.calls[0][1] as Record<string, unknown>),
    ).toBe(false);

    vi.clearAllMocks();
    await SorteoService.excusar(7, "parentesco", "<p>x</p>", "detalle", "   ");
    expect(
      "signPassword" in (mockPost.mock.calls[0][1] as Record<string, unknown>),
    ).toBe(false);

    vi.clearAllMocks();
    await SorteoService.excusar(7, "parentesco", "<p>x</p>", undefined, "");
    expect(
      "signPassword" in (mockPost.mock.calls[0][1] as Record<string, unknown>),
    ).toBe(false);
  });

  it("🔴 sin detalle el campo `reason` NO viaja (un blanco no es lo mismo que ausente para @IsOptional)", async () => {
    // El principio se conserva del contrato multipart; cambia el envoltorio. `@IsOptional()` solo se
    // salta con `undefined`/`null`: un `reason: ""` pasaría la validación y quedaría persistido
    // como detalle vacío en la bandeja del director.
    await SorteoService.excusar(555, "parentesco", ESCRITO_HTML);

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect("causalId" in body).toBe(true);
    expect("reason" in body).toBe(false);
  });

  it("un detalle de solo espacios tampoco viaja, y el que viaja va recortado", async () => {
    await SorteoService.excusar(555, "parentesco", ESCRITO_HTML, "   ");
    expect(
      "reason" in (mockPost.mock.calls[0][1] as Record<string, unknown>),
    ).toBe(false);

    vi.clearAllMocks();
    await SorteoService.excusar(555, "parentesco", ESCRITO_HTML, "  cuñado  ");
    expect((mockPost.mock.calls[0][1] as Record<string, unknown>).reason).toBe(
      "cuñado",
    );
  });

  it("🔴 el ESCRITO siempre viaja: es lo que el sistema va a convertir en PDF", async () => {
    await SorteoService.excusar(555, "parentesco", ESCRITO_HTML);

    expect(
      (mockPost.mock.calls[0][1] as Record<string, unknown>).escritoHtml,
    ).toBe(ESCRITO_HTML);
  });
});

describe("vista previa del escrito de excusa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:escrito-excusa");
  });

  it("vistaPreviaEscritoExcusa(555, html) → POST /sorteo/555/excusa/vista-previa como blob y cancelable", async () => {
    mockPost.mockResolvedValue({ data: new Blob(["%PDF"]) });
    const control = new AbortController();

    const url = await SorteoService.vistaPreviaEscritoExcusa(
      555,
      ESCRITO_HTML,
      control.signal,
    );

    expect(mockPost).toHaveBeenCalledWith(
      "/sorteo/555/excusa/vista-previa",
      { escritoHtml: ESCRITO_HTML },
      expect.objectContaining({
        responseType: "blob",
        signal: control.signal,
      }),
    );
    expect(url).toBe("blob:escrito-excusa");
  });

  it("🔴 la vista previa NUNCA lleva la clave: su cuerpo tiene exactamente `escritoHtml` (D-16)", async () => {
    mockPost.mockResolvedValue({ data: new Blob(["%PDF"]) });

    await SorteoService.vistaPreviaEscritoExcusa(7, "<p>x</p>");

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["escritoHtml"]);
  });

  it("🔴 un fallo dice POR QUÉ, aunque el servidor lo mande dentro de un Blob", async () => {
    // Con `responseType: "blob"` el cuerpo del ERROR también llega como Blob, así que el
    // normalizador del httpClient no encuentra el mensaje y cae en un «Request failed with status
    // code 400» que no dice nada. `mensajeDeErrorBlob` lo rescata.
    const cuerpo = new Blob([
      JSON.stringify({
        error: { message: "El escrito que sustenta la excusa está vacío." },
      }),
    ]);
    mockPost.mockRejectedValue(
      Object.assign(new Error("Request failed with status code 400"), {
        isHttpClientError: true,
        originalError: { response: { data: cuerpo } },
      }),
    );

    await expect(
      SorteoService.vistaPreviaEscritoExcusa(555, ESCRITO_HTML),
    ).rejects.toThrow(/está vacío/);
  });

  it("si el cuerpo no se puede leer, NO inventa un motivo", async () => {
    mockPost.mockRejectedValue(
      Object.assign(new Error("Network Error"), {
        isHttpClientError: true,
        originalError: { response: { data: new Blob(["esto no es json"]) } },
      }),
    );

    await expect(
      SorteoService.vistaPreviaEscritoExcusa(555, ESCRITO_HTML),
    ).rejects.toThrow("Network Error");
  });
});

/**
 * EL ESCRITO DE LA EXCUSA EN LA BANDEJA DEL DIRECTOR — pedido del usuario, 2026-09-17.
 *
 * La sección de solicitudes de reasignación dejó de ser desplegable: el motivo se lee de entrada y
 * el escrito se abre con un icono de ojo. Lo que se protege aquí es el contrato del endpoint que
 * alimenta ese ojo — que es un GET, que va por `cass_id` y que NO manda cuerpo.
 */
describe("SorteoService — el escrito de la excusa para el visor del director", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("escritoDeExcusa(900001013) → GET /sorteo/900001013/excusa/escrito, sin cuerpo", async () => {
    mockGet.mockResolvedValueOnce({
      data: { docName: "Escrito de excusa", docUrl: "/api/fileserver/ejecucion/documents/2026/10/x.pdf" },
    });

    const escrito = await SorteoService.escritoDeExcusa(900001013);

    expect(mockGet).toHaveBeenCalledTimes(1);
    // Un solo argumento: es una lectura, no lleva cuerpo ni opciones.
    expect(mockGet.mock.calls[0]).toHaveLength(1);
    expect(mockGet).toHaveBeenCalledWith("/sorteo/900001013/excusa/escrito");
    expect(escrito.docUrl).toBe("/api/fileserver/ejecucion/documents/2026/10/x.pdf");
  });

  it("🔴 el 404 PROPAGA: una excusa sin escrito no es un fallo, y la página lo degrada con un aviso", async () => {
    // Las excusas anteriores al 2026-09-01 se presentaron sin documento. El servicio no lo disfraza
    // devolviendo un objeto vacío —eso dejaría al visor abriendo una URL indefinida—: propaga, y
    // quien llama decide. La página lo convierte en un toast informativo, no en un error.
    mockGet.mockRejectedValueOnce(new Error("Request failed with status code 404"));

    await expect(SorteoService.escritoDeExcusa(900001013)).rejects.toThrow("404");
  });
});

/**
 * LA BANDEJA DEL DECISOR, FILTRADA Y PAGINADA (Fase 03.19, Plan 17, D-09).
 *
 * 🔴 ESTO ES UNA ADUANA, NO UNA PRUEBA DE CONVENIENCIA. `FilterMisAsignadosDto` del backend es una
 * ALLOWLIST bajo un `ValidationPipe` global con `forbidNonWhitelisted: true`: un parámetro que el
 * DTO no declare **no se ignora, se rechaza con 400** — y el mensaje del 400 no dice cuál de los
 * doce filtros lo causó. Por eso se afirma el CONJUNTO EXACTO de claves emitidas y no sólo que
 * estén las que interesan: una clave de más es una bandeja que no carga.
 *
 * Los nombres se transcriben A MANO desde el DTO del backend
 * (`ejecucion-backend/src/modules/ejecucion/sorteo/presentation/dto/filter-mis-asignados.dto.ts`).
 * Derivarlos del propio servicio haría que un error de tecleo se copiara a la prueba.
 */
describe("SorteoService — misAsignados: filtros, paginado y sobre (D-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      data: { data: [], total: 0, limit: 10, offset: 0, page: 1, pages: 0 },
    });
  });

  /** Las claves de query realmente emitidas, en orden de aparición. */
  const clavesEmitidas = (): string[] => {
    const opciones = mockGet.mock.calls[0][1] as { params: URLSearchParams };
    return [...opciones.params.keys()];
  };

  const valorEmitido = (clave: string): string | null => {
    const opciones = mockGet.mock.calls[0][1] as { params: URLSearchParams };
    return opciones.params.get(clave);
  };

  it("sin filtros y sin paginado NO emite ninguna clave: una bandeja sin filtrar no manda blancos", async () => {
    await SorteoService.misAsignados();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe("/sorteo/mis-asignados");
    expect(clavesEmitidas()).toEqual([]);
  });

  it("🔴 con un filtro de texto y un rango de fechas emite EXACTAMENTE los nombres que el DTO declara", async () => {
    await SorteoService.misAsignados({
      pageIndex: 0,
      pageSize: 10,
      filterParams: {
        admiName: "Gabriela",
        expCreatedAtFrom: "2026-09-01",
        expCreatedAtTo: "2026-09-16",
        eejeStatus: ["ASIGNADO_DECISOR", "RECIBIDO"],
      },
    });

    // El conjunto EXACTO. `eejeStatus` sale REPETIDO —es como se manda un array por query— y por eso
    // aparece dos veces en la lista de claves.
    expect(clavesEmitidas()).toEqual([
      "admiName",
      "expCreatedAtFrom",
      "expCreatedAtTo",
      "eejeStatus",
      "eejeStatus",
      "limit",
      "offset",
    ]);
    expect(valorEmitido("admiName")).toBe("Gabriela");
    expect(valorEmitido("expCreatedAtFrom")).toBe("2026-09-01");
  });

  it("🔴 lo vacío se OMITE: un filtro sin valor no es un filtro en blanco, es un filtro que no está", async () => {
    await SorteoService.misAsignados({
      filterParams: { admiName: "", expZone: "   ", eejeStatus: [] },
    });

    expect(clavesEmitidas()).toEqual([]);
  });

  it("traduce el índice y el tamaño de página a límite y desplazamiento", async () => {
    await SorteoService.misAsignados({ pageIndex: 3, pageSize: 20 });

    expect(valorEmitido("limit")).toBe("20");
    // Página 4 (índice 3) de 20 en 20 ⇒ se saltan 60.
    expect(valorEmitido("offset")).toBe("60");
  });

  it("🔴 devuelve el SOBRE entero, no el array: el `limit` APLICADO viaja con él", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [{ eejeId: 183 }],
        total: 120,
        // El backend acota a 100 aunque se le pidan 5.000: quien lea el sobre tiene que poder
        // enterarse, y por eso el servicio no se queda con `data` a secas.
        limit: 100,
        offset: 0,
        page: 1,
        pages: 2,
      },
    });

    const sobre = await SorteoService.misAsignados({ pageSize: 5000 });

    expect(sobre.total).toBe(120);
    expect(sobre.limit).toBe(100);
    expect(sobre.data).toHaveLength(1);
  });
});
