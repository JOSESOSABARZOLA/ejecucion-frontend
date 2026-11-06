/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05)
 * Archivo: modalesCumplimiento.test.tsx
 * Responsabilidad: Fijar la conducta de los seis modales del tramo del cumplimiento y, sobre todo,
 *   **que los dos extremos del despacho sigan alineados**.
 *
 *   ── LA BARRERA CONTRA «ACCIÓN NO DISPONIBLE» ─────────────────────────────────────────────────
 *   🔴 El primer caso recorre los SEIS nombres de acción y afirma que `ACCION_A_MODAL` los resuelve
 *   y que la clave resultante existe en `modalRegistry`. Ése es exactamente el fallo que produce el
 *   toast «Acción no disponible, porfavor comuníquese con el administrador»: el nombre está en el
 *   catálogo del backend y en el motor de reglas, el botón se pinta, y al pulsarlo no hay modal
 *   detrás. Sin este caso, el desalineamiento solo se descubre pulsando.
 *
 *   Las otras cinco conductas son las cinco maneras en que estos modales se rompen en producción:
 *   que un fallo del servidor cierre el modal y se lleve por delante lo que el decisor escribió,
 *   que un envío correcto no recargue la bandeja, que se pueda deshacer una declaración sin motivo,
 *   que un archivo que no es PDF llegue al servicio, y que la acreditación pida un número tecleado
 *   en vez de citar un documento de la lista.
 *
 *   ⚠️ `react-pdf` se simula porque `modalRegistry` arrastra el visor de documentos y `pdfjs-dist`
 *   necesita `DOMMatrix`, que jsdom no tiene. Lo que aquí importa del registro son sus CLAVES.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-lhu: volver entre la subida y la conclusión
 *   del informe, y «Cancelar» de los seis fijado con pruebas)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: los fallos del servidor se afirman en
 *   el aviso flotante y sin caja; el paso 2 del informe ya no repite que quedó adjunto)
 */
import { errorDelServidor } from "../../test/errores";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  declarar: vi.fn(),
  deshacer: vi.fn(),
  acreditar: vi.fn(),
  constatarIncumplimiento: vi.fn(),
  adjuntarInforme: vi.fn(),
  registrarAlegacion: vi.fn(),
  detalle: vi.fn(),
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
    declarar: mocks.declarar,
    deshacer: mocks.deshacer,
    acreditar: mocks.acreditar,
    constatarIncumplimiento: mocks.constatarIncumplimiento,
    adjuntarInforme: mocks.adjuntarInforme,
    registrarAlegacion: mocks.registrarAlegacion,
    detalle: mocks.detalle,
  },
  SUBIDA_TIMEOUT_MS: 45000,
}));

vi.mock("../../services/EpasService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/EpasService")>()),
  EpasService: { getDocumentos: mocks.getDocumentos },
}));

import { modalRegistry } from "../../interfaces/IModal";
import { ACCION_A_MODAL, resolverModalDeAccion } from "../tabla/RowActions";
import ModalDeclararHacer, {
  MODAL_KEY as DECLARAR,
} from "./ModalDeclararHacer";
import ModalDeshacerHacer, {
  MODAL_KEY as DESHACER,
} from "./ModalDeshacerHacer";
import ModalConstatarIncumplimiento, {
  MODAL_KEY as CONSTATAR,
} from "./ModalConstatarIncumplimiento";
import ModalAdjuntarInforme, {
  MODAL_KEY as ADJUNTAR_INFORME,
} from "./ModalAdjuntarInforme";
import ModalAcreditarCumplimiento, {
  MODAL_KEY as ACREDITAR,
} from "./ModalAcreditarCumplimiento";
import ModalRegistrarAlegacion, {
  MODAL_KEY as REGISTRAR_ALEGACION,
} from "./ModalRegistrarAlegacion";
import type {
  ObligacionHacerEnBandeja,
  TerminoAlegacion,
} from "../../interfaces/IObligacionHacer";

