/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: La barra de acciones de la página de generación (Fase 03.19, Plan 13, D-12)
 * Archivo: BarraAccionesGeneracion.test.tsx
 * Responsabilidad: Fijar las dos reglas que esta barra tiene y que, sin prueba, viven solo en un
 *   comentario:
 *
 *   ── 🔴 UN SOLO PRIMARIO SÓLIDO A LA VEZ (UI-SPEC §4.3) ──────────────────────────────────────
 *   La aserción no cuenta rótulos: **cuenta botones sólidos primarios en el DOM**, en los cuatro
 *   pasos. Contar rótulos daría verde el día que alguien añadiera un tercer botón sólido con otro
 *   texto, que es justo el fallo que la regla previene —dos llamadas a la acción con el mismo peso,
 *   y una de las dos emite un acto administrativo que no se deshace—.
 *
 *   ── EL PRIMARIO DEL PASO 4 NO EMITE ─────────────────────────────────────────────────────────
 *   «Generar documento» llama a `pedirConfirmacion`, que ABRE la confirmación. Emitir es lo que se
 *   confirma DENTRO del compositor. Si esta barra llamara a emitir, el acto saldría sin que nadie
 *   lo confirmara, y la confirmación de UI-SPEC §4.8 sería decorativa.
 *
 *   ── Y EL CONTRATO CON EL COMPOSITOR ─────────────────────────────────────────────────────────
 *   Las acciones llegan en el objeto que `CompositorProvidencia` entrega a `renderBarraAcciones`
 *   (`AccionesCompositor`). Este archivo lo construye con ese tipo, así que si el compositor
 *   cambiara la forma del objeto, esta prueba dejaría de compilar — que es exactamente cuando hay
 *   que enterarse, y no en la pantalla del decisor.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BarraAccionesGeneracion from "./BarraAccionesGeneracion";
import type { AccionesCompositor } from "./CompositorProvidencia";
import type { PasoGeneracion } from "./GeneracionStepper";

/** El objeto que el compositor entrega, en su estado más permisivo. */
const accionesDe = (
  parcial: Partial<AccionesCompositor> = {},
): AccionesCompositor => ({
  previaAbierta: false,
  emitiendo: false,
  tipoElegido: true,
  puedeEmitir: true,
  cancelar: vi.fn(),
  alternarPrevia: vi.fn(),
  pedirConfirmacion: vi.fn(),
  ...parcial,
});

/**
 * Los botones SÓLIDOS primarios que hay en pantalla. `btn-outline btn-primary` es otra jerarquía
 * —contorno— y por eso se descuenta explícitamente.
 */
const primariosSolidos = (): HTMLElement[] =>
  screen
    .getAllByRole("button")
    .filter(
      (boton) =>
        boton.className.includes("btn-primary") &&
        !boton.className.includes("btn-outline"),
    );

const PASOS: PasoGeneracion[] = [1, 2, 3, 4];

