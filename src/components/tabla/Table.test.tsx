/**
 * Microservicio: ejecucion
 * Módulo: Kit de tabla (compartido)
 * Feature: El contrato de PETICIONES de la tabla — red de seguridad de D-01 (Fase 03.19, Plan 01)
 * Archivo: Table.test.tsx
 * Responsabilidad: Fijar, con aserciones ejecutables, cuántas veces y con qué parámetros pide datos
 *   `Table.tsx`. Hasta hoy **ningún test montaba este componente**, y es el que pinta las tres
 *   pantallas con tabla del módulo. La Fase 03.19 lo sustituye entero por la versión de
 *   `resolucion-frontend @ origin/dev`: sin esto, un bucle de peticiones en la versión nueva se
 *   descubriría mirando la pestaña Network, no leyendo un test rojo.
 *
 *   ── LO QUE ESTE ARCHIVO NO PRUEBA ────────────────────────────────────────────────────────────
 *   No prueba el despacho de las acciones de fila: eso es de `RowActions.test.tsx`. Aquí `RowActions`
 *   se dobla por un componente vacío porque exige `ToastProvider` y `ModalProvider` y arrastra los 16
 *   modales del registro —uno llega hasta `react-pdf`, que revienta en jsdom—. Lo que se mira de la
 *   columna de acciones es sólo si ESTÁ o NO ESTÁ.
 *
 *   ── 🔴 LAS DOS CONDUCTAS QUE EL PLAN 01 DEJÓ EN `it.todo`, Y CÓMO ACABARON ───────────────────
 *   El Plan 01 midió con una sonda dos defectos de la tabla de entonces y los dejó escritos como
 *   pendientes —sin ablandar ninguna aserción y sin tocar producción— para que el Plan 06 tuviera
 *   un criterio OBJETIVO con el que decidir si sustituir la tabla mejoraba algo o sólo cambiaba.
 *   Las dos son hoy pruebas de verdad, y ésta es su historia:
 *
 *     (a) **La tabla se pedía a sí misma una segunda vez 500 ms después de montarse.** Medido:
 *         montar ⇒ 1 petición; a los 900 ms ⇒ 2, idénticas. El `DebouncedInput` de la versión
 *         anterior tenía un efecto sobre `[value]` que corría también al montar, así que medio
 *         segundo después llamaba `column.setFilterValue("")`; TanStack devolvía un ARRAY NUEVO al
 *         quitar el filtro vacío y el efecto de carga repetía la consulta. Una petición de más POR
 *         CADA COLUMNA FILTRABLE en cada montaje (`TableByDocumentType` tiene cinco).
 *         ✅ **LO ARREGLA LA VERSIÓN PORTADA, por tres sitios a la vez**: el debounce no emite si
 *         el valor no cambió; el manejador traduce la cadena vacía a `undefined` y compara antes de
 *         escribir; y el efecto de carga compara los filtros por CLAVE NORMALIZADA
 *         (`normalizeColumnFiltersKey`) en vez de por identidad de array.
 *
 *     (b) **Filtrar NO reiniciaba a la página 1.** Medido: montar → avanzar de página → filtrar ⇒
 *         la petición del filtro llevaba `pageIndex: 1`. Quien estuviera en la página 3 y filtrara
 *         pedía la página 3 de lo filtrado —casi siempre vacía— y la tabla le enseñaba «No se
 *         encontraron resultados» sobre un filtro que sí tenía filas.
 *         ⚠️ **La versión portada NO lo arregla**: en `origin/dev` el único sitio que devuelve
 *         `pageIndex` a 0 sigue siendo el botón que limpia todos los filtros. Se arregló a mano en
 *         el Plan 06, en su propio commit, y esta prueba es la que lo fija.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-09-25 (Fase 03.20, Plan 02, C5 del contrato de UI: un
 *   `describe` nuevo para el NOMBRE ACCESIBLE del disparador de fila. La prueba que más pesa es la
 *   que monta SIN la prop nueva y afirma que el disparador sigue anunciándose «Expandir fila» — es
 *   la que demuestra, en vez de prometer, que ninguna pantalla anterior cambia. Las pruebas
 *   anteriores no se tocaron y `montar` tampoco: el nuevo `describe` trae su propio ayudante.)
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 07: un `describe` nuevo para la
 *   fijación de columnas a la IZQUIERDA. La prueba que más pesa es la del OPT-IN: monta el array de
 *   columnas que no declara nada y afirma que NINGUNA celda lleva las clases nuevas — es lo que
 *   demuestra, en vez de prometer, que las otras cuatro pantallas con tabla del módulo no cambian.
 *   `montar` gana dos parámetros OPCIONALES y las seis pruebas anteriores no se tocaron.)
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 06: los dos `it.todo` pasan a ser
 *   pruebas ejecutables, y desaparece el andamio que esperaba a la petición fantasma.)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import Table, { type PaginationAndFilters } from "./Table";

// Ver la cabecera: aquí sólo importa si la columna de acciones se pinta, nunca qué hace.
vi.mock("./RowActions", () => ({ default: () => null }));

type Fila = { expNumber: string; administrado: string };

/** Dos filas con dato reconocible: sirven para saber que la carga terminó, no para probar el pintado. */
const FILAS: Fila[] = [
  { expNumber: "EPAS-2026-04101", administrado: "Comercial Ficticia del Valle S.A." },
  { expNumber: "EPAS-2026-04102", administrado: "Taller Imaginario Norte" },
];

