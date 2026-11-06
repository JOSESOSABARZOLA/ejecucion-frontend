/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Paso 3 de la página de generación — Notificación (D-05) — pruebas
 * Archivo: PasoNotificacion.test.tsx
 * Responsabilidad: Fijar las tres reglas del paso 3 que, si se pierden, se pierden en silencio:
 *
 *   1. Sin ninguna forma marcada SE PUEDE AVANZAR, pero el paso DICE la consecuencia, con el texto
 *      literal del contrato de copy (UI-SPEC §5.5). Es la regla cara: un documento emitido sin
 *      despachos no notifica a nadie y no arranca ningún plazo, y nadie se entera hasta que el
 *      plazo que debía correr no corrió.
 *   2. Lo marcado se LEVANTA al padre. El paso no persiste nada: el guardado ocurre al confirmar la
 *      emisión, antes de emitir, y lo orquesta la página.
 *   3. Mientras hay un envío en vuelo el contenido queda apagado: cambiar las formas a mitad del
 *      `POST` que emite un acto administrativo es una carrera que no se puede permitir.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 * Modificado por: Andrés Miño — 2026-10-26 (quick 261026-ft2: un canal MARCADO sin su dato se dice en
 *   línea bajo ese canal, con la frase del servidor, y la validez sube por `onMotivoFormasIncompletas`,
 *   aparte de la selección; ninguna forma marcada sigue siendo válido).
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: se dobla useToast: el cuerpo de las
 *   formas dice en el aviso flotante los fallos de sus acciones)
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PasoNotificacion from "./PasoNotificacion";
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

vi.mock("../../services/NotificacionEjecucionService", async (importOriginal) => {
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
});

/**
 * 🔴 EL TEXTO EXIGIDO, ESCRITO A MANO Y NO IMPORTADO DE LA FUENTE.
 * Importar la constante del componente haría que la prueba dijera «el componente pinta lo que el
 * componente dice», que es verdad siempre. Aquí está copiado de UI-SPEC §5.5, que es el contrato.
 */
const AVISO_SIN_FORMAS =
  "No hay ninguna forma de notificación aceptada. El documento se generará, pero nadie quedará notificado y no empezará a correr ningún plazo.";

const FORMAS: FormasAceptadas = {
  admiId: 9,
  nombre: "Juan Pérez",
  correos: [
    {
      corrId: 1,
      email: "juan@ejemplo.ec",
      procedencia: "EXPEDIENTE",
      vigente: true,
    },
    {
      corrId: 2,
      email: "antiguo@ejemplo.ec",
      procedencia: "ESCRITO",
      vigente: false,
    },
  ],
  casillero: "",
  direccion: "Av. Amazonas N32-14",
  aceptaCorreo: false,
  aceptaCasillero: false,
  aceptaFisico: false,
};

