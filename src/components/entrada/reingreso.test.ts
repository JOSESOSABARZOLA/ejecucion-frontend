/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend) — tests
 * Feature: El reingreso con observaciones en la fila de la Bandeja de Entrada (Fase 03.24, Plan 24, G-01)
 * Archivo: reingreso.test.ts
 * Responsabilidad: Fijar la precedencia del estado de la fila (UI-SPEC §1.2) y los textos de §6.1
 *   para la fila y el aviso de remisión. Solo se usan campos de `EnvioLoteCaso`: el navegador no
 *   deduce nada de la lista de observaciones.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 */
import { describe, expect, it } from "vitest";
import {
  CHIP_REINGRESO_POR_VERIFICAR,
  ETIQUETA_REINGRESADO,
  fraseRetenidosPorVerificar,
  marcaDeLaFila,
  tituloChipReingreso,
  tituloPorDevolverNoCumplidas,
  tituloReingresadoBaja,
} from "./reingreso";
import type {
  EnvioLoteCaso,
  ReingresoResumen,
} from "../../services/EntradaLotesService";

const resumen = (
  overrides: Partial<ReingresoResumen> = {},
): ReingresoResumen => ({
  reingresadoAt: "2026-10-21T10:00:00.000Z",
  total: 3,
  porVerificar: 0,
  cumplidas: 3,
  noCumplidas: 0,
  ...overrides,
});

const caso = (overrides: Partial<EnvioLoteCaso> = {}): EnvioLoteCaso => ({
  envlcId: 1,
  eejeId: 10,
  eejeStatus: "RECIBIDO",
  porDevolver: false,
  ...overrides,
});

describe("marcaDeLaFila — EL ESTADO DE LA FILA, Y ES UNO SOLO (UI-SPEC §1.2)", () => {
  it("«Por devolver» gana al reingreso por verificar", () => {
    expect(
      marcaDeLaFila(
        caso({
          porDevolver: true,
          reingreso: resumen({ porVerificar: 2, cumplidas: 1 }),
        }),
      ),
    ).toBe("POR_DEVOLVER");
  });

  it("con observaciones por verificar y sin «Por devolver», la marca es el reingreso", () => {
    expect(
      marcaDeLaFila(
        caso({
          porDevolver: false,
          reingreso: resumen({ porVerificar: 1, cumplidas: 2 }),
        }),
      ),
    ).toBe("REINGRESO_POR_VERIFICAR");
  });

  it("sin nada por verificar, sin reingreso o con el campo ausente, se pinta el estado", () => {
    expect(
      marcaDeLaFila(
        caso({ porDevolver: false, reingreso: resumen({ porVerificar: 0 }) }),
      ),
    ).toBe("ESTADO");
    expect(marcaDeLaFila(caso({ reingreso: null }))).toBe("ESTADO");
    expect(marcaDeLaFila(caso({ reingreso: undefined }))).toBe("ESTADO");
    expect(marcaDeLaFila(caso({ porDevolver: undefined }))).toBe("ESTADO");
  });
});

describe("textos de la fila (UI-SPEC §6.1)", () => {
  it("las constantes son literales, sin abreviar", () => {
    expect(CHIP_REINGRESO_POR_VERIFICAR).toBe(
      "Reingresado · observaciones por verificar",
    );
    expect(ETIQUETA_REINGRESADO).toBe("Reingresado");
  });

  it("el title del chip dice el estado legal y las cifras del servidor", () => {
    expect(
      tituloChipReingreso("Recibido", resumen({ porVerificar: 2, total: 3 })),
    ).toBe(
      "Estado: Recibido. Resolución volvió a enviar este expediente tras su devolución a la DMR. Faltan por verificar 2 de 3 observaciones de la devolución anterior.",
    );
  });

  it("el title de la etiqueta baja sin observaciones anteriores no habla de ellas", () => {
    expect(tituloReingresadoBaja(resumen({ total: 0, cumplidas: 0 }))).toBe(
      "Resolución volvió a enviar este expediente tras su devolución a la DMR.",
    );
  });

  it("el title de la etiqueta baja con observaciones anteriores dice que están todas cumplidas", () => {
    expect(tituloReingresadoBaja(resumen({ total: 2, cumplidas: 2 }))).toBe(
      "Resolución volvió a enviar este expediente tras su devolución a la DMR. Observaciones de la devolución anterior: todas cumplidas.",
    );
  });

  it("el title de «Por devolver» por no cumplidas", () => {
    expect(tituloPorDevolverNoCumplidas("Recibido", 1)).toBe(
      "Estado: Recibido. 1 observación(es) de la devolución anterior no se cumplieron, así que se devuelve a la DMR.",
    );
  });
});

describe("fraseRetenidosPorVerificar — el aviso de la remisión (UI-SPEC §1.6)", () => {
  it("con retenidos por verificar añade la frase, con su espacio inicial", () => {
    expect(fraseRetenidosPorVerificar(2)).toBe(
      " 2 expediente(s) reingresado(s) con observaciones por verificar NO se remitieron: verifíquelas en su ficha.",
    );
  });

  it("con 0 o sin el campo no añade nada", () => {
    expect(fraseRetenidosPorVerificar(0)).toBe("");
    expect(fraseRetenidosPorVerificar(undefined)).toBe("");
  });
});
