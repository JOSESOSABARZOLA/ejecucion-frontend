/**
 * Microservicio: ejecucion
 * Módulo: Alertas
 * Feature: Contrato HTTP de la campana y de Avisos (quick 261030-m29)
 * Archivo: AlertService.test.ts
 * Responsabilidad: Fijar que el listado de Avisos YA NO inventa avisos cuando el servidor falla
 *   (antes caía a datos simulados y el usuario veía alertas que no tenía), y las tres rutas que usa
 *   la campana.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-30
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import httpClient from "../api/httpClient";
import { AlertService } from "./AlertService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPut = httpClient.put as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AlertService.getAllAlerts", () => {
  it("con error del servidor RELANZA, sin datos simulados", async () => {
    const error = new Error("500");
    mockGet.mockRejectedValue(error);

    await expect(AlertService.getAllAlerts(0, 10)).rejects.toBe(error);
  });

  it("pide la página con limit/offset y solo los filtros con valor", async () => {
    const sobre = { data: [], total: 0, limit: 10, offset: 20, page: 3, pages: 0 };
    mockGet.mockResolvedValue({ data: sobre });

    const respuesta = await AlertService.getAllAlerts(2, 10, {
      aresTipo: "orden_pago.plazo_vencido",
      vacio: "",
      nulo: null,
    });

    expect(respuesta).toBe(sobre);
    expect(mockGet).toHaveBeenCalledWith(
      "/alert/listByUser?limit=10&offset=20&aresTipo=orden_pago.plazo_vencido",
    );
  });
});

describe("AlertService — campana", () => {
  it("getUnreadAlerts pide las no leídas del usuario de la sesión", async () => {
    mockGet.mockResolvedValue({ data: { alerts: [], totalAlerts: 0 } });

    await AlertService.getUnreadAlerts();

    expect(mockGet).toHaveBeenCalledWith("/alert/unread");
  });

  it("markAsRead usa PUT /alert/:ualeId/read", async () => {
    mockPut.mockResolvedValue({ data: undefined });

    await AlertService.markAsRead(42);

    expect(mockPut).toHaveBeenCalledWith("/alert/42/read", {});
  });
});
