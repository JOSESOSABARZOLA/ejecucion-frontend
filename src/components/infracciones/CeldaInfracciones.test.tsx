/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend)
 * Feature: La infracción manda — la celda «Infracciones» de las bandejas (Fase 03.23, Plan 17, D-16)
 * Archivo: CeldaInfracciones.test.tsx
 * Responsabilidad: Afirmar que la celda TRADUCE el bloque `infracciones` que manda el servidor
 *   —códigos, estado de CORE, conflicto y descuadre— y que no decide nada por su cuenta.
 *
 *   🔴 EL CASO QUE MÁS CARO SALE. El backend devuelve `descuadre: true` para un EPAS SIN
 *   infracciones (una multa sin filas que la sumen no cuadra). Si la celda leyera `descuadre` antes
 *   que `codigos.length`, el decisor vería «Descuadre» en un expediente que no tiene nada que
 *   cuadrar, y buscaría un error de importes que no existe. Hay una prueba con ese nombre.
 *
 *   Y una segunda clase de caso: la que lee el FUENTE para afirmar que la celda no parte códigos
 *   (no deduce materias): una ausencia no se puede afirmar mirando solo el render.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-16
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: el resumen lleva ids de Sorteo y
 *   `sinMateria`)
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CeldaInfracciones from "./CeldaInfracciones";
import type { ResumenInfracciones } from "../../services/InfraccionesService";
// El fuente como texto, con el `?raw` de Vite (como `ObligacionesVivas.test.tsx`).
import fuenteCelda from "./CeldaInfracciones.tsx?raw";

/** Un resumen base: un código, leído de CORE, sin avisos. Cada caso cambia SOLO lo que describe. */
const resumen = (
  overrides: Partial<ResumenInfracciones> = {},
): ResumenInfracciones => ({
  codigos: ["LIC-LU-001"],
  materiaIds: [26],
  submateriaIds: [54],
  sinMateria: false,
  estadoCore: "LEIDO",
  conflicto: false,
  descuadre: false,
  ...overrides,
});

