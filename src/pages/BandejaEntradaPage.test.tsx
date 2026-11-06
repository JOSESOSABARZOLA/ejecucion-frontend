/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: El buscador de la Bandeja de Entrada no parpadea (incidencia del 2026-09-17)
 * Archivo: BandejaEntradaPage.test.tsx
 * Responsabilidad: Fijar el comportamiento de CARGA del buscador, que es lo único que este archivo
 *   prueba. La página tiene más de mil líneas y no hace falta recorrerlas para sostener esto.
 *
 *   🔴 QUÉ SE ROMPIÓ Y QUÉ LO IMPIDE VOLVER. Al estrenar el buscador, la pantalla ENTERA parpadeaba
 *   en cada tecla. La causa no era el buscador: era `<Loading />`, que no es un spinner sino un
 *   `<div>` absoluto que tapa de borde a borde con el logo a `clamp(12rem, 30vw, 26rem)`, y estaba
 *   colgado de `{loading && …}` a secas. Cada consulta lo montaba y lo desmontaba.
 *
 *   Las tres pruebas de aquí son las tres mitades del arreglo:
 *     1. el velo se ve en la carga INICIAL (no se apagó del todo: cuando no hay nada que enseñar, sí
 *        hay que decir que se está cargando);
 *     2. el velo NO vuelve al buscar, y los resultados anteriores se quedan en pantalla;
 *     3. buscar lanza UNA consulta, no dos — el reinicio de página iba en un efecto aparte y se veía
 *        como un render más, así que la bandeja pedía dos veces y las dos respuestas competían.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado por: Andrés Miño — 2026-10-07 (quick 261007-jrr: la fila del expediente enseña
 *   «Materia · Submateria» en las dos bandejas; el rol del doble de `useUser` pasa a ser mutable para
 *   probar también la del secretario abogado)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 12, D-16/D-17): cada caso enseña sus
 *   infracciones con `CeldaInfracciones`, la bandeja filtra por MATERIA (entonces por código;
 *   desde la quick 261104-jh1 por `materiaId`) y el buscador anuncia que encuentra por código de infracción. El hook del catálogo
 *   se dobla para no salir a la red.
 * Modificado por: Andrés Miño — 2026-10-16 (UAT 03.23-14): dentro del lote solo se enseñan los
 *   expedientes que casan (`coincideFiltro`) y la cabecera dice «N de M caso(s)»; la barra de
 *   filtros es UNA fila con «Limpiar filtros» dentro; el buscador anuncia la materia, y el vacío
 *   con solo la materia puesta la nombra.
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 07, D-09/D-13): el servicio doblado
 *   trae `estadoSincronizacion` (por defecto con la integración apagada), y un bloque nuevo fija que
 *   ningún rol ve ya el botón de sincronización manual y que la línea de la última sincronización
 *   aparece para los dos roles solo con la integración encendida.
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 11, D-05): en el bloque de
 *   infracciones, un caso trae `datosResolucionFaltantes: ["MULTA"]` y otro `null`; dos pruebas
 *   fijan que el aviso «Datos de Resolución incompletos» sale en el primero, junto a su celda de
 *   infracciones, y no en el segundo ni en el THIN.
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 18, G-16/G-13): la línea visible ya no
 *   es `role="status"` y se comprueba por su texto; el doble de `useModal` trae `modal.isOpen`, y un
 *   bloque nuevo fija que una pasada con datos recarga la bandeja sola si es seguro y, con una ficha
 *   abierta o una selección de casos, pinta «Hay datos nuevos de Resolución» sin tocar la lista.
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 20, G-04): el `👁` y el `⑂` de la fila
 *   son `BotonAccionFila` con nombre accesible, en orden `👁` → `⑂` → «Devolver a DMR», y el `⑂`
 *   abre la línea de tiempo con `momento: "antesDelSorteo"` mientras no haya habido sorteo.
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 24, G-01): un bloque nuevo fija el estado
 *   único de la fila con reingreso («Por devolver» > chip ámbar > estado + «Reingresado»), la guarda
 *   de «Marcar revisado» y la frase de los retenidos por verificar en el aviso de la remisión.
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261029-kl0): los mocks ganan `aprobarEnviarSorteo`
 *   y `aprobarPorDirector`; un bloque nuevo fija la advertencia de los excluidos del sorteo y el
 *   «Remitir al secretario» por caso del director.
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1): el filtro «Materia» lleva ids de Sorteo
 *   (`materiaId`), el resumen lleva `materiaIds`/`submateriaIds`/`sinMateria`, y la fila de un caso
 *   con alguna infracción sin materia dice «Sin materia».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { errorDelServidor } from "../test/errores";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type {
  EnvioLoteCaso,
  EnvioLoteDto,
  EstadoSincronizacionResolucion,
} from "../services/EntradaLotesService";
import type { ResumenInfracciones } from "../services/InfraccionesService";
import {
  CHIP_REINGRESO_POR_VERIFICAR,
  ETIQUETA_REINGRESADO,
  tituloChipReingreso,
  tituloPorDevolverNoCumplidas,
} from "../components/entrada/reingreso";

const mocks = vi.hoisted(() => ({
  // Rol del doble de `useUser`, MUTABLE (quick 261007-jrr): las bandejas del director y del
  // secretario abogado comparten la fila, y las dos se prueban. Por defecto, «director».
  rolName: "director",
  bandejaDirector: vi.fn(),
  bandejaSecretario: vi.fn(),
  approveDirector: vi.fn(),
  // quick 261029-kl0: «Aprobar y enviar a sorteo» (secretario) y la remisión por caso (director).
  aprobarEnviarSorteo: vi.fn(),
  aprobarPorDirector: vi.fn(),
  // Fase 03.24 (D-13): la página lee el estado de la sincronización al montar. Por defecto, la
  // integración APAGADA — así ninguna prueba anterior ve la línea nueva (D-10, Pitfall 11).
  estadoSincronizacion: vi.fn(async (): Promise<EstadoSincronizacionResolucion> => ({
    habilitada: false,
    intervaloMinutos: 5,
    enCurso: false,
    resultado: "NUNCA",
    inicio: null,
    fin: null,
    motivo: null,
    lotes: 0,
    casosNuevos: 0,
    casosActualizados: 0,
    reingresados: 0,
    fallos: [],
    fallosTotales: 0,
    truncado: false,
  })),
  addToast: vi.fn(),
  openModal: vi.fn(),
  // Plan 18 (G-13): ¿hay un modal abierto? La página lo lee para decidir si recarga sola.
  modalAbierto: false,
  // Fase 03.23 (Plan 12): lo que devuelve el doble de `useTableCatalogOptions` y con qué clave se
  // le llamó. Mutable para probar la carga fallida del catálogo.
  catalogo: {
    options: [] as { value: string; label: string }[],
    isLoading: false,
    error: null as Error | null,
  },
  clavesCatalogo: [] as string[],
}));

// El desplegable «Materia» lee las materias de Sorteo por el hook de catálogos. Se dobla el
// HOOK (no el servicio): la prueba fija qué hace la bandeja con las opciones, no cómo se cargan.
vi.mock("../hooks/useTableCatalogOptions", () => ({
  useTableCatalogOptions: (clave: string) => {
    mocks.clavesCatalogo.push(clave);
    return mocks.catalogo;
  },
}));

vi.mock("../services/EntradaLotesService", () => ({
  EntradaLotesService: {
    bandejaDirector: mocks.bandejaDirector,
    bandejaSecretario: mocks.bandejaSecretario,
    approveDirector: mocks.approveDirector,
    aprobarEnviarSorteo: mocks.aprobarEnviarSorteo,
    estadoSincronizacion: mocks.estadoSincronizacion,
  },
}));

// El gate de /seed y el resto de servicios que la página toca al montarse: se doblan para que esta
// prueba no arrastre media docena de módulos que no tienen nada que ver con el parpadeo.
vi.mock("../services/InboxCasesService", () => ({
  InboxCasesService: { isSeedEnabled: vi.fn().mockResolvedValue(false) },
}));
vi.mock("../services/SorteoService", () => ({
  SorteoService: { lotes: vi.fn(), sortear: vi.fn() },
}));
vi.mock("../services/EpasService", () => ({
  EpasService: {
    marcarRevisado: vi.fn(),
    aprobarPorDirector: mocks.aprobarPorDirector,
  },
  default: {},
}));

// La página solo importa la CLAVE de estos tres modales (para abrirlos por nombre), pero importar el
// módulo arrastra su árbol entero — y el de la ficha del expediente llega hasta `react-pdf`, que en
// jsdom revienta al cargarse (`DOMMatrix is not defined`). Se doblan por su clave, que es lo único
// que esta prueba necesita de ellos.
vi.mock("../components/modals/ModalExpedienteLote", () => ({
  MODAL_KEY: "expedienteLote",
  default: () => null,
}));
vi.mock("../components/modals/ModalReturnToDmr", () => ({
  MODAL_KEY: "DEVOLVER_DMR",
  default: () => null,
}));
vi.mock("../components/modals/ModalAnexarDocumento", () => ({
  MODAL_KEY: "anexarDocumento",
  default: () => null,
}));

