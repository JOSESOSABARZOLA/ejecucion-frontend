/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Archivo: ModalExcusa.test.tsx
 * Responsabilidad: Fija las reglas del modal de excusa después de que el decisor DEJARA DE SUBIR UN
 *   PDF (D-03, 2026-09-16) y pasara a redactar el escrito sobre una plantilla precargada.
 *
 *   Se conservan las reglas vigentes que este cambio NO relaja: que la causal no venga
 *   preseleccionada —preseleccionar la primera haría que un decisor apurado se excusara por «interés
 *   personal» sin haberlo elegido— y que SIGA HACIENDO FALTA UN ESCRITO. El acta del 2026-08-28 no
 *   se toca; lo único que cambia es QUIÉN produce el escrito.
 *
 *   ── 🔴 POR QUÉ LA PLANTILLA CAÍDA **NO** BLOQUEA, Y EL CATÁLOGO DE CAUSALES SÍ ───────────────
 *   Parecen el mismo caso y no lo son, y la diferencia hay que respetarla:
 *
 *   · **Sin causal la excusa NO PUEDE EXISTIR.** Es un dato del acto, lo fija la norma y es lo único
 *     agrupable; sin ella no hay nada que el director pueda resolver ni que nadie pueda contar. Por
 *     eso el catálogo caído bloquea el envío.
 *   · **Sin plantilla la excusa SÍ puede existir.** El escrito es texto del DECISOR: la plantilla
 *     solo le ahorra teclearlo. Bloquear aquí dejaría el mecanismo entero congelado por una fila de
 *     catálogo que no ha llegado — un funcionario no podría apartarse de un expediente en el que
 *     tiene conflicto de interés porque un `SELECT` falló.
 *
 *   Así que, con la plantilla caída: se avisa, el editor arranca vacío pero UTILIZABLE, y se puede
 *   enviar en cuanto el decisor escriba algo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-09-16 (D-03: fuera el input de archivo; entra la plantilla
 *   precargada en el editor, con su vista previa).
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: el caso lleva la materia en `expMateria`, la
 *   del expediente; la submateria del reparto decía otra cosa y el escrito no la leía)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 17 — D-17: la fila ya no trae la
 *   submateria del reparto; `expMateria` es la materia DEDUCIDA del código de las infracciones)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 14 — D-19: la excusa pide la clave de
 *   firma con el campo único, la manda solo por `excusar` y nunca por la vista previa, devuelve al
 *   campo tras un fallo de firma sin perder lo redactado y avisa si el escrito salió firmado).
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la clave rechazada solo en el estado
 *   E; los demás fallos se afirman en el aviso flotante y sin caja)
 */

import { errorDelServidor } from "../../test/errores";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { MiEpasAsignado } from "../../services/SorteoService";
import { resetModoDeFirmaCache } from "../../hooks/useClaveDeFirma";
// El FUENTE del modal, como texto (`?raw`, no `node:fs`): mismo patrón que PasoFirmaClave.test.tsx.
import fuenteDelModal from "./ModalExcusa.tsx?raw";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  causalesExcusa: vi.fn(),
  excusar: vi.fn(),
  vistaPreviaEscritoExcusa: vi.fn(),
  leerPlantilla: vi.fn(),
  useUser: vi.fn(),
  readModoDeFirma: vi.fn(),
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

// Fase 03.21: el hook de la clave lee el modo de firma por el export POR DEFECTO del servicio, así
// que se doblan los dos (el nombrado y el por defecto) con el mismo objeto.
vi.mock("../../services/SorteoService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../services/SorteoService")>();
  const dobles = {
    causalesExcusa: mocks.causalesExcusa,
    excusar: mocks.excusar,
    vistaPreviaEscritoExcusa: mocks.vistaPreviaEscritoExcusa,
    readModoDeFirma: mocks.readModoDeFirma,
  };
  return { ...real, default: dobles, SorteoService: dobles };
});

vi.mock("../../services/PlantillaService", () => ({
  PlantillaService: { leer: mocks.leerPlantilla },
}));

vi.mock("../../context/UserContext", () => ({
  useUser: mocks.useUser,
}));

