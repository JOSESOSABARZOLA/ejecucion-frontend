/**
 * Microservicio: ejecucion
 * Módulo: Firma digital (frontend) — Expediente
 * Feature: El sello «Firmado» de un documento del expediente (Fase 03.21, D-15/D-26, UI-SPEC §8.1)
 * Archivo: SelloFirma.test.tsx
 * Responsabilidad: Fijar las tres caras del sello —«Firmado» con una línea por firma, el chip
 *   «Sin firma» de lo que la requería y no la tiene, y nada en el resto— y sus dos aserciones
 *   negativas: el rótulo nunca cuenta firmas («1 de 3») y nunca lleva la variante suave ilegible.
 *
 *   ⚠️ jsdom no calcula CSS: aquí se afirman CLASES y ESTRUCTURA. El contraste del sello (6,8:1 /
 *   8,4:1) se mira con un par de ojos en los dos temas (UI-SPEC §12).
 *
 *   Datos INVENTADOS: ningún nombre real de la base entra en un fixture.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SelloFirma from "./SelloFirma";
import type { FirmaDocumento } from "../../services/EpasService";

/** 26 de octubre de 2026, 15:40, en hora LOCAL (sin `Z`): la prueba no mide la zona horaria. */
const A_LAS_1540 = "2026-10-26T15:40:00";

const firma = (parcial: Partial<FirmaDocumento> = {}): FirmaDocumento => ({
  rol: "decisor",
  nombre: "Ana Pérez",
  at: A_LAS_1540,
  ...parcial,
});

describe("SelloFirma — un documento con firmas (D-15)", () => {
  it("pinta «Firmado» como badge-success badge-sm SÓLIDO y debajo la línea del firmante", () => {
    const { container } = render(<SelloFirma firmas={[firma()]} />);

    const sello = screen.getByText("Firmado");
    expect(sello.tagName).toBe("SPAN");
    expect(sello.className).toContain("badge");
    expect(sello.className).toContain("badge-success");
    expect(sello.className).toContain("badge-sm");

    const linea = screen.getByText("Decisor: Ana Pérez · 26 oct 2026, 15:40");
    expect(linea.className).toContain("text-xs");
    expect(linea.className).toContain("text-base-content/70");

    // El contenedor es la columna de §8.1.
    const columna = container.firstElementChild as HTMLElement;
    expect(columna.className).toContain("flex");
    expect(columna.className).toContain("flex-col");
    expect(columna.className).toContain("gap-1");
  });

  it("🔴 el icono del sello es decorativo: lleva aria-hidden y el lector anuncia solo «Firmado» (A10)", () => {
    render(<SelloFirma firmas={[firma()]} />);

    const sello = screen.getByText("Firmado");
    const icono = sello.querySelector('[aria-hidden="true"]');
    expect(icono).not.toBeNull();
    expect(icono?.querySelector("svg")).not.toBeNull();
    expect(sello.textContent?.trim()).toBe("Firmado");
  });

  it("las tres firmas del acta salen en TRES líneas y en el orden en que se aplicaron", () => {
    render(
      <SelloFirma
        firmas={[
          firma({ rol: "decisor", nombre: "Ana Pérez", at: "2026-10-26T09:00:00" }),
          firma({ rol: "secretario", nombre: "Luis Mora", at: "2026-10-26T10:15:00" }),
          firma({ rol: "director", nombre: "Rosa Vega", at: "2026-10-26T11:30:00" }),
        ]}
      />,
    );

    const lineas = screen.getAllByText(/ · 26 oct 2026, /);
    expect(lineas.map((l) => l.textContent)).toEqual([
      "Decisor: Ana Pérez · 26 oct 2026, 09:00",
      "Secretario: Luis Mora · 26 oct 2026, 10:15",
      "Director: Rosa Vega · 26 oct 2026, 11:30",
    ]);
  });

  it("🔴 el rótulo es «Firmado» a secas, siempre: nunca «1 de 3» (la UI no sabe cuántas casillas hay)", () => {
    const { container } = render(
      <SelloFirma firmas={[firma({ rol: "decisor" })]} />,
    );

    expect(screen.getAllByText("Firmado")).toHaveLength(1);
    expect(container.textContent).not.toMatch(/\d+\s+de\s+\d+/);
  });

  it("una firma sin nombre registrado lo dice en vez de dejar un hueco", () => {
    render(<SelloFirma firmas={[firma({ rol: "secretario", nombre: null })]} />);

    expect(
      screen.getByText(
        "Secretario: firmante sin nombre registrado · 26 oct 2026, 15:40",
      ),
    ).toBeInTheDocument();
  });

  it("con firmas, `firmaRequerida` no cambia nada: no se pinta el chip «Sin firma»", () => {
    render(<SelloFirma firmas={[firma()]} firmaRequerida />);

    expect(screen.getByText("Firmado")).toBeInTheDocument();
    expect(screen.queryByText("Sin firma")).toBeNull();
  });

  it("el rótulo del rol cubre los cuatro roles del contrato, también el de revisor", () => {
    render(
      <SelloFirma
        firmas={[firma({ rol: "revisor", nombre: "Iván Ríos", at: "2026-10-26T08:00:00" })]}
      />,
    );

    expect(
      screen.getByText("Revisor: Iván Ríos · 26 oct 2026, 08:00"),
    ).toBeInTheDocument();
  });
});

describe("SelloFirma — un documento sin firmas (D-26)", () => {
  it("si REQUERÍA firma y no la tiene: chip «Sin firma» badge-outline badge-sm, sin sello ni líneas", () => {
    render(<SelloFirma firmas={[]} firmaRequerida />);

    const chip = screen.getByText("Sin firma");
    expect(chip.className).toContain("badge");
    expect(chip.className).toContain("badge-outline");
    expect(chip.className).toContain("badge-sm");
    expect(chip.className).not.toContain("badge-success");
    expect(screen.queryByText("Firmado")).toBeNull();
  });

  it("`firmaRequerida` sin `firmas` (campo ausente) también es «Sin firma»", () => {
    render(<SelloFirma firmaRequerida />);

    expect(screen.getByText("Sin firma")).toBeInTheDocument();
  });

  it("🔴 sin `firmaRequerida` —firmador apagado, anterior a encenderlo o documento subido— no pinta NADA", () => {
    const vacio = render(<SelloFirma firmas={[]} />);
    expect(vacio.container).toBeEmptyDOMElement();
    vacio.unmount();

    const ausente = render(<SelloFirma />);
    expect(ausente.container).toBeEmptyDOMElement();
    ausente.unmount();

    const falso = render(<SelloFirma firmas={[]} firmaRequerida={false} />);
    expect(falso.container).toBeEmptyDOMElement();
  });
});

describe("SelloFirma — la aserción negativa del contraste (UI-SPEC § Color)", () => {
  it("🔴 ninguna rama pinta la variante suave `badge-soft` (~1,8:1, un sello que no se lee)", () => {
    const firmado = render(<SelloFirma firmas={[firma()]} />);
    expect(firmado.container.innerHTML).not.toContain("badge-soft");
    firmado.unmount();

    const sinFirma = render(<SelloFirma firmas={[]} firmaRequerida />);
    expect(sinFirma.container.innerHTML).not.toContain("badge-soft");
  });
});
