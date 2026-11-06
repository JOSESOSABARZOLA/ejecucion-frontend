/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/ordenes-pago (frontend)
 * Feature: Bandeja de órdenes de pago (2026-09-03)
 * Archivo: OrdenPagoService.test.ts
 * Responsabilidad: Bloquear el contrato HTTP del servicio. Lo que se prueba aquí no es "que llame":
 *   es que los filtros VACÍOS no viajen (un `q=` vacío filtraría por la cadena vacía en vez de por
 *   "sin filtro", y la bandeja saldría vacía sin decir por qué) y que el actor NUNCA vaya en el
 *   cuerpo — lo deriva el backend del JWT.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-03
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

import httpClient from "../api/httpClient";
import { OrdenPagoService } from "./OrdenPagoService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = httpClient.post as unknown as ReturnType<typeof vi.fn>;
const mockPatch = httpClient.patch as unknown as ReturnType<typeof vi.fn>;

describe("OrdenPagoService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("bandeja()", () => {
    it("manda campo, estado y paginación en la query", async () => {
      await OrdenPagoService.bandeja({
        campo: "EXPEDIENTE",
        q: "1361",
        estado: "PENDIENTE",
        pagina: 2,
        limite: 25,
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/ordenes-pago/bandeja?campo=EXPEDIENTE&q=1361&estado=PENDIENTE&pagina=2&limite=25",
      );
    });

    it("🔴 un término en blanco NO viaja: filtraría por la cadena vacía", async () => {
      await OrdenPagoService.bandeja({ campo: "TODOS", q: "   " });

      expect(mockGet).toHaveBeenCalledWith("/ordenes-pago/bandeja?campo=TODOS");
    });

    it("recorta el término: «58431366 » y «58431366» son la misma búsqueda", async () => {
      await OrdenPagoService.bandeja({ q: " 58431366 " });

      expect(mockGet).toHaveBeenCalledWith("/ordenes-pago/bandeja?q=58431366");
    });
  });

  describe("registrar()", () => {
    it("POST /ordenes-pago con expediente, tipo y número — y sin actor", async () => {
      await OrdenPagoService.registrar(42, "MULTA", "58431366");

      expect(mockPost).toHaveBeenCalledWith("/ordenes-pago", {
        eejeId: 42,
        tipo: "MULTA",
        numero: "58431366",
      });
      // El actor se deriva del JWT en el backend: mandarlo desde aquí sería ofrecer la superficie
      // para actuar en nombre de otro (anti-spoofing, mismo criterio que el resto del módulo).
      const [, cuerpo] = mockPost.mock.calls[0] as [string, object];
      expect(cuerpo).not.toHaveProperty("userId");
      expect(cuerpo).not.toHaveProperty("registradaBy");
    });
  });

  describe("anular()", () => {
    it("PATCH /ordenes-pago/:id/anular con el motivo", async () => {
      await OrdenPagoService.anular(7, "El SAO la anuló por error de valor");

      expect(mockPatch).toHaveBeenCalledWith("/ordenes-pago/7/anular", {
        motivo: "El SAO la anuló por error de valor",
      });
    });
  });

  describe("historial()", () => {
    it("GET /ordenes-pago/:eejeId/historial", async () => {
      await OrdenPagoService.historial(42);

      expect(mockGet).toHaveBeenCalledWith("/ordenes-pago/42/historial");
    });
  });
});
