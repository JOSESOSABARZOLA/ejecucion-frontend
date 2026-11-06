/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend) — tests
 * Feature: Catálogos LOCALES y REMOTOS de los filtros de columna (quick 261006-g35; Fase 03.23, D-17)
 * Archivo: useTableCatalogOptions.test.ts
 * Responsabilidad: Fijar las dos clases de catálogo que sirve el hook. El LOCAL (`eejeStatus`) se
 *   deriva de código, está listo al primer render y no toca la red. Los REMOTOS —`materiaId` y
 *   `submateriaId`, los dos de las materias de Sorteo de `GET /infracciones/materias`— ofrecen
 *   `{ value: id, label: nombre }` en el orden del servidor, y si fallan (o Sorteo no está
 *   disponible) dejan `options` vacío con un `Error` que el disparador enseña. Fija también la COALESCENCIA: las dos celdas montadas a
 *   la vez comparten UNA petición, y la siguiente carga vuelve a pedir (no hay caché). Y que, tras
 *   cargar, la barra de «filtros aplicados» lee la ETIQUETA y cae al valor crudo con un código que
 *   no conoce.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-06
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: la clave del id de materia del g35 pasa a
 *   ser DOS, `materiaId` y `submateriaId`; la inactiva también se ofrece)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-14/D-17: las claves pasan a
 *   `materiaCod`/`submateriaCod` y se cargan del diccionario, no del catálogo local retirado)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: las claves son `materiaId`/`submateriaId`
 *   de `InfraccionesService.materias()`; `disponible: false` ⇒ error; fuera el diccionario)
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  materias: vi.fn(),
}));

vi.mock("../services/InfraccionesService", () => ({
  InfraccionesService: {
    materias: mocks.materias,
  },
  default: {
    materias: mocks.materias,
  },
}));

import { useTableCatalogOptions } from "./useTableCatalogOptions";
import { getCatalogOptionLabel } from "../config/tableCatalogDefaults";
import { ESTADOS_EPAS } from "../config/estadosEpas";

const MATERIAS = {
  disponible: true,
  origen: "SIMULADO",
  materias: [
    { id: 26, nombre: "LICENCIAMIENTO" },
    { id: 27, nombre: "FAUNA URBANA" },
  ],
  submaterias: [
    { id: 54, materiaId: 26, nombre: "LUAE" },
    { id: 33, materiaId: 27, nombre: "AMBIENTE" },
  ],
};

describe("useTableCatalogOptions — catálogo LOCAL (eejeStatus)", () => {
  beforeEach(() => {
    mocks.materias.mockReset();
  });

  it("devuelve al PRIMER render las opciones derivadas de estadosEpas, sin cargar y sin tocar la red", () => {
    const { result } = renderHook(() => useTableCatalogOptions("eejeStatus"));

    expect(result.current.options).toHaveLength(ESTADOS_EPAS.length);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mocks.materias).not.toHaveBeenCalled();
  });
});

