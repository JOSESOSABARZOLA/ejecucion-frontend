/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend) — tests
 * Feature: Basarse en un documento anterior (Fase 03.19, Plan 15 · D-04)
 * Archivo: similarDocumentImport.util.test.ts
 * Responsabilidad: Fijar con aserciones ejecutables las tres conductas de la importación que, si se
 *   rompen, no se notan hasta que alguien firma un acto administrativo sin formato.
 *
 *   1. 🔴 UN VALOR QUE YA ES HTML VUELVE IDÉNTICO. Es la aserción de IGUALDAD ESTRICTA, y es la
 *      razón de ser del archivo: si alguien «normaliza» el contenido de camino al editor, la
 *      providencia importada pierde negrita, títulos y listas, y el decisor ve el mismo texto que
 *      escribió pero SIN formato. La guarda de arquitectura de la fase vigila que no entre ninguna
 *      pieza que degrade HTML a texto; ésta vigila que la pieza que SÍ entró no lo haga.
 *   2. El texto plano se reparte en párrafos, porque el editor no sabe qué hacer con saltos de
 *      línea sueltos y los colapsa en un solo bloque.
 *   3. Un valor vacío produce cadena vacía y NO una etiqueta huérfana (`<p></p>`): un párrafo vacío
 *      cuenta como contenido para el editor y haría creer al paso 2 que ya hay algo redactado.
 *
 *   Y la cuarta, que el plan 05 exige por escrito: ANTES de importar se mira la versión del
 *   contenido almacenado. Una versión que este cliente no conoce no se importa «a ver qué sale».
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 */

import { describe, it, expect } from "vitest";
import {
  VERSION_CONTENIDO_SOPORTADA,
  esContenidoImportable,
  fusionarSeccionesImportadas,
  importarSeccionesDeProvidencia,
  toEditorHtml,
} from "./similarDocumentImport.util";
import type { ProvidenciaDocStructure } from "../services/ProvidenciaService";

/** Contenido almacenado por el backend (plan 05): `version`, `tipoCodigo` y las secciones. */
const estructura = (
  parcial: Partial<ProvidenciaDocStructure> = {},
): ProvidenciaDocStructure => ({
  version: VERSION_CONTENIDO_SOPORTADA,
  tipoCodigo: "ARCHIVO_POR_PAGO_O_CONVENIO_DE_PAGO",
  secciones: [{ clave: "cuerpo", html: "<p>Contenido</p>" }],
  ...parcial,
});

describe("toEditorHtml — lo que ya es HTML se respeta entero", () => {
  it("🔴 devuelve IDÉNTICO un valor que ya trae etiquetas de negrita y lista", () => {
    // Igualdad ESTRICTA, no «contiene»: una comprobación laxa pasaría en verde aunque la utilidad
    // reenvolviera el valor, reordenara atributos o le añadiera un párrafo por fuera — y cualquiera
    // de esas tres cosas cambia lo que se imprime en el PDF del acto administrativo.
    const html =
      "<p><strong>PRIMERO:</strong> se dispone el archivo.</p>" +
      "<ul><li>Primer ítem</li><li>Segundo ítem</li></ul>";

    expect(toEditorHtml(html)).toBe(html);
  });

  it("no toca las entidades ni la acentuación de un valor con etiquetas", () => {
    const html = "<p>Notificación &amp; archivo — año 2026</p>";

    expect(toEditorHtml(html)).toBe(html);
  });

  it("reparte en DOS párrafos un texto plano con dos bloques separados", () => {
    const plano = "Primer bloque de texto.\n\nSegundo bloque de texto.";

    expect(toEditorHtml(plano)).toBe(
      "<p>Primer bloque de texto.</p><p>Segundo bloque de texto.</p>",
    );
  });

  it("un valor vacío produce cadena vacía, NUNCA una etiqueta huérfana", () => {
    // `<p></p>` pasaría por contenido: el paso 2 creería que ya hay algo redactado y pediría
    // confirmación para reemplazar un cuerpo que en realidad está en blanco.
    expect(toEditorHtml("")).toBe("");
    expect(toEditorHtml("   \n\n  ")).toBe("");
  });
});

describe("importarSeccionesDeProvidencia — la versión se mira ANTES de importar", () => {
  it("importa la sección del cuerpo conservando sus etiquetas", () => {
    const html = "<p><em>Considerando</em> lo actuado.</p>";

    expect(
      importarSeccionesDeProvidencia(estructura({
        secciones: [{ clave: "cuerpo", html }],
      }), ["cuerpo"]),
    ).toEqual({ cuerpo: html });
  });

  it("🔴 NO importa nada de un contenido con una versión que este cliente no conoce", () => {
    // El plan 05 puso `version` justamente para esto: distinguir un contenido que se entiende de
    // uno que no, en vez de adivinarlo por las claves que se encuentren. Importar a ciegas una
    // versión futura metería en el editor un cuerpo con otra semántica sin avisar a nadie.
    const futuro = estructura({ version: VERSION_CONTENIDO_SOPORTADA + 1 });

    expect(esContenidoImportable(futuro)).toBe(false);
    expect(importarSeccionesDeProvidencia(futuro, ["cuerpo"])).toEqual({});
  });

  it("sin contenido almacenado no importa nada y no revienta", () => {
    expect(esContenidoImportable(undefined)).toBe(false);
    expect(importarSeccionesDeProvidencia(undefined, ["cuerpo"])).toEqual({});
  });

  it("una sección en blanco no se importa: no hay nada que traer", () => {
    expect(
      importarSeccionesDeProvidencia(
        estructura({ secciones: [{ clave: "cuerpo", html: "   " }] }),
        ["cuerpo"],
      ),
    ).toEqual({});
  });

  it("ignora las claves de sección que este módulo no conoce", () => {
    // La providencia de Ejecución es UNA sección («cuerpo»). Si algún día llega un contenido con
    // más, se toma lo que se sabe colocar y no se inventa dónde va el resto.
    expect(
      importarSeccionesDeProvidencia(
        estructura({
          secciones: [
            { clave: "cuerpo", html: "<p>Sí</p>" },
            { clave: "antecedentes", html: "<p>No</p>" },
          ],
        }),
        ["cuerpo"],
      ),
    ).toEqual({ cuerpo: "<p>Sí</p>" });
  });
});

describe("fusionarSeccionesImportadas", () => {
  it("lo importado pisa lo que había en esa misma clave y deja el resto intacto", () => {
    expect(
      fusionarSeccionesImportadas(
        { cuerpo: "<p>Lo viejo</p>", otra: "<p>Ajena</p>" },
        { cuerpo: "<p>Lo importado</p>" },
      ),
    ).toEqual({ cuerpo: "<p>Lo importado</p>", otra: "<p>Ajena</p>" });
  });

  it("no muta el objeto que recibe", () => {
    const actual = { cuerpo: "<p>Lo viejo</p>" };

    fusionarSeccionesImportadas(actual, { cuerpo: "<p>Lo importado</p>" });

    expect(actual).toEqual({ cuerpo: "<p>Lo viejo</p>" });
  });
});
