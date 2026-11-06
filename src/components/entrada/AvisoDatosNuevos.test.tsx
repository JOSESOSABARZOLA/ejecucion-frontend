/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend) — tests
 * Feature: La Bandeja se entera de lo que trajo la pasada (Fase 03.24, Plan 18, G-13)
 * Archivo: AvisoDatosNuevos.test.tsx
 * Responsabilidad: Fijar la conducta de UI-SPEC §3.2: con una pasada nueva que trajo datos, recargar
 *   sola si es seguro y, si no, pintar «Hay datos nuevos de Resolución · Recargar»; nada en la
 *   primera lectura, con pasadas sin datos o fallidas, ni con la integración apagada; un solo aviso
 *   aunque lleguen varias pasadas, y que se va al terminar una recarga.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AvisoDatosNuevos from "./AvisoDatosNuevos";
import {
  ANUNCIO_CON_AVISO,
  ANUNCIO_RECARGA_SOLA,
  AVISO_DATOS_NUEVOS,
  BOTON_RECARGAR,
} from "./datosNuevos";
import type { EstadoSincronizacionResolucion } from "../../services/EntradaLotesService";

const FIN_1 = "2026-10-21T10:00:05.000Z";
const FIN_2 = "2026-10-21T10:05:05.000Z";
const FIN_3 = "2026-10-21T10:10:05.000Z";

const estado = (
  overrides: Partial<EstadoSincronizacionResolucion> = {},
): EstadoSincronizacionResolucion => ({
  habilitada: true,
  intervaloMinutos: 5,
  enCurso: false,
  resultado: "CORRECTA",
  inicio: "2026-10-21T10:00:00.000Z",
  fin: FIN_1,
  motivo: null,
  lotes: 1,
  casosNuevos: 2,
  casosActualizados: 1,
  reingresados: 0,
  fallos: [],
  fallosTotales: 0,
  truncado: false,
  ...overrides,
});

/** Las props por omisión: integración encendida, pantalla segura, recarga que termina bien. */
const props = (
  overrides: Partial<Parameters<typeof AvisoDatosNuevos>[0]> = {},
) => ({
  estado: estado(),
  seguro: true,
  onRecargar: vi.fn(async () => {}),
  marcaDeRecarga: "marca-1" as unknown,
  ...overrides,
});

const anuncio = () => screen.getByRole("status");
const aviso = () => screen.queryByText(AVISO_DATOS_NUEVOS);
const botonRecargar = () =>
  screen.queryByRole("button", { name: BOTON_RECARGAR });

describe("AvisoDatosNuevos — la primera lectura no es una novedad", () => {
  it("no recarga, no pinta el aviso y el nodo vivo queda vacío", () => {
    const p = props();
    render(<AvisoDatosNuevos {...p} />);
    expect(p.onRecargar).not.toHaveBeenCalled();
    expect(aviso()).toBeNull();
    expect(anuncio()).toBeEmptyDOMElement();
  });
});

