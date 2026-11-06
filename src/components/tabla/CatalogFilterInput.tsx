/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: El filtro de CATÁLOGO de la fila de filtros (Fase 03.19, Plan 06, D-09)
 * Archivo: CatalogFilterInput.tsx
 * Responsabilidad: Ofrecer las opciones cerradas de una columna —ESTATUS, catálogo local, y
 *   MATERIA, catálogo remoto— en un desplegable con apariencia de campo, y escribir la elegida en el
 *   filtro de esa columna.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-g35: lee también el `error` del hook.
 *   Si un catálogo remoto no se pudo cargar, el disparador dice «No disponible», queda apagado y
 *   explica el motivo en su `title`)
 *
 * ── DE DÓNDE VIENE ───────────────────────────────────────────────────────────────────────────
 * Portado de `resolucion-frontend @ origin/dev — src/shared/components/tabla/CatalogFilterInput.tsx`.
 * Se conserva su estructura y su lógica de selección, incluidas las dos guardas de igualdad que
 * evitan reescribir el filtro con el mismo valor (cada reescritura es una petición).
 *
 * Lo que se le AÑADE, por el UI-SPEC §1.3 y §6 (A2, A6, A12):
 *   · `aria-label="Filtrar por {columna}"` en el disparador. Sin él su nombre accesible sería
 *     «seleccione», que es lo mismo para las doce columnas;
 *   · al cerrar con `Escape`, el foco VUELVE al disparador. En el original el panel se cierra pero
 *     el foco se queda donde estaba, y quien navega con teclado acaba fuera de la tabla.
 *
 * Lo que se le AMPUTA:
 *   · los dos bloques comentados de «selección múltiple» (`toggleOption` y su `<label>` con
 *     casilla). Código muerto que el original arrastra; si un día hace falta, se escribe entonces —
 *     las convenciones de este repositorio piden retirar el código muerto, no comentarlo;
 *   · el `capitalize` del texto de cada opción. Las etiquetas de `estadosEpas.ts` son FRASES, no
 *     palabras sueltas, y ese `capitalize` convierte «En verificación de pago» en «En Verificación
 *     De Pago». En Resolución no se notaba porque allí las etiquetas son de una palabra.
 *
 * ── POR QUÉ UN RADIO Y NO UNA CASILLA ────────────────────────────────────────────────────────
 * El valor del filtro es un ARRAY —el backend lo consume con `= ANY($n::varchar[])`— pero hoy sólo
 * se elige UNA opción: `selectOption` sustituye la selección en vez de acumularla, y el panel se
 * cierra al elegir. El array se conserva porque es el contrato del DTO y porque es lo que permitirá
 * la selección múltiple sin tocar ni el servidor ni la serialización.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Column } from "@tanstack/react-table";
import { useTableCatalogOptions } from "../../hooks/useTableCatalogOptions";
import type {
  ICatalogOption,
  TableCatalogKey,
} from "../../interfaces/ITableCatalog";
import type { ICatalogFilterValue } from "../../interfaces/ITableFilter";

