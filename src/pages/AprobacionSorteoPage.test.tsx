/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Firma del lote por el director (orden 3) con la firma digital real — Fase 03.21
 * Archivo: AprobacionSorteoPage.test.tsx
 * Responsabilidad: Fijar la vida de la clave de firma del DIRECTOR en la confirmación de un lote:
 *   se borra tras CUALQUIER intento (con éxito o con error), al cerrar el diálogo y al abrirlo para
 *   otro lote; y escribir en el campo retira el aviso del fallo anterior para que el botón de
 *   confirmar vuelva a armarse sin cerrar y reabrir. Y mientras el modo de firma no se conoce
 *   (leyéndose o tras un fallo de lectura) no se deja firmar ni se dice que la firma está apagada.
 *
 *   La clave de las pruebas es un valor ficticio, reconocible si se escapara.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-27
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: los fallos de la firma se afirman en
 *   el aviso flotante; ConfirmationDetail ya no los pinta en una caja)
 */

import { errorDelServidor } from "../test/errores";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { resetModoDeFirmaCache } from "../hooks/useClaveDeFirma";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  openModal: vi.fn(),
  lotesPendientes: vi.fn(),
  reasignacionesPendientes: vi.fn(),
  firmarLote: vi.fn(),
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
    user: { usuId: 7, usuFullName: "DIRECTORA DE PRUEBA", rolName: "Director" },
  }),
}));

// El hook de la clave lee el modo por el export POR DEFECTO del servicio y la página por el
// nombrado: se doblan los dos con el mismo objeto.
vi.mock("../services/SorteoService", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/SorteoService")>();
  const dobles = {
    lotesPendientes: mocks.lotesPendientes,
    reasignacionesPendientes: mocks.reasignacionesPendientes,
    firmarLote: mocks.firmarLote,
    readModoDeFirma: mocks.readModoDeFirma,
  };
  return { ...real, default: dobles, SorteoService: dobles };
});

import AprobacionSorteoPage from "./AprobacionSorteoPage";

const CLAVE_FICTICIA = "clave-ficticia-del-director";
const TEXTO_NO_RESPONDE_SERVIDOR =
  "El servicio de firma no responde. Inténtelo de nuevo en unos minutos.";

const LOTES = [
  { amasId: 501, decisorUserId: 34, totalCasos: 2, sdetName: "Esperando firma", casos: [] },
  { amasId: 502, decisorUserId: 35, totalCasos: 1, sdetName: "Esperando firma", casos: [] },
];

const encendido = () =>
  mocks.readModoDeFirma.mockResolvedValue({
    firmadorHabilitado: true,
    sesionCentral: true,
  });

const montar = async () => {
  render(<AprobacionSorteoPage />);
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Revisar y firmar" })).toHaveLength(2),
  );
};

const abrirLote = async (indice: number) => {
  fireEvent.click(screen.getAllByRole("button", { name: "Revisar y firmar" })[indice]);
  return screen.findByLabelText("Clave de firma");
};

// El `<dialog>` se pinta con `modal-open` (sin el atributo `open`): jsdom lo da por oculto y sus
// botones no salen por rol. Se buscan por la clase, como en BandejaSalidaPage.test.tsx.
const botonConfirmar = () =>
  document.querySelector<HTMLButtonElement>(".app-modules-modal-submit")!;
const botonCancelar = () =>
  document.querySelector<HTMLButtonElement>(".app-modules-modal-cancel")!;
const botonAspa = () =>
  document.querySelector<HTMLButtonElement>(".app-modules-modal-close")!;

const escribirClave = (campo: HTMLElement, valor = CLAVE_FICTICIA) =>
  fireEvent.change(campo, { target: { value: valor } });

