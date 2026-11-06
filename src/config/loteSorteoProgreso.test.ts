/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Progreso de sorteo de un lote — unidad pura
 * Archivo: loteSorteoProgreso.test.ts
 * Responsabilidad: Fijar la REGRESIÓN que motivó este módulo: un lote cuyos casos avanzaron más allá
 *   de `ASIGNADO_DECISOR` volvía a mostrarse como «Por sortear» y re-ofrecía el botón de enviar a
 *   sorteo. La cuenta se hace por NEGACIÓN, así que ningún estado futuro puede reintroducirla.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-28
 */

import { describe, expect, it } from "vitest";
import type { EnvioLoteCaso } from "../services/EntradaLotesService";
import {
  contarProgresoSorteo,
  noQuedaNadaPorSortear,
  seMuestraEnSorteo,
} from "./loteSorteoProgreso";

/** Caso aterrizado en el estado dado. */
const caso = (eejeStatus?: string): EnvioLoteCaso => ({
  eejeId: 1,
  eejeStatus,
});

/** Caso aún NO aterrizado: sin eeje_id y sin estado. */
const casoSinAterrizar = (): EnvioLoteCaso => ({ envlcCaseRef: 99 });

describe("contarProgresoSorteo", () => {
  it("cuenta como PENDIENTE lo que todavía puede sortearse (RECIBIDO, VERIFICADO)", () => {
    const progreso = contarProgresoSorteo([
      caso("RECIBIDO"),
      caso("VERIFICADO"),
    ]);

    expect(progreso).toEqual({
      total: 2,
      pendientes: 2,
      sorteados: 0,
      descartados: 0,
    });
    expect(noQuedaNadaPorSortear(progreso)).toBe(false);
  });

  it("cuenta como PENDIENTE el caso aún sin aterrizar (sin eejeStatus)", () => {
    const progreso = contarProgresoSorteo([
      casoSinAterrizar(),
      caso("ASIGNADO_DECISOR"),
    ]);

    expect(progreso.pendientes).toBe(1);
    expect(progreso.sorteados).toBe(1);
    expect(noQuedaNadaPorSortear(progreso)).toBe(false);
  });

  it("🔴 REGRESIÓN: los estados POSTERIORES al sorteo siguen contando como sorteados", () => {
    // Este es el bug reportado el 2026-08-28: el conjunto cerrado {SORTEADO, ASIGNADO_DECISOR}
    // dejaba de contar el caso en cuanto avanzaba, y el lote retrocedía a «Por sortear».
    const posteriores = [
      "SORTEADO",
      "ASIGNADO_DECISOR",
      "EN_VERIFICACION_PAGO",
      "EN_TRABAJO_COMUNITARIO",
      "PENDIENTE_COACTIVA",
      "CUMPLIDO",
      "ARCHIVADO",
      "EN_IMPUGNACION",
      "EN_PRESCRIPCION",
      "EN_EJECUCION_HACER",
    ];

    for (const estado of posteriores) {
      const progreso = contarProgresoSorteo([caso(estado)]);
      expect(progreso.pendientes, `${estado} no debe quedar pendiente`).toBe(0);
      expect(progreso.sorteados, `${estado} cuenta como sorteado`).toBe(1);
      expect(noQuedaNadaPorSortear(progreso)).toBe(true);
      expect(seMuestraEnSorteo(progreso)).toBe(true);
    }
  });

  it("reproduce el lote 107: ASIGNADO_DECISOR + CUMPLIDO ya no queda pendiente", () => {
    const progreso = contarProgresoSorteo([
      caso("ASIGNADO_DECISOR"),
      caso("ASIGNADO_DECISOR"),
      caso("ASIGNADO_DECISOR"),
      caso("CUMPLIDO"),
    ]);

    expect(progreso.pendientes).toBe(0);
    expect(progreso.sorteados).toBe(4);
    expect(seMuestraEnSorteo(progreso)).toBe(true);
  });

  it("DEVUELTO_DMR no es pendiente ni sorteado: no bloquea el lote", () => {
    const progreso = contarProgresoSorteo([
      caso("ASIGNADO_DECISOR"),
      caso("DEVUELTO_DMR"),
    ]);

    expect(progreso).toEqual({
      total: 2,
      pendientes: 0,
      sorteados: 1,
      descartados: 1,
    });
    expect(noQuedaNadaPorSortear(progreso)).toBe(true);
    expect(seMuestraEnSorteo(progreso)).toBe(true);
  });

  it("un lote enteramente devuelto a la DMR NO se presenta como «En Sorteo»", () => {
    const progreso = contarProgresoSorteo([
      caso("DEVUELTO_DMR"),
      caso("DEVUELTO_DMR"),
    ]);

    expect(noQuedaNadaPorSortear(progreso)).toBe(true);
    expect(seMuestraEnSorteo(progreso)).toBe(false);
  });

  it("un lote sin casos no está completo, está vacío", () => {
    const progreso = contarProgresoSorteo([]);

    expect(progreso.total).toBe(0);
    expect(noQuedaNadaPorSortear(progreso)).toBe(false);
    expect(seMuestraEnSorteo(progreso)).toBe(false);
  });

  it("un lote a medio sortear sigue pendiente", () => {
    const progreso = contarProgresoSorteo([
      caso("ASIGNADO_DECISOR"),
      caso("VERIFICADO"),
    ]);

    expect(progreso.pendientes).toBe(1);
    expect(noQuedaNadaPorSortear(progreso)).toBe(false);
    expect(seMuestraEnSorteo(progreso)).toBe(false);
  });
});
