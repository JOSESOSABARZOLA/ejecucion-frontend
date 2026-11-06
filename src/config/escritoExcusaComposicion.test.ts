/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME) — frontend
 * Feature: Composición del escrito de excusa (Quick 260916-kwg, D-03) — tests
 * Archivo: escritoExcusaComposicion.test.ts
 * Responsabilidad: Fijar las tres reglas de la marca de sitio `{Detalle}` —sustituir, borrar el
 *   párrafo, o no hacer nada— y el CONTRATO con el backend.
 *
 *   ── POR QUÉ EL HECHO CONCRETO ENTRA POR MARCADOR Y NO POR TEXTO LITERAL ──────────────────────
 *   Localizar el párrafo del SEGUNDO por su redacción lo ataría a un texto que la DAJ puede
 *   reescribir mañana — y reescribirlo sin desplegar es LITERALMENTE para lo que se creó
 *   `t_plantilla_documento` (D-05). Una composición que se rompe justo cuando la DAJ edita anula el
 *   motivo del diseño.
 *
 *   Este proyecto ya resolvió este problema una vez, con el cuadro de horas: *«el del CUADRO se deja
 *   intacto a propósito: no es un dato que se sustituya por su valor, es la marca de sitio que el
 *   backend usa para injertar la tabla»*, y *«su presencia es la señal: sin marcador no hay cuadro»*.
 *   `{Detalle}` es lo mismo, aplicado al hecho concreto.
 *
 *   ── LOS FIXTURES SON EL CONTRATO CON EL OTRO REPOSITORIO ─────────────────────────────────────
 *   `HTML_CON_DETALLE` y `HTML_SIN_DETALLE` son, carácter a carácter, los del spec del backend
 *   (`escrito-excusa.report.spec.ts`). El caso final los compara. Si uno cambia, el otro repositorio
 *   tiene que cambiar con él.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-16
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: el caso lleva la materia en `expMateria`, la
 *   del expediente; la submateria del reparto decía otra cosa y el escrito no la leía)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 17 — D-17: la fila ya no trae la
 *   submateria del reparto; el señuelo pasa a ser la submateria DEDUCIDA, que el escrito tampoco lee)
 * Modificado por: Andrés Miño — 2026-10-28 (la plantilla ya no trae el bloque del firmante: lo pone la estampa)
 */

import { describe, expect, it } from "vitest";
import {
  MARCADOR_DETALLE,
  componerEscritoExcusa,
} from "./escritoExcusaComposicion";
import type { MiEpasAsignado } from "../services/SorteoService";

/**
 * La plantilla TAL Y COMO ESTÁ SEMBRADA en `t_plantilla_documento` (clave ESCRITO_EXCUSA).
 *
 * No se re-tecleó: se extrajo de la fila de la base, igual que los dos fixtures de salida. Si la DAJ
 * corrige el texto en producción, esta constante se queda como está — lo que se prueba aquí son las
 * REGLAS de composición, no la redacción, y ese es justo el punto de D-05.
 */
const PLANTILLA = [
  "<p>Quito D.M., {Fecha}</p>",
  "<p><br></p>",
  "<p>Señor(a)<br><strong>Director(a) Metropolitano(a) de Ejecución</strong><br>Agencia Metropolitana de Control<br>Presente.-</p>",
  "<p><br></p>",
  "<p>De mi consideración:</p>",
  "<p>Yo, <strong>{Decisor}</strong>, en mi calidad de funcionario decisor de la Dirección Metropolitana de Ejecución, a quien por sorteo le correspondió el conocimiento del expediente <strong>{Expediente}</strong>, seguido en contra de {Nombre Administrado}, con documento de identificación {CI/RUC}, en materia de {Materia}, comparezco ante usted y expongo:</p>",
  "<p><strong>PRIMERO.-</strong> Me excuso de conocer y sustanciar el expediente señalado, por encontrarme incurso en la siguiente causal prevista en la Resolución de Protocolo de Recusación y Excusa de la Agencia Metropolitana de Control:</p>",
  "<blockquote><p><em>{Causal}</em></p></blockquote>",
  "<p><strong>SEGUNDO.-</strong> Los hechos concretos que sustentan la causal invocada son los siguientes: {Detalle}</p>",
  "<p><strong>TERCERO.-</strong> Por lo expuesto, solicito que se acepte la presente excusa y se disponga la reasignación del expediente a otro funcionario decisor, conforme al procedimiento de sorteo vigente.</p>",
  "<p><br></p>",
  "<p>Atentamente,</p>",
].join("\n");

