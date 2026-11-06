/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/ordenes-pago (frontend)
 * Feature: La orden de pago suspendida por la impugnación (quick 261028-mtg)
 * Archivo: CeldaOrden.test.tsx
 * Responsabilidad: Fijar que la celda sin orden y no editable dice POR QUÉ cuando el expediente está
 *   suspendido por la impugnación, y que en cualquier otro caso no editable sigue diciendo solo
 *   «Pendiente» (de quién es no se dice).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-29
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CeldaOrden from "./CeldaOrden";
import { crearMiEpasAsignado } from "../../test/fixtures/miEpasAsignado";

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const SIN_ORDENES_NO_EDITABLE = { editable: false };

describe("CeldaOrden — suspendida por impugnación", () => {
  it("EN_IMPUGNACION y no editable: «Suspendida por impugnación», con el porqué en el title y sin campo", () => {
    render(
      <CeldaOrden
        row={crearMiEpasAsignado({
          eejeStatus: "EN_IMPUGNACION",
          ordenes: SIN_ORDENES_NO_EDITABLE,
        })}
        tipo="MULTA"
        onRegistrada={vi.fn()}
      />,
    );

    const texto = screen.getByText("Suspendida por impugnación");
    expect(texto.getAttribute("title")).toMatch(/hasta que la Procuraduría resuelva/);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("en otro estado y no editable sigue diciendo solo «Pendiente»", () => {
    render(
      <CeldaOrden
        row={crearMiEpasAsignado({
          eejeStatus: "EN_VERIFICACION_PAGO",
          ordenes: SIN_ORDENES_NO_EDITABLE,
        })}
        tipo="MULTA"
        onRegistrada={vi.fn()}
      />,
    );

    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.queryByText(/impugnación/i)).toBeNull();
  });
});