describe("AprobacionSorteoPage — la clave del director no sobrevive al acto (CR-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
    encendido();
    mocks.lotesPendientes.mockResolvedValue(LOTES);
    mocks.reasignacionesPendientes.mockResolvedValue({
      items: [],
      totalPages: 0,
      totalCount: 0,
      pageSize: 10,
    });
  });

  it("tras un fallo la clave se borra, y escribir de nuevo rearma el botón", async () => {
    mocks.firmarLote.mockRejectedValueOnce(
      errorDelServidor(TEXTO_NO_RESPONDE_SERVIDOR, 504, "APP-FIRMA-UPSTREAM-001"),
    );
    await montar();
    escribirClave(await abrirLote(0));

    fireEvent.click(botonConfirmar());

    // El campo vuelve vacío tras el intento fallido.
    const campo = await screen.findByLabelText("Clave de firma");
    await waitFor(() => expect(campo).toHaveValue(""));
    expect(mocks.firmarLote).toHaveBeenCalledWith(501, 34, undefined, CLAVE_FICTICIA);
    expect(botonConfirmar()).toBeDisabled();

    // Escribir es un intento nuevo: el aviso se retira y el botón vuelve a poder pulsarse.
    escribirClave(campo, "otra-clave-ficticia");
    expect(screen.queryByText(new RegExp(TEXTO_NO_RESPONDE_SERVIDOR))).not.toBeInTheDocument();
    expect(botonConfirmar()).toBeEnabled();
  });

  it("tras un éxito la clave se borra y el diálogo se cierra", async () => {
    mocks.firmarLote.mockResolvedValueOnce({ firmado: true });
    await montar();
    escribirClave(await abrirLote(0));

    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(screen.queryByLabelText("Clave de firma")).not.toBeInTheDocument(),
    );
    // Al abrir de nuevo el mismo lote, el campo no trae la clave anterior.
    expect(await abrirLote(0)).toHaveValue("");
  });

  it("cancelar el diálogo borra la clave: no se hereda al abrir otro lote", async () => {
    await montar();
    escribirClave(await abrirLote(0));

    fireEvent.click(botonCancelar());
    await waitFor(() =>
      expect(screen.queryByLabelText("Clave de firma")).not.toBeInTheDocument(),
    );

    const campoOtroLote = await abrirLote(1);
    expect(campoOtroLote).toHaveValue("");
    expect(botonConfirmar()).toBeDisabled();
  });

  it("cerrar con el aspa también borra la clave", async () => {
    await montar();
    escribirClave(await abrirLote(0));

    fireEvent.click(botonAspa());
    await waitFor(() =>
      expect(screen.queryByLabelText("Clave de firma")).not.toBeInTheDocument(),
    );

    expect(await abrirLote(0)).toHaveValue("");
  });
});

describe("AprobacionSorteoPage — mientras el modo de firma no se conoce (WR-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
    mocks.lotesPendientes.mockResolvedValue(LOTES);
    mocks.reasignacionesPendientes.mockResolvedValue({
      items: [],
      totalPages: 0,
      totalCount: 0,
      pageSize: 10,
    });
  });

  it("leyendo el modo: no dice que la firma esté desactivada y no deja firmar", async () => {
    mocks.readModoDeFirma.mockReturnValue(new Promise(() => {}));
    await montar();
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar y firmar" })[0]);

    expect(
      await screen.findByText("Comprobando si la firma digital está activa en este despliegue…"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/La firma digital está desactivada/)).toBeNull();
    expect(botonConfirmar()).toBeDisabled();
  });

  it("si no se pudo leer el modo, no deja firmar y «Reintentar» vuelve a preguntar", async () => {
    mocks.readModoDeFirma.mockRejectedValueOnce(new Error("sin red"));
    mocks.readModoDeFirma.mockResolvedValueOnce({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    await montar();
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar y firmar" })[0]);

    expect(
      await screen.findByText(/No se pudo comprobar si la firma digital está activa/),
    ).toBeInTheDocument();
    expect(botonConfirmar()).toBeDisabled();

    const reintentar = document.querySelector<HTMLButtonElement>(".alert-warning button")!;
    fireEvent.click(reintentar);

    expect(await screen.findByLabelText("Clave de firma")).toBeInTheDocument();
    expect(mocks.readModoDeFirma).toHaveBeenCalledTimes(2);
  });
});

