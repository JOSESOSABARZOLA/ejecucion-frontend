/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend)
 * Feature: Catálogo cerrado de hechos derivados y veredicto con motivo — Fase 03.18, Plan 01
 * Archivo: accionesHechos.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES las dos propiedades que hacen que este motor
 *   valga para la rama de obligación de hacer, y que un comentario no puede garantizar:
 *
 *     1. 🔴 LO INDECIDIBLE SE APAGA. Cuando el hecho que una condición necesita NO VIENE en el
 *        contexto —el caso real de `peldano`, que solo viaja en `GET /obligacion-hacer/:eejeId` y
 *        no en las cuatro bandejas—, la acción sale DESHABILITADA con el motivo «falta el dato».
 *        Nunca habilitada por omisión y nunca adivinada.
 *     2. 🔴 APAGAR Y NO ESCONDER. El evaluador devuelve un VEREDICTO con tres partes —visible,
 *        habilitada y motivo— y no un booleano: sin motivo no se puede apagar sin esconder, y el
 *        decisor tiene derecho a saber que un paso existe aunque todavía no le toque.
 *
 *   Unidad pura: no monta React y no toca la red.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 19: el bloque de `hechosDelEpas`, con
 *   los seis casos de `epas.sinAceptar` incluido el de la marca AUSENTE.)
 */

import { describe, it, expect } from "vitest";
import {
  evaluarCondiciones,
  hechosDelEpas,
  hechosDeLote,
  hechosDeObligacionHacer,
  leerHecho,
  motivoDeHecho,
  MOTIVOS_ACCION,
  type CondicionAccion,
  type HechosAccion,
} from "./accionesHechos";
import {
  ACCIONES_OCULTAS,
  resolverAccion,
  resolverRegla,
  type InboxActionStatusRule,
} from "./inboxActionStatusRules";

/** El bloque tal y como viaja en una FILA DE BANDEJA: con término, SIN peldaño. */
const BLOQUE_DE_BANDEJA = {
  tiene: true,
  cumplida: false,
  cumplidaAt: null,
  multasCompulsorias: 0,
  tieneInforme: false,
  sustitutoriaOrdenada: false,
  terminoAlegacion: {
    estado: "EN_CURSO",
    motivo: null,
    habilitaMultaCompulsoria: false,
    alegacionPendiente: false,
  },
  // `as const` añadido por el Plan 04 al estrechar la firma del adaptador: sin él, `estado` se
  // infiere como `string` y deja de encajar en `EstadoTermino`. No cambia ni un valor del fixture.
} as const;