describe("BarraAccionesGeneracion — cinco controles y un solo primario", () => {
  it("🔴 en los cuatro pasos hay EXACTAMENTE un botón primario sólido", () => {
    for (const paso of PASOS) {
      const { unmount } = render(
        <BarraAccionesGeneracion
          paso={paso}
          acciones={accionesDe()}
          onAtras={vi.fn()}
          onSiguiente={vi.fn()}
        />,
      );

      expect(primariosSolidos()).toHaveLength(1);
      unmount();
    }
  });

  it("el paso 1 no ofrece Atrás ni Ver borrador, y su primario dice «Siguiente»", () => {
    render(
      <BarraAccionesGeneracion
        paso={1}
        acciones={accionesDe()}
        onAtras={vi.fn()}
        onSiguiente={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atrás" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver borrador" })).toBeNull();
    expect(primariosSolidos()[0]).toHaveTextContent("Siguiente");
    expect(
      screen.queryByRole("button", { name: "Generar documento" }),
    ).toBeNull();
  });

  it("el paso 4 cambia el primario a «Generar documento» y «Siguiente» desaparece", () => {
    render(
      <BarraAccionesGeneracion
        paso={4}
        acciones={accionesDe()}
        onAtras={vi.fn()}
        onSiguiente={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Atrás" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver borrador" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
    expect(primariosSolidos()[0]).toHaveTextContent("Generar documento");
  });

  it("«Generar documento» PIDE CONFIRMACIÓN; no emite", () => {
    const acciones = accionesDe();
    render(
      <BarraAccionesGeneracion
        paso={4}
        acciones={acciones}
        onAtras={vi.fn()}
        onSiguiente={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    expect(acciones.pedirConfirmacion).toHaveBeenCalledTimes(1);
  });

  it("«Siguiente» avanza, y «Atrás» retrocede", () => {
    const onSiguiente = vi.fn();
    const onAtras = vi.fn();
    render(
      <BarraAccionesGeneracion
        paso={2}
        acciones={accionesDe()}
        onAtras={onAtras}
        onSiguiente={onSiguiente}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(onSiguiente).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(onAtras).toHaveBeenCalledTimes(1);
  });

  it("mientras se genera, el primario lo dice y TODO queda apagado", () => {
    render(
      <BarraAccionesGeneracion
        paso={4}
        acciones={accionesDe({ emitiendo: true })}
        onAtras={vi.fn()}
        onSiguiente={vi.fn()}
      />,
    );

    for (const boton of screen.getAllByRole("button")) {
      expect(boton).toBeDisabled();
    }
    expect(primariosSolidos()[0]).toHaveTextContent("Generando…");
  });

  it("«Ver borrador» está apagado sin tipo elegido, y dice por qué", () => {
    const acciones = accionesDe({ tipoElegido: false });
    render(
      <BarraAccionesGeneracion
        paso={2}
        acciones={acciones}
        onAtras={vi.fn()}
        onSiguiente={vi.fn()}
      />,
    );

    const borrador = screen.getByRole("button", { name: "Ver borrador" });
    expect(borrador).toBeDisabled();
    expect(borrador).toHaveAttribute(
      "title",
      "Elija el tipo de providencia para ver el borrador.",
    );
  });

  it("con el panel abierto el rótulo del borrador deja de mentir, y alterna", () => {
    const acciones = accionesDe({ previaAbierta: true });
    render(
      <BarraAccionesGeneracion
        paso={2}
        acciones={acciones}
        onAtras={vi.fn()}
        onSiguiente={vi.fn()}
      />,
    );

    const borrador = screen.getByRole("button", { name: "Ocultar borrador" });
    fireEvent.click(borrador);
    expect(acciones.alternarPrevia).toHaveBeenCalledTimes(1);
  });

  it("«Siguiente» bloqueado se apaga Y dice qué falta", () => {
    const onSiguiente = vi.fn();
    render(
      <BarraAccionesGeneracion
        paso={1}
        acciones={accionesDe()}
        onAtras={vi.fn()}
        onSiguiente={onSiguiente}
        motivoSiguienteBloqueado="Elija el tipo de providencia para continuar."
      />,
    );

    const siguiente = screen.getByRole("button", { name: "Siguiente" });
    expect(siguiente).toBeDisabled();
    expect(siguiente).toHaveAttribute(
      "title",
      "Elija el tipo de providencia para continuar.",
    );

    fireEvent.click(siguiente);
    expect(onSiguiente).not.toHaveBeenCalled();
  });

  it("«Cancelar» usa la salida del compositor, tal cual", () => {
    const acciones = accionesDe();
    render(
      <BarraAccionesGeneracion
        paso={3}
        acciones={acciones}
        onAtras={vi.fn()}
        onSiguiente={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(acciones.cancelar).toHaveBeenCalledTimes(1);
  });
});

describe("BarraAccionesGeneracion — «Generar documento» apagado dice qué falta (quick 261006-dw9)", () => {
  it("🔴 en el paso 4 el `title` del primario apagado junta los motivos", () => {
    render(
      <BarraAccionesGeneracion
        paso={4}
        acciones={accionesDe({
          puedeEmitir: false,
          motivosNoEmitir: [
            { paso: 1, texto: "Falta X." },
            { paso: 4, texto: "Falta Y." },
          ],
        })}
        onAtras={vi.fn()}
        onSiguiente={vi.fn()}
      />,
    );

    const generar = screen.getByRole("button", { name: "Generar documento" });
    expect(generar).toBeDisabled();
    expect(generar).toHaveAttribute("title", "Falta X. Falta Y.");
  });

  it("con todo en regla, «Generar documento» no lleva `title`", () => {
    render(
      <BarraAccionesGeneracion
        paso={4}
        acciones={accionesDe({ puedeEmitir: true, motivosNoEmitir: [] })}
        onAtras={vi.fn()}
        onSiguiente={vi.fn()}
      />,
    );

    const generar = screen.getByRole("button", { name: "Generar documento" });
    expect(generar).toBeEnabled();
    expect(generar).not.toHaveAttribute("title");
  });
});
