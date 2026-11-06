/**
 * Microservicio: ejecucion
 * Módulo: Impugnación (rama act. 7 de PRO-GEJ-001)
 * Archivo: ImpugnacionAcciones.test.tsx
 * Responsabilidad: Fija la resolución del recurso en la bandeja del decisor. Lo que se protege es el
 *   DATO: el desenlace del recurso no aceptado existe para REPORTAR, así que ningún valor viene
 *   preseleccionado (preseleccionar sesgaría justo la estadística que se quiere medir), no se puede
 *   confirmar sin elegir, y al volver a «acepta» la elección se limpia y NO viaja en el cuerpo.
 *   Y su espejo (2026-10-12): al aceptar se elige el DESTINO —Instrucción, Resolución o Archivo—, sin
 *   preselección y sin el cual no se confirma.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-07
 * Modificado por: Andrés Miño — 2026-10-12 (destino del recurso aceptado)
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 * Modificado por: Andrés Miño — 2026-10-28 (tras confirmar no se puede reenviar; confirmar sube el PDF elegido)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: registrar la impugnación en todo estado
 *   activo que permita el servidor, con la consecuencia antes de confirmar; la sección EN_IMPUGNACION
 *   dice desde cuándo, de dónde viene y a dónde vuelve, y tras resolver queda en el estado devuelto;
 *   el mismo formulario con obligación de hacer; fallo de carga en su hueco)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { MiEpasAsignado } from "../../services/SorteoService";
import type { VistaImpugnacion } from "../../services/ImpugnacionService";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  resolverRecurso: vi.fn(),
  subirResolucion: vi.fn(),
  leerEstado: vi.fn(),
  registrarImpugnacion: vi.fn(),
  iniciarEjecucion: vi.fn(),
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

// Solo se mockean las llamadas HTTP: RECURSO_DESENLACES se importa REAL a propósito, para que el test
// se apoye en el mismo contrato que consume la UI y no en una copia que podría desviarse.
vi.mock("../../services/ImpugnacionService", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../services/ImpugnacionService")
  >()),
  ImpugnacionService: {
    leerEstado: mocks.leerEstado,
    registrarImpugnacion: mocks.registrarImpugnacion,
    iniciarEjecucion: mocks.iniciarEjecucion,
    subirResolucion: mocks.subirResolucion,
    resolverRecurso: mocks.resolverRecurso,
  },
}));

import { ImpugnacionAcciones } from "./ImpugnacionAcciones";

const EPAS: MiEpasAsignado = {
  eejeId: 7,
  eejeStatus: "EN_IMPUGNACION",
  expNumber: "EPAS-001",
  tieneImpugnacion: true,
};

/**
 * La vista del servidor para un estado dado. Por defecto, la de un EPAS suspendido que venía de
 * trabajo comunitario y sin la resolución de esta impugnación adjunta.
 */
const vistaDe = (
  eejeStatus: string,
  extra: Partial<VistaImpugnacion> = {},
): VistaImpugnacion => ({
  eejeStatus,
  entrada:
    eejeStatus === "EN_IMPUGNACION"
      ? {
          permitida: false,
          motivo: "El EPAS 7 ya está en impugnación.",
          estadoAlReanudar: null,
        }
      : { permitida: true, motivo: null, estadoAlReanudar: eejeStatus },
  suspension:
    eejeStatus === "EN_IMPUGNACION"
      ? {
          esusId: 1,
          desde: "2026-10-16T15:00:00.000Z",
          estadoPrevio: "EN_TRABAJO_COMUNITARIO",
          estadoAlReanudar: "EN_TRABAJO_COMUNITARIO",
          origen: "DECISOR",
        }
      : null,
  resolucionAdjunta: false,
  historial: [],
  ...extra,
});

const montar = (row: MiEpasAsignado = EPAS) =>
  render(<ImpugnacionAcciones row={row} onChanged={vi.fn()} />);

const radio = (nombre: RegExp) =>
  screen.getByRole("radio", { name: nombre }) as HTMLInputElement;

const botonConfirmar = () =>
  screen.getByRole("button", { name: /confirmar/i }) as HTMLButtonElement;

