/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: «Mis Expedientes» — la bandeja del decisor en tabla (Fase 03.19, Plan 17)
 * Archivo: MisAsignadosPage.test.tsx
 * Responsabilidad: Fijar las conductas que esta pantalla es la ÚNICA que puede demostrar, porque
 *   es la única que monta la tabla, el catálogo de acciones, la ficha y la línea de tiempo a la vez.
 *
 *   ── 🔴 LO QUE ESTE ARCHIVO PROTEGE, EN ORDEN DE LO QUE COSTARÍA PERDERLO ────────────────────
 *   1. **Que no haya bucle de peticiones (D-09).** Montar pide UNA vez; filtrar añade UNA. La
 *      bandeja lleva cédula, teléfono y dirección del administrado en cada página: una tabla que se
 *      pida a sí misma en cada render no es sólo lenta, es un goteo de datos personales.
 *   2. **Que la fila lleve `caseId` al modal de la línea de tiempo (D-07/D-10).** `MiEpasAsignado`
 *      lo trae desde el Plan 03; si este cableado lo dejara caer, el modal enseñaría su aviso de
 *      «media traza» también sobre los nueve expedientes que SÍ tienen identidad en Asignaciones, y
 *      nadie sabría distinguir el caso degradado del caso roto.
 *   3. **Que un fallo de carga NO se lea como «no tiene expedientes» (UI-SPEC §1.7, deferred §19).**
 *      Es la afirmación más peligrosa que esta pantalla puede hacer: el decisor concluye que no le
 *      han asignado nada y se va.
 *   4. **Que la entrada al correctivo siga abierta (CR-01).** El caso caro es «expediente SIN
 *      correctivo»: la pantalla de la rama es precisamente donde se declara, y apagar la puerta ahí
 *      deja la rama inalcanzable por toda vía de interfaz. Esta conducta se hereda SIN TOCAR.
 *
 *   ── QUÉ SE RETIRÓ DE LA VERSIÓN ANTERIOR, Y ADÓNDE FUE ──────────────────────────────────────
 *   Las tres pruebas del gate de la multa compulsoria. No se pierden: el bloque que gateaban se
 *   mudó a la ficha con el Plan 10, y desde el quick 261014-kn3 vive SOLO en la página de la
 *   obligación de hacer, único sitio donde se monta. La bandeja ya no lo monta, así que aquí no hay
 *   nada que afirmar; la conducta la cubre hoy `ObligacionHacerPage.test.tsx` («la serie
 *   compulsoria se monta con el `permiteRegistrar` que dice el MOTOR…»).
 *   Mantenerlas adaptadas habría sido una prueba verde protegiendo un camino que ya no existe.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 17: la pantalla pasó de lista de
 *   tarjetas a tabla, así que este archivo se reescribe entero en vez de parchearse.)
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 19, gap 4 del UAT: «Aceptar» y
 *   «Excusarme» sobre una fila ya aceptada —y sobre una autoaceptada al vencer el plazo— salen
 *   presentes y apagadas con su porqué; y sobre una SIN aceptar las dos siguen pulsables.)
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 06, gap 1 del UAT: la confirmación de
 *   «Anular» pasó del diálogo del navegador al cascarón del módulo. Las dos pruebas que espiaban
 *   ese diálogo se CONVIERTEN —no se borran: las conductas que protegen son contrato de UI— y se
 *   añaden tres, entre ellas la que fija CH-5 en conducta observable.)
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-g35: la columna «Materia» —la del
 *   EXPEDIENTE— y su filtro de catálogo, con opciones del catálogo local de entonces. Entró el doble
 *   de aquel servicio, la lista de cabeceras pasó de 17 a 18 y un describe nuevo fijó la celda, las
 *   opciones, la petición, la etiqueta en la barra, el anti-bucle y el fallo del catálogo)
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: dos columnas, «Materia» —la PADRE— y
 *   «Submateria», ambas del expediente, con sus filtros de catálogo remoto. La lista de cabeceras
 *   pasó de 18 a 19 y el describe del g35 se reescribió —no se duplicó— para las dos)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: solo la cabecera. El gate de la multa
 *   compulsoria ya no vive en la ficha sino en la página de la obligación de hacer.)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 17 — D-16/D-17: «Materia» y
 *   «Submateria» pasan a ser las DEDUCIDAS del código de las infracciones y filtran por CÓDIGO del
 *   diccionario CAT v1.3 (`materiaCod`, `submateriaCod`); el doble del catálogo local se sustituye
 *   por el de `InfraccionesService.diccionario`. Entra la columna «Infracciones» con su filtro de
 *   texto `infraccion`: la lista de cabeceras pasa de 19 a 20 y un describe nuevo la fija)
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 11, D-05): el describe de la columna
 *   «Infracciones» fija que el aviso «Datos de Resolución incompletos» sale en esa celda, debajo de
 *   la de la 03.23, cuando el servidor manda faltantes, y no sale con `null`.)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el rechazo de la anulación se afirma
 *   en el aviso flotante; ConfirmationDetail ya no lo pinta en una caja)
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-m29: describe nuevo del ENLACE PROFUNDO de
 *   la campana — `?eeje=&exp=&pestana=` abre la ficha, limpia la query y avisa si ya no está)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29, Task 4b: describe nuevo del CONTADOR
 *   de documentos sin leer junto al número de expediente — con los ids de la página cargada, sin
 *   otra petición a la bandeja, nada con 0, la tabla igual si falla y recalculado al recargar)
 * Modificado por: Andrés Miño — 2026-11-04 (revisión 261030-m29, IN-07: una respuesta del enlace
 *   que llega tarde —otro enlace o la página desmontada— no abre ni limpia nada)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: «Materia»/«Submateria» filtran por ids
 *   de Sorteo (`materiaId`, `submateriaId`) cargados del doble de `InfraccionesService.materias`; la
 *   celda dice «Sin materia» con el flag del resumen)
 */
import { errorDeRed, errorDelServidor } from "../test/errores";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import type { MiEpasAsignado } from "../services/SorteoService";
import type {
  ObligacionHacerEnBandeja,
  TerminoAlegacion,
} from "../interfaces/IObligacionHacer";
import {
  crearMiEpasAsignado,
  crearMiEpasAsignadoConOrdenes,
  crearMiEpasAsignadoPendiente,
  crearMiEpasAsignadoSinCaseId,
} from "../test/fixtures/miEpasAsignado";

const mocks = vi.hoisted(() => ({
  misAsignados: vi.fn(),
  addToast: vi.fn(),
  openModal: vi.fn(),
  rolName: { valor: "funcionario decisor" },
  registrarOrden: vi.fn(),
  anularOrden: vi.fn(),
  historialOrdenes: vi.fn(),
  materias: vi.fn(),
  // quick 261030-m29: el contador de documentos sin leer. Con implementación propia (que
  // `vi.clearAllMocks` conserva): por defecto nada sin leer, y los describe de antes no lo notan.
  contarNoLeidos: vi.fn(async () => ({}) as Record<number, number>),
}));

vi.mock("../services/SorteoService", () => ({
  SorteoService: {
    misAsignados: mocks.misAsignados,
    aceptarCaso: vi.fn(),
  },
}));

// Desde la Fase 03.22 las dos columnas de orden de pago montan `CeldaOrden`, que consume este
// servicio: sin el doble, teclear en una celda saldría a la red desde jsdom.
vi.mock("../services/OrdenPagoService", () => ({
  OrdenPagoService: {
    registrar: mocks.registrarOrden,
    anular: mocks.anularOrden,
    historial: mocks.historialOrdenes,
  },
}));

vi.mock("../services/EpasService", () => ({
  default: { descargarExpediente: vi.fn() },
}));

// Quick 261104-jh1: las celdas de los filtros «Materia» y «Submateria» cargan sus opciones de las
// materias de Sorteo (`GET /infracciones/materias`) a través de este servicio. Sin el
// doble, montar la bandeja saldría a la red desde jsdom. Se dobla SOLO el objeto del servicio: el
// resto del módulo —`ETIQUETA_ESTADO_CORE`, que lee la celda «Infracciones»— es el real, para que
// la prueba lea la misma redacción que verá el usuario.
vi.mock("../services/InfraccionesService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../services/InfraccionesService")>();
  const doble = { materias: mocks.materias, ficha: vi.fn() };
  return { ...real, InfraccionesService: doble, default: doble };
});

vi.mock("../services/DocumentosLecturaService", () => ({
  DocumentosLecturaService: { contar: mocks.contarNoLeidos },
}));

vi.mock("../context/UserContext", () => ({
  useUser: () => ({
    user: { usuId: 4, rolName: mocks.rolName.valor },
    sessionState: "authenticated",
  }),
}));

vi.mock("../hooks/useModal", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));

vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

// Los modales de desenlace arrastran el visor, y con él `react-pdf`, que en jsdom no tiene
// `DOMMatrix`. Se dobla el VISOR y no los modales: así la página sigue montando su árbol real —que
// es lo que estas pruebas miran— sin cargar el lector de PDF.
vi.mock("../components/pdf/PDFViewer", () => ({
  PDFViewer: () => null,
}));

import MisAsignadosPage from "./MisAsignadosPage";

/** Un término base: el traslado corrido y el plazo CORRIENDO (todavía no habilita la multa). */
const TERMINO: TerminoAlegacion = {
  estado: "EN_CURSO",
  motivo: null,
  trasladoDocId: 4120,
  trasladoEmitidoAt: "2026-09-01T14:00:00.000Z",
  arrancaAt: "2026-09-03T14:00:00.000Z",
  arrancoPorAgotamiento: false,
  plazoDias: 10,
  venceAt: "2026-09-17T23:59:59.000Z",
  vencido: false,
  diasHabilesRestantes: 4,
  calendarioCargadoHasta: 2026,
  habilitaMultaCompulsoria: false,
  alegacionDocId: null,
  alegacionIngresadaAt: null,
  terminoUsado: false,
  alegacionResueltaAt: null,
  alegacionPendiente: false,
};

