/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: El filtro de RANGO DE FECHAS de la fila de filtros (Fase 03.19, Plan 06, D-09)
 * Archivo: DateRangeFilterInput.tsx
 * Responsabilidad: Pedir un «desde» y un «hasta» y entregarlos ya normalizados —o `undefined`— al
 *   filtro de su columna, sin dejar que un rango invertido salga hacia el servidor.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 *
 * ── DE DÓNDE VIENE ───────────────────────────────────────────────────────────────────────────
 * Portado de `resolucion-frontend @ origin/dev — src/shared/components/tabla/DateRangeFilterInput.tsx`.
 * La lógica es la suya, línea por línea. Lo que se le AÑADE es la accesibilidad que el UI-SPEC §1.3
 * y §6 (A6, A7) exigen y que el original no tiene:
 *   · nombre accesible en cada campo (`Filtrar por {columna}: desde` / `: hasta`). El `placeholder`
 *     de un `<input type="date">` no es nombre accesible, y el rótulo flotante «Desde»/«Hasta» no
 *     dice de qué columna es: con doce columnas filtrables, un lector de pantalla anunciaría doce
 *     «Desde» idénticos;
 *   · `aria-invalid` en los DOS campos cuando el rango está invertido, y `aria-describedby`
 *     apuntando al texto del error, para que el mensaje se anuncie en vez de solo verse.
 *
 * ── POR QUÉ «HASTA» NO EXISTE HASTA QUE HAY «DESDE» ──────────────────────────────────────────
 * Conducta del original que se conserva: la celda de filtro es estrecha y dos campos de fecha no
 * caben cómodos. Un «hasta» sin «desde» tampoco es un rango que este filtro sepa expresar.
 *
 * ── POR QUÉ EL RANGO INVERTIDO NO SE MANDA ───────────────────────────────────────────────────
 * `normalizeRange` devuelve `undefined` cuando `from > to`, y el efecto ni siquiera llama a
 * `onChange`: se queda enseñando el error. Mandarlo produciría una consulta vacía que el usuario
 * leería como «no hay expedientes» en vez de como «se equivocó al teclear».
 */

import { useEffect, useId, useRef, useState } from "react";
import type { IDateRangeFilterValue } from "../../interfaces/ITableFilter";

type DateRangeFilterInputProps = {
  value: IDateRangeFilterValue | undefined;
  onChange: (value: IDateRangeFilterValue | undefined) => void;
  /** Cabecera de la columna. Sólo se usa para construir el nombre accesible de los dos campos. */
  etiquetaColumna: string;
  debounce?: number;
};

const normalizeRange = (
  range: IDateRangeFilterValue,
): IDateRangeFilterValue | undefined => {
  const from = range.from?.trim() || undefined;
  const to = range.to?.trim() || undefined;

  if (!from && !to) {
    return undefined;
  }

  if (from && to && from > to) {
    return undefined;
  }

  return { from, to };
};

const areRangesEqual = (
  left: IDateRangeFilterValue | undefined,
  right: IDateRangeFilterValue | undefined,
): boolean => left?.from === right?.from && left?.to === right?.to;

const DateRangeFilterInput = ({
  value,
  onChange,
  etiquetaColumna,
  debounce = 500,
}: DateRangeFilterInputProps) => {
  const idError = useId();
  const [from, setFrom] = useState(value?.from ?? "");
  const [to, setTo] = useState(value?.to ?? "");
  const [isInvalidRange, setIsInvalidRange] = useState(false);
  const lastDebouncedValueRef = useRef<IDateRangeFilterValue | undefined>(
    value,
  );

  const showToInput = from.trim() !== "";

  // Sincroniza con el filtro cuando lo cambia ALGUIEN DE FUERA: la «X» de un badge de la barra de
  // filtros aplicados o el botón que los limpia todos. Sin esto, el filtro se iría pero los dos
  // campos seguirían enseñando las fechas, que es peor que no tener barra.
  useEffect(() => {
    // Mismo caso que el cuadro de texto de `FilterByColumn`: la regla pide derivar en el render, y
    // aquí no se puede porque durante el medio segundo del debounce el estado local y el filtro de
    // la columna divergen a propósito. Derivarlo borraría la fecha a medio escribir.
    /* eslint-disable react-hooks/set-state-in-effect */
    setFrom(value?.from ?? "");
    setTo(value?.to ?? "");
    setIsInvalidRange(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    lastDebouncedValueRef.current = value;
  }, [value]);

  const handleFromChange = (nextFrom: string) => {
    setFrom(nextFrom);
    if (!nextFrom.trim()) {
      setTo("");
      setIsInvalidRange(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextRange = normalizeRange({ from, to });

      if (from && to && from > to) {
        setIsInvalidRange(true);
        return;
      }

      setIsInvalidRange(false);

      if (areRangesEqual(lastDebouncedValueRef.current, nextRange)) {
        return;
      }

      lastDebouncedValueRef.current = nextRange;
      onChange(nextRange);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [from, to, debounce, onChange]);

  return (
    <div className="app-data-table-filter-date-range">
      <label className="floating-label">
        <span>Desde</span>
        <input
          type="date"
          aria-label={`Filtrar por ${etiquetaColumna}: desde`}
          aria-invalid={isInvalidRange}
          aria-describedby={isInvalidRange ? idError : undefined}
          className={`app-data-table-filter-input input input-bordered w-full transition-all text-xs ${
            isInvalidRange ? "input-error" : ""
          }`}
          value={from}
          onChange={(event) => handleFromChange(event.target.value)}
        />
      </label>
      {showToInput && (
        <label className="floating-label">
          <span>Hasta</span>
          <input
            type="date"
            aria-label={`Filtrar por ${etiquetaColumna}: hasta`}
            aria-invalid={isInvalidRange}
            aria-describedby={isInvalidRange ? idError : undefined}
            className={`app-data-table-filter-input input input-bordered w-full transition-all text-xs ${
              isInvalidRange ? "input-error" : ""
            }`}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      )}
      {isInvalidRange && showToInput && (
        // `role="alert"` para que el error se anuncie al aparecer: el texto sale medio segundo
        // después de teclear, cuando el foco ya no tiene por qué estar en el campo.
        <span
          id={idError}
          role="alert"
          className="app-data-table-filter-date-range-error"
        >
          La fecha «Desde» es posterior a la fecha «Hasta».
        </span>
      )}
    </div>
  );
};

export default DateRangeFilterInput;
