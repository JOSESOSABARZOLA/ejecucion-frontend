/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/comun (frontend)
 * Feature: La fecha corta de la tarjeta de despacho (Fase 03.20, §2.5.2 del contrato de UI)
 * Archivo: datetime.util.test.ts
 * Responsabilidad: Fijar el formato LITERAL de la captura —`10 sept 2026`— y, de paso, poner la
 *   primera red bajo `formatDate` y `formatFechaLarga`, que hasta hoy no tenían ninguna prueba y
 *   son el espejo del backend: si divergen, dos papeles del mismo expediente llevan la fecha en
 *   formatos distintos y nadie lo ve hasta tenerlos los dos delante.
 *
 *   ── 🔴 POR QUÉ NO SE AFIRMA CONTRA `Intl` ────────────────────────────────────────────────────
 *   El analog de Resolución formatea con el conversor a texto local del objeto de
 *   internacionalización del runtime, que depende del ICU: el mismo código da una cadena distinta
 *   según con qué Node se ejecute y según cómo se haya compilado. Aquí se formatea con `date-fns`,
 *   que lleva sus propias tablas y es determinista —también en jsdom, que es donde estas
 *   aserciones viven—.
 *
 *   ⚠️ El nombre de ese conversor NO se escribe en ninguna parte de este archivo ni del que
 *   prueba: hay una puerta que comprueba por texto que no ha vuelto, y una puerta que casa con su
 *   propia explicación no es una puerta.
 *
 *   ⚠️ Las fechas se construyen con el constructor de tres números (año, mes, día), NO con una
 *   cadena ISO: una cadena ISO se interpreta en UTC y en una zona a -05:00 devolvería el día
 *   anterior. Esta prueba mediría entonces la zona horaria de quien la corre.
 *
 *   Unidad pura: no monta interfaz, no llama a servicios.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-25
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11: `formatFechaHoraCorta`, la fecha
 *   CON hora de cada línea del sello «Firmado» —`26 oct 2026, 15:40`—, con la misma tabla de
 *   abreviaturas que la corta y la misma salida vacía sin fecha).
 */
import { describe, it, expect } from "vitest";
import { DatetimeUtil } from "./datetime.util";

/** 10 de septiembre de 2026, en hora local. Es la fecha de la tarjeta de la captura. */
const DIEZ_DE_SEPTIEMBRE = new Date(2026, 8, 10);
/** 17 de septiembre de 2026: la de la tarjeta de correo de la misma captura. */
const DIECISIETE_DE_SEPTIEMBRE = new Date(2026, 8, 17);

describe("DatetimeUtil.formatFechaCorta — el formato de la tarjeta de despacho", () => {
  it("un 10 de septiembre de 2026 produce «10 sept 2026»", () => {
    expect(DatetimeUtil.formatFechaCorta(DIEZ_DE_SEPTIEMBRE)).toBe("10 sept 2026");
  });

  it("un 17 de septiembre de 2026 produce «17 sept 2026»", () => {
    expect(DatetimeUtil.formatFechaCorta(DIECISIETE_DE_SEPTIEMBRE)).toBe(
      "17 sept 2026",
    );
  });

  it("acepta la cadena que llega del servidor, no sólo un objeto de fecha", () => {
    expect(DatetimeUtil.formatFechaCorta("2026-09-10T15:30:00")).toBe(
      "10 sept 2026",
    );
  });

  it("🔴 una fecha ausente produce CADENA VACÍA, nunca «Sin fecha»", () => {
    // La tarjeta simplemente no pinta la meta: una palabra ahí ocuparía el sitio de un dato que no
    // existe. Es el mismo criterio que `formatTimeAgo`, que devuelve nulo en vez de texto.
    expect(DatetimeUtil.formatFechaCorta(undefined)).toBe("");
    expect(DatetimeUtil.formatFechaCorta(null)).toBe("");
    expect(DatetimeUtil.formatFechaCorta("")).toBe("");
  });

  it("una fecha inválida también produce cadena vacía, en vez de reventar la tarjeta", () => {
    expect(DatetimeUtil.formatFechaCorta("no-soy-una-fecha")).toBe("");
  });

  it("los doce meses salen con la abreviatura de la captura", () => {
    // Se afirman los doce porque la abreviatura de septiembre es la ÚNICA de cuatro letras y es
    // justo la de la captura: escribir sólo esa dejaría sin red a las otras once.
    const abreviaturas = Array.from({ length: 12 }, (_, mes) =>
      DatetimeUtil.formatFechaCorta(new Date(2026, mes, 1)),
    );

    expect(abreviaturas).toEqual([
      "1 ene 2026",
      "1 feb 2026",
      "1 mar 2026",
      "1 abr 2026",
      "1 may 2026",
      "1 jun 2026",
      "1 jul 2026",
      "1 ago 2026",
      "1 sept 2026",
      "1 oct 2026",
      "1 nov 2026",
      "1 dic 2026",
    ]);
  });
});