describe("catálogo cerrado de hechos derivados", () => {
  it("la bolsa vacía no conoce ningún hecho", () => {
    const { conocido } = leerHecho({}, "obligacionHacer.tiene");
    expect(conocido).toBe(false);
  });

  it("🔴 un hecho PRESENTE con valor nulo SÍ es conocido", () => {
    // La serie del art. 240 agotada deja `ordinalSiguiente` en nulo: no hay peldaño que ofrecer.
    // Eso es un hecho, no ignorancia — y confundirlo con «no vino el dato» apagaría la acción por
    // el motivo equivocado.
    const hechos: HechosAccion = {
      "obligacionHacer.peldano.ordinalSiguiente": null,
    };
    expect(leerHecho(hechos, "obligacionHacer.peldano.ordinalSiguiente")).toEqual(
      { conocido: true, valor: null },
    );
  });

  it("sin bloque, el adaptador devuelve la bolsa vacía", () => {
    expect(hechosDeObligacionHacer(undefined)).toEqual({});
    expect(hechosDeObligacionHacer(null)).toEqual({});
  });

  it("🔴 en una fila de bandeja, las dos claves de peldaño quedan AUSENTES (no nulas)", () => {
    const hechos = hechosDeObligacionHacer(BLOQUE_DE_BANDEJA);

    expect("obligacionHacer.peldano.ordinalSiguiente" in hechos).toBe(false);
    expect("obligacionHacer.peldano.serieAgotada" in hechos).toBe(false);
    expect(
      leerHecho(hechos, "obligacionHacer.peldano.ordinalSiguiente").conocido,
    ).toBe(false);

    // Lo que SÍ viaja, viaja: el adaptador no se come nada de lo presente.
    expect(hechos["obligacionHacer.tiene"]).toBe(true);
    expect(hechos["obligacionHacer.cumplida"]).toBe(false);
    expect(hechos["obligacionHacer.terminoAlegacion.estado"]).toBe("EN_CURSO");
  });

  // 🔴 FIXTURE CORREGIDO POR EL PLAN 04. Este caso pasaba el peldaño PLANO en la raíz del bloque,
  // que es una forma que el backend NO ENVÍA NUNCA: cuando se escribió, el bloque viajaba sin tipo
  // propio en el frontend y la suposición no se podía comprobar. El Plan 02 declaró los tipos
  // espejo del contrato y midió la forma real: el peldaño viaja en el DETALLE, y allí dentro de
  // `serieCompulsorias`. Lo que este caso afirma —que el ordinal nulo llega como hecho CONOCIDO, y
  // no como dato ausente— no cambia ni una letra; lo que cambia es que ahora se afirma sobre la
  // forma que existe.
  it("el detalle del expediente SÍ trae el peldaño, y el ordinal nulo llega como hecho conocido", () => {
    const hechos = hechosDeObligacionHacer({
      obligacionHacer: { tiene: true, cumplida: false },
      terminoAlegacion: BLOQUE_DE_BANDEJA.terminoAlegacion,
      serieCompulsorias: {
        serie: [],
        peldano: { registradas: 3, ordinalSiguiente: null, serieAgotada: true },
      },
    });

    expect(
      leerHecho(hechos, "obligacionHacer.peldano.ordinalSiguiente"),
    ).toEqual({ conocido: true, valor: null });
    expect(hechos["obligacionHacer.peldano.serieAgotada"]).toBe(true);
  });

  it("sin condiciones, la regla cumple y no echa nada de menos", () => {
    expect(evaluarCondiciones(undefined, {})).toEqual({
      cumple: true,
      faltan: [],
      incumplidas: [],
    });
  });

  it("la pertenencia compara contra los valores del enum del término", () => {
    const condiciones: CondicionAccion[] = [
      {
        hecho: "obligacionHacer.terminoAlegacion.estado",
        en: ["EN_CURSO", "VENCIDO"],
      },
    ];
    const hechos = hechosDeObligacionHacer(BLOQUE_DE_BANDEJA);

    expect(evaluarCondiciones(condiciones, hechos).cumple).toBe(true);
    expect(
      evaluarCondiciones(condiciones, {
        "obligacionHacer.terminoAlegacion.estado": "SIN_TRASLADO",
      }).cumple,
    ).toBe(false);
  });

  it("🔴 toda clave no conocida se acumula en `faltan` y niega el cumplimiento", () => {
    const resultado = evaluarCondiciones(
      [
        { hecho: "obligacionHacer.tiene", es: true },
        { hecho: "obligacionHacer.peldano.ordinalSiguiente", es: 2 },
      ],
      hechosDeObligacionHacer(BLOQUE_DE_BANDEJA),
    );

    expect(resultado.cumple).toBe(false);
    expect(resultado.faltan).toEqual([
      "obligacionHacer.peldano.ordinalSiguiente",
    ]);
  });

  it("ningún motivo pinta la clave técnica tal cual", () => {
    const frase = motivoDeHecho("obligacionHacer.tieneInforme");
    expect(frase).not.toContain("obligacionHacer.");
    expect(MOTIVOS_ACCION.DATO_AUSENTE("obligacionHacer.tieneInforme")).toContain(
      frase,
    );
  });
});

