/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend) — tests
 * Feature: Borrador de providencia guardado en el servidor (quick 261006-el5)
 * Archivo: useAutoguardadoBorrador.test.ts
 * Responsabilidad: Fijar el motor del autoguardado en solitario, sin compositor ni página: cuándo
 *   sale un PUT (y cuándo NO), la coalescencia de los cambios dentro del retardo, que recuperar no
 *   vuelve a guardar, cómo se lee y se reintenta un fallo, el vaciado que es un DELETE, y los
 *   controles que usan el compositor y la página (`guardarYa`, `pausar`, `reanudar`, `descartar`).
 *
 *   Las fechas se construyen LOCALES (`new Date(2026, 9, 6, 14, 32)`) para que los rótulos no
 *   dependan del huso de la máquina que corre las pruebas.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-06
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/ProvidenciaService", () => ({
  ProvidenciaService: {
    leerBorrador: vi.fn(),
    guardarBorrador: vi.fn(),
    descartarBorrador: vi.fn(),
  },
}));

import { ProvidenciaService } from "../services/ProvidenciaService";
import type { BorradorProvidencia } from "../services/ProvidenciaService";
import {
  RETARDO_AUTOGUARDADO_MS,
  horaDeGuardado,
  rotuloRecuperacion,
  useAutoguardadoBorrador,
} from "./useAutoguardadoBorrador";

const ISO = new Date(2026, 9, 6, 14, 32).toISOString();
const ISO_SERVIDOR = new Date(2026, 9, 6, 9, 5).toISOString();

const guardar = vi.mocked(ProvidenciaService.guardarBorrador);
const descartarSrv = vi.mocked(ProvidenciaService.descartarBorrador);

interface Props {
  eejeId: number | null;
  cuerpo: string;
  tipoCodigo: string;
}

const montar = (inicial: Partial<Props> = {}) =>
  renderHook((p: Props) => useAutoguardadoBorrador(p), {
    initialProps: { eejeId: 42, cuerpo: "", tipoCodigo: "", ...inicial },
  });

const avanzar = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

/** Deja correr las continuaciones de las promesas pendientes. */
const vaciar = async () => {
  await act(async () => {});
};

const base = (extra: Partial<BorradorProvidencia> = {}): BorradorProvidencia => ({
  tipoCodigo: "ATENCION_A_ESCRITO",
  cuerpo: "<p>guardado</p>",
  actualizadoAt: ISO_SERVIDOR,
  ...extra,
});

function diferida<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

