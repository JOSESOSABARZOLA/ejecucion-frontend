/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Paso 4 de la página de generación — Firma sobre el seam env-gated (D-06) — pruebas
 * Archivo: PasoFirmaClave.test.tsx
 * Responsabilidad: Fijar las dos mitades del paso 4 y, sobre todo, la regla que no se puede
 *   comprobar mirando la pantalla:
 *
 *   · Con el firmador APAGADO —el caso de hoy y el del despliegue actual— el paso EXISTE, no pinta
 *     ningún campo de contraseña y DICE, con el texto exigido, que el documento se generará sin
 *     firma criptográfica. Un paso que desaparece deja al decisor creyendo que firmó.
 *   · Con el firmador ENCENDIDO se pide la clave, con su nombre accesible y su control de
 *     mostrar/ocultar.
 *   · 🔴 LA CLAVE NO SALE DEL COMPONENTE. Se comprueba, no se supone: no aparece en ningún volcado
 *     a consola, ni en el almacenamiento del navegador, ni en la URL, ni en lo único que el
 *     componente publica hacia arriba. Es la contraparte de la aserción que el plan 12 escribió
 *     sobre el payload del compositor.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 10: el paso monta el campo único
 *   `CampoClaveCertificado`; estado C sin sesión central con `sinSesionCentral` en lo publicado; el
 *   lector de la clave que registra hacia la página; el aviso de fallo de firma y el estado E con el
 *   foco; la clave vacía tras un envío fallido; y la aserción `?raw` se extiende a la página).
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-01: `modoDesconocido` en lo publicado;
 *   un fallo al leer el modo ya no se toma por firmador apagado).
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el paso ya no pinta la caja del fallo
 *   de firma; la clave rechazada solo en el estado E del campo)
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PasoFirmaClave, { type EstadoPasoFirma } from "./PasoFirmaClave";
import { resetModoDeFirmaCache } from "../../hooks/useClaveDeFirma";
// El FUENTE del componente, como texto. Se trae con `?raw` y no con `node:fs`: este proyecto de
// TypeScript deliberadamente no le abre `fs` ni `process` al código de la app.
import fuenteDelPaso from "./PasoFirmaClave.tsx?raw";
import fuenteDeLaPagina from "../../pages/GenerarDocumentoPage.tsx?raw";

const mocks = vi.hoisted(() => ({
  readModoDeFirma: vi.fn(),
  limpiar: vi.fn(),
}));

vi.mock("../../services/SorteoService", () => ({
  default: { readModoDeFirma: mocks.readModoDeFirma },
  SorteoService: { readModoDeFirma: mocks.readModoDeFirma },
}));

/**
 * El hook REAL, con `limpiar` envuelto en un espía. Doblarlo entero habría dejado la prueba
 * afirmando sobre un doble; así se ejerce la lógica de verdad —incluida la de «si no se puede
 * consultar el modo, se asume apagado»— y además se puede ver si el borrado se llama.
 */
vi.mock("../../hooks/useClaveDeFirma", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../hooks/useClaveDeFirma")>();
  return {
    ...real,
    useClaveDeFirma: () => {
      const clave = real.useClaveDeFirma();
      return {
        ...clave,
        limpiar: () => {
          mocks.limpiar();
          clave.limpiar();
        },
      };
    },
  };
});

/**
 * 🔴 EL TEXTO EXIGIDO POR D-06, copiado de UI-SPEC §5.7 y escrito a mano aquí. Importarlo del
 * componente convertiría la aserción en una tautología.
 */
const TEXTO_FIRMA_DESACTIVADA =
  "La firma digital está desactivada en este despliegue: el documento se generará SIN firma criptográfica.";

/** El estado C (UI-SPEC §10.5), escrito a mano. */
const AVISO_SIN_SESION_CENTRAL =
  "Para firmar hay que entrar al sistema con el Auth central, y su sesión actual no lo está. Cierre sesión y vuelva a entrar por el Auth central. Mientras tanto no se puede emitir nada que lleve firma.";

/** Un valor con forma de secreto, y reconocible a simple vista si se escapara a algún sitio. */
const SECRETO = "Sup3r-Clave-Del-P12";