/**
 * 🔴 CONTRATO CON EL BACKEND — con hecho concreto.
 *
 * Es, carácter a carácter, `HTML_CON_DETALLE` de
 * `ejecucion-backend/src/modules/documentation/reports/templates/escrito/escrito-excusa.report.spec.ts`.
 * Si uno de los dos cambia, el otro repositorio tiene que cambiar con él: no hay compilador que ate
 * los dos lados, solo esta nota y la aserción que los compara.
 */
const HTML_CON_DETALLE = [
  "<p>Quito D.M., 16 de septiembre de 2026</p>",
  "<p><br></p>",
  "<p>Señor(a)<br><strong>Director(a) Metropolitano(a) de Ejecución</strong><br>Agencia Metropolitana de Control<br>Presente.-</p>",
  "<p><br></p>",
  "<p>De mi consideración:</p>",
  "<p>Yo, <strong>ANDRÉS MIÑO CARRERA</strong>, en mi calidad de funcionario decisor de la Dirección Metropolitana de Ejecución, a quien por sorteo le correspondió el conocimiento del expediente <strong>GADDMQ-AMC-DMIT-ZEE-2024-1764</strong>, seguido en contra de CARVAJAL VEGA DAYANA LIZBETH, con documento de identificación 1755566054, en materia de Espacio Público, comparezco ante usted y expongo:</p>",
  "<p><strong>PRIMERO.-</strong> Me excuso de conocer y sustanciar el expediente señalado, por encontrarme incurso en la siguiente causal prevista en la Resolución de Protocolo de Recusación y Excusa de la Agencia Metropolitana de Control:</p>",
  "<blockquote><p><em>Ser pariente hasta el cuarto grado de consanguinidad.</em></p></blockquote>",
  "<p><strong>SEGUNDO.-</strong> Los hechos concretos que sustentan la causal invocada son los siguientes: El administrado es cónyuge de mi hermana.</p>",
  "<p><strong>TERCERO.-</strong> Por lo expuesto, solicito que se acepte la presente excusa y se disponga la reasignación del expediente a otro funcionario decisor, conforme al procedimiento de sorteo vigente.</p>",
  "<p><br></p>",
  "<p>Atentamente,</p>",
].join("\n");

/**
 * 🔴 CONTRATO CON EL BACKEND — sin hecho concreto.
 *
 * El párrafo del SEGUNDO no está: no está vacío ni con un guion, no está. Se borra el párrafo ENTERO
 * que contenía la marca, no solo la marca. Dejar el rótulo huérfano es exactamente el defecto que
 * tuvo el cuadro de horas antes del `10b9ba9`.
 */
const HTML_SIN_DETALLE = [
  "<p>Quito D.M., 16 de septiembre de 2026</p>",
  "<p><br></p>",
  "<p>Señor(a)<br><strong>Director(a) Metropolitano(a) de Ejecución</strong><br>Agencia Metropolitana de Control<br>Presente.-</p>",
  "<p><br></p>",
  "<p>De mi consideración:</p>",
  "<p>Yo, <strong>ANDRÉS MIÑO CARRERA</strong>, en mi calidad de funcionario decisor de la Dirección Metropolitana de Ejecución, a quien por sorteo le correspondió el conocimiento del expediente <strong>GADDMQ-AMC-DMIT-ZEE-2024-1764</strong>, seguido en contra de CARVAJAL VEGA DAYANA LIZBETH, con documento de identificación 1755566054, en materia de Espacio Público, comparezco ante usted y expongo:</p>",
  "<p><strong>PRIMERO.-</strong> Me excuso de conocer y sustanciar el expediente señalado, por encontrarme incurso en la siguiente causal prevista en la Resolución de Protocolo de Recusación y Excusa de la Agencia Metropolitana de Control:</p>",
  "<blockquote><p><em>Ser pariente hasta el cuarto grado de consanguinidad.</em></p></blockquote>",
  "<p><strong>TERCERO.-</strong> Por lo expuesto, solicito que se acepte la presente excusa y se disponga la reasignación del expediente a otro funcionario decisor, conforme al procedimiento de sorteo vigente.</p>",
  "<p><br></p>",
  "<p>Atentamente,</p>",
].join("\n");

