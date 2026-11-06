/**
 * Microservicio: ejecucion
 * Módulo: EPAS (frontend) — tests
 * Archivo: EpasService.descarga.test.ts
 * Responsabilidad: Blindar las tres cosas de la descarga del expediente que, si se rompen, no dan
 *   la cara como un fallo sino como algo peor: una descarga que parece funcionar.
 *
 *   1. Que la petición lleve su PROPIO timeout. El global de `httpClient` es de 5 s; comprimir N
 *      PDFs escaneados lo rebasa, y el navegador abortaría una descarga que el backend sirve bien.
 *   2. Que un rechazo diga POR QUÉ. El backend se niega con una razón —«no tiene acta de sorteo
 *      definitiva»— y ese cuerpo llega como Blob, así que sin rescatarlo el usuario vería un
 *      «Request failed with status code 400» que no explica nada ni sugiere qué hacer.
 *   3. Que el nombre salga de `Content-Disposition`, que es el único sitio donde el servidor lo
 *      dice, y que su ausencia no deje al fichero sin nombre.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-25
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../api/httpClient", () => ({
  default: { get: mocks.get },
}));

import EpasService, { DESCARGA_EXPEDIENTE_TIMEOUT_MS } from "./EpasService";

// ⟳ 2026-09-29 (quick 260929-kfg): el paquete es UN PDF foliado, ya no un ZIP de piezas.
const pdf = new Blob(["%PDF-1.7"]);

describe("descarga del expediente", () => {
  beforeEach(() => mocks.get.mockReset());

  it("🔴 la petición lleva su propio timeout: con los 5 s globales un expediente grande se aborta a medias", async () => {
    mocks.get.mockResolvedValue({ data: pdf, headers: {} });

    await EpasService.descargarExpediente(42);

    expect(mocks.get).toHaveBeenCalledWith("/epas/42/expediente/descargar", {
      responseType: "blob",
      timeout: DESCARGA_EXPEDIENTE_TIMEOUT_MS,
    });
    expect(DESCARGA_EXPEDIENTE_TIMEOUT_MS).toBeGreaterThan(5000);
  });

  it("toma el nombre del fichero de Content-Disposition", async () => {
    mocks.get.mockResolvedValue({
      data: pdf,
      headers: {
        "content-disposition":
          'attachment; filename="expediente-42-20260825.pdf"',
      },
    });

    const { blob, nombreArchivo } = await EpasService.descargarExpediente(42);

    expect(blob).toBe(pdf);
    expect(nombreArchivo).toBe("expediente-42-20260825.pdf");
  });

  it("acepta el nombre sin comillas", async () => {
    mocks.get.mockResolvedValue({
      data: pdf,
      headers: { "content-disposition": "attachment; filename=expediente-7.pdf" },
    });

    const { nombreArchivo } = await EpasService.descargarExpediente(7);

    expect(nombreArchivo).toBe("expediente-7.pdf");
  });

  it("sin la cabecera cae a un nombre derivado del id: mejor un nombre pobre que ninguno", async () => {
    mocks.get.mockResolvedValue({ data: pdf, headers: {} });

    const { nombreArchivo } = await EpasService.descargarExpediente(9);

    expect(nombreArchivo).toBe("expediente-9.pdf");
  });

  it("🔴 el rechazo del backend llega ENTERO al usuario, aunque venga dentro de un Blob", async () => {
    const cuerpo = new Blob([
      JSON.stringify({
        message:
          "El EPAS 198 no tiene acta de sorteo definitiva: su sorteo aún no se ha cerrado con firma.",
      }),
    ]);
    mocks.get.mockRejectedValueOnce(
      Object.assign(new Error("Request failed with status code 400"), {
        isHttpClientError: true,
        originalError: { response: { data: cuerpo } },
      }),
    );

    await expect(EpasService.descargarExpediente(198)).rejects.toThrow(
      /no tiene acta de sorteo definitiva/,
    );
  });

  it("un error ilegible no inventa una causa", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Network Error"));

    await expect(EpasService.descargarExpediente(1)).rejects.toThrow(
      "Network Error",
    );
  });
});
