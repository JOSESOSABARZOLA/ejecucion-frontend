/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo de la ESCALADA (Fase 03.18, Plan 06)
 * Archivo: modalesEscalada.test.tsx
 * Responsabilidad: Fijar la conducta de los cuatro modales de la escalada, y muy en concreto las
 *   TRES formas en que este tramo se rompe en producción sin que nadie se entere:
 *
 *   1. **Que una advertencia se trate como un error.** Los tres actos que devuelven `advertencias[]`
 *      lo hacen DENTRO de un 2xx, sobre un hecho YA CONSUMADO. Una pantalla que corte el flujo o
 *      pinte rojo hace que el decisor reintente, y entonces hay DOS actos donde hubo uno — dos
 *      diligencias, o dos órdenes de pago sobre la misma deuda.
 *   2. **Que el recargo del art. 239 se calcule en el navegador.** Serían DOS importes para una
 *      deuda que se cobra por coactiva a una persona concreta. El caso de la multiplicación lee el
 *      FUENTE del componente, no su render: lo que se prohíbe es que el cálculo exista.
 *   3. **Que un `epasReabierto: false` se cuente como «no pasó nada».** Con advertencia significa
 *      que la reapertura FALLÓ y el expediente se quedó donde estaba; sin ella, que no había nada
 *      que reabrir. Son dos cosas distintas y el usuario tiene derecho a distinguirlas: es el punto
 *      en que un expediente CUMPLIDO vuelve a deber.
 *
 *   Y la cuarta, heredada del Plan 05: el recorrido de los DIEZ nombres de acción de la rama contra
 *   `ACCION_A_MODAL` y `modalRegistry`, que es la barrera contra el toast «Acción no disponible».
 *
 *   ⚠️ `react-pdf` se simula porque `modalRegistry` arrastra el visor de documentos y `pdfjs-dist`
 *   necesita `DOMMatrix`, que jsdom no tiene. Lo que aquí importa del registro son sus CLAVES.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-jcy: sale el modal del acto sobre el sello
 *   de clausura) * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-lhu: la salida explícita del resultado y
 *   «Cancelar» de los cuatro, fijados con pruebas)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: un rechazo del servidor se afirma en
 *   el aviso flotante y sin caja)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq: la base de los gastos se escribe en
 *   formato ecuatoriano —«4.820,55» viaja como 4820.55— y «4820.55» se rechaza bajo la casilla)
 */
import { errorDelServidor } from "../../test/errores";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  ordenarSustitutoria: vi.fn(),
  registrarDiligencia: vi.fn(),
  respaldoCostos: vi.fn(),
  registrarGastosSustitutoria: vi.fn(),
  getDocumentos: vi.fn(),
}));

vi.mock("react-pdf", () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: { workerSrc: "" }, version: "0" },
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock("../../services/ObligacionHacerService", () => ({
  ObligacionHacerService: {
    ordenarSustitutoria: mocks.ordenarSustitutoria,
    registrarDiligencia: mocks.registrarDiligencia,
    respaldoCostos: mocks.respaldoCostos,
    registrarGastosSustitutoria: mocks.registrarGastosSustitutoria,
  },
  SUBIDA_TIMEOUT_MS: 45000,
}));

vi.mock("../../services/EpasService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/EpasService")>()),
  EpasService: { getDocumentos: mocks.getDocumentos },
}));

