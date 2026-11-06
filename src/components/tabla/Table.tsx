/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: La tabla ÚNICA del módulo (Fase 03.19, Plan 06, D-01 / D-02 / D-09)
 * Archivo: Table.tsx
 * Responsabilidad: Pintar cualquier conjunto de datos paginado y filtrado POR EL SERVIDOR: pide las
 *   filas, ofrece una fila de filtros por columna, enseña qué filtros hay puestos y monta el
 *   paginado. No sabe nada del dominio: todo lo que conoce se lo pasan por props.
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-09-25 (Fase 03.20, Plan 02, C5 del contrato de UI: una prop
 *   OPCIONAL, `etiquetaFilaExpandible`, para que la página pueda NOMBRAR el disparador de
 *   expansión. Se pinta con un `Boton` de solo icono y hasta hoy iba sin nombre: un lector de
 *   pantalla lo anuncia literalmente «botón», diez veces por página. Es el mismo defecto que el
 *   Plan 08 de la 03.19 arregló en la columna ACCIONES. Sin la prop cae a «Expandir fila» /
 *   «Contraer fila», así que es ADITIVA y ninguna pantalla anterior cambia —y hoy no hay ninguna:
 *   `isExpandible` no tiene ni un consumidor—. 🔴 No se toca nada más de la columna de expansión:
 *   ni su ancho, ni su interruptor de filtro, ni sus iconos, ni el realce de abierta.)
 * Modificado por: Andrés Miño — 2026-09-25 (Fase 03.22, Plan 08, gap 3 del UAT: el realce al pasar
 *   el ratón SALE del marcado. Vivía aquí como un utilitario del color de marca al 5 % —es decir,
 *   CON canal alfa— que SUSTITUÍA al zebra opaco; las celdas fijas heredan el fondo de su `<tr>`, así
 *   que al pasar el ratón se volvían translúcidas y dejaban ver el contenido que se desplazaba por
 *   detrás. Ahora la fila de datos lleva la clase `app-data-table-row` y el realce lo pinta
 *   `tables.css` como una CAPA DE IMAGEN encima del color. 🔴 El zebra por paridad se queda aquí y no
 *   se toca: la paridad SÓLO la sabe React —la fila expandida es otro `<tr>` del mismo `<tbody>` y
 *   desplaza la paridad de todas las de abajo—, así que el CSS no puede recalcularla.)
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 07, gap 2 del UAT: `meta.pinnedLeft`,
 *   el espejo de `meta.pinnedRight`. Los TRES puntos donde se traducía el interruptor de la derecha
 *   pasan por un único ayudante, `claseDeColumnaFijada`, que deja la regla en un solo sitio. 🔴 El
 *   bloque fijado a la izquierda son DOS columnas: la de numeración la antepone ESTA tabla y va
 *   delante, así que lidera pegada al borde y la declarada por la página va detrás, desplazada por
 *   su ancho. Es OPT-IN: sin `pinnedLeft` no se emite ninguna clase nueva y ninguna de las cuatro
 *   pantallas anteriores cambia.)
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 17, UI-SPEC §5.1: dos props OPCIONALES
 *   —`vacioSinFiltros` y `vacioConFiltros`— para que la pantalla que monta la tabla pueda nombrar lo
 *   que falta. El defecto es el texto de antes, byte a byte: ninguna de las cuatro pantallas
 *   anteriores cambia. El vacío de la bandeja del decisor tiene que decir «No tiene expedientes
 *   asignados», y una tabla genérica no puede saber que lo que lista son expedientes.)
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 06, D-01: la implementación se
 *   SUSTITUYE por la de `resolucion-frontend @ origin/dev`, traducida a esta estructura. La
 *   cabecera anterior venía del clon —decía `Microservicio: resolucion` y tenía la codificación
 *   rota en «Módulo» y «según»— y por eso se reescribe entera en vez de añadirle una línea.)
 *
 * ── LOS 7 CAMBIOS VISIBLES, PARA QUE EL UAT SEPA QUÉ ANUNCIAR ────────────────────────────────
 * Esta tabla la montan CUATRO pantallas que no son de esta fase. Lo que van a ver distinto:
 *
 *   C1 · Desaparecen los dos bloques «Limpiar Filtros» y «Exportar CSV / PDF». Los de exportar eran
 *        botones MUERTOS —no tenían `onClick`—, y el de limpiar se convierte en la «X» de la barra
 *        de «Filtros aplicados», que ahora sólo aparece cuando hay alguno puesto.
 *   C2 · El paginado en línea (los cuatro botones sueltos y el select «Mostar 10») pasa a
 *        `Pagination`, que ya existía y es el de la captura: «Página 1 de 12 · Ir a: ·
 *        Registros/página · Total: 120». Opciones 5/10/20/30/40/50, defecto 10 (UI-SPEC §1.8).
 *   C3 · El filtro baja de DENTRO del `<th>` de la cabecera a una SEGUNDA fila de cabecera. Donde
 *        todas las columnas llevan `enableColumnFilter: false` no se nota.
 *   C4 · La primera carga dice «Cargando datos...» en vez de «No se encontraron resultados». Era un
 *        falso negativo: la tabla afirmaba que no había nada mientras aún estaba preguntando.
 *   C5 · Guardia anti-carrera (`activeFetchIdRef`): una respuesta lenta ya no puede pisar a una
 *        posterior. Antes, teclear rápido en un filtro podía dejar en pantalla el resultado viejo.
 *   C6 · La fila expandida se envuelve en `app-table-expanded-cell`, que la fija a la izquierda
 *        para que no se desplace al hacer scroll horizontal.
 *   C7 · El efecto de carga depende ahora también de `columns` y de `findRecordsFn`. 🔴 Quien monte
 *        esta tabla DEBE memoizar las dos cosas (`useMemo`/`useCallback` con dependencias
 *        estables) o provocará un bucle de peticiones. Las cuatro pantallas actuales ya lo hacen.
 *
 * Y un cambio que NO se ve pero se mide: **al montar se pide UNA sola vez**. Antes había una
 * petición idéntica de más por cada columna filtrable, medio segundo después de aparecer la
 * pantalla (`TableByDocumentType` tiene cinco). El porqué y los tres cortes, en `FilterByColumn.tsx`
 * y en `tableFilterParams.util.ts`.
 *
 * ── QUÉ SE LE AMPUTÓ AL ORIGINAL (D-02) ──────────────────────────────────────────────────────
 * Las dos props con las que la rama le dice a `RowActions` desde dónde se abre un modal, y el tipo
 * de contexto de modal que las acompaña. En Ejecución esa traducción NO la hace la tabla: la hace
 * `RowActions` con `ACCION_A_MODAL` / `resolverModalDeAccion`, la pieza que construyó la Fase 03.18
 * para que renombrar un modal y renombrar una actividad del backend dejaran de ser el mismo dato.
 * Por eso `RowActions` se invoca aquí con SU firma —`actions`, `data`, `refetchFn`— y ni él, ni
 * `RowActionMenu`, ni `ActionButton` se han sobrescrito.
 *
 * También se amputan los imports de tipos de dominio de Resolución: esta tabla es genérica y no
 * tiene por qué conocer ninguna entidad.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
  type ReactNode,
} from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type Row,
  type RowSelectionState,
} from "@tanstack/react-table";
import FilterByColumn from "./FilterByColumn";
import RowActions from "./RowActions";
import type { UserActions } from "../../interfaces/IUser";
import EmptyState from "../common/EmptyState";
import Boton from "../common/Boton";
import Pagination from "../common/Pagination";
import {
  formatFilterBadgeValue,
  getColumnCatalogKey,
  getColumnFilterType,
  isActiveFilterValue,
  normalizeColumnFiltersKey,
  serializeColumnFilters,
} from "../../utils/tableFilterParams.util";
// 🔴 Import POR EFECTO SECUNDARIO, y no sobra: `ITableFilter.ts` lleva el `declare module` que añade
// `filterType`, `catalogKey` y compañía al `ColumnMeta` de TanStack. Sin esta línea el archivo no
// entra en la compilación de este módulo, `meta.filterType` deja de tipar y toda la fila de filtros
// cae a «texto» sin que nadie se entere.
import "../../interfaces/ITableFilter";

