/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend) — tests
 * Feature: Estado de la sincronización automática con Resolución (Fase 03.24, Plan 07, D-13)
 * Archivo: useEstadoSincronizacion.test.ts
 * Responsabilidad: Fijar el ritmo del hook que alimenta la línea de estado de la Bandeja de Entrada:
 *   consulta al montar, vuelve a consultar cada intervalo para que «hace N minutos» no mienta, un
 *   error deja el estado en null sin romper la página, y al desmontar el temporizador se apaga.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-20
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/EntradaLotesService", () => ({
  EntradaLotesService: {
    estadoSincronizacion: vi.fn(),
  },
}));

import {
  EntradaLotesService,
  type EstadoSincronizacionResolucion,
} from "../services/EntradaLotesService";
import {
  INTERVALO_REFRESCO_SINCRONIZACION_MS,
  useEstadoSincronizacion,
} from "./useEstadoSincronizacion";

const consultar = vi.mocked(EntradaLotesService.estadoSincronizacion);

const ESTADO: EstadoSincronizacionResolucion = {
  habilitada: true,
  intervaloMinutos: 5,
  enCurso: false,
  resultado: "CORRECTA",
  inicio: "2026-10-20T14:00:00.000Z",
  fin: "2026-10-20T14:00:05.000Z",
  motivo: null,
  lotes: 2,
  casosNuevos: 3,
  casosActualizados: 1,
  reingresados: 0,
  fallos: [],
  fallosTotales: 0,
  truncado: false,
};

/** Deja correr las continuaciones de las promesas pendientes. */
const vaciar = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("useEstadoSincronizacion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    consultar.mockReset();
    consultar.mockResolvedValue(ESTADO);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refresca cada 60 s por defecto", () => {
    expect(INTERVALO_REFRESCO_SINCRONIZACION_MS).toBe(60_000);
  });

  it("consulta UNA vez al montar y devuelve el estado que manda el servidor", async () => {
    const { result } = renderHook(() => useEstadoSincronizacion());
    expect(result.current).toBeNull();
    await vaciar();
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual(ESTADO);
  });

  it("vuelve a consultar al cumplirse el intervalo, para que «hace N minutos» no mienta", async () => {
    renderHook(() => useEstadoSincronizacion());
    await vaciar();
    expect(consultar).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it("respeta un intervalo propio", async () => {
    renderHook(() => useEstadoSincronizacion({ intervaloMs: 1_000 }));
    await vaciar();
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(consultar).toHaveBeenCalledTimes(4);
  });

  it("🔴 un error NO rompe la página: el estado queda en null y la línea no se pinta", async () => {
    consultar.mockResolvedValueOnce(ESTADO);
    const { result } = renderHook(() => useEstadoSincronizacion());
    await vaciar();
    expect(result.current).toEqual(ESTADO);

    consultar.mockRejectedValueOnce(new Error("503"));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await vaciar();
    expect(result.current).toBeNull();
  });

  it("al desmontar se apaga el temporizador: no hay más consultas", async () => {
    const { unmount } = renderHook(() => useEstadoSincronizacion());
    await vaciar();
    expect(consultar).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(consultar).toHaveBeenCalledTimes(1);
  });
});
