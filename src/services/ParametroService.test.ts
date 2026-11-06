/**
 * Microservicio: ejecucion
 * Módulo: Parámetros del módulo (DME)
 * Feature: Los plazos de las alertas en la pantalla de Parámetros (quick 261030-m29)
 * Archivo: ParametroService.test.ts
 * Responsabilidad: Fijar que los mapas de la pantalla cubren los tres plazos que se cuentan en días
 *   HÁBILES —el término de alegación, que faltaba, y los dos de las alertas— con su etiqueta y una
 *   sola unidad, espejo de `UNIDADES_POR_CLAVE` del backend y del CHECK de la tabla.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-04
 */
import { describe, it, expect } from "vitest";
import {
  ETIQUETA_PARAMETRO,
  ETIQUETA_UNIDAD,
  UNIDADES_POR_CLAVE,
  type ParametroClave,
} from "./ParametroService";

const HABILES: ParametroClave[] = [
  "PLAZO_ALEGACION_INFORME",
  "PLAZO_ORDEN_PAGO",
  "AVISO_PREVIO_TRABAJO_COMUNITARIO",
];

describe("ParametroService — los plazos en días hábiles (quick 261030-m29)", () => {
  it("las tres claves en HÁBILES tienen esa unidad y solo esa", () => {
    for (const clave of HABILES) {
      expect(UNIDADES_POR_CLAVE[clave]).toEqual(["HABILES"]);
    }
  });

  it("y su etiqueta", () => {
    expect(ETIQUETA_PARAMETRO.PLAZO_ALEGACION_INFORME).toBe(
      "Término de alegación al informe de verificación",
    );
    expect(ETIQUETA_PARAMETRO.PLAZO_ORDEN_PAGO).toBe(
      "Plazo para registrar la orden de pago",
    );
    expect(ETIQUETA_PARAMETRO.AVISO_PREVIO_TRABAJO_COMUNITARIO).toBe(
      "Aviso previo del vencimiento del trabajo comunitario",
    );
  });

  it("«hábiles» ya descuenta los feriados del calendario del módulo", () => {
    expect(ETIQUETA_UNIDAD.HABILES).toBe(
      "días hábiles (sin fines de semana ni feriados)",
    );
  });

  it("solo esas tres admiten HÁBILES; los otros dos plazos siguen en CALENDARIO", () => {
    const conHabiles = (Object.keys(UNIDADES_POR_CLAVE) as ParametroClave[])
      .filter((clave) => UNIDADES_POR_CLAVE[clave].includes("HABILES"))
      .sort();
    expect(conHabiles).toEqual([...HABILES].sort());
    expect(UNIDADES_POR_CLAVE.PLAZO_ACEPTACION_SORTEO).toEqual(["CALENDARIO"]);
    expect(UNIDADES_POR_CLAVE.PLAZO_EXTENSION_TERMINO).toEqual(["CALENDARIO"]);
  });
});
