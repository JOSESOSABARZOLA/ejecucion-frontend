/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: El término de alegación en pantalla (Fase 03.18, Plan 07)
 * Archivo: TerminoAlegacionPlazo.test.tsx
 * Responsabilidad: Afirmar que el término se PINTA y no se CALCULA.
 *
 *   🔴 LO QUE ESTAS PRUEBAS DEFIENDEN. Los días del término del art. 10 son HÁBILES y se cuentan
 *   contra el calendario de feriados del SERVIDOR. Un componente que restara dos cadenas ISO en el
 *   navegador daría un número distinto del que el expediente sostiene, y un término que miente en
 *   pantalla es peor que no tener término: el administrado pierde el derecho porque nadie miró el
 *   calendario, no porque no lo pidiera.
 *
 *   Por eso hay dos clases de caso aquí: los que comprueban lo que se VE, y uno que lee el FUENTE
 *   del componente para afirmar que una aritmética prohibida NO EXISTE — una ausencia no se puede
 *   afirmar mirando sólo el render.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: el término SUSPENDIDO por la
 *   impugnación, y el vencimiento corrido por una suspensión ya cerrada)
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TerminoAlegacionPlazo from "./TerminoAlegacionPlazo";
import type { TerminoAlegacion } from "../../interfaces/IObligacionHacer";
// 🔴 EL FUENTE DEL COMPONENTE, COMO TEXTO. Con el `?raw` de Vite y no con `node:fs`, por lo mismo
// que en `modalesEscalada.test.tsx`: `tsconfig.app.json` fija `"types": ["vite/client"]`.
import fuenteTermino from "./TerminoAlegacionPlazo.tsx?raw";

/** Un término base. Cada caso cambia SOLO lo que describe. */
const TERMINO: TerminoAlegacion = {
  estado: "EN_CURSO",
  motivo: null,
  trasladoDocId: 4120,
  trasladoEmitidoAt: "2026-09-01T14:00:00.000Z",
  arrancaAt: "2026-09-03T14:00:00.000Z",
  arrancoPorAgotamiento: false,
  plazoDias: 10,
  venceAt: "2026-09-17T23:59:59.000Z",
  vencido: false,
  diasHabilesRestantes: 4,
  calendarioCargadoHasta: 2026,
  habilitaMultaCompulsoria: false,
  alegacionDocId: null,
  alegacionIngresadaAt: null,
  terminoUsado: false,
  alegacionResueltaAt: null,
  alegacionPendiente: false,
};

const conTermino = (parche: Partial<TerminoAlegacion>): TerminoAlegacion => ({
  ...TERMINO,
  ...parche,
});

