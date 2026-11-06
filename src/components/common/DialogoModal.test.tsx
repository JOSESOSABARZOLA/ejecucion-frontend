/**
 * Microservicio: ejecucion
 * Módulo: ejecucion (frontend, compartido)
 * Feature: Cerrar los modales al pulsar fuera (quick 261019-mcf)
 * Archivo: DialogoModal.test.tsx
 * Responsabilidad: Fijar la regla de cierre de `DialogoModal`: el fondo cierra solo si el gesto
 *   EMPIEZA y ACABA en él (un arrastre desde dentro no), con cambios pregunta y «Seguir editando» no
 *   cierra, con un envío en curso no hace nada, y Escape obedece exactamente a lo mismo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-19
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DialogoModal from "./DialogoModal";

const montar = (props: { hayCambios?: boolean; ocupado?: boolean } = {}) => {
  const onCerrar = vi.fn();
  const utilidades = render(
    <DialogoModal
      open
      className="modal modal-open"
      data-testid="fondo"
      onCerrar={onCerrar}
      {...props}
    >
      <div className="modal-box">
        <p>Contenido del modal</p>
        <input aria-label="Campo" />
      </div>
    </DialogoModal>,
  );
  return { onCerrar, fondo: screen.getByTestId("fondo"), ...utilidades };
};

/** Un clic completo: `pointerdown` en `abajo`, `click` en `arriba` (el ancestro común). */
const pulsar = (abajo: Element, arriba: Element = abajo) => {
  fireEvent.pointerDown(abajo);
  fireEvent.click(arriba);
};

describe("DialogoModal — cerrar al pulsar fuera", () => {
  it("un clic en el fondo cierra", () => {
    const { onCerrar, fondo } = montar();
    pulsar(fondo);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("un clic dentro del modal no cierra", () => {
    const { onCerrar } = montar();
    pulsar(screen.getByText("Contenido del modal"));
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it("arrastrar desde dentro y soltar en el fondo NO cierra", () => {
    const { onCerrar, fondo } = montar();
    // El navegador entrega el `click` al ancestro común: el propio `<dialog>`.
    pulsar(screen.getByLabelText("Campo"), fondo);
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it("con cambios pregunta, y «Seguir editando» deja el modal como estaba", () => {
    const { onCerrar, fondo } = montar({ hayCambios: true });
    pulsar(fondo);

    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByText("Contenido del modal")).toBeInTheDocument();
  });

  it("con cambios, «Descartar» cierra", () => {
    const { onCerrar, fondo } = montar({ hayCambios: true });
    pulsar(fondo);
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("un clic en el fondo de la confirmación equivale a seguir editando, y no cierra el modal", () => {
    const { onCerrar, fondo } = montar({ hayCambios: true });
    pulsar(fondo);
    pulsar(screen.getByRole("alertdialog"));
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it("ocupado ignora el clic en el fondo, con o sin cambios", () => {
    const { onCerrar, fondo } = montar({ ocupado: true, hayCambios: true });
    pulsar(fondo);
    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
  });
});

describe("DialogoModal — Escape, con la misma regla", () => {
  it("sin cambios cierra, y ataja la conducta nativa", () => {
    const { onCerrar } = montar();
    const evento = fireEvent.keyDown(screen.getByLabelText("Campo"), {
      key: "Escape",
    });
    expect(onCerrar).toHaveBeenCalledTimes(1);
    // `fireEvent` devuelve false cuando se llamó a `preventDefault()`.
    expect(evento).toBe(false);
  });

  it("con cambios pregunta en vez de cerrar; Escape en la pregunta vuelve al modal", () => {
    const { onCerrar } = montar({ hayCambios: true });
    fireEvent.keyDown(screen.getByLabelText("Campo"), { key: "Escape" });
    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: "Seguir editando" }), {
      key: "Escape",
    });
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it("ocupado ignora Escape y aun así impide el cierre nativo", () => {
    const { onCerrar, fondo } = montar({ ocupado: true });
    const evento = fireEvent.keyDown(screen.getByLabelText("Campo"), {
      key: "Escape",
    });
    expect(evento).toBe(false);
    const cancelado = fireEvent(
      fondo,
      new Event("cancel", { cancelable: true }),
    );
    expect(cancelado).toBe(false);
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it("el `cancel` nativo del <dialog> pasa por la misma regla", () => {
    const { onCerrar, fondo } = montar();
    fireEvent(fondo, new Event("cancel", { cancelable: true }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("si un hijo ya trató su Escape, el modal no se entera", () => {
    const onCerrar = vi.fn();
    render(
      <DialogoModal open className="modal modal-open" onCerrar={onCerrar}>
        <input
          aria-label="Desplegable"
          onKeyDown={(e) => {
            if (e.key === "Escape") e.preventDefault();
          }}
        />
      </DialogoModal>,
    );
    fireEvent.keyDown(screen.getByLabelText("Desplegable"), { key: "Escape" });
    expect(onCerrar).not.toHaveBeenCalled();
  });
});

describe("DialogoModal — anidados", () => {
  it("el clic en el fondo del de arriba cierra solo el de arriba", () => {
    const cerrarAbajo = vi.fn();
    const cerrarArriba = vi.fn();
    render(
      <DialogoModal
        open
        className="modal modal-open"
        data-testid="abajo"
        onCerrar={cerrarAbajo}
      >
        <div className="modal-box">Formulario</div>
        <DialogoModal
          open
          className="modal modal-open"
          data-testid="arriba"
          onCerrar={cerrarArriba}
        >
          <div className="modal-box">
            <input aria-label="Confirmación" />
          </div>
        </DialogoModal>
      </DialogoModal>,
    );

    pulsar(screen.getByTestId("arriba"));
    expect(cerrarArriba).toHaveBeenCalledTimes(1);
    expect(cerrarAbajo).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByLabelText("Confirmación"), { key: "Escape" });
    expect(cerrarArriba).toHaveBeenCalledTimes(2);
    expect(cerrarAbajo).not.toHaveBeenCalled();
  });
});
