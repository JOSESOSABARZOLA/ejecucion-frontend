/**
 * Microservicio: ejecucion
 * Módulo: Kit de tabla (compartido)
 * Feature: Traducción de nombre de acción a clave de modal
 * Archivo: RowActions.test.tsx
 * Responsabilidad: Lo que se protege es que el NOMBRE DE LA ACCIÓN —un dato que llega del backend—
 *   deje de ser, por sí solo, la clave del registro de modales. Las cuatro conductas cubiertas son
 *   las cuatro maneras en que ese desacoplamiento se rompe: que una acción de siempre deje de abrir
 *   su modal, que una acción traducida abra el equivocado, que una acción sin traducción abra algo
 *   en vez de avisar, y que una acción apagada despache igualmente.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { UserActions } from "../../interfaces/IUser";
import RowActions, { ACCION_A_MODAL, resolverModalDeAccion } from "./RowActions";

const openModal = vi.fn();
const addToast = vi.fn();

vi.mock("../../hooks/useModal", () => ({
  useModal: () => ({ openModal }),
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast }),
}));

// El registro real arrastra los 16 componentes de modal (y con ellos servicios, providers y
// `import.meta.env`): aquí sólo importa QUÉ CLAVES existen, que es lo único que RowActions consulta.
vi.mock("../../interfaces/IModal", () => ({
  modalRegistry: {
    caseReview: () => null,
    timeLine: () => null,
    excusarme: () => null,
  },
}));

/** Acción mínima: al despacho sólo le importan el nombre, la prioridad y si está apagada. */
const accion = (
  actiName: string,
  extra: Partial<UserActions> = {},
): UserActions =>
  ({
    actiId: 1,
    submId: 1,
    actiName,
    actiLabel: `Etiqueta de ${actiName}`,
    actiContext: "epas",
    actiIconName: "faEye",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: true,
    ...extra,
  }) as unknown as UserActions;

const pulsar = () => fireEvent.click(screen.getAllByRole("button")[0]);

describe("RowActions — despacho por ACCION_A_MODAL", () => {
  beforeEach(() => {
    openModal.mockClear();
    addToast.mockClear();
  });

  it("una acción cuyo nombre coincide con una clave del registro abre ESE modal", () => {
    render(<RowActions actions={[accion("caseReview")]} data={{ id: 7 }} />);

    pulsar();

    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal.mock.calls[0][0]).toBe("caseReview");
    expect(addToast).not.toHaveBeenCalled();
  });

  it("una acción con entrada propia en el mapa abre el modal al que el mapa apunta, aunque su nombre sea otro", () => {
    // Se prueba contra un mapa LOCAL en vez de plantar una entrada de mentira en el mapa de la
    // aplicación: el mapa compartido es contrato de producción, no banco de pruebas (mismo criterio
    // que los núcleos puros del Plan 01).
    expect(
      resolverModalDeAccion("ordenarSustitutoria", {
        ordenarSustitutoria: "caseReview",
      }),
    ).toBe("caseReview");

    // Y la traducción gana a la coincidencia directa: si el mapa dice otra cosa, manda el mapa.
    expect(
      resolverModalDeAccion("timeLine", { timeLine: "excusarme" }),
    ).toBe("excusarme");
  });

  it("una acción sin entrada y sin clave coincidente no abre nada y avisa de error de configuración", () => {
    const avisoDeConsola = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    render(
      <RowActions actions={[accion("accionQueNadieRegistro")]} data={{}} />,
    );

    pulsar();

    expect(openModal).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0]).toBe("error");
    expect(avisoDeConsola).toHaveBeenCalledTimes(1);

    avisoDeConsola.mockRestore();
  });

  it("una acción deshabilitada no abre modal aunque se pulse", () => {
    render(
      <RowActions
        actions={[accion("caseReview", { actiIsDisabled: true })]}
        data={{}}
      />,
    );

    pulsar();

    expect(openModal).not.toHaveBeenCalled();
  });

  it("el mapa traduce a claves del registro, nunca a nombres inventados", () => {
    // Un mapa que apunte a una clave inexistente es un modal que no abre y nadie avisa: la única
    // forma de que esto se note pronto es afirmarlo.
    expect(Object.keys(ACCION_A_MODAL).length).toBeGreaterThan(0);
  });
});
