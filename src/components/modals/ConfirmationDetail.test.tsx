/**
 * Microservicio: ejecucion
 * Módulo: modales (frontend, compartido)
 * Feature: El aviso flotante como canal único del resultado de una acción (quick 261028-kmg)
 * Archivo: ConfirmationDetail.test.tsx
 * Responsabilidad: Fijar que la confirmación genérica ya NO pinta `message` en una caja: lo lleva al
 *   aviso flotante una sola vez por contenido (un objeto nuevo con el mismo texto no repite el aviso;
 *   que el mensaje desaparezca y vuelva, sí) y conserva el bloqueo del botón de confirmar mientras el
 *   padre tenga un mensaje puesto.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-28
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfirmationDetail from "./ConfirmationDetail";
import type { ToastType } from "../../interfaces/IToast";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

type Mensaje = { variant: ToastType; message: string } | undefined;

function vista(message: Mensaje) {
  return (
    <ConfirmationDetail
      headerKicker="Prueba"
      headerTitle="Confirmar la acción"
      statusCopy="Listo para confirmar"
      descriptionCopy="Se hará la acción."
      informationData={{ Lote: "L-1" }}
      onConfirm={vi.fn().mockResolvedValue(undefined)}
      onClose={vi.fn()}
      message={message}
    />
  );
}

const botonConfirmar = () => screen.getByRole("button", { name: "Confirmar" });

describe("ConfirmationDetail — el mensaje va al aviso flotante (quick 261028-kmg)", () => {
  beforeEach(() => {
    mocks.addToast.mockReset();
  });

  it("con un mensaje de error lo dice una vez en el aviso flotante, no en línea, y apaga Confirmar", () => {
    render(vista({ variant: "error", message: "No se pudo X." }));
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(mocks.addToast).toHaveBeenCalledWith("error", "No se pudo X.");
    expect(screen.queryByText("No se pudo X.")).not.toBeInTheDocument();
    expect(botonConfirmar()).toBeDisabled();
  });

  it("un objeto nuevo con el mismo contenido no repite el aviso", () => {
    const { rerender } = render(vista({ variant: "error", message: "No se pudo X." }));
    rerender(vista({ variant: "error", message: "No se pudo X." }));
    rerender(vista({ variant: "error", message: "No se pudo X." }));
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
  });

  it("si el mensaje desaparece Confirmar se enciende, y si vuelve el mismo se avisa otra vez", () => {
    const { rerender } = render(vista({ variant: "error", message: "No se pudo X." }));
    rerender(vista(undefined));
    expect(botonConfirmar()).toBeEnabled();
    rerender(vista({ variant: "error", message: "No se pudo X." }));
    expect(mocks.addToast).toHaveBeenCalledTimes(2);
    expect(botonConfirmar()).toBeDisabled();
  });

  it("la variante de éxito sale como éxito", () => {
    render(vista({ variant: "success", message: "Hecho." }));
    expect(mocks.addToast).toHaveBeenCalledWith("success", "Hecho.");
  });

  it("sin mensaje no se avisa nada", () => {
    render(vista(undefined));
    expect(mocks.addToast).not.toHaveBeenCalled();
    expect(botonConfirmar()).toBeEnabled();
  });
});