import { modalRegistry } from "../../interfaces/IModal";
import { ACCION_A_MODAL, resolverModalDeAccion } from "../tabla/RowActions";
import ModalOrdenarSustitutoria, {
  MODAL_KEY as ORDENAR_SUSTITUTORIA,
} from "./ModalOrdenarSustitutoria";
import ModalRegistrarDiligencia, {
  MODAL_KEY as REGISTRAR_DILIGENCIA,
} from "./ModalRegistrarDiligencia";
import ModalRespaldoCostos, {
  MODAL_KEY as RESPALDO_COSTOS,
} from "./ModalRespaldoCostos";
import ModalGastosSustitutoria, {
  MODAL_KEY as GASTOS_SUSTITUTORIA,
} from "./ModalGastosSustitutoria";
import { MODAL_KEY as DECLARAR } from "./ModalDeclararHacer";
import { MODAL_KEY as DESHACER } from "./ModalDeshacerHacer";
import { MODAL_KEY as CONSTATAR } from "./ModalConstatarIncumplimiento";
import { MODAL_KEY as ADJUNTAR_INFORME } from "./ModalAdjuntarInforme";
import { MODAL_KEY as ACREDITAR } from "./ModalAcreditarCumplimiento";
import { MODAL_KEY as REGISTRAR_ALEGACION } from "./ModalRegistrarAlegacion";
// 🔴 EL FUENTE DEL COMPONENTE, COMO TEXTO. Se lee con el `?raw` de Vite y no con `node:fs` porque
// `tsconfig.app.json` fija `"types": ["vite/client"]`: el tipado de Node no está disponible aquí, y
// ensanchar el perímetro de tipos de toda la aplicación para una prueba sería el peor cambio.
import fuenteGastos from "./ModalGastosSustitutoria.tsx?raw";

/** Los CUATRO nombres de acción del tramo de la escalada (`POLITICA_ACCIONES`, Plan 04). */
const LOS_CUATRO = [
  ORDENAR_SUSTITUTORIA,
  REGISTRAR_DILIGENCIA,
  RESPALDO_COSTOS,
  GASTOS_SUSTITUTORIA,
] as const;

/** Los DIEZ actos de la rama que tienen modal: los seis del cumplimiento más los cuatro de arriba. */
const LOS_DIEZ = [
  DECLARAR,
  DESHACER,
  CONSTATAR,
  ADJUNTAR_INFORME,
  ACREDITAR,
  REGISTRAR_ALEGACION,
  ...LOS_CUATRO,
] as const;

const FILA = {
  eejeId: 77,
  expNumber: "EPAS-2026-0077",
  admiName: "Rosa",
  admiLastname: "Pilataxi",
};

const boton = (nombre: RegExp) => screen.getByRole("button", { name: nombre });

/** `files` es de solo lectura en jsdom: hay que definirla antes de disparar el change. */
const adjuntar = (archivo: File) => {
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  Object.defineProperty(input, "files", {
    value: [archivo],
    configurable: true,
  });
  fireEvent.change(input);
};

const PDF = (nombre = "acta.pdf") =>
  new File(["%PDF-1.4"], nombre, { type: "application/pdf" });

/** Los dos selectores de documento del modal de gastos, en el orden en que se pintan. */
const elegirDocumento = (indice: number, docId: number) => {
  const selects = screen.getAllByRole("combobox");
  fireEvent.change(selects[indice], { target: { value: String(docId) } });
};

/**
 * El desglose que devuelve el servidor. 🔴 LAS CIFRAS NO CUADRAN A PROPÓSITO: 100 × 20 % no es
 * 7,77 ni el total es 999,99. Si la pantalla pintara lo que ella calcula en vez de lo que llegó,
 * estos números la delatarían.
 */
const DESGLOSE = {
  ordpId: 4201,
  epasReabierto: false,
  base: 100,
  recargoPct: 20,
  recargoValor: 7.77,
  total: 999.99,
};

const AVISO_SIN_REAPERTURA = {
  codigo: "SUSTITUTORIA_GASTOS_SIN_REAPERTURA",
  mensaje:
    "Los costos QUEDARON REGISTRADOS (orden de pago OP-1, USD 999.99), pero el expediente NO se pudo reabrir.",
};

const AVISO_SIN_DILIGENCIA = {
  codigo: "GASTOS_SIN_DILIGENCIA_EJECUTADA",
  mensaje:
    "Se liquidaron los costos, pero la última diligencia registrada terminó como FALLIDA.",
};

