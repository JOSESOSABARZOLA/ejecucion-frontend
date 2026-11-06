/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: El chip de PLAZO RESTANTE de la bandeja del decisor (Fase 03.19, Plan 07, D-09)
 * Archivo: ChipPlazo.test.tsx
 * Responsabilidad: Afirmar los CINCO estados del plazo por su TEXTO VISIBLE, y demostrar que el
 *   veredicto de aceptación lo pone el SERVIDOR y no el navegador.
 *
 *   ── 🔴 POR QUÉ LOS CASOS DE BORDE Y NO UN «5 días» ──────────────────────────────────────────
 *   Un chip que sabe pintar «5 días» no demuestra nada: el valor de esta columna está entero en
 *   sus fronteras. Aquí se afirman las cuatro que importan —el día en que cambia de color (2 → 3),
 *   el día en que vence (0), el plazo YA PASADO, y la fila sin fecha— porque son exactamente los
 *   sitios donde un `<=` mal puesto o un `Math.max` olvidado producen un número negativo, un chip
 *   del color equivocado o una celda vacía. Ninguno de los tres rompe la pantalla: los tres MIENTEN
 *   en silencio.
 *
 *   ── 🔴 Y POR QUÉ SE PRUEBA QUE EL NAVEGADOR NO DECIDE (T-03.19-29) ──────────────────────────
 *   `aceptado` y `aceptadoImplicito` llegan computed-on-read del backend. Si este componente
 *   dedujera la aceptación de que el plazo pasó, habría dos jueces del mismo hecho: un día el chip
 *   diría «Aceptado» y el servidor respondería que no, o al revés. Las dos pruebas del final ponen
 *   al componente delante de un plazo VENCIDO con el veredicto del servidor en contra y afirman que
 *   obedece al servidor en los dos sentidos.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-09-22 (UAT de la fase, gap 2: el rótulo del chip pasa a
 *   «Auto-aceptado» por pedido del usuario)
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ChipPlazo from "./ChipPlazo";
import { crearMiEpasAsignado } from "../../test/fixtures/miEpasAsignado";

/** Un día en milisegundos — para situar el vencimiento respecto del reloj de la prueba. */
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Un vencimiento que el componente tiene que leer como exactamente `dias` días.
 *
 * 🔴 MEDIO DÍA MENOS, no medio día más, y el signo importa: el componente redondea HACIA ARRIBA
 * (`Math.ceil`, para no quitarle al decisor un día que legalmente tiene), así que «quedan N días»
 * es el intervalo (N−1, N]. Un vencimiento a exactamente N×24h cae en el filo —y unos milisegundos
 * de lentitud de la suite lo tiran al lado equivocado—, y a N×24h + medio día ya es N+1. El centro
 * del intervalo es N×24h − medio día.
 *
 * `venceEn(0)` queda por tanto medio día en el PASADO, que es justamente lo que significa cero días
 * restantes: el plazo venció.
 */
const venceEn = (dias: number): string =>
  new Date(Date.now() + dias * UN_DIA_MS - UN_DIA_MS / 2).toISOString();

/** Una fila sin aceptar y sin excusa: el lienzo limpio sobre el que se prueba el plazo. */
const filaPendiente = (plazoVenceAt: string | undefined) =>
  crearMiEpasAsignado({
    aceptado: false,
    aceptadoExplicito: false,
    aceptadoImplicito: false,
    aceptadoAt: undefined,
    excusaPendiente: false,
    plazoVenceAt,
  });

