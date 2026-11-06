/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Multiselect con select nativo
 * Archivo: MultiSelect.tsx
 * Responsabilidad: Renderizar un selector múltiple nativo con estilos del sistema
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-22
 */
import { useCallback, useId, type ChangeEvent, type FC } from "react";

type MultiSelectProps = {
  options: readonly string[];
  value: string[];
  onChange: (selected: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const MultiSelect: FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = "Seleccionar...",
  disabled = false,
  className = "",
}) => {
  const selectId = useId();
  const hintId = `${selectId}-hint`;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(
        event.target.selectedOptions,
        (option) => option.value,
      );
      onChange(selected);
    },
    [onChange],
  );

  return (
    <div className={`w-full min-w-0 ${className}`.trim()}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-base-content/80" htmlFor={selectId}>
          {label}
        </label>
      )}

      <div className="app-multiselect-field p-1">
        <select
          id={selectId}
          multiple
          disabled={disabled}
          value={value}
          size={options.length}
          aria-label={label ?? placeholder}
          aria-describedby={hintId}
          onChange={handleChange}
          // className="app-multiselect"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <p id={hintId} className="app-multiselect-hint">
        Mantén Ctrl o Cmd para seleccionar varios correos.
      </p>
    </div>
  );
};

export default MultiSelect;
