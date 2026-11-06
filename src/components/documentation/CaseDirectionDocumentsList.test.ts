/**
 * Microservicio: ejecucion
 * Módulo: documentacion
 * Feature: El sello «Firmado» en las tarjetas de documentos por Dirección (Fase 03.21, Plan 11,
 *   D-15, C10, UI-SPEC §8.2)
 * Archivo: CaseDirectionDocumentsList.test.ts
 * Responsabilidad: Fijar que el adaptador `aDocumento` CONSERVA `firmas` y `firmaRequerida`.
 *
 *   🔴 POR QUÉ HACE FALTA: `aDocumento` construye un `IDocument` campo por campo, así que todo lo
 *   que no nombra se pierde. Antes de esta fase eso no importaba; ahora, sin estas dos líneas, la
 *   tarjeta de la pestaña «Documentación» pintaría sin sello un documento que en las otras dos
 *   listas del expediente sale «Firmado» (C10). La segunda mitad monta `DocumentCards` con lo que
 *   devuelve el adaptador y comprueba que el sello cae dentro de `document-meta`.
 *
 *   Es `.ts` y no `.tsx`: el montaje usa `createElement`, sin JSX. Datos INVENTADOS.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: `aDocumentoExterno`, el reparto del
 *   agregado entre las cuatro Direcciones ajenas, la llamada ÚNICA al abrir una y el resaltado por
 *   URL)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: la marca «Nuevo» por usuario en las
 *   cinco Direcciones —compuesta con la acción de observar, que sigue solo en Ejecución— y la
 *   lectura al pulsar «Ver»: propio o externo según de dónde sea el documento, y `onLeido`)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import CaseDirectionDocumentsList, {
  AVISO_SIMULADO,
  aDocumento,
  aDocumentoExterno,
  repartirModulos,
} from "./CaseDirectionDocumentsList";
import DocumentCards from "./DocumentsCards";
import type { ExpedienteDocumento } from "../../services/EpasService";
import type {
  IDocumentoExterno,
  IDocumentosExternosDelExpediente,
} from "../../interfaces/IDocumentosExternos";

const mocks = vi.hoisted(() => ({
  getDocumentos: vi.fn(),
  getDocumentosExternos: vi.fn(),
  // Con implementación propia: `vi.clearAllMocks` la conserva y los describe que no saben de
  // lecturas ven «nada sin leer».
  noLeidosDelEpas: vi.fn(async (eejeId: number) => ({
    eejeId,
    propios: [] as number[],
    externos: [],
    total: 0,
  })),
  marcarPropio: vi.fn(async () => undefined),
  marcarExterno: vi.fn(async () => undefined),
}));

vi.mock("../../services/EpasService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/EpasService")>()),
  EpasService: {
    getDocumentos: mocks.getDocumentos,
    getDocumentosExternos: mocks.getDocumentosExternos,
  },
}));

vi.mock("../../services/DocumentosLecturaService", () => ({
  DocumentosLecturaService: {
    noLeidosDelEpas: mocks.noLeidosDelEpas,
    marcarPropio: mocks.marcarPropio,
    marcarExterno: mocks.marcarExterno,
  },
}));

const FIRMADO: ExpedienteDocumento = {
  docId: 21,
  docName: "Providencia de inicio de ejecución",
  tdocTypeName: "Providencia",
  docUploadedAt: "2026-10-26T15:40:00",
  docUrl: "/api/fileserver/ejecucion/documents/2026/10/d.pdf",
  firmaRequerida: true,
  firmas: [
    { rol: "decisor", nombre: "Ana Pérez", at: "2026-10-26T15:40:00" },
    { rol: "secretario", nombre: null, at: "2026-10-26T16:05:00" },
  ],
};

describe("CaseDirectionDocumentsList.aDocumento — conserva la firma (C10)", () => {
  it("copia `firmas` (en su orden) y `firmaRequerida` del documento del expediente", () => {
    const adaptado = aDocumento(FIRMADO);

    expect(adaptado.firmas).toEqual(FIRMADO.firmas);
    expect(adaptado.firmaRequerida).toBe(true);
  });

  it("D-26: lo que requería firma y no la tiene llega con `firmas` vacío y `firmaRequerida`", () => {
    const adaptado = aDocumento({
      docId: 22,
      docName: "Providencia sin firmar",
      firmaRequerida: true,
      firmas: [],
    });

    expect(adaptado.firmas).toEqual([]);
    expect(adaptado.firmaRequerida).toBe(true);
  });

  it("sin los dos campos (lo de antes de la fase) los deja ausentes y no cambia el resto del adaptador", () => {
    const adaptado = aDocumento({ docId: 23, docName: "Anexo subido" });

    expect(adaptado.firmas).toBeUndefined();
    expect(adaptado.firmaRequerida).toBeUndefined();
    expect(adaptado.docId).toBe(23);
    expect(adaptado.docName).toBe("Anexo subido");
    expect(adaptado.docUrl).toBe("");
    expect(adaptado.docStatus).toBeNull();
  });
});

describe("DocumentCards — el sello en `document-meta` (UI-SPEC §8.2)", () => {
  it("la tarjeta de un documento firmado pinta «Firmado» y sus líneas dentro de `document-meta`", () => {
    const { container } = render(
      createElement(DocumentCards, {
        documents: [aDocumento(FIRMADO)],
        onSelectDocument: vi.fn(),
      }),
    );

    const meta = container.querySelector(".document-meta") as HTMLElement;
    expect(meta).not.toBeNull();
    expect(meta).toContainElement(screen.getByText("Firmado"));
    expect(meta).toContainElement(
      screen.getByText("Decisor: Ana Pérez · 26 oct 2026, 15:40"),
    );
    expect(meta).toContainElement(
      screen.getByText(
        "Secretario: firmante sin nombre registrado · 26 oct 2026, 16:05",
      ),
    );
  });

  it("🔴 un documento sin firmas ni `firmaRequerida` sigue sin sello ni chip", () => {
    render(
      createElement(DocumentCards, {
        documents: [aDocumento({ docId: 24, docName: "Anexo subido" })],
        onSelectDocument: vi.fn(),
      }),
    );

    expect(screen.getByText(/Anexo subido/)).toBeInTheDocument();
    expect(screen.queryByText("Firmado")).toBeNull();
    expect(screen.queryByText("Sin firma")).toBeNull();
  });
});

// ── Quick 261030-dun: documentos de los otros módulos ───────────────────────────────────────────

const EXTERNO: IDocumentoExterno = {
  docId: "sim-resolucion-123-1",
  nombre: "Resolución sancionatoria",
  tipo: "Resolución",
  subtipo: "Sancionatoria",
  fecha: "2026-05-05T15:00:00.000Z",
  estado: "emitido",
  firmado: true,
  firmantes: [
    { nombre: "Pedro Ruiz", rol: "Resolutor", fecha: "2026-05-05T15:00:00.000Z" },
    { nombre: "Sin fecha", rol: "Secretario", fecha: null },
  ],
  administrados: [],
  archivoUrl: "/api/epas/5/documentos-externos/resolucion/sim-resolucion-123-1/archivo",
};

const URL_INSTRUCCION =
  "/api/epas/5/documentos-externos/dmit/sim-dmit-123-1/archivo";

const RESPUESTA: IDocumentosExternosDelExpediente = {
  eejeId: 5,
  caseId: 123,
  modulos: [
    {
      modulo: "inspeccion",
      nombre: "Dirección Metropolitana de Inspección",
      estado: "deshabilitado",
      simulado: false,
      mensaje: "Inspección sin configurar.",
      documentos: [],
    },
    {
      modulo: "dmit",
      nombre: "Dirección Metropolitana de Instrucción",
      estado: "ok",
      simulado: false,
      mensaje: null,
      documentos: [
        { ...EXTERNO, docId: "sim-dmit-123-1", nombre: "Auto de inicio", archivoUrl: URL_INSTRUCCION },
      ],
    },
    {
      modulo: "resolucion",
      nombre: "Dirección Metropolitana de Resolución",
      estado: "ok",
      simulado: true,
      mensaje: null,
      documentos: [EXTERNO],
    },
    {
      modulo: "sg",
      nombre: "Secretaría General",
      estado: "error",
      simulado: false,
      mensaje: "No se pudo consultar a Secretaría General. Intente más tarde.",
      documentos: [],
    },
  ],
};

describe("CaseDirectionDocumentsList.aDocumentoExterno", () => {
  it("docId negativo por índice, nombre, URL del proxy, tipo y firmas con fecha", () => {
    const adaptado = aDocumentoExterno(EXTERNO, 0);
    expect(adaptado.docId).toBe(-1);
    expect(aDocumentoExterno(EXTERNO, 2).docId).toBe(-3);
    expect(adaptado.docName).toBe("Resolución sancionatoria");
    expect(adaptado.docUrl).toBe(EXTERNO.archivoUrl);
    expect(adaptado.tdocTypeName).toBe("Resolución");
    expect(adaptado.tsdocSubtypeName).toBe("Sancionatoria");
    expect(adaptado.firmas).toEqual([
      { rol: "Resolutor", nombre: "Pedro Ruiz", at: "2026-05-05T15:00:00.000Z" },
    ]);
  });
});

describe("CaseDirectionDocumentsList.repartirModulos", () => {
  it("dmit ⇒ instruccion; ok/simulado ⇒ aviso; deshabilitado ⇒ aviso; error ⇒ error", () => {
    const reparto = repartirModulos(RESPUESTA);

    expect(reparto.instruccion?.documents.map((d) => d.docName)).toEqual([
      "Auto de inicio",
    ]);
    expect(reparto.instruccion?.aviso).toBeNull();
    expect(reparto.resolucion?.documents).toHaveLength(1);
    expect(reparto.resolucion?.aviso).toBe(AVISO_SIMULADO);
    expect(reparto.inspeccion).toMatchObject({
      documents: [],
      error: null,
      aviso: "Inspección sin configurar.",
      loaded: true,
    });
    expect(reparto.sg).toMatchObject({
      documents: [],
      error: "No se pudo consultar a Secretaría General. Intente más tarde.",
      loaded: true,
    });
    expect(reparto.ejecucion).toBeUndefined();
  });

  it("un módulo que no llega deja su Dirección cargada y vacía", () => {
    const reparto = repartirModulos({ eejeId: 5, caseId: 1, modulos: [] });
    for (const direccion of ["inspeccion", "instruccion", "resolucion", "sg"] as const) {
      expect(reparto[direccion]).toMatchObject({ documents: [], loaded: true, error: null });
    }
  });
});

describe("CaseDirectionDocumentsList — las Direcciones ajenas en UNA llamada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentos.mockResolvedValue([]);
    mocks.getDocumentosExternos.mockResolvedValue(RESPUESTA);
  });

  const montar = (props: Record<string, unknown> = {}) =>
    render(
      createElement(CaseDirectionDocumentsList, {
        eejeId: 5,
        onSelectDocument: vi.fn(),
        ...props,
      }),
    );

  it("cinco Direcciones, con Secretaría General la quinta", async () => {
    montar();
    expect(screen.getByText("Secretaría General")).toBeInTheDocument();
    expect(screen.getByText("5.")).toBeInTheDocument();
    // Deja terminar la carga inicial de Ejecución dentro de act.
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("abrir una externa hace UNA llamada que llena las cuatro; abrir otra no vuelve a llamar", async () => {
    montar();
    await waitFor(() => expect(mocks.getDocumentos).toHaveBeenCalledTimes(1));
    expect(mocks.getDocumentosExternos).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Dirección Metropolitana de Resolución"));
    expect(await screen.findByText(/Resolución sancionatoria/)).toBeInTheDocument();
    expect(screen.getByText(AVISO_SIMULADO)).toBeInTheDocument();
    expect(mocks.getDocumentosExternos).toHaveBeenCalledTimes(1);
    expect(mocks.getDocumentosExternos).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByText("Dirección Metropolitana de Instrucción"));
    expect(await screen.findByText(/Auto de inicio/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Secretaría General"));
    expect(
      await screen.findByText("No se pudo consultar a Secretaría General. Intente más tarde."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Dirección Metropolitana de Inspección"));
    expect(await screen.findByText("Inspección sin configurar.")).toBeInTheDocument();

    expect(mocks.getDocumentosExternos).toHaveBeenCalledTimes(1);
  });

  it("con selectedDocumentUrl solo resalta la Dirección que contiene ese documento", async () => {
    montar({ selectedDocumentId: -1, selectedDocumentUrl: EXTERNO.archivoUrl });

    fireEvent.click(screen.getByText("Dirección Metropolitana de Instrucción"));
    const auto = await screen.findByText(/Auto de inicio/);
    expect(auto.closest(".document-card")?.className).not.toMatch(/\bselected\b/);

    fireEvent.click(screen.getByText("Dirección Metropolitana de Resolución"));
    const resolucion = await screen.findByText(/Resolución sancionatoria/);
    expect(resolucion.closest(".document-card")?.className).toMatch(/\bselected\b/);
  });

  it("si la llamada entera falla, las cuatro ajenas muestran el error", async () => {
    mocks.getDocumentosExternos.mockRejectedValue(new Error("red"));
    montar();
    fireEvent.click(screen.getByText("Secretaría General"));
    expect(
      await screen.findByText("No se pudieron consultar los documentos de otros módulos."),
    ).toBeInTheDocument();
  });

  it("la acción por documento (observar) solo en los de Ejecución", async () => {
    mocks.getDocumentos.mockResolvedValue([
      { docId: 9, docName: "Providencia propia", docUrl: "/api/x.pdf" },
    ]);
    const accion = vi.fn(() => createElement("span", null, "ACCION"));
    montar({ accionPorDocumento: accion });
    expect(await screen.findByText("ACCION")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Dirección Metropolitana de Resolución"));
    await screen.findByText(/Resolución sancionatoria/);
    expect(accion).not.toHaveBeenCalledWith(
      expect.objectContaining({ docName: "Resolución sancionatoria" }),
    );
    expect(screen.queryByText("ACCION")).toBeNull();
  });
});

describe("CaseDirectionDocumentsList — la marca «Nuevo» por usuario (quick 261030-m29)", () => {
  const NUEVO = "Documento nuevo sin leer";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentos.mockResolvedValue([
      { docId: 9, docName: "Providencia leída", docUrl: "/api/9.pdf" },
      { docId: 12, docName: "Providencia nueva", docUrl: "/api/12.pdf" },
    ]);
    mocks.noLeidosDelEpas.mockResolvedValue({
      eejeId: 5,
      propios: [12],
      externos: [],
      total: 1,
    });
    mocks.getDocumentosExternos.mockResolvedValue({
      ...RESPUESTA,
      modulos: RESPUESTA.modulos.map((m) =>
        m.modulo === "resolucion"
          ? { ...m, documentos: [{ ...EXTERNO, nuevo: true }] }
          : m,
      ),
    });
  });

  /** La tarjeta del documento cuyo nombre contiene `texto`. */
  const tarjeta = async (texto: RegExp) =>
    (await screen.findByText(texto)).closest(".document-card") as HTMLElement;

  it("Ejecución: la marca va en el propio sin leer, junto a la acción de observar (compuesta, no reemplazada)", async () => {
    const accion = vi.fn(() => createElement("span", null, "ACCION"));
    render(
      createElement(CaseDirectionDocumentsList, {
        eejeId: 5,
        onSelectDocument: vi.fn(),
        accionPorDocumento: accion,
      }),
    );

    const nueva = await tarjeta(/Providencia nueva/);
    await waitFor(() =>
      expect(within(nueva).getByRole("img", { name: NUEVO })).toBeInTheDocument(),
    );
    expect(within(nueva).getByText("ACCION")).toBeInTheDocument();
    const leida = await tarjeta(/Providencia leída/);
    expect(within(leida).queryByRole("img", { name: NUEVO })).toBeNull();
    expect(within(leida).getByText("ACCION")).toBeInTheDocument();
    expect(mocks.noLeidosDelEpas).toHaveBeenCalledWith(5);
  });

  it("«Ver» de un propio nuevo marca su lectura, quita la marca, llama a onLeido y selecciona", async () => {
    const onSelectDocument = vi.fn();
    const onLeido = vi.fn();
    render(
      createElement(CaseDirectionDocumentsList, {
        eejeId: 5,
        onSelectDocument,
        onLeido,
      }),
    );
    const nueva = await tarjeta(/Providencia nueva/);
    await waitFor(() => within(nueva).getByRole("img", { name: NUEVO }));

    fireEvent.click(within(nueva).getByRole("button", { name: "Ver" }));

    expect(mocks.marcarPropio).toHaveBeenCalledWith(5, 12);
    expect(onLeido).toHaveBeenCalledTimes(1);
    expect(onSelectDocument).toHaveBeenCalledWith(
      expect.objectContaining({ docId: 12 }),
    );
    expect(screen.queryByRole("img", { name: NUEVO })).toBeNull();

    // Uno sin marca no marca nada.
    fireEvent.click(
      within(await tarjeta(/Providencia leída/)).getByRole("button", { name: "Ver" }),
    );
    expect(mocks.marcarPropio).toHaveBeenCalledTimes(1);
    expect(onLeido).toHaveBeenCalledTimes(1);
  });

  it("otra Dirección: el externo con nuevo=true lleva la marca y «Ver» marca su lectura con su módulo y su docId", async () => {
    const onLeido = vi.fn();
    render(
      createElement(CaseDirectionDocumentsList, {
        eejeId: 5,
        onSelectDocument: vi.fn(),
        onLeido,
      }),
    );
    await waitFor(() => expect(mocks.getDocumentos).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("Dirección Metropolitana de Resolución"));
    const externa = await tarjeta(/Resolución sancionatoria/);
    expect(within(externa).getByRole("img", { name: NUEVO })).toBeInTheDocument();

    fireEvent.click(within(externa).getByRole("button", { name: "Ver" }));

    expect(mocks.marcarExterno).toHaveBeenCalledWith(5, "resolucion", EXTERNO.docId);
    expect(mocks.marcarPropio).not.toHaveBeenCalled();
    expect(onLeido).toHaveBeenCalledTimes(1);
    expect(within(externa).queryByRole("img", { name: NUEVO })).toBeNull();
  });

  it("🔴 si las lecturas fallan, Ejecución se lista igual y sin marcas", async () => {
    mocks.noLeidosDelEpas.mockRejectedValue(new Error("500"));
    render(
      createElement(CaseDirectionDocumentsList, {
        eejeId: 5,
        onSelectDocument: vi.fn(),
      }),
    );
    expect(await screen.findByText(/Providencia nueva/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("img", { name: NUEVO })).toBeNull();
  });
});
