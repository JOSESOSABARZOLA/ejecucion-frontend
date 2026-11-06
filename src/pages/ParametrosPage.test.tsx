/**
 * Microservicio: ejecucion
 * Módulo: Parámetros del módulo (DME)
 * Feature: Los plazos de las alertas en la pantalla de Parámetros (quick 261030-m29)
 * Archivo: ParametrosPage.test.tsx
 * Responsabilidad: Fijar que un plazo en días HÁBILES se trata como PLAZO en la pantalla: su
 *   etiqueta, su unidad declarada (sin selector de una sola opción) y, con 0, el aviso del plazo que
 *   vence al arrancar —no el de los parámetros económicos—. Datos INVENTADOS.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-04
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq: el SBU, de unidad USD, se lee
 *   «USD 460,00» en la cabecera y en la confirmación; los plazos no cambian)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  historico: vi.fn(),
  actualizar: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock("../services/ParametroService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../services/ParametroService")>();
  return {
    ...real,
    ParametroService: {
      listar: mocks.listar,
      historico: mocks.historico,
      actualizar: mocks.actualizar,
    },
  };
});
vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

import ParametrosPage from "./ParametrosPage";

describe("ParametrosPage — los plazos en días hábiles (quick 261030-m29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.historico.mockResolvedValue([]);
    mocks.listar.mockResolvedValue([
      {
        id: 7,
        clave: "PLAZO_ORDEN_PAGO",
        valor: 5,
        unidad: "HABILES",
        descripcion: "Días para registrar la orden de pago",
        origen: "tabla",
      },
    ]);
  });

  it("lo lista con su etiqueta y su unidad", async () => {
    render(<ParametrosPage />);
    expect(
      await screen.findByText("Plazo para registrar la orden de pago"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("5 días hábiles (sin fines de semana ni feriados)"),
    ).toBeInTheDocument();
  });

  it("al editarlo con 0 avisa como PLAZO y declara la unidad sin selector", async () => {
    render(<ParametrosPage />);
    await screen.findByText("Plazo para registrar la orden de pago");

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "0" } });

    expect(
      screen.getByText("Un plazo de 0 vence en el mismo instante en que arranca."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("IN-08: con 0 en la anticipación del aviso del TC dice que avisa el mismo día, no que un plazo vence", async () => {
    mocks.listar.mockResolvedValue([
      {
        id: 8,
        clave: "AVISO_PREVIO_TRABAJO_COMUNITARIO",
        valor: 2,
        unidad: "HABILES",
        descripcion: "Días hábiles de anticipación del aviso",
        origen: "tabla",
      },
    ]);
    render(<ParametrosPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "0" } });

    expect(
      screen.getByText(
        "Con 0 el aviso sale el mismo día en que vence el plazo del trabajo comunitario.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Un plazo de 0 vence en el mismo instante en que arranca."),
    ).toBeNull();
  });
});

describe("ParametrosPage — el SBU en dólares (quick 261105-cvq)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.historico.mockResolvedValue([]);
    mocks.listar.mockResolvedValue([
      {
        id: 1,
        clave: "SBU_VIGENTE",
        valor: 460,
        unidad: "USD",
        descripcion: "Salario básico unificado, solo referencia",
        origen: "tabla",
      },
    ]);
  });

  it("se lee «USD 460,00», como en el compositor y el PDF, y no «460 dólares»", async () => {
    render(<ParametrosPage />);
    expect(await screen.findByText("USD 460,00")).toBeInTheDocument();
    expect(screen.queryByText(/460 dólares/)).toBeNull();
  });

  it("la confirmación dice Antes y Después en dólares; con la casilla vacía, Después es «—»", async () => {
    render(<ParametrosPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));

    // Sin tocar la casilla: la cabecera, Antes y Después dicen lo mismo.
    expect(screen.getAllByText("USD 460,00")).toHaveLength(3);

    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "470" } });
    expect(screen.getByText("USD 470,00")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "" } });
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
