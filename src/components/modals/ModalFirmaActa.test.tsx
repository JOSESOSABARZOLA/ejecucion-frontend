/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Firma del acta D2 con la firma digital real — Fase 03.21 (D-10, D-11, D-16, C5, C6)
 * Archivo: ModalFirmaActa.test.tsx
 * Responsabilidad: Fijar lo que el modal de firma del acta le dice al firmante ahora que la firma es
 *   real y TODO O NADA (D-10): si la firma no se aplica, ni el acta se firma ni —en el director— el
 *   lote se aprueba en Asignaciones, y el modal tiene que decirlo con la consecuencia de SU rol.
 *
 *   ── QUÉ SE BLOQUEA AQUÍ ──────────────────────────────────────────────────────────────────────
 *   · C6: con el firmador apagado el aviso ya no promete una firma «PENDIENTE» que no va a ocurrir:
 *     dice que el acta quedó SIN firma criptográfica, distinguiendo al director (§10.7).
 *   · C5: la clave se borra al terminar el envío, con éxito O con error (§2.3 regla 2).
 *   · Un fallo `APP-FIRMA-*` antepone la consecuencia por rol (§10.1); solo la clave incorrecta
 *     activa el estado E (campo vacío, marcado y con el foco). El modal no se cierra.
 *   · §10.8: con el firmador encendido, si la vista previa no carga, el aviso ya no dice «aún puede
 *     firmar»: dice que la firma puede rechazarse sin aplicar nada. El botón no se apaga por eso.
 *   · D-16: el fuente del modal no escribe la clave en consola, almacenamiento, cookie ni URL.
 *
 *   Los textos se escriben A MANO (UI-SPEC §10): importarlos del catálogo convertiría cada aserción
 *   en una tautología. La clave de las pruebas es un valor ficticio, reconocible si se escapara.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la clave rechazada solo en el estado
 *   E; los demás fallos se afirman en el aviso flotante y sin caja)
 */

import { errorDelServidor } from "../../test/errores";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { resetModoDeFirmaCache } from "../../hooks/useClaveDeFirma";
// El FUENTE del modal, como texto (`?raw`, no `node:fs`): mismo patrón que ModalExcusa.test.tsx.
import fuenteDelModal from "./ModalFirmaActa.tsx?raw";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  actaDeLote: vi.fn(),
  firmarLote: vi.fn(),
  readModoDeFirma: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

// El hook de la clave lee el modo de firma por el export POR DEFECTO del servicio, así que se doblan
// los dos (el nombrado y el por defecto) con el mismo objeto.
vi.mock("../../services/SorteoService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../services/SorteoService")>();
  const dobles = {
    actaDeLote: mocks.actaDeLote,
    firmarLote: mocks.firmarLote,
    readModoDeFirma: mocks.readModoDeFirma,
  };
  return { ...real, default: dobles, SorteoService: dobles };
});

vi.mock("../../context/UserContext", () => ({
  useUser: mocks.useUser,
}));

vi.mock("../pdf/PDFViewer", () => ({
  PDFViewer: ({ document }: { document: { docUrl: string } }) => (
    <div data-testid="visor-pdf">{document.docUrl}</div>
  ),
}));

import ModalFirmaActa from "./ModalFirmaActa";

/* ─────────────────────────────── textos (UI-SPEC §10) ─────────────────────────────── */

const AVISO_SIN_FIRMADOR_ACTA =
  "La firma digital está desactivada en este despliegue: su firma quedará registrada, pero el acta quedará SIN firma criptográfica.";
const EXITO_APAGADO_DECISOR =
  "Firma registrada. La firma digital está desactivada en este despliegue: el acta quedó SIN firma criptográfica.";
const EXITO_APAGADO_DIRECTOR =
  "Firma registrada y lote aprobado en Asignaciones. El acta quedó SIN firma criptográfica: la firma digital está desactivada en este despliegue.";
const EXITO_FIRMADA_DECISOR = "Acta firmada: su firma digital quedó aplicada.";
const EXITO_FIRMADA_DIRECTOR = "Acta firmada y lote aprobado en Asignaciones.";
const TEXTO_CLAVE_INCORRECTA_SERVIDOR =
  "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.";
const TEXTO_NO_RESPONDE_SERVIDOR =
  "El servicio de firma no responde. Inténtelo de nuevo en unos minutos.";
