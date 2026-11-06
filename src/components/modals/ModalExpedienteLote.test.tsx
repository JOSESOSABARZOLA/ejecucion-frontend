/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Archivo: ModalExpedienteLote.test.tsx
 * Responsabilidad: Fijar la conducta que el área pidió textualmente y que es la razón de ser de todo
 *   el cambio: **lo que se anota sobrevive a cerrar la ficha**.
 *
 *   ── LO QUE SE PRUEBA DE VERDAD ───────────────────────────────────────────────────────────────
 *   · Que al ABRIR la ficha se lee lo ya guardado, y aparece en pantalla. Sin esto, reabrir
 *     empezaría de cero y el usuario creería que su trabajo se perdió.
 *   · Que al GUARDAR viaja el conjunto entero al servidor, con la etiqueta que el usuario vio —que
 *     es la que se imprime en el memorando— y no el nombre técnico del campo.
 *   · Que el AVISO distingue «lo anoté» de «lo anoté y lo mandé». Esa diferencia importa porque el
 *     memorando lee el servidor, no la pantalla.
 *   · Que CERRAR refresca la bandeja: el badge «Por devolver» lo calcula el servidor, así que sin la
 *     recarga el usuario observa, cierra, y la fila sigue igual.
 *
 *   ── Y DESDE EL 2026-09-21, LA OTRA BANDEJA (D-10) ────────────────────────────────────────────
 *   La misma ficha se abre ahora desde «Mis Expedientes», donde absorbe lo que vivía en el
 *   desplegable del decisor. El tercer `describe` fija esa mitad: las pestañas absorbidas, que la
 *   señal de «Adjuntar documento» llega hasta dentro, que la regla de las dos fases se mudó con
 *   ella, y que la capacidad de ESCRIBIR observaciones de triage **no** viajó con el resto.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-18
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 10: la ficha absorbente del decisor).
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: la ficha deja la pestaña de multas
 *   compulsorias. La prueba de la fila ACEPTADA afirma ahora las DOS absorbidas y que la serie ya no
 *   se ofrece ni se pide; el doble de la serie se conserva como guarda de esa negativa.)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 13, D-16/D-08: la pestaña
 *   «Infracciones» existe desde las DOS bandejas, y la ficha no pide nada al abrirse: la ficha de
 *   infracciones se pide al pulsar la pestaña, y esa petición es el «uso» que refresca CORE.)
 * Modificado por: Andrés Miño — 2026-10-19 (UAT 03.23-14: la negativa de la descarga se ve también
 *   como decisor.)
 * Modificado por: Andrés Miño — 2026-10-19 (quick 261019-mcf: el último `describe` fija el cierre
 *   al pulsar fuera de la ficha.)
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 11, D-05: un `describe` fija que la
 *   pestaña de información abre con la alerta «Datos de Resolución incompletos» y su lista cuando el
 *   servidor manda faltantes, desde las dos bandejas, y que sin faltantes no aparece.)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-01)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el éxito y los fallos de guardar,
 *   verificar y descargar se afirman en el aviso flotante; el fallo de carga sigue en línea)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: la pestaña «Recursos» lee la vista de
 *   la impugnación al abrirse; se dobla `leerEstado` y se afirma que la pide) * Modificado por: Andrés Miño — 2026-10-29 (quick 261029-kl0: `guardar` resuelve
 *   `{ observaciones, remisionRetirada }`; la remisión retirada se dice en un solo aviso y cierra la
 *   ficha del secretario; el director sabe cuándo puede remitir de nuevo)
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: se dobla `getDocumentosExternos`; el
 *   visor de PDF doblado enseña la URL que recibe, para afirmar que un documento de otro módulo se
 *   abre en el hueco de la derecha de la ficha del decisor)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: se dobla `DocumentosLecturaService`; un
 *   `describe` fija el número de no leídos en la pestaña «Documentación» —nada con 0 o con fallo—,
 *   que baja en 1 al abrir un documento nuevo, y que el resumen mínimo no lo pide)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq: un `describe` fija la «Multa Impuesta»
 *   de la ficha en «USD 2.300,00» y el 0 declarado en «USD 0,00»)
 */
import { errorDelServidor } from "../../test/errores";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import ModalExpedienteLote, {
  AVISO_NO_CUMPLIDAS,
  AVISO_REINGRESO_POR_VERIFICAR,
  AVISO_TODAS_CUMPLIDAS,
  ERROR_VERIFICACION,
} from "./ModalExpedienteLote";
import DialogoModal from "../common/DialogoModal";
import {
  AVISO_PUEDE_REMITIRSE,
  avisoRemisionRetiradaDirector,
  avisoRemisionRetiradaSecretario,
} from "../entrada/remisionCaso";
import type { EnvioLoteCaso } from "../../services/EntradaLotesService";
import type { IObservacion } from "../../interfaces/ICaseObservations";
import type { MiEpasAsignado } from "../../services/SorteoService";
import {
  crearMiEpasAsignado,
  crearMiEpasAsignadoPendiente,
} from "../../test/fixtures/miEpasAsignado";

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  guardar: vi.fn(),
  revisar: vi.fn(),
  verificar: vi.fn(),
  // ── D-10: los dos bloques absorbidos piden lo suyo; la serie de multas ya no se pide ───────
  listarDocumentos: vi.fn(),
  // ── quick 261030-dun: los documentos de los otros módulos, bajo los propios del decisor ──────
  documentosExternos: vi.fn(),
  listarNotificaciones: vi.fn(),
  serieMultas: vi.fn(),
  // ── Fase 03.23 (D-16/D-08): la pestaña «Infracciones» pide la ficha SOLO al abrirse ─────────
  fichaInfracciones: vi.fn(),
  descargarExpediente: vi.fn(),
  addToast: vi.fn(),
  openModal: vi.fn(),
  // ── quick 261028-mtg: la pestaña «Recursos» lee GET /epas/:id/impugnacion al montarse ──────
  leerEstadoImpugnacion: vi.fn(),
  // ── quick 261030-m29: el contador de no leídos de la pestaña y las lecturas de la lista. Con
  //    implementación propia, que `vi.clearAllMocks` conserva: por defecto nada sin leer, así el
  //    botón «Documentación» conserva su nombre en los describe de antes. ─────────────────────────
  contarNoLeidos: vi.fn(async () => ({}) as Record<number, number>),
  noLeidosDelEpas: vi.fn(async (eejeId: number) => ({
    eejeId,
    propios: [] as number[],
    externos: [],
    total: 0,
  })),
  marcarPropio: vi.fn(async () => undefined),
  marcarExterno: vi.fn(async () => undefined),
}));

vi.mock("../../services/DocumentosLecturaService", () => ({
  DocumentosLecturaService: {
    contar: mocks.contarNoLeidos,
    noLeidosDelEpas: mocks.noLeidosDelEpas,
    marcarPropio: mocks.marcarPropio,
    marcarExterno: mocks.marcarExterno,
  },
}));

// quick 261029-kl0: se conservan los helpers puros reales (`quedanObservacionesVivas`).
vi.mock("../../services/ObservacionesService", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../services/ObservacionesService")
  >()),
  ObservacionesService: {
    listar: mocks.listar,
    guardar: mocks.guardar,
    revisar: mocks.revisar,
    verificar: mocks.verificar,
  },
  default: {
    listar: mocks.listar,
    guardar: mocks.guardar,
    revisar: mocks.revisar,
    verificar: mocks.verificar,
  },
}));

// La pestaña «Documentación» no participa de estas conductas y arrastra el visor de PDF, que revienta
// en jsdom por falta de DOMMatrix. Se corta aquí y no en el registro de modales.
vi.mock("../documentation/CaseDirectionDocumentsList", () => ({
  default: () => null,
}));
// Quick 261030-dun: el doble enseña la URL que recibe (y nada más), para afirmar qué documento abre.
vi.mock("../pdf/PDFViewer", () => ({
  PDFViewer: ({ document }: { document: { docUrl?: string } }) => (
    <div data-testid="visor-pdf">{document.docUrl}</div>
  ),
}));

