/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend) — tests
 * Feature: Estado de la sincronización automática con Resolución (Fase 03.24, Plan 07, D-10/D-13)
 * Archivo: LineaSincronizacion.test.tsx
 * Responsabilidad: Fijar qué dice la línea de la Bandeja de Entrada para cada estado que manda el
 *   servidor: nada con la integración apagada, «correcta», «con N fallo(s)» con los motivos en el
 *   `title`, «falló: <motivo>», «Sincronizando…» y «aún no hubo pasadas». Usa un `ahora` fijo para
 *   que «hace N minutos» no dependa del reloj de la máquina.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-20
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 18, G-16): la línea visible deja de ser
 *   una región viva; la prueba la busca por su texto y no por `role="status"`. Un bloque nuevo fija
 *   el nodo `sr-only` que solo anuncia el CAMBIO de resultado, nunca el reloj.
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 24, G-09): un bloque nuevo fija que los
 *   casos tardíos van en el `title` en un bloque propio, aparte de los fallos, sin tocar la línea
 *   visible, y que sin los campos el `title` es el de siempre.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LineaSincronizacion, {
  PREFIJO_ULTIMA_SINCRONIZACION,
  TEXTO_SIN_PASADAS,
  TEXTO_SINCRONIZANDO,
  TITULO_TARDIOS,
} from "./LineaSincronizacion";
import type {
  EstadoSincronizacionResolucion,
  FalloSincronizacion,
} from "../../services/EntradaLotesService";

const AHORA = new Date(2026, 9, 20, 10, 30, 0);
const HACE_3_MIN = new Date(2026, 9, 20, 10, 27, 0).toISOString();
const HACE_3_MIN_Y_POCO = new Date(2026, 9, 20, 10, 26, 50).toISOString();

/** Factoría: un estado CORRECTO de hace 3 minutos, que cada prueba retoca. */
const estado = (
  overrides: Partial<EstadoSincronizacionResolucion> = {},
): EstadoSincronizacionResolucion => ({
  habilitada: true,
  intervaloMinutos: 5,
  enCurso: false,
  resultado: "CORRECTA",
  inicio: HACE_3_MIN_Y_POCO,
  fin: HACE_3_MIN,
  motivo: null,
  lotes: 2,
  casosNuevos: 4,
  casosActualizados: 1,
  reingresados: 0,
  fallos: [],
  fallosTotales: 0,
  truncado: false,
  ...overrides,
});

const fallo = (
  motivo: string,
  extra: Partial<FalloSincronizacion> = {},
): FalloSincronizacion => ({
  pagina: null,
  enloId: null,
  resolucionCasoId: null,
  motivo,
  ...extra,
});

/**
 * El contenedor VISIBLE de la línea. Ya no tiene `role` (G-16): se llega a él por su primer texto,
 * que es hijo directo del contenedor en los tres casos (con resultado, en curso y sin pasadas).
 */
const linea = (): HTMLElement => {
  const primerTexto = screen.getByText(
    /^(Última sincronización|Sincronizando…|Aún no ha habido)/,
  );
  const contenedor = primerTexto.parentElement;
  if (!contenedor) throw new Error("La línea visible no tiene contenedor");
  return contenedor;
};

/** El nodo vivo `sr-only`: lo único que el lector de pantalla anuncia por su cuenta. */
const anuncio = () => screen.getByRole("status");

