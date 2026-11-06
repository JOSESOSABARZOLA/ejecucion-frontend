/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/epas (frontend)
 * Feature: Observaciones de la devolución anterior y su verificación (Fase 03.24, cierre de huecos G-01)
 * Archivo: ObservacionesService.test.ts
 * Responsabilidad: Fijar la forma de la petición de `ObservacionesService.verificar` —la ruta y el
 *   cuerpo— y los dos helpers puros con los que la ficha reparte y cuenta las observaciones de la
 *   devolución anterior (`separarObservaciones`, `contarVerificaciones`). Las pruebas de los helpers
 *   viven aquí y no junto a la interfaz porque son las que consumen la respuesta de `verificar`: el
 *   servicio devuelve la lista entera y la ficha la vuelve a separar con ellos.
 *
 *   🔴 El cuerpo de la verificación lleva SOLO `{ verificacion }`. El `ValidationPipe` del backend
 *   corre con `forbidNonWhitelisted`: colar el `obseId` (que va en la ruta) o la autoría daría un 400.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261029-kl0: `guardar` devuelve
 *   `{ observaciones, remisionRetirada }` y tolera el array del servidor anterior;
 *   `quedanObservacionesVivas`)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Doble del cliente HTTP centralizado: solo capturamos ruta y cuerpo. Sin red real.
vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn(async () => ({ data: [] })),
    put: vi.fn(async () => ({ data: [] })),
    patch: vi.fn(async () => ({ data: {} })),
  },
}));

import httpClient from "../api/httpClient";
import {
  ObservacionesService,
  quedanObservacionesVivas,
} from "./ObservacionesService";
import {
  contarVerificaciones,
  separarObservaciones,
  type IObservacion,
} from "../interfaces/ICaseObservations";

const mockPatch = httpClient.patch as unknown as ReturnType<typeof vi.fn>;
const mockPut = httpClient.put as unknown as ReturnType<typeof vi.fn>;

const obs = (parcial: Partial<IObservacion>): IObservacion => ({
  tipo: "CAMPO",
  clave: "admiAddress",
  etiqueta: "Dirección del administrado",
  texto: "Falta el número de casa",
  ...parcial,
});

describe("ObservacionesService.verificar — la forma de la petición (G-01)", () => {
  beforeEach(() => {
    mockPatch.mockReset();
  });

  it("hace PATCH a /epas/:id/observaciones/:obseId/verificacion con solo { verificacion }", async () => {
    const lista = [obs({ obseId: 9, deDevolucionAnterior: true, verificacion: "CUMPLIDA" })];
    mockPatch.mockResolvedValueOnce({ data: { observaciones: lista } });

    const resultado = await ObservacionesService.verificar(201, 9, "CUMPLIDA");

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      "/epas/201/observaciones/9/verificacion",
      { verificacion: "CUMPLIDA" },
    );
    expect(resultado).toEqual(lista);
  });

  it("devuelve [] si la respuesta no trae un array en `observaciones`", async () => {
    mockPatch.mockResolvedValueOnce({ data: { observaciones: null } });
    await expect(
      ObservacionesService.verificar(201, 9, "NO_CUMPLIDA"),
    ).resolves.toEqual([]);

    mockPatch.mockResolvedValueOnce({ data: undefined });
    await expect(
      ObservacionesService.verificar(201, 9, "NO_CUMPLIDA"),
    ).resolves.toEqual([]);
  });

  it("propaga el fallo del servidor: la ficha enseña su mensaje", async () => {
    mockPatch.mockRejectedValueOnce(new Error("403"));
    await expect(
      ObservacionesService.verificar(201, 9, "CUMPLIDA"),
    ).rejects.toThrow("403");
  });
});

describe("separarObservaciones — anteriores arriba, nuevas abajo (UI-SPEC §1.3)", () => {
  it("reparte por `deDevolucionAnterior` y conserva el orden en que llegan", () => {
    const a1 = obs({ obseId: 1, clave: "a", deDevolucionAnterior: true });
    const n1 = obs({ obseId: 2, clave: "b", deDevolucionAnterior: false });
    const a2 = obs({ obseId: 3, clave: "c", deDevolucionAnterior: true });

    const { anteriores, nuevas } = separarObservaciones([a1, n1, a2]);

    expect(anteriores).toEqual([a1, a2]);
    expect(nuevas).toEqual([n1]);
  });

  it("sin `deDevolucionAnterior`, la observación cuenta como nueva", () => {
    const sinMarca = obs({ obseId: 4 });
    const { anteriores, nuevas } = separarObservaciones([sinMarca]);
    expect(anteriores).toEqual([]);
    expect(nuevas).toEqual([sinMarca]);
  });
});

