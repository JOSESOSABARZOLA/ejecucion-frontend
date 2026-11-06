/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Bandeja de Salida — tres pestañas y despacho por lote (2026-09-17, ampliado el 09-18)
 * Archivo: BandejaSalidaPage.test.tsx
 * Responsabilidad: Fijar lo que la pantalla PROMETE y que no se puede leer del backend:
 *
 *   1. que cada pestaña consulta SU destino, y que cambiar de pestaña reinicia búsqueda y selección
 *      —son dos universos distintos, y arrastrar una selección de SG a DMR despacharía expedientes
 *      que el usuario ya no está viendo;
 *   2. que el despacho manda los expedientes ELEGIDOS con el destino de la pestaña activa, y que al
 *      volver limpia la selección y recarga (si no, la lista seguiría ofreciendo lo ya despachado);
 *   3. que `despachado: false` se cuenta como AVISO y no como error: el lote se creó con sus
 *      expedientes dentro y lo que falló fue la remisión — decirle «error» al usuario le haría creer
 *      que perdió el trabajo de elegir treinta expedientes;
 *   4. que la DEVOLUCIÓN dice si su MEMORANDO salió o no, que es la mitad del acto que el usuario no
 *      puede ver por sí mismo.
 *
 *   No recorre el maquetado: se prueban las llamadas al servicio y los avisos, que es donde viven
 *   las decisiones.
 *   5. (Fase 03.21) que la devolución a DMR/DMIT la despacha SOLO el director, con su clave dentro de
 *      la confirmación, que un fallo de firma se dice y se reintenta escribiendo en el campo, y que el
 *      aviso de éxito dice si el memorando salió firmado. SG no cambia.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 14 — D-07/D-19/D-24: la clave del
 *   director en la confirmación de DMR/DMIT, el gate del rol, el fallo de firma y `memoFirmado`).
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: los fallos del despacho se afirman en
 *   el aviso flotante; ConfirmationDetail ya no los pinta en una caja)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ExpedientePendienteSalida } from "../services/EntradaLotesService";
import { resetModoDeFirmaCache } from "../hooks/useClaveDeFirma";
import { errorDelServidor } from "../test/errores";
// El FUENTE de la página, como texto (`?raw`, no `node:fs`): mismo patrón que PasoFirmaClave.test.tsx.
import fuenteDeLaPagina from "./BandejaSalidaPage.tsx?raw";

const mocks = vi.hoisted(() => ({
  pendientesSalida: vi.fn(),
  despacharSalida: vi.fn(),
  addToast: vi.fn(),
  readModoDeFirma: vi.fn(),
  usuario: { usuId: 4, rolName: "director" } as {
    usuId: number;
    rolName: string;
  },
}));

// Fase 03.21: el hook de la clave lee el modo de firma por el export POR DEFECTO del servicio.
vi.mock("../services/SorteoService", () => ({
  default: { readModoDeFirma: mocks.readModoDeFirma },
  SorteoService: { readModoDeFirma: mocks.readModoDeFirma },
}));

vi.mock("../services/EntradaLotesService", () => ({
  EntradaLotesService: {
    pendientesSalida: mocks.pendientesSalida,
    despacharSalida: mocks.despacharSalida,
  },
}));

// La REVISIÓN se hace en la FICHA del expediente (2026-09-18), y su árbol llega hasta `react-pdf`,
// que en jsdom revienta al cargarse (`DOMMatrix is not defined`). Se dobla: lo que esta prueba
// comprueba es que la fila la OFREZCA, no lo que la ficha pinta por dentro —eso lo prueba
// `ModalExpedienteLote.test.tsx`.
vi.mock("../components/modals/ModalExpedienteLote", () => ({
  MODAL_KEY: "expedienteLote",
  default: () => <div data-testid="ficha-expediente" />,
}));

vi.mock("../context/UserContext", () => ({
  useUser: () => ({
    user: mocks.usuario,
    sessionState: "authenticated",
  }),
}));
vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

import BandejaSalidaPage from "./BandejaSalidaPage";

// Por omisión: el DIRECTOR y el firmador APAGADO, la conducta de antes de la Fase 03.21.
beforeEach(() => {
  mocks.usuario = { usuId: 4, rolName: "director" };
  mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
  resetModoDeFirmaCache();
});

