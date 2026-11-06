/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: Las DOS obligaciones vivas en la fila de la bandeja (Fase 03.18, Plan 08)
 * Archivo: ObligacionesVivas.test.tsx
 * Responsabilidad: Afirmar que la fila enseña LAS DOS obligaciones —la pecuniaria y el correctivo—
 *   y que no deduce ninguna de las dos.
 *
 *   🔴 LO QUE ESTAS PRUEBAS DEFIENDEN. El archivo del expediente exige que las DOS obligaciones
 *   estén cumplidas. Una bandeja que sólo enseñe la pecuniaria hace creer que falta la mitad del
 *   trabajo cuando falta la otra mitad, y el expediente se archiva con el correctivo vivo. Por eso
 *   el caso de «las dos a la vez» no es un caso más: es el criterio 6 de la fase.
 *
 *   Y hay una segunda clase de caso: el que lee el FUENTE del componente para afirmar que una
 *   aritmética prohibida NO EXISTE. Una ausencia no se puede afirmar mirando sólo el render.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: el chip del término suspendido por la
 *   impugnación, que no se confunde con el vencido)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq: la multa se lee «Multa: USD 1.200,00»,
 *   ya no con «$»)
 */
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ObligacionesVivas from "./ObligacionesVivas";
import type {
  ObligacionHacerEnBandeja,
  TerminoAlegacion,
} from "../../interfaces/IObligacionHacer";
// 🔴 EL FUENTE DEL COMPONENTE, COMO TEXTO. Con el `?raw` de Vite y no con `node:fs`, por lo mismo
// que en `TerminoAlegacionPlazo.test.tsx`: `tsconfig.app.json` fija `"types": ["vite/client"]`.
import fuenteObligaciones from "./ObligacionesVivas.tsx?raw";

/** Un término base: el traslado corrido y el plazo corriendo. Cada caso cambia SÓLO lo que describe. */
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

/** El bloque del correctivo tal y como lo derivó el servidor para una FILA de bandeja. */
const CORRECTIVO: ObligacionHacerEnBandeja = {
  tiene: true,
  cumplida: false,
  cumplidaAt: null,
  multasCompulsorias: 0,
  tieneInforme: false,
  sustitutoriaOrdenada: false,
  terminoAlegacion: TERMINO,
};

const conCorrectivo = (
  parche: Partial<ObligacionHacerEnBandeja>,
): ObligacionHacerEnBandeja => ({ ...CORRECTIVO, ...parche });

