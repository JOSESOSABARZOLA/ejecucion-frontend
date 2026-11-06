/**
 * Microservicio: ejecucion
 * Módulo: Expediente (compartido)
 * Archivo: DocumentosOtrosModulos.test.tsx
 * Responsabilidad: Fijar cómo se ven los documentos de los otros módulos: cada módulo con su nombre
 *   y su estado (documentos, vacío, error, deshabilitado, simulado), el fallo de la llamada entera,
 *   cómo se abre un documento (callback o modal del visor) y el resaltado del abierto.
 *   Datos INVENTADOS.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-30
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: la marca «Nuevo» de un documento con
 *   `nuevo: true`; abrirlo marca su lectura con su módulo y su docId, la quita y llama a `onLeido`)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type {
  IDocumentoExterno,
  IDocumentosExternosDelExpediente,
} from "../../interfaces/IDocumentosExternos";

const mocks = vi.hoisted(() => ({
  getDocumentosExternos: vi.fn(),
  openModal: vi.fn(),
  marcarExterno: vi.fn(),
}));

vi.mock("../../services/EpasService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/EpasService")>()),
  EpasService: { getDocumentosExternos: mocks.getDocumentosExternos },
}));
vi.mock("../../hooks/useModal", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));

vi.mock("../../services/DocumentosLecturaService", () => ({
  DocumentosLecturaService: { marcarExterno: mocks.marcarExterno },
}));

import DocumentosOtrosModulos from "./DocumentosOtrosModulos";

const AUTO: IDocumentoExterno = {
  docId: "sim-dmit-123-1",
  nombre: "Auto de inicio del procedimiento sancionador",
  tipo: "Auto",
  subtipo: null,
  fecha: "2026-02-10T15:00:00.000Z",
  estado: "emitido",
  firmado: true,
  firmantes: [
    { nombre: "Laura Gómez", rol: "Instructor", fecha: null },
  ],
  administrados: [],
  archivoUrl: "/api/epas/5/documentos-externos/dmit/sim-dmit-123-1/archivo",
};

const RESPUESTA: IDocumentosExternosDelExpediente = {
  eejeId: 5,
  caseId: 123,
  modulos: [
    {
      modulo: "inspeccion",
      nombre: "Dirección Metropolitana de Inspección",
      estado: "deshabilitado",
      simulado: false,
      mensaje: "La consulta a Inspección está encendida pero le falta configuración.",
      documentos: [],
    },
    {
      modulo: "dmit",
      nombre: "Dirección Metropolitana de Instrucción",
      estado: "ok",
      simulado: true,
      mensaje: null,
      documentos: [AUTO],
    },
    {
      modulo: "resolucion",
      nombre: "Dirección Metropolitana de Resolución",
      estado: "error",
      simulado: false,
      mensaje: "No se pudo consultar a Dirección Metropolitana de Resolución. Intente más tarde.",
      documentos: [],
    },
    {
      modulo: "sg",
      nombre: "Secretaría General",
      estado: "ok",
      simulado: false,
      mensaje: null,
      documentos: [],
    },
  ],
};

describe("DocumentosOtrosModulos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentosExternos.mockResolvedValue(RESPUESTA);
  });

  it("mientras carga lo dice", () => {
    mocks.getDocumentosExternos.mockReturnValue(new Promise(() => undefined));
    render(<DocumentosOtrosModulos eejeId={5} />);
    expect(
      screen.getByText("Cargando documentos de otros módulos…"),
    ).toBeInTheDocument();
  });

  it("pinta los cuatro módulos en el orden recibido con su nombre como encabezado", async () => {
    render(<DocumentosOtrosModulos eejeId={5} />);
    await screen.findByText(AUTO.nombre);

    expect(mocks.getDocumentosExternos).toHaveBeenCalledWith(5);
    const encabezados = screen
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent?.replace("Simulado", "").trim());
    expect(encabezados).toEqual([
      "Dirección Metropolitana de Inspección",
      "Dirección Metropolitana de Instrucción",
      "Dirección Metropolitana de Resolución",
      "Secretaría General",
    ]);
  });

  it("ok con documentos: botón con su nombre, insignia del tipo y «Firmado por <nombre> (<rol>)»", async () => {
    render(<DocumentosOtrosModulos eejeId={5} />);
    const seccion = within(
      await screen.findByRole("region", {
        name: "Dirección Metropolitana de Instrucción",
      }),
    );
    expect(seccion.getByRole("button", { name: AUTO.nombre })).toBeInTheDocument();
    expect(seccion.getByText("Auto")).toHaveClass("badge");
    expect(
      seccion.getByText("Firmado por Laura Gómez (Instructor)"),
    ).toBeInTheDocument();
    // simulado ⇒ insignia «Simulado» en ESE módulo
    expect(seccion.getByText("Simulado")).toHaveClass("badge-warning");
  });

  it("ok sin documentos ⇒ «Sin documentos emitidos.»; sin simulado no hay insignia", async () => {
    render(<DocumentosOtrosModulos eejeId={5} />);
    const seccion = within(
      await screen.findByRole("region", { name: "Secretaría General" }),
    );
    expect(seccion.getByText("Sin documentos emitidos.")).toBeInTheDocument();
    expect(seccion.queryByText("Simulado")).toBeNull();
  });

  it("error ⇒ su mensaje; deshabilitado ⇒ su mensaje en tono neutro", async () => {
    render(<DocumentosOtrosModulos eejeId={5} />);
    const resolucion = within(
      await screen.findByRole("region", {
        name: "Dirección Metropolitana de Resolución",
      }),
    );
    expect(
      resolucion.getByText(
        "No se pudo consultar a Dirección Metropolitana de Resolución. Intente más tarde.",
      ),
    ).toHaveClass("text-error");

    const inspeccion = within(
      screen.getByRole("region", { name: "Dirección Metropolitana de Inspección" }),
    );
    expect(
      inspeccion.getByText(
        "La consulta a Inspección está encendida pero le falta configuración.",
      ),
    ).toHaveClass("text-base-content/70");
  });

  it("si la llamada entera falla lo dice", async () => {
    mocks.getDocumentosExternos.mockRejectedValue(new Error("red"));
    render(<DocumentosOtrosModulos eejeId={5} />);
    expect(
      await screen.findByText(
        "No se pudieron consultar los documentos de otros módulos.",
      ),
    ).toBeInTheDocument();
  });

  it("sin callback, pulsar abre el modal del visor con nombre y archivoUrl", async () => {
    render(<DocumentosOtrosModulos eejeId={5} />);
    (await screen.findByRole("button", { name: AUTO.nombre })).click();
    expect(mocks.openModal).toHaveBeenCalledWith("documentViewer", {
      docName: AUTO.nombre,
      docUrl: AUTO.archivoUrl,
    });
  });

  it("con callback, lo entrega y NO abre el modal; urlAbierta resalta su fila", async () => {
    const onAbrirDocumento = vi.fn();
    render(
      <DocumentosOtrosModulos
        eejeId={5}
        onAbrirDocumento={onAbrirDocumento}
        urlAbierta={AUTO.archivoUrl}
      />,
    );
    const boton = await screen.findByRole("button", { name: AUTO.nombre });
    expect(boton).toHaveAttribute("aria-current", "true");
    expect(boton.className).toContain("font-semibold");

    boton.click();
    expect(onAbrirDocumento).toHaveBeenCalledWith(AUTO);
    expect(mocks.openModal).not.toHaveBeenCalled();
  });

  it("sin urlAbierta no resalta nada", async () => {
    render(<DocumentosOtrosModulos eejeId={5} />);
    const boton = await screen.findByRole("button", { name: AUTO.nombre });
    expect(boton).not.toHaveAttribute("aria-current");
  });
});

describe("DocumentosOtrosModulos — la marca «Nuevo» (quick 261030-m29)", () => {
  const NUEVO: IDocumentoExterno = {
    ...AUTO,
    docId: "dmit/42 a",
    nombre: "Informe nuevo de Instrucción",
    archivoUrl: "/api/epas/5/documentos-externos/dmit/42/archivo",
    nuevo: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.marcarExterno.mockResolvedValue(undefined);
    mocks.getDocumentosExternos.mockResolvedValue({
      ...RESPUESTA,
      modulos: RESPUESTA.modulos.map((m) =>
        m.modulo === "dmit" ? { ...m, documentos: [AUTO, NUEVO] } : m,
      ),
    });
  });

  it("solo el documento con nuevo=true lleva la marca", async () => {
    render(<DocumentosOtrosModulos eejeId={5} />);
    const fila = (
      await screen.findByRole("button", { name: NUEVO.nombre })
    ).closest("li") as HTMLElement;

    expect(
      within(fila).getByRole("img", { name: "Documento nuevo sin leer" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Documento nuevo sin leer" })).toHaveLength(1);
  });

  it("abrir el nuevo marca su lectura con su módulo y su docId, quita la marca y llama a onLeido", async () => {
    const onLeido = vi.fn();
    const onAbrirDocumento = vi.fn();
    render(
      <DocumentosOtrosModulos
        eejeId={5}
        onLeido={onLeido}
        onAbrirDocumento={onAbrirDocumento}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: NUEVO.nombre }));

    expect(onAbrirDocumento).toHaveBeenCalledWith(NUEVO);
    expect(mocks.marcarExterno).toHaveBeenCalledWith(5, "dmit", "dmit/42 a");
    expect(onLeido).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("img", { name: "Documento nuevo sin leer" }),
    ).toBeNull();

    // Abrirlo otra vez ya no marca nada.
    fireEvent.click(screen.getByRole("button", { name: NUEVO.nombre }));
    expect(mocks.marcarExterno).toHaveBeenCalledTimes(1);
    expect(onLeido).toHaveBeenCalledTimes(1);
  });

  it("abrir uno sin marca no marca nada", async () => {
    const onLeido = vi.fn();
    render(<DocumentosOtrosModulos eejeId={5} onLeido={onLeido} />);

    fireEvent.click(await screen.findByRole("button", { name: AUTO.nombre }));

    expect(mocks.marcarExterno).not.toHaveBeenCalled();
    expect(onLeido).not.toHaveBeenCalled();
  });

  it("si marcar falla, solo se avisa en consola y la marca se queda quitada", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.marcarExterno.mockRejectedValue(new Error("red"));
    render(<DocumentosOtrosModulos eejeId={5} />);

    fireEvent.click(await screen.findByRole("button", { name: NUEVO.nombre }));

    await waitFor(() => expect(aviso).toHaveBeenCalled());
    expect(
      screen.queryByRole("img", { name: "Documento nuevo sin leer" }),
    ).toBeNull();
    aviso.mockRestore();
  });
});