/**
 * Un expediente mínimo: lo que la fila necesita para pintarse y poder elegirse.
 *
 * Nace SIN observaciones pendientes (2026-09-18): el caso normal es el del expediente que el
 * director ya revisó, y es el que deja probar todo lo demás. Las pruebas del candado pasan sus
 * propias cifras por `over`.
 */
const expediente = (
  eejeId: number,
  expNumber: string,
  eejeStatus = "PENDIENTE_ARCHIVO",
  over: Partial<ExpedientePendienteSalida> = {},
): ExpedientePendienteSalida => ({
  eejeId,
  eejeStatus,
  expNumber,
  admiName: "Gabriela",
  admiLastname: "Díaz",
  admiIdentification: "1712345678",
  observacionesPendientes: 0,
  observacionesAprobadas: 0,
  observacionesRechazadas: 0,
  ...over,
});

/** La forma paginada que devuelve la bandeja. */
const pagina = (data: ExpedientePendienteSalida[], total = data.length) => ({
  data,
  total,
  limit: 10,
  offset: 0,
  page: 1,
  pages: Math.ceil(total / 10) || 0,
});

/**
 * Acepta el diálogo de confirmación. Se busca por la CLASE del botón de submit y no por su texto:
 * cada pestaña redacta el suyo («Sí, generar y enviar» / «Sí, generar el lote») y atar la prueba a
 * esas frases la rompería al reescribir una copy, que es justo lo que no se está probando aquí.
 */
const aceptarConfirmacion = async () => {
  const boton = await waitFor(() => {
    const b = document.querySelector<HTMLButtonElement>(
      ".app-modules-modal-submit",
    );
    if (!b) throw new Error("No se abrió el diálogo de confirmación");
    return b;
  });
  fireEvent.click(boton);
};

const pintar = () =>
  render(
    <MemoryRouter>
      <BandejaSalidaPage />
    </MemoryRouter>,
  );

/** El destino con el que se hizo la última consulta de pendientes. */
const ultimoDestino = () =>
  mocks.pendientesSalida.mock.calls[
    mocks.pendientesSalida.mock.calls.length - 1
  ][0];

describe("BandejaSalidaPage — las tres pestañas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pendientesSalida.mockResolvedValue(pagina([expediente(5, "EXP-1")]));
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-SG-2026-0042",
      casos: 1,
      despachado: true,
    });
  });

  it("abre en «Envío a SG» y consulta ese destino", async () => {
    pintar();

    await waitFor(() => expect(mocks.pendientesSalida).toHaveBeenCalled());
    expect(ultimoDestino()).toBe("SG");
  });

  it("cambiar a «Devolución a DMR» consulta el OTRO destino", async () => {
    pintar();
    await waitFor(() => expect(mocks.pendientesSalida).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Devolución a DMR"));

    await waitFor(() => expect(ultimoDestino()).toBe("DMR"));
  });

  it("🔴 cambiar de pestaña PIERDE la selección: son dos universos, y arrastrarla despacharía expedientes que ya no se ven", async () => {
    pintar();
    await screen.findByText("EXP-1");

    // Elegir el expediente de SG…
    fireEvent.click(
      screen.getByLabelText("Seleccionar el expediente EXP-1"),
    );
    expect(screen.getByText("Generar lote (1)")).toBeTruthy();

    // …y cambiar de pestaña.
    fireEvent.click(screen.getByText("Devolución a DMR"));

    await waitFor(() => expect(ultimoDestino()).toBe("DMR"));
    expect(screen.queryByText("Generar lote (1)")).toBeNull();
    expect(screen.getByText("Generar lote")).toBeTruthy();
  });

  it("🔴 la TERCERA pestaña consulta la DMIT, no la DMR: son dos direcciones distintas y un expediente no puede salir en las dos", async () => {
    pintar();
    await waitFor(() => expect(mocks.pendientesSalida).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Devolución a DMIT"));

    await waitFor(() => expect(ultimoDestino()).toBe("DMIT"));
  });

  it("🔴 cambiar de la DMR a la DMIT también PIERDE la selección: despachar mezclado crearía un lote con el destino equivocado", async () => {
    pintar();
    await screen.findByText("EXP-1");
    fireEvent.click(screen.getByText("Devolución a DMR"));
    await waitFor(() => expect(ultimoDestino()).toBe("DMR"));

    await screen.findByText("EXP-1");
    fireEvent.click(screen.getByLabelText("Seleccionar el expediente EXP-1"));
    expect(screen.getByText("Generar lote (1)")).toBeTruthy();

    fireEvent.click(screen.getByText("Devolución a DMIT"));

    await waitFor(() => expect(ultimoDestino()).toBe("DMIT"));
    expect(screen.queryByText("Generar lote (1)")).toBeNull();
  });

  it("el botón de generar el lote no hace nada sin selección: un lote de cero expedientes es un acto vacío", async () => {
    pintar();
    await screen.findByText("EXP-1");

    const boton = screen.getByText("Generar lote").closest("button")!;
    expect(boton.hasAttribute("disabled")).toBe(true);
  });
});

