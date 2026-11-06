/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: Unidad pura del gate de aceptación del caso (aceptarCaso) en INBOX_ACTION_STATUS_RULES
 *   (FEND-03/RECE-06) — Fase 3.5
 * Archivo: inboxActionStatusRules.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES que `aceptarCaso` es la ÚNICA acción de
 *   aceptación/firma que entra en la tabla de reglas, gateada al funcionario decisor sobre
 *   ASIGNADO_DECISOR. El turno del LOTE (firmar*) NO va en esta tabla (su gating vive en
 *   loteTurnActions.ts): aquí solo se comprueba que `aceptarCaso` respeta rol + status y que la
 *   comparación de rol es case-insensitive. Unidad pura: no monta React.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 19: el gate de `aceptarCaso` se mide
 *   por `resolverAccion` porque la regla ya exige hechos que el adaptador no transporta, y la matriz
 *   de paridad recibe su excepción ESCRITA para las dos celdas que cambiaron.)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: con el EPAS EN_IMPUGNACION las dieciséis
 *   acciones suspendidas salen apagadas con el motivo de la suspensión; el término SUSPENDIDO apaga
 *   registrar la alegación)
 */

import { describe, it, expect } from "vitest";
import {
  isInboxActionVisible,
  INBOX_ACTION_STATUS_RULES,
} from "./inboxActionStatusRules";
// Fase 03.18, Plan 01 — el motor ampliado. Import aparte para no tocar el bloque de arriba, que es
// el que las pruebas vigentes usan.
import {
  ACCIONES_SUSPENDIDAS_POR_IMPUGNACION,
  aplicarVeredicto,
  proyectarVeredicto,
  resolverAccion,
  CONTEXTO_SIN_HECHOS,
  type InboxActionName,
  type InboxActionStatus,
  type InboxActionStatusRule,
  type InboxRole,
} from "./inboxActionStatusRules";
import { MOTIVOS_ACCION, type HechosAccion } from "./accionesHechos";
import type { UserActions } from "../interfaces/IUser";

/**
 * LA FILA QUE LA BANDEJA EXISTE PARA PEDIR: el caso sigue sin aceptar y no hay excusa esperando al
 * director. Bolsa LITERAL y no `hechosDelEpas(...)`: este archivo prueba la TABLA DE REGLAS, y un
 * esperado que saliera del adaptador dejaría de fallar el día en que el adaptador se rompiera.
 *
 * Aparece desde el Plan 19 de la Fase 03.19 (gap 4 del UAT del 2026-09-22): hasta entonces
 * `aceptarCaso` se gateaba SOLO por rol y estado, y el gate de la aceptación —que la versión de
 * tarjetas de la página tenía a mano— se había quedado atrás en el paso a tabla del Plan 17.
 */
const CASO_SIN_ACEPTAR: HechosAccion = {
  "epas.sinAceptar": true,
  "epas.sinExcusaPendiente": true,
};

