/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Unidad pura del adapter SorteoLote[]+EnvioLoteDto → ModalAssignmentResultData (D-08) — Fase 3.8
 * Archivo: sorteoLoteToModalData.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES el mapeo que ALIMENTA el ModalAssignmentResult
 *   EXISTENTE (reuse, NO rebuild): (1) el header sale de la ENTRADA — document.docName = nº de memo
 *   (envlNumeroLote), tdocTypeName derivado de envlTipo; (2) "Usuarios asignados" sale del SORTEO —
 *   assignment agrupa por decisorUserId con subName=materia y masterStatusName="En espera"
 *   (etiqueta estática, D-08/Q2); (3) DEGRADACIÓN HONESTA — un decisor sin nombre conserva su grupo
 *   con su id (no se oculta); (4) casos totales del document = suma de los casos de los pares. Unidad
 *   pura: no monta React ni toca el modal.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-17: los casos llevan `materia`, la
 *   deducida de sus infracciones, y un caso sin ella se lee «materia no disponible»); 2026-10-16 (fix
 *   sorteo: `userNames` lleva el nombre del decisor — del caso, como lo manda el backend, o del sublote
 *   como respaldo — y quien no resolvió no entra)
 */

import { describe, it, expect } from "vitest";
import { sorteoLoteToModalData } from "./sorteoLoteToModalData";
import type { EnvioLoteDto } from "../services/EntradaLotesService";
import type { SorteoLote } from "../services/SorteoService";

/** ENTRADA: la identidad del header (nº de memo = envlNumeroLote), tipo ENVIO, ligada al sorteo 9001. */
const LOTE: EnvioLoteDto = {
  envlId: 1,
  envlNumeroLote: "GADDMQ-AMC-DMR-8008-M",
  envlStatus: "ENVIADO_SORTEO",
  envlTipo: "ENVIO",
  envlAmasId: 9001,
  envlIncomeAt: "2026-07-20T10:00:00.000Z",
};

/**
 * SORTEO: dos pares decisor bajo el MISMO master 9001 (ya filtrados por amasId por el llamador):
 * 6389 con 2 casos, 6457 (sin nombre) con 1.
 */
const SORTEO_LOTES: SorteoLote[] = [
  {
    amasId: 9001,
    decisorUserId: 6389,
    decisorName: "Ana Torres",
    sorteoAt: "2026-07-21T09:00:00.000Z",
    casos: [
      { eejeId: 101, expNumber: "EXP-1", decisorUserId: 6389, subId: 17, materia: "AMBIENTE" },
      { eejeId: 102, expNumber: "EXP-2", decisorUserId: 6389, subId: 18, materia: "LICENCIAMIENTO" },
    ],
  },
  {
    amasId: 9001,
    decisorUserId: 6457,
    // decisorName undefined a propósito: el id no resolvió (LEFT JOIN, R-03-01-F).
    decisorName: undefined,
    sorteoAt: "2026-07-21T09:00:00.000Z",
    casos: [
      { eejeId: 103, expNumber: "EXP-3", decisorUserId: 6457, subId: 19, materia: "ESPACIO PÚBLICO" },
    ],
  },
];

