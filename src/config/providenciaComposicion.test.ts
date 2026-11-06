/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Composición de providencias (Fase 03.14, Plan 06 · Fase 03.15, Plan 06) — tests
 * Archivo: providenciaComposicion.test.ts
 * Responsabilidad: Fija las reglas puras del modal: qué tokens se ofrecen (solo los que TIENEN
 *   valor), que los tokens se resuelven ANTES de mandar, qué secciones viajan, y quién puede emitir.
 *
 *   Fase 03.15 (D-5): y la PRECEDENCIA de los dos orígenes de la prueba. Es la aserción que más
 *   falta hacía — invertir la mezcla no rompe nada visible: la providencia sale igual, con la fecha
 *   de ayer impresa donde el decisor acababa de teclear la de hoy.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-14
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys, D-01: {Materia} y {Submateria} salen del
 *   EXPEDIENTE —`expMateria` y `expSubmateria`—, nunca de la `submateria` del reparto; las listas de
 *   tokens ganan {Submateria} justo detrás de {Materia})
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 17 — D-17/D-00b: la fila ya no trae el
 *   id de materia ni la submateria del reparto; {Materia}/{Submateria} y la cabecera leen las
 *   DEDUCIDAS del código, y un caso nuevo fija que varias submaterias se imprimen tal cual llegan)
 */

import { describe, expect, it } from "vitest";
import {
  MARCADOR_CUADRO,
  cabeceraDesdeCaso,
  mezclarContextoTokens,
  puedeEmitirProvidencia,
  resolverTokens,
  seccionesParaEnviar,
  tieneContenido,
  tokensDisponibles,
} from "./providenciaComposicion";
import type { MiEpasAsignado } from "../services/SorteoService";
import { crearMiEpasAsignado } from "../test/fixtures/miEpasAsignado";
import { DatetimeUtil } from "../utils/datetime.util";

const caso = (extra: Partial<MiEpasAsignado> = {}): MiEpasAsignado => ({
  eejeId: 42,
  expNumber: "GADDMQ-AMC-DMIT-ZEE-2024-1764",
  administrado: "CARVAJAL VEGA DAYANA LIZBETH",
  cedula: "1755566054",
  // Fase 03.23 (D-17): materia y submateria DEDUCIDAS por el servidor del código de las infracciones
  // del EPAS (`EPU-UI-…`), con los nombres literales del diccionario CAT v1.3. Ya no hay id de
  // materia ni submateria del reparto en la fila.
  expMateria: "ESPACIO PÚBLICO",
  expSubmateria: "USO INDEBIDO ESPACIO PUBLICO",
  aceptado: true,
  ...extra,
});

describe("tokens", () => {
  it("ofrece los cinco datos que el caso trae", () => {
    expect(tokensDisponibles(caso()).map((t) => t.token)).toEqual([
      "{Expediente}",
      "{Nombre Administrado}",
      "{CI/RUC}",
      "{Materia}",
      "{Submateria}",
    ]);
  });

  it("🔴 NO ofrece un token sin valor: insertarlo dejaría un marcador impreso en el PDF", () => {
    const sinMateria = caso({
      expMateria: undefined,
      expSubmateria: undefined,
      cedula: "   ",
    });

    expect(tokensDisponibles(sinMateria).map((t) => t.token)).toEqual([
      "{Expediente}",
      "{Nombre Administrado}",
    ]);
  });

  it("resuelve los tokens del texto con el valor del caso", () => {
    const html = "<p>El expediente {Expediente} de {Nombre Administrado}.</p>";

    expect(resolverTokens(html, caso())).toBe(
      "<p>El expediente GADDMQ-AMC-DMIT-ZEE-2024-1764 de CARVAJAL VEGA DAYANA LIZBETH.</p>",
    );
  });

  it("resuelve TODAS las apariciones del mismo token, no solo la primera", () => {
    const html = "<p>{CI/RUC} y otra vez {CI/RUC}</p>";

    expect(resolverTokens(html, caso())).toBe(
      "<p>1755566054 y otra vez 1755566054</p>",
    );
  });

  it("🔴 Fase 03.23 (D-17): {Materia} y {Submateria} son las DEDUCIDAS del código que manda el servidor", () => {
    // La fixture lleva `LIC-LU-…` y, deducidas por el servidor, «LICENCIAMIENTO» / «LUAE».
    const fila = crearMiEpasAsignado();
    const html = "<p>{Materia} / {Submateria}</p>";

    expect(resolverTokens(html, fila)).toBe("<p>LICENCIAMIENTO / LUAE</p>");
  });

  it("🔴 D-00b: VARIAS submaterias llegan ya unidas y {Submateria} las compone TAL CUAL", () => {
    const html = "<p>en materia de {Materia}, submateria {Submateria}.</p>";

    expect(
      resolverTokens(
        html,
        caso({
          expMateria: "LICENCIAMIENTO",
          expSubmateria: "EDIFICACIÓN, HABILITACIÓN DEL SUELO",
        }),
      ),
    ).toBe(
      "<p>en materia de LICENCIAMIENTO, submateria EDIFICACIÓN, HABILITACIÓN DEL SUELO.</p>",
    );
  });

  it("sin `expSubmateria`, {Submateria} no se ofrece (pero {Materia} sí, si la hay)", () => {
    const ofrecidos = tokensDisponibles(
      caso({ expSubmateria: undefined }),
    ).map((t) => t.token);

    expect(ofrecidos).not.toContain("{Submateria}");
    expect(ofrecidos).toContain("{Materia}");
  });

  it("un token sin dato se deja tal cual en vez de sustituirse por vacío", () => {
    const html = "<p>Materia: {Materia}</p>";

    expect(resolverTokens(html, caso({ expMateria: undefined }))).toBe(html);
  });
});

