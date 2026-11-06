/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend) — pruebas
 * Archivo: FormasNotificacionCuerpo.test.tsx
 * Responsabilidad: Fijar la regla que hace que este cuerpo no pueda BORRAR una declaración de
 *   formas de notificación: mientras la lectura del expediente no haya terminado BIEN, de aquí no
 *   sale ni una selección hacia arriba ni una escritura hacia el servidor.
 *
 *   ── 🔴 POR QUÉ ES ESTA REGLA Y NO OTRA ───────────────────────────────────────────────────────
 *   Dos hechos que por separado son inocentes: las tres casillas nacen en `false`, y
 *   `PUT /notificacion/formas/:eejeId` REEMPLAZA la declaración entera en vez de parchearla. Juntos
 *   convierten cualquier escritura prematura en un borrado: el expediente pasa a «no acepta ninguna
 *   forma», las providencias que se emitan después salen sin despachos, nadie queda notificado y
 *   ningún plazo empieza a correr (T-03.19-70). No hay error, no hay pantalla roja: el trámite
 *   parece haber ido bien y el daño aparece semanas después, cuando el plazo que debía correr no
 *   corrió.
 *
 *   Las dos mitades de la regla se prueban por separado porque se rompen por separado:
 *     · El SILENCIO de `onSeleccion` — es lo único que le dice a la página de generación que no
 *       tiene nada que escribir. Si se publicara una selección fantasma, la página no podría
 *       distinguirla de una declaración real: tres «no» son tan verdaderos como tres «sí».
 *     · La NEGATIVA de `guardar()` — vive dentro del cuerpo, no en el pie, para que ninguna cáscara
 *       futura que olvide mirar `leido` pueda volver a abrir el agujero.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-05: el administrado sin
 *   dirección —NULL desde la migración del 2026-10-20— se explica con una pista asociada por
 *   `aria-describedby` y «Antes: sin dirección registrada», y el texto `null` no aparece nunca).
 * Modificado por: Andrés Miño — 2026-10-26 (quick 261026-ft2: con la lectura rota tampoco sale ningún
 *   motivo de formas incompletas, y en el modal el motivo en línea se ve pero «Guardar» sigue como
 *   estaba: el servidor es la autoridad allí).
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: se dobla useToast; la negativa a
 *   guardar sin leer y el fallo al guardar se afirman en el aviso flotante; el de lectura, en línea)
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorDelServidor } from "../../test/errores";
import FormasNotificacionCuerpo from "./FormasNotificacionCuerpo";
import type { FormasAceptadas } from "../../services/NotificacionEjecucionService";

const mocks = vi.hoisted(() => ({
  formas: vi.fn(),
  guardarFormas: vi.fn(),
  agregarCorreo: vi.fn(),
  desactivarCorreo: vi.fn(),
  addToast: vi.fn(),
}));

// El cuerpo dice en el aviso flotante los fallos de añadir, desactivar y guardar (quick 261028-kmg).
vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock(
  "../../services/NotificacionEjecucionService",
  async (importOriginal) => {
    const real =
      await importOriginal<
        typeof import("../../services/NotificacionEjecucionService")
      >();
    return {
      ...real,
      NotificacionEjecucionService: {
        ...real.NotificacionEjecucionService,
        formas: mocks.formas,
        guardarFormas: mocks.guardarFormas,
        agregarCorreo: mocks.agregarCorreo,
        desactivarCorreo: mocks.desactivarCorreo,
      },
    };
  },
);

/** El expediente cuyo administrado SÍ aceptó dos formas. Es lo que no se puede perder. */
const FORMAS: FormasAceptadas = {
  admiId: 9,
  nombre: "Comercial Ficticia del Valle S.A.",
  correos: [],
  casillero: "1042",
  direccion: "Av. Inventada 123",
  aceptaCorreo: true,
  aceptaCasillero: true,
  aceptaFisico: false,
};

/**
 * 🔴 EL PIE DESCUIDADO, A PROPÓSITO. No mira `leido`: es el pie que alguien escribirá dentro de dos
 * años sin haber leído este archivo. Si la negativa viviera en el pie y no en el cuerpo, con este
 * pie el borrado volvería, y nada en las pruebas del cuerpo se pondría rojo.
 */
const PIE_DESCUIDADO = ({ guardar }: { guardar: () => Promise<boolean> }) => (
  <button type="button" onClick={() => void guardar()}>
    Guardar de todas formas
  </button>
);