describe("ObligacionesVivas", () => {
  it("con multa y SIN correctivo enseña sólo la etiqueta pecuniaria", () => {
    render(<ObligacionesVivas multaImpuesta={1200} />);

    expect(screen.getByText(/Multa:/i)).toBeInTheDocument();
    // Formato ecuatoriano con el prefijo USD, el mismo que el PDF; nunca el «$» de antes.
    expect(screen.getByText("Multa: USD 1.200,00")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    // Ni una palabra del correctivo: el expediente no lo lleva.
    expect(screen.queryByText(/correctivo/i)).not.toBeInTheDocument();
  });

  it("con correctivo y SIN multa enseña sólo la etiqueta del correctivo", () => {
    render(<ObligacionesVivas obligacionHacer={CORRECTIVO} />);

    expect(screen.getByText(/Correctivo pendiente/i)).toBeInTheDocument();
    // La resolución de origen no impuso multa —o no consta—: no se pinta «USD 0,00».
    expect(screen.queryByText(/Multa:/i)).not.toBeInTheDocument();
  });

  it("🔴 CRITERIO 6 — con las DOS obligaciones vivas enseña las DOS, distinguibles de un vistazo", () => {
    render(
      <ObligacionesVivas multaImpuesta={1200} obligacionHacer={CORRECTIVO} />,
    );

    const pecuniaria = screen.getByText(/Multa:/i);
    const correctivo = screen.getByText(/Correctivo pendiente/i);

    expect(pecuniaria).toBeInTheDocument();
    expect(correctivo).toBeInTheDocument();
    // Distinguibles: no es la misma etiqueta repetida, y no comparten tono.
    expect(pecuniaria).not.toBe(correctivo);
    expect(pecuniaria.className).not.toEqual(correctivo.className);
  });

  it("con el correctivo YA CUMPLIDO lo dice y cambia de tono", () => {
    render(<ObligacionesVivas obligacionHacer={CORRECTIVO} />);
    const tonoPendiente = screen.getByText(/Correctivo pendiente/i).className;
    cleanup();

    render(
      <ObligacionesVivas
        obligacionHacer={conCorrectivo({
          cumplida: true,
          cumplidaAt: "2026-09-12T10:00:00.000Z",
        })}
      />,
    );

    const cumplido = screen.getByText(/Correctivo cumplido/i);
    expect(cumplido).toBeInTheDocument();
    expect(screen.queryByText(/Correctivo pendiente/i)).not.toBeInTheDocument();
    // El tono cambia: cumplido y pendiente no se pueden confundir de un vistazo.
    expect(cumplido.className).not.toEqual(tonoPendiente);
  });

  it("ya no pinta ningún distintivo del sello de clausura (quick 261014-jcy)", () => {
    render(<ObligacionesVivas obligacionHacer={CORRECTIVO} />);

    // El correctivo se sigue viendo; la solicitud de retiro del sello ya no existe en la fila.
    expect(screen.getByText(/Correctivo pendiente/i)).toBeInTheDocument();
    expect(screen.queryByText(/sello/i)).toBeNull();
  });

  it("con el TÉRMINO VENCIDO lo señala, y lo hace SIN calcular fechas", () => {
    render(
      <ObligacionesVivas
        obligacionHacer={conCorrectivo({
          terminoAlegacion: {
            ...TERMINO,
            estado: "VENCIDO",
            vencido: true,
            diasHabilesRestantes: null,
            habilitaMultaCompulsoria: true,
          },
        })}
      />,
    );

    expect(screen.getByText(/término de alegación vencido/i)).toBeInTheDocument();

    // 🔴 LA AUSENCIA QUE IMPORTA. Los días del término son HÁBILES y se cuentan contra el calendario
    // de feriados del SERVIDOR: cualquier aritmética de fechas aquí daría un número distinto del que
    // el expediente sostiene. Y el ordinal de la multa sale de CONTAR la serie, que la fila no trae.
    expect(fuenteObligaciones).not.toMatch(/new Date\(/);
    expect(fuenteObligaciones).not.toMatch(/\.getTime\(/);
    expect(fuenteObligaciones).not.toMatch(/Date\.now\(/);
    // Y no lee el estado del EPAS: esta rama NO es una máquina de estados.
    expect(fuenteObligaciones).not.toMatch(/eejeStatus/);
  });

  it("quick 261028-mtg: con el término SUSPENDIDO pinta el chip de suspendido y NO el de vencido", () => {
    render(
      <ObligacionesVivas
        obligacionHacer={conCorrectivo({
          terminoAlegacion: {
            ...TERMINO,
            estado: "SUSPENDIDO",
            venceAt: null,
            vencido: false,
            diasHabilesRestantes: 4,
            suspendidoDesde: "2026-10-16T15:00:00.000Z",
            diasHabilesSuspendidos: 0,
          },
        })}
      />,
    );

    expect(
      screen.getByText("Término de alegación suspendido"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/término de alegación vencido/i)).toBeNull();
  });

  it("con el término EN CURSO no pinta ningún chip del término", () => {
    render(<ObligacionesVivas obligacionHacer={conCorrectivo({})} />);
    expect(screen.queryByText(/término de alegación/i)).toBeNull();
  });

  it("SIN bloque de correctivo no renderiza nada del correctivo y no falla", () => {
    // (a) El bloque ausente: esta respuesta no lo trae.
    const { container, unmount } = render(<ObligacionesVivas />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    // (b) El bloque presente con `tiene: false`: se miró y el expediente NO lleva correctivo. Es un
    // hecho conocido, y tampoco se pinta nada de la rama.
    render(
      <ObligacionesVivas
        multaImpuesta={800}
        obligacionHacer={conCorrectivo({ tiene: false })}
      />,
    );
    expect(screen.getByText(/Multa:/i)).toBeInTheDocument();
    expect(screen.queryByText(/correctivo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/término de alegación/i)).not.toBeInTheDocument();
  });
});
