/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: Los dos botones de icono de la columna ACCIONES (Fase 03.19, Plan 08, D-11)
 * Archivo: BotonAccionFila.test.tsx
 * Responsabilidad: Afirmar las DOS cosas que hoy, medidas sobre `ActionButton`, están mal en los
 *   botones de icono de la fila — y que no se ven mirando la pantalla, que es por lo que llevan
 *   así desde marzo.
 *
 *   ── 🔴 1. UN BOTÓN SIN TEXTO Y SIN `aria-label` SE LLAMA «BOTÓN» ─────────────────────────────
 *   Para quien usa lector de pantalla, la columna ACCIONES de la bandeja es hoy literalmente
 *   «botón, botón, botón». Las tres acciones existen, se pueden pulsar y ninguna dice cuál es.
 *   Por eso la prueba localiza con `getByRole("button", { name: … })` y no con un `querySelector`:
 *   es la consulta que FALLA hoy, y es exactamente la que hace el usuario que no ve el icono.
 *
 *   ── 🔴 2. EL TOOLTIP DESAPARECE JUSTO CUANDO HACE FALTA ──────────────────────────────────────
 *   `ActionButton.tsx:33-37` pone `data-tip=""` cuando la acción está deshabilitada, que es el
 *   único momento en que el usuario pregunta «¿por qué no puedo?». La regla de esta fase es la
 *   inversa: motivo cuando está apagada, etiqueta cuando no. Y el `data-tip` va en el ENVOLTORIO
 *   porque un `<button disabled>` no recibe eventos de puntero: puesto en el botón, el tooltip del
 *   caso apagado no llegaría a dispararse nunca aunque tuviera texto.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BotonAccionFila from "./BotonAccionFila";

describe("BotonAccionFila", () => {
  it("🔴 tiene NOMBRE ACCESIBLE: se localiza por su etiqueta, no por «botón»", () => {
    render(
      <BotonAccionFila
        icono="mirar"
        etiqueta="Ver expediente EXP-183"
        onClick={vi.fn()}
      />,
    );

    // Ésta es la consulta que hoy falla con los dos botones de la fila.
    const boton = screen.getByRole("button", { name: "Ver expediente EXP-183" });
    expect(boton).toBeTruthy();
    // Y el `title` acompaña, para quien sí ve y pasa el ratón.
    expect(boton.getAttribute("title")).toBe("Ver expediente EXP-183");
  });

  it("habilitado: el tooltip dice la ETIQUETA y el clic dispara el handler una sola vez", () => {
    const abrirFicha = vi.fn();
    const { container } = render(
      <BotonAccionFila
        icono="mirar"
        etiqueta="Ver expediente EXP-183"
        onClick={abrirFicha}
      />,
    );

    expect(container.querySelector("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Ver expediente EXP-183",
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver expediente EXP-183" }));
    expect(abrirFicha).toHaveBeenCalledTimes(1);
  });

  it("🔴 deshabilitado: el tooltip dice el MOTIVO —no se vacía— y el clic NO dispara nada", () => {
    const noDebeCorrer = vi.fn();
    const motivo = "Acepte el caso para poder ver el expediente.";

    const { container } = render(
      <BotonAccionFila
        icono="mirar"
        etiqueta="Ver expediente EXP-183"
        motivo={motivo}
        deshabilitado
        onClick={noDebeCorrer}
      />,
    );

    expect(container.querySelector("[data-tip]")?.getAttribute("data-tip")).toBe(
      motivo,
    );

    const boton = screen.getByRole("button", { name: "Ver expediente EXP-183" });
    fireEvent.click(boton);
    expect(noDebeCorrer).not.toHaveBeenCalled();
    expect(boton.getAttribute("aria-disabled")).toBe("true");
  });

  it("🔴 el tooltip vive en el ENVOLTORIO, no en el botón apagado", () => {
    // Un `<button disabled>` no recibe eventos de puntero: si el `data-tip` estuviera en él, el
    // tooltip del caso apagado tendría el texto correcto y aun así no se mostraría nunca.
    const { container } = render(
      <BotonAccionFila
        icono="lineaDeTiempo"
        etiqueta="Línea de tiempo de EXP-183"
        motivo="El expediente todavía no tiene movimientos."
        deshabilitado
        onClick={vi.fn()}
      />,
    );

    const envoltorio = container.querySelector("[data-tip]");
    const boton = screen.getByRole("button", {
      name: "Línea de tiempo de EXP-183",
    });

    expect(envoltorio).not.toBe(boton);
    expect(envoltorio?.contains(boton)).toBe(true);
    expect(boton.hasAttribute("data-tip")).toBe(false);
  });

  it("deshabilitado SIN motivo cae a la etiqueta en vez de dejar el tooltip en blanco", () => {
    // Quien apaga la acción debería dar el motivo, pero si no lo da, un tooltip vacío es peor que
    // uno que al menos nombra la acción: es la regresión que este componente viene a corregir.
    const { container } = render(
      <BotonAccionFila
        icono="mirar"
        etiqueta="Ver expediente EXP-183"
        deshabilitado
        onClick={vi.fn()}
      />,
    );

    expect(container.querySelector("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Ver expediente EXP-183",
    );
  });
});
