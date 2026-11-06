/**
 * Microservicio: ejecucion
 * Módulo: utils — tests
 * Feature: Etiqueta de materia con el estado «Sin materia» (quick 261104-jh1)
 * Archivo: materia.util.test.ts
 * Responsabilidad: Fijar las cuatro combinaciones de nombres y flag, y el separador de submaterias.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-04
 */
import { describe, expect, it } from "vitest";
import { ETIQUETA_SIN_MATERIA, etiquetaConSinMateria } from "./materia.util";

describe("etiquetaConSinMateria", () => {
  it("con nombre y sin flag ⇒ solo el nombre", () => {
    expect(etiquetaConSinMateria("LICENCIAMIENTO", false)).toBe("LICENCIAMIENTO");
  });

  it("con nombre y flag ⇒ nombre / Sin materia", () => {
    expect(etiquetaConSinMateria("LICENCIAMIENTO", true)).toBe(
      "LICENCIAMIENTO / Sin materia",
    );
  });

  it("sin nombre y con flag ⇒ Sin materia", () => {
    expect(etiquetaConSinMateria(undefined, true)).toBe(ETIQUETA_SIN_MATERIA);
    expect(etiquetaConSinMateria(null, true)).toBe("Sin materia");
    expect(etiquetaConSinMateria("  ", true)).toBe("Sin materia");
  });

  it("sin nombre ni flag ⇒ —", () => {
    expect(etiquetaConSinMateria(undefined, false)).toBe("—");
    expect(etiquetaConSinMateria()).toBe("—");
  });

  it("acepta otro separador para las submaterias", () => {
    expect(etiquetaConSinMateria("LUAE, EDIFICACIÓN", true, ", ")).toBe(
      "LUAE, EDIFICACIÓN, Sin materia",
    );
  });
});