const CORRECTIVO: ObligacionHacerEnBandeja = {
  tiene: true,
  cumplida: false,
  cumplidaAt: null,
  multasCompulsorias: 0,
  tieneInforme: true,
  sustitutoriaOrdenada: false,
  terminoAlegacion: TERMINO,
};

/** El sobre paginado que el endpoint devuelve desde el Plan 03. */
const sobreCon = (filas: MiEpasAsignado[], total = filas.length) => ({
  data: filas,
  total,
  limit: 10,
  offset: 0,
  page: 1,
  pages: Math.ceil(total / 10),
});

/** Monta la bandeja con las filas dadas y espera a que la primera carga pinte. */
const montar = async (filas: MiEpasAsignado[]) => {
  mocks.misAsignados.mockResolvedValue(sobreCon(filas));
  render(
    <MemoryRouter>
      <MisAsignadosPage />
    </MemoryRouter>,
  );
  await screen.findByText(filas[0].expNumber as string);
};

/** Abre el `⋮` de la fila indicada por su número de expediente. */
const abrirMenu = (expNumber: string) => {
  fireEvent.click(
    screen.getByRole("button", { name: `Acciones del EPAS ${expNumber}` }),
  );
};

/**
 * Las materias de Sorteo que sirve el doble de `GET /infracciones/materias` (quick 261104-jh1),
 * recortadas a lo que estas pruebas eligen, con los ids reales de Sorteo. No son datos personales.
 */
