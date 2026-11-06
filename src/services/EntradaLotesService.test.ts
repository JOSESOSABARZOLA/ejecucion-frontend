/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Unidades puras de URL shapes del EntradaLotesService (D-06/D-10) — Fase 3.8
 * Archivo: EntradaLotesService.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES el contrato HTTP de EntradaLotesService contra
 *   el backend 3.6: por cada uno de los 5 métodos, verificar el VERBO, el PATH y el BODY con los que se
 *   llama a httpClient (mockeado). El test FALLA si un path o un body cambia — en particular si algún
 *   método filtrara el actor/rol al body (prohibido: el backend lo deriva del JWT). No monta React ni
 *   hace red real: mockea api/httpClient y ejerce solo las URL shapes.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 12): el filtro de MATERIA (`materiaCod`,
 *   código del diccionario) viaja como query param y se omite cuando está vacío.
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1): el filtro de materia viaja como
 *   `materiaId` (id de Sorteo).
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 07, D-09/D-13): fuera las pruebas de
 *   la sincronización manual (el POST de sync ya no existe) y dentro la del GET que lee el estado
 *   de la sincronización automática.
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 14, D-16/D-24): el despacho lleva la
 *   clave de firma del director como `signPassword` del cuerpo, solo si la hay.
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock del cliente HTTP centralizado: solo capturamos verbo/path/body, sin red real.
vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn(async () => ({ data: [] })),
    post: vi.fn(async () => ({ data: {} })),
    patch: vi.fn(async () => ({ data: {} })),
  },
}));

import httpClient from "../api/httpClient";
import { EntradaLotesService, GENERAR_TIMEOUT_MS } from "./EntradaLotesService";
import { FIRMA_TIMEOUT_MS } from "./SorteoService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = httpClient.post as unknown as ReturnType<typeof vi.fn>;
const mockPatch = httpClient.patch as unknown as ReturnType<typeof vi.fn>;