describe("ImpugnacionAcciones — resolución del recurso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolverRecurso.mockResolvedValue({
      eejeStatus: "EN_VERIFICACION_PAGO",
    });
    mocks.leerEstado.mockImplementation(() =>
      Promise.resolve(vistaDe("EN_IMPUGNACION")),
    );
  });

  it("no propone respuesta: ni «sí» ni «no» vienen marcados", () => {
    montar();
    expect(radio(/^sí/i).checked).toBe(false);
    expect(radio(/^no/i).checked).toBe(false);
    expect(botonConfirmar().disabled).toBe(true);
  });

  it("el desenlace solo aparece al marcar «no acepta»", () => {
    montar();
    expect(screen.queryByRole("radio", { name: /rechazado/i })).toBeNull();

    fireEvent.click(radio(/^no/i));

    expect(screen.getByRole("radio", { name: /rechazado/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /inadmitido/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /desistido/i })).toBeTruthy();
  });

  it("ningún desenlace viene preseleccionado: es un dato estadístico, no un valor por defecto", () => {
    montar();
    fireEvent.click(radio(/^no/i));

    expect(radio(/rechazado/i).checked).toBe(false);
    expect(radio(/inadmitido/i).checked).toBe(false);
    expect(radio(/desistido/i).checked).toBe(false);
  });

  it("sin desenlace elegido no se puede confirmar", () => {
    montar();
    fireEvent.click(radio(/^no/i));

    expect(botonConfirmar().disabled).toBe(true);

    fireEvent.click(radio(/inadmitido/i));

    expect(botonConfirmar().disabled).toBe(false);
  });

  it("«no acepta» + desenlace → viaja el desenlace elegido", async () => {
    montar();
    fireEvent.click(radio(/^no/i));
    fireEvent.click(radio(/desistido/i));
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.resolverRecurso).toHaveBeenCalledWith(
        7,
        false,
        "DESISTIDO",
        undefined,
      ),
    );
  });

  // ⟳ 2026-10-12: «acepta» ya no se confirma solo — exige el destino. Lo que esta prueba protegía
  // (sin desenlace en el cuerpo) sigue igual.
  it("«acepta» + Instrucción → se confirma sin desenlace y con el destino DMIT", async () => {
    montar();
    fireEvent.click(radio(/^sí/i));

    expect(screen.queryByRole("radio", { name: /rechazado/i })).toBeNull();
    // Sin destino no se confirma.
    expect(botonConfirmar().disabled).toBe(true);

    fireEvent.click(radio(/instrucción/i));
    expect(botonConfirmar().disabled).toBe(false);
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.resolverRecurso).toHaveBeenCalledWith(
        7,
        true,
        undefined,
        "DMIT",
      ),
    );
  });

  it("volver a «acepta» limpia el desenlace ya elegido (no se cuela en el reporte)", async () => {
    montar();
    fireEvent.click(radio(/^no/i));
    fireEvent.click(radio(/rechazado/i));
    fireEvent.click(radio(/^sí/i));

    // Al volver a «no», la elección anterior no reaparece (se comprueba antes de confirmar: tras
    // confirmar el formulario ya no está).
    fireEvent.click(radio(/^no/i));
    expect(radio(/rechazado/i).checked).toBe(false);
    expect(botonConfirmar().disabled).toBe(true);

    fireEvent.click(radio(/^sí/i));
    fireEvent.click(radio(/resolución/i));
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.resolverRecurso).toHaveBeenCalledWith(
        7,
        true,
        undefined,
        "DMR",
      ),
    );
  });

  // ── 261012-giz (2026-10-12): el DESTINO del recurso aceptado ──
  it("el destino solo aparece al marcar «sí», con las tres opciones y NINGUNA marcada", () => {
    montar();
    expect(screen.queryByRole("radio", { name: /instrucción/i })).toBeNull();

    fireEvent.click(radio(/^sí/i));

    expect(radio(/instrucción \(dmit\)/i).checked).toBe(false);
    expect(radio(/resolución \(dmr\)/i).checked).toBe(false);
    expect(radio(/archivo \(secretaría general\)/i).checked).toBe(false);
    expect(botonConfirmar().disabled).toBe(true);
  });

  it("pasar a «no» limpia el destino ya elegido; volver a «sí» no lo trae de vuelta", () => {
    montar();
    fireEvent.click(radio(/^sí/i));
    fireEvent.click(radio(/archivo/i));
    fireEvent.click(radio(/^no/i));

    expect(screen.queryByRole("radio", { name: /archivo/i })).toBeNull();

    fireEvent.click(radio(/^sí/i));
    expect(radio(/archivo/i).checked).toBe(false);
    expect(botonConfirmar().disabled).toBe(true);
  });

  it("un EPAS en RECURSO_ACEPTADO muestra solo lectura: sale por la Bandeja de Salida", () => {
    mocks.leerEstado.mockResolvedValue(vistaDe("RECURSO_ACEPTADO"));
    render(
      <ImpugnacionAcciones
        row={{ ...EPAS, eejeStatus: "RECURSO_ACEPTADO" }}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/recurso aceptado/i).textContent).toMatch(
      /bandeja de salida/i,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("tras confirmar, el formulario desaparece y queda solo lectura: no se puede mandar otra vez", async () => {
    mocks.resolverRecurso.mockResolvedValue({ eejeStatus: "RECURSO_ACEPTADO" });
    montar();
    fireEvent.click(radio(/^sí/i));
    fireEvent.click(radio(/instrucción/i));
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(screen.getByText(/recurso aceptado/i).textContent).toMatch(
        /bandeja de salida/i,
      ),
    );
    expect(screen.queryByRole("button", { name: /confirmar/i })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(mocks.resolverRecurso).toHaveBeenCalledTimes(1);
  });

  it("si la confirmación falla, el formulario sigue con lo respondido para reintentar", async () => {
    mocks.resolverRecurso.mockRejectedValue(new Error("400"));
    montar();
    fireEvent.click(radio(/^sí/i));
    fireEvent.click(radio(/instrucción/i));
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("error", expect.any(String)),
    );
    expect(radio(/instrucción/i).checked).toBe(true);
    expect(botonConfirmar().disabled).toBe(false);
  });

  it("un PDF elegido sin pulsar «Adjuntar» se sube antes de resolver", async () => {
    const { container } = montar();
    const pdf = new File(["%PDF"], "resolucion.pdf", { type: "application/pdf" });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [pdf] },
    });
    fireEvent.click(radio(/^sí/i));
    fireEvent.click(radio(/instrucción/i));
    fireEvent.click(botonConfirmar());

    await waitFor(() => expect(mocks.resolverRecurso).toHaveBeenCalled());
    expect(mocks.subirResolucion).toHaveBeenCalledWith(7, pdf);
    expect(mocks.subirResolucion.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.resolverRecurso.mock.invocationCallOrder[0],
    );
  });
});

