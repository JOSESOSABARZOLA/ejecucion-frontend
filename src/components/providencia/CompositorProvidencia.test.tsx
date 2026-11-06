/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend) — tests
 * Archivo: CompositorProvidencia.test.tsx
 * Responsabilidad: La aserción viva de D-03 — que la extracción del cuerpo NO cambió lo que se
 *   envía, y que el cuerpo extraído sabe vivir fuera de un modal.
 *
 *   ── 🔴 LA PRUEBA QUE SOSTIENE LA FASE ────────────────────────────────────────────────────────
 *   En la rama de Resolución el editor es DECORATIVO: el HTML se aplana a texto plano antes de
 *   armar el PDF. Aquí el HTML viaja ENTERO al backend y `richtext-a-pdfmake` lo traduce a nodos,
 *   así que la negrita y las listas que el decisor marca SE IMPRIMEN en el acto administrativo.
 *   Portar la página de la rama —o «homologar» este compositor con el de allí— emitiría
 *   providencias sin formato, y el compilador no diría absolutamente nada. Por eso el caso de abajo
 *   redacta con negrita, lista y acentos, y mira LO QUE SE ENVÍA.
 *
 *   Y por eso el texto no se teclea a mano: se carga por el borrador del tipo y se hace pasar por el
 *   editor de verdad (insertando un token), que es el viaje que podría perder detalle. Una prueba
 *   que afirmara sobre una cadena que nunca entró en Tiptap no probaría nada de esto.
 *
 *   ── LO DEMÁS QUE SE FIJA AQUÍ ────────────────────────────────────────────────────────────────
 *     · El cuerpo se monta SIN elemento de diálogo nativo: es la condición que la página impone.
 *     · Los pasos ocultos se OCULTAN, no se desmontan (UI-SPEC §4.2).
 *     · La barra de acciones se puede sustituir sin duplicar el cuerpo, y el contrato que recibe
 *       (`puedeEmitir`, `pedirConfirmacion`) basta para emitir desde una página.
 *     · La URL del borrador se suelta AL DESMONTAR, que es como se sale de una página.
 *     · El HTML redactado no se pinta en ningún sitio nuevo (T-03.19-20).
 *     · (quick 261006-dw9, UAT 03.15 paso 8) Con un tipo que exige prueba y sin ella en el
 *       expediente, el compositor PUBLICA qué hay que adjuntar (`motivoPrueba`) y dice por qué no se
 *       puede emitir (`motivosNoEmitir`); si la prueba consta, no bloquea; y `puedeEmitir` equivale
 *       SIEMPRE a «sin motivos y sin emitir». Los textos van escritos a mano, no importados.
 *     · (quick 261006-el5) SIN la prop `autoguardado` —el modal heredado— el compositor no lee, no
 *       guarda y no descarta ningún borrador en el servidor (DP-16).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-el5 — el doble gana leer/guardar/descartar
 *   borrador y la prueba del modal heredado).
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 13 — D-04/D-06/D-13: el compositor ya
 *   no ofrece la declaración manual de aptitud ni la manda; con un tipo que autoriza el TC pide la
 *   ficha de infracciones, sus motivos de bloqueo entran en «Qué falta para emitir» y, si es APTA,
 *   enseña de solo lectura qué infracciones entran y cuáles no. El doble gana `InfraccionesService`.)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: los fallos de la emisión se afirman
 *   en el aviso flotante; ConfirmationDetail ya no los pinta en una caja)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: la ficha de prueba con los campos de
 *   materia de Sorteo —ids, `sinMateria`, `infraccionesSinMateria`—)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cc7: el SBU lo escribe el ejecutor. Con un
 *   tipo que autoriza el TC, el estado del TC trae `sbuParametro: 460` y se fija que el campo sale
 *   VACÍO con la referencia en «$ 460,00», que «470,75» viaja como 470.75 a emitir y a la vista
 *   previa, que «470.75» se rechaza bajo el campo y que el doble de la referencia avisa sin bloquear;
 *   los casos que emiten el tipo que autoriza escriben antes un SBU)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq: los importes se afirman con
 *   `formatearUsd`; la referencia del SBU se lee «Valor en Parámetros: USD 460,00». Un `describe`
 *   fija la «Multa impuesta (USD)» de la cabecera: «2.300,50» viaja como 2300.5 y «2300.50» bloquea)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-ma6: un `describe` fija la propuesta de las
 *   horas de la resolución en «Horas fijadas por el acto administrativo»: una sola vez, con su línea
 *   de referencia, borrable, y nunca con el TC ya autorizado o sin horas)
 * Modificado por: Andrés Miño — 2026-11-06 (quick 261106-bo0: las infracciones de la ficha de prueba
 *   llevan la base legal, en null)
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { crearMiEpasAsignado } from "../../test/fixtures/miEpasAsignado";
import type {
  EmitirProvidenciaPayload,
  TipoProvidenciaDisponible,
} from "../../services/ProvidenciaService";
import type { FichaInfracciones } from "../../services/InfraccionesService";
import { formatearUsd } from "../../utils/importe.util";
import { MARCADOR_CUADRO } from "../../config/providenciaComposicion";

const mocks = vi.hoisted(() => ({
  tipos: vi.fn(),
  emitir: vi.fn(),
  vistaPrevia: vi.fn(),
  addToast: vi.fn(),
  estadoPago: vi.fn(),
  estadoTc: vi.fn(),
  leerBorrador: vi.fn(),
  guardarBorrador: vi.fn(),
  descartarBorrador: vi.fn(),
  fichaInfracciones: vi.fn(),
}));

vi.mock("../../services/ProvidenciaService", () => ({
  ProvidenciaService: {
    tipos: mocks.tipos,
    emitir: mocks.emitir,
    vistaPrevia: mocks.vistaPrevia,
    leerBorrador: mocks.leerBorrador,
    guardarBorrador: mocks.guardarBorrador,
    descartarBorrador: mocks.descartarBorrador,
  },
  ETIQUETA_ACCION_EPAS: {} as Record<string, string>,
}));
vi.mock("../../services/PagoService", () => ({
  PagoService: { estado: mocks.estadoPago },
}));
vi.mock("../../services/TrabajoComunitarioService", () => ({
  TrabajoComunitarioService: { estado: mocks.estadoTc },
  SUBIDA_TIMEOUT_MS: 60000,
}));
// Fase 03.23: parcial — se dobla solo el objeto del servicio; los tipos y constantes, reales.
vi.mock("../../services/InfraccionesService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../services/InfraccionesService")>();
  const doble = { ...real.InfraccionesService, ficha: mocks.fichaInfracciones };
  return { ...real, InfraccionesService: doble, default: doble };
});
vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));
// El visor arrastra `react-pdf`, que en jsdom revienta al cargarse («DOMMatrix is not defined»).
vi.mock("../pdf/PDFViewer", () => ({ PDFViewer: () => null }));
// Pide sus propias órdenes de pago al montarse; nada que ver con lo que se prueba aquí.
vi.mock("../ordenes-pago/OrdenesPagoCabecera", () => ({ default: () => null }));

import CompositorProvidencia, {
  type AccionesCompositor,
  type EstadoCompositor,
} from "./CompositorProvidencia";

