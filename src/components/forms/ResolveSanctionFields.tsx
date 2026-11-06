/**
 * Microservicio: resolucion
 * Módulo: documentacion
 * Feature: Campos dinámicos de sanción por artículo/ordenanza
 * Archivo: ResolveSanctionFields.tsx
 * Responsabilidad: Renderizar filas de sanción con total calculado (DTO ResolveSanctionDataDto)
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-12
 */

import { useEffect } from "react";
import { Field, FieldArray, useFormikContext, type FieldProps } from "formik";
import type { DocumentFormValues } from "../../config/validationSchemas";
import type { IResolveSanctionItem } from "../../interfaces/IDocument";
import { NumberInput } from "./FormikField";
import Boton from "../common/Boton";

const EMPTY_SANCTION_ROW: IResolveSanctionItem = {
  ersaSanctionAmount: undefined,
  ersaArticle: undefined,
  ersaOrdinance: undefined,
};

/**
 * Función para sumar los montos de las sanción
 * @param sanctions - Array de sanción
 * @returns Total de los montos de las sanción
 */
const sumSanctionAmounts = (
  sanctions: IResolveSanctionItem[] | undefined,
): number =>
  (sanctions ?? []).reduce(
    (total, item) => total + (Number(item.ersaSanctionAmount) || 0),
    0,
  );

/**
 * Función para renderizar los campos del documento de resolución tipo sanción
 * @returns Componente de campos de sanción
 */
const ResolveSanctionFields = () => {
  // Obtener los valores del formulario y el campo de sanción
  const { values, setFieldValue } = useFormikContext<DocumentFormValues>();

  useEffect(() => {
    // Sumar los montos de las sanción
    const total = sumSanctionAmounts(
      values.ersaSanctions as IResolveSanctionItem[] | undefined,
    );

    // Si el total de las sanción es diferente al total del formulario, actualizar el total
    if (values.ersaTotalSanctionAmount !== total) {
      void setFieldValue("ersaTotalSanctionAmount", total);
    }
  }, [values.ersaSanctions, values.ersaTotalSanctionAmount, setFieldValue]);

  return (
    <div className="flex flex-col gap-4">
      <FieldArray name="ersaSanctions">
        {({ push, remove, form }) => {
          // Obtener las sanción del formulario
          const sanctions =
            (form.values.ersaSanctions as IResolveSanctionItem[] | undefined) ??
            [];

          // Renderizar los campos de sanción
          return (
            <>
              {sanctions.map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 rounded-lg border border-base-300 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-base-content/70">
                      Sanción {index + 1}
                    </span>

                    {sanctions.length > 1 && (
                      <Boton
                        deshabilitado={false}
                        estilos="btn btn-ghost btn-sm btn-circle text-error"
                        // icono="minus"
                        texto="-"
                        onClick={() => remove(index)}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field name={`ersaSanctions[${index}].ersaSanctionAmount`}>
                      {(props: FieldProps) => (
                        <NumberInput
                          {...props}
                          label="Monto de Sanción"
                          placeholder="Ej: 50000"
                          required
                        />
                      )}
                    </Field>

                    <Field name={`ersaSanctions[${index}].ersaArticle`}>
                      {(props: FieldProps) => (
                        <NumberInput
                          {...props}
                          label="Artículo"
                          placeholder="Ej: 45"
                          required
                        />
                      )}
                    </Field>

                    <Field name={`ersaSanctions[${index}].ersaOrdinance`}>
                      {(props: FieldProps) => (
                        <NumberInput
                          {...props}
                          label="Ordenanza"
                          placeholder="Ej: 211"
                          required
                        />
                      )}
                    </Field>
                  </div>
                </div>
              ))}

              <Boton
                deshabilitado={false}
                estilos="btn btn-outline btn-sm w-fit"
                texto="Agregar sanción"
                onClick={() => push({ ...EMPTY_SANCTION_ROW })}
              />
            </>
          );
        }}
      </FieldArray>

      <Field name="ersaTotalSanctionAmount">
        {(props: FieldProps) => (
          <NumberInput
            {...props}
            label="Total de Sanción"
            placeholder="0"
            disabled
          />
        )}
      </Field>
    </div>
  );
};

export default ResolveSanctionFields;
