/**
 * Microservicio: ejecucion
 * Módulo: ejecucion (frontend, compartido)
 * Feature: Cerrar los modales al pulsar fuera (quick 261019-mcf)
 * Archivo: ModalContainer.cierreFuera.test.tsx
 * Responsabilidad: La prueba de INTEGRACIÓN del cierre por el fondo en un modal con formulario del
 *   registro, montado por el camino real: `ModalProvider` → `openModal` → `ModalContainer` →
 *   `ModalDeclararHacer`. Es el camino que más se presta a romperse, porque el `<dialog>` es del
 *   contenedor y lo que hay escrito lo sabe el modal: si `useCierreModal` dejara de llegar, el fondo
 *   tiraría lo escrito sin preguntar y ninguna prueba del componente suelto lo vería.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-19
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModalProvider, useModal } from "../../providers/ModalProvider";
import ModalContainer from "./ModalContainer";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  declarar: vi.fn(),
}));

// El registro importa todos los modales, y alguno arrastra el visor de PDF (sin DOMMatrix en jsdom).
vi.mock("react-pdf", () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: { workerSrc: "" }, version: "0" },
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock("../../services/ObligacionHacerService", () => ({
  ObligacionHacerService: { declarar: mocks.declarar },
  SUBIDA_TIMEOUT_MS: 45000,
}));

const Abridor = () => {
  const { openModal } = useModal();
  return (
    <button
      type="button"
      onClick={() =>
        openModal("declararHacer", {
          eejeId: 9,
          expNumber: "EXP-9",
          admiName: "Ana",
          admiLastname: "Ruiz",
        })
      }
    >
      Abrir
    </button>
  );
};

const montarYAbrir = () => {
  render(
    <ModalProvider>
      <Abridor />
      <ModalContainer />
    </ModalProvider>,
  );
  fireEvent.click(screen.getByText("Abrir"));
  return document.getElementById("contenedorModales")!;
};

/** Un clic completo en el fondo: `pointerdown` y `click` sobre el propio `<dialog>`. */
const pulsarFondo = (fondo: Element) => {
  fireEvent.pointerDown(fondo);
  fireEvent.click(fondo);
};

const campo = () =>
  screen.getByPlaceholderText(/Qué correctivo impuso la resolución/);

describe("ModalContainer — cerrar al pulsar fuera, con un modal de formulario del registro", () => {
  beforeEach(() => {
    mocks.declarar.mockReset();
  });

  it("sin nada escrito, el clic en el fondo cierra el modal", () => {
    const fondo = montarYAbrir();
    expect(
      screen.getByText("Declarar la obligación de hacer"),
    ).toBeInTheDocument();

    pulsarFondo(fondo);

    expect(document.getElementById("contenedorModales")).toBeNull();
  });

  it("un clic dentro del formulario no cierra", () => {
    montarYAbrir();
    pulsarFondo(screen.getByText("Declarar la obligación de hacer"));
    expect(document.getElementById("contenedorModales")).not.toBeNull();
  });

  it("con texto escrito pregunta; «Seguir editando» conserva lo escrito y «Descartar» cierra", () => {
    const fondo = montarYAbrir();
    fireEvent.change(campo(), { target: { value: "Retirar el letrero" } });

    pulsarFondo(fondo);
    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Seguir editando"));
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
    expect(campo()).toHaveValue("Retirar el letrero");

    pulsarFondo(fondo);
    fireEvent.click(screen.getByText("Descartar"));
    expect(document.getElementById("contenedorModales")).toBeNull();
  });

  it("Escape sigue la misma regla: con texto escrito, pregunta en vez de cerrar", () => {
    montarYAbrir();
    fireEvent.change(campo(), { target: { value: "Retirar el letrero" } });

    fireEvent.keyDown(campo(), { key: "Escape" });

    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();
    expect(document.getElementById("contenedorModales")).not.toBeNull();
  });

  it("mientras se envía, el fondo no hace nada", async () => {
    // El envío se queda colgado: es el «ocupado» del modal, y el fondo tiene que respetarlo.
    mocks.declarar.mockReturnValue(new Promise(() => {}));
    const fondo = montarYAbrir();
    fireEvent.change(campo(), { target: { value: "Retirar el letrero" } });

    fireEvent.click(screen.getByText("Declarar"));
    await waitFor(() =>
      expect(screen.getByText("Declarando…")).toBeInTheDocument(),
    );

    pulsarFondo(fondo);

    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
    expect(document.getElementById("contenedorModales")).not.toBeNull();
  });
});