/**
 * Relleno de geometría para jsdom: Tiptap mide dónde cae el cursor (`Range.getClientRects`) y jsdom
 * no implementa la geometría de `Range`. Mismo apaño, y por lo mismo, que en `RichTextEditor.test.tsx`.
 */
const rectanguloNulo = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
} as DOMRect;
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () =>
    Object.assign([], { item: () => null }) as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => rectanguloNulo;
}

/**
 * EL CUERPO DE PRUEBA: negrita, lista y acentos.
 *
 * Los tres, y no un párrafo suelto, porque son las tres cosas distintas que un aplanado se lleva
 * por delante — la marca, la estructura y la codificación.
 */
const CUERPO_CON_FORMATO =
  "<p><strong>Negrita</strong> con acentuación</p>" +
  "<ul><li>Primer ítem</li><li>Segundo ítem</li></ul>";

const TIPO: TipoProvidenciaDisponible = {
  codigo: "PROVIDENCIA_DE_IMPULSO",
  nombre: "Providencia de impulso",
  activo: true,
  disponible: true,
  borrador: CUERPO_CON_FORMATO,
};

const caso = crearMiEpasAsignado();

/** La etiqueta del campo SBU (quick 261105-cc7), escrita a mano: no se importa del componente. */
const ETIQUETA_SBU =
  "SBU con el que se calcula el trabajo comunitario (en dólares)";

/**
 * La clase con la que se OCULTA un paso sin desmontarlo (UI-SPEC §4.2).
 *
 * Era la utilidad `hidden` cuando el plan 12 escribió estas pruebas, porque su CSS todavía no
 * existía (pendiente §30). El plan 13 lo portó —`administration-docs-generate-page.css`— y el
 * sustituto se retiró. Lo que se afirma no ha cambiado ni un ápice: un paso oculto sigue EN EL
 * DOCUMENTO, y uno visible no cuelga de nada oculto.
 */
const OCULTO = ".app-modules-docs-page-step-hidden";

/** El HTML del cuerpo tal y como salió hacia el backend. */
const cuerpoEnviado = (): string | undefined => {
  const payload = mocks.emitir.mock.calls[0][0] as EmitirProvidenciaPayload;
  return payload.secciones.find((s) => s.clave === "cuerpo")?.html;
};

/**
 * Elige el tipo y hace pasar el texto POR EL EDITOR insertando un token.
 *
 * Elegir el tipo solo precarga la cadena en el estado; es la inserción la que dispara `onUpdate` de
 * Tiptap y devuelve el HTML que el editor produce de verdad. Sin este paso, la prueba afirmaría
 * sobre una cadena que nunca vio ProseMirror.
 */
const redactarPasandoPorElEditor = async () => {
  fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
    target: { value: TIPO.codigo },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Expediente" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Emitir providencia" }),
    ).toBeEnabled(),
  );
};

describe("CompositorProvidencia — el cuerpo extraído (D-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tipos.mockResolvedValue([TIPO]);
    mocks.vistaPrevia.mockResolvedValue("blob:borrador");
    mocks.emitir.mockResolvedValue({
      docId: 1,
      docName: "p.pdf",
      docUrl: "/api/fileserver/ejecucion/providencias/2026/10/p.pdf",
      paginas: 1,
      tipoCodigo: TIPO.codigo,
      accionEpasAplicada: null,
    });
    mocks.estadoPago.mockRejectedValue(new Error("sin pago"));
    mocks.estadoTc.mockRejectedValue(new Error("sin trabajo comunitario"));
    globalThis.URL.createObjectURL = vi.fn(() => "blob:borrador");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("🔴 el payload conserva la NEGRITA, la LISTA y los acentos: el HTML no se aplana", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );
    await redactarPasandoPorElEditor();

    fireEvent.click(screen.getByRole("button", { name: "Emitir providencia" }));
    fireEvent.click(await screen.findByRole("button", { name: "Emitir" }));
    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));

    const cuerpo = cuerpoEnviado();
    expect(cuerpo).toContain("<strong>");
    expect(cuerpo).toContain("Negrita");
    // La lista sobrevive ENTERA: el contenedor y sus elementos. Un aplanado dejaría el texto y se
    // llevaría la estructura, que en el PDF es la diferencia entre una lista y un párrafo corrido.
    expect(cuerpo).toContain("<ul>");
    expect(cuerpo).toContain("<li>");
    expect(cuerpo).toContain("Primer ítem");
    expect(cuerpo).toContain("Segundo ítem");
    expect(cuerpo).toContain("acentuación");
  });

  it("los tokens del expediente se siguen resolviendo antes de enviar", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );
    await redactarPasandoPorElEditor();

    fireEvent.click(screen.getByRole("button", { name: "Emitir providencia" }));
    fireEvent.click(await screen.findByRole("button", { name: "Emitir" }));
    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));

    // Al backend llega el VALOR, no el marcador: el token se resolvió por el camino.
    expect(cuerpoEnviado()).toContain(caso.expNumber!);
    expect(cuerpoEnviado()).not.toContain("{Expediente}");
  });

  it("🔴 se monta SIN ningún elemento de diálogo nativo, ni siquiera al confirmar", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );
    await redactarPasandoPorElEditor();
    expect(document.querySelector("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Emitir providencia" }));

    expect(
      await screen.findByText("Emitir la providencia"),
    ).toBeInTheDocument();
    // Es la condición que la PÁGINA impone: allí no hay un primer diálogo del que colgar.
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("los pasos ocultos se OCULTAN, no se desmontan (UI-SPEC §4.2)", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
        paso={1}
      />,
    );

    const selector = await screen.findByLabelText("Tipo de providencia");
    expect(selector.closest(OCULTO)).toBeNull();

    // El paso 2 sigue EN EL DOCUMENTO —solo que oculto—: desmontarlo perdería lo redactado al
    // volver atrás, que es el modo de fallo que UI-SPEC §4.2 prohíbe.
    const etiquetaCuerpo = screen.getByText("Cuerpo de la providencia");
    expect(etiquetaCuerpo).toBeInTheDocument();
    expect(etiquetaCuerpo.closest(OCULTO)).not.toBeNull();
  });

  it("sin `paso` se ve todo: es el caso del modal, y no cambia", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );

    expect(
      (await screen.findByLabelText("Tipo de providencia")).closest(OCULTO),
    ).toBeNull();
    expect(
      screen.getByText("Cuerpo de la providencia").closest(OCULTO),
    ).toBeNull();
  });

  it("`renderBarraAcciones` sustituye la barra sin duplicar el cuerpo", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
        renderBarraAcciones={(acciones: AccionesCompositor) => (
          <button
            type="button"
            disabled={!acciones.puedeEmitir}
            onClick={acciones.pedirConfirmacion}
          >
            Generar documento
          </button>
        )}
      />,
    );

    // La de siempre desaparece; la de la página manda.
    expect(
      screen.queryByRole("button", { name: "Emitir providencia" }),
    ).toBeNull();
    fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
      target: { value: TIPO.codigo },
    });

    const generar = await screen.findByRole("button", {
      name: "Generar documento",
    });
    await waitFor(() => expect(generar).toBeEnabled());
    fireEvent.click(generar);

    expect(
      await screen.findByText("Emitir la providencia"),
    ).toBeInTheDocument();
  });

  it("🔴 suelta la URL del borrador AL DESMONTAR (de una página se sale con «atrás»)", async () => {
    mocks.vistaPrevia.mockResolvedValue("blob:borrador-retenido");
    const { unmount } = render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
      target: { value: TIPO.codigo },
    });

    // El refresco automático espera 1,5 s a que se deje de escribir.
    await waitFor(() => expect(mocks.vistaPrevia).toHaveBeenCalled(), {
      timeout: 4000,
    });
    await waitFor(() =>
      expect(screen.queryByText("Armando el borrador…")).toBeNull(),
    );

    unmount();

    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:borrador-retenido",
    );
  });

  it("🔴 el HTML redactado solo se pinta DENTRO del editor (T-03.19-20)", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );
    await redactarPasandoPorElEditor();

    // La extracción no abrió ningún camino nuevo para HTML de usuario: la negrita redactada existe
    // en el documento UNA sola vez, dentro de la superficie de Tiptap. Si alguien pintara el cuerpo
    // en un panel propio inyectando HTML, aparecería también fuera.
    const negritas = Array.from(document.querySelectorAll("strong")).filter(
      (n) => n.textContent === "Negrita",
    );
    expect(negritas.length).toBe(1);
    expect(negritas[0].closest(".app-rich-editor-content")).not.toBeNull();
  });
});

