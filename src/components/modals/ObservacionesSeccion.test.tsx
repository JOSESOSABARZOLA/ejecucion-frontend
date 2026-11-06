/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/epas (frontend)
 * Archivo: ObservacionesSeccion.test.tsx
 * Responsabilidad: Fijar lo que el PANEL le deja hacer al usuario — que es donde viven las reglas
 *   que se pueden romper sin que nadie lo note:
 *
 *   · La caja dice sobre QUÉ se escribe. Un panel con el rótulo genérico «Observación» y una lista
 *     de trece campos detrás es un panel en el que se anota lo correcto sobre el campo equivocado.
 *   · Un campo ya observado NO admite una segunda. Es la misma regla que el índice único de la base;
 *     si la pantalla la perdiera, el usuario escribiría algo que el servidor va a machacar.
 *   · Borrar una fila quita ESA y no las demás; «Borrar observaciones» las quita todas.
 *
 *   El panel es presentacional a propósito, así que estas pruebas no tocan la red.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-18
 * Modificado por: Andrés Miño — 2026-10-19 (UAT 03.23-14: el panel pierde el botón de «añadir»)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-01)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import ObservacionesSeccion, {
  BADGE_VERIFICACION,
  PISTA_ANTERIORES_DIRECTOR,
  PISTA_ANTERIORES_SECRETARIO,
  PISTA_OBJETIVO_ANTERIOR,
  ROTULO_ANTERIORES,
  ROTULO_NUEVAS,
} from "./ObservacionesSeccion";
import {
  crearBorradorVacio,
  type IObservacion,
  type IObservacionBorrador,
} from "../../interfaces/ICaseObservations";

/**
 * Monta el panel con el estado que la ficha le daría, para poder pulsar de verdad en vez de
 * comprobar que se llamó a un callback. Lo que interesa es la CONSECUENCIA en pantalla.
 */
function montarPanel(iniciales: IObservacion[] = []) {
  const guardadas: IObservacion[][] = [];

  const Anfitrion = () => {
    const [observaciones, setObservaciones] =
      useState<IObservacion[]>(iniciales);
    const [borrador, setBorrador] = useState<IObservacionBorrador>(
      crearBorradorVacio(),
    );

    return (
      <div>
        <button
          type="button"
          onClick={() =>
            setBorrador({
              tipo: "CAMPO",
              clave: "admiLastname",
              etiqueta: "Apellido",
              texto: "",
            })
          }
        >
          pulsar etiqueta de Apellido
        </button>
        <ObservacionesSeccion
          borrador={borrador}
          observaciones={observaciones}
          onBorradorChange={setBorrador}
          onOcultar={vi.fn()}
          onBorrar={(tipo, clave) =>
            setObservaciones((previas) =>
              previas.filter((o) => !(o.tipo === tipo && o.clave === clave)),
            )
          }
          onGuardar={() => guardadas.push(observaciones)}
          onBorrarTodas={() => {
            guardadas.push([]);
            setObservaciones([]);
          }}
        />
      </div>
    );
  };

  render(<Anfitrion />);
  return { guardadas };
}

const observacionDeApellido: IObservacion = {
  obseId: 1,
  tipo: "CAMPO",
  clave: "admiLastname",
  etiqueta: "Apellido",
  texto: "No coincide con la cédula",
};