/**
 * Columnas como CONSTANTE DE MÓDULO, no construidas dentro del render: es el equivalente de prueba
 * del `useMemo(…, [])` que las tres páginas usan (PATTERNS §5). Un array nuevo en cada render haría
 * que esta prueba midiera la identidad de las columnas en vez del contrato de peticiones.
 *
 * Sólo `expNumber` es filtrable: una columna filtrable = un cuadro de filtro, y así
 * `getAllByPlaceholderText` no tiene que elegir.
 */
const COLUMNAS: ColumnDef<Fila>[] = [
  {
    id: "expNumber",
    accessorFn: (fila) => fila.expNumber,
    header: "Expediente",
    cell: (info) => String(info.getValue()),
  },
  {
    id: "administrado",
    accessorFn: (fila) => fila.administrado,
    header: "Administrado",
    enableColumnFilter: false,
    cell: (info) => String(info.getValue()),
  },
];

/**
 * Las mismas columnas, con los DOS interruptores de fijación declarados (Fase 03.22, Plan 07).
 * También como CONSTANTE DE MÓDULO y por la misma razón que la de arriba: un array nuevo en cada
 * render mediría la identidad de las columnas en vez de lo que estas pruebas quieren medir.
 *
 * `administrado` lleva el de la DERECHA a propósito: la columna de acciones que declara `Table.tsx`
 * por su cuenta no lo declara, así que sin esto no habría forma de comprobar que el refactor del
 * ayudante de clases no se llevó por delante la fijación que ya existía.
 */
const COLUMNAS_FIJADAS: ColumnDef<Fila>[] = [
  { ...COLUMNAS[0], meta: { pinnedLeft: true } },
  { ...COLUMNAS[1], meta: { pinnedRight: true } },
];

/** 25 de total contra 10 por página: hay páginas siguientes, así que el paginado está vivo. */
const TOTAL = 25;

/**
 * El doble de `findRecordsFn`. El tipo se declara en el genérico de `vi.fn` y no en la firma de la
 * implementación a propósito: así `mock.calls[n][0]` sigue siendo un `PaginationAndFilters` tipado
 * —que es sobre lo que este archivo asierta— sin declarar un parámetro que el doble no usa.
 */
const crearBuscador = () =>
  vi.fn<(parametros: PaginationAndFilters) => Promise<{ data: Fila[]; total: number }>>(
    async () => ({ data: FILAS, total: TOTAL }),
  );