/**
 * El tipo 3: exige el comprobante del pago de la multa. Lleva el MISMO borrador que el de impulso
 * para que el cuerpo no sea lo que falta: aquí solo se mira la prueba.
 */
const TIPO_PAGO: TipoProvidenciaDisponible = {
  codigo: "ARCHIVO_POR_PAGO_O_CONVENIO_DE_PAGO",
  nombre: "Archivo por pago o convenio de pago",
  activo: true,
  disponible: true,
  borrador: CUERPO_CON_FORMATO,
};

/** Textos del contrato, ESCRITOS A MANO: si el componente los cambia, esta prueba tiene que saberlo. */
const MOTIVO_COMPROBANTE =
  "Adjunte el comprobante del pago de la multa, con su fecha y su número de transacción, para continuar.";
const FALTA_COMPROBANTE =
  "Falta el comprobante del pago de la multa, con su fecha y su número de transacción.";
const FALTA_TIPO = "Falta elegir el tipo de providencia.";

describe("CompositorProvidencia — la prueba exigida y los motivos de no emitir (quick 261006-dw9)", () => {
  /** Cada `acciones` que la barra recibió, en orden. La última es la que está en pantalla. */
  let capturadas: AccionesCompositor[];
  let onEstado: Mock<(estado: EstadoCompositor) => void>;

  const ultimaAccion = (): AccionesCompositor =>
    capturadas[capturadas.length - 1];
  const ultimoEstado = (): EstadoCompositor | undefined =>
    onEstado.mock.calls[onEstado.mock.calls.length - 1]?.[0];

  const montar = () =>
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
        onEstado={onEstado}
        renderBarraAcciones={(acciones: AccionesCompositor) => {
          capturadas.push(acciones);
          return null;
        }}
      />,
    );

  const elegir = async (codigo: string) =>
    fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
      target: { value: codigo },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    capturadas = [];
    onEstado = vi.fn<(estado: EstadoCompositor) => void>();
    mocks.tipos.mockResolvedValue([TIPO, TIPO_PAGO]);
    mocks.vistaPrevia.mockResolvedValue("blob:borrador");
    mocks.estadoPago.mockRejectedValue(new Error("sin pago"));
    mocks.estadoTc.mockRejectedValue(new Error("sin trabajo comunitario"));
    globalThis.URL.createObjectURL = vi.fn(() => "blob:borrador");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("🔴 con el tipo 3 y sin comprobante en el expediente, publica qué hay que adjuntar y no deja emitir", async () => {
    montar();
    await elegir(TIPO_PAGO.codigo);

    await waitFor(() =>
      expect(ultimoEstado()?.motivoPrueba).toBe(MOTIVO_COMPROBANTE),
    );
    expect(ultimaAccion().puedeEmitir).toBe(false);
    expect(ultimaAccion().motivosNoEmitir).toContainEqual({
      paso: 1,
      texto: FALTA_COMPROBANTE,
    });
  });

  it("al aportar PDF + fecha + transacción, el motivo desaparece y se puede emitir", async () => {
    montar();
    await elegir(TIPO_PAGO.codigo);
    await waitFor(() =>
      expect(ultimoEstado()?.motivoPrueba).toBe(MOTIVO_COMPROBANTE),
    );

    fireEvent.change(screen.getByLabelText("Fecha del pago"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(screen.getByLabelText("Nro. de transacción"), {
      target: { value: "TX-0001" },
    });
    fireEvent.change(screen.getByLabelText(/Comprobante \(PDF/), {
      target: {
        files: [
          new File(["%PDF-1.4"], "comprobante.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    await waitFor(() => expect(ultimoEstado()?.motivoPrueba).toBeUndefined());
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));
    expect(ultimaAccion().motivosNoEmitir).toEqual([]);
  });

  it("si la prueba YA CONSTA, se cita y no bloquea nada", async () => {
    mocks.estadoPago.mockResolvedValue({
      eejeId: caso.eejeId,
      eejeStatus: "EN_VERIFICACION_PAGO",
      pagoAt: "2026-09-01",
      transaccion: "TX-0001",
      pagoDocId: 5,
    });
    montar();
    await elegir(TIPO_PAGO.codigo);

    expect(
      await screen.findByText(/Ya consta en el expediente/),
    ).toBeInTheDocument();
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));
    expect(ultimoEstado()?.motivoPrueba).toBeUndefined();
    expect(ultimaAccion().motivosNoEmitir).toEqual([]);
  });

  it("🔴 `puedeEmitir` equivale a «sin motivos y sin emitir»; sin tipo, el motivo lo dice", async () => {
    montar();
    await screen.findByLabelText("Tipo de providencia");
    // Desde aquí el catálogo está cargado: lo de antes es el «cargando», que no es un motivo.
    const desde = capturadas.length - 1;

    await waitFor(() =>
      expect(ultimaAccion().motivosNoEmitir).toContainEqual({
        paso: 1,
        texto: FALTA_TIPO,
      }),
    );
    expect(ultimaAccion().puedeEmitir).toBe(false);

    await elegir(TIPO.codigo);
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));

    for (const a of capturadas.slice(desde)) {
      expect(a.puedeEmitir).toBe(
        (a.motivosNoEmitir ?? []).length === 0 && !a.emitiendo,
      );
    }
  });
});

describe("CompositorProvidencia — el modal heredado no autoguarda (quick 261006-el5, DP-16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tipos.mockResolvedValue([TIPO]);
    mocks.vistaPrevia.mockResolvedValue("blob:borrador");
    mocks.estadoPago.mockRejectedValue(new Error("sin pago"));
    mocks.estadoTc.mockRejectedValue(new Error("sin trabajo comunitario"));
    globalThis.URL.createObjectURL = vi.fn(() => "blob:borrador");
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("🔴 sin la prop autoguardado no lee, no guarda y no descarta aunque se elija un tipo y pasen 5 s", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
      target: { value: TIPO.codigo },
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mocks.leerBorrador).not.toHaveBeenCalled();
    expect(mocks.guardarBorrador).not.toHaveBeenCalled();
    expect(mocks.descartarBorrador).not.toHaveBeenCalled();
    // Y no pinta nada del guardado: el modal no tiene borrador en el servidor.
    expect(screen.queryByText(/Borrador guardado|Cambios sin guardar/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Descartar borrador" }),
    ).toBeNull();
  });
});