const AVISO_SIN_VISTA_PREVIA_ENCENDIDO =
  "No se pudo cargar la vista previa del acta. Puede intentar firmar: si el acta todavía no existe, la firma se rechazará y no se aplicará nada.";
const AVISO_SIN_VISTA_PREVIA_APAGADO =
  "El acta todavía no está disponible para vista previa. Aún puede firmar; el acta se generará/actualizará en breve.";
const CLAVE_FICTICIA = "clave-ficticia-de-prueba";

/* ─────────────────────────────── utilidades ─────────────────────────────── */

const ROLES = {
  decisor: "Funcionario Decisor",
  secretario: "Secretario Abogado",
  director: "Director",
} as const;

const comoRol = (rol: keyof typeof ROLES) =>
  mocks.useUser.mockReturnValue({
    user: { usuId: 42, usuFullName: "ANDRÉS MIÑO CARRERA", rolName: ROLES[rol] },
  });

const apagado = () =>
  mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
const encendido = () =>
  mocks.readModoDeFirma.mockResolvedValue({
    firmadorHabilitado: true,
    sesionCentral: true,
  });

const montar = (onClose = vi.fn(), refetchFn = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <ModalFirmaActa
      caseData={{ amasId: 900, decisorUserId: 34 }}
      onClose={onClose}
      refetchFn={refetchFn}
    />,
  );
  return { onClose, refetchFn };
};

const botonFirmar = () =>
  screen.getByRole("button", { name: /sí, (aprobar y )?firmar/i }) as HTMLButtonElement;

const campoClave = () => screen.getByLabelText("Clave de firma") as HTMLInputElement;

/** Monta con el firmador ENCENDIDO, espera el campo y escribe la clave ficticia. */
const montarEncendidoConClave = async (onClose = vi.fn()) => {
  encendido();
  montar(onClose);
  await screen.findByLabelText("Clave de firma");
  fireEvent.change(campoClave(), { target: { value: CLAVE_FICTICIA } });
  return onClose;
};

beforeEach(() => {
  vi.clearAllMocks();
  resetModoDeFirmaCache();
  mocks.actaDeLote.mockResolvedValue({
    docName: "Acta de Sorteo (D2)",
    docUrl: "/uploads/acta.pdf",
  });
  mocks.firmarLote.mockResolvedValue({ firmado: false, expedientesSellados: 0 });
  comoRol("decisor");
});

/* ─────────────────────────────── firmador apagado ─────────────────────────────── */

describe("ModalFirmaActa — firmador APAGADO (D-11, C6)", () => {
  it("avisa que el acta quedará SIN firma criptográfica y no pide clave", async () => {
    apagado();
    montar();

    await waitFor(() => expect(mocks.readModoDeFirma).toHaveBeenCalled());
    expect(await screen.findByText(AVISO_SIN_FIRMADOR_ACTA)).toBeTruthy();
    expect(screen.queryByLabelText("Clave de firma")).toBeNull();
  });

  it("decisor: el éxito dice que el acta quedó SIN firma criptográfica (ya no promete una firma PENDIENTE)", async () => {
    apagado();
    const { onClose } = montar();
    await screen.findByText(AVISO_SIN_FIRMADOR_ACTA);

    fireEvent.click(botonFirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("success", EXITO_APAGADO_DECISOR),
    );
    expect(mocks.firmarLote).toHaveBeenCalledWith(900, 34, undefined, undefined);
    expect(onClose).toHaveBeenCalled();
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toMatch(/PENDIENTE/);
  });

  it("director: el éxito dice que el lote se aprobó y el acta quedó SIN firma criptográfica", async () => {
    comoRol("director");
    apagado();
    montar();
    await screen.findByText(AVISO_SIN_FIRMADOR_ACTA);

    fireEvent.click(botonFirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("success", EXITO_APAGADO_DIRECTOR),
    );
  });

  it("si la vista previa no carga, el aviso es el de siempre y se puede firmar", async () => {
    apagado();
    mocks.actaDeLote.mockRejectedValue(errorDelServidor("No existe el acta.", 404));
    montar();

    expect(await screen.findByText(AVISO_SIN_VISTA_PREVIA_APAGADO)).toBeTruthy();
    await screen.findByText(AVISO_SIN_FIRMADOR_ACTA);
    expect(botonFirmar().disabled).toBe(false);
  });
});