/** Rellena el formulario de gastos entero, sin enviarlo. */
const rellenarGastos = async () => {
  fireEvent.change(screen.getByLabelText(/base de los gastos/i), {
    target: { value: "100" },
  });
  fireEvent.change(screen.getByLabelText(/n.mero de la orden/i), {
    target: { value: "OP-1" },
  });
  // Dos selectores → dos juegos de opciones iguales: se espera a que los DOS estén poblados.
  await waitFor(() =>
    expect(
      screen.getAllByRole("option", { name: /Acta de inspecci.n/i }),
    ).toHaveLength(2),
  );
  elegirDocumento(0, 501);
  elegirDocumento(1, 502);
};

/** Rellena el formulario de gastos entero y lo envía (sin pantalla intermedia: quick 261014-dmc). */
const registrarGastos = async () => {
  await rellenarGastos();
  fireEvent.click(boton(/registrar los gastos/i));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDocumentos.mockResolvedValue([
    {
      docId: 501,
      docName: "Providencia de cobro de valores",
      tdocTypeName: "Providencia",
      docUploadedAt: "2026-09-10T12:00:00.000Z",
      docUrl: "/api/fileserver/ejecucion/documents/2026/10/x.pdf",
    },
    {
      docId: 502,
      docName: "Acta de inspección",
      tdocTypeName: "Acta",
      docUploadedAt: "2026-09-11T12:00:00.000Z",
      docUrl: "/api/fileserver/ejecucion/documents/2026/10/y.pdf",
    },
  ]);
});

describe("Los cuatro de la escalada — despacho", () => {
  it("🔴 los DIEZ nombres de acción de la rama resuelven a una clave que existe en el registro", () => {
    for (const nombre of LOS_DIEZ) {
      const clave = resolverModalDeAccion(nombre);

      // Si esto falla, el botón se pinta y al pulsarlo sale «Acción no disponible».
      expect(clave, `«${nombre}» no resuelve a ningún modal`).not.toBeNull();
      expect(
        Object.prototype.hasOwnProperty.call(modalRegistry, clave as string),
        `«${nombre}» resuelve a «${clave}», que no está en modalRegistry`,
      ).toBe(true);
      expect(typeof modalRegistry[clave as keyof typeof modalRegistry]).toBe(
        "function",
      );
    }
  });

  it("los cuatro de la escalada tienen entrada PROPIA en ACCION_A_MODAL", () => {
    for (const nombre of LOS_CUATRO) {
      expect(
        Object.prototype.hasOwnProperty.call(ACCION_A_MODAL, nombre),
        `«${nombre}» no está anotado en ACCION_A_MODAL`,
      ).toBe(true);
    }
  });
});