vi.mock("../context/UserContext", () => ({
  useUser: () => ({
    user: { usuId: 4, rolName: mocks.rolName },
    sessionState: "authenticated",
  }),
}));
vi.mock("../hooks/useModal", () => ({
  useModal: () => ({
    openModal: mocks.openModal,
    modal: { isOpen: mocks.modalAbierto },
  }),
}));
vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

import BandejaEntradaPage from "./BandejaEntradaPage";

/** Un lote mínimo: solo lo que la cabecera de la card necesita para pintarse. */
const lote = (envlId: number, numero: string): EnvioLoteDto => ({
  envlId,
  envlNumeroLote: numero,
  envlStatus: "EN_REVISION",
  envlTipo: "ENVIO",
  envlIncomeAt: "2026-09-16T10:00:00.000Z",
  casos: [],
});

/** La forma paginada que devuelven las bandejas. */
const pagina = (data: EnvioLoteDto[], total = data.length) => ({
  data,
  total,
  limit: 10,
  offset: 0,
  page: 1,
  pages: Math.ceil(total / 10),
});

/**
 * Rótulo accesible del buscador general (Fase 03.23: también encuentra por código de infracción;
 * UAT 03.23-14: y por materia).
 */
const ROTULO_BUSCADOR =
  "Buscar por número de lote, expediente, materia, código de infracción, nombre o cédula";

/** El velo a pantalla completa se reconoce por el alt de su logo (ver `Loading.tsx`). */
const velo = () => screen.queryByAltText("Cargando");

const pintar = () =>
  render(
    <MemoryRouter>
      <BandejaEntradaPage />
    </MemoryRouter>,
  );

describe("BandejaEntradaPage — la carga del buscador no parpadea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bandejaDirector.mockResolvedValue(
      pagina([lote(1, "PRB-ENV-111111"), lote(2, "PRB-ENV-222222")]),
    );
  });

  it("muestra el velo en la carga INICIAL y lo retira al llegar los lotes", async () => {
    pintar();

    // Antes de que responda no hay nada que enseñar: el velo es lo correcto ahí.
    expect(velo()).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy();
    });
    expect(velo()).toBeNull();
  });

  it("🔴 al BUSCAR no vuelve el velo, y los resultados anteriores siguen en pantalla", async () => {
    pintar();
    await waitFor(() => {
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy();
    });

    // La segunda consulta se deja colgando: es el instante exacto en que antes se veía el velo.
    let resolver: (v: unknown) => void = () => {};
    mocks.bandejaDirector.mockReturnValueOnce(
      new Promise((res) => {
        resolver = res;
      }),
    );

    fireEvent.change(screen.getByLabelText(ROTULO_BUSCADOR), {
      target: { value: "Gabriela" },
    });

    await waitFor(
      () => {
        expect(mocks.bandejaDirector).toHaveBeenCalledTimes(2);
      },
      { timeout: 2000 },
    );

    // Con la consulta EN VUELO: ni velo, ni lista vacía. Esto es el arreglo.
    expect(velo()).toBeNull();
    expect(screen.getByText("PRB-ENV-111111")).toBeTruthy();

    resolver(pagina([lote(3, "PRB-ENV-333333")]));
    await waitFor(() => {
      expect(screen.getByText("PRB-ENV-333333")).toBeTruthy();
    });
  });

  it("🔴 buscar DESDE OTRA PÁGINA lanza UNA sola consulta, no dos", async () => {
    // ⚠️ El caso tiene que empezar FUERA de la primera página, o no prueba nada: con `pageIndex` ya
    // en 0, el `setPageIndex(0)` del reinicio es un no-op y React ni siquiera vuelve a renderizar.
    // El fallo —dos consultas y una carrera entre ellas— solo aparecía buscando desde la página 2 en
    // adelante, que es justo lo que nadie prueba a mano.
    mocks.bandejaDirector.mockResolvedValue(
      pagina([lote(1, "PRB-ENV-111111")], 25),
    );
    pintar();
    await waitFor(() => {
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy();
    });

    // A la página 2.
    fireEvent.click(screen.getByTitle("Página siguiente"));
    await waitFor(() => {
      expect(mocks.bandejaDirector).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 10 }),
      );
    });
    const trasPaginar = mocks.bandejaDirector.mock.calls.length;

    fireEvent.change(screen.getByLabelText(ROTULO_BUSCADOR), {
      target: { value: "Gabriela" },
    });

    await waitFor(
      () => {
        expect(mocks.bandejaDirector).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "Gabriela", offset: 0 }),
        );
      },
      { timeout: 2000 },
    );

    // Se espera de sobra por si hubiera otra consulta en camino. Con el reinicio de página en un
    // efecto aparte, aquí había DOS llamadas nuevas: la primera con el término nuevo y la página
    // vieja (offset 10), y la segunda ya con offset 0 — compitiendo por llegar.
    await new Promise((res) => setTimeout(res, 600));
    expect(mocks.bandejaDirector.mock.calls.length).toBe(trasPaginar + 1);
  });

  it("el rebote NO consulta por cada tecla: tres pulsaciones seguidas son UNA consulta", async () => {
    pintar();
    await waitFor(() => {
      expect(mocks.bandejaDirector).toHaveBeenCalledTimes(1);
    });

    const caja = screen.getByLabelText(ROTULO_BUSCADOR);
    fireEvent.change(caja, { target: { value: "G" } });
    fireEvent.change(caja, { target: { value: "Ga" } });
    fireEvent.change(caja, { target: { value: "Gab" } });

    await waitFor(
      () => {
        expect(mocks.bandejaDirector).toHaveBeenCalledTimes(2);
      },
      { timeout: 2000 },
    );
    expect(mocks.bandejaDirector).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "Gab" }),
    );
  });
});

/**
 * EL BADGE «POR DEVOLVER» (2026-09-18).
 *
 * Lo que se prueba es la CONSECUENCIA en la lista, no el contrato: que un expediente ya observado se
 * distinga de un vistazo de uno que no lo está, y que distinguirlo NO cueste una petición por fila.
 * Esa segunda mitad es la que se puede romper sin que nadie lo note — hasta que la bandeja cargue
 * cincuenta lotes en producción.
 */
