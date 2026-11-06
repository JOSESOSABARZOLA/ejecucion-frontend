/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: Unidad pura de la SELECCIÓN y del REPORTE del combo de firma de actas (RECE-05) — Fase 3.12
 * Archivo: comboFirma.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES las cuatro cosas que se rompen solas cuando esta
 *   lógica vive dentro del JSX: (1) que un lote SIN decisorUserId nunca entre en la selección ni en el
 *   payload —enviarlo produciría un par inválido que el DTO del backend rechaza con 400 (Pitfall 6)—,
 *   (2) que el turno se DELEGUE en resolveLoteTurnActions y funcione igual en los TRES roles, sin
 *   reimplementarlo aquí (D-10), (3) que el conteo de la confirmación reforzada del director sea de
 *   MASTERS distintos y no de sublotes (D-05), y (4) que el resumen distinga firmados de omitidos y
 *   levante advertencia cuando algún omitido llegó a TOCAR Asignaciones (D-04). Unidad pura: no monta
 *   React, no toca red y no conoce el httpClient.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-06
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 15 — D-10/D-20: los motivos
 *   FIRMA_FALLIDA y FIRMA_NO_INTENTADA, el catálogo cerrado `etiquetaCausaFirma` recorrido entero y la
 *   frase del corte en `resumenReporte`, con su plural. Ninguna etiqueta interpola el `detalle`.)
 */

import { describe, it, expect } from "vitest";
import {
  clavePar,
  esSeleccionable,
  motivoNoSeleccionable,
  paresDesdeSeleccion,
  contarMasters,
  resumenReporte,
  etiquetaMotivo,
  etiquetaCausaFirma,
} from "./comboFirma";
import type { CausaFirma } from "./firmaCopy";
import type {
  ComboMotivo,
  FirmarLotesOmitido,
  FirmarLotesResult,
  SorteoLote,
} from "../services/SorteoService";

/* ─────────────────────────────── fixtures ─────────────────────────────── */

/** Turno del FUNCIONARIO DECISOR: PENDIENTE y sin firma de orden 1. */
const loteTurnoDecisor: SorteoLote = {
  amasId: 900,
  decisorUserId: 34,
  estado: "PENDIENTE",
};

/** Turno del SECRETARIO ABOGADO: la orden 1 ya se selló. */
const loteTurnoSecretario: SorteoLote = {
  amasId: 901,
  decisorUserId: 35,
  estado: "PARCIALMENTE_FIRMADO",
  firmaDecisorAt: "2026-08-01T10:00:00Z",
};

/** Turno del DIRECTOR: las órdenes 1 y 2 ya se sellaron. */
const loteTurnoDirector: SorteoLote = {
  amasId: 902,
  decisorUserId: 36,
  estado: "PARCIALMENTE_FIRMADO",
  firmaDecisorAt: "2026-08-01T10:00:00Z",
  firmaSecretarioAt: "2026-08-02T10:00:00Z",
};

/** EN TURNO del decisor pero SIN decisor resuelto: el caso del Pitfall 6. */
const loteSinDecisor: SorteoLote = {
  amasId: 903,
  estado: "PENDIENTE",
};

/**
 * EN TURNO pero SIN CASOS ACTIVOS: los 3 expedientes del sublote fueron excusados (quick
 * 260806-m7u). El backend lo omite con motivo `SIN_CASOS_ACTIVOS` porque el acta que se firmaría
 * estaría vacía; la casilla no debe dejar marcarlo.
 */
const loteSinCasosActivos: SorteoLote = {
  amasId: 905,
  decisorUserId: 38,
  estado: "PENDIENTE",
  totalCasos: 3,
  casosActivos: 0,
};

/** EN TURNO con EXCUSA PARCIAL: 5 casos, 2 excusados. Sigue siendo firmable con normalidad. */
const loteExcusaParcial: SorteoLote = {
  amasId: 906,
  decisorUserId: 39,
  estado: "PENDIENTE",
  totalCasos: 5,
  casosActivos: 3,
};

/** Estado terminal: no es turno de nadie. */
const loteAprobado: SorteoLote = {
  amasId: 904,
  decisorUserId: 37,
  estado: "APROBADO",
  firmaDecisorAt: "2026-08-01T10:00:00Z",
  firmaSecretarioAt: "2026-08-02T10:00:00Z",
  aprobadoAt: "2026-08-03T10:00:00Z",
};

