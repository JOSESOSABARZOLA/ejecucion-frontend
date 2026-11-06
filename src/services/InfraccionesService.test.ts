/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend) — tests
 * Feature: Contrato HTTP del servicio de infracciones (Fase 03.23, Plan 11, D-17)
 * Archivo: InfraccionesService.test.ts
 * Responsabilidad: Fijar las lecturas del servicio —materias de Sorteo (`GET /infracciones/materias`),
 *   catálogo de CORE (`GET /infracciones/catalogo`, solo con los parámetros presentes) y la ficha de
 *   `GET /epas/:eejeId/infracciones`— por `httpClient` y devolviendo el cuerpo TAL CUAL, y que el
 *   copy de los estados de la lectura de CORE vive en un solo sitio y no repite redacción.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-16
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: fuera el diccionario; casos de
 *   `materias()` y `catalogo()`; la ficha con ids y nombres de Sorteo y «Sin materia»)
 * Modificado por: Andrés Miño — 2026-11-06 (quick 261106-bo0: la infracción de la ficha lleva la base
 *   legal)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn(),
  },
}));

import httpClient from "../api/httpClient";
import {
  ETIQUETA_ESTADO_CORE,
  InfraccionesService,
  type CatalogoMateriasRespuesta,
  type PaginaCatalogoInfracciones,
  type EstadoLecturaCore,
  type FichaInfracciones,
} from "./InfraccionesService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;

const MATERIAS: CatalogoMateriasRespuesta = {
  disponible: true,
  origen: "SIMULADO",
  materias: [
    { id: 22, nombre: "AMBIENTE" },
    { id: 26, nombre: "LICENCIAMIENTO" },
  ],
  submaterias: [{ id: 54, materiaId: 26, nombre: "LUAE" }],
};

const PAGINA: PaginaCatalogoInfracciones = {
  disponible: true,
  origen: "CORE",
  items: [
    {
      codigo: "LIC-LU-X-124-1947A-02",
      infraccion: "Texto",
      sancion: "4 RBU",
      categoria: null,
      norma: null,
      materiaId: 26,
      submateriaId: 54,
      materia: "LICENCIAMIENTO",
      submateria: "LUAE",
      sinMateria: false,
    },
  ],
  pagina: 1,
  tamanoPagina: 20,
  total: 1,
  totalPaginas: 1,
};

const FICHA: FichaInfracciones = {
  eejeId: 7,
  estadoCore: "LEIDO",
  coreLeidoAt: "2026-10-16T12:00:00.000Z",
  coreDisponible: true,
  materia: "LICENCIAMIENTO",
  submaterias: ["LUAE"],
  infraccionesSinMateria: 0,
  tipoPersona: "NATURAL",
  avisoIdentificacion: null,
  multaTotal: 470,
  sumaMultas: 470,
  infracciones: [
    {
      codigo: "LIC-LU-X-124-1947A-02",
      materia: "LICENCIAMIENTO",
      submateria: "LUAE",
      materiaId: 26,
      submateriaId: 54,
      sinMateria: false,
      sancion: "Multa",
      multa: 470,
      enResolucion: true,
      enCore: true,
      admiteTc: true,
      motivoNoAdmite: null,
      obligacionHacer: null,
      articulo: null,
      literal: null,
      subliteral: null,
      numeral: null,
      tipificacion: null,
    },
  ],
  evaluacionTc: { estado: "APTA", motivos: [], multaConmutable: 470 },
  alertas: [],
  avisoCoreCambio: null,
};

describe("InfraccionesService.materias (quick 261104-jh1)", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("lee GET /infracciones/materias por httpClient y devuelve el cuerpo tal cual", async () => {
    mockGet.mockResolvedValue({ data: MATERIAS });

    const materias = await InfraccionesService.materias();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("/infracciones/materias");
    expect(materias).toEqual(MATERIAS);
  });

  it("si la petición falla, el error se propaga (el consumidor decide qué pintar)", async () => {
    mockGet.mockRejectedValue(new Error("caída"));

    await expect(InfraccionesService.materias()).rejects.toThrow("caída");
  });

  it("el diccionario retirado ya no existe en el servicio", () => {
    expect("diccionario" in InfraccionesService).toBe(false);
  });
});

describe("InfraccionesService.catalogo (quick 261104-jh1)", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: PAGINA });
  });

  it("lee GET /infracciones/catalogo con todos los parámetros presentes", async () => {
    const pagina = await InfraccionesService.catalogo({
      search: "lic",
      materiaId: 26,
      submateriaId: 54,
      page: 2,
      pageSize: 20,
    });

    expect(mockGet).toHaveBeenCalledWith("/infracciones/catalogo", {
      params: {
        search: "lic",
        materiaId: 26,
        submateriaId: 54,
        page: 2,
        pageSize: 20,
      },
    });
    expect(pagina).toEqual(PAGINA);
  });

  it("omite los parámetros ausentes o vacíos", async () => {
    await InfraccionesService.catalogo({
      search: "",
      materiaId: undefined,
      page: 1,
    });

    expect(mockGet).toHaveBeenCalledWith("/infracciones/catalogo", {
      params: { page: 1 },
    });
  });
});

describe("InfraccionesService.ficha (Plan 05)", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("lee GET /epas/7/infracciones y devuelve la FichaInfracciones tal cual", async () => {
    mockGet.mockResolvedValue({ data: FICHA });

    const ficha = await InfraccionesService.ficha(7);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("/epas/7/infracciones");
    expect(ficha).toEqual(FICHA);
  });
});

describe("ETIQUETA_ESTADO_CORE: el copy de la lectura de CORE en un solo sitio", () => {
  const ESTADOS: EstadoLecturaCore[] = [
    "PENDIENTE",
    "LEIDO",
    "SIN_CASO",
    "NO_ENCONTRADO",
    "DEMO",
  ];

  it("cada estado tiene su etiqueta y ninguna se repite", () => {
    const etiquetas = ESTADOS.map((estado) => ETIQUETA_ESTADO_CORE[estado]);
    for (const etiqueta of etiquetas) {
      expect(etiqueta).toBeTruthy();
    }
    expect(new Set(etiquetas).size).toBe(ESTADOS.length);
  });

  it("dice la redacción acordada", () => {
    expect(ETIQUETA_ESTADO_CORE).toEqual({
      PENDIENTE: "Pendiente de lectura",
      LEIDO: "Infracciones leídas",
      SIN_CASO: "Sin caso enlazado",
      NO_ENCONTRADO: "Caso no encontrado",
      DEMO: "Datos de demostración",
    });
  });
});
