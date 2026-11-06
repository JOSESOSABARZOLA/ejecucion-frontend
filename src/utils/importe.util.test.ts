/**
 * Microservicio: ejecucion
 * Módulo: utils — tests
 * Feature: SBU de ingreso manual por el ejecutor (quick 261105-cc7)
 * Archivo: importe.util.test.ts
 * Responsabilidad: Fijar que el parseador monetario lee el formato ecuatoriano (coma decimal, punto
 *   de miles) y que RECHAZA lo demás en vez de reinterpretarlo: «470.75» no puede volverse 47.075.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-05
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — formatearUsd con la MISMA tabla de
 *   casos que el del backend, el prefijo «USD» en el lector y la ida y vuelta pantalla → casilla)
 */
import { describe, expect, it } from "vitest";
import { formatearUsd, parsearImporte } from "./importe.util";

describe("parsearImporte (es-EC)", () => {
  it.each([
    ["470,75", 470.75],
    ["470", 470],
    ["470,7", 470.7],
    ["1.234", 1234],
    ["1.234,56", 1234.56],
    ["1234,56", 1234.56],
    ["$ 470,75", 470.75],
    ["  470,75  ", 470.75],
    ["1.234.567,8", 1234567.8],
    ["0", 0],
    // Lo que la pantalla enseña se puede pegar tal cual (quick 261105-cvq).
    ["USD 470,75", 470.75],
    ["usd 1.234,56", 1234.56],
    ["USD1.234,56", 1234.56],
  ])("«%s» ⇒ %d", (texto, esperado) => {
    expect(parsearImporte(texto)).toBe(esperado);
  });

  it.each([
    "470.75",
    "12.34",
    "470,755",
    "1,234.56",
    "-5",
    "abc",
    "",
    "   ",
    "1.23.4",
    "1.2345",
    ",50",
    "470,",
    "USD",
    "USD 470.75",
  ])("🔴 «%s» no es un importe en formato ecuatoriano ⇒ undefined", (texto) => {
    expect(parsearImporte(texto)).toBeUndefined();
  });
});

/**
 * La misma tabla que `importe-legal.util.spec.ts` del backend: pantalla y PDF tienen que decir lo
 * mismo carácter a carácter.
 */
describe("formatearUsd (espejo del backend)", () => {
  it.each([
    [2300, "USD 2.300,00"],
    [1840, "USD 1.840,00"],
    [460, "USD 460,00"],
    [470.75, "USD 470,75"],
    [0.5, "USD 0,50"],
    [1234567.89, "USD 1.234.567,89"],
    [230.999, "USD 231,00"],
    [5.678, "USD 5,68"],
    [0, "USD 0,00"],
    [Number.NaN, "USD 0,00"],
  ])("%d ⇒ «%s»", (valor, esperado) => {
    expect(formatearUsd(valor)).toBe(esperado);
  });

  it("el espacio tras «USD» es un espacio normal, no uno duro de Intl", () => {
    expect(formatearUsd(2300).charCodeAt(3)).toBe(32);
  });

  it.each([0, 0.5, 470.75, 2300, 1234567.89])(
    "ida y vuelta: parsearImporte(formatearUsd(%d)) devuelve el mismo valor",
    (valor) => {
      expect(parsearImporte(formatearUsd(valor))).toBe(valor);
    },
  );
});