describe("DatetimeUtil — regresión de los dos formatos que ya existían", () => {
  it("`formatDate` sigue en dd/MM/yyyy: es el de la columna FECHA CREACIÓN", () => {
    // 🔴 Los dos formatos CONVIVEN a propósito, porque los dos están en la captura: la columna es
    // densa y se escanea en vertical, la tarjeta es prosa. No se unifican.
    expect(DatetimeUtil.formatDate(DIEZ_DE_SEPTIEMBRE)).toBe("10/09/2026");
  });

  it("`formatDate` sin fecha sigue diciendo «Sin fecha», y eso NO cambia", () => {
    expect(DatetimeUtil.formatDate(null)).toBe("Sin fecha");
    expect(DatetimeUtil.formatDate(undefined)).toBe("Sin fecha");
  });

  it("`formatFechaLarga` sigue siendo el espejo del backend, con el mes entero", () => {
    expect(DatetimeUtil.formatFechaLarga(DIEZ_DE_SEPTIEMBRE)).toBe(
      "10 de septiembre de 2026",
    );
  });

  it("`formatTimeAgo` sigue devolviendo nulo sin fecha, que es de donde sale el criterio", () => {
    expect(DatetimeUtil.formatTimeAgo(null)).toBeNull();
  });
});

describe("DatetimeUtil.formatFechaHoraCorta — la constancia de la firma (Fase 03.21, UI-SPEC §8.1)", () => {
  it("un 26 de octubre de 2026 a las 15:40 produce «26 oct 2026, 15:40»", () => {
    expect(
      DatetimeUtil.formatFechaHoraCorta(new Date(2026, 9, 26, 15, 40)),
    ).toBe("26 oct 2026, 15:40");
  });

  it("una cadena ISO sin zona —que se lee en hora LOCAL— da lo mismo", () => {
    // Sin `Z` ni desfase la cadena se interpreta en hora local: así la prueba no mide la zona
    // horaria de quien la corre.
    expect(DatetimeUtil.formatFechaHoraCorta("2026-10-26T15:40:00")).toBe(
      "26 oct 2026, 15:40",
    );
  });

  it("la hora va en 24 h y con dos cifras: las 09:05 no salen «9:5» ni «9:05 a. m.»", () => {
    expect(
      DatetimeUtil.formatFechaHoraCorta(new Date(2026, 8, 3, 9, 5)),
    ).toBe("3 sept 2026, 09:05");
  });

  it("sin fecha o con una inválida devuelve lo MISMO que `formatFechaCorta`: cadena vacía", () => {
    expect(DatetimeUtil.formatFechaHoraCorta(null)).toBe(
      DatetimeUtil.formatFechaCorta(null),
    );
    expect(DatetimeUtil.formatFechaHoraCorta(undefined)).toBe("");
    expect(DatetimeUtil.formatFechaHoraCorta("")).toBe("");
    expect(DatetimeUtil.formatFechaHoraCorta("no-soy-una-fecha")).toBe("");
  });
});
