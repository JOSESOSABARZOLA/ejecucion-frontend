/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend)
 * Feature: La infracción manda — la pestaña «Infracciones» de la ficha (Fase 03.23, Plan 13, D-16/D-08)
 * Archivo: InfraccionesSeccion.test.tsx
 * Responsabilidad: Afirmar que la pestaña PIDE la ficha una sola vez al montarse (ese pedido es el
 *   «uso» que refresca CORE, D-08), que pinta lo que manda el servidor —filas, alertas, estado de
 *   CORE con su fecha y el resumen del trabajo comunitario— sin decidir nada, y que un fallo de red
 *   se dice en una frase sin romper el resto de la ficha.
 *
 *   🔴 LA BANDERA `vivo`. Cerrar la ficha antes de que el servidor conteste no puede dejar un
 *   `setState` colgado sobre un componente desmontado: hay una prueba que resuelve la petición
 *   DESPUÉS de desmontar y comprueba que no pasa nada.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-16
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: la ficha con ids y nombres de Sorteo;
 *   una fila sin materia dice «Sin materia», la cabecera lo añade y la alerta SIN_MATERIA se pinta)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq: los importes se afirman con
 *   `formatearUsd`, «USD 920,00»)
 * Modificado por: Andrés Miño — 2026-11-06 (quick 261106-bo0: la columna «Base legal» con la
 *   referencia y la tipificación; «—» si no hay nada)
 * Modificado por: Andrés Miño — 2026-11-06 (los textos largos se recortan a tres líneas con «Ver más»)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import InfraccionesSeccion from "./InfraccionesSeccion";
import type { FichaInfracciones } from "../../services/InfraccionesService";
import { formatearUsd } from "../../utils/importe.util";

const mocks = vi.hoisted(() => ({ ficha: vi.fn() }));

// Parcial: se dobla SOLO el objeto del servicio; `ETIQUETA_ESTADO_CORE` se importa real, para que
// la prueba se apoye en la misma redacción que la bandeja.
vi.mock("../../services/InfraccionesService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../services/InfraccionesService")>();
  const doble = { ...real.InfraccionesService, ficha: mocks.ficha };
  return { ...real, InfraccionesService: doble, default: doble };
});

/**
 * Una ficha APTA de dos infracciones: una entra al TC y la otra queda fuera por ser el administrado
 * una sociedad. Cada caso cambia SOLO lo que describe.
 */
const crearFicha = (
  over: Partial<FichaInfracciones> = {},
): FichaInfracciones => ({
  eejeId: 77,
  estadoCore: "LEIDO",
  coreLeidoAt: "2026-10-15T15:30:00.000Z",
  coreDisponible: true,
  materia: "LICENCIAMIENTO",
  submaterias: ["LUAE"],
  infraccionesSinMateria: 0,
  tipoPersona: "NATURAL",
  avisoIdentificacion: null,
  multaTotal: 1380,
  sumaMultas: 1380,
  infracciones: [
    {
      codigo: "LIC-LU-X-124-1947A-02",
      materia: "LICENCIAMIENTO",
      submateria: "LUAE",
      materiaId: 26,
      submateriaId: 54,
      sinMateria: false,
      sancion: "Multa de 2 SBU",
      multa: 920,
      enResolucion: true,
      enCore: true,
      admiteTc: true,
      motivoNoAdmite: null,
      obligacionHacer: "Obtener la LUAE",
      articulo: "316",
      literal: null,
      subliteral: null,
      numeral: "1",
      tipificacion: "TIPIFICACIÓN DE EJEMPLO",
    },
    {
      codigo: "AMB-RU-X-200-3-01",
      materia: "AMBIENTE",
      submateria: "RUIDO",
      materiaId: 22,
      submateriaId: 59,
      sinMateria: false,
      sancion: null,
      multa: 460,
      enResolucion: true,
      enCore: true,
      admiteTc: false,
      motivoNoAdmite: "RUC de sociedad",
      obligacionHacer: null,
      articulo: null,
      literal: null,
      subliteral: null,
      numeral: null,
      tipificacion: null,
    },
  ],
  evaluacionTc: { estado: "APTA", motivos: [], multaConmutable: 920 },
  alertas: [],
  avisoCoreCambio: null,
  ...over,
});