/** Reporte mínimo: sirve de base para variar solo lo que cada test mide. */
function reporte(over: Partial<FirmarLotesResult> = {}): FirmarLotesResult {
  return {
    ordenAplicado: 3,
    rolFirmante: "director",
    solicitados: 0,
    firmados: [],
    omitidos: [],
    mastersAprobados: [],
    ...over,
  };
}

/* ─────────────────────────────── clavePar ─────────────────────────────── */

describe("clavePar", () => {
  it("devuelve la MISMA clave que la página usa como key del Collapse", () => {
    expect(clavePar(loteTurnoDecisor)).toBe("900-34");
  });

  it("un lote sin decisorUserId devuelve la variante con interrogante", () => {
    expect(clavePar(loteSinDecisor)).toBe("903-?");
  });
});

/* ───────────────────────────── esSeleccionable ─────────────────────────── */

describe("esSeleccionable (delega el turno en resolveLoteTurnActions — D-10)", () => {
  it("es true en el turno de cada uno de los TRES roles", () => {
    expect(esSeleccionable(loteTurnoDecisor, "funcionario decisor")).toBe(true);
    expect(esSeleccionable(loteTurnoSecretario, "secretario abogado")).toBe(
      true,
    );
    expect(esSeleccionable(loteTurnoDirector, "director")).toBe(true);
  });

  it("es false para un lote EN TURNO pero SIN decisorUserId (Pitfall 6)", () => {
    expect(esSeleccionable(loteSinDecisor, "funcionario decisor")).toBe(false);
  });

  it("es false fuera del turno de ese rol, en los TRES roles", () => {
    // El decisor no firma lo que ya firmó; el secretario no se adelanta; el director tampoco.
    expect(esSeleccionable(loteTurnoSecretario, "funcionario decisor")).toBe(
      false,
    );
    expect(esSeleccionable(loteTurnoDecisor, "secretario abogado")).toBe(false);
    expect(esSeleccionable(loteTurnoSecretario, "director")).toBe(false);
    // Estado terminal: nadie.
    expect(esSeleccionable(loteAprobado, "director")).toBe(false);
  });

  it("es false para un lote EN TURNO pero SIN casos activos: no se marca lo que el backend va a omitir (quick 260806-m7u)", () => {
    expect(esSeleccionable(loteSinCasosActivos, "funcionario decisor")).toBe(
      false,
    );
  });

  it("la EXCUSA PARCIAL no afecta: con casos activos > 0 el sublote sigue siendo seleccionable", () => {
    expect(esSeleccionable(loteExcusaParcial, "funcionario decisor")).toBe(true);
  });

  it("casosActivos AUSENTE no bloquea: solo se atranca lo que se SABE vacío (mismo criterio que el backend)", () => {
    expect(esSeleccionable(loteTurnoDecisor, "funcionario decisor")).toBe(true);
  });
});

/* ────────────────────────── motivoNoSeleccionable ──────────────────────── */

describe("motivoNoSeleccionable", () => {
  it("explica que falta el decisor resuelto cuando ese es el caso", () => {
    const motivo = motivoNoSeleccionable(loteSinDecisor, "funcionario decisor");
    expect(motivo).toBeDefined();
    expect(motivo).toMatch(/decisor/i);
  });

  it("devuelve undefined cuando el lote SÍ es seleccionable", () => {
    expect(
      motivoNoSeleccionable(loteTurnoDirector, "director"),
    ).toBeUndefined();
  });

  it("explica que el sublote no tiene casos activos (todos excusados), que es el caso más confuso: parece firmable y no lo es", () => {
    const motivo = motivoNoSeleccionable(
      loteSinCasosActivos,
      "funcionario decisor",
    );
    expect(motivo).toBeDefined();
    expect(motivo).toMatch(/excusad|casos activos/i);
  });

  it("SIN CASOS ACTIVOS tiene precedencia sobre la falta de decisor: es la razón terminal", () => {
    const motivo = motivoNoSeleccionable(
      { ...loteSinCasosActivos, decisorUserId: undefined },
      "funcionario decisor",
    );
    expect(motivo).toMatch(/excusad|casos activos/i);
  });
});

