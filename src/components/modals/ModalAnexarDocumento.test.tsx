/**
 * Microservicio: ejecucion
 * Módulo: Expediente (compartido)
 * Archivo: ModalAnexarDocumento.test.tsx
 * Responsabilidad: Fijar las reglas del anexo libre después de que DEJARA DE SER UN FORMULARIO
 *   INCRUSTADO bajo la lista de documentos y pasara a un MODAL que se abre desde la cabecera de la
 *   fila (encargo del usuario, 2026-09-17).
 *
 *   ── LO QUE SE PRUEBA DE VERDAD, Y NO SOLO "LO QUE SE LE ENTREGA AL MOCK" ─────────────────────
 *   Las dos reglas que este cambio podía romper sin que nadie se enterara son de COMPORTAMIENTO,
 *   no de contrato:
 *
 *   · **El mensaje del backend se pinta TAL CUAL.** No se comprueba que el servicio fue llamado:
 *     se comprueba que la frase exacta que devolvió el servidor ESTÁ EN LA PANTALLA y que el modal
 *     NO se cerró. Es la frase que dice si la ventana está cerrada (sin decisor asignado, o ya
 *     remitido a SG); un texto propio la escondería.
 *   · **La lista se entera del anexo.** No se comprueba que `onSuccess` sea una función: se monta
 *     la CADENA COMPLETA —`openModal` → registro de modales → `ModalContainer` → subida →
 *     `triggerSuccess` → `onSuccess` de la página → `recargaSenal` → `ExpedienteDocumentos`— y se
 *     mide que la lista VUELVE A PEDIRSE y que el documento nuevo APARECE. Esa cadena atraviesa el
 *     `modalRegistry`: si la clave no estuviera registrada, este test caería.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-17
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la subida fallida se afirma en el
 *   aviso flotante, sin caja)
 */

import { errorDelServidor } from "../../test/errores";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { ExpedienteDocumento } from "../../services/EpasService";

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  adjuntarAnexo: vi.fn(),
  getDocumentos: vi.fn(),
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock("../../services/EpasService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/EpasService")>()),
  EpasService: {
    adjuntarAnexo: mocks.adjuntarAnexo,
    getDocumentos: mocks.getDocumentos,
  },
}));

/**
 * 🔴 SE MOCKEA `react-pdf`, **NO** el registro de modales.
 *
 * La prueba de abajo monta `ModalContainer`, que resuelve el componente contra el `modalRegistry`
 * REAL — y ésa es media prueba: si la clave del anexo no estuviera registrada, no habría modal que
 * rellenar. Pero el registro arrastra el visor de documentos, y con él `react-pdf`, que revienta en
 * jsdom por falta de `DOMMatrix`. Otros tests resuelven esto sustituyendo el registro entero por
 * uno de mentira; aquí no se puede sin perder lo que se quiere medir, así que el corte se hace un
 * nivel más abajo: en la librería del visor, que no participa de este flujo.
 */
vi.mock("react-pdf", () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
}));

import ModalAnexarDocumento, { MODAL_KEY } from "./ModalAnexarDocumento";
import ModalContainer from "./ModalContainer";
import { ModalProvider } from "../../providers/ModalProvider";
import { useModal } from "../../hooks/useModal";
import { ExpedienteDocumentos } from "../expediente/ExpedienteDocumentos";

/**
 * `ModalContainer` abre el modal con `dialog.showModal()`. jsdom lo implementa desde la v26, pero
 * el polyfill se deja por si el runner corriera sobre uno anterior: sin él el contenedor reventaría
 * y el fallo parecería del modal, que es justo lo que se está midiendo.
 */
beforeAll(() => {
  const proto =
    typeof HTMLDialogElement !== "undefined"
      ? HTMLDialogElement.prototype
      : null;
  if (proto && !proto.showModal) {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    proto.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
  }
});

const EEJE_ID = 7;

const PDF = () =>
  new File(["%PDF-1.4 nada"], "escaneo_004.pdf", { type: "application/pdf" });

const DESCRIPCION_BUENA = "Denuncia ciudadana firmada";

const montar = (onClose = vi.fn()) =>
  render(
    <ModalProvider>
      <ModalAnexarDocumento
        caseData={{ eejeId: EEJE_ID }}
        onClose={onClose}
      />
    </ModalProvider>,
  );

const campoDescripcion = () =>
  screen.getByPlaceholderText(/qué es el documento/i) as HTMLInputElement;

