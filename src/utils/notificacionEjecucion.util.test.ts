/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: El Gestor de Notificaciones (Fase 03.20) — la fórmula del anillo, D-16
 * Archivo: notificacionEjecucion.util.test.ts
 * Responsabilidad: Bloquear con aserciones EJECUTABLES la divergencia consciente respecto de
 *   Resolución, que es lo único que un «copia funcionamiento» borraría sin que nada se pusiera
 *   rojo: `getDespachosCompletionPercentage` de Resolución cuenta SÓLO `notificado`, y Ejecución
 *   tiene un tercer estado —`rechazado`— que es un despacho RESUELTO. La vía se agotó, su razón de
 *   imposibilidad está emitida y los plazos arrancan igual. Con la fórmula literal, un expediente
 *   con sus tres vías agotadas saldría 0 % EN ROJO: exactamente lo contrario de lo ocurrido.
 *
 *   Por eso la prueba de `rechazado` tiene nombre propio y va marcada: es la que fija D-16.
 *
 *   ── LO QUE ESTE ARCHIVO NO PRUEBA ────────────────────────────────────────────────────────────
 *   No prueba el anillo. `RadialProgress` ya existe y no se toca; y el caso de CERO despachos —que
 *   es el normal hoy: 156 de 157 administrados no tienen ninguna forma aceptada— no lo decide esta
 *   función, que devuelve 0 por compatibilidad aritmética, sino el consumidor, que NO debe pintar
 *   anillo. Eso lo prueba el plan que monta la celda.
 *
 *   Unidad pura: no monta interfaz, no llama a servicios, no toca la red.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-25
 */
import { describe, it, expect } from "vitest";
import {
  ESTADOS_DESPACHO_RESUELTOS,
  ETIQUETA_FORMA_TARJETA,
  ORDEN_FORMAS_NOTIFICACION,
  porcentajeDespachosResueltos,
} from "./notificacionEjecucion.util";

/** Atajo: la función sólo mira `estado`, así que el fixture es exactamente eso. */
const despachos = (...estados: string[]) => estados.map((estado) => ({ estado }));

describe("porcentajeDespachosResueltos — la fórmula del anillo (Fase 03.20, D-16)", () => {
  it("con la lista vacía devuelve 0", () => {
    expect(porcentajeDespachosResueltos([])).toBe(0);
  });

  it("dos notificados de tres son 67: se redondea", () => {
    // Es la aritmética de la captura, fila 4: Pendiente + Notificado + Notificado → naranja.
    expect(
      porcentajeDespachosResueltos(
        despachos("pendiente", "notificado", "notificado"),
      ),
    ).toBe(67);
  });

  it("tres de tres son 100", () => {
    expect(
      porcentajeDespachosResueltos(
        despachos("notificado", "notificado", "notificado"),
      ),
    ).toBe(100);
  });

  it("cero de dos son 0", () => {
    expect(porcentajeDespachosResueltos(despachos("pendiente", "pendiente"))).toBe(
      0,
    );
  });

  it("🔴 un despacho RECHAZADO cuenta como resuelto (D-16): uno de cada tres son 67", () => {
    // LA prueba de esta fase. Con la fórmula de Resolución esto daría 33 y el anillo saldría rojo
    // sobre un expediente en el que dos de las tres vías ya están cerradas.
    expect(
      porcentajeDespachosResueltos(
        despachos("notificado", "rechazado", "pendiente"),
      ),
    ).toBe(67);
  });

  it("🔴 tres rechazados de tres son 100, no 0: las tres vías se agotaron", () => {
    // El caso que hace visible el daño: un expediente con todas sus vías cerradas y su razón de
    // imposibilidad emitida saldría «0 %, en rojo, nadie ha hecho nada» con la fórmula literal.
    expect(
      porcentajeDespachosResueltos(
        despachos("rechazado", "rechazado", "rechazado"),
      ),
    ).toBe(100);
  });

  it("el estado escrito en MAYÚSCULAS cuenta igual: la comparación no distingue caja", () => {
    expect(
      porcentajeDespachosResueltos(despachos("NOTIFICADO", "Rechazado")),
    ).toBe(100);
  });

  it("un estado desconocido no cuenta como resuelto", () => {
    expect(
      porcentajeDespachosResueltos(despachos("notificado", "zzz-no-existe")),
    ).toBe(50);
  });

  it("los estados que cuentan como resueltos son exactamente dos", () => {
    expect(ESTADOS_DESPACHO_RESUELTOS).toEqual(["notificado", "rechazado"]);
  });
});

describe("El orden y los rótulos de las tres formas (Fase 03.20, §2.2 del contrato de UI)", () => {
  it("el orden de las tres formas es FIJO y no depende de los datos", () => {
    expect(ORDEN_FORMAS_NOTIFICACION).toEqual(["CASILLERO", "FISICO", "CORREO"]);
  });

  it("los rótulos de la TARJETA son los de la captura, en mayúsculas de título", () => {
    expect(ETIQUETA_FORMA_TARJETA).toEqual({
      CASILLERO: "Casillero Judicial",
      FISICO: "Dirección Física",
      CORREO: "Correo Electrónico",
    });
  });
});