/**
 * Fase 03.23 (D-04, D-06, D-13): el trabajo comunitario lo decide la INFRACCIÓN en CORE.
 *
 * 🔴 Lo que se fija:
 *   · La casilla de la declaración manual ya no existe y el payload no lleva ninguna clave de
 *     aptitud (el backend la rechazaría con 400). Se afirma por PREFIJO de clave —`aptitud…`— para
 *     que la prueba no nombre el campo retirado.
 *   · Con un tipo que NO autoriza TC no se pide la ficha: pedirla refresca CORE (D-08).
 *   · Con un tipo que lo autoriza: BLOQUEADA ⇒ cada motivo del servidor en «Qué falta para emitir»
 *     (paso 1) y no se emite; APTA ⇒ el desglose de solo lectura y lo compensable; cargando o con la
 *     red caída tampoco se emite a ciegas.
 */
describe("CompositorProvidencia — el TC lo decide la infracción (Fase 03.23, D-04/D-06/D-13)", () => {
  /** Un tipo que AUTORIZA trabajo comunitario: es lo único que enciende la consulta de la ficha. */
  const TIPO_TC: TipoProvidenciaDisponible = {
    codigo: "TRABAJO_COMUNITARIO",
    nombre: "Trabajo comunitario",
    activo: true,
    disponible: true,
    borrador: CUERPO_CON_FORMATO,
    accionEpas: "INICIAR_TRABAJO_COMUNITARIO",
  };

  /** Ficha APTA: una infracción entra al TC y otra queda fuera por ser el administrado sociedad. */
  const fichaApta = (
    over: Partial<FichaInfracciones> = {},
  ): FichaInfracciones => ({
    eejeId: caso.eejeId!,
    estadoCore: "LEIDO",
    coreLeidoAt: "2026-10-15T15:30:00.000Z",
    coreDisponible: true,
    materia: "LICENCIAMIENTO",
    submaterias: ["LUAE"],
    infraccionesSinMateria: 0,
    tipoPersona: "NATURAL",
    avisoIdentificacion: null,
    multaTotal: 1380,
    sumaMultas: 1380,
    infracciones: [
      {
        codigo: "LIC-LU-X-124-1947A-02",
        materia: "LICENCIAMIENTO",
        submateria: "LUAE",
        materiaId: 26,
        submateriaId: 54,
        sinMateria: false,
        sancion: null,
        multa: 920,
        enResolucion: true,
        enCore: true,
        admiteTc: true,
        motivoNoAdmite: null,
        obligacionHacer: null,
        articulo: null,
        literal: null,
        subliteral: null,
        numeral: null,
        tipificacion: null,
      },
      {
        codigo: "AMB-RU-X-200-3-01",
        materia: "AMBIENTE",
        submateria: "RUIDO",
        materiaId: 22,
        submateriaId: 59,
        sinMateria: false,
        sancion: null,
        multa: 460,
        enResolucion: true,
        enCore: true,
        admiteTc: false,
        motivoNoAdmite: "RUC de sociedad",
        obligacionHacer: null,
        articulo: null,
        literal: null,
        subliteral: null,
        numeral: null,
        tipificacion: null,
      },
    ],
    evaluacionTc: { estado: "APTA", motivos: [], multaConmutable: 920 },
    alertas: [],
    avisoCoreCambio: null,
    ...over,
  });

  let capturadas: AccionesCompositor[];
  const ultimaAccion = (): AccionesCompositor =>
    capturadas[capturadas.length - 1];

  /** Monta con la barra capturada: es por donde se leen `motivosNoEmitir` y `puedeEmitir`. */
  const montarConBarra = () =>
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
        renderBarraAcciones={(acciones: AccionesCompositor) => {
          capturadas.push(acciones);
          return null;
        }}
      />,
    );

  const elegir = async (codigo: string) =>
    fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
      target: { value: codigo },
    });

  /** Escribe el SBU como lo teclearía el ejecutor (quick 261105-cc7). */
  const escribirSbu = (texto: string) =>
    fireEvent.change(screen.getByLabelText(ETIQUETA_SBU), {
      target: { value: texto },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    capturadas = [];
    mocks.tipos.mockResolvedValue([TIPO, TIPO_TC]);
    mocks.vistaPrevia.mockResolvedValue("blob:borrador");
    mocks.emitir.mockResolvedValue({
      docId: 1,
      docName: "p.pdf",
      docUrl: "/api/fileserver/ejecucion/providencias/2026/10/p.pdf",
      paginas: 1,
      tipoCodigo: TIPO_TC.codigo,
      accionEpasAplicada: "INICIAR_TRABAJO_COMUNITARIO",
    });
    mocks.estadoPago.mockRejectedValue(new Error("sin pago"));
    // Quick 261105-cc7: el estado del TC trae el SBU de Parámetros SOLO como referencia.
    mocks.estadoTc.mockResolvedValue({
      eejeId: caso.eejeId,
      eejeStatus: "EN_VERIFICACION_PAGO",
      sbuParametro: 460,
    });
    mocks.fichaInfracciones.mockResolvedValue(fichaApta());
    globalThis.URL.createObjectURL = vi.fn(() => "blob:borrador");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("con un tipo que NO autoriza TC, no pide la ficha de infracciones", async () => {
    montarConBarra();
    await elegir(TIPO.codigo);
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));

    expect(mocks.fichaInfracciones).not.toHaveBeenCalled();
    expect(screen.queryByText("Trabajo comunitario por infracción")).toBeNull();
    // Quick 261105-cc7: sin autorizar el TC y sin cuadro no hay nada que calcular: no se pide SBU.
    expect(screen.queryByLabelText(ETIQUETA_SBU)).toBeNull();
  });

  it("🔴 BLOQUEADA: cada motivo del servidor entra en «Qué falta para emitir» (paso 1) y no se emite", async () => {
    mocks.fichaInfracciones.mockResolvedValue(
      fichaApta({
        evaluacionTc: {
          estado: "BLOQUEADA",
          motivos: [
            {
              codigo: "PENDIENTE_CORE",
              mensaje:
                "Las infracciones de este expediente aún no se han leído de CORE.",
            },
            { codigo: "DESCUADRE", mensaje: "La multa no cuadra." },
          ],
          multaConmutable: null,
        },
      }),
    );
    montarConBarra();
    await elegir(TIPO_TC.codigo);

    await waitFor(() =>
      expect(ultimaAccion().motivosNoEmitir).toContainEqual({
        paso: 1,
        texto:
          "Las infracciones de este expediente aún no se han leído de CORE.",
      }),
    );
    expect(ultimaAccion().motivosNoEmitir).toContainEqual({
      paso: 1,
      texto: "La multa no cuadra.",
    });
    expect(ultimaAccion().puedeEmitir).toBe(false);
    expect(mocks.fichaInfracciones).toHaveBeenCalledTimes(1);
    expect(mocks.fichaInfracciones).toHaveBeenCalledWith(caso.eejeId);
    expect(screen.queryByText(/Susceptible de compensación/)).toBeNull();
  });

  it("🔴 APTA: enseña qué infracciones entran y cuáles quedan fuera y por qué, y lo compensable", async () => {
    montarConBarra();
    await elegir(TIPO_TC.codigo);

    expect(
      await screen.findByText("Trabajo comunitario por infracción"),
    ).toBeInTheDocument();
    expect(screen.getByText("LIC-LU-X-124-1947A-02")).toBeInTheDocument();
    expect(screen.getByText("Admite TC")).toBeInTheDocument();
    expect(screen.getByText("AMB-RU-X-200-3-01")).toBeInTheDocument();
    expect(screen.getByText("No admite: RUC de sociedad")).toBeInTheDocument();
    expect(
      screen.getByText(`Susceptible de compensación: ${formatearUsd(920)}`),
    ).toBeInTheDocument();
    escribirSbu("470,75");
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));
    expect(ultimaAccion().motivosNoEmitir).toEqual([]);
  });

  it("mientras se comprueba, un motivo de espera impide emitir", async () => {
    mocks.fichaInfracciones.mockReturnValue(
      new Promise<FichaInfracciones>(() => {}),
    );
    montarConBarra();
    await elegir(TIPO_TC.codigo);

    await waitFor(() =>
      expect(ultimaAccion().motivosNoEmitir).toContainEqual({
        paso: 1,
        texto: "Comprobando las infracciones del expediente…",
      }),
    );
    expect(ultimaAccion().puedeEmitir).toBe(false);
  });

  it("🔴 si la ficha falla por red, no se deja emitir a ciegas", async () => {
    mocks.fichaInfracciones.mockRejectedValue(new Error("Network Error"));
    montarConBarra();
    await elegir(TIPO_TC.codigo);

    await waitFor(() =>
      expect(ultimaAccion().motivosNoEmitir).toContainEqual({
        paso: 1,
        texto:
          "No se pudo comprobar si las infracciones admiten trabajo comunitario.",
      }),
    );
    expect(ultimaAccion().puedeEmitir).toBe(false);
  });

  it("🔴 D-06: no hay casilla de declaración y el payload emitido no lleva ninguna clave de aptitud", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );
    await elegir(TIPO_TC.codigo);
    await screen.findByText("Trabajo comunitario por infracción");

    expect(screen.queryByText(/Declaro que/)).toBeNull();
    expect(
      screen.queryByRole("checkbox", { name: /admite trabajo comunitario/i }),
    ).toBeNull();

    escribirSbu("470,75");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Emitir providencia" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Emitir providencia" }));
    fireEvent.click(await screen.findByRole("button", { name: "Emitir" }));
    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));

    const payload = mocks.emitir.mock.calls[0][0] as EmitirProvidenciaPayload;
    expect(payload.tipoCodigo).toBe(TIPO_TC.codigo);
    expect(Object.keys(payload).filter((k) => k.startsWith("aptitud"))).toEqual(
      [],
    );
  });

  // ── Quick 261105-cc7: el SBU lo escribe el ejecutor, en formato ecuatoriano ──────────────────
  it("🔴 con un tipo que autoriza el TC, el campo SBU sale VACÍO, con la referencia de Parámetros, y sin él no se emite", async () => {
    montarConBarra();
    await elegir(TIPO_TC.codigo);
    await screen.findByText("Trabajo comunitario por infracción");

    const campo = await screen.findByLabelText(ETIQUETA_SBU);
    // Nunca se rellena con el parámetro: aceptarlo por descuido es lo que la decisión evita.
    expect(campo).toHaveValue("");
    expect(formatearUsd(460)).toBe("USD 460,00");
    expect(
      await screen.findByText(
        `Valor en Parámetros: ${formatearUsd(460)} — solo referencia: escriba el SBU que corresponde al caso.`,
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(ultimaAccion().motivosNoEmitir).toContainEqual({
        paso: 2,
        texto:
          "Falta escribir el SBU en dólares con el que se calcula el trabajo comunitario.",
      }),
    );
    expect(ultimaAccion().puedeEmitir).toBe(false);
  });

  it("🔴 «470,75» viaja como 470.75 al emitir, y la vista previa recibe el mismo valor", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );
    await elegir(TIPO_TC.codigo);
    await screen.findByText("Trabajo comunitario por infracción");
    escribirSbu("470,75");

    await waitFor(
      () =>
        expect(
          mocks.vistaPrevia.mock.calls.some(
            ([p]) =>
              (p as EmitirProvidenciaPayload).datosCuadro?.sbu === 470.75,
          ),
        ).toBe(true),
      { timeout: 4000 },
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Emitir providencia" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Emitir providencia" }));
    fireEvent.click(await screen.findByRole("button", { name: "Emitir" }));
    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));

    const payload = mocks.emitir.mock.calls[0][0] as EmitirProvidenciaPayload;
    expect(payload.datosCuadro?.sbu).toBe(470.75);
  });

  it("🔴 «470.75» (punto decimal) se rechaza bajo el campo al salir de él, y el error se retira al editar", async () => {
    const MENSAJE_CAMPO =
      "Escriba el SBU en dólares con coma para los centavos, por ejemplo 470,75 (el punto separa los miles).";
    montarConBarra();
    await elegir(TIPO_TC.codigo);
    await screen.findByText("Trabajo comunitario por infracción");

    escribirSbu("470.75");
    const campo = screen.getByLabelText(ETIQUETA_SBU);
    fireEvent.blur(campo);

    const error = await screen.findByText(MENSAJE_CAMPO);
    expect(error).toHaveClass("text-error");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo.getAttribute("aria-describedby")).toContain(error.id);
    await waitFor(() =>
      expect(ultimaAccion().motivosNoEmitir).toContainEqual({
        paso: 2,
        texto:
          "El SBU escrito no es un importe válido: use la coma para los centavos, por ejemplo 470,75.",
      }),
    );
    expect(ultimaAccion().puedeEmitir).toBe(false);

    escribirSbu("470,75");
    expect(screen.queryByText(MENSAJE_CAMPO)).toBeNull();
    expect(campo).not.toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));
  });

  it("«1.234» se lee como mil doscientos treinta y cuatro", async () => {
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );
    await elegir(TIPO_TC.codigo);
    await screen.findByText("Trabajo comunitario por infracción");
    escribirSbu("1.234");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Emitir providencia" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Emitir providencia" }));
    fireEvent.click(await screen.findByRole("button", { name: "Emitir" }));
    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));

    const payload = mocks.emitir.mock.calls[0][0] as EmitirProvidenciaPayload;
    expect(payload.datosCuadro?.sbu).toBe(1234);
  });

  it("un SBU de más del doble de la referencia (p. ej. «47075», sin la coma) avisa sin bloquear", async () => {
    montarConBarra();
    await elegir(TIPO_TC.codigo);
    await screen.findByText("Trabajo comunitario por infracción");
    escribirSbu("47075");

    expect(
      await screen.findByText(/más del doble del valor de Parámetros/),
    ).toHaveClass("text-warning");
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));
  });
});

