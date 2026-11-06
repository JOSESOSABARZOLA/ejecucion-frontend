/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend) — tests
 * Feature: La Bandeja se entera de lo que trajo la pasada (Fase 03.24, Plan 18, G-13)
 * Archivo: datosNuevos.test.ts
 * Responsabilidad: Fijar cuándo una pasada «trajo datos» (UI-SPEC §3.1) y los textos de §6.4.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 */
import { describe, expect, it } from "vitest";
import {
  ANUNCIO_CON_AVISO,
  ANUNCIO_RECARGA_SOLA,
  AVISO_DATOS_NUEVOS,
  BOTON_RECARGAR,
  trajoDatos,
  tituloDatosNuevos,
} from "./datosNuevos";
import type { EstadoSincronizacionResolucion } from "../../services/EntradaLotesService";

const estado = (
  overrides: Partial<EstadoSincronizacionResolucion> = {},
): EstadoSincronizacionResolucion => ({
  habilitada: true,
  intervaloMinutos: 5,
  enCurso: false,
  resultado: "CORRECTA",
  inicio: "2026-10-21T10:00:00.000Z",
  fin: "2026-10-21T10:00:05.000Z",
  motivo: null,
  lotes: 0,
  casosNuevos: 0,
  casosActualizados: 0,
  reingresados: 0,
  fallos: [],
  fallosTotales: 0,
  truncado: false,
  ...overrides,
});

describe("trajoDatos — una pasada trae datos si suma algo (UI-SPEC §3.1)", () => {
  it("sin casos nuevos, actualizados ni reingresados: no", () => {
    expect(trajoDatos(estado())).toBe(false);
  });

  it.each([
    ["casosNuevos", { casosNuevos: 1 }],
    ["casosActualizados", { casosActualizados: 2 }],
    ["reingresados", { reingresados: 1 }],
  ] as const)("con %s > 0: sí", (_campo, cifras) => {
    expect(trajoDatos(estado(cifras))).toBe(true);
  });

  it("los lotes solos no cuentan: lo que cambia la lista son los casos", () => {
    expect(trajoDatos(estado({ lotes: 3 }))).toBe(false);
  });
});

describe("datosNuevos — los textos de UI-SPEC §6.4", () => {
  it("el `title` del aviso enumera las tres cifras", () => {
    expect(
      tituloDatosNuevos(
        estado({ casosNuevos: 4, casosActualizados: 1, reingresados: 2 }),
      ),
    ).toBe(
      "La última sincronización trajo 4 caso(s) nuevo(s), 1 actualizado(s) y 2 reingresado(s).",
    );
  });

  it("aviso, botón y los dos anuncios", () => {
    expect(AVISO_DATOS_NUEVOS).toBe("Hay datos nuevos de Resolución");
    expect(BOTON_RECARGAR).toBe("Recargar");
    expect(ANUNCIO_RECARGA_SOLA).toBe(
      "Llegaron datos nuevos de Resolución y la bandeja se actualizó.",
    );
    expect(ANUNCIO_CON_AVISO).toBe(
      "Llegaron datos nuevos de Resolución. Pulse «Recargar» para verlos.",
    );
  });
});
