/**
 * Microservicio: ejecucion
 * Módulo: Expediente (compartido)
 * Feature: Documentos nuevos sin leer, por usuario (quick 261030-m29)
 * Archivo: DocumentosLecturaService.test.ts
 * Responsabilidad: Fijar el contrato REAL del backend que este servicio adapta: el conteo llega como
 *   ARREGLO y sale como mapa, de 100 en 100 ids y sin salir a la red si no hay ids válidos; las
 *   marcas van por PUT a su ruta, con el docId externo codificado.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-04
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api/httpClient", () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

import httpClient from "../api/httpClient";
import {
  DocumentosLecturaService,
  MAX_EPAS_POR_CONTEO,
} from "./DocumentosLecturaService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPut = httpClient.put as unknown as ReturnType<typeof vi.fn>;

describe("DocumentosLecturaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPut.mockResolvedValue({ status: 204, data: "" });
  });

  it("noLeidosDelEpas pide la ruta del EPAS y devuelve el cuerpo", async () => {
    const cuerpo = { eejeId: 7, propios: [12], externos: [], total: 1 };
    mockGet.mockResolvedValue({ data: cuerpo });
    await expect(DocumentosLecturaService.noLeidosDelEpas(7)).resolves.toEqual(cuerpo);
    expect(mockGet).toHaveBeenCalledWith("/documentos-lectura/epas/7");
  });

  it("contar convierte el ARREGLO del backend en mapa", async () => {
    mockGet.mockResolvedValue({
      data: [
        { eejeId: 5, noLeidos: 3 },
        { eejeId: 6, noLeidos: 0 },
      ],
    });
    await expect(DocumentosLecturaService.contar([5, 6])).resolves.toEqual({ 5: 3, 6: 0 });
    expect(mockGet).toHaveBeenCalledWith("/documentos-lectura/no-leidos", {
      params: { eejeIds: "5,6" },
    });
  });

  it("sin ids válidos no sale a la red; descarta repetidos y no enteros positivos", async () => {
    await expect(DocumentosLecturaService.contar([])).resolves.toEqual({});
    await expect(DocumentosLecturaService.contar([0, -1, 1.5])).resolves.toEqual({});
    expect(mockGet).not.toHaveBeenCalled();

    mockGet.mockResolvedValue({ data: [] });
    await DocumentosLecturaService.contar([3, 3, 0, 4]);
    expect(mockGet).toHaveBeenCalledWith("/documentos-lectura/no-leidos", {
      params: { eejeIds: "3,4" },
    });
  });

  it("trocea de 100 en 100 y junta las respuestas", async () => {
    const ids = Array.from({ length: MAX_EPAS_POR_CONTEO + 5 }, (_, i) => i + 1);
    mockGet.mockImplementation(async (_url: string, config: { params: { eejeIds: string } }) => ({
      data: config.params.eejeIds
        .split(",")
        .map((id) => ({ eejeId: Number(id), noLeidos: 1 })),
    }));

    const mapa = await DocumentosLecturaService.contar(ids);

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[0][1].params.eejeIds.split(",")).toHaveLength(100);
    expect(mockGet.mock.calls[1][1].params.eejeIds).toBe("101,102,103,104,105");
    expect(Object.keys(mapa)).toHaveLength(105);
  });

  it("el fallo del conteo se propaga (quien llama decide que no pasa nada)", async () => {
    mockGet.mockRejectedValue(new Error("500"));
    await expect(DocumentosLecturaService.contar([1])).rejects.toThrow("500");
  });

  it("marcarPropio y marcarExterno van por PUT; el docId externo viaja codificado", async () => {
    await DocumentosLecturaService.marcarPropio(7, 12);
    await DocumentosLecturaService.marcarExterno(7, "dmit", "doc/42 a");

    expect(mockPut).toHaveBeenCalledWith("/documentos-lectura/epas/7/propios/12");
    expect(mockPut).toHaveBeenCalledWith(
      "/documentos-lectura/epas/7/externos/dmit/doc%2F42%20a",
    );
  });
});