const CASO: MiEpasAsignado = {
  eejeId: 42,
  cassId: 555,
  expNumber: "GADDMQ-AMC-DMIT-ZEE-2024-1764",
  administrado: "CARVAJAL VEGA DAYANA LIZBETH",
  cedula: "1755566054",
  // «en materia de {Materia}» lee la materia DEL EXPEDIENTE, que desde la Fase 03.23 (D-17) es la
  // DEDUCIDA por el servidor del código de sus infracciones. El valor se queda en «Espacio Público»
  // —y no en el literal del CAT, «ESPACIO PÚBLICO»— porque `HTML_CON_DETALLE`/`HTML_SIN_DETALLE` son,
  // carácter a carácter, los del spec del backend: cambiarlo aquí rompería ese contrato sin tocar
  // el otro repositorio. La SUBMATERIA dice otra cosa a propósito: si el escrito la leyera en lugar
  // de la materia, diría «en materia de USO INDEBIDO ESPACIO PUBLICO».
  expMateria: "Espacio Público",
  expSubmateria: "USO INDEBIDO ESPACIO PUBLICO",
  aceptado: true,
};

const CONTEXTO = {
  causal: "Ser pariente hasta el cuarto grado de consanguinidad.",
  decisor: "ANDRÉS MIÑO CARRERA",
  fecha: "16 de septiembre de 2026",
};

const HECHO = "El administrado es cónyuge de mi hermana.";

describe("componerEscritoExcusa — con hecho concreto", () => {
  it("inserta el hecho en el sitio de la marca y resuelve los siete tokens", () => {
    const html = componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, HECHO);

    expect(html).toContain(HECHO);
    // La marca desaparece: se sustituyó por el texto, no se quedó al lado.
    expect(html).not.toContain(MARCADOR_DETALLE);
    // Y no queda ni una llave suelta: ningún token sin resolver llegaría impreso al PDF.
    expect(html).not.toMatch(/[{}]/);
    // El rótulo sigue donde estaba, con su hecho detrás.
    expect(html).toContain(
      "<strong>SEGUNDO.-</strong> Los hechos concretos que sustentan la causal " +
        `invocada son los siguientes: ${HECHO}</p>`,
    );
  });

  it("un hecho con espacios de sobra viaja recortado", () => {
    expect(
      componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, `   ${HECHO}   `),
    ).toContain(`siguientes: ${HECHO}</p>`);
  });
});

describe("componerEscritoExcusa — SIN hecho concreto (decisión 3)", () => {
  it("🔴 se va el PÁRRAFO ENTERO: no queda ni «SEGUNDO», ni relleno, ni un guion", () => {
    // La regla es del párrafo completo y no solo de la marca. Borrar únicamente `{Detalle}` dejaría
    // «SEGUNDO.- Los hechos concretos … son los siguientes:» colgando sin nada detrás — que es
    // exactamente el defecto que tuvo el cuadro de horas antes del `10b9ba9`, «el cuadro se quedaba
    // huérfano porque su rótulo lo ponía el motor».
    const html = componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, undefined);

    expect(html).not.toContain("SEGUNDO");
    expect(html).not.toContain("hechos concretos");
    expect(html).not.toContain(MARCADOR_DETALLE);
    expect(html).not.toContain("—");
  });

  it("PRIMERO y TERCERO siguen intactos: la omisión es quirúrgica", () => {
    const html = componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, undefined);

    expect(html).toContain("PRIMERO");
    expect(html).toContain("TERCERO");
    expect(html).toContain("Atentamente,");
  });

  it("un hecho de SOLO ESPACIOS es lo mismo que no haber escrito nada", () => {
    expect(componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, "   ")).toBe(
      componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, undefined),
    );
  });

  it("no deja una línea en blanco donde estaba el párrafo", () => {
    // Importa para que la salida sea determinista: es la que se compara con el fixture del backend.
    expect(
      componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, undefined),
    ).not.toMatch(/\n\n/);
  });
});

