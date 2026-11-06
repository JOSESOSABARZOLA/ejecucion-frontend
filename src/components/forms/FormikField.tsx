/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Componentes helper para campos de formulario con Formik
 * Archivo: FormikField.tsx
 * Responsabilidad: Proporcionar componentes reutilizables para inputs, selects y textareas
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-06
 */

import { getIn, type FieldProps } from "formik";
import React from "react";

interface BaseFieldProps extends FieldProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

interface SelectInputProps extends BaseFieldProps {
  options: Array<{ value: number | string; label: string }>;
  onValueChange?: (value: string) => void;
}

interface CheckboxInputProps extends FieldProps {
  label: string;
  disabled?: boolean;
}

/**
 * Campo de texto reutilizable
 * Incluye validación visual y mensajes de error
 */
export const TextInput: React.FC<BaseFieldProps> = ({
  field,
  form,
  label,
  placeholder,
  required = false,
  disabled = false,
  className = "",
}) => {
  const hasError =
    getIn(form.touched, field.name) && getIn(form.errors, field.name);
  const errorMessage = hasError ? (getIn(form.errors, field.name) as string) : "";

  return (
    <div className="app-modules-modal-field form-control w-full">
      <label className="label">
        <span className="app-modules-modal-label label-text font-medium">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </span>
      </label>
      <input
        {...field}
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        className={`app-modules-modal-input input input-bordered w-full transition-all ${
          hasError ? "input-error" : "focus:input-primary"
        } ${className}`}
        // className={`input input-bordered w-full transition-all ${
        //   hasError ? "input-error" : "focus:input-primary"
        // } ${className}`}
      />
      {hasError && (
        <label className="label">
          <span className="label-text-alt text-error">{errorMessage}</span>
        </label>
      )}
    </div>
  );
};

/**
 * Campo numérico
 */
export const NumberInput: React.FC<BaseFieldProps> = ({
  field,
  form,
  label,
  placeholder,
  required = false,
  disabled = false,
  className = "",
}) => {
  const hasError =
    getIn(form.touched, field.name) && getIn(form.errors, field.name);
  const errorMessage = hasError ? (getIn(form.errors, field.name) as string) : "";

  return (
    <div className="app-modules-modal-field form-control w-full">
      <label className="label">
        <span className="app-modules-modal-label label-text font-medium">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </span>
      </label>
      <input
        {...field}
        type="number"
        placeholder={placeholder}
        disabled={disabled}
        className={`app-modules-modal-input input input-bordered w-full transition-all ${
          hasError ? "input-error" : "focus:input-primary"
        } ${className}`}
      />
      {hasError && (
        <label className="label">
          <span className="label-text-alt text-error">{errorMessage}</span>
        </label>
      )}
    </div>
  );
};

/**
 * Campo de email
 */
export const EmailInput: React.FC<BaseFieldProps> = ({
  field,
  form,
  label,
  placeholder,
  required = false,
  disabled = false,
  className = "",
}) => {
  const hasError =
    getIn(form.touched, field.name) && getIn(form.errors, field.name);
  const errorMessage = hasError ? (getIn(form.errors, field.name) as string) : "";

  return (
    <div className="app-modules-modal-field form-control w-full">
      <label className="label">
        <span className="app-modules-modal-label label-text font-medium">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </span>
      </label>
      <input
        {...field}
        type="email"
        placeholder={placeholder}
        disabled={disabled}
        className={`app-modules-modal-input input input-bordered w-full transition-all ${
          hasError ? "input-error" : "focus:input-primary"
        } ${className}`}
      />
      {hasError && (
        <label className="label">
          <span className="label-text-alt text-error">{errorMessage}</span>
        </label>
      )}
    </div>
  );
};

/**
 * Campo de teléfono
 */
export const PhoneInput: React.FC<BaseFieldProps> = ({
  field,
  form,
  label,
  placeholder,
  required = false,
  disabled = false,
  className = "",
}) => {
  const hasError =
    getIn(form.touched, field.name) && getIn(form.errors, field.name);
  const errorMessage = hasError ? (getIn(form.errors, field.name) as string) : "";

  return (
    <div className="app-modules-modal-field form-control w-full">
      <label className="label">
        <span className="app-modules-modal-label label-text font-medium">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </span>
      </label>
      <input
        {...field}
        type="tel"
        placeholder={placeholder}
        disabled={disabled}
        className={`app-modules-modal-input input input-bordered w-full transition-all ${
          hasError ? "input-error" : "focus:input-primary"
        } ${className}`}
      />
      {hasError && (
        <label className="label">
          <span className="label-text-alt text-error">{errorMessage}</span>
        </label>
      )}
    </div>
  );
};