/* ────────────────────────── paresDesdeSeleccion ────────────────────────── */

describe("paresDesdeSeleccion (defensa en profundidad antes del submit)", () => {
  const lotes = [
    loteTurnoDirector,
    { ...loteSinDecisor, estado: "PARCIALMENTE_FIRMADO" as const },
    loteAprobado,
  ];

  it("devuelve solo los pares de lotes SELECCIONABLES cuya clave está en el conjunto", () => {
    const pares = paresDesdeSeleccion(
      lotes,
      new Set([clavePar(loteTurnoDirector), clavePar(loteAprobado)]),
      "director",
    );
    // loteAprobado está en el conjunto pero NO es seleccionable: se descarta en silencio.
    expect(pares).toEqual([{ amasId: 902, decisorUserId: 36 }]);
  });

  it("descarta en silencio las claves huérfanas y los lotes sin decisor", () => {
    const pares = paresDesdeSeleccion(
      lotes,
      new Set(["777-1", clavePar(loteSinDecisor)]),
      "director",
    );
    expect(pares).toEqual([]);
  });

  it("un lote SIN casos activos marcado antes de un refetch se descarta del payload (quick 260806-m7u)", () => {
    // El usuario lo marcó cuando aún tenía casos; al recargar, la excusa dejó el sublote vacío.
    const conVacio = [loteTurnoDecisor, loteSinCasosActivos];

    const pares = paresDesdeSeleccion(
      conVacio,
      new Set([clavePar(loteTurnoDecisor), clavePar(loteSinCasosActivos)]),
      "funcionario decisor",
    );

    expect(pares).toEqual([{ amasId: 900, decisorUserId: 34 }]);
  });

  it("los pares llevan amasId y decisorUserId NUMÉRICOS, nunca undefined", () => {
    const pares = paresDesdeSeleccion(
      lotes,
      new Set([clavePar(loteTurnoDirector)]),
      "director",
    );
    expect(pares).toHaveLength(1);
    expect(typeof pares[0].amasId).toBe("number");
    expect(typeof pares[0].decisorUserId).toBe("number");
  });
});

/* ───────────────────────────── contarMasters ───────────────────────────── */

describe("contarMasters (el número que ve el director — D-05)", () => {
  it("cuenta amasId DISTINTOS", () => {
    expect(
      contarMasters([
        { amasId: 900, decisorUserId: 1 },
        { amasId: 901, decisorUserId: 2 },
        { amasId: 902, decisorUserId: 3 },
      ]),
    ).toBe(3);
  });

  it("tres pares del MISMO master cuentan 1", () => {
    expect(
      contarMasters([
        { amasId: 900, decisorUserId: 1 },
        { amasId: 900, decisorUserId: 2 },
        { amasId: 900, decisorUserId: 3 },
      ]),
    ).toBe(1);
  });
});

/* ───────────────────────────── resumenReporte ──────────────────────────── */

describe("resumenReporte", () => {
  const omitidoTocado = {
    par: { amasId: 901, decisorUserId: 35 },
    motivo: "ERROR_ASIGNACIONES" as ComboMotivo,
    detalle: "Asignaciones respondió 504.",
    intentado: true,
    statusCode: 504,
  };

  const omitidoLimpio = {
    par: { amasId: 903, decisorUserId: 37 },
    motivo: "CASOS_SIN_ACEPTAR" as ComboMotivo,
    detalle: "Quedan 4 casos sin aceptar.",
    intentado: false,
    casosPendientes: 4,
  };

  const firmado = {
    par: { amasId: 900, decisorUserId: 34 },
    ordenAplicado: 3 as const,
    expedientesSellados: 2,
    intentado: true,
  };

  it("dice cuántas se firmaron sobre cuántas se pidieron y cuántas quedaron omitidas", () => {
    const texto = resumenReporte(
      reporte({
        solicitados: 3,
        firmados: [firmado],
        omitidos: [omitidoTocado, omitidoLimpio],
        mastersAprobados: [900],
      }),
    );
    expect(texto).toContain("1");
    expect(texto).toContain("3");
    expect(texto).toMatch(/firm/i);
    expect(texto).toMatch(/omitid/i);
  });

  it("advierte explícitamente cuando algún omitido lleva intentado en true (D-04)", () => {
    const texto = resumenReporte(
      reporte({
        solicitados: 2,
        firmados: [firmado],
        omitidos: [omitidoTocado],
        mastersAprobados: [900],
      }),
    );
    expect(texto).toContain("alcanzaron a tocar Asignaciones");
  });

  it("NO advierte cuando ningún omitido tiene intentado en true", () => {
    const texto = resumenReporte(
      reporte({
        solicitados: 2,
        firmados: [firmado],
        omitidos: [omitidoLimpio],
        mastersAprobados: [900],
      }),
    );
    expect(texto).not.toContain("alcanzaron a tocar Asignaciones");
  });
});