/**
 * Fase 03.21 (D-04, D-07, D-11): la firma en el mismo acto de emitir.
 *
 * 🔴 Lo que se fija:
 *   · El compositor no sabe de claves: la PIDE con `obtenerClaveDeFirma` en el instante de emitir,
 *     UNA vez y DESPUÉS de `antesDeEmitir`, y la pasa como tercer argumento de `emitir`.
 *   · Un fallo se entrega a quien monta con `alFallarFirma`: si responde `true`, la confirmación SE
 *     CIERRA y el compositor no pinta nada (la página lo pinta junto al campo, UI-SPEC §3.3); si
 *     responde `false` o no hay prop, la conducta de la 03.19 (confirmación abierta con su mensaje).
 *   · El aviso de éxito dice si la providencia salió firmada (UI-SPEC §10.7). Textos a mano.
 */
describe("CompositorProvidencia — la firma en el mismo acto (Fase 03.21, D-04/D-07/D-11)", () => {
  const emitidaBase = {
    docId: 1,
    docName: "p.pdf",
    docUrl: "/api/fileserver/ejecucion/providencias/2026/10/p.pdf",
    paginas: 1,
    tipoCodigo: TIPO.codigo,
    accionEpasAplicada: null,
  };

  /** Un `HttpClientError` como lo deja el normalizador. */
  const errorHttp = (code: string, status: number, mensaje: string) =>
    Object.assign(new Error(mensaje), {
      isHttpClientError: true as const,
      originalError: undefined,
      code,
      status,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tipos.mockResolvedValue([TIPO]);
    mocks.vistaPrevia.mockResolvedValue("blob:borrador");
    mocks.emitir.mockResolvedValue({ ...emitidaBase, firma: { aplicada: true } });
    mocks.estadoPago.mockRejectedValue(new Error("sin pago"));
    mocks.estadoTc.mockRejectedValue(new Error("sin trabajo comunitario"));
    globalThis.URL.createObjectURL = vi.fn(() => "blob:borrador");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  const emitirDesdeLaConfirmacion = async () => {
    await redactarPasandoPorElEditor();
    fireEvent.click(screen.getByRole("button", { name: "Emitir providencia" }));
    fireEvent.click(await screen.findByRole("button", { name: "Emitir" }));
    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));
  };

  it("🔴 pide la clave UNA vez, DESPUÉS de antesDeEmitir, y la pasa como tercer argumento", async () => {
    const orden: string[] = [];
    const antesDeEmitir = vi.fn(async () => {
      orden.push("antesDeEmitir");
    });
    const obtenerClaveDeFirma = vi.fn(() => {
      orden.push("obtenerClaveDeFirma");
      return "k";
    });
    mocks.emitir.mockImplementation(async () => {
      orden.push("emitir");
      return { ...emitidaBase, firma: { aplicada: true } };
    });
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
        antesDeEmitir={antesDeEmitir}
        obtenerClaveDeFirma={obtenerClaveDeFirma}
      />,
    );
    await emitirDesdeLaConfirmacion();

    expect(obtenerClaveDeFirma).toHaveBeenCalledTimes(1);
    expect(orden).toEqual(["antesDeEmitir", "obtenerClaveDeFirma", "emitir"]);
    expect(mocks.emitir).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      "k",
    );
  });

  it("sin obtenerClaveDeFirma el tercer argumento es undefined", async () => {
    render(
      <CompositorProvidencia caso={caso} onCancelar={vi.fn()} onEmitida={vi.fn()} />,
    );
    await emitirDesdeLaConfirmacion();

    expect(mocks.emitir.mock.calls[0][2]).toBeUndefined();
  });

  it.each([
    [true, null, "Providencia emitida, firmada y adjuntada al expediente."],
    [
      true,
      "MARCAR_CUMPLIDO",
      "Providencia emitida y firmada. Además, el expediente cambió de estado.",
    ],
    [
      false,
      null,
      "Providencia emitida SIN firma criptográfica y adjuntada al expediente.",
    ],
    [
      false,
      "MARCAR_CUMPLIDO",
      "Providencia emitida SIN firma criptográfica. Además, el expediente cambió de estado.",
    ],
  ])(
    "aviso de éxito con firma.aplicada=%s y acción %s (UI-SPEC §10.7)",
    async (aplicada, accion, texto) => {
      mocks.emitir.mockResolvedValue({
        ...emitidaBase,
        accionEpasAplicada: accion,
        firma: { aplicada },
      });
      render(
        <CompositorProvidencia caso={caso} onCancelar={vi.fn()} onEmitida={vi.fn()} />,
      );
      await emitirDesdeLaConfirmacion();

      await waitFor(() =>
        expect(mocks.addToast).toHaveBeenCalledWith("success", texto),
      );
    },
  );

  it("🔴 si alFallarFirma responde true, la confirmación SE CIERRA y el compositor no pinta el error", async () => {
    const err = errorHttp(
      "APP-FIRMA-CLAVE-001",
      422,
      "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.",
    );
    mocks.emitir.mockRejectedValue(err);
    const alFallarFirma = vi.fn(() => true);
    const onEmitida = vi.fn();
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={onEmitida}
        obtenerClaveDeFirma={() => "k"}
        alFallarFirma={alFallarFirma}
      />,
    );
    await emitirDesdeLaConfirmacion();

    await waitFor(() => expect(alFallarFirma).toHaveBeenCalledWith(err));
    await waitFor(() =>
      expect(screen.queryByText("Emitir la providencia")).toBeNull(),
    );
    expect(screen.queryByText(/La clave de firma no es correcta/)).toBeNull();
    expect(onEmitida).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalledWith("success", expect.anything());
    // El borrador no se pierde: el botón de emitir vuelve a estar disponible.
    expect(
      screen.getByRole("button", { name: "Emitir providencia" }),
    ).toBeEnabled();
  });

  it("si alFallarFirma responde false, la confirmación sigue abierta con su mensaje (03.19)", async () => {
    mocks.emitir.mockRejectedValue(
      errorHttp("APP-ERROR-400", 400, "Falta la cabecera del documento."),
    );
    const alFallarFirma = vi.fn(() => false);
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
        alFallarFirma={alFallarFirma}
      />,
    );
    await emitirDesdeLaConfirmacion();

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "Falta la cabecera del documento.",
      ),
    );
    expect(alFallarFirma).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Emitir la providencia")).toBeInTheDocument();
  });

  it("un fallo al emitir se dice UNA vez y, al cerrar la confirmación, NO reaparece en el formulario (quick 261028-kmg)", async () => {
    mocks.emitir.mockRejectedValue(
      errorHttp("APP-ERROR-400", 400, "Falta la cabecera del documento."),
    );
    render(
      <CompositorProvidencia caso={caso} onCancelar={vi.fn()} onEmitida={vi.fn()} />,
    );
    await emitirDesdeLaConfirmacion();
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "Falta la cabecera del documento.",
      ),
    );

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(".app-modules-modal-cancel")!,
    );
    await waitFor(() =>
      expect(screen.queryByText("Emitir la providencia")).toBeNull(),
    );
    expect(screen.queryByText("Falta la cabecera del documento.")).toBeNull();
    expect(
      mocks.addToast.mock.calls.filter(([tipo]) => tipo === "error"),
    ).toHaveLength(1);
  });

  it("el fallo al CARGAR el catálogo de tipos se queda en línea y no sale en el aviso flotante (quick 261028-kmg)", async () => {
    mocks.tipos.mockRejectedValue(
      errorHttp("APP-ERROR-500", 400, "El catálogo no responde."),
    );
    render(
      <CompositorProvidencia caso={caso} onCancelar={vi.fn()} onEmitida={vi.fn()} />,
    );

    expect(await screen.findByText("El catálogo no responde.")).toBeInTheDocument();
    expect(mocks.addToast).not.toHaveBeenCalledWith("error", expect.anything());
  });

  it("sin alFallarFirma, cualquier error deja la confirmación abierta con su mensaje (03.19)", async () => {
    mocks.emitir.mockRejectedValue(
      errorHttp(
        "APP-FIRMA-NO-RESPONDE-001",
        504,
        "El servicio de firma no responde. Inténtelo de nuevo en unos minutos.",
      ),
    );
    render(
      <CompositorProvidencia caso={caso} onCancelar={vi.fn()} onEmitida={vi.fn()} />,
    );
    await emitirDesdeLaConfirmacion();

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(/El servicio de firma no responde/),
      ),
    );
    expect(screen.getByText("Emitir la providencia")).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// quick 261105-cvq — «Multa impuesta (USD)» de la cabecera, en formato ecuatoriano.