/**
 * Doble del editor: un `<textarea>` con `data-testid`.
 *
 * Tiptap monta un ProseMirror sobre `contenteditable`, que en jsdom no se puede teclear de forma
 * fiable. Lo que se prueba aquí no es el editor —tiene su propio sitio— sino QUÉ VALOR RECIBE y QUÉ
 * PASA CUANDO CAMBIA, que es exactamente la superficie de este doble.
 *
 * 🔴 El doble respeta la propiedad de la que depende la regla de `editorTocado`: `onChange` SOLO se
 * dispara con edición humana. El `RichTextEditor` real lo garantiza usando
 * `setContent(value, { emitUpdate: false })` para los cambios externos (`RichTextEditor.tsx:73`); el
 * doble, siendo un input controlado que solo emite en `change`, se comporta igual.
 */
vi.mock("../providencia/RichTextEditor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (html: string) => void;
  }) => (
    <textarea
      data-testid="editor-escrito"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("../pdf/PDFViewer", () => ({
  PDFViewer: ({ document }: { document: { docUrl: string } }) => (
    <div data-testid="visor-pdf">{document.docUrl}</div>
  ),
}));

import ModalExcusa from "./ModalExcusa";

const CASO: MiEpasAsignado = {
  eejeId: 7,
  cassId: 555,
  eejeStatus: "SORTEADO",
  expNumber: "EPAS-001",
  administrado: "CARVAJAL VEGA DAYANA LIZBETH",
  cedula: "1755566054",
  // «en materia de {Materia}» lee la materia DEL EXPEDIENTE, que desde la Fase 03.23 (D-17) es la
  // DEDUCIDA por el servidor del código de sus infracciones: el nombre literal del diccionario CAT
  // v1.3. La submateria del reparto ya no viaja en la fila.
  expMateria: "LICENCIAMIENTO",
};

/** Las seis del catálogo, recortadas a dos: lo que se prueba es la regla, no la lista. */
const CAUSALES = [
  {
    codigo: "interes_personal_profesional",
    titulo: "Tener interés personal o profesional en el asunto.",
    orden: 1,
  },
  {
    codigo: "parentesco",
    titulo: "Ser pariente hasta el cuarto grado de consanguinidad.",
    orden: 3,
  },
];

/** La plantilla, recortada: lleva un token del expediente, la marca y el rótulo del SEGUNDO. */
const PLANTILLA = {
  clave: "ESCRITO_EXCUSA",
  nombre: "Escrito con que el funcionario decisor sustenta su excusa",
  html:
    "<p>Yo, {Decisor}, sobre el expediente {Expediente}.</p>\n" +
    "<p><strong>SEGUNDO.-</strong> Los hechos son: {Detalle}</p>\n" +
    "<p><strong>TERCERO.-</strong> Solicito la reasignación.</p>",
  activo: true,
};

/** Espeja el retardo del refresco del modal. */
const RETARDO_PREVIA_MS = 1500;

const montar = (onClose = vi.fn()) =>
  render(<ModalExcusa caseData={CASO} onClose={onClose} />);

const editor = () =>
  screen.getByTestId("editor-escrito") as HTMLTextAreaElement;

const detalle = () =>
  screen.getByPlaceholderText(/hecho concreto/i) as HTMLTextAreaElement;

const botonEnviar = () => screen.getByRole("button", { name: /enviar excusa/i });

const elegirCausal = (codigo: string) =>
  fireEvent.change(screen.getByRole("combobox"), { target: { value: codigo } });

/** Espera a que la plantilla esté cargada y compuesta en el editor. */
const esperarPlantilla = () =>
  waitFor(() => expect(editor().value).toContain("TERCERO"));

describe("ModalExcusa — el escrito se genera, no se sube (D-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.causalesExcusa.mockResolvedValue(CAUSALES);
    mocks.excusar.mockResolvedValue({});
    mocks.leerPlantilla.mockResolvedValue(PLANTILLA);
    mocks.vistaPreviaEscritoExcusa.mockResolvedValue("blob:borrador");
    mocks.useUser.mockReturnValue({
      user: { usuId: 42, usuFullName: "ANDRÉS MIÑO CARRERA" },
    });
    mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
    resetModoDeFirmaCache();
  });

  it("🔴 YA NO HAY input[type=file] en el DOM: el decisor no sube nada", async () => {
    // Es la aserción central del encargo (D-03). El helper `adjuntar()` que existía en este fichero
    // se fue con él.
    const { container } = montar();
    await esperarPlantilla();

    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it("la plantilla se PRECARGA en el editor con los tokens ya resueltos", async () => {
    montar();
    await esperarPlantilla();

    expect(mocks.leerPlantilla).toHaveBeenCalledWith("ESCRITO_EXCUSA");
    // El número de expediente del caso SE VE…
    expect(editor().value).toContain("EPAS-001");
    // …y el literal del token NO: un `{Expediente}` impreso en un acto administrativo es
    // exactamente lo que el mecanismo de tokens viene a evitar.
    expect(editor().value).not.toContain("{Expediente}");
    expect(editor().value).toContain("ANDRÉS MIÑO CARRERA");
  });

  it("la causal sigue SIN venir preseleccionada (regla vigente, no se toca)", async () => {
    montar();
    await esperarPlantilla();

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
    expect(botonEnviar()).toHaveProperty("disabled", true);
  });

  it("🔴 sin causal NO se puede enviar, por mucho escrito que haya", async () => {
    montar();
    await esperarPlantilla();

    expect(editor().value.length).toBeGreaterThan(0);
    expect(botonEnviar()).toHaveProperty("disabled", true);
  });

  it("🔴 con causal pero con el EDITOR VACÍO tampoco: sigue haciendo falta un escrito (acta del 28-08)", async () => {
    montar();
    await esperarPlantilla();
    elegirCausal("parentesco");

    expect(botonEnviar()).toHaveProperty("disabled", false);

    // Un Tiptap vacío sigue trayendo `<p></p>`: `tieneContenido` lo reconoce como vacío.
    fireEvent.change(editor(), { target: { value: "<p></p>" } });

    expect(botonEnviar()).toHaveProperty("disabled", true);
  });
});