const campoArchivo = () =>
  screen.getByLabelText(/documento \(pdf/i) as HTMLInputElement;

const botonAdjuntar = () =>
  screen.getByRole("button", { name: /^adjuntar$/i }) as HTMLButtonElement;

const escribir = (texto: string) =>
  fireEvent.change(campoDescripcion(), { target: { value: texto } });

const elegir = (archivo: File) =>
  fireEvent.change(campoArchivo(), { target: { files: [archivo] } });

describe("ModalAnexarDocumento — las validaciones viajaron enteras del formulario al modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adjuntarAnexo.mockResolvedValue({ docId: 99 });
    mocks.getDocumentos.mockResolvedValue([]);
  });

  /**
   * Las dos reglas del formulario viejo: hace falta ARCHIVO y una descripción de al menos cuatro
   * caracteres. Se prueban juntas porque son la misma condición (`puedeSubir`) y romper una sin la
   * otra es el fallo típico de un copiado a medias.
   */
  const INVALIDOS: Array<[string, string, File | null]> = [
    ["sin archivo, por buena que sea la descripción", DESCRIPCION_BUENA, null],
    ["con una descripción de menos de 4 caracteres", "abc", PDF()],
    ["con una descripción que solo son espacios", "      ", PDF()],
    ["sin nada de nada", "", null],
  ];

  it.each(INVALIDOS)(
    "no deja adjuntar %s",
    async (_caso: string, descripcion: string, archivo: File | null) => {
      montar();
      if (descripcion) escribir(descripcion);
      if (archivo) elegir(archivo);

      expect(botonAdjuntar().disabled).toBe(true);

      // Y no basta con que el botón se vea apagado: se pulsa, y NO se llama al servidor.
      fireEvent.click(botonAdjuntar());
      await waitFor(() => expect(mocks.adjuntarAnexo).not.toHaveBeenCalled());
    },
  );

  it("con archivo y descripción suficiente, sí deja", () => {
    montar();
    escribir(DESCRIPCION_BUENA);
    elegir(PDF());

    expect(botonAdjuntar().disabled).toBe(false);
  });

  it("conserva el aviso de POR QUÉ la descripción importa", () => {
    // El texto se ganó su sitio: es lo que evita que el expediente se llene de «escaneo_004.pdf».
    montar();

    expect(
      screen.getByText(/no le dice nada a quien abra el expediente dentro de/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/solo pdf/i)).toBeInTheDocument();
  });

  it("sin eejeId no ofrece formulario: lo dice y no llama a nada", () => {
    render(
      <ModalProvider>
        <ModalAnexarDocumento
          caseData={{}}
          onClose={vi.fn()}
        />
      </ModalProvider>,
    );

    expect(screen.queryByPlaceholderText(/qué es el documento/i)).toBeNull();
    expect(mocks.adjuntarAnexo).not.toHaveBeenCalled();
  });
});

describe("ModalAnexarDocumento — el error del backend se muestra TAL CUAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocumentos.mockResolvedValue([]);
  });

  /**
   * 🔴 LA REGLA QUE NO SE PUEDE RELAJAR. El mensaje del servidor es el que explica la ventana —sin
   * decisor asignado, o ya remitido a SG—. Sustituirlo por «No se pudo adjuntar el documento»
   * dejaría al funcionario sin saber por qué, que es precisamente lo que se quería evitar.
   */
  it("dice la frase EXACTA del servidor en el aviso flotante (sin caja) y deja el modal abierto", async () => {
    const DEL_SERVIDOR =
      "El EPAS 7 todavía no tiene decisor asignado: no se pueden anexar documentos.";
    mocks.adjuntarAnexo.mockRejectedValue(errorDelServidor(DEL_SERVIDOR));
    const onClose = vi.fn();

    montar(onClose);
    escribir(DESCRIPCION_BUENA);
    elegir(PDF());
    fireEvent.click(botonAdjuntar());

    // La frase del servidor, una vez y sin una palabra propia encima del diagnóstico…
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith("error", DEL_SERVIDOR),
    );
    expect(mocks.addToast).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(DEL_SERVIDOR)).toBeNull();
    // …y el modal sigue abierto, con lo tecleado intacto para reintentar.
    expect(onClose).not.toHaveBeenCalled();
    expect(campoDescripcion().value).toBe(DESCRIPCION_BUENA);
  });

  it("solo cuando el error viene MUDO se pone un texto propio", async () => {
    mocks.adjuntarAnexo.mockRejectedValue({ vaya: "objeto sin message" });

    montar();
    escribir(DESCRIPCION_BUENA);
    elegir(PDF());
    fireEvent.click(botonAdjuntar());

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "No se pudo adjuntar el documento.",
      ),
    );
  });
});

