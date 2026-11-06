/**
 * Microservicio: ejecucion
 * Módulo: toasts (frontend)
 * Feature: El aviso flotante como canal único del resultado de una acción (quick 261028-kmg)
 * Archivo: ToastProvider.test.tsx
 * Responsabilidad: Fijar la conducta de la pila de avisos: error y advertencia se quedan hasta que el
 *   usuario los cierra (aunque quien llama pase una duración), éxito e información se van solos por
 *   su tiempo RESTANTE (un aviso nuevo no alarga la vida de los anteriores), el mismo aviso repetido
 *   se ve una vez y el desalojo de la pila de 3 tira primero el no persistente más antiguo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-28
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider } from "./ToastProvider";
import { useToast } from "../hooks/useToast";
import type { ToastType } from "../interfaces/IToast";

interface Disparo {
  etiqueta: string;
  tipo: ToastType;
  texto: string;
  titulo?: string;
  duracion?: number;
}

/** Consumidor de prueba: un botón por aviso que se quiere disparar. */
function Disparador({ disparos }: { disparos: Disparo[] }) {
  const { addToast } = useToast();
  return (
    <>
      {disparos.map((d) => (
        <button
          key={d.etiqueta}
          type="button"
          onClick={() => addToast(d.tipo, d.texto, d.titulo, d.duracion)}
        >
          {d.etiqueta}
        </button>
      ))}
    </>
  );
}

function montar(disparos: Disparo[]) {
  return render(
    <ToastProvider>
      <Disparador disparos={disparos} />
    </ToastProvider>,
  );
}

function pulsar(etiqueta: string) {
  fireEvent.click(screen.getByRole("button", { name: etiqueta }));
}

function avanzar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("ToastProvider — persistencia, auto-cierre, dedupe y desalojo (quick 261028-kmg)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("un aviso de error sigue en pantalla a los 60 s y «Cerrar aviso» lo quita", () => {
    montar([{ etiqueta: "err", tipo: "error", texto: "No se pudo guardar." }]);
    pulsar("err");
    avanzar(60000);
    expect(screen.getByText("No se pudo guardar.")).toBeInTheDocument();

    // El contenedor es un popover que jsdom no abre (no tiene la API): cuenta como oculto.
    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar aviso", hidden: true }),
    );
    expect(screen.queryByText("No se pudo guardar.")).not.toBeInTheDocument();
  });

  it("un error con duración explícita de 3000 también persiste: manda el tipo", () => {
    montar([
      { etiqueta: "err", tipo: "error", texto: "Falló la carga.", duracion: 3000 },
    ]);
    pulsar("err");
    avanzar(10000);
    expect(screen.getByText("Falló la carga.")).toBeInTheDocument();
  });

  it("una advertencia persiste igual que un error", () => {
    montar([{ etiqueta: "adv", tipo: "warning", texto: "Sin decisor resuelto." }]);
    pulsar("adv");
    avanzar(60000);
    expect(screen.getByText("Sin decisor resuelto.")).toBeInTheDocument();
  });

  it("un éxito y una información desaparecen a los 3 s", () => {
    montar([
      { etiqueta: "ok", tipo: "success", texto: "Guardado." },
      { etiqueta: "inf", tipo: "info", texto: "Para que sepa." },
    ]);
    pulsar("ok");
    pulsar("inf");
    avanzar(2999);
    expect(screen.getByText("Guardado.")).toBeInTheDocument();
    expect(screen.getByText("Para que sepa.")).toBeInTheDocument();
    avanzar(1);
    expect(screen.queryByText("Guardado.")).not.toBeInTheDocument();
    expect(screen.queryByText("Para que sepa.")).not.toBeInTheDocument();
  });

  it("un éxito con duración 5000 sigue a los 4000 y no a los 5000", () => {
    montar([{ etiqueta: "ok", tipo: "success", texto: "Enviado.", duracion: 5000 }]);
    pulsar("ok");
    avanzar(4000);
    expect(screen.getByText("Enviado.")).toBeInTheDocument();
    avanzar(1000);
    expect(screen.queryByText("Enviado.")).not.toBeInTheDocument();
  });

  it("un aviso nuevo no alarga la vida de los anteriores", () => {
    montar([
      { etiqueta: "a", tipo: "success", texto: "Éxito A." },
      { etiqueta: "b", tipo: "success", texto: "Éxito B." },
    ]);
    pulsar("a");
    avanzar(2000);
    pulsar("b");
    avanzar(1000); // t = 3000
    expect(screen.queryByText("Éxito A.")).not.toBeInTheDocument();
    expect(screen.getByText("Éxito B.")).toBeInTheDocument();
    avanzar(2000); // t = 5000
    expect(screen.queryByText("Éxito B.")).not.toBeInTheDocument();
  });

  it("el mismo tipo + texto + título disparado dos veces se ve una sola vez; otro texto sí se apila", () => {
    montar([
      { etiqueta: "x", tipo: "error", texto: "No se pudo enviar.", titulo: "Envío" },
      { etiqueta: "y", tipo: "error", texto: "Otro fallo." },
    ]);
    pulsar("x");
    pulsar("x");
    expect(screen.getAllByText("No se pudo enviar.")).toHaveLength(1);
    pulsar("y");
    expect(screen.getAllByText("No se pudo enviar.")).toHaveLength(1);
    expect(screen.getByText("Otro fallo.")).toBeInTheDocument();
  });

  it("con [error, éxito, éxito] un cuarto aviso desaloja el éxito más antiguo y el error sigue", () => {
    montar([
      { etiqueta: "e", tipo: "error", texto: "Error 1." },
      { etiqueta: "s1", tipo: "success", texto: "Éxito 1." },
      { etiqueta: "s2", tipo: "success", texto: "Éxito 2." },
      { etiqueta: "i", tipo: "info", texto: "Info 3." },
    ]);
    pulsar("e");
    pulsar("s1");
    pulsar("s2");
    pulsar("i");
    expect(screen.getByText("Error 1.")).toBeInTheDocument();
    expect(screen.queryByText("Éxito 1.")).not.toBeInTheDocument();
    expect(screen.getByText("Éxito 2.")).toBeInTheDocument();
    expect(screen.getByText("Info 3.")).toBeInTheDocument();
  });

  it("con tres errores, un cuarto desaloja el error más antiguo", () => {
    montar([
      { etiqueta: "e1", tipo: "error", texto: "Error 1." },
      { etiqueta: "e2", tipo: "error", texto: "Error 2." },
      { etiqueta: "e3", tipo: "error", texto: "Error 3." },
      { etiqueta: "e4", tipo: "error", texto: "Error 4." },
    ]);
    pulsar("e1");
    pulsar("e2");
    pulsar("e3");
    pulsar("e4");
    expect(screen.queryByText("Error 1.")).not.toBeInTheDocument();
    expect(screen.getByText("Error 2.")).toBeInTheDocument();
    expect(screen.getByText("Error 3.")).toBeInTheDocument();
    expect(screen.getByText("Error 4.")).toBeInTheDocument();
  });
});
