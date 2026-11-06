/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend) — tests
 * Feature: La línea de estado no anuncia el reloj (Fase 03.24, Plan 18, G-16)
 * Archivo: anuncioSincronizacion.test.ts
 * Responsabilidad: Fijar la tabla de UI-SPEC §4.2: qué se anuncia al lector de pantalla cuando cambia
 *   el resultado de la sincronización con Resolución, y que no se anuncia nada en la primera lectura,
 *   con el mismo resultado seguido, mientras corre una pasada ni sin pasadas.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 */
import { describe, expect, it } from "vitest";
import {
  ANUNCIO_RECUPERADA,
  anuncioDelCambio,
  anuncioFallida,
  anuncioParcial,
} from "./anuncioSincronizacion";
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

const MOTIVO_401 = "Resolución respondió 401: credencial rechazada";

describe("anuncioSincronizacion — los textos de UI-SPEC §6.5", () => {
  it("falló: «La última sincronización falló: {motivo}.»", () => {
    expect(anuncioFallida(MOTIVO_401)).toBe(
      `La última sincronización falló: ${MOTIVO_401}.`,
    );
  });

  it("parcial: «La última sincronización terminó con {n} fallo(s).»", () => {
    expect(anuncioParcial(3)).toBe(
      "La última sincronización terminó con 3 fallo(s).",
    );
  });

  it("se recupera: «La sincronización vuelve a ser correcta.»", () => {
    expect(ANUNCIO_RECUPERADA).toBe("La sincronización vuelve a ser correcta.");
  });
});

describe("anuncioDelCambio — solo se anuncia el cambio de resultado (G-16)", () => {
  it("primera lectura (sin resultado anterior): nada, aunque sea FALLIDA", () => {
    expect(
      anuncioDelCambio(null, estado({ resultado: "FALLIDA", motivo: MOTIVO_401 })),
    ).toBeNull();
    expect(anuncioDelCambio(null, estado())).toBeNull();
  });

  it("CORRECTA → FALLIDA: «La última sincronización falló: {motivo}.»", () => {
    expect(
      anuncioDelCambio(
        "CORRECTA",
        estado({ resultado: "FALLIDA", motivo: MOTIVO_401 }),
      ),
    ).toBe(`La última sincronización falló: ${MOTIVO_401}.`);
  });

  it("CORRECTA → PARCIAL con 3 fallos: «… terminó con 3 fallo(s).»", () => {
    expect(
      anuncioDelCambio(
        "CORRECTA",
        estado({ resultado: "PARCIAL", fallosTotales: 3 }),
      ),
    ).toBe("La última sincronización terminó con 3 fallo(s).");
  });

  it.each(["FALLIDA", "PARCIAL"] as const)(
    "%s → CORRECTA: «La sincronización vuelve a ser correcta.»",
    (anterior) => {
      expect(anuncioDelCambio(anterior, estado())).toBe(ANUNCIO_RECUPERADA);
    },
  );

  it.each(["CORRECTA", "PARCIAL", "FALLIDA"] as const)(
    "%s → %s (mismo resultado, otro `fin`): nada",
    (resultado) => {
      expect(
        anuncioDelCambio(
          resultado,
          estado({
            resultado,
            motivo: resultado === "FALLIDA" ? MOTIVO_401 : null,
            fallosTotales: resultado === "CORRECTA" ? 0 : 2,
            fin: "2026-10-21T10:05:05.000Z",
          }),
        ),
      ).toBeNull();
    },
  );

  it("mientras corre una pasada («Sincronizando…»): nada", () => {
    expect(
      anuncioDelCambio(
        "CORRECTA",
        estado({ enCurso: true, resultado: "FALLIDA", motivo: MOTIVO_401 }),
      ),
    ).toBeNull();
  });

  it("sin pasadas (`NUNCA`): nada", () => {
    expect(
      anuncioDelCambio("FALLIDA", estado({ resultado: "NUNCA", fin: null })),
    ).toBeNull();
  });
});
