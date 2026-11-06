/**
 * Microservicio: ejecucion
 * Módulo: utils — tests
 * Feature: La base legal de cada infracción en la ficha (quick 261106-bo0)
 * Archivo: baseLegal.util.test.ts
 * Responsabilidad: Fijar el orden y las abreviaturas de la referencia legal, que salta las partes
 *   vacías, tolera `undefined` (backend sin desplegar) y no transforma los valores.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-06
 */
import { describe, expect, it } from "vitest";
import { referenciaLegal } from "./baseLegal.util";

describe("referenciaLegal", () => {
  it("los cuatro ⇒ «Art. 316, lit. a, sublit. i, num. 1»", () => {
    expect(
      referenciaLegal({
        articulo: "316",
        literal: "a",
        subliteral: "i",
        numeral: "1",
      }),
    ).toBe("Art. 316, lit. a, sublit. i, num. 1");
  });

  it("solo artículo y numeral ⇒ «Art. 316, num. 1»", () => {
    expect(
      referenciaLegal({
        articulo: "316",
        literal: null,
        subliteral: null,
        numeral: "1",
      }),
    ).toBe("Art. 316, num. 1");
  });

  it("solo literal ⇒ «lit. b»", () => {
    expect(referenciaLegal({ literal: "b" })).toBe("lit. b");
  });

  it("los cuatro null ⇒ null", () => {
    expect(
      referenciaLegal({
        articulo: null,
        literal: null,
        subliteral: null,
        numeral: null,
      }),
    ).toBeNull();
  });

  it("con undefined (backend sin desplegar) o solo espacios ⇒ null", () => {
    expect(referenciaLegal({})).toBeNull();
    expect(
      referenciaLegal({
        articulo: undefined,
        literal: "   ",
        subliteral: "",
        numeral: undefined,
      }),
    ).toBeNull();
  });

  it("recorta los espacios de cada parte", () => {
    expect(referenciaLegal({ articulo: " 316 " })).toBe("Art. 316");
    expect(referenciaLegal({ articulo: " 316 ", numeral: "  2" })).toBe(
      "Art. 316, num. 2",
    );
  });

  it("no transforma los valores (mayúsculas, puntos y guiones tal cual)", () => {
    expect(referenciaLegal({ articulo: "316-A", literal: "B." })).toBe(
      "Art. 316-A, lit. B.",
    );
  });
});
