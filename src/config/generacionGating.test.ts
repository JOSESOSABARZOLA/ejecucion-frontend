/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/generacion-documento (frontend)
 * Feature: La puerta de pasos de la página de generación, con la salida 3 → 4 (quick 261026-ft2)
 * Archivo: generacionGating.test.ts
 * Responsabilidad: Fijar qué cierra la salida de cada paso: el tipo y su prueba en el 1, el cuerpo
 *   en el 2 y, desde este quick, un canal de notificación MARCADO sin su dato en el 3. Sin ninguna
 *   forma marcada el 3 sigue libre (D-12). La precedencia de los motivos no cambia: el primero que
 *   falta, desde el principio.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 */
import { describe, expect, it } from "vitest";
import {
  motivoParaAvanzar,
  motivoParaLlegarA,
  topeDeLasPuertas,
  type CondicionesAvance,
} from "./generacionGating";

const EN_REGLA: CondicionesAvance = {
  tipoElegido: true,
  cuerpoConContenido: true,
};

describe("motivoParaAvanzar — la salida del paso 3", () => {
  it("sin canal incompleto (incluso sin ninguna forma) 3 → 4 es libre", () => {
    expect(
      motivoParaAvanzar(3, { ...EN_REGLA, motivoFormas: undefined }),
    ).toBeUndefined();
  });

  it("con un canal marcado sin su dato devuelve ese motivo", () => {
    expect(motivoParaAvanzar(3, { ...EN_REGLA, motivoFormas: "X" })).toBe("X");
  });
});

describe("motivoParaLlegarA — acumulado desde el principio", () => {
  it("al 4 lo cierra el motivo de formas; al 3 no", () => {
    const condiciones: CondicionesAvance = { ...EN_REGLA, motivoFormas: "X" };
    expect(motivoParaLlegarA(4, condiciones)).toBe("X");
    expect(motivoParaLlegarA(3, condiciones)).toBeUndefined();
  });

  it("la precedencia sigue intacta: tipo, prueba y cuerpo van antes que las formas", () => {
    expect(
      motivoParaLlegarA(4, {
        tipoElegido: false,
        cuerpoConContenido: true,
        motivoFormas: "X",
      }),
    ).toBe("Elija el tipo de providencia para continuar.");
    expect(
      motivoParaLlegarA(4, {
        tipoElegido: true,
        cuerpoConContenido: false,
        motivoFormas: "X",
      }),
    ).toBe("Escriba el cuerpo de la providencia para continuar.");
    expect(
      motivoParaLlegarA(4, {
        ...EN_REGLA,
        motivoPrueba: "Adjunte el comprobante.",
        motivoFormas: "X",
      }),
    ).toBe("Adjunte el comprobante.");
  });
});

describe("topeDeLasPuertas — el techo de lo alcanzable", () => {
  it("3 con el motivo de formas y lo demás en regla; 4 sin él", () => {
    expect(topeDeLasPuertas({ ...EN_REGLA, motivoFormas: "X" })).toBe(3);
    expect(topeDeLasPuertas(EN_REGLA)).toBe(4);
  });

  it("1 o 2 cuando una salida anterior ya está cerrada", () => {
    expect(
      topeDeLasPuertas({
        tipoElegido: false,
        cuerpoConContenido: true,
        motivoFormas: "X",
      }),
    ).toBe(1);
    expect(
      topeDeLasPuertas({
        tipoElegido: true,
        cuerpoConContenido: false,
        motivoFormas: "X",
      }),
    ).toBe(2);
  });
});