// ── D-10 ────────────────────────────────────────────────────────────────────────────────────────
// Los tres bloques absorbidos se montan DE VERDAD: es lo único que prueba que la ficha los ofrece y
// que su dato llega a la pantalla. Lo que se dobla es el HTTP, no el componente — doblar el
// componente dejaría pasar una pestaña que existe y no enseña nada.
//
// `importOriginal` en los dos servicios que exportan además catálogos (`ETIQUETA_FORMA`): esos se
// importan REALES a propósito, para que la prueba se apoye en el mismo contrato que consume la UI.
vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));
vi.mock("../../hooks/useModal", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
// La ficha importa el servicio por DEFECTO: se doblan las dos exportaciones o la descarga iría al
// servicio real.
vi.mock("../../services/EpasService", async (importOriginal) => {
  const doble = {
    getDocumentos: mocks.listarDocumentos,
    getDocumentosExternos: mocks.documentosExternos,
    descargarExpediente: mocks.descargarExpediente,
  };
  return {
    ...(await importOriginal<typeof import("../../services/EpasService")>()),
    EpasService: doble,
    default: doble,
  };
});
vi.mock(
  "../../services/NotificacionEjecucionService",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../services/NotificacionEjecucionService")
    >()),
    NotificacionEjecucionService: { porExpediente: mocks.listarNotificaciones },
  }),
);
vi.mock("../../services/MultaCompulsoriaService", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../services/MultaCompulsoriaService")
  >()),
  MultaCompulsoriaService: { serie: mocks.serieMultas, registrar: vi.fn() },
}));

// quick 261028-mtg: parcial — los catálogos del recurso se importan reales; solo se dobla el HTTP.
vi.mock("../../services/ImpugnacionService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../services/ImpugnacionService")>();
  return {
    ...real,
    ImpugnacionService: {
      ...real.ImpugnacionService,
      leerEstado: mocks.leerEstadoImpugnacion,
    },
  };
});

// Fase 03.23: parcial, como en `CeldaInfracciones` — `ETIQUETA_ESTADO_CORE` se importa real.
vi.mock("../../services/InfraccionesService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../services/InfraccionesService")>();
  const doble = { ...real.InfraccionesService, ficha: mocks.fichaInfracciones };
  return { ...real, InfraccionesService: doble, default: doble };
});

const caso: EnvioLoteCaso = {
  envlcId: 1,
  eejeId: 77,
  expNumber: "001-2026",
  admiName: "Daniela",
  admiLastname: "Morales",
  eejeStatus: "RECIBIDO",
};

const guardada: IObservacion = {
  obseId: 1,
  tipo: "CAMPO",
  clave: "admiLastname",
  etiqueta: "Apellido",
  texto: "No coincide con la cédula",
};

/** Pulsa el icono de etiqueta que hay junto a un campo de la ficha. */
const observarCampo = (rotulo: string) =>
  fireEvent.click(screen.getByTitle(`Observar «${rotulo}»`).querySelector("button")!);

describe("ModalExpedienteLote — la ficha que observa", () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue([]);
    mocks.guardar
      .mockReset()
      .mockImplementation(async (_id, lista) => ({
        observaciones: lista,
        remisionRetirada: false,
      }));
    mocks.addToast.mockReset();
  });

  it("el fallo al CARGAR las observaciones se queda en línea y no se repite en el aviso flotante (quick 261028-kmg)", async () => {
    mocks.listar.mockRejectedValue(errorDelServidor("Servicio caído."));

    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);

    expect(
      await screen.findByText("No se pudieron cargar las observaciones del expediente."),
    ).toBeInTheDocument();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it("🔴 al reabrir la ficha, lo anotado la vez anterior SIGUE AHÍ", async () => {
    mocks.listar.mockResolvedValue([guardada]);

    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);

    expect(await screen.findByText("No coincide con la cédula")).toBeInTheDocument();
    expect(mocks.listar).toHaveBeenCalledWith(77);
    expect(
      screen.getByText("Total de observaciones guardadas: 1"),
    ).toBeInTheDocument();
  });

  it("observar un campo, escribir y guardar manda al servidor la etiqueta que el usuario vio", async () => {
    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    observarCampo("Apellido");
    fireEvent.change(screen.getByLabelText("Texto de la observación"), {
      target: { value: "No coincide con la cédula" },
    });
    fireEvent.click(screen.getByText("Guardar observaciones"));

    await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());
    // 🔴 La ETIQUETA, y no `admiLastname`: es lo que sale impreso en la columna MOTIVO del
    // memorando, y quien lo reciba tiene que poder leerlo.
    expect(mocks.guardar).toHaveBeenCalledWith(77, [
      {
        tipo: "CAMPO",
        clave: "admiLastname",
        etiqueta: "Apellido",
        texto: "No coincide con la cédula",
      },
    ]);
  });

  it("🔴 pasar a OTRO campo no pierde lo escrito: «Guardar observaciones» manda las dos", async () => {
    // UAT 03.23-14: el panel ya no tiene botón de «añadir a la lista»; lo escrito entra al cambiar
    // de objetivo y al guardar.
    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    observarCampo("Apellido");
    fireEvent.change(screen.getByLabelText("Texto de la observación"), {
      target: { value: "No coincide con la cédula" },
    });
    observarCampo("Nombre");
    fireEvent.change(screen.getByLabelText("Texto de la observación"), {
      target: { value: "Falta el segundo nombre" },
    });
    fireEvent.click(screen.getByText("Guardar observaciones"));

    await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());
    expect(mocks.guardar).toHaveBeenCalledWith(77, [
      {
        tipo: "CAMPO",
        clave: "admiLastname",
        etiqueta: "Apellido",
        texto: "No coincide con la cédula",
      },
      {
        tipo: "CAMPO",
        clave: "admiName",
        etiqueta: "Nombre",
        texto: "Falta el segundo nombre",
      },
    ]);
    // Con dos, el éxito va en plural y en el aviso flotante (quick 261028-kmg).
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Se han guardado 2 observaciones correctamente",
      ),
    );
  });

  it("el panel ya no tiene el botoncito de «añadir a la lista»", async () => {
    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    observarCampo("Apellido");

    expect(
      screen.queryByTitle("Añadir la observación a la lista"),
    ).not.toBeInTheDocument();
  });

  it("mientras hay cambios sin mandar, la ficha AVISA; una vez mandados, felicita en el aviso flotante (sin caja verde)", async () => {
    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    observarCampo("Apellido");
    fireEvent.change(screen.getByLabelText("Texto de la observación"), {
      target: { value: "No coincide con la cédula" },
    });

    // Anotado pero NO mandado: el memorando todavía no sabe nada de esto.
    expect(
      await screen.findByText(/observaciones sin guardar/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Guardar observaciones"));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Se han guardado 1 observación correctamente",
      ),
    );
    expect(
      screen.queryByText("Se han guardado 1 observación correctamente"),
    ).toBeNull();
    expect(screen.queryByText(/sin guardar/i)).not.toBeInTheDocument();
  });

  it("«Borrar observaciones» manda una lista vacía: un borrado total es legítimo", async () => {
    mocks.listar.mockResolvedValue([guardada]);

    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);
    await screen.findByText("No coincide con la cédula");

    fireEvent.click(screen.getByText("Borrar observaciones"));

    await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(77, []));
  });

  it("🔴 cerrar la ficha REFRESCA la bandeja: el badge «Por devolver» lo calcula el servidor", async () => {
    const refetchFn = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ModalExpedienteLote
        caseData={caso}
        onClose={onClose}
        refetchFn={refetchFn}
      />,
    );
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText("Cerrar modal de expediente"));

    expect(refetchFn).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("un fallo del servidor se dice en el aviso flotante (sin caja), y lo escrito NO se pierde de la pantalla", async () => {
    mocks.guardar.mockRejectedValue(errorDelServidor("El expediente ya se despachó."));

    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    observarCampo("Apellido");
    fireEvent.change(screen.getByLabelText("Texto de la observación"), {
      target: { value: "No coincide con la cédula" },
    });
    fireEvent.click(screen.getByText("Guardar observaciones"));

    // La frase del servidor, TAL CUAL: es la que dice que la ventana de edición se cerró.
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "El expediente ya se despachó.",
      ),
    );
    expect(screen.queryByText("El expediente ya se despachó.")).toBeNull();
    expect(screen.getByText("No coincide con la cédula")).toBeInTheDocument();
  });
});

