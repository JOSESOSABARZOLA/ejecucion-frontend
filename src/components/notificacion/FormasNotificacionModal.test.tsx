/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend) — pruebas
 * Archivo: FormasNotificacionModal.test.tsx
 * Responsabilidad: Fijar que esta pantalla NO puede borrar las formas de notificación que ya están
 *   declaradas en el expediente.
 *
 *   ── 🔴 EL DEFECTO QUE ESTAS PRUEBAS IMPIDEN VOLVER ───────────────────────────────────────────
 *   `PUT /notificacion/formas/:eejeId` REEMPLAZA la declaración entera; no parchea. Y las tres
 *   casillas del cuerpo nacen en `false`. Si la LECTURA de las formas fallaba, el cuerpo dejaba de
 *   cargar igual y pintaba las tres casillas vacías: pulsar «Guardar» ahí escribía «no acepta
 *   ninguna forma» encima de lo que el secretario había declarado. A partir de ese momento cada
 *   providencia que se emitiera se quedaba sin despachos — nadie notificado, ningún plazo corriendo
 *   — y no había ni un error en ninguna pantalla que lo delatara (T-03.19-70).
 *
 *   Aquí se fija la capa de la CÁSCARA: el botón no ofrece una escritura que destruiría datos. La
 *   otra capa —que el propio cuerpo se niegue aunque el pie no mire— vive en
 *   `FormasNotificacionCuerpo.test.tsx`, porque es del cuerpo y porque un pie futuro que olvidara
 *   mirar `leido` solo rompería ésta.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 */
import { errorDelServidor } from "../../test/errores";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormasNotificacionModal from "./FormasNotificacionModal";
import type { FormasAceptadas } from "../../services/NotificacionEjecucionService";

const mocks = vi.hoisted(() => ({
  formas: vi.fn(),
  guardarFormas: vi.fn(),
  agregarCorreo: vi.fn(),
  desactivarCorreo: vi.fn(),
  addToast: vi.fn(),
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

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

/** El expediente cuyo administrado SÍ aceptó dos formas. Es lo que no se puede perder. */
const FORMAS: FormasAceptadas = {
  admiId: 9,
  nombre: "Comercial Ficticia del Valle S.A.",
  correos: [
    {
      corrId: 1,
      email: "contacto@ficticia.ec",
      procedencia: "EXPEDIENTE",
      vigente: true,
    },
  ],
  casillero: "1042",
  direccion: "Av. Inventada 123",
  aceptaCorreo: true,
  aceptaCasillero: true,
  aceptaFisico: false,
};

const CASO = { eejeId: 101, expNumber: "EPAS-2026-00042" };

const montar = () =>
  render(<FormasNotificacionModal caso={CASO} onClose={vi.fn()} />);

/**
 * `hidden: true` no es un atajo: daisyUI abre el diálogo con la clase `modal-open` y SIN el atributo
 * `open`, así que para jsdom todo el contenido del `<dialog>` queda fuera del árbol de accesibilidad
 * y ninguna consulta por rol lo encuentra. Es una limitación del entorno, no de la pantalla —el
 * navegador real sí lo expone—, y se deja dicho para que nadie la lea como «el botón no es accesible».
 */
const botonGuardar = () =>
  screen.getByRole("button", { name: /Guardar/, hidden: true });

describe("FormasNotificacionModal — con la lectura de formas ROTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardarFormas.mockResolvedValue(FORMAS);
  });

  it("🔴 «Guardar» queda APAGADO: no se ofrece una escritura que borraría las formas", async () => {
    mocks.formas.mockRejectedValue(
      errorDelServidor("El servicio de notificación no responde."),
    );

    montar();

    // El motivo se ve: aquí el diálogo está abierto y la caja de error no está tapada por nada.
    // (Es justo lo que NO pasa en el paso 3 de la página de generación, que está oculto mientras
    // el decisor confirma desde el paso 4 — por eso allí hace falta además abortar la emisión.)
    expect(
      await screen.findByText("El servicio de notificación no responde."),
    ).toBeInTheDocument();

    // 🔴 `cargando` ya es `false` aquí —el indicador de carga desapareció—: si el botón mirara solo
    // esa bandera, estaría encendido. Es exactamente la confusión que abría el agujero.
    expect(screen.queryByAltText("Cargando")).toBeNull();
    expect(botonGuardar()).toBeDisabled();

    // Pulsarlo no hace nada, y nada se escribe ni se anuncia como guardado.
    fireEvent.click(botonGuardar());
    expect(mocks.guardarFormas).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it("no afirma «no hay ninguna forma aceptada» cuando lo que pasa es que no se sabe", async () => {
    mocks.formas.mockRejectedValue(new Error("502"));

    montar();
    await screen.findByText("No se pudieron leer las formas de notificación.");

    // El aviso de «sin formas» describe una consecuencia CIERTA; con la lectura rota no lo es, y
    // pintarlo haría creer al secretario que el expediente está en un estado que nadie ha mirado.
    expect(
      screen.queryByText(/Sin ninguna forma aceptada/),
    ).not.toBeInTheDocument();
  });

  it("con la lectura BIEN, guardar sigue funcionando como siempre", async () => {
    // El contrapeso: la negativa no puede haberse llevado por delante el camino normal.
    mocks.formas.mockResolvedValue(FORMAS);

    montar();
    await waitFor(() => expect(botonGuardar()).toBeEnabled());

    fireEvent.click(botonGuardar());

    await waitFor(() =>
      expect(mocks.guardarFormas).toHaveBeenCalledWith(101, {
        aceptaCorreo: true,
        aceptaCasillero: true,
        aceptaFisico: false,
        casillero: "1042",
        direccion: "Av. Inventada 123",
      }),
    );
  });
});