export type TableSortOrder = "asc" | "desc";

export type TableSort = {
  sortBy: string;
  sortOrder: TableSortOrder;
};

/**
 * Lo que la tabla le pide al servidor. `sortBy`/`sortOrder` son OPCIONALES y sólo viajan si la
 * pantalla declara `defaultSort`: así los consumidores anteriores a esta fase no cambian.
 */
export type PaginationAndFilters = {
  pageIndex: number;
  pageSize: number;
  filterParams: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: TableSortOrder;
};

type PaginatedResponse<T> = {
  data: T[];
  total: number;
};

type StylesComponents = {
  containerStyle: string;
  tableStyle: string;
};

type TablaProps<T extends object> = {
  styles: StylesComponents;
  dataT: T[];
  columns: ColumnDef<T>[];
  resolveActionsPerRow: (row: T, options: UserActions[]) => UserActions[];
  tableOptions: UserActions[];
  findRecordsFn: (
    params: PaginationAndFilters,
  ) => Promise<PaginatedResponse<T>>;
  isExpandible?: boolean;
  renderExpandedRow?: (row: T) => ReactNode;
  /**
   * Nombre accesible del disparador de expansión. La tabla no conoce el dominio; la página sí.
   *
   * Sin ella se cae a «Expandir fila» / «Contraer fila», así que ninguna pantalla anterior cambia
   * —y hoy no hay ninguna: `isExpandible` no tiene ni un consumidor en todo `src/`—. Existe porque
   * el disparador se pinta con un `Boton` de SOLO ICONO y, sin nombre, se anuncia literalmente
   * «botón» diez veces por página: el mismo defecto que la Fase 03.19 arregló en la columna
   * ACCIONES.
   *
   * Recibe la fila y si está abierta, porque el texto tiene que cambiar al abrir: «Ver despachos
   * del expediente 053-2026» ⇄ «Ocultar despachos del expediente 053-2026».
   */
  etiquetaFilaExpandible?: (row: T, expandida: boolean) => string;
  getRowCanExpand?: (row: Row<T>) => boolean;
  isSelectable?: boolean;
  getRowId?: (row: T) => string;
  onSelectionChange?: (selectedRowIds: string[]) => void;
  getRowCanSelect?: (row: Row<T>) => boolean;
  hideActionsColumn?: boolean;
  hideToolbar?: boolean;
  hideNumberColumn?: boolean;
  /**
   * Entrega al padre la función de recarga. La bandeja del decisor la necesita para refrescar tras
   * «Aceptar», «Excusarme» o al volver de la página de generación, sin remontar la tabla —remontarla
   * perdería los filtros y la página en la que estaba—. En Ejecución estaba COMENTADA; aquí se
   * activa (RESEARCH §1.2).
   */
  onRefetchReady?: (refetch: () => Promise<void>) => void;
  onFilterParamsChange?: (
    filterParams: Record<string, string | string[]>,
  ) => void;
  defaultSort?: TableSort;
  /**
   * El copy de los DOS vacíos, cuando la pantalla tiene uno propio (UI-SPEC §5.1).
   *
   * 🔴 POR QUÉ SE PARAMETRIZA EN VEZ DE DEJARLO FIJO. Esta tabla es genérica y no conoce el dominio;
   * «No se encontraron resultados para la búsqueda actual» es lo mejor que puede decir sin saber qué
   * se está listando. Pero la bandeja del decisor sí lo sabe, y su vacío tiene que decir «No tiene
   * expedientes asignados · Cuando el sorteo le asigne un EPAS aparecerá aquí»: un encabezado que
   * nombra la cosa ausente y una pista que dice qué esperar. Meter ese texto AQUÍ sería que la tabla
   * genérica hablara del sorteo; dejarlo fuera sería que la bandeja no pudiera decirlo.
   *
   * Las dos props son OPCIONALES y su defecto es el texto de hoy, byte a byte: las otras cuatro
   * pantallas que montan esta tabla no cambian ni una letra.
   */
  vacioSinFiltros?: { texto: string; pista?: string };
  vacioConFiltros?: { texto: string; pista?: string };
};

