/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/epas (frontend)
 * Feature: Unidad pura de la fusión de las TRES trazas de la línea de tiempo (D-07/D-08) — Fase
 *   03.19, ampliada en la Fase 03.22 con el historial de órdenes de pago
 * Archivo: lineaDeTiempo.util.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES las cuatro reglas que hacen que la línea de
 *   tiempo del expediente sea legible y no mienta:
 *     (1) las dos trazas se INTERCALAN por fecha y cada evento conserva su PROCEDENCIA —dos sistemas
 *         distintos cuentan la vida del mismo expediente, y sin marca se creería que el módulo
 *         escribió lo que no escribió;
 *     (2) el ORDEN ES DETERMINISTA incluso cuando dos hechos comparten instante: la fusión corre 20
 *         veces sobre las mismas entradas barajadas y la secuencia de claves no cambia. Sin esto la
 *         línea «baila» entre recargas y el usuario no puede citarla como prueba;
 *     (3) cada FECHA NO NULA de una entrada de Asignaciones es UN evento, no un campo: aplanar la
 *         entrada a uno solo perdería quién se excusó y cuándo se resolvió, que es justo lo que D-07
 *         quiere contar;
 *     (4) DEGRADACIÓN HONESTA — un asiento sin actor se pinta «Sistema» (nunca vacío, ni el literal
 *         de un valor no definido, ni el nombre de OTRA persona) y un hito sin campos cambiados se
 *         conserva SIN diff, no se oculta. En los hechos de Asignaciones esto se afirma dos veces y
 *         hacen falta las dos: sin su `*By` el actor es «Sistema» y nunca el decisor asignado —que
 *         es de quién es el caso, no quién hizo el hecho—, y con su `*By` ése es el actor.
 *
 *   🔴 Los casos (4) no se prueban solos contra datos reales: medido el 2026-09-21 sobre EjecucionDB,
 *   NINGUNA de las 404 filas de la bitácora tiene el actor vacío. Hay que FORZARLO en el fixture o
 *   viaja sin probar. Los asientos sin diff sí existen (la constatación de incumplimiento y la orden
 *   de sustitutoria del `eeje_id` 105 llevan `log_changed_fields = []`).
 *
 *   ── EL TERCER ORIGEN (Fase 03.22, D-07) ──────────────────────────────────────────────────────
 *   El historial de órdenes de pago entra como tercera fuente y se prueba por lo que puede perder:
 *   que una orden ANULADA produzca sus DOS eventos con el motivo literal (aplanarla al registro
 *   borraría lo único que explica por qué un expediente tuvo dos números), que la anulación se firme
 *   «Sistema» y nunca con quien registró, que un tipo no previsto se lea igual, que los eventos
 *   queden INTERCALADOS y no agrupados al final, y que omitir el tercer arreglo devuelva
 *   EXACTAMENTE lo de antes — el cambio es aditivo o no es.
 *
 *   Unidad pura: no monta la interfaz, no llama a servicios, no toca el modal.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 03 — D-07)
 */

import { describe, it, expect } from "vitest";
import {
  ACTOR_DESCONOCIDO,
  fundirLineaDeTiempo,
  type EventoLinea,
} from "./lineaDeTiempo.util";
import type { TimelineEvent } from "../interfaces/ICase";
import type { OrdenPago } from "../services/OrdenPagoService";
import type { HistorialCasoEntry } from "../services/SorteoService";

/**
 * LA TRAZA INTERNA (`t_logs_ejecucion`, art. 82 CRE). Cuenta lo que el módulo de Ejecución hizo con
 * el expediente: lo recibió verificado, lo asignó a su decisor y —más tarde— constató que el
 * correctivo no se cumplió.
 *
 * El tercer asiento es el caso incómodo y está a propósito: **sin actor y sin campos cambiados**.
 * Existe en la base real (la constatación de incumplimiento) y es el que revienta una interfaz
 * escrita suponiendo que siempre hay un nombre y siempre hay un diff.
 */