describe("PasoNotificacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.formas.mockResolvedValue(FORMAS);
  });

  it("sin ninguna forma marcada: DICE la consecuencia con el texto del contrato y NO bloquea", async () => {
    const onSeleccion = vi.fn();
    render(<PasoNotificacion eejeId={101} onSeleccion={onSeleccion} />);

    const aviso = await screen.findByText(AVISO_SIN_FORMAS);

    // Es una ADVERTENCIA, no un error: el servidor lo tolera y lo dice.
    const caja = aviso.closest('[role="alert"]');
    expect(caja).not.toBeNull();
    expect(caja?.className).toContain("alert-warning");
    expect(caja?.className).not.toContain("alert-error");

    // Y NO bloquea. Tres comprobaciones, porque «no bloquear» se puede romper de tres maneras:
    // (a) la sección no se declara ocupada por no haber formas…
    const seccion = screen.getByRole("region", {
      name: "Formas de notificación",
    });
    expect(seccion).not.toHaveAttribute("aria-busy", "true");
    // (b) …las casillas siguen siendo operables, así que la falta de formas no apaga nada…
    for (const casilla of screen.getAllByRole("checkbox")) {
      expect(casilla).toBeEnabled();
    }
    // (c) …y, sobre todo, la selección —vacía— se levanta igual, y lo que se levanta NO lleva
    // ninguna bandera de permiso: es el cuerpo exacto del guardado (`PUT` con
    // `forbidNonWhitelisted`). La validez de lo marcado (quick 261026-ft2) viaja APARTE, por
    // `onMotivoFormasIncompletas`. Si alguien añadiera un `puedeAvanzar` a la selección, esta
    // aserción se pone roja, que es cuando hay que releer el contrato.
    await waitFor(() => expect(onSeleccion).toHaveBeenCalled());
    const levantado = onSeleccion.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(levantado).sort()).toEqual([
      "aceptaCasillero",
      "aceptaCorreo",
      "aceptaFisico",
      "casillero",
      "direccion",
    ]);
    expect(levantado.aceptaCorreo).toBe(false);
    expect(levantado.aceptaCasillero).toBe(false);
    expect(levantado.aceptaFisico).toBe(false);
  });

  it("marcar una forma la LEVANTA al padre, y el aviso desaparece", async () => {
    const onSeleccion = vi.fn();
    render(<PasoNotificacion eejeId={101} onSeleccion={onSeleccion} />);

    await screen.findByText(AVISO_SIN_FORMAS);
    const correo = screen.getByRole("checkbox", { name: /correo/i });
    fireEvent.click(correo);

    await waitFor(() =>
      expect(onSeleccion).toHaveBeenLastCalledWith(
        expect.objectContaining({
          aceptaCorreo: true,
          aceptaCasillero: false,
          aceptaFisico: false,
        }),
      ),
    );
    expect(screen.queryByText(AVISO_SIN_FORMAS)).toBeNull();
  });

  it("mientras se envía, el contenido queda deshabilitado", async () => {
    render(<PasoNotificacion eejeId={101} enviando onSeleccion={vi.fn()} />);

    await screen.findByText(AVISO_SIN_FORMAS);
    for (const casilla of screen.getAllByRole("checkbox")) {
      expect(casilla).toBeDisabled();
    }
    expect(screen.getByLabelText(/número de casillero/i)).toBeDisabled();
    expect(screen.getByLabelText(/dirección del domicilio/i)).toBeDisabled();
  });

  it("el paso NO persiste nada por su cuenta: el guardado es de quien confirma la emisión", async () => {
    render(<PasoNotificacion eejeId={101} onSeleccion={vi.fn()} />);

    await screen.findByText(AVISO_SIN_FORMAS);
    fireEvent.click(screen.getByRole("checkbox", { name: /correo/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /físico/i }));

    expect(mocks.guardarFormas).not.toHaveBeenCalled();
  });

  it("un correo NO vigente se enseña atenuado y marcado, nunca ausente", async () => {
    render(<PasoNotificacion eejeId={101} onSeleccion={vi.fn()} />);

    const antiguo = await screen.findByText("antiguo@ejemplo.ec");
    expect(antiguo.className).toContain("line-through");
    expect(screen.getByText("No vigente")).toBeInTheDocument();
    // Y la vigente sigue ahí, sin tachar: las dos conviven.
    expect(screen.getByText("juan@ejemplo.ec").className).not.toContain(
      "line-through",
    );
  });

  it("lleva el rótulo del contrato y lo usa como nombre accesible de la sección", async () => {
    render(<PasoNotificacion eejeId={101} onSeleccion={vi.fn()} />);

    await screen.findByText(AVISO_SIN_FORMAS);
    expect(
      screen.getByRole("region", { name: "Formas de notificación" }),
    ).toBeInTheDocument();
  });
});

/**
 * 🔴 QUICK 261026-ft2 — UN CANAL MARCADO SIN SU DATO. El servidor lo rechaza (D-15) y antes solo se
 * descubría al confirmar la emisión. Las frases son las del servidor, ESCRITAS A MANO.
 */
