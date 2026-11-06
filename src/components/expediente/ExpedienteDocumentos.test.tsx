/**
 * Microservicio: ejecucion
 * Módulo: Expediente (compartido)
 * Archivo: ExpedienteDocumentos.test.tsx
 * Responsabilidad: Fijar lo que queda del componente después de que el formulario de anexos se
 *   fuera a un MODAL (encargo del usuario, 2026-09-17): una LISTA, y nada más.
 *
 *   Dos cosas se miden aquí y no en el test del modal, porque son de este componente:
 *   · Que el formulario YA NO ESTÁ —ni su rótulo, ni el input de archivo, ni el botón—, tampoco en
 *     la rama de «sin documentos», que es donde se colaba antes.
 *   · Que `recargaSenal` HACE algo: una señal nueva vuelve a pedir la lista; la misma señal en un
 *     re-render NO. Sin la segunda mitad, un `useEffect` con las dependencias mal puestas pasaría
 *     por verde pidiendo la lista en cada render.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-15/D-26, UI-SPEC §8.2: el
 *   `<li>` pasa a columna —la fila de siempre (nombre + chip de tipo) y debajo el sello «Firmado»
 *   con sus líneas—; sin firmas ni `firmaRequerida`, todo igual que antes).
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-dun: `mostrarOtrosModulos` —sin él no se
 *   pide nada a los otros módulos; con él la sección sale debajo, también con la lista propia vacía
 *   o caída—).
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: la marca «Nuevo» por usuario —qué
 *   documento la lleva, que abrirlo la quita, marca la lectura y avisa con `onLeido`, y que si las
 *   lecturas fallan la lista sale igual sin marcas—).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ExpedienteDocumento } from "../../services/EpasService";

const mocks = vi.hoisted(() => ({
  getDocumentos: vi.fn(),
  getDocumentosExternos: vi.fn(),
  // Con implementación propia: `vi.clearAllMocks` la conserva, así que los describe de antes (que no
  // saben de lecturas) ven «nada sin leer» y no una promesa ausente.
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

// Quick 261030-m29: las lecturas por usuario. Por defecto nada sin leer; cada prueba de la marca
// pone lo suyo.
vi.mock("../../services/DocumentosLecturaService", () => ({
  DocumentosLecturaService: {
    noLeidosDelEpas: mocks.noLeidosDelEpas,
    marcarPropio: mocks.marcarPropio,
    marcarExterno: mocks.marcarExterno,
  },
}));

import { ExpedienteDocumentos } from "./ExpedienteDocumentos";
import { ModalProvider } from "../../providers/ModalProvider";

const EEJE_ID = 7;

const DOCS: ExpedienteDocumento[] = [
  {
    docId: 1,
    docName: "Resolución sancionatoria",
    docUrl: "/api/fileserver/ejecucion/documents/2026/10/a.pdf",
    tdocTypeName: "Resolución",
  },
  { docId: 2, docName: "Acta de inspección", docUrl: "/api/fileserver/ejecucion/documents/2026/10/b.pdf" },
];

const montar = (recargaSenal?: number) =>
  render(
    <ModalProvider>
      <ExpedienteDocumentos
        eejeId={EEJE_ID}
        recargaSenal={recargaSenal}
      />
    </ModalProvider>,
  );

/** El formulario viejo, buscado por sus tres señas. Ninguna debe aparecer ya. */
const noHayFormulario = (container: HTMLElement) => {
  expect(container.querySelector('input[type="file"]')).toBeNull();
  expect(screen.queryByText(/adjuntar documento al expediente/i)).toBeNull();
  expect(screen.queryByRole("button", { name: /^adjuntar$/i })).toBeNull();
  expect(screen.queryByPlaceholderText(/qué es el documento/i)).toBeNull();
};

describe("ExpedienteDocumentos — ya no incrusta el formulario de anexos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentos.mockResolvedValue(DOCS);
  });

  it("lista los documentos y NO pinta formulario alguno", async () => {
    const { container } = montar();

    expect(
      await screen.findByText("Resolución sancionatoria"),
    ).toBeInTheDocument();
    expect(screen.getByText("Acta de inspección")).toBeInTheDocument();
    noHayFormulario(container);
  });

  it("🔴 tampoco en la rama de «sin documentos», que es donde se colaba", async () => {
    mocks.getDocumentos.mockResolvedValue([]);
    const { container } = montar();

    expect(
      await screen.findByText(/sin documentos registrados/i),
    ).toBeInTheDocument();
    noHayFormulario(container);
  });

  it("degrada con gracia cuando el endpoint no responde", async () => {
    mocks.getDocumentos.mockRejectedValue(new Error("404"));
    const { container } = montar();

    expect(
      await screen.findByText(/integración pendiente/i),
    ).toBeInTheDocument();
    noHayFormulario(container);
  });
});

