/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/plantillas (frontend)
 * Feature: Lectura de plantillas de documento (Quick 260916-kwg, D-05)
 * Archivo: PlantillaService.test.ts
 * Responsabilidad: Fijar la forma de la URL de `GET /plantillas/:clave` y —lo que más importa— que
 *   un fallo del catálogo PROPAGUE en vez de tragarse.
 *
 *   ── POR QUÉ EL ERROR DEBE PROPAGAR AQUÍ ──────────────────────────────────────────────────────
 *   Porque quien decide qué hacer cuando no hay plantilla es el MODAL, no el servicio. Y lo que hace
 *   el modal es deliberado y distinto de lo que hace con las causales: avisa, abre el editor en
 *   blanco y **deja enviar igual**. Si este servicio devolviera `null` en silencio, el modal no
 *   podría distinguir «la plantilla está vacía a propósito» de «el backend no respondió», y el
 *   decisor se quedaría delante de un editor en blanco sin saber cuál de las dos cosas pasó.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-16
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn(async () => ({ data: {} })),
  },
}));

import httpClient from "../api/httpClient";
import { PlantillaService } from "./PlantillaService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;

const PLANTILLA = {
  clave: "ESCRITO_EXCUSA",
  nombre: "Escrito con que el funcionario decisor sustenta su excusa",
  html: "<p>Quito D.M., {Fecha}</p>",
  activo: true,
};

describe("PlantillaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leer('ESCRITO_EXCUSA') → GET /plantillas/ESCRITO_EXCUSA y devuelve la plantilla", async () => {
    mockGet.mockResolvedValueOnce({ data: PLANTILLA });

    await expect(PlantillaService.leer("ESCRITO_EXCUSA")).resolves.toEqual(
      PLANTILLA,
    );
    expect(mockGet).toHaveBeenCalledWith("/plantillas/ESCRITO_EXCUSA");
  });

  it("🔴 `html: null` se devuelve TAL CUAL: es «el editor arranca en blanco», no un fallo", async () => {
    // Es la promesa escrita en el COMMENT de `plan_html`. Convertirlo aquí en cadena vacía o en un
    // error borraría una distinción que el backend se molesta en mantener.
    mockGet.mockResolvedValueOnce({ data: { ...PLANTILLA, html: null } });

    const plantilla = await PlantillaService.leer("ESCRITO_EXCUSA");

    expect(plantilla.html).toBeNull();
  });

  it("🔴 un 404 PROPAGA: quien decide qué hacer sin plantilla es el modal, no el servicio", async () => {
    mockGet.mockRejectedValueOnce(
      new Error('La plantilla "ESCRITO_EXCUSA" no existe o no está vigente.'),
    );

    await expect(PlantillaService.leer("ESCRITO_EXCUSA")).rejects.toThrow(
      /no existe o no está vigente/,
    );
  });

  it("la clave viaja en la RUTA, no como query", async () => {
    mockGet.mockResolvedValueOnce({ data: PLANTILLA });

    await PlantillaService.leer("PROVIDENCIA_EXCUSA");

    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toBe("/plantillas/PROVIDENCIA_EXCUSA");
    expect(url).not.toContain("?");
    expect(url).not.toContain("undefined");
  });
});