describe("BandejaEntradaPage — «Por devolver»", () => {
  /** Un lote con dos casos: uno observado y otro no. */
  const loteConCasos = (): EnvioLoteDto => ({
    ...lote(1, "PRB-ENV-111111"),
    casos: [
      {
        envlcId: 1,
        eejeId: 10,
        expNumber: "001-2026",
        eejeStatus: "RECIBIDO",
        admiName: "Daniela",
        admiLastname: "Morales",
        observacionesTotal: 3,
        porDevolver: true,
      },
      {
        envlcId: 2,
        eejeId: 11,
        expNumber: "002-2026",
        eejeStatus: "RECIBIDO",
        admiName: "Sofía",
        admiLastname: "Peña",
        observacionesTotal: 0,
        porDevolver: false,
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bandejaDirector.mockResolvedValue(pagina([loteConCasos()]));
  });

  it("el expediente observado se marca «Por devolver» y el que no lo está, no", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("001-2026")).toBeTruthy());

    const marcas = screen.getAllByText("Por devolver");
    expect(marcas).toHaveLength(1);
    // En ROJO: es la decisión que alguien ya tomó sobre ese expediente, y tiene que saltar a la vista.
    expect(marcas[0].className).toContain("text-error");
    // Y dice CUÁNTAS, para que no haya que abrir la ficha solo para saber si hay una o quince.
    expect(marcas[0].getAttribute("title")).toContain("3 observaciones");

    // 🔴 UN SOLO ESTADO POR FILA (2026-09-21, reportado por el área: «se queda con dos estados:
    // Recibido y por devolver»). La marca SUSTITUYE al estado mientras dura: dos chips seguidos con
    // la misma forma se leen como dos estados del mismo expediente. El estado no se pierde —va en el
    // `title`—, pero deja de disputarle el sitio a lo que de verdad va a pasar con el expediente.
    // ⟳ 2026-09-29 (quick 260929-mbo): el estado se nombra con su ETIQUETA legible, aquí y en el
    // chip. El `title` no lleva chip —es un atributo— pero sí la etiqueta.
    expect(marcas[0].getAttribute("title")).toContain("Estado: Recibido");
    // El OTRO caso del lote, que no está marcado, sí enseña su estado: la marca acota, no apaga.
    expect(screen.getAllByText("Recibido")).toHaveLength(1);
  });

  /**
   * 🔴 DOS ESTADOS EN LA MISMA FILA (2026-09-18, observado por el área: «esos expedientes tienen dos
   * estados, dice Devuelto_DMR y Por Devolver»).
   *
   * Un expediente YA devuelto conserva sus observaciones —son el motivo con el que salió— pero ya no
   * está pendiente de nada. La marca se pinta desde `porDevolver`, que lo resuelve el servidor, y no
   * desde el conteo: con el conteo, la fila decía las dos cosas a la vez.
   */
  it("el expediente YA devuelto conserva sus observaciones pero NO se marca «Por devolver»", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      pagina([
        {
          ...lote(1, "PRB-ENV-111111"),
          casos: [
            {
              envlcId: 1,
              eejeId: 10,
              expNumber: "001-2026",
              eejeStatus: "DEVUELTO_DMR",
              admiName: "Daniela",
              admiLastname: "Morales",
              // Las observaciones SIGUEN ahí: el memorando de devolución las cita.
              observacionesTotal: 3,
              porDevolver: false,
            },
          ],
        },
      ]),
    );
    pintar();
    await waitFor(() => expect(screen.getByText("001-2026")).toBeTruthy());

    // Su estado lo dice, y lo dice UNA sola vez.
    // El enum crudo ya no se pinta: «Devuelto a la DMR» con su chip rojo (quick 260929-mbo).
    expect(screen.getByText("Devuelto a la DMR")).toBeTruthy();
    expect(screen.queryByText("Por devolver")).toBeNull();
    // 🔴 Y TAMPOCO SE OFRECE DEVOLVERLO OTRA VEZ (2026-09-18, reportado por el área:
    // «Transición inválida: no se puede aplicar DEVOLVER_DMR desde DEVUELTO_DMR»). El gate se
    // calculaba solo por LOTE y dejaba el botón puesto sobre un expediente ya devuelto — y los lotes
    // de tipo DEVOLUCION entran con TODOS sus casos así.
    expect(screen.queryByText("Devolver a DMR")).toBeNull();
  });

  it("el expediente en RECIBIDO sí ofrece «Devolver a DMR»: el gate acota, no apaga", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("001-2026")).toBeTruthy());

    // Los dos casos del lote están en RECIBIDO y el lote en EN_REVISION con el director delante.
    expect(screen.getAllByText("Devolver a DMR")).toHaveLength(2);
  });

  it("🔴 la marca NO cuesta una petición por fila: llega con la consulta que hidrata el lote", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("Por devolver")).toBeTruthy());

    // Una sola lectura de la bandeja, y ninguna consulta de observaciones por expediente.
    expect(mocks.bandejaDirector).toHaveBeenCalledTimes(1);
  });

  /**
   * 🔴 EL FALLO REPORTADO POR EL ÁREA (2026-09-18): «si el director remite un lote al secretario, se
   * están yendo también los expedientes en estado Por Devolver que marcó el director».
   *
   * Quien los retiene es el backend. Lo que se fija aquí es que la pantalla lo DIGA: remitir treinta
   * y que tres se queden en silencio es lo que se descubre semanas después.
   */
  it("al remitir el lote, el aviso dice cuántos se quedaron por estar marcados", async () => {
    mocks.approveDirector.mockResolvedValue({
      envlId: 1,
      remitido: true,
      retenidos: 3,
    });
    pintar();
    await waitFor(() => expect(screen.getByText("Por devolver")).toBeTruthy());

    fireEvent.click(screen.getByText("Remitir al secretario"));
    fireEvent.click(
      await waitFor(() => {
        const b = document.querySelector<HTMLButtonElement>(
          ".app-modules-modal-submit",
        );
        if (!b) throw new Error("No se abrió el diálogo de confirmación");
        return b;
      }),
    );

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    const [variante, mensaje] = mocks.addToast.mock.calls[0];
    expect(variante).toBe("success");
    expect(mensaje).toContain("remitido al secretario");
    expect(mensaje).toContain("3 expediente(s) marcados");
  });

  it("sin marcados, el aviso NO menciona retenciones que no existen", async () => {
    mocks.approveDirector.mockResolvedValue({
      envlId: 1,
      remitido: true,
      retenidos: 0,
    });
    pintar();
    await waitFor(() => expect(screen.getByText("Por devolver")).toBeTruthy());

    fireEvent.click(screen.getByText("Remitir al secretario"));
    fireEvent.click(
      await waitFor(() => {
        const b = document.querySelector<HTMLButtonElement>(
          ".app-modules-modal-submit",
        );
        if (!b) throw new Error("No se abrió el diálogo de confirmación");
        return b;
      }),
    );

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    expect(mocks.addToast.mock.calls[0][1]).not.toContain("NO se remitieron");
  });
});

/**
 * MATERIA Y SUBMATERIA EN LA FILA (quick 261007-jrr).
 *
 * En esta bandeja se decide qué se remite y qué se devuelve a la DMR, y la materia del expediente es
 * parte de esa decisión. Se enseña tras la zona como «Materia · Submateria»; lo que no se sabe se
 * OMITE (sin «—», como la zona y la cédula); si las dos se llaman igual sale una sola vez; y el
 * `title` dice siempre las dos partes con su rótulo.
 */
describe("BandejaEntradaPage — materia y submateria en la fila (quick 261007-jrr)", () => {
  /** Un caso aterrizado con su número de expediente y lo que se sepa de su materia. */
  const caso = (
    n: number,
    expMateria?: string,
    expSubmateria?: string,
  ): NonNullable<EnvioLoteDto["casos"]>[number] => ({
    envlcId: n,
    eejeId: 100 + n,
    expNumber: `10${n}-2026`,
    eejeStatus: "RECIBIDO",
    admiName: "Daniela",
    admiLastname: "Morales",
    expZone: "Eugenio Espejo",
    expMateria,
    expSubmateria,
  });

  /** La fila entera de un expediente, acotada desde su número. */
  const fila = (expNumber: string): HTMLElement => {
    const el = screen
      .getByText(expNumber)
      .closest<HTMLElement>(".app-item-list-row");
    if (!el) throw new Error(`No se encontró la fila de ${expNumber}`);
    return el;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rolName = "director";
    mocks.bandejaDirector.mockResolvedValue(
      pagina([
        {
          ...lote(1, "PRB-ENV-111111"),
          casos: [
            caso(1, "Construcción", "Edificación"),
            caso(2, "Espacio Público", undefined),
            caso(3, undefined, "Turismo"),
            caso(4, undefined, undefined),
            caso(5, "Ambiente", "Ambiente"),
          ],
        },
      ]),
    );
  });

  afterEach(() => {
    // Que el rol no se filtre a los demás describe: todos asumen «director».
    mocks.rolName = "director";
  });

  it("con las dos: «Materia · Submateria» y el `title` rotula las dos partes", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("101-2026")).toBeTruthy());

    const dato = within(fila("101-2026")).getByText(
      "Construcción · Edificación",
    );
    expect(dato.getAttribute("title")).toBe(
      "Materia: Construcción · Submateria: Edificación",
    );
  });

  it("solo la materia: sale ella sola, sin separador", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("102-2026")).toBeTruthy());

    const dato = within(fila("102-2026")).getByText("Espacio Público");
    expect(dato.textContent).not.toContain(" · ");
    expect(dato.getAttribute("title")).toBe("Materia: Espacio Público");
  });

  it("solo la submateria: sale ella sola, y el `title` dice que es la submateria", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("103-2026")).toBeTruthy());

    const dato = within(fila("103-2026")).getByText("Turismo");
    expect(dato.textContent).not.toContain(" · ");
    expect(dato.getAttribute("title")).toBe("Submateria: Turismo");
  });

  it("sin ninguna: la fila no enseña nada en ese sitio, ni «—»", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("104-2026")).toBeTruthy());

    const laFila = fila("104-2026");
    const rotulados = Array.from(
      laFila.querySelectorAll<HTMLElement>("[title]"),
    ).filter((el) => {
      const t = el.getAttribute("title") ?? "";
      return t.startsWith("Materia:") || t.startsWith("Submateria:");
    });
    expect(rotulados).toHaveLength(0);
    expect(within(laFila).queryByText("—")).toBeNull();
  });

  it("mismo nombre en las dos: sale UNA vez, y el `title` sigue diciendo las dos", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("105-2026")).toBeTruthy());

    const laFila = fila("105-2026");
    expect(within(laFila).queryByText("Ambiente · Ambiente")).toBeNull();
    const datos = within(laFila).getAllByText("Ambiente");
    expect(datos).toHaveLength(1);
    expect(datos[0].getAttribute("title")).toBe(
      "Materia: Ambiente · Submateria: Ambiente",
    );
  });

  it("en la bandeja del SECRETARIO ABOGADO también se ve", async () => {
    mocks.rolName = "secretario abogado";
    mocks.bandejaSecretario.mockResolvedValue(
      pagina([
        {
          ...lote(7, "PRB-ENV-777777"),
          envlStatus: "APROBADO",
          casos: [caso(1, "Construcción", "Edificación")],
        },
      ]),
    );
    pintar();
    await waitFor(() => expect(screen.getByText("101-2026")).toBeTruthy());

    expect(mocks.bandejaSecretario).toHaveBeenCalled();
    expect(mocks.bandejaDirector).not.toHaveBeenCalled();
    expect(
      within(fila("101-2026")).getByText("Construcción · Edificación"),
    ).toBeTruthy();
  });
});

