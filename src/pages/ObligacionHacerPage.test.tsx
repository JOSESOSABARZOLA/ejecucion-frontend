/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La pantalla del correctivo de un expediente (Fase 03.18, Plan 07)
 * Archivo: ObligacionHacerPage.test.tsx
 * Responsabilidad: Aseverar las seis conductas de la pantalla, y sobre todo la que la distingue de
 *   su análogo de Instrucción: **las acciones salen del MOTOR, y las que no proceden se ven
 *   APAGADAS CON SU MOTIVO, no ausentes**.
 *
 *   🔴 El caso caro es «expediente SIN correctivo declarado». Ahí sólo procede declarar, y lo fácil
 *   es esconder las otras ocho. Esta prueba exige que estén VISIBLES y apagadas: el decisor tiene
 *   derecho a ver el procedimiento entero aunque un paso no le toque todavía, y un botón que se
 *   esfuma no deja ni la pregunta de qué haría falta para encenderlo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: «Generar providencia». Se dobla la
 *   lectura de la bandeja del decisor —de donde salen los hechos de la aceptación—, se registra la
 *   ruta del asistente con una sonda, y se prueba que el botón lo decide el MOTOR con la regla
 *   `generarDocumento`, que navega pidiendo volver aquí, y que la página no redacta la regla.)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-lhu: la vuelta de la ficha por rol —bandeja
 *   del decisor, pantalla anterior o Dashboard— arriba, abajo y en el error)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: con el EPAS EN_IMPUGNACION los actos
 *   salen apagados con el motivo de la suspensión, el aviso de estado arriba y, con la fila del
 *   decisor, la sección del recurso montada en la página; la prueba del fuente admite que el estado
 *   se PASE al motor, nunca que se compare)
 */
import { errorDelServidor } from "../test/errores";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type {
  ObligacionHacerDetalle,
  TerminoAlegacion,
} from "../interfaces/IObligacionHacer";
import {
  crearMiEpasAsignado,
  crearMiEpasAsignadoPendiente,
} from "../test/fixtures/miEpasAsignado";
import type { MiEpasAsignado } from "../services/SorteoService";
import { RUTA_GENERAR_DOCUMENTO_HIJA } from "../config/rutasGeneracionDocumento";
import { MOTIVOS_ACCION } from "../config/accionesHechos";

const MOTIVOS_SUSPENSION = MOTIVOS_ACCION.SUSPENDIDA_POR_IMPUGNACION;

const mocks = vi.hoisted(() => ({
  detalle: vi.fn(),
  leerEstadoImpugnacion: vi.fn(),
  misAsignados: vi.fn(),
  openModal: vi.fn(),
  addToast: vi.fn(),
  rolName: { valor: "funcionario decisor" },
}));

vi.mock("../services/ObligacionHacerService", () => ({
  ObligacionHacerService: {
    detalle: mocks.detalle,
  },
}));

// Quick 261014-kn3: la lectura de la bandeja del decisor, de donde salen los hechos de la
// aceptación. Se esparce el servicio real y se cubren las DOS puertas (nombrada y por defecto).
vi.mock("../services/SorteoService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../services/SorteoService")>();
  const doble = { ...real.SorteoService, misAsignados: mocks.misAsignados };
  return { ...real, SorteoService: doble, default: doble };
});

// quick 261028-mtg: la sección del recurso se monta DE VERDAD; se dobla solo su lectura HTTP.
vi.mock("../services/ImpugnacionService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../services/ImpugnacionService")>();
  return {
    ...real,
    ImpugnacionService: {
      ...real.ImpugnacionService,
      leerEstado: mocks.leerEstadoImpugnacion,
    },
  };
});

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

// El registro real arrastra los diecisiete componentes de modal (y con ellos react-pdf, que en jsdom
// no tiene `DOMMatrix`). Aquí sólo importa QUÉ CLAVES existen, que es lo único que consulta
// `resolverModalDeAccion`. Mismo criterio que `RowActions.test.tsx`.
vi.mock("../interfaces/IModal", () => ({
  modalRegistry: {
    declararHacer: () => null,
    deshacerHacer: () => null,
    adjuntarInforme: () => null,
    acreditarCumplimiento: () => null,
    constatarIncumplimiento: () => null,
    registrarAlegacion: () => null,
    ordenarSustitutoria: () => null,
    registrarDiligencia: () => null,
    registrarRespaldoCostos: () => null,
    registrarGastosSustitutoria: () => null,
  },
}));

