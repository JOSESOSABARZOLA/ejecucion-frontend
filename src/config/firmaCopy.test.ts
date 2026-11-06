/**
 * Microservicio: ejecucion
 * Módulo: Firma digital (frontend) — Fase 03.21
 * Feature: Contrato de copy de la firma digital real y helpers del error APP-FIRMA — pruebas
 * Archivo: firmaCopy.test.ts
 * Responsabilidad: Fijar que los textos de la fase son LITERALMENTE los de UI-SPEC 03.21 §10 (se
 *   escriben a mano aquí: importarlos del catálogo convertiría cada aserción en una tautología), que
 *   un fallo de firma se reconoce solo por su `code` `APP-FIRMA-*`, que la clave incorrecta es la
 *   única puerta del estado E, y que el mensaje compuesto nunca arrastra el detalle técnico del error.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 */

import { describe, expect, it } from "vitest";
import type { HttpClientError } from "../api/httpClient";
import {
  AVISO_SIN_FIRMADOR,
  AVISO_SIN_SESION_CENTRAL,
  CODIGO_CLAVE_INCORRECTA,
  CONSECUENCIA_FALLO_FIRMA,
  ERROR_CLAVE_INCORRECTA,
  FRASE_CONFIRMACION_CON_FIRMA,
  MOTIVO_SIN_SESION_CENTRAL,
  PISTA_CLAVE_FIRMA,
  PREFIJO_CODIGO_FIRMA,
  ROTULO_CLAVE_FIRMA,
  esClaveIncorrecta,
  esErrorDeFirma,
  mensajeDeFalloDeFirma,
} from "./firmaCopy";

/** Un `HttpClientError` como lo deja el normalizador (mismo patrón que `mensajeParaUsuario.test`). */
function httpError(
  campos: Partial<HttpClientError>,
  mensaje = "No se pudo completar la operación.",
) {
  return Object.assign(new Error(mensaje), {
    isHttpClientError: true as const,
    originalError: undefined,
    ...campos,
  }) as HttpClientError;
}

const TEXTO_CLAVE_SERVIDOR =
  "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.";

describe("esErrorDeFirma", () => {
  it("reconoce cualquier código APP-FIRMA-* del sobre de error", () => {
    expect(esErrorDeFirma(httpError({ code: "APP-FIRMA-SESION-001", status: 409 }))).toBe(true);
    expect(esErrorDeFirma(httpError({ code: "APP-FIRMA-CLAVE-001", status: 422 }))).toBe(true);
    expect(esErrorDeFirma(httpError({ code: "APP-FIRMA-NO-RESPONDE-001", status: 503 }))).toBe(true);
  });

  it("no confunde con un fallo de firma lo que no lo es", () => {
    expect(esErrorDeFirma(httpError({ code: "APP-ERROR-500", status: 500 }))).toBe(false);
    expect(esErrorDeFirma(httpError({ code: undefined }))).toBe(false);
    expect(esErrorDeFirma(new Error("APP-FIRMA-CLAVE-001"))).toBe(false);
    expect(esErrorDeFirma(null)).toBe(false);
    expect(esErrorDeFirma(undefined)).toBe(false);
  });

  it("el prefijo es el del backend", () => {
    expect(PREFIJO_CODIGO_FIRMA).toBe("APP-FIRMA-");
  });
});

describe("esClaveIncorrecta — la única puerta del estado E", () => {
  it("solo con APP-FIRMA-CLAVE-001", () => {
    expect(CODIGO_CLAVE_INCORRECTA).toBe("APP-FIRMA-CLAVE-001");
    expect(esClaveIncorrecta(httpError({ code: "APP-FIRMA-CLAVE-001" }))).toBe(true);
    expect(esClaveIncorrecta(httpError({ code: "APP-FIRMA-CERTIFICADO-001" }))).toBe(false);
    expect(esClaveIncorrecta(httpError({ code: "APP-FIRMA-SESION-001" }))).toBe(false);
    expect(esClaveIncorrecta(httpError({ code: "APP-FIRMA-FALTA-CLAVE-001" }))).toBe(false);
    expect(esClaveIncorrecta(new Error("x"))).toBe(false);
    expect(esClaveIncorrecta(null)).toBe(false);
  });
});