const TRAZA_INTERNA: TimelineEvent[] = [
  {
    logId: 115,
    logCreatedAt: "2026-09-18T16:00:00.000Z",
    logUserId: 4,
    usuFullName: "Andrés Decisor",
    logTableName: "t_expediente_ejecucion",
    logRecordId: 105,
    logEvent: "EPAS verificado",
    logEventCodigo: "EPAS_VERIFICADO",
    cambios: [
      { campo: "Estado del EPAS", antes: "RECIBIDO", despues: "VERIFICADO" },
    ],
  },
  {
    logId: 117,
    logCreatedAt: "2026-09-18T18:00:00.000Z",
    logUserId: 4,
    usuFullName: "Andrés Decisor",
    logTableName: "t_expediente_ejecucion",
    logRecordId: 105,
    logEvent: "Asignado a decisor",
    logEventCodigo: "ASIGNADO_DECISOR",
    cambios: [
      { campo: "Estado del EPAS", antes: "VERIFICADO", despues: "ASIGNADO" },
    ],
  },
  {
    logId: 121,
    logCreatedAt: "2026-09-20T09:00:00.000Z",
    // Sin `logUserId` ni `usuFullName`: acto interno. Y sin `cambios`: el hecho importa por su
    // código, no por un diff que no existe.
    logTableName: "t_expediente_ejecucion",
    logRecordId: 105,
    logEvent: "Se constató el incumplimiento del correctivo",
    logEventCodigo: "HACER_INCUMPLIMIENTO_CONSTATADO",
    cambios: [],
  },
];

/**
 * LA TRAZA DE ASIGNACIONES. **Una sola entrada** que cuenta tres hechos: el caso se asignó al
 * decisor 6389, ese decisor pidió reasignarse («Conflicto de intereses») y la reasignación se
 * resolvió a favor. Tres fechas ⇒ tres puntos en la línea, no uno.
 */
const HISTORIAL_ASIGNACIONES: HistorialCasoEntry[] = [
  {
    historyOrder: 1,
    id: 7001,
    caseId: 3300,
    assignmentMasterId: 9001,
    userId: 6389,
    masterStatusName: "Aprobado",
    assignmentStatusName: "Asignado",
    assignedAt: "2026-09-18T17:00:00.000Z",
    reason: "Conflicto de intereses",
    reassignmentRequestedAt: "2026-09-19T08:00:00.000Z",
    reassignmentResolvedAt: "2026-09-19T15:00:00.000Z",
    reassignmentResolution: "ACEPTADA",
  },
];

/** Devuelve la secuencia de claves de una fusión, que es lo que hace comparable un orden. */
const claves = (eventos: EventoLinea[]): string[] =>
  eventos.map((evento) => evento.clave);

/**
 * Baraja determinista (Fisher-Yates con un generador congruencial sembrado). Se usa un generador
 * PROPIO y no `Math.random` a propósito: un test que baraja al azar y falla una vez de cada cien no
 * se puede reproducir, y el defecto que persigue —un orden que depende de cómo llegó la entrada— es
 * justo de los que se esconden así.
 */
