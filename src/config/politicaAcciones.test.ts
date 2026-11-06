/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend)
 * Feature: La prueba que cierra D-5 — política total sobre el union de acciones
 * Archivo: politicaAcciones.test.ts
 * Responsabilidad: Demostrar, recorriendo el union ENTERO nombre por nombre, que invertir el
 *   defecto del motor —«sin regla, se niega»— no rompió ninguna acción que hoy se ofrece
 *   legítimamente. El criterio de aceptación de D-5 es explícito en que esto se demuestra con una
 *   prueba sobre el union completo y NO leyendo el diff, porque un diff enseña lo que cambió y no
 *   lo que dejó de funcionar.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 11, D-11: las cuatro entradas del
 *   submenú del EPAS que hasta hoy se gateaban con predicados sueltos entran al motor, y su paridad
 *   contra esos predicados se mide aquí, celda a celda.)
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 19, gap 4 del UAT: la matriz de paridad
 *   recibe su excepción ESCRITA para `aceptarCaso` y `excusarme`, que estrenan gate de aceptación.)
 */

import { describe, expect, it } from "vitest";
import {
  INBOX_ACTION_NAMES,
  POLITICA_ACCIONES,
  isInboxActionVisible,
  resolverAccion,
  type InboxActionName,
  type InboxActionStatus,
  type InboxActionStatusRule,
  type InboxRole,
  type PoliticaAccion,
} from "./inboxActionStatusRules";
import {
  hechosDelEpas,
  hechosDeLote,
  hechosDeObligacionHacer,
  motivoDeHecho,
  MOTIVOS_ACCION,
} from "./accionesHechos";
import type {
  ObligacionHacerDetalle,
  ObligacionHacerEnBandeja,
} from "../interfaces/IObligacionHacer";
import type { LoteEstado, SorteoLote } from "../services/SorteoService";

/** Los tres roles operativos del módulo. */
const ROLES: InboxRole[] = [
  "secretario abogado",
  "director",
  "funcionario decisor",
];

/** Los siete estados EPAS que gatean, más la ausencia de estado. */
const ESTADOS: (InboxActionStatus | undefined)[] = [
  "RECIBIDO",
  "VERIFICADO",
  "SORTEADO",
  "ASIGNADO_DECISOR",
  "EN_VERIFICACION_PAGO",
  "EN_TRABAJO_COMUNITARIO",
  "PENDIENTE_COACTIVA",
  undefined,
];

/**
 * 🔴 EL TOTAL DEL UNION, ESCRITO A MANO. 16 valores de `ModalType` más 22 propios —con
 * `DEVOLVER_DMR` y `excusarme` declarados en los dos sitios y fundidos por el union en uno—, que
 * hacen 38, más las 12 de la rama del correctivo que añadió la Tarea 3 de este mismo plan, más
 * `verObligacionHacer` —la puerta de LECTURA de esa rama, que añadió la corrección de CR-01—, más
 * `anexarDocumento` —el modal del anexo libre, quick 260917-anx—, más `expedienteLote` —la ficha del
 * expediente de la Bandeja de Entrada, reunión del 2026-09-16—.
 *
 * Está escrito como número literal a propósito: si alguien añade o quita una acción, esta prueba
 * FALLA y le obliga a mirar `POLITICA_ACCIONES`, que es exactamente donde tiene que decidir algo.
 * Un `expect(x.length).toBe(x.length)` no obligaría a nadie a mirar nada. Y funcionó CINCO veces:
 * la corrección de CR-01, el quick 260917-anx, la ficha del expediente del 2026-09-16, las cuatro
 * entradas del submenú del EPAS que trajo el Plan 11 de la Fase 03.19 (53 → 57) y el quick
 * 261014-jcy, que retiró la acción del sello de clausura (57 → 56).
 */
const TOTAL_ACCIONES = 56;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// LA LÓGICA ANTERIOR, REPRODUCIDA A MANO.
//
// 🔴 NO SE IMPORTA NADA DE LO QUE SE PRUEBA, y las 18 reglas vigentes se copian aquí como DATO
// LITERAL. Si el esperado saliera de la misma tabla que se está probando, la prueba pasaría con
// cualquier refactor —incluido el que cambiara una regla por descuido—. Es la misma doctrina que
// fijó la matriz de paridad del Plan 01.
// ─────────────────────────────────────────────────────────────────────────────────────────────

type ReglaVigente = {
  roles?: InboxRole[];
  status?: InboxActionStatus | InboxActionStatus[];
};

/** Las 18 reglas tal y como estaban ANTES de esta fase, copiadas a mano. */
const REGLAS_VIGENTES: Record<string, ReglaVigente> = {
  aprobarEpas: { roles: ["director"], status: "RECIBIDO" },
  aprobarExpediente: { roles: ["director"] },
  devolverExpediente: { roles: ["director"] },
  marcarRevisado: { roles: ["secretario abogado"], status: "RECIBIDO" },
  desRevisar: { roles: ["secretario abogado"], status: "VERIFICADO" },
  DEVOLVER_DMR: {
    roles: ["secretario abogado", "director"],
    status: ["RECIBIDO", "VERIFICADO"],
  },
  returnBatchDmr: { roles: ["secretario abogado"], status: "RECIBIDO" },
  sortear: { roles: ["secretario abogado"], status: "VERIFICADO" },
  aprobarLote: { roles: ["director"], status: "SORTEADO" },
  excusarme: { roles: ["funcionario decisor"], status: "ASIGNADO_DECISOR" },
  registrarPago: {
    roles: ["funcionario decisor"],
    status: "EN_VERIFICACION_PAGO",
  },
  registrarCumplimiento: {
    roles: ["funcionario decisor"],
    status: "EN_TRABAJO_COMUNITARIO",
  },
  registrarAcogimiento: {
    roles: ["funcionario decisor"],
    status: "EN_VERIFICACION_PAGO",
  },
  solicitarProrroga: {
    roles: ["funcionario decisor"],
    status: "EN_TRABAJO_COMUNITARIO",
  },
  gestionarCoactiva: {
    roles: ["funcionario decisor"],
    status: "PENDIENTE_COACTIVA",
  },
  aceptarCaso: { roles: ["funcionario decisor"], status: "ASIGNADO_DECISOR" },
  formasNotificacion: {
    roles: ["secretario abogado"],
    status: ["RECIBIDO", "VERIFICADO"],
  },
  enviarSorteo: { roles: ["director"], status: "RECIBIDO" },
};

/**
 * `isInboxActionVisible` tal y como se comportaba ANTES del Plan 04, con la cuña puesta: sin regla
 * escrita, la acción se ofrecía. Es el listón contra el que se mide que nada se rompió.
 */