/* ─────────────────── el refresco de la bandeja no es la firma (revisión 03.21, WR-03) ─────────────────── */

describe("ModalFirmaActa — refrescar la bandeja falla DESPUÉS de una firma aplicada (WR-03)", () => {
  it("director: no pinta «No se pudo firmar», avisa de la lista y cierra; no invita a firmar de nuevo", async () => {
    comoRol("director");
    encendido();
    mocks.firmarLote.mockResolvedValue({ firmado: true, expedientesSellados: 3 });
    const onClose = vi.fn();
    const refetchFn = vi.fn().mockRejectedValue(new Error("bandeja caída"));
    montar(onClose, refetchFn);
    await screen.findByLabelText("Clave de firma");
    fireEvent.change(campoClave(), { target: { value: CLAVE_FICTICIA } });

    fireEvent.click(botonFirmar());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.firmarLote).toHaveBeenCalledTimes(1);
    expect(mocks.addToast).toHaveBeenCalledWith("success", EXITO_FIRMADA_DIRECTOR);
    expect(mocks.addToast).toHaveBeenCalledWith(
      "info",
      "Quedó hecho, pero no se pudo actualizar la lista. Actualícela antes de repetir nada.",
    );
    expect(screen.queryByText(/No se pudo firmar el acta/)).toBeNull();
  });
});