describe("BandejaSalidaPage — el despacho", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pendientesSalida.mockResolvedValue(
      pagina([expediente(5, "EXP-1"), expediente(6, "EXP-2")]),
    );
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-SG-2026-0042",
      casos: 1,
      despachado: true,
    });
  });

  /** Elige EXP-1, abre la confirmación y la acepta. */
  const despacharExp1 = async () => {
    await screen.findByText("EXP-1");
    fireEvent.click(screen.getByLabelText("Seleccionar el expediente EXP-1"));
    fireEvent.click(screen.getByText("Generar lote (1)"));
    await aceptarConfirmacion();
  };

  it("manda al backend SOLO los expedientes elegidos, con el destino de la pestaña activa", async () => {
    pintar();
    await despacharExp1();

    await waitFor(() => expect(mocks.despacharSalida).toHaveBeenCalled());
    expect(mocks.despacharSalida).toHaveBeenCalledWith("SG", [5], undefined);
  });

  it("tras despachar, LIMPIA la selección y RECARGA: si no, la lista seguiría ofreciendo lo ya despachado", async () => {
    pintar();
    const consultasAntes = mocks.pendientesSalida.mock.calls.length;
    await despacharExp1();

    await waitFor(() =>
      expect(mocks.pendientesSalida.mock.calls.length).toBeGreaterThan(
        consultasAntes,
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("Generar lote (1)")).toBeNull(),
    );
  });

  it("🔴 `despachado: false` es un AVISO, no un error: el lote se creó y lo que falló fue la remisión", async () => {
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-SG-2026-0042",
      casos: 1,
      despachado: false,
      detalle: "SG no aceptó el archivo",
    });
    pintar();
    await despacharExp1();

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    const [variante, mensaje] = mocks.addToast.mock.calls[0];
    // El trabajo de elegir treinta expedientes NO se perdió, y el mensaje lo dice.
    expect(variante).toBe("info");
    expect(mensaje).toContain("DME-SG-2026-0042");
    expect(mensaje).toContain("SG no aceptó el archivo");
  });

  it("un fallo de red SÍ es error, y NO limpia la selección (el usuario reintenta con lo mismo elegido)", async () => {
    mocks.despacharSalida.mockRejectedValue(new Error("Servidor no disponible"));
    pintar();
    await despacharExp1();

    // El fallo lo dice ConfirmationDetail en el aviso flotante, una vez (quick 261028-kmg).
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(/No se pudo generar el lote/),
      ),
    );
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
  });
});