function conductaAnterior(
  actiName: string,
  docStatus: string | null | undefined,
  userRole: string,
): boolean {
  const regla = REGLAS_VIGENTES[actiName];
  if (!regla) return true; // la cuña del Plan 01
  const rol = userRole.trim().toLowerCase();
  if (regla.roles && !regla.roles.includes(rol as InboxRole)) return false;
  if (regla.status) {
    const permitidos = Array.isArray(regla.status)
      ? regla.status
      : [regla.status];
    const estado = (docStatus ?? "").trim().toUpperCase();
    if (!permitidos.includes(estado as InboxActionStatus)) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * La regla ÚNICA de una política, para las acciones que no tienen alternativas.
 *
 * Desde 2026-09-29 `regla` puede ser una lista (quick 260929-kfg). Estas pruebas afirman sobre
 * acciones que siguen teniendo UNA sola, y este ayudante lo deja explícito: si alguna ganara
 * alternativas, la prueba falla diciendo exactamente eso en vez de compilar mal o pasar de largo.
 */
function reglaUnica(politica: PoliticaAccion): InboxActionStatusRule {
  if (politica.tipo !== "regla") {
    throw new Error("se esperaba una política de regla");
  }
  if (Array.isArray(politica.regla)) {
    throw new Error("se esperaba UNA regla, no alternativas");
  }
  return politica.regla as InboxActionStatusRule;
}

describe("POLITICA_ACCIONES: el mapa total sobre el union", () => {
  it("🔴 tiene una política por cada nombre del union, y son cincuenta y siete", () => {
    expect(INBOX_ACTION_NAMES).toHaveLength(TOTAL_ACCIONES);
    expect(new Set(INBOX_ACTION_NAMES).size).toBe(TOTAL_ACCIONES);

    for (const nombre of INBOX_ACTION_NAMES) {
      const politica = POLITICA_ACCIONES[nombre];
      expect(politica, `sin política: ${nombre}`).toBeDefined();
      expect(
        ["regla", "oculta"],
        `tipo desconocido en ${nombre}`,
      ).toContain(politica.tipo);
    }
  });

  it("toda política de ocultar trae su porqué escrito", () => {
    for (const nombre of INBOX_ACTION_NAMES) {
      const politica = POLITICA_ACCIONES[nombre];
      if (politica.tipo === "regla") continue;
      expect(politica.porque.trim().length, `porque vacío: ${nombre}`)
        .toBeGreaterThan(0);
    }
  });

  it("🔴 D-5: ninguna acción con regla sale invisible, con ningún rol", () => {
    for (const nombre of INBOX_ACTION_NAMES) {
      if (POLITICA_ACCIONES[nombre].tipo === "oculta") continue;
      for (const rol of ROLES) {
        for (const estado of ESTADOS) {
          const veredicto = resolverAccion(nombre, { rol, estado });
          expect(veredicto.visible, `${nombre} / ${rol} / ${estado}`).toBe(true);
        }
      }
    }
  });

  it("ningún apagado es mudo: si niega, dice por qué", () => {
    for (const nombre of INBOX_ACTION_NAMES) {
      for (const rol of ROLES) {
        for (const estado of ESTADOS) {
          const v = resolverAccion(nombre, { rol, estado });
          if (v.visible && !v.habilitada) {
            expect(v.motivo, `${nombre} / ${rol} / ${estado}`).toBeTruthy();
          }
        }
      }
    }
  });
});

describe("las políticas de ocultar", () => {
  const ocultas = () =>
    INBOX_ACTION_NAMES.filter((n) => POLITICA_ACCIONES[n].tipo === "oculta");

  it("son exactamente las dos heredadas de Resolución sin consumidor", () => {
    expect(ocultas().sort()).toEqual(["returnCases", "returnMemo"]);
  });

  it("no se muestran con ningún rol ni en ningún estado", () => {
    for (const nombre of ocultas()) {
      for (const rol of ROLES) {
        for (const estado of ESTADOS) {
          const v = resolverAccion(nombre, { rol, estado });
          expect(v.visible, `${nombre} / ${rol} / ${estado}`).toBe(false);
          expect(v.habilitada).toBe(false);
        }
      }
      expect(isInboxActionVisible(nombre, "RECIBIDO", "director")).toBe(false);
    }
  });
});

describe("las exenciones declaradas: ya no queda ninguna", () => {
  it("🔴 las tres firmas del lote pasaron de exención a REGLA (Plan 09)", () => {
    // Era la última deuda de D-7: dos mecanismos de gating donde la decisión quiere uno. La
    // exención decía textualmente «el Plan 09 lo absorbe en el motor», y esto es ese plan.
    for (const nombre of FIRMAS) {
      expect(POLITICA_ACCIONES[nombre].tipo, nombre).toBe("regla");
    }
  });

  it("y el tipo de política «externa» ya no existe: ninguna entrada puede declararla", () => {
    // No basta con vaciar las tres entradas: mientras el union admitiera `tipo: "externa"`,
    // cualquiera podría volver a sacar una acción del motor SIN un plan que lo respaldara. Al
    // borrarlo del union, la ausencia de exenciones la impone el COMPILADOR y no la vigilancia.
    for (const nombre of INBOX_ACTION_NAMES) {
      expect(POLITICA_ACCIONES[nombre].tipo, nombre).not.toBe("externa");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PARIDAD DEL TURNO DE FIRMA DEL ACTA D2 (Fase 03.18, Plan 09, Tarea 1)
//
// 🔴 ESTE BLOQUE SE ESCRIBIÓ Y PASÓ CON `loteTurnActions.ts` TODAVÍA INTACTO. Ésa es toda su razón
// de ser: demostrar que la regla nueva decide lo MISMO que el código que iba a sustituirla ANTES de
// sustituirlo, no después. Un plan que primero sustituye y luego prueba solo puede demostrar que el
// código nuevo hace lo que el código nuevo hace.
//
// 🔴 EL RESOLVER ORIGINAL SE REPRODUCE A MANO, NO SE IMPORTA. Misma doctrina que `conductaAnterior`
// más arriba: si el esperado saliera de la función que se está sustituyendo, la prueba seguiría
// verde el día en que la sustitución cambiara la conducta de las dos a la vez.
//
// 🔴 POR QUÉ EL TURNO CABE AHORA EN LA TABLA Y ANTES NO. La cabecera del archivo absorbido decía,
// el 2026-07-23, que su gate no cabía porque «el `status` de esa tabla es el enum EPAS y no puede
// expresar el turno del lote». Sigue siendo cierto: el turno no entra por `status`. Entra por la
// dimensión de CONDICIONES SOBRE HECHOS DERIVADOS, que en aquella fecha no existía.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Las tres acciones de firma, en el orden de la secuencia del acta D2. */
const FIRMAS = [
  "firmarDecisor",
  "firmarSecretario",
  "firmarDirector",
] as const satisfies readonly InboxActionName[];

/** Los cuatro estados reales del lote (`LoteEstado`), más la ausencia de estado. */
const ESTADOS_LOTE: (LoteEstado | undefined)[] = [
  "PENDIENTE",
  "PARCIALMENTE_FIRMADO",
  "APROBADO",
  "RECHAZADO",
  undefined,
];

/** Los tres roles con turno posible, más uno que no interviene en la secuencia. */
const ROLES_DEL_TURNO: string[] = [
  "funcionario decisor",
  "secretario abogado",
  "director",
  "auditor",
];

/** Las 8 combinaciones de las tres marcas de firma, como el backend las envía (marca o ausencia). */
const MARCAS: Partial<SorteoLote>[] = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({
  firmaDecisorAt: n & 1 ? "2026-07-23T10:00:00Z" : undefined,
  firmaSecretarioAt: n & 2 ? "2026-07-23T11:00:00Z" : undefined,
  aprobadoAt: n & 4 ? "2026-07-23T12:00:00Z" : undefined,
}));

/**
 * `resolveLoteTurnActions` TAL Y COMO ESTABA ESCRITO ANTES DE ESTE PLAN, copiado literalmente de
 * `loteTurnActions.ts` (Fase 3.5, 2026-07-23). Es el listón contra el que se mide la regla nueva.
 */
function turnoAnterior(lote: SorteoLote, rolName: string): string[] {
  const role = (rolName ?? "").trim().toLowerCase();
  const estado = lote.estado;

  if (estado !== "PENDIENTE" && estado !== "PARCIALMENTE_FIRMADO") return [];

  if (role === "funcionario decisor") {
    return estado === "PENDIENTE" && !lote.firmaDecisorAt
      ? ["firmarDecisor"]
      : [];
  }
  if (role === "secretario abogado") {
    return estado === "PARCIALMENTE_FIRMADO" &&
      !!lote.firmaDecisorAt &&
      !lote.firmaSecretarioAt
      ? ["firmarSecretario"]
      : [];
  }
  if (role === "director") {
    return estado === "PARCIALMENTE_FIRMADO" &&
      !!lote.firmaSecretarioAt &&
      !lote.aprobadoAt
      ? ["firmarDirector"]
      : [];
  }
  return [];
}

describe("el turno de firma del acta D2, resuelto por el motor", () => {
  it("🔴 las tres reglas gatean por ROL y por HECHOS, y ninguna declara `status`", () => {
    // El `status` de esta tabla es el enum EPAS. Declararlo aquí sería afirmar que el turno del
    // lote es un estado del expediente, que es justamente lo que no es.
    const rolEsperado: Record<string, InboxRole> = {
      firmarDecisor: "funcionario decisor",
      firmarSecretario: "secretario abogado",
      firmarDirector: "director",
    };
    for (const nombre of FIRMAS) {
      const regla = reglaUnica(POLITICA_ACCIONES[nombre]);
      expect(regla.status, nombre).toBeUndefined();
      expect(regla.roles, nombre).toEqual([rolEsperado[nombre]]);
      expect(regla.condiciones?.length ?? 0, nombre).toBeGreaterThan(0);
    }
  });

  it("🔴 PARIDAD: estado × marcas × rol, el motor decide lo mismo que el resolver original", () => {
    let celdas = 0;
    let comparaciones = 0;

    for (const estado of ESTADOS_LOTE) {
      for (const marcas of MARCAS) {
        const lote = { estado, ...marcas } as SorteoLote;
        for (const rol of ROLES_DEL_TURNO) {
          const esperado = turnoAnterior(lote, rol);
          const hechos = hechosDeLote(lote);

          for (const nombre of FIRMAS) {
            const v = resolverAccion(nombre, { rol, hechos });
            expect(
              v.habilitada,
              `${nombre} / ${rol} / ${estado} / ${JSON.stringify(marcas)}`,
            ).toBe(esperado.includes(nombre));
            comparaciones += 1;
          }

          // Y lo que el motor deja habilitado es EXACTAMENTE la lista que devolvía el original.
          expect(
            FIRMAS.filter(
              (n) => resolverAccion(n, { rol, hechos }).habilitada,
            ),
            `${rol} / ${estado} / ${JSON.stringify(marcas)}`,
          ).toEqual(esperado);

          celdas += 1;
        }
      }
    }

    // 5 estados (los 4 de `LoteEstado` más la ausencia) × 8 marcas × 4 roles = 160 celdas, y tres
    // acciones comparadas en cada una. El plan pedía al menos 4 × 8 × 4 = 128.
    expect(celdas).toBe(5 * 8 * 4);
    expect(comparaciones).toBe(5 * 8 * 4 * 3);
  });

  it("en los dos estados terminales no hay turno para nadie", () => {
    for (const estado of ["APROBADO", "RECHAZADO"] as LoteEstado[]) {
      const hechos = hechosDeLote({
        estado,
        firmaDecisorAt: "2026-07-23T10:00:00Z",
        firmaSecretarioAt: "2026-07-23T11:00:00Z",
        aprobadoAt: "2026-07-23T12:00:00Z",
      });
      for (const rol of ROLES_DEL_TURNO) {
        for (const nombre of FIRMAS) {
          expect(
            resolverAccion(nombre, { rol, hechos }).habilitada,
            `${nombre} / ${rol} / ${estado}`,
          ).toBe(false);
        }
      }
    }
  });

  it("🔴 apagar y no esconder: fuera de turno la firma sigue VISIBLE y con su motivo", () => {
    // El cambio de conducta visible de todo el plan. El secretario de un lote PENDIENTE ya no deja
    // de ver el paso: lo ve apagado, que es lo que la fase entera persigue —«el decisor tiene que
    // saber que un paso existe aunque todavía no le toque»—.
    const hechos = hechosDeLote({ estado: "PENDIENTE" });
    const v = resolverAccion("firmarSecretario", {
      rol: "secretario abogado",
      hechos,
    });
    expect(v.visible).toBe(true);
    expect(v.habilitada).toBe(false);
    expect(v.motivo).toBeTruthy();
    // Y el motivo NO es el genérico del catálogo: nombra la secuencia, que es lo accionable.
    expect(v.motivo).toContain("decisor");
  });

  it("un lote sin estado apaga las tres con «no se puede decidir aquí»", () => {
    const hechos = hechosDeLote({});
    for (const nombre of FIRMAS) {
      const v = resolverAccion(nombre, { rol: "director", hechos });
      expect(v.visible, nombre).toBe(true);
      expect(v.habilitada, nombre).toBe(false);
    }
  });

  it("🔴 el adaptador de compatibilidad ya NO las deja pasar a ciegas", () => {
    // Antes del Plan 09 las tres salían habilitadas para cualquier rol y estado, porque el motor
    // tenía prohibido opinar sobre ellas. Hoy opina, y `isInboxActionVisible` —que no lleva bolsa
    // de hechos— las apaga: sin los hechos del lote, el turno es INDECIDIBLE. Es correcto y es
    // inocuo: ese adaptador NUNCA se usó para las firmas; su gate lo consume
    // `resolveLoteTurnActions`, que sí construye la bolsa.
    for (const nombre of FIRMAS) {
      expect(isInboxActionVisible(nombre, "SORTEADO", "director"), nombre).toBe(
        false,
      );
    }
  });
});

describe("el defecto de D-5, ya invertido", () => {
  it("una cadena que no está en el union sale apagada con su motivo, no desaparecida", () => {
    const v = resolverAccion("accionQueNadieEscribio", {
      rol: "director",
      estado: "RECIBIDO",
    });
    expect(v.visible).toBe(true);
    expect(v.habilitada).toBe(false);
    expect(v.motivo).toBe(MOTIVOS_ACCION.SIN_REGLA);
  });

  it("y el adaptador de compatibilidad ya NO la ofrece: la cuña del Plan 01 se quitó", () => {
    expect(
      isInboxActionVisible("accionQueNadieEscribio", "RECIBIDO", "director"),
    ).toBe(false);
  });
});

/**
 * 🔴 LA EXCEPCIÓN A LA MATRIZ DE ABAJO, DECLARADA COMO DATO — 2026-09-22, Fase 03.19 Plan 19.
 *
 * Es la MISMA excepción que la matriz hermana de `inboxActionStatusRules.test.ts`, y por la misma
 * causa: el gap 4 del UAT del 2026-09-22. `aceptarCaso` y `excusarme` estrenan condiciones sobre la
 * aceptación del caso —el predicado que la versión de tarjetas de la bandeja tenía a mano y que el
 * paso a tabla del Plan 17 dejó atrás—, así que su celda `funcionario decisor × ASIGNADO_DECISOR`
 * DEJA de coincidir con `conductaAnterior`, que ignora `condiciones` a propósito.
 *
 * ⚠️ `REGLAS_VIGENTES` NO SE TOCA. Es la réplica a mano de las reglas ANTERIORES a la fase y su valor
 * está justamente en no importar nada de lo que prueba: que siga diciendo lo de antes es correcto.
 * Lo que cambia es lo que se espera del MOTOR para estas dos.
 */
const CON_GATE_DE_ACEPTACION: readonly InboxActionName[] = [
  "aceptarCaso",
  "excusarme",
];

describe("anti-regresión de conducta: nada legítimo se rompió", () => {
  it("🔴 las 18 reglas vigentes deciden BIT A BIT lo mismo que antes, salvo las DOS del gate de aceptación", () => {
    const conReglaVigente = Object.keys(REGLAS_VIGENTES) as InboxActionName[];
    expect(conReglaVigente).toHaveLength(18);

    let celdas = 0;
    let celdasConGate = 0;
    for (const nombre of conReglaVigente) {
      expect(POLITICA_ACCIONES[nombre].tipo, nombre).toBe("regla");
      const conGate = CON_GATE_DE_ACEPTACION.includes(nombre);
      for (const rol of ROLES) {
        for (const estado of ESTADOS) {
          const anterior = conductaAnterior(nombre, estado, rol);
          // Sin bolsa de hechos, las dos del gate no pueden decidir: apagan con el motivo del dato
          // ausente. La tabla de verdad completa —con la fila puesta y las doce formas que puede
          // tener— está en el bloque del submenú del EPAS, que es su sitio.
          const esperado = conGate ? false : anterior;
          const etiqueta = `${nombre} / ${rol} / ${estado}`;
          expect(isInboxActionVisible(nombre, estado, rol), etiqueta).toBe(
            esperado,
          );
          const v = resolverAccion(nombre, { rol, estado });
          expect(v.habilitada, etiqueta).toBe(esperado);
          if (conGate && anterior) {
            celdasConGate += 1;
            expect(v.motivo, etiqueta).toBe(
              MOTIVOS_ACCION.DATO_AUSENTE("epas.sinAceptar"),
            );
          }
          celdas += 1;
        }
      }
    }
    expect(celdas).toBe(18 * 3 * 8);
    // Las dos acciones × el único par rol/estado en que su regla de rol y estado se cumple.
    expect(celdasConGate).toBe(2);
  });

  it("🔴 y las que NUNCA tuvieron regla siguen ofreciéndose igual que con la cuña puesta", () => {
    for (const nombre of INBOX_ACTION_NAMES) {
      if (nombre in REGLAS_VIGENTES) continue;
      // Las once de la rama del correctivo NO EXISTÍAN antes de este plan: no hay «conducta anterior»
      // contra la que medirlas, y su regla la prueba el bloque de la rama, más abajo.
      if (RAMA.includes(nombre)) continue;
      // Las tres firmas del lote SÍ tenían conducta anterior, pero no la de esta función: su gate
      // vivía en `loteTurnActions` y `conductaAnterior` no sabe nada de él. El Plan 09 las trajo al
      // motor, y su paridad —celda a celda contra el resolver original— la prueba el bloque del
      // turno, más abajo. Medirlas aquí sería medirlas contra un listón que nunca fue el suyo.
      if ((FIRMAS as readonly string[]).includes(nombre)) continue;
      // Las CUATRO del submenú del EPAS tampoco existían antes del Plan 11 de la Fase 03.19, y por
      // la misma razón que las firmas del lote no se miden aquí: su gate vivía en PREDICADOS
      // SUELTOS de `MisAsignadosPage` —`puedeEmitirProvidencia`, `estaAceptado`, `row.eejeId != null`—
      // que `conductaAnterior` no sabe reproducir. Su paridad, celda a celda contra esos predicados
      // copiados a mano, está en el bloque del submenú, más abajo. Medirlas aquí sería medirlas
      // contra un listón que nunca fue el suyo.
      if ((SUBMENU_EPAS as readonly string[]).includes(nombre)) continue;
      const politica = POLITICA_ACCIONES[nombre];
      if (politica.tipo === "oculta") continue; // decisión medida, no efecto colateral
      for (const rol of ROLES) {
        for (const estado of ESTADOS) {
          expect(
            isInboxActionVisible(nombre, estado, rol),
            `${nombre} / ${rol} / ${estado}`,
          ).toBe(conductaAnterior(nombre, estado, rol));
        }
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RAMA DEL CORRECTIVO (Fase 03.18, Plan 04, Tarea 3)
//
// 🔴 NINGUNA DE ESTAS ONCE REGLAS LLEVA `status`, Y NO ES UN OLVIDO. El propio
// `obligacion-hacer.interface.ts` del backend lo declara: «ESTA RAMA NO ES UNA MÁQUINA DE
// ESTADOS… mientras el expediente lleve correctivo, todas las acciones están disponibles
// siempre», y `EN_EJECUCION_HACER` «no se cableará nunca». Un estado EPAS aquí no gatea: abre.
// Lo que gatea son HECHOS DERIVADOS que el backend ya resuelve y ya envía.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Las once de la rama: diez actos de escritura más el registro de la multa compulsoria. */
const RAMA: InboxActionName[] = [
  "declararHacer",
  "deshacerHacer",
  "adjuntarInforme",
  "acreditarCumplimiento",
  "constatarIncumplimiento",
  "registrarAlegacion",
  "ordenarSustitutoria",
  "registrarDiligencia",
  "registrarRespaldoCostos",
  "registrarGastosSustitutoria",
  "registrarMultaCompulsoria",
];

const DECISOR: InboxRole = "funcionario decisor";

const TERMINO = (
  estado: "SIN_TRASLADO" | "SIN_NOTIFICAR" | "EN_CURSO" | "VENCIDO",
) => ({
  estado,
  motivo: null,
  trasladoDocId: null,
  trasladoEmitidoAt: null,
  arrancaAt: null,
  arrancoPorAgotamiento: false,
  plazoDias: estado === "SIN_TRASLADO" ? null : 5,
  venceAt: null,
  vencido: estado === "VENCIDO",
  diasHabilesRestantes: null,
  calendarioCargadoHasta: null,
  habilitaMultaCompulsoria: estado === "VENCIDO",
  alegacionDocId: null,
  alegacionIngresadaAt: null,
  terminoUsado: false,
  alegacionResueltaAt: null,
  alegacionPendiente: false,
});

/**
 * 🔴 EL FIXTURE DE BANDEJA: lo que de verdad viaja en la FILA de las cuatro bandejas. Sin peldaño,
 * porque `PeldanoCompulsorio` solo viaja en `GET /obligacion-hacer/:eejeId`. Es el fixture que
 * demuestra que ninguna de las once reglas queda INDECIDIBLE en la pantalla donde se usa.
 */
const enBandeja = (
  over: Partial<ObligacionHacerEnBandeja> = {},
): ObligacionHacerEnBandeja => ({
  tiene: true,
  cumplida: false,
  cumplidaAt: null,
  multasCompulsorias: 0,
  tieneInforme: false,
  sustitutoriaOrdenada: false,
  terminoAlegacion: TERMINO("SIN_TRASLADO"),
  ...over,
});

/** El fixture del DETALLE: la única forma que trae el peldaño. */
const enDetalle = (
  over: Partial<ObligacionHacerEnBandeja> = {},
): ObligacionHacerDetalle => {
  const base = enBandeja(over);
  return {
    obligacionHacer: {
      tiene: base.tiene,
      cumplida: base.cumplida,
      cumplidaAt: base.cumplidaAt,
      multasCompulsorias: base.multasCompulsorias,
      tieneInforme: base.tieneInforme,
      sustitutoriaOrdenada: base.sustitutoriaOrdenada,
    },
    serieCompulsorias: {
      serie: [],
      peldano: {
        registradas: 0,
        ordinalSiguiente: 1,
        serieAgotada: false,
        incumplimientoConstatadoDespuesDeLaUltimaMulta: false,
      },
    },
    diligencias: [],
    terminoAlegacion: base.terminoAlegacion,
  };
};

/** Resuelve una acción de la rama con el rol del decisor y la bolsa que trae ese bloque. */
const veredicto = (
  nombre: InboxActionName,
  bloque: ObligacionHacerEnBandeja | ObligacionHacerDetalle,
  rol: InboxRole = DECISOR,
) => resolverAccion(nombre, { rol, hechos: hechosDeObligacionHacer(bloque) });

describe("rama del correctivo: las once reglas sobre hechos derivados", () => {
  it("las once están en el union y todas tienen política de regla", () => {
    for (const nombre of RAMA) {
      expect(INBOX_ACTION_NAMES, nombre).toContain(nombre);
      expect(POLITICA_ACCIONES[nombre].tipo, nombre).toBe("regla");
    }
  });

  it("🔴 ninguna declara `status`: la rama no es una máquina de estados", () => {
    for (const nombre of RAMA) {
      const regla = reglaUnica(POLITICA_ACCIONES[nombre]);
      expect(regla.status, nombre).toBeUndefined();
      expect(regla.roles, nombre).toEqual(["funcionario decisor"]);
    }
  });

  it("sin correctivo declarado, diez salen apagadas con su motivo — y declararHacer NO", () => {
    const sin = enBandeja({ tiene: false });
    const motivoDeLaPuerta = MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA(
      "obligacionHacer.tiene",
    );

    for (const nombre of RAMA) {
      const v = veredicto(nombre, sin);
      expect(v.visible, nombre).toBe(true); // apagar y no esconder
      if (nombre === "declararHacer") {
        // Es la ÚNICA que procede cuando todavía no hay correctivo: es la que lo declara. Exigirle
        // que el expediente ya lo lleve la haría inalcanzable para siempre.
        expect(v.habilitada, nombre).toBe(true);
        continue;
      }
      expect(v.habilitada, nombre).toBe(false);
      expect(v.motivo, nombre).toBe(motivoDeLaPuerta);
    }
  });

  it("con correctivo y SIN informe, acreditar el cumplimiento se apaga nombrando el informe", () => {
    const v = veredicto(
      "acreditarCumplimiento",
      enBandeja({ tieneInforme: false }),
    );
    expect(v.habilitada).toBe(false);
    expect(v.motivo).toBe(
      MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA("obligacionHacer.tieneInforme"),
    );
    expect(v.motivo).toContain(motivoDeHecho("obligacionHacer.tieneInforme"));

    // Y con informe sí procede: el endpoint exige `docId`, y sin informe no hay documento que citar.
    expect(
      veredicto("acreditarCumplimiento", enBandeja({ tieneInforme: true }))
        .habilitada,
    ).toBe(true);
  });

  it("el término en curso habilita la alegación; sin trasladar, la apaga con motivo", () => {
    expect(
      veredicto(
        "registrarAlegacion",
        enBandeja({ terminoAlegacion: TERMINO("EN_CURSO") }),
      ).habilitada,
    ).toBe(true);

    const v = veredicto(
      "registrarAlegacion",
      enBandeja({ terminoAlegacion: TERMINO("SIN_TRASLADO") }),
    );
    expect(v.habilitada).toBe(false);
    expect(v.motivo).toBe(
      MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA(
        "obligacionHacer.terminoAlegacion.estado",
      ),
    );
  });

  it("🔴 el término VENCIDO habilita la multa compulsoria — habilita, no la dispara", () => {
    expect(
      veredicto(
        "registrarMultaCompulsoria",
        enBandeja({ terminoAlegacion: TERMINO("VENCIDO") }),
      ).habilitada,
    ).toBe(true);
    expect(
      veredicto(
        "registrarMultaCompulsoria",
        enBandeja({ terminoAlegacion: TERMINO("EN_CURSO") }),
      ).habilitada,
    ).toBe(false);
  });

  it("sin sustitutoria ordenada se apagan costos y gastos — la diligencia NO", () => {
    const sinSustitutoria = enBandeja({ sustitutoriaOrdenada: false });
    for (const nombre of [
      "registrarRespaldoCostos",
      "registrarGastosSustitutoria",
    ] as InboxActionName[]) {
      const v = veredicto(nombre, sinSustitutoria);
      expect(v.habilitada, nombre).toBe(false);
      expect(v.motivo, nombre).toBe(
        MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA(
          "obligacionHacer.sustitutoriaOrdenada",
        ),
      );
    }

    // 🔴 El backend AVISA y NUNCA BLOQUEA al registrar una diligencia sin sustitutoria ordenada.
    // Convertir esa advertencia en puerta cerrada sería reimplementar en pantalla una regla que el
    // servidor decidió NO tener.
    expect(veredicto("registrarDiligencia", sinSustitutoria).habilitada).toBe(
      true,
    );
  });

  it("con un secretario o un director, las once salen apagadas por rol", () => {
    for (const rol of ["secretario abogado", "director"] as InboxRole[]) {
      for (const nombre of RAMA) {
        const v = veredicto(nombre, enDetalle({ tiene: true }), rol);
        expect(v.visible, nombre + " / " + rol).toBe(true);
        expect(v.habilitada, nombre + " / " + rol).toBe(false);
        expect(v.motivo, nombre + " / " + rol).toBe(
          MOTIVOS_ACCION.FUERA_DE_ROL,
        );
      }
    }
  });

  it("🔴 en una FILA DE BANDEJA, donde el peldaño no viaja, ninguna queda indecidible", () => {
    const fila = enBandeja({
      tiene: true,
      tieneInforme: true,
      sustitutoriaOrdenada: true,
      terminoAlegacion: TERMINO("VENCIDO"),
    });
    const hechos = hechosDeObligacionHacer(fila);

    // La premisa de la prueba: el peldaño NO está en la bolsa. Si algún día viajara, este caso
    // dejaría de demostrar lo que dice demostrar.
    expect(hechos).not.toHaveProperty(
      "obligacionHacer.peldano.ordinalSiguiente",
    );
    expect(hechos).not.toHaveProperty("obligacionHacer.peldano.serieAgotada");

    const motivosDeDatoAusente = [
      MOTIVOS_ACCION.DATO_AUSENTE("obligacionHacer.peldano.ordinalSiguiente"),
      MOTIVOS_ACCION.DATO_AUSENTE("obligacionHacer.peldano.serieAgotada"),
    ];
    for (const nombre of RAMA) {
      const v = veredicto(nombre, fila);
      expect(motivosDeDatoAusente, nombre + " salió indecidible").not.toContain(
        v.motivo,
      );
      expect(v.motivo ?? "", nombre).not.toContain("no trae el dato");
    }
  });

  it("y el peldaño del DETALLE tampoco cambia el veredicto de ninguna: no es puerta", () => {
    const over = {
      tiene: true,
      tieneInforme: true,
      sustitutoriaOrdenada: true,
      terminoAlegacion: TERMINO("VENCIDO"),
    };
    for (const nombre of RAMA) {
      expect(veredicto(nombre, enDetalle(over)), nombre).toEqual(
        veredicto(nombre, enBandeja(over)),
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PUERTA DE LA RAMA (corrección de CR-01)
//
// 🔴 `verObligacionHacer` NO ES LA DUODÉCIMA DE `RAMA`, y por eso se prueba aparte: las once
// de `RAMA` son ACTOS —del decisor, gateados por hechos— y ésta es una LECTURA. Meterla en `RAMA`
// rompería, con razón, las dos aserciones que ese bloque hace sobre las once (rol único y
// condiciones sobre hechos).
//
// Lo que estas pruebas fijan es el invariante que se violó: la puerta NO puede depender de que el
// correctivo ya exista, porque dentro de ella está la única acción que lo declara.
// ═════════════════════════════════════════════════════════════════════════════════════════════
describe("verObligacionHacer: la puerta de lectura de la rama", () => {
  it("está en el union y tiene política de regla", () => {
    expect(INBOX_ACTION_NAMES).toContain("verObligacionHacer");
    expect(POLITICA_ACCIONES.verObligacionHacer.tipo).toBe("regla");
  });

  it("🔴 no declara NINGUNA condición sobre hechos, ni `status`", () => {
    const regla = reglaUnica(POLITICA_ACCIONES.verObligacionHacer);
    // Una condición sobre `obligacionHacer.tiene` es exactamente lo que cerró la rama en CR-01; y
    // una condición cualquiera quedaría además INDECIDIBLE en las filas que no traen el bloque.
    expect(regla.condiciones).toBeUndefined();
    expect(regla.status).toBeUndefined();
  });

  it("🔴 con el correctivo declarado Y SIN declarar, el decisor entra igual", () => {
    for (const bloque of [enBandeja({ tiene: true }), enBandeja({ tiene: false })]) {
      const v = veredicto("verObligacionHacer", bloque);
      expect(v.visible).toBe(true);
      expect(v.habilitada, JSON.stringify(bloque)).toBe(true);
    }
    // Y sin bloque ninguno —que es lo que manda el backend cuando no hay correctivo— tampoco se
    // apaga con «falta el dato»: la regla no pregunta por ninguno.
    const sinBolsa = resolverAccion("verObligacionHacer", {
      rol: "funcionario decisor",
    });
    expect(sinBolsa.habilitada).toBe(true);
  });

  it("la abren los TRES roles de las cuatro lecturas del controlador, y sólo ellos", () => {
    for (const rol of ROLES) {
      expect(
        resolverAccion("verObligacionHacer", { rol }).habilitada,
        rol,
      ).toBe(true);
    }
    const ajeno = resolverAccion("verObligacionHacer", { rol: "administrador" });
    expect(ajeno.visible).toBe(true); // apagar y no esconder
    expect(ajeno.habilitada).toBe(false);
    expect(ajeno.motivo).toBe(MOTIVOS_ACCION.FUERA_DE_ROL);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS CUATRO ENTRADAS DEL SUBMENÚ DEL EPAS (Fase 03.19, Plan 11 — D-11)
//
// 🔴 QUÉ SE ESTÁ ARREGLANDO. El `⋮` de la bandeja del decisor ofrecía nueve entradas, y CUATRO de
// ellas no pasaban por el motor: se gateaban con predicados sueltos escritos en la propia página.
// Eso es exactamente lo que D-6 de la Fase 03.18 vino a recoger —una decisión de permiso que vive
// fuera de la tabla es una decisión que nadie puede auditar, y que nada obliga a mantener
// coherente con el backend—.
//
// 🔴 LOS PREDICADOS SE REPRODUCEN A MANO, NO SE IMPORTAN. Misma doctrina que `conductaAnterior` y
// que `turnoAnterior`: si el esperado saliera de la función que se está sustituyendo, la prueba
// seguiría verde el día en que la sustitución cambiara la conducta de las dos a la vez.
//
// 🔴 Y NINGUNA DE LAS CUATRO DECLARA `status`. Ninguno de los predicados que sustituyen miraba el
// estado del EPAS: miraban la ACEPTACIÓN, que no es un estado sino una marca del sorteo. Inventarle
// un `status` a estas reglas sería inventar una máquina de estados que el módulo no tiene, y
// apagaría el submenú entero en cuanto el expediente avanzara.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Las cuatro que entran al motor con este plan. */
const SUBMENU_EPAS = [
  "generarDocumento",
  "adjuntarDocumento",
  "descargarExpediente",
  "accionesImpugnacion",
] as const satisfies readonly InboxActionName[];

/** Lo que la FILA de la bandeja del decisor trae sobre la aceptación del caso. */
type FilaAceptacion = {
  aceptado?: boolean;
  aceptadoImplicito?: boolean;
  excusaPendiente?: boolean;
};

/**
 * `puedeEmitirProvidencia` TAL Y COMO ESTÁ ESCRITO en `providenciaComposicion.ts`, copiado
 * literalmente. Era el listón de «Generar documento» — con UNA celda de diferencia, la del bloque
 * de más abajo.
 */
function puedeEmitirAnterior(fila: FilaAceptacion): boolean {
  return fila.aceptado === true && fila.excusaPendiente !== true;
}

/**
 * `estaAceptado` TAL Y COMO ESTÁ ESCRITO en `MisAsignadosPage.tsx`, copiado literalmente. Es el
 * listón de «Descargar expediente» y el de la rama de impugnación, que solo se monta en la FASE 2.
 */
function estaAceptadoAnterior(fila: FilaAceptacion): boolean {
  return fila.aceptado ?? fila.aceptadoImplicito ?? false;
}

/** Las 12 combinaciones de las tres marcas de aceptación, como el backend las envía. */
const FILAS: FilaAceptacion[] = [true, false, undefined].flatMap((aceptado) =>
  [true, false].flatMap((excusaPendiente) =>
    [true, undefined].map((aceptadoImplicito) => ({
      ...(aceptado === undefined ? {} : { aceptado }),
      ...(aceptadoImplicito === undefined ? {} : { aceptadoImplicito }),
      excusaPendiente,
    })),
  ),
);

describe("submenú del EPAS: las cuatro decisiones sueltas, ya en el motor", () => {
  it("las cuatro están en el union y TRES son del decisor; la descarga ya no (2026-09-29)", () => {
    for (const nombre of SUBMENU_EPAS) {
      expect(INBOX_ACTION_NAMES, nombre).toContain(nombre);
      const politica = POLITICA_ACCIONES[nombre];
      expect(politica.tipo, nombre).toBe("regla");
      if (politica.tipo !== "regla") throw new Error("imposible");

      // 🔴 `descargarExpediente` es el PRIMER caso con reglas alternativas: el secretario abogado y
      // el director la tienen sobre cualquier expediente (actividad 18 de PRO-GEJ-001), y el
      // decisor sobre los suyos ya aceptados. Las otras tres siguen siendo suyas y solo suyas.
      if (nombre === "descargarExpediente") {
        expect(Array.isArray(politica.regla), nombre).toBe(true);
        continue;
      }

      const regla = reglaUnica(politica);
      expect(regla.roles, nombre).toEqual(["funcionario decisor"]);
      expect(regla.status, nombre).toBeUndefined();
    }
  });

  it("🔴 la descarga del expediente la tienen los TRES roles operativos, y solo el decisor con condición", () => {
    const politica = POLITICA_ACCIONES.descargarExpediente;
    if (politica.tipo !== "regla" || !Array.isArray(politica.regla)) {
      throw new Error("descargarExpediente debe tener reglas alternativas");
    }
    const hechos = hechosDelEpas({ aceptado: true, excusaPendiente: false });

    // Secretario y director: sin condición, sobre cualquier expediente — es SU trabajo llevarlo a
    // certificar, y esos expedientes no son suyos.
    for (const rol of ["secretario abogado", "director"] as InboxRole[]) {
      expect(resolverAccion("descargarExpediente", { rol }).habilitada, rol).toBe(
        true,
      );
    }

    // El decisor CONSERVA su condición de aceptación: la fase 1 de su bandeja enseña un resumen
    // mínimo a propósito, y ofrecer ahí la descarga completa contradiría esa decisión.
    expect(
      resolverAccion("descargarExpediente", { rol: DECISOR, hechos }).habilitada,
    ).toBe(true);
    expect(
      resolverAccion("descargarExpediente", {
        rol: DECISOR,
        hechos: hechosDelEpas({ aceptado: false, excusaPendiente: false }),
      }).habilitada,
    ).toBe(false);
  });

  it("🔴 PARIDAD: sobre 12 filas, el motor decide lo mismo que los predicados sueltos", () => {
    let celdas = 0;

    for (const fila of FILAS) {
      const hechos = hechosDelEpas(fila);
      const ctx = { rol: DECISOR, hechos };

      // 🔴 EL LISTÓN DE «Generar documento» ES EL VEREDICTO EFECTIVO, NO EL LITERAL DE
      // `puedeEmitirProvidencia`. Los dos predicados sueltos DISCREPABAN entre sí en una celda, y
      // la discrepancia se resuelve aquí a favor del que la bandeja ya usaba para partirse en dos
      // fases. El porqué, con su única celda, está en la prueba siguiente.
      expect(
        resolverAccion("generarDocumento", ctx).habilitada,
        `generarDocumento / ${JSON.stringify(fila)}`,
      ).toBe(estaAceptadoAnterior(fila) && fila.excusaPendiente !== true);

      for (const nombre of [
        "descargarExpediente",
        "accionesImpugnacion",
      ] as const) {
        expect(
          resolverAccion(nombre, ctx).habilitada,
          `${nombre} / ${JSON.stringify(fila)}`,
        ).toBe(estaAceptadoAnterior(fila));
      }

      // «Adjuntar documento» no miraba la aceptación: su único gate de pantalla era que el caso
      // tuviera expediente, y ésa es una condición de la FILA, no del motor. Para el motor, la
      // ventana real la impone el backend y la regla solo anticipa el rol.
      expect(
        resolverAccion("adjuntarDocumento", ctx).habilitada,
        `adjuntarDocumento / ${JSON.stringify(fila)}`,
      ).toBe(true);

      celdas += 1;
    }

    // 3 formas de `aceptado` × 2 de `excusaPendiente` × 2 de `aceptadoImplicito` = 12.
    expect(celdas).toBe(12);
  });

  it("🔴 LA ÚNICA CELDA EN QUE LOS DOS PREDICADOS SUELTOS SE CONTRADECÍAN", () => {
    // La fila: sin `aceptado` y con `aceptadoImplicito` en verdadero. Es la que manda un backend
    // ANTERIOR al veredicto efectivo, cuando el plazo de aceptación ya venció.
    //
    //   · `estaAceptado`           → VERDADERO (cae a `aceptadoImplicito` por compatibilidad), así
    //                                que la card se abre en FASE 2 y ofrece descargar el expediente.
    //   · `puedeEmitirProvidencia` → FALSO (exige `aceptado === true`), así que en esa MISMA fila
    //                                «Emitir providencia» no aparecía.
    //
    // Es decir: el decisor podía descargar el expediente de un caso del que no podía emitir ni una
    // providencia, sin que nada le dijera por qué. Dos nociones de «aceptado» conviviendo en el
    // mismo menú es exactamente la clase de divergencia que el motor existe para no tener.
    //
    // 🔴 SE RESUELVE A FAVOR DEL VEREDICTO EFECTIVO, y no es una preferencia. El backend deriva
    // `aceptado` en SQL como «aceptado explícita O implícitamente» y lo envía SIEMPRE, así que
    // `aceptadoImplicito` es solo el respaldo heredado; y cuando ese respaldo dice que el plazo
    // venció, el decisor SÍ se hizo cargo del caso. Con el backend vigente esta celda no se puede
    // dar —`aceptado` nunca falta—, así que el cambio no altera ninguna pantalla de hoy.
    const filaHeredada: FilaAceptacion = {
      aceptadoImplicito: true,
      excusaPendiente: false,
    };

    expect(puedeEmitirAnterior(filaHeredada)).toBe(false);
    expect(estaAceptadoAnterior(filaHeredada)).toBe(true);

    // El motor se alinea con la aceptación efectiva: las tres entradas que dependen de ella deciden
    // ahora LO MISMO sobre la misma fila, que es lo que faltaba.
    const ctx = { rol: DECISOR, hechos: hechosDelEpas(filaHeredada) };
    for (const nombre of [
      "generarDocumento",
      "descargarExpediente",
      "accionesImpugnacion",
    ] as const) {
      expect(resolverAccion(nombre, ctx).habilitada, nombre).toBe(true);
    }
  });

  it("y con el veredicto efectivo ausente del todo, ninguna de las tres decide", () => {
    // La otra mitad del cambio, y la que importa más: donde la página trataba «no lo sé» como «no»,
    // el motor lo trata como indecidible. Apaga igual, pero por el motivo correcto.
    const ctx = { rol: DECISOR, hechos: hechosDelEpas({ excusaPendiente: false }) };
    for (const nombre of [
      "generarDocumento",
      "descargarExpediente",
      "accionesImpugnacion",
    ] as const) {
      const v = resolverAccion(nombre, ctx);
      expect(v.habilitada, nombre).toBe(false);
      expect(v.motivo, nombre).toBe(MOTIVOS_ACCION.DATO_AUSENTE("epas.aceptado"));
    }
  });

  it("🔴 apagar y no esconder: las cuatro salen VISIBLES con cualquier rol y estado", () => {
    for (const nombre of SUBMENU_EPAS) {
      for (const rol of ROLES) {
        for (const estado of ESTADOS) {
          const v = resolverAccion(nombre, { rol, estado });
          expect(v.visible, `${nombre} / ${rol} / ${estado}`).toBe(true);
          if (!v.habilitada) expect(v.motivo, `${nombre} / ${rol}`).toBeTruthy();
        }
      }
    }
  });

  it("fuera del rol del decisor, TRES se apagan nombrando el rol y no la aceptación", () => {
    // El orden de los filtros ES la conducta: al secretario se le dice que el paso no es suyo, no
    // que acepte un caso que nunca va a poder aceptar.
    //
    // ⟳ 2026-09-29: `descargarExpediente` sale de esta prueba porque para el secretario y el
    // director ya NO se apaga — la tiene su propia prueba arriba. Las otras tres no cambian.
    const hechos = hechosDelEpas({ aceptado: true, excusaPendiente: false });
    for (const nombre of SUBMENU_EPAS.filter(
      (n) => n !== "descargarExpediente",
    )) {
      for (const rol of ["secretario abogado", "director"] as InboxRole[]) {
        const v = resolverAccion(nombre, { rol, hechos });
        expect(v.habilitada, `${nombre} / ${rol}`).toBe(false);
        expect(v.motivo, `${nombre} / ${rol}`).toBe(MOTIVOS_ACCION.FUERA_DE_ROL);
      }
    }
  });

  it("🔴 lo indecidible se apaga: sin bolsa de hechos, tres de las cuatro no deciden", () => {
    // Es la doctrina heredada, y aquí importa: una pantalla que no traiga la marca de aceptación no
    // puede afirmar «no procede» —no lo sabe—, así que apaga diciendo que no puede decidirlo.
    for (const nombre of [
      "generarDocumento",
      "descargarExpediente",
      "accionesImpugnacion",
    ] as const) {
      const v = resolverAccion(nombre, { rol: DECISOR });
      expect(v.visible, nombre).toBe(true);
      expect(v.habilitada, nombre).toBe(false);
      expect(v.motivo, nombre).toBe(
        MOTIVOS_ACCION.DATO_AUSENTE("epas.aceptado"),
      );
    }

    // La cuarta no pregunta por ningún hecho, así que no hay nada que quedara indecidible.
    expect(resolverAccion("adjuntarDocumento", { rol: DECISOR }).habilitada).toBe(
      true,
    );
  });

  it("la excusa pendiente apaga «Generar documento» diciendo qué falta, no «no disponible»", () => {
    const v = resolverAccion("generarDocumento", {
      rol: DECISOR,
      hechos: hechosDelEpas({ aceptado: true, excusaPendiente: true }),
    });
    expect(v.habilitada).toBe(false);
    expect(v.motivo).toBe(
      MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA("epas.sinExcusaPendiente"),
    );
    // Formato obligatorio del UI-SPEC §5.2: la frase nombra la condición que falta.
    expect(v.motivo).toContain(motivoDeHecho("epas.sinExcusaPendiente"));
    expect(v.motivo).not.toMatch(/no disponible|sin permisos|no permitida/i);
  });

  it("🔴 «Formas de notificación» NO se toca: sigue siendo del secretario, en recepción", () => {
    // D-05 la saca del `⋮` del DECISOR, que es una decisión de PANTALLA. La regla del motor ya
    // decía que es acto del secretario y en recepción: retirarla del submenú ALINEA la pantalla con
    // la regla, no la cambia. Si este bloque falla, alguien tocó la regla creyendo aplicar D-05.
    const regla = reglaUnica(POLITICA_ACCIONES.formasNotificacion);
    expect(regla.roles).toEqual(["secretario abogado"]);
    expect(regla.status).toEqual(["RECIBIDO", "VERIFICADO"]);
    expect(regla.condiciones).toBeUndefined();
    expect(
      resolverAccion("formasNotificacion", {
        rol: DECISOR,
        estado: "ASIGNADO_DECISOR",
      }).habilitada,
    ).toBe(false);
  });

  it("🔴 «Adjuntar documento» y el MODAL del anexo son dos nombres y dos preguntas", () => {
    // `anexarDocumento` es el modal (quick 260917-anx) y conserva su regla VACÍA: la ventana en que
    // se puede anexar la hace cumplir el backend, y replicarla aquí crearía una segunda verdad.
    // `adjuntarDocumento` es la ENTRADA del submenú, y lo que decide es de quién es el paso. Es la
    // misma distinción que CR-01 pagó caro por no hacer entre entrar a leer y registrar un acto.
    const modal = POLITICA_ACCIONES.anexarDocumento;
    if (modal.tipo !== "regla") throw new Error("imposible");
    expect(modal.regla).toEqual({});
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// «ACEPTAR» Y «EXCUSARME»: LA TABLA DE VERDAD COMPLETA (Fase 03.19, Plan 19 — gap 4 del UAT).
//
// 🔴 QUÉ SE ESTÁ FIJANDO. Las dos entradas se ofrecían para siempre, también sobre un caso ya
// aceptado o autoaceptado, porque su gate era solo rol + estado y aceptar NO cambia el estado del
// EPAS. El gate que faltaba existía a mano en la versión de TARJETAS de la bandeja —`!aceptado &&
// !excusaPendiente`, las dos condiciones en las dos acciones— y el paso a tabla del Plan 17 lo dejó
// atrás. Aquí se recorren las DOCE formas que puede tener la fila para que no vuelva a irse.
//
// 🔴 EL LISTÓN SE ESCRIBE COMO PREDICADO, NO CELDA A CELDA. Igual que la matriz de paridad del
// bloque de arriba: una lista de doce booleanos copiados a mano se puede «arreglar» al color de lo
// que el código haga, y un predicado no. Reusa `FILAS`, `DECISOR` y `estaAceptadoAnterior` del
// bloque del submenú en vez de duplicarlos: son la misma pregunta sobre la misma fila.
//
// 🔴 Y LA CELDA DE LA MARCA AUSENTE SE AFIRMA POR SU MOTIVO. No cumple el predicado, pero por una
// razón DISTINTA —no se sabe, en vez de no procede—, y esa distinción es la que el motor existe
// para sostener y la que el UAT pidió probar antes de dar el arreglo por bueno.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Las dos que recuperan su gate con este plan. Llevan rol Y `status`, al revés que las del `⋮`. */
const ACEPTAR_Y_EXCUSARSE = [
  "aceptarCaso",
  "excusarme",
] as const satisfies readonly InboxActionName[];

/** ¿La fila trae la marca de la aceptación, sea cual sea su valor? */
const diceLaAceptacion = (fila: FilaAceptacion): boolean =>
  fila.aceptado !== undefined || fila.aceptadoImplicito !== undefined;

describe("«Aceptar» y «Excusarme»: el gate que el Plan 17 dejó atrás, sobre las doce filas", () => {
  it("las dos declaran sus DOS condiciones, en el orden que decide el motivo", () => {
    // El orden no es estético: `resolverRegla` pinta el motivo de la PRIMERA condición incumplida, y
    // cuando el caso ya está aceptado lo accionable que hay que decir es eso, no la excusa.
    for (const nombre of ACEPTAR_Y_EXCUSARSE) {
      const regla = reglaUnica(POLITICA_ACCIONES[nombre]);
      expect(regla.roles, nombre).toEqual(["funcionario decisor"]);
      expect(regla.status, nombre).toBe("ASIGNADO_DECISOR");
      expect(regla.condiciones, nombre).toEqual([
        { hecho: "epas.sinAceptar", es: true },
        { hecho: "epas.sinExcusaPendiente", es: true },
      ]);
      // Sin motivo personalizado: sustituiría TAMBIÉN al de rol y al de estado, y estas dos gatean
      // por los dos. Un secretario leería el texto de la aceptación en vez de que el paso no es suyo.
      expect(regla.motivoPersonalizado, nombre).toBeUndefined();
    }
  });

  it("🔴 TABLA DE VERDAD: habilitada ⟺ el caso sigue sin aceptar Y no hay excusa esperando", () => {
    let celdas = 0;
    let celdasAusentes = 0;

    for (const fila of FILAS) {
      const ctx = {
        rol: DECISOR,
        estado: "ASIGNADO_DECISOR",
        hechos: hechosDelEpas(fila),
      };
      const etiqueta = JSON.stringify(fila);
      const conocida = diceLaAceptacion(fila);
      // El listón, como predicado. `estaAceptadoAnterior` es el VEREDICTO EFECTIVO —cae a
      // `aceptadoImplicito`—, así que la autoaceptación por vencimiento del plazo cuenta: es el caso
      // literal del reporte del usuario.
      const esperado =
        conocida && !estaAceptadoAnterior(fila) && fila.excusaPendiente !== true;

      for (const nombre of ACEPTAR_Y_EXCUSARSE) {
        const v = resolverAccion(nombre, ctx);
        const donde = `${nombre} / ${etiqueta}`;

        // Apagar no es esconder (D-7): las dos siguen VISIBLES en las doce filas.
        expect(v.visible, donde).toBe(true);
        expect(v.habilitada, donde).toBe(esperado);

        if (!v.habilitada) {
          // Cada apagado trae su porqué, y nunca un «no disponible» a secas.
          expect(v.motivo, donde).toBeTruthy();
          expect(v.motivo, donde).not.toMatch(
            /no disponible|sin permisos|no permitida/i,
          );
          // 🔴 EL LISTÓN DEL PLAN: ninguno de los motivos se lee del revés. Con
          // `{ hecho: "epas.aceptado", es: false }` este expect caería en las diez filas conocidas.
          expect(v.motivo, donde).not.toMatch(/ya aceptó el caso/i);

          if (!conocida) {
            // La celda del hecho AUSENTE: «no se puede decidir aquí», no «no procede». El dato
            // ausente manda sobre el incumplido, así que gana incluso con la excusa pendiente.
            expect(v.motivo, donde).toBe(
              MOTIVOS_ACCION.DATO_AUSENTE("epas.sinAceptar"),
            );
          } else if (estaAceptadoAnterior(fila)) {
            expect(v.motivo, donde).toBe(
              MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA("epas.sinAceptar"),
            );
          } else {
            expect(v.motivo, donde).toBe(
              MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA("epas.sinExcusaPendiente"),
            );
          }
        }
      }

      if (!conocida) celdasAusentes += 1;
      celdas += 1;
    }

    // 3 formas de `aceptado` × 2 de `excusaPendiente` × 2 de `aceptadoImplicito` = 12.
    expect(celdas).toBe(12);
    // Y dos de las doce no traen NINGUNA marca de aceptación: son las del modo de fallo probado.
    expect(celdasAusentes).toBe(2);
  });

  it("🔴 sobre un caso YA ACEPTADO las dos están apagadas, y el motivo se lee del derecho", () => {
    // El reporte del usuario, dicho en una sola celda: «ya está aceptado … por el funcionario».
    const ctx = {
      rol: DECISOR,
      estado: "ASIGNADO_DECISOR",
      hechos: hechosDelEpas({ aceptado: true, excusaPendiente: false }),
    };
    for (const nombre of ACEPTAR_Y_EXCUSARSE) {
      const v = resolverAccion(nombre, ctx);
      expect(v.habilitada, nombre).toBe(false);
      expect(v.motivo, nombre).toBe(
        MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA("epas.sinAceptar"),
      );
      // Formato obligatorio del UI-SPEC §5.2: la frase nombra la condición que falta.
      expect(v.motivo, nombre).toContain(motivoDeHecho("epas.sinAceptar"));
    }
  });

  it("🔴 y por AUTOACEPTACIÓN al vencer el plazo, igual: el veredicto efectivo cuenta", () => {
    // La otra mitad del reporte: «o autoaceptado». La aceptación por vencimiento la deriva el
    // backend y viaja en `aceptadoImplicito`; el navegador no la recalcula.
    const ctx = {
      rol: DECISOR,
      estado: "ASIGNADO_DECISOR",
      hechos: hechosDelEpas({
        aceptadoImplicito: true,
        excusaPendiente: false,
      }),
    };
    for (const nombre of ACEPTAR_Y_EXCUSARSE) {
      const v = resolverAccion(nombre, ctx);
      expect(v.habilitada, nombre).toBe(false);
      expect(v.motivo, nombre).toBe(
        MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA("epas.sinAceptar"),
      );
    }
  });

  it("🔴 sobre un caso SIN aceptar las dos siguen ENCENDIDAS: es lo que la bandeja pide", () => {
    // El riesgo REAL de este plan (T-03.19-19-06, severidad alta): apagar «Aceptar» a quien sí puede
    // aceptar dejaría la bandeja del decisor sin su única función. Esta es la prueba que lo impide.
    const ctx = {
      rol: DECISOR,
      estado: "ASIGNADO_DECISOR",
      hechos: hechosDelEpas({ aceptado: false, excusaPendiente: false }),
    };
    for (const nombre of ACEPTAR_Y_EXCUSARSE) {
      expect(resolverAccion(nombre, ctx), nombre).toEqual({
        visible: true,
        habilitada: true,
      });
    }
  });

  it("con la excusa esperando al director, las dos apagan NOMBRANDO la excusa", () => {
    // Lo declara el propio DTO: `excusaPendiente` «oculta Excusar/Aceptar». Con una excusa en manos
    // del director, el caso no está esperando una aceptación.
    const ctx = {
      rol: DECISOR,
      estado: "ASIGNADO_DECISOR",
      hechos: hechosDelEpas({ aceptado: false, excusaPendiente: true }),
    };
    for (const nombre of ACEPTAR_Y_EXCUSARSE) {
      const v = resolverAccion(nombre, ctx);
      expect(v.habilitada, nombre).toBe(false);
      expect(v.motivo, nombre).toBe(
        MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA("epas.sinExcusaPendiente"),
      );
    }
  });

  it("el orden de los filtros NO cambió: manda el rol, luego el estado, luego los hechos", () => {
    // Con el caso ya aceptado —o sea, con la condición incumplida— el motivo sigue siendo el del rol
    // para quien no es decisor, y el del estado para el decisor sobre otro estado. Si esto se
    // invirtiera, un secretario leería un texto sobre una aceptación que nunca va a firmar.
    const hechos = hechosDelEpas({ aceptado: true, excusaPendiente: false });
    for (const nombre of ACEPTAR_Y_EXCUSARSE) {
      for (const rol of ["secretario abogado", "director"] as InboxRole[]) {
        expect(
          resolverAccion(nombre, { rol, estado: "ASIGNADO_DECISOR", hechos })
            .motivo,
          `${nombre} / ${rol}`,
        ).toBe(MOTIVOS_ACCION.FUERA_DE_ROL);
      }
      expect(
        resolverAccion(nombre, {
          rol: DECISOR,
          estado: "EN_EJECUCION",
          hechos,
        }).motivo,
        nombre,
      ).toBe(MOTIVOS_ACCION.FUERA_DE_ESTADO);
    }
  });
});