/**
 * INFRACCIONES Y FILTRO DE MATERIA (Fase 03.23, Plan 12, D-16/D-17).
 *
 * En esta bandeja se decide qué se remite y qué se devuelve a la DMR, así que las alertas de las
 * infracciones (CORE pendiente, conflicto, descuadre, sin infracciones) tienen que verse ANTES de
 * decidir. La fila las pinta con `CeldaInfracciones`, la misma de «Mis expedientes», que traduce el
 * bloque del servidor y no calcula nada. El filtro «Materia» manda el ID de Sorteo
 * (`materiaId`, quick 261104-jh1) y el servidor hace el resto; el buscador encuentra también por código de
 * infracción, y lo dice.
 */
describe("BandejaEntradaPage — infracciones y filtro de materia (Fase 03.23)", () => {
  /** El bloque `infracciones` tal como lo manda el servidor. */
  const resumen = (
    codigos: string[],
    extra: Partial<ResumenInfracciones> = {},
  ): ResumenInfracciones => ({
    codigos,
    materiaIds: [],
    submateriaIds: [],
    sinMateria: false,
    estadoCore: "LEIDO",
    conflicto: false,
    descuadre: false,
    ...extra,
  });

  /** La fila entera de un expediente, acotada desde su identificador visible. */
  const fila = (texto: string): HTMLElement => {
    const el = screen
      .getByText(texto)
      .closest<HTMLElement>(".app-item-list-row");
    if (!el) throw new Error(`No se encontró la fila de ${texto}`);
    return el;
  };

  const MATERIAS = [
    { value: "22", label: "AMBIENTE" },
    { value: "26", label: "LICENCIAMIENTO" },
  ];

  /** El desplegable de materia, por su rótulo accesible. */
  const desplegableMateria = (): HTMLSelectElement =>
    screen.getByLabelText("Filtrar por materia");

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rolName = "director";
    mocks.clavesCatalogo = [];
    mocks.catalogo = { options: MATERIAS, isLoading: false, error: null };
    mocks.bandejaDirector.mockResolvedValue(
      pagina([
        {
          ...lote(1, "PRB-ENV-111111"),
          casos: [
            {
              envlcId: 1,
              eejeId: 201,
              expNumber: "201-2026",
              eejeStatus: "RECIBIDO",
              expMateria: "LICENCIAMIENTO",
              expSubmateria: "LUAE",
              infracciones: resumen(
                ["LIC-LU-X-124-1947A-02", "LIC-LU-X-124-1947A-03"],
                { conflicto: true },
              ),
              // Fase 03.24 (D-05): vino de Resolución sin multa.
              datosResolucionFaltantes: ["MULTA"],
            },
            {
              envlcId: 2,
              eejeId: 202,
              expNumber: "202-2026",
              eejeStatus: "RECIBIDO",
              // Para el backend un EPAS SIN infracciones descuadra: la celda dice otra cosa.
              infracciones: resumen([], { descuadre: true }),
              // Fase 03.24 (D-05): no vino de Resolución, así que no hay aviso que dar.
              datosResolucionFaltantes: null,
            },
            {
              // THIN: aún no es EPAS, así que el servidor no manda ni materia ni infracciones.
              envlcId: 3,
              envlcCaseRef: 999,
            },
          ],
        },
      ]),
    );
  });

  afterEach(() => {
    mocks.catalogo = { options: [], isLoading: false, error: null };
  });

  it("el caso con infracciones pinta su celda: el primer código, «+N» y la alerta del servidor", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("201-2026")).toBeTruthy());

    const laFila = fila("201-2026");
    expect(within(laFila).getByText("LIC-LU-X-124-1947A-02")).toBeTruthy();
    expect(within(laFila).getByText("+1")).toBeTruthy();
    expect(within(laFila).getByText("Conflicto de códigos")).toBeTruthy();
    // La materia de la fila es la DEDUCIDA que manda el servidor, con la regla visual de siempre.
    expect(within(laFila).getByText("LICENCIAMIENTO · LUAE")).toBeTruthy();
  });

  it("quick 261104-jh1: un caso con alguna infracción «sin materia» lo dice junto a su materia; sin ninguna, solo «Sin materia»", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      pagina([
        {
          ...lote(1, "PRB-ENV-111111"),
          casos: [
            {
              envlcId: 1,
              eejeId: 301,
              expNumber: "301-2026",
              eejeStatus: "RECIBIDO",
              expMateria: "LICENCIAMIENTO",
              expSubmateria: "LUAE",
              infracciones: resumen(["LIC-LU-X-124-1947A-02", "095-2025-001"], {
                materiaIds: [26],
                submateriaIds: [54],
                sinMateria: true,
              }),
            },
            {
              envlcId: 2,
              eejeId: 302,
              expNumber: "302-2026",
              eejeStatus: "RECIBIDO",
              infracciones: resumen(["095-2025-001"], { sinMateria: true }),
            },
          ],
        },
      ]),
    );
    pintar();
    await waitFor(() => expect(screen.getByText("301-2026")).toBeTruthy());

    expect(
      within(fila("301-2026")).getByText("LICENCIAMIENTO / Sin materia · LUAE"),
    ).toBeTruthy();
    expect(within(fila("302-2026")).getByText("Sin materia")).toBeTruthy();
  });

  it("el caso aterrizado sin códigos dice «Sin infracciones», nunca «Descuadre»", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("202-2026")).toBeTruthy());

    const laFila = fila("202-2026");
    expect(within(laFila).getByText("Sin infracciones")).toBeTruthy();
    expect(within(laFila).queryByText("Descuadre")).toBeNull();
  });

  it("el caso THIN no pinta nada de infracciones", async () => {
    pintar();
    await waitFor(() =>
      expect(screen.getByText("Ref. origen #999")).toBeTruthy(),
    );

    const laFila = fila("Ref. origen #999");
    expect(within(laFila).queryByText("Sin infracciones")).toBeNull();
    expect(laFila.querySelector('[title^="Infracciones:"]')).toBeNull();
    expect(
      within(laFila).queryByText("Datos de Resolución incompletos"),
    ).toBeNull();
  });

  it("Fase 03.24 (D-05): el caso al que le falta la multa enseña «Datos de Resolución incompletos» junto a sus infracciones", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("201-2026")).toBeTruthy());

    const laFila = fila("201-2026");
    const aviso = within(laFila).getByText("Datos de Resolución incompletos");
    expect(aviso.closest("[title]")?.getAttribute("title")).toContain("multa");
    // Convive con la celda de la 03.23: el aviso de conflicto sigue ahí, y en la MISMA celda.
    const celda = within(laFila)
      .getByText("Conflicto de códigos")
      .closest(".app-item-list-info--baja");
    expect(celda).not.toBeNull();
    expect(celda!.contains(aviso)).toBe(true);
  });

  it("Fase 03.24 (D-05): el caso que no vino de Resolución (`null`) no enseña el aviso", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("202-2026")).toBeTruthy());

    const laFila = fila("202-2026");
    expect(
      within(laFila).queryByText("Datos de Resolución incompletos"),
    ).toBeNull();
    expect(within(laFila).getByText("Sin infracciones")).toBeTruthy();
  });

  it("«Materia» ofrece «Todas» y las materias de Sorteo, con el ID como valor", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("201-2026")).toBeTruthy());

    expect(mocks.clavesCatalogo).toContain("materiaId");
    const opciones = Array.from(desplegableMateria().options).map((o) => [
      o.value,
      o.textContent,
    ]);
    expect(opciones).toEqual([
      ["", "Todas"],
      ["22", "AMBIENTE"],
      ["26", "LICENCIAMIENTO"],
    ]);
  });

  it("con «Todas», `materiaId` NO viaja", async () => {
    pintar();
    await waitFor(() => expect(mocks.bandejaDirector).toHaveBeenCalledTimes(1));

    expect("materiaId" in mocks.bandejaDirector.mock.calls[0][0]).toBe(false);
  });

  it("🔴 elegir una materia DESDE OTRA PÁGINA repite la carga con `materiaId` y vuelve a la página 1, en UNA consulta", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      pagina([lote(1, "PRB-ENV-111111")], 25),
    );
    pintar();
    await waitFor(() =>
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy(),
    );

    fireEvent.click(screen.getByTitle("Página siguiente"));
    await waitFor(() => {
      expect(mocks.bandejaDirector).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 10 }),
      );
    });
    const trasPaginar = mocks.bandejaDirector.mock.calls.length;

    fireEvent.change(desplegableMateria(), { target: { value: "26" } });

    await waitFor(() => {
      expect(mocks.bandejaDirector).toHaveBeenLastCalledWith(
        expect.objectContaining({ materiaId: "26", offset: 0 }),
      );
    });
    await new Promise((res) => setTimeout(res, 100));
    expect(mocks.bandejaDirector.mock.calls.length).toBe(trasPaginar + 1);
  });

  it("«Limpiar filtros» vacía la materia y `materiaId` deja de viajar", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("201-2026")).toBeTruthy());

    // Sin filtros no hay nada que limpiar.
    expect(screen.queryByText("Limpiar filtros")).toBeNull();

    fireEvent.change(desplegableMateria(), { target: { value: "22" } });
    await waitFor(() => {
      expect(mocks.bandejaDirector).toHaveBeenLastCalledWith(
        expect.objectContaining({ materiaId: "22" }),
      );
    });

    fireEvent.click(screen.getByText("Limpiar filtros"));
    await waitFor(() => {
      const ultima = mocks.bandejaDirector.mock.calls.at(-1)?.[0] ?? {};
      expect("materiaId" in ultima).toBe(false);
    });
    expect(desplegableMateria().value).toBe("");
  });

  it("el buscador anuncia que encuentra por código de infracción", async () => {
    pintar();
    await waitFor(() => expect(screen.getByText("201-2026")).toBeTruthy());

    expect(
      screen.getByLabelText(ROTULO_BUSCADOR).getAttribute("placeholder"),
    ).toContain("código de infracción");
  });

  it("si el catálogo de materias no carga, «Materia» dice «No disponible», queda apagado, y la bandeja carga igual", async () => {
    mocks.catalogo = {
      options: [],
      isLoading: false,
      error: new Error("caído"),
    };
    pintar();
    await waitFor(() => expect(screen.getByText("201-2026")).toBeTruthy());

    const desplegable = desplegableMateria();
    expect(desplegable.disabled).toBe(true);
    expect(desplegable.textContent).toContain("No disponible");
    expect(mocks.bandejaDirector).toHaveBeenCalledTimes(1);
  });
});

