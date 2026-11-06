/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/multas-compulsorias (frontend)
 * Feature: Historial de multas compulsorias del expediente (2026-09-03)
 * Archivo: MultaCompulsoriaService.test.ts
 * Responsabilidad: Bloquear el contrato HTTP. Lo que se fija aquí es que el registro viaje como
 *   MULTIPART con su timeout propio —el global de 5 s aborta la subida de un escaneo a medias, y el
 *   backend habría creado ya la multa— y que el ORDINAL no viaje: lo pone el servidor.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-03
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { mcomId: 11 } }),
  },
}));

import httpClient from "../api/httpClient";
import {
  MultaCompulsoriaService,
  SUBIDA_TIMEOUT_MS,
} from "./MultaCompulsoriaService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = httpClient.post as unknown as ReturnType<typeof vi.fn>;

describe("MultaCompulsoriaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serie() → GET /multas-compulsorias/:eejeId", async () => {
    await MultaCompulsoriaService.serie(42);

    expect(mockGet).toHaveBeenCalledWith("/multas-compulsorias/42");
  });

  it("registrar() manda multipart con el PDF y su timeout propio", async () => {
    const pdf = new File(["x"], "resolucion.pdf", {
      type: "application/pdf",
    });

    await MultaCompulsoriaService.registrar(
      42,
      {
        resolucionNumero: "GADDMQ-AMC-DME-2024-013",
        resolucionFecha: "2024-05-07",
        valor: 1840,
      },
      pdf,
    );

    const [url, cuerpo, opciones] = mockPost.mock.calls[0] as [
      string,
      FormData,
      { headers: Record<string, string>; timeout: number },
    ];

    expect(url).toBe("/multas-compulsorias/42");
    expect(cuerpo).toBeInstanceOf(FormData);
    expect(cuerpo.get("resolucionNumero")).toBe("GADDMQ-AMC-DME-2024-013");
    expect(cuerpo.get("resolucionFecha")).toBe("2024-05-07");
    expect(cuerpo.get("valor")).toBe("1840");
    expect(cuerpo.get("file")).toBeInstanceOf(File);
    expect(opciones.timeout).toBe(SUBIDA_TIMEOUT_MS);
  });

  it("🔴 el ORDINAL no viaja: lo deriva el servidor del orden de la serie", async () => {
    // Si la pantalla lo mandara, un día diría «3.ª» sobre lo que la providencia imprime como
    // «segunda» — y el documento notificado es el que manda.
    const pdf = new File(["x"], "resolucion.pdf", {
      type: "application/pdf",
    });

    await MultaCompulsoriaService.registrar(
      42,
      {
        resolucionNumero: "GADDMQ-AMC-DME-2024-013",
        resolucionFecha: "2024-05-07",
        valor: 1840,
      },
      pdf,
    );

    const [, cuerpo] = mockPost.mock.calls[0] as [string, FormData];
    expect(cuerpo.get("ordinal")).toBeNull();
  });
});