describe("ExpedienteDocumentos — `recargaSenal` es lo que sustituye al `recarga` interno", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentos.mockResolvedValue(DOCS);
  });

  it("una señal NUEVA vuelve a pedir la lista", async () => {
    const { rerender } = montar(0);
    await waitFor(() => expect(mocks.getDocumentos).toHaveBeenCalledTimes(1));

    rerender(
      <ModalProvider>
        <ExpedienteDocumentos
          eejeId={EEJE_ID}
          recargaSenal={1}
        />
      </ModalProvider>,
    );

    await waitFor(() => expect(mocks.getDocumentos).toHaveBeenCalledTimes(2));
  });

  it("🔴 la MISMA señal en un re-render NO vuelve a pedirla", async () => {
    const { rerender } = montar(3);
    await waitFor(() => expect(mocks.getDocumentos).toHaveBeenCalledTimes(1));

    rerender(
      <ModalProvider>
        <ExpedienteDocumentos
          eejeId={EEJE_ID}
          recargaSenal={3}
        />
      </ModalProvider>,
    );

    // Se espera de verdad: si el efecto se disparara, la segunda llamada llegaría en este hueco.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.getDocumentos).toHaveBeenCalledTimes(1);
  });
});

describe("ExpedienteDocumentos — el sello «Firmado» (Fase 03.21, D-15/D-26, UI-SPEC §8.2)", () => {
  const FIRMADO: ExpedienteDocumento = {
    docId: 10,
    docName: "Providencia de inicio de ejecución",
    docUrl: "/api/fileserver/ejecucion/documents/2026/10/c.pdf",
    tdocTypeName: "Providencia",
    firmaRequerida: true,
    firmas: [
      { rol: "decisor", nombre: "Ana Pérez", at: "2026-10-26T15:40:00" },
    ],
  };
  const SIN_FIRMA_REQUERIDA: ExpedienteDocumento = {
    docId: 11,
    docName: "Providencia sin firmar",
    tdocTypeName: "Providencia",
    firmaRequerida: true,
    firmas: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("un documento firmado: el <li> es columna, la fila de nombre + tipo arriba y el sello con su línea debajo", async () => {
    mocks.getDocumentos.mockResolvedValue([FIRMADO]);
    montar();

    const nombre = await screen.findByText(
      "Providencia de inicio de ejecución",
    );
    const li = nombre.closest("li") as HTMLElement;
    expect(li.className).toContain("flex");
    expect(li.className).toContain("flex-col");
    expect(li.className).toContain("gap-1");

    // La fila de siempre: nombre + chip de tipo, juntos y en la PRIMERA fila del <li>.
    const fila = li.firstElementChild as HTMLElement;
    expect(fila).toContainElement(nombre);
    expect(fila).toContainElement(screen.getByText("Providencia"));

    // El sello y su línea, en el mismo <li>, después de la fila.
    const sello = screen.getByText("Firmado");
    expect(sello.className).toContain("badge-success");
    expect(li).toContainElement(sello);
    expect(fila).not.toContainElement(
      screen.getByText("Decisor: Ana Pérez · 26 oct 2026, 15:40"),
    );
    expect(li).toContainElement(
      screen.getByText("Decisor: Ana Pérez · 26 oct 2026, 15:40"),
    );
  });

  it("D-26: lo que requería firma y no la tiene lleva el chip «Sin firma», sin sello", async () => {
    mocks.getDocumentos.mockResolvedValue([SIN_FIRMA_REQUERIDA]);
    montar();

    expect(await screen.findByText("Sin firma")).toBeInTheDocument();
    expect(screen.queryByText("Firmado")).toBeNull();
  });

  it("🔴 un documento sin firmas y sin `firmaRequerida` se ve igual que hoy: ni sello ni chip", async () => {
    mocks.getDocumentos.mockResolvedValue(DOCS);
    montar();

    expect(
      await screen.findByText("Resolución sancionatoria"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Firmado")).toBeNull();
    expect(screen.queryByText("Sin firma")).toBeNull();
  });

  it("🔴 el sello NO se deriva de `docStatus`: un documento «EMITIDA» sin firmas no dice «Firmado»", async () => {
    mocks.getDocumentos.mockResolvedValue([
      { docId: 12, docName: "Acta emitida", docStatus: "EMITIDA", firmas: [] },
    ]);
    montar();

    expect(await screen.findByText("Acta emitida")).toBeInTheDocument();
    expect(screen.queryByText("Firmado")).toBeNull();
  });
});

describe("ExpedienteDocumentos — dentro de otro modal no abre el visor en modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentos.mockResolvedValue(DOCS);
  });

  it("con onAbrirDocumento entrega el documento pulsado y marca su fila como la abierta", async () => {
    const onAbrirDocumento = vi.fn();
    render(
      <ModalProvider>
        <ExpedienteDocumentos
          eejeId={EEJE_ID}
          onAbrirDocumento={onAbrirDocumento}
          docIdAbierto={2}
        />
      </ModalProvider>,
    );

    const boton = await screen.findByRole("button", {
      name: "Resolución sancionatoria",
    });
    boton.click();

    expect(onAbrirDocumento).toHaveBeenCalledWith(DOCS[0]);
    expect(
      screen.getByRole("button", { name: "Acta de inspección" }),
    ).toHaveAttribute("aria-current", "true");
    expect(boton).not.toHaveAttribute("aria-current");
  });
});

