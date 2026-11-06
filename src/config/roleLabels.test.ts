/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Etiquetas de rol para presentación (D-04) — unidad pura
 * Archivo: roleLabels.test.ts
 * Responsabilidad: Bloquear con aserciones ejecutables el contrato de presentación de ROLE_LABELS:
 *   el rol 'funcionario decisor' se muestra como "Funcionario Ejecutor", los otros roles mapeados
 *   rinden su etiqueta, y cualquier rol no mapeado hace passthrough (se muestra el rol_name crudo).
 *   Es una unidad pura: no monta React, solo ejerce la función `roleLabel`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 */

import { describe, it, expect } from "vitest";
import { ROLE_LABELS, roleLabel } from "./roleLabels";

describe("roleLabel (D-04)", () => {
  it("mapea 'funcionario decisor' -> 'Funcionario Ejecutor'", () => {
    expect(roleLabel("funcionario decisor")).toBe("Funcionario Ejecutor");
  });

  it("mapea 'secretario abogado' -> 'Secretario'", () => {
    expect(roleLabel("secretario abogado")).toBe("Secretario");
  });

  it("mapea 'director' -> 'Director'", () => {
    expect(roleLabel("director")).toBe("Director");
  });

  it("hace passthrough de un rol no mapeado conocido del dominio", () => {
    expect(roleLabel("delegado de trabajo comunitario")).toBe(
      "delegado de trabajo comunitario",
    );
  });

  it("hace passthrough de una cadena arbitraria (no la altera)", () => {
    expect(roleLabel("rol-inexistente-xyz")).toBe("rol-inexistente-xyz");
  });

  it("no 'corrige' Title Case: la clave del backend es minúsculas exactas", () => {
    // Si alguien pasa 'Funcionario Decisor' (Title Case) NO debe acertar el mapa
    // y cae al passthrough — protege la nota del roleLabels.ts sobre claves exactas.
    expect(roleLabel("Funcionario Decisor")).toBe("Funcionario Decisor");
  });

  it("las claves de ROLE_LABELS están en minúsculas exactas del backend", () => {
    expect(ROLE_LABELS).toHaveProperty("funcionario decisor");
    expect(ROLE_LABELS).not.toHaveProperty("Funcionario Decisor");
  });
});