describe("ModalGastosSustitutoria — el importe lo calcula el servidor", () => {
  it("🔴 el formulario manda la BASE y los tres datos, y NADA MÁS: ningún importe calculado", async () => {
    mocks.registrarGastosSustitutoria.mockResolvedValue(DESGLOSE);

    render(
      <ModalGastosSustitutoria
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    await registrarGastos();

    await waitFor(() =>
      expect(mocks.registrarGastosSustitutoria).toHaveBeenCalledTimes(1),
    );
    // Exactamente cuatro claves: un campo de más lo rechaza el ValidationPipe con un 400.
    expect(mocks.registrarGastosSustitutoria).toHaveBeenCalledWith(77, {
      valor: 100,
      numeroOrden: "OP-1",
      docId: 501,
      respaldoDocId: 502,
    });
  });

  it("🔴 el desglose que se pinta es el del SERVIDOR, aunque las cifras no cuadren", async () => {
    mocks.registrarGastosSustitutoria.mockResolvedValue(DESGLOSE);

    render(
      <ModalGastosSustitutoria
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    await registrarGastos();

    // 100 × 20 % NO es 7,77, y 100 + 7,77 NO es 999,99. Si la pantalla multiplicara, aquí saldrían
    // 20,00 y 120,00 y este caso caería.
    expect(await screen.findByText(/7,77/)).toBeInTheDocument();
    expect(screen.getByText(/999,99/)).toBeInTheDocument();
    expect(screen.getByText(/100,00/)).toBeInTheDocument();
    // El porcentaje, tal y como llegó: PUNTOS PORCENTUALES, no la fracción.
    expect(screen.getByText(/^20\s*%$/)).toBeInTheDocument();
  });

  it("🔴 en el FUENTE del componente no hay ninguna multiplicación de recargo", () => {
    // Se excluyen los comentarios: el JSDoc CITA el porcentaje del artículo, y citarlo no es
    // calcularlo. Lo que se prohíbe es que el cálculo exista en el código que corre.
    const codigo = fuenteGastos
      .split("\n")
      .filter((linea: string) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(linea))
      .join("\n");

    expect(codigo).not.toMatch(/recargo *\*|\* *0\.2|1\.2 *\*|\* *20/);
  });

  // quick 261105-cvq: la base se escribe en formato ecuatoriano.
  it("🔴 «4.820,55» viaja como 4820.55, con las cuatro claves y nada más", async () => {
    mocks.registrarGastosSustitutoria.mockResolvedValue(DESGLOSE);
    render(<ModalGastosSustitutoria caseData={FILA} onClose={vi.fn()} />);

    await rellenarGastos();
    fireEvent.change(screen.getByLabelText(/base de los gastos/i), {
      target: { value: "4.820,55" },
    });
    fireEvent.click(boton(/registrar los gastos/i));

    await waitFor(() =>
      expect(mocks.registrarGastosSustitutoria).toHaveBeenCalledTimes(1),
    );
    expect(mocks.registrarGastosSustitutoria).toHaveBeenCalledWith(77, {
      valor: 4820.55,
      numeroOrden: "OP-1",
      docId: 501,
      respaldoDocId: 502,
    });
  });

  it("🔴 «4820.55» se rechaza bajo la casilla, con aria-invalid, y el envío no ocurre", async () => {
    render(<ModalGastosSustitutoria caseData={FILA} onClose={vi.fn()} />);

    await rellenarGastos();
    const base = screen.getByLabelText(/base de los gastos/i);
    expect(base).toHaveAttribute("type", "text");
    expect(base).toHaveAttribute("inputMode", "decimal");
    fireEvent.change(base, { target: { value: "4820.55" } });

    const aviso = screen.getByText(
      "Escriba la base en dólares con coma para los centavos, por ejemplo 4.820,55 (el punto separa los miles).",
    );
    expect(base).toHaveAttribute("aria-invalid", "true");
    expect(base.getAttribute("aria-describedby")).toBe(aviso.id);
    fireEvent.click(boton(/registrar los gastos/i));
    expect(mocks.registrarGastosSustitutoria).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS DOCUMENTOS DEL ART. 239 (corrección de CR-02)
//
// 🔴 EL SERVIDOR NO LO COMPRUEBA. `obligacion-hacer.repository.ts` llama a
// `assertDocumentoDelExpediente` por separado para `docId` y para `respaldoDocId` y comprueba
// PERTENENCIA al expediente, nunca que sean distintos: un mismo PDF pasa las dos comprobaciones.
// Esta pantalla es, hoy, el único sitio donde se puede impedir — y por eso se fija aquí.
//
// Lo que estaría en juego si se rompiera: una orden de pago `GASTOS_SUSTITUTORIA` cobrable por vía
// coactiva en la que «qué se dispone» y «qué costó» son el mismo papel, y un expediente que pierde
// uno de los dos documentos que el artículo exige poder enseñar.
// ═════════════════════════════════════════════════════════════════════════════════════════════
describe("ModalGastosSustitutoria — la providencia y el respaldo son DOS papeles", () => {
  const abrir = () =>
    render(<ModalGastosSustitutoria caseData={FILA} onClose={vi.fn()} />);

  /** Rellena base y orden, espera a los dos selectores poblados y elige en cada uno. */
  const rellenarCon = async (docId: number, respaldoDocId: number) => {
    fireEvent.change(screen.getByLabelText(/base de los gastos/i), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText(/n.mero de la orden/i), {
      target: { value: "OP-1" },
    });
    await waitFor(() =>
      expect(
        screen.getAllByRole("option", { name: /Acta de inspecci.n/i }),
      ).toHaveLength(2),
    );
    elegirDocumento(0, docId);
    elegirDocumento(1, respaldoDocId);
  };

  it("🔴 con el MISMO documento en los dos, NO se puede registrar y el acto no se manda", async () => {
    abrir();
    await rellenarCon(501, 501);

    // El botón del acto queda apagado: el acto no se puede enviar.
    expect(boton(/registrar los gastos/i)).toBeDisabled();
    fireEvent.click(boton(/registrar los gastos/i));
    expect(mocks.registrarGastosSustitutoria).not.toHaveBeenCalled();
  });

  it("y el formulario DICE POR QUÉ: un botón apagado sin motivo deja adivinando cuál falta", async () => {
    abrir();
    await rellenarCon(501, 501);

    expect(
      screen.getByText(/tienen que ser DOS documentos distintos/i),
    ).toBeInTheDocument();
  });

  it("con DOS documentos distintos el aviso desaparece y el acto viaja con los dos", async () => {
    mocks.registrarGastosSustitutoria.mockResolvedValue(DESGLOSE);
    abrir();
    await rellenarCon(501, 502);

    expect(
      screen.queryByText(/tienen que ser DOS documentos distintos/i),
    ).not.toBeInTheDocument();

    fireEvent.click(boton(/registrar los gastos/i));

    await waitFor(() =>
      expect(mocks.registrarGastosSustitutoria).toHaveBeenCalledTimes(1),
    );
    expect(mocks.registrarGastosSustitutoria).toHaveBeenCalledWith(
      77,
      expect.objectContaining({ docId: 501, respaldoDocId: 502 }),
    );
  });
});

describe("ModalGastosSustitutoria — la reapertura, en sus TRES casos", () => {
  const renderYRegistrar = async (respuesta: unknown) => {
    mocks.registrarGastosSustitutoria.mockResolvedValue(respuesta);
    render(
      <ModalGastosSustitutoria
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );
    await registrarGastos();
  };

  it("reapertura EN VERDADERO: la pantalla dice que el expediente vuelve a deber", async () => {
    await renderYRegistrar({ ...DESGLOSE, epasReabierto: true });

    expect(await screen.findByText(/vuelve a deber/i)).toBeInTheDocument();
  });

  it("🔴 reapertura en FALSO **con** advertencia: la pantalla dice que NO se completó", async () => {
    await renderYRegistrar({
      ...DESGLOSE,
      epasReabierto: false,
      advertencias: [AVISO_SIN_REAPERTURA],
    });

    expect(
      await screen.findByText(/la reapertura no se complet/i),
    ).toBeInTheDocument();
    // Y no se cuenta como que el expediente volviera a deber: no se reabrió.
    expect(screen.queryByText(/vuelve a deber/i)).not.toBeInTheDocument();
  });

  it("reapertura en FALSO **sin** advertencia: la pantalla no dice nada de reapertura", async () => {
    await renderYRegistrar({ ...DESGLOSE, epasReabierto: false });

    expect(await screen.findByText(/999,99/)).toBeInTheDocument();
    expect(screen.queryByText(/reapertura/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/vuelve a deber/i)).not.toBeInTheDocument();
  });
});

describe("Las advertencias son AVISOS, no errores", () => {
  it("🔴 una respuesta 2xx CON advertencias RESUELVE: se pinta aviso, no error, y el acto queda", async () => {
    mocks.registrarGastosSustitutoria.mockResolvedValue({
      ...DESGLOSE,
      advertencias: [AVISO_SIN_DILIGENCIA],
    });
    const refetchFn = vi.fn().mockResolvedValue(undefined);

    render(
      <ModalGastosSustitutoria
        caseData={FILA}
        onClose={vi.fn()}
        refetchFn={refetchFn}
      />,
    );

    await registrarGastos();

    // El toast es de ÉXITO, la bandeja se recargó y el aviso se pinta en variante de advertencia.
    await waitFor(() => expect(refetchFn).toHaveBeenCalledTimes(1));
    expect(mocks.addToast.mock.calls[0][0]).toBe("success");

    const aviso = await screen.findByText(
      /Se está trasladando el costo de una ejecución que no consta EJECUTADA/i,
    );
    expect(aviso.closest(".alert-warning")).not.toBeNull();
    expect(document.querySelector(".alert-error")).toBeNull();
  });

  it("la advertencia del art. 240 al ordenar la sustitutoria se PINTA y no deshace nada", async () => {
    mocks.ordenarSustitutoria.mockResolvedValue({
      multasCompulsoriasRegistradas: 1,
      advertencias: [
        {
          codigo: "SUSTITUTORIA_SIN_LAS_TRES_MULTAS",
          mensaje:
            "Se ordenó la ejecución sustitutoria constando 1 de las 3 multas compulsorias. La operación QUEDÓ REGISTRADA.",
        },
      ],
    });

    render(
      <ModalOrdenarSustitutoria
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    await screen.findByRole("option", { name: /Providencia de cobro/i });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "501" },
    });
    fireEvent.click(boton(/ordenar la sustitutoria/i));

    expect(
      await screen.findByText(/No constan las tres multas compulsorias/i),
    ).toBeInTheDocument();
    expect(document.querySelector(".alert-error")).toBeNull();
    expect(mocks.addToast.mock.calls[0][0]).toBe("success");
  });

  it("un código de advertencia DESCONOCIDO se enseña tal cual en vez de esconderse", async () => {
    mocks.ordenarSustitutoria.mockResolvedValue({
      multasCompulsoriasRegistradas: 3,
      advertencias: [
        { codigo: "CODIGO_DEL_FUTURO", mensaje: "Algo que avisar." },
      ],
    });

    render(
      <ModalOrdenarSustitutoria
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    await screen.findByRole("option", { name: /Providencia de cobro/i });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "501" },
    });
    fireEvent.click(boton(/ordenar la sustitutoria/i));

    // Se ve DOS veces: en el titular de reserva y en la coletilla que dice que no se reconoce.
    expect(await screen.findAllByText(/CODIGO_DEL_FUTURO/)).toHaveLength(2);
    expect(
      screen.getByText(/Código no reconocido por esta pantalla/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Algo que avisar.")).toBeInTheDocument();
  });
});

describe("ModalRegistrarDiligencia — FALLIDA es un resultado, no un error", () => {
  it("🔴 una diligencia FALLIDA se registra igual, con su acta, y el toast es de éxito", async () => {
    mocks.registrarDiligencia.mockResolvedValue({ dsusId: 9, docId: 900 });

    render(
      <ModalRegistrarDiligencia
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /FALLIDA/ }));
    fireEvent.change(screen.getByLabelText(/qué pasó/i), {
      target: { value: "El administrado negó el acceso al predio." },
    });
    adjuntar(PDF());

    fireEvent.click(boton(/registrar la diligencia/i));

    await waitFor(() =>
      expect(mocks.registrarDiligencia).toHaveBeenCalledTimes(1),
    );
    expect(mocks.registrarDiligencia.mock.calls[0][1]).toEqual({
      resultado: "FALLIDA",
      motivo: "El administrado negó el acceso al predio.",
    });
    expect(mocks.addToast.mock.calls[0][0]).toBe("success");
    // 🔴 Sin acta no hay fila, pero con ella el fallo no se pinta como fallo del sistema.
    expect(document.querySelector(".alert-error")).toBeNull();
  });

  it("el acta se pide como endurecimiento DEL PROYECTO, y la pantalla lo dice así", () => {
    render(
      <ModalRegistrarDiligencia
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/el proyecto/i)).toBeInTheDocument();
    expect(screen.getByText(/actividad 14/i)).toBeInTheDocument();
  });

  it("sin acta no se puede registrar: sin papel no hay fila", () => {
    render(
      <ModalRegistrarDiligencia
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /EJECUTADA/ }));
    fireEvent.change(screen.getByLabelText(/qué pasó/i), {
      target: { value: "Se derrocó la ampliación no autorizada." },
    });

    expect(boton(/registrar la diligencia/i)).toBeDisabled();
    fireEvent.click(boton(/registrar la diligencia/i));
    expect(mocks.registrarDiligencia).not.toHaveBeenCalled();
  });
});