describe("aceptarCaso en INBOX_ACTION_STATUS_RULES (gate por-caso — RECE-06)", () => {
  it("habilitada para el funcionario decisor con el EPAS ASIGNADO_DECISOR, sobre un caso sin aceptar", () => {
    // 🔴 SE MIDE CON `resolverAccion` Y NO CON `isInboxActionVisible`, y el cambio es del Plan 19.
    // La firma del adaptador es `(actiName, docStatus, userRole)`: NO PUEDE TRANSPORTAR HECHOS, así
    // que desde que la regla exige la marca de la aceptación devuelve `false` siempre. Lo que esta
    // prueba fija —que el decisor sobre ASIGNADO_DECISOR puede aceptar— sigue siendo verdad y sigue
    // siendo lo que importa; lo que cambia es por dónde se pregunta.
    expect(
      resolverAccion("aceptarCaso", {
        rol: "funcionario decisor",
        estado: "ASIGNADO_DECISOR",
        hechos: CASO_SIN_ACEPTAR,
      }),
    ).toEqual({ visible: true, habilitada: true });
  });

  it("NO visible para el director (rol equivocado)", () => {
    expect(
      isInboxActionVisible("aceptarCaso", "ASIGNADO_DECISOR", "director"),
    ).toBe(false);
  });

  it("NO visible sobre otro estado (VERIFICADO) aunque el rol sea decisor", () => {
    expect(
      isInboxActionVisible("aceptarCaso", "VERIFICADO", "funcionario decisor"),
    ).toBe(false);
  });

  it("la comparación de rol es case-insensitive", () => {
    // Conducta observable desde la Fase 2 y NO se toca. Pasa a medirse por `resolverAccion` por el
    // mismo motivo que la primera del bloque: la regla ya exige hechos que el adaptador no lleva.
    expect(
      resolverAccion("aceptarCaso", {
        rol: "  Funcionario Decisor  ",
        estado: "  asignado_decisor ",
        hechos: CASO_SIN_ACEPTAR,
      }).habilitada,
    ).toBe(true);
  });

  it("🔴 el ADAPTADOR de compatibilidad ya no decide esta acción, y eso no rompe ninguna pantalla", () => {
    // Desde el Plan 19, `aceptarCaso` y `excusarme` exigen la marca de la aceptación, y
    // `isInboxActionVisible(actiName, docStatus, userRole)` no tiene por dónde pasarla: para él la
    // condición está siempre AUSENTE, así que apaga. Queda escrito aquí como CONDUCTA ESPERADA y no
    // como defecto.
    //
    // 🔴 Y POR QUÉ NO ROMPE NADA, MEDIDO Y NO SUPUESTO: ninguno de los 14 puntos de llamada del
    // adaptador evalúa `aceptarCaso` ni `excusarme`. Las dos llegan a la pantalla SOLO por
    // `accionesDeLaFila`, que construye el contexto con `hechosDelEpas(row)` y sí pasa la bolsa.
    // Si algún día alguien cablease una de las dos por el adaptador, esta prueba le dice por qué la
    // vería apagada en vez de dejarle buscarlo en el motor.
    for (const nombre of ["aceptarCaso", "excusarme"] as const) {
      expect(
        isInboxActionVisible(nombre, "ASIGNADO_DECISOR", "funcionario decisor"),
        nombre,
      ).toBe(false);

      // Y no es un apagado mudo: sin la bolsa, el motor dice que no puede decidirlo.
      const v = resolverAccion(nombre, {
        rol: "funcionario decisor",
        estado: "ASIGNADO_DECISOR",
      });
      expect(v.visible, nombre).toBe(true);
      expect(v.habilitada, nombre).toBe(false);
      expect(v.motivo, nombre).toBe(
        MOTIVOS_ACCION.DATO_AUSENTE("epas.sinAceptar"),
      );
    }
  });

  it("🔴 el turno del LOTE (firmar*) YA tiene regla en la tabla, y NUNCA por `status`", () => {
    // 🔴 ESTE CASO DECÍA LO CONTRARIO, Y SE INVIRTIÓ A PROPÓSITO (Fase 03.18, Plan 09). Decía:
    // «firmarDecisor/Secretario/Director existen en el union de nombres pero su gating vive en
    // loteTurnActions.ts, no aquí: no deben aparecer como reglas de la tabla». Era cierto mientras
    // la tabla solo supiera gatear por rol y por ESTADO —y el `status` de esta tabla es el enum
    // EPAS, que no puede expresar el turno del lote—. El Plan 01 le añadió la dimensión de
    // CONDICIONES sobre hechos derivados, y el turno es exactamente esa clase de condición.
    //
    // Lo que este caso protege ahora es el límite que NO cambió: que las tres tengan regla, y que
    // ninguna la exprese con `status`. La paridad celda a celda con el resolver original vive en
    // `politicaAcciones.test.ts`.
    for (const nombre of [
      "firmarDecisor",
      "firmarSecretario",
      "firmarDirector",
    ] as const) {
      const regla = INBOX_ACTION_STATUS_RULES[nombre];
      expect(regla, nombre).toBeDefined();
      expect(regla?.status, nombre).toBeUndefined();
      expect((regla?.condiciones?.length ?? 0) > 0, nombre).toBe(true);
    }
  });
});