describe("PasoNotificacion — un canal marcado sin su dato (quick 261026-ft2)", () => {
  const FRASE_CORREO =
    "Para notificar por correo hace falta al menos una dirección VIGENTE: agréguela antes de aceptar ese canal.";
  const FRASE_CASILLERO =
    "Para notificar por casillero judicial hace falta su número: indíquelo antes de aceptar ese canal.";
  const FRASE_FISICO =
    "Para aceptar la notificación en el domicilio hace falta la dirección del administrado.";
  const PISTA_G05 =
    "Sin dirección registrada. Escríbala si el administrado acepta la notificación en su domicilio.";

  const region = () =>
    within(screen.getByRole("region", { name: "Formas de notificación" }));

  /** Lo último que el paso dijo sobre la validez. */
  const ultimoMotivo = (fn: ReturnType<typeof vi.fn>) =>
    fn.mock.calls[fn.mock.calls.length - 1]?.[0] as string | undefined;

  const montar = () => {
    const onMotivo = vi.fn();
    render(
      <PasoNotificacion
        eejeId={101}
        onSeleccion={vi.fn()}
        onMotivoFormasIncompletas={onMotivo}
      />,
    );
    return onMotivo;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.formas.mockResolvedValue(FORMAS);
  });

  it("ninguna marcada: tras leer publica undefined, sin motivo en línea, y el aviso sigue", async () => {
    const onMotivo = montar();

    await screen.findByText(AVISO_SIN_FORMAS);
    await waitFor(() => expect(onMotivo).toHaveBeenCalled());
    expect(ultimoMotivo(onMotivo)).toBeUndefined();
    for (const frase of [FRASE_CORREO, FRASE_CASILLERO, FRASE_FISICO]) {
      expect(screen.queryByText(frase)).toBeNull();
    }
  });

  it("correo con SOLO direcciones no vigentes: marcarlo da el motivo en línea; desmarcarlo lo quita", async () => {
    mocks.formas.mockResolvedValue({
      ...FORMAS,
      correos: FORMAS.correos.filter((c) => !c.vigente),
    });
    const onMotivo = montar();
    await screen.findByText(AVISO_SIN_FORMAS);

    const casilla = region().getByRole("checkbox", { name: /correo/i });
    fireEvent.click(casilla);

    await waitFor(() => expect(ultimoMotivo(onMotivo)).toBe(FRASE_CORREO));
    expect(region().getByText(FRASE_CORREO)).toBeInTheDocument();
    expect(casilla).toHaveAttribute("aria-invalid", "true");
    expect(casilla).toHaveAccessibleDescription(
      expect.stringContaining(FRASE_CORREO),
    );

    fireEvent.click(casilla);
    await waitFor(() => expect(ultimoMotivo(onMotivo)).toBeUndefined());
    expect(screen.queryByText(FRASE_CORREO)).toBeNull();
    expect(casilla).not.toHaveAttribute("aria-invalid");
  });

  it("casillero vacío: marcarlo da el motivo; los espacios no valen; el número lo quita", async () => {
    const onMotivo = montar();
    await screen.findByText(AVISO_SIN_FORMAS);

    const casilla = region().getByRole("checkbox", { name: /casillero/i });
    const campo = region().getByLabelText("Número de casillero");
    fireEvent.click(casilla);

    await waitFor(() => expect(ultimoMotivo(onMotivo)).toBe(FRASE_CASILLERO));
    expect(region().getByText(FRASE_CASILLERO)).toBeInTheDocument();
    expect(casilla).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription(
      expect.stringContaining(FRASE_CASILLERO),
    );

    fireEvent.change(campo, { target: { value: "   " } });
    expect(ultimoMotivo(onMotivo)).toBe(FRASE_CASILLERO);
    expect(region().getByText(FRASE_CASILLERO)).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: "1042" } });
    await waitFor(() => expect(ultimoMotivo(onMotivo)).toBeUndefined());
    expect(screen.queryByText(FRASE_CASILLERO)).toBeNull();
    expect(campo).not.toHaveAttribute("aria-invalid");
    expect(casilla).not.toHaveAttribute("aria-invalid");
  });

  it("físico sin dirección (G-05): el motivo se suma a la pista en la descripción del campo; escribirla lo quita", async () => {
    mocks.formas.mockResolvedValue({
      admiId: FORMAS.admiId,
      nombre: FORMAS.nombre,
      correos: FORMAS.correos,
      casillero: FORMAS.casillero,
      aceptaCorreo: false,
      aceptaCasillero: false,
      aceptaFisico: false,
    } satisfies FormasAceptadas);
    const onMotivo = montar();
    await screen.findByText(AVISO_SIN_FORMAS);

    const casilla = region().getByRole("checkbox", { name: /físico/i });
    const campo = region().getByLabelText("Dirección del domicilio");
    fireEvent.click(casilla);

    await waitFor(() => expect(ultimoMotivo(onMotivo)).toBe(FRASE_FISICO));
    expect(region().getByText(FRASE_FISICO)).toBeInTheDocument();
    expect(casilla).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription(
      expect.stringContaining(PISTA_G05),
    );
    expect(campo).toHaveAccessibleDescription(
      expect.stringContaining(FRASE_FISICO),
    );

    fireEvent.change(campo, { target: { value: "Av. Amazonas N24" } });
    await waitFor(() => expect(ultimoMotivo(onMotivo)).toBeUndefined());
    expect(screen.queryByText(FRASE_FISICO)).toBeNull();
    expect(campo).not.toHaveAttribute("aria-invalid");
  });

  it("correo con una dirección vigente: marcarlo es válido", async () => {
    const onMotivo = montar();
    await screen.findByText(AVISO_SIN_FORMAS);

    fireEvent.click(region().getByRole("checkbox", { name: /correo/i }));

    await waitFor(() => expect(screen.queryByText(AVISO_SIN_FORMAS)).toBeNull());
    expect(ultimoMotivo(onMotivo)).toBeUndefined();
    expect(screen.queryByText(FRASE_CORREO)).toBeNull();
  });
});