describe("BandejaEntradaPage — filtros dentro del lote y barra de filtros (UAT 03.23-14)", () => {
  const MATERIAS = [
    { value: "22", label: "AMBIENTE" },
    { value: "26", label: "LICENCIAMIENTO" },
  ];

  /** Un lote con tres casos: dos EPAS y un THIN, con las marcas que se le pasen. */
  const loteConCasos = (
    marcas: [boolean | undefined, boolean | undefined, boolean | undefined],
  ): EnvioLoteDto => ({
    ...lote(1, "PRB-ENV-111111"),
    casos: [
      {
        envlcId: 1,
        eejeId: 201,
        expNumber: "201-2026",
        eejeStatus: "RECIBIDO",
        coincideFiltro: marcas[0],
      },
      {
        envlcId: 2,
        eejeId: 202,
        expNumber: "202-2026",
        eejeStatus: "RECIBIDO",
        coincideFiltro: marcas[1],
      },
      { envlcId: 3, envlcCaseRef: 999, coincideFiltro: marcas[2] },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rolName = "director";
    mocks.catalogo = { options: MATERIAS, isLoading: false, error: null };
  });

  afterEach(() => {
    mocks.catalogo = { options: [], isLoading: false, error: null };
  });

  it("🔴 con filtro, DENTRO del lote solo se enseñan los expedientes que casan, y la cabecera dice «N de M caso(s)»", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      pagina([loteConCasos([true, false, false])]),
    );
    pintar();
    await waitFor(() => expect(screen.getByText("201-2026")).toBeTruthy());

    expect(screen.queryByText("202-2026")).toBeNull();
    expect(screen.queryByText("Ref. origen #999")).toBeNull();
    expect(screen.getByText("1 de 3 caso(s)")).toBeTruthy();
    // Y avisa de que las acciones del lote no se recortan con la lista.
    expect(
      screen.getByText(/Se muestran 1 de 3 expedientes del lote/).textContent,
    ).toContain("siguen valiendo para el lote completo");
  });

  it("sin filtro (el servidor no manda la marca) se enseñan todos y la cabecera cuenta el lote entero", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      pagina([loteConCasos([undefined, undefined, undefined])]),
    );
    pintar();
    await waitFor(() => expect(screen.getByText("201-2026")).toBeTruthy());

    expect(screen.getByText("202-2026")).toBeTruthy();
    expect(screen.getByText("Ref. origen #999")).toBeTruthy();
    expect(screen.getByText("3 caso(s)")).toBeTruthy();
    expect(screen.queryByText(/Se muestran/)).toBeNull();
  });

  it("si dentro del lote no casa ninguno, lo dice en vez de enseñar una lista vacía", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      pagina([loteConCasos([false, false, false])]),
    );
    pintar();
    await waitFor(() =>
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy(),
    );

    expect(screen.getByText("0 de 3 caso(s)")).toBeTruthy();
    expect(
      screen.getByText(
        "Ningún expediente de este lote coincide con el filtro.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("201-2026")).toBeNull();
  });

  it("con SOLO la materia puesta y ningún lote, el vacío nombra la materia; con más filtros, el mensaje general", async () => {
    mocks.bandejaDirector.mockResolvedValue(pagina([]));
    pintar();
    await waitFor(() =>
      expect(
        screen.getByText("No hay lotes en su bandeja de entrada."),
      ).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("Filtrar por materia"), {
      target: { value: "26" },
    });
    await waitFor(() =>
      expect(
        screen.getByText("No hay lotes con infracciones de LICENCIAMIENTO."),
      ).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText(ROTULO_BUSCADOR), {
      target: { value: "Gabriela" },
    });
    await waitFor(() =>
      expect(
        screen.getByText(
          "Ningún lote coincide con la búsqueda, la materia o el rango de fechas.",
        ),
      ).toBeTruthy(),
    );
  });

  it("el buscador anuncia que encuentra también por materia", async () => {
    mocks.bandejaDirector.mockResolvedValue(pagina([]));
    pintar();
    await waitFor(() => expect(mocks.bandejaDirector).toHaveBeenCalled());

    expect(
      screen.getByLabelText(ROTULO_BUSCADOR).getAttribute("placeholder"),
    ).toContain("materia");
  });

  it("🔴 la barra de filtros es UNA sola fila: los cuatro controles y «Limpiar filtros» son hermanos, alineados por abajo", async () => {
    mocks.bandejaDirector.mockResolvedValue(pagina([]));
    pintar();
    await waitFor(() => expect(mocks.bandejaDirector).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Filtrar por materia"), {
      target: { value: "22" },
    });
    await waitFor(() =>
      expect(screen.getByText("Limpiar filtros")).toBeTruthy(),
    );

    const barra = screen.getByRole("search", { name: "Filtros de la bandeja" });
    // Una fila que se parte sola en pantallas estrechas, con todo alineado por abajo.
    const clases = barra.className.split(" ");
    expect(clases).toContain("flex");
    expect(clases).toContain("flex-wrap");
    expect(clases).toContain("items-end");

    // Cada control cuelga de SU rótulo, y cada rótulo cuelga DIRECTAMENTE de la barra: sin un
    // segundo grupo flex anidado, que era lo que dejaba «Limpiar filtros» debajo de MATERIA.
    const controles = [
      screen.getByLabelText(ROTULO_BUSCADOR),
      screen.getByLabelText("Filtrar por materia"),
      screen.getByLabelText("Fecha de ingreso desde"),
      screen.getByLabelText("Fecha de ingreso hasta"),
    ];
    for (const control of controles) {
      expect(control.closest("label")?.parentElement).toBe(barra);
    }
    const limpiar = screen.getByText("Limpiar filtros").closest("button");
    expect(limpiar?.parentElement).toBe(barra);
    // «Limpiar filtros» va AL FINAL de la fila.
    expect(barra.lastElementChild).toBe(limpiar);
  });
});

/**
 * LA SINCRONIZACIÓN CON RESOLUCIÓN ES AUTOMÁTICA (Fase 03.24, Plan 07, D-09/D-10/D-13).
 *
 * Nadie sincroniza a mano: el botón y su modal se fueron. A cambio, bajo el título de la bandeja,
 * director y secretario ven UNA línea con la última sincronización — y nada si la integración está
 * apagada, que es como queda la pantalla mientras no se encienda.
 */