describe("ExpedienteDocumentos — documentos de otros módulos (quick 261030-dun)", () => {
  const EXTERNOS = {
    eejeId: EEJE_ID,
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
            nombre: "Resolución sancionatoria (otro módulo)",
            tipo: "Resolución",
            subtipo: null,
            fecha: null,
            estado: "emitido",
            firmado: false,
            firmantes: [],
            administrados: [],
            archivoUrl:
              "/api/epas/7/documentos-externos/resolucion/sim-resolucion-123-1/archivo",
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentos.mockResolvedValue(DOCS);
    mocks.getDocumentosExternos.mockResolvedValue(EXTERNOS);
  });

  it("🔴 sin mostrarOtrosModulos NO pide nada a los otros módulos (ActasSorteoPage no cambia)", async () => {
    montar();
    expect(
      await screen.findByText("Resolución sancionatoria"),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.getDocumentosExternos).not.toHaveBeenCalled();
    expect(screen.queryByText("Documentos de otros módulos")).toBeNull();
  });

  it("con mostrarOtrosModulos pinta los propios y DEBAJO la sección de otros módulos", async () => {
    render(
      <ModalProvider>
        <ExpedienteDocumentos eejeId={EEJE_ID} mostrarOtrosModulos />
      </ModalProvider>,
    );

    const propio = await screen.findByText("Resolución sancionatoria");
    const externo = await screen.findByText(
      "Resolución sancionatoria (otro módulo)",
    );
    const titulo = screen.getByText("Documentos de otros módulos");
    expect(mocks.getDocumentosExternos).toHaveBeenCalledWith(EEJE_ID);
    // Orden en el DOM: propio → título → externo.
    expect(
      propio.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      titulo.compareDocumentPosition(externo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("también cuando la lista propia está vacía o falló", async () => {
    mocks.getDocumentos.mockResolvedValue([]);
    const { unmount } = render(
      <ModalProvider>
        <ExpedienteDocumentos eejeId={EEJE_ID} mostrarOtrosModulos />
      </ModalProvider>,
    );
    expect(
      await screen.findByText(/sin documentos registrados/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Resolución sancionatoria (otro módulo)"),
    ).toBeInTheDocument();
    unmount();

    mocks.getDocumentos.mockRejectedValue(new Error("404"));
    render(
      <ModalProvider>
        <ExpedienteDocumentos eejeId={EEJE_ID} mostrarOtrosModulos />
      </ModalProvider>,
    );
    expect(
      await screen.findByText(/integración pendiente/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Resolución sancionatoria (otro módulo)"),
    ).toBeInTheDocument();
  });

  it("el externo pulsado va a onAbrirDocumentoExterno", async () => {
    const onAbrirDocumentoExterno = vi.fn();
    render(
      <ModalProvider>
        <ExpedienteDocumentos
          eejeId={EEJE_ID}
          mostrarOtrosModulos
          onAbrirDocumentoExterno={onAbrirDocumentoExterno}
        />
      </ModalProvider>,
    );
    (
      await screen.findByRole("button", {
        name: "Resolución sancionatoria (otro módulo)",
      })
    ).click();
    expect(onAbrirDocumentoExterno).toHaveBeenCalledWith(
      EXTERNOS.modulos[0].documentos[0],
    );
  });
});

describe("ExpedienteDocumentos — la marca «Nuevo» por usuario (quick 261030-m29)", () => {
  const PROPIOS: ExpedienteDocumento[] = [
    { docId: 11, docName: "Providencia leída", docUrl: "/api/x/11.pdf" },
    { docId: 12, docName: "Providencia nueva", docUrl: "/api/x/12.pdf" },
  ];

  const montarConLectura = (onLeido = vi.fn(), onAbrirDocumento = vi.fn()) =>
    render(
      <ModalProvider>
        <ExpedienteDocumentos
          eejeId={EEJE_ID}
          onAbrirDocumento={onAbrirDocumento}
          onLeido={onLeido}
        />
      </ModalProvider>,
    );

  /** La fila (`<li>`) del documento con ese nombre. */
  const filaDe = (nombre: string) =>
    screen.getByRole("button", { name: nombre }).closest("li") as HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentos.mockResolvedValue(PROPIOS);
    mocks.noLeidosDelEpas.mockResolvedValue({
      eejeId: EEJE_ID,
      propios: [12],
      externos: [],
      total: 1,
    });
    mocks.marcarPropio.mockResolvedValue(undefined);
  });

  it("solo el documento sin leer lleva la marca «Nuevo»", async () => {
    montarConLectura();
    await screen.findByRole("button", { name: "Providencia nueva" });

    expect(mocks.noLeidosDelEpas).toHaveBeenCalledWith(EEJE_ID);
    expect(
      await within(filaDe("Providencia nueva")).findByRole("img", {
        name: "Documento nuevo sin leer",
      }),
    ).toHaveTextContent("Nuevo");
    expect(
      within(filaDe("Providencia leída")).queryByRole("img", {
        name: "Documento nuevo sin leer",
      }),
    ).toBeNull();
  });

  it("abrir el nuevo marca su lectura, quita la marca y llama a onLeido", async () => {
    const onLeido = vi.fn();
    const onAbrirDocumento = vi.fn();
    montarConLectura(onLeido, onAbrirDocumento);
    await within(await waitFor(() => filaDe("Providencia nueva"))).findByRole(
      "img",
      { name: "Documento nuevo sin leer" },
    );

    fireEvent.click(screen.getByRole("button", { name: "Providencia nueva" }));

    expect(onAbrirDocumento).toHaveBeenCalledWith(PROPIOS[1]);
    expect(mocks.marcarPropio).toHaveBeenCalledWith(EEJE_ID, 12);
    expect(onLeido).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("img", { name: "Documento nuevo sin leer" }),
    ).toBeNull();

    // Abrirlo otra vez ya no marca nada.
    fireEvent.click(screen.getByRole("button", { name: "Providencia nueva" }));
    expect(mocks.marcarPropio).toHaveBeenCalledTimes(1);
    expect(onLeido).toHaveBeenCalledTimes(1);
  });

  it("abrir uno sin marca no marca nada", async () => {
    const onLeido = vi.fn();
    montarConLectura(onLeido);
    await screen.findByRole("img", { name: "Documento nuevo sin leer" });

    fireEvent.click(screen.getByRole("button", { name: "Providencia leída" }));

    expect(mocks.marcarPropio).not.toHaveBeenCalled();
    expect(onLeido).not.toHaveBeenCalled();
  });

  it("si marcar falla, la marca se queda quitada y solo se avisa en consola", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.marcarPropio.mockRejectedValue(new Error("red"));
    montarConLectura();
    await screen.findByRole("img", { name: "Documento nuevo sin leer" });

    fireEvent.click(screen.getByRole("button", { name: "Providencia nueva" }));

    await waitFor(() => expect(aviso).toHaveBeenCalled());
    expect(
      screen.queryByRole("img", { name: "Documento nuevo sin leer" }),
    ).toBeNull();
    aviso.mockRestore();
  });

  it("🔴 si las lecturas fallan, la lista se pinta igual y sin marcas", async () => {
    mocks.noLeidosDelEpas.mockRejectedValue(new Error("500"));
    montarConLectura();

    expect(
      await screen.findByRole("button", { name: "Providencia nueva" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Providencia leída" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      screen.queryByRole("img", { name: "Documento nuevo sin leer" }),
    ).toBeNull();
  });

  it("una señal de recarga nueva vuelve a pedir las lecturas", async () => {
    const { rerender } = render(
      <ModalProvider>
        <ExpedienteDocumentos eejeId={EEJE_ID} recargaSenal={0} />
      </ModalProvider>,
    );
    await waitFor(() => expect(mocks.noLeidosDelEpas).toHaveBeenCalledTimes(1));

    rerender(
      <ModalProvider>
        <ExpedienteDocumentos eejeId={EEJE_ID} recargaSenal={1} />
      </ModalProvider>,
    );
    await waitFor(() => expect(mocks.noLeidosDelEpas).toHaveBeenCalledTimes(2));
  });
});