describe("PasoFirmaClave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModoDeFirmaCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("firmador APAGADO — el caso de hoy", () => {
    beforeEach(() => {
      mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
    });

    it("el paso EXISTE, dice el texto exigido y NO pinta ningún campo de clave", async () => {
      render(<PasoFirmaClave />);

      expect(await screen.findByText(TEXTO_FIRMA_DESACTIVADA)).toBeInTheDocument();
      expect(screen.queryByLabelText(/clave/i)).toBeNull();
      // El aviso es informativo: no hay nada que corregir, es el despliegue el que está así.
      const caja = screen
        .getByText(TEXTO_FIRMA_DESACTIVADA)
        .closest('[role="alert"]');
      expect(caja?.className).toContain("alert-info");
    });

    it("publica hacia arriba que NO hay nada que esperar: se puede generar", async () => {
      const onEstado = vi.fn();
      render(<PasoFirmaClave onEstado={onEstado} />);
      await waitFor(() => expect(mocks.readModoDeFirma).toHaveBeenCalled());

      await waitFor(() =>
        expect(onEstado).toHaveBeenLastCalledWith({
          requerida: false,
          listaParaEnviar: true,
          sinSesionCentral: false,
          modoDesconocido: false,
        }),
      );
    });

    it("si no se puede consultar el modo, NO se dice que la firma esté desactivada ni se deja generar (revisión 03.21, WR-01)", async () => {
      mocks.readModoDeFirma.mockRejectedValue(new Error("sin red"));
      const onEstado = vi.fn();
      render(<PasoFirmaClave onEstado={onEstado} />);

      expect(
        await screen.findByText(/No se pudo comprobar si la firma digital está activa/),
      ).toBeInTheDocument();
      expect(screen.queryByText(TEXTO_FIRMA_DESACTIVADA)).toBeNull();
      expect(screen.queryByLabelText(/clave/i)).toBeNull();
      await waitFor(() =>
        expect(onEstado).toHaveBeenLastCalledWith({
          requerida: false,
          listaParaEnviar: false,
          sinSesionCentral: false,
          modoDesconocido: true,
        }),
      );
    });
  });

  describe("firmador ENCENDIDO", () => {
    beforeEach(() => {
      mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: true });
    });

    it("pide la clave, con su nombre accesible y oculta por defecto", async () => {
      render(<PasoFirmaClave />);

      const campo = await screen.findByLabelText("Clave de firma");
      expect(campo).toHaveAttribute("type", "password");
      expect(campo).toHaveAttribute("autocomplete", "new-password");
      // Sin `name`: el campo no cuelga de ningún formulario y así no puede serializarse por
      // accidente en un envío que nadie escribió a propósito.
      expect(campo).not.toHaveAttribute("name");
      expect(screen.queryByText(TEXTO_FIRMA_DESACTIVADA)).toBeNull();
    });

    it("mostrar/ocultar cambia el tipo del campo y lo anuncia", async () => {
      render(<PasoFirmaClave />);
      const campo = await screen.findByLabelText("Clave de firma");

      const mostrar = screen.getByRole("button", { name: "Mostrar la clave" });
      expect(mostrar).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(mostrar);
      expect(campo).toHaveAttribute("type", "text");
      const ocultar = screen.getByRole("button", { name: "Ocultar la clave" });
      expect(ocultar).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(ocultar);
      expect(campo).toHaveAttribute("type", "password");
    });

    it("sin clave no se puede generar; con ella, sí", async () => {
      const onEstado = vi.fn();
      render(<PasoFirmaClave onEstado={onEstado} />);
      const campo = await screen.findByLabelText("Clave de firma");

      await waitFor(() =>
        expect(onEstado).toHaveBeenLastCalledWith({
          requerida: true,
          listaParaEnviar: false,
          sinSesionCentral: false,
          modoDesconocido: false,
        }),
      );

      fireEvent.change(campo, { target: { value: SECRETO } });

      await waitFor(() =>
        expect(onEstado).toHaveBeenLastCalledWith({
          requerida: true,
          listaParaEnviar: true,
          sinSesionCentral: false,
          modoDesconocido: false,
        }),
      );
    });

    it("al desmontar se borra la clave del estado", async () => {
      const { unmount } = render(<PasoFirmaClave />);
      const campo = await screen.findByLabelText("Clave de firma");
      fireEvent.change(campo, { target: { value: SECRETO } });

      expect(mocks.limpiar).not.toHaveBeenCalled();
      unmount();
      expect(mocks.limpiar).toHaveBeenCalled();
    });

    it("al TERMINAR el envío se borra la clave: no sobrevive al acto de firmar", async () => {
      const { rerender } = render(<PasoFirmaClave enviando />);
      const campo = await screen.findByLabelText("Clave de firma");
      fireEvent.change(campo, { target: { value: SECRETO } });
      expect(campo).toHaveValue(SECRETO);

      rerender(<PasoFirmaClave enviando={false} />);

      await waitFor(() => expect(campo).toHaveValue(""));
      expect(mocks.limpiar).toHaveBeenCalled();
    });
  });

  describe("firmador ENCENDIDO y SIN sesión central — estado C (Fase 03.21, D-12)", () => {
    beforeEach(() => {
      mocks.readModoDeFirma.mockResolvedValue({
        firmadorHabilitado: true,
        sesionCentral: false,
      });
    });

    it("avisa en ámbar, no pide la clave y publica que no se puede generar", async () => {
      const onEstado = vi.fn();
      render(<PasoFirmaClave onEstado={onEstado} />);

      const aviso = await screen.findByText(AVISO_SIN_SESION_CENTRAL);
      expect(aviso.closest('[role="alert"]')?.className).toContain(
        "alert-warning",
      );
      expect(screen.queryByLabelText("Clave de firma")).toBeNull();
      expect(document.querySelector('input[type="password"]')).toBeNull();
      await waitFor(() =>
        expect(onEstado).toHaveBeenLastCalledWith({
          requerida: true,
          listaParaEnviar: false,
          sinSesionCentral: true,
          modoDesconocido: false,
        }),
      );
    });
  });

  describe("el lector de la clave hacia la página (Fase 03.21, D-04/D-16)", () => {
    beforeEach(() => {
      mocks.readModoDeFirma.mockResolvedValue({
        firmadorHabilitado: true,
        sesionCentral: true,
      });
    });

    it("registra un lector que devuelve la clave en el momento de leerla, y nada al desmontar", async () => {
      let leer: (() => string | undefined) | undefined;
      const { unmount } = render(
        <PasoFirmaClave registrarLectorClave={(l) => (leer = l)} />,
      );
      const campo = await screen.findByLabelText("Clave de firma");
      expect(leer).toBeDefined();
      expect(leer?.()).toBeUndefined();

      fireEvent.change(campo, { target: { value: SECRETO } });
      await waitFor(() => expect(leer?.()).toBe(SECRETO));

      unmount();
      expect(leer?.()).toBeUndefined();
    });
  });

  describe("el fallo de firma vuelve al campo (Fase 03.21, D-07; regla de mensajes 261028-kmg)", () => {
    const AVISO_CLAVE =
      "No se generó el documento. La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.";
    const AVISO_NO_RESPONDE =
      "No se generó el documento. El servicio de firma no responde. Inténtelo de nuevo en unos minutos.";

    beforeEach(() => {
      mocks.readModoDeFirma.mockResolvedValue({
        firmadorHabilitado: true,
        sesionCentral: true,
      });
    });

    it("🔴 clave incorrecta: SOLO el estado E — campo VACÍO, marcado, con su línea y con el foco, sin caja", async () => {
      const { rerender } = render(<PasoFirmaClave enviando />);
      const campo = await screen.findByLabelText("Clave de firma");
      fireEvent.change(campo, { target: { value: SECRETO } });

      rerender(
        <PasoFirmaClave
          enviando={false}
          errorFirma={{ mensaje: AVISO_CLAVE, claveIncorrecta: true }}
        />,
      );

      await waitFor(() => expect(campo).toHaveValue(""));
      expect(campo).toHaveAttribute("aria-invalid", "true");
      // Se dice UNA vez, bajo el campo: ni la caja con la consecuencia ni ningún role="alert".
      expect(screen.queryByText(AVISO_CLAVE)).toBeNull();
      expect(
        screen.getByRole("region", { name: "Firma" }).querySelector('[role="alert"]'),
      ).toBeNull();
      expect(
        screen.getByText("La clave de firma no es correcta."),
      ).toBeInTheDocument();
      await waitFor(() => expect(document.activeElement).toBe(campo));
    });

    it("otra causa: ni caja ni campo marcado (la página lo dice en el aviso flotante), y el campo queda vacío", async () => {
      const { rerender } = render(<PasoFirmaClave />);
      const campo = await screen.findByLabelText("Clave de firma");
      fireEvent.change(campo, { target: { value: SECRETO } });

      rerender(
        <PasoFirmaClave
          errorFirma={{ mensaje: AVISO_NO_RESPONDE, claveIncorrecta: false }}
        />,
      );

      await waitFor(() => expect(campo).toHaveValue(""));
      expect(screen.queryByText(AVISO_NO_RESPONDE)).toBeNull();
      expect(document.querySelector('[role="alert"]')).toBeNull();
      expect(campo).not.toHaveAttribute("aria-invalid");
      expect(screen.queryByText("La clave de firma no es correcta.")).toBeNull();
    });

    it("escribir en el campo avisa a la página para que retire el aviso", async () => {
      const onEditarClave = vi.fn();
      render(
        <PasoFirmaClave
          errorFirma={{ mensaje: AVISO_CLAVE, claveIncorrecta: true }}
          onEditarClave={onEditarClave}
        />,
      );
      const campo = await screen.findByLabelText("Clave de firma");
      fireEvent.change(campo, { target: { value: "x" } });

      expect(onEditarClave).toHaveBeenCalled();
    });
  });

  describe("🔴 la clave no sale del componente — comprobado, no supuesto", () => {
    beforeEach(() => {
      mocks.readModoDeFirma.mockResolvedValue({ firmadorHabilitado: true });
    });

    it("no llega a la consola, ni al almacenamiento, ni a la URL, ni a lo publicado", async () => {
      const consola = {
        log: vi.spyOn(console, "log").mockImplementation(() => {}),
        info: vi.spyOn(console, "info").mockImplementation(() => {}),
        warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
        error: vi.spyOn(console, "error").mockImplementation(() => {}),
        debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      };
      const guardado = vi.spyOn(Storage.prototype, "setItem");
      const publicado: EstadoPasoFirma[] = [];

      render(<PasoFirmaClave onEstado={(e) => publicado.push(e)} />);
      const campo = await screen.findByLabelText("Clave de firma");
      fireEvent.change(campo, { target: { value: SECRETO } });
      fireEvent.click(screen.getByRole("button", { name: "Mostrar la clave" }));
      await waitFor(() => expect(publicado.length).toBeGreaterThan(0));

      // (a) Ningún volcado a consola la contiene — de hecho, ninguno se produjo.
      for (const espia of Object.values(consola)) {
        const contiene = espia.mock.calls
          .flat()
          .some((arg) => JSON.stringify(arg ?? "").includes(SECRETO));
        expect(contiene).toBe(false);
      }

      // (b) No se escribió en `localStorage` ni en `sessionStorage`.
      const enAlmacenamiento = guardado.mock.calls.some((args) =>
        args.some((a) => String(a).includes(SECRETO)),
      );
      expect(enAlmacenamiento).toBe(false);
      expect(guardado).not.toHaveBeenCalled();

      // (c) No está en la URL.
      expect(window.location.href).not.toContain(SECRETO);

      // (d) Y lo único que el componente publica hacia arriba no la lleva ni puede llevarla: se
      //     enumeran sus claves en vez de excluir un patrón, igual que hizo el plan 12 con el
      //     payload del compositor. En español «clave» es homónimo de «contraseña» y de
      //     «identificador», así que un `grep` negativo se equivoca en los dos sentidos.
      for (const estado of publicado) {
        expect(Object.keys(estado).sort()).toEqual([
          "listaParaEnviar",
          "modoDesconocido",
          "requerida",
          "sinSesionCentral",
        ]);
        for (const valor of Object.values(estado)) {
          expect(typeof valor).toBe("boolean");
        }
        expect(JSON.stringify(estado)).not.toContain(SECRETO);
      }
    });

    /**
     * ⚠️ HONESTIDAD SOBRE EL ALCANCE DE LA PRUEBA DE ARRIBA. En este jsdom `window.localStorage`
     * NO existe —no hay origen—, así que «no se escribió en el almacenamiento» es una aserción que
     * en este entorno no puede fallar aunque el componente lo intentara. Por eso la garantía de
     * verdad es esta otra, que no depende del entorno: se lee el FUENTE del componente y se
     * comprueba que no nombra ninguna de las salidas por las que un secreto se escapa. Un `grep`
     * es más pobre que una aserción de conducta, pero aquí es el que sí puede fallar.
     */
    it("el fuente del componente no nombra ninguna vía de escape", () => {
      // Las cinco salidas: volcado a consola, los dos almacenamientos, las cookies y la URL.
      for (const via of [
        "console.",
        "localStorage",
        "sessionStorage",
        "document.cookie",
        "window.location",
      ]) {
        expect(fuenteDelPaso).not.toContain(via);
      }
    });

    /**
     * Fase 03.21 (D-16): la página obtiene la clave con un getter en el instante de emitir, así que
     * su fuente también se revisa. Solo consola y almacenamientos: la página usa la URL a propósito
     * en su salvaguarda del historial, y eso no tiene que ver con la clave.
     */
    it("el fuente de la página tampoco escribe en consola ni en el almacenamiento", () => {
      for (const via of ["console.", "localStorage", "sessionStorage"]) {
        expect(fuenteDeLaPagina).not.toContain(via);
      }
    });
  });
});