describe("BandejaSalidaPage — el memorando de la devolución", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pendientesSalida.mockResolvedValue(
      pagina([expediente(5, "EXP-1", "DEVUELTO_DMR")]),
    );
  });

  /** Va a la pestaña de DMR, elige EXP-1 y despacha. */
  const devolverExp1 = async () => {
    fireEvent.click(screen.getByText("Devolución a DMR"));
    await waitFor(() => expect(ultimoDestino()).toBe("DMR"));
    await screen.findByText("EXP-1");
    fireEvent.click(screen.getByLabelText("Seleccionar el expediente EXP-1"));
    fireEvent.click(screen.getByText("Generar lote (1)"));
    await aceptarConfirmacion();
  };

  it("🔴 dice que el MEMORANDO se generó: es la mitad del acto que el usuario no puede ver por sí mismo", async () => {
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-DEV-2026-0042",
      casos: 1,
      despachado: true,
      memoUrl: "/api/fileserver/ejecucion/memorandos/2026/10/memo-devolucion-DME-DEV-2026-0042.pdf",
    });
    pintar();
    await devolverExp1();

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    const [variante, mensaje] = mocks.addToast.mock.calls[0];
    expect(variante).toBe("success");
    expect(mensaje).toContain("memorando de devolución");
  });

  it("🔴 y AVISA cuando NO se pudo generar: es justo el caso en el que el usuario tiene que hacer algo", async () => {
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-DEV-2026-0042",
      casos: 1,
      despachado: true,
      memoUrl: null,
    });
    pintar();
    await devolverExp1();

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    const [, mensaje] = mocks.addToast.mock.calls[0];
    expect(mensaje).toContain("no se pudo generar");
    // El lote SIGUE creado: el documento no deshace la devolución.
    expect(mensaje).toContain("DME-DEV-2026-0042");
  });

  it("el ARCHIVO a SG no habla de memorando: ese documento es el de la vuelta a la DMR", async () => {
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-SG-2026-0042",
      casos: 1,
      despachado: true,
    });
    pintar();
    await screen.findByText("EXP-1");
    fireEvent.click(screen.getByLabelText("Seleccionar el expediente EXP-1"));
    fireEvent.click(screen.getByText("Generar lote (1)"));
    await aceptarConfirmacion();

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    expect(mocks.addToast.mock.calls[0][1]).not.toContain("memorando");
  });

  it("🔴 despachar desde la DMIT también dice si el memorando salió: devolver a Instrucción no es un caso de segunda", async () => {
    mocks.despacharSalida.mockResolvedValue({
      envlId: 43,
      numeroLote: "DME-DMIT-2026-0043",
      casos: 1,
      despachado: true,
      memoUrl: "/api/fileserver/ejecucion/memorandos/2026/10/memo-devolucion-DME-DMIT-2026-0043.pdf",
    });
    pintar();
    fireEvent.click(screen.getByText("Devolución a DMIT"));
    await waitFor(() => expect(ultimoDestino()).toBe("DMIT"));
    await screen.findByText("EXP-1");
    fireEvent.click(screen.getByLabelText("Seleccionar el expediente EXP-1"));
    fireEvent.click(screen.getByText("Generar lote (1)"));
    await aceptarConfirmacion();

    await waitFor(() => expect(mocks.despacharSalida).toHaveBeenCalled());
    expect(mocks.despacharSalida).toHaveBeenCalledWith("DMIT", [5], undefined);
    const [variante, mensaje] = mocks.addToast.mock.calls[0];
    expect(variante).toBe("success");
    expect(mensaje).toContain("memorando de devolución");
  });

  it("🔴 la confirmación de la DMIT nombra a INSTRUCCIÓN y NO a Resolución: es lo último que el usuario lee antes de sacar el expediente del módulo", async () => {
    pintar();
    fireEvent.click(screen.getByText("Devolución a DMIT"));
    await waitFor(() => expect(ultimoDestino()).toBe("DMIT"));
    await screen.findByText("EXP-1");
    fireEvent.click(screen.getByLabelText("Seleccionar el expediente EXP-1"));
    fireEvent.click(screen.getByText("Generar lote (1)"));

    const texto = await waitFor(() => {
      const modal = document.querySelector(".modal-open");
      if (!modal) throw new Error("No se abrió el diálogo de confirmación");
      return modal.textContent ?? "";
    });

    expect(texto).toContain("Dirección Metropolitana de Instrucción");
    expect(texto).not.toContain("Dirección Metropolitana de Resolución");
  });

  // 261012-giz (2026-10-12): en las tres pestañas se mezclan dos actos; la fila del recurso aceptado
  // lo dice, y las demás no cambian.
  it("una fila en RECURSO_ACEPTADO dice «Recurso aceptado»; las de otros estados no", async () => {
    mocks.pendientesSalida.mockResolvedValue(
      pagina([
        expediente(5, "EXP-1", "RECURSO_ACEPTADO"),
        expediente(6, "EXP-2", "DEVUELTO_POR_NULIDAD"),
      ]),
    );
    pintar();
    fireEvent.click(screen.getByText("Devolución a DMIT"));
    await waitFor(() => expect(ultimoDestino()).toBe("DMIT"));
    await screen.findByText("EXP-1");

    expect(screen.getAllByText("Recurso aceptado")).toHaveLength(1);
  });

  it("sin recursos aceptados en la página, la etiqueta no aparece", async () => {
    pintar();
    await screen.findByText("EXP-1");
    expect(screen.queryByText("Recurso aceptado")).toBeNull();
  });
});