const MATERIAS_SORTEO = {
  disponible: true,
  origen: "SIMULADO",
  materias: [
    { id: 22, nombre: "AMBIENTE" },
    { id: 26, nombre: "LICENCIAMIENTO" },
  ],
  submaterias: [
    { id: 43, materiaId: 26, nombre: "EDIFICACIÓN" },
    { id: 54, materiaId: 26, nombre: "LUAE" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rolName.valor = "funcionario decisor";
  mocks.materias.mockResolvedValue(MATERIAS_SORTEO);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — la tabla y su contrato de peticiones (D-09)", () => {
  it("🔴 al montar pide la bandeja UNA sola vez, con la página 1 y sin filtros", async () => {
    await montar([crearMiEpasAsignado()]);

    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);
    expect(mocks.misAsignados.mock.calls[0][0]).toEqual({
      pageIndex: 0,
      pageSize: 10,
      filterParams: {},
    });
  });

  it("🔴 filtrar un nombre añade UNA petición, con ese filtro y la página REINICIADA", async () => {
    await montar([crearMiEpasAsignado()]);
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);

    // El nombre accesible del control, no el `placeholder`: las nueve columnas de texto comparten
    // el mismo «buscar...» y localizarlas por ahí sería localizar cualquiera de las nueve.
    fireEvent.change(screen.getByLabelText("Filtrar por Nombres"), {
      target: { value: "Gabriela" },
    });

    await waitFor(
      () => expect(mocks.misAsignados).toHaveBeenCalledTimes(2),
      // ⚠️ 4 s y no 2: el debounce del filtro es de 500 ms, pero en jsdom bajo carga la cadena
      // cambio → debounce → efecto de carga → promesa ha llegado a pasar de dos segundos. Es el
      // mismo modo de fallo que la entrada 44 del deferred documenta para el caso análogo de
      // `Table.test.tsx`; un margen corto produce rojos que no hablan de ninguna regresión.
      { timeout: 4000 },
    );
    expect(mocks.misAsignados.mock.calls[1][0]).toEqual({
      pageIndex: 0,
      pageSize: 10,
      // La clave es `admiName` porque es el `id` de la columna, y el `id` es el nombre que
      // `FilterMisAsignadosDto` declara. Una letra distinta sería un 400 sin explicación.
      filterParams: { admiName: "Gabriela" },
    });

    // 🔴 LA MEDIDA ANTI-BUCLE. 1.200 ms de reloj REAL, más del doble del debounce de 500 ms: si
    // `columnas` o `buscarBandeja` cambiaran de identidad en cada render, aquí habría ya una
    // tercera petición —y una cuarta, y una quinta—.
    await new Promise((resolver) => setTimeout(resolver, 1200));
    expect(mocks.misAsignados).toHaveBeenCalledTimes(2);
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // 🔴 LA PRUEBA QUE DE VERDAD MUERDE LA MEMOIZACIÓN, Y POR QUÉ HACEN FALTA LAS DOS.
  //
  // La de arriba demuestra que no hay bucle AUTOSOSTENIDO —una petición se responde y no engendra
  // otra—, y es la que el Plan 06 pedía. Pero por sí sola NO detecta que `columnas` deje de estar
  // memoizada: medido con una mutación sembrada (quitar el `useMemo` y construir el array en el
  // render) las diecinueve pruebas seguían en verde, porque la PÁGINA no se vuelve a renderizar
  // sola —los renders de la tabla no la alcanzan— y sin re-render del padre la identidad nueva
  // nunca llega a nacer.
  //
  // Lo que la destapa es un re-render del PADRE por cualquier motivo ajeno a la tabla. Abrir la
  // confirmación de «Aceptar» es exactamente eso, y es además algo que el decisor hace todos los
  // días: con `columnas` sin memoizar, ese clic vuelve a pedir la bandeja entera.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("🔴 un re-render de la página (abrir «Aceptar») NO vuelve a pedir la bandeja", async () => {
    const fila = crearMiEpasAsignadoPendiente({
      eejeStatus: "ASIGNADO_DECISOR",
    });
    await montar([fila]);
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);

    abrirMenu(fila.expNumber as string);
    fireEvent.click(screen.getByRole("menuitem", { name: /^aceptar/i }));
    await screen.findByText("Aceptar el caso asignado");

    // Un margen de reloj real, para que una petición tardía tenga tiempo de aparecer.
    await new Promise((resolver) => setTimeout(resolver, 600));
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);
  });

  it("la columna ESTATUS pinta la etiqueta legible, no el valor crudo del enum", async () => {
    await montar([
      crearMiEpasAsignado({ eejeStatus: "EN_VERIFICACION_PAGO" }),
    ]);

    expect(screen.getByText("En verificación de pago")).toBeInTheDocument();
    expect(screen.queryByText("EN_VERIFICACION_PAGO")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — el vacío y el fallo NO son lo mismo (UI-SPEC §1.7 / §5.1)", () => {
  it("sin expedientes asignados dice que no hay ninguno, y NO ofrece reintentar", async () => {
    mocks.misAsignados.mockResolvedValue(sobreCon([]));
    render(
      <MemoryRouter>
        <MisAsignadosPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("No tiene expedientes asignados"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });

  it("🔴 si la carga FALLA lo dice y ofrece reintentar, y NO afirma que no haya expedientes", async () => {
    mocks.misAsignados.mockRejectedValue(errorDeRed());
    render(
      <MemoryRouter>
        <MisAsignadosPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/No se pudieron cargar sus expedientes/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    // El motivo del servidor se enseña como DETALLE, no se traga ni se manda a la consola.
    expect(
      screen.getByText(/No se pudo conectar con el servidor/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Network Error/)).toBeNull();

    // 🔴 LA AFIRMACIÓN QUE IMPORTA. El vacío de la tabla sigue en el DOM —la tabla no se desmonta,
    // para no perder los filtros— pero está OCULTO: ni se ve ni lo anuncia un lector de pantalla.
    expect(
      screen.getByText("No tiene expedientes asignados"),
    ).not.toBeVisible();
  });

  it("🔴 «Reintentar» vuelve a pedir SIN remontar, y al responder bien el aviso desaparece", async () => {
    mocks.misAsignados
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValue(sobreCon([crearMiEpasAsignado()]));

    render(
      <MemoryRouter>
        <MisAsignadosPage />
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "Reintentar" });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("EPAS-2026-04101")).toBeVisible();
    expect(
      screen.queryByText(/No se pudieron cargar sus expedientes/i),
    ).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — los tres controles de la fila (D-10)", () => {
  it("🔴 el `👁` abre la ficha en modo decisor, con las cuatro cosas DENTRO de los datos del caso", async () => {
    const fila = crearMiEpasAsignado();
    await montar([fila]);

    fireEvent.click(
      screen.getByRole("button", { name: `Ver expediente ${fila.expNumber}` }),
    );

    expect(mocks.openModal).toHaveBeenCalledTimes(1);
    const [clave, datos, callbacks] = mocks.openModal.mock.calls[0];
    expect(clave).toBe("expedienteLote");
    // 🔴 Las cuatro van DENTRO de `caseData`: `ModalContainer` sólo reparte tres props y cualquier
    // otra cosa entregada suelta se perdería sin que nada fallara.
    expect(datos).toMatchObject({
      eejeId: fila.eejeId,
      bandeja: "decisor",
      rolName: "funcionario decisor",
      recargaSenal: 0,
    });
    expect(callbacks.refetchFn).toBeInstanceOf(Function);
  });

  it("🔴 el `⑂` abre la línea de tiempo LLEVANDO el `caseId` de la fila", async () => {
    const fila = crearMiEpasAsignado();
    await montar([fila]);

    fireEvent.click(
      screen.getByRole("button", {
        name: `Línea de tiempo de ${fila.expNumber}`,
      }),
    );

    expect(mocks.openModal).toHaveBeenCalledWith("timeLine", {
      eejeId: 4101,
      // Ésta es la afirmación. Sin ella el modal enseñaría su aviso de media traza sobre un
      // expediente que SÍ tiene identidad en Asignaciones.
      caseId: 8801,
      expNumber: "EPAS-2026-04101",
    });
  });

  it("🔴 y con una fila SIN identificador de asignación sigue abriendo: la degradación es del modal", async () => {
    // 63 de los 72 reflejos de la base de hoy están así. Esconder el botón dejaría sin traza
    // interna —que sí existe— a la mayoría de los expedientes.
    const fila = crearMiEpasAsignadoSinCaseId();
    await montar([fila]);

    const boton = screen.getByRole("button", {
      name: `Línea de tiempo de ${fila.expNumber}`,
    });
    expect(boton).not.toBeDisabled();
    fireEvent.click(boton);

    expect(mocks.openModal).toHaveBeenCalledWith("timeLine", {
      eejeId: 4103,
      caseId: undefined,
      expNumber: "EPAS-2026-04103",
    });
  });

  it("los dos botones de icono tienen nombre accesible con el número de expediente", async () => {
    await montar([crearMiEpasAsignado()]);

    // En una tabla de veinte filas, «Ver expediente» a secas no distingue ninguna.
    expect(
      screen.getByRole("button", { name: "Ver expediente EPAS-2026-04101" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Línea de tiempo de EPAS-2026-04101",
      }),
    ).toBeInTheDocument();
  });

  /**
   * 🔴 LA DIRECCIÓN DE LA BURBUJA ES UNA DECISIÓN MEDIDA, NO UN GUSTO — y esta prueba está aquí
   * para que nadie la «normalice» al valor por defecto del componente y devuelva el gap 4 del UAT
   * de la 03.22 («no se sobrepone a la columna y se muestra detrás»). Hacia abajo, la burbuja sale
   * a 0,5rem del borde del botón y la fila sólo tiene 0,4724rem de relleno: cae entera en la banda
   * de la fila siguiente —cuya celda fija empata en capa y gana por orden del documento— y, en la
   * última fila visible, fuera del recuadro con scroll, que la recorta.
   *
   * ⚠️ LO QUE ESTA PRUEBA NO AFIRMA: que la burbuja se LEA. jsdom no calcula CSS —no posiciona un
   * pseudo-elemento, no resuelve orden de pintado y no recorta nada—. Lo único comprobable aquí es
   * que la clase de dirección está puesta en el envoltorio. Que se lea entera, en una fila del
   * medio y en la última visible, con ratón y con teclado, es el UAT de la fase (ronda 3,
   * comprobaciones 6 y 7, en los dos temas).
   */
  it("🔴 los DOS botones sacan su tooltip de lado: hacia abajo se sale de la banda de su fila", async () => {
    await montar([crearMiEpasAsignado()]);

    const envoltorioDe = (nombreAccesible: string) =>
      screen.getByRole("button", { name: nombreAccesible }).closest(".tooltip");

    expect(envoltorioDe("Ver expediente EPAS-2026-04101")).toHaveClass(
      "tooltip-left",
    );
    expect(envoltorioDe("Línea de tiempo de EPAS-2026-04101")).toHaveClass(
      "tooltip-left",
    );

    // Y ninguno se quedó con el valor por defecto, que es el que produce el defecto.
    expect(document.querySelectorAll(".tooltip-bottom")).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — el `⋮` y sus doce entradas (D-05, D-11, D-12)", () => {
  it("🔴 D-12: «Generar documento» es un ENLACE a la página del expediente, y no abre ningún modal", async () => {
    const fila = crearMiEpasAsignado();
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    const entrada = screen.getByRole("menuitem", {
      name: /generar documento/i,
    });
    expect(entrada).not.toBeDisabled();
    // Un enlace de verdad, no un botón que navega: se puede abrir en otra pestaña sin perder la
    // bandeja. La ruta sale del literal único de `rutasGeneracionDocumento.ts`.
    expect(entrada).toHaveAttribute(
      "href",
      "/home/mis-asignados/document-generate/4101",
    );

    fireEvent.click(entrada);
    expect(mocks.openModal).not.toHaveBeenCalled();
  });

  // 🔴 LA PÁGINA DE GENERACIÓN SE SIRVE SÓLO AL DECISOR, y la entrada que lleva a ella tiene que
  // saberlo. Si el `⋮` la ofreciera ENCENDIDA a un secretario, pulsarla lo sacaría de la bandeja y
  // lo devolvería al panel sin una sola palabra de explicación: la ruta está protegida por rol y el
  // enrutador no negocia. El motor ya lo decide —la regla nombra sólo al decisor—; esto lo fija,
  // porque es el tipo de invariante que una entrada nueva en la lista de roles rompería en silencio.
  it("🔴 «Generar documento» NO se ofrece encendida a quien no puede abrir la página", async () => {
    mocks.rolName.valor = "secretario abogado";
    const fila = crearMiEpasAsignado();
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    const entrada = screen.getByRole("menuitem", {
      name: /generar documento/i,
    });
    // Presente —el paso existe y el secretario tiene derecho a saberlo— y apagada con su motivo.
    expect(entrada).toBeDisabled();
    expect(entrada.getAttribute("title") ?? "").toMatch(
      /su rol no interviene en este paso/i,
    );
  });

  it("🔴 D-05: el `⋮` del decisor NO ofrece «Formas de notificación»", async () => {
    // Su sitio es el paso 3 de la página de generación. Que siga aquí significaría dos puertas al
    // mismo acto, una de ellas fuera del orden que la emisión necesita.
    const fila = crearMiEpasAsignado();
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    expect(
      screen.queryByRole("menuitem", { name: /formas de notificación/i }),
    ).not.toBeInTheDocument();
  });

  it("ofrece las DOCE entradas del catálogo, ni una más ni una menos", async () => {
    const fila = crearMiEpasAsignado();
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    expect(screen.getAllByRole("menuitem")).toHaveLength(12);
  });

  it("🔴 D-11: sobre un expediente SIN aceptar, lo que no procede sale APAGADO CON SU MOTIVO", async () => {
    // ⚠️ El estado se fija a `ASIGNADO_DECISOR` y no se hereda del fixture, que dice `SORTEADO`.
    // `aceptarCaso` exige ESE estado —es el que significa «hay un decisor esperando a decidir»— y
    // con `SORTEADO` la entrada sale apagada por estado, que es una conducta correcta pero OTRA: no
    // es la que esta prueba viene a fijar. Se pide explícitamente en vez de heredarla.
    const fila = crearMiEpasAsignadoPendiente({
      eejeStatus: "ASIGNADO_DECISOR",
    });
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    // Presente, no ausente: el decisor tiene que saber que el paso existe aunque no le toque.
    const generar = screen.getByRole("menuitem", {
      name: /generar documento/i,
    });
    expect(generar).toBeDisabled();
    expect(generar.getAttribute("title") ?? "").toMatch(/aceptó el caso/i);

    // Y «Aceptar» y «Excusarme», que es lo único que sí puede hacer, van ENCENDIDAS.
    //
    // 🔴 LAS DOS, Y NO SOLO «Aceptar» (Fase 03.19, Plan 19 — gap 4 del UAT). El arreglo de ese gap
    // les puso a las dos el gate de la aceptación que la versión de tarjetas tenía a mano, y el
    // riesgo REAL de ese arreglo era pasarse de frenada: apagar aquí dejaría la bandeja del decisor
    // sin las dos únicas decisiones que existe para pedirle. Esta es la mitad del listón que lo
    // impide; la otra es la prueba de la fila ya aceptada, más abajo.
    for (const patron of [/^aceptar/i, /excusarme/i]) {
      expect(
        screen.getByRole("menuitem", { name: patron }),
        String(patron),
      ).not.toBeDisabled();
    }
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // EL GAP 4 DEL UAT DEL 2026-09-22, TRADUCIDO AL IDIOMA DEL REPORTE (Fase 03.19, Plan 19).
  //
  // «Veo las opciones de Aceptar y excusarme activas luego de que el expediente ya está aceptado o
  // autoaceptado por el funcionario». Las pruebas de `politicaAcciones.test.ts` prueban el MOTOR;
  // estas dos prueban que la PANTALLA lo consume —que `accionesDeLaFila` recibe la fila y no una
  // bolsa vacía—, que es justo el cableado que el paso a tabla del Plan 17 perdió.
  // ───────────────────────────────────────────────────────────────────────────────────────────

  it("🔴 sobre un expediente YA ACEPTADO, «Aceptar» y «Excusarme» salen PRESENTES y APAGADAS", async () => {
    // El caso base del fixture ya trae `aceptado: true`; lo que se pide explícitamente es el estado,
    // porque las dos reglas exigen ASIGNADO_DECISOR y con otro estado el apagado sería por estado —
    // una conducta correcta pero OTRA, y no la que esta prueba viene a fijar—.
    const fila = crearMiEpasAsignado({ eejeStatus: "ASIGNADO_DECISOR" });
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    // Apagar no es esconder (D-7): el submenú sigue ofreciendo las DOCE entradas.
    expect(screen.getAllByRole("menuitem")).toHaveLength(12);

    for (const patron of [/^aceptar/i, /excusarme/i]) {
      const entrada = screen.getByRole("menuitem", { name: patron });
      expect(entrada, String(patron)).toBeDisabled();
      // Con su porqué, y leído del derecho: nunca «solo procede si el decisor ya aceptó el caso».
      const titulo = entrada.getAttribute("title") ?? "";
      expect(titulo, String(patron)).toMatch(/sigue sin aceptar/i);
      expect(titulo, String(patron)).not.toMatch(/ya aceptó el caso/i);
    }
  });

  it("🔴 y AUTOACEPTADO al vencer el plazo, igual: es el caso literal del reporte", async () => {
    // 🔴 SIN `aceptado` Y CON `aceptadoImplicito`: es la única forma de fila en que la aceptación la
    // decide el RESPALDO heredado, así que es la que prueba de verdad que el veredicto efectivo
    // incluye el vencimiento del plazo. El backend vigente envía además `aceptado: true` en este
    // caso —esa forma la cubre la prueba de arriba—, pero el motor no puede depender de ello.
    const fila = crearMiEpasAsignado({
      eejeStatus: "ASIGNADO_DECISOR",
      aceptado: undefined,
      aceptadoExplicito: false,
      aceptadoImplicito: true,
      aceptadoAt: undefined,
    });
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    for (const patron of [/^aceptar/i, /excusarme/i]) {
      const entrada = screen.getByRole("menuitem", { name: patron });
      expect(entrada, String(patron)).toBeDisabled();
      expect(
        entrada.getAttribute("title") ?? "",
        String(patron),
      ).toMatch(/sigue sin aceptar/i);
    }
  });

  it("«Aceptar» pide confirmación antes de sellar nada", async () => {
    const fila = crearMiEpasAsignadoPendiente({
      eejeStatus: "ASIGNADO_DECISOR",
    });
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    fireEvent.click(screen.getByRole("menuitem", { name: /^aceptar/i }));

    expect(
      await screen.findByText("Aceptar el caso asignado"),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA ENTRADA AL CORRECTIVO. Conducta HEREDADA de la Fase 03.18 y de su corrección CR-01: se
// traslada palabra por palabra porque el catálogo del Plan 11 la trasladó palabra por palabra.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — la entrada al correctivo", () => {
  it("con un expediente QUE LLEVA correctivo, el `⋮` ofrece la entrada y lleva a su pantalla", async () => {
    const fila = crearMiEpasAsignado({ obligacionHacer: CORRECTIVO });
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    const entrada = screen.getByRole("menuitem", {
      name: /obligación de hacer/i,
    });
    expect(entrada).not.toBeDisabled();
    expect(entrada).toHaveAttribute("href", "/home/obligacion-hacer/4101");
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // 🔴 CR-01: EL DECISOR TIENE QUE PODER LLEGAR A DECLARAR EL CORRECTIVO.
  //
  // `declararHacer` sólo se pinta dentro de `ObligacionHacerPage` y su regla exige
  // `obligacionHacer.tiene === false`: apagar la puerta justo en ese estado dejaba la acción que
  // ABRE la rama sin ninguna vía de interfaz. Lo que se afirma es la intención, no la mecánica.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("🔴 con un expediente SIN correctivo, el decisor PUEDE entrar: es la pantalla donde se declara", async () => {
    const fila = crearMiEpasAsignado({
      obligacionHacer: { ...CORRECTIVO, tiene: false },
    });
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    const entrada = screen.getByRole("menuitem", {
      name: /obligación de hacer/i,
    });
    expect(entrada).not.toBeDisabled();
    expect(entrada).toHaveAttribute("href", "/home/obligacion-hacer/4101");
  });

  it("y tampoco la cierra una fila que NO TRAE el bloque del correctivo", async () => {
    // La ausencia del bloque es lo que manda el backend para un expediente sin correctivo. Si la
    // puerta preguntara por un hecho, aquí saldría apagada con «falta el dato» — que es la otra
    // forma de dejar la rama inalcanzable.
    const fila = crearMiEpasAsignado();
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    const entrada = screen.getByRole("menuitem", {
      name: /obligación de hacer/i,
    });
    expect(entrada).not.toBeDisabled();
    expect(entrada).toHaveAttribute("href", "/home/obligacion-hacer/4101");
  });

  it("🔴 pero la puerta SIGUE gateada por rol: quien no interviene la ve apagada con su motivo", async () => {
    mocks.rolName.valor = "administrador";
    const fila = crearMiEpasAsignado({ obligacionHacer: CORRECTIVO });
    await montar([fila]);
    abrirMenu(fila.expNumber as string);

    const entrada = screen.getByRole("menuitem", {
      name: /obligación de hacer/i,
    });
    expect(entrada).toBeDisabled();
    expect(entrada.getAttribute("title") ?? "").toMatch(
      /su rol no interviene en este paso/i,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — el ORDEN de las cabeceras (UAT 2026-09-22, prueba 2)", () => {
  /**
   * Las cabeceras DE TÍTULO, en orden de pintado.
   *
   * 🔴 `th[scope="col"]` Y NO `getAllByRole("columnheader")`. `Table.tsx` pinta DOS filas de `<th>`
   * —la de títulos y la de filtros (líneas 623-670)— y sólo la de títulos lleva `scope="col"`. Un
   * `getAllByRole` devolvería las dos entrelazadas y esta prueba afirmaría algo distinto de lo que
   * cree.
   */
  const cabeceras = () =>
    Array.from(document.querySelectorAll('th[scope="col"]')).map((th) =>
      (th.textContent ?? "").trim(),
    );

  it("🔴 EXPEDIENTE va inmediatamente después de «Nro.»: es lo primero que el decisor lee", async () => {
    // El orden lo pidió el usuario en el UAT del 2026-09-22 («El numero del expediente debería ser
    // la segunda fila(luego del nro)»). Antes de este plan la primera era «Plazo restante» y
    // «Expediente» caía en la 11.ª: NINGUNA aserción del repo cubría el orden, y por eso el defecto
    // llegó hasta el UAT. Esta prueba falla si alguien devuelve `plazo` al primer puesto.
    await montar([crearMiEpasAsignado()]);

    expect(cabeceras().slice(0, 2)).toEqual(["Nro.", "Expediente"]);
  });

  it("«Nro.» sigue apareciendo UNA sola vez: la antepone la tabla compartida, no la página", async () => {
    // `Table.tsx:433-446` declara `numberColumn` y la antepone al array de la página, además de
    // calcular el índice global con el desplazamiento de página. Si alguien «arreglara» el orden
    // declarando un `nro` en `MisAsignadosPage`, saldrían dos cabeceras iguales.
    await montar([crearMiEpasAsignado()]);

    expect(cabeceras().filter((texto) => texto === "Nro.")).toHaveLength(1);
  });

  it("el conjunto no cambia de tamaño sin que se note: esta lista ES el contrato de las cabeceras", async () => {
    // 🔴 ESTA PRUEBA NO SE BORRA NI SE RELAJA A UN `toContain`. La añadió el plan 03.19-18 con un
    // propósito exacto: que cambiar el conjunto de columnas cueste tocar esta lista y quede escrito
    // en el diff. La Fase 03.22 la EXTIENDE de 15 a 17 —entran las dos de orden de pago entre
    // «Obligaciones» y «Sublote» (D-06)—, que es justo la conducta que se le pedía.
    // El quick 261006-g35 (2026-10-06) la EXTIENDE de 17 a 18: entra «Materia» —la materia DEL
    // EXPEDIENTE, con filtro de catálogo— entre «Creado en» y «Obligaciones», la primera posición
    // tras el pliegue, para no desplazar ninguna de las doce primeras.
    // El quick 261006-kys (2026-10-06) la EXTIENDE de 18 a 19: «Materia» pasa a ser la materia PADRE de
    // la submateria del expediente y entra «Submateria» justo detrás, en la misma posición tras el
    // pliegue (D-02: las dos del expediente, cada una con su filtro de catálogo).
    // La Fase 03.23, Plan 17 (D-16) la EXTIENDE de 19 a 20: entra «Infracciones» —los códigos del
    // EPAS con sus avisos, filtro de texto `infraccion`— justo detrás de «Submateria», porque la
    // materia y la submateria se DEDUCEN de esos códigos y se leen juntas.
    await montar([crearMiEpasAsignado()]);

    expect(cabeceras()).toEqual([
      "Nro.",
      "Expediente",
      "Plazo restante",
      "Estatus",
      "Nombres",
      "Apellidos",
      "CI/RUC",
      "Teléfono",
      "Negocio",
      "Dirección",
      "Zonal",
      "Creado en",
      "Materia",
      "Submateria",
      "Infracciones",
      "Obligaciones",
      "N.º orden (multa)",
      "N.º orden (remanente)",
      "Sublote",
      "Acciones",
    ]);
  });

  it("🔴 EXPEDIENTE va FIJADA a la izquierda: el bloque fijo son ella y «Nro.», y nadie más", async () => {
    // Gap 2 del UAT de la Fase 03.22, pedido literal del usuario. Esta prueba vive en este
    // `describe` porque es donde está el razonamiento sobre qué columna va dónde: la fijación
    // SUSTITUYE a reordenar, así que lo que la lista de arriba fija —el orden— y lo que fija ésta
    // —qué queda a la vista al desplazarse— son la misma decisión mirada por sus dos caras.
    //
    // 🔴 jsdom NO calcula CSS: nada de esto afirma que la columna se quede quieta, que su fondo sea
    // opaco ni que siga la franja de su fila. Eso son las nueve comprobaciones humanas del UAT, en
    // los dos temas. Aquí se afirma lo único que jsdom sabe: la CLASE y la ESTRUCTURA.
    await montar([crearMiEpasAsignado()]);

    const filas = Array.from(document.querySelectorAll("tbody tr"));
    expect(filas.length).toBeGreaterThan(0);

    for (const fila of filas) {
      const celdas = Array.from(fila.querySelectorAll("td"));

      // La del expediente es la SEGUNDA, tras la de numeración que antepone `Table.tsx`.
      expect(celdas[1].className).toContain("app-data-table-pinned-cell");
      // Y la de acciones conserva la suya, fijada a la derecha desde la Fase 03.19.
      expect(celdas[celdas.length - 1].className).toContain(
        "app-data-table-actions-cell",
      );

      // 🔴 EXACTAMENTE DOS celdas fijadas a la izquierda por fila: la numeración y el expediente.
      // Si mañana alguien marcara una tercera columna, esta prueba lo dice.
      expect(
        celdas.filter(
          (celda) =>
            celda.className.includes("app-data-table-nro-cell") ||
            celda.className.includes("app-data-table-pinned-cell"),
        ),
      ).toHaveLength(2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — las columnas y los filtros de MATERIA y SUBMATERIA (quick 261104-jh1)", () => {
  /**
   * 🔴 Las dos son las de SORTEO que el servidor resolvió y guardó en la foto (`expMateria`,
   * `expSubmateria`): varias se dicen todas (D-00b). La página no deduce nada. Las opciones de los
   * dos filtros salen de las materias de Sorteo (`GET /infracciones/materias`, doble
   * `mocks.materias`), nunca de una lista tecleada, y lo que viaja es el ID.
   */
  const cabeceras = () =>
    Array.from(document.querySelectorAll('th[scope="col"]')).map((th) =>
      (th.textContent ?? "").trim(),
    );

  /** La celda de la columna `cabecera` de la fila de ese expediente, por el ÍNDICE de su cabecera. */
  const celdaDe = (cabecera: string, expNumber: string): HTMLElement => {
    const indice = cabeceras().indexOf(cabecera);
    expect(indice).toBeGreaterThan(-1);
    const fila = Array.from(document.querySelectorAll("tbody tr")).find((tr) =>
      (tr.textContent ?? "").includes(expNumber),
    );
    expect(fila).toBeDefined();
    return Array.from((fila as HTMLElement).querySelectorAll("td"))[
      indice
    ] as HTMLElement;
  };

  it("con alguna infracción «sin materia» la celda lo dice junto al nombre, o sola si no hay nombre", async () => {
    await montar([
      crearMiEpasAsignado({
        eejeId: 5101,
        expNumber: "EPAS-2026-05101",
        expMateria: "LICENCIAMIENTO",
        expSubmateria: "LUAE",
        infracciones: {
          codigos: ["LIC-LU-X-124-1947A-02", "095-2025-001"],
          materiaIds: [26],
          submateriaIds: [54],
          sinMateria: true,
          estadoCore: "LEIDO",
          conflicto: false,
          descuadre: false,
        },
      }),
      crearMiEpasAsignado({
        eejeId: 5102,
        expNumber: "EPAS-2026-05102",
        expMateria: undefined,
        expSubmateria: undefined,
        infracciones: {
          codigos: ["095-2025-001"],
          materiaIds: [],
          submateriaIds: [],
          sinMateria: true,
          estadoCore: "LEIDO",
          conflicto: false,
          descuadre: false,
        },
      }),
    ]);

    expect(celdaDe("Materia", "EPAS-2026-05101").textContent?.trim()).toBe(
      "LICENCIAMIENTO / Sin materia",
    );
    expect(celdaDe("Submateria", "EPAS-2026-05101").textContent?.trim()).toBe(
      "LUAE, Sin materia",
    );
    expect(celdaDe("Materia", "EPAS-2026-05102").textContent?.trim()).toBe(
      "Sin materia",
    );
  });

  it("pinta la MATERIA y la(s) SUBMATERIA(s) DE SORTEO tal como llegan, y «—» en las dos cuando no las trae", async () => {
    await montar([
      crearMiEpasAsignado({
        eejeId: 5001,
        expNumber: "EPAS-2026-05001",
        expMateria: "LICENCIAMIENTO",
        // Varias submaterias, unidas por el SERVIDOR (D-00b): la celda no parte ni recompone nada.
        expSubmateria: "EDIFICACIÓN, HABILITACIÓN DEL SUELO",
      }),
      crearMiEpasAsignado({
        eejeId: 5002,
        expNumber: "EPAS-2026-05002",
        expMateria: undefined,
        expSubmateria: undefined,
      }),
    ]);

    expect(celdaDe("Materia", "EPAS-2026-05001").textContent?.trim()).toBe(
      "LICENCIAMIENTO",
    );
    expect(celdaDe("Submateria", "EPAS-2026-05001").textContent?.trim()).toBe(
      "EDIFICACIÓN, HABILITACIÓN DEL SUELO",
    );
    expect(celdaDe("Materia", "EPAS-2026-05002").textContent?.trim()).toBe(
      "—",
    );
    expect(celdaDe("Submateria", "EPAS-2026-05002").textContent?.trim()).toBe(
      "—",
    );
  });

  it("las opciones de los dos filtros salen de las materias de Sorteo, pedidas UNA sola vez para los dos", async () => {
    await montar([crearMiEpasAsignado()]);

    const materia = screen.getByRole("button", { name: "Filtrar por Materia" });
    const submateria = screen.getByRole("button", {
      name: "Filtrar por Submateria",
    });
    await waitFor(() => expect(materia).not.toBeDisabled());
    await waitFor(() => expect(submateria).not.toBeDisabled());
    // Las dos celdas montan a la vez y comparten la petición EN VUELO (coalescencia, Plan 11).
    expect(mocks.materias).toHaveBeenCalledTimes(1);

    fireEvent.click(materia);
    const listaMaterias = screen.getByRole("listbox");
    expect(within(listaMaterias).getByText("LICENCIAMIENTO")).toBeInTheDocument();
    expect(within(listaMaterias).getByText("AMBIENTE")).toBeInTheDocument();
  });

  it("🔴 elegir una MATERIA añade UNA petición con `materiaId`, la barra lee la ETIQUETA, y no hay bucle", async () => {
    await montar([crearMiEpasAsignado()]);
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);

    const disparador = screen.getByRole("button", {
      name: "Filtrar por Materia",
    });
    await waitFor(() => expect(disparador).not.toBeDisabled());
    fireEvent.click(disparador);
    fireEvent.click(
      within(screen.getByRole("listbox")).getByRole("radio", {
        name: "LICENCIAMIENTO",
      }),
    );

    await waitFor(
      () => expect(mocks.misAsignados).toHaveBeenCalledTimes(2),
      // Mismo margen que la prueba del filtro de Nombres, por la misma razón (jsdom bajo carga).
      { timeout: 4000 },
    );
    expect(mocks.misAsignados.mock.calls[1][0]).toEqual({
      pageIndex: 0,
      pageSize: 10,
      // La clave es la que `FilterMisAsignadosDto` declara, y el valor el ID de Sorteo.
      filterParams: { materiaId: ["26"] },
    });

    const barra = document.querySelector(
      ".app-table-applied-filters-badges",
    ) as HTMLElement;
    expect(barra).not.toBeNull();
    expect(barra.textContent).toContain("Materia: LICENCIAMIENTO");
    // El id crudo no se lee: «Materia: 26» sería el valor, no la etiqueta.
    expect(barra.textContent).not.toContain("Materia: 26");

    // 🔴 LA MEDIDA ANTI-BUCLE, igual que en el filtro de Nombres.
    await new Promise((resolver) => setTimeout(resolver, 1200));
    expect(mocks.misAsignados).toHaveBeenCalledTimes(2);
  });

  it("🔴 elegir una SUBMATERIA añade UNA petición con `submateriaId`, la barra lee la ETIQUETA, y no hay bucle", async () => {
    await montar([crearMiEpasAsignado()]);
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);

    const disparador = screen.getByRole("button", {
      name: "Filtrar por Submateria",
    });
    await waitFor(() => expect(disparador).not.toBeDisabled());
    fireEvent.click(disparador);
    fireEvent.click(
      within(screen.getByRole("listbox")).getByRole("radio", {
        name: "EDIFICACIÓN · LICENCIAMIENTO",
      }),
    );

    await waitFor(
      () => expect(mocks.misAsignados).toHaveBeenCalledTimes(2),
      { timeout: 4000 },
    );
    expect(mocks.misAsignados.mock.calls[1][0]).toEqual({
      pageIndex: 0,
      pageSize: 10,
      filterParams: { submateriaId: ["43"] },
    });

    const barra = document.querySelector(
      ".app-table-applied-filters-badges",
    ) as HTMLElement;
    expect(barra).not.toBeNull();
    expect(barra.textContent).toContain(
      "Submateria: EDIFICACIÓN · LICENCIAMIENTO",
    );
    expect(barra.textContent).not.toContain("Submateria: 43");

    await new Promise((resolver) => setTimeout(resolver, 1200));
    expect(mocks.misAsignados).toHaveBeenCalledTimes(2);
  });

  it("si las materias de Sorteo no se pueden cargar, los dos filtros dicen «No disponible» y quedan apagados; la bandeja carga igual", async () => {
    mocks.materias.mockRejectedValue(new Error("403"));
    await montar([crearMiEpasAsignado()]);

    const submateria = screen.getByRole("button", {
      name: "Filtrar por Submateria",
    });
    const materia = screen.getByRole("button", { name: "Filtrar por Materia" });
    await waitFor(() =>
      expect(submateria.textContent).toContain("No disponible"),
    );
    await waitFor(() => expect(materia.textContent).toContain("No disponible"));
    expect(submateria).toBeDisabled();
    expect(materia).toBeDisabled();

    // La tabla no depende del catálogo de materias: la fila está y la bandeja se pidió una sola vez.
    expect(screen.getByText("EPAS-2026-04101")).toBeInTheDocument();
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — la columna INFRACCIONES y su filtro (Fase 03.23, D-16)", () => {
  /**
   * La celda pinta los códigos del bloque `infracciones` que manda el servidor y sus avisos; el
   * filtro es TEXTO libre (`infraccion`, ≤ 60 en el backend) sobre esos códigos. La celda en sí se
   * prueba a fondo en `CeldaInfracciones.test.tsx`; aquí se afirma el CABLEADO en la tabla.
   */
  const cabeceras = () =>
    Array.from(document.querySelectorAll('th[scope="col"]')).map((th) =>
      (th.textContent ?? "").trim(),
    );

  const celdaDe = (cabecera: string, expNumber: string): HTMLElement => {
    const indice = cabeceras().indexOf(cabecera);
    expect(indice).toBeGreaterThan(-1);
    const fila = Array.from(document.querySelectorAll("tbody tr")).find((tr) =>
      (tr.textContent ?? "").includes(expNumber),
    );
    expect(fila).toBeDefined();
    return Array.from((fila as HTMLElement).querySelectorAll("td"))[
      indice
    ] as HTMLElement;
  };

  it("pinta los códigos del EPAS con sus avisos, y «Sin infracciones» —no «Descuadre»— en el que no tiene ninguno", async () => {
    await montar([
      crearMiEpasAsignado({
        eejeId: 5101,
        expNumber: "EPAS-2026-05101",
        infracciones: {
          codigos: ["LIC-LU-X-124-1947A-02", "AMB-RS-X-001-0001A-01"],
          materiaIds: [22, 26],
          submateriaIds: [54, 75],
          sinMateria: false,
          estadoCore: "PENDIENTE",
          conflicto: true,
          descuadre: false,
        },
      }),
      crearMiEpasAsignado({
        eejeId: 5102,
        expNumber: "EPAS-2026-05102",
        // 🔴 La regla del backend: sin infracciones también llega `descuadre: true`.
        infracciones: {
          codigos: [],
          materiaIds: [],
          submateriaIds: [],
          sinMateria: false,
          estadoCore: "LEIDO",
          conflicto: false,
          descuadre: true,
        },
      }),
    ]);

    const conCodigos = celdaDe("Infracciones", "EPAS-2026-05101");
    expect(conCodigos.textContent).toContain("LIC-LU-X-124-1947A-02");
    expect(conCodigos.textContent).toContain("+1");
    expect(conCodigos.textContent).toContain("Pendiente de lectura");
    expect(conCodigos.textContent).toContain("Conflicto de códigos");

    const sinCodigos = celdaDe("Infracciones", "EPAS-2026-05102");
    expect(sinCodigos.textContent).toContain("Sin infracciones");
    expect(sinCodigos.textContent).not.toContain("Descuadre");
  });

  it("Fase 03.24 (D-05): «Datos de Resolución incompletos» sale en la celda de infracciones si el servidor manda faltantes, y no con `null`", async () => {
    await montar([
      crearMiEpasAsignado({
        eejeId: 5201,
        expNumber: "EPAS-2026-05201",
        infracciones: {
          codigos: [],
          materiaIds: [],
          submateriaIds: [],
          sinMateria: false,
          estadoCore: "LEIDO",
          conflicto: false,
          descuadre: true,
        },
        datosResolucionFaltantes: ["MULTA", "CORE_ID", "INFRACCIONES"],
      }),
      crearMiEpasAsignado({
        eejeId: 5202,
        expNumber: "EPAS-2026-05202",
        datosResolucionFaltantes: null,
      }),
    ]);

    const conFaltantes = celdaDe("Infracciones", "EPAS-2026-05201");
    // Convive con la celda de la 03.23: «Sin infracciones» sigue saliendo.
    expect(conFaltantes.textContent).toContain("Sin infracciones");
    expect(conFaltantes.textContent).toContain(
      "Datos de Resolución incompletos",
    );
    const conTitulo = conFaltantes.querySelector(
      '[title^="Datos de Resolución incompletos"]',
    );
    expect(conTitulo).not.toBeNull();
    expect(conTitulo!.getAttribute("title")).toContain("caso enlazado");

    const sinFaltantes = celdaDe("Infracciones", "EPAS-2026-05202");
    expect(sinFaltantes.textContent).not.toContain(
      "Datos de Resolución incompletos",
    );
  });

  it("🔴 escribir «LU-X» en su filtro añade UNA petición con `infraccion=LU-X`, y no hay bucle", async () => {
    await montar([crearMiEpasAsignado()]);
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Filtrar por Infracciones"), {
      target: { value: "LU-X" },
    });

    await waitFor(
      () => expect(mocks.misAsignados).toHaveBeenCalledTimes(2),
      { timeout: 4000 },
    );
    expect(mocks.misAsignados.mock.calls[1][0]).toEqual({
      pageIndex: 0,
      pageSize: 10,
      // La clave es la que `FilterMisAsignadosDto` declara desde el Plan 18 (`infraccion`).
      filterParams: { infraccion: "LU-X" },
    });

    await new Promise((resolver) => setTimeout(resolver, 1200));
    expect(mocks.misAsignados).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — las columnas de orden de pago (Fase 03.22, D-05/D-06)", () => {
  /**
   * 🔴 LO QUE ESTAS PRUEBAS NO PUEDEN AFIRMAR, Y NO LO INTENTAN: jsdom no calcula CSS. Nada de color
   * resuelto, contraste, ancho ni pliegue. Las ocho comprobaciones visuales del contrato de UI
   * (H1-H8) van al UAT de la fase; fingirlas con una aserción sobre un estilo calculado sería peor
   * que no tenerlas. Aquí se afirma lo único que jsdom sabe: la CLASE y la ESTRUCTURA.
   */
  const EXPEDIENTE = "EPAS-2026-04101";

  const campo = (tipo: "multa" | "remanente") =>
    screen.getByLabelText(
      `Número de orden (${tipo}) del expediente ${EXPEDIENTE}`,
    );

  const botonAnular = () =>
    screen.getByLabelText(
      `Anular la orden SAO-2026-0001 (multa) del expediente ${EXPEDIENTE}`,
    );

  /** La fila SIN órdenes pero CON la marca de escritura: el estado normal de la bandeja de hoy. */
  const filaEditable = () =>
    crearMiEpasAsignado({ ordenes: { editable: true } });

  it("estado REGISTRADA: el número en monoespaciada y la palabra sobre un badge apagado", async () => {
    await montar([crearMiEpasAsignadoConOrdenes()]);

    expect(screen.getByText("SAO-2026-0001")).toHaveClass("font-mono");
    const badge = screen.getByText("Registrada");
    expect(badge.className).toContain("badge-sm");
    expect(badge.className).toContain("badge-ghost");
  });

  it("estado PAGADA: la palabra sobre el badge de éxito", async () => {
    await montar([crearMiEpasAsignadoConOrdenes()]);

    expect(screen.getByText("SAO-2026-0002")).toHaveClass("font-mono");
    const badge = screen.getByText("Pagada");
    expect(badge.className).toContain("badge-sm");
    expect(badge.className).toContain("badge-success");
  });

  it("sin orden y SIN la marca de escritura: «Pendiente», ningún campo y ningún «Anular»", async () => {
    // Y no se dice de quién es el expediente: a quien no le pertenece tampoco le corresponde
    // saberlo (mismo criterio que el mensaje del guard de pertenencia).
    await montar([crearMiEpasAsignado({ ordenes: { editable: false } })]);

    const pendientes = screen.getAllByText("Pendiente");
    expect(pendientes).toHaveLength(2);
    // La opacidad CORREGIDA del contrato: la del porte daba 3,4:1 en tema claro sobre la banda
    // impar del zebra. La prueba afirma la CLASE; el contraste lo mira un par de ojos.
    expect(pendientes[0].className).toContain("opacity-75");
    expect(screen.queryByLabelText(/Número de orden/)).toBeNull();
    expect(screen.queryByLabelText(/Anular la orden/)).toBeNull();
  });

  it("sin orden y CON la marca de escritura: DOS campos, uno por columna, con nombres accesibles distintos", async () => {
    await montar([filaEditable()]);

    const multa = campo("multa");
    const remanente = campo("remanente");
    expect(multa).not.toBe(remanente);
    expect(multa.className).toContain("input-sm");
    expect(multa.className).toContain("w-40");
    // 🔴 ASERCIÓN NEGATIVA sobre el `className` DEL CAMPO, no sobre el documento entero: la clase de
    // borde de daisyUI 4 que el porte arrastraba tiene CERO apariciones en daisyUI 5.5.19, así que
    // copiarla habría dejado una clase muerta que nadie se atreve a quitar después.
    expect(multa.className).not.toContain("input-bordered");
  });

  it("`Enter` sobre el campo registra la orden y recarga la bandeja", async () => {
    await montar([filaEditable()]);
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);

    fireEvent.change(campo("multa"), { target: { value: "SAO-2026-0009" } });
    fireEvent.keyDown(campo("multa"), { key: "Enter" });

    await waitFor(() => expect(mocks.registrarOrden).toHaveBeenCalledTimes(1));
    expect(mocks.registrarOrden).toHaveBeenCalledWith(
      4101,
      "MULTA",
      "SAO-2026-0009",
    );
    // La RECARGA, no un remontaje: es lo que conserva los filtros puestos y la página.
    await waitFor(() => expect(mocks.misAsignados).toHaveBeenCalledTimes(2), {
      timeout: 4000,
    });
  });

  it("salir del foco produce exactamente lo mismo que `Enter` (B8: teclado y ratón equivalentes)", async () => {
    await montar([filaEditable()]);

    fireEvent.change(campo("remanente"), {
      target: { value: "SAO-2026-0010" },
    });
    fireEvent.blur(campo("remanente"));

    await waitFor(() => expect(mocks.registrarOrden).toHaveBeenCalledTimes(1));
    expect(mocks.registrarOrden).toHaveBeenCalledWith(
      4101,
      "REMANENTE",
      "SAO-2026-0010",
    );
  });

  it("un campo vacío al salir del foco NO llama a registrar", async () => {
    // Es el caso MASIVO: con 10 filas hay 20 campos vacíos en pantalla, y tabular por la tabla los
    // recorre todos. Una petición por cada campo abandonado sería una tormenta contra el backend.
    await montar([filaEditable()]);

    fireEvent.blur(campo("multa"));

    expect(mocks.registrarOrden).not.toHaveBeenCalled();
  });

  it("🔴 tras un rechazo del servidor el toast dice qué pasó Y qué hacer, y lo tecleado SIGUE en el campo", async () => {
    // La invariante viene del porte con su razón escrita: vaciar el campo al fallar obligaría a
    // teclearlo otra vez para averiguar qué estaba mal.
    mocks.registrarOrden.mockRejectedValueOnce(
      errorDelServidor("Ya existe una orden vigente de este tipo"),
    );
    await montar([filaEditable()]);

    fireEvent.change(campo("multa"), { target: { value: "SAO-2026-0009" } });
    fireEvent.keyDown(campo("multa"), { key: "Enter" });

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringContaining("Ya existe una orden vigente de este tipo"),
      ),
    );
    expect(mocks.addToast).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Corrija el número y vuelva a intentarlo."),
    );
    expect(campo("multa")).toHaveValue("SAO-2026-0009");
  });

  // ─── La confirmación de «Anular» (Fase 03.22, Plan 06 — gap 1 del UAT / diferido D1) ──────────
  //
  // Las dos primeras pruebas de este tramo vienen CONVERTIDAS, no escritas de nuevo: protegían dos
  // conductas del contrato de UI —«la consecuencia se dice ANTES» y «cancelar no dispara NADA»— y
  // esas conductas no han cambiado; lo que cambió es el ENVOLTORIO de la confirmación, que pasó
  // del diálogo del navegador al cascarón del módulo. Borrarlas habría dejado el contrato sin
  // prueba con su nombre.

  /**
   * `hidden: true` NO es un atajo: daisyUI abre el diálogo con la clase `modal-open` y SIN el
   * atributo `open`, así que para jsdom todo el contenido del `<dialog>` queda fuera del árbol de
   * accesibilidad y ninguna consulta por rol lo encuentra. Es una limitación del entorno, no de la
   * pantalla —el navegador real sí lo expone—, y se deja dicho para que nadie lo lea como «ese
   * botón no es accesible». Mismo precedente y mismo aviso en `FormasNotificacionModal.test.tsx`.
   */
  const botonDelModal = (nombre: RegExp) =>
    screen.getByRole("button", { name: nombre, hidden: true });

  /**
   * El contenido de la confirmación. Se acota a propósito: el número de la orden y el del
   * expediente están TAMBIÉN en la fila de la tabla, y una consulta global no distinguiría «se ve
   * en la confirmación» de «se ve en la bandeja de detrás».
   */
  const confirmacion = () => {
    const modal = document.querySelector("dialog.modal");
    if (!modal) throw new Error("La confirmación del módulo no está en pantalla");
    return within(modal as HTMLElement);
  };

  const hayConfirmacion = () =>
    document.querySelector("dialog.modal") !== null;

  /**
   * El campo se busca por su ETIQUETA, que es una consulta de DOM y no del árbol de accesibilidad:
   * por eso éste no necesita `hidden`.
   */
  const campoMotivo = () =>
    screen.getByLabelText("Motivo de la anulación (obligatorio)");

  /** El botón de confirmar, anclado: el «Anular» de la celda también empieza por «Anular la orden». */
  const CONFIRMAR = /^Anular la orden$/;

  it("🔴 «Anular» abre la confirmación del MÓDULO —no el diálogo del navegador— y dice la consecuencia ANTES de pedir el motivo", async () => {
    // El espía se queda aunque el código de producción ya no use esa API: ES la prueba de regresión
    // del gap 1 del UAT. Si alguien volviera a meter el cascarón nativo, esta aserción lo diría por
    // su nombre en vez de dejarlo pasar en verde.
    const preguntar = vi.spyOn(window, "prompt");
    await montar([crearMiEpasAsignadoConOrdenes()]);

    fireEvent.click(botonAnular());

    expect(preguntar).not.toHaveBeenCalled();
    // El orden lo da `ConfirmationDetail`: la descripción va dentro de la ficha de datos y la
    // ranura del padre —el campo del motivo— DESPUÉS, justo encima de las acciones (03.19 §5.9).
    expect(
      confirmacion().getByText(
        /La orden no se borra: queda en el historial del expediente/,
      ),
    ).toBeInTheDocument();
    expect(confirmacion().getByText("SAO-2026-0001")).toBeInTheDocument();
    expect(confirmacion().getByText(EXPEDIENTE)).toBeInTheDocument();
    // El mínimo se ENUNCIA junto al campo. Quien lo impone es el servidor (CH-5).
    expect(
      confirmacion().getByText(/Mínimo 10 caracteres/),
    ).toBeInTheDocument();
    expect(campoMotivo()).toBeInTheDocument();
    preguntar.mockRestore();
  });

  it("cancelar la confirmación no dispara NADA: ni petición, ni aviso, ni cambio en pantalla", async () => {
    await montar([crearMiEpasAsignadoConOrdenes()]);

    fireEvent.click(botonAnular());
    expect(hayConfirmacion()).toBe(true);

    fireEvent.click(botonDelModal(/^Cancelar$/));

    expect(mocks.anularOrden).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
    expect(hayConfirmacion()).toBe(false);
  });

  it("con motivo, confirmar anula con el id de la orden, avisa del éxito y RECARGA la bandeja", async () => {
    await montar([crearMiEpasAsignadoConOrdenes()]);
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);

    fireEvent.click(botonAnular());
    fireEvent.change(campoMotivo(), {
      target: { value: "Se digitó el número equivocado" },
    });
    fireEvent.click(botonDelModal(CONFIRMAR));

    await waitFor(() =>
      expect(mocks.anularOrden).toHaveBeenCalledWith(
        7001,
        "Se digitó el número equivocado",
      ),
    );
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Orden SAO-2026-0001 anulada — queda registrada en la línea de tiempo del expediente.",
      ),
    );
    // La RECARGA, no un remontaje: es lo que conserva los filtros puestos y la página.
    await waitFor(() => expect(mocks.misAsignados).toHaveBeenCalledTimes(2), {
      timeout: 4000,
    });
  });

  it("🔴 el mínimo se DICE, no se impone: un motivo de 3 caracteres SÍ llega al servidor", async () => {
    // Parece una prueba que pide un comportamiento laxo y es exactamente lo contrario: es la que
    // fija CH-5 en conducta observable, y no sólo en un `grep` sobre el componente. El navegador no
    // puede llevar una SEGUNDA copia de la regla del servidor: el día que el servidor la cambie, un
    // cliente que la comprobara seguiría rechazando motivos válidos y nadie sabría por qué. El
    // mínimo se enuncia junto al campo; quien lo impone —y el único— es el backend.
    // ⚠️ Consecuencia aceptada: un motivo vacío también viaja y vuelve rechazado. Es lo que hacía
    // el cascarón nativo, que devolvía la cadena vacía y la celda la mandaba.
    await montar([crearMiEpasAsignadoConOrdenes()]);

    fireEvent.click(botonAnular());
    fireEvent.change(campoMotivo(), { target: { value: "abc" } });
    fireEvent.click(botonDelModal(CONFIRMAR));

    await waitFor(() =>
      expect(mocks.anularOrden).toHaveBeenCalledWith(7001, "abc"),
    );
  });

  it("🔴 el rechazo del servidor se lee DENTRO de la confirmación, que sigue abierta con lo escrito, y se puede corregir", async () => {
    mocks.anularOrden.mockRejectedValueOnce(
      errorDelServidor("El motivo debe tener al menos 10 caracteres"),
    );
    await montar([crearMiEpasAsignadoConOrdenes()]);

    fireEvent.click(botonAnular());
    fireEvent.change(campoMotivo(), { target: { value: "abc" } });
    fireEvent.click(botonDelModal(CONFIRMAR));

    // En el aviso flotante, que sale por ENCIMA del modal (quick 261028-kmg): la confirmación sigue
    // abierta con lo escrito para que quien recibe «el motivo debe tener al menos 10 caracteres»
    // pueda corregirlo ahí mismo.
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(/El motivo debe tener al menos 10 caracteres/),
      ),
    );
    expect(hayConfirmacion()).toBe(true);
    expect(campoMotivo()).toHaveValue("abc");

    // 🔴 EL CALLEJÓN SIN SALIDA QUE ESTA PRUEBA IMPIDE: el cascarón compartido apaga su botón de
    // confirmar mientras haya alerta y NO lo vuelve a encender solo. Como el mínimo lo impone el
    // servidor, ese rechazo es el camino ESPERADO; sin la limpieza de la alerta al teclear, la
    // única salida del modal sería Cancelar y lo escrito se perdería.
    expect(botonDelModal(CONFIRMAR)).toBeDisabled();

    fireEvent.change(campoMotivo(), {
      target: { value: "abc — se digitó el número equivocado" },
    });

    expect(botonDelModal(CONFIRMAR)).not.toBeDisabled();
  });

  it("«Anular» se nombra por su orden y lleva el tamaño pequeño, no el extra pequeño", async () => {
    // Sin el nombre accesible serían hasta 20 botones que se anuncian «Anular, Anular, Anular».
    // Y el tamaño no es gusto: iguala la altura del campo para que la fila no salte (H7).
    await montar([crearMiEpasAsignadoConOrdenes()]);

    const boton = botonAnular();
    expect(boton.className).toContain("btn-sm");
    expect(boton.className).not.toContain("btn-xs");
  });

  it("«Anular» sólo aparece con la marca de escritura en verdadero", async () => {
    const conOrdenes = crearMiEpasAsignadoConOrdenes();
    await montar([
      crearMiEpasAsignadoConOrdenes({
        ordenes: { ...conOrdenes.ordenes, editable: false },
      }),
    ]);

    // El número y su badge SÍ se ven: lo que desaparece es la acción, no el dato.
    expect(screen.getByText("SAO-2026-0001")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Anular la orden/)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — el enlace profundo de la campana (quick 261030-m29)", () => {
  /** Enseña la query actual: es lo que demuestra que el enlace se limpió. */
  function Query() {
    const { search } = useLocation();
    return <p data-testid="query">{search}</p>;
  }

  /**
   * Monta la bandeja en una URL con query. La tabla pide su página de 10 sin filtros; el enlace
   * pide la suya de 20 filtrada por número. Cada una recibe lo suyo.
   */
  const montarEn = (url: string, filasDelEnlace: MiEpasAsignado[]) => {
    mocks.misAsignados.mockImplementation(
      async (params: { pageSize?: number }) =>
        params.pageSize === 20
          ? sobreCon(filasDelEnlace)
          : sobreCon([crearMiEpasAsignado()]),
    );
    render(
      <MemoryRouter initialEntries={[url]}>
        <MisAsignadosPage />
        <Query />
      </MemoryRouter>,
    );
  };

  it("abre la ficha de ESE expediente en la pestaña de documentos y limpia la query", async () => {
    const parecida = crearMiEpasAsignado({ eejeId: 50, expNumber: "0001-2026-B" });
    const buscada = crearMiEpasAsignado({ eejeId: 5, expNumber: "0001-2026" });
    montarEn(
      "/home/mis-asignados?eeje=5&exp=0001-2026&pestana=documentos",
      [parecida, buscada],
    );

    await waitFor(() =>
      expect(mocks.openModal).toHaveBeenCalledWith(
        "expedienteLote",
        expect.objectContaining({
          eejeId: 5,
          expNumber: "0001-2026",
          bandeja: "decisor",
          pestanaInicial: "documentos",
        }),
        expect.any(Object),
      ),
    );
    expect(mocks.misAsignados).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 20,
      filterParams: { expNumber: "0001-2026" },
    });
    expect(mocks.openModal).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("query")).toHaveTextContent(/^$/));
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it("sin pestaña abre la ficha en su pestaña por defecto", async () => {
    montarEn("/home/mis-asignados?eeje=5&exp=0001-2026", [
      crearMiEpasAsignado({ eejeId: 5, expNumber: "0001-2026" }),
    ]);

    await waitFor(() =>
      expect(mocks.openModal).toHaveBeenCalledWith(
        "expedienteLote",
        expect.objectContaining({ eejeId: 5, pestanaInicial: undefined }),
        expect.any(Object),
      ),
    );
  });

  it("si el expediente ya no está, avisa y no abre nada", async () => {
    montarEn("/home/mis-asignados?eeje=5&exp=0001-2026&pestana=documentos", [
      crearMiEpasAsignado({ eejeId: 50, expNumber: "0001-2026-B" }),
    ]);

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "warning",
        "El expediente 0001-2026 ya no está en su bandeja.",
      ),
    );
    expect(mocks.openModal).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("query")).toHaveTextContent(/^$/));
  });

  it("si la búsqueda falla, lo dice en el aviso flotante y no abre nada", async () => {
    mocks.misAsignados.mockImplementation(async (params: { pageSize?: number }) => {
      if (params.pageSize === 20) throw errorDelServidor("Servicio no disponible", 503);
      return sobreCon([crearMiEpasAsignado()]);
    });
    render(
      <MemoryRouter initialEntries={["/home/mis-asignados?eeje=5&exp=0001-2026"]}>
        <MisAsignadosPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("error", expect.any(String)),
    );
    expect(mocks.openModal).not.toHaveBeenCalled();
  });

  it("con un eeje que no es un id válido no pide nada y limpia la query", async () => {
    montarEn("/home/mis-asignados?eeje=abc&exp=0001-2026", []);

    await waitFor(() => expect(screen.getByTestId("query")).toHaveTextContent(/^$/));
    expect(mocks.misAsignados).not.toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 20 }),
    );
    expect(mocks.openModal).not.toHaveBeenCalled();
  });

  it("IN-07: si llega otro enlace mientras el primero busca, la respuesta vieja ni abre su ficha ni limpia la query", async () => {
    let soltarPrimera: (v: ReturnType<typeof sobreCon>) => void = () => {};
    const primera = new Promise<ReturnType<typeof sobreCon>>((r) => {
      soltarPrimera = r;
    });
    mocks.misAsignados.mockImplementation(
      async (params: { pageSize?: number; filterParams?: { expNumber?: string } }) => {
        if (params.pageSize !== 20) return sobreCon([crearMiEpasAsignado()]);
        if (params.filterParams?.expNumber === "0001-2026") return primera;
        return sobreCon([crearMiEpasAsignado({ eejeId: 6, expNumber: "0002-2026" })]);
      },
    );
    function OtraAlerta() {
      const navegar = useNavigate();
      return (
        <button
          type="button"
          onClick={() => navegar("/home/mis-asignados?eeje=6&exp=0002-2026")}
        >
          otra alerta
        </button>
      );
    }
    render(
      <MemoryRouter initialEntries={["/home/mis-asignados?eeje=5&exp=0001-2026"]}>
        <MisAsignadosPage />
        <Query />
        <OtraAlerta />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(mocks.misAsignados).toHaveBeenCalledWith(
        expect.objectContaining({ filterParams: { expNumber: "0001-2026" } }),
      ),
    );

    // Se pulsa otra alerta antes de que responda la primera búsqueda.
    fireEvent.click(screen.getByRole("button", { name: "otra alerta" }));
    await waitFor(() =>
      expect(mocks.openModal).toHaveBeenCalledWith(
        "expedienteLote",
        expect.objectContaining({ eejeId: 6 }),
        expect.any(Object),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("query")).toHaveTextContent(/^$/));

    // Llega tarde la primera: no abre la ficha del 5 ni avisa de nada.
    soltarPrimera(sobreCon([crearMiEpasAsignado({ eejeId: 5, expNumber: "0001-2026" })]));
    await primera;
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.openModal).toHaveBeenCalledTimes(1);
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it("IN-07: si la página se desmonta mientras busca, la respuesta no abre nada ni toca la query", async () => {
    let soltar: (v: ReturnType<typeof sobreCon>) => void = () => {};
    const pendiente = new Promise<ReturnType<typeof sobreCon>>((r) => {
      soltar = r;
    });
    mocks.misAsignados.mockImplementation(async (params: { pageSize?: number }) =>
      params.pageSize === 20 ? pendiente : sobreCon([crearMiEpasAsignado()]),
    );
    const { unmount } = render(
      <MemoryRouter initialEntries={["/home/mis-asignados?eeje=5&exp=0001-2026"]}>
        <MisAsignadosPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(mocks.misAsignados).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 20 }),
      ),
    );
    unmount();
    soltar(sobreCon([crearMiEpasAsignado({ eejeId: 5, expNumber: "0001-2026" })]));
    await pendiente;
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.openModal).not.toHaveBeenCalled();
  });

  it("sin query no hace la petición del enlace (la tabla pide solo la suya)", async () => {
    await montar([crearMiEpasAsignado()]);

    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);
    expect(mocks.openModal).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Mis Expedientes — el contador de documentos sin leer (quick 261030-m29)", () => {
  const UNO = crearMiEpasAsignado({ eejeId: 5, expNumber: "0005-2026" });
  const DOS = crearMiEpasAsignado({ eejeId: 6, expNumber: "0006-2026" });

  /** La celda del expediente (la del número). */
  const celda = (expNumber: string) =>
    screen.getByText(expNumber).closest("td") as HTMLElement;

  it("pide el conteo con los ids de la página cargada y pinta «N nuevos» solo donde N > 0", async () => {
    mocks.contarNoLeidos.mockResolvedValue({ 5: 3, 6: 0 });
    await montar([UNO, DOS]);

    await waitFor(() =>
      expect(within(celda("0005-2026")).getByText("3 nuevos")).toBeInTheDocument(),
    );
    expect(mocks.contarNoLeidos).toHaveBeenCalledWith([5, 6]);
    expect(within(celda("0006-2026")).queryByText(/nuevo/)).toBeNull();
    // 🔴 Sin otra petición a la bandeja: el conteo usa la página ya cargada.
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);
  });

  it("con uno solo dice «1 nuevo»", async () => {
    mocks.contarNoLeidos.mockResolvedValue({ 5: 1 });
    await montar([UNO]);
    await waitFor(() =>
      expect(within(celda("0005-2026")).getByText("1 nuevo")).toBeInTheDocument(),
    );
  });

  it("🔴 si el conteo falla, la tabla se ve igual y sin contadores", async () => {
    mocks.contarNoLeidos.mockRejectedValue(new Error("500"));
    await montar([UNO, DOS]);
    await waitFor(() => expect(mocks.contarNoLeidos).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByText("0005-2026")).toBeInTheDocument();
    expect(screen.getByText("0006-2026")).toBeInTheDocument();
    expect(screen.queryByText(/\bnuevos?\b/)).toBeNull();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it("se recalcula al recargar la bandeja (p. ej. al cerrar la ficha)", async () => {
    mocks.contarNoLeidos.mockResolvedValue({ 5: 2 });
    await montar([UNO]);
    await waitFor(() => within(celda("0005-2026")).getByText("2 nuevos"));

    // Cerrar la ficha recarga la bandeja por su `refetchFn`.
    fireEvent.click(screen.getByRole("button", { name: "Ver expediente 0005-2026" }));
    const [, , callbacks] = mocks.openModal.mock.calls[0];
    mocks.contarNoLeidos.mockResolvedValue({ 5: 0 });
    await callbacks.refetchFn();

    await waitFor(() => expect(mocks.contarNoLeidos).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(within(celda("0005-2026")).queryByText(/nuevo/)).toBeNull(),
    );
  });

  it("el enlace profundo de la campana sigue funcionando con el contador encendido", async () => {
    mocks.contarNoLeidos.mockResolvedValue({ 5: 1 });
    mocks.misAsignados.mockImplementation(async (params: { pageSize?: number }) =>
      params.pageSize === 20 ? sobreCon([UNO]) : sobreCon([UNO, DOS]),
    );
    render(
      <MemoryRouter initialEntries={["/home/mis-asignados?eeje=5&exp=0005-2026&pestana=documentos"]}>
        <MisAsignadosPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(mocks.openModal).toHaveBeenCalledWith(
        "expedienteLote",
        expect.objectContaining({ eejeId: 5, pestanaInicial: "documentos" }),
        expect.any(Object),
      ),
    );
    await waitFor(() =>
      expect(within(celda("0005-2026")).getByText("1 nuevo")).toBeInTheDocument(),
    );
    // El conteo nunca pide con el tamaño del enlace.
    expect(mocks.misAsignados).toHaveBeenCalledTimes(2);
  });
});
