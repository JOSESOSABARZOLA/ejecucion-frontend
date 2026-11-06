/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Esquemas de validación para formularios
 * Archivo: validationSchemas.ts
 * Responsabilidad: Centralizar esquemas de validación con Yup
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-06
 */

import * as Yup from "yup";

/**
 * Esquema de validación para el formulario de expediente
 * Define las reglas de validación para cada campo del expediente
 */
export const caseValidationSchema = Yup.object().shape({
  // Datos del expediente
  expNumber: Yup.string()
    .required("El número de expediente es requerido")
    .min(3, "El número debe tener al menos 3 caracteres"),

  // caseResolveIdentification: Yup.string()
  //   .required("El número de resolución es requerido")
  //   .min(3, "El número debe tener al menos 3 caracteres"),

  eresStatus: Yup.string()
    .required("El estado del expediente es requerido")
    .oneOf(
      ["pendiente", "resuelto", "apelado", "archivado"],
      "El estado seleccionado no es válido",
    ),

  // eresPenalty: Yup.number()
  //   .required("El monto de la sanción es requerido")
  //   .positive("La sanción debe ser un número positivo"),

  eresArticle: Yup.number()
    .required("El artículo es requerido")
    .positive("El artículo debe ser un número positivo"),

  eresFojas: Yup.number()
    .required("El número de folios es requerido")
    .positive("El número de folios debe ser positivo"),

  expZone: Yup.string()
    .required("La zona es requerida")
    .min(2, "La zona debe estar especificada"),

  eresMedidaCautelar: Yup.string().nullable().default(""),

  eresHasAppeal: Yup.boolean().default(false),

  eresIsactive: Yup.boolean().default(true),

  // Fechas
  eresIncomeAt: Yup.date()
    .required("La fecha de ingreso es requerida")
    .typeError("La fecha debe ser válida"),

  eresResolveAt: Yup.date().nullable().typeError("La fecha debe ser válida"),

  eresResolveUntil: Yup.date().nullable().typeError("La fecha debe ser válida"),

  // Datos del administrado
  admiName: Yup.string()
    .required("El nombre es requerido")
    .min(2, "El nombre debe tener al menos 2 caracteres"),

  admiLastname: Yup.string()
    .required("El apellido es requerido")
    .min(2, "El apellido debe tener al menos 2 caracteres"),

  admiBusinessName: Yup.string().nullable().default(""),

  admiIdentification: Yup.string()
    .required("La cédula es requerida")
    .min(6, "La cédula debe ser válida"),

  admiTelephone: Yup.string()
    .required("El teléfono es requerido")
    .min(7, "El teléfono debe ser válido"),

  admiEmail: Yup.string()
    .required("El email es requerido")
    .email("El email debe ser válido"),

  admiAddress: Yup.string()
    .required("La dirección es requerida")
    .min(10, "La dirección debe ser más específica"),

  admiJudicialLocker: Yup.string().nullable().default(""),
});

/**
 * Esquema de validación para documentos
 * Define las reglas de validación para cada campo del documento
 */
export const documentValidationSchema = Yup.object().shape({
  file: Yup.mixed<File>().nullable().optional(),

  // docId: Yup.number()
  //   .nullable()
  //   .optional()
  //   .positive("El ID del documento debe ser un número positivo")
  //   .integer("El ID debe ser un número entero"),

  tdocType: Yup.string()
    .required("El tipo de documento es requerido")
    .min(2, "El tipo debe tener al menos 2 caracteres"),

  // eresId: Yup.number()
  //   .required("El ID ERES es requerido")
  //   .positive("El ID ERES debe ser un número positivo")
  //   .integer("El ID ERES debe ser un número entero"),

  docName: Yup.string()
    .nullable()
    .optional()
    .min(2, "El nombre debe tener al menos 2 caracteres"),

  docSize: Yup.number().min(0, "El tamaño no puede ser negativo").optional(),

  docUploadedAt: Yup.date()
    .nullable()
    .optional()
    .typeError("La fecha debe ser válida"),

  docUploadedBy: Yup.string()
    .nullable()
    .optional()
    .min(2, "El usuario debe tener al menos 2 caracteres"),

  // docIsActive: Yup.boolean().default(true),

  docUrl: Yup.string().nullable().optional().url("La URL debe ser válida"),

  docObservacion: Yup.string().nullable().optional(),

  tsdocId: Yup.number().when("tdocType", {
    is: (value: string) => Boolean(value && value.trim() !== ""),
    then: (schema) =>
      schema
        .required("Debe seleccionar un subtipo de documento")
        .positive("El subtipo debe ser válido"),
    otherwise: (schema) => schema.nullable().optional(),
  }),

  tsdocSubtype: Yup.string().when("tdocType", {
    is: (value: string) => Boolean(value && value.trim() !== ""),
    then: (schema) =>
      schema.required("Debe seleccionar un subtipo de documento"),
    otherwise: (schema) => schema.nullable().optional(),
  }),

  // epexDaysAdded: Yup.number().when("tsdocSubtype", {
  //   is: (value: string) => value === "extensionTerm",
  //   then: (schema) =>
  //     schema
  //       .required("Los días agregados son requeridos")
  //       .typeError("Debe ser un número válido")
  //       .positive("Debe ser un número positivo"),
  //   otherwise: (schema) => schema.nullable().optional(),
  // }),

  // epexNewDeadline: Yup.string().when("tsdocSubtype", {
  //   is: (value: string) => value === "extensionTerm",
  //   then: (schema) =>
  //     schema.required("La nueva fecha límite es requerida").min(1, "Ingrese una fecha"),
  //   otherwise: (schema) => schema.nullable().optional(),
  // }),

  epexReason: Yup.string().when("tsdocSubtype", {
    is: (value: string) => value === "extensionTerm",
    then: (schema) =>
      schema
        .required("El motivo es requerido")
        .min(2, "El motivo es muy corto"),
    otherwise: (schema) => schema.nullable().optional(),
  }),

  ersaSanctions: Yup.array().when("tsdocSubtype", {
    is: (value: string) => value === "sancion",
    then: (schema) =>
      schema
        .of(
          Yup.object({
            ersaSanctionAmount: Yup.number()
              .required("Campo requerido")
              .typeError("Debe ser un número válido")
              .positive("Debe ser un número positivo")
              .max(999999999, "Monto muy alto"),
            ersaArticle: Yup.number()
              .required("El artículo es requerido")
              .typeError("Debe ser un número válido")
              .positive("Debe ser un número positivo"),
            ersaOrdinance: Yup.number()
              .required("La ordenanza es requerida")
              .typeError("Debe ser un número válido")
              .positive("Debe ser un número positivo"),
          }),
        )
        .min(1, "Debe ingresar al menos una sanción"),
    otherwise: (schema) => schema.optional(),
  }),

  ersaTotalSanctionAmount: Yup.number().when("tsdocSubtype", {
    is: (value: string) => value === "sancion",
    then: (schema) =>
      schema
        .typeError("Debe ser un número válido")
        .min(0, "El total no puede ser negativo"),
    otherwise: (schema) => schema.nullable().optional(),
  }),
});

export type CaseFormValues = Yup.InferType<typeof caseValidationSchema>;
export type DocumentFormValues = Yup.InferType<typeof documentValidationSchema>;