describe("resolverAccion — el veredicto con motivo", () => {
  /**
   * La bolsa que `aceptarCaso` necesita desde la Fase 03.19, Plan 19: el caso sigue sin aceptar y no
   * hay excusa esperando al director. Se usa como EJEMPLO de acción vigente, igual que antes.
   *
   * 🔴 BOLSA LITERAL Y NO `hechosDelEpas(...)`: este bloque prueba el EVALUADOR, y un esperado que
   * saliera del adaptador de la fila haría que las dos piezas se rompieran juntas en silencio.
   */
  const CASO_SIN_ACEPTAR: HechosAccion = {
    "epas.sinAceptar": true,
    "epas.sinExcusaPendiente": true,
  };

  it("una acción vigente, con su rol y su estado, sale visible y habilitada", () => {
    expect(
      resolverAccion("aceptarCaso", {
        rol: "funcionario decisor",
        estado: "ASIGNADO_DECISOR",
        hechos: CASO_SIN_ACEPTAR,
      }),
    ).toEqual({ visible: true, habilitada: true });
  });

  it("fuera de rol: visible y APAGADA, con su motivo", () => {
    expect(
      resolverAccion("aceptarCaso", {
        rol: "director",
        estado: "ASIGNADO_DECISOR",
      }),
    ).toEqual({
      visible: true,
      habilitada: false,
      motivo: MOTIVOS_ACCION.FUERA_DE_ROL,
    });
  });

  it("fuera de estado: visible y APAGADA, con su motivo", () => {
    expect(
      resolverAccion("aceptarCaso", {
        rol: "funcionario decisor",
        estado: "VERIFICADO",
      }),
    ).toEqual({
      visible: true,
      habilitada: false,
      motivo: MOTIVOS_ACCION.FUERA_DE_ESTADO,
    });
  });

  it("🔴 un actiName sin regla sale APAGADO CON MOTIVO, no escondido (D-5 matizada por D-7)", () => {
    // Negar es apagar con su porqué. Un olvido de regla se ve así en pantalla —visible,
    // preguntable, depurable— en vez de esfumarse sin que nadie sepa que la acción existía.
    expect(
      resolverAccion("accionQueNadieEscribio", { rol: "director" }),
    ).toEqual({
      visible: true,
      habilitada: false,
      motivo: MOTIVOS_ACCION.SIN_REGLA,
    });
  });

  it("los filtros van en cascada: el motivo es el PRIMERO que falla, que es el más accionable", () => {
    // Rol equivocado Y estado equivocado a la vez: manda el rol, porque es lo primero que el
    // usuario puede entender de sí mismo.
    expect(
      resolverAccion("aceptarCaso", { rol: "director", estado: "VERIFICADO" })
        .motivo,
    ).toBe(MOTIVOS_ACCION.FUERA_DE_ROL);
  });

  it("la normalización de rol y estado es la de siempre (conducta observable)", () => {
    expect(
      resolverAccion("aceptarCaso", {
        rol: "  Funcionario Decisor  ",
        estado: "  asignado_decisor ",
        hechos: CASO_SIN_ACEPTAR,
      }).habilitada,
    ).toBe(true);
  });
});