// La serie compulsoria se REUTILIZA, no se duplica: aquí se dobla para que la prueba de la página no
// arrastre el servicio de multas, y para poder afirmar con qué `permiteRegistrar` la monta.
vi.mock("../components/multas-compulsorias/MultasCompulsoriasExpediente", () => ({
  default: ({
    eejeId,
    permiteRegistrar,
  }: {
    eejeId: number;
    permiteRegistrar?: boolean;
  }) => (
    <div data-testid="serie-compulsoria" data-permite={String(!!permiteRegistrar)}>
      Serie compulsoria del EPAS {eejeId}
    </div>
  ),
}));

import ObligacionHacerPage from "./ObligacionHacerPage";
import fuentePagina from "./ObligacionHacerPage.tsx?raw";

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

/** Un expediente CON correctivo declarado, con informe y con la sustitutoria ordenada. */
const DETALLE: ObligacionHacerDetalle = {
  obligacionHacer: {
    tiene: true,
    cumplida: false,
    cumplidaAt: null,
    multasCompulsorias: 2,
    tieneInforme: true,
    sustitutoriaOrdenada: true,
  },
  serieCompulsorias: {
    serie: [],
    peldano: {
      registradas: 2,
      ordinalSiguiente: 3,
      serieAgotada: false,
      incumplimientoConstatadoDespuesDeLaUltimaMulta: true,
    },
  },
  diligencias: [
    {
      dsusId: 71,
      eejeId: 500,
      resultado: "FALLIDA",
      motivo: "Acceso negado por el administrado.",
      actoAt: "2026-09-12T09:00:00.000Z",
      registradaBy: 4,
      docId: 9100,
    },
  ],
  terminoAlegacion: TERMINO,
};

/** El mismo expediente, pero SIN correctivo declarado: es el caso caro. */
const DETALLE_SIN_CORRECTIVO: ObligacionHacerDetalle = {
  ...DETALLE,
  obligacionHacer: {
    tiene: false,
    cumplida: false,
    cumplidaAt: null,
    multasCompulsorias: 0,
    tieneInforme: false,
    sustitutoriaOrdenada: false,
  },
  serieCompulsorias: {
    serie: [],
    peldano: {
      registradas: 0,
      ordinalSiguiente: 1,
      serieAgotada: false,
      incumplimientoConstatadoDespuesDeLaUltimaMulta: false,
    },
  },
  diligencias: [],
};

/**
 * Las OCHO acciones de escritura del menú que NO son declarar. Acreditar y constatar ya no están
 * en el menú: se deciden al subir el informe.
 */
const LAS_OCHO_RESTANTES = [
  "deshacerHacer",
  "adjuntarInforme",
  "registrarAlegacion",
  "ordenarSustitutoria",
  "registrarDiligencia",
  "registrarRespaldoCostos",
  "registrarGastosSustitutoria",
  "registrarMultaCompulsoria",
] as const;

/** Una pantalla doblada: pinta la dirección a la que se navegó, con el `data-testid` dado. */
const Sonda = ({ testId }: { testId: string }) => {
  const { pathname, search } = useLocation();
  return <p data-testid={testId}>{`${pathname}${search}`}</p>;
};

/**
 * Monta la ficha. `previas` son las entradas del historial ANTERIORES a la ficha (quick
 * 261014-lhu): sin ellas la ficha es la primera entrada —URL tecleada, pestaña nueva— y react-router
 * le da la clave inicial; con ellas, la ficha llegó navegando dentro de la app.
 *
 * Las rutas de la bandeja, del tablero y del origen se escriben COMO LITERALES a propósito: si la
 * constante de la página derivara, estas pruebas lo cazarían.
 */