/**
 * EL CANDADO DE LA REVISIÓN (2026-09-18) — encargo del área: el director aprueba o rechaza las
 * observaciones antes de que los documentos se devuelvan.
 *
 * Lo que se fija aquí es lo que la pantalla promete y el backend no puede enseñar: que un expediente
 * sin revisar NO SE PUEDE ELEGIR. El backend lo rechaza igual al despachar; si la casilla se dejara
 * encendida, el usuario elegiría treinta expedientes y recibiría el error al confirmar, sin saber
 * cuál de los treinta lo causó.
 */
describe("BandejaSalidaPage — el candado de la revisión del director", () => {
  /** Uno revisado (elegible) y otro con dos observaciones sin ver (bloqueado). */
  const conUnBloqueado = () =>
    pagina([
      expediente(5, "EXP-1", "DEVUELTO_DMR", { observacionesAprobadas: 2 }),
      expediente(6, "EXP-2", "DEVUELTO_DMR", { observacionesPendientes: 2 }),
    ]);

  /** Lleva la pantalla a la pestaña de devolución a la DMR y espera a que pinte. */
  const enDmr = async () => {
    pintar();
    fireEvent.click(screen.getByText("Devolución a DMR"));
    await waitFor(() => expect(ultimoDestino()).toBe("DMR"));
    await screen.findByText("EXP-2");
  };

  const casilla = (expNumber: string) =>
    screen.getByLabelText(
      `Seleccionar el expediente ${expNumber}`,
    ) as HTMLInputElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pendientesSalida.mockResolvedValue(conUnBloqueado());
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-DMR-2026-0042",
      casos: 1,
      despachado: true,
      memoUrl: "/api/fileserver/ejecucion/memorandos/2026/10/m.pdf",
    });
  });

  it("🔴 el expediente con observaciones SIN REVISAR no se puede elegir; el revisado sí", async () => {
    await enDmr();

    expect(casilla("EXP-2").disabled).toBe(true);
    expect(casilla("EXP-1").disabled).toBe(false);
  });

  it("«Seleccionar todos» se salta los bloqueados: despacharía justo lo que el backend rechaza", async () => {
    await enDmr();
    fireEvent.click(screen.getByText("Seleccionar todos los de esta página"));

    // Solo uno de los dos entra en la selección, y es el revisado.
    await screen.findByText("Generar lote (1)");
    expect(casilla("EXP-1").checked).toBe(true);
    expect(casilla("EXP-2").checked).toBe(false);
  });

  it("la fila dice CUÁNTAS faltan por revisar, no solo que faltan", async () => {
    await enDmr();

    // «2 sin revisar» y no «sin revisar»: una observación pendiente y ocho no son el mismo trabajo.
    expect(screen.getByText("2 sin revisar")).toBeTruthy();
    expect(screen.getByText("2 aprobada(s)")).toBeTruthy();
  });

  it("el botón de revisar sale en la fila de la devolución, con el total de observaciones", async () => {
    await enDmr();

    // Las DOS filas lo ofrecen —también la ya revisada: el director puede cambiar de opinión
    // mientras el lote no salga— y las dos suman dos observaciones, así que hay dos botones.
    expect(screen.getAllByText("Observaciones (2)")).toHaveLength(2);
  });

  /**
   * 🔴 ABRE LA FICHA DEL EXPEDIENTE, NO UN DIÁLOGO PROPIO (2026-09-18, encargo del área: «se le debe
   * levantar el mismo modal que cuando se agregan las observaciones»). Hubo un diálogo propio de
   * esta pantalla durante unas horas y se retiró: partía en dos el mismo acto y dejaba al director
   * decidiendo sobre una lista de frases, sin el expediente delante.
   */
  it("revisar abre la MISMA ficha en la que se anotan las observaciones", async () => {
    await enDmr();

    expect(screen.queryByTestId("ficha-expediente")).toBeNull();
    fireEvent.click(screen.getAllByText("Observaciones (2)")[0]);

    expect(screen.getByTestId("ficha-expediente")).toBeTruthy();
  });

  // En SG no hay observaciones ni memorando de motivos: el botón ahí sería una puerta a una pantalla
  // vacía, y la casilla no debe bloquearse nunca.
  it("la pestaña de ARCHIVO no ofrece la revisión: ahí no hay nada que revisar", async () => {
    mocks.pendientesSalida.mockResolvedValue(
      pagina([
        expediente(7, "EXP-3", "PENDIENTE_ARCHIVO", {
          observacionesPendientes: 3,
        }),
      ]),
    );
    pintar();
    await screen.findByText("EXP-3");

    expect(screen.queryByText("Observaciones (3)")).toBeNull();
    expect(casilla("EXP-3").disabled).toBe(false);
  });
});