describe("ModalRespaldoCostos — el primer paso de dos", () => {
  it("🔴 al terminar canta el identificador del documento y dice que falta el paso 2", async () => {
    mocks.respaldoCostos.mockResolvedValue({ docId: 733 });
    const onClose = vi.fn();

    render(
      <ModalRespaldoCostos
        caseData={FILA}
        onClose={onClose}
      />,
    );

    adjuntar(PDF("liquidacion.pdf"));
    fireEvent.click(boton(/subir el respaldo/i));

    expect(await screen.findByText("733")).toBeInTheDocument();
    expect(screen.getByText(/Falta el paso 2/i)).toBeInTheDocument();
    // No se cierra solo: el identificador es lo que el segundo paso va a pedir.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("un rechazo del servidor sale en el aviso flotante, sin caja en el modal, y el modal sigue abierto (quick 261028-kmg)", async () => {
    mocks.respaldoCostos.mockRejectedValue(
      errorDelServidor("El expediente no está en ejecución sustitutoria."),
    );
    const onClose = vi.fn();

    render(
      <ModalRespaldoCostos
        caseData={FILA}
        onClose={onClose}
      />,
    );

    adjuntar(PDF("liquidacion.pdf"));
    fireEvent.click(boton(/subir el respaldo/i));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "El expediente no está en ejecución sustitutoria.",
      ),
    );
    expect(
      screen.queryByText("El expediente no está en ejecución sustitutoria."),
    ).toBeNull();
    expect(boton(/subir el respaldo/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * Un modal de la escalada: cómo se monta, qué servicio escribe, cómo se rellena y se envía, y su
 * resultado. Rellenar (que puede esperar a los selectores) y enviar (un clic) van separados para
 * poder meter SOLO el clic en `act`: la respuesta del servicio llega en el tick siguiente.
 */
type CasoDeEscalada = {
  nombre: string;
  montar: (onClose: () => void) => void;
  servicio: ReturnType<typeof vi.fn>;
  rellenar: () => Promise<void>;
  enviar: () => void;
  respuesta: unknown;
  titulo: RegExp;
};

const LOS_CUATRO_CASOS: CasoDeEscalada[] = [
  {
    nombre: "Ordenar sustitutoria",
    montar: (onClose) =>
      render(<ModalOrdenarSustitutoria caseData={FILA} onClose={onClose} />),
    servicio: mocks.ordenarSustitutoria,
    rellenar: async () => {
      await screen.findByRole("option", { name: /Providencia de cobro/i });
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "501" },
      });
    },
    enviar: () => fireEvent.click(boton(/ordenar la sustitutoria/i)),
    respuesta: { multasCompulsoriasRegistradas: 3, advertencias: [] },
    titulo: /la orden quedó registrada/i,
  },
  {
    nombre: "Diligencia",
    montar: (onClose) =>
      render(<ModalRegistrarDiligencia caseData={FILA} onClose={onClose} />),
    servicio: mocks.registrarDiligencia,
    rellenar: async () => {
      fireEvent.click(screen.getByRole("radio", { name: /FALLIDA/ }));
      fireEvent.change(screen.getByLabelText(/qué pasó/i), {
        target: { value: "El administrado negó el acceso al predio." },
      });
      adjuntar(PDF());
    },
    enviar: () => fireEvent.click(boton(/registrar la diligencia/i)),
    respuesta: { dsusId: 9, docId: 900 },
    titulo: /la diligencia quedó registrada/i,
  },
  {
    nombre: "Respaldo de costos",
    montar: (onClose) =>
      render(<ModalRespaldoCostos caseData={FILA} onClose={onClose} />),
    servicio: mocks.respaldoCostos,
    rellenar: async () => {
      adjuntar(PDF("liquidacion.pdf"));
    },
    enviar: () => fireEvent.click(boton(/subir el respaldo/i)),
    respuesta: { docId: 733 },
    titulo: /el respaldo quedó incorporado/i,
  },
  {
    nombre: "Gastos de la sustitutoria",
    montar: (onClose) =>
      render(<ModalGastosSustitutoria caseData={FILA} onClose={onClose} />),
    servicio: mocks.registrarGastosSustitutoria,
    rellenar: rellenarGastos,
    enviar: () => fireEvent.click(boton(/registrar los gastos/i)),
    respuesta: DESGLOSE,
    titulo: /el costo quedó trasladado/i,
  },
];

const casosDeEscalada = LOS_CUATRO_CASOS.map(
  (caso) => [caso.nombre, caso] as const,
);

describe("Los cuatro de la escalada — salir sin escribir y salir del resultado (quick 261014-lhu)", () => {
  it.each(casosDeEscalada)(
    "%s: «Cancelar» cierra y no escribe",
    async (_nombre, caso) => {
      const onClose = vi.fn();
      caso.montar(onClose);
      // Los selectores de documento leen al montar: se deja llegar la lectura dentro de `act`.
      await act(async () => undefined);

      fireEvent.click(boton(/^cancelar$/i));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mocks.ordenarSustitutoria).not.toHaveBeenCalled();
      expect(mocks.registrarDiligencia).not.toHaveBeenCalled();
      expect(mocks.respaldoCostos).not.toHaveBeenCalled();
      expect(mocks.registrarGastosSustitutoria).not.toHaveBeenCalled();
    },
  );

  it.each(casosDeEscalada)(
    "%s: «Cancelar» y la × se apagan mientras el acto viaja",
    async (_nombre, caso) => {
      caso.servicio.mockReturnValue(new Promise(() => undefined));
      const onClose = vi.fn();
      caso.montar(onClose);

      await caso.rellenar();
      caso.enviar();

      await waitFor(() => expect(boton(/^cancelar$/i)).toBeDisabled());
      expect(boton(/cerrar modal/i)).toBeDisabled();
      fireEvent.click(boton(/^cancelar$/i));
      fireEvent.click(boton(/cerrar modal/i));
      expect(onClose).not.toHaveBeenCalled();
      expect(caso.servicio).toHaveBeenCalledTimes(1);
    },
  );

  it.each(casosDeEscalada)(
    "%s: el resultado ofrece «Volver a la ficha» —y no vuelve al formulario—; pulsarlo solo cierra",
    async (_nombre, caso) => {
      caso.servicio.mockResolvedValue(caso.respuesta);
      const onClose = vi.fn();
      caso.montar(onClose);

      await caso.rellenar();
      await act(async () => caso.enviar());
      expect(
        await screen.findByRole("heading", { name: caso.titulo }),
      ).toBeInTheDocument();

      expect(boton(/volver a la ficha/i)).toBeEnabled();
      expect(screen.queryByRole("button", { name: /cancelar/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /entendido/i })).toBeNull();
      expect(document.querySelector('input[type="file"]')).toBeNull();

      fireEvent.click(boton(/volver a la ficha/i));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(caso.servicio).toHaveBeenCalledTimes(1);
    },
  );

  it.each(casosDeEscalada)(
    "%s: la × del resultado solo cierra",
    async (_nombre, caso) => {
      caso.servicio.mockResolvedValue(caso.respuesta);
      const onClose = vi.fn();
      caso.montar(onClose);

      await caso.rellenar();
      await act(async () => caso.enviar());
      await screen.findByRole("heading", { name: caso.titulo });

      fireEvent.click(boton(/cerrar modal/i));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(caso.servicio).toHaveBeenCalledTimes(1);
    },
  );
});
