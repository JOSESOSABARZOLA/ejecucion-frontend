/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Actas
 * Feature: Firma en combo del acta D2 con la firma digital real — Fase 03.21
 * Archivo: ActasSorteoPage.test.tsx
 * Responsabilidad: Fijar la vida de la clave de firma del combo: la confirmación se abre siempre
 *   con el campo vacío y la clave se borra al cancelar o cerrar con el aspa, no solo tras un envío.
 *   Antes la clave vivía en el estado de la página el resto de su vida y la siguiente apertura la
 *   traía ya escrita.
 *
 *   La clave de las pruebas es un valor ficticio, reconocible si se escapara.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-27
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la clave rechazada del combo se dice solo
 *   bajo el campo, con el foco; otro fallo de firma solo en el aviso flotante; el resumen del reporte
 *   va al aviso flotante y el panel de omitidos solo se pinta si los hay.)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { resetModoDeFirmaCache } from "../hooks/useClaveDeFirma";
import { errorDelServidor } from "../test/errores";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  openModal: vi.fn(),
  lotes: vi.fn(),
  misLotes: vi.fn(),
  firmarLotes: vi.fn(),
  readModoDeFirma: vi.fn(),
}));

vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock("../hooks/useModal", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));

vi.mock("../context/UserContext", () => ({
  useUser: () => ({
    user: { usuId: 9, usuFullName: "SECRETARIA DE PRUEBA", rolName: "Secretario Abogado" },
  }),
}));

// Los documentos del expediente se cargan por su cuenta; aquí no interesan.
vi.mock("../components/expediente/ExpedienteDocumentos", () => ({
  ExpedienteDocumentos: () => null,
}));

// La página importa el `MODAL_KEY` del modal de firma, que trae el visor PDF (pdf.js no carga en
// jsdom).
vi.mock("../components/pdf/PDFViewer", () => ({ PDFViewer: () => null }));

vi.mock("../services/SorteoService", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/SorteoService")>();
  const dobles = {
    lotes: mocks.lotes,
    misLotes: mocks.misLotes,
    firmarLotes: mocks.firmarLotes,
    readModoDeFirma: mocks.readModoDeFirma,
  };
  return { ...real, default: dobles, SorteoService: dobles };
});

import ActasSorteoPage from "./ActasSorteoPage";

const CLAVE_FICTICIA = "clave-ficticia-del-combo";

/** Turno del SECRETARIO ABOGADO: la orden 1 ya se selló. */
const LOTE_TURNO_SECRETARIO = {
  amasId: 901,
  decisorUserId: 35,
  decisorName: "DECISOR DE PRUEBA",
  estado: "PARCIALMENTE_FIRMADO",
  firmaDecisorAt: "2026-08-01T10:00:00Z",
  totalCasos: 1,
  casos: [],
};

// El `<dialog>` se pinta con `modal-open` (sin el atributo `open`): jsdom lo da por oculto y sus
// botones no salen por rol. Se buscan por la clase, como en BandejaSalidaPage.test.tsx.
const botonCancelar = () =>
  document.querySelector<HTMLButtonElement>(".app-modules-modal-cancel")!;
const botonAspa = () =>
  document.querySelector<HTMLButtonElement>(".app-modules-modal-close")!;
const botonConfirmar = () =>
  document.querySelector<HTMLButtonElement>(".app-modules-modal-submit")!;

const montarYSeleccionar = async () => {
  render(<ActasSorteoPage />);
  const casilla = await screen.findByRole("checkbox", {
    name: /Seleccionar el acta del lote #901/,
  });
  fireEvent.click(casilla);
};

const abrirCombo = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Firmar seleccionadas/ }));
  return screen.findByLabelText("Clave de firma");
};

describe("ActasSorteoPage — la clave del combo no sobrevive a un diálogo cancelado (CR-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.lotes.mockResolvedValue([LOTE_TURNO_SECRETARIO]);
  });

  it("cancelar borra la clave: la siguiente apertura trae el campo vacío", async () => {
    await montarYSeleccionar();
    fireEvent.change(await abrirCombo(), { target: { value: CLAVE_FICTICIA } });

    fireEvent.click(botonCancelar());
    await waitFor(() =>
      expect(screen.queryByLabelText("Clave de firma")).not.toBeInTheDocument(),
    );

    expect(await abrirCombo()).toHaveValue("");
    expect(mocks.firmarLotes).not.toHaveBeenCalled();
  });

  it("cerrar con el aspa también borra la clave", async () => {
    await montarYSeleccionar();
    fireEvent.change(await abrirCombo(), { target: { value: CLAVE_FICTICIA } });

    fireEvent.click(botonAspa());
    await waitFor(() =>
      expect(screen.queryByLabelText("Clave de firma")).not.toBeInTheDocument(),
    );

    expect(await abrirCombo()).toHaveValue("");
  });
});

