/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/recepcion (frontend)
 * Feature: Red de seguridad de D-01 — 3.er consumidor de `Table.tsx` (Fase 03.19, Plan 01)
 * Archivo: ModalExtendedCases.test.tsx
 * Responsabilidad: Prueba de humo de render. No prueba ninguna regla de negocio: este modal es un
 *   consumidor HEREDADO de `Table.tsx` que llegó sin test, y su única función aquí es **delatar una
 *   regresión de firma o de render** cuando D-01 sustituya la tabla. Si el modal deja de pedir los
 *   expedientes ampliados, o deja de pintarlos, esto sale en rojo.
 *
 *   Dos conductas y nada más: que al montar se pida la lista UNA vez, y que una celda con dato real
 *   llegue al documento.
 *
 *   ── POR QUÉ EL CONTEO SE MIDE NADA MÁS PINTAR LA FILA ────────────────────────────────────────
 *   Medio segundo después del montaje, `FilterByColumn` provoca una petición idéntica por cada
 *   columna filtrable. Es deuda de `Table.tsx` documentada en `Table.test.tsx` (su `it.todo` (a));
 *   aquí se mide lo que importa a este modal: que abrirlo pide una vez.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CaseExtendedResponse } from "../../interfaces/ICaseExtended";
import ModalExtendedCases from "./ModalExtendedCases";

const mocks = vi.hoisted(() => ({
  getAllExtendedCases: vi.fn(),
}));

vi.mock("../../services/CaseService", () => ({
  CaseService: { getAllExtendedCases: mocks.getAllExtendedCases },
}));

// La columna de acciones se pinta (el modal no pasa `hideActionsColumn`) aunque su resolutor
// devuelva siempre cero acciones. `RowActions` exige `ToastProvider` y `ModalProvider` y arrastra los
// 16 modales del registro: se dobla, porque de esa columna esta prueba no mira nada.
vi.mock("../tabla/RowActions", () => ({ default: () => null }));

/** UN expediente ampliado con número reconocible: es el dato que tiene que llegar a la celda. */
const RESPUESTA: CaseExtendedResponse = {
  data: [
    {
      expedientNumber: "EPAS-2026-04101",
      administradoName: "Rosa",
      administradoLastName: "Imaginaria",
      administradoIdentification: "0000000000",
      extensionDaysAdded: 10,
      extensionNewDeadline: new Date("2026-10-01T00:00:00.000Z"),
      extensionReason: "Prórroga solicitada por el administrado",
      extensionStatus: "Aprobada",
    },
  ],
  total: 1,
  limit: 10,
  offset: 0,
  page: 1,
  pages: 1,
};

describe("ModalExtendedCases — humo de render sobre `Table.tsx` (3.er consumidor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllExtendedCases.mockResolvedValue(RESPUESTA);
  });

  it("al abrirse pide los expedientes ampliados UNA vez y los pinta", async () => {
    render(<ModalExtendedCases onClose={vi.fn()} />);

    expect(await screen.findByText("EPAS-2026-04101")).toBeInTheDocument();
    expect(screen.getByText("Rosa")).toBeInTheDocument();
    expect(mocks.getAllExtendedCases).toHaveBeenCalledTimes(1);
  });
});