describe("BandejaEntradaPage — sincronización automática con Resolución (Fase 03.24)", () => {
  const ROTULO_LINEA = "Última sincronización";

  const encendida = (): EstadoSincronizacionResolucion => ({
    habilitada: true,
    intervaloMinutos: 5,
    enCurso: false,
    resultado: "CORRECTA",
    inicio: new Date(Date.now() - 3 * 60_000 - 5_000).toISOString(),
    fin: new Date(Date.now() - 3 * 60_000).toISOString(),
    motivo: null,
    lotes: 1,
    casosNuevos: 2,
    casosActualizados: 0,
    reingresados: 0,
    fallos: [],
    fallosTotales: 0,
    truncado: false,
  });

  /** Un lote APROBADO con un caso por sortear: el secretario tiene algo que aprobar y enviar. */
  const loteAprobado = (): EnvioLoteDto => ({
    ...lote(7, "PRB-ENV-777777"),
    envlStatus: "APROBADO",
    casos: [
      {
        envlcId: 1,
        eejeId: 101,
        expNumber: "101-2026",
        eejeStatus: "RECIBIDO",
        admiName: "Daniela",
        admiLastname: "Morales",
      },
    ],
  });

  let estadoPorDefecto: ReturnType<typeof mocks.estadoSincronizacion.getMockImplementation>;

  beforeEach(() => {
    vi.clearAllMocks();
    estadoPorDefecto = mocks.estadoSincronizacion.getMockImplementation();
    mocks.bandejaDirector.mockResolvedValue(pagina([lote(1, "PRB-ENV-111111")]));
    mocks.bandejaSecretario.mockResolvedValue(pagina([loteAprobado()]));
  });

  afterEach(() => {
    mocks.rolName = "director";
    if (estadoPorDefecto) {
      mocks.estadoSincronizacion.mockImplementation(estadoPorDefecto);
    }
  });

  it.each(["secretario abogado", "director"])(
    "🔴 %s: NO hay botón de sincronización manual (D-09)",
    async (rol) => {
      mocks.rolName = rol;
      pintar();
      await waitFor(() =>
        expect(screen.getAllByText(/PRB-ENV-/).length).toBeGreaterThan(0),
      );
      expect(
        screen.queryByRole("button", { name: /Sincronizar ingresos/ }),
      ).toBeNull();
    },
  );

  it.each(["secretario abogado", "director"])(
    "%s: con la integración encendida, la línea de la última sincronización aparece (D-13)",
    async (rol) => {
      mocks.rolName = rol;
      mocks.estadoSincronizacion.mockImplementation(async () => encendida());
      pintar();
      await waitFor(() =>
        expect(screen.getByText(new RegExp(ROTULO_LINEA))).toBeTruthy(),
      );
      expect(mocks.estadoSincronizacion).toHaveBeenCalled();
      // La línea visible ya no es `role="status"` (G-16): se lee su texto.
      expect(screen.getByText("correcta")).toBeTruthy();
    },
  );

  it("con la integración apagada la línea NO aparece: la pantalla queda como estaba (D-10)", async () => {
    pintar();
    await waitFor(() =>
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy(),
    );
    expect(mocks.estadoSincronizacion).toHaveBeenCalled();
    expect(screen.queryByText(new RegExp(ROTULO_LINEA))).toBeNull();
  });

  it("el secretario sigue teniendo su bandeja y «Aprobar y enviar a sorteo»: no dependía del botón retirado", async () => {
    mocks.rolName = "secretario abogado";
    pintar();
    await waitFor(() => expect(screen.getByText("101-2026")).toBeTruthy());

    expect(mocks.bandejaSecretario).toHaveBeenCalled();
    expect(mocks.bandejaDirector).not.toHaveBeenCalled();
    expect(screen.getByText("Lotes para enviar a sorteo")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Aprobar y enviar a sorteo/ }),
    ).toBeTruthy();
  });
});

/**
 * Plan 18 (G-13): la Bandeja se entera de lo que trajo la pasada.
 *
 * El sondeo de la línea de estado (60 s) es el que trae el `fin` nuevo. Si la pasada trajo casos y la
 * pantalla está tranquila, la lista se recarga sola por el mismo camino que «Actualizar», con los
 * mismos filtros y la misma página. Con una ficha abierta o una selección de casos, la lista NO se
 * toca: sale «Hay datos nuevos de Resolución · Recargar» y decide el usuario (T-03.24-70).
 */
describe("BandejaEntradaPage — datos nuevos de Resolución (Plan 18, G-13)", () => {
  const AVISO = "Hay datos nuevos de Resolución";
  const FIN_1 = "2026-10-21T10:00:05.000Z";
  const FIN_2 = "2026-10-21T10:05:05.000Z";

  const conFin = (
    fin: string,
    casosNuevos: number,
  ): EstadoSincronizacionResolucion => ({
    habilitada: true,
    intervaloMinutos: 5,
    enCurso: false,
    resultado: "CORRECTA",
    inicio: fin,
    fin,
    motivo: null,
    lotes: casosNuevos > 0 ? 1 : 0,
    casosNuevos,
    casosActualizados: 0,
    reingresados: 0,
    fallos: [],
    fallosTotales: 0,
    truncado: false,
  });

  /** Llega la pasada siguiente: el sondeo de la línea lee un `fin` nuevo. */
  const llegaPasada = async (fin: string, casosNuevos: number) => {
    mocks.estadoSincronizacion.mockImplementation(async () =>
      conFin(fin, casosNuevos),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
  };

  /** Espera a que la página haya leído la primera pasada (la línea ya se ve). */
  const esperarPrimeraLectura = () =>
    waitFor(() =>
      expect(screen.getByText(/Última sincronización/)).toBeTruthy(),
    );

  let estadoPorDefecto: ReturnType<
    typeof mocks.estadoSincronizacion.getMockImplementation
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    estadoPorDefecto = mocks.estadoSincronizacion.getMockImplementation();
    mocks.estadoSincronizacion.mockImplementation(async () => conFin(FIN_1, 2));
    mocks.bandejaDirector.mockResolvedValue(
      pagina([lote(1, "PRB-ENV-111111")]),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    mocks.rolName = "director";
    mocks.modalAbierto = false;
    if (estadoPorDefecto) {
      mocks.estadoSincronizacion.mockImplementation(estadoPorDefecto);
    }
  });

  it("sin nada abierto, una pasada con datos recarga la bandeja sola, en la misma página y sin aviso", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      pagina([lote(1, "PRB-ENV-111111")], 25),
    );
    pintar();
    await waitFor(() =>
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy(),
    );
    await esperarPrimeraLectura();
    // Se deja pasar el rebote del buscador del montaje (350 ms), que vuelve a la página 1.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    // A la página 2: la recarga sola tiene que conservarla.
    fireEvent.click(screen.getByTitle("Página siguiente"));
    await waitFor(() =>
      expect(mocks.bandejaDirector).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 10 }),
      ),
    );
    const antes = mocks.bandejaDirector.mock.calls.length;
    const filtrosDeAntes = mocks.bandejaDirector.mock.calls.at(-1)?.[0];

    await llegaPasada(FIN_2, 3);

    await waitFor(() =>
      expect(mocks.bandejaDirector.mock.calls.length).toBe(antes + 1),
    );
    expect(mocks.bandejaDirector).toHaveBeenLastCalledWith(filtrosDeAntes);
    expect(screen.queryByText(AVISO)).toBeNull();
    // Sin el velo de carga a pantalla completa.
    expect(velo()).toBeNull();
  });

  it("una pasada SIN datos no recarga ni avisa", async () => {
    pintar();
    await waitFor(() =>
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy(),
    );
    await esperarPrimeraLectura();
    const antes = mocks.bandejaDirector.mock.calls.length;

    await llegaPasada(FIN_2, 0);

    expect(mocks.bandejaDirector.mock.calls.length).toBe(antes);
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it("🔴 con una ficha abierta NO pide los lotes: pinta el aviso, y «Recargar» recarga y lo quita", async () => {
    mocks.modalAbierto = true;
    // Una respuesta NUEVA en cada consulta, como la red: el aviso se va cuando cambian los lotes, y
    // un `mockResolvedValue` devolvería siempre el mismo arreglo.
    mocks.bandejaDirector.mockImplementation(async () =>
      pagina([lote(1, "PRB-ENV-111111")]),
    );
    pintar();
    await waitFor(() =>
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy(),
    );
    await esperarPrimeraLectura();
    const antes = mocks.bandejaDirector.mock.calls.length;

    await llegaPasada(FIN_2, 3);

    await waitFor(() => expect(screen.getByText(AVISO)).toBeTruthy());
    expect(mocks.bandejaDirector.mock.calls.length).toBe(antes);

    // El usuario decide: «Recargar» hace lo mismo que «Actualizar».
    fireEvent.click(screen.getByRole("button", { name: "Recargar" }));
    await waitFor(() =>
      expect(mocks.bandejaDirector.mock.calls.length).toBe(antes + 1),
    );
    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull());
  });

  it("🔴 con una selección de casos para sortear NO pide los lotes: pinta el aviso", async () => {
    mocks.rolName = "secretario abogado";
    mocks.bandejaSecretario.mockResolvedValue(
      pagina([
        {
          ...lote(7, "PRB-ENV-777777"),
          envlStatus: "APROBADO",
          casos: [
            {
              envlcId: 1,
              eejeId: 101,
              expNumber: "101-2026",
              eejeStatus: "VERIFICADO",
              admiName: "Daniela",
              admiLastname: "Morales",
            },
          ],
        },
      ]),
    );
    pintar();
    const casilla = await screen.findByLabelText(
      "Seleccionar el caso de Daniela Morales",
    );
    await esperarPrimeraLectura();
    fireEvent.click(casilla);
    expect(casilla).toBeChecked();
    const antes = mocks.bandejaSecretario.mock.calls.length;

    await llegaPasada(FIN_2, 3);

    await waitFor(() => expect(screen.getByText(AVISO)).toBeTruthy());
    expect(mocks.bandejaSecretario.mock.calls.length).toBe(antes);
    // La selección sigue ahí: la lista no se tocó.
    expect(casilla).toBeChecked();
  });

  it("con la integración apagada no hay aviso aunque cambie la pasada (D-10)", async () => {
    mocks.estadoSincronizacion.mockImplementation(async () => ({
      ...conFin(FIN_1, 2),
      habilitada: false,
    }));
    mocks.modalAbierto = true;
    pintar();
    await waitFor(() =>
      expect(screen.getByText("PRB-ENV-111111")).toBeTruthy(),
    );
    mocks.estadoSincronizacion.mockImplementation(async () => ({
      ...conFin(FIN_2, 3),
      habilitada: false,
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.queryByText(AVISO)).toBeNull();
    expect(screen.queryByText(/Última sincronización/)).toBeNull();
  });
});

/**
 * EL `👁` Y EL `⑂` EN LA FILA (Fase 03.24, Plan 20 — G-04, UI-SPEC §2.1).
 *
 * El usuario lo decidió: «el director sí debería poder ver la línea de tiempo». Se abre desde la
 * FILA, justo después del `👁` y antes de «Devolver a DMR» —el orden del 03.19—, y nunca desde la
 * ficha (Pitfall 11). Antes del sorteo viaja `momento: "antesDelSorteo"`, para que el modal enseñe
 * la nota neutra y no el aviso falso de «sin identificador de asignación».
 */
describe("BandejaEntradaPage — `👁` y `⑂` en la fila (Plan 20, G-04)", () => {
  const casoFila = (
    eejeId: number,
    eejeStatus: string,
    expNumber?: string,
  ): NonNullable<EnvioLoteDto["casos"]>[number] => ({
    envlcId: eejeId,
    eejeId,
    expNumber,
    eejeStatus,
    admiName: "Daniela",
    admiLastname: "Morales",
  });

  const conCasos = (casos: NonNullable<EnvioLoteDto["casos"]>) =>
    pagina([{ ...lote(1, "PRB-ENV-111111"), casos }]);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rolName = "director";
    mocks.modalAbierto = false;
    mocks.bandejaDirector.mockResolvedValue(
      conCasos([casoFila(201, "RECIBIDO", "STUB-201-2026")]),
    );
  });

  afterEach(() => {
    mocks.rolName = "director";
  });

  it("como director, la fila tiene «Ver expediente …» y «Línea de tiempo de …»", async () => {
    pintar();
    expect(
      await screen.findByRole("button", { name: "Ver expediente STUB-201-2026" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Línea de tiempo de STUB-201-2026" }),
    ).toBeTruthy();
  });

  it("el orden del DOM es `👁` → `⑂` → «Devolver a DMR»", async () => {
    pintar();
    const ojo = await screen.findByRole("button", {
      name: "Ver expediente STUB-201-2026",
    });
    const linea = screen.getByRole("button", {
      name: "Línea de tiempo de STUB-201-2026",
    });
    const devolver = screen.getByText("Devolver a DMR").closest("button");
    if (!devolver) throw new Error("No se encontró «Devolver a DMR»");

    expect(
      ojo.compareDocumentPosition(linea) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      linea.compareDocumentPosition(devolver) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("el `👁` sigue abriendo la ficha como hoy", async () => {
    pintar();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver expediente STUB-201-2026" }),
    );
    expect(mocks.openModal).toHaveBeenCalledWith(
      "expedienteLote",
      expect.objectContaining({ eejeId: 201, expNumber: "STUB-201-2026" }),
      expect.objectContaining({ refetchFn: expect.any(Function) }),
    );
  });

  it("🔴 el `⑂` antes del sorteo abre la línea de tiempo con momento «antesDelSorteo», sin callbacks", async () => {
    pintar();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Línea de tiempo de STUB-201-2026",
      }),
    );
    expect(mocks.openModal).toHaveBeenCalledTimes(1);
    expect(mocks.openModal.mock.calls[0]).toEqual([
      "timeLine",
      { eejeId: 201, expNumber: "STUB-201-2026", momento: "antesDelSorteo" },
    ]);
  });

  it("con el caso ya sorteado (ASIGNADO_DECISOR) la llamada va sin momento", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      conCasos([casoFila(202, "ASIGNADO_DECISOR", "STUB-202-2026")]),
    );
    pintar();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Línea de tiempo de STUB-202-2026",
      }),
    );
    const [clave, datos] = mocks.openModal.mock.calls[0];
    expect(clave).toBe("timeLine");
    expect(datos).toMatchObject({ eejeId: 202, expNumber: "STUB-202-2026" });
    expect(datos.momento).toBeUndefined();
  });

  it("sin número de expediente, el nombre accesible usa el EPAS", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      conCasos([casoFila(203, "RECIBIDO")]),
    );
    pintar();
    expect(
      await screen.findByRole("button", { name: "Línea de tiempo del EPAS 203" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Ver expediente del EPAS 203" }),
    ).toBeTruthy();
  });

  it("como secretario abogado también ve el `⑂` [RECOMENDACIÓN UI-SPEC §2.2]", async () => {
    mocks.rolName = "secretario abogado";
    mocks.bandejaSecretario.mockResolvedValue(
      pagina([
        {
          ...lote(7, "PRB-ENV-777777"),
          envlStatus: "APROBADO",
          casos: [casoFila(204, "VERIFICADO", "STUB-204-2026")],
        },
      ]),
    );
    pintar();
    expect(
      await screen.findByRole("button", {
        name: "Línea de tiempo de STUB-204-2026",
      }),
    ).toBeTruthy();
  });

  it("los dos botones son la misma pieza: btn-sm btn-square btn-soft btn-primary", async () => {
    pintar();
    const ojo = await screen.findByRole("button", {
      name: "Ver expediente STUB-201-2026",
    });
    const linea = screen.getByRole("button", {
      name: "Línea de tiempo de STUB-201-2026",
    });
    for (const boton of [ojo, linea]) {
      for (const clase of ["btn-sm", "btn-square", "btn-soft", "btn-primary"]) {
        expect(boton.className).toContain(clase);
      }
    }
  });
});