describe("useAutoguardadoBorrador", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    guardar.mockReset();
    descartarSrv.mockReset();
    guardar.mockImplementation(async (_eejeId, b) => ({
      tipoCodigo: b.tipoCodigo || null,
      cuerpo: b.cuerpo,
      actualizadoAt: ISO,
    }));
    descartarSrv.mockResolvedValue({ eliminado: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("el retardo es de 2 segundos", () => {
    expect(RETARDO_AUTOGUARDADO_MS).toBe(2000);
  });

  it("sin armar no sale ni un PUT aunque el contenido cambie durante 10 s", async () => {
    const { result, rerender } = montar();

    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "T" });
    await avanzar(5000);
    rerender({ eejeId: 42, cuerpo: "<p>dos</p>", tipoCodigo: "T" });
    await avanzar(5000);

    expect(guardar).not.toHaveBeenCalled();
    expect(result.current.estado).toBe("inactivo");
  });

  it("tras armar(null), un cambio queda pendiente y sale UN PUT a los 2000 ms, no a los 1999", async () => {
    const { result, rerender } = montar();
    act(() => result.current.armar(null));

    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "TIPO_A" });
    expect(result.current.estado).toBe("pendiente");

    await avanzar(1999);
    expect(guardar).not.toHaveBeenCalled();

    await avanzar(1);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith(42, {
      cuerpo: "<p>uno</p>",
      tipoCodigo: "TIPO_A",
    });
    await vaciar();

    expect(result.current.estado).toBe("al-dia");
    expect(result.current.guardadoAt).toBe(ISO);
    expect(result.current.hayBorradorEnServidor).toBe(true);
  });

  it("tres cambios dentro del retardo ⇒ UN PUT con el ÚLTIMO contenido", async () => {
    const { result, rerender } = montar();
    act(() => result.current.armar(null));

    rerender({ eejeId: 42, cuerpo: "<p>a</p>", tipoCodigo: "T" });
    await avanzar(500);
    rerender({ eejeId: 42, cuerpo: "<p>ab</p>", tipoCodigo: "T" });
    await avanzar(500);
    rerender({ eejeId: 42, cuerpo: "<p>abc</p>", tipoCodigo: "T" });
    await avanzar(2000);
    await vaciar();

    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith(42, {
      cuerpo: "<p>abc</p>",
      tipoCodigo: "T",
    });
  });

  it("armar(base) con el mismo contenido que el actual ⇒ ningún PUT (recuperar no vuelve a guardar)", async () => {
    const { result } = montar({
      cuerpo: "<p>guardado</p>",
      tipoCodigo: "ATENCION_A_ESCRITO",
    });

    act(() => result.current.armar(base()));
    await avanzar(10000);

    expect(guardar).not.toHaveBeenCalled();
    expect(descartarSrv).not.toHaveBeenCalled();
    expect(result.current.estado).toBe("al-dia");
    expect(result.current.hayBorradorEnServidor).toBe(true);
    expect(result.current.guardadoAt).toBe(ISO_SERVIDOR);
  });

  it("un PUT que falla ⇒ error; no se reintenta solo con el mismo contenido; el siguiente cambio sí; un PUT bueno limpia el error", async () => {
    guardar.mockRejectedValueOnce(new Error("sin red"));
    const { result, rerender } = montar();
    act(() => result.current.armar(null));

    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "T" });
    await avanzar(2000);
    await vaciar();

    expect(result.current.estado).toBe("error");
    expect(result.current.error).toBe("error desconocido");

    await avanzar(10000);
    expect(guardar).toHaveBeenCalledTimes(1);

    rerender({ eejeId: 42, cuerpo: "<p>uno más</p>", tipoCodigo: "T" });
    await avanzar(2000);
    await vaciar();

    expect(guardar).toHaveBeenCalledTimes(2);
    expect(result.current.estado).toBe("al-dia");
    expect(result.current.error).toBeNull();
  });

  it("con borrador en el servidor y el cuerpo vaciado ⇒ DELETE y no PUT", async () => {
    const { result, rerender } = montar({
      cuerpo: "<p>guardado</p>",
      tipoCodigo: "ATENCION_A_ESCRITO",
    });
    act(() => result.current.armar(base()));

    rerender({ eejeId: 42, cuerpo: "<p></p>", tipoCodigo: "ATENCION_A_ESCRITO" });
    await avanzar(2000);
    await vaciar();

    expect(descartarSrv).toHaveBeenCalledWith(42);
    expect(guardar).not.toHaveBeenCalled();
    expect(result.current.hayBorradorEnServidor).toBe(false);
    expect(result.current.estado).toBe("al-dia");
  });

  it("sin borrador en el servidor y cuerpo vacío ⇒ ni PUT ni DELETE (un tipo sin cuerpo no se guarda)", async () => {
    const { result, rerender } = montar();
    act(() => result.current.armar(null));

    rerender({ eejeId: 42, cuerpo: "<p></p>", tipoCodigo: "T" });
    await avanzar(10000);

    expect(guardar).not.toHaveBeenCalled();
    expect(descartarSrv).not.toHaveBeenCalled();
    expect(result.current.estado).toBe("al-dia");
  });

  it("guardarYa() con un cambio pendiente hace el PUT al instante y resuelve true", async () => {
    const { result, rerender } = montar();
    act(() => result.current.armar(null));
    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "T" });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.guardarYa();
    });

    expect(guardar).toHaveBeenCalledTimes(1);
    expect(ok).toBe(true);
    expect(result.current.estado).toBe("al-dia");

    // Y el temporizador que había quedado programado no vuelve a escribir.
    await avanzar(10000);
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it("guardarYa() con el PUT fallando resuelve false", async () => {
    guardar.mockRejectedValue(new Error("caído"));
    const { result, rerender } = montar();
    act(() => result.current.armar(null));
    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "T" });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.guardarYa();
    });

    expect(ok).toBe(false);
    expect(result.current.estado).toBe("error");
  });

  it("guardarYa() sin armar resuelve true: no hay nada que pueda guardar", async () => {
    const { result } = montar({ cuerpo: "<p>uno</p>" });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.guardarYa();
    });

    expect(ok).toBe(true);
    expect(guardar).not.toHaveBeenCalled();
  });

  it("pausar() con un cambio pendiente ⇒ ningún PUT en 10 s; reanudar() ⇒ sale tras el retardo", async () => {
    const { result, rerender } = montar();
    act(() => result.current.armar(null));
    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "T" });

    await act(async () => {
      await result.current.pausar();
    });
    await avanzar(10000);
    expect(guardar).not.toHaveBeenCalled();

    act(() => result.current.reanudar());
    await avanzar(1999);
    expect(guardar).not.toHaveBeenCalled();
    await avanzar(1);
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it("🔴 con un PUT en vuelo, pausar() no resuelve hasta que termina", async () => {
    const enVuelo = diferida<BorradorProvidencia>();
    guardar.mockReturnValueOnce(enVuelo.promesa);
    const { result, rerender } = montar();
    act(() => result.current.armar(null));
    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "T" });
    await avanzar(2000);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(result.current.estado).toBe("guardando");

    let pausado = false;
    act(() => {
      void result.current.pausar().then(() => {
        pausado = true;
      });
    });
    await vaciar();
    expect(pausado).toBe(false);

    await act(async () => {
      enVuelo.resolver({ tipoCodigo: "T", cuerpo: "<p>uno</p>", actualizadoAt: ISO });
    });
    await vaciar();
    expect(pausado).toBe(true);
  });

  it("descartar() hace DELETE y deja el motor PAUSADO hasta reanudar()", async () => {
    const { result, rerender } = montar({
      cuerpo: "<p>guardado</p>",
      tipoCodigo: "ATENCION_A_ESCRITO",
    });
    act(() => result.current.armar(base()));

    await act(async () => {
      await result.current.descartar();
    });

    expect(descartarSrv).toHaveBeenCalledWith(42);
    expect(result.current.hayBorradorEnServidor).toBe(false);
    expect(result.current.guardadoAt).toBeNull();

    // Pausado: lo que quien llama ponga ahora no se guarda solo.
    rerender({ eejeId: 42, cuerpo: "<p>de cero</p>", tipoCodigo: "" });
    await avanzar(10000);
    expect(guardar).not.toHaveBeenCalled();

    act(() => result.current.reanudar());
    await avanzar(2000);
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it("desmontar con un cambio pendiente dispara el PUT", async () => {
    const { result, rerender, unmount } = montar();
    act(() => result.current.armar(null));
    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "T" });

    unmount();

    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith(42, {
      cuerpo: "<p>uno</p>",
      tipoCodigo: "T",
    });
  });

  it("desmontar estando pausado no dispara nada", async () => {
    const { result, rerender, unmount } = montar();
    act(() => result.current.armar(null));
    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "T" });
    await act(async () => {
      await result.current.pausar();
    });

    unmount();

    expect(guardar).not.toHaveBeenCalled();
  });

  it("con eejeId null el motor es inerte aunque se arme", async () => {
    const { result, rerender } = montar({ eejeId: null });
    act(() => result.current.armar(null));
    rerender({ eejeId: null, cuerpo: "<p>uno</p>", tipoCodigo: "T" });
    await avanzar(10000);

    expect(guardar).not.toHaveBeenCalled();
    expect(result.current.estado).toBe("inactivo");
  });

  it("un tipoCodigo vacío viaja como null", async () => {
    const { result, rerender } = montar();
    act(() => result.current.armar(null));
    rerender({ eejeId: 42, cuerpo: "<p>uno</p>", tipoCodigo: "" });
    await avanzar(2000);

    expect(guardar).toHaveBeenCalledWith(42, {
      cuerpo: "<p>uno</p>",
      tipoCodigo: null,
    });
  });

  it("los rótulos: «06-10 a las 14:32» y «14:32»", () => {
    expect(rotuloRecuperacion(ISO)).toBe("06-10 a las 14:32");
    expect(horaDeGuardado(ISO)).toBe("14:32");
  });
});