describe("InfraccionesSeccion — la pestaña «Infracciones» de la ficha", () => {
  beforeEach(() => {
    mocks.ficha.mockReset().mockResolvedValue(crearFicha());
  });

  it("🔴 al montarse pide la ficha UNA vez con el eejeId, y mientras tanto dice que está cargando", async () => {
    render(<InfraccionesSeccion eejeId={77} />);

    expect(
      screen.getByText("Cargando las infracciones del expediente…"),
    ).toBeInTheDocument();
    await screen.findByText("LIC-LU-X-124-1947A-02");
    expect(mocks.ficha).toHaveBeenCalledTimes(1);
    expect(mocks.ficha).toHaveBeenCalledWith(77);
  });

  it("pinta una fila por infracción: código, materia · submateria, sanción, multa, TC con su motivo y obligación de hacer", async () => {
    render(<InfraccionesSeccion eejeId={77} />);

    const tabla = await screen.findByRole("table");
    const filas = within(tabla).getAllByRole("row");
    // Cabecera + dos infracciones.
    expect(filas).toHaveLength(3);

    const apta = filas[1];
    expect(within(apta).getByText("LIC-LU-X-124-1947A-02")).toBeInTheDocument();
    expect(within(apta).getByText("LICENCIAMIENTO · LUAE")).toBeInTheDocument();
    expect(within(apta).getByText("Multa de 2 SBU")).toBeInTheDocument();
    expect(within(apta).getByText(formatearUsd(920))).toBeInTheDocument();
    expect(within(apta).getByText("Sí")).toBeInTheDocument();
    expect(within(apta).getByText("Obtener la LUAE")).toBeInTheDocument();

    // La que queda fuera dice «No» y POR QUÉ, con las palabras del servidor; los huecos con «—».
    const fuera = filas[2];
    expect(within(fuera).getByText("No")).toBeInTheDocument();
    expect(within(fuera).getByText("RUC de sociedad")).toBeInTheDocument();
    // quick 261106-bo0: tres huecos —base legal, sanción y obligación de hacer—.
    expect(within(fuera).getAllByText("—")).toHaveLength(3);
  });

  describe("quick 261106-bo0: la columna «Base legal»", () => {
    it("va justo después de «Código»", async () => {
      render(<InfraccionesSeccion eejeId={77} />);

      const tabla = await screen.findByRole("table");
      const cabeceras = within(tabla)
        .getAllByRole("columnheader")
        .map((th) => th.textContent);
      expect(cabeceras.slice(0, 2)).toEqual(["Código", "Base legal"]);
    });

    it("enseña la referencia y, debajo, la tipificación", async () => {
      render(<InfraccionesSeccion eejeId={77} />);

      const tabla = await screen.findByRole("table");
      const apta = within(tabla).getAllByRole("row")[1];
      const celda = within(apta).getAllByRole("cell")[1];
      expect(within(celda).getByText("Art. 316, num. 1")).toBeInTheDocument();
      expect(
        within(celda).getByText("TIPIFICACIÓN DE EJEMPLO"),
      ).toBeInTheDocument();
    });

    it("sin ninguno de los cinco ⇒ «—» en esa celda", async () => {
      render(<InfraccionesSeccion eejeId={77} />);

      const tabla = await screen.findByRole("table");
      const fuera = within(tabla).getAllByRole("row")[2];
      expect(within(fuera).getAllByRole("cell")[1]).toHaveTextContent(/^—$/);
    });

    it("solo con tipificación ⇒ la tipificación y no «—»", async () => {
      const base = crearFicha();
      mocks.ficha.mockResolvedValue(
        crearFicha({
          infracciones: [
            base.infracciones[0],
            { ...base.infracciones[1], tipificacion: "SOLO TIPIFICACIÓN" },
          ],
        }),
      );
      render(<InfraccionesSeccion eejeId={77} />);

      const tabla = await screen.findByRole("table");
      const fila = within(tabla).getAllByRole("row")[2];
      const celda = within(fila).getAllByRole("cell")[1];
      expect(within(celda).getByText("SOLO TIPIFICACIÓN")).toBeInTheDocument();
      expect(within(celda).queryByText("—")).toBeNull();
    });
  });

  describe("textos largos de CORE (la sanción pasa de 1000 caracteres)", () => {
    const SANCION_LARGA = "1. Multa económica; 2. Decomiso. ".repeat(20);

    it("se recortan a tres líneas con «Ver más», y «Ver menos» los vuelve a recortar", async () => {
      const base = crearFicha();
      mocks.ficha.mockResolvedValue(
        crearFicha({
          infracciones: [
            { ...base.infracciones[0], sancion: SANCION_LARGA },
            base.infracciones[1],
          ],
        }),
      );
      render(<InfraccionesSeccion eejeId={77} />);

      const tabla = await screen.findByRole("table");
      const fila = within(tabla).getAllByRole("row")[1];
      const texto = within(fila).getByText(SANCION_LARGA.trim());
      expect(texto).toHaveClass("line-clamp-3");

      const boton = within(fila).getByRole("button", { name: "Ver más" });
      expect(boton).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(boton);
      expect(texto).not.toHaveClass("line-clamp-3");
      expect(boton).toHaveTextContent("Ver menos");
      expect(boton).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(boton);
      expect(texto).toHaveClass("line-clamp-3");
    });

    it("un texto corto va entero, sin botón", async () => {
      render(<InfraccionesSeccion eejeId={77} />);

      const tabla = await screen.findByRole("table");
      expect(within(tabla).queryByRole("button")).toBeNull();
    });
  });

  it("enseña el estado de CORE con la fecha de la última lectura", async () => {
    render(<InfraccionesSeccion eejeId={77} />);

    expect(await screen.findByText(/Infracciones leídas/)).toHaveTextContent(
      "Infracciones leídas · última lectura: 15/10/2026",
    );
  });

  it("con la evaluación APTA: multa total, suma por infracción y lo susceptible de compensación", async () => {
    render(<InfraccionesSeccion eejeId={77} />);

    await screen.findByRole("table");
    expect(screen.getByText("Multa total")).toBeInTheDocument();
    expect(screen.getByText("Suma por infracción")).toBeInTheDocument();
    expect(
      screen.getByText(`Susceptible de compensación: ${formatearUsd(920)}`),
    ).toBeInTheDocument();
  });

  it("con la evaluación BLOQUEADA no ofrece compensación y dice los motivos que no estén ya en los avisos", async () => {
    mocks.ficha.mockResolvedValue(
      crearFicha({
        evaluacionTc: {
          estado: "BLOQUEADA",
          motivos: [
            { codigo: "DESCUADRE", mensaje: "La multa no cuadra." },
            {
              codigo: "NINGUNA_APTA",
              mensaje: "Ninguna infracción admite trabajo comunitario.",
            },
          ],
          multaConmutable: null,
        },
        alertas: [{ codigo: "DESCUADRE", mensaje: "La multa no cuadra." }],
      }),
    );
    render(<InfraccionesSeccion eejeId={77} />);

    await screen.findByRole("table");
    expect(screen.queryByText(/Susceptible de compensación/)).toBeNull();
    expect(
      screen.getByText("Trabajo comunitario: no procede."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ninguna infracción admite trabajo comunitario."),
    ).toBeInTheDocument();
    // El descuadre se dice UNA vez, como aviso: repetirlo en el resumen sería ruido.
    expect(screen.getAllByText("La multa no cuadra.")).toHaveLength(1);
  });

  it("🔴 pinta TODAS las alertas del servidor con su mensaje (conflicto, cambio tras el sello, identificación)", async () => {
    mocks.ficha.mockResolvedValue(
      crearFicha({
        alertas: [
          {
            codigo: "CONFLICTO_CODIGOS",
            mensaje:
              "Los códigos de infracción de Resolución y los del caso no coinciden.",
          },
          {
            codigo: "CORE_CAMBIO_TRAS_SELLO",
            mensaje: "Las infracciones del caso cambiaron el 14/10/2026.",
          },
          {
            codigo: "IDENTIFICACION_NO_RECONOCIDA",
            mensaje: "La identificación no se reconoce.",
          },
        ],
      }),
    );
    render(<InfraccionesSeccion eejeId={77} />);

    expect(
      await screen.findByText(
        "Los códigos de infracción de Resolución y los del caso no coinciden.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Las infracciones del caso cambiaron el 14/10/2026."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("La identificación no se reconoce."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(3);
  });

  it("🔴 con CORE caído enseña el aviso del servidor y la última lectura, no un error", async () => {
    mocks.ficha.mockResolvedValue(
      crearFicha({
        coreDisponible: false,
        alertas: [
          {
            codigo: "CORE_NO_DISPONIBLE",
            mensaje:
              "No se pudieron consultar las infracciones ahora; se muestra la última lectura del 15/10/2026.",
          },
        ],
      }),
    );
    render(<InfraccionesSeccion eejeId={77} />);

    expect(
      await screen.findByText(
        "No se pudieron consultar las infracciones ahora; se muestra la última lectura del 15/10/2026.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "No se pudieron cargar las infracciones del expediente.",
      ),
    ).toBeNull();
  });

  it("un fallo de red se dice en una frase", async () => {
    mocks.ficha.mockRejectedValue(new Error("Network Error"));
    render(<InfraccionesSeccion eejeId={77} />);

    expect(
      await screen.findByText(
        "No se pudieron cargar las infracciones del expediente.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("sin infracciones: la alerta del servidor y NINGUNA tabla vacía muda", async () => {
    mocks.ficha.mockResolvedValue(
      crearFicha({
        estadoCore: "SIN_CASO",
        infracciones: [],
        multaTotal: 920,
        sumaMultas: null,
        evaluacionTc: {
          estado: "BLOQUEADA",
          motivos: [
            {
              codigo: "SIN_INFRACCIONES",
              mensaje:
                "Sin infracciones registradas: el expediente no tiene un caso enlazado.",
            },
          ],
          multaConmutable: null,
        },
        alertas: [
          {
            codigo: "SIN_INFRACCIONES",
            mensaje:
              "Sin infracciones registradas: el expediente no tiene un caso enlazado.",
          },
        ],
      }),
    );
    render(<InfraccionesSeccion eejeId={77} />);

    expect(
      await screen.findByText(
        "Sin infracciones registradas: el expediente no tiene un caso enlazado.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/Sin caso enlazado/)).toBeInTheDocument();
  });

  it("🔴 cerrar la ficha antes de que conteste no deja un setState colgado (bandera `vivo`)", async () => {
    let resolver: (f: FichaInfracciones) => void = () => {};
    mocks.ficha.mockReturnValue(
      new Promise<FichaInfracciones>((r) => {
        resolver = r;
      }),
    );
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(<InfraccionesSeccion eejeId={77} />);
    unmount();
    resolver(crearFicha());
    await waitFor(() => expect(mocks.ficha).toHaveBeenCalledTimes(1));
    await Promise.resolve();

    expect(errores).not.toHaveBeenCalled();
    errores.mockRestore();
  });

  it("quick 261104-jh1: una infracción «sin materia» lo dice en su fila, la cabecera lo añade y la alerta SIN_MATERIA se pinta", async () => {
    const base = crearFicha();
    mocks.ficha.mockResolvedValue(
      crearFicha({
        infraccionesSinMateria: 1,
        infracciones: [
          base.infracciones[0],
          {
            ...base.infracciones[1],
            codigo: "095-2025-001",
            materia: null,
            submateria: null,
            materiaId: null,
            submateriaId: null,
            sinMateria: true,
          },
        ],
        alertas: [
          {
            codigo: "SIN_MATERIA",
            mensaje: "1 infracción no tiene materia de Sorteo.",
          },
        ],
      }),
    );
    render(<InfraccionesSeccion eejeId={77} />);

    const tabla = await screen.findByRole("table");
    const filas = within(tabla).getAllByRole("row");
    expect(within(filas[2]).getByText("095-2025-001")).toBeInTheDocument();
    expect(within(filas[2]).getByText("Sin materia")).toBeInTheDocument();
    expect(
      screen.getByText(/Materia: LICENCIAMIENTO \/ Sin materia/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 infracción no tiene materia de Sorteo."),
    ).toBeInTheDocument();
  });
});
