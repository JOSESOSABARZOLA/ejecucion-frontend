/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: Unidad pura del resolver de TURNO de firma secuencial del acta D2 (FEND-03/RECE-06) — Fase 3.5
 * Archivo: loteTurnActions.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES la DERIVACIÓN del turno de firma desde
 *   estado + firmaDecisorAt/firmaSecretarioAt/aprobadoAt (NUNCA desde rolSiguiente, ausente en las
 *   filas del lote). Cubre la matriz por rol/estado: decisor(PENDIENTE)→firmarDecisor,
 *   secretario(PARCIALMENTE_FIRMADO+firmaDecisor)→firmarSecretario,
 *   director(PARCIALMENTE_FIRMADO+firmaSecretario)→firmarDirector; rol fuera de turno / APROBADO /
 *   RECHAZADO → []; comparación de rol case-insensitive. También el gate ADVISORY del decisor
 *   (resolveDecisorFirmaGate). Unidad pura: no monta React.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 */

import { describe, it, expect } from "vitest";
import {
  resolveLoteTurnActions,
  resolveDecisorFirmaGate,
} from "./loteTurnActions";
import type { SorteoLote, MiEpasAsignado } from "../services/SorteoService";

/** Helper: construye un SorteoLote parcial tipado con la forma mínima que el resolver lee. */
function lote(partial: Partial<SorteoLote>): SorteoLote {
  return { amasId: 900, ...partial };
}

describe("resolveLoteTurnActions (turno derivado de estado+firmas — FEND-03)", () => {
  it("decisor sobre PENDIENTE sin firmaDecisorAt → ['firmarDecisor']", () => {
    expect(
      resolveLoteTurnActions(
        lote({ estado: "PENDIENTE" }),
        "funcionario decisor",
      ),
    ).toEqual(["firmarDecisor"]);
  });

  it("secretario sobre PARCIALMENTE_FIRMADO con firmaDecisorAt y sin firmaSecretarioAt → ['firmarSecretario']", () => {
    expect(
      resolveLoteTurnActions(
        lote({
          estado: "PARCIALMENTE_FIRMADO",
          firmaDecisorAt: "2026-07-23T10:00:00Z",
        }),
        "secretario abogado",
      ),
    ).toEqual(["firmarSecretario"]);
  });

  it("director sobre PARCIALMENTE_FIRMADO con firmaSecretarioAt y sin aprobadoAt → ['firmarDirector']", () => {
    expect(
      resolveLoteTurnActions(
        lote({
          estado: "PARCIALMENTE_FIRMADO",
          firmaDecisorAt: "2026-07-23T10:00:00Z",
          firmaSecretarioAt: "2026-07-23T11:00:00Z",
        }),
        "director",
      ),
    ).toEqual(["firmarDirector"]);
  });

  it("rol equivocado para el turno (director sobre PENDIENTE) → []", () => {
    expect(
      resolveLoteTurnActions(lote({ estado: "PENDIENTE" }), "director"),
    ).toEqual([]);
  });

  it("secretario sobre PARCIALMENTE_FIRMADO cuando aún no firmó el decisor → []", () => {
    expect(
      resolveLoteTurnActions(
        lote({ estado: "PARCIALMENTE_FIRMADO" }),
        "secretario abogado",
      ),
    ).toEqual([]);
  });

  it("director sobre PARCIALMENTE_FIRMADO cuando aún no firmó el secretario → []", () => {
    expect(
      resolveLoteTurnActions(
        lote({
          estado: "PARCIALMENTE_FIRMADO",
          firmaDecisorAt: "2026-07-23T10:00:00Z",
        }),
        "director",
      ),
    ).toEqual([]);
  });

  it("decisor sobre PENDIENTE que YA firmó (firmaDecisorAt presente) → []", () => {
    expect(
      resolveLoteTurnActions(
        lote({
          estado: "PENDIENTE",
          firmaDecisorAt: "2026-07-23T10:00:00Z",
        }),
        "funcionario decisor",
      ),
    ).toEqual([]);
  });

  it("lote APROBADO → [] para todos los roles", () => {
    const aprobado = lote({
      estado: "APROBADO",
      firmaDecisorAt: "2026-07-23T10:00:00Z",
      firmaSecretarioAt: "2026-07-23T11:00:00Z",
      aprobadoAt: "2026-07-23T12:00:00Z",
    });
    expect(resolveLoteTurnActions(aprobado, "funcionario decisor")).toEqual([]);
    expect(resolveLoteTurnActions(aprobado, "secretario abogado")).toEqual([]);
    expect(resolveLoteTurnActions(aprobado, "director")).toEqual([]);
  });

  it("lote RECHAZADO → [] para todos los roles", () => {
    const rechazado = lote({ estado: "RECHAZADO" });
    expect(resolveLoteTurnActions(rechazado, "funcionario decisor")).toEqual([]);
    expect(resolveLoteTurnActions(rechazado, "secretario abogado")).toEqual([]);
    expect(resolveLoteTurnActions(rechazado, "director")).toEqual([]);
  });

  it("la comparación de rol es case-insensitive (tolera espacios/mayúsculas)", () => {
    expect(
      resolveLoteTurnActions(lote({ estado: "PENDIENTE" }), "  Funcionario Decisor  "),
    ).toEqual(["firmarDecisor"]);
    expect(
      resolveLoteTurnActions(
        lote({
          estado: "PARCIALMENTE_FIRMADO",
          firmaDecisorAt: "2026-07-23T10:00:00Z",
        }),
        "SECRETARIO ABOGADO",
      ),
    ).toEqual(["firmarSecretario"]);
  });

  it("un rol desconocido nunca obtiene acción (default deny)", () => {
    expect(
      resolveLoteTurnActions(lote({ estado: "PENDIENTE" }), "auditor"),
    ).toEqual([]);
  });
});

describe("resolveDecisorFirmaGate (compuerta ADVISORY del decisor)", () => {
  it("true solo si TODOS los casos del grupo están aceptados (aceptadoImplicito)", () => {
    const grupo: MiEpasAsignado[] = [
      { cassId: 1, aceptadoImplicito: true },
      { cassId: 2, aceptadoImplicito: true },
    ];
    expect(resolveDecisorFirmaGate(grupo)).toBe(true);
  });

  it("false si queda algún caso pendiente (aceptadoImplicito !== true)", () => {
    const grupo: MiEpasAsignado[] = [
      { cassId: 1, aceptadoImplicito: true },
      { cassId: 2, aceptadoImplicito: false },
    ];
    expect(resolveDecisorFirmaGate(grupo)).toBe(false);
  });

  it("false para un grupo vacío (no hay nada que firmar)", () => {
    expect(resolveDecisorFirmaGate([])).toBe(false);
  });
});