describe("CeldaInfracciones — los códigos", () => {
  it("con un código pinta el código, sin «+N»", () => {
    render(<CeldaInfracciones resumen={resumen()} />);

    expect(screen.getByText("LIC-LU-001")).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("con tres pinta el PRIMERO y «+2», y el `title` lista TODOS", () => {
    const { container } = render(
      <CeldaInfracciones
        resumen={resumen({
          codigos: ["LIC-LU-001", "AMB-RS-004", "LIC-ED-010"],
        })}
      />,
    );

    expect(screen.getByText("LIC-LU-001")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    // Los otros dos no se pintan a la vista…
    expect(screen.queryByText("AMB-RS-004")).not.toBeInTheDocument();
    // …pero están en el `title` del contenedor, enteros y en el orden del servidor.
    const conTitulo = container.querySelector("[title]") as HTMLElement;
    expect(conTitulo).not.toBeNull();
    expect(conTitulo.title).toContain("LIC-LU-001, AMB-RS-004, LIC-ED-010");
  });

  it("el lector de pantalla oye la lista completa, no un «+2» suelto", () => {
    const { container } = render(
      <CeldaInfracciones
        resumen={resumen({
          codigos: ["LIC-LU-001", "AMB-RS-004", "LIC-ED-010"],
        })}
      />,
    );

    const oculto = container.querySelector(".sr-only") as HTMLElement;
    expect(oculto).not.toBeNull();
    expect(oculto.textContent).toContain("AMB-RS-004");
    expect(oculto.textContent).toContain("LIC-ED-010");
  });
});

describe("CeldaInfracciones — sin infracciones", () => {
  it("sin bloque dice «Sin infracciones»", () => {
    render(<CeldaInfracciones resumen={undefined} />);

    expect(screen.getByText("Sin infracciones")).toBeInTheDocument();
  });

  it("🔴 con `codigos: []` y `descuadre: true` dice «Sin infracciones» y NUNCA «Descuadre»", () => {
    render(
      <CeldaInfracciones
        resumen={resumen({
          codigos: [],
          materiaIds: [],
          submateriaIds: [],
          sinMateria: false,
          descuadre: true,
        })}
      />,
    );

    expect(screen.getByText("Sin infracciones")).toBeInTheDocument();
    expect(screen.queryByText("Descuadre")).not.toBeInTheDocument();
  });

  it("sin códigos y con CORE PENDIENTE dice «Pendiente de lectura» en lugar de «Sin infracciones»", () => {
    render(
      <CeldaInfracciones
        resumen={resumen({
          codigos: [],
          materiaIds: [],
          submateriaIds: [],
          sinMateria: false,
          estadoCore: "PENDIENTE",
          descuadre: true,
        })}
      />,
    );

    expect(screen.getByText("Pendiente de lectura")).toBeInTheDocument();
    expect(screen.queryByText("Sin infracciones")).not.toBeInTheDocument();
    expect(screen.queryByText("Descuadre")).not.toBeInTheDocument();
  });
});

describe("CeldaInfracciones — las señales del servidor", () => {
  it("`descuadre: true` con códigos pinta el badge «Descuadre»", () => {
    render(<CeldaInfracciones resumen={resumen({ descuadre: true })} />);

    expect(screen.getByText("LIC-LU-001")).toBeInTheDocument();
    expect(screen.getByText("Descuadre")).toBeInTheDocument();
  });

  it("`conflicto: true` pinta el badge «Conflicto de códigos»", () => {
    render(<CeldaInfracciones resumen={resumen({ conflicto: true })} />);

    expect(screen.getByText("Conflicto de códigos")).toBeInTheDocument();
  });

  it("estado PENDIENTE con códigos pinta el código y el badge «Pendiente de lectura»", () => {
    render(<CeldaInfracciones resumen={resumen({ estadoCore: "PENDIENTE" })} />);

    expect(screen.getByText("LIC-LU-001")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de lectura")).toBeInTheDocument();
  });

  it("estado DEMO pinta una marca discreta «demo», no un badge de alarma", () => {
    render(<CeldaInfracciones resumen={resumen({ estadoCore: "DEMO" })} />);

    const marca = screen.getByText("demo");
    expect(marca).toBeInTheDocument();
    expect(marca.className).not.toContain("badge");
    // La marca se explica con la redacción ÚNICA del estado (ETIQUETA_ESTADO_CORE).
    expect(marca.getAttribute("title")).toBe("Datos de demostración");
  });

  it("estado LEÍDO sin avisos no pinta ningún badge", () => {
    const { container } = render(<CeldaInfracciones resumen={resumen()} />);

    expect(container.querySelector(".badge")).toBeNull();
  });

  it("las tres señales a la vez se pintan las tres", () => {
    render(
      <CeldaInfracciones
        resumen={resumen({
          estadoCore: "PENDIENTE",
          conflicto: true,
          descuadre: true,
        })}
      />,
    );

    expect(screen.getByText("Pendiente de lectura")).toBeInTheDocument();
    expect(screen.getByText("Conflicto de códigos")).toBeInTheDocument();
    expect(screen.getByText("Descuadre")).toBeInTheDocument();
  });
});

describe("CeldaInfracciones — no decide nada (T-03.23-16)", () => {
  it("🔴 el fuente no parte códigos: la materia la deduce el servidor, no la celda", () => {
    // Como expresión regular y no como literal: así el grep de la prohibición del plan, que barre
    // también esta carpeta, no tropieza con la propia prueba que la defiende.
    expect(fuenteCelda).not.toMatch(/split\(\s*["'`]-["'`]\s*\)/);
    expect(fuenteCelda).not.toMatch(/materiasCod|submateriasCod|materiaIds|submateriaIds/);
  });
});