describe("resolverRegla — la dimensión de condiciones sobre hechos", () => {
  const REGLA_CON_PELDANO: InboxActionStatusRule = {
    roles: ["funcionario decisor"],
    condiciones: [
      { hecho: "obligacionHacer.tiene", es: true },
      { hecho: "obligacionHacer.terminoAlegacion.habilitaMultaCompulsoria", es: true },
    ],
  };
  const CTX = { rol: "funcionario decisor" };

  it("condición cumplida sobre un hecho PRESENTE: habilitada", () => {
    const veredicto = resolverRegla(
      REGLA_CON_PELDANO,
      {
        ...CTX,
        hechos: {
          "obligacionHacer.tiene": true,
          "obligacionHacer.terminoAlegacion.habilitaMultaCompulsoria": true,
        },
      },
      false,
    );
    expect(veredicto).toEqual({ visible: true, habilitada: true });
  });

  it("condición NO cumplida sobre un hecho presente: apagada, y el motivo NOMBRA la condición", () => {
    const veredicto = resolverRegla(
      REGLA_CON_PELDANO,
      {
        ...CTX,
        hechos: {
          "obligacionHacer.tiene": true,
          "obligacionHacer.terminoAlegacion.habilitaMultaCompulsoria": false,
        },
      },
      false,
    );
    expect(veredicto.visible).toBe(true);
    expect(veredicto.habilitada).toBe(false);
    expect(veredicto.motivo).toBe(
      MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA(
        "obligacionHacer.terminoAlegacion.habilitaMultaCompulsoria",
      ),
    );
  });

  it("🔴 condición sobre un hecho AUSENTE: apagada con «falta el dato», NUNCA habilitada", () => {
    // Es el caso real de la bandeja: `peldano` no viaja en la fila. Adivinarlo ofrecería un acto
    // del art. 240 sin saber si queda peldaño que ofrecer.
    const veredicto = resolverRegla(
      {
        roles: ["funcionario decisor"],
        condiciones: [
          { hecho: "obligacionHacer.peldano.ordinalSiguiente", es: 1 },
        ],
      },
      { ...CTX, hechos: hechosDeObligacionHacer(BLOQUE_DE_BANDEJA) },
      false,
    );

    expect(veredicto.visible).toBe(true);
    expect(veredicto.habilitada).toBe(false);
    expect(veredicto.motivo).toBe(
      MOTIVOS_ACCION.DATO_AUSENTE("obligacionHacer.peldano.ordinalSiguiente"),
    );
  });

  it("sin bolsa de hechos, una regla con condiciones es indecidible y se apaga", () => {
    const veredicto = resolverRegla(REGLA_CON_PELDANO, CTX, false);
    expect(veredicto.habilitada).toBe(false);
    expect(veredicto.motivo).toBe(
      MOTIVOS_ACCION.DATO_AUSENTE("obligacionHacer.tiene"),
    );
  });

  it("una acción OCULTA sale invisible con independencia de rol, estado y hechos", () => {
    // La excepción deliberada a «apagar y no esconder»: el botón que NUNCA va a servir en ese punto
    // sí se oculta, porque apagado solo genera la duda de qué habría que hacer para encenderlo.
    for (const rol of ["director", "secretario abogado", "funcionario decisor"]) {
      expect(
        resolverRegla(
          REGLA_CON_PELDANO,
          { rol, estado: "ASIGNADO_DECISOR", hechos: { "obligacionHacer.tiene": true } },
          true,
        ),
      ).toEqual({ visible: false, habilitada: false });
    }
  });

  // 🔴 ACTUALIZADO POR EL PLAN 04, que es lo que el título de este caso anunciaba. Era un
  // MARCADOR DE POSICIÓN —`ACCIONES_OCULTAS` se declaró vacío en el Plan 01 para poder probar la
  // conducta de ocultación antes de que hubiera una sola acción oculta—, no una garantía de
  // conducta: ninguna pantalla dependía de que estuviera vacío. Hoy se deriva de
  // `POLITICA_ACCIONES` y contiene las dos heredadas de Resolución que se midieron sin un solo
  // consumidor. La conducta que este archivo sí protege —que una acción oculta no se muestre— la
  // siguen probando los casos de `resolverRegla` de más arriba, intactos.
  it("ACCIONES_OCULTAS se deriva de POLITICA_ACCIONES y hoy lo pueblan las dos heredadas inertes", () => {
    expect([...ACCIONES_OCULTAS].sort()).toEqual(["returnCases", "returnMemo"]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS HECHOS DEL LOTE (Fase 03.18, Plan 09)
//
// 🔴 POR QUÉ EL TURNO DE FIRMA CABE AQUÍ Y ANTES NO. La cabecera de `loteTurnActions.ts` decía, el
// 2026-07-23, que su gate no podía vivir en la tabla de reglas porque «el `status` de esa tabla es
// el enum EPAS y no puede expresar el turno del lote». Era CIERTO y lo sigue siendo: el turno NO
// entra por la dimensión `status`. Entra por la dimensión de CONDICIONES SOBRE HECHOS DERIVADOS,
// que cuando se escribió aquella frase no existía —la añadió el Plan 01 de esta misma fase—.
//
// 🔴 BOOLEANOS, NO MARCAS DE TIEMPO. El lenguaje de condiciones tiene dos operadores —igualdad y
// pertenencia— a propósito. Añadir un tercero («presente») para este caso ampliaría el lenguaje por
// una comodidad; el adaptador convierte la marca en «hay firma», que además es lo que la regla
// quiere decir.
// ═════════════════════════════════════════════════════════════════════════════════════════════

describe("hechosDeLote: el turno de firma del acta D2, dicho como hechos", () => {
  it("copia el estado del lote y traduce las tres marcas a «hay firma»", () => {
    expect(
      hechosDeLote({
        estado: "PARCIALMENTE_FIRMADO",
        firmaDecisorAt: "2026-07-23T10:00:00Z",
      }),
    ).toEqual({
      "lote.estado": "PARCIALMENTE_FIRMADO",
      "lote.firmaDecisor": true,
      "lote.firmaSecretario": false,
      "lote.aprobado": false,
    });
  });

  it("🔴 los tres booleanos SIEMPRE vienen: una marca ausente es «no hay firma», no «no se sabe»", () => {
    // Es la diferencia con `hechosDeObligacionHacer`, y es deliberada. Allí una clave ausente es
    // INDECIDIBLE porque la pantalla pudo no traer el dato; aquí la ausencia de la marca ES el
    // hecho —nadie firmó—, que es exactamente como lo leía el resolver original (`!firmaDecisorAt`).
    // Si se copiaran «solo si presentes», el decisor de un lote PENDIENTE recién sorteado vería su
    // propio botón apagado por falta de dato: una regresión silenciosa de la firma orden-1.
    const hechos = hechosDeLote({ estado: "PENDIENTE" });
    expect(hechos["lote.firmaDecisor"]).toBe(false);
    expect(hechos["lote.firmaSecretario"]).toBe(false);
    expect(hechos["lote.aprobado"]).toBe(false);
    expect(leerHecho(hechos, "lote.firmaDecisor").conocido).toBe(true);
  });

  it("un lote SIN estado deja la clave ausente: ahí el turno no se puede decidir", () => {
    const hechos = hechosDeLote({});
    expect(hechos).not.toHaveProperty("lote.estado");
    expect(leerHecho(hechos, "lote.estado").conocido).toBe(false);
  });

  it("no interpreta la marca más allá de su existencia: ninguna fecha entra en la bolsa", () => {
    const hechos = hechosDeLote({
      estado: "APROBADO",
      firmaDecisorAt: "2026-07-23T10:00:00Z",
      firmaSecretarioAt: "2026-07-23T11:00:00Z",
      aprobadoAt: "2026-07-23T12:00:00Z",
    });
    for (const valor of Object.values(hechos)) {
      expect(typeof valor === "boolean" || valor === "APROBADO").toBe(true);
    }
    expect(Object.keys(hechos)).toHaveLength(4);
  });

  it("las cuatro claves del lote tienen su frase de motivo escrita", () => {
    for (const clave of [
      "lote.estado",
      "lote.firmaDecisor",
      "lote.firmaSecretario",
      "lote.aprobado",
    ] as const) {
      expect(motivoDeHecho(clave), clave).toBeTruthy();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA ACEPTACIÓN DEL CASO, DICHA EN LAS DOS DIRECCIONES (Fase 03.19, Plan 19 — gap 4 del UAT).
//
// 🔴 QUÉ SE ESTÁ ARREGLANDO. «Aceptar» y «Excusarme» se ofrecían para siempre, también sobre un
// caso ya aceptado: su gate era solo rol + estado, y aceptar NO cambia el estado del EPAS. El gate
// que faltaba existía en la versión de tarjetas de la página (`!aceptado && !excusaPendiente`,
// `git show 3f87a5f^:src/pages/MisAsignadosPage.tsx`, líneas 536-552) y el paso a tabla del Plan 17
// lo dejó atrás. Para trasladarlo al motor hacía falta poder decir «el caso sigue SIN aceptar», y
// eso es `epas.sinAceptar`.
//
// 🔴 CLAVE NUEVA EN POSITIVO, Y NO `{ hecho: "epas.aceptado", es: false }`. Es el mismo precio que
// el comentario de `epas.sinExcusaPendiente` explica: `DESCRIPCION_HECHO` está en indicativo
// AFIRMATIVO, así que una condición negativa sobre una clave positiva pinta el motivo DEL REVÉS —le
// diría al decisor que «Aceptar» solo procede si él ya aceptó el caso—. Las dos últimas pruebas de
// este bloque son las que no dejan que eso vuelva.
// ═════════════════════════════════════════════════════════════════════════════════════════════

describe("hechosDelEpas: la aceptación del caso, en las dos direcciones", () => {
  it("con el caso aceptado a mano, `sinAceptar` es falso y `aceptado` verdadero", () => {
    const hechos = hechosDelEpas({ aceptado: true, excusaPendiente: false });
    expect(hechos["epas.sinAceptar"]).toBe(false);
    expect(hechos["epas.aceptado"]).toBe(true);
  });

  it("con el caso todavía sin aceptar, `sinAceptar` es VERDADERO", () => {
    // Es la celda que la bandeja existe para pedir: aquí «Aceptar» y «Excusarme» van encendidas.
    const hechos = hechosDelEpas({ aceptado: false, excusaPendiente: false });
    expect(hechos["epas.sinAceptar"]).toBe(true);
    expect(hechos["epas.aceptado"]).toBe(false);
  });

  it("🔴 el veredicto efectivo incluye la aceptación POR VENCIMIENTO del plazo", () => {
    // El caso literal del reporte del usuario del 2026-09-22: «ya está aceptado o AUTOACEPTADO».
    // La aceptación por vencimiento la deriva el backend y viaja en `aceptadoImplicito`; el hecho
    // cae a ella igual que `epas.aceptado`, porque para el decisor que se hizo cargo del caso —lo
    // haya hecho a mano o se lo haya hecho el plazo— ya no hay nada que aceptar ni de qué excusarse.
    const hechos = hechosDelEpas({
      aceptadoImplicito: true,
      excusaPendiente: false,
    });
    expect(hechos["epas.sinAceptar"]).toBe(false);
    expect(hechos["epas.aceptado"]).toBe(true);
  });

  it("🔴 sin NINGUNA marca de aceptación la clave queda AUSENTE, no en falso", () => {
    // La distinción que este archivo existe para sostener: «no lo sé» no es «no está aceptado». Si
    // la ausencia se escribiera como `true`, el motor afirmaría que el caso sigue sin aceptar sobre
    // una fila que no lo dice, y encendería «Aceptar» sin saberlo.
    const hechos = hechosDelEpas({ excusaPendiente: false });
    expect(hechos).not.toHaveProperty("epas.sinAceptar");
    expect(leerHecho(hechos, "epas.sinAceptar").conocido).toBe(false);
    // Y la excusa SÍ se escribe siempre: esa asimetría es deliberada y no se toca.
    expect(leerHecho(hechos, "epas.sinExcusaPendiente").conocido).toBe(true);
  });

  it("🔴 las dos claves de la aceptación están SIEMPRE las dos o ninguna, y nunca dicen lo mismo", () => {
    // Comparten el mismo `if` a propósito. Si se separaran, el caso «no lo sé» de una se convertiría
    // en el «no» de la otra y las dos reglas gateadas por `sinAceptar` empezarían a discrepar de las
    // tres vecinas gateadas por `aceptado` sobre la misma fila.
    const FILAS = [
      { aceptado: true, excusaPendiente: false },
      { aceptado: false, excusaPendiente: false },
      { aceptadoImplicito: true, excusaPendiente: false },
      { aceptadoImplicito: false, excusaPendiente: true },
      { excusaPendiente: false },
      { excusaPendiente: true },
      {},
    ];

    for (const fila of FILAS) {
      const hechos = hechosDelEpas(fila);
      const etiqueta = JSON.stringify(fila);
      const conoceAceptado = leerHecho(hechos, "epas.aceptado").conocido;
      const conoceSinAceptar = leerHecho(hechos, "epas.sinAceptar").conocido;
      expect(conoceSinAceptar, etiqueta).toBe(conoceAceptado);
      if (conoceAceptado) {
        expect(hechos["epas.sinAceptar"], etiqueta).toBe(
          !hechos["epas.aceptado"],
        );
      }
    }
  });

  it("🔴 las DOS plantillas de motivo se leen del derecho con `epas.sinAceptar`", () => {
    // Es la razón de existir de la clave. Si alguien la sustituyera por `epas.aceptado` con
    // `es: false`, el motivo diría lo contrario de lo que le falta al decisor y esta prueba caería.
    const frase = motivoDeHecho("epas.sinAceptar");
    expect(frase).toBeTruthy();
    // Nunca la clave técnica tal cual: `actiDisabledHint` va a la pantalla de un funcionario.
    expect(frase).not.toContain("epas.");

    const noCumplida = MOTIVOS_ACCION.CONDICION_NO_CUMPLIDA("epas.sinAceptar");
    const ausente = MOTIVOS_ACCION.DATO_AUSENTE("epas.sinAceptar");
    expect(noCumplida).toBe(`Esta acción solo procede si ${frase}.`);
    expect(ausente).toContain(`no trae el dato de si ${frase}`);

    // 🔴 EL LISTÓN QUE IMPORTA: ninguna de las dos puede decirle al decisor que su acción depende
    // de que él YA haya aceptado el caso, que es justo lo que `epas.aceptado` en negativo diría.
    for (const motivo of [noCumplida, ausente]) {
      expect(motivo).not.toContain(motivoDeHecho("epas.aceptado"));
      expect(motivo).not.toMatch(/ya aceptó el caso/i);
    }
  });
});
