/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: El despachador de la fila de filtros (Fase 03.19, Plan 06, D-09)
 * Archivo: FilterByColumn.tsx
 * Responsabilidad: Decidir QUÉ control de filtro le toca a cada columna —texto, catálogo o rango de
 *   fechas— según `column.columnDef.meta.filterType`, y escribir el resultado en el filtro de esa
 *   columna sin reescribirlo cuando no ha cambiado.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 *
 * ── DE DÓNDE VIENE, Y QUÉ ARREGLA RESPECTO DEL ANTERIOR ──────────────────────────────────────
 * Portado de `resolucion-frontend @ origin/dev — src/shared/components/tabla/FilterByColumn.tsx`.
 * Sustituye a la versión que había aquí, que sólo sabía pintar un cuadro de texto y que además
 * causaba, medida por el Plan 01, **una petición de más por cada columna filtrable en cada
 * montaje**: su `DebouncedInput` tenía un efecto sobre `[value]` que corría TAMBIÉN al montar, así
 * que medio segundo después de aparecer llamaba `column.setFilterValue("")`; TanStack devolvía un
 * array nuevo al quitar el filtro vacío y el efecto de carga de la tabla repetía la consulta.
 *
 * La versión de la rama lo corta por DOS sitios independientes, y por eso el arreglo es sólido:
 *   1. `lastDebouncedValueRef` — el debounce no emite si el valor no ha cambiado desde la última
 *      emisión, y al montar la referencia ya vale lo mismo que el valor inicial;
 *   2. `handleTextFilterChange` — compara con el filtro actual antes de escribirlo, y además
 *      traduce la cadena vacía a `undefined`, que es «quita el filtro» y no «filtra por nada».
 * (El tercer corte vive en `Table.tsx`, que compara filtros por clave normalizada y no por
 * identidad de array.)
 *
 * ── LO QUE SE LE AÑADE: EL NOMBRE ACCESIBLE (UI-SPEC §1.3 y §6/A6) ───────────────────────────
 * Ni el original ni la versión anterior daban nombre accesible a los controles: su único rótulo es
 * el `placeholder` «buscar...» o el flotante «Filtro», que es idéntico en las doce columnas de la
 * bandeja. Aquí cada control recibe `aria-label="Filtrar por {cabecera}"`, con la cabecera sacada
 * de `columnDef.header` cuando es texto y del id de la columna cuando no lo es — degradación
 * honesta: un id es feo pero distingue, y «Filtro» repetido doce veces no distingue nada.
 */

import type { Column } from "@tanstack/react-table";
import React, { useCallback, useEffect, useRef, useState } from "react";
import DateRangeFilterInput from "./DateRangeFilterInput";
import CatalogFilterInput from "./CatalogFilterInput";
import type { IDateRangeFilterValue } from "../../interfaces/ITableFilter";
import { isDateRangeFilterValue } from "../../utils/tableFilterParams.util";

type DebouncedInputProps = {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
};

const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: DebouncedInputProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) => {
  const [value, setValue] = useState(initialValue);
  const lastDebouncedValueRef = useRef<string | number>(initialValue);

  // Espeja el filtro cuando lo cambia ALGUIEN DE FUERA: la «X» de un badge de la barra de filtros
  // aplicados, o el botón que los limpia todos. Sin esto, el filtro se iría pero el cuadro seguiría
  // enseñando lo tecleado, que es peor que no tener barra.
  useEffect(() => {
    // La regla pide derivar en el render en vez de sincronizar con un efecto, y aquí no se puede:
    // mientras la persona teclea, el estado local y el filtro de la columna divergen A PROPÓSITO
    // durante el medio segundo del debounce. Derivarlo en el render borraría cada pulsación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(initialValue);
    lastDebouncedValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // 🔴 La guarda que mata la petición fantasma del montaje: si el valor no ha cambiado desde la
      // última emisión —y al montar no ha cambiado— no se emite nada.
      if (lastDebouncedValueRef.current === value) {
        return;
      }
      lastDebouncedValueRef.current = value;
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, debounce, onChange]);

  return (
    <label className="floating-label">
      <span>Filtro</span>
      <input
        {...props}
        className="app-data-table-filter-input input input-bordered w-full transition-all text-xs"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </label>
  );
};