describe("componerEscritoExcusa — plantilla SIN la marca (la DAJ la borró)", () => {
  it("🔴 no se injerta nada y NO es un error: su presencia es la señal", () => {
    // Misma semántica que `MARCADOR_CUADRO` («sin marcador no hay cuadro»). La DAJ puede reescribir
    // el párrafo como quiera; si además quita la marca, el hecho concreto no se imprime. Eso es una
    // decisión suya sobre el texto, no un fallo del sistema, y por eso NO se avisa en pantalla.
    const sinMarca =
      "<p>Quito D.M., {Fecha}</p>\n<p>Yo, {Decisor}, sobre {Expediente}.</p>";

    expect(componerEscritoExcusa(sinMarca, CASO, CONTEXTO, HECHO)).toBe(
      "<p>Quito D.M., 16 de septiembre de 2026</p>\n" +
        "<p>Yo, ANDRÉS MIÑO CARRERA, sobre GADDMQ-AMC-DMIT-ZEE-2024-1764.</p>",
    );
  });

  it("sin marca, con hecho o sin él, el resultado es el MISMO: nada que injertar", () => {
    const sinMarca = "<p>Texto de la DAJ sobre {Expediente}.</p>";

    expect(componerEscritoExcusa(sinMarca, CASO, CONTEXTO, HECHO)).toBe(
      componerEscritoExcusa(sinMarca, CASO, CONTEXTO, undefined),
    );
  });

  it("una plantilla vacía no revienta la composición", () => {
    expect(componerEscritoExcusa("", CASO, CONTEXTO, HECHO)).toBe("");
  });
});

describe("componerEscritoExcusa — el hecho concreto se ESCAPA", () => {
  it("🔴 un hecho con `<` o `&` no se inyecta como etiqueta", () => {
    // Este HTML acaba en un PDF generado en el servidor. El conversor del backend ya es una lista
    // blanca —no hay superficie de XSS—, pero un hecho que rompa el marcado dejaría el escrito con
    // el texto desmontado: párrafos partidos, negritas que no cierran, frases que desaparecen. Y
    // sería en un acto administrativo.
    const html = componerEscritoExcusa(
      PLANTILLA,
      CASO,
      CONTEXTO,
      "Su abogado <b>me llamó</b> & me presionó",
    );

    expect(html).toContain(
      "Su abogado &lt;b&gt;me llamó&lt;/b&gt; &amp; me presionó",
    );
    // Lo que NO puede pasar: que la etiqueta entre viva en el documento.
    expect(html).not.toContain("<b>me llamó</b>");
  });

  it("el `&` se escapa ANTES que `<` y `>`: nada de doble escapado", () => {
    // Si el orden fuera el contrario, `<` se volvería `&lt;` y luego su `&` se re-escaparía a
    // `&amp;lt;`, y el PDF imprimiría «&lt;» literal donde debía verse «<».
    const html = componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, "a < b & c");

    expect(html).toContain("a &lt; b &amp; c");
    expect(html).not.toContain("&amp;lt;");
  });
});

describe("🔴 CONTRATO CON EL BACKEND", () => {
  it("con hecho, la salida es EXACTAMENTE el fixture `HTML_CON_DETALLE` del spec del backend", () => {
    expect(componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, HECHO)).toBe(
      HTML_CON_DETALLE,
    );
  });

  it("sin hecho, la salida es EXACTAMENTE el fixture `HTML_SIN_DETALLE` del spec del backend", () => {
    expect(componerEscritoExcusa(PLANTILLA, CASO, CONTEXTO, undefined)).toBe(
      HTML_SIN_DETALLE,
    );
  });
});