/* ───────────────────────────── etiquetaMotivo ──────────────────────────── */

describe("etiquetaMotivo (traduce la taxonomía CERRADA del backend)", () => {
  // La lista crece con la unión del backend: SIN_CASOS_ACTIVOS entró con el quick 260806-m7u.
  // EXCUSA_PENDIENTE entró el 2026-08-24: firmar con una excusa sin resolver varaba el caso.
  const motivos: ComboMotivo[] = [
    "FUERA_DE_TURNO",
    "YA_FIRMADO",
    "RECHAZADO",
    "CASOS_SIN_ACEPTAR",
    "SIN_CASOS_ACTIVOS",
    "EXCUSA_PENDIENTE",
    "PAR_INEXISTENTE",
    "ERROR_ASIGNACIONES",
    "ERROR_INTERNO",
    // Fase 03.21 (D-10/D-20): la firma real puede fallar, y el corte deja actas sin intentar.
    "FIRMA_FALLIDA",
    "FIRMA_NO_INTENTADA",
  ];

  it("traduce los ONCE motivos y ninguna etiqueta queda vacía", () => {
    const etiquetas = motivos.map((m) => etiquetaMotivo(m));
    etiquetas.forEach((e) => expect(e.trim().length).toBeGreaterThan(0));
    // Ninguna etiqueta se repite: son once situaciones distintas para el usuario.
    expect(new Set(etiquetas).size).toBe(11);
  });

  // T-3.12-19: la firma solo recibe el motivo, así que el `detalle` del servidor NO puede colarse.
  it.each(motivos)("%s: texto no vacío que no contiene el detalle del servidor", (motivo) => {
    const detalle = "DETALLE-DEL-SERVIDOR-QUE-NO-SE-PINTA";
    const etiqueta = etiquetaMotivo(motivo);
    expect(etiqueta.trim().length).toBeGreaterThan(0);
    expect(etiqueta).not.toContain(detalle);
  });

  it("FIRMA_FALLIDA dice que el acta no se firmó y su lote no se aprobó (D-10)", () => {
    expect(etiquetaMotivo("FIRMA_FALLIDA")).toBe(
      "La firma digital no se aplicó: el acta no se firmó y su lote no se aprobó.",
    );
  });

  it("FIRMA_NO_INTENTADA dice que NO se intentó, por qué, y que puede reenviarse (D-20)", () => {
    expect(etiquetaMotivo("FIRMA_NO_INTENTADA")).toBe(
      "No se intentó: la firma falló en un acta anterior de este mismo envío por una causa que afecta a todas (la clave, la sesión, el certificado o el servicio de firma), y repetirla habría fallado igual. Puede volver a enviarla cuando se resuelva.",
    );
  });

  it("FIRMA_FALLIDA y FIRMA_NO_INTENTADA no se confunden: una falló, la otra ni se intentó", () => {
    expect(etiquetaMotivo("FIRMA_FALLIDA")).not.toMatch(/No se intentó/);
    expect(etiquetaMotivo("FIRMA_NO_INTENTADA")).toMatch(/^No se intentó/);
  });

  it("el copy es ACCIONABLE en los motivos que el usuario puede resolver", () => {
    expect(etiquetaMotivo("CASOS_SIN_ACEPTAR")).toMatch(/acept/i);
    expect(etiquetaMotivo("RECHAZADO")).toMatch(/sorte/i);
    expect(etiquetaMotivo("ERROR_ASIGNACIONES")).toMatch(/Asignaciones/);
  });

  it("SIN_CASOS_ACTIVOS no se confunde con YA_FIRMADO: dice que los casos fueron excusados, no que ya se firmó", () => {
    const etiqueta = etiquetaMotivo("SIN_CASOS_ACTIVOS");
    expect(etiqueta).toMatch(/excusad/i);
    expect(etiqueta).not.toMatch(/ya (estaba|fue) firmad/i);
  });
});