describe("ModalAnexarDocumento — el éxito avisa, cierra y refresca la lista", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adjuntarAnexo.mockResolvedValue({ docId: 99 });
  });

  it("manda eejeId, descripción RECORTADA y archivo, y avisa con un toast", async () => {
    const onClose = vi.fn();
    montar(onClose);
    escribir(`   ${DESCRIPCION_BUENA}   `);
    const archivo = PDF();
    elegir(archivo);
    fireEvent.click(botonAdjuntar());

    await waitFor(() =>
      expect(mocks.adjuntarAnexo).toHaveBeenCalledWith(
        EEJE_ID,
        DESCRIPCION_BUENA,
        archivo,
      ),
    );
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        `Anexo «${DESCRIPCION_BUENA}» agregado al expediente.`,
      ),
    );
  });

  /**
   * LA CADENA ENTERA, sin atajos: la página abre el modal por el REGISTRO (`openModal(MODAL_KEY)`),
   * el modal sube, dispara `onSuccess`, la página incrementa su señal y `ExpedienteDocumentos`
   * vuelve a pedir la lista. Es lo que sustituye al `recarga` interno que el componente tenía
   * cuando el formulario vivía dentro de él.
   */
  it("🔴 tras subir, la lista de documentos se vuelve a pedir y el anexo aparece", async () => {
    const ANTES: ExpedienteDocumento[] = [
      { docId: 1, docName: "Resolución sancionatoria", docUrl: "/api/fileserver/ejecucion/documents/2026/10/a.pdf" },
    ];
    const DESPUES: ExpedienteDocumento[] = [
      ...ANTES,
      { docId: 2, docName: DESCRIPCION_BUENA, docUrl: "/api/fileserver/ejecucion/documents/2026/10/b.pdf" },
    ];
    mocks.getDocumentos
      .mockResolvedValueOnce(ANTES)
      .mockResolvedValue(DESPUES);

    const Pagina = () => {
      const { openModal } = useModal();
      const [senal, setSenal] = useState(0);
      return (
        <>
          <button
            type="button"
            onClick={() =>
              openModal(
                MODAL_KEY,
                { eejeId: EEJE_ID },
                { onSuccess: () => setSenal((n) => n + 1) },
              )
            }
          >
            Adjuntar documento
          </button>
          <ExpedienteDocumentos
            eejeId={EEJE_ID}
            recargaSenal={senal}
          />
        </>
      );
    };

    render(
      <ModalProvider>
        <Pagina />
        <ModalContainer />
      </ModalProvider>,
    );

    expect(
      await screen.findByText("Resolución sancionatoria"),
    ).toBeInTheDocument();
    expect(mocks.getDocumentos).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Adjuntar documento" }),
    );
    escribir(DESCRIPCION_BUENA);
    elegir(PDF());
    fireEvent.click(botonAdjuntar());

    // El modal se fue…
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/qué es el documento/i)).toBeNull(),
    );
    // …y la lista se pidió otra vez, con el anexo dentro.
    await waitFor(() => expect(mocks.getDocumentos).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(DESCRIPCION_BUENA)).toBeInTheDocument();
  });
});

/**
 * VALIDACIÓN DEL ARCHIVO — añadida el 2026-09-17 a petición del usuario.
 *
 * El formulario incrustado no la tenía: solo `accept="application/pdf"`, que NO es una validación
 * sino una sugerencia del diálogo del sistema — el usuario puede saltársela eligiendo «todos los
 * archivos». Sin esto, un `.docx` o un escaneo de 40 MB llegaban al servidor para que los rechazara
 * él, y el aviso aparecía DESPUÉS de esperar la subida entera.
 *
 * Lo que se afirma aquí no es que el aviso se pinte: es que el servicio **NO se llega a llamar**.
 * Un aviso visible con la petición saliendo igual no habría arreglado nada.
 */
describe("ModalAnexarDocumento — el archivo se valida antes de salir a la red", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adjuntarAnexo.mockResolvedValue({ docId: 99 });
  });

  it("🔴 un archivo que NO es PDF se rechaza aquí, sin pedírselo al servidor", async () => {
    montar();
    escribir(DESCRIPCION_BUENA);
    elegir(new File(["no soy pdf"], "denuncia.docx", { type: "application/msword" }));

    expect(await screen.findByText(/tiene que ser un PDF/i)).toBeInTheDocument();
    expect(botonAdjuntar()).toBeDisabled();

    fireEvent.click(botonAdjuntar());
    await waitFor(() => expect(mocks.adjuntarAnexo).not.toHaveBeenCalled());
  });

  it("🔴 un PDF que pasa de 10 MB se rechaza aquí, y el aviso dice qué hacer", async () => {
    montar();
    escribir(DESCRIPCION_BUENA);

    // 12 MB: se fabrica el tamaño sin reservar la memoria de verdad — jsdom lee `size` del File,
    // y un Uint8Array de 12 MB en cada corrida es peaje que la prueba no necesita pagar.
    const gordo = new File(["%PDF-1.4"], "escaneo-a-600-dpi.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(gordo, "size", { value: 12 * 1024 * 1024 });
    elegir(gordo);

    const aviso = await screen.findByText(/máximo son 10 MB/i);
    expect(aviso).toBeInTheDocument();
    // El aviso no solo dice que no: dice cómo salir del paso.
    expect(aviso.textContent).toMatch(/reduzca la resolución/i);

    fireEvent.click(botonAdjuntar());
    await waitFor(() => expect(mocks.adjuntarAnexo).not.toHaveBeenCalled());
  });

  it("un PDF válido no dispara ningún aviso y deja adjuntar", async () => {
    montar();
    escribir(DESCRIPCION_BUENA);
    elegir(PDF());

    await waitFor(() => expect(botonAdjuntar()).toBeEnabled());
    expect(screen.queryByText(/tiene que ser un PDF/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/máximo son 10 MB/i)).not.toBeInTheDocument();
  });
});
