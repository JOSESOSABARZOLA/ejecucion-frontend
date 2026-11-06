/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: Unidad pura del SLOT declarativo del acta D2 (actaFieldsRegistry) — RECE-05/FEND-03, Fase 3.5
 * Archivo: actaFieldsRegistry.test.ts
 * Responsabilidad: Fijar con aserciones EJECUTABLES el CONTRATO del slot: que initialValues, reviewRows, el
 *   adapter `toActaDatosPayload` y el esquema Yup DERIVAN de la única lista `ACTA_FIELDS` (parametrizable).
 *   Blinda que rellenar la lista exacta de PRO-GEJ-001 en un solo archivo reconfigura todo el flujo sin
 *   tocar el modal ni el servicio. No monta React ni hace red: ejerce solo funciones puras.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-24
 */
import { describe, it, expect } from "vitest";
import {
  ACTA_FIELDS,
  ACTA_INITIAL_VALUES,
  actaReviewRows,
  actaValidationSchema,
  toActaDatosPayload,
  type ActaFormValues,
} from "./actaFieldsRegistry";

describe("actaFieldsRegistry (slot declarativo del acta D2)", () => {
  it("ACTA_INITIAL_VALUES tiene una clave por cada ACTA_FIELDS[].name, con su defaultValue o ''", () => {
    const keys = Object.keys(ACTA_INITIAL_VALUES);
    expect(keys).toHaveLength(ACTA_FIELDS.length);
    for (const field of ACTA_FIELDS) {
      expect(ACTA_INITIAL_VALUES).toHaveProperty(
        field.name,
        field.defaultValue ?? "",
      );
    }
  });

  it("actaReviewRows devuelve una fila por campo con el value capturado o '-'", () => {
    // Parte de TODO vacío para ejercer el fallback '-' de los campos sin defaultValue.
    const empty: ActaFormValues = ACTA_FIELDS.reduce((acc, f) => {
      acc[f.name] = "";
      return acc;
    }, {} as ActaFormValues);
    const first = ACTA_FIELDS[0].name;
    const values: ActaFormValues = { ...empty, [first]: "  0042  " };

    const rows = actaReviewRows(values);
    expect(rows).toHaveLength(ACTA_FIELDS.length);
    // Espeja el orden/labels de ACTA_FIELDS.
    expect(rows.map((r) => r.label)).toEqual(ACTA_FIELDS.map((f) => f.label));
    // El campo capturado se muestra trim; los vacíos caen a '-'.
    expect(rows[0].value).toBe("0042");
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].value).toBe("-");
    }
  });

  it("toActaDatosPayload produce el blob esperado (identidad tras trim, una clave por campo)", () => {
    const first = ACTA_FIELDS[0].name;
    const values: ActaFormValues = {
      ...ACTA_INITIAL_VALUES,
      [first]: "  valor con espacios  ",
    };

    const payload = toActaDatosPayload(values);
    expect(Object.keys(payload).sort()).toEqual(
      ACTA_FIELDS.map((f) => f.name).sort(),
    );
    expect(payload[first]).toBe("valor con espacios");
  });

  it("actaValidationSchema RECHAZA un value vacío en un campo requerido", async () => {
    const requiredField = ACTA_FIELDS.find((f) => f.required);
    // La lista provisional debe traer al menos un requerido para ejercer la validación.
    expect(requiredField).toBeDefined();

    const invalid: ActaFormValues = {
      ...ACTA_INITIAL_VALUES,
      [requiredField!.name]: "   ",
    };

    await expect(actaValidationSchema.validate(invalid)).rejects.toThrow();
  });

  it("actaValidationSchema ACEPTA valores completos y con el formato esperado", async () => {
    const values: ActaFormValues = { ...ACTA_INITIAL_VALUES };
    for (const field of ACTA_FIELDS) {
      if (!field.required) continue;
      // Respeta el patrón del campo (numérico / HH:mm) si lo declara; si no, texto libre.
      values[field.name] = field.pattern
        ? field.pattern.source.includes(":")
          ? "11:06"
          : "0042"
        : "valor válido";
    }

    await expect(
      actaValidationSchema.validate(values),
    ).resolves.toBeDefined();
  });

  it("actaValidationSchema RECHAZA un value que no casa el formato (pattern) del campo", async () => {
    const patternField = ACTA_FIELDS.find((f) => f.pattern);
    // La lista real debe traer al menos un campo con formato (numérico/HH:mm) para ejercerlo.
    expect(patternField).toBeDefined();

    const invalid: ActaFormValues = { ...ACTA_INITIAL_VALUES };
    // Completa TODOS los requeridos con formato válido…
    for (const field of ACTA_FIELDS) {
      if (!field.required) continue;
      invalid[field.name] = field.pattern
        ? field.pattern.source.includes(":")
          ? "11:06"
          : "0042"
        : "valor válido";
    }
    // …y rompe SOLO el campo con formato con un valor que no casa.
    invalid[patternField!.name] = "no-formato";

    await expect(actaValidationSchema.validate(invalid)).rejects.toThrow();
  });
});
