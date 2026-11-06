/**
 * Microservicio: ejecucion
 * Módulo: inbox (frontend)
 * Feature: Cabecera de «Usuarios asignados» en el resultado del sorteo
 * Archivo: CollapseAssignedUsers.test.tsx
 * Responsabilidad: Fijar que la cabecera de cada usuario asignado enseña su NOMBRE COMPLETO cuando se
 *   conoce, y que «Usuario ( id )» queda solo como respaldo para quien no tiene nombre (ni desaparece
 *   ni recibe un nombre inventado).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-16
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CollapseAssignedUsers from "./CollapseAssignedUsers";
import type { AssignmentResult } from "../../interfaces/IAssignmentResult";

/** Un caso asignado mínimo: solo importan la materia y las fechas que pinta la cabecera. */
const RESULTADO: AssignmentResult = {
  id: 1,
  assignmentMasterId: 900001000,
  masterStatusId: 0,
  masterStatusName: "En espera",
  parentId: 0,
  assignmentStatusId: 0,
  assignmentStatusName: "",
  subId: 0,
  subName: "AMBIENTE",
  caseId: 201,
  userId: 4,
  assignedAt: new Date("2026-10-16T12:00:00.000Z"),
  unassignedAt: null,
  assignedBy: 0,
  reason: null,
  casePoints: 0,
  requestedBy: null,
  requestedAt: null,
  approvedBy: 0,
  approvedAt: new Date("2026-10-16T12:00:00.000Z"),
  rejectedBy: null,
  rejectedAt: null,
};

describe("CollapseAssignedUsers — cabecera del usuario asignado", () => {
  it("enseña el nombre completo del usuario y no «Usuario ( id )»", () => {
    render(
      <CollapseAssignedUsers
        item={{ userId: 4, userName: "Andres Decisor", results: [RESULTADO] }}
        index={0}
      />,
    );

    const titulo = screen.getByRole("heading", { level: 3 });
    expect(titulo).toHaveTextContent("1.Andres Decisor");
    expect(titulo).not.toHaveTextContent("Usuario (");
    expect(screen.getByText("Expedientes asignados: 1")).toBeInTheDocument();
  });

  it("sin nombre conocido cae a «Usuario ( id )»: el usuario no desaparece", () => {
    render(
      <CollapseAssignedUsers
        item={{ userId: 6457, results: [{ ...RESULTADO, userId: 6457 }] }}
        index={1}
      />,
    );

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "2.Usuario ( 6457 )",
    );
  });

  it("un nombre en blanco cuenta como desconocido y también cae al id", () => {
    render(
      <CollapseAssignedUsers
        item={{ userId: 7066, userName: "   ", results: [{ ...RESULTADO, userId: 7066 }] }}
        index={0}
      />,
    );

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Usuario ( 7066 )",
    );
  });
});