//
// 🔴 Antes era una casilla numérica del navegador y lo mal escrito se DESCARTABA EN SILENCIO: el
// PDF salía con la multa del expediente y nadie se enteraba. Ahora se lee con `parsearImporte`, y
// un texto que no es un importe bloquea la emisión con su motivo. Vacía no bloquea (es opcional).
// ═════════════════════════════════════════════════════════════════════════════════════════════
describe("CompositorProvidencia — la multa de la cabecera en formato ecuatoriano (quick 261105-cvq)", () => {
  const ETIQUETA_MULTA = "Multa impuesta (USD)";
  const MENSAJE_CAMPO =
    "Escriba la multa en dólares con coma para los centavos, por ejemplo 2.300,00 (el punto separa los miles).";
  const MOTIVO =
    "La multa impuesta de «Datos de la cabecera» no es un importe válido: use la coma para los centavos, por ejemplo 2.300,00.";

  let capturadas: AccionesCompositor[];
  const ultimaAccion = (): AccionesCompositor =>
    capturadas[capturadas.length - 1];

  const montarConBarra = () =>
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
        renderBarraAcciones={(acciones: AccionesCompositor) => {
          capturadas.push(acciones);
          return null;
        }}
      />,
    );

  /** Abre «Datos de la cabecera» y escribe la multa como la teclearía el decisor. */
  const escribirMulta = (texto: string) => {
    fireEvent.click(screen.getByText("Datos de la cabecera"));
    const campo = screen.getByLabelText(ETIQUETA_MULTA);
    fireEvent.change(campo, { target: { value: texto } });
    return campo;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturadas = [];
    mocks.tipos.mockResolvedValue([TIPO]);
    mocks.vistaPrevia.mockResolvedValue("blob:borrador");
    mocks.emitir.mockResolvedValue({
      docId: 1,
      docName: "p.pdf",
      docUrl: "/api/fileserver/ejecucion/providencias/2026/10/p.pdf",
      paginas: 1,
      tipoCodigo: TIPO.codigo,
      accionEpasAplicada: null,
    });
    mocks.estadoPago.mockRejectedValue(new Error("sin pago"));
    mocks.estadoTc.mockRejectedValue(new Error("sin trabajo comunitario"));
    globalThis.URL.createObjectURL = vi.fn(() => "blob:borrador");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("🔴 «2.300,50» viaja como 2300.5 al emitir, y la vista previa recibe el mismo valor", async () => {
    render(
      <CompositorProvidencia caso={caso} onCancelar={vi.fn()} onEmitida={vi.fn()} />,
    );
    await redactarPasandoPorElEditor();
    const campo = escribirMulta("2.300,50");
    expect(campo).toHaveAttribute("type", "text");
    expect(campo).toHaveAttribute("inputMode", "decimal");

    await waitFor(
      () =>
        expect(
          mocks.vistaPrevia.mock.calls.some(
            ([p]) =>
              (p as EmitirProvidenciaPayload).cabecera?.multaImpuesta === 2300.5,
          ),
        ).toBe(true),
      { timeout: 4000 },
    );

    fireEvent.click(screen.getByRole("button", { name: "Emitir providencia" }));
    fireEvent.click(await screen.findByRole("button", { name: "Emitir" }));
    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));

    const payload = mocks.emitir.mock.calls[0][0] as EmitirProvidenciaPayload;
    expect(payload.cabecera?.multaImpuesta).toBe(2300.5);
  });

  it("🔴 «2300.50» se rechaza bajo el campo al salir de él y BLOQUEA la emisión; editar retira el error", async () => {
    montarConBarra();
    fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
      target: { value: TIPO.codigo },
    });
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));

    const campo = escribirMulta("2300.50");
    fireEvent.blur(campo);

    const error = await screen.findByText(MENSAJE_CAMPO);
    expect(error).toHaveClass("text-error");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo.getAttribute("aria-describedby")).toContain(error.id);
    await waitFor(() =>
      expect(ultimaAccion().motivosNoEmitir).toContainEqual({
        paso: 1,
        texto: MOTIVO,
      }),
    );
    expect(ultimaAccion().puedeEmitir).toBe(false);

    fireEvent.change(campo, { target: { value: "2.300,50" } });
    expect(screen.queryByText(MENSAJE_CAMPO)).toBeNull();
    expect(campo).not.toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));
  });

  it("la casilla vacía no bloquea: el campo es opcional y el servidor usa la del expediente", async () => {
    montarConBarra();
    fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
      target: { value: TIPO.codigo },
    });
    await waitFor(() => expect(ultimaAccion().puedeEmitir).toBe(true));

    const campo = escribirMulta("");
    fireEvent.blur(campo);

    expect(screen.queryByText(MENSAJE_CAMPO)).toBeNull();
    expect(
      (ultimaAccion().motivosNoEmitir ?? []).some((m) => m.texto === MOTIVO),
    ).toBe(false);
    expect(ultimaAccion().puedeEmitir).toBe(true);
  });
});

