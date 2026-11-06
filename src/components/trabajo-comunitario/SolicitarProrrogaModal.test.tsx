/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/trabajo-comunitario (frontend)
 * Feature: El plazo del trabajo comunitario y la impugnación (quick 261028-mtg)
 * Archivo: SolicitarProrrogaModal.test.tsx
 * Responsabilidad: Fijar que el modal de prórroga dice cuántos días corrió el plazo una impugnación
 *   ya resuelta y que, con la suspensión abierta, explica que el plazo está detenido en vez de
 *   atribuirlo a una solicitud previa que no existe.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-29
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { EstadoTrabajoComunitario } from "../../services/TrabajoComunitarioService";
import { crearMiEpasAsignado } from "../../test/fixtures/miEpasAsignado";

const mocks = vi.hoisted(() => ({ estado: vi.fn() }));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../services/TrabajoComunitarioService", () => ({
  TrabajoComunitarioService: {
    estado: mocks.estado,
    solicitarProrroga: vi.fn(),
  },
}));

import SolicitarProrrogaModal from "./SolicitarProrrogaModal";

const BASE: EstadoTrabajoComunitario = {
  eejeId: 95,
  eejeStatus: "EN_TRABAJO_COMUNITARIO",
  plazoMeses: 2,
  venceAt: "2026-12-20T15:00:00.000Z",
  vencido: false,
  acogido: true,
  prorrogaDisponible: true,
  prorrogaMesesPrevistos: 1,
  prorrogaVenceAtPrevisto: "2027-01-20T15:00:00.000Z",
};

const montar = () =>
  render(
    <SolicitarProrrogaModal
      caso={crearMiEpasAsignado({ eejeId: 95 })}
      onClose={vi.fn()}
    />,
  );

describe("SolicitarProrrogaModal — la impugnación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con diasSuspendidos > 0 dice cuántos días corrió el plazo la impugnación", async () => {
    mocks.estado.mockResolvedValue({ ...BASE, diasSuspendidos: 12 });
    montar();
    expect(
      await screen.findByText(/plazo corrido 12 días por la\s+impugnación/i),
    ).toBeInTheDocument();
  });

  it("sin suspensiones no dice nada de la impugnación", async () => {
    mocks.estado.mockResolvedValue({ ...BASE, diasSuspendidos: 0 });
    montar();
    await screen.findByText("Plazo autorizado");
    expect(screen.queryByText(/impugnación/i)).toBeNull();
  });

  it("con la suspensión abierta explica que el plazo está detenido, no una solicitud previa", async () => {
    mocks.estado.mockResolvedValue({
      ...BASE,
      prorrogaDisponible: false,
      prorrogaMesesPrevistos: undefined,
      prorrogaVenceAtPrevisto: undefined,
      plazoSuspendidoDesde: "2026-10-16T15:00:00.000Z",
      diasRestantesAlSuspender: 30,
    });
    montar();
    expect(
      await screen.findByText(
        /el plazo está suspendido por la impugnación desde el .*\(le quedaban 30 días\)/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ya se presentó una solicitud/i)).toBeNull();
    expect(screen.getByText(/provisional/i)).toBeInTheDocument();
  });
});
