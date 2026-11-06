/**
 * Microservicio: ejecucion
 * Módulo: ejecucion (frontend, compartido)
 * Feature: La pista del estado vacío (Fase 03.19, Plan 08, UI-SPEC §5.1)
 * Archivo: EmptyState.test.tsx
 * Responsabilidad: `EmptyState` solo sabía decir una línea, y la bandeja del decisor necesita
 *   distinguir DOS vacíos que se parecen y no son el mismo:
 *
 *     · «No tiene expedientes asignados» — no hay nada que ver y no hay nada que hacer.
 *     · «Ningún expediente coincide con los filtros» — hay expedientes, y hay un filtro puesto.
 *
 *   Con doce columnas filtrables y scroll horizontal, confundirlos hace creer que la bandeja está
 *   vacía cuando lo que hay es un filtro olvidado en una columna que ni siquiera está en pantalla.
 *   Por eso la pista es una SEGUNDA LÍNEA de verdad y no un paréntesis dentro de la primera.
 *
 *   Y por eso la prop es OPCIONAL: los veintiún consumidores actuales siguen pasando solo `text`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("sin `hint` se comporta exactamente como antes: una sola línea", () => {
    const { container } = render(<EmptyState text="Cargando datos..." />);

    expect(screen.getByText("Cargando datos...")).toBeTruthy();
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("🔴 con `hint` dice las dos cosas: qué pasa y qué hacer", () => {
    render(
      <EmptyState
        text="Ningún expediente coincide con los filtros"
        hint="Quite algún filtro para ver más resultados. Hay filtros aplicados en columnas que pueden estar fuera de pantalla."
      />,
    );

    expect(
      screen.getByText("Ningún expediente coincide con los filtros"),
    ).toBeTruthy();
    expect(
      screen.getByText(/Hay filtros aplicados en columnas/),
    ).toBeTruthy();
  });

  it("la pista es una línea APARTE, no texto pegado al encabezado", () => {
    // Si las dos frases salieran en el mismo párrafo, el encabezado dejaría de leerse de un golpe
    // —que es todo lo que aporta— y daría igual haber separado los dos vacíos.
    const { container } = render(
      <EmptyState
        text="No tiene expedientes asignados"
        hint="Cuando el sorteo le asigne un EPAS aparecerá aquí."
      />,
    );

    const parrafos = Array.from(container.querySelectorAll("p"));
    expect(parrafos).toHaveLength(2);
    expect(parrafos[0].textContent).toBe("No tiene expedientes asignados");
    expect(parrafos[1].textContent).toBe(
      "Cuando el sorteo le asigne un EPAS aparecerá aquí.",
    );
  });
});