/**
 * La cabecera legible de una columna, para construir el nombre accesible de su filtro. Cuando el
 * `header` no es texto —una función que pinta JSX— no hay nada legible que extraer sin renderizarlo,
 * así que se cae al id de la columna.
 */
const etiquetaDeColumna = (column: Column<object, unknown>): string => {
  const header = column.columnDef.header;
  return typeof header === "string" && header.trim() !== "" ? header : column.id;
};

const FilterByColumn = ({ column }: { column: Column<object, unknown> }) => {
  const columnFilterValue = column.getFilterValue();
  const filterType = column.columnDef.meta?.filterType ?? "text";
  const etiquetaColumna = etiquetaDeColumna(column);

  // 🔴 Los dos `useCallback` de abajo NO son cosmética: su resultado viaja como `onChange` a un
  // control con debounce, cuyo efecto depende de esa función. Si la identidad cambiara en cada
  // render, el temporizador se reiniciaría con ella y el filtro tardaría en salir —o no saldría—.
  //
  // El compilador de React no puede demostrar que se conserva la memoización porque el `column` de
  // TanStack es un objeto con métodos que mutan estado externo (`setFilterValue`). Es un aviso
  // sobre una OPTIMIZACIÓN que este proyecto ni siquiera aplica: el build usa
  // `@vitejs/plugin-react-swc` sin el compilador, así que aquí la regla no puede mejorar nada y sí
  // obligaría a quitar una memoización que hace falta.
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const handleTextFilterChange = useCallback(
    (nextValue: string | number) => {
      const normalized = String(nextValue).trim();
      // Cadena vacía ⇒ `undefined`: «quita el filtro», no «filtra por la cadena vacía». Lo segundo
      // acabaría en un `?expNumber=` que el DTO del backend rechaza con 400.
      const nextFilter = normalized === "" ? undefined : normalized;
      const currentFilter = column.getFilterValue();
      if (nextFilter === currentFilter) {
        return;
      }
      column.setFilterValue(nextFilter);
    },
    [column],
  );

  // Mismo motivo que el de arriba.
  const handleDateRangeFilterChange = useCallback(
    (nextValue: IDateRangeFilterValue | undefined) => {
      const currentFilter = column.getFilterValue();
      const currentRange = isDateRangeFilterValue(currentFilter)
        ? currentFilter
        : undefined;

      if (
        currentRange?.from === nextValue?.from &&
        currentRange?.to === nextValue?.to
      ) {
        return;
      }

      column.setFilterValue(nextValue);
    },
    [column],
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  if (filterType === "dateRange") {
    const dateRangeValue = isDateRangeFilterValue(columnFilterValue)
      ? columnFilterValue
      : undefined;

    return (
      <DateRangeFilterInput
        value={dateRangeValue}
        onChange={handleDateRangeFilterChange}
        etiquetaColumna={etiquetaColumna}
      />
    );
  }

  if (filterType === "catalog") {
    const catalogKey = column.columnDef.meta?.catalogKey;
    // Una columna marcada como catálogo pero sin catálogo no pinta control: es un error de
    // definición de columna, y pintar un cuadro de texto ahí lo escondería.
    if (!catalogKey) {
      return null;
    }

    return (
      <CatalogFilterInput
        column={column}
        catalogKey={catalogKey}
        etiquetaColumna={etiquetaColumna}
      />
    );
  }

  return (
    <div className="app-data-table-filter-cell">
      <DebouncedInput
        type="text"
        placeholder="buscar..."
        aria-label={`Filtrar por ${etiquetaColumna}`}
        onChange={handleTextFilterChange}
        value={(columnFilterValue ?? "") as string}
      />
    </div>
  );
};

export default FilterByColumn;