function montar(eejeId = 500, previas: string[] = []) {
  return render(
    <MemoryRouter
      initialEntries={[...previas, `/home/obligacion-hacer/${eejeId}`]}
      initialIndex={previas.length}
    >
      <Routes>
        <Route
          path="/home/obligacion-hacer/:eejeId"
          element={<ObligacionHacerPage />}
        />
        <Route
          path={`/home/${RUTA_GENERAR_DOCUMENTO_HIJA}`}
          element={<Sonda testId="sonda-generacion" />}
        />
        <Route
          path="/home/mis-asignados"
          element={<Sonda testId="sonda-bandeja" />}
        />
        <Route
          path="/home/dashboard"
          element={<Sonda testId="sonda-tablero" />}
        />
        <Route
          path="/home/origen-previo"
          element={<Sonda testId="sonda-origen" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

/** El sobre paginado de `GET /sorteo/mis-asignados` con las filas dadas. */
const sobreBandeja = (filas: MiEpasAsignado[]) => ({
  data: filas,
  total: filas.length,
  limit: 100,
  offset: 0,
  page: 1,
  pages: filas.length > 0 ? 1 : 0,
});

/** El botón de una acción, buscado por el nombre con que la página lo marca. */
const boton = (actiName: string): HTMLButtonElement =>
  screen.getByTestId(`accion-${actiName}`) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rolName.valor = "funcionario decisor";
  mocks.detalle.mockResolvedValue(DETALLE);
  // La fila del expediente 500 en la bandeja del decisor: aceptado a mano y sin excusa.
  mocks.misAsignados.mockResolvedValue(
    sobreBandeja([crearMiEpasAsignado({ eejeId: 500 })]),
  );
});

describe("ObligacionHacerPage", () => {
  it("carga el detalle del correctivo y muestra sus cinco secciones", async () => {
    montar();

    await waitFor(() => expect(mocks.detalle).toHaveBeenCalledWith(500));

    // Obligación e informe. `getAllBy` porque el mismo texto sale en la sección y en el botón del
    // acto: lo que se afirma es que ESTÁ, no cuántas veces aparece.
    expect(screen.getAllByText(/La obligación de hacer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/informe/i).length).toBeGreaterThan(0);
    // El sello de clausura se retiró (quick 261014-jcy): ni sección ni acción.
    expect(screen.queryByText(/sello de clausura/i)).toBeNull();
    // Serie compulsoria: se REUTILIZA el componente que ya existía.
    expect(screen.getByTestId("serie-compulsoria")).toBeInTheDocument();
    // Diligencias de la sustitutoria.
    expect(screen.getByText(/Acceso negado por el administrado/i)).toBeInTheDocument();
    // Término de alegación.
    expect(screen.getAllByText(/Término para alegar/i).length).toBeGreaterThan(0);
  });

  it("🔴 el PELDAÑO siguiente se pinta tal y como lo derivó el servidor", async () => {
    montar();
    await waitFor(() => expect(mocks.detalle).toHaveBeenCalled());

    // 3.ª, porque el servidor dijo 3 — no porque la pantalla haya contado la serie.
    expect(screen.getByTestId("peldano-siguiente")).toHaveTextContent("3");
  });

  it("las acciones salen del motor: las que no proceden aparecen DESHABILITADAS con su motivo", async () => {
    montar();
    await waitFor(() => expect(mocks.detalle).toHaveBeenCalled());

    // Con el correctivo YA declarado, declarar no procede: apagada, pero AHÍ.
    const declarar = boton("declararHacer");
    expect(declarar).toBeDisabled();
    expect(declarar.getAttribute("title")).toBeTruthy();

    // Y lo que sí procede, procede.
    expect(boton("adjuntarInforme")).toBeEnabled();
    expect(boton("registrarRespaldoCostos")).toBeEnabled();
  });

  it("🔴 un expediente SIN correctivo declarado deja, de los actos de la rama, SOLO declarar habilitada, y las otras ocho VISIBLES y apagadas", async () => {
    // «Generar providencia» (quick 261014-kn3) no es un acto de la rama ni depende del correctivo:
    // lo decide la aceptación del caso, y por eso no está en esta lista.
    mocks.detalle.mockResolvedValue(DETALLE_SIN_CORRECTIVO);
    montar();
    await waitFor(() => expect(mocks.detalle).toHaveBeenCalled());

    expect(boton("declararHacer")).toBeEnabled();

    for (const nombre of LAS_OCHO_RESTANTES) {
      const b = boton(nombre);
      // VISIBLE: el paso existe y el decisor tiene derecho a verlo.
      expect(b).toBeInTheDocument();
      // APAGADO y CON MOTIVO: apagar sin decir por qué deja al usuario adivinando.
      expect(b).toBeDisabled();
      expect(b.getAttribute("title")).toBeTruthy();
    }
  });

  it("con un rol distinto del decisor las nueve de escritura salen apagadas y las LECTURAS siguen visibles", async () => {
    mocks.rolName.valor = "secretario abogado";
    montar();
    await waitFor(() => expect(mocks.detalle).toHaveBeenCalled());

    for (const nombre of ["declararHacer", ...LAS_OCHO_RESTANTES]) {
      expect(boton(nombre)).toBeDisabled();
    }
    // «Generar providencia» también, por rol; y la bandeja del decisor —que a este rol le
    // respondería 403— ni se pide.
    expect(boton("generarDocumento")).toBeDisabled();
    expect(mocks.misAsignados).not.toHaveBeenCalled();

    // Las lecturas de la rama son de los tres roles: el contenido sigue ahí.
    expect(screen.getAllByText(/La obligación de hacer/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("serie-compulsoria")).toBeInTheDocument();
    expect(screen.getAllByText(/Término para alegar/i).length).toBeGreaterThan(0);
  });

  it("tras un acto correcto, la página RECARGA el detalle", async () => {
    montar();
    await waitFor(() => expect(mocks.detalle).toHaveBeenCalledTimes(1));

    boton("adjuntarInforme").click();

    expect(mocks.openModal).toHaveBeenCalled();
    const [, , callbacks] = mocks.openModal.mock.calls[0];
    // La recarga viaja por el MISMO camino que usan las bandejas: el `refetchFn` del modal.
    await callbacks.refetchFn();

    await waitFor(() => expect(mocks.detalle).toHaveBeenCalledTimes(2));
    // La recarga es la del CORRECTIVO: la bandeja del decisor no se vuelve a pedir.
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);
  });

  it("un informe SIN conclusión se dice en la ficha y viaja al modal del informe", async () => {
    mocks.detalle.mockResolvedValue({
      ...DETALLE,
      obligacionHacer: {
        ...DETALLE.obligacionHacer,
        informeDocId: 640,
        informeSinConclusion: true,
      },
    });
    montar();

    expect(
      await screen.findByText(/sin conclusión registrada/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/documento 640/i)).toBeInTheDocument();

    boton("adjuntarInforme").click();
    const [, caseData] = mocks.openModal.mock.calls[0];
    expect(caseData.obligacionHacer).toMatchObject({
      informeDocId: 640,
      informeSinConclusion: true,
    });
  });

  it("sin informe pendiente la ficha dice lo de siempre", async () => {
    montar();
    await waitFor(() => expect(mocks.detalle).toHaveBeenCalled());
    expect(await screen.findByText("adjuntado")).toBeInTheDocument();
    expect(screen.queryByText(/sin conclusión registrada/i)).toBeNull();
  });

  it("🔴 la página NO lee ni compara el estado del EPAS, y NO deduce el peldaño", () => {
    const codigo = fuentePagina
      .split("\n")
      .filter(
        (linea) =>
          !linea.trimStart().startsWith("*") &&
          !linea.trimStart().startsWith("//") &&
          !linea.trimStart().startsWith("/*"),
      )
      .join("\n");

    // ⟳ quick 261028-mtg: el estado del EPAS se PASA al motor —que es quien sabe que en
    // EN_IMPUGNACION los actos quedan suspendidos—, y ése es su ÚNICO uso. La página sigue sin
    // compararlo: ninguna decisión de esta pantalla se toma mirando el estado.
    expect(codigo.match(/eejeStatus/g) ?? []).toHaveLength(1);
    expect(codigo).toMatch(/estado: detalle\?\.eejeStatus \?\? null/);
    expect(codigo).not.toMatch(/eejeStatus\s*[!=]==|[!=]==\s*[\w.?]*eejeStatus/);
    // Criterio 7 (quick 261014-kn3): la página no redacta la regla de «Generar providencia» ni lee
    // los campos de aceptación de la fila; se la pasa ENTERA al adaptador `hechosDelEpas`.
    expect(codigo).not.toMatch(
      /epas\.aceptado|sinExcusaPendiente|\.aceptado\b|\.excusaPendiente\b/,
    );
    // El ordinal no se cuenta aquí: está prohibido guardarlo y prohibido deducirlo, para que el
    // número que ve la pantalla y el que imprime el acto notificado sean el mismo.
    expect(codigo).not.toMatch(/ordinal\s*\+\s*1/);
    expect(codigo).not.toMatch(/length\s*\+\s*1/);
    // La ficha no escribe rutas (quick 261014-lhu): las toma de las constantes —la de la bandeja,
    // la del refugio y la del asistente—, así que ninguna vuelta puede derivar de un literal suelto.
    expect(codigo).not.toMatch(/["'\x60]\/home\//);
  });

  it("la serie compulsoria se monta con el `permiteRegistrar` que dice el MOTOR, no con un true suelto", async () => {
    // Sin correctivo declarado, registrar la multa compulsoria no procede.
    mocks.detalle.mockResolvedValue(DETALLE_SIN_CORRECTIVO);
    montar();
    await waitFor(() => expect(mocks.detalle).toHaveBeenCalled());

    expect(screen.getByTestId("serie-compulsoria")).toHaveAttribute(
      "data-permite",
      "false",
    );
  });

  it("si el servidor rechaza la lectura, se muestra SU mensaje y no un armazón vacío", async () => {
    mocks.detalle.mockRejectedValue(
      errorDelServidor("Este expediente no le corresponde."),
    );
    montar();

    expect(
      await screen.findByText(/Este expediente no le corresponde/i),
    ).toBeInTheDocument();
  });
});

describe("ObligacionHacerPage — «Generar providencia» (quick 261014-kn3)", () => {
  it("🔴 con la fila aceptada y sin excusa, el botón está HABILITADO y lleva al asistente pidiendo volver aquí", async () => {
    montar();

    await waitFor(() => expect(boton("generarDocumento")).toBeEnabled());
    const b = boton("generarDocumento");
    expect(b).toHaveTextContent("Generar providencia");
    expect(mocks.misAsignados).toHaveBeenCalledTimes(1);
    expect(mocks.misAsignados).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 100,
    });

    b.click();

    expect(await screen.findByTestId("sonda-generacion")).toHaveTextContent(
      "/home/mis-asignados/document-generate/500?desde=obligacion-hacer",
    );
    expect(mocks.openModal).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it("con la fila SIN aceptar, el botón se ve APAGADO y dice que falta aceptar el caso", async () => {
    mocks.misAsignados.mockResolvedValue(
      sobreBandeja([crearMiEpasAsignadoPendiente({ eejeId: 500 })]),
    );
    montar();

    await waitFor(() =>
      expect(boton("generarDocumento").getAttribute("title")).toMatch(
        /aceptó el caso/,
      ),
    );
    expect(boton("generarDocumento")).toBeDisabled();
    expect(boton("generarDocumento").getAttribute("title")).not.toMatch(
      /No se puede decidir aquí/,
    );
  });

  it("con una excusa pendiente, el botón se ve APAGADO y lo dice", async () => {
    mocks.misAsignados.mockResolvedValue(
      sobreBandeja([
        crearMiEpasAsignado({ eejeId: 500, excusaPendiente: true }),
      ]),
    );
    montar();

    await waitFor(() =>
      expect(boton("generarDocumento").getAttribute("title")).toMatch(
        /excusa/,
      ),
    );
    expect(boton("generarDocumento")).toBeDisabled();
  });

  it.each([
    ["la fila no está en la bandeja", () =>
      mocks.misAsignados.mockResolvedValue(
        sobreBandeja([crearMiEpasAsignado({ eejeId: 9999 })]),
      )],
    ["la lectura de la bandeja falla", () =>
      mocks.misAsignados.mockRejectedValue(new Error("502"))],
  ])("cuando %s, el botón se ve APAGADO con «No se puede decidir aquí…» y la ficha se pinta entera", async (_caso, preparar) => {
    preparar();
    montar();

    await waitFor(() => expect(mocks.misAsignados).toHaveBeenCalled());
    await waitFor(() =>
      expect(boton("generarDocumento").getAttribute("title")).toMatch(
        /^No se puede decidir aquí/,
      ),
    );
    expect(boton("generarDocumento")).toBeDisabled();
    // El resto de la ficha no depende de esta lectura.
    expect(boton("adjuntarInforme")).toBeEnabled();
    expect(screen.getByTestId("serie-compulsoria")).toBeInTheDocument();
    expect(screen.getAllByText(/Término para alegar/i).length).toBeGreaterThan(0);
  });
});

describe("ObligacionHacerPage — volver (quick 261014-lhu)", () => {
  it("decisor sin historial: «Volver a Mis Expedientes» arriba y abajo, con la miga de la bandeja; el de ARRIBA lleva a la bandeja", async () => {
    montar();

    const botones = await screen.findAllByRole("button", {
      name: "Volver a Mis Expedientes",
    });
    expect(botones).toHaveLength(2);
    expect(
      screen.getByText("Mis Expedientes / Obligación de hacer"),
    ).toBeInTheDocument();

    botones[0].click();

    expect(await screen.findByTestId("sonda-bandeja")).toHaveTextContent(
      "/home/mis-asignados",
    );
  });

  it("decisor sin historial: el de ABAJO también lleva a la bandeja", async () => {
    montar();

    const botones = await screen.findAllByRole("button", {
      name: "Volver a Mis Expedientes",
    });
    expect(botones).toHaveLength(2);

    botones[1].click();

    expect(await screen.findByTestId("sonda-bandeja")).toHaveTextContent(
      "/home/mis-asignados",
    );
  });

  it("🔴 decisor que llega DESDE el asistente: vuelve a la bandeja, NO a la generación", async () => {
    montar(500, [
      "/home/mis-asignados/document-generate/500?desde=obligacion-hacer",
    ]);

    const botones = await screen.findAllByRole("button", {
      name: "Volver a Mis Expedientes",
    });
    botones[0].click();

    expect(await screen.findByTestId("sonda-bandeja")).toHaveTextContent(
      "/home/mis-asignados",
    );
    expect(screen.queryByTestId("sonda-generacion")).toBeNull();
  });

  it("secretario con una entrada previa de la app: «Volver a la pantalla anterior» lo devuelve a ella", async () => {
    mocks.rolName.valor = "secretario abogado";
    montar(500, ["/home/origen-previo"]);

    const botones = await screen.findAllByRole("button", {
      name: "Volver a la pantalla anterior",
    });
    expect(botones).toHaveLength(2);
    expect(
      screen.getByText("Ejecución / Obligación de hacer"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Volver a Mis Expedientes" }),
    ).toBeNull();

    botones[0].click();

    expect(await screen.findByTestId("sonda-origen")).toHaveTextContent(
      "/home/origen-previo",
    );
    expect(mocks.misAsignados).not.toHaveBeenCalled();
  });

  it("director sin historial: «Volver al Dashboard» lleva al tablero", async () => {
    mocks.rolName.valor = "director";
    montar();

    const botones = await screen.findAllByRole("button", {
      name: "Volver al Dashboard",
    });
    expect(botones).toHaveLength(2);
    expect(
      screen.getByText("Ejecución / Obligación de hacer"),
    ).toBeInTheDocument();

    botones[1].click();

    expect(await screen.findByTestId("sonda-tablero")).toHaveTextContent(
      "/home/dashboard",
    );
  });

  it("si la lectura del correctivo falla, se ve el mensaje del servidor y la vuelta del rol", async () => {
    mocks.detalle.mockRejectedValue(
      errorDelServidor("Este expediente no le corresponde."),
    );
    montar();

    expect(
      await screen.findByText(/Este expediente no le corresponde/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mis Expedientes / Obligación de hacer"),
    ).toBeInTheDocument();

    screen.getByRole("button", { name: "Volver a Mis Expedientes" }).click();

    expect(await screen.findByTestId("sonda-bandeja")).toHaveTextContent(
      "/home/mis-asignados",
    );
  });
});

// ── quick 261028-mtg (2026-10-29): la página con el expediente suspendido por impugnación ──
describe("ObligacionHacerPage — suspendido por impugnación (quick 261028-mtg)", () => {
  const DETALLE_SUSPENDIDO: ObligacionHacerDetalle = {
    ...DETALLE,
    eejeStatus: "EN_IMPUGNACION",
    suspensionImpugnacion: {
      desde: "2026-10-16T15:00:00.000Z",
      estadoPrevio: "EN_VERIFICACION_PAGO",
    },
    terminoAlegacion: {
      ...TERMINO,
      estado: "SUSPENDIDO",
      venceAt: null,
      suspendidoDesde: "2026-10-16T15:00:00.000Z",
      diasHabilesSuspendidos: 0,
    },
  };

  beforeEach(() => {
    mocks.leerEstadoImpugnacion.mockResolvedValue({
      eejeStatus: "EN_IMPUGNACION",
      entrada: {
        permitida: false,
        motivo: "Ya está en impugnación.",
        estadoAlReanudar: null,
      },
      suspension: {
        esusId: 1,
        desde: "2026-10-16T15:00:00.000Z",
        estadoPrevio: "EN_VERIFICACION_PAGO",
        estadoAlReanudar: "EN_VERIFICACION_PAGO",
        origen: "DECISOR",
      },
      resolucionAdjunta: false,
      historial: [],
    });
  });

  it("los actos de la rama salen apagados con el motivo de la suspensión, el aviso va arriba y la sección del recurso se monta aquí", async () => {
    mocks.detalle.mockResolvedValue(DETALLE_SUSPENDIDO);
    mocks.misAsignados.mockResolvedValue(
      sobreBandeja([
        crearMiEpasAsignado({ eejeId: 500, eejeStatus: "EN_IMPUGNACION" }),
      ]),
    );
    montar();

    expect(
      await screen.findByText(
        /expediente suspendido por impugnación desde el 16\/10\/2026/i,
      ),
    ).toBeInTheDocument();

    for (const actiName of ["declararHacer", ...LAS_OCHO_RESTANTES]) {
      const b = boton(actiName);
      expect(b, actiName).toBeDisabled();
      expect(b.title, actiName).toBe(MOTIVOS_SUSPENSION);
    }

    // D-5: el recurso se resuelve también desde esta rama.
    expect(
      await screen.findByText(/en impugnación — pendiente/i),
    ).toBeInTheDocument();
    expect(mocks.leerEstadoImpugnacion).toHaveBeenCalledWith(500);
    expect(
      await screen.findByRole("radio", {
        name: /no — se reanuda: vuelve a «en verificación de pago»/i,
      }),
    ).toBeInTheDocument();
    // Y el aviso no remite a otra pantalla: la sección está aquí.
    expect(screen.queryByText(/mis expedientes → ⋮ → recursos/i)).toBeNull();
    // Generar documento sigue disponible (P-8).
    await waitFor(() => expect(boton("generarDocumento")).toBeEnabled());
  });

  it("sin la fila del decisor, el aviso remite a «Mis expedientes → ⋮ → Recursos» y no monta la sección", async () => {
    mocks.detalle.mockResolvedValue(DETALLE_SUSPENDIDO);
    mocks.misAsignados.mockResolvedValue(sobreBandeja([]));
    montar();

    expect(
      await screen.findByText(/mis expedientes → ⋮ → recursos/i),
    ).toBeInTheDocument();
    await waitFor(() => expect(mocks.misAsignados).toHaveBeenCalled());
    expect(screen.queryByText(/en impugnación — pendiente/i)).toBeNull();
    expect(mocks.leerEstadoImpugnacion).not.toHaveBeenCalled();
  });

  it("en otro estado la página es la de siempre: sin aviso y con los actos según sus condiciones", async () => {
    mocks.detalle.mockResolvedValue({
      ...DETALLE,
      eejeStatus: "EN_VERIFICACION_PAGO",
      suspensionImpugnacion: null,
    });
    montar();

    await waitFor(() => expect(boton("adjuntarInforme")).toBeEnabled());
    expect(screen.queryByText(/suspendido por impugnación/i)).toBeNull();
    expect(screen.queryByText(/en impugnación — pendiente/i)).toBeNull();
  });
});