describe("ActasSorteoPage — los mensajes del combo (quick 261028-kmg)", () => {
  const PAR = { amasId: 901, decisorUserId: 35 };

  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.lotes.mockResolvedValue([LOTE_TURNO_SECRETARIO]);
  });

  const enviarCombo = async () => {
    await montarYSeleccionar();
    fireEvent.change(await abrirCombo(), { target: { value: CLAVE_FICTICIA } });
    fireEvent.click(botonConfirmar());
  };

  it("🔴 clave rechazada: SOLO el estado E —campo vacío, marcado y con el foco—, sin caja ni aviso flotante; escribir lo retira y rearma «Confirmar»", async () => {
    mocks.firmarLotes.mockRejectedValueOnce(
      errorDelServidor(
        "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.",
        422,
        "APP-FIRMA-CLAVE-001",
      ),
    );
    await enviarCombo();

    await waitFor(() =>
      expect(screen.getByLabelText("Clave de firma")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    const campo = screen.getByLabelText("Clave de firma");
    expect(campo).toHaveValue("");
    expect(screen.getByText("La clave de firma no es correcta.")).toBeInTheDocument();
    await waitFor(() => expect(campo).toHaveFocus());
    expect(mocks.addToast).not.toHaveBeenCalledWith("error", expect.anything());
    expect(screen.queryByText(/No se firmó ninguna acta/)).toBeNull();
    expect(botonConfirmar()).toBeDisabled();

    fireEvent.change(campo, { target: { value: "otra-clave-ficticia" } });
    expect(screen.queryByText("La clave de firma no es correcta.")).toBeNull();
    expect(botonConfirmar()).toBeEnabled();
  });

  it("otro fallo de firma: «No se firmó ninguna acta. …» SOLO en el aviso flotante, una vez, y el campo sin marcar", async () => {
    mocks.firmarLotes.mockRejectedValueOnce(
      errorDelServidor(
        "El servicio de firma no responde. Inténtelo de nuevo en unos minutos.",
        504,
        "APP-FIRMA-NO-RESPONDE-001",
      ),
    );
    await enviarCombo();

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(
          /^No se firmó ninguna acta\. El servicio de firma no responde/,
        ),
      ),
    );
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Clave de firma")).not.toHaveAttribute("aria-invalid");
  });

  it("un 200 con omitidos: el resumen va al aviso flotante y el panel de omitidos se queda, con «Descartar el reporte»", async () => {
    mocks.firmarLotes.mockResolvedValueOnce({
      ordenAplicado: 2,
      rolFirmante: "secretario abogado",
      solicitados: 1,
      firmados: [],
      omitidos: [
        {
          par: PAR,
          motivo: "YA_FIRMADO",
          detalle: "Ya firmada.",
          intentado: false,
        },
      ],
      mastersAprobados: [],
    });
    await enviarCombo();

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "warning",
        "Se firmaron 0 de 1 acta. 1 quedó omitida.",
      ),
    );
    expect(await screen.findByText("Actas que no se firmaron")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Descartar el reporte" }),
    ).toBeInTheDocument();
    // El resumen no se repite en una caja.
    expect(screen.queryByText("Se firmaron 0 de 1 acta. 1 quedó omitida.")).toBeNull();
  });

  it("un 200 sin omitidos: el resumen va al aviso flotante y no queda nada en línea", async () => {
    mocks.firmarLotes.mockResolvedValueOnce({
      ordenAplicado: 2,
      rolFirmante: "secretario abogado",
      solicitados: 1,
      firmados: [
        { par: PAR, ordenAplicado: 2, expedientesSellados: 0, intentado: false },
      ],
      omitidos: [],
      mastersAprobados: [],
    });
    await enviarCombo();

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("success", "Se firmaron 1 de 1 acta."),
    );
    expect(screen.queryByText("Actas que no se firmaron")).toBeNull();
    expect(screen.queryByRole("button", { name: "Descartar el reporte" })).toBeNull();
  });
});