describe("ModalFirmaActa — con la firma en vuelo no se cierra (WR-04)", () => {
  it("el aspa se apaga mientras se firma, como «Cancelar», y vuelve al terminar", async () => {
    comoRol("director");
    let terminar: (valor: { firmado: boolean }) => void = () => {};
    mocks.firmarLote.mockReturnValue(
      new Promise((resolve) => {
        terminar = resolve;
      }),
    );
    const onClose = await montarEncendidoConClave();
    const aspa = screen.getByRole("button", { name: "Cerrar modal de firma" });
    expect(aspa).toBeEnabled();

    fireEvent.click(botonFirmar());

    await waitFor(() => expect(aspa).toBeDisabled());
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.click(aspa);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => terminar({ firmado: true }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

/* ─────────────────────────────── firmador encendido ─────────────────────────────── */

describe("ModalFirmaActa — firmador ENCENDIDO, firma aplicada (D-10, §10.7)", () => {
  it("decisor: la clave viaja como cuarto argumento, el éxito dice que la firma quedó aplicada y la clave se borra", async () => {
    mocks.firmarLote.mockResolvedValue({ firmado: true, expedientesSellados: 0 });
    const onClose = await montarEncendidoConClave();

    fireEvent.click(botonFirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("success", EXITO_FIRMADA_DECISOR),
    );
    expect(mocks.firmarLote).toHaveBeenCalledWith(900, 34, undefined, CLAVE_FICTICIA);
    expect(onClose).toHaveBeenCalled();
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toContain(CLAVE_FICTICIA);
    await waitFor(() => expect(campoClave().value).toBe(""));
  });

  it("secretario: el mismo aviso que el decisor", async () => {
    comoRol("secretario");
    mocks.firmarLote.mockResolvedValue({ firmado: true, expedientesSellados: 0 });
    await montarEncendidoConClave();

    fireEvent.click(botonFirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("success", EXITO_FIRMADA_DECISOR),
    );
  });

  it("director: el éxito dice firma Y aprobación", async () => {
    comoRol("director");
    mocks.firmarLote.mockResolvedValue({ firmado: true, expedientesSellados: 3 });
    await montarEncendidoConClave();

    fireEvent.click(botonFirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("success", EXITO_FIRMADA_DIRECTOR),
    );
  });
});

describe("ModalFirmaActa — firmador ENCENDIDO, la firma falla (D-10, C5, §10.1)", () => {
  it("🔴 CLAVE INCORRECTA como director: SOLO el estado E —el modal sigue abierto y el campo vuelve vacío, marcado y con el foco—, sin caja ni aviso flotante (UAT 03.21, hueco 2)", async () => {
    comoRol("director");
    mocks.firmarLote.mockRejectedValue(
      errorDelServidor(TEXTO_CLAVE_INCORRECTA_SERVIDOR, 422, "APP-FIRMA-CLAVE-001"),
    );
    const onClose = await montarEncendidoConClave();

    fireEvent.click(botonFirmar());

    await waitFor(() =>
      expect(campoClave().getAttribute("aria-invalid")).toBe("true"),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
    expect(screen.queryByText(/El acta no se firmó/)).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();

    const campo = campoClave();
    expect(campo.value).toBe("");
    expect(screen.getByText("La clave de firma no es correcta.")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(campo));
    expect(document.body.textContent).not.toContain(CLAVE_FICTICIA);

    // Escribir de nuevo retira el estado E: es un intento nuevo.
    fireEvent.change(campo, { target: { value: "otra" } });
    expect(campo.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByText("La clave de firma no es correcta.")).toBeNull();
    expect(botonFirmar().disabled).toBe(false);
  });

  it("FIRMADOR NO RESPONDE como secretario: «El acta no se firmó. …», el campo vacío y SIN marcar", async () => {
    comoRol("secretario");
    mocks.firmarLote.mockRejectedValue(
      errorDelServidor(TEXTO_NO_RESPONDE_SERVIDOR, 503, "APP-FIRMA-NO-RESPONDE-001"),
    );
    const onClose = await montarEncendidoConClave();

    fireEvent.click(botonFirmar());

    // Un 5xx lleva además la referencia de correlación al final («(ref. …)»): se ancla el comienzo.
    // Va SOLO al aviso flotante, una vez (quick 261028-kmg).
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(
          /^El acta no se firmó\. El servicio de firma no responde\. Inténtelo de nuevo en unos minutos\./,
        ),
      ),
    );
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/El acta no se firmó/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(campoClave().value).toBe("");
    expect(campoClave().getAttribute("aria-invalid")).toBeNull();
  });

  it("decisor: la consecuencia NO menciona la aprobación (eso es solo del director)", async () => {
    mocks.firmarLote.mockRejectedValue(
      errorDelServidor(TEXTO_NO_RESPONDE_SERVIDOR, 504, "APP-FIRMA-NO-RESPONDE-001"),
    );
    await montarEncendidoConClave();

    fireEvent.click(botonFirmar());

    // Un 5xx lleva además la referencia de correlación al final («(ref. …)»): se ancla el comienzo.
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(
          /^El acta no se firmó\. El servicio de firma no responde\. Inténtelo de nuevo en unos minutos\./,
        ),
      ),
    );
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toMatch(
      /no se aprobó en Asignaciones/,
    );
  });

  it("un fallo que NO es de firma: el texto de siempre, sin consecuencia delante, y la clave TAMBIÉN se borra (C5)", async () => {
    mocks.firmarLote.mockRejectedValue(
      errorDelServidor("Todavía no es su turno de firma.", 400),
    );
    await montarEncendidoConClave();

    fireEvent.click(botonFirmar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "Todavía no es su turno de firma.",
      ),
    );
    expect(JSON.stringify(mocks.addToast.mock.calls)).not.toMatch(/El acta no se firmó/);
    expect(screen.queryByText("Todavía no es su turno de firma.")).toBeNull();
    expect(campoClave().value).toBe("");
    expect(campoClave().getAttribute("aria-invalid")).toBeNull();
  });
});

describe("ModalFirmaActa — vista previa fallida con el firmador ENCENDIDO (§10.8)", () => {
  it("el aviso dice que la firma puede rechazarse sin aplicar nada, y el botón NO se apaga por eso", async () => {
    mocks.actaDeLote.mockRejectedValue(errorDelServidor("No existe el acta.", 404));
    await montarEncendidoConClave();

    expect(await screen.findByText(AVISO_SIN_VISTA_PREVIA_ENCENDIDO)).toBeTruthy();
    expect(screen.queryByText(AVISO_SIN_VISTA_PREVIA_APAGADO)).toBeNull();
    expect(botonFirmar().disabled).toBe(false);
  });
});

/* ─────────────────────────────── el fuente ─────────────────────────────── */

describe("ModalFirmaActa — el fuente (D-16, C6)", () => {
  /** Las líneas que no son comentario: un comentario puede CITAR el texto retirado para explicarlo. */
  const codigo = fuenteDelModal
    .split("\n")
    .filter((linea) => !/^\s*(\*|\/\/|\/\*)/.test(linea))
    .join("\n");

  it("no escribe en consola, almacenamiento, cookie ni URL", () => {
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

  it("ya no promete que la firma criptográfica «queda PENDIENTE»", () => {
    expect(codigo).not.toContain("queda PENDIENTE");
  });
});
