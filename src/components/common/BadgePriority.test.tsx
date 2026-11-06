/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend)
 * Feature: C4 del contrato de UI de la Fase 03.20 — el chip del despacho
 * Archivo: BadgePriority.test.tsx
 * Responsabilidad: Fijar con aserciones EJECUTABLES las dos correcciones medidas que la Fase 03.20
 *   le hace al chip compartido, y —sobre todo— que son ADITIVAS.
 *
 *   ── LAS DOS CORRECCIONES, Y POR QUÉ SE PRUEBAN ASÍ ───────────────────────────────────────────
 *   (1) `pendiente` entra en el mapa con la píldora PÁLIDA. La aserción que más pesa de este
 *       archivo no es la que dice de qué color sale `pendiente`: es la que dice que el chip de un
 *       estado DESCONOCIDO y el de `pendiente` NO son el mismo. El chip por defecto significa «no
 *       conozco este estado»; si `pendiente` cayera ahí, un estado mal escrito se vería idéntico al
 *       único sobre el que el secretario tiene que actuar.
 *   (2) El chip gana el escalón de 12px. `xs` son 10px y `md` son 14px: entre los dos no había
 *       nada, y por debajo de 12px está prohibido por escrito desde la Fase 03.19.
 *
 *   ── LO QUE ESTE ARCHIVO NO PRUEBA, Y NO LO INTENTA ───────────────────────────────────────────
 *   🔴 Ningún color resuelto y ningún contraste. jsdom no calcula CSS: no sabe qué pinta
 *   `badge-ghost` ni sobre qué fondo cae. Los contrastes están MEDIDOS en el contrato de UI de la
 *   fase (10,6:1 en claro, 14,7:1 en oscuro) y su comprobación es humana, en los dos temas. Aquí se
 *   asierta sobre `className`, que es lo único que este componente decide de verdad.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-25
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BadgePriority, { BADGE_GROUPS } from "./BadgePriority";

/** El `<div>` del chip es el que lleva el texto: no hay rol que pedir, así que se pide por texto. */
const chipDe = (texto: string) => screen.getByText(texto);

describe("BadgePriority — el chip del despacho (Fase 03.20, C4 del contrato de UI)", () => {
  it("`pendiente` sale con la píldora pálida, no con el chip por defecto", () => {
    render(<BadgePriority text="Pendiente" priority="pendiente" size="sm" />);

    expect(chipDe("Pendiente")).toHaveClass("badge-ghost");
  });

  it("🔴 el chip de un estado DESCONOCIDO no es el mismo que el de `pendiente`", () => {
    // Es la aserción que protege la razón de ser del mapeo: sin ella, alguien podría «simplificar»
    // borrando la clave y las dos cosas se verían igual sin que nada fallara.
    render(
      <>
        <BadgePriority text="Pendiente" priority="pendiente" size="sm" />
        <BadgePriority text="Inventado" priority="zzz-no-existe" size="sm" />
      </>,
    );

    const pendiente = chipDe("Pendiente").className;
    const desconocido = chipDe("Inventado").className;

    expect(pendiente).not.toEqual(desconocido);
    expect(BADGE_GROUPS.pendiente).not.toEqual(BADGE_GROUPS.default);
  });

  it("un estado que el mapa no conoce sigue cayendo al chip por defecto", () => {
    render(<BadgePriority text="Inventado" priority="zzz-no-existe" size="sm" />);

    const chip = chipDe("Inventado");
    expect(chip).toHaveClass("badge-soft");
    expect(chip).toHaveClass("badge-info");
  });

  it("`notificado` NO cambia: sigue siendo la píldora azul marino", () => {
    render(<BadgePriority text="Notificado" priority="notificado" size="sm" />);

    expect(chipDe("Notificado")).toHaveClass("badge-secondary");
    expect(BADGE_GROUPS.notificado).toBe("badge-secondary");
  });

  it("`rechazado` NO cambia: sigue siendo la roja", () => {
    render(<BadgePriority text="Rechazado" priority="rechazado" size="sm" />);

    expect(chipDe("Rechazado")).toHaveClass("badge-error");
    expect(BADGE_GROUPS.rechazado).toBe("badge-error");
  });

  it("sin pasar tamaño sigue saliendo el de 14px, igual que hoy", () => {
    render(<BadgePriority text="Notificado" priority="notificado" />);

    const chip = chipDe("Notificado");
    expect(chip).toHaveClass("badge-md");
    expect(chip).not.toHaveClass("badge-sm");
  });

  it("con el escalón nuevo sale la clase de 12px", () => {
    render(<BadgePriority text="Pendiente" priority="pendiente" size="sm" />);

    expect(chipDe("Pendiente")).toHaveClass("badge-sm");
  });

  it("los tres escalones anteriores siguen produciendo su clase de siempre", () => {
    // La prueba del cambio ADITIVO: si alguien renombrara o quitara un escalón para «ordenar» la
    // unión, esto se pone rojo antes de que una pantalla ajena a esta fase cambie de aspecto.
    render(
      <>
        <BadgePriority text="Uno" priority="alta" size="xs" />
        <BadgePriority text="Dos" priority="media" size="md" />
        <BadgePriority text="Tres" priority="baja" size="lg" />
      </>,
    );

    expect(chipDe("Uno")).toHaveClass("badge-xs");
    expect(chipDe("Dos")).toHaveClass("badge-md");
    expect(chipDe("Tres")).toHaveClass("badge-lg");
  });

  it("sin texto no pinta nada", () => {
    const { container } = render(
      <BadgePriority text={undefined} priority="pendiente" size="sm" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("IN-09: por defecto sigue siendo un div; con como=\"span\" es un span con las mismas clases", () => {
    render(
      <>
        <BadgePriority text="Bloque" priority="alta" size="xs" />
        <BadgePriority text="EnLinea" priority="alta" size="xs" como="span" />
      </>,
    );

    expect(chipDe("Bloque").tagName).toBe("DIV");
    expect(chipDe("EnLinea").tagName).toBe("SPAN");
    expect(chipDe("EnLinea")).toHaveClass("badge", "badge-error", "badge-xs");
  });
});