/**
 * ⚠️ Los dos últimos parámetros los añadió la Fase 03.22, Plan 07, y son OPCIONALES a propósito:
 * las seis pruebas anteriores siguen llamando a `montar` exactamente igual y no se tocaron.
 */
const montar = (
  buscar: ReturnType<typeof crearBuscador>,
  ocultarAcciones = false,
  columnas: ColumnDef<Fila>[] = COLUMNAS,
  ocultarNumeracion = false,
) =>
  render(
    <Table<Fila>
      styles={{ containerStyle: "overflow-x-auto", tableStyle: "table table-sm" }}
      dataT={[]}
      columns={columnas}
      findRecordsFn={buscar}
      resolveActionsPerRow={() => []}
      tableOptions={[]}
      hideActionsColumn={ocultarAcciones}
      hideNumberColumn={ocultarNumeracion}
    />,
  );

/** La primera fila en pantalla: la señal de que la carga inicial resolvió. */
const esperarLaPrimeraCarga = () => screen.findByText("EPAS-2026-04101");

describe("Table — el contrato de peticiones que la sustitución de D-01 debe conservar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("al montarse pide los registros UNA sola vez, con la página 1 y sin filtros", async () => {
    const buscar = crearBuscador();
    montar(buscar);

    await esperarLaPrimeraCarga();

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar.mock.calls[0][0]).toEqual({
      pageIndex: 0,
      pageSize: 10,
      filterParams: {},
    });
  });

  // 🔴 (a) de la cabecera: era `it.todo` y ahora es una aserción. Es la prueba objetiva de que la
  // sustitución de D-01 mejoró algo MEDIBLE y no sólo cambió el aspecto de la tabla.
  it("no vuelve a pedir lo mismo cuando vence el debounce de los filtros vacíos del montaje", async () => {
    const buscar = crearBuscador();
    montar(buscar);
    await esperarLaPrimeraCarga();

    // 1.200 ms de reloj REAL, más del doble del debounce de 500 ms: es el instante en el que la
    // versión anterior tenía ya la segunda petición hecha. No se usan temporizadores falsos porque
    // lo que se quiere medir es justo la interacción del debounce con los efectos de React.
    await new Promise((resolver) => setTimeout(resolver, 1200));

    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("filtrar una columna añade UNA petición más, que lleva el valor tecleado", async () => {
    const buscar = crearBuscador();
    montar(buscar);
    await esperarLaPrimeraCarga();

    // Ya no hace falta dejar pasar el debounce del montaje: no hay petición fantasma que esperar.
    // Se afirma el conteo antes de filtrar, para que el `mockClear` no tape una de más.
    expect(buscar).toHaveBeenCalledTimes(1);
    buscar.mockClear();

    fireEvent.change(screen.getByPlaceholderText("buscar..."), {
      target: { value: "04101" },
    });

    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(buscar.mock.calls[0][0].filterParams).toEqual({ expNumber: "04101" });
  });

  // 🔴 (b) de la cabecera: era `it.todo`, la versión portada NO lo arreglaba y se arregló a mano.
  it("filtrar reinicia a la página 1 aunque se hubiera avanzado de página", async () => {
    const buscar = crearBuscador();
    montar(buscar);
    await esperarLaPrimeraCarga();

    // 25 registros a 10 por página ⇒ 3 páginas: el botón de «siguiente» está vivo.
    fireEvent.click(screen.getByTitle("Página siguiente"));
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(buscar.mock.calls[1][0].pageIndex).toBe(1);

    buscar.mockClear();
    fireEvent.change(screen.getByPlaceholderText("buscar..."), {
      target: { value: "04101" },
    });

    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1), { timeout: 2000 });
    // La petición del filtro va a la página 1, no a la 3 del resultado filtrado — que casi siempre
    // está vacía y haría creer que el filtro no encuentra nada.
    expect(buscar.mock.calls[0][0]).toMatchObject({
      pageIndex: 0,
      filterParams: { expNumber: "04101" },
    });
  });

  it("pinta la columna «Acciones» cuando la página no pide ocultarla", async () => {
    const buscar = crearBuscador();
    montar(buscar);

    await esperarLaPrimeraCarga();
    expect(screen.getByText("Acciones")).toBeInTheDocument();
  });

  it("no pinta la columna «Acciones» con `hideActionsColumn`", async () => {
    const buscar = crearBuscador();
    montar(buscar, true);

    // La cabecera «Expediente» prueba que la tabla se pintó: sin ella la ausencia no diría nada.
    await esperarLaPrimeraCarga();
    expect(screen.getByText("Expediente")).toBeInTheDocument();
    expect(screen.queryByText("Acciones")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Table — la fijación de columnas a la IZQUIERDA (Fase 03.22, Plan 07, gap 2 del UAT)", () => {
  /**
   * 🔴 LO QUE ESTAS PRUEBAS NO PUEDEN AFIRMAR, Y NO LO INTENTAN: jsdom no calcula CSS. No sabe si
   * la columna se queda quieta al desplazar, si su fondo es opaco, si sigue la franja de su fila,
   * si hay hueco o solape entre las dos fijadas, ni si la sombra se ve. Todo eso son las nueve
   * comprobaciones humanas del UAT de la fase, en los dos temas. Afirmarlo aquí con una consulta
   * sobre un estilo calculado sería una prueba verde protegiendo algo que nadie ha mirado — el
   * defecto exacto que el contrato de UI §7 existe para evitar.
   *
   * Se consulta el DOM directamente porque una CLASE no es un rol y por rol no se puede pedir; es
   * el mismo recurso que usa el ayudante `cabeceras()` de `MisAsignadosPage.test.tsx`.
   */
  const celdas = (selector: string) =>
    Array.from(document.querySelectorAll(selector));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("la columna que declara el interruptor lleva la clase de fijada en sus TRES celdas", async () => {
    const buscar = crearBuscador();
    montar(buscar, false, COLUMNAS_FIJADAS);
    await esperarLaPrimeraCarga();

    // Dos `<th>`: el de la fila de títulos y el de la fila de filtros (Table.tsx pinta las dos).
    expect(celdas("th.app-data-table-pinned-col")).toHaveLength(2);
    // Dos `<td>`: una por cada fila de datos.
    expect(celdas("td.app-data-table-pinned-cell")).toHaveLength(2);
  });

  it("con la numeración pintada, ella lidera el bloque y la declarada va desplazada", async () => {
    const buscar = crearBuscador();
    montar(buscar, false, COLUMNAS_FIJADAS);
    await esperarLaPrimeraCarga();

    // La numeración va DELANTE y la antepone esta misma tabla: entra en el bloque fijado, o
    // quedaría un hueco a la izquierda por donde se vería pasar el contenido desplazado.
    expect(celdas("th.app-data-table-nro-col")).toHaveLength(2);
    expect(celdas("td.app-data-table-nro-cell")).toHaveLength(2);

    // Y por eso la declarada recibe ADEMÁS el modificador de desplazamiento.
    expect(
      celdas("th.app-data-table-pinned-col.app-data-table-pinned-offset"),
    ).toHaveLength(2);
    expect(
      celdas("td.app-data-table-pinned-cell.app-data-table-pinned-offset"),
    ).toHaveLength(2);
  });

  it("con la numeración OCULTA, la declarada se pega al borde y NO lleva el desplazamiento", async () => {
    const buscar = crearBuscador();
    montar(buscar, false, COLUMNAS_FIJADAS, true);
    await esperarLaPrimeraCarga();

    expect(celdas("th.app-data-table-pinned-col")).toHaveLength(2);
    expect(celdas("td.app-data-table-pinned-cell")).toHaveLength(2);
    // Hoy ninguna pantalla está en este caso —la bandeja del decisor pinta su `Nro.`—, pero
    // `Table.tsx` lo comparten todas las tablas del módulo y la regla se escribió para las dos.
    expect(celdas(".app-data-table-pinned-offset")).toHaveLength(0);
    expect(celdas(".app-data-table-nro-col, .app-data-table-nro-cell")).toHaveLength(0);
  });

  // 🔴 LA PRUEBA DEL OPT-IN. Es la que DEMUESTRA —y no promete— que ninguna otra tabla de la
  // aplicación cambia: monta el array de columnas de siempre, que no declara ningún interruptor, y
  // afirma que no aparece NINGUNA de las clases nuevas en todo el documento.
  it("🔴 una tabla que no declara nada no recibe NINGUNA de las clases nuevas", async () => {
    const buscar = crearBuscador();
    montar(buscar);
    await esperarLaPrimeraCarga();

    expect(
      celdas(
        [
          ".app-data-table-pinned-col",
          ".app-data-table-pinned-cell",
          ".app-data-table-pinned-offset",
          ".app-data-table-nro-col",
          ".app-data-table-nro-cell",
        ].join(", "),
      ),
    ).toHaveLength(0);
  });

  it("la fijación a la DERECHA sigue intacta: el refactor del ayudante no se llevó nada", async () => {
    const buscar = crearBuscador();
    montar(buscar, false, COLUMNAS_FIJADAS);
    await esperarLaPrimeraCarga();

    expect(celdas("th.app-data-table-actions-col")).toHaveLength(2);
    expect(celdas("td.app-data-table-actions-cell")).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Table — el realce del ratón sale del marcado (Fase 03.22, Plan 08, gap 3 del UAT)", () => {
  /**
   * 🔴 LO QUE ESTAS PRUEBAS NO PUEDEN AFIRMAR, Y NO LO INTENTAN. jsdom NO calcula CSS: no resuelve
   * un color, no compone una opacidad y no sabe qué se pinta encima de qué. **Ninguna prueba de
   * aquí dice que la celda fija sea opaca al pasar el ratón** — eso es exactamente el gap que este
   * plan cierra, y sólo lo puede confirmar un par de ojos. Está en el UAT de la fase (ronda 3,
   * comprobaciones 1 a 4, en los DOS temas).
   *
   * Lo que sí es comprobable, y es lo que hay aquí: que el marcado lleva el asidero que el CSS
   * engancha, que el zebra por paridad sigue viviendo en React —que es el único que sabe la
   * paridad— y que el realce translúcido no ha vuelto por un copiar-y-pegar.
   */
  const filas = (selector: string) =>
    Array.from(document.querySelectorAll(selector));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cada fila de DATOS lleva la clase semántica, y nadie más la lleva", async () => {
    const buscar = crearBuscador();
    montar(buscar);
    await esperarLaPrimeraCarga();

    // Dos filas de datos ⇒ exactamente dos. Ni la fila de títulos, ni la de filtros, ni el pie.
    expect(filas("tr.app-data-table-row")).toHaveLength(2);
    expect(filas("tbody tr.app-data-table-row")).toHaveLength(2);
    expect(filas("thead tr.app-data-table-row")).toHaveLength(0);
  });

  it("el zebra sigue decidiéndose por la paridad del índice, en React y no en el CSS", async () => {
    const buscar = crearBuscador();
    montar(buscar);
    await esperarLaPrimeraCarga();

    const [primera, segunda] = filas("tr.app-data-table-row");
    expect(primera).toHaveClass("bg-base-100");
    expect(segunda).toHaveClass("bg-base-200");
  });

  it("🔴 ninguna fila lleva ya el realce TRANSLÚCIDO: es el gap 3, y no puede volver", async () => {
    const buscar = crearBuscador();
    montar(buscar);
    await esperarLaPrimeraCarga();

    // La cadena se escribe entera a propósito: es la que hay que poder buscar el día que alguien
    // la reintroduzca. Está PROHIBIDA en el `<tr>` porque es el color de marca al 5 % —con canal
    // alfa— y SUSTITUYE al zebra opaco del que las celdas fijas heredan su fondo: con ella puesta,
    // al pasar el ratón la columna fija se transparenta y deja ver lo que se desplaza por detrás.
    // El realce equivalente vive ahora en `tables.css` como capa de imagen encima del color.
    for (const fila of filas("tr.app-data-table-row")) {
      expect(fila.className).not.toContain("hover:bg-primary/5");
    }
  });
});

describe("Table — el nombre accesible del disparador de fila (Fase 03.20, C5)", () => {
  /**
   * 🔴 QUÉ DEFECTO FIJA ESTO. El disparador de expansión se pinta con un `Boton` de SOLO ICONO y
   * hasta esta fase no recibía nombre: un lector de pantalla lo anunciaba literalmente «botón»,
   * diez veces por página. Es el mismo defecto que la Fase 03.19 arregló en la columna ACCIONES.
   *
   * La prop es OPCIONAL y la caída vive en el punto de uso, así que la primera prueba de aquí —la
   * que monta SIN la prop— es la que demuestra, en vez de prometer, que ninguna pantalla anterior
   * cambia. (Hoy no hay ninguna: `isExpandible` no tiene ni un consumidor en todo `src/`.)
   */
  const montarExpandible = (
    buscar: ReturnType<typeof crearBuscador>,
    etiquetaFilaExpandible?: (fila: Fila, expandida: boolean) => string,
  ) =>
    render(
      <Table<Fila>
        styles={{ containerStyle: "overflow-x-auto", tableStyle: "table table-sm" }}
        dataT={[]}
        columns={COLUMNAS}
        findRecordsFn={buscar}
        resolveActionsPerRow={() => []}
        tableOptions={[]}
        isExpandible
        renderExpandedRow={(fila) => <span>Despachos de {fila.expNumber}</span>}
        etiquetaFilaExpandible={etiquetaFilaExpandible}
      />,
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin la prop, el disparador se anuncia con el texto genérico de siempre", async () => {
    const buscar = crearBuscador();
    montarExpandible(buscar);
    await esperarLaPrimeraCarga();

    // Dos filas de datos ⇒ dos disparadores, los dos cerrados.
    expect(screen.getAllByLabelText("Expandir fila")).toHaveLength(2);
  });

  it("con la prop, el disparador se anuncia con lo que devuelve la página", async () => {
    const buscar = crearBuscador();
    montarExpandible(buscar, (fila, expandida) =>
      expandida
        ? `Ocultar despachos del expediente ${fila.expNumber}`
        : `Ver despachos del expediente ${fila.expNumber}`,
    );
    await esperarLaPrimeraCarga();

    expect(
      screen.getByLabelText("Ver despachos del expediente EPAS-2026-04101"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Ver despachos del expediente EPAS-2026-04102"),
    ).toBeInTheDocument();
    // Y el genérico ya no se usa en ninguna de las dos filas.
    expect(screen.queryByLabelText("Expandir fila")).toBeNull();
  });

  it("al abrir la fila el nombre cambia: la función recibe `expandida = true`", async () => {
    const buscar = crearBuscador();
    montarExpandible(buscar, (fila, expandida) =>
      expandida
        ? `Ocultar despachos del expediente ${fila.expNumber}`
        : `Ver despachos del expediente ${fila.expNumber}`,
    );
    await esperarLaPrimeraCarga();

    fireEvent.click(
      screen.getByLabelText("Ver despachos del expediente EPAS-2026-04101"),
    );

    await screen.findByLabelText(
      "Ocultar despachos del expediente EPAS-2026-04101",
    );
    // La otra fila sigue cerrada: el nombre es POR FILA, no por tabla.
    expect(
      screen.getByLabelText("Ver despachos del expediente EPAS-2026-04102"),
    ).toBeInTheDocument();
  });

  it("una tabla NO expandible no pinta disparador, así que nada de esto aplica", async () => {
    const buscar = crearBuscador();
    montar(buscar);
    await esperarLaPrimeraCarga();

    expect(screen.queryByLabelText("Expandir fila")).toBeNull();
    expect(screen.queryByLabelText("Contraer fila")).toBeNull();
  });
});
