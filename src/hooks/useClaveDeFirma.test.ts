/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Actas
 * Feature: Clave del certificado para la firma del acta D2 — tests
 * Archivo: useClaveDeFirma.test.ts
 * Responsabilidad: Fija la regla que gobierna si se pide la clave y qué se manda al servicio. Lo que
 *   importa de verdad: con el firmador APAGADO no se pide nada y NO se envía ninguna clave (hoy es
 *   el camino normal), y con él encendido no se puede enviar la firma sin ella.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-13
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08: `sesionCentral` y el estado C —
 *   firmador encendido con una sesión que no viene del Auth central no deja enviar ni manda la
 *   clave—, y la caché del modo que se vacía para forzar una nueva lectura).
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-01: `cargando`, `errorModo` y
 *   `reintentarModo`; un fallo de lectura ya no se toma por «firmador apagado»).
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClaveDeFirma, resetModoDeFirmaCache } from "./useClaveDeFirma";
import SorteoService from "../services/SorteoService";

vi.mock("../services/SorteoService", () => ({
  default: { readModoDeFirma: vi.fn() },
  SorteoService: { readModoDeFirma: vi.fn() },
}));

const mockedReadModo = SorteoService.readModoDeFirma as unknown as ReturnType<
  typeof vi.fn
>;