/**
 * LA REVISIÓN DEL DIRECTOR, EN LA MISMA FICHA (2026-09-18, encargo del área: «cuando el director
 * revisa las observaciones, se le debe levantar el mismo modal que cuando se agregan, mostrárselas
 * ahí las que se agregaron y que pueda aceptarlas o negarlas»).
 *
 * 🔴 La revisión vivió unas horas en un diálogo propio de la Bandeja de Salida y se retiró: partía
 * en dos pantallas un acto que es uno solo, y dejaba al director decidiendo sobre una lista de
 * frases sin el expediente delante. Aquí decide con el dato observado a la vista.
 */
describe("ModalExpedienteLote — el director revisa en la ficha", () => {
  /** La anotó el SECRETARIO (9). El director de estas pruebas es el 42. */
  const delSecretario: IObservacion = {
    ...guardada,
    createdBy: 9,
    estado: "PENDIENTE",
  };

  const abrirComoDirector = (over: Partial<EnvioLoteCaso> = {}) =>
    render(
      <ModalExpedienteLote
        caseData={{ ...caso, puedeRevisar: true, usuarioId: 42, ...over }}
        onClose={vi.fn()}
      />,
    );

  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue([delSecretario]);
    mocks.guardar
      .mockReset()
      .mockImplementation(async (_id, lista) => ({
        observaciones: lista,
        remisionRetirada: false,
      }));
    mocks.revisar
      .mockReset()
      .mockResolvedValue({ observaciones: [], revertido: false });
  });

  it("ve lo que anotó el secretario y puede aprobarlo sin salir de la ficha", async () => {
    mocks.revisar.mockResolvedValue({
      observaciones: [{ ...delSecretario, estado: "APROBADA" }],
      revertido: false,
    });
    abrirComoDirector();
    await screen.findByText("No coincide con la cédula");

    fireEvent.click(screen.getByText("Aprobar"));

    await waitFor(() => expect(mocks.revisar).toHaveBeenCalled());
    expect(mocks.revisar).toHaveBeenCalledWith(77, [
      { obseId: 1, estado: "APROBADA", motivoRechazo: undefined },
    ]);
    expect(await screen.findByText("Aprobada")).toBeInTheDocument();
  });

  it("🔴 rechazar exige motivo, y el motivo viaja con el veredicto", async () => {
    abrirComoDirector();
    await screen.findByText("No coincide con la cédula");

    fireEvent.click(screen.getByText("Rechazar"));
    // La caja se abre BAJO la fila, y sin texto no se puede confirmar.
    const confirmar = screen.getByText("Confirmar rechazo").closest("button")!;
    expect(confirmar.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Motivo del rechazo de Apellido"), {
      target: { value: "El apellido consta así en la cédula" },
    });
    fireEvent.click(screen.getByText("Confirmar rechazo"));

    await waitFor(() => expect(mocks.revisar).toHaveBeenCalled());
    expect(mocks.revisar).toHaveBeenCalledWith(77, [
      {
        obseId: 1,
        estado: "RECHAZADA",
        motivoRechazo: "El apellido consta así en la cédula",
      },
    ]);
  });

  // 🔴 Nadie se aprueba a sí mismo: el director también anota —su triage por expediente completo lo
  // exige— y lo suyo nace consentido. Sin el badge, el hueco parecería un fallo de la pantalla.
  it("sobre lo que anotó él mismo no hay botones: sale «Suya»", async () => {
    mocks.listar.mockResolvedValue([
      { ...guardada, createdBy: 42, estado: "APROBADA" },
    ]);
    abrirComoDirector();
    await screen.findByText("No coincide con la cédula");

    expect(screen.queryByText("Aprobar")).toBeNull();
    expect(screen.queryByText("Rechazar")).toBeNull();
    expect(screen.getByText("Suya")).toBeInTheDocument();
  });

  it("el SECRETARIO abre la misma ficha y NO ve veredictos: él anota, no consiente", async () => {
    render(
      <ModalExpedienteLote
        caseData={{ ...caso, puedeRevisar: false, usuarioId: 9 }}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("No coincide con la cédula");

    expect(screen.queryByText("Aprobar")).toBeNull();
    expect(screen.queryByText("Rechazar")).toBeNull();
  });

  // Rechazada la ÚLTIMA viva, la devolución se queda sin motivo y el expediente vuelve al triage. Es
  // un cambio de estado de lo que se está mirando: se dice en la ficha, no con un aviso que se va.
  it("al rechazar la última, la ficha avisa de que el expediente vuelve a la Bandeja de Entrada", async () => {
    mocks.revisar.mockResolvedValue({
      observaciones: [
        { ...delSecretario, estado: "RECHAZADA", motivoRechazo: "No procede" },
      ],
      revertido: true,
    });
    abrirComoDirector();
    await screen.findByText("No coincide con la cédula");

    fireEvent.click(screen.getByText("Rechazar"));
    fireEvent.change(screen.getByLabelText("Motivo del rechazo de Apellido"), {
      target: { value: "No procede" },
    });
    fireEvent.click(screen.getByText("Confirmar rechazo"));

    expect(
      await screen.findByText(/vuelve a la Bandeja de Entrada/),
    ).toBeInTheDocument();
    // Y el motivo queda a la vista del secretario, en la misma fila que él escribió.
    expect(screen.getByText(/Motivo del rechazo: No procede/)).toBeInTheDocument();
  });
});

/**
 * LA FICHA ABSORBE EL DESPLEGABLE DEL DECISOR (2026-09-21, D-10).
 *
 * 🔴 LO QUE SE PROTEGE NO ES QUE «HAYA PESTAÑAS NUEVAS». Es que al aplanar la fila no se pierda
 * nada de lo que el decisor veía y podía hacer, y que no se GANE nada que no le toca:
 *
 *   · Las tres pestañas absorbidas enseñan un dato REAL, no una pestaña vacía que parezca correcta.
 *   · La señal de «Adjuntar documento» llega hasta dentro de la ficha. Si se corta, adjuntar deja de
 *     refrescar y el usuario cree que su documento no se subió (Pitfall 10).
 *   · La regla de las DOS FASES se mudó con el contenido: sin aceptar, resumen mínimo. Vivía en el
 *     desplegable, y un traslado que la dejara atrás enseñaría el expediente entero a quien todavía
 *     puede excusarse de él.
 *   · La revisión de observaciones de triage NO viaja con el resto (T-03.19-41). Se diseñó para la
 *     Bandeja de Entrada, otro rol y otro momento del procedimiento.
 */