describe("EntradaLotesService (URL shapes — D-06/D-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bandejaDirector() sin filtros → GET /entrada-lotes/bandeja-director con params vacíos", async () => {
    await EntradaLotesService.bandejaDirector();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/bandeja-director", {
      params: {},
    });
  });

  it("bandejaSecretario() sin filtros → GET /entrada-lotes/bandeja-secretario con params vacíos", async () => {
    await EntradaLotesService.bandejaSecretario();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/bandeja-secretario", {
      params: {},
    });
  });

  it("estadoSincronizacion() → GET /entrada-lotes/sincronizacion y devuelve el estado tal cual (Fase 03.24, D-13)", async () => {
    const estado = { habilitada: true, resultado: "CORRECTA" };
    mockGet.mockResolvedValueOnce({ data: estado });
    const res = await EntradaLotesService.estadoSincronizacion();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/sincronizacion");
    expect(res).toBe(estado);
  });

  it("🔴 el servicio YA NO sabe sincronizar a mano: la sincronización es automática (Fase 03.24, D-09)", () => {
    expect("sync" in EntradaLotesService).toBe(false);
  });

  it("approveDirector(envlId) → PATCH /entrada-lotes/:id/approve-director con body {}", async () => {
    await EntradaLotesService.approveDirector(42);
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      "/entrada-lotes/42/approve-director",
      {},
    );
  });

  it("aprobarEnviarSorteo(envlId) → PATCH /entrada-lotes/:id/aprobar-enviar-sorteo con body {}", async () => {
    await EntradaLotesService.aprobarEnviarSorteo(99);
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      "/entrada-lotes/99/aprobar-enviar-sorteo",
      {},
    );
  });

  it("bandejaSalida() sin filtros → GET /entrada-lotes/bandeja-salida con params vacíos", async () => {
    await EntradaLotesService.bandejaSalida();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/bandeja-salida", {
      params: {},
    });
  });

  it("enviarSg(envlId) → PATCH /entrada-lotes/:id/enviar-sg con body {}", async () => {
    await EntradaLotesService.enviarSg(7);
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith("/entrada-lotes/7/enviar-sg", {});
  });

  it("generarLotesDePrueba() → POST /entrada-lotes/dev/generar con body {} y timeout propio", async () => {
    await EntradaLotesService.generarLotesDePrueba();
    expect(mockPost).toHaveBeenCalledTimes(1);
    // El timeout propio NO es decoración: con los 5 s globales el navegador aborta una siembra
    // de ~60-90 casos que el backend sí termina, y el usuario ve un error que no existió.
    expect(mockPost).toHaveBeenCalledWith(
      "/entrada-lotes/dev/generar",
      {},
      {
        timeout: GENERAR_TIMEOUT_MS,
      },
    );
  });

  it("purgarLotesDePrueba() → PATCH /entrada-lotes/dev/purge con body {}", async () => {
    await EntradaLotesService.purgarLotesDePrueba();
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith("/entrada-lotes/dev/purge", {});
  });

  it("NINGÚN método pone actor/rol en el body (anti-Spoofing T-03.8-09 / T-03.9-02)", async () => {
    await EntradaLotesService.approveDirector(1);
    await EntradaLotesService.aprobarEnviarSorteo(2);
    await EntradaLotesService.enviarSg(5);

    const bodies = [
      ...mockPost.mock.calls.map((c) => c[1]),
      ...mockPatch.mock.calls.map((c) => c[1]),
    ];
    for (const body of bodies) {
      const keys = Object.keys((body ?? {}) as Record<string, unknown>);
      // Cuerpo vacío: nunca actor/rol/userId/approvedBy.
      expect(keys).not.toContain("actor");
      expect(keys).not.toContain("rol");
      expect(keys).not.toContain("rolName");
      expect(keys).not.toContain("userId");
      expect(keys).not.toContain("approvedBy");
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// FILTROS + PAGINADO de las bandejas (reunión del 2026-09-16, puntos 1, 3 y 7)
// ───────────────────────────────────────────────────────────────────────────────────────────────

describe("EntradaLotesService — filtros y paginado de las bandejas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("manda cada filtro como query param, con el nombre que el DTO del backend declara", async () => {
    await EntradaLotesService.bandejaDirector({
      search: "Gabriela",
      fechaDesde: "2026-09-01",
      fechaHasta: "2026-09-16",
      limit: 20,
      offset: 40,
    });

    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/bandeja-director", {
      params: {
        search: "Gabriela",
        fechaDesde: "2026-09-01",
        fechaHasta: "2026-09-16",
        limit: "20",
        offset: "40",
      },
    });
  });

  it("🔴 OMITE los filtros vacíos en vez de mandarlos en blanco", async () => {
    // El ValidationPipe del backend corre con whitelist + forbidNonWhitelisted, y además
    // `fechaDesde: ""` fallaría el @Matches del DTO: la bandeja respondería 400 por un campo que el
    // usuario nunca rellenó. Un filtro sin valor no es un filtro vacío, es un filtro que no está.
    await EntradaLotesService.bandejaDirector({
      search: "   ",
      fechaDesde: "",
      fechaHasta: "",
    });

    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/bandeja-director", {
      params: {},
    });
  });

  it("recorta los espacios del buscador: nadie busca «  Gabriela  »", async () => {
    await EntradaLotesService.bandejaSecretario({ search: "  Gabriela  " });

    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/bandeja-secretario", {
      params: { search: "Gabriela" },
    });
  });

  it("quick 261104-jh1: la MATERIA viaja como `materiaId`, con el id de Sorteo", async () => {
    await EntradaLotesService.bandejaSecretario({ materiaId: "26" });

    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/bandeja-secretario", {
      params: { materiaId: "26" },
    });
  });

  it("Fase 03.23 (D-16): una materia vacía («Todas») NO viaja: en blanco fallaría el @Matches del DTO", async () => {
    await EntradaLotesService.bandejaDirector({ materiaId: "" });

    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/bandeja-director", {
      params: {},
    });
  });

  it("un offset de 0 SÍ viaja: es la primera página pedida explícitamente, no un filtro ausente", async () => {
    await EntradaLotesService.bandejaDirector({ limit: 10, offset: 0 });

    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/bandeja-director", {
      params: { limit: "10", offset: "0" },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// BANDEJA DE SALIDA por EXPEDIENTE (encargo del 2026-09-17): las dos pestañas y su despacho.
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe("EntradaLotesService — Bandeja de Salida por expediente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pendientesSalida('SG') → GET /entrada-lotes/salida/pendientes con el destino en los params", async () => {
    await EntradaLotesService.pendientesSalida("SG");

    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/salida/pendientes", {
      params: { destino: "SG" },
    });
  });

  it("🔴 el DESTINO viaja SIEMPRE: es lo único que distingue una pestaña de la otra, y sin él el backend responde 400", async () => {
    await EntradaLotesService.pendientesSalida("DMR");

    const params = mockGet.mock.calls[0][1].params;
    expect(params.destino).toBe("DMR");
  });

  it("los filtros de la bandeja acompañan al destino (buscador, rango y paginado), ya casteados a query", async () => {
    await EntradaLotesService.pendientesSalida("DMR", {
      search: "Díaz",
      fechaDesde: "2026-09-01",
      limit: 10,
      offset: 20,
    });

    expect(mockGet).toHaveBeenCalledWith("/entrada-lotes/salida/pendientes", {
      params: {
        search: "Díaz",
        fechaDesde: "2026-09-01",
        limit: "10",
        offset: "20",
        destino: "DMR",
      },
    });
  });

  it("despacharSalida → POST /entrada-lotes/salida/despachar con los expedientes en el CUERPO y el destino en la QUERY", async () => {
    await EntradaLotesService.despacharSalida("SG", [7, 8]);

    expect(mockPost).toHaveBeenCalledWith(
      "/entrada-lotes/salida/despachar",
      { eejeIds: [7, 8] },
      { params: { destino: "SG" }, timeout: FIRMA_TIMEOUT_MS },
    );
  });

  it("🔴 el cuerpo NO lleva actor ni rol: el backend los deriva del JWT y aceptarlos aquí sería suplantación", async () => {
    await EntradaLotesService.despacharSalida("DMR", [7]);

    const body = mockPost.mock.calls[0][1];
    expect(Object.keys(body)).toEqual(["eejeIds"]);
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("roles");
  });

  it("🔴 usa el timeout de la firma: largo para treinta EPAS en fila, pero POR DEBAJO de los 60 s del nginx (revisión 03.21, WR-08)", async () => {
    await EntradaLotesService.despacharSalida("SG", [1, 2, 3]);
    await EntradaLotesService.despacharSalida("DMR", [4], "clave-ficticia");

    for (const llamada of mockPost.mock.calls) {
      const timeout = llamada[2].timeout as number;
      expect(timeout).toBe(FIRMA_TIMEOUT_MS);
      // Los 5 s por defecto abortarían a medias…
      expect(timeout).toBeGreaterThan(5_000);
      // …y por encima de 60 s el corte lo daría nginx con un 504 opaco, no el navegador.
      expect(timeout).toBeLessThan(60_000);
      // Y por encima de los 25 s con que el backend corta a auth-amc: el fallo del firmador llega.
      expect(timeout).toBeGreaterThan(25_000);
    }
  });

  // Fase 03.21 (D-16, D-24): el memorando de devolución se firma con la clave del DIRECTOR en el
  // mismo acto de despachar. La clave viaja en el cuerpo y solo si la hay. Valor ficticio.
  it("con la clave de firma, el cuerpo lleva `signPassword` junto a los expedientes", async () => {
    await EntradaLotesService.despacharSalida("DMR", [1, 2], "clave-ficticia");

    expect(mockPost).toHaveBeenCalledWith(
      "/entrada-lotes/salida/despachar",
      { eejeIds: [1, 2], signPassword: "clave-ficticia" },
      { params: { destino: "DMR" }, timeout: FIRMA_TIMEOUT_MS },
    );
  });

  it("🔴 una clave ausente o en blanco NO viaja: el cuerpo es solo `{ eejeIds }`", async () => {
    await EntradaLotesService.despacharSalida("DMIT", [3]);
    await EntradaLotesService.despacharSalida("DMIT", [3], "   ");

    expect(mockPost.mock.calls[0][1]).toEqual({ eejeIds: [3] });
    expect(mockPost.mock.calls[1][1]).toEqual({ eejeIds: [3] });
    expect(Object.keys(mockPost.mock.calls[1][1])).toEqual(["eejeIds"]);
  });

  it("🔴 la clave va en el CUERPO, nunca en la query", async () => {
    await EntradaLotesService.despacharSalida("DMR", [1], "clave-ficticia");

    expect(JSON.stringify(mockPost.mock.calls[0][2])).not.toContain(
      "clave-ficticia",
    );
  });
});
