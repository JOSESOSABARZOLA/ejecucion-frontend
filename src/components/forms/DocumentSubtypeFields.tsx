/**
 * Microservicio: resolucion
 * Módulo: documentacion
 * Feature: Campos dinámicos por subtipo de documento
 * Archivo: DocumentSubtypeFields.tsx
 * Responsabilidad: Renderizar campos del registry según DocumentFieldDefinition
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-08
 */

import { Field, type FieldProps } from "formik";
import type { DocumentFieldDefinition } from "../../config/documentGenerationConfig";
import { NumberInput, TextAreaInput, TextInput } from "./FormikField";

interface DocumentSubtypeFieldsProps {
  fields: DocumentFieldDefinition[];
}

const DocumentSubtypeFields = ({
  fields,
}: DocumentSubtypeFieldsProps) => {
  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((fieldDef) => (
        <Field key={fieldDef.name} name={fieldDef.name}>
          {(props: FieldProps) => {
            if (fieldDef.kind === "number") {
              return (
                <NumberInput
                  {...props}
                  label={fieldDef.label}
                  placeholder={fieldDef.placeholder}
                />
              );
            }

            if (fieldDef.kind === "textarea") {
              return (
                <TextAreaInput
                  {...props}
                  label={fieldDef.label}
                  placeholder={fieldDef.placeholder}
                />
              );
            }

            return (
              <TextInput
                {...props}
                label={fieldDef.label}
                placeholder={fieldDef.placeholder}
              />
            );
          }}
        </Field>
      ))}
    </div>
  );
};

export default DocumentSubtypeFields;
