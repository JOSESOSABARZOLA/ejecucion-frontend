/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Datos y firma del acta D2 por el secretario con la firma digital real — Fase 03.21
 * Archivo: ModalActaDatos.test.tsx
 * Responsabilidad: Fijar lo que el modal del secretario hace con su clave de firma: se borra tras
 *   CUALQUIER intento, también cuando fallan los datos o la firma, y al volver al formulario. Y lo que
 *   dice: el éxito según si la firma se aplicó (sin prometer una firma «pendiente») y, si la firma
 *   falla tras guardar los datos, que los datos SÍ quedaron guardados.
 *
 *   Los textos se escriben A MANO (UI-SPEC §10): importarlos del catálogo convertiría cada aserción
 *   en una tautología. La clave de las pruebas es un valor ficticio, reconocible si se escapara.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-27
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la clave rechazada solo en el estado
 *   E con un aviso informativo; los demás fallos en el aviso flotante y sin caja)
 */

import { errorDelServidor, errorDeRed } from "../../test/errores";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { resetModoDeFirmaCache } from "../../hooks/useClaveDeFirma";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  actaDeLote: vi.fn(),
  actaDatos: vi.fn(),
  firmarLote: vi.fn(),
  readModoDeFirma: vi.fn(),
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock("../../services/SorteoService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../services/SorteoService")>();
  const dobles = {
    actaDeLote: mocks.actaDeLote,
    actaDatos: mocks.actaDatos,
    firmarLote: mocks.firmarLote,
    readModoDeFirma: mocks.readModoDeFirma,
  };
  return { ...real, default: dobles, SorteoService: dobles };
});

vi.mock("../pdf/PDFViewer", () => ({
  PDFViewer: () => <div data-testid="visor-pdf" />,
}));

import ModalActaDatos from "./ModalActaDatos";

const CLAVE_FICTICIA = "clave-ficticia-del-secretario";
const TEXTO_NO_RESPONDE_SERVIDOR =
  "El servicio de firma no responde. Inténtelo de nuevo en unos minutos.";

const montar = (
  onClose = vi.fn(),
  refetchFn = vi.fn().mockResolvedValue(undefined),
) => {
  render(
    <ModalActaDatos
      caseData={{ amasId: 901, decisorUserId: 35 }}
      onClose={onClose}
      refetchFn={refetchFn}
    />,
  );
  return { onClose, refetchFn };
};