describe("ChipPlazo — los cinco estados del plazo del decisor", () => {
  it("ACEPTADO a mano: lo dice, y no pinta ninguna cuenta de días", () => {
    render(<ChipPlazo row={crearMiEpasAsignado({ aceptado: true })} />);

    expect(screen.getByText("Aceptado")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/d[ií]as?/i);
  });

  it("🔴 ACEPTADO POR VENCIMIENTO DEL PLAZO: se dice «Auto-aceptado», y no «Aceptado»", () => {
    // Es el estado que se perdería al portar `ResolveCountdownBadge` de la rama de Resolución, que
    // cuenta contra otro plazo: pintaría «6 días» sobre un expediente que ya está aceptado.
    render(
      <ChipPlazo
        row={crearMiEpasAsignado({
          aceptado: true,
          aceptadoExplicito: false,
          aceptadoImplicito: true,
        })}
      />,
    );

    expect(screen.getByText("Auto-aceptado")).toBeInTheDocument();
  });

  it("EXCUSA PENDIENTE: gana al plazo, porque el expediente ya no espera una aceptación", () => {
    const { container } = render(
      <ChipPlazo
        row={crearMiEpasAsignado({
          aceptado: false,
          aceptadoExplicito: false,
          aceptadoImplicito: false,
          excusaPendiente: true,
          plazoVenceAt: venceEn(5),
        })}
      />,
    );

    expect(screen.getByText("Excusa pendiente")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/para aceptar/i);
    // Uno de los dos casos críticos: lleva icono ADEMÁS del texto, nunca solo color.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  // ── LAS FRONTERAS DEL PLAZO ────────────────────────────────────────────────────────────────

  it("🔴 FRONTERA (3 días): todavía NO avisa — dice «para aceptar» y usa el naranja normal", () => {
    const { container } = render(<ChipPlazo row={filaPendiente(venceEn(3))} />);

    expect(screen.getByText("3 días")).toBeInTheDocument();
    expect(screen.getByText("para aceptar")).toBeInTheDocument();
    expect(screen.queryByText("por vencer")).toBeNull();
    // El naranja normal, no el fuerte. Se mira el token, no un hex.
    expect(container.innerHTML).toContain("--app-plazo-fg)");
  });

  it("🔴 FRONTERA (2 días): AQUÍ cambia — dice «por vencer» y usa el naranja fuerte", () => {
    const { container } = render(<ChipPlazo row={filaPendiente(venceEn(2))} />);

    expect(screen.getByText("2 días")).toBeInTheDocument();
    expect(screen.getByText("por vencer")).toBeInTheDocument();
    expect(screen.queryByText("para aceptar")).toBeNull();
    expect(container.innerHTML).toContain("--app-plazo-fg-fuerte)");
    // El segundo caso crítico: icono de reloj además del texto.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("FRONTERA (1 día): el singular, que es lo que se lee el día antes de perder el expediente", () => {
    render(<ChipPlazo row={filaPendiente(venceEn(1))} />);

    expect(screen.getByText("1 día")).toBeInTheDocument();
    expect(screen.getByText("por vencer")).toBeInTheDocument();
  });

  it("🔴 EL DÍA DEL VENCIMIENTO: «0 días», nunca en blanco", () => {
    render(<ChipPlazo row={filaPendiente(venceEn(0))} />);

    expect(screen.getByText("0 días")).toBeInTheDocument();
    expect(screen.getByText("por vencer")).toBeInTheDocument();
  });

  it("🔴 PLAZO YA PASADO: se queda en «0 días» y NO pinta un número negativo", () => {
    render(<ChipPlazo row={filaPendiente(venceEn(-9))} />);

    expect(screen.getByText("0 días")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/-\s*\d/);
  });

  it("🔴 SIN FECHA DE VENCIMIENTO: «—» con texto accesible, no una celda muda", () => {
    render(<ChipPlazo row={filaPendiente(undefined)} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    // El texto tiene que EXISTIR para el lector de pantalla, no vivir solo en el `title`.
    expect(screen.getByText("Sin plazo registrado")).toBeInTheDocument();
    // Y no se inventa una cuenta a partir de `plazoDias`, que es el plazo CONCEDIDO y no el que queda.
    expect(document.body.textContent ?? "").not.toMatch(/\d+\s*d[ií]as?/i);
  });

  // ── EL VEREDICTO ES DEL SERVIDOR (T-03.19-29) ──────────────────────────────────────────────

  it("🔴 con el plazo VENCIDO pero el servidor diciendo que NO está aceptado, NO inventa la aceptación", () => {
    render(
      <ChipPlazo
        row={crearMiEpasAsignado({
          aceptado: false,
          aceptadoExplicito: false,
          aceptadoImplicito: false,
          excusaPendiente: false,
          plazoVenceAt: venceEn(-4),
        })}
      />,
    );

    expect(screen.queryByText(/Aceptado/i)).toBeNull();
    expect(screen.getByText("0 días")).toBeInTheDocument();
  });

  it("🔴 con el plazo VIVO pero el servidor diciendo que YA está aceptado, obedece al servidor", () => {
    render(
      <ChipPlazo
        row={crearMiEpasAsignado({
          aceptado: true,
          aceptadoExplicito: false,
          aceptadoImplicito: true,
          plazoVenceAt: venceEn(6),
        })}
      />,
    );

    expect(screen.getByText("Auto-aceptado")).toBeInTheDocument();
    expect(screen.queryByText("para aceptar")).toBeNull();
  });
});
