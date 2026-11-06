/**
 * Microservicio: ejecucion
 * Módulo: Kit de tabla (compartido)
 * Feature: Corrección del tooltip y del nombre accesible de los botones de fila (Fase 03.19, Plan 08)
 * Archivo: ActionButton.test.tsx
 * Responsabilidad: `ActionButton` lo montan las CUATRO pantallas que usan `Table.tsx`, así que su
 *   defecto no es de la bandeja del decisor: es del módulo entero. Lo que se protege aquí son las
 *   dos correcciones, porque las dos son invisibles mirando la pantalla y por eso llevan desde
 *   marzo sin que nadie las notara:
 *
 *     · Los botones no tenían `aria-label`. Un botón de solo icono sin nombre accesible se anuncia
 *       «botón»: la fila entera era «botón, botón» para un lector de pantalla.
 *     · El tooltip se VACIABA cuando la acción estaba deshabilitada. Es el único momento en que el
 *       funcionario pregunta «¿por qué no puedo?», y era justo el momento en que la pantalla se
 *       callaba. `actiDisabledHint` ya viajaba en los datos desde la Fase 03.18 y no se pintaba
 *       en ningún sitio.
 *
 *   La firma del componente NO cambia: lo consumen `RowActions` y su prueba de la 03.18, que sigue
 *   verde.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UserActions } from "../../interfaces/IUser";
import ActionButton from "./ActionButton";

/** Acción mínima: a este componente solo le importan etiqueta, icono, apagado y motivo. */
const accion = (extra: Partial<UserActions> = {}): UserActions =>
  ({
    actiId: 1,
    submId: 1,
    actiName: "caseReview",
    actiLabel: "Ver expediente",
    actiContext: "epas",
    actiIconName: "mirar",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: true,
    ...extra,
  }) as unknown as UserActions;

describe("ActionButton", () => {
  it("🔴 el botón de icono se llama por su etiqueta, no «botón»", () => {
    render(<ActionButton items={[accion()]} onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Ver expediente" })).toBeTruthy();
  });

  it("habilitado: el tooltip dice la etiqueta", () => {
    const { container } = render(
      <ActionButton items={[accion()]} onClick={vi.fn()} />,
    );

    expect(container.querySelector("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Ver expediente",
    );
  });

  it("🔴 deshabilitado: el tooltip dice el MOTIVO, en vez de quedarse en blanco", () => {
    const motivo = "Acepte el caso para poder ver el expediente.";
    const { container } = render(
      <ActionButton
        items={[accion({ actiIsDisabled: true, actiDisabledHint: motivo })]}
        onClick={vi.fn()}
      />,
    );

    expect(container.querySelector("[data-tip]")?.getAttribute("data-tip")).toBe(
      motivo,
    );
    expect(
      screen.getByRole("button", { name: "Ver expediente" }),
    ).toHaveProperty("disabled", true);
  });

  it("deshabilitado sin motivo: cae a la etiqueta, nunca a la cadena vacía", () => {
    const { container } = render(
      <ActionButton items={[accion({ actiIsDisabled: true })]} onClick={vi.fn()} />,
    );

    expect(container.querySelector("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Ver expediente",
    );
  });
});
