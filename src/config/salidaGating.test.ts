/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Unidad pura del resolver de gating role-only de la Bandeja de Salida (D-06/D-10) — Fase 3.9
 * Archivo: salidaGating.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES el reparto por ROL de la acción de salida
 *   (role-only, SIN status): el secretario abogado y el director ven `enviarSg` (la Bandeja de Salida es
 *   COMPARTIDA, a diferencia del reparto exclusivo de la entrada); el funcionario decisor NO la ve. La
 *   comparación de rol es case-insensitive y una acción desconocida no es visible (default deny). Unidad
 *   pura: no monta React ni toca el enum EPAS.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 */

import { describe, it, expect } from "vitest";
import { isSalidaActionVisible } from "./salidaGating";

describe("isSalidaActionVisible (gating role-only — D-06)", () => {
  it("secretario abogado ve enviarSg", () => {
    expect(isSalidaActionVisible("enviarSg", "secretario abogado")).toBe(true);
  });

  it("director ve enviarSg", () => {
    expect(isSalidaActionVisible("enviarSg", "director")).toBe(true);
  });

  it("funcionario decisor NO ve enviarSg", () => {
    expect(isSalidaActionVisible("enviarSg", "funcionario decisor")).toBe(
      false,
    );
  });

  it("la comparación de rol es case-insensitive", () => {
    expect(isSalidaActionVisible("enviarSg", "Secretario Abogado")).toBe(true);
    expect(isSalidaActionVisible("enviarSg", "DIRECTOR")).toBe(true);
    expect(isSalidaActionVisible("enviarSg", "  Director  ")).toBe(true);
  });

  it("una acción desconocida no es visible para ningún rol", () => {
    expect(isSalidaActionVisible("accionInexistente", "director")).toBe(false);
    expect(
      isSalidaActionVisible("accionInexistente", "secretario abogado"),
    ).toBe(false);
  });

  /**
   * REVISAR OBSERVACIONES (2026-09-18) — la PRIMERA acción de esta bandeja que NO es compartida.
   *
   * 🔴 El secretario abogado despacha aquí, pero no revisa: él es quien anotó las observaciones. Si
   * pudiera aprobarlas, la revisión dejaría de ser un control y sería un paso más de su propio
   * trámite. Este test es el que impide que alguien «unifique» el reparto de la bandeja.
   */
  it("revisar observaciones lo ve SOLO el director, no el secretario que las anotó", () => {
    expect(isSalidaActionVisible("revisarObservaciones", "director")).toBe(
      true,
    );
    expect(
      isSalidaActionVisible("revisarObservaciones", "secretario abogado"),
    ).toBe(false);
    expect(
      isSalidaActionVisible("revisarObservaciones", "funcionario decisor"),
    ).toBe(false);
  });
});