/**
 * EL REINGRESO CON OBSERVACIONES EN LA FILA (Fase 03.24, Plan 24, G-01, UI-SPEC §1.2 y §1.6).
 *
 * La fila pinta UN solo estado y cada condición la decide el servidor: «Por devolver» gana; después,
 * «Reingresado · observaciones por verificar» en ámbar; si no, el chip de estado de siempre, con la
 * etiqueta baja «Reingresado» si el expediente volvió. La remisión dice cuántos reingresados se
 * quedaron por verificar, solo si el servidor manda la cifra.
 */
describe("BandejaEntradaPage — el reingreso con observaciones (Plan 24, G-01)", () => {
  const reingreso = (
    overrides: Partial<NonNullable<EnvioLoteCaso["reingreso"]>> = {},
  ): NonNullable<EnvioLoteCaso["reingreso"]> => ({
    reingresadoAt: "2026-10-21T10:00:00.000Z",
    total: 2,
    porVerificar: 0,
    cumplidas: 2,
    noCumplidas: 0,
    ...overrides,
  });

  const casoReingresado = (
    overrides: Partial<EnvioLoteCaso> = {},
  ): EnvioLoteCaso => ({
    envlcId: 1,
    eejeId: 10,
    expNumber: "001-2026",
    eejeStatus: "RECIBIDO",
    admiName: "Daniela",
    admiLastname: "Morales",
    observacionesTotal: 0,
    porDevolver: false,
    ...overrides,
  });

  const conCasos = (casos: EnvioLoteCaso[], extra: Partial<EnvioLoteDto> = {}) =>
    pagina([{ ...lote(1, "PRB-ENV-111111"), ...extra, casos }]);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rolName = "director";
    mocks.modalAbierto = false;
  });

  afterEach(() => {
    mocks.rolName = "director";
  });

  it("con observaciones por verificar, la fila enseña el chip ámbar en lugar del estado", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      conCasos([
        casoReingresado({
          reingreso: reingreso({ porVerificar: 2, total: 2, cumplidas: 0 }),
        }),
      ]),
    );
    pintar();
    const chip = await screen.findByText(CHIP_REINGRESO_POR_VERIFICAR);

    expect(chip.tagName).toBe("SPAN");
    for (const clase of [
      "app-item-list-info--media",
      "font-semibold",
      "text-[color:var(--app-plazo-fg-fuerte)]",
    ]) {
      expect(chip.className).toContain(clase);
    }
    // Ni rojo ni azul primario (L-2).
    expect(chip.className).not.toContain("text-error");
    expect(chip.getAttribute("title")).toBe(
      tituloChipReingreso("Recibido", { porVerificar: 2, total: 2 }),
    );
    // UN solo estado por fila: el chip de estado no se pinta (el estado va en el `title`).
    expect(screen.queryByText("Recibido")).toBeNull();
    expect(screen.queryByText("Por devolver")).toBeNull();
  });

  it("con «Por devolver» y alguna no cumplida, gana «Por devolver» con el `title` de las no cumplidas", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      conCasos([
        casoReingresado({
          porDevolver: true,
          reingreso: reingreso({
            porVerificar: 1,
            cumplidas: 0,
            noCumplidas: 1,
          }),
        }),
        // Sin no cumplidas: el `title` de siempre (observaciones nuevas anotadas).
        casoReingresado({
          envlcId: 2,
          eejeId: 11,
          expNumber: "002-2026",
          porDevolver: true,
          observacionesTotal: 2,
          reingreso: null,
        }),
      ]),
    );
    pintar();
    await screen.findByText("001-2026");

    const marcas = screen.getAllByText("Por devolver");
    expect(marcas).toHaveLength(2);
    expect(marcas[0].getAttribute("title")).toBe(
      tituloPorDevolverNoCumplidas("Recibido", 1),
    );
    expect(marcas[1].getAttribute("title")).toContain(
      "2 observaciones anotadas",
    );
    expect(screen.queryByText(CHIP_REINGRESO_POR_VERIFICAR)).toBeNull();
  });

  it("con todo cumplido, la fila enseña su estado y detrás la etiqueta baja «Reingresado»", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      conCasos([
        casoReingresado({
          reingreso: reingreso({ porVerificar: 0, total: 2, cumplidas: 2 }),
        }),
      ]),
    );
    pintar();
    await screen.findByText("001-2026");

    expect(screen.getByText("Recibido")).toBeTruthy();
    const etiqueta = screen.getByText(ETIQUETA_REINGRESADO);
    expect(etiqueta.className).toContain("app-item-list-info--baja");
    expect(etiqueta.getAttribute("title")).toMatch(/todas cumplidas\.$/);
    expect(screen.queryByText(CHIP_REINGRESO_POR_VERIFICAR)).toBeNull();
  });

  it("sin reingreso, la fila es la de siempre", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      conCasos([casoReingresado({ reingreso: null })]),
    );
    pintar();
    await screen.findByText("001-2026");

    expect(screen.getByText("Recibido")).toBeTruthy();
    expect(screen.queryByText(ETIQUETA_REINGRESADO)).toBeNull();
    expect(screen.queryByText(CHIP_REINGRESO_POR_VERIFICAR)).toBeNull();
  });

  it("el secretario no ve «Marcar revisado» mientras haya observaciones por verificar", async () => {
    mocks.rolName = "secretario abogado";
    mocks.bandejaSecretario.mockResolvedValue(
      conCasos(
        [
          casoReingresado({
            reingreso: reingreso({ porVerificar: 1, cumplidas: 1 }),
          }),
          // Testigo: el otro RECIBIDO, sin nada pendiente, sí lo ofrece.
          casoReingresado({
            envlcId: 2,
            eejeId: 11,
            expNumber: "002-2026",
            reingreso: null,
          }),
        ],
        { envlStatus: "APROBADO", envlAmasId: null },
      ),
    );
    pintar();
    await screen.findByText("002-2026");

    expect(screen.getAllByText("Marcar revisado")).toHaveLength(1);
  });

  const remitir = async () => {
    fireEvent.click(await screen.findByText("Remitir al secretario"));
    fireEvent.click(
      await waitFor(() => {
        const b = document.querySelector<HTMLButtonElement>(
          ".app-modules-modal-submit",
        );
        if (!b) throw new Error("No se abrió el diálogo de confirmación");
        return b;
      }),
    );
    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    return mocks.addToast.mock.calls[0][1] as string;
  };

  it("al remitir, el aviso dice cuántos reingresados se quedaron por verificar; sin la cifra, nada", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      conCasos([
        casoReingresado({
          reingreso: reingreso({ porVerificar: 1, cumplidas: 1 }),
        }),
      ]),
    );
    mocks.approveDirector.mockResolvedValueOnce({
      envlId: 1,
      remitido: true,
      retenidos: 0,
      retenidosPorVerificar: 1,
    });
    const { unmount } = pintar();
    expect(await remitir()).toContain(
      "1 expediente(s) reingresado(s) con observaciones por verificar NO se remitieron",
    );
    unmount();

    vi.clearAllMocks();
    mocks.approveDirector.mockResolvedValueOnce({
      envlId: 1,
      remitido: true,
      retenidos: 0,
    });
    pintar();
    expect(await remitir()).not.toContain(
      "con observaciones por verificar NO se remitieron",
    );
  });
});