describe("useClaveDeFirma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
  });

  it("firmador APAGADO (hoy): no se pide clave y NO se manda ninguna", async () => {
    mockedReadModo.mockResolvedValue({ firmadorHabilitado: false });

    const { result } = renderHook(() => useClaveDeFirma());
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.requerida).toBe(false);
    // Se puede firmar sin teclear nada, y al servicio no le llega ninguna clave.
    expect(result.current.listaParaEnviar).toBe(true);
    expect(result.current.claveParaEnviar).toBeUndefined();
  });

  it("firmador ENCENDIDO: se pide, y sin ella NO se puede enviar", async () => {
    mockedReadModo.mockResolvedValue({ firmadorHabilitado: true });

    const { result } = renderHook(() => useClaveDeFirma());
    await waitFor(() => expect(result.current.requerida).toBe(true));

    expect(result.current.listaParaEnviar).toBe(false);

    act(() => result.current.setClave("clave-del-p12"));

    expect(result.current.listaParaEnviar).toBe(true);
    expect(result.current.claveParaEnviar).toBe("clave-del-p12");
  });

  it("una clave en blanco no cuenta como clave", async () => {
    mockedReadModo.mockResolvedValue({ firmadorHabilitado: true });

    const { result } = renderHook(() => useClaveDeFirma());
    await waitFor(() => expect(result.current.requerida).toBe(true));

    act(() => result.current.setClave("   "));

    expect(result.current.listaParaEnviar).toBe(false);
  });

  it("`limpiar` borra la clave del estado: no sobrevive al acto de firmar", async () => {
    mockedReadModo.mockResolvedValue({ firmadorHabilitado: true });

    const { result } = renderHook(() => useClaveDeFirma());
    await waitFor(() => expect(result.current.requerida).toBe(true));
    act(() => result.current.setClave("clave-del-p12"));

    act(() => result.current.limpiar());

    expect(result.current.clave).toBe("");
    expect(result.current.claveParaEnviar).toBeUndefined();
  });

  describe("mientras el modo no se conoce (revisión 03.21, WR-01)", () => {
    it("leyendo el modo: `cargando` y NO se puede enviar (no es «firmador apagado»)", async () => {
      let responder: (modo: { firmadorHabilitado: boolean }) => void = () => {};
      mockedReadModo.mockReturnValue(
        new Promise((resolve) => {
          responder = resolve;
        }),
      );

      const { result } = renderHook(() => useClaveDeFirma());

      expect(result.current.cargando).toBe(true);
      expect(result.current.errorModo).toBe(false);
      expect(result.current.requerida).toBe(false);
      expect(result.current.listaParaEnviar).toBe(false);
      expect(result.current.claveParaEnviar).toBeUndefined();

      await act(async () => responder({ firmadorHabilitado: false }));

      expect(result.current.cargando).toBe(false);
      expect(result.current.listaParaEnviar).toBe(true);
    });

    it("si no se puede consultar el modo, NO se asume apagado: `errorModo` y no se puede enviar", async () => {
      mockedReadModo.mockRejectedValue(new Error("sin red"));

      const { result } = renderHook(() => useClaveDeFirma());
      await waitFor(() => expect(result.current.errorModo).toBe(true));

      expect(result.current.cargando).toBe(false);
      expect(result.current.requerida).toBe(false);
      expect(result.current.listaParaEnviar).toBe(false);
      expect(result.current.claveParaEnviar).toBeUndefined();
    });

    it("tras un fallo de lectura, `reintentarModo` vuelve a preguntar y sale del atasco", async () => {
      mockedReadModo.mockRejectedValueOnce(new Error("sin red"));
      mockedReadModo.mockResolvedValueOnce({
        firmadorHabilitado: true,
        sesionCentral: true,
      });

      const { result } = renderHook(() => useClaveDeFirma());
      await waitFor(() => expect(result.current.errorModo).toBe(true));

      act(() => result.current.reintentarModo());
      expect(result.current.cargando).toBe(true);

      await waitFor(() => expect(result.current.requerida).toBe(true));
      expect(result.current.errorModo).toBe(false);
      expect(mockedReadModo).toHaveBeenCalledTimes(2);
      act(() => result.current.setClave("clave-del-p12"));
      expect(result.current.listaParaEnviar).toBe(true);
    });

    it("un modal que se abre con el modo ya leído arranca sabiéndolo (sin «comprobando…»)", async () => {
      mockedReadModo.mockResolvedValue({ firmadorHabilitado: true });

      const primero = renderHook(() => useClaveDeFirma());
      await waitFor(() => expect(primero.result.current.requerida).toBe(true));

      const segundo = renderHook(() => useClaveDeFirma());
      expect(segundo.result.current.cargando).toBe(false);
      expect(segundo.result.current.requerida).toBe(true);
    });
  });

  it("el modo se pregunta UNA vez por sesión, no en cada modal que se abre", async () => {
    mockedReadModo.mockResolvedValue({ firmadorHabilitado: true });

    const primero = renderHook(() => useClaveDeFirma());
    await waitFor(() => expect(primero.result.current.requerida).toBe(true));
    const segundo = renderHook(() => useClaveDeFirma());
    await waitFor(() => expect(segundo.result.current.requerida).toBe(true));

    expect(mockedReadModo).toHaveBeenCalledTimes(1);
  });

  describe("sesionCentral (Fase 03.21, D-12)", () => {
    it("encendido SIN sesión central: se pide (requerida) pero no se puede enviar, ni con clave", async () => {
      mockedReadModo.mockResolvedValue({
        firmadorHabilitado: true,
        sesionCentral: false,
      });

      const { result } = renderHook(() => useClaveDeFirma());
      await waitFor(() => expect(result.current.requerida).toBe(true));

      expect(result.current.sesionCentral).toBe(false);
      expect(result.current.sinSesionCentral).toBe(true);

      act(() => result.current.setClave("clave-del-p12"));

      expect(result.current.listaParaEnviar).toBe(false);
      expect(result.current.claveParaEnviar).toBeUndefined();
    });

    it("encendido CON sesión central: la conducta de siempre", async () => {
      mockedReadModo.mockResolvedValue({
        firmadorHabilitado: true,
        sesionCentral: true,
      });

      const { result } = renderHook(() => useClaveDeFirma());
      await waitFor(() => expect(result.current.requerida).toBe(true));

      expect(result.current.sesionCentral).toBe(true);
      expect(result.current.sinSesionCentral).toBe(false);
      act(() => result.current.setClave("clave-del-p12"));
      expect(result.current.listaParaEnviar).toBe(true);
      expect(result.current.claveParaEnviar).toBe("clave-del-p12");
    });

    it("si el servidor no informa sesionCentral, la UI degrada: la conducta de hoy", async () => {
      mockedReadModo.mockResolvedValue({ firmadorHabilitado: true });

      const { result } = renderHook(() => useClaveDeFirma());
      await waitFor(() => expect(result.current.requerida).toBe(true));

      expect(result.current.sesionCentral).toBeUndefined();
      expect(result.current.sinSesionCentral).toBe(false);
      act(() => result.current.setClave("clave-del-p12"));
      expect(result.current.listaParaEnviar).toBe(true);
      expect(result.current.claveParaEnviar).toBe("clave-del-p12");
    });

    it("con el firmador apagado no hay estado C, aunque llegara sesionCentral=false", async () => {
      mockedReadModo.mockResolvedValue({
        firmadorHabilitado: false,
        sesionCentral: false,
      });

      const { result } = renderHook(() => useClaveDeFirma());
      await waitFor(() => expect(result.current.cargando).toBe(false));

      expect(result.current.requerida).toBe(false);
      expect(result.current.sinSesionCentral).toBe(false);
      expect(result.current.listaParaEnviar).toBe(true);
    });

    it("resetModoDeFirmaCache() fuerza una nueva lectura (se vacía al cerrar sesión)", async () => {
      mockedReadModo.mockResolvedValueOnce({
        firmadorHabilitado: true,
        sesionCentral: true,
      });
      const primero = renderHook(() => useClaveDeFirma());
      await waitFor(() => expect(primero.result.current.requerida).toBe(true));

      resetModoDeFirmaCache();
      mockedReadModo.mockResolvedValueOnce({
        firmadorHabilitado: true,
        sesionCentral: false,
      });
      const segundo = renderHook(() => useClaveDeFirma());
      await waitFor(() =>
        expect(segundo.result.current.sinSesionCentral).toBe(true),
      );

      expect(mockedReadModo).toHaveBeenCalledTimes(2);
    });
  });
});
