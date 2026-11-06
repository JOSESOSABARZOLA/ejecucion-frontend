/**
 * Microservicio: ejecucion
 * Módulo: Recepción (DME)
 * Archivo: ModalReturnToDmr.test.tsx
 * Responsabilidad: Fijar la conducta del modal de devolución DESPUÉS de que dejara de preguntar un
 *   motivo en texto libre (2026-09-18).
 *
 *   ── LO QUE SE PRUEBA DE VERDAD ───────────────────────────────────────────────────────────────
 *   · Que YA NO HAY caja de motivo. Es el cambio entero: si volviera a aparecer, habría dos sitios
 *     donde explicar la misma devolución y uno de los dos acabaría ignorado.
 *   · Que un expediente sin observaciones NO se puede devolver, y que el modal DICE DÓNDE anotarlas
 *     en vez de limitarse a apagar el botón.
 *   · Que la llamada al backend va SIN motivo: lo compone él, por caso, con las observaciones de
 *     cada administrado.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-18
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: un rechazo del servidor se afirma en
 *   el aviso flotante y sin caja)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { errorDelServidor } from "../../test/errores";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ModalReturnToDmr from "./ModalReturnToDmr";
import type { EpasListItem } from "../../services/EpasService";
import type { IObservacion } from "../../interfaces/ICaseObservations";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  getNotificacionEstado: vi.fn(),
  returnToDmr: vi.fn(),
  devolverExpedienteADmr: vi.fn(),
  listar: vi.fn(),
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock("../../services/EpasService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/EpasService")>()),
  EpasService: {
    getNotificacionEstado: mocks.getNotificacionEstado,
    returnToDmr: mocks.returnToDmr,
    devolverExpedienteADmr: mocks.devolverExpedienteADmr,
  },
}));

vi.mock("../../services/ObservacionesService", () => ({
  ObservacionesService: { listar: mocks.listar, guardar: vi.fn() },
  default: { listar: mocks.listar, guardar: vi.fn() },
}));

const caso = { eejeId: 77, expNumber: "001-2026" } as EpasListItem;

const observaciones: IObservacion[] = [
  {
    obseId: 1,
    tipo: "CAMPO",
    clave: "admiLastname",
    etiqueta: "Apellido",
    texto: "No coincide con la cédula",
  },
  {
    obseId: 2,
    tipo: "DOCUMENTO",
    clave: "55",
    etiqueta: "Acta de inspección",
    texto: "Ilegible",
  },
];

const botonConfirmar = () =>
  screen.getByText(/Devolver a DMR|Devolver el expediente/i, {
    selector: "button",
  });

describe("ModalReturnToDmr — la devolución que ya no pregunta el motivo", () => {
  beforeEach(() => {
    mocks.addToast.mockReset();
    mocks.getNotificacionEstado
      .mockReset()
      .mockResolvedValue({ eejeId: 77, estado: "notificado" });
    mocks.returnToDmr.mockReset().mockResolvedValue(undefined);
    mocks.devolverExpedienteADmr
      .mockReset()
      .mockResolvedValue({ expId: 3, devueltos: 2, omitidos: 0 });
    mocks.listar.mockReset().mockResolvedValue(observaciones);
  });

  it("🔴 NO ofrece ninguna caja donde escribir un motivo: el motivo se anota en la ficha", async () => {
    render(<ModalReturnToDmr caseData={caso} onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    expect(document.querySelector("textarea")).toBeNull();
  });

  it("enseña lo anotado, y distingue lo observado en un campo de lo observado en un documento", async () => {
    render(<ModalReturnToDmr caseData={caso} onClose={vi.fn()} />);

    expect(
      await screen.findByText("No coincide con la cédula"),
    ).toBeInTheDocument();
    expect(screen.getByText("Acta de inspección")).toBeInTheDocument();
    expect(screen.getByText("Ilegible")).toBeInTheDocument();
    expect(screen.getByText("DOCUMENTO")).toBeInTheDocument();
  });

  it("🔴 un expediente SIN observaciones no se devuelve, y el modal dice dónde anotarlas", async () => {
    mocks.listar.mockResolvedValue([]);

    render(<ModalReturnToDmr caseData={caso} onClose={vi.fn()} />);

    expect(
      await screen.findByText(/no tiene observaciones/i),
    ).toBeInTheDocument();
    // Se APAGA, no se esconde: quien abra el modal tiene que ver que la acción existe.
    await waitFor(() => expect(botonConfirmar()).toBeDisabled());
    expect(screen.getByText(/anótelas en su ficha/i)).toBeInTheDocument();
  });

  it("confirmar devuelve el caso SIN mandar motivo: lo compone el backend con las observaciones", async () => {
    const onClose = vi.fn();
    render(<ModalReturnToDmr caseData={caso} onClose={onClose} />);
    await screen.findByText("No coincide con la cédula");

    fireEvent.click(botonConfirmar());

    await waitFor(() => expect(mocks.returnToDmr).toHaveBeenCalledWith(77));
    expect(onClose).toHaveBeenCalled();
  });

  it("con alcance de EXPEDIENTE dice cuántos administrados se devuelven y llama sin motivo", async () => {
    render(
      <ModalReturnToDmr
        caseData={{
          ...caso,
          expedienteScope: { expId: 3, expNumber: "001-2026", casosElegibles: 2 },
        }}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("No coincide con la cédula");

    expect(screen.getByText("2 administrados")).toBeInTheDocument();

    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.devolverExpedienteADmr).toHaveBeenCalledWith(3),
    );
  });
  it("un rechazo del servidor sale en el aviso flotante, sin caja, y el modal sigue abierto (quick 261028-kmg)", async () => {
    mocks.returnToDmr.mockRejectedValue(
      errorDelServidor("El EPAS ya no está en RECIBIDO."),
    );
    const onClose = vi.fn();
    render(<ModalReturnToDmr caseData={caso} onClose={onClose} />);
    await screen.findByText("No coincide con la cédula");

    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "El EPAS ya no está en RECIBIDO.",
      ),
    );
    expect(screen.queryByText("El EPAS ya no está en RECIBIDO.")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
