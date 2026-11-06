/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Unidad pura del resolver de gating role-only de la Bandeja de Entrada (D-06/D-10) — Fase 3.8
 * Archivo: entradaGating.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES el reparto por ROL de las acciones de entrada
 *   (opción A del RESEARCH, role-only, SIN status): el secretario ve aprobar-enviar-sorteo pero NO
 *   approve-director; el director ve approve-director pero NO aprobar-enviar-sorteo; el funcionario
 *   decisor no ve ninguna. La comparación de rol es case-insensitive. Unidad pura: no monta React ni
 *   toca el enum EPAS.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 07, D-09): la acción de sincronización
 *   manual sale del mapa (la sincronización con Resolución es automática); una prueba fija que su
 *   nombre retirado cae en el default deny para todos los roles.
 */

import { describe, it, expect } from "vitest";
import { ENTRADA_ACTION_ROLES, isEntradaActionVisible } from "./entradaGating";

describe("isEntradaActionVisible (gating role-only — D-06)", () => {
  it("secretario abogado ve aprobarEnviarSorteo", () => {
    expect(
      isEntradaActionVisible("aprobarEnviarSorteo", "secretario abogado"),
    ).toBe(true);
  });

  it("secretario abogado NO ve approveDirectorEntrada", () => {
    expect(
      isEntradaActionVisible("approveDirectorEntrada", "secretario abogado"),
    ).toBe(false);
  });

  it("director ve approveDirectorEntrada", () => {
    expect(isEntradaActionVisible("approveDirectorEntrada", "director")).toBe(
      true,
    );
  });

  it("director NO ve aprobarEnviarSorteo", () => {
    expect(isEntradaActionVisible("aprobarEnviarSorteo", "director")).toBe(
      false,
    );
  });

  it("funcionario decisor no ve ninguna de las acciones de entrada", () => {
    expect(
      isEntradaActionVisible("aprobarEnviarSorteo", "funcionario decisor"),
    ).toBe(false);
    expect(
      isEntradaActionVisible("approveDirectorEntrada", "funcionario decisor"),
    ).toBe(false);
  });

  it("devolverDmr es COMPARTIDA: director y secretario abogado la ven; el decisor no", () => {
    expect(isEntradaActionVisible("devolverDmr", "director")).toBe(true);
    expect(isEntradaActionVisible("devolverDmr", "secretario abogado")).toBe(
      true,
    );
    expect(isEntradaActionVisible("devolverDmr", "funcionario decisor")).toBe(
      false,
    );
  });

  it("la comparación de rol es case-insensitive", () => {
    expect(
      isEntradaActionVisible("approveDirectorEntrada", "DIRECTOR"),
    ).toBe(true);
    expect(
      isEntradaActionVisible("aprobarEnviarSorteo", "  Secretario Abogado  "),
    ).toBe(true);
  });

  it("una acción desconocida no es visible para ningún rol", () => {
    expect(isEntradaActionVisible("accionInexistente", "director")).toBe(false);
    expect(
      isEntradaActionVisible("accionInexistente", "secretario abogado"),
    ).toBe(false);
  });

  it("🔴 la sincronización manual se retiró (Fase 03.24, D-09): su nombre cae en el default deny", () => {
    for (const rol of ["secretario abogado", "director", "funcionario decisor"]) {
      expect(isEntradaActionVisible("syncIngresos", rol)).toBe(false);
    }
  });

  it("el mapa queda con las tres acciones que siguen vivas, y su reparto no cambia", () => {
    expect(ENTRADA_ACTION_ROLES).toEqual({
      aprobarEnviarSorteo: ["secretario abogado"],
      approveDirectorEntrada: ["director"],
      devolverDmr: ["director", "secretario abogado"],
    });
  });
});