const barajar = <T,>(lista: T[], semilla: number): T[] => {
  const copia = [...lista];
  let estado = semilla;
  const siguiente = () => {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    return estado / 2147483648;
  };
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(siguiente() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

describe("fundirLineaDeTiempo (las dos trazas del expediente — D-07/D-08)", () => {
  it("intercala las dos trazas por fecha y cada evento conserva su procedencia", () => {
    const eventos = fundirLineaDeTiempo(TRAZA_INTERNA, HISTORIAL_ASIGNACIONES);

    // 3 internos + 3 fechas de la única entrada de Asignaciones.
    expect(eventos).toHaveLength(6);

    // El orden real: verificado (16:00) → asignado en Asignaciones (17:00) → asignado en el módulo
    // (18:00) → excusa pedida → excusa resuelta → incumplimiento constatado. Que el 2.º y el 3.º
    // vengan de sistemas distintos y queden PEGADOS es exactamente el caso que la fusión existe para
    // resolver: son el mismo hecho contado dos veces, y solo la etiqueta de origen lo explica.
    expect(eventos.map((evento) => evento.origen)).toEqual([
      "interna",
      "asignaciones",
      "interna",
      "asignaciones",
      "asignaciones",
      "interna",
    ]);

    const fechas = eventos.map((evento) => evento.fecha);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it("🔴 el orden es DETERMINISTA cuando dos hechos comparten instante", () => {
    const MISMO_INSTANTE = "2026-09-19T12:00:00.000Z";

    // Cuatro hechos en el MISMO segundo, dos de cada traza: el peor caso posible para un orden que
    // se apoye solo en la fecha.
    const internosEmpatados: TimelineEvent[] = [
      { ...TRAZA_INTERNA[0], logId: 201, logCreatedAt: MISMO_INSTANTE },
      { ...TRAZA_INTERNA[1], logId: 202, logCreatedAt: MISMO_INSTANTE },
    ];
    const asignacionesEmpatadas: HistorialCasoEntry[] = [
      {
        ...HISTORIAL_ASIGNACIONES[0],
        id: 7002,
        assignedAt: MISMO_INSTANTE,
        reassignmentRequestedAt: null,
        reassignmentResolvedAt: null,
      },
      {
        ...HISTORIAL_ASIGNACIONES[0],
        id: 7003,
        assignedAt: MISMO_INSTANTE,
        reassignmentRequestedAt: null,
        reassignmentResolvedAt: null,
      },
    ];

    const referencia = claves(
      fundirLineaDeTiempo(internosEmpatados, asignacionesEmpatadas),
    );
    expect(referencia).toHaveLength(4);

    for (let vuelta = 0; vuelta < 20; vuelta++) {
      const obtenida = claves(
        fundirLineaDeTiempo(
          barajar(internosEmpatados, vuelta + 1),
          barajar(asignacionesEmpatadas, vuelta + 101),
        ),
      );
      expect(obtenida).toEqual(referencia);
    }
  });

  it("🔴 una entrada de Asignaciones con 3 fechas produce 3 eventos, con títulos distintos", () => {
    const eventos = fundirLineaDeTiempo([], HISTORIAL_ASIGNACIONES);

    expect(eventos).toHaveLength(3);

    const titulos = eventos.map((evento) => evento.titulo);
    expect(new Set(titulos).size).toBe(3);

    // Y cada uno conserva su fecha propia: aplanarlas a `assignedAt` es justamente el error.
    expect(eventos.map((evento) => evento.fecha)).toEqual([
      "2026-09-18T17:00:00.000Z",
      "2026-09-19T08:00:00.000Z",
      "2026-09-19T15:00:00.000Z",
    ]);

    // Las claves son estables y distintas entre sí: son la `key` de React de la lista.
    expect(new Set(claves(eventos)).size).toBe(3);
  });

  it("degrada honesto: sin actor dice «Sistema», y un hito sin diff se conserva sin cambios", () => {
    const eventos = fundirLineaDeTiempo(TRAZA_INTERNA, []);

    const constatacion = eventos.find((evento) => evento.clave === "interna:121");
    expect(constatacion).toBeDefined();
    expect(constatacion?.actor).toBe(ACTOR_DESCONOCIDO);
    expect(constatacion?.actor).toBe("Sistema");
    // 🔴 El hito NO desaparece por no traer diff, y no trae un array vacío que pintaría una caja
    // «Cambios realizados» sin nada dentro.
    expect(constatacion?.cambios).toBeUndefined();
    expect(eventos).toHaveLength(3);

    // El asiento que sí tiene actor no se toca.
    const verificado = eventos.find((evento) => evento.clave === "interna:115");
    expect(verificado?.actor).toBe("Andrés Decisor");
    expect(verificado?.cambios).toHaveLength(1);
  });

  it("traduce la palabra cruda que escribe el disparador de base a una etiqueta legible", () => {
    // `log_event` es texto libre y el disparador de base escribe literalmente «UPDATE». Es un valor
    // válido que hay que saber mostrar: en una traza que se lee como prueba, «UPDATE» no dice nada.
    const crudo: TimelineEvent[] = [
      {
        ...TRAZA_INTERNA[0],
        logId: 300,
        logEvent: "UPDATE",
        logEventCodigo: undefined,
      },
    ];

    const [evento] = fundirLineaDeTiempo(crudo, []);
    expect(evento.titulo).not.toBe("UPDATE");
    expect(evento.titulo.length).toBeGreaterThan(0);
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // 🔴 A QUIÉN SE LE ATRIBUYE CADA HECHO DE ASIGNACIONES.
  //
  // Los ocho `*By` del historial se declaran anulables y en la práctica llegan vacíos. Con el
  // hueco sin tapar, el actor caía al `userId` de la fila —el DECISOR ASIGNADO— y la línea firmaba
  // cada hecho con el nombre de quien lo PADECIÓ: «Reasignación resuelta → Usuario 6389», donde
  // 6389 es el decisor que pidió excusarse, no el director que resolvió. La prueba anterior no lo
  // veía porque el fixture no lleva ningún `*By` y el caso salía verde con el actor equivocado.
  //
  // En una traza nominativa del art. 82 CRE que se lee como prueba, un actor FALSO es peor que uno
  // ausente: el ausente se ve y se pregunta, el falso se cree y no se comprueba.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("🔴 sin el `*By` del hecho, el actor es «Sistema» — NUNCA el decisor asignado", () => {
    const eventos = fundirLineaDeTiempo([], HISTORIAL_ASIGNACIONES);

    // Escrito como igualdad y no como «no es 6389»: la regla es que hay UN sustituto y es
    // «Sistema». Un «no es el decisor» pasaría en verde con cualquier otro nombre inventado.
    for (const evento of eventos) {
      expect(evento.actor).toBe(ACTOR_DESCONOCIDO);
    }

    // Y el titular de la asignación NO se pierde: se cuenta como contexto, que es lo que es.
    // «De quién era el caso» y «quién hizo esto» son dos preguntas y la línea responde las dos.
    const resuelta = eventos.find((evento) =>
      evento.clave.endsWith("reassignmentResolvedAt"),
    );
    expect(resuelta?.titulo).toBe("Reasignación resuelta");
    expect(resuelta?.detalle).toBe("ACEPTADA · Asignación de Usuario 6389");
    // Lo que no puede volver a pasar, dicho en la casilla donde pasaba.
    expect(resuelta?.actor).not.toBe("Usuario 6389");
  });

  it("con el `*By` del hecho, ese Y NO OTRO es el actor", () => {
    // El contrapeso: al quitar el eslabón falso no se puede haber perdido el verdadero. Cada hecho
    // lleva su propio responsable y son personas DISTINTAS — es justo lo que D-07 quiere contar.
    const conResponsables: HistorialCasoEntry[] = [
      {
        ...HISTORIAL_ASIGNACIONES[0],
        assignedBy: 41,
        reassignmentRequestedBy: 6389,
        reassignmentResolvedBy: 77,
      },
    ];

    const eventos = fundirLineaDeTiempo([], conResponsables);
    expect(eventos.map((evento) => evento.actor)).toEqual([
      "Usuario 41",
      "Usuario 6389",
      "Usuario 77",
    ]);
  });
});

/**
 * EL HISTORIAL DE ÓRDENES DE PAGO (`GET /ordenes-pago/:eejeId/historial`, Fase 03.22 — D-07).
 *
 * Dos órdenes INVENTADAS (T-03.19-01: nunca filas copiadas de EjecucionDB), elegidas por lo que
 * rompen:
 *  · la 4101 se registró y luego SE ANULÓ con su motivo — es el caso que D-07 quiere iluminar, el
 *    que explica por qué un expediente tuvo dos números, y el que NO se ve en la fila de la bandeja;
 *  · la 4102 sigue viva y llega SIN `registradaPor` resuelto — el JOIN al usuario es `LEFT`, así que
 *    el hueco existe y hay que forzarlo aquí o viaja sin probar.
 */
const ORDENES: OrdenPago[] = [
  {
    ordpId: 4101,
    eejeId: 105,
    tipo: "MULTA",
    numero: "SAO-2026-0041",
    estado: "REGISTRADA",
    registradaAt: "2026-09-18T19:00:00.000Z",
    registradaBy: 4,
    registradaPor: "Andrés Decisor",
    anuladaAt: "2026-09-19T11:00:00.000Z",
    anuladaBy: 4,
    anuladaMotivo: "Se emitió con el valor del remanente en lugar del de la multa",
  },
  {
    ordpId: 4102,
    eejeId: 105,
    tipo: "REMANENTE",
    numero: "SAO-2026-0058",
    estado: "REGISTRADA",
    registradaAt: "2026-09-19T14:00:00.000Z",
    registradaBy: 4,
    // Sin `registradaPor`: el nombre no llegó resuelto. El actor tiene que caer a «Sistema».
  },
];

describe("fundirLineaDeTiempo — el TERCER origen: las órdenes de pago (Fase 03.22, D-07)", () => {
  it("una orden solo registrada produce UN evento, con su tipo, su número y quien la registró", () => {
    const [viva] = [ORDENES[1]];
    const eventos = fundirLineaDeTiempo([], [], [viva]);

    expect(eventos).toHaveLength(1);
    expect(eventos[0].clave).toBe("ordenes:4102:registrada");
    expect(eventos[0].origen).toBe("ordenes");
    expect(eventos[0].fecha).toBe("2026-09-19T14:00:00.000Z");
    expect(eventos[0].titulo).toBe(
      "Orden de pago (remanente) registrada — N.º SAO-2026-0058",
    );

    // 🔴 El hueco del `LEFT JOIN`: sin nombre resuelto, «Sistema». Nunca en blanco y nunca el
    // literal de un valor no definido — es la regla 4 de la cabecera del módulo.
    expect(eventos[0].actor).toBe(ACTOR_DESCONOCIDO);
    expect(eventos[0].titulo).not.toContain("undefined");

    // Un hecho de orden NO trae diff de campos: `undefined`, nunca un arreglo vacío que pintaría
    // una caja «Cambios realizados» sin nada dentro.
    expect(eventos[0].cambios).toBeUndefined();
    expect(eventos[0].detalle).toBeUndefined();
  });

  it("🔴 una orden ANULADA produce DOS eventos, y el segundo cuenta el motivo", () => {
    const eventos = fundirLineaDeTiempo([], [], [ORDENES[0]]);

    // Aplanar la orden a su registro borraría justo la anulación: el único rastro de por qué este
    // expediente tuvo dos números, y lo que la fila de la bandeja NO enseña.
    expect(claves(eventos)).toEqual([
      "ordenes:4101:registrada",
      "ordenes:4101:anulada",
    ]);

    const [registro, anulacion] = eventos;

    expect(registro.fecha).toBe("2026-09-18T19:00:00.000Z");
    expect(registro.titulo).toBe(
      "Orden de pago (multa) registrada — N.º SAO-2026-0041",
    );
    expect(registro.actor).toBe("Andrés Decisor");

    expect(anulacion.fecha).toBe("2026-09-19T11:00:00.000Z");
    expect(anulacion.titulo).toBe(
      "Orden de pago (multa) anulada — N.º SAO-2026-0041",
    );
    // El motivo va LITERAL: sin prefijo, sin comillas añadidas. La traza lo cita, no lo glosa.
    expect(anulacion.detalle).toBe(
      "Se emitió con el valor del remanente en lugar del de la multa",
    );
    expect(anulacion.cambios).toBeUndefined();
  });

  it("🔴 la anulación se firma SIEMPRE «Sistema», aunque el registro tenga nombre", () => {
    // El historial no trae el nombre de quien anula (`anuladaBy` es un identificador y no viaja
    // resuelto). Firmarla con `registradaPor` atribuiría la anulación a quien registró la orden:
    // el mismo defecto que la 03.19 ya pagó una vez (un hecho firmado por quien lo padeció).
    const eventos = fundirLineaDeTiempo([], [], [ORDENES[0]]);

    const anulacion = eventos.find((evento) => evento.clave.endsWith(":anulada"));
    expect(anulacion?.actor).toBe(ACTOR_DESCONOCIDO);
    expect(anulacion?.actor).toBe("Sistema");
    // Dicho en la casilla donde podría volver a pasar.
    expect(anulacion?.actor).not.toBe("Andrés Decisor");
  });

  it("un tipo de orden NO previsto se lee igual, nunca como un valor no definido", () => {
    // El cliente declara `MULTA | REMANENTE`, pero el enum del backend tiene además
    // `MULTA_COMPULSORIA` y `GASTOS_SUSTITUTORIA`. El día que se emita una, el historial la
    // devolverá tal cual y la traza —que se lee como prueba— no puede imprimir un hueco.
    const exotica = {
      ...ORDENES[1],
      ordpId: 4103,
      tipo: "GASTOS_SUSTITUTORIA",
    } as unknown as OrdenPago;

    const [evento] = fundirLineaDeTiempo([], [], [exotica]);
    expect(evento.titulo).not.toContain("undefined");
    expect(evento.titulo).toContain("gastos de sustitutoria");
  });

  it("🔴 los eventos de orden quedan INTERCALADOS por fecha, no agrupados al final", () => {
    const eventos = fundirLineaDeTiempo(
      TRAZA_INTERNA,
      HISTORIAL_ASIGNACIONES,
      ORDENES,
    );

    // 3 internos + 3 fechas de Asignaciones + 3 de las dos órdenes (una anulada cuenta doble).
    expect(eventos).toHaveLength(9);
    expect(claves(eventos)).toEqual([
      "interna:115",
      "asignaciones:7001:assignedAt",
      "interna:117",
      "ordenes:4101:registrada",
      "asignaciones:7001:reassignmentRequestedAt",
      "ordenes:4101:anulada",
      "ordenes:4102:registrada",
      "asignaciones:7001:reassignmentResolvedAt",
      "interna:121",
    ]);

    const fechas = eventos.map((evento) => evento.fecha);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it("🔴 el cambio es ADITIVO: omitir el tercer arreglo devuelve exactamente lo de antes", () => {
    const conDos = fundirLineaDeTiempo(TRAZA_INTERNA, HISTORIAL_ASIGNACIONES);
    const conVacio = fundirLineaDeTiempo(TRAZA_INTERNA, HISTORIAL_ASIGNACIONES, []);

    // Escrito sobre el objeto entero y no solo sobre las claves: lo que se promete es que las 7
    // pruebas que existían antes de la Fase 03.22 no pueden haber cambiado de resultado.
    expect(conVacio).toEqual(conDos);
    expect(conDos).toHaveLength(6);
    expect(
      conDos.every((evento) => evento.origen !== "ordenes"),
    ).toBe(true);
  });
});