describe("Fase 03.14.1 — el desenlace del EPAS pecuniario", () => {
  it("🔴 la respuesta al trabajo comunitario se recoge en EN_VERIFICACION_PAGO (act. 16)", () => {
    // Es el precedente 7.2 del procedimiento: se informa y se responde mientras el expediente está
    // en verificación de pago. Ni antes (no hay nada que ofrecer) ni después (ya se autorizó).
    expect(
      isInboxActionVisible(
        "registrarAcogimiento",
        "EN_VERIFICACION_PAGO",
        "funcionario decisor",
      ),
    ).toBe(true);
    expect(
      isInboxActionVisible(
        "registrarAcogimiento",
        "EN_TRABAJO_COMUNITARIO",
        "funcionario decisor",
      ),
    ).toBe(false);
  });

  it("🔴 la respuesta al trabajo comunitario es SOLO del decisor", () => {
    expect(
      isInboxActionVisible(
        "registrarAcogimiento",
        "EN_VERIFICACION_PAGO",
        "secretario abogado",
      ),
    ).toBe(false);
    expect(
      isInboxActionVisible(
        "registrarAcogimiento",
        "EN_VERIFICACION_PAGO",
        "director",
      ),
    ).toBe(false);
  });

  it("🔴 el tramo de coactiva se ofrece en PENDIENTE_COACTIVA, y es del decisor", () => {
    // Que ADEMÁS la Zonal no la haya iniciado NO lo puede decir esta tabla: depende de un dato del
    // expediente. Lo comprueba el backend, y el modal lo explica.
    expect(
      isInboxActionVisible(
        "gestionarCoactiva",
        "PENDIENTE_COACTIVA",
        "funcionario decisor",
      ),
    ).toBe(true);
    expect(
      isInboxActionVisible(
        "gestionarCoactiva",
        "EN_VERIFICACION_PAGO",
        "funcionario decisor",
      ),
    ).toBe(false);
    expect(
      isInboxActionVisible(
        "gestionarCoactiva",
        "PENDIENTE_COACTIVA",
        "secretario abogado",
      ),
    ).toBe(false);
  });

  it("🔴 la solicitud de prórroga se registra con el trabajo comunitario EN CURSO", () => {
    // Que además llegue A TIEMPO —antes del vencimiento— NO lo puede decir esta tabla: el status es
    // el enum EPAS y un plazo no es un estado. Esa parte la comprueba el backend con la fecha real.
    expect(
      isInboxActionVisible(
        "solicitarProrroga",
        "EN_TRABAJO_COMUNITARIO",
        "funcionario decisor",
      ),
    ).toBe(true);
    expect(
      isInboxActionVisible(
        "solicitarProrroga",
        "EN_VERIFICACION_PAGO",
        "funcionario decisor",
      ),
    ).toBe(false);
    expect(
      isInboxActionVisible(
        "solicitarProrroga",
        "PENDIENTE_COACTIVA",
        "funcionario decisor",
      ),
    ).toBe(false);
  });

  it("🔴 el decisor resuelve el pago SOLO en EN_VERIFICACION_PAGO", () => {
    expect(
      isInboxActionVisible(
        "registrarPago",
        "EN_VERIFICACION_PAGO",
        "funcionario decisor",
      ),
    ).toBe(true);
    expect(
      isInboxActionVisible(
        "registrarPago",
        "ASIGNADO_DECISOR",
        "funcionario decisor",
      ),
    ).toBe(false);
  });

  it("🔴 cierra el trabajo comunitario SOLO en EN_TRABAJO_COMUNITARIO", () => {
    expect(
      isInboxActionVisible(
        "registrarCumplimiento",
        "EN_TRABAJO_COMUNITARIO",
        "funcionario decisor",
      ),
    ).toBe(true);
    expect(
      isInboxActionVisible(
        "registrarCumplimiento",
        "EN_VERIFICACION_PAGO",
        "funcionario decisor",
      ),
    ).toBe(false);
  });

  it("🔴 ni el secretario ni el director ven estas acciones: son actos del decisor", () => {
    for (const rol of ["secretario abogado", "director"]) {
      expect(
        isInboxActionVisible("registrarPago", "EN_VERIFICACION_PAGO", rol),
      ).toBe(false);
      expect(
        isInboxActionVisible(
          "registrarCumplimiento",
          "EN_TRABAJO_COMUNITARIO",
          rol,
        ),
      ).toBe(false);
    }
  });

  it("declarar impago sigue la misma regla que registrar el pago", () => {
    expect(
      isInboxActionVisible(
        "registrarPago",
        "EN_VERIFICACION_PAGO",
        "funcionario decisor",
      ),
    ).toBe(true);
  });

  describe("formas de notificación desde el secretario (2026-08-28)", () => {
    it("el SECRETARIO las declara en los dos estados de su Recepción", () => {
      for (const estado of ["RECIBIDO", "VERIFICADO"]) {
        expect(
          isInboxActionVisible(
            "formasNotificacion",
            estado,
            "secretario abogado",
          ),
        ).toBe(true);
      }
    });

    it("🔴 se declaran ANTES de que haya providencia que despachar", () => {
      // Es el porqué de la fase elegida: las formas nacen en «no», y mientras nadie las declare
      // cada providencia emitida crea su notificación SIN despachos — ningún plazo arranca. Una
      // vez sorteado y asignado, esta bandeja ya no lo muestra.
      expect(
        isInboxActionVisible(
          "formasNotificacion",
          "ASIGNADO_DECISOR",
          "secretario abogado",
        ),
      ).toBe(false);
    });

    it("el decisor NO la ve aquí: la suya vive en su propia bandeja", () => {
      // El backend sí se lo permite (los tres roles); lo que no tiene es esta superficie, que es
      // la del secretario. La del decisor sigue intacta en MisAsignadosPage.
      expect(
        isInboxActionVisible(
          "formasNotificacion",
          "RECIBIDO",
          "funcionario decisor",
        ),
      ).toBe(false);
    });

    it("el director tampoco, POR AHORA: sumarlo es añadir su rol a la regla", () => {
      expect(
        isInboxActionVisible("formasNotificacion", "RECIBIDO", "director"),
      ).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Fase 03.18, Plan 01 — LA PARIDAD Y EL VEREDICTO
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Los tres roles operativos del union `InboxRole`. */
const ROLES: InboxRole[] = [
  "secretario abogado",
  "director",
  "funcionario decisor",
];

/** Los siete estados del union `InboxActionStatus`, más la ausencia de estado. */
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
 * La lógica ANTERIOR a la Fase 03.18, reproducida aquí a mano y a propósito.
 *
 * 🔴 NO SE IMPORTA NADA PARA CALCULAR EL ESPERADO. Si el esperado saliera del mismo código que se
 * está probando, la prueba pasaría con cualquier refactor, incluido el que rompiera las bandejas.
 * Esta función es la fotografía del evaluador que había, y es contra la fotografía contra lo que se
 * compara.
 */
function conductaAnterior(
  regla: InboxActionStatusRule | undefined,
  estado: string | null | undefined,
  rol: string,
): boolean {
  if (!regla) return true;
  const rolNormalizado = rol.trim().toLowerCase();
  if (regla.roles && !regla.roles.includes(rolNormalizado as InboxRole)) {
    return false;
  }
  if (regla.status) {
    const permitidos = Array.isArray(regla.status)
      ? regla.status
      : [regla.status];
    const estadoNormalizado = (estado ?? "").trim().toUpperCase();
    return permitidos.includes(estadoNormalizado as InboxActionStatus);
  }
  return true;
}

describe("paridad con el evaluador anterior (Fase 03.18, Plan 01)", () => {
  // 🔴 FIJADO POR EL PLAN 04. Esta lista se derivaba de `Object.keys(INBOX_ACTION_STATUS_RULES)`,
  // y eso hacía que la matriz creciera sola: en cuanto el Plan 04 añadió las doce reglas de la rama
  // del correctivo, la «paridad con el evaluador anterior» pasó a medir acciones que ANTES NO
  // EXISTÍAN —y cuya conducta anterior, por tanto, no significa nada—. Los 18 nombres se fijan aquí
  // como dato literal, que es lo que el título de este bloque dice desde el primer día. La política
  // de las acciones nuevas la prueba `politicaAcciones.test.ts`, que es su sitio.
  const NOMBRES: InboxActionName[] = [
    "aprobarEpas",
    "aprobarExpediente",
    "devolverExpediente",
    "marcarRevisado",
    "desRevisar",
    "DEVOLVER_DMR",
    "returnBatchDmr",
    "sortear",
    "aprobarLote",
    "excusarme",
    "registrarPago",
    "registrarCumplimiento",
    "registrarAcogimiento",
    "solicitarProrroga",
    "gestionarCoactiva",
    "aceptarCaso",
    "formasNotificacion",
    "enviarSorteo",
  ];

  /**
   * 🔴 LA EXCEPCIÓN, DECLARADA COMO DATO — 2026-09-22, Fase 03.19 Plan 19, gap 4 del UAT.
   *
   * `conductaAnterior` reimplementa rol + estado e IGNORA `condiciones` a propósito: era el listón
   * correcto mientras la tabla no supiera gatear por hechos. Estas DOS acciones estrenan condiciones
   * sobre la aceptación del caso, así que sus celdas `funcionario decisor × ASIGNADO_DECISOR` YA NO
   * pueden coincidir con aquel listón, y eso es exactamente lo que el plan vino a cambiar: sobre un
   * caso ya aceptado las dos se ofrecían para siempre.
   *
   * La matriz NO se recorta —las 432 celdas se siguen recorriendo— y las dos NO se silencian: para
   * ellas se espera el veredicto NUEVO, que con la bolsa vacía de este bloque es «no se puede
   * decidir aquí». Una excepción escrita se lee en la revisión; un `skip` no.
   */
  const CON_GATE_DE_ACEPTACION: readonly InboxActionName[] = [
    "aceptarCaso",
    "excusarme",
  ];

  it("la matriz recorre las 18 reglas vigentes × 3 roles × 8 estados = 432 celdas", () => {
    expect(NOMBRES).toHaveLength(18);
    expect(ROLES).toHaveLength(3);
    expect(ESTADOS).toHaveLength(8);
    expect(NOMBRES.length * ROLES.length * ESTADOS.length).toBe(432);
  });

  it("🔴 de las 432 celdas, solo cambiaron las DOS del gate de aceptación (2026-09-22)", () => {
    // 🔴 EL TÍTULO DECÍA «ninguna de las 432 celdas cambió de conducta» Y ERA VERDAD HASTA HOY. Dos
    // cambiaron, el 2026-09-22, por el gap 4 del UAT de la Fase 03.19: `aceptarCaso` y `excusarme`
    // dejaron de ofrecerse sobre un caso ya aceptado. Se corrige la afirmación en vez de dejarla
    // mintiendo con la prueba en verde, que es lo único peor que una prueba roja.
    let celdas = 0;
    let celdasConGate = 0;
    const divergencias: string[] = [];

    for (const actiName of NOMBRES) {
      const regla = INBOX_ACTION_STATUS_RULES[actiName];
      const conGate = CON_GATE_DE_ACEPTACION.includes(actiName);
      for (const rol of ROLES) {
        for (const estado of ESTADOS) {
          celdas += 1;
          const anterior = conductaAnterior(regla, estado, rol);

          // Las dos del gate: donde la conducta anterior decía «se ofrece», el veredicto nuevo con
          // la bolsa VACÍA de este bloque apaga diciendo que no puede decidirlo —y donde decía «no
          // se ofrece», sigue apagando por rol o por estado, que van ANTES de las condiciones—.
          const esperado = conGate ? false : anterior;
          if (conGate && anterior) celdasConGate += 1;

          // (a) El adaptador de compatibilidad: lo que las 14 llamadas vigentes siguen viendo. Para
          // las dos del gate devuelve `false` porque su firma no transporta hechos; ninguna de esas
          // 14 llamadas evalúa estas dos acciones (medido), así que no hay pantalla afectada.
          if (isInboxActionVisible(actiName, estado, rol) !== esperado) {
            divergencias.push(`isInboxActionVisible ${actiName}/${rol}/${estado}`);
          }
          // (b) El veredicto nuevo: `habilitada` es lo que aquel booleano significaba.
          const veredicto = resolverAccion(actiName, { rol, estado });
          if (veredicto.habilitada !== esperado) {
            divergencias.push(`habilitada ${actiName}/${rol}/${estado}`);
          }
          // (b bis) Y para las dos del gate, el MOTIVO es el del dato ausente y no el de «no
          // procede»: con la bolsa vacía el sistema no sabe si el caso está aceptado, y decir «no
          // procede» sería afirmar lo que no sabe. Solo en la celda que antes sí se ofrecía: en las
          // demás manda el filtro de rol o de estado, que va primero.
          if (conGate && anterior) {
            if (
              veredicto.motivo !== MOTIVOS_ACCION.DATO_AUSENTE("epas.sinAceptar")
            ) {
              divergencias.push(`motivo ${actiName}/${rol}/${estado}`);
            }
          }
          // (c) Y nada se esconde en esta ola: `ACCIONES_OCULTAS` está vacío.
          if (!veredicto.visible) {
            divergencias.push(`visible ${actiName}/${rol}/${estado}`);
          }
          // (d) Apagar VIENE CON SU MOTIVO: no hay apagado mudo.
          if (!veredicto.habilitada && !veredicto.motivo) {
            divergencias.push(`sin motivo ${actiName}/${rol}/${estado}`);
          }
        }
      }
    }

    expect(divergencias).toEqual([]);
    expect(celdas).toBe(432);
    // Las dos acciones × el único par rol/estado en que su regla de rol y estado se cumple.
    expect(celdasConGate).toBe(2);
  });

  it("las reglas SOLO-ROL siguen ignorando el estado (el expediente no tiene estado propio)", () => {
    // aprobarExpediente y devolverExpediente no llevan `status` a propósito: el expediente no tiene
    // estado, lo tienen sus casos. Un refactor que les inventara un estado las apagaría entero.
    for (const actiName of ["aprobarExpediente", "devolverExpediente"]) {
      for (const estado of ESTADOS) {
        expect(isInboxActionVisible(actiName, estado, "director")).toBe(true);
        expect(isInboxActionVisible(actiName, estado, "secretario abogado")).toBe(
          false,
        );
      }
    }
  });

  it("las reglas con `status` en ARRAY siguen aceptando los dos estados", () => {
    for (const estado of ["RECIBIDO", "VERIFICADO"]) {
      expect(isInboxActionVisible("DEVOLVER_DMR", estado, "director")).toBe(true);
      expect(
        isInboxActionVisible("formasNotificacion", estado, "secretario abogado"),
      ).toBe(true);
    }
    expect(isInboxActionVisible("DEVOLVER_DMR", "SORTEADO", "director")).toBe(
      false,
    );
    expect(
      isInboxActionVisible("formasNotificacion", "SORTEADO", "secretario abogado"),
    ).toBe(false);
  });

  it("el orden de los filtros es conducta: manda el rol sobre el estado", () => {
    expect(
      resolverAccion("aceptarCaso", { rol: "director", estado: "VERIFICADO" })
        .motivo,
    ).toBe(MOTIVOS_ACCION.FUERA_DE_ROL);
  });

  it("CONTEXTO_SIN_HECHOS arma el contexto de quien solo tiene rol y estado", () => {
    expect(CONTEXTO_SIN_HECHOS("director", "RECIBIDO")).toEqual({
      rol: "director",
      estado: "RECIBIDO",
    });
    expect(resolverAccion("aprobarEpas", CONTEXTO_SIN_HECHOS("director", "RECIBIDO")))
      .toEqual({ visible: true, habilitada: true });
  });
});

describe("aplicarVeredicto", () => {
  /** Una acción del menú, con la forma con la que viaja en `UserActions`. */
  const ACCION: UserActions = {
    actiId: 1,
    submId: 2,
    actiName: "returnBatchDmr",
    actiLabel: "Devolver lote a la DMR",
    actiContext: "epas",
    actiIconName: "faReply",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  };

  it("sobre una acción visible y habilitada devuelve LA MISMA acción, sin campos añadidos", () => {
    const resultado = aplicarVeredicto(
      ACCION,
      CONTEXTO_SIN_HECHOS("secretario abogado", "RECIBIDO"),
    );
    expect(resultado).toBe(ACCION);
  });

  it("sobre una acción visible y deshabilitada devuelve una COPIA con el motivo, sin mutar", () => {
    const resultado = aplicarVeredicto(
      ACCION,
      CONTEXTO_SIN_HECHOS("director", "RECIBIDO"),
    );

    expect(resultado).not.toBe(ACCION);
    expect(resultado?.actiIsDisabled).toBe(true);
    expect(resultado?.actiDisabledHint).toBe(MOTIVOS_ACCION.FUERA_DE_ROL);
    // 🔴 Las acciones son constantes de módulo COMPARTIDAS (EPAS_ROW_ACTIONS, EXPEDIENTE_ACTIONS):
    // mutarlas contaminaría filas distintas de la misma tabla.
    expect(ACCION.actiIsDisabled).toBeUndefined();
    expect(ACCION.actiDisabledHint).toBeUndefined();
  });

  it("sobre una acción OCULTA devuelve null", () => {
    expect(
      proyectarVeredicto(ACCION, { visible: false, habilitada: false }),
    ).toBeNull();
  });

  it("🔴 una acción que ya venía deshabilitada por otra causa NO se rehabilita", () => {
    // El EPAS bloqueado, el lote sin casos elegibles: quien la apagó sabía algo que el motor no
    // sabe. Rehabilitarla ofrecería un acto que el backend va a rechazar.
    const yaApagada: UserActions = {
      ...ACCION,
      actiIsDisabled: true,
      actiDisabledHint: "El expediente está bloqueado",
    };
    const resultado = proyectarVeredicto(yaApagada, {
      visible: true,
      habilitada: true,
    });

    expect(resultado?.actiIsDisabled).toBe(true);
    expect(resultado?.actiDisabledHint).toBe("El expediente está bloqueado");
  });
});

// ── quick 261028-mtg (2026-10-29, D-2): lo suspendido por la impugnación se APAGA con su motivo ──
describe("suspensión por impugnación (quick 261028-mtg)", () => {
  const DECISOR = "funcionario decisor";
  /** Una bolsa en la que TODAS las acciones del decisor estarían encendidas por sus condiciones. */
  const HECHOS_TODO_CUMPLE: HechosAccion = {
    "epas.aceptado": true,
    "epas.sinAceptar": false,
    "epas.sinExcusaPendiente": true,
    "obligacionHacer.tiene": true,
    "obligacionHacer.cumplida": false,
    "obligacionHacer.tieneInforme": true,
    "obligacionHacer.sustitutoriaOrdenada": true,
    "obligacionHacer.terminoAlegacion.estado": "EN_CURSO",
    "obligacionHacer.terminoAlegacion.habilitaMultaCompulsoria": true,
    "obligacionHacer.terminoAlegacion.alegacionPendiente": false,
  };

  const SUSPENDIDAS: InboxActionName[] = [
    "registrarPago",
    "registrarAcogimiento",
    "registrarCumplimiento",
    "solicitarProrroga",
    "gestionarCoactiva",
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

  it("la lista declarada son exactamente las dieciséis", () => {
    expect([...ACCIONES_SUSPENDIDAS_POR_IMPUGNACION].sort()).toEqual(
      [...SUSPENDIDAS].sort(),
    );
  });

  it.each(SUSPENDIDAS)(
    "%s en EN_IMPUGNACION: visible, apagada y con el motivo de la suspensión",
    (accion) => {
      expect(
        resolverAccion(accion, {
          rol: DECISOR,
          estado: "EN_IMPUGNACION",
          hechos: HECHOS_TODO_CUMPLE,
        }),
      ).toEqual({
        visible: true,
        habilitada: false,
        motivo: MOTIVOS_ACCION.SUSPENDIDA_POR_IMPUGNACION,
      });
    },
  );

  it("el estado se normaliza como en la cascada (minúsculas y espacios)", () => {
    expect(
      resolverAccion("registrarPago", {
        rol: DECISOR,
        estado: " en_impugnacion ",
        hechos: HECHOS_TODO_CUMPLE,
      }).motivo,
    ).toBe(MOTIVOS_ACCION.SUSPENDIDA_POR_IMPUGNACION);
  });

  it("con un rol ajeno se conserva «su rol no interviene»", () => {
    expect(
      resolverAccion("registrarPago", {
        rol: "secretario abogado",
        estado: "EN_IMPUGNACION",
        hechos: HECHOS_TODO_CUMPLE,
      }),
    ).toEqual({
      visible: true,
      habilitada: false,
      motivo: MOTIVOS_ACCION.FUERA_DE_ROL,
    });
  });

  it.each<InboxActionName>([
    "accionesImpugnacion",
    "generarDocumento",
    "adjuntarDocumento",
    "descargarExpediente",
    "verObligacionHacer",
  ])("%s sigue habilitada para el decisor con el caso aceptado (P-8)", (accion) => {
    expect(
      resolverAccion(accion, {
        rol: DECISOR,
        estado: "EN_IMPUGNACION",
        hechos: HECHOS_TODO_CUMPLE,
      }),
    ).toEqual({ visible: true, habilitada: true });
  });

  it.each(["EN_VERIFICACION_PAGO", "EN_TRABAJO_COMUNITARIO", "PENDIENTE_COACTIVA", "ASIGNADO_DECISOR", undefined])(
    "en %s los veredictos son los de la cascada, sin el motivo de la suspensión",
    (estado) => {
      for (const accion of SUSPENDIDAS) {
        expect(
          resolverAccion(accion, {
            rol: DECISOR,
            estado,
            hechos: HECHOS_TODO_CUMPLE,
          }).motivo,
        ).not.toBe(MOTIVOS_ACCION.SUSPENDIDA_POR_IMPUGNACION);
      }
    },
  );

  it("fuera de EN_IMPUGNACION el pago se sigue ofreciendo en verificación de pago", () => {
    expect(
      resolverAccion("registrarPago", {
        rol: DECISOR,
        estado: "EN_VERIFICACION_PAGO",
        hechos: HECHOS_TODO_CUMPLE,
      }).habilitada,
    ).toBe(true);
  });

  it("registrarAlegacion con el término SUSPENDIDO sale apagada con CONDICION_NO_CUMPLIDA aunque el contexto no traiga estado", () => {
    expect(
      resolverAccion("registrarAlegacion", {
        rol: DECISOR,
        hechos: {
          ...HECHOS_TODO_CUMPLE,
          "obligacionHacer.terminoAlegacion.estado": "SUSPENDIDO",
        },
      }),
    ).toEqual({
      visible: true,
      habilitada: false,
      motivo: MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA(
        "obligacionHacer.terminoAlegacion.estado",
      ),
    });
  });

  it("registrarAlegacion con el término EN_CURSO sigue habilitada como hoy", () => {
    expect(
      resolverAccion("registrarAlegacion", {
        rol: DECISOR,
        hechos: HECHOS_TODO_CUMPLE,
      }),
    ).toEqual({ visible: true, habilitada: true });
  });
});