describe("tieneContenido", () => {
  it("reconoce como vacío lo que Tiptap deja al borrar todo", () => {
    expect(tieneContenido("<p></p>")).toBe(false);
    expect(tieneContenido("<p>&nbsp;</p>")).toBe(false);
    expect(tieneContenido(undefined)).toBe(false);
  });

  it("reconoce el contenido aunque venga envuelto en etiquetas", () => {
    expect(
      tieneContenido("<ol><li><p><strong>Algo</strong></p></li></ol>"),
    ).toBe(true);
  });
});

describe("seccionesParaEnviar", () => {
  it("manda UNA sección con todo el cuerpo y los tokens ya resueltos", () => {
    const secciones = seccionesParaEnviar(
      { cuerpo: "<p>Sobre {Expediente}</p>" },
      caso(),
    );

    expect(secciones).toEqual([
      {
        clave: "cuerpo",
        html: "<p>Sobre GADDMQ-AMC-DMIT-ZEE-2024-1764</p>",
      },
    ]);
  });

  it("🔴 el marcador del cuadro NO se resuelve: es la marca de sitio de la tabla", () => {
    // Si se sustituyera por un valor como los demás tokens, el backend no encontraría dónde
    // injertar el cuadro y la providencia de trabajo comunitario saldría sin su tabla.
    const secciones = seccionesParaEnviar(
      { cuerpo: `<p>detalle:</p><p>${MARCADOR_CUADRO}</p>` },
      caso(),
    );

    expect(secciones[0].html).toContain(MARCADOR_CUADRO);
  });

  it("un cuerpo vacío no viaja (el editor de Tiptap siempre trae <p></p>)", () => {
    expect(seccionesParaEnviar({ cuerpo: "<p></p>" }, caso())).toEqual([]);
    expect(seccionesParaEnviar({}, caso())).toEqual([]);
  });
});