const campo = (nombre: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${nombre}"]`)!;

/** Llena el formulario y pasa al paso de confirmación, donde vive el campo de la clave. */
const irAConfirmacion = async () => {
  await waitFor(() => expect(campo("numeroActa")).toBeTruthy());
  fireEvent.change(campo("numeroActa"), { target: { value: "0042" } });
  fireEvent.change(campo("numeroMemorandoCustodia"), { target: { value: "0100" } });
  fireEvent.change(campo("hora"), { target: { value: "11:06" } });
  const continuar = screen.getByRole("button", { name: "Continuar" });
  await waitFor(() => expect(continuar).toBeEnabled());
  fireEvent.click(continuar);
  return screen.findByLabelText("Clave de firma");
};

const escribirClave = (valor = CLAVE_FICTICIA) =>
  fireEvent.change(screen.getByLabelText("Clave de firma"), {
    target: { value: valor },
  });

describe("ModalActaDatos — la clave del secretario no sobrevive al intento (CR-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
    mocks.actaDeLote.mockResolvedValue({ docUrl: "/acta.pdf" });
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
  });

  it("si falla la firma, la clave se borra y el modal sigue abierto", async () => {
    mocks.actaDatos.mockResolvedValue(undefined);
    mocks.firmarLote.mockRejectedValue(
      errorDelServidor(TEXTO_NO_RESPONDE_SERVIDOR, 504, "APP-FIRMA-UPSTREAM-001"),
    );
    const { onClose } = montar();
    await irAConfirmacion();
    escribirClave();

    fireEvent.click(screen.getByRole("button", { name: "Guardar y firmar" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Clave de firma")).toHaveValue(""),
    );
    expect(mocks.firmarLote).toHaveBeenCalledWith(901, 35, undefined, CLAVE_FICTICIA);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("si fallan los datos (antes de firmar), la clave también se borra", async () => {
    mocks.actaDatos.mockRejectedValue(errorDeRed());
    montar();
    await irAConfirmacion();
    escribirClave();

    fireEvent.click(screen.getByRole("button", { name: "Guardar y firmar" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Clave de firma")).toHaveValue(""),
    );
    expect(mocks.firmarLote).not.toHaveBeenCalled();
  });

  it("volver al formulario borra la clave", async () => {
    montar();
    await irAConfirmacion();
    escribirClave();

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    const continuar = await screen.findByRole("button", { name: "Continuar" });
    await waitFor(() => expect(continuar).toBeEnabled());
    fireEvent.click(continuar);

    expect(await screen.findByLabelText("Clave de firma")).toHaveValue("");
  });
});

describe("ModalActaDatos — el aviso dice qué quedó hecho (WR-02)", () => {
  const TEXTO_CLAVE_INCORRECTA_SERVIDOR =
    "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.";

  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
    mocks.actaDeLote.mockResolvedValue({ docUrl: "/acta.pdf" });
    mocks.actaDatos.mockResolvedValue(undefined);
  });

  it("firmador apagado: no promete una firma «pendiente»", async () => {
    mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
    mocks.firmarLote.mockResolvedValue({ firmado: false });
    const { onClose } = montar();
    await waitFor(() => expect(campo("numeroActa")).toBeTruthy());
    fireEvent.change(campo("numeroActa"), { target: { value: "0042" } });
    fireEvent.change(campo("numeroMemorandoCustodia"), { target: { value: "0100" } });
    fireEvent.change(campo("hora"), { target: { value: "11:06" } });
    const continuar = screen.getByRole("button", { name: "Continuar" });
    await waitFor(() => expect(continuar).toBeEnabled());
    fireEvent.click(continuar);
    const guardar = await screen.findByRole("button", { name: "Guardar y firmar" });
    await waitFor(() => expect(guardar).toBeEnabled());

    fireEvent.click(guardar);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.addToast).toHaveBeenCalledWith(
      "success",
      "Datos del acta guardados. Firma registrada. La firma digital está desactivada en este despliegue: el acta quedó SIN firma criptográfica.",
    );
  });

  it("firma aplicada: lo dice", async () => {
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.firmarLote.mockResolvedValue({ firmado: true });
    montar();
    await irAConfirmacion();
    escribirClave();

    fireEvent.click(screen.getByRole("button", { name: "Guardar y firmar" }));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Datos del acta guardados. Acta firmada: su firma digital quedó aplicada.",
      ),
    );
  });

  it("si la firma falla tras guardar los datos, NO dice que los datos no se guardaron", async () => {
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.firmarLote.mockRejectedValue(
      errorDelServidor(TEXTO_NO_RESPONDE_SERVIDOR, 504, "APP-FIRMA-UPSTREAM-001"),
    );
    montar();
    await irAConfirmacion();
    escribirClave();

    fireEvent.click(screen.getByRole("button", { name: "Guardar y firmar" }));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        // Un 5xx lleva además la referencia de soporte al final.
        expect.stringContaining(
          `Los datos del acta quedaron guardados. El acta no se firmó. ${TEXTO_NO_RESPONDE_SERVIDOR}`,
        ),
      ),
    );
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".alert-error")).toBeNull();
    expect(screen.getByLabelText("Clave de firma")).not.toHaveAttribute("aria-invalid");
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toMatch(/No se pudo guardar el acta/);
  });

  it("la clave incorrecta activa SOLO el estado E —campo marcado y con el foco—, más un aviso informativo de que los datos quedaron guardados; escribir lo retira", async () => {
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.firmarLote.mockRejectedValue(
      errorDelServidor(TEXTO_CLAVE_INCORRECTA_SERVIDOR, 422, "APP-FIRMA-CLAVE-001"),
    );
    montar();
    await irAConfirmacion();
    escribirClave();

    fireEvent.click(screen.getByRole("button", { name: "Guardar y firmar" }));

    const campoClave = screen.getByLabelText("Clave de firma");
    await waitFor(() => expect(campoClave).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("La clave de firma no es correcta.")).toBeInTheDocument();
    await waitFor(() => expect(campoClave).toHaveFocus());
    expect(mocks.addToast).toHaveBeenCalledWith(
      "info",
      "Los datos del acta quedaron guardados; el acta todavía no se firmó.",
    );
    expect(mocks.addToast).not.toHaveBeenCalledWith("error", expect.anything());
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(screen.queryByText(/El acta no se firmó/)).toBeNull();

    escribirClave("otra-clave-ficticia");
    expect(campoClave).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(/Los datos del acta quedaron guardados/)).toBeNull();
  });

  it("si fallan los datos, dice que no se guardaron ni se firmó", async () => {
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.actaDatos.mockRejectedValue(errorDeRed());
    montar();
    await irAConfirmacion();
    escribirClave();

    fireEvent.click(screen.getByRole("button", { name: "Guardar y firmar" }));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("error", expect.any(String)),
    );
    expect(document.querySelector(".alert-error")).toBeNull();
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toMatch(/quedaron guardados/);
    expect(mocks.firmarLote).not.toHaveBeenCalled();
  });
});

describe("ModalActaDatos — refrescar la bandeja falla DESPUÉS de guardar y firmar (WR-03)", () => {
  it("no dice que la firma no se completó: avisa de la lista y cierra", async () => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
    mocks.actaDeLote.mockResolvedValue({ docUrl: "/acta.pdf" });
    mocks.actaDatos.mockResolvedValue(undefined);
    mocks.readModoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.firmarLote.mockResolvedValue({ firmado: true });
    const { onClose } = montar(vi.fn(), vi.fn().mockRejectedValue(new Error("bandeja caída")));
    await irAConfirmacion();
    escribirClave();

    fireEvent.click(screen.getByRole("button", { name: "Guardar y firmar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.addToast).toHaveBeenCalledWith(
      "info",
      "Quedó hecho, pero no se pudo actualizar la lista. Actualícela antes de repetir nada.",
    );
    expect(screen.queryByText(/la firma no se completó/)).toBeNull();
  });
});
