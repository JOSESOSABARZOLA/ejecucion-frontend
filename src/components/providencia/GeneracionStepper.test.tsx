/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: El stepper de la página de generación de documentos (Fase 03.19, Plan 13, D-03)
 * Archivo: GeneracionStepper.test.tsx
 * Responsabilidad: Afirmar las dos cosas que este componente puede romper en silencio —la
 *   NAVEGACIÓN y la ACCESIBILIDAD— y, sobre todo, la que UI-SPEC §4.2 escribe en rojo:
 *
 *   ── 🔴 UN PASO BLOQUEADO NO DESAPARECE ──────────────────────────────────────────────────────
 *   La salida fácil de un paso al que todavía no se puede llegar es no pintarlo. Y es la peor: el
 *   decisor ve un stepper de dos pasos, cree que el acto termina ahí, y el tercero le aparece de
 *   golpe cuando ya creía haber acabado. Por eso la prueba del paso bloqueado afirma que el botón
 *   **ESTÁ EN EL DOCUMENTO** (`toBeInTheDocument`, nunca `queryBy… === null`), que está apagado, y
 *   que DICE qué falta. Un `display:none` colado en el futuro haría fallar la primera aserción.
 *
 *   ── Y que el motivo se pueda OÍR, no solo ver ───────────────────────────────────────────────
 *   `title` es un tooltip de ratón: quien navega con teclado o con lector de pantalla no lo alcanza
 *   —y menos en un botón `disabled`, que ni siquiera recibe el foco—. Por eso el motivo viaja
 *   además en un texto asociado con `aria-describedby`, y hay una aserción que lo comprueba: sin
 *   ella, «dice qué falta» se cumpliría solo para quien usa ratón y vista.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import GeneracionStepper from "./GeneracionStepper";

/** Los cuatro rótulos del contrato (UI-SPEC §4.2), en su orden. */
const ROTULOS = [
  "Información General",
  "Edición del Documento",
  "Notificación",
  "Firma",
];

describe("GeneracionStepper — los 4 pasos, su navegación y su accesibilidad", () => {
  it("pinta los cuatro rótulos del contrato, en orden", () => {
    render(
      <GeneracionStepper
        pasoActivo={1}
        pasoMaximoAlcanzable={1}
        onCambiarPaso={vi.fn()}
      />,
    );

    const pasos = screen.getAllByRole("button");
    expect(pasos).toHaveLength(4);
    expect(pasos.map((boton) => boton.textContent?.trim())).toEqual([
      `1${ROTULOS[0]}`,
      `2${ROTULOS[1]}`,
      `3${ROTULOS[2]}`,
      `4${ROTULOS[3]}`,
    ]);
  });

  it("🔴 un paso por encima del máximo alcanzable SIGUE EN EL DOCUMENTO, apagado, y dice qué falta", () => {
    render(
      <GeneracionStepper
        pasoActivo={1}
        pasoMaximoAlcanzable={1}
        onCambiarPaso={vi.fn()}
        motivosBloqueo={{
          2: "Elija el tipo de providencia para continuar.",
        }}
      />,
    );

    const paso2 = screen.getByRole("button", {
      name: /Edición del Documento/,
    });

    // (a) EXISTE. No es `queryBy… === null`: la regla es que se vea apagado, no que desaparezca.
    expect(paso2).toBeInTheDocument();

    // (b) Está apagado, y ANUNCIADO como apagado.
    expect(paso2).toBeDisabled();
    expect(paso2).toHaveAttribute("aria-disabled", "true");

    // (c) Dice qué falta, en el `title` (ratón)…
    expect(paso2).toHaveAttribute(
      "title",
      "Elija el tipo de providencia para continuar.",
    );

    // (d) …y también por un camino que un lector de pantalla sí recorre.
    const idDescripcion = paso2.getAttribute("aria-describedby");
    expect(idDescripcion).toBeTruthy();
    expect(document.getElementById(idDescripcion as string)?.textContent).toBe(
      "Elija el tipo de providencia para continuar.",
    );
  });

  it("sin motivo propio, el paso bloqueado nombra el paso anterior en vez de callarse", () => {
    render(
      <GeneracionStepper
        pasoActivo={2}
        pasoMaximoAlcanzable={2}
        onCambiarPaso={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Notificación/ })).toHaveAttribute(
      "title",
      "Complete «Edición del Documento» para continuar.",
    );
  });

  it("pulsar un paso ya alcanzado llama al manejador con su índice", () => {
    const onCambiarPaso = vi.fn();
    render(
      <GeneracionStepper
        pasoActivo={3}
        pasoMaximoAlcanzable={3}
        onCambiarPaso={onCambiarPaso}
      />,
    );

    // Hacia ATRÁS siempre es libre: el paso 1 ya se alcanzó.
    fireEvent.click(screen.getByRole("button", { name: /Información General/ }));
    expect(onCambiarPaso).toHaveBeenCalledWith(1);

    // Y el paso 4, que todavía no se ganó, no llama a nadie.
    fireEvent.click(screen.getByRole("button", { name: /Firma/ }));
    expect(onCambiarPaso).toHaveBeenCalledTimes(1);
  });

  it("el elemento de navegación anuncia «Paso N de 4» y marca el activo como el actual", () => {
    render(
      <GeneracionStepper
        pasoActivo={2}
        pasoMaximoAlcanzable={3}
        onCambiarPaso={vi.fn()}
      />,
    );

    expect(screen.getByRole("navigation")).toHaveAccessibleName("Paso 2 de 4");

    const activo = screen.getByRole("button", {
      name: /Edición del Documento/,
    });
    expect(activo).toHaveAttribute("aria-current", "step");

    // El actual es UNO SOLO: si dos pasos se marcaran como `step`, el lector diría dos «actual».
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });

  it("mientras se genera, el stepper entero queda bloqueado y lo dice (UI-SPEC §4.3)", () => {
    const onCambiarPaso = vi.fn();
    render(
      <GeneracionStepper
        pasoActivo={4}
        pasoMaximoAlcanzable={4}
        onCambiarPaso={onCambiarPaso}
        bloqueado
      />,
    );

    for (const rotulo of ROTULOS) {
      const paso = screen.getByRole("button", { name: new RegExp(rotulo) });
      expect(paso).toBeInTheDocument();
      expect(paso).toBeDisabled();
      expect(paso).toHaveAttribute(
        "title",
        "El documento se está generando; espere a que termine.",
      );
    }

    fireEvent.click(screen.getByRole("button", { name: /Información General/ }));
    expect(onCambiarPaso).not.toHaveBeenCalled();
  });

  it("un paso ya superado se marca como completo, y el activo no", () => {
    render(
      <GeneracionStepper
        pasoActivo={3}
        pasoMaximoAlcanzable={3}
        onCambiarPaso={vi.fn()}
      />,
    );

    const paso1 = screen.getByRole("button", { name: /Información General/ });
    expect(paso1.className).toContain("is-complete");
    // El punto del paso completo lleva el visto, y el visto NO es el único aviso: la clase
    // `is-complete` lo acompaña (UI-SPEC §6/A1 — nada depende solo de un signo gráfico).
    expect(paso1).toHaveAccessibleName(/Paso 1 de 4: Información General/);

    const paso3 = screen.getByRole("button", { name: /Notificación/ });
    expect(paso3.className).toContain("is-active");
    expect(paso3.className).not.toContain("is-complete");
  });
});