const areSelectionsEqual = (
  left: ICatalogFilterValue | undefined,
  right: ICatalogFilterValue,
): boolean => {
  if (!left) {
    return right.length === 0;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
};

const getTriggerLabel = (
  selectedValues: ICatalogFilterValue,
  options: ICatalogOption[],
  isLoading: boolean,
  hayError: boolean,
): string => {
  if (isLoading) {
    return "Cargando...";
  }

  // quick 261006-g35: un catálogo REMOTO que no se pudo cargar. Un desplegable apagado con
  // «seleccione» y sin motivo no se distingue de un catálogo vacío; la doctrina del módulo es
  // apagar CON su motivo (el detalle va en el `title` del disparador).
  if (hayError) {
    return "No disponible";
  }

  if (selectedValues.length === 0) {
    return "seleccione";
  }

  return selectedValues
    .map(
      (value) =>
        options.find((option) => option.value === value)?.label ?? value,
    )
    .join(", ");
};

type CatalogFilterInputProps = {
  column: Column<object, unknown>;
  catalogKey: TableCatalogKey;
  /** Cabecera de la columna. Sólo se usa para el nombre accesible del disparador. */
  etiquetaColumna: string;
};

const CatalogFilterInput = ({
  column,
  catalogKey,
  etiquetaColumna,
}: CatalogFilterInputProps) => {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { options, isLoading, error } = useTableCatalogOptions(catalogKey);
  const columnFilterValue = column.getFilterValue();
  // El `useMemo` no es optimización: `selectedValues` es dependencia de `selectOption`, y sin él el
  // array literal `[]` de la rama falsa sería NUEVO en cada render, así que el `useCallback` de
  // abajo no memoizaría nada. (El original de la rama lo deja sin memoizar.)
  const selectedValues = useMemo<ICatalogFilterValue>(
    () =>
      Array.isArray(columnFilterValue)
        ? (columnFilterValue as ICatalogFilterValue)
        : [],
    [columnFilterValue],
  );

  const applySelection = useCallback(
    (nextSelected: ICatalogFilterValue) => {
      const nextFilter = nextSelected.length === 0 ? undefined : nextSelected;
      const currentFilter = column.getFilterValue();

      if (
        nextFilter === undefined &&
        (currentFilter === undefined ||
          (Array.isArray(currentFilter) && currentFilter.length === 0))
      ) {
        return;
      }

      if (
        Array.isArray(currentFilter) &&
        nextFilter !== undefined &&
        areSelectionsEqual(currentFilter as ICatalogFilterValue, nextFilter)
      ) {
        return;
      }

      column.setFilterValue(nextFilter);
    },
    [column],
  );

  const selectOption = useCallback(
    (optionValue: string) => {
      const isSelected = selectedValues[0] === optionValue;
      const nextSelected = isSelected ? [] : [optionValue];

      applySelection(nextSelected);

      if (!isSelected) {
        setIsOpen(false);
      }
    },
    [applySelection, selectedValues],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        // A12: el foco vuelve a quien abrió el panel. Sin esta línea, cerrar con `Escape` deja el
        // foco en el `<body>` y el siguiente tabulador empieza otra vez por el principio de la
        // página, no por la columna siguiente.
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const triggerLabel = getTriggerLabel(
    selectedValues,
    options,
    isLoading,
    error !== null,
  );
  // Con error ya queda apagado: el hook entrega `options` vacío.
  const isDisabled = isLoading || options.length === 0;
  const motivoNoDisponible =
    error !== null
      ? `No se pudo cargar el catálogo de ${etiquetaColumna}. Recargue la página para reintentar.`
      : undefined;
  const hasSelection = selectedValues.length > 0;

  return (
    <div
      ref={containerRef}
      className="app-data-table-filter-cell app-data-table-filter-catalog"
    >
      <label className="floating-label w-full">
        <span>Filtro</span>
        <button
          ref={triggerRef}
          type="button"
          className={`app-data-table-filter-input app-data-table-filter-catalog-trigger input input-bordered w-full transition-all text-xs ${
            isOpen ? "input-primary" : ""
          }`}
          disabled={isDisabled}
          title={motivoNoDisponible}
          aria-label={`Filtrar por ${etiquetaColumna}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onClick={() => {
            if (!isDisabled) {
              setIsOpen((prev) => !prev);
            }
          }}
        >
          <span
            className={`app-data-table-filter-catalog-trigger-text truncate ${
              hasSelection
                ? ""
                : "app-data-table-filter-catalog-trigger-placeholder"
            }`}
          >
            {triggerLabel}
          </span>
        </button>
      </label>

      {isOpen && options.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-multiselectable="false"
          className="app-data-table-filter-catalog-panel rounded-2xl border border-base-300 bg-base-100 p-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        >
          {options.map((option) => {
            const isChecked = selectedValues.includes(option.value);

            return (
              <li key={option.value} role="option" aria-selected={isChecked}>
                <label className="app-data-table-filter-catalog-option flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-xs hover:bg-primary/5">
                  <input
                    type="radio"
                    name={`${listboxId}-catalog`}
                    className="radio radio-primary radio-xs"
                    checked={isChecked}
                    onChange={() => selectOption(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CatalogFilterInput;