describe("ModalExcusa — el hecho concreto se inserta en el escrito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.causalesExcusa.mockResolvedValue(CAUSALES);
    mocks.excusar.mockResolvedValue({});
    mocks.leerPlantilla.mockResolvedValue(PLANTILLA);
    mocks.vistaPreviaEscritoExcusa.mockResolvedValue("blob:borrador");
    mocks.useUser.mockReturnValue({
      user: { usuId: 42, usuFullName: "ANDRÉS MIÑO CARRERA" },
    });
    mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
    resetModoDeFirmaCache();
  });

  it("lo tecleado en el DETALLE aparece en el editor, y al borrarlo desaparece el SEGUNDO", async () => {
    montar();
    await esperarPlantilla();

    fireEvent.change(detalle(), { target: { value: "Es mi cuñado." } });
    await waitFor(() => expect(editor().value).toContain("Es mi cuñado."));
    expect(editor().value).toContain("SEGUNDO");

    // Al vaciar el detalle se va el PÁRRAFO ENTERO del SEGUNDO: ni rótulo huérfano ni relleno.
    fireEvent.change(detalle(), { target: { value: "" } });
    await waitFor(() => expect(editor().value).not.toContain("SEGUNDO"));
    expect(editor().value).toContain("TERCERO");
  });

  it("🔴 en cuanto se edita el EDITOR a mano, el detalle DEJA de pisarlo", async () => {
    // Es la regla de `editorTocado`, y es la que rompería un refactor descuidado del efecto de
    // recomposición. Sin ella, el decisor escribe su escrito, toca el detalle y ve cómo el sistema
    // le borra lo que acababa de redactar.
    montar();
    await esperarPlantilla();

    fireEvent.change(editor(), {
      target: { value: "<p>Lo escribo yo entero.</p>" },
    });
    fireEvent.change(detalle(), { target: { value: "Es mi cuñado." } });

    await waitFor(() => expect(detalle().value).toBe("Es mi cuñado."));
    // El editor conserva lo que escribió el decisor: la recomposición se detuvo.
    expect(editor().value).toBe("<p>Lo escribo yo entero.</p>");
  });

  it("🔴 `excusar` recibe el HTML DEL EDITOR, no el de la plantilla, cuando se ha editado", async () => {
    const onClose = vi.fn();
    montar(onClose);
    await esperarPlantilla();

    elegirCausal("parentesco");
    fireEvent.change(editor(), {
      target: { value: "<p>Mi propia redacción.</p>" },
    });
    fireEvent.click(botonEnviar());

    await waitFor(() => expect(mocks.excusar).toHaveBeenCalledTimes(1));
    expect(mocks.excusar).toHaveBeenCalledWith(
      555,
      "parentesco",
      "<p>Mi propia redacción.</p>",
      "",
      undefined,
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("el detalle acompaña a la causal y viaja recortado", async () => {
    montar();
    await esperarPlantilla();

    elegirCausal("interes_personal_profesional");
    fireEvent.change(detalle(), {
      target: { value: "  Asesoré a la empresa.  " },
    });
    await waitFor(() => expect(editor().value).toContain("Asesoré a la empresa."));

    fireEvent.click(botonEnviar());

    await waitFor(() =>
      expect(mocks.excusar).toHaveBeenCalledWith(
        555,
        "interes_personal_profesional",
        expect.stringContaining("Asesoré a la empresa."),
        "Asesoré a la empresa.",
        undefined,
      ),
    );
  });
});

describe("ModalExcusa — catálogos caídos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.causalesExcusa.mockResolvedValue(CAUSALES);
    mocks.excusar.mockResolvedValue({});
    mocks.leerPlantilla.mockResolvedValue(PLANTILLA);
    mocks.vistaPreviaEscritoExcusa.mockResolvedValue("blob:borrador");
    mocks.useUser.mockReturnValue({
      user: { usuId: 42, usuFullName: "ANDRÉS MIÑO CARRERA" },
    });
    mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
    resetModoDeFirmaCache();
  });

  it("🔴 si el CATÁLOGO DE CAUSALES no carga, el modal lo DICE y NO deja enviar a ciegas", async () => {
    mocks.causalesExcusa.mockRejectedValueOnce(new Error("backend caído"));
    montar();

    await waitFor(() =>
      expect(
        screen.getByText(/no se pudieron cargar las causales/i),
      ).toBeTruthy(),
    );

    expect(botonEnviar()).toHaveProperty("disabled", true);
    expect(mocks.excusar).not.toHaveBeenCalled();
  });

  it("🔴 si la PLANTILLA no carga, avisa pero el editor queda UTILIZABLE y SÍ se puede enviar", async () => {
    // Ver la cabecera del fichero: sin plantilla la excusa SÍ puede existir, porque el escrito es
    // texto del decisor. Bloquear aquí dejaría a un funcionario sin poder apartarse de un expediente
    // en el que tiene conflicto de interés porque un SELECT falló.
    mocks.leerPlantilla.mockRejectedValueOnce(new Error("404"));
    montar();

    await waitFor(() =>
      expect(
        screen.getByText(/no se pudo cargar la plantilla/i),
      ).toBeTruthy(),
    );

    elegirCausal("parentesco");
    // Editor vacío ⇒ todavía no se puede enviar…
    expect(botonEnviar()).toHaveProperty("disabled", true);

    // …pero en cuanto el decisor escribe, sí.
    fireEvent.change(editor(), { target: { value: "<p>Lo redacto yo.</p>" } });
    expect(botonEnviar()).toHaveProperty("disabled", false);

    fireEvent.click(botonEnviar());
    await waitFor(() =>
      expect(mocks.excusar).toHaveBeenCalledWith(
        555,
        "parentesco",
        "<p>Lo redacto yo.</p>",
        "",
        undefined,
      ),
    );
  });
});

