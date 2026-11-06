/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend)
 * Feature: «Remitir al secretario» por caso en la fila del director (quick 261029-kl0)
 * Archivo: remisionCaso.test.ts
 * Responsabilidad: Fijar en una tabla cuándo la fila del director ofrece «Remitir al secretario» para
 *   UN caso (`puedeRemitirCasoSuelto`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-29
 */
import { describe, it, expect } from "vitest";
import {
  puedeRemitirCasoSuelto,
  type RemisionCasoContexto,
} from "./remisionCaso";

const base: RemisionCasoContexto = {
  rolName: "director",
  loteEnRevision: false,
  loteSinSortear: true,
  caso: {
    eejeId: 264,
    eejeStatus: "RECIBIDO",
    remitidoAlSecretario: false,
    porDevolver: false,
    reingreso: null,
  },
};

const con = (
  cambio: Partial<Omit<RemisionCasoContexto, "caso">>,
  caso: Partial<RemisionCasoContexto["caso"]> = {},
): RemisionCasoContexto => ({
  ...base,
  ...cambio,
  caso: { ...base.caso, ...caso },
});

describe("puedeRemitirCasoSuelto (quick 261029-kl0)", () => {
  it("director + lote remitido sin sortear + RECIBIDO sin remitir, sin marca ni nada por verificar → sí", () => {
    expect(puedeRemitirCasoSuelto(base)).toBe(true);
  });

  it.each<[string, RemisionCasoContexto]>([
    ["lote EN_REVISION (la remisión es del lote)", con({ loteEnRevision: true })],
    ["lote ya enviado a sorteo (envlAmasId puesto)", con({ loteSinSortear: false })],
    ["ya remitido al secretario", con({}, { remitidoAlSecretario: true })],
    ["el servidor no manda remitidoAlSecretario", con({}, { remitidoAlSecretario: undefined })],
    ["marcado «Por devolver»", con({}, { porDevolver: true })],
    [
      "observaciones de la devolución anterior por verificar",
      con(
        {},
        {
          reingreso: {
            reingresadoAt: "2026-10-29T10:00:00Z",
            total: 1,
            porVerificar: 1,
            cumplidas: 0,
            noCumplidas: 0,
          },
        },
      ),
    ],
    ["VERIFICADO", con({}, { eejeStatus: "VERIFICADO" })],
    ["caso THIN (sin eejeId)", con({}, { eejeId: undefined })],
    ["rol secretario", con({ rolName: "secretario abogado" })],
  ])("no: %s", (_motivo, ctx) => {
    expect(puedeRemitirCasoSuelto(ctx)).toBe(false);
  });
});