describe("LineaSincronizacion — D-10: con la integración apagada no cambia nada visible", () => {
  it("sin estado (aún no llegó o el endpoint falló) no pinta nada", () => {
    const { container } = render(
      <LineaSincronizacion estado={null} ahora={AHORA} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("con `habilitada: false` no pinta nada, aunque el resto del estado traiga datos", () => {
    const { container } = render(
      <LineaSincronizacion
        estado={estado({ habilitada: false })}
        ahora={AHORA}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("LineaSincronizacion — D-13: traduce el estado del servidor", () => {
  it("el contenedor visible no tiene role: el lector la lee al llegar a ella, no por su cuenta (G-16)", () => {
    render(<LineaSincronizacion estado={estado()} ahora={AHORA} />);
    expect(linea()).toBeInTheDocument();
    expect(linea()).not.toHaveAttribute("role");
  });

  it("CORRECTA hace 3 min → «Última sincronización: hace 3 minutos · correcta»", () => {
    render(<LineaSincronizacion estado={estado()} ahora={AHORA} />);
    const texto = linea().textContent ?? "";
    expect(texto).toContain(PREFIJO_ULTIMA_SINCRONIZACION);
    expect(texto).toContain("Última sincronización");
    expect(texto).toContain("hace 3 minutos");
    expect(texto).toContain("correcta");
  });

  it("PARCIAL con 2 fallos → «con 2 fallo(s)» y el `title` enumera los dos motivos con su página o lote", () => {
    render(
      <LineaSincronizacion
        estado={estado({
          resultado: "PARCIAL",
          fallosTotales: 2,
          fallos: [
            fallo("Resolución respondió 422: página rechazada", { pagina: 3 }),
            fallo("Al expediente le falta expZone", {
              enloId: 42,
              resolucionCasoId: 2313,
            }),
          ],
        })}
        ahora={AHORA}
      />,
    );
    expect(linea().textContent).toContain("con 2 fallo(s)");
    const title = linea().getAttribute("title") ?? "";
    expect(title).toContain("pág. 3");
    expect(title).toContain("Resolución respondió 422: página rechazada");
    expect(title).toContain("lote 42");
    expect(title).toContain("Al expediente le falta expZone");
    expect(title).not.toMatch(/se muestran/i);
  });

  it("PARCIAL con 25 fallos y solo 20 en la lista → el `title` avisa de que se muestran 20 de 25", () => {
    const veinte = Array.from({ length: 20 }, (_, i) =>
      fallo(`motivo ${i + 1}`, { enloId: i + 1 }),
    );
    render(
      <LineaSincronizacion
        estado={estado({
          resultado: "PARCIAL",
          fallosTotales: 25,
          fallos: veinte,
        })}
        ahora={AHORA}
      />,
    );
    expect(linea().textContent).toContain("con 25 fallo(s)");
    expect(linea().getAttribute("title")).toMatch(/se muestran 20 de 25/i);
  });

  it("FALLIDA → «falló: <motivo>» con el motivo que dio el servidor", () => {
    render(
      <LineaSincronizacion
        estado={estado({
          resultado: "FALLIDA",
          motivo: "Resolución respondió 401: credencial rechazada",
          fallosTotales: 1,
          fallos: [fallo("Resolución respondió 401: credencial rechazada")],
        })}
        ahora={AHORA}
      />,
    );
    const texto = linea().textContent ?? "";
    expect(texto).toContain(PREFIJO_ULTIMA_SINCRONIZACION);
    expect(texto).toContain("falló: Resolución respondió 401");
  });

  it("en curso → «Sincronizando…»", () => {
    render(
      <LineaSincronizacion estado={estado({ enCurso: true })} ahora={AHORA} />,
    );
    expect(linea().textContent).toContain(TEXTO_SINCRONIZANDO);
    expect(linea().textContent).toContain("Sincronizando…");
  });

  it("NUNCA → dice que aún no hubo pasadas y cada cuánto corre la sincronización", () => {
    render(
      <LineaSincronizacion
        estado={estado({
          resultado: "NUNCA",
          inicio: null,
          fin: null,
          intervaloMinutos: 5,
        })}
        ahora={AHORA}
      />,
    );
    const texto = linea().textContent ?? "";
    expect(texto).toContain(TEXTO_SIN_PASADAS);
    expect(texto).toContain("cada 5 min");
    expect(texto).not.toContain(PREFIJO_ULTIMA_SINCRONIZACION);
  });
});

describe("LineaSincronizacion — G-16: solo se anuncia el CAMBIO de resultado, nunca el reloj", () => {
  const MOTIVO_401 = "Resolución respondió 401: credencial rechazada";

  it("hay un nodo `sr-only` con role=status, aria-live=polite y aria-atomic=true", () => {
    render(<LineaSincronizacion estado={estado()} ahora={AHORA} />);
    const nodo = anuncio();
    expect(nodo).toHaveClass("sr-only");
    expect(nodo).toHaveAttribute("aria-live", "polite");
    expect(nodo).toHaveAttribute("aria-atomic", "true");
  });

  it("la primera lectura no se anuncia, aunque sea FALLIDA", () => {
    render(
      <LineaSincronizacion
        estado={estado({ resultado: "FALLIDA", motivo: MOTIVO_401 })}
        ahora={AHORA}
      />,
    );
    expect(anuncio()).toBeEmptyDOMElement();
  });

  it("de CORRECTA a FALLIDA anuncia «La última sincronización falló: {motivo}.»", () => {
    const { rerender } = render(
      <LineaSincronizacion estado={estado()} ahora={AHORA} />,
    );
    rerender(
      <LineaSincronizacion
        estado={estado({ resultado: "FALLIDA", motivo: MOTIVO_401 })}
        ahora={AHORA}
      />,
    );
    expect(anuncio().textContent).toBe(
      `La última sincronización falló: ${MOTIVO_401}.`,
    );
  });

  it("de CORRECTA a PARCIAL con 3 fallos anuncia «… terminó con 3 fallo(s).»", () => {
    const { rerender } = render(
      <LineaSincronizacion estado={estado()} ahora={AHORA} />,
    );
    rerender(
      <LineaSincronizacion
        estado={estado({ resultado: "PARCIAL", fallosTotales: 3 })}
        ahora={AHORA}
      />,
    );
    expect(anuncio().textContent).toBe(
      "La última sincronización terminó con 3 fallo(s).",
    );
  });

  it.each([
    ["FALLIDA", { resultado: "FALLIDA", motivo: MOTIVO_401 }],
    ["PARCIAL", { resultado: "PARCIAL", fallosTotales: 2 }],
  ] as const)(
    "de %s a CORRECTA anuncia «La sincronización vuelve a ser correcta.»",
    (_nombre, previo) => {
      const { rerender } = render(
        <LineaSincronizacion estado={estado(previo)} ahora={AHORA} />,
      );
      rerender(<LineaSincronizacion estado={estado()} ahora={AHORA} />);
      expect(anuncio().textContent).toBe(
        "La sincronización vuelve a ser correcta.",
      );
    },
  );

  it("no cambia entre dos lecturas con el mismo resultado y distinto hace N", () => {
    const { rerender } = render(
      <LineaSincronizacion estado={estado()} ahora={AHORA} />,
    );
    // Pasa a FALLIDA: hay un anuncio, y tiene que quedarse quieto.
    rerender(
      <LineaSincronizacion
        estado={estado({ resultado: "FALLIDA", motivo: MOTIVO_401 })}
        ahora={AHORA}
      />,
    );
    const antes = anuncio().textContent;
    expect(antes).not.toBe("");
    // Otro minuto (otro «hace N») y otra pasada (otro `fin`) con el mismo resultado.
    rerender(
      <LineaSincronizacion
        estado={estado({
          resultado: "FALLIDA",
          motivo: MOTIVO_401,
          fin: new Date(2026, 9, 20, 10, 32, 0).toISOString(),
        })}
        ahora={new Date(2026, 9, 20, 10, 40, 0)}
      />,
    );
    expect(anuncio().textContent).toBe(antes);
  });

  it("no cambia con «Sincronizando…» ni al volver con el mismo resultado", () => {
    const { rerender } = render(
      <LineaSincronizacion estado={estado()} ahora={AHORA} />,
    );
    rerender(
      <LineaSincronizacion estado={estado({ enCurso: true })} ahora={AHORA} />,
    );
    expect(anuncio()).toBeEmptyDOMElement();
    rerender(<LineaSincronizacion estado={estado()} ahora={AHORA} />);
    expect(anuncio()).toBeEmptyDOMElement();
  });
});

/**
 * G-09 (pantalla, Plan 24): los casos TARDÍOS —llegaron a un lote que ya salió a sorteo— van en el
 * `title`, en un bloque PROPIO y separado de los fallos. No son fallos: la línea visible, su anuncio
 * y `fallosTotales` no los cuentan (UI-SPEC L-5). Sin los campos (un backend anterior), el `title`
 * es el de siempre.
 */
describe("LineaSincronizacion — G-09: los casos tardíos en el `title`, aparte de los fallos", () => {
  const tardio = (
    resolucionCasoId: number,
    extra: Partial<FalloSincronizacion> = {},
  ): FalloSincronizacion =>
    fallo(
      "lote 900: ya salió a sorteo en Ejecución; el caso entra cuando Resolución lo mande en un lote nuevo",
      { pagina: 1, enloId: 900, resolucionCasoId, ...extra },
    );

  it("CORRECTA con un tardío: la línea sigue «correcta» y el `title` lo cuenta en su bloque", () => {
    render(
      <LineaSincronizacion
        estado={estado({ casosTardios: 1, tardios: [tardio(201)] })}
        ahora={AHORA}
      />,
    );
    const texto = linea().textContent ?? "";
    expect(texto).toContain("correcta");
    expect(texto).not.toMatch(/fallo/i);
    const title = linea().getAttribute("title") ?? "";
    expect(title).toContain(TITULO_TARDIOS);
    expect(title).toContain(
      "- pág. 1 · lote 900 · caso 201: lote 900: ya salió a sorteo",
    );
    expect(title).not.toContain("Fallos de la última sincronización");
  });

  it("PARCIAL con un fallo y un tardío: dos bloques separados, primero los fallos", () => {
    render(
      <LineaSincronizacion
        estado={estado({
          resultado: "PARCIAL",
          fallosTotales: 1,
          fallos: [fallo("Al expediente le falta expZone", { enloId: 42 })],
          casosTardios: 1,
          tardios: [tardio(201)],
        })}
        ahora={AHORA}
      />,
    );
    expect(linea().textContent).toContain("con 1 fallo(s)");
    const title = linea().getAttribute("title") ?? "";
    const iFallos = title.indexOf("Fallos de la última sincronización:");
    const iTardios = title.indexOf(TITULO_TARDIOS);
    expect(iFallos).toBeGreaterThanOrEqual(0);
    expect(iTardios).toBeGreaterThan(iFallos);
    const bloqueFallos = title.slice(iFallos, iTardios);
    const bloqueTardios = title.slice(iTardios);
    expect(bloqueFallos).toContain("Al expediente le falta expZone");
    expect(bloqueFallos).not.toContain("caso 201");
    expect(bloqueTardios).toContain("caso 201");
    expect(bloqueTardios).not.toContain("Al expediente le falta expZone");
  });

  it("25 tardíos y 20 en la lista: el bloque acaba en «(se muestran 20 de 25)»", () => {
    const veinte = Array.from({ length: 20 }, (_, i) => tardio(300 + i));
    render(
      <LineaSincronizacion
        estado={estado({ casosTardios: 25, tardios: veinte })}
        ahora={AHORA}
      />,
    );
    const title = linea().getAttribute("title") ?? "";
    expect(title.endsWith("(se muestran 20 de 25)")).toBe(true);
    expect(linea().textContent).toContain("correcta");
  });

  it("sin los campos (backend anterior), el `title` es el de siempre", () => {
    render(<LineaSincronizacion estado={estado()} ahora={AHORA} />);
    expect(linea().getAttribute("title")).toBe(
      "Lotes: 2 · casos nuevos: 4 · actualizados: 1 · reingresados: 0",
    );
  });
});