describe("sorteoLoteToModalData (adapter ENTRADA+SORTEO → modal — D-08)", () => {
  it("el header sale de la ENTRADA: docName = nº de memo y tdocTypeName derivado de envlTipo", () => {
    const data = sorteoLoteToModalData(LOTE, SORTEO_LOTES);

    // D-08 / Q1: el header muestra la identidad de ENTRADA (nº de memo), no el amas_id del sorteo.
    expect(data.document.docName).toBe("GADDMQ-AMC-DMR-8008-M");
    // tdocTypeName DERIVADO de envlTipo (ENVIO → Memorando de Envío).
    expect(data.document.tdocTypeName).toBe("Memorando de Envío");
    expect(data.document.docStatus).toBe("sorteado");
  });

  it("assignment agrupa por decisorUserId (2 grupos) con subName=materia y masterStatusName='En espera'", () => {
    const data = sorteoLoteToModalData(LOTE, SORTEO_LOTES);

    const grupos = Object.keys(data.assignment).map(Number).sort((a, b) => a - b);
    expect(grupos).toEqual([6389, 6457]);

    expect(data.assignment[6389]).toHaveLength(2);
    expect(data.assignment[6457]).toHaveLength(1);

    // subName = materia DEDUCIDA del caso (D-17).
    expect(data.assignment[6389][0].subName).toBe("AMBIENTE");
    expect(data.assignment[6389][1].subName).toBe("LICENCIAMIENTO");
    expect(data.assignment[6457][0].subName).toBe("ESPACIO PÚBLICO");

    // masterStatusName = "En espera" (etiqueta estática — D-08/Q2, no hay aceptación por-caso aquí).
    expect(data.assignment[6389][0].masterStatusName).toBe("En espera");
    expect(data.assignment[6457][0].masterStatusName).toBe("En espera");

    // El grupo lleva el amas_id del master y el userId del decisor.
    expect(data.assignment[6389][0].assignmentMasterId).toBe(9001);
    expect(data.assignment[6389][0].userId).toBe(6389);
  });

  it("un caso sin infracciones (sin materia deducida) se lee «materia no disponible», nunca el id del reparto", () => {
    const data = sorteoLoteToModalData(LOTE, [
      {
        amasId: 9001,
        decisorUserId: 6389,
        decisorName: "Ana Torres",
        sorteoAt: "2026-07-21T09:00:00.000Z",
        casos: [{ eejeId: 104, expNumber: "EXP-4", decisorUserId: 6389, subId: 17 }],
      },
    ]);

    expect(data.assignment[6389][0].subName).toBe("materia no disponible");
    expect(data.assignment[6389][0].subName).not.toContain("17");
  });

  it("degradación honesta: un decisor sin nombre conserva su grupo con su id (no desaparece)", () => {
    const data = sorteoLoteToModalData(LOTE, SORTEO_LOTES);

    // 6457 no resolvió su nombre pero SIGUE presente, con su id y su caso.
    expect(data.assignment[6457]).toBeDefined();
    expect(data.assignment[6457]).toHaveLength(1);
    expect(data.assignment[6457][0].userId).toBe(6457);
  });

  it("casos totales del document = suma de los casos de los pares", () => {
    const data = sorteoLoteToModalData(LOTE, SORTEO_LOTES);
    // 2 (6389) + 1 (6457) = 3.
    expect(data.document.casesRelated).toHaveLength(3);
  });

  it("un tipo desconocido degrada tdocTypeName al valor crudo del envlTipo", () => {
    const data = sorteoLoteToModalData(
      { ...LOTE, envlTipo: "OTRO" },
      SORTEO_LOTES,
    );
    expect(data.document.tdocTypeName).toBe("OTRO");
  });

  it("userNames lleva el nombre que el backend manda en cada CASO (LEFT JOIN a t_usuario)", () => {
    // Forma REAL de GET /sorteo/lotes: el nombre viaja en el caso y el sublote no lo trae.
    const lotesReales: SorteoLote[] = [
      {
        amasId: 9001,
        decisorUserId: 4,
        sorteoAt: "2026-10-16T09:00:00.000Z",
        casos: [
          { eejeId: 201, decisorUserId: 4, decisorName: "Andres Decisor", materia: "AMBIENTE" },
          { eejeId: 202, decisorUserId: 4, decisorName: "Andres Decisor", materia: "AMBIENTE" },
        ],
      },
      {
        amasId: 9001,
        decisorUserId: 6795,
        sorteoAt: "2026-10-16T09:00:00.000Z",
        casos: [{ eejeId: 203, decisorUserId: 6795, decisorName: "Pablo Zambrano" }],
      },
    ];

    const data = sorteoLoteToModalData(LOTE, lotesReales);

    expect(data.userNames).toEqual({ 4: "Andres Decisor", 6795: "Pablo Zambrano" });
  });

  it("userNames cae al nombre del sublote cuando el caso no lo trae", () => {
    const data = sorteoLoteToModalData(LOTE, SORTEO_LOTES);

    expect(data.userNames?.[6389]).toBe("Ana Torres");
  });

  it("degradación honesta: un decisor sin nombre NO entra en userNames (el modal pinta su id)", () => {
    const data = sorteoLoteToModalData(LOTE, SORTEO_LOTES);

    expect(data.userNames).not.toHaveProperty("6457");
    // Su grupo sigue ahí: falta el nombre, no el decisor.
    expect(data.assignment[6457]).toHaveLength(1);
  });
});