describe("ObservacionesSeccion — el panel de la ficha", () => {
  it("sin objetivo elegido no deja escribir, y lo dice en vez de quedarse mudo", () => {
    montarPanel();

    const caja = screen.getByLabelText("Texto de la observación");
    expect(caja).toBeDisabled();
    expect(caja).toHaveAttribute(
      "placeholder",
      "Seleccione un campo o documento…",
    );
  });

  it("pulsar la etiqueta de un campo apunta la caja a ESE campo, con su rótulo delante", () => {
    montarPanel();

    fireEvent.click(screen.getByText("pulsar etiqueta de Apellido"));

    // El rótulo es lo único que le dice al usuario sobre qué está escribiendo, y es exactamente lo
    // que saldrá impreso en el memorando.
    expect(screen.getByText("Apellido")).toBeInTheDocument();
    const caja = screen.getByLabelText("Texto de la observación");
    expect(caja).toBeEnabled();
    expect(caja).toHaveAttribute("placeholder", "Escriba la observación…");
  });

  it("no hay botón de «añadir a la lista» junto al rótulo: guarda «Guardar observaciones»", () => {
    // UAT 03.23-14: el botoncito no se veía y lo escrito se perdía. Lo que la caja lleva entra en la
    // lista desde la ficha (`conBorrador`), al guardar o al cambiar de objetivo.
    montarPanel();

    fireEvent.click(screen.getByText("pulsar etiqueta de Apellido"));

    expect(
      screen.queryByTitle("Añadir la observación a la lista"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Guardar observaciones")).toBeInTheDocument();
  });

  it("cada fila dice si es CAMPO o DOCUMENTO", () => {
    // Sin eso, «Acta de inspección» en medio de una lista de campos parecería un campo más.
    montarPanel([observacionDeApellido]);

    expect(screen.getByText("CAMPO")).toBeInTheDocument();
  });

  it("un campo que ya tiene observación no admite una segunda, y explica por qué", () => {
    montarPanel([observacionDeApellido]);

    fireEvent.click(screen.getByText("pulsar etiqueta de Apellido"));

    expect(screen.getByLabelText("Texto de la observación")).toBeDisabled();
    expect(
      screen.getByText(/ya tiene una observación registrada/i),
    ).toBeInTheDocument();
  });

  it("la ✕ de una fila quita ESA observación y deja las demás donde estaban", () => {
    montarPanel([
      observacionDeApellido,
      {
        obseId: 2,
        tipo: "DOCUMENTO",
        clave: "55",
        etiqueta: "Acta de inspección",
        texto: "Ilegible",
      },
    ]);

    fireEvent.click(
      screen
        .getByTitle("Borrar la observación de Apellido")
        .querySelector("button")!,
    );

    expect(
      screen.queryByText("No coincide con la cédula"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Ilegible")).toBeInTheDocument();
    expect(
      screen.getByText("Total de observaciones guardadas: 1"),
    ).toBeInTheDocument();
  });

  it("«Borrar observaciones» las quita todas y manda una lista vacía, que es un borrado legítimo", () => {
    const { guardadas } = montarPanel([observacionDeApellido]);

    fireEvent.click(screen.getByText("Borrar observaciones"));

    expect(guardadas).toEqual([[]]);
    expect(
      screen.getByText("No hay observaciones registradas"),
    ).toBeInTheDocument();
  });

  it("sin nada anotado, «Borrar observaciones» está apagado: no hay nada que borrar", () => {
    montarPanel();

    expect(
      screen.getByText("Borrar observaciones").closest("button"),
    ).toBeDisabled();
  });
});

// ── Fase 03.24, cierre de huecos G-01: el grupo «Observaciones de la devolución anterior» ───────

const anteriorPorVerificar: IObservacion = {
  obseId: 11,
  tipo: "CAMPO",
  clave: "admiAddress",
  etiqueta: "Dirección del administrado",
  texto: "Falta el número de casa",
  createdBy: 7,
  deDevolucionAnterior: true,
  verificacion: "POR_VERIFICAR",
};

const anteriorCumplida: IObservacion = {
  obseId: 12,
  tipo: "DOCUMENTO",
  clave: "55",
  etiqueta: "Acta de inspección",
  texto: "Ilegible en la pág. 2",
  createdBy: 7,
  deDevolucionAnterior: true,
  verificacion: "CUMPLIDA",
  verificadaAt: "2026-10-21T15:30:00.000Z",
  verificadaPorNombre: "Verónica Abad",
};

type PropsGrupo = Partial<Parameters<typeof ObservacionesSeccion>[0]>;

/** Monta el panel con props directas: aquí interesa qué se pinta y qué se avisa hacia arriba. */
function montarConAnteriores(props: PropsGrupo = {}) {
  const onVerificar = vi.fn();
  const utils = render(
    <ObservacionesSeccion
      borrador={crearBorradorVacio()}
      observaciones={[]}
      anteriores={[anteriorPorVerificar, anteriorCumplida]}
      onBorradorChange={vi.fn()}
      onOcultar={vi.fn()}
      onBorrar={vi.fn()}
      onGuardar={vi.fn()}
      onBorrarTodas={vi.fn()}
      puedeRevisar
      usuarioId={2}
      onVerificar={onVerificar}
      {...props}
    />,
  );
  const grupo = utils.container.querySelector(
    'section[aria-labelledby="obs-anteriores-titulo"]',
  ) as HTMLElement | null;
  return { onVerificar, grupo, ...utils };
}

describe("ObservacionesSeccion — observaciones de la devolución anterior (G-01, UI-SPEC §1.3)", () => {
  it("el grupo va en su sección con rótulo y el recuento de las que faltan por verificar", () => {
    const { grupo } = montarConAnteriores();

    expect(grupo).not.toBeNull();
    const rotulo = document.getElementById("obs-anteriores-titulo");
    expect(rotulo?.tagName).toBe("H5");
    expect(rotulo).toHaveTextContent(`${ROTULO_ANTERIORES} · 1 por verificar`);
  });

  it("sin nada por verificar, el rótulo va sin recuento", () => {
    montarConAnteriores({ anteriores: [anteriorCumplida] });

    expect(document.getElementById("obs-anteriores-titulo")?.textContent).toBe(
      ROTULO_ANTERIORES,
    );
  });

  it("va ENCIMA de la caja de escritura de las nuevas", () => {
    const { grupo } = montarConAnteriores();
    const caja = screen.getByLabelText("Texto de la observación");

    expect(
      grupo!.compareDocumentPosition(caja) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("cada fila lleva número, etiqueta, texto, tipo y badge, y la autoría si la hay", () => {
    const { grupo } = montarConAnteriores();
    const g = within(grupo!);

    expect(g.getByText("1.")).toBeInTheDocument();
    expect(g.getByText("2.")).toBeInTheDocument();
    expect(g.getByText("Dirección del administrado")).toBeInTheDocument();
    expect(g.getByText("Falta el número de casa")).toBeInTheDocument();
    expect(g.getByText("CAMPO")).toBeInTheDocument();
    expect(g.getByText("DOCUMENTO")).toBeInTheDocument();
    expect(g.getByText(BADGE_VERIFICACION.POR_VERIFICAR)).toHaveClass(
      "badge",
      "badge-sm",
      "badge-ghost",
    );
    expect(
      g.getByText(BADGE_VERIFICACION.CUMPLIDA, { selector: "span" }),
    ).toHaveClass("badge-success");
    expect(
      g.getByText("Verificada por Verónica Abad el 21/10/2026"),
    ).toBeInTheDocument();
    // Una sola línea de autoría: la de la por verificar no se pinta (nunca «undefined»).
    expect(g.getAllByText(/^Verificada por/)).toHaveLength(1);
    expect(grupo!.textContent).not.toMatch(/undefined/);
  });

  it("es de SOLO LECTURA: sin textarea, sin input y sin ✕", () => {
    const { grupo } = montarConAnteriores();

    expect(grupo!.querySelector("textarea")).toBeNull();
    expect(grupo!.querySelector("input")).toBeNull();
    expect(
      within(grupo!).queryByTitle(/Borrar la observación/),
    ).toBeNull();
    expect(grupo!.textContent).not.toContain("✕");
  });

  it("el director ve el par Cumplida / No cumplida con nombre, join y aria-pressed", () => {
    montarConAnteriores();

    const control = screen.getByRole("group", {
      name: "Verificación de la observación de Acta de inspección",
    });
    expect(control).toHaveClass("join");
    const cumplida = within(control).getByRole("button", {
      name: "Marcar como cumplida la observación de Acta de inspección",
    });
    const noCumplida = within(control).getByRole("button", {
      name: "Marcar como no cumplida la observación de Acta de inspección",
    });
    expect(cumplida).toHaveClass("btn", "btn-sm", "join-item", "btn-success");
    expect(cumplida).toHaveAttribute("aria-pressed", "true");
    expect(noCumplida).toHaveAttribute("aria-pressed", "false");
    expect(noCumplida).not.toHaveClass("btn-error");
    expect(noCumplida).not.toHaveClass("btn-xs");
  });

  it("pulsar «No cumplida» avisa hacia arriba sin abrir ninguna confirmación", () => {
    const { onVerificar } = montarConAnteriores();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Marcar como no cumplida la observación de Dirección del administrado",
      }),
    );

    expect(onVerificar).toHaveBeenCalledTimes(1);
    expect(onVerificar).toHaveBeenCalledWith(11, "NO_CUMPLIDA");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("pulsar el botón que ya está pulsado no hace nada", () => {
    const { onVerificar } = montarConAnteriores();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Marcar como cumplida la observación de Acta de inspección",
      }),
    );

    expect(onVerificar).not.toHaveBeenCalled();
  });

  it("mientras se verifica, todo el grupo está apagado y la lista lleva aria-busy", () => {
    const { grupo } = montarConAnteriores({ verificando: true });

    const botones = within(grupo!).getAllByRole("button");
    expect(botones).toHaveLength(4);
    botones.forEach((boton) => expect(boton).toBeDisabled());
    expect(grupo!.querySelector("ul")).toHaveAttribute("aria-busy", "true");
  });

  it("el control se ofrece también sobre lo que anotó el propio director, sin «Suya»", () => {
    const { grupo } = montarConAnteriores({ usuarioId: 7 });

    expect(
      screen.getByRole("group", {
        name: "Verificación de la observación de Dirección del administrado",
      }),
    ).toBeInTheDocument();
    expect(within(grupo!).queryByText("Suya")).toBeNull();
  });

  it("el secretario solo ve los badges y la pista de solo lectura, sin botones", () => {
    const { grupo } = montarConAnteriores({ puedeRevisar: false });

    expect(within(grupo!).queryAllByRole("button")).toHaveLength(0);
    expect(within(grupo!).queryByRole("group")).toBeNull();
    expect(within(grupo!).getByText(PISTA_ANTERIORES_SECRETARIO)).toHaveClass(
      "text-sm",
    );
    expect(within(grupo!).queryByText(PISTA_ANTERIORES_DIRECTOR)).toBeNull();
    expect(
      within(grupo!).getByText(BADGE_VERIFICACION.POR_VERIFICAR),
    ).toBeInTheDocument();
  });

  it("con grupo anterior, las nuevas llevan su rótulo y su total, y «Borrar» se apaga sin nuevas", () => {
    montarConAnteriores();

    expect(screen.getByText(PISTA_ANTERIORES_DIRECTOR)).toBeInTheDocument();
    expect(screen.getByText(ROTULO_NUEVAS)).toBeInTheDocument();
    expect(
      screen.getByText("Observaciones nuevas guardadas: 0"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Total de observaciones guardadas/),
    ).toBeNull();
    expect(
      screen.getByText("Borrar observaciones").closest("button"),
    ).toBeDisabled();
  });

  it("con grupo anterior y una nueva, el total cuenta solo las nuevas y «Borrar» se enciende", () => {
    montarConAnteriores({ observaciones: [observacionDeApellido] });

    expect(
      screen.getByText("Observaciones nuevas guardadas: 1"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Borrar observaciones").closest("button"),
    ).toBeEnabled();
  });

  it("sin grupo anterior, los textos son los de siempre y no hay rótulos nuevos", () => {
    montarConAnteriores({ anteriores: [], observaciones: [observacionDeApellido] });

    expect(
      screen.getByText("Total de observaciones guardadas: 1"),
    ).toBeInTheDocument();
    expect(screen.queryByText(ROTULO_NUEVAS)).toBeNull();
    expect(document.getElementById("obs-anteriores-titulo")).toBeNull();
  });

  it("si el objetivo elegido ya tiene una observación anterior, la caja se apaga con su pista", () => {
    montarConAnteriores({
      borrador: {
        tipo: "CAMPO",
        clave: "admiAddress",
        etiqueta: "Dirección del administrado",
        texto: "",
      },
    });

    expect(screen.getByLabelText("Texto de la observación")).toBeDisabled();
    expect(screen.getByText(PISTA_OBJETIVO_ANTERIOR)).toBeInTheDocument();
    expect(
      screen.queryByText(/ya tiene una observación registrada/i),
    ).toBeNull();
  });
});