/* ─────────────────────────── etiquetaCausaFirma ─────────────────────────── */

describe("etiquetaCausaFirma (catálogo CERRADO de las siete causas — UI-SPEC §10.9)", () => {
  const esperado: Record<CausaFirma, string> = {
    CLAVE_INCORRECTA: "La clave de firma no es correcta.",
    CERTIFICADO:
      "Su firma electrónica no está registrada en el Auth central o está caducada.",
    SIN_SESION_CENTRAL: "Su sesión no está abierta con el Auth central.",
    FALTA_CLAVE: "No llegó la clave de firma.",
    FIRMADOR_NO_RESPONDE: "El servicio de firma no respondió.",
    RESPUESTA_INVALIDA:
      "El servicio de firma devolvió una respuesta que no se pudo verificar.",
    DOCUMENTO_NO_FIRMABLE: "El acta no estaba lista para firmarse.",
  };
  const causas = Object.keys(esperado) as CausaFirma[];

  it("cubre las SIETE causas y ninguna etiqueta se repite", () => {
    expect(causas).toHaveLength(7);
    expect(new Set(causas.map((c) => etiquetaCausaFirma(c))).size).toBe(7);
  });

  it.each(causas)("%s: el texto literal de §10.9, sin el detalle del servidor", (causa) => {
    const detalle = "DETALLE-DEL-SERVIDOR-QUE-NO-SE-PINTA";
    const etiqueta = etiquetaCausaFirma(causa);
    expect(etiqueta).toBe(esperado[causa]);
    expect(etiqueta.trim().length).toBeGreaterThan(0);
    expect(etiqueta).not.toContain(detalle);
  });
});

/* ─────────────────── resumenReporte con el corte de la firma ─────────────────── */

describe("resumenReporte con FIRMA_FALLIDA / FIRMA_NO_INTENTADA (D-20)", () => {
  const fallida: FirmarLotesOmitido = {
    par: { amasId: 910, decisorUserId: 40 },
    motivo: "FIRMA_FALLIDA",
    detalle: "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.",
    intentado: false,
    causaFirma: "CLAVE_INCORRECTA",
  };
  const noIntentada = (amasId: number): FirmarLotesOmitido => ({
    par: { amasId, decisorUserId: 41 },
    motivo: "FIRMA_NO_INTENTADA",
    detalle: "No se intentó.",
    intentado: false,
    causaFirma: "CLAVE_INCORRECTA",
  });

  it("con DOS actas no intentadas añade la frase del corte en plural", () => {
    const texto = resumenReporte(
      reporte({
        solicitados: 3,
        firmados: [],
        omitidos: [fallida, noIntentada(911), noIntentada(912)],
        mastersAprobados: [],
      }),
    );
    expect(texto).toContain(
      "La firma se detuvo en un acta anterior por una causa que afecta a todas: 2 actas no se intentaron. Vuelva a abrir «Firmar en combo» y escriba la clave de nuevo.",
    );
  });

  it("con UNA acta no intentada usa el singular", () => {
    const texto = resumenReporte(
      reporte({
        solicitados: 2,
        firmados: [],
        omitidos: [fallida, noIntentada(911)],
        mastersAprobados: [],
      }),
    );
    expect(texto).toContain(": 1 acta no se intentó. Vuelva a abrir");
  });

  it("sin actas no intentadas el resumen es el de siempre (sin la frase del corte)", () => {
    const texto = resumenReporte(
      reporte({
        solicitados: 1,
        firmados: [],
        omitidos: [fallida],
        mastersAprobados: [],
      }),
    );
    expect(texto).toBe("Se firmaron 0 de 1 acta. 1 quedó omitida.");
    expect(texto).not.toContain("La firma se detuvo");
  });

  it("un fallo de firma (intentado false) NUNCA levanta la advertencia de Asignaciones tocada", () => {
    const texto = resumenReporte(
      reporte({
        solicitados: 2,
        firmados: [],
        omitidos: [fallida, noIntentada(911)],
        mastersAprobados: [],
      }),
    );
    expect(texto).not.toContain("alcanzaron a tocar Asignaciones");
  });
});