describe("AvisoDatosNuevos — pasada nueva con datos", () => {
  it("si es SEGURO, recarga una vez, no pinta el aviso y anuncia que la bandeja se actualizó", async () => {
    const p = props();
    const { rerender } = render(<AvisoDatosNuevos {...p} />);
    rerender(<AvisoDatosNuevos {...p} estado={estado({ fin: FIN_2 })} />);

    await waitFor(() => expect(anuncio().textContent).toBe(ANUNCIO_RECARGA_SOLA));
    expect(p.onRecargar).toHaveBeenCalledTimes(1);
    expect(aviso()).toBeNull();
    expect(botonRecargar()).toBeNull();
  });

  it("si NO es seguro, no recarga y pinta «Hay datos nuevos de Resolución» con su `title` y «Recargar»", () => {
    const p = props({ seguro: false });
    const { rerender } = render(<AvisoDatosNuevos {...p} />);
    rerender(
      <AvisoDatosNuevos
        {...p}
        estado={estado({ fin: FIN_2, casosNuevos: 4, casosActualizados: 1, reingresados: 2 })}
      />,
    );

    expect(p.onRecargar).not.toHaveBeenCalled();
    expect(aviso()).not.toBeNull();
    expect(aviso()).toHaveAttribute(
      "title",
      "La última sincronización trajo 4 caso(s) nuevo(s), 1 actualizado(s) y 2 reingresado(s).",
    );
    expect(botonRecargar()).not.toBeNull();
    expect(anuncio().textContent).toBe(ANUNCIO_CON_AVISO);
  });

  it("«Recargar» llama a onRecargar y el aviso se va cuando cambia la marca de recarga", () => {
    const p = props({ seguro: false });
    const { rerender } = render(<AvisoDatosNuevos {...p} />);
    rerender(<AvisoDatosNuevos {...p} estado={estado({ fin: FIN_2 })} />);

    fireEvent.click(botonRecargar() as HTMLElement);
    expect(p.onRecargar).toHaveBeenCalledTimes(1);

    // Terminó bien una recarga (esta u otra: «Actualizar», el refetch de un modal): llegan lotes nuevos.
    rerender(
      <AvisoDatosNuevos
        {...p}
        estado={estado({ fin: FIN_2 })}
        marcaDeRecarga="marca-2"
      />,
    );
    expect(aviso()).toBeNull();
    expect(botonRecargar()).toBeNull();
  });

  it("dos pasadas sin atender dejan UN solo aviso, sin apilarse", () => {
    const p = props({ seguro: false });
    const { rerender } = render(<AvisoDatosNuevos {...p} />);
    rerender(<AvisoDatosNuevos {...p} estado={estado({ fin: FIN_2 })} />);
    rerender(<AvisoDatosNuevos {...p} estado={estado({ fin: FIN_3 })} />);

    expect(screen.getAllByText(AVISO_DATOS_NUEVOS)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: BOTON_RECARGAR })).toHaveLength(1);
    expect(p.onRecargar).not.toHaveBeenCalled();
  });

  it("si la recarga sola falla, sale el aviso para que el usuario lo intente", async () => {
    const p = props({ onRecargar: vi.fn(async () => Promise.reject(new Error("red"))) });
    const { rerender } = render(<AvisoDatosNuevos {...p} />);
    rerender(<AvisoDatosNuevos {...p} estado={estado({ fin: FIN_2 })} />);

    await waitFor(() => expect(aviso()).not.toBeNull());
    expect(p.onRecargar).toHaveBeenCalledTimes(1);
  });
});

describe("AvisoDatosNuevos — lo que NO cuenta como datos nuevos", () => {
  it("una pasada nueva sin cambios: ni aviso ni recarga", () => {
    const p = props({ seguro: false });
    const { rerender } = render(<AvisoDatosNuevos {...p} />);
    rerender(
      <AvisoDatosNuevos
        {...p}
        estado={estado({ fin: FIN_2, casosNuevos: 0, casosActualizados: 0, reingresados: 0 })}
      />,
    );
    expect(aviso()).toBeNull();
    expect(p.onRecargar).not.toHaveBeenCalled();
  });

  it("una pasada nueva FALLIDA: ni aviso ni recarga, aunque traiga cifras", () => {
    const p = props();
    const { rerender } = render(<AvisoDatosNuevos {...p} />);
    rerender(
      <AvisoDatosNuevos
        {...p}
        estado={estado({ fin: FIN_2, resultado: "FALLIDA", motivo: "Resolución respondió 401" })}
      />,
    );
    expect(aviso()).toBeNull();
    expect(p.onRecargar).not.toHaveBeenCalled();
  });

  it("el mismo `fin` otra vez (otro minuto del sondeo): nada", () => {
    const p = props({ seguro: false });
    const { rerender } = render(<AvisoDatosNuevos {...p} />);
    rerender(<AvisoDatosNuevos {...p} estado={estado()} />);
    expect(aviso()).toBeNull();
    expect(p.onRecargar).not.toHaveBeenCalled();
  });
});

describe("AvisoDatosNuevos — D-10: con la integración apagada no hay nada", () => {
  it.each([
    ["sin estado", null],
    ["con `habilitada: false`", estado({ habilitada: false })],
  ])("%s no pinta nada, ni aviso, ni botón, ni nodo vivo", (_caso, valor) => {
    const p = props({ estado: valor, seguro: false });
    const { container, rerender } = render(<AvisoDatosNuevos {...p} />);
    rerender(
      <AvisoDatosNuevos
        {...p}
        estado={valor ? { ...valor, fin: FIN_2 } : null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(p.onRecargar).not.toHaveBeenCalled();
  });
});