describe("ModalExpedienteLote — la ficha absorbente del decisor (D-10)", () => {
  /** Una fila de «Mis Expedientes» montada en la ficha, con su bandeja de origen declarada. */
  const abrirComoDecisor = (over: Partial<MiEpasAsignado> = {}) =>
    render(
      <ModalExpedienteLote
        caseData={{
          ...crearMiEpasAsignado({
            eejeStatus: "ASIGNADO_DECISOR",
            tieneImpugnacion: true,
            ...over,
          }),
          bandeja: "decisor",
          rolName: "funcionario decisor",
        }}
        onClose={vi.fn()}
      />,
    );

  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue([]);
    mocks.guardar
      .mockReset()
      .mockImplementation(async (_id, lista) => ({
        observaciones: lista,
        remisionRetirada: false,
      }));
    mocks.revisar.mockReset();
    mocks.listarDocumentos.mockReset().mockResolvedValue([]);
    mocks.documentosExternos.mockReset().mockResolvedValue({
      eejeId: 1,
      caseId: 123,
      modulos: [
        {
          modulo: "resolucion",
          nombre: "Dirección Metropolitana de Resolución",
          estado: "ok",
          simulado: true,
          mensaje: null,
          documentos: [
            {
              docId: "sim-resolucion-123-1",
              nombre: "Resolución sancionatoria (Resolución)",
              tipo: "Resolución",
              subtipo: null,
              fecha: null,
              estado: "emitido",
              firmado: false,
              firmantes: [],
              administrados: [],
              archivoUrl:
                "/api/epas/1/documentos-externos/resolucion/sim-resolucion-123-1/archivo",
            },
          ],
        },
      ],
    });
    mocks.leerEstadoImpugnacion.mockReset().mockResolvedValue({
      eejeStatus: "ASIGNADO_DECISOR",
      entrada: {
        permitida: true,
        motivo: null,
        estadoAlReanudar: "EN_VERIFICACION_PAGO",
      },
      suspension: null,
      resolucionAdjunta: false,
      historial: [],
    });
    mocks.listarNotificaciones.mockReset().mockResolvedValue([
      {
        notiId: 501,
        eejeId: 4101,
        docId: 77,
        docName: "Providencia de citación a audiencia",
        emitidaAt: "2026-09-05T10:00:00.000Z",
        despachos: [],
      },
    ]);
    mocks.serieMultas.mockReset().mockResolvedValue([
      {
        mcomId: 11,
        eejeId: 4101,
        ordinal: 1,
        resolucionNumero: "GADDMQ-AMC-DME-2026-0099-M",
        resolucionFecha: "2026-09-10",
        valor: 150,
        docId: 88,
        registradaAt: "2026-09-10T12:00:00.000Z",
        registradaBy: 6389,
      },
    ]);
  });

  it("🔴 si el servidor niega la descarga del expediente, el DECISOR ve el motivo en el aviso flotante (sin caja)", async () => {
    const motivo =
      "El EPAS 4101 no tiene acta de sorteo definitiva: su sorteo aún no se ha cerrado con firma.";
    mocks.descargarExpediente.mockReset().mockRejectedValue(errorDelServidor(motivo));
    abrirComoDecisor();

    fireEvent.click(
      screen.getByRole("button", { name: /Descargar expediente/ }),
    );

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("error", motivo),
    );
    expect(screen.queryByText(motivo)).toBeNull();
  });

  it("🔴 sobre una fila ACEPTADA ofrece las DOS pestañas absorbidas (notificaciones e impugnación), y ya NO la de multas compulsorias", async () => {
    abrirComoDecisor();

    // Las dos existen como pestaña, junto a las dos que la ficha ya tenía.
    expect(
      screen.getByRole("button", { name: "Notificaciones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recursos" }),
    ).toBeInTheDocument();
    // Quick 261014-kn3: la serie compulsoria vive solo en la página de la obligación de hacer.
    expect(
      screen.queryByRole("button", { name: "Multas compulsorias" }),
    ).toBeNull();

    // Y cada una PINTA lo suyo: una pestaña que existe y sale vacía es una regresión silenciosa.
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    expect(
      await screen.findByText("Providencia de citación a audiencia"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recursos" }));
    expect(await screen.findByText("Con impugnación")).toBeInTheDocument();
    // quick 261028-mtg: la pestaña pide al servidor si se puede registrar y a dónde vuelve.
    await waitFor(() =>
      expect(mocks.leerEstadoImpugnacion).toHaveBeenCalled(),
    );

    // Y la ficha ya no PIDE la serie: no basta con no pintarla.
    expect(mocks.serieMultas).not.toHaveBeenCalled();
  });

  it("🔴 subir la señal de recarga vuelve a PEDIR los documentos: es el hilo de «Adjuntar documento»", async () => {
    const caso = {
      ...crearMiEpasAsignado({ eejeStatus: "ASIGNADO_DECISOR" }),
      bandeja: "decisor" as const,
      rolName: "funcionario decisor",
      recargaSenal: 0,
    };
    const { rerender } = render(
      <ModalExpedienteLote caseData={caso} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Documentación" }));
    await waitFor(() => expect(mocks.listarDocumentos).toHaveBeenCalledTimes(1));

    // Lo que hace el `onSuccess` del modal de anexos: subir el contador de la página.
    rerender(
      <ModalExpedienteLote
        caseData={{ ...caso, recargaSenal: 1 }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.listarDocumentos).toHaveBeenCalledTimes(2));
  });

  it("quick 261030-dun: bajo los documentos propios salen los de otros módulos y se abren en el visor de la derecha, sin modal", async () => {
    abrirComoDecisor();

    fireEvent.click(screen.getByRole("button", { name: "Documentación" }));
    expect(
      await screen.findByText("Documentos de otros módulos"),
    ).toBeInTheDocument();
    const externo = await screen.findByRole("button", {
      name: "Resolución sancionatoria (Resolución)",
    });
    expect(mocks.documentosExternos).toHaveBeenCalledTimes(1);

    fireEvent.click(externo);

    expect(await screen.findByTestId("visor-pdf")).toHaveTextContent(
      "/api/epas/1/documentos-externos/resolucion/sim-resolucion-123-1/archivo",
    );
    expect(mocks.openModal).not.toHaveBeenCalled();
    // Y queda resaltado como el abierto.
    expect(
      screen.getByRole("button", {
        name: "Resolución sancionatoria (Resolución)",
      }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("🔴 sobre una fila NO ACEPTADA enseña el resumen mínimo, NO el expediente entero", async () => {
    render(
      <ModalExpedienteLote
        caseData={{
          ...crearMiEpasAsignadoPendiente(),
          bandeja: "decisor",
          rolName: "funcionario decisor",
        }}
        onClose={vi.fn()}
      />,
    );

    // Lo que el desplegable enseñaba en su fase 1, palabra por palabra.
    expect(await screen.findByText("Pendiente de aceptación")).toBeInTheDocument();
    expect(screen.getByText("Comercial Ficticia del Valle S.A.")).toBeInTheDocument();
    expect(screen.getByText("0000000000")).toBeInTheDocument();

    // Y NADA del expediente completo: ni las pestañas absorbidas ni las que la ficha ya tenía.
    expect(screen.queryByRole("button", { name: "Documentación" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Notificaciones" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Multas compulsorias" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Recursos" })).toBeNull();
    expect(screen.queryByText("Resolución de Origen")).toBeNull();
    // Ni siquiera se PIDE lo del expediente completo: no basta con no pintarlo.
    expect(mocks.listarNotificaciones).not.toHaveBeenCalled();
    expect(mocks.serieMultas).not.toHaveBeenCalled();
  });

  it("🔴 en modo lectura no hay veredicto del director — ni aunque quien abre diga que puede revisar", async () => {
    mocks.listar.mockResolvedValue([
      {
        obseId: 1,
        tipo: "CAMPO",
        clave: "admiLastname",
        etiqueta: "Apellido",
        texto: "No coincide con la cédula",
        createdBy: 9,
        estado: "PENDIENTE",
      } satisfies IObservacion,
    ]);

    render(
      <ModalExpedienteLote
        caseData={{
          ...crearMiEpasAsignado({ eejeStatus: "ASIGNADO_DECISOR" }),
          bandeja: "decisor",
          rolName: "funcionario decisor",
          // 🔴 La ficha lo APAGA ella misma: la mitigación no puede depender de que cada punto de
          // montaje se acuerde de pasar `false` (T-03.19-41).
          puedeRevisar: true,
          usuarioId: 42,
        }}
        onClose={vi.fn()}
      />,
    );

    await screen.findByRole("button", { name: "Notificaciones" });

    expect(screen.queryByText("Aprobar")).toBeNull();
    expect(screen.queryByText("Rechazar")).toBeNull();
    // El panel entero se queda en la Bandeja de Entrada: aquí no se anota triage sobre un
    // expediente que ya salió de triage.
    expect(screen.queryByText("Guardar observaciones")).toBeNull();
    expect(screen.queryByText("No coincide con la cédula")).toBeNull();
    expect(mocks.listar).not.toHaveBeenCalled();
  });
});

/**
 * Fase 03.23 (D-16/D-08): la pestaña «Infracciones».
 *
 * 🔴 La promesa de la primera pestaña es que la ficha NO PIDE NADA al abrirse. La ficha de
 * infracciones, además, refresca CORE cada vez que se pide (D-08): pedirla al abrir sería consultar
 * CORE por cada ojo pulsado en una bandeja, se mire o no la pestaña. Se pide al pulsarla.
 */
describe("ModalExpedienteLote — la pestaña «Infracciones» (Fase 03.23, D-16/D-08)", () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue([]);
    mocks.listarDocumentos.mockReset().mockResolvedValue([]);
    mocks.listarNotificaciones.mockReset().mockResolvedValue([]);
    mocks.fichaInfracciones.mockReset().mockResolvedValue({
      eejeId: 77,
      estadoCore: "LEIDO",
      coreLeidoAt: "2026-10-15T15:30:00.000Z",
      coreDisponible: true,
      materia: "LICENCIAMIENTO",
      submaterias: ["LUAE"],
      tipoPersona: "NATURAL",
      avisoIdentificacion: null,
      multaTotal: 920,
      sumaMultas: 920,
      infracciones: [
        {
          codigo: "LIC-LU-X-124-1947A-02",
          materia: "LICENCIAMIENTO",
          submateria: "LUAE",
          sancion: null,
          multa: 920,
          enResolucion: true,
          enCore: true,
          admiteTc: true,
          motivoNoAdmite: null,
          obligacionHacer: null,
        },
      ],
      evaluacionTc: { estado: "APTA", motivos: [], multaConmutable: 920 },
      alertas: [],
      avisoCoreCambio: null,
    });
  });

  it("🔴 desde la Bandeja de Entrada: la pestaña existe, abrir la ficha NO la pide y pulsarla SÍ, una vez", async () => {
    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    const pestana = screen.getByRole("button", { name: "Infracciones" });
    expect(mocks.fichaInfracciones).not.toHaveBeenCalled();

    fireEvent.click(pestana);
    expect(
      await screen.findByText("LIC-LU-X-124-1947A-02"),
    ).toBeInTheDocument();
    expect(mocks.fichaInfracciones).toHaveBeenCalledTimes(1);
    expect(mocks.fichaInfracciones).toHaveBeenCalledWith(77);
  });

  it("🔴 desde «Mis expedientes»: la misma pestaña, con la misma regla (no es de las absorbidas)", async () => {
    render(
      <ModalExpedienteLote
        caseData={{
          ...crearMiEpasAsignado({ eejeStatus: "ASIGNADO_DECISOR" }),
          bandeja: "decisor",
          rolName: "funcionario decisor",
        }}
        onClose={vi.fn()}
      />,
    );

    const pestana = await screen.findByRole("button", { name: "Infracciones" });
    expect(mocks.fichaInfracciones).not.toHaveBeenCalled();

    fireEvent.click(pestana);
    await waitFor(() =>
      expect(mocks.fichaInfracciones).toHaveBeenCalledWith(4101),
    );
    expect(mocks.fichaInfracciones).toHaveBeenCalledTimes(1);
  });
});

/**
 * EL AVISO DE DATOS DE RESOLUCIÓN INCOMPLETOS (Fase 03.24, D-05). La ficha lo enseña al principio de
 * la pestaña de información —la de apertura—, sin tener que abrir la de infracciones. Solo traduce
 * `datosResolucionFaltantes`; el detalle del componente se prueba en `AvisoDatosResolucion.test.tsx`.
 */
describe("ModalExpedienteLote — el aviso de datos de Resolución incompletos (Fase 03.24, D-05)", () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue([]);
    mocks.listarDocumentos.mockReset().mockResolvedValue([]);
    mocks.listarNotificaciones.mockReset().mockResolvedValue([]);
    // Sin reiniciar, arrastraría la llamada del describe anterior.
    mocks.fichaInfracciones.mockReset();
  });

  it("desde la Bandeja de Entrada, con faltantes: la pestaña de información abre con la alerta y su lista", async () => {
    render(
      <ModalExpedienteLote
        caseData={{
          ...caso,
          datosResolucionFaltantes: ["MULTA", "RESOLUCION_NUMERO"],
        }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    const alerta = screen
      .getAllByRole("alert")
      .find((a) =>
        (a.textContent ?? "").includes("Datos de Resolución incompletos"),
      );
    expect(alerta).toBeDefined();
    expect(alerta!.textContent).toContain("multa");
    expect(alerta!.textContent).toContain("número de resolución");
    // Sin abrir la pestaña de infracciones: no se pidió su ficha.
    expect(mocks.fichaInfracciones).not.toHaveBeenCalled();
  });

  it("desde «Mis expedientes», con faltantes: la misma alerta", async () => {
    render(
      <ModalExpedienteLote
        caseData={{
          ...crearMiEpasAsignado({ eejeStatus: "ASIGNADO_DECISOR" }),
          datosResolucionFaltantes: ["CORE_ID"],
          bandeja: "decisor",
          rolName: "funcionario decisor",
        }}
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/Datos de Resolución incompletos/),
    ).toBeInTheDocument();
    expect(screen.getByText(/caso enlazado/)).toBeInTheDocument();
  });

  it("sin faltantes (`null` o vacío) la alerta no aparece", async () => {
    const { unmount } = render(
      <ModalExpedienteLote
        caseData={{ ...caso, datosResolucionFaltantes: null }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());
    expect(
      screen.queryByText(/Datos de Resolución incompletos/),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <ModalExpedienteLote
        caseData={{ ...caso, datosResolucionFaltantes: [] }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByText(/Datos de Resolución incompletos/),
    ).not.toBeInTheDocument();
  });
});

/**
 * CERRAR LA FICHA AL PULSAR FUERA (quick 261019-mcf). La ficha va dentro del `<dialog>` de
 * `ModalContainer`, que aquí se reproduce con el mismo `DialogoModal` (el contenedor real necesita el
 * `useModal` que este archivo dobla). Lo que se fija es lo que la ficha le DECLARA: las observaciones
 * sin guardar piden confirmación, guardar bloquea el cierre, y cerrar refresca la bandeja.
 */
describe("ModalExpedienteLote — cerrar al pulsar fuera (quick 261019-mcf)", () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue([]);
    mocks.guardar
      .mockReset()
      .mockImplementation(async (_id, lista) => ({
        observaciones: lista,
        remisionRetirada: false,
      }));
  });

  const montarEnDialogo = () => {
    const onClose = vi.fn();
    const refetchFn = vi.fn().mockResolvedValue(undefined);
    render(
      <DialogoModal open className="modal" data-testid="fondo" onCerrar={onClose}>
        <ModalExpedienteLote caseData={caso} onClose={onClose} refetchFn={refetchFn} />
      </DialogoModal>,
    );
    return { onClose, refetchFn, fondo: screen.getByTestId("fondo") };
  };

  const pulsarFondo = (fondo: Element) => {
    fireEvent.pointerDown(fondo);
    fireEvent.click(fondo);
  };

  const anotarSinGuardar = async () => {
    observarCampo("Apellido");
    fireEvent.change(screen.getByLabelText("Texto de la observación"), {
      target: { value: "No coincide con la cédula" },
    });
    await screen.findByText(/observaciones sin guardar/i);
  };

  it("sin nada pendiente, el fondo cierra por el camino del aspa: refresca la bandeja y cierra", async () => {
    const { onClose, refetchFn, fondo } = montarEnDialogo();
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    pulsarFondo(fondo);

    expect(refetchFn).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("🔴 con observaciones SIN GUARDAR pregunta; «Seguir editando» no cierra ni pierde lo anotado", async () => {
    const { onClose, fondo } = montarEnDialogo();
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());
    await anotarSinGuardar();

    pulsarFondo(fondo);
    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Seguir editando"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("No coincide con la cédula")).toBeInTheDocument();

    pulsarFondo(fondo);
    fireEvent.click(screen.getByText("Descartar"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape con el foco fuera de la ficha aplica la misma regla: con algo sin guardar, pregunta", async () => {
    const { onClose } = montarEnDialogo();
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());
    await anotarSinGuardar();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("mientras se guardan las observaciones, el fondo no hace nada", async () => {
    mocks.guardar.mockReturnValue(new Promise(() => {}));
    const { onClose, fondo } = montarEnDialogo();
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());
    await anotarSinGuardar();

    fireEvent.click(screen.getByText("Guardar observaciones"));
    await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());

    pulsarFondo(fondo);

    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * EL REINGRESO EN LA FICHA (Fase 03.24, cierre de huecos G-01, UI-SPEC §1.3-§1.5). La ficha separa
 * las observaciones de la devolución anterior —solo lectura, se verifican— de las nuevas, deja al
 * director marcar cada anterior como cumplida o no cumplida, y dice qué va a pasar con el expediente
 * según lo que el SERVIDOR devuelve, no según lo último que se pulsó.
 */
describe("ModalExpedienteLote — el reingreso: separar, verificar y avisar (G-01)", () => {
  /** Anterior sobre «Apellido», por verificar. La anotó el director 42 en la devolución. */
  const anterior: IObservacion = {
    obseId: 11,
    tipo: "CAMPO",
    clave: "admiLastname",
    etiqueta: "Apellido",
    texto: "Falta el segundo apellido",
    createdBy: 42,
    deDevolucionAnterior: true,
    verificacion: "POR_VERIFICAR",
  };
  /** Nueva sobre «Nombre», del secretario. */
  const nueva: IObservacion = {
    obseId: 12,
    tipo: "CAMPO",
    clave: "admiName",
    etiqueta: "Nombre",
    texto: "Falta el segundo nombre",
    createdBy: 9,
    estado: "PENDIENTE",
  };

  const abrir = (puedeRevisar: boolean) =>
    render(
      <ModalExpedienteLote
        caseData={{ ...caso, puedeRevisar, usuarioId: puedeRevisar ? 42 : 9 }}
        onClose={vi.fn()}
      />,
    );

  const grupoAnterior = () =>
    document.querySelector(
      'section[aria-labelledby="obs-anteriores-titulo"]',
    ) as HTMLElement;

  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue([anterior]);
    mocks.guardar
      .mockReset()
      .mockImplementation(async (_id, lista) => ({
        observaciones: lista,
        remisionRetirada: false,
      }));
    mocks.revisar
      .mockReset()
      .mockResolvedValue({ observaciones: [], revertido: false });
    mocks.verificar.mockReset();
  });

  it("al cargar, las anteriores van a su grupo, las nuevas a su lista, y el campo anterior sale observado", async () => {
    mocks.listar.mockResolvedValue([anterior, nueva]);
    abrir(false);

    expect(await screen.findByText("Falta el segundo apellido")).toBeInTheDocument();
    expect(
      within(grupoAnterior()).getByText("Falta el segundo apellido"),
    ).toBeInTheDocument();
    expect(
      within(grupoAnterior()).queryByText("Falta el segundo nombre"),
    ).toBeNull();
    expect(
      screen.getByText("Observaciones nuevas guardadas: 1"),
    ).toBeInTheDocument();
    // `sinGuardar` solo compara las nuevas: recién cargado, no hay nada sin guardar.
    expect(screen.queryByText(/observaciones sin guardar/i)).toBeNull();
    // El campo con observación anterior se marca como observado en la ficha.
    expect(
      screen.getByTitle("«Apellido» ya tiene una observación"),
    ).toBeInTheDocument();
  });

  it("🔴 el aviso 5 sale al director al abrir, y NO lleva role=\"alert\": no es un evento", async () => {
    abrir(true);

    const aviso = await screen.findByText(AVISO_REINGRESO_POR_VERIFICAR);
    const contenedor = aviso.closest(".alert") as HTMLElement;
    expect(contenedor).toHaveAttribute("role", "note");
    expect(contenedor).toHaveClass("alert-info");
    expect(
      screen
        .queryAllByRole("alert")
        .some((a) => a.textContent?.includes(AVISO_REINGRESO_POR_VERIFICAR)),
    ).toBe(false);
  });

  it("el secretario abre la misma ficha y el aviso 5 no sale", async () => {
    abrir(false);

    await screen.findByText("Falta el segundo apellido");
    expect(screen.queryByText(AVISO_REINGRESO_POR_VERIFICAR)).toBeNull();
    expect(
      within(grupoAnterior()).queryAllByRole("button"),
    ).toHaveLength(0);
  });

  it("pulsar «No cumplida» verifica en el servidor, repinta la lista y pasa al aviso 4", async () => {
    mocks.verificar.mockResolvedValue([
      { ...anterior, verificacion: "NO_CUMPLIDA" },
    ]);
    abrir(true);
    await screen.findByText(AVISO_REINGRESO_POR_VERIFICAR);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Marcar como no cumplida la observación de Apellido",
      }),
    );

    await waitFor(() =>
      expect(mocks.verificar).toHaveBeenCalledWith(77, 11, "NO_CUMPLIDA"),
    );
    const aviso = await screen.findByText(AVISO_NO_CUMPLIDAS);
    const contenedor = aviso.closest(".alert") as HTMLElement;
    expect(contenedor).toHaveClass("alert-warning");
    expect(contenedor).toHaveAttribute("role", "status");
    expect(screen.queryByText(AVISO_REINGRESO_POR_VERIFICAR)).toBeNull();
    expect(
      within(grupoAnterior()).getByText("No cumplida", { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Marcar como no cumplida la observación de Apellido",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("mientras se verifica, el grupo queda apagado con aria-busy y el fondo no cierra la ficha", async () => {
    mocks.verificar.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    render(
      <DialogoModal open className="modal" data-testid="fondo" onCerrar={onClose}>
        <ModalExpedienteLote
          caseData={{ ...caso, puedeRevisar: true, usuarioId: 42 }}
          onClose={onClose}
        />
      </DialogoModal>,
    );
    await screen.findByText(AVISO_REINGRESO_POR_VERIFICAR);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Marcar como cumplida la observación de Apellido",
      }),
    );
    await waitFor(() => expect(mocks.verificar).toHaveBeenCalled());

    within(grupoAnterior())
      .getAllByRole("button")
      .forEach((b) => expect(b).toBeDisabled());
    expect(grupoAnterior().querySelector("ul")).toHaveAttribute(
      "aria-busy",
      "true",
    );

    const fondo = screen.getByTestId("fondo");
    fireEvent.pointerDown(fondo);
    fireEvent.click(fondo);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("con todas cumplidas sale el aviso 6 (success, status), y gana al «Se han guardado N»", async () => {
    mocks.listar.mockResolvedValue([
      { ...anterior, verificacion: "CUMPLIDA" },
      nueva,
    ]);
    abrir(true);

    const aviso = await screen.findByText(AVISO_TODAS_CUMPLIDAS);
    const contenedor = aviso.closest(".alert") as HTMLElement;
    expect(contenedor).toHaveClass("alert-success");
    expect(contenedor).toHaveAttribute("role", "status");
    expect(screen.queryByText(/Se han guardado/)).toBeNull();
  });

  it("orden de la cadena: el aviso 4 gana al 5, y «sin guardar» gana al 4", async () => {
    mocks.listar.mockResolvedValue([
      { ...anterior, verificacion: "NO_CUMPLIDA" },
      {
        ...anterior,
        obseId: 13,
        clave: "admiName",
        etiqueta: "Nombre",
        verificacion: "POR_VERIFICAR",
      },
    ]);
    abrir(true);

    expect(await screen.findByText(AVISO_NO_CUMPLIDAS)).toBeInTheDocument();
    expect(screen.queryByText(AVISO_REINGRESO_POR_VERIFICAR)).toBeNull();

    // Se escribe una nueva sobre un campo SIN observación anterior: queda algo sin guardar.
    observarCampo("Teléfono");
    fireEvent.change(screen.getByLabelText("Texto de la observación"), {
      target: { value: "No coincide" },
    });

    expect(
      await screen.findByText(/observaciones sin guardar/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(AVISO_NO_CUMPLIDAS)).toBeNull();
  });

  it("si la verificación falla, sale el mensaje del servidor y la lista no cambia", async () => {
    mocks.verificar.mockRejectedValue(
      errorDelServidor(
        "Este expediente ya salió de la Bandeja de Entrada: la verificación no se puede cambiar.",
      ),
    );
    abrir(true);
    await screen.findByText(AVISO_REINGRESO_POR_VERIFICAR);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Marcar como no cumplida la observación de Apellido",
      }),
    );

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "Este expediente ya salió de la Bandeja de Entrada: la verificación no se puede cambiar.",
      ),
    );
    // Sin cambios optimistas: sigue por verificar y el botón no quedó pulsado.
    expect(
      within(grupoAnterior()).getByText("Por verificar"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Marcar como no cumplida la observación de Apellido",
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("si la verificación falla sin mensaje, sale el texto de respaldo de §6.1", async () => {
    mocks.verificar.mockRejectedValue(new Error(""));
    abrir(true);
    await screen.findByText(AVISO_REINGRESO_POR_VERIFICAR);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Marcar como cumplida la observación de Apellido",
      }),
    );

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("error", ERROR_VERIFICACION),
    );
  });

  it("guardar manda SOLO las nuevas (con el borrador) y vuelve a separar la respuesta", async () => {
    // El servidor devuelve la lista entera, anteriores incluidas.
    mocks.guardar.mockImplementation(async (_id, lista: IObservacion[]) => ({
      observaciones: [
        anterior,
        ...lista.map((o, i) => ({ ...o, obseId: 50 + i })),
      ],
      remisionRetirada: false,
    }));
    abrir(false);
    await screen.findByText("Falta el segundo apellido");

    observarCampo("Nombre");
    fireEvent.change(screen.getByLabelText("Texto de la observación"), {
      target: { value: "Falta el segundo nombre" },
    });
    fireEvent.click(screen.getByText("Guardar observaciones"));

    await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());
    expect(mocks.guardar).toHaveBeenCalledWith(77, [
      {
        tipo: "CAMPO",
        clave: "admiName",
        etiqueta: "Nombre",
        texto: "Falta el segundo nombre",
      },
    ]);
    expect(
      await screen.findByText("Observaciones nuevas guardadas: 1"),
    ).toBeInTheDocument();
    expect(
      within(grupoAnterior()).getByText("Falta el segundo apellido"),
    ).toBeInTheDocument();
    expect(
      within(grupoAnterior()).queryByText("Falta el segundo nombre"),
    ).toBeNull();
  });
});