// ── quick 261028-mtg (2026-10-29): la impugnación entra en cualquier estado activo ──
describe("ImpugnacionAcciones — registrar la impugnación (D-1) y la suspensión (D-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fila = (eejeStatus: string, extra: Partial<MiEpasAsignado> = {}) => ({
    ...EPAS,
    eejeStatus,
    tieneImpugnacion: false,
    ...extra,
  });

  it("EN_TRABAJO_COMUNITARIO: «Registrar impugnación» enseña la consecuencia y solo «Confirmar registro» registra", async () => {
    mocks.leerEstado.mockResolvedValue(vistaDe("EN_TRABAJO_COMUNITARIO"));
    mocks.registrarImpugnacion.mockResolvedValue({
      eejeStatus: "EN_IMPUGNACION",
      estadoPrevio: "EN_TRABAJO_COMUNITARIO",
      estadoAlReanudar: "EN_TRABAJO_COMUNITARIO",
    });
    montar(fila("EN_TRABAJO_COMUNITARIO"));

    expect(screen.getByText("En trabajo comunitario")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Registrar impugnación" }),
    );

    // Primer paso: la consecuencia, sin llamar a nada.
    expect(
      screen.getByText(/todo lo que está en curso queda\s+suspendido/i)
        .textContent,
    ).toMatch(/vuelve a «En trabajo comunitario»/);
    expect(mocks.registrarImpugnacion).not.toHaveBeenCalled();

    // «Cancelar» vuelve atrás sin registrar.
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText(/queda\s+suspendido/i)).toBeNull();
    expect(mocks.registrarImpugnacion).not.toHaveBeenCalled();

    // Segundo intento, confirmado.
    fireEvent.click(screen.getByRole("button", { name: "Registrar impugnación" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar registro" }));

    await waitFor(() =>
      expect(mocks.registrarImpugnacion).toHaveBeenCalledWith(7),
    );
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        expect.stringMatching(/impugnación registrada/i),
      ),
    );
    expect(
      await screen.findByText(/en impugnación — pendiente/i),
    ).toBeInTheDocument();
    expect(mocks.registrarImpugnacion).toHaveBeenCalledTimes(1);
  });

  it.each(["EN_VERIFICACION_PAGO", "PENDIENTE_COACTIVA"])(
    "%s también ofrece «Registrar impugnación» cuando el servidor lo permite",
    async (estado) => {
      mocks.leerEstado.mockResolvedValue(vistaDe(estado));
      montar(fila(estado));
      expect(
        await screen.findByRole("button", { name: "Registrar impugnación" }),
      ).toBeInTheDocument();
    },
  );

  it("ASIGNADO_DECISOR con la bandera: «Gestionar impugnación» como hoy, sin un segundo botón de registrar", async () => {
    mocks.leerEstado.mockResolvedValue(vistaDe("ASIGNADO_DECISOR"));
    mocks.registrarImpugnacion.mockResolvedValue({
      eejeStatus: "EN_IMPUGNACION",
      estadoPrevio: "ASIGNADO_DECISOR",
      estadoAlReanudar: "EN_VERIFICACION_PAGO",
    });
    montar(fila("ASIGNADO_DECISOR", { tieneImpugnacion: true }));

    await waitFor(() => expect(mocks.leerEstado).toHaveBeenCalled());
    expect(screen.getByText("Con impugnación")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar impugnación" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Gestionar impugnación" }));
    await waitFor(() =>
      expect(mocks.registrarImpugnacion).toHaveBeenCalledWith(7),
    );
  });

  it("ASIGNADO_DECISOR sin la bandera: «Iniciar acciones de ejecución» y además «Registrar impugnación»", async () => {
    mocks.leerEstado.mockResolvedValue(
      vistaDe("ASIGNADO_DECISOR", {
        entrada: {
          permitida: true,
          motivo: null,
          estadoAlReanudar: "EN_VERIFICACION_PAGO",
        },
      }),
    );
    montar(fila("ASIGNADO_DECISOR"));

    expect(
      screen.getByRole("button", { name: "Iniciar acciones de ejecución" }),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Registrar impugnación" }),
    );
    expect(
      screen.getByText(/queda\s+suspendido/i).textContent,
    ).toMatch(/vuelve a «En verificación de pago»/);
  });

  it("si el servidor no lo permite, no hay botón y se dice su motivo", async () => {
    mocks.leerEstado.mockResolvedValue(
      vistaDe("PENDIENTE_COACTIVA", {
        entrada: {
          permitida: false,
          motivo: "El caso no está aceptado.",
          estadoAlReanudar: null,
        },
      }),
    );
    montar(fila("PENDIENTE_COACTIVA"));

    expect(
      await screen.findByText("El caso no está aceptado."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar impugnación" }),
    ).toBeNull();
  });

  it("EN_IMPUGNACION dice desde cuándo, de qué estado viene, que falta la resolución de ESTA impugnación y a dónde vuelve el «No»", async () => {
    mocks.leerEstado.mockResolvedValue(
      vistaDe("EN_IMPUGNACION", {
        suspension: {
          esusId: 3,
          desde: "2026-10-16T15:00:00.000Z",
          estadoPrevio: "PENDIENTE_COACTIVA",
          estadoAlReanudar: "PENDIENTE_COACTIVA",
          origen: "DECISOR",
        },
      }),
    );
    montar();

    expect(
      (await screen.findByText(/suspendido desde/i)).textContent,
    ).toMatch(/16\/10\/2026 — estaba en «Pendiente de coactiva»/);
    expect(
      screen.getByText(/falta la resolución de la procuraduría de esta impugnación/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", {
        name: /no — se reanuda: vuelve a «pendiente de coactiva»/i,
      }),
    ).toBeInTheDocument();
  });

  it("con la resolución ya adjunta no se avisa de que falta", async () => {
    mocks.leerEstado.mockResolvedValue(
      vistaDe("EN_IMPUGNACION", { resolucionAdjunta: true }),
    );
    montar();
    await screen.findByText(/suspendido desde/i);
    expect(screen.queryByText(/falta la resolución/i)).toBeNull();
  });

  it("tras confirmar «No», la sección queda en el estado que DEVOLVIÓ el servidor (no en uno fijo)", async () => {
    mocks.leerEstado.mockResolvedValueOnce(
      vistaDe("EN_IMPUGNACION", {
        suspension: {
          esusId: 3,
          desde: "2026-10-16T15:00:00.000Z",
          estadoPrevio: "PENDIENTE_COACTIVA",
          estadoAlReanudar: "PENDIENTE_COACTIVA",
          origen: "DECISOR",
        },
      }),
    );
    mocks.leerEstado.mockResolvedValue(vistaDe("PENDIENTE_COACTIVA"));
    mocks.resolverRecurso.mockResolvedValue({ eejeStatus: "PENDIENTE_COACTIVA" });
    montar();

    await screen.findByText(/suspendido desde/i);
    fireEvent.click(radio(/^no/i));
    fireEvent.click(radio(/rechazado/i));
    fireEvent.click(botonConfirmar());

    expect(await screen.findByText("Pendiente de coactiva")).toBeInTheDocument();
    expect(screen.queryByText(/en verificación de pago/i)).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(mocks.addToast).toHaveBeenCalledWith(
      "success",
      "Recurso no aceptado: el expediente vuelve a «Pendiente de coactiva».",
    );
  });

  it("D-5: con obligación de hacer, el mismo formulario adjunta y resuelve igual", async () => {
    mocks.leerEstado.mockResolvedValue(vistaDe("EN_IMPUGNACION"));
    mocks.resolverRecurso.mockResolvedValue({
      eejeStatus: "EN_TRABAJO_COMUNITARIO",
    });
    const conHacer = {
      ...EPAS,
      obligacionHacer: { tiene: true } as MiEpasAsignado["obligacionHacer"],
    };
    const { container } = montar(conHacer);
    const pdf = new File(["%PDF"], "resolucion.pdf", { type: "application/pdf" });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [pdf] },
    });
    fireEvent.click(radio(/^no/i));
    expect(botonConfirmar().disabled).toBe(true);
    fireEvent.click(radio(/inadmitido/i));
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.resolverRecurso).toHaveBeenCalledWith(
        7,
        false,
        "INADMITIDO",
        undefined,
      ),
    );
    expect(mocks.subirResolucion).toHaveBeenCalledWith(7, pdf);
    expect(await screen.findByText("En trabajo comunitario")).toBeInTheDocument();
  });

  it("si falla la carga de la vista, el fallo va en su hueco con «Reintentar» y no en el aviso flotante", async () => {
    mocks.leerEstado.mockRejectedValueOnce(new Error("Network Error"));
    mocks.leerEstado.mockResolvedValue(vistaDe("EN_TRABAJO_COMUNITARIO"));
    montar(fila("EN_TRABAJO_COMUNITARIO"));

    const reintentar = await screen.findByRole("button", { name: "Reintentar" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(mocks.addToast).not.toHaveBeenCalled();

    fireEvent.click(reintentar);
    expect(
      await screen.findByRole("button", { name: "Registrar impugnación" }),
    ).toBeInTheDocument();
    expect(mocks.leerEstado).toHaveBeenCalledTimes(2);
  });
});