/**
 * Quick 261105-ma6 — las horas que fijó la RESOLUCIÓN se PROPONEN como las del acto administrativo.
 *   · Con el TC sin autorizar y `horasResolucion: 16`, el campo nace con 16, una línea lo explica
 *     y la vista previa recibe `datosCuadro.horasAutorizadas === 16` (el mismo camino que el sello).
 *   · Si el ejecutor lo borra, queda vacío y no se vuelve a proponer.
 *   · Con el TC ya autorizado, o sin horas (o 0), no se propone nada.
 */
describe("CompositorProvidencia — las horas de la resolución se proponen como las del acto (quick 261105-ma6)", () => {
  const ETIQUETA_HORAS = "Horas fijadas por el acto administrativo";
  const LINEA_REFERENCIA = /La resolución fijó 16 horas de trabajo comunitario/;

  /** Un tipo que autoriza el TC y cuyo borrador lleva el cuadro (el único que enseña el campo). */
  const TIPO_TC_CUADRO: TipoProvidenciaDisponible = {
    codigo: "TRABAJO_COMUNITARIO_CUADRO",
    nombre: "Trabajo comunitario con cuadro",
    activo: true,
    disponible: true,
    borrador: `<p>Se autoriza el trabajo comunitario.</p><p>${MARCADOR_CUADRO}</p>`,
    accionEpas: "INICIAR_TRABAJO_COMUNITARIO",
  };

  /** Ficha APTA mínima: sin ella el tipo que autoriza el TC no deja componer. */
  const fichaApta: FichaInfracciones = {
    eejeId: caso.eejeId!,
    estadoCore: "LEIDO",
    coreLeidoAt: "2026-10-15T15:30:00.000Z",
    coreDisponible: true,
    materia: "LICENCIAMIENTO",
    submaterias: ["LUAE"],
    infraccionesSinMateria: 0,
    tipoPersona: "NATURAL",
    avisoIdentificacion: null,
    multaTotal: 920,
    sumaMultas: 920,
    infracciones: [
      {
        codigo: "LIC-LU-X-124-1947A-02",
        materia: "LICENCIAMIENTO",
        submateria: "LUAE",
        materiaId: 26,
        submateriaId: 54,
        sinMateria: false,
        sancion: null,
        multa: 920,
        enResolucion: true,
        enCore: true,
        admiteTc: true,
        motivoNoAdmite: null,
        obligacionHacer: null,
        articulo: null,
        literal: null,
        subliteral: null,
        numeral: null,
        tipificacion: null,
      },
    ],
    evaluacionTc: { estado: "APTA", motivos: [], multaConmutable: 920 },
    alertas: [],
    avisoCoreCambio: null,
  };

  const montar = () =>
    render(
      <CompositorProvidencia
        caso={caso}
        onCancelar={vi.fn()}
        onEmitida={vi.fn()}
      />,
    );

  const elegir = async (codigo: string) =>
    fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
      target: { value: codigo },
    });

  const escribirSbu = (texto: string) =>
    fireEvent.change(screen.getByLabelText(ETIQUETA_SBU), {
      target: { value: texto },
    });

  /** ¿Alguna llamada a la vista previa llevó estas horas en el cuadro? */
  const vistaPreviaConHoras = (horas: number | undefined) =>
    mocks.vistaPrevia.mock.calls.some(
      ([p]) =>
        (p as EmitirProvidenciaPayload).datosCuadro !== undefined &&
        (p as EmitirProvidenciaPayload).datosCuadro?.horasAutorizadas ===
          horas,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tipos.mockResolvedValue([TIPO, TIPO_TC_CUADRO]);
    mocks.vistaPrevia.mockResolvedValue("blob:borrador");
    mocks.estadoPago.mockRejectedValue(new Error("sin pago"));
    mocks.fichaInfracciones.mockResolvedValue(fichaApta);
    globalThis.URL.createObjectURL = vi.fn(() => "blob:borrador");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("TC sin autorizar y 16 horas de la resolución ⇒ el campo nace con 16, la línea lo dice y la vista previa las manda", async () => {
    mocks.estadoTc.mockResolvedValue({
      eejeId: caso.eejeId,
      eejeStatus: "EN_VERIFICACION_PAGO",
      sbuParametro: 460,
      horasResolucion: 16,
    });
    montar();
    await elegir(TIPO_TC_CUADRO.codigo);

    const campo = await screen.findByLabelText(ETIQUETA_HORAS);
    await waitFor(() => expect(campo).toHaveValue(16));
    expect(screen.getByText(LINEA_REFERENCIA)).toBeInTheDocument();

    escribirSbu("470,75");
    await waitFor(() => expect(vistaPreviaConHoras(16)).toBe(true), {
      timeout: 4000,
    });
  });

  it("si el ejecutor borra las horas, quedan vacías, no se vuelven a proponer y la vista previa ya no las manda", async () => {
    mocks.estadoTc.mockResolvedValue({
      eejeId: caso.eejeId,
      eejeStatus: "EN_VERIFICACION_PAGO",
      sbuParametro: 460,
      horasResolucion: 16,
    });
    montar();
    await elegir(TIPO_TC_CUADRO.codigo);

    const campo = await screen.findByLabelText(ETIQUETA_HORAS);
    await waitFor(() => expect(campo).toHaveValue(16));

    fireEvent.change(campo, { target: { value: "" } });
    expect(campo).toHaveValue(null);

    mocks.vistaPrevia.mockClear();
    escribirSbu("470,75");
    await waitFor(
      () =>
        expect(
          mocks.vistaPrevia.mock.calls.some(
            ([p]) =>
              (p as EmitirProvidenciaPayload).datosCuadro?.sbu === 470.75,
          ),
        ).toBe(true),
      { timeout: 4000 },
    );
    expect(vistaPreviaConHoras(undefined)).toBe(true);
    expect(vistaPreviaConHoras(16)).toBe(false);
    expect(campo).toHaveValue(null);
  });

  it("con el TC ya autorizado no se propone nada ni aparece la línea", async () => {
    mocks.estadoTc.mockResolvedValue({
      eejeId: caso.eejeId,
      eejeStatus: "EN_TRABAJO_COMUNITARIO",
      sbuParametro: 460,
      horasResolucion: 16,
      horasAutorizadas: 20,
      autorizadoAt: "2026-11-01T10:00:00.000Z",
    });
    montar();
    await elegir(TIPO_TC_CUADRO.codigo);

    const campo = await screen.findByLabelText(ETIQUETA_HORAS);
    await waitFor(() => expect(mocks.estadoTc).toHaveBeenCalled());
    expect(campo).toHaveValue(null);
    expect(screen.queryByText(LINEA_REFERENCIA)).toBeNull();
  });

  it.each([
    ["sin horasResolucion", undefined],
    ["con 0 horas", 0],
  ])("%s ⇒ el campo queda vacío y no aparece la línea", async (_n, horas) => {
    mocks.estadoTc.mockResolvedValue({
      eejeId: caso.eejeId,
      eejeStatus: "EN_VERIFICACION_PAGO",
      sbuParametro: 460,
      horasResolucion: horas,
    });
    montar();
    await elegir(TIPO_TC_CUADRO.codigo);

    const campo = await screen.findByLabelText(ETIQUETA_HORAS);
    await waitFor(() => expect(mocks.estadoTc).toHaveBeenCalled());
    expect(campo).toHaveValue(null);
    expect(
      screen.queryByText(/La resolución fijó .* horas de trabajo comunitario/),
    ).toBeNull();
  });
});