describe("contarVerificaciones — cuenta para pintar, no para decidir (UI-SPEC §1.7)", () => {
  it("cuenta una de cada estado", () => {
    expect(
      contarVerificaciones([
        obs({ verificacion: "POR_VERIFICAR" }),
        obs({ verificacion: "CUMPLIDA" }),
        obs({ verificacion: "NO_CUMPLIDA" }),
      ]),
    ).toEqual({ total: 3, porVerificar: 1, cumplidas: 1, noCumplidas: 1 });
  });

  it("una anterior sin `verificacion` cuenta como por verificar", () => {
    expect(
      contarVerificaciones([obs({ deDevolucionAnterior: true })]),
    ).toEqual({ total: 1, porVerificar: 1, cumplidas: 0, noCumplidas: 0 });
  });

  it("una lista vacía da todo a cero", () => {
    expect(contarVerificaciones([])).toEqual({
      total: 0,
      porVerificar: 0,
      cumplidas: 0,
      noCumplidas: 0,
    });
  });
});

describe("ObservacionesService.guardar — la remisión retirada (quick 261029-kl0)", () => {
  beforeEach(() => {
    mockPut.mockReset();
  });

  it("con la respuesta nueva devuelve el par { observaciones, remisionRetirada }", async () => {
    const lista = [obs({ obseId: 1, estado: "PENDIENTE" })];
    mockPut.mockResolvedValueOnce({
      data: { observaciones: lista, remisionRetirada: true },
    });

    const res = await ObservacionesService.guardar(201, lista);

    expect(mockPut).toHaveBeenCalledWith("/epas/201/observaciones", {
      observaciones: [
        {
          tipo: "CAMPO",
          clave: "admiAddress",
          etiqueta: "Dirección del administrado",
          texto: "Falta el número de casa",
        },
      ],
    });
    expect(res).toEqual({ observaciones: lista, remisionRetirada: true });
  });

  it("tolera el array del servidor anterior: remisionRetirada false", async () => {
    const lista = [obs({ obseId: 1 })];
    mockPut.mockResolvedValueOnce({ data: lista });

    await expect(ObservacionesService.guardar(201, lista)).resolves.toEqual({
      observaciones: lista,
      remisionRetirada: false,
    });
  });

  it("sin un array válido devuelve observaciones vacías", async () => {
    mockPut.mockResolvedValueOnce({ data: { observaciones: null } });
    await expect(ObservacionesService.guardar(201, [])).resolves.toEqual({
      observaciones: [],
      remisionRetirada: false,
    });

    mockPut.mockResolvedValueOnce({ data: undefined });
    await expect(ObservacionesService.guardar(201, [])).resolves.toEqual({
      observaciones: [],
      remisionRetirada: false,
    });
  });
});

describe("quedanObservacionesVivas — espeja la retención del servidor (quick 261029-kl0)", () => {
  it("una nueva no rechazada retiene", () => {
    expect(quedanObservacionesVivas([obs({ estado: "PENDIENTE" })])).toBe(true);
    expect(quedanObservacionesVivas([obs({ estado: "APROBADA" })])).toBe(true);
  });

  it("todas las nuevas RECHAZADA y ninguna anterior que cuente: no queda nada vivo", () => {
    expect(
      quedanObservacionesVivas([
        obs({ obseId: 1, estado: "RECHAZADA" }),
        obs({ obseId: 2, estado: "RECHAZADA" }),
      ]),
    ).toBe(false);
  });

  it("una anterior POR_VERIFICAR, sin verificación o NO_CUMPLIDA no rechazada retiene", () => {
    for (const verificacion of ["POR_VERIFICAR", undefined, "NO_CUMPLIDA"] as const) {
      expect(
        quedanObservacionesVivas([
          obs({ estado: "RECHAZADA" }),
          obs({ deDevolucionAnterior: true, estado: "APROBADA", verificacion }),
        ]),
      ).toBe(true);
    }
  });

  it("una anterior CUMPLIDA no cuenta", () => {
    expect(
      quedanObservacionesVivas([
        obs({ deDevolucionAnterior: true, estado: "APROBADA", verificacion: "CUMPLIDA" }),
      ]),
    ).toBe(false);
  });

  it("una lista vacía no retiene", () => {
    expect(quedanObservacionesVivas([])).toBe(false);
  });
});