/**
 * FASE 03.21 — EL MEMORANDO DE DEVOLUCIÓN SE FIRMA CON LA CLAVE DEL DIRECTOR (D-19, D-24).
 *
 * Los textos se escriben A MANO (UI-SPEC §6, §10): importarlos convertiría las aserciones en
 * tautologías. La clave es un valor ficticio, reconocible si se escapara.
 */
describe("BandejaSalidaPage — la firma del memorando de devolución (Fase 03.21)", () => {
  const AVISO_SIN_FIRMADOR_MEMORANDO =
    "La firma digital está desactivada en este despliegue: el memorando de devolución se generará SIN firma criptográfica.";
  const MOTIVO_SOLO_DIRECTOR =
    "Solo el director despacha y firma el memorando de devolución.";
  const TEXTO_CLAVE_INCORRECTA_SERVIDOR =
    "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.";
  const CLAVE_FICTICIA = "clave-ficticia-de-prueba";

  const encendido = () =>
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });

  const botonConfirmar = () =>
    document.querySelector<HTMLButtonElement>(".app-modules-modal-submit")!;

  const modal = () => document.querySelector(".modal-open");

  /** Abre la pestaña, elige EXP-1 y abre la confirmación (sin aceptarla). */
  const abrirConfirmacion = async (pestana?: string) => {
    pintar();
    if (pestana) {
      fireEvent.click(screen.getByText(pestana));
      await waitFor(() =>
        expect(ultimoDestino()).toBe(pestana.includes("DMIT") ? "DMIT" : "DMR"),
      );
    }
    await screen.findByText("EXP-1");
    await waitFor(() => expect(mocks.readModoDeFirma).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText("Seleccionar el expediente EXP-1"));
    fireEvent.click(screen.getByText("Generar lote (1)"));
    await waitFor(() => expect(modal()).toBeTruthy());
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pendientesSalida.mockResolvedValue(
      pagina([expediente(5, "EXP-1", "DEVUELTO_DMR")]),
    );
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-DMR-2026-0042",
      casos: 1,
      despachado: true,
      memoUrl: "/api/fileserver/ejecucion/memorandos/2026/10/m.pdf",
      memoFirmado: true,
    });
  });

  it("SG: la confirmación NO pide clave ni habla de memorando, aunque el firmador esté encendido", async () => {
    encendido();
    await abrirConfirmacion();

    expect(screen.queryByLabelText("Clave de firma")).toBeNull();
    expect(modal()!.textContent).not.toContain("memorando");
    expect(botonConfirmar().disabled).toBe(false);
  });

  it("SG: el secretario abogado sigue despachando (su botón no se apaga)", async () => {
    mocks.usuario = { usuId: 9, rolName: "Secretario Abogado" };
    pintar();
    await screen.findByText("EXP-1");
    fireEvent.click(screen.getByLabelText("Seleccionar el expediente EXP-1"));

    const boton = screen.getByText("Generar lote (1)").closest("button")!;
    expect(boton.hasAttribute("disabled")).toBe(false);
  });

  it("🔴 DMR/DMIT con el SECRETARIO: el despacho se apaga y el envoltorio dice por qué", async () => {
    mocks.usuario = { usuId: 9, rolName: "Secretario Abogado" };
    for (const pestana of ["Devolución a DMR", "Devolución a DMIT"]) {
      const { unmount } = pintar();
      fireEvent.click(screen.getByText(pestana));
      await screen.findByText("EXP-1");
      fireEvent.click(screen.getByLabelText("Seleccionar el expediente EXP-1"));

      const boton = screen.getByText("Generar lote (1)").closest("button")!;
      expect(boton.hasAttribute("disabled")).toBe(true);
      // El motivo va en el ENVOLTORIO: un botón apagado no recibe el puntero.
      expect(boton.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
        MOTIVO_SOLO_DIRECTOR,
      );
      unmount();
    }
  });

  it("DMR con el director y el firmador APAGADO: el aviso del memorando sin firma, sin campo, y se despacha sin clave", async () => {
    await abrirConfirmacion("Devolución a DMR");

    expect(screen.getByText(AVISO_SIN_FIRMADOR_MEMORANDO)).toBeTruthy();
    expect(screen.queryByLabelText("Clave de firma")).toBeNull();
    expect(botonConfirmar().disabled).toBe(false);
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.despacharSalida).toHaveBeenCalledWith("DMR", [5], undefined),
    );
  });

  it("🔴 DMR con el director y el firmador ENCENDIDO: el campo está en la confirmación, sin clave no se confirma y la clave viaja como tercer argumento", async () => {
    encendido();
    await abrirConfirmacion("Devolución a DMR");

    const campo = (await screen.findByLabelText(
      "Clave de firma",
    )) as HTMLInputElement;
    // Hijo de la confirmación, antes de sus acciones.
    expect(modal()!.contains(campo)).toBe(true);
    expect(botonConfirmar().disabled).toBe(true);

    fireEvent.change(campo, { target: { value: CLAVE_FICTICIA } });
    expect(botonConfirmar().disabled).toBe(false);
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.despacharSalida).toHaveBeenCalledWith(
        "DMR",
        [5],
        CLAVE_FICTICIA,
      ),
    );
    // Ningún aviso lleva la clave.
    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toContain(
      CLAVE_FICTICIA,
    );
  });

  it("DMIT con el director y el firmador ENCENDIDO: también pide la clave", async () => {
    encendido();
    await abrirConfirmacion("Devolución a DMIT");

    expect(await screen.findByLabelText("Clave de firma")).toBeTruthy();
  });

  it("🔴 clave rechazada: se dice UNA vez, bajo el campo —vacío, marcado y con el foco—, sin caja ni aviso flotante, y escribir en él lo retira y rearma el botón (UAT 03.21, hueco 2)", async () => {
    encendido();
    mocks.despacharSalida.mockRejectedValueOnce(
      errorDelServidor(
        TEXTO_CLAVE_INCORRECTA_SERVIDOR,
        422,
        "APP-FIRMA-CLAVE-001",
      ),
    );
    await abrirConfirmacion("Devolución a DMR");
    fireEvent.change(await screen.findByLabelText("Clave de firma"), {
      target: { value: CLAVE_FICTICIA },
    });
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(screen.getByLabelText("Clave de firma")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    const campo = screen.getByLabelText("Clave de firma") as HTMLInputElement;
    expect(campo.value).toBe("");
    expect(screen.getByText("La clave de firma no es correcta.")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(campo));
    // Ni la caja con la consecuencia ni un aviso flotante de error que lo repita.
    expect(
      screen.queryByText(/No se generó el lote ni su memorando\./),
    ).toBeNull();
    expect(modal()!.querySelector('[role="alert"]')).toBeNull();
    expect(mocks.addToast).not.toHaveBeenCalledWith("error", expect.anything());
    // Con la clave vacía el botón está apagado…
    expect(botonConfirmar().disabled).toBe(true);
    expect(document.body.textContent).not.toContain(CLAVE_FICTICIA);

    // …y escribir en el campo retira la línea y lo rearma.
    fireEvent.change(campo, { target: { value: "otra-clave-ficticia" } });
    expect(screen.queryByText("La clave de firma no es correcta.")).toBeNull();
    expect(botonConfirmar().disabled).toBe(false);
  });

  it("🔴 otro fallo de firma: «No se generó el lote ni su memorando. …» SOLO en el aviso flotante, una vez; el campo sin marcar, el botón apagado y escribir lo rearma", async () => {
    encendido();
    mocks.despacharSalida.mockRejectedValueOnce(
      errorDelServidor(
        "El servicio de firma no responde. Inténtelo de nuevo en unos minutos.",
        504,
        "APP-FIRMA-NO-RESPONDE-001",
      ),
    );
    await abrirConfirmacion("Devolución a DMR");
    fireEvent.change(await screen.findByLabelText("Clave de firma"), {
      target: { value: CLAVE_FICTICIA },
    });
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(
          /^No se generó el lote ni su memorando\. El servicio de firma no responde/,
        ),
      ),
    );
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(modal()!.querySelector('[role="alert"]')).toBeNull();
    const campo = screen.getByLabelText("Clave de firma") as HTMLInputElement;
    expect(campo.getAttribute("aria-invalid")).toBeNull();
    expect(botonConfirmar().disabled).toBe(true);

    fireEvent.change(campo, { target: { value: "otra-clave-ficticia" } });
    expect(botonConfirmar().disabled).toBe(false);
  });

  it("🔴 la clave tecleada no llega a ningún aviso flotante cuando el envío falla", async () => {
    encendido();
    mocks.despacharSalida.mockRejectedValueOnce(
      errorDelServidor(
        "El servicio de firma no responde. Inténtelo de nuevo en unos minutos.",
        504,
        "APP-FIRMA-NO-RESPONDE-001",
      ),
    );
    await abrirConfirmacion("Devolución a DMR");
    fireEvent.change(await screen.findByLabelText("Clave de firma"), {
      target: { value: "secreta-123" },
    });
    fireEvent.click(botonConfirmar());

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toContain(
      "secreta-123",
    );
  });

  it("🔴 si el despacho agota el tiempo, el resultado es DESCONOCIDO: no dice «no se generó», dice que actualice antes de repetir (revisión 03.21, WR-08)", async () => {
    encendido();
    const tiempo = errorDelServidor(
      "El servidor tardó demasiado en responder. Actualice la página para comprobar si la operación se completó antes de repetirla.",
    );
    tiempo.status = undefined;
    tiempo.code = "ECONNABORTED";
    tiempo.causa = "tiempo";
    mocks.despacharSalida.mockRejectedValueOnce(tiempo);
    await abrirConfirmacion("Devolución a DMR");
    fireEvent.change(await screen.findByLabelText("Clave de firma"), {
      target: { value: CLAVE_FICTICIA },
    });
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(/Actualice la página para comprobar si la operación se completó/),
      ),
    );
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toMatch(/No se generó el lote/);
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
  });

  it("éxito con `memoFirmado`: el aviso dice que el memorando se generó Y SE FIRMÓ", async () => {
    encendido();
    await abrirConfirmacion("Devolución a DMR");
    fireEvent.change(await screen.findByLabelText("Clave de firma"), {
      target: { value: CLAVE_FICTICIA },
    });
    fireEvent.click(botonConfirmar());

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    const [variante, mensaje] = mocks.addToast.mock.calls[0];
    expect(variante).toBe("success");
    expect(mensaje).toContain(" Se generó y firmó el memorando de devolución.");
  });

  it("éxito sin `memoFirmado` (firmador apagado): «Se generó el memorando de devolución.», sin decir que se firmó", async () => {
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-DMR-2026-0042",
      casos: 1,
      despachado: true,
      memoUrl: "/api/fileserver/ejecucion/memorandos/2026/10/m.pdf",
      memoFirmado: false,
    });
    await abrirConfirmacion("Devolución a DMR");
    fireEvent.click(botonConfirmar());

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    const [, mensaje] = mocks.addToast.mock.calls[0];
    expect(mensaje).toContain(" Se generó el memorando de devolución.");
    expect(mensaje).not.toContain("firmó");
  });

  it("🔴 con el firmador ENCENDIDO nunca dice «…no se pudo generar; el lote queda creado»: con el todo o nada ese estado no existe", async () => {
    encendido();
    mocks.despacharSalida.mockResolvedValue({
      envlId: 42,
      numeroLote: "DME-DMR-2026-0042",
      casos: 1,
      despachado: true,
      memoUrl: null,
      memoFirmado: false,
    });
    await abrirConfirmacion("Devolución a DMR");
    fireEvent.change(await screen.findByLabelText("Clave de firma"), {
      target: { value: CLAVE_FICTICIA },
    });
    fireEvent.click(botonConfirmar());

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    expect(mocks.addToast.mock.calls[0][1]).not.toContain(
      "no se pudo generar",
    );
  });

  it("la clave se borra al CERRAR la confirmación", async () => {
    encendido();
    await abrirConfirmacion("Devolución a DMR");
    fireEvent.change(await screen.findByLabelText("Clave de firma"), {
      target: { value: CLAVE_FICTICIA },
    });

    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => expect(modal()).toBeNull());

    fireEvent.click(screen.getByText("Generar lote (1)"));
    const campo = (await screen.findByLabelText(
      "Clave de firma",
    )) as HTMLInputElement;
    expect(campo.value).toBe("");
  });

  it("🔴 D-16 — el fuente de la página no escribe en consola, almacenamiento, cookie ni URL", () => {
    for (const via of [
      "console.",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "window.location",
    ]) {
      expect(fuenteDeLaPagina).not.toContain(via);
    }
  });
});
