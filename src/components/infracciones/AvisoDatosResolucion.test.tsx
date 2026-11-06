/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend)
 * Feature: El lote de Resolución, de verdad — el aviso de datos de Resolución incompletos
 *   (Fase 03.24, Plan 11, D-05)
 * Archivo: AvisoDatosResolucion.test.tsx
 * Responsabilidad: Afirmar que el aviso TRADUCE la lista `datosResolucionFaltantes` que calcula el
 *   servidor —sin aviso si no vino de Resolución o si no falta nada; con la lista legible en el
 *   `title` y para el lector de pantalla si falta algo— y que no decide nada por su cuenta.
 *
 *   Como en `CeldaInfracciones.test.tsx`, una prueba lee el FUENTE con `?raw` para afirmar una
 *   ausencia: el componente no mira multas, fechas ni el EPAS; solo la lista.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-20
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AvisoDatosResolucion from "./AvisoDatosResolucion";
import {
  ETIQUETA_FALTANTE_RESOLUCION,
  TEXTO_DATOS_RESOLUCION_INCOMPLETOS,
} from "./datosResolucion";
// El fuente como texto, con el `?raw` de Vite (como `CeldaInfracciones.test.tsx`).
import fuenteAviso from "./AvisoDatosResolucion.tsx?raw";

/** Los cinco códigos del backend (Plan 10), en el orden del fragmento SQL. */
const TODOS = [
  "MULTA",
  "RESOLUCION_NUMERO",
  "RESOLUCION_FECHA",
  "CORE_ID",
  "INFRACCIONES",
];

/** Factoría: pinta el aviso con la lista dada y la variante opcional. */
const pintar = (
  faltantes: string[] | null | undefined,
  variante?: "badge" | "alerta",
) =>
  render(<AvisoDatosResolucion faltantes={faltantes} variante={variante} />);

/** El elemento que lleva el `title` con la lista (el contenedor del badge). */
const conTitulo = (container: HTMLElement) =>
  container.querySelector("[title]") as HTMLElement | null;

describe("AvisoDatosResolucion — cuándo NO se pinta", () => {
  it("sin la propiedad (caso THIN) no pinta nada", () => {
    const { container } = pintar(undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it("con `null` (el EPAS no vino de Resolución) no pinta nada", () => {
    const { container } = pintar(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("con la lista vacía (vino de Resolución y no falta nada) no pinta nada", () => {
    const { container } = pintar([]);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AvisoDatosResolucion — el badge", () => {
  it("con MULTA y CORE_ID dice «Datos de Resolución incompletos» y los lista en el `title`", () => {
    const { container } = pintar(["MULTA", "CORE_ID"]);

    expect(
      screen.getByText(TEXTO_DATOS_RESOLUCION_INCOMPLETOS),
    ).toBeInTheDocument();
    expect(TEXTO_DATOS_RESOLUCION_INCOMPLETOS).toBe(
      "Datos de Resolución incompletos",
    );
    const titulo = conTitulo(container);
    expect(titulo).not.toBeNull();
    expect(titulo!.title).toContain("multa");
    expect(titulo!.title).toContain("caso enlazado");
  });

  it("el lector de pantalla oye los dos datos que faltan", () => {
    const { container } = pintar(["MULTA", "CORE_ID"]);

    const oculto = container.querySelector(".sr-only") as HTMLElement;
    expect(oculto).not.toBeNull();
    expect(oculto.textContent).toContain("multa");
    expect(oculto.textContent).toContain("caso enlazado");
  });

  it("con los cinco códigos el `title` nombra los cinco datos", () => {
    const { container } = pintar(TODOS);

    const titulo = conTitulo(container)!.title;
    expect(titulo).toContain("multa");
    expect(titulo).toContain("número de resolución");
    expect(titulo).toContain("fecha de resolución");
    expect(titulo).toContain("caso enlazado");
    expect(titulo).toContain("infracciones");
  });

  it("cada código del backend tiene su etiqueta", () => {
    for (const codigo of TODOS) {
      expect(ETIQUETA_FALTANTE_RESOLUCION[codigo]).toBeTruthy();
    }
  });

  it("un código desconocido se muestra tal cual (degradación honesta)", () => {
    const { container } = pintar(["OTRO"]);

    expect(conTitulo(container)!.title).toContain("OTRO");
  });

  it("un código con marcado se pinta como TEXTO, no como HTML", () => {
    const { container } = pintar(["<b>x</b>"]);

    expect(container.querySelector("b")).toBeNull();
    expect(conTitulo(container)!.title).toContain("<b>x</b>");
  });
});

describe("AvisoDatosResolucion — la alerta de la ficha", () => {
  it("usa `Alert` (role=alert) con el mismo texto y la lista VISIBLE", () => {
    pintar(["MULTA", "RESOLUCION_FECHA"], "alerta");

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent(TEXTO_DATOS_RESOLUCION_INCOMPLETOS);
    // La lista se ve, no solo está en el `title`.
    expect(screen.getByText(/multa/)).toBeVisible();
    expect(screen.getByText(/fecha de resolución/)).toBeVisible();
  });

  it("sin faltantes la alerta tampoco aparece", () => {
    const { container } = pintar([], "alerta");
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("AvisoDatosResolucion — no decide nada", () => {
  it("el fuente no mira la multa, la fecha ni el EPAS: solo traduce la lista", () => {
    expect(fuenteAviso).not.toContain("multaImpuesta");
    expect(fuenteAviso).not.toContain("resolucionFecha");
    expect(fuenteAviso).not.toMatch(/\beeje[A-Z_]/);
    expect(fuenteAviso).not.toContain("dangerouslySetInnerHTML");
  });
});