describe("ModalExcusa — vista previa del borrador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.causalesExcusa.mockResolvedValue(CAUSALES);
    mocks.excusar.mockResolvedValue({});
    mocks.leerPlantilla.mockResolvedValue(PLANTILLA);
    mocks.vistaPreviaEscritoExcusa.mockResolvedValue("blob:borrador");
    mocks.useUser.mockReturnValue({
      user: { usuId: 42, usuFullName: "ANDRÉS MIÑO CARRERA" },
    });
    mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
    resetModoDeFirmaCache();
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("«Ver borrador» abre el panel y pide el PDF con el HTML del editor", async () => {
    vi.useFakeTimers();
    try {
      montar();
      await vi.waitFor(() => expect(editor().value).toContain("TERCERO"));

      fireEvent.click(screen.getByRole("button", { name: /ver borrador/i }));
      // El refresco va con retardo: no se pide un PDF por pulsación.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RETARDO_PREVIA_MS + 500);
      });

      expect(mocks.vistaPreviaEscritoExcusa).toHaveBeenCalledWith(
        555,
        expect.stringContaining("TERCERO"),
        expect.any(AbortSignal),
      );
      expect(screen.getByTestId("visor-pdf").textContent).toBe("blob:borrador");
    } finally {
      vi.useRealTimers();
    }
  });

  it("🔴 si el refresco falla, el borrador anterior SE QUEDA y se avisa de que está desfasado", async () => {
    // Vaciar la pantalla por un fallo pasajero —o porque el texto está a medio escribir— castigaría
    // al que redacta. Callarlo sería peor: creería estar viendo lo último que escribió.
    vi.useFakeTimers();
    try {
      montar();
      await vi.waitFor(() => expect(editor().value).toContain("TERCERO"));

      fireEvent.click(screen.getByRole("button", { name: /ver borrador/i }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RETARDO_PREVIA_MS + 500);
      });
      expect(screen.getByTestId("visor-pdf")).toBeTruthy();

      mocks.vistaPreviaEscritoExcusa.mockRejectedValueOnce(
        errorDelServidor("El escrito está vacío."),
      );
      fireEvent.change(editor(), { target: { value: "<p>Otra cosa</p>" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RETARDO_PREVIA_MS + 500);
      });

      // El visor sigue mostrando el borrador anterior…
      expect(screen.getByTestId("visor-pdf").textContent).toBe("blob:borrador");
      // …y el aviso lo dice, con el motivo real del servidor.
      expect(screen.getByText(/El escrito está vacío/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * FASE 03.21, D-19 — EL ESCRITO DE EXCUSA SE FIRMA CON LA CLAVE DEL DECISOR.
 *
 * Los textos se escriben A MANO (UI-SPEC §10): importarlos del catálogo convertiría cada aserción en
 * una tautología. La clave de las pruebas es un valor ficticio, reconocible si se escapara.
 */
const AVISO_SIN_FIRMADOR_EXCUSA =
  "La firma digital está desactivada en este despliegue: el escrito de excusa se presentará SIN firma criptográfica.";
const AVISO_SIN_SESION_CENTRAL =
  "Para firmar hay que entrar al sistema con el Auth central, y su sesión actual no lo está. Cierre sesión y vuelva a entrar por el Auth central. Mientras tanto no se puede emitir nada que lleve firma.";
const TEXTO_CLAVE_INCORRECTA_SERVIDOR =
  "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.";
const CLAVE_FICTICIA = "clave-ficticia-de-prueba";

describe("ModalExcusa — la clave de firma (Fase 03.21, D-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
    mocks.causalesExcusa.mockResolvedValue(CAUSALES);
    mocks.excusar.mockResolvedValue({ escritoFirmado: false });
    mocks.leerPlantilla.mockResolvedValue(PLANTILLA);
    mocks.vistaPreviaEscritoExcusa.mockResolvedValue("blob:borrador");
    mocks.useUser.mockReturnValue({
      user: { usuId: 42, usuFullName: "ANDRÉS MIÑO CARRERA" },
    });
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  const encendido = (sesionCentral: boolean | undefined = true) =>
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      ...(sesionCentral === undefined ? {} : { sesionCentral }),
    });

  const campoClave = () =>
    screen.getByLabelText("Clave de firma") as HTMLInputElement;

  /** Monta con el firmador ENCENDIDO, espera el campo y deja la causal elegida. */
  const montarEncendido = async (onClose = vi.fn()) => {
    encendido();
    montar(onClose);
    await esperarPlantilla();
    await screen.findByLabelText("Clave de firma");
    elegirCausal("parentesco");
    return onClose;
  };

  it("si la excusa se presentó y lo que falla es refrescar la bandeja, NO se pinta como fallo del envío (revisión 03.21, WR-03)", async () => {
    mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
    const onClose = vi.fn();
    const refetchFn = vi.fn().mockRejectedValue(new Error("bandeja caída"));
    render(<ModalExcusa caseData={CASO} onClose={onClose} refetchFn={refetchFn} />);
    await esperarPlantilla();
    elegirCausal("parentesco");
    await waitFor(() => expect(botonEnviar()).toHaveProperty("disabled", false));

    fireEvent.click(botonEnviar());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.excusar).toHaveBeenCalledTimes(1);
    expect(mocks.addToast).toHaveBeenCalledWith(
      "success",
      "Excusa presentada. El escrito quedó SIN firma criptográfica.",
    );
    expect(mocks.addToast).toHaveBeenCalledWith(
      "info",
      "Quedó hecho, pero no se pudo actualizar la lista. Actualícela antes de repetir nada.",
    );
    expect(screen.queryByText(/No se pudo enviar la solicitud de excusa/)).toBeNull();
  });

  it("APAGADO: avisa que el escrito saldrá SIN firma, no pide clave, y el éxito lo dice", async () => {
    mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
    const onClose = vi.fn();
    montar(onClose);
    await esperarPlantilla();

    await waitFor(() => expect(mocks.readModoDeFirma).toHaveBeenCalled());
    expect(screen.getByText(AVISO_SIN_FIRMADOR_EXCUSA)).toBeTruthy();
    expect(screen.queryByLabelText("Clave de firma")).toBeNull();

    elegirCausal("parentesco");
    // El botón depende solo de las reglas de siempre.
    expect(botonEnviar()).toHaveProperty("disabled", false);
    fireEvent.click(botonEnviar());

    await waitFor(() => expect(mocks.excusar).toHaveBeenCalledTimes(1));
    expect(mocks.excusar.mock.calls[0][4]).toBeUndefined();
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Excusa presentada. El escrito quedó SIN firma criptográfica.",
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("ENCENDIDO: el campo está ENCIMA de las acciones y, sin clave, «Enviar excusa» se apaga", async () => {
    await montarEncendido();

    const campo = campoClave();
    expect(campo.type).toBe("password");
    // Encima de la fila de acciones: el último dato antes del botón que presenta.
    const acciones = document.querySelector(".app-modules-modal-actions")!;
    expect(
      campo.compareDocumentPosition(acciones) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Después del escrito.
    expect(
      editor().compareDocumentPosition(campo) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(botonEnviar()).toHaveProperty("disabled", true);
    fireEvent.change(campo, { target: { value: CLAVE_FICTICIA } });
    expect(botonEnviar()).toHaveProperty("disabled", false);
  });

  it("ENCENDIDO: la clave viaja como QUINTO argumento de `excusar`, el éxito dice «firmado» y la clave se borra", async () => {
    mocks.excusar.mockResolvedValue({ escritoFirmado: true });
    const onClose = await montarEncendido();

    fireEvent.change(campoClave(), { target: { value: CLAVE_FICTICIA } });
    fireEvent.click(botonEnviar());

    await waitFor(() => expect(mocks.excusar).toHaveBeenCalledTimes(1));
    expect(mocks.excusar).toHaveBeenCalledWith(
      555,
      "parentesco",
      expect.stringContaining("TERCERO"),
      "",
      CLAVE_FICTICIA,
    );
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Excusa presentada con el escrito firmado.",
      ),
    );
    expect(onClose).toHaveBeenCalled();
    // Ningún aviso lleva la clave.
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toContain(
      CLAVE_FICTICIA,
    );
    await waitFor(() => expect(campoClave().value).toBe(""));
  });

  it("ENCENDIDO SIN SESIÓN CENTRAL (estado C): aviso, ningún campo y el botón apagado", async () => {
    encendido(false);
    montar();
    await esperarPlantilla();

    await screen.findByText(AVISO_SIN_SESION_CENTRAL);
    expect(screen.queryByLabelText("Clave de firma")).toBeNull();
    elegirCausal("parentesco");
    expect(botonEnviar()).toHaveProperty("disabled", true);
  });

  it("🔴 CLAVE INCORRECTA: SOLO el estado E —el modal sigue abierto, lo redactado se conserva y el campo vuelve vacío, marcado y con el foco—, sin caja ni aviso flotante (UAT 03.21, hueco 2)", async () => {
    mocks.excusar.mockRejectedValue(
      errorDelServidor(
        TEXTO_CLAVE_INCORRECTA_SERVIDOR,
        422,
        "APP-FIRMA-CLAVE-001",
      ),
    );
    const onClose = await montarEncendido();
    fireEvent.change(editor(), {
      target: { value: "<p>Mi propia redacción.</p>" },
    });
    fireEvent.change(campoClave(), { target: { value: CLAVE_FICTICIA } });
    fireEvent.click(botonEnviar());

    await waitFor(() =>
      expect(campoClave().getAttribute("aria-invalid")).toBe("true"),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
    expect(screen.queryByText(/No se presentó la excusa\./)).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
    // Lo redactado y la causal siguen ahí.
    expect(editor().value).toBe("<p>Mi propia redacción.</p>");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "parentesco",
    );
    // Estado E: vacío, marcado, con su línea y con el foco.
    const campo = campoClave();
    expect(campo.value).toBe("");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("La clave de firma no es correcta.")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(campo));
    // Y el aviso no repite la clave.
    expect(document.body.textContent).not.toContain(CLAVE_FICTICIA);

    // Escribir de nuevo retira el estado E.
    fireEvent.change(campo, { target: { value: "otra" } });
    expect(campo.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByText("La clave de firma no es correcta.")).toBeNull();
  });

  it("otro fallo de firma (el firmador no responde): la consecuencia + el texto del servidor, sin marcar el campo", async () => {
    mocks.excusar.mockRejectedValue(
      errorDelServidor(
        "El servicio de firma no responde. Inténtelo de nuevo en unos minutos.",
        503,
        "APP-FIRMA-NO-RESPONDE-001",
      ),
    );
    const onClose = await montarEncendido();
    fireEvent.change(campoClave(), { target: { value: CLAVE_FICTICIA } });
    fireEvent.click(botonEnviar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(
          /^No se presentó la excusa\. El servicio de firma no responde\./,
        ),
      ),
    );
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/No se presentó la excusa\./)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(campoClave().getAttribute("aria-invalid")).toBeNull();
    // La clave se borra también tras el error (UI-SPEC §2.3, regla 2).
    expect(campoClave().value).toBe("");
  });

  it("un fallo que NO es de firma conserva la conducta de antes (sin la consecuencia delante)", async () => {
    mocks.excusar.mockRejectedValue(
      errorDelServidor("Ya hay una excusa pendiente para este caso."),
    );
    await montarEncendido();
    fireEvent.change(campoClave(), { target: { value: CLAVE_FICTICIA } });
    fireEvent.click(botonEnviar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "Ya hay una excusa pendiente para este caso.",
      ),
    );
    expect(screen.queryByText("Ya hay una excusa pendiente para este caso.")).toBeNull();
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toMatch(/No se presentó la excusa\./);
  });

  it("🔴 D-16 — la vista previa del escrito NUNCA recibe la clave", async () => {
    encendido();
    vi.useFakeTimers();
    try {
      montar();
      await vi.waitFor(() => expect(editor().value).toContain("TERCERO"));
      await vi.waitFor(() =>
        expect(screen.getByLabelText("Clave de firma")).toBeTruthy(),
      );
      fireEvent.change(campoClave(), { target: { value: CLAVE_FICTICIA } });

      fireEvent.click(screen.getByRole("button", { name: /ver borrador/i }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RETARDO_PREVIA_MS + 500);
      });

      expect(mocks.vistaPreviaEscritoExcusa).toHaveBeenCalled();
      for (const llamada of mocks.vistaPreviaEscritoExcusa.mock.calls) {
        expect(llamada).toHaveLength(3);
        expect(llamada[0]).toBe(555);
        expect(typeof llamada[1]).toBe("string");
        expect(llamada[2]).toBeInstanceOf(AbortSignal);
        expect(String(llamada[1])).not.toContain(CLAVE_FICTICIA);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("🔴 D-16 — el fuente del modal no escribe en consola, almacenamiento, cookie ni URL", () => {
    for (const via of [
      "console.",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "window.location",
    ]) {
      expect(fuenteDelModal).not.toContain(via);
    }
  });
});