/** El vacío que esta tabla dice cuando nadie le pasa uno propio. Es el texto que tenía en línea. */
const VACIO_SIN_FILTROS_POR_DEFECTO = {
  texto: "No se encontraron resultados para la búsqueda actual",
};

const VACIO_CON_FILTROS_POR_DEFECTO = {
  texto: "Ningún resultado coincide con los filtros",
  pista:
    "Quite algún filtro para ver más resultados. Puede haber filtros puestos en columnas que están fuera de pantalla.",
};

//TODO: Separar por componentes la tabla
const Table = <T extends object>({
  dataT,
  columns,
  findRecordsFn,
  styles,
  resolveActionsPerRow,
  tableOptions,
  isExpandible = false,
  renderExpandedRow,
  // Sin valor por defecto a propósito: la caída a «Expandir fila» / «Contraer fila» vive en el
  // punto de uso, porque depende de si la fila está abierta y aquí eso todavía no se sabe.
  etiquetaFilaExpandible,
  getRowCanExpand,
  isSelectable = false,
  getRowId,
  onSelectionChange,
  getRowCanSelect,
  hideActionsColumn = false,
  hideToolbar = false,
  hideNumberColumn = false,
  onRefetchReady,
  onFilterParamsChange,
  defaultSort,
  vacioSinFiltros = VACIO_SIN_FILTROS_POR_DEFECTO,
  vacioConFiltros = VACIO_CON_FILTROS_POR_DEFECTO,
}: TablaProps<T>) => {
  //Estado para la información que será presentada en la tabla
  const [data, setData] = useState<T[]>(dataT);

  //Total de registros que sirve en conjunto con la paginación
  const [totalData, setTotalData] = useState<number>(0);

  //Estado para manejar el filtrado de columnas
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  //Estado para manejo de paginación
  const [paginationFilters, setPaginationFilters] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isFetching, setIsFetching] = useState(true);
  const activeFetchIdRef = useRef(0);

  //Funcion que retorna el header para presentarlo en los filtro aplicados para una mejor lectura del usuario, para no presentar los ids de las columnas
  const getHeaderByColumnId = (columnId: string): string => {
    const column = columns.find((col) => col.id === columnId);
    if (!column) return columnId;
    if (typeof column.header === "string") return column.header;
    return columnId;
  };

  /**
   * Función para refrescar los datos de la tabla
   * Ejecuta la búsqueda con los filtros y paginación actuales y actualiza los estados setData y setTotalData
   * Se expone para ser llamada desde modales o componentes externos
   */
  const buildRequestParams = useCallback((): PaginationAndFilters => {
    const filterParams = serializeColumnFilters(columnFilters, columns);

    return {
      ...paginationFilters,
      filterParams,
      sortBy: defaultSort?.sortBy,
      sortOrder: defaultSort?.sortOrder,
    };
  }, [
    columnFilters,
    columns,
    paginationFilters,
    defaultSort?.sortBy,
    defaultSort?.sortOrder,
  ]);

  const refetchData = useCallback(async () => {
    const params = buildRequestParams();
    const response = await findRecordsFn(params);
    setData(response.data);
    setTotalData(response.total);
  }, [buildRequestParams, findRecordsFn]);

  // Expone refetchData al componente padre para que lo pase a componentes internos
  useEffect(() => {
    if (onRefetchReady) {
      onRefetchReady(refetchData);
    }
  }, [refetchData, onRefetchReady]);

  /**
   * 🔴 La clave por la que se comparan los filtros, y la razón de que la tabla no se pida a sí misma
   * dos veces al montar. TanStack devuelve un ARRAY NUEVO al quitar un filtro vacío, así que
   * `columnFilters` cambia de identidad sin cambiar de contenido; comparando por esta cadena —sólo
   * los filtros ACTIVOS— ese cambio deja de disparar el efecto de carga.
   */
  const columnFiltersKey = useMemo(
    () => normalizeColumnFiltersKey(columnFilters),
    [columnFilters],
  );

  useEffect(() => {
    onFilterParamsChange?.(serializeColumnFilters(columnFilters, columns));
  }, [columnFiltersKey, columns, onFilterParamsChange, columnFilters]);

  const activeColumnFilters = useMemo(
    () => columnFilters.filter((filter) => isActiveFilterValue(filter.value)),
    [columnFilters],
  );

  /**
   * 🔴 CAMBIAR UN FILTRO DEVUELVE A LA PÁGINA 1. Éste es el ÚNICO arreglo de conducta que este plan
   * hace a mano, y no viene de `origin/dev`: allí, igual que en la versión anterior de aquí, el
   * único sitio que devuelve `pageIndex` a 0 es el botón que limpia todos los filtros.
   *
   * Qué pasaba sin esto, medido por la sonda del Plan 01 y fijado ahora en `Table.test.tsx`: montar
   * → avanzar de página → teclear un filtro producía una petición con `pageIndex: 1`. Quien
   * estuviera en la página 3 y filtrara pedía la PÁGINA 3 DE LO FILTRADO, que casi siempre está
   * vacía, y la tabla le enseñaba «No se encontraron resultados» sobre un filtro que sí tenía
   * filas. Con doce columnas filtrables en la bandeja del decisor, eso deja de ser un caso raro.
   *
   * El `prev.pageIndex === 0 ? prev : …` no es una micro-optimización: devolver el MISMO objeto
   * hace que React descarte la actualización, y sin eso cada cambio de filtro estando ya en la
   * primera página provocaría un render —y una petición— de más. Y cuando sí hay que reiniciar, las
   * dos actualizaciones de estado caen en el mismo lote de React, así que el efecto de carga corre
   * UNA vez con el filtro nuevo y la página 1, no dos veces.
   */
  const aplicarFiltrosYVolverALaPrimeraPagina = useCallback(
    (siguientes: SetStateAction<ColumnFiltersState>) => {
      setColumnFilters(siguientes);
      setPaginationFilters((prev) =>
        prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 },
      );
    },
    [],
  );

  const handleClearAllFilters = useCallback(() => {
    setColumnFilters([]);
    setPaginationFilters((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  //Efecto que se lanza al momento de cambiar filtros o pagina
  useEffect(() => {
    const filterParams = serializeColumnFilters(columnFilters, columns);

    const params: PaginationAndFilters = {
      ...paginationFilters,
      filterParams,
      sortBy: defaultSort?.sortBy,
      sortOrder: defaultSort?.sortOrder,
    };

    const fetchId = ++activeFetchIdRef.current;
    setIsFetching(true);

    findRecordsFn(params)
      .then((response) => {
        if (fetchId !== activeFetchIdRef.current) {
          return;
        }
        setData(response.data);
        setTotalData(response.total);
      })
      .finally(() => {
        if (fetchId === activeFetchIdRef.current) {
          setIsFetching(false);
        }
      });

    return () => {
      activeFetchIdRef.current = fetchId + 1;
    };
    // `columnFilters` y `paginationFilters` entran por sus partes estables (`columnFiltersKey`,
    // `pageIndex`, `pageSize`) a propósito: por identidad de objeto volverían a pedir lo mismo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paginationFilters.pageIndex,
    paginationFilters.pageSize,
    columnFiltersKey,
    defaultSort?.sortBy,
    defaultSort?.sortOrder,
    findRecordsFn,
    columns,
  ]);

  useEffect(() => {
    if (!isSelectable || !onSelectionChange) {
      return;
    }

    const selectedRowIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
    );
    onSelectionChange(selectedRowIds);
  }, [rowSelection, isSelectable, onSelectionChange]);

  // Columna de selección, permite seleccionar filas individualmente o todas en la página actual
  const selectionColumn: ColumnDef<T> = {
    id: "select",
    size: 40,
    enableColumnFilter: false,
    header: ({ table: tableInstance }) => (
      <input
        type="checkbox"
        className="checkbox checkbox-primary checkbox-sm"
        checked={tableInstance.getIsAllPageRowsSelected()}
        ref={(input) => {
          if (input) {
            input.indeterminate =
              tableInstance.getIsSomePageRowsSelected() &&
              !tableInstance.getIsAllPageRowsSelected();
          }
        }}
        onChange={tableInstance.getToggleAllPageRowsSelectedHandler()}
        aria-label="Seleccionar todas las filas de la página"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="checkbox checkbox-primary checkbox-sm"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        aria-label="Seleccionar fila"
      />
    ),
  };

  // Columna de expansión, se usa para expandir y contraer las filas de la tabla
  const expanderColumn: ColumnDef<T> = {
    id: "expander",
    header: () => null,
    size: 40,
    enableColumnFilter: false,
    cell: ({ row }) =>
      row.getCanExpand() ? (
        <Boton
          deshabilitado={false}
          estilos={`btn btn-outline btn-circle btn-neutral btn-sm m-0 p-0 ${row.getIsExpanded() ? "btn-active" : ""}`}
          onClick={row.getToggleExpandedHandler()}
          icono={row.getIsExpanded() ? "contraer" : "expandir"}
          etiquetaAccesible={
            etiquetaFilaExpandible?.(row.original, row.getIsExpanded()) ??
            (row.getIsExpanded() ? "Contraer fila" : "Expandir fila")
          }
        />
      ) : null,
  };

  // El `id` y el ancho de la columna de numeración salen a constantes porque la fijación a la
  // IZQUIERDA (Fase 03.22, Plan 07) los lee: el bloque fijado la incluye, y se la reconoce por su
  // `id` en vez de darle `meta` —darle `meta` obligaría a distinguir después al líder del seguidor
  // por otra vía y a mantener dos fuentes de la misma decisión—.
  // 🔴 `--app-data-table-nro-width` de `tables.css` tiene que valer LO MISMO que este ancho.
  const ID_COLUMNA_NUMERACION = "nro";
  const ANCHO_COLUMNA_NUMERACION = 60;

  // Crear columna de numeración con acceso a paginación
  const numberColumn: ColumnDef<T> = {
    header: "Nro.",
    id: ID_COLUMNA_NUMERACION,
    enableColumnFilter: false,
    size: ANCHO_COLUMNA_NUMERACION,
    cell: (info) => {
      const rowIndex = info.row.index;
      const pageIndex = table.getState().pagination.pageIndex;
      const pageSize = table.getState().pagination.pageSize;
      const globalIndex = pageIndex * pageSize + rowIndex + 1;

      return <span className="font-semibold text-center">{globalIndex}</span>;
    },
  };

  //Columna de acciones, se renderizan botones o un menú dependiendo de la configuración enviada, además se evalúan las características de cada fila para decidir que acciones mostrar o deshabilitar
  const actionColumn: ColumnDef<T> = {
    id: "acciones",
    header: "Acciones",
    size: 500,
    enableColumnFilter: false,
    cell: (row) => (
      <RowActions
        actions={resolveActionsPerRow(row.row.original, tableOptions)}
        data={row.row.original}
        refetchFn={refetchData}
      />
    ),
  };

  // Crear array de columnas con numeración al inicio
  const columnsWithNumber = [
    ...(isSelectable ? [selectionColumn] : []),
    ...(isExpandible ? [expanderColumn] : []),
    ...(hideNumberColumn ? [] : [numberColumn]),
    ...columns,
    ...(hideActionsColumn ? [] : [actionColumn]),
  ];

  // ── La fijación de columnas, traducida a clases (Fase 03.22, Plan 07) ────────────────────────
  // Se mira `columns` —el array de la PÁGINA, ANTES de que se le antepongan numeración y acciones—
  // porque es la página la que decide QUÉ columna se fija; esta tabla sólo decide CÓMO.
  const hayColumnaFijadaALaIzquierda = columns.some(
    (columna) => columna.meta?.pinnedLeft === true,
  );
  // 🔴 La numeración va DELANTE de la columna declarada, así que entra en el bloque fijado: fijar
  // sólo la declarada dejaría un hueco a la izquierda por donde se vería pasar el contenido
  // desplazado. Si la tabla la oculta, la declarada es la primera y se queda pegada al borde sola.
  const seFijaLaNumeracion = hayColumnaFijadaALaIzquierda && !hideNumberColumn;

  /**
   * La clase de fijación de una celda, en UN solo sitio para los TRES puntos donde se aplica: la
   * fila de títulos, la fila de filtros y la celda del cuerpo. Devuelve `undefined` cuando la
   * columna no pide nada, que es el caso de todas las columnas de todas las pantallas anteriores.
   */
  const claseDeColumnaFijada = (
    columnId: string,
    meta: { pinnedLeft?: boolean; pinnedRight?: boolean } | undefined,
    donde: "cabecera" | "cuerpo",
  ): string | undefined => {
    if (meta?.pinnedRight) {
      return donde === "cabecera"
        ? "app-data-table-actions-col"
        : "app-data-table-actions-cell";
    }
    if (seFijaLaNumeracion && columnId === ID_COLUMNA_NUMERACION) {
      return donde === "cabecera"
        ? "app-data-table-nro-col"
        : "app-data-table-nro-cell";
    }
    if (meta?.pinnedLeft) {
      const base =
        donde === "cabecera"
          ? "app-data-table-pinned-col"
          : "app-data-table-pinned-cell";
      return seFijaLaNumeracion ? `${base} app-data-table-pinned-offset` : base;
    }
    return undefined;
  };

  //Configuración de la tabla, actualmente tiene paginación y filtrado por columna del lado del servidor
  const table = useReactTable({
    data,
    columns: columnsWithNumber,
    getCoreRowModel: getCoreRowModel(),
    ...(isExpandible
      ? {
          getRowCanExpand: getRowCanExpand ?? (() => true),
          getExpandedRowModel: getExpandedRowModel(),
          onExpandedChange: setExpanded,
        }
      : {}),
    ...(isSelectable && getRowId
      ? {
          enableRowSelection: getRowCanSelect ?? true,
          getRowId: (row: T) => getRowId(row),
          onRowSelectionChange: setRowSelection,
        }
      : {}),

    //Filtrado de columnas
    manualFiltering: true,
    onColumnFiltersChange: aplicarFiltrosYVolverALaPrimeraPagina,

    //Paginacion
    manualPagination: true,
    rowCount: totalData,
    onPaginationChange: (updater) => {
      setPaginationFilters((prev) => {
        const newPagination =
          typeof updater === "function" ? updater(prev) : updater;
        return { ...prev, ...newPagination };
      });
    },

    state: {
      columnFilters,
      ...(isExpandible ? { expanded } : {}),
      ...(isSelectable ? { rowSelection } : {}),
      pagination: {
        pageIndex: paginationFilters.pageIndex,
        pageSize: paginationFilters.pageSize,
      },
    },
  });

  const selectedCount = Object.keys(rowSelection).filter(
    (id) => rowSelection[id],
  ).length;

  /**
   * La barra de «filtros aplicados». Se extrae a una variable —el original la tiene en línea— porque
   * hace falta pintarla TAMBIÉN en el estado vacío: si la tabla se queda sin filas por culpa de un
   * filtro y la barra desaparece con ellas, la persona se queda sin el único mando para quitarlo.
   */
  const barraDeFiltrosAplicados =
    !hideToolbar && activeColumnFilters.length > 0 ? (
      <div className="app-table-applied-filters-toolbar mb-2">
        <div className="stats bg-base-100 border-base-300 border app-table-applied-filters-panel">
          <div className="stat">
            <div className="app-table-applied-filters">
              <div className="app-table-applied-filters-header">
                <span className="stat-title">Filtros aplicados:</span>
                <button
                  type="button"
                  className="btn btn-xs btn-error"
                  onClick={handleClearAllFilters}
                  aria-label="Limpiar todos los filtros"
                >
                  X
                </button>
              </div>
              <div className="app-table-applied-filters-badges flex gap-2 flex-wrap">
                {activeColumnFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className="badge badge-dash badge-primary"
                  >
                    {getHeaderByColumnId(filter.id)}:{" "}
                    {formatFilterBadgeValue(
                      filter.value,
                      getColumnFilterType(columns, filter.id),
                      getColumnCatalogKey(columns, filter.id),
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        // Por el mismo camino que cualquier otro cambio de filtro: quitar uno
                        // ensancha el resultado y la página en la que se estaba deja de significar
                        // lo mismo.
                        aplicarFiltrosYVolverALaPrimeraPagina(
                          columnFilters.filter((f) => f.id !== filter.id),
                        );
                      }}
                      className="btn btn-xs btn-warning btn-ghost"
                      aria-label={`Quitar el filtro de ${getHeaderByColumnId(filter.id)}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  // C4: primera carga. Antes se enseñaba «No se encontraron resultados» mientras aún se estaba
  // preguntando, que es afirmar una ausencia sin haberla comprobado.
  if (isFetching && data.length === 0) {
    return <EmptyState text="Cargando datos..." />;
  }

  // 🔴 VACÍO-SIN-FILTROS y VACÍO-POR-FILTRO son dos mensajes distintos (UI-SPEC §1.7 y §5.1). El
  // original de la rama los confunde en uno solo, igual que la versión anterior de aquí. Con doce
  // columnas filtrables y scroll horizontal, esa confusión hace creer que no hay nada cuando lo que
  // hay es un filtro olvidado en una columna que ni siquiera se ve.
  if (data.length === 0) {
    return (
      <>
        {barraDeFiltrosAplicados}
        {activeColumnFilters.length > 0 ? (
          <EmptyState
            text={vacioConFiltros.texto}
            hint={vacioConFiltros.pista}
          />
        ) : (
          <EmptyState text={vacioSinFiltros.texto} hint={vacioSinFiltros.pista} />
        )}
      </>
    );
  }

  return (
    <>
      {barraDeFiltrosAplicados}

      {/* div propiamente de la tabla de presentación de datos.
          `aria-busy` + la atenuación son el estado de RECARGA: las filas siguen en pantalla —la
          tabla nunca se vacía mientras se refresca (UI-SPEC §1.7)— pero se ve que están quedando
          obsoletas. Sin color nuevo: sólo opacidad. */}
      <div
        aria-busy={isFetching}
        className={`app-data-table-shell ${styles.containerStyle} ${
          isFetching ? "opacity-60 transition-opacity" : "transition-opacity"
        }`}
      >
        <table className={`app-data-table ${styles.tableStyle}`}>
          {/* Cabecera de la tabla: dos filas, la de títulos y la de filtros (C3) */}
          <thead className="app-data-table-head">
            {table.getHeaderGroups().map((headerGroup) => (
              <Fragment key={headerGroup.id}>
                <tr className="app-data-table-header-row text-xs uppercase tracking-[0.16em] text-base-content">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className={claseDeColumnaFijada(
                        header.column.id,
                        header.column.columnDef.meta,
                        "cabecera",
                      )}
                      style={{ width: `${header.getSize()}px` }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
                <tr className="app-data-table-filter-row">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={`${header.id}-filter`}
                      className={claseDeColumnaFijada(
                        header.column.id,
                        header.column.columnDef.meta,
                        "cabecera",
                      )}
                      style={{ width: `${header.getSize()}px` }}
                    >
                      {header.column.getCanFilter() ? (
                        // El control de filtro no sabe nada de `T` —sólo lee `meta` y escribe el
                        // valor del filtro—, así que se le entrega la columna en su forma genérica.
                        // El original de la rama resolvía lo mismo tipando el control con `any`;
                        // aquí el `any` se cambia por `object` —el límite que `T extends object` ya
                        // garantiza— y el puente se paga con esta conversión, que queda en UN sitio
                        // en vez de abrirle un `any` a todo el archivo del control.
                        <FilterByColumn
                          column={
                            header.column as unknown as Column<object, unknown>
                          }
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              </Fragment>
            ))}
          </thead>

          {/* Cuerpo de la tabla */}
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                {/* `eresIsLocked` se comprueba con `in` y NO por tipo a propósito: esta tabla es
                    genérica y no importa ninguna entidad del dominio (D-02). La regla viene de las
                    dos versiones —la anterior de aquí y la de la rama— y atenúa las filas que otro
                    usuario tiene tomadas. */}
                {/* 🔴 EL ZEBRA ES OPACO A PROPÓSITO Y SE QUEDA AQUÍ: las celdas fijas copian el
                    fondo de su `<tr>` (`background-color: inherit`), y la paridad SÓLO la sabe este
                    componente —la fila expandida de abajo es otro `<tr>` del mismo `<tbody>`, así
                    que el CSS no puede recalcularla—.
                    🔴 El realce al pasar el ratón SE FUE A `tables.css` (Plan 08, gap 3 del UAT):
                    aquí era un color translúcido que SUSTITUÍA al zebra, y la celda fija heredaba
                    esa transparencia y dejaba ver lo que se desplazaba por detrás. `app-data-table-row`
                    es el asidero con el que el CSS lo pinta ahora como una capa ENCIMA del color, y
                    sólo sobre las filas de DATOS. */}
                <tr
                  className={`app-data-table-row border-b border-base-300
                  ${"eresIsLocked" in row.original && row.original.eresIsLocked ? "opacity-50 cursor-not-allowed" : ""}
                  ${row.index % 2 === 0 ? "bg-base-100" : "bg-base-200"}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`overflow-visible py-2 text-sm text-base-content md:text-[0.95rem] ${
                        claseDeColumnaFijada(
                          cell.column.id,
                          cell.column.columnDef.meta,
                          "cuerpo",
                        ) ?? ""
                      }`}
                      style={{ width: `${cell.column.getSize()}px` }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {isExpandible && row.getIsExpanded() && renderExpandedRow && (
                  <tr className="border-b border-base-300 bg-base-200/50">
                    <td colSpan={row.getVisibleCells().length} className="p-0">
                      <div className="app-table-expanded-cell">
                        {renderExpandedRow(row.original)}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>

          {/* Pie de tabla */}
          <tfoot>
            {table.getFooterGroups().map((footerGroup) => (
              <tr key={footerGroup.id}>
                {footerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.footer,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      <div className="app-table-footer">
        {isSelectable && (
          <p className="text-sm text-center py-2">
            {selectedCount} de {totalData} filas seleccionadas
          </p>
        )}

        {/* C2: el paginado de la captura. `Pagination` ya existía aquí, byte a byte el de la rama:
            esta tabla sólo tiene que montarlo. */}
        <Pagination
          pageIndex={table.getState().pagination.pageIndex}
          pageSize={table.getState().pagination.pageSize}
          totalPages={Math.max(table.getPageCount(), 1)}
          onPageChange={(page) => table.setPageIndex(page)}
          onPageSizeChange={(size) => {
            setPaginationFilters(() => ({
              pageIndex: 0,
              pageSize: size,
            }));
          }}
          totalRecords={totalData}
        />
      </div>
    </>
  );
};

export default Table;