describe("FormasNotificacionCuerpo — la lectura falló", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardarFormas.mockResolvedValue(FORMAS);
    mocks.formas.mockRejectedValue(new Error("502 desde notificación"));
  });

  it("🔴 NO levanta ninguna selección: la ausencia es la señal de que no hay nada declarado", async () => {
    const onSeleccion = vi.fn();
    render(<FormasNotificacionCuerpo eejeId={101} onSeleccion={onSeleccion} />);

    // Se espera a que la lectura haya terminado —el motivo ya está pintado— para que la aserción
    // no sea simplemente «todavía no ha dado tiempo».
    await screen.findByText("No se pudieron leer las formas de notificación.");
    expect(onSeleccion).not.toHaveBeenCalled();

    // Y sigue sin levantar nada después: no es un retraso, es un silencio.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSeleccion).not.toHaveBeenCalled();
  });

  it("🔴 NO publica ningún motivo de formas incompletas: sin lectura no se afirma nada", async () => {
    const onMotivo = vi.fn();
    render(
      <FormasNotificacionCuerpo
        eejeId={101}
        onMotivoFormasIncompletas={onMotivo}
      />,
    );

    await screen.findByText("No se pudieron leer las formas de notificación.");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onMotivo).not.toHaveBeenCalled();
  });

  it("🔴 se NIEGA a guardar aunque el pie se lo pida, y dice por qué en el aviso flotante", async () => {
    render(
      <FormasNotificacionCuerpo eejeId={101} renderPie={PIE_DESCUIDADO} />,
    );
    await screen.findByText("No se pudieron leer las formas de notificación.");

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar de todas formas" }),
    );

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "No se pudieron leer las formas de notificación de este expediente. Guardar ahora las borraría todas: cierre y vuelva a abrir esta pantalla cuando se puedan leer.",
      ),
    );
    // El fallo de LECTURA sigue en línea, una sola vez, y no se repite en el aviso flotante.
    expect(
      screen.getByText("No se pudieron leer las formas de notificación."),
    ).toBeInTheDocument();
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    // LO QUE IMPORTA: el `PUT` que reemplaza la declaración entera no llegó a salir.
    expect(mocks.guardarFormas).not.toHaveBeenCalled();
  });

  it("no afirma «no hay ninguna forma aceptada»: con la lectura rota eso no se sabe", async () => {
    render(<FormasNotificacionCuerpo eejeId={101} />);
    await screen.findByText("No se pudieron leer las formas de notificación.");

    expect(
      screen.queryByText(/Sin ninguna forma aceptada/),
    ).not.toBeInTheDocument();
  });
});

describe("FormasNotificacionCuerpo — la lectura fue bien (el contrapeso)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardarFormas.mockResolvedValue(FORMAS);
    mocks.formas.mockResolvedValue(FORMAS);
  });

  it("levanta lo leído y guarda: la negativa no se llevó por delante el camino normal", async () => {
    const onSeleccion = vi.fn();
    render(
      <FormasNotificacionCuerpo
        eejeId={101}
        onSeleccion={onSeleccion}
        renderPie={PIE_DESCUIDADO}
      />,
    );

    // Lo levantado es lo LEÍDO, no el `false` inicial de las casillas.
    await waitFor(() =>
      expect(onSeleccion).toHaveBeenCalledWith({
        aceptaCorreo: true,
        aceptaCasillero: true,
        aceptaFisico: false,
        casillero: "1042",
        direccion: "Av. Inventada 123",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar de todas formas" }),
    );
    await waitFor(() => expect(mocks.guardarFormas).toHaveBeenCalledTimes(1));
  });

  it("el modal sigue igual (quick 261026-ft2): enseña el motivo en línea, y aun así su pie guarda", async () => {
    // La fixture acepta correo SIN direcciones: el servidor lo rechazaría, y el cuerpo ya lo dice.
    render(
      <FormasNotificacionCuerpo eejeId={101} renderPie={PIE_DESCUIDADO} />,
    );

    expect(
      await screen.findByText(
        "Para notificar por correo hace falta al menos una dirección VIGENTE: agréguela antes de aceptar ese canal.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar de todas formas" }),
    );
    await waitFor(() => expect(mocks.guardarFormas).toHaveBeenCalledTimes(1));
  });
  it("si guardar falla, el texto del servidor sale en el aviso flotante y no en una caja (quick 261028-kmg)", async () => {
    mocks.guardarFormas.mockRejectedValue(
      errorDelServidor("El casillero es obligatorio si acepta casillero."),
    );
    render(
      <FormasNotificacionCuerpo eejeId={101} renderPie={PIE_DESCUIDADO} />,
    );
    await waitFor(() => expect(mocks.formas).toHaveBeenCalled());
    await screen.findByRole("button", { name: "Guardar de todas formas" });

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar de todas formas" }),
    );

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "El casillero es obligatorio si acepta casillero.",
      ),
    );
    expect(
      screen.queryByText("El casillero es obligatorio si acepta casillero."),
    ).toBeNull();
  });
});

