/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/dashboard (frontend)
 * Feature: Indicadores de gestión con alcance por rol — tests
 * Archivo: DashboardPage.test.tsx
 * Responsabilidad: Sostener las cuatro conductas del tablero que no son «pintar números»:
 *
 *     1. que el 403 de un rol sin tablero se EXPLIQUE en vez de parecer una pantalla rota — y es el
 *        caso que más va a pasar, porque el tablero es la página de aterrizaje de TODOS (`/home` →
 *        `dashboard`) y la ruta no tiene gate por rol;
 *     2. que un error de verdad se distinga del 403 y ofrezca reintentar;
 *     3. que el administrador no vea anillos a cero, que no es informar sino parecer roto;
 *     4. 🔴 que la CONCENTRACIÓN no se enseñe con una sola persona en el alcance: a un decisor le
 *        saldría siempre «100 % de la carga», que no significa nada y se lee como una alarma.
 *
 *   jsdom no carga CSS, así que esto afirma estructura y texto, nunca aspecto.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-02
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Tablero } from "../services/DashboardService";
import DashboardPage from "./DashboardPage";

const mocks = vi.hoisted(() => ({ obtener: vi.fn() }));

vi.mock("../services/DashboardService", () => ({
  DashboardService: { obtener: mocks.obtener },
}));

const tableroDe = (parcial: Partial<Tablero> = {}): Tablero => ({
  alcance: { rol: "director", personas: 3, sinExpedientesPorRol: false },
  totales: {
    expedientes: 157,
    activos: 147,
    archivados: 3,
    devueltos: 7,
    sinAsignar: 64,
  },
  porEstado: [
    { estado: "RECIBIDO", total: 58 },
    { estado: "EN_VERIFICACION_PAGO", total: 43 },
  ],
  carga: [
    {
      usuarioId: 4,
      nombre: "Andres Decisor",
      rol: "funcionario decisor",
      llevaExpedientes: true,
      expedientesActivos: 68,
      concentracionPorcentaje: 82,
      aceptacionVencida: 7,
      actosUltimos30Dias: 364,
    },
  ],
  plazos: {
    aceptacionVencida: 22,
    aceptacionEnPlazo: 0,
    trabajoComunitarioEnCurso: 1,
  },
  excusas: [],
  ...parcial,
});

describe("DashboardPage", () => {
  beforeEach(() => {
    mocks.obtener.mockReset();
  });

  it("pide el tablero UNA vez al montar, y sin parámetros", async () => {
    mocks.obtener.mockResolvedValue(tableroDe());

    render(<DashboardPage />);

    await waitFor(() => expect(mocks.obtener).toHaveBeenCalledTimes(1));
    // El alcance lo resuelve el servidor con el JWT: si esta pantalla mandara el usuario, la
    // autorización dependería de que mande el número correcto.
    expect(mocks.obtener).toHaveBeenCalledWith();
  });

  it("pinta los totales y la carga con los datos del servidor", async () => {
    mocks.obtener.mockResolvedValue(tableroDe());

    render(<DashboardPage />);

    expect(await screen.findByText("147")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("Andres Decisor")).toBeInTheDocument();
    expect(screen.getByText(/Alcance: 3 personas/)).toBeInTheDocument();
  });

  it("🔴 un 403 se explica: el rol no tiene tablero, y no se ofrece reintentar", async () => {
    mocks.obtener.mockRejectedValue({ response: { status: 403 } });

    render(<DashboardPage />);

    expect(
      await screen.findByText(/Su rol no tiene tablero de indicadores/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reintentar/i }),
    ).not.toBeInTheDocument();
  });

  it("un error de verdad se distingue del 403 y SÍ ofrece reintentar", async () => {
    mocks.obtener.mockRejectedValue({ response: { status: 500 } });

    render(<DashboardPage />);

    expect(
      await screen.findByText(/No se pudieron cargar los indicadores/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reintentar/i }),
    ).toBeInTheDocument();
  });

  it("el administrador no recibe anillos a cero, recibe una explicación", async () => {
    mocks.obtener.mockResolvedValue(
      tableroDe({
        alcance: {
          rol: "administrador",
          personas: 1,
          sinExpedientesPorRol: true,
        },
        totales: {
          expedientes: 0,
          activos: 0,
          archivados: 0,
          devueltos: 0,
          sinAsignar: 0,
        },
        porEstado: [],
        carga: [],
      }),
    );

    render(<DashboardPage />);

    expect(
      await screen.findByText(/Su rol no lleva expedientes/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Carga por decisor")).not.toBeInTheDocument();
  });

  describe("la concentración", () => {
    it("🔴 NO se enseña con una sola persona en el alcance", async () => {
      mocks.obtener.mockResolvedValue(
        tableroDe({
          alcance: {
            rol: "funcionario decisor",
            personas: 1,
            sinExpedientesPorRol: false,
          },
          carga: [
            {
              usuarioId: 4,
              nombre: "Andres Decisor",
              rol: "funcionario decisor",
              llevaExpedientes: true,
              expedientesActivos: 68,
              // El servidor manda 100 porque está solo en su alcance; la pantalla lo calla.
              concentracionPorcentaje: 100,
              aceptacionVencida: 7,
              actosUltimos30Dias: 364,
            },
          ],
        }),
      );

      render(<DashboardPage />);

      await screen.findByText("Andres Decisor");
      expect(screen.queryByText(/100% de la carga/)).not.toBeInTheDocument();
      expect(screen.getByText(/Alcance: solo usted/)).toBeInTheDocument();
    });

    it("sí se enseña con varias personas", async () => {
      mocks.obtener.mockResolvedValue(tableroDe());

      render(<DashboardPage />);

      expect(await screen.findByText(/82% de la carga/)).toBeInTheDocument();
    });
  });

  it("la aceptación vencida se señala sobre la fila de quien la tiene", async () => {
    mocks.obtener.mockResolvedValue(tableroDe());

    render(<DashboardPage />);

    expect(
      await screen.findByText(/7 sin aceptar a tiempo/),
    ).toBeInTheDocument();
  });
});