describe("useTableCatalogOptions — MATERIAS (materiaId ← GET /infracciones/materias)", () => {
  beforeEach(() => {
    mocks.materias.mockReset();
  });

  it("empieza CARGANDO y sin opciones, y tras la respuesta ofrece { value: código, label: nombre } en el ORDEN del servidor", async () => {
    mocks.materias.mockResolvedValue(MATERIAS);

    const { result } = renderHook(() => useTableCatalogOptions("materiaId"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.options).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.options).toEqual([
      { value: "26", label: "LICENCIAMIENTO" },
      { value: "27", label: "FAUNA URBANA" },
    ]);
    expect(result.current.error).toBeNull();
    expect(mocks.materias).toHaveBeenCalledTimes(1);
  });

  it("si Sorteo no está disponible (disponible: false): sin opciones y con el Error del catálogo", async () => {
    mocks.materias.mockResolvedValue({
      disponible: false,
      origen: null,
      materias: [],
      submaterias: [],
    });

    const { result } = renderHook(() => useTableCatalogOptions("materiaId"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.options).toEqual([]);
    expect(result.current.error?.message).toBe(
      "El catálogo de materias de Sorteo no responde ahora",
    );
  });

  it("si las materias no se pueden cargar: sin opciones, sin carga y con un Error", async () => {
    mocks.materias.mockRejectedValue(new Error("403"));

    const { result } = renderHook(() => useTableCatalogOptions("materiaId"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.options).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("un rechazo que no es un Error se envuelve en uno: el consumidor no tiene que adivinar la forma", async () => {
    mocks.materias.mockRejectedValue("caída");

    const { result } = renderHook(() => useTableCatalogOptions("materiaId"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("tras una carga con éxito, la barra de «filtros aplicados» lee la ETIQUETA; con un código desconocido, el valor crudo", async () => {
    mocks.materias.mockResolvedValue(MATERIAS);

    const { result } = renderHook(() => useTableCatalogOptions("materiaId"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getCatalogOptionLabel("materiaId", "26")).toBe("LICENCIAMIENTO");
    expect(getCatalogOptionLabel("materiaId", "999")).toBe("999");
  });
});

describe("useTableCatalogOptions — SUBMATERIAS (submateriaId ← GET /infracciones/materias)", () => {
  beforeEach(() => {
    mocks.materias.mockReset();
  });

  it("ofrece las submaterias como { value: id, label: «submateria · materia» }", async () => {
    mocks.materias.mockResolvedValue(MATERIAS);

    const { result } = renderHook(() =>
      useTableCatalogOptions("submateriaId"),
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.options).toEqual([
      { value: "54", label: "LUAE · LICENCIAMIENTO" },
      { value: "33", label: "AMBIENTE · FAUNA URBANA" },
    ]);
    expect(result.current.error).toBeNull();
  });

  it("si falla: sin opciones, sin carga y con un Error", async () => {
    mocks.materias.mockRejectedValue(new Error("caída"));

    const { result } = renderHook(() =>
      useTableCatalogOptions("submateriaId"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.options).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("tras cargar, la etiqueta de una submateria se resuelve bajo SU clave; con un código desconocido, el valor crudo", async () => {
    mocks.materias.mockResolvedValue(MATERIAS);

    const { result } = renderHook(() =>
      useTableCatalogOptions("submateriaId"),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getCatalogOptionLabel("submateriaId", "54")).toBe(
      "LUAE · LICENCIAMIENTO",
    );
    expect(getCatalogOptionLabel("submateriaId", "999")).toBe("999");
  });
});

describe("useTableCatalogOptions — COALESCENCIA de las materias (una petición por montaje)", () => {
  beforeEach(() => {
    mocks.materias.mockReset();
  });

  it("las celdas de materia y submateria montadas A LA VEZ comparten UNA sola petición", async () => {
    mocks.materias.mockResolvedValue(MATERIAS);

    const materia = renderHook(() => useTableCatalogOptions("materiaId"));
    const submateria = renderHook(() =>
      useTableCatalogOptions("submateriaId"),
    );

    await waitFor(() => expect(materia.result.current.isLoading).toBe(false));
    await waitFor(() =>
      expect(submateria.result.current.isLoading).toBe(false),
    );

    expect(mocks.materias).toHaveBeenCalledTimes(1);
    expect(materia.result.current.options).toHaveLength(2);
    expect(submateria.result.current.options).toHaveLength(2);
  });

  it("NO es una caché: una vez resuelta, el siguiente montaje vuelve a pedir", async () => {
    mocks.materias.mockResolvedValue(MATERIAS);

    const primera = renderHook(() => useTableCatalogOptions("materiaId"));
    await waitFor(() => expect(primera.result.current.isLoading).toBe(false));

    const segunda = renderHook(() => useTableCatalogOptions("materiaId"));
    await waitFor(() => expect(segunda.result.current.isLoading).toBe(false));

    expect(mocks.materias).toHaveBeenCalledTimes(2);
  });

  it("tras un fallo, el siguiente montaje vuelve a intentarlo (el rechazo no queda guardado)", async () => {
    mocks.materias.mockRejectedValueOnce(new Error("caída"));
    mocks.materias.mockResolvedValueOnce(MATERIAS);

    const fallida = renderHook(() => useTableCatalogOptions("materiaId"));
    await waitFor(() => expect(fallida.result.current.isLoading).toBe(false));
    expect(fallida.result.current.error).toBeInstanceOf(Error);

    const reintento = renderHook(() => useTableCatalogOptions("materiaId"));
    await waitFor(() =>
      expect(reintento.result.current.isLoading).toBe(false),
    );

    expect(reintento.result.current.error).toBeNull();
    expect(reintento.result.current.options).toHaveLength(2);
    expect(mocks.materias).toHaveBeenCalledTimes(2);
  });
});
