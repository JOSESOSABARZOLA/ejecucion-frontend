/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: La regla D-15 de las formas de notificación, espejada en el cliente (quick 261026-ft2)
 * Archivo: formasNotificacion.util.test.ts
 * Responsabilidad: Fijar con aserciones EJECUTABLES que el cliente dice y decide lo mismo que
 *   `guardarFormas` del backend: correo ⇒ al menos una dirección vigente; casillero y dirección
 *   valen recortados y, en blanco, caen al valor guardado; ninguna forma marcada es válido (D-12).
 *   Las tres frases se escriben aquí A MANO, carácter a carácter: si alguien cambia la fuente sin
 *   cambiar el servidor, esta prueba lo dice.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 */
import { describe, expect, it } from "vitest";
import {
  MOTIVO_CASILLERO_SIN_NUMERO,
  MOTIVO_CORREO_SIN_VIGENTE,
  MOTIVO_FISICO_SIN_DIRECCION,
  motivosFormasIncompletas,
  primerMotivoFormas,
  type EntradaFormas,
  type LeidoFormas,
} from "./formasNotificacion.util";

const FRASE_CORREO =
  "Para notificar por correo hace falta al menos una dirección VIGENTE: agréguela antes de aceptar ese canal.";
const FRASE_CASILLERO =
  "Para notificar por casillero judicial hace falta su número: indíquelo antes de aceptar ese canal.";
const FRASE_FISICO =
  "Para aceptar la notificación en el domicilio hace falta la dirección del administrado.";

const NINGUNA: EntradaFormas = {
  aceptaCorreo: false,
  aceptaCasillero: false,
  aceptaFisico: false,
};

const VACIO: LeidoFormas = { correos: [] };

const correo = (vigente: boolean, corrId = 1) => ({
  corrId,
  email: `persona${corrId}@example.com`,
  procedencia: "core",
  vigente,
});

describe("las frases son las del servidor, palabra por palabra", () => {
  it("correo, casillero y físico", () => {
    expect(MOTIVO_CORREO_SIN_VIGENTE).toBe(FRASE_CORREO);
    expect(MOTIVO_CASILLERO_SIN_NUMERO).toBe(FRASE_CASILLERO);
    expect(MOTIVO_FISICO_SIN_DIRECCION).toBe(FRASE_FISICO);
  });
});

describe("motivosFormasIncompletas — espejo de D-15", () => {
  it("ninguna forma marcada es válido aunque no haya ningún dato (D-12)", () => {
    const motivos = motivosFormasIncompletas(NINGUNA, VACIO);
    expect(motivos).toEqual({});
    expect(primerMotivoFormas(motivos)).toBeUndefined();
  });

  describe("correo", () => {
    it("con la lista vacía ⇒ motivo", () => {
      expect(
        motivosFormasIncompletas({ ...NINGUNA, aceptaCorreo: true }, VACIO),
      ).toEqual({ correo: FRASE_CORREO });
    });

    it("solo con direcciones no vigentes ⇒ motivo", () => {
      expect(
        motivosFormasIncompletas(
          { ...NINGUNA, aceptaCorreo: true },
          { correos: [correo(false, 1), correo(false, 2)] },
        ),
      ).toEqual({ correo: FRASE_CORREO });
    });

    it("con al menos una vigente ⇒ sin motivo", () => {
      expect(
        motivosFormasIncompletas(
          { ...NINGUNA, aceptaCorreo: true },
          { correos: [correo(false, 1), correo(true, 2)] },
        ),
      ).toEqual({});
    });
  });

  describe("casillero", () => {
    const marcado: EntradaFormas = { ...NINGUNA, aceptaCasillero: true };

    it("tecleado con espacios alrededor ⇒ vale recortado, sin motivo", () => {
      expect(
        motivosFormasIncompletas({ ...marcado, casillero: "  1042  " }, VACIO),
      ).toEqual({});
    });

    it("tecleado en blanco y guardado vacío ⇒ motivo", () => {
      expect(
        motivosFormasIncompletas(
          { ...marcado, casillero: "   " },
          { correos: [], casillero: "" },
        ),
      ).toEqual({ casillero: FRASE_CASILLERO });
    });

    it("tecleado en blanco y sin guardado ⇒ motivo", () => {
      expect(
        motivosFormasIncompletas({ ...marcado, casillero: "   " }, VACIO),
      ).toEqual({ casillero: FRASE_CASILLERO });
    });

    it("tecleado vacío o ausente y guardado «1042» ⇒ cae al guardado, sin motivo", () => {
      const leido: LeidoFormas = { correos: [], casillero: "1042" };
      expect(motivosFormasIncompletas({ ...marcado, casillero: "" }, leido)).toEqual(
        {},
      );
      expect(motivosFormasIncompletas(marcado, leido)).toEqual({});
    });
  });

  describe("físico", () => {
    const marcado: EntradaFormas = { ...NINGUNA, aceptaFisico: true };

    it("tecleada con espacios alrededor ⇒ vale recortada, sin motivo", () => {
      expect(
        motivosFormasIncompletas(
          { ...marcado, direccion: "  Av. Amazonas N24-03  " },
          VACIO,
        ),
      ).toEqual({});
    });

    it("tecleada en blanco y guardada vacía ⇒ motivo", () => {
      expect(
        motivosFormasIncompletas(
          { ...marcado, direccion: "   " },
          { correos: [], direccion: "" },
        ),
      ).toEqual({ fisico: FRASE_FISICO });
    });

    it("sin tecleo y sin guardada (G-05: la dirección NULL llega ausente) ⇒ motivo", () => {
      expect(motivosFormasIncompletas(marcado, VACIO)).toEqual({
        fisico: FRASE_FISICO,
      });
    });

    it("tecleada vacía y guardada ⇒ cae a la guardada, sin motivo", () => {
      expect(
        motivosFormasIncompletas(
          { ...marcado, direccion: "" },
          { correos: [], direccion: "Av. Amazonas N24-03" },
        ),
      ).toEqual({});
    });
  });

  it("un canal NO marcado nunca da motivo aunque le falte el dato", () => {
    expect(
      motivosFormasIncompletas(
        { ...NINGUNA, casillero: "", direccion: "" },
        { correos: [correo(false)] },
      ),
    ).toEqual({});
  });

  it("con varios motivos, el primero sigue el orden del servidor: correo, casillero, físico", () => {
    const todos = motivosFormasIncompletas(
      { aceptaCorreo: true, aceptaCasillero: true, aceptaFisico: true },
      VACIO,
    );
    expect(todos).toEqual({
      correo: FRASE_CORREO,
      casillero: FRASE_CASILLERO,
      fisico: FRASE_FISICO,
    });
    expect(primerMotivoFormas(todos)).toBe(FRASE_CORREO);

    const sinCorreo = motivosFormasIncompletas(
      { aceptaCorreo: false, aceptaCasillero: true, aceptaFisico: true },
      VACIO,
    );
    expect(primerMotivoFormas(sinCorreo)).toBe(FRASE_CASILLERO);

    const soloFisico = motivosFormasIncompletas(
      { aceptaCorreo: false, aceptaCasillero: false, aceptaFisico: true },
      VACIO,
    );
    expect(primerMotivoFormas(soloFisico)).toBe(FRASE_FISICO);
  });
});