/**
 * quick 261029-kl0 (EPAS 264 / lote 15, 127): una observación viva sobre un expediente remitido y sin
 * sortear le retira la remisión y lo devuelve al director. El secretario lo sabe por UN aviso y la
 * ficha se cierra; el director se queda en ella y, rechazadas todas, sabe que puede remitirlo de
 * nuevo desde su fila.
 */
describe("ModalExpedienteLote — la observación devuelve el expediente al director (quick 261029-kl0)", () => {
  const escribirYGuardar = async () => {
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());
    observarCampo("Apellido");
    fireEvent.change(screen.getByLabelText("Texto de la observación"), {
      target: { value: "No coincide con la cédula" },
    });
    fireEvent.click(screen.getByText("Guardar observaciones"));
    await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());
  };

  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue([]);
    mocks.addToast.mockReset();
    mocks.revisar.mockReset();
  });

  it("secretario, remisión retirada → UN solo aviso que dice que vuelve al director, y la ficha se cierra", async () => {
    mocks.guardar
      .mockReset()
      .mockImplementation(async (_id, lista: IObservacion[]) => ({
        observaciones: lista.map((o) => ({ ...o, obseId: 5 })),
        remisionRetirada: true,
      }));
    const onClose = vi.fn();
    const refetchFn = vi.fn().mockResolvedValue(undefined);
    render(
      <ModalExpedienteLote
        caseData={{ ...caso, puedeRevisar: false, usuarioId: 9 }}
        onClose={onClose}
        refetchFn={refetchFn}
      />,
    );

    await escribirYGuardar();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(refetchFn).toHaveBeenCalledTimes(1);
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(mocks.addToast).toHaveBeenCalledWith(
      "success",
      avisoRemisionRetiradaSecretario(1),
    );
    expect(avisoRemisionRetiradaSecretario(1)).toMatch(/vuelve al director/);
  });

  it("secretario, sin remisión retirada → el aviso de siempre y la ficha sigue abierta", async () => {
    mocks.guardar
      .mockReset()
      .mockImplementation(async (_id, lista: IObservacion[]) => ({
        observaciones: lista.map((o) => ({ ...o, obseId: 5 })),
        remisionRetirada: false,
      }));
    const onClose = vi.fn();
    render(
      <ModalExpedienteLote
        caseData={{ ...caso, puedeRevisar: false, usuarioId: 9 }}
        onClose={onClose}
      />,
    );

    await escribirYGuardar();

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Se han guardado 1 observación correctamente",
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("director, remisión retirada → el aviso dice que queda «Por devolver» y la ficha NO se cierra", async () => {
    mocks.guardar
      .mockReset()
      .mockImplementation(async (_id, lista: IObservacion[]) => ({
        observaciones: lista.map((o) => ({
          ...o,
          obseId: 5,
          createdBy: 42,
          estado: "APROBADA" as const,
        })),
        remisionRetirada: true,
      }));
    const onClose = vi.fn();
    render(
      <ModalExpedienteLote
        caseData={{ ...caso, puedeRevisar: true, usuarioId: 42 }}
        onClose={onClose}
      />,
    );

    await escribirYGuardar();

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        avisoRemisionRetiradaDirector(1),
      ),
    );
    expect(avisoRemisionRetiradaDirector(1)).toMatch(/«Por devolver»/);
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("director rechaza la última viva de un RECIBIDO sin remitir → aviso info: puede remitirse de nuevo", async () => {
    const delSecretario: IObservacion = {
      ...guardada,
      createdBy: 9,
      estado: "PENDIENTE",
    };
    mocks.listar.mockResolvedValue([delSecretario]);
    mocks.revisar.mockResolvedValue({
      observaciones: [
        { ...delSecretario, estado: "RECHAZADA", motivoRechazo: "No procede" },
      ],
      revertido: false,
    });
    render(
      <ModalExpedienteLote
        caseData={{
          ...caso,
          puedeRevisar: true,
          usuarioId: 42,
          remitidoAlSecretario: false,
        }}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("No coincide con la cédula");

    fireEvent.click(screen.getByText("Rechazar"));
    fireEvent.change(screen.getByLabelText("Motivo del rechazo de Apellido"), {
      target: { value: "No procede" },
    });
    fireEvent.click(screen.getByText("Confirmar rechazo"));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("info", AVISO_PUEDE_REMITIRSE),
    );
  });

  it("si aún queda una viva, no se dice que pueda remitirse", async () => {
    const una: IObservacion = { ...guardada, createdBy: 9, estado: "PENDIENTE" };
    const otra: IObservacion = {
      ...guardada,
      obseId: 2,
      clave: "admiName",
      etiqueta: "Nombre",
      texto: "Falta el segundo nombre",
      createdBy: 9,
      estado: "PENDIENTE",
    };
    mocks.listar.mockResolvedValue([una, otra]);
    mocks.revisar.mockResolvedValue({
      observaciones: [
        { ...una, estado: "RECHAZADA", motivoRechazo: "No procede" },
        otra,
      ],
      revertido: false,
    });
    render(
      <ModalExpedienteLote
        caseData={{
          ...caso,
          puedeRevisar: true,
          usuarioId: 42,
          remitidoAlSecretario: false,
        }}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("No coincide con la cédula");

    fireEvent.click(screen.getAllByText("Rechazar")[0]);
    fireEvent.change(screen.getByLabelText("Motivo del rechazo de Apellido"), {
      target: { value: "No procede" },
    });
    fireEvent.click(screen.getByText("Confirmar rechazo"));

    await waitFor(() => expect(mocks.revisar).toHaveBeenCalled());
    expect(mocks.addToast).not.toHaveBeenCalledWith("info", AVISO_PUEDE_REMITIRSE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("ModalExpedienteLote — el contador de documentos sin leer (quick 261030-m29)", () => {
  const abrirComoDecisor = () =>
    render(
      <ModalExpedienteLote
        caseData={{
          ...crearMiEpasAsignado({ eejeStatus: "ASIGNADO_DECISOR" }),
          bandeja: "decisor",
          rolName: "funcionario decisor",
        }}
        onClose={vi.fn()}
      />,
    );

  /** El botón de la pestaña, con o sin número. */
  const pestanaDocs = () =>
    screen.getByRole("button", { name: /^Documentación/ });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listarDocumentos.mockResolvedValue([
      { docId: 12, docName: "Providencia nueva", docUrl: "/api/12.pdf" },
      { docId: 13, docName: "Providencia también nueva", docUrl: "/api/13.pdf" },
    ]);
    mocks.documentosExternos.mockResolvedValue({ eejeId: 4101, caseId: null, modulos: [] });
    mocks.noLeidosDelEpas.mockResolvedValue({
      eejeId: 4101,
      propios: [12, 13],
      externos: [],
      total: 2,
    });
    mocks.contarNoLeidos.mockResolvedValue({ 4101: 2, 77: 2 });
    mocks.listar.mockResolvedValue([]);
  });

  it("la pestaña «Documentación» enseña cuántos documentos no ha abierto el usuario", async () => {
    abrirComoDecisor();

    await waitFor(() =>
      expect(within(pestanaDocs()).getByText("2")).toHaveClass("badge"),
    );
    expect(mocks.contarNoLeidos).toHaveBeenCalledWith([4101]);
    expect(pestanaDocs()).toHaveAccessibleName("Documentación, 2 sin leer");
  });

  it("abrir un documento nuevo baja el número en 1 (y al llegar a 0 desaparece)", async () => {
    abrirComoDecisor();
    await waitFor(() => within(pestanaDocs()).getByText("2"));

    fireEvent.click(pestanaDocs());
    fireEvent.click(await screen.findByRole("button", { name: "Providencia nueva" }));
    await waitFor(() => expect(within(pestanaDocs()).getByText("1")).toBeInTheDocument());
    expect(mocks.marcarPropio).toHaveBeenCalledWith(4101, 12);

    fireEvent.click(screen.getByRole("button", { name: "Providencia también nueva" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Documentación" })).toBeInTheDocument(),
    );
  });

  it("con 0 no pinta número", async () => {
    mocks.contarNoLeidos.mockResolvedValue({ 4101: 0 });
    abrirComoDecisor();
    await waitFor(() => expect(mocks.contarNoLeidos).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole("button", { name: "Documentación" })).toBeInTheDocument();
  });

  it("🔴 si el conteo falla, la pestaña sale sin número y la ficha funciona igual", async () => {
    mocks.contarNoLeidos.mockRejectedValue(new Error("500"));
    abrirComoDecisor();
    await waitFor(() => expect(mocks.contarNoLeidos).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole("button", { name: "Documentación" })).toBeInTheDocument();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it("sobre una fila NO ACEPTADA (resumen mínimo) no se pide el conteo", async () => {
    render(
      <ModalExpedienteLote
        caseData={{
          ...crearMiEpasAsignadoPendiente(),
          bandeja: "decisor",
          rolName: "funcionario decisor",
        }}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText("Pendiente de aceptación")).toBeInTheDocument();
    expect(mocks.contarNoLeidos).not.toHaveBeenCalled();
  });

  it("IN-04: al cambiar de expediente con la ficha montada, el número del anterior desaparece en el acto", async () => {
    const datos = (eejeId: number) => ({
      ...crearMiEpasAsignado({ eejeId, eejeStatus: "ASIGNADO_DECISOR" }),
      bandeja: "decisor" as const,
      rolName: "funcionario decisor",
    });
    // El conteo del segundo expediente no llega mientras se mira.
    mocks.contarNoLeidos
      .mockResolvedValueOnce({ 4101: 2 })
      .mockReturnValueOnce(new Promise(() => {}));
    const { rerender } = render(
      <ModalExpedienteLote
        caseData={datos(4101)}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => within(pestanaDocs()).getByText("2"));

    rerender(
      <ModalExpedienteLote
        caseData={datos(4102)}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.contarNoLeidos).toHaveBeenCalledWith([4102]));
    expect(screen.getByRole("button", { name: "Documentación" })).toBeInTheDocument();
  });

  it("desde la Bandeja de Entrada también cuenta", async () => {
    render(<ModalExpedienteLote caseData={caso} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(within(pestanaDocs()).getByText("2")).toBeInTheDocument(),
    );
    expect(mocks.contarNoLeidos).toHaveBeenCalledWith([77]);
  });
});

/**
 * quick 261105-cvq: la «Multa Impuesta» de la ficha sale con el formateador único del frontend
 * («USD 2.300,00»), el mismo algoritmo que el PDF. Un 0 DECLARADO se pinta; una multa ausente, no.
 */
describe("ModalExpedienteLote — la multa impuesta en formato ecuatoriano (quick 261105-cvq)", () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue([]);
    mocks.addToast.mockReset();
  });

  it("una multa de 2300 se lee «USD 2.300,00», sin el signo de dólar", async () => {
    render(
      <ModalExpedienteLote
        caseData={{ ...caso, multaImpuesta: 2300 }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    expect(screen.getByText("USD 2.300,00")).toBeInTheDocument();
    expect(screen.queryByText(/\$ ?2/)).not.toBeInTheDocument();
  });

  it("🔴 una multa DECLARADA de 0 se pinta «USD 0,00»: no es lo mismo que no saberla", async () => {
    render(
      <ModalExpedienteLote
        caseData={{ ...caso, multaImpuesta: 0 }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(mocks.listar).toHaveBeenCalled());

    expect(screen.getByText("USD 0,00")).toBeInTheDocument();
  });
});