/**
 * Campo de fecha
 */
export const DateInput: React.FC<BaseFieldProps> = ({
  field,
  form,
  label,
  required = false,
  disabled = false,
  className = "",
}) => {
  const hasError =
    getIn(form.touched, field.name) && getIn(form.errors, field.name);
  const errorMessage = hasError ? (getIn(form.errors, field.name) as string) : "";

  return (
    <div className="app-modules-modal-field form-control w-full">
      <label className="label">
        <span className="app-modules-modal-label label-text font-medium">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </span>
      </label>
      <input
        {...field}
        type="date"
        disabled={disabled}
        value={
          field.value instanceof Date
            ? field.value.toISOString().split("T")[0]
            : field.value || ""
        }
        onChange={(e) => {
          const date = e.target.value ? new Date(e.target.value) : null;
          form.setFieldValue(field.name, date);
        }}
        className={`app-modules-modal-input input input-bordered w-full transition-all ${
          hasError ? "input-error" : "focus:input-primary"
        } ${className}`}
      />
      {hasError && (
        <label className="label">
          <span className="label-text-alt text-error">{errorMessage}</span>
        </label>
      )}
    </div>
  );
};

/**
 * Campo de selección (select)
 */


export const SelectInput: React.FC<SelectInputProps> = ({
  field,
  form,
  label,
  required = false,
  disabled = false,
  options,
  className = "",
  onValueChange,
}) => {
  const hasError =
    getIn(form.touched, field.name) && getIn(form.errors, field.name);
  const errorMessage = hasError ? (getIn(form.errors, field.name) as string) : "";

  const handleBlur = () => {
    form.setFieldTouched(field.name, true);
  };

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    field.onChange(event);
    onValueChange?.(event.target.value);
  };

  return (
    <div className="app-modules-modal-field form-control w-full">
      <label className="label">
        <span className="app-modules-modal-label label-text font-medium">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </span>
      </label>
      <select
        // {...field}
        // name={field.name}
        // id={field.name}
        // disabled={disabled}
        name={field.name}
        id={field.name}
        value={field.value || ""}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className={`app-modules-modal-input select select-bordered w-full transition-all ${
          hasError ? "select-error" : "focus:select-primary"
        } ${className}`}
      >
        <option value="">Seleccionar...</option>

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
      {hasError && (
        <label className="label">
          <span className="label-text-alt text-error">{errorMessage}</span>
        </label>
      )}
    </div>
  );
};

/**
 * Campo de textarea
 */
export const TextAreaInput: React.FC<BaseFieldProps> = ({
  field,
  form,
  label,
  placeholder,
  required = false,
  disabled = false,
  className = "",
}) => {
  const hasError =
    getIn(form.touched, field.name) && getIn(form.errors, field.name);
  const errorMessage = hasError ? (getIn(form.errors, field.name) as string) : "";

  return (
    <div className="app-modules-modal-field form-control w-full">
      <label className="label">
        <span className="app-modules-modal-label label-text font-medium">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </span>
      </label>
      <textarea
        {...field}
        placeholder={placeholder}
        disabled={disabled}
        className={`app-modules-modal-input textarea textarea-bordered w-full transition-all ${
          hasError ? "textarea-error" : "focus:textarea-primary"
        } ${className}`}
        rows={3}
      />
      {hasError && (
        <label className="label">
          <span className="label-text-alt text-error">{errorMessage}</span>
        </label>
      )}
    </div>
  );
};

/**
 * Campo Checkbox
 */


export const CheckboxInput: React.FC<CheckboxInputProps> = ({
  field,
  label,
  disabled = false,
}) => {
  return (
    <div className="form-control">
      <label className="label cursor-pointer">
        <input
          {...field}
          type="checkbox"
          disabled={disabled}
          checked={field.value}
          className="checkbox checkbox-primary"
        />
        <span className="label-text font-semibold ml-2">{label}</span>
      </label>
    </div>
  );
};