describe("mensajeDeFalloDeFirma", () => {
  it("compone «{consecuencia} {texto del servidor}» (UI-SPEC §10.1)", () => {
    const err = httpError(
      { code: "APP-FIRMA-CLAVE-001", status: 422 },
      TEXTO_CLAVE_SERVIDOR,
    );

    expect(mensajeDeFalloDeFirma(CONSECUENCIA_FALLO_FIRMA.generacion, err)).toBe(
      "No se generó el documento. La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.",
    );
  });

  it("🔴 nunca arrastra el detalle técnico del error, aunque traiga una clave", () => {
    const err = httpError(
      {
        code: "APP-FIRMA-CLAVE-001",
        status: 422,
        detalle: "auth-amc rechazó signPassword=clave-super-secreta-123",
      },
      TEXTO_CLAVE_SERVIDOR,
    );

    const mensaje = mensajeDeFalloDeFirma(CONSECUENCIA_FALLO_FIRMA.excusa, err);

    expect(mensaje).not.toContain("clave-super-secreta-123");
    expect(mensaje.startsWith("No se presentó la excusa. ")).toBe(true);
  });

  it("con un error que no es del cliente HTTP usa la frase genérica, no su texto técnico", () => {
    const mensaje = mensajeDeFalloDeFirma(
      CONSECUENCIA_FALLO_FIRMA.combo,
      new TypeError("Cannot read properties of undefined"),
    );

    expect(mensaje).toBe("No se firmó ninguna acta. No se pudo aplicar la firma.");
  });
});

describe("copy literal de UI-SPEC 03.21 §10", () => {
  it("§10.1 — las seis consecuencias", () => {
    expect(CONSECUENCIA_FALLO_FIRMA).toEqual({
      generacion: "No se generó el documento.",
      excusa: "No se presentó la excusa.",
      actaDecisorSecretario: "El acta no se firmó.",
      actaDirector:
        "El acta no se firmó y el lote no se aprobó en Asignaciones.",
      despacho: "No se generó el lote ni su memorando.",
      combo: "No se firmó ninguna acta.",
    });
  });

  it("§10.2 / §10.3 — rótulo, línea de error y pista del campo", () => {
    expect(ROTULO_CLAVE_FIRMA).toBe("Clave de firma");
    expect(ERROR_CLAVE_INCORRECTA).toBe("La clave de firma no es correcta.");
    expect(PISTA_CLAVE_FIRMA).toBe(
      "Se usa únicamente para firmar y no se guarda en ningún momento. Si la firma no se aplica, no se guarda nada.",
    );
  });

  it("§10.4 — el aviso del firmador apagado, por superficie", () => {
    expect(AVISO_SIN_FIRMADOR).toEqual({
      generacion:
        "La firma digital está desactivada en este despliegue: el documento se generará SIN firma criptográfica.",
      excusa:
        "La firma digital está desactivada en este despliegue: el escrito de excusa se presentará SIN firma criptográfica.",
      memorando:
        "La firma digital está desactivada en este despliegue: el memorando de devolución se generará SIN firma criptográfica.",
      acta: "La firma digital está desactivada en este despliegue: su firma quedará registrada, pero el acta quedará SIN firma criptográfica.",
    });
  });

  it("§10.5 — firmador encendido sin sesión central", () => {
    expect(AVISO_SIN_SESION_CENTRAL).toBe(
      "Para firmar hay que entrar al sistema con el Auth central, y su sesión actual no lo está. Cierre sesión y vuelva a entrar por el Auth central. Mientras tanto no se puede emitir nada que lleve firma.",
    );
    expect(MOTIVO_SIN_SESION_CENTRAL).toBe(
      "Entre al sistema con el Auth central para poder firmar.",
    );
  });

  it("§10.6 — la frase de la confirmación con el firmador encendido", () => {
    expect(FRASE_CONFIRMACION_CON_FIRMA).toBe(
      "El documento se firmará con su certificado antes de guardarse; si la firma no se aplica, no se emite nada.",
    );
  });
});
