/**
 * Microservicio: ejecucion
 * Módulo: N/A (componentes comunes, frontend)
 * Feature: Alert con rol accesible configurable (Fase 03.24, cierre de huecos IN-02)
 * Archivo: Alert.test.tsx
 * Responsabilidad: Fijar que `Alert` sigue siendo asertivo (`role="alert"`) por defecto —ningún
 *   llamador existente cambia— y que con `rol` pinta `role="status"` o `role="note"`, para los
 *   avisos que ya están al abrir y no son un evento (UI-SPEC §1.5).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Alert from "./Alert";

describe("Alert — rol accesible (IN-02)", () => {
  it("sin `rol` pinta role=\"alert\", como hasta ahora", () => {
    render(<Alert variant="error" message="Algo falló" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Algo falló");
  });

  it("con rol=\"note\" pinta role=\"note\" y no es asertivo", () => {
    render(<Alert variant="info" rol="note" message="Información estática" />);
    expect(screen.getByRole("note")).toHaveTextContent("Información estática");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("con rol=\"status\" pinta role=\"status\"", () => {
    render(<Alert variant="success" rol="status" message="Hecho" />);
    expect(screen.getByRole("status")).toHaveTextContent("Hecho");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