/**
 * quick 261029-kl0 (EPAS 264 / lote 15, 127): una observación viva sobre un expediente remitido y sin
 * sortear lo devuelve al director. «Aprobar y enviar a sorteo» deja fuera lo que está con él y lo dice
 * en una advertencia; el director, tras revisar en la ficha, lo remite de nuevo desde su fila.
 */
describe("BandejaEntradaPage — la observación devuelve el expediente al director (quick 261029-kl0)", () => {
  const casoDelDirector = (
    overrides: Partial<EnvioLoteCaso> = {},
  ): EnvioLoteCaso => ({
    envlcId: 1,
    eejeId: 264,
    expNumber: "264-2026",
    eejeStatus: "RECIBIDO",
    admiName: "Daniela",
    admiLastname: "Morales",
    observacionesTotal: 0,
    porDevolver: false,
    remitidoAlSecretario: false,
    ...overrides,
  });

  const loteAprobado = (casos: EnvioLoteCaso[]) =>
    pagina([
      {
        ...lote(15, "PRB-ENV-000015"),
        envlStatus: "APROBADO",
        envlAmasId: null,
        casos,
      },
    ]);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rolName = "director";
    mocks.modalAbierto = false;
  });

  afterEach(() => {
    mocks.rolName = "director";
  });

  it("director, lote APROBADO sin sortear, caso RECIBIDO sin remitir y sin marca → «Remitir al secretario» en la fila", async () => {
    mocks.bandejaDirector.mockResolvedValue(loteAprobado([casoDelDirector()]));
    mocks.aprobarPorDirector.mockResolvedValue(undefined);
    pintar();

    const boton = await screen.findByText("Remitir al secretario");
    fireEvent.click(boton);

    await waitFor(() =>
      expect(mocks.aprobarPorDirector).toHaveBeenCalledWith(264),
    );
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Expediente 264-2026 remitido al secretario.",
      ),
    );
    // Recarga la bandeja: la de la carga inicial y la de después de remitir.
    await waitFor(() =>
      expect(mocks.bandejaDirector).toHaveBeenCalledTimes(2),
    );
  });

  it("con «Por devolver» NO aparece «Remitir al secretario»: aparece «Devolver a DMR»", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      loteAprobado([casoDelDirector({ porDevolver: true, observacionesTotal: 1 })]),
    );
    pintar();
    await screen.findByText("264-2026");

    expect(screen.queryByText("Remitir al secretario")).toBeNull();
    expect(screen.getByText("Devolver a DMR")).toBeTruthy();
  });

  it("si el servidor no manda remitidoAlSecretario, no se ofrece", async () => {
    mocks.bandejaDirector.mockResolvedValue(
      loteAprobado([casoDelDirector({ remitidoAlSecretario: undefined })]),
    );
    pintar();
    await screen.findByText("264-2026");

    expect(screen.queryByText("Remitir al secretario")).toBeNull();
  });

  it("si la remisión falla, el error va al aviso flotante", async () => {
    mocks.bandejaDirector.mockResolvedValue(loteAprobado([casoDelDirector()]));
    mocks.aprobarPorDirector.mockRejectedValue(
      errorDelServidor("El EPAS 264 no se puede remitir al secretario."),
    );
    pintar();

    fireEvent.click(await screen.findByText("Remitir al secretario"));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "El EPAS 264 no se puede remitir al secretario.",
      ),
    );
  });

  const aprobarYEnviar = async () => {
    fireEvent.click(
      await screen.findByRole("button", { name: /Aprobar y enviar a sorteo/ }),
    );
    fireEvent.click(
      await waitFor(() => {
        const b = document.querySelector<HTMLButtonElement>(
          ".app-modules-modal-submit",
        );
        if (!b) throw new Error("No se abrió el diálogo de confirmación");
        return b;
      }),
    );
    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
  };

  it("secretario: «Aprobar y enviar a sorteo» con excluidos → UNA advertencia con las dos cifras", async () => {
    mocks.rolName = "secretario abogado";
    mocks.bandejaSecretario.mockResolvedValue(
      loteAprobado([
        casoDelDirector({
          eejeId: 1,
          expNumber: "001-2026",
          eejeStatus: "VERIFICADO",
          remitidoAlSecretario: true,
        }),
      ]),
    );
    mocks.aprobarEnviarSorteo.mockResolvedValue({
      envlId: 15,
      status: "APROBADO",
      amasId: 900,
      sorteados: 3,
      excluidos: 2,
    });
    pintar();

    await aprobarYEnviar();

    expect(mocks.aprobarEnviarSorteo).toHaveBeenCalledWith(15);
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    const [variante, mensaje] = mocks.addToast.mock.calls[0];
    expect(variante).toBe("warning");
    expect(mensaje).toContain("3 expediente(s) enviados al sorteo");
    expect(mensaje).toContain("2 no se sortearon");
    expect(mensaje).toContain("director");
  });

  it("secretario: sin excluidos → el aviso de éxito de siempre", async () => {
    mocks.rolName = "secretario abogado";
    mocks.bandejaSecretario.mockResolvedValue(
      loteAprobado([
        casoDelDirector({
          eejeId: 1,
          expNumber: "001-2026",
          eejeStatus: "VERIFICADO",
          remitidoAlSecretario: true,
        }),
      ]),
    );
    mocks.aprobarEnviarSorteo.mockResolvedValue({
      envlId: 15,
      status: "ENVIADO_SORTEO",
      amasId: 900,
      sorteados: 1,
      excluidos: 0,
    });
    pintar();

    await aprobarYEnviar();

    expect(mocks.addToast).toHaveBeenCalledWith(
      "success",
      "Lote PRB-ENV-000015 aprobado y enviado al sorteo.",
    );
  });
});
