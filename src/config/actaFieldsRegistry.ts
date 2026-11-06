/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: SLOT declarativo de los CAMPOS del acta D2 (captura del secretario) — RECE-05 / FEND-03, Fase 3.5
 * Archivo: actaFieldsRegistry.ts
 * Responsabilidad: Ser la ÚNICA fuente de verdad de QUÉ campos captura el secretario en el acta D2. Todo
 *   —los inputs del formulario, los valores iniciales, las filas de revisión, el esquema Yup y el blob
 *   `datos` que persiste `SorteoService.actaDatos`— DERIVA de la lista `ACTA_FIELDS`. Es un SLOT
 *   PARAMETRIZABLE: rellenar la lista EXACTA de PRO-GEJ-001 (HUMAN-VERIFY, Plan 06/UAT) se hace SOLO aquí,
 *   sin tocar el modal (`ModalActaDatos`), el servicio ni el backend (que guarda un jsonb AGNÓSTICO de
 *   campos, Plan 01/02). Por eso el modal itera `ACTA_FIELDS` en vez de codificar campos concretos.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-24
 */
import * as Yup from "yup";

/** Tipo de control con el que se renderiza un campo del acta (tokens daisyUI en el modal). */
export type ActaFieldKind = "text" | "textarea";

/**
 * DEFINICIÓN de UN campo del acta. `name` es la clave literal con la que viaja el valor dentro del blob
 * `datos` (agnóstico): el backend no interpreta estas claves, solo las persiste y las reimprime.
 */
export interface ActaFieldDefinition {
  /** Clave del campo dentro del blob `datos` y del formulario Formik. */
  name: string;
  /** Control de captura: input de una línea o área de texto. */
  kind: ActaFieldKind;
  /** Etiqueta humana (formulario y filas de revisión). */
  label: string;
  /** Placeholder opcional del control. */
  placeholder?: string;
  /** Si el campo es OBLIGATORIO para confirmar (se refleja en el esquema Yup). */
  required?: boolean;
  /** Valor inicial del campo (prellenado). Si se omite, arranca como cadena vacía. */
  defaultValue?: string;
  /** Patrón opcional de FORMATO (p. ej. numérico o HH:mm); vacío siempre pasa (excludeEmptyString). */
  pattern?: RegExp;
  /** Mensaje del error de formato cuando `pattern` no casa. */
  patternMessage?: string;
}

/** Valores del formulario del acta: cada `name` de `ACTA_FIELDS` mapeado a un string. */
export type ActaFormValues = Record<string, string>;

/** Una fila del paso de revisión (etiqueta + valor ya formateado). */
export interface ActaReviewRow {
  label: string;
  value: string;
}

/**
 * Campos REALES que captura el secretario en el acta D2 (formato oficial, Excel `docs/sorteo-expediente.xlsx`).
 * Estos cuatro son los ÚNICOS datos que NO se derivan automáticamente: el consecutivo del acta (NRO ...-S),
 * el del memorando de custodia (...-M), el lugar de suscripción y la hora del sorteo. El resto del acta
 * (fecha larga, cantidad y su forma en letras, año, nombres, columnas de la tabla) lo arma el backend.
 * Cambiar SOLO este array reconfigura todo el flujo cliente: inputs, initialValues, reviewRows, esquema Yup
 * y el blob `datos`. NO hace falta tocar el modal; el backend guarda el blob AGNÓSTICO y la capa de
 * presentación del acta (acta-sorteo.service) coloca estas claves en su sitio del formato oficial.
 */
export const ACTA_FIELDS: ActaFieldDefinition[] = [
  {
    name: "numeroActa",
    kind: "text",
    label: "Nro. de acta (consecutivo -S)",
    placeholder: "Ej: 0042",
    required: true,
    pattern: /^\d+$/,
    patternMessage: "El Nro. de acta debe ser numérico",
  },
  {
    name: "numeroMemorandoCustodia",
    kind: "text",
    label: "Nro. de memorando de custodia (-M)",
    placeholder: "Ej: 0100",
    required: true,
    pattern: /^\d+$/,
    patternMessage: "El Nro. de memorando debe ser numérico",
  },
  {
    name: "lugar",
    kind: "text",
    label: "Lugar de suscripción",
    placeholder: "Ej: Quito D.M.",
    defaultValue: "Quito D.M.",
    required: true,
  },
  {
    name: "hora",
    kind: "text",
    label: "Hora del sorteo (HH:mm)",
    placeholder: "Ej: 11:06",
    required: true,
    pattern: /^([01]\d|2[0-3]):[0-5]\d$/,
    patternMessage: "La hora debe tener formato HH:mm",
  },
];

/**
 * Valores iniciales derivados de `ACTA_FIELDS`: cada `name` arranca con su `defaultValue` (p. ej. `lugar`
 * prellena "Quito D.M.") o cadena vacía si no lo define.
 */
export const ACTA_INITIAL_VALUES: ActaFormValues = ACTA_FIELDS.reduce(
  (acc, field) => {
    acc[field.name] = field.defaultValue ?? "";
    return acc;
  },
  {} as ActaFormValues,
);

/**
 * Filas del paso de revisión: UNA por campo de `ACTA_FIELDS`, con el valor capturado o `-` si vacío.
 * No inventa campos: espeja exactamente la lista declarada.
 */
export const actaReviewRows = (values: ActaFormValues): ActaReviewRow[] =>
  ACTA_FIELDS.map((field) => ({
    label: field.label,
    value: (values[field.name] ?? "").trim() || "-",
  }));

/**
 * Esquema Yup construido a partir de `ACTA_FIELDS`: cada campo es `string().trim()`, y `required()` si el
 * field lo marca. Espeja el DTO server-side (que además revalida bajo whitelist): la validación cliente es
 * conveniencia, no autoridad (T-3.5-02).
 */
export const actaValidationSchema = Yup.object().shape(
  ACTA_FIELDS.reduce<Record<string, Yup.StringSchema>>((shape, field) => {
    let schema = Yup.string().trim();
    if (field.required) {
      schema = schema.required(`${field.label} es requerido`);
    }
    if (field.pattern) {
      // Un valor vacío NO dispara el formato (lo cubre `required` si aplica): solo se valida el formato
      // cuando el usuario escribió algo.
      schema = schema.matches(field.pattern, {
        message: field.patternMessage ?? `${field.label} no tiene el formato esperado`,
        excludeEmptyString: true,
      });
    }
    shape[field.name] = schema;
    return shape;
  }, {}),
);

/**
 * ADAPTER: mapea los valores del formulario al blob `datos` que consume `SorteoService.actaDatos`. Es el
 * ÚNICO punto de transformación form→persistencia (hoy identidad tras `trim`); si en el futuro un campo
 * debe serializarse distinto, se cambia SOLO aquí. El backend guarda el blob agnóstico tal cual.
 */
export const toActaDatosPayload = (
  values: ActaFormValues,
): Record<string, unknown> =>
  ACTA_FIELDS.reduce<Record<string, unknown>>((payload, field) => {
    payload[field.name] = (values[field.name] ?? "").trim();
    return payload;
  }, {});