describe("TerminoAlegacionPlazo", () => {
  it("con el término EN CURSO pinta los días hábiles restantes TAL Y COMO LLEGAN y la fecha de vencimiento", () => {
    render(<TerminoAlegacionPlazo termino={conTermino({ diasHabilesRestantes: 4 })} />);

    // El número es el del servidor, y la unidad se dice en voz alta: hábiles NO es calendario.
    expect(screen.getByText(/faltan 4 días hábiles/i)).toBeInTheDocument();
    // La fecha de vencimiento, formateada (17/09/2026). Sale dos veces —la franja y la ficha— y las
    // dos son la MISMA fecha: se afirma que aparece, no cuántas veces se pinta.
    expect(screen.getAllByText(/17\/09\/2026/).length).toBeGreaterThan(0);
  });

  it("🔴 con el término VENCIDO lo dice y NO pinta un número negativo de días", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({
          estado: "VENCIDO",
          vencido: true,
          diasHabilesRestantes: null,
          habilitaMultaCompulsoria: true,
        })}
      />,
    );

    expect(screen.getByText(/el término venció/i)).toBeInTheDocument();
    // Ni un "-3" ni un "−3": si el servidor no manda restantes, no se inventa una resta.
    expect(document.body.textContent ?? "").not.toMatch(/-\s*\d+\s*d[ií]a/i);
  });

  it("SIN TRASLADO: explica el motivo por el que el término no ha arrancado", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({
          estado: "SIN_TRASLADO",
          motivo:
            "No consta providencia de traslado del informe sobre el expediente.",
          arrancaAt: null,
          plazoDias: null,
          venceAt: null,
          diasHabilesRestantes: null,
          trasladoDocId: null,
          trasladoEmitidoAt: null,
        })}
      />,
    );

    expect(
      screen.getByText(/No consta providencia de traslado/i),
    ).toBeInTheDocument();
  });

  it("SIN NOTIFICAR: explica el motivo, que es el caso que SÍ se puede corregir", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({
          estado: "SIN_NOTIFICAR",
          motivo:
            "El traslado se emitió pero ningún despacho consta notificado: el administrado no tiene formas de notificación declaradas.",
          arrancaAt: null,
          plazoDias: null,
          venceAt: null,
          diasHabilesRestantes: null,
        })}
      />,
    );

    expect(
      screen.getByText(/formas de notificación declaradas/i),
    ).toBeInTheDocument();
  });

  it("🔴 si el término arrancó por AGOTAMIENTO de intentos, lo DECLARA: no es lo mismo que una notificación recibida", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({ arrancoPorAgotamiento: true })}
      />,
    );

    expect(screen.getByText(/agotaron/i)).toBeInTheDocument();
  });

  it("🔴 si el calendario de feriados NO llega hasta el vencimiento, lo advierte", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({
          venceAt: "2027-01-12T23:59:59.000Z",
          calendarioCargadoHasta: 2026,
        })}
      />,
    );

    expect(
      screen.getByText(/calendario de feriados sólo está cargado hasta 2026/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/vence en 2027/i)).toBeInTheDocument();
  });

  it("con el calendario VACÍO también advierte: contar sin feriados no puede ser silencioso", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({ calendarioCargadoHasta: null })}
      />,
    );

    expect(
      screen.getByText(/calendario de feriados está VACÍO/i),
    ).toBeInTheDocument();
  });

  it("🔴 en el FUENTE del componente NO hay ninguna aritmética de fechas", () => {
    // Se miran las líneas de código, no los comentarios: la cabecera de este componente HABLA de
    // restar fechas para prohibirlo, y una prohibición escrita no puede hacer fallar la prueba.
    const codigo = fuenteTermino
      .split("\n")
      .filter(
        (linea) =>
          !linea.trimStart().startsWith("*") &&
          !linea.trimStart().startsWith("//") &&
          !linea.trimStart().startsWith("/*"),
      )
      .join("\n");

    expect(codigo).not.toMatch(/new Date\(/);
    expect(codigo).not.toMatch(/getTime\(/);
    expect(codigo).not.toMatch(/Date\.now\(/);
    expect(codigo).not.toMatch(/differenceIn/);
  });

  it("en modo COMPACTO sigue diciendo lo que queda, para la cabecera del expediente", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({ diasHabilesRestantes: 2 })}
        compacto
      />,
    );

    expect(screen.getByText(/faltan 2 días hábiles/i)).toBeInTheDocument();
  });

  it("una defensa SIN CONTESTAR se ve: es lo que avisa al imponer la multa compulsoria", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({
          alegacionDocId: 9001,
          alegacionIngresadaAt: "2026-09-10T10:00:00.000Z",
          terminoUsado: true,
          alegacionPendiente: true,
        })}
      />,
    );

    expect(screen.getByText(/sin resolver|pendiente/i)).toBeInTheDocument();
  });

  // ── quick 261028-mtg (2026-10-29): el término detenido por la impugnación ──
  it("SUSPENDIDO: etiqueta «Suspendido», sin fecha de vencimiento y con los días hábiles que le quedaban", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({
          estado: "SUSPENDIDO",
          venceAt: null,
          vencido: false,
          diasHabilesRestantes: 3,
          suspendidoDesde: "2026-10-16T15:00:00.000Z",
          diasHabilesSuspendidos: 0,
          motivo:
            "El término de alegación está suspendido por la impugnación desde el 2026-10-16: le quedaban 3 días hábiles, que vuelven a correr cuando la Procuraduría resuelva el recurso.",
        })}
      />,
    );

    expect(screen.getByText("Suspendido")).toBeInTheDocument();
    expect(
      screen.getByText(/suspendido desde el 16\/10\/2026; le quedaban 3 días hábiles/i),
    ).toBeInTheDocument();
    // Ni «en curso» ni «vencido», y ninguna fecha de vencimiento.
    expect(screen.queryByText("En curso")).toBeNull();
    expect(screen.queryByText("Vencido")).toBeNull();
    expect(screen.queryByText(/vence el \d/i)).toBeNull();
    expect(screen.getByText("sin vencimiento")).toBeInTheDocument();
    // El motivo redactado por el servidor, tal cual.
    expect(screen.getByText(/vuelven a correr cuando la Procuraduría/)).toBeInTheDocument();
  });

  it("SUSPENDIDO en modo COMPACTO también dice que está suspendido", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({
          estado: "SUSPENDIDO",
          venceAt: null,
          diasHabilesRestantes: 1,
          suspendidoDesde: "2026-10-16T15:00:00.000Z",
        })}
        compacto
      />,
    );
    expect(screen.getByText("Suspendido")).toBeInTheDocument();
    expect(screen.getByText(/le quedaban 1 día hábil$/i)).toBeInTheDocument();
  });

  it("una suspensión ya cerrada que corrió el vencimiento se dice", () => {
    render(
      <TerminoAlegacionPlazo
        termino={conTermino({ diasHabilesSuspendidos: 5 })}
      />,
    );
    expect(
      screen.getByText(/el vencimiento se corrió 5 días hábiles por la impugnación/i),
    ).toBeInTheDocument();
  });
});