describe("AprobacionSorteoPage — el aviso dice lo que pasó con la firma (WR-02)", () => {
  const TEXTO_CLAVE_INCORRECTA_SERVIDOR =
    "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.";

  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
    mocks.lotesPendientes.mockResolvedValue(LOTES);
    mocks.reasignacionesPendientes.mockResolvedValue({
      items: [],
      totalPages: 0,
      totalCount: 0,
      pageSize: 10,
    });
  });

  it("firmador apagado: no promete una firma «pendiente»; dice que el acta quedó SIN firma", async () => {
    mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
    mocks.firmarLote.mockResolvedValueOnce({ firmado: false });
    await montar();
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar y firmar" })[0]);
    await screen.findByText(/La firma digital está desactivada/);

    expect(document.body.textContent).not.toMatch(/se incorporará cuando|PENDIENTE/);
    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Firma registrada y lote aprobado en Asignaciones. El acta quedó SIN firma criptográfica: la firma digital está desactivada en este despliegue.",
      ),
    );
  });

  it("firmador encendido y firma aplicada: «Acta firmada y lote aprobado en Asignaciones.»", async () => {
    encendido();
    mocks.firmarLote.mockResolvedValueOnce({ firmado: true });
    await montar();
    escribirClave(await abrirLote(0));

    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Acta firmada y lote aprobado en Asignaciones.",
      ),
    );
  });

  it("un fallo APP-FIRMA-* antepone que ni el acta se firmó ni el lote se aprobó", async () => {
    encendido();
    mocks.firmarLote.mockRejectedValueOnce(
      errorDelServidor(TEXTO_NO_RESPONDE_SERVIDOR, 504, "APP-FIRMA-UPSTREAM-001"),
    );
    await montar();
    escribirClave(await abrirLote(0));

    fireEvent.click(botonConfirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        // Un 5xx lleva además la referencia de soporte al final.
        expect.stringContaining(
          `El acta no se firmó y el lote no se aprobó en Asignaciones. ${TEXTO_NO_RESPONDE_SERVIDOR}`,
        ),
      ),
    );
    // No es la clave: el campo no se marca, y el aviso sale una vez y en ninguna caja.
    expect(screen.getByLabelText("Clave de firma")).not.toHaveAttribute("aria-invalid");
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".modal-open [role='alert']")).toBeNull();
    // Bloqueo del reintento: apagado tras el fallo; escribir en el campo lo rearma.
    expect(botonConfirmar()).toBeDisabled();
    escribirClave(screen.getByLabelText("Clave de firma"));
    expect(botonConfirmar()).toBeEnabled();
  });

  it("la clave incorrecta activa SOLO el estado E: campo vacío, marcado y con el foco; ni caja ni aviso flotante (UAT 03.21, hueco 2)", async () => {
    encendido();
    mocks.firmarLote.mockRejectedValueOnce(
      errorDelServidor(TEXTO_CLAVE_INCORRECTA_SERVIDOR, 422, "APP-FIRMA-CLAVE-001"),
    );
    await montar();
    escribirClave(await abrirLote(0));

    fireEvent.click(botonConfirmar());

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
    expect(
      screen.queryByText(/El acta no se firmó y el lote no se aprobó/),
    ).toBeNull();
    // Apagado con la clave vacía; escribir retira la línea y rearma «Confirmar».
    expect(botonConfirmar()).toBeDisabled();
    escribirClave(campo);
    expect(screen.queryByText("La clave de firma no es correcta.")).toBeNull();
    expect(botonConfirmar()).toBeEnabled();
  });
});