/**
 * 🔴 G-05 (UI-SPEC §5) — EL ADMINISTRADO SIN DIRECCIÓN. Desde la Fase 03.24 todo EPAS de Resolución
 * llega con la dirección NULL, y el servidor la manda AUSENTE. La pantalla explica el vacío —sin
 * inventar ni ocultar el dato— y la regla D-15 (físico sin dirección) sigue siendo del servidor.
 */
describe("FormasNotificacionCuerpo — el administrado sin dirección (G-05)", () => {
  const PISTA =
    "Sin dirección registrada. Escríbala si el administrado acepta la notificación en su domicilio.";

  /** Lo que manda el servidor cuando `admi_address` es NULL: la clave no viene. */
  const SIN_DIRECCION: FormasAceptadas = {
    admiId: 9,
    nombre: "Comercial Ficticia del Valle S.A.",
    correos: [],
    casillero: "1042",
    aceptaCorreo: false,
    aceptaCasillero: true,
    aceptaFisico: false,
  };

  const campo = () =>
    screen.getByRole("textbox", { name: "Dirección del domicilio" });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardarFormas.mockResolvedValue(SIN_DIRECCION);
  });

  it("🔴 G-05 el campo queda vacío con la pista debajo, asociada por aria-describedby", async () => {
    mocks.formas.mockResolvedValue(SIN_DIRECCION);
    render(<FormasNotificacionCuerpo eejeId={101} />);

    const pista = await screen.findByText(PISTA);
    expect(pista).toHaveAttribute("id", "pista-direccion");
    expect(campo()).toHaveValue("");
    expect(campo()).toHaveAttribute("aria-describedby", "pista-direccion");
    expect(campo()).toHaveAccessibleDescription(PISTA);
  });

  it("🔴 G-05 al escribir una dirección, «Antes:» dice «sin dirección registrada» y la pista se va", async () => {
    mocks.formas.mockResolvedValue(SIN_DIRECCION);
    render(<FormasNotificacionCuerpo eejeId={101} />);
    await screen.findByText(PISTA);

    fireEvent.change(campo(), { target: { value: "Av. Amazonas N24" } });

    expect(
      screen.getByText("Antes: sin dirección registrada"),
    ).toBeInTheDocument();
    expect(screen.queryByText(PISTA)).not.toBeInTheDocument();
    expect(campo()).not.toHaveAttribute("aria-describedby");
  });

  it("con dirección: ni pista ni aria-describedby, y «Antes:» muestra la dirección", async () => {
    mocks.formas.mockResolvedValue(FORMAS);
    render(<FormasNotificacionCuerpo eejeId={101} />);
    await waitFor(() => expect(campo()).toHaveValue("Av. Inventada 123"));

    expect(screen.queryByText(PISTA)).not.toBeInTheDocument();
    expect(campo()).not.toHaveAttribute("aria-describedby");

    fireEvent.change(campo(), { target: { value: "Av. Inventada 456" } });
    expect(screen.getByText("Antes: Av. Inventada 123")).toBeInTheDocument();
  });

  it("🔴 G-05 el texto «null» no aparece nunca en el DOM", async () => {
    mocks.formas.mockResolvedValue(SIN_DIRECCION);
    const { container } = render(<FormasNotificacionCuerpo eejeId={101} />);
    await screen.findByText(PISTA);

    expect(container.textContent).not.toMatch(/null/);
    expect(campo()).not.toHaveValue("null");

    fireEvent.change(campo(), { target: { value: "x" } });
    expect(container.textContent).not.toMatch(/null/);
  });
});