describe("tokens de la prueba — los DOS orígenes de D-5", () => {
  it("🔴 PRECEDENCIA: con los dos orígenes presentes gana lo TECLEADO en el formulario", () => {
    // El decisor que acaba de teclear la transacción en el modal no puede ver cómo el sistema se la
    // sustituye por la de ayer. Lo guardado rellena el hueco; no lo pisa.
    const contexto = mezclarContextoTokens(
      { pagoAt: "2026-09-01", transaccion: "TRX-DE-AYER" },
      { pagoAt: "2026-09-14", transaccion: "TRX-DE-HOY" },
    );

    expect(contexto).toEqual({
      pagoAt: "2026-09-14",
      transaccion: "TRX-DE-HOY",
    });
  });

  it("lo guardado RELLENA el hueco que el formulario deja vacío", () => {
    expect(
      mezclarContextoTokens(
        { pagoAt: "2026-09-01", transaccion: "TRX-DE-AYER" },
        { transaccion: "TRX-DE-HOY" },
      ),
    ).toEqual({ pagoAt: "2026-09-01", transaccion: "TRX-DE-HOY" });
  });

  it("una cadena en blanco del formulario NO cuenta como valor: no pisa lo guardado", () => {
    // Es el campo que el decisor abrió y dejó vacío. Tratarlo como valor borraría el dato bueno.
    expect(
      mezclarContextoTokens(
        { pagoAt: "2026-09-01", transaccion: "TRX-DE-AYER" },
        { pagoAt: "   ", transaccion: "" },
      ),
    ).toEqual({ pagoAt: "2026-09-01", transaccion: "TRX-DE-AYER" });
  });

  it("sustituye los dos tokens nuevos con lo que trae el contexto", () => {
    const html = "<p>Pagado el {Fecha de pago}, transacción {Transacción}.</p>";

    expect(
      resolverTokens(html, caso(), {
        pagoAt: "14 de septiembre de 2026",
        transaccion: "TRX-99",
      }),
    ).toBe("<p>Pagado el 14 de septiembre de 2026, transacción TRX-99.</p>");
  });

  it("🔴 sin contexto los tokens nuevos se dejan INTACTOS, y los cuatro de siempre siguen resolviéndose", () => {
    // La llamada SIN el tercer argumento es la de todos los tipos que no exigen prueba: tiene que
    // seguir comportándose exactamente igual que antes de esta fase.
    const html = "<p>{Expediente} · {Fecha de pago}</p>";

    expect(resolverTokens(html, caso())).toBe(
      "<p>GADDMQ-AMC-DMIT-ZEE-2024-1764 · {Fecha de pago}</p>",
    );
  });

  it("🔴 la paleta es REACTIVA: los tokens nuevos aparecen en cuanto el contexto trae valor", () => {
    expect(tokensDisponibles(caso()).map((t) => t.token)).not.toContain(
      "{Fecha de pago}",
    );

    expect(
      tokensDisponibles(caso(), { pagoAt: "2026-09-14" }).map((t) => t.token),
    ).toEqual([
      "{Expediente}",
      "{Nombre Administrado}",
      "{CI/RUC}",
      "{Materia}",
      "{Submateria}",
      "{Fecha de pago}",
    ]);
  });

  it("con el contexto de la PRUEBA se ofrecen siete: los tres del escrito siguen filtrados", () => {
    expect(
      tokensDisponibles(caso(), {
        pagoAt: "2026-09-14",
        transaccion: "TRX-99",
      }),
    ).toHaveLength(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Los TRES tokens del ESCRITO DE EXCUSA (Quick 260916-kwg)
//
// {Causal}, {Decisor} y {Fecha} entran en el registro COMPARTIDO y no en uno propio del escrito. Un
// segundo registro sería un segundo mecanismo de tokens, con su propia función de resolución y su
// propio filtro: dos sitios donde arreglar el mismo defecto. Como resuelven SOLO desde el contexto y
// `EmitirProvidenciaModal` no lo pasa, el efecto sobre la providencia es NULO — y eso no se deja a
// la buena fe, se clava con la prueba de no-regresión de abajo.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe("tokens del escrito de excusa", () => {
  const contextoEscrito = {
    causal: "Ser pariente hasta el cuarto grado de consanguinidad.",
    decisor: "ANDRÉS MIÑO CARRERA",
    fecha: "16 de septiembre de 2026",
  };

  it("los tres resuelven DESDE EL CONTEXTO, no desde el caso", () => {
    const ofrecidos = tokensDisponibles(caso(), contextoEscrito).map(
      (t) => t.token,
    );

    expect(ofrecidos).toContain("{Causal}");
    expect(ofrecidos).toContain("{Decisor}");
    expect(ofrecidos).toContain("{Fecha}");
  });

  it("resolverTokens los sustituye en el HTML", () => {
    const html =
      "<p>Yo, {Decisor}, el {Fecha}, por la causal: {Causal}</p>";

    expect(resolverTokens(html, caso(), contextoEscrito)).toBe(
      "<p>Yo, ANDRÉS MIÑO CARRERA, el 16 de septiembre de 2026, por la causal: " +
        "Ser pariente hasta el cuarto grado de consanguinidad.</p>",
    );
  });

  it("🔴 sin valor NO se ofrecen: insertarlos dejaría un literal en un acto administrativo", () => {
    const ofrecidos = tokensDisponibles(caso(), {
      causal: "   ",
      decisor: undefined,
    }).map((t) => t.token);

    expect(ofrecidos).not.toContain("{Causal}");
    expect(ofrecidos).not.toContain("{Decisor}");
    expect(ofrecidos).not.toContain("{Fecha}");
  });

  it("🔴 NO HAY REGRESIÓN EN LA PROVIDENCIA: sin contexto se siguen ofreciendo EXACTAMENTE los cinco del caso", () => {
    // `EmitirProvidenciaModal` nunca pasa los campos nuevos, así que su lista de badges no puede
    // cambiar. Esta aserción es la que lo garantiza: si alguien hiciera que uno de los tres nuevos
    // resolviera desde el caso (o le pusiera un valor por defecto), aparecería aquí y esto se
    // pondría rojo. Sin ella, el cambio sería invisible hasta que un decisor viera un badge de más.
    expect(tokensDisponibles(caso()).map((t) => t.token)).toEqual([
      "{Expediente}",
      "{Nombre Administrado}",
      "{CI/RUC}",
      "{Materia}",
      "{Submateria}",
    ]);
  });

  it("el catálogo completo tiene DIEZ tokens", () => {
    expect(
      tokensDisponibles(caso(), {
        pagoAt: "2026-09-14",
        transaccion: "TRX-99",
        ...contextoEscrito,
      }),
    ).toHaveLength(10);
  });

  it("🔴 {Detalle} NO es un token: resolverTokens lo deja INTACTO", () => {
    // Es una marca de SITIO, no un dato que se sustituya por su valor — la misma semántica que
    // `{Cuadro de horas}`. Si entrara en el registro, el resolvedor lo borraría (o lo sustituiría)
    // antes de que `componerEscritoExcusa` pudiera encontrarlo, y la regla «sin hecho concreto no
    // hay párrafo SEGUNDO» dejaría de poder aplicarse.
    const html = "<p>SEGUNDO.- … los siguientes: {Detalle}</p>";

    expect(resolverTokens(html, caso(), contextoEscrito)).toBe(html);
    expect(
      tokensDisponibles(caso(), contextoEscrito).map((t) => t.token),
    ).not.toContain("{Detalle}");
  });
});

describe("DatetimeUtil.formatFechaLarga", () => {
  it("espeja formatDocumentDateLong del backend: «d de MMMM de yyyy» en español", () => {
    // Espejo EXACTO de `documentation/utils/document-date.util.ts`. Si divergen, el escrito llevará
    // una fecha con distinto formato que el resto de documentos del expediente.
    expect(DatetimeUtil.formatFechaLarga(new Date(2026, 8, 16))).toBe(
      "16 de septiembre de 2026",
    );
  });

  it("sin argumento usa hoy, y una fecha inválida no revienta la composición", () => {
    expect(DatetimeUtil.formatFechaLarga()).toMatch(/^\d{1,2} de \w+ de \d{4}$/);
    expect(DatetimeUtil.formatFechaLarga(new Date("no-es-fecha"))).toMatch(
      /^\d{1,2} de \w+ de \d{4}$/,
    );
  });

  it("seccionesParaEnviar resuelve también los tokens de la prueba, y sigue dejando el cuadro", () => {
    const secciones = seccionesParaEnviar(
      { cuerpo: `<p>{Transacción}</p><p>${MARCADOR_CUADRO}</p>` },
      caso(),
      { transaccion: "TRX-99" },
    );

    expect(secciones[0].html).toBe(`<p>TRX-99</p><p>${MARCADOR_CUADRO}</p>`);
  });
});

describe("cabeceraDesdeCaso", () => {
  it("prellena lo que el caso sabe y omite lo que no", () => {
    expect(cabeceraDesdeCaso(caso({ cedula: undefined }))).toEqual({
      expedienteNumero: "GADDMQ-AMC-DMIT-ZEE-2024-1764",
      administradoNombre: "CARVAJAL VEGA DAYANA LIZBETH",
      materia: "ESPACIO PÚBLICO",
    });
  });

  it("🔴 Fase 03.23 (D-17): la MATERIA de la cabecera es la DEDUCIDA del código, nunca la submateria", () => {
    const cabecera = cabeceraDesdeCaso(crearMiEpasAsignado());

    expect(cabecera.materia).toBe("LICENCIAMIENTO");
    expect(Object.values(cabecera)).not.toContain("LUAE");
  });
});

describe("puedeEmitirProvidencia", () => {
  it("solo sobre un caso ACEPTADO", () => {
    expect(puedeEmitirProvidencia(caso())).toBe(true);
    expect(puedeEmitirProvidencia(caso({ aceptado: false }))).toBe(false);
    expect(puedeEmitirProvidencia(caso({ aceptado: undefined }))).toBe(false);
  });

  it("🔴 no sobre uno con excusa pendiente: todavía no se sabe si es suyo", () => {
    expect(puedeEmitirProvidencia(caso({ excusaPendiente: true }))).toBe(false);
  });
});