/** Los seis nombres de acción del tramo, tal como los declara `POLITICA_ACCIONES` (Plan 04). */
const LOS_SEIS = [
  DECLARAR,
  DESHACER,
  CONSTATAR,
  ADJUNTAR_INFORME,
  ACREDITAR,
  REGISTRAR_ALEGACION,
] as const;

const FILA = {
  eejeId: 77,
  expNumber: "EPAS-2026-0077",
  admiName: "Rosa",
  admiLastname: "Pilataxi",
};

/** El término tal y como lo DERIVA el servidor. Ninguno de sus valores se recalcula en pantalla. */
const TERMINO: TerminoAlegacion = {
  estado: "EN_CURSO",
  motivo: null,
  trasladoDocId: 31,
  trasladoEmitidoAt: "2026-09-01T10:00:00.000Z",
  arrancaAt: "2026-09-03T10:00:00.000Z",
  arrancoPorAgotamiento: false,
  plazoDias: 10,
  venceAt: "2026-09-17T10:00:00.000Z",
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

/** El bloque completo de la rama tal y como viaja en la fila (con término). */
const OBLIGACION_HACER: ObligacionHacerEnBandeja = {
  tiene: true,
  cumplida: false,
  cumplidaAt: null,
  multasCompulsorias: 0,
  tieneInforme: true,
  sustitutoriaOrdenada: false,
  terminoAlegacion: TERMINO,
};

/** La fila con un informe SIN conclusión (documento 640): el modal del informe abre en la conclusión. */
const PENDIENTE = {
  ...FILA,
  obligacionHacer: {
    ...OBLIGACION_HACER,
    informeDocId: 640,
    informeSinConclusion: true,
  },
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

const PDF = () =>
  new File(["%PDF-1.4"], "informe.pdf", { type: "application/pdf" });
const NO_PDF = () =>
  new File(["fotito"], "informe.jpg", { type: "image/jpeg" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDocumentos.mockResolvedValue([
    {
      docId: 501,
      docName: "Informe de control y verificación",
      tdocTypeName: "Informe",
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

describe("Los seis del tramo del cumplimiento — despacho", () => {
  it("🔴 los SEIS nombres de acción resuelven a una clave que existe en el registro de modales", () => {
    for (const nombre of LOS_SEIS) {
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

  it("los seis tienen entrada PROPIA en ACCION_A_MODAL, no solo coincidencia de nombre", () => {
    for (const nombre of LOS_SEIS) {
      expect(
        Object.prototype.hasOwnProperty.call(ACCION_A_MODAL, nombre),
        `«${nombre}» no está anotado en ACCION_A_MODAL`,
      ).toBe(true);
    }
  });

  it("el registro no tiene ni una clave sin componente: sigue siendo TOTAL", () => {
    const huecos = Object.entries(modalRegistry).filter(
      ([, componente]) => typeof componente !== "function",
    );
    expect(huecos.map(([clave]) => clave)).toEqual([]);
  });
});

describe("ModalDeclararHacer — el error sale en el aviso flotante y el éxito recarga", () => {
  it("🔴 un envío que FALLA deja el modal abierto, en el FORMULARIO, y dice el error en el aviso flotante (sin caja)", async () => {
    mocks.declarar.mockRejectedValue(errorDelServidor("No es su expediente."));
    const onClose = vi.fn();

    render(
      <ModalDeclararHacer
        caseData={FILA}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Retirar la valla publicitaria" },
    });
    fireEvent.click(boton(/^declarar$/i));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("error", "No es su expediente."),
    );
    expect(screen.queryByText("No es su expediente.")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    // Sin pantalla intermedia: sigue el formulario, con lo escrito intacto y el botón del acto.
    expect(screen.queryByText(/revise antes/i)).toBeNull();
    expect(screen.getByRole("textbox")).toHaveValue(
      "Retirar la valla publicitaria",
    );
    expect(boton(/^declarar$/i)).toBeEnabled();
  });

  it("🔴 dos clics seguidos con el envío en curso mandan el acto UNA sola vez", async () => {
    let resolver: () => void = () => undefined;
    mocks.declarar.mockReturnValue(
      new Promise<void>((r) => {
        resolver = r;
      }),
    );
    const onClose = vi.fn();

    render(
      <ModalDeclararHacer
        caseData={FILA}
        onClose={onClose}
      />,
    );

    fireEvent.click(boton(/^declarar$/i));
    fireEvent.click(boton(/declarando/i));

    expect(mocks.declarar).toHaveBeenCalledTimes(1);
    expect(boton(/declarando/i)).toBeDisabled();
    expect(boton(/cancelar/i)).toBeDisabled();
    expect(boton(/cerrar modal/i)).toBeDisabled();

    resolver();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.declarar).toHaveBeenCalledTimes(1);
  });

  it("un envío CORRECTO dispara la recarga de la bandeja y cierra", async () => {
    mocks.declarar.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const refetchFn = vi.fn().mockResolvedValue(undefined);

    render(
      <ModalDeclararHacer
        caseData={FILA}
        onClose={onClose}
        refetchFn={refetchFn}
      />,
    );

    fireEvent.click(boton(/^declarar$/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.declarar).toHaveBeenCalledWith(77, {});
    expect(refetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("ModalDeshacerHacer — sin motivo no se deshace", () => {
  it("🔴 con el motivo VACÍO no se puede enviar", () => {
    render(
      <ModalDeshacerHacer
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    expect(boton(/deshacer la declaración/i)).toBeDisabled();

    fireEvent.click(boton(/deshacer la declaración/i));
    expect(mocks.deshacer).not.toHaveBeenCalled();
  });

  it("un motivo demasiado corto se avisa EN EL FORMULARIO, no con el 400 del servidor", () => {
    render(
      <ModalDeshacerHacer
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "error" },
    });

    expect(screen.getByText(/mínimo 10 caracteres/i)).toBeInTheDocument();
    expect(boton(/deshacer la declaración/i)).toBeDisabled();
    expect(mocks.deshacer).not.toHaveBeenCalled();
  });

  it("con un motivo suficiente, el cuerpo lleva el motivo recortado y nada más", async () => {
    mocks.deshacer.mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ModalDeshacerHacer
        caseData={FILA}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Se declaró sobre el expediente equivocado.  " },
    });
    fireEvent.click(boton(/deshacer la declaración/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.deshacer).toHaveBeenCalledWith(77, {
      motivo: "Se declaró sobre el expediente equivocado.",
    });
  });
});

describe("ModalAdjuntarInforme — subir es un clic, sin pantalla de revisión", () => {
  it("🔴 un archivo que NO es PDF se rechaza ANTES de llamar al servicio", () => {
    render(
      <ModalAdjuntarInforme
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    adjuntar(NO_PDF());

    expect(screen.getByText(/tiene que ser un PDF/i)).toBeInTheDocument();
    expect(boton(/subir el informe/i)).toBeDisabled();
    expect(mocks.adjuntarInforme).not.toHaveBeenCalled();
  });

  it("🔴 «Subir el informe» sube DIRECTO (el File tal cual) y pasa a la conclusión sin cerrar", async () => {
    mocks.adjuntarInforme.mockResolvedValue({ docId: 900 });
    const onClose = vi.fn();
    const archivo = PDF();

    render(
      <ModalAdjuntarInforme
        caseData={FILA}
        onClose={onClose}
      />,
    );

    adjuntar(archivo);
    fireEvent.click(boton(/subir el informe/i));

    expect(
      await screen.findByRole("heading", { name: /qué concluye el informe/i }),
    ).toBeInTheDocument();
    expect(mocks.adjuntarInforme).toHaveBeenCalledTimes(1);
    expect(mocks.adjuntarInforme).toHaveBeenCalledWith(77, archivo);
    expect(onClose).not.toHaveBeenCalled();

    // Que quedó adjunto lo dice el aviso de éxito; el paso 2 no lo repite y enseña su guía.
    expect(mocks.addToast).toHaveBeenCalledWith(
      "success",
      expect.stringMatching(/^Informe de verificación adjunto al expediente/),
    );
    expect(screen.queryByText(/El informe quedó adjunto/)).toBeNull();
    expect(
      screen.getByText(
        "Registre qué concluye el informe de verificación (documento 900) según lo que informó la DMIP, citándolo como prueba.",
      ),
    ).toBeInTheDocument();
  });

  it("un error al subir sale en el aviso flotante (sin caja) y el modal sigue en la subida", async () => {
    mocks.adjuntarInforme.mockRejectedValue(errorDelServidor("El PDF pesa demasiado."));
    const onClose = vi.fn();

    render(
      <ModalAdjuntarInforme
        caseData={FILA}
        onClose={onClose}
      />,
    );

    adjuntar(PDF());
    fireEvent.click(boton(/subir el informe/i));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("error", "El PDF pesa demasiado."),
    );
    expect(screen.queryByText(/el pdf pesa demasiado/i)).toBeNull();
    expect(boton(/subir el informe/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /qué concluye el informe/i })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("la × sin subida previa solo cierra: no hay nada que recargar", async () => {
    const onClose = vi.fn();
    const refetchFn = vi.fn().mockResolvedValue(undefined);

    render(
      <ModalAdjuntarInforme
        caseData={FILA}
        onClose={onClose}
        refetchFn={refetchFn}
      />,
    );

    fireEvent.click(boton(/cerrar modal/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(refetchFn).not.toHaveBeenCalled();
  });
});

describe("ModalAdjuntarInforme — la conclusión se registra en línea, con un solo botón", () => {
  const subirInforme = async (
    onClose = vi.fn(),
    refetchFn = vi.fn().mockResolvedValue(undefined),
  ) => {
    mocks.adjuntarInforme.mockResolvedValue({ docId: 900 });
    render(
      <ModalAdjuntarInforme
        caseData={FILA}
        onClose={onClose}
        refetchFn={refetchFn}
      />,
    );
    adjuntar(PDF());
    fireEvent.click(boton(/subir el informe/i));
    await screen.findByRole("heading", { name: /qué concluye el informe/i });
    return { onClose, refetchFn };
  };

  it("«Registrar conclusión» está apagado hasta elegir Cumple o Incumple", async () => {
    await subirInforme();
    expect(boton(/registrar conclusión/i)).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /^cumple/i }));
    expect(boton(/registrar conclusión/i)).toBeEnabled();
  });

  it("🔴 «Cumple» acredita citando el informe RECIÉN SUBIDO, sin selector ni segunda confirmación", async () => {
    mocks.acreditar.mockResolvedValue(undefined);
    const { onClose, refetchFn } = await subirInforme();

    fireEvent.click(screen.getByRole("radio", { name: /^cumple/i }));
    fireEvent.click(boton(/registrar conclusión/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.acreditar).toHaveBeenCalledWith(77, { docId: 900 });
    expect(mocks.constatarIncumplimiento).not.toHaveBeenCalled();
    expect(mocks.getDocumentos).not.toHaveBeenCalled();
    expect(refetchFn).toHaveBeenCalled();
  });

  it("🔴 «Incumple» constata citando el informe RECIÉN SUBIDO, recarga y cierra", async () => {
    mocks.constatarIncumplimiento.mockResolvedValue(undefined);
    const { onClose, refetchFn } = await subirInforme();

    fireEvent.click(screen.getByRole("radio", { name: /^incumple/i }));
    fireEvent.click(boton(/registrar conclusión/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.constatarIncumplimiento).toHaveBeenCalledWith(77, {
      docId: 900,
    });
    expect(mocks.acreditar).not.toHaveBeenCalled();
    expect(refetchFn).toHaveBeenCalled();
  });

  it("un error al registrar sale en el aviso flotante (sin caja) y el modal sigue en la conclusión", async () => {
    mocks.acreditar.mockRejectedValue(errorDelServidor("No es su decisor"));
    const { onClose } = await subirInforme();

    fireEvent.click(screen.getByRole("radio", { name: /^cumple/i }));
    fireEvent.click(boton(/registrar conclusión/i));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("error", "No es su decisor"),
    );
    expect(screen.queryByText(/no es su decisor/i)).toBeNull();
    expect(screen.getByRole("heading", { name: /qué concluye el informe/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^cumple/i })).toBeChecked();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cerrar con la × tras subir no decide nada, pero recarga: el informe ya está en el expediente", async () => {
    const { onClose, refetchFn } = await subirInforme();

    fireEvent.click(boton(/cerrar modal/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(refetchFn).toHaveBeenCalledTimes(1);
    expect(mocks.acreditar).not.toHaveBeenCalled();
    expect(mocks.constatarIncumplimiento).not.toHaveBeenCalled();
  });
});

describe("ModalAdjuntarInforme — se RETOMA si el informe quedó sin conclusión", () => {
  it("🔴 abre directo en la conclusión citando el informe pendiente, sin subir otro PDF", async () => {
    mocks.constatarIncumplimiento.mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ModalAdjuntarInforme
        caseData={PENDIENTE}
        onClose={onClose}
        refetchFn={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("heading", { name: /qué concluye el informe/i })).toBeInTheDocument();
    expect(screen.getByText(/documento 640/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /^incumple/i }));
    fireEvent.click(boton(/registrar conclusión/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.constatarIncumplimiento).toHaveBeenCalledWith(77, {
      docId: 640,
    });
    expect(mocks.adjuntarInforme).not.toHaveBeenCalled();
  });

  it("«Volver a la subida» vuelve a la subida, y la conclusión cita el NUEVO", async () => {
    mocks.adjuntarInforme.mockResolvedValue({ docId: 901 });
    mocks.acreditar.mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ModalAdjuntarInforme
        caseData={PENDIENTE}
        onClose={onClose}
        refetchFn={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(boton(/volver a la subida/i));

    expect(document.querySelector('input[type="file"]')).not.toBeNull();
    expect(boton(/subir el informe/i)).toBeDisabled();
    // La subida avisa de que el pendiente SIGUE adjunto, y volver no ha escrito nada.
    expect(screen.getByText(/documento 640/i)).toBeInTheDocument();
    expect(mocks.adjuntarInforme).not.toHaveBeenCalled();
    expect(mocks.acreditar).not.toHaveBeenCalled();
    expect(mocks.constatarIncumplimiento).not.toHaveBeenCalled();

    adjuntar(PDF());
    fireEvent.click(boton(/subir el informe/i));
    expect(await screen.findByText(/documento 901/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /^cumple/i }));
    fireEvent.click(boton(/registrar conclusión/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.acreditar).toHaveBeenCalledWith(77, { docId: 901 });
  });

  it("sin informe pendiente (false, bloque ausente o docId nulo) abre en la subida", () => {
    const casos = [
      { ...FILA, obligacionHacer: { ...OBLIGACION_HACER, informeSinConclusion: false, informeDocId: 640 } },
      FILA,
      { ...FILA, obligacionHacer: { ...OBLIGACION_HACER, informeSinConclusion: true, informeDocId: null } },
    ];
    for (const caseData of casos) {
      const { unmount } = render(
        <ModalAdjuntarInforme
          caseData={caseData}
          onClose={vi.fn()}
        />,
      );
      expect(boton(/subir el informe/i)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /qué concluye el informe/i })).toBeNull();
      unmount();
    }
  });
});

describe("ModalAcreditarCumplimiento — se cita de una lista, no de un número", () => {
  it("🔴 no hay ninguna caja de número: el documento se elige de los del expediente", async () => {
    const { container } = render(
      <ModalAcreditarCumplimiento
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(mocks.getDocumentos).toHaveBeenCalledWith(77),
    );

    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
  });

  it("el docId que viaja es el ELEGIDO en la lista", async () => {
    mocks.acreditar.mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ModalAcreditarCumplimiento
        caseData={FILA}
        onClose={onClose}
      />,
    );

    const selector = await screen.findByRole("combobox");
    await waitFor(() => expect(selector).not.toBeDisabled());
    fireEvent.change(selector, { target: { value: "502" } });

    fireEvent.click(boton(/acreditar el cumplimiento/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.acreditar).toHaveBeenCalledWith(77, { docId: 502 });
  });
});

describe("ModalConstatarIncumplimiento — dice lo que de verdad hace", () => {
  it("advierte que NO mueve el expediente de estado", async () => {
    render(
      <ModalConstatarIncumplimiento
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.getDocumentos).toHaveBeenCalledWith(77));
    expect(
      screen.getByText(/no mueve el expediente de estado/i),
    ).toBeInTheDocument();
  });
});

describe("ModalRegistrarAlegacion — el término se pinta, no se calcula", () => {
  it("🔴 los días restantes son los del servidor, tal cual, sin restar fechas", () => {
    render(
      <ModalRegistrarAlegacion
        caseData={{
          ...FILA,
          obligacionHacer: OBLIGACION_HACER,
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("4 días hábiles")).toBeInTheDocument();
    expect(screen.getByText("10 días hábiles")).toBeInTheDocument();
    // La ficha viene de la FILA: no hace falta ir a buscar el detalle.
    expect(mocks.detalle).not.toHaveBeenCalled();
  });

  it("sin el escrito en PDF no se puede ingresar: el escrito ES el hecho", () => {
    mocks.detalle.mockResolvedValue({ terminoAlegacion: TERMINO });

    render(
      <ModalRegistrarAlegacion
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    expect(boton(/ingresar el escrito/i)).toBeDisabled();
    expect(mocks.registrarAlegacion).not.toHaveBeenCalled();
  });

  it("con el PDF, el escrito viaja y las observaciones vacías NO se inyectan en el cuerpo", async () => {
    mocks.detalle.mockResolvedValue({ terminoAlegacion: TERMINO });
    mocks.registrarAlegacion.mockResolvedValue({ docId: 910 });
    const onClose = vi.fn();
    const archivo = PDF();

    render(
      <ModalRegistrarAlegacion
        caseData={FILA}
        onClose={onClose}
      />,
    );

    adjuntar(archivo);
    fireEvent.click(boton(/ingresar el escrito/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.registrarAlegacion).toHaveBeenCalledWith(77, {}, archivo);
  });
});

describe("ModalAdjuntarInforme — volver entre la subida y la conclusión sin escribir nada (quick 261014-lhu)", () => {
  /** Sube un informe (docId 900) y deja el modal en la conclusión. */
  const subirInforme = async (onClose = vi.fn()) => {
    mocks.adjuntarInforme.mockResolvedValue({ docId: 900 });
    render(
      <ModalAdjuntarInforme
        caseData={FILA}
        onClose={onClose}
        refetchFn={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    adjuntar(PDF());
    fireEvent.click(boton(/subir el informe/i));
    await screen.findByRole("heading", { name: /qué concluye el informe/i });
    return { onClose };
  };

  it("🔴 tras subir, «Volver a la subida» avisa de que el informe SIGUE adjunto y «Volver a la conclusión» lo vuelve a citar, sin llamar a nada", async () => {
    mocks.acreditar.mockResolvedValue(undefined);
    const { onClose } = await subirInforme();

    fireEvent.click(boton(/volver a la subida/i));

    expect(document.querySelector('input[type="file"]')).not.toBeNull();
    expect(screen.getByText(/documento 900/i)).toHaveTextContent(
      /sigue adjunto/i,
    );
    expect(mocks.adjuntarInforme).toHaveBeenCalledTimes(1);
    expect(mocks.acreditar).not.toHaveBeenCalled();
    expect(mocks.constatarIncumplimiento).not.toHaveBeenCalled();

    fireEvent.click(boton(/volver a la conclusión/i));

    expect(screen.getByRole("heading", { name: /qué concluye el informe/i })).toBeInTheDocument();
    expect(screen.getByText(/documento 900/i)).toBeInTheDocument();
    expect(mocks.adjuntarInforme).toHaveBeenCalledTimes(1);
    expect(mocks.acreditar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /^cumple/i }));
    fireEvent.click(boton(/registrar conclusión/i));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.acreditar).toHaveBeenCalledWith(77, { docId: 900 });
    expect(mocks.adjuntarInforme).toHaveBeenCalledTimes(1);
  });

  it("con el informe pendiente, ir a la subida y volver deja la conclusión citando el 640 sin llamar a NINGÚN servicio", () => {
    render(
      <ModalAdjuntarInforme
        caseData={PENDIENTE}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /subir otro informe/i })).toBeNull();

    fireEvent.click(boton(/volver a la subida/i));
    expect(screen.queryByRole("button", { name: /subir otro informe/i })).toBeNull();
    fireEvent.click(boton(/volver a la conclusión/i));

    expect(screen.getByRole("heading", { name: /qué concluye el informe/i })).toBeInTheDocument();
    expect(screen.getByText(/documento 640/i)).toBeInTheDocument();
    expect(mocks.adjuntarInforme).not.toHaveBeenCalled();
    expect(mocks.acreditar).not.toHaveBeenCalled();
    expect(mocks.constatarIncumplimiento).not.toHaveBeenCalled();
  });

  it("«Volver a la subida» se apaga mientras se registra la conclusión", async () => {
    await subirInforme();
    mocks.acreditar.mockReturnValue(new Promise(() => undefined));

    fireEvent.click(screen.getByRole("radio", { name: /^cumple/i }));
    fireEvent.click(boton(/registrar conclusión/i));

    await waitFor(() => expect(boton(/volver a la subida/i)).toBeDisabled());
  });

  it("«Volver a la conclusión» se apaga mientras se sube otro informe", async () => {
    mocks.adjuntarInforme.mockReturnValue(new Promise(() => undefined));
    render(
      <ModalAdjuntarInforme
        caseData={PENDIENTE}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(boton(/volver a la subida/i));
    adjuntar(PDF());
    fireEvent.click(boton(/subir el informe/i));

    await waitFor(() =>
      expect(boton(/volver a la conclusión/i)).toBeDisabled(),
    );
  });

  it("en una apertura sin informe citado, la subida NO ofrece «Volver a la conclusión»", () => {
    render(
      <ModalAdjuntarInforme
        caseData={FILA}
        onClose={vi.fn()}
      />,
    );

    expect(boton(/subir el informe/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /volver a la conclusión/i }),
    ).toBeNull();
  });
});

/** Un modal del cumplimiento, cómo se monta, qué servicio escribe y cómo se rellena y envía. */
type CasoDeSalida = {
  nombre: string;
  montar: (onClose: () => void) => void;
  servicio: ReturnType<typeof vi.fn>;
  rellenarYEnviar: () => Promise<void>;
};

/** Espera a que el selector de documentos esté poblado y elige el 502. */
const elegirDocumento502 = async () => {
  const selector = await screen.findByRole("combobox");
  await waitFor(() => expect(selector).not.toBeDisabled());
  fireEvent.change(selector, { target: { value: "502" } });
};

const LOS_SEIS_CASOS: CasoDeSalida[] = [
  {
    nombre: "Declarar",
    montar: (onClose) =>
      render(<ModalDeclararHacer caseData={FILA} onClose={onClose} />),
    servicio: mocks.declarar,
    rellenarYEnviar: async () => {
      fireEvent.click(boton(/^declarar$/i));
    },
  },
  {
    nombre: "Deshacer",
    montar: (onClose) =>
      render(<ModalDeshacerHacer caseData={FILA} onClose={onClose} />),
    servicio: mocks.deshacer,
    rellenarYEnviar: async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Se declaró sobre el expediente equivocado." },
      });
      fireEvent.click(boton(/deshacer la declaración/i));
    },
  },
  {
    nombre: "Informe",
    montar: (onClose) =>
      render(<ModalAdjuntarInforme caseData={FILA} onClose={onClose} />),
    servicio: mocks.adjuntarInforme,
    rellenarYEnviar: async () => {
      adjuntar(PDF());
      fireEvent.click(boton(/subir el informe/i));
    },
  },
  {
    nombre: "Acreditar",
    montar: (onClose) =>
      render(<ModalAcreditarCumplimiento caseData={FILA} onClose={onClose} />),
    servicio: mocks.acreditar,
    rellenarYEnviar: async () => {
      await elegirDocumento502();
      fireEvent.click(boton(/acreditar el cumplimiento/i));
    },
  },
  {
    nombre: "Constatar",
    montar: (onClose) =>
      render(
        <ModalConstatarIncumplimiento caseData={FILA} onClose={onClose} />,
      ),
    servicio: mocks.constatarIncumplimiento,
    rellenarYEnviar: async () => {
      await elegirDocumento502();
      fireEvent.click(boton(/registrar la constatación/i));
    },
  },
  {
    nombre: "Alegación",
    // Con el bloque de la rama en la fila: el modal no tiene que leer el detalle.
    montar: (onClose) =>
      render(
        <ModalRegistrarAlegacion
          caseData={{ ...FILA, obligacionHacer: OBLIGACION_HACER }}
          onClose={onClose}
        />,
      ),
    servicio: mocks.registrarAlegacion,
    rellenarYEnviar: async () => {
      adjuntar(PDF());
      fireEvent.click(boton(/ingresar el escrito/i));
    },
  },
];

describe("Los seis del cumplimiento — salir sin escribir (quick 261014-lhu)", () => {
  it.each(LOS_SEIS_CASOS.map((caso) => [caso.nombre, caso] as const))(
    "%s: «Cancelar» cierra y no escribe",
    async (_nombre, caso) => {
      const onClose = vi.fn();
      caso.montar(onClose);

      fireEvent.click(boton(/^cancelar$/i));

      // El del informe cierra de forma asíncrona (recarga si hubo subida).
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(mocks.declarar).not.toHaveBeenCalled();
      expect(mocks.deshacer).not.toHaveBeenCalled();
      expect(mocks.acreditar).not.toHaveBeenCalled();
      expect(mocks.constatarIncumplimiento).not.toHaveBeenCalled();
      expect(mocks.adjuntarInforme).not.toHaveBeenCalled();
      expect(mocks.registrarAlegacion).not.toHaveBeenCalled();
    },
  );

  it.each(LOS_SEIS_CASOS.map((caso) => [caso.nombre, caso] as const))(
    "%s: «Cancelar» y la × se apagan mientras el acto viaja",
    async (_nombre, caso) => {
      caso.servicio.mockReturnValue(new Promise(() => undefined));
      const onClose = vi.fn();
      caso.montar(onClose);

      await caso.rellenarYEnviar();

      await waitFor(() => expect(boton(/^cancelar$/i)).toBeDisabled());
      expect(boton(/cerrar modal/i)).toBeDisabled();
      fireEvent.click(boton(/^cancelar$/i));
      fireEvent.click(boton(/cerrar modal/i));
      expect(onClose).not.toHaveBeenCalled();
      expect(caso.servicio).toHaveBeenCalledTimes(1);
    },
  );
});
