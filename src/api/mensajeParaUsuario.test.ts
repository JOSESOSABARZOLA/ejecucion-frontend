/**
 * Microservicio: ejecucion
 * Módulo: Compartido / HTTP
 * Feature: Errores sin texto técnico en pantalla
 * Archivo: mensajeParaUsuario.test.ts
 * Responsabilidad: Fijar qué texto de un error llega a la pantalla: el del servidor pasa tal cual,
 *   el de un fallo de red/tiempo/5xx lleva la referencia «(ref. xxxxxxxx)» para poder reportarlo, y
 *   el de un error JS (TypeError…) NUNCA se pinta. Fija también `errorDeBlob`, que rescata el
 *   mensaje del servidor de un cuerpo Blob sin perder `status`, `code` ni `correlationId`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpClientError } from "./httpClient";
import {
  ErrorParaUsuario,
  MENSAJES_ERROR_HTTP,
  esHttpClientError,
  mensajeParaUsuario,
} from "./mensajeParaUsuario";
import { errorDeBlob } from "../utils/blobError.util";

function errorHttp(campos: Partial<HttpClientError>, mensaje: string) {
  return Object.assign(new Error(mensaje), {
    isHttpClientError: true as const,
    originalError: undefined,
    ...campos,
  }) as HttpClientError;
}

let consola: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consola = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consola.mockRestore();
});

describe("mensajeParaUsuario", () => {
  it("un rechazo de negocio (4xx con sobre) pasa TAL CUAL y sin referencia", () => {
    const err = errorHttp(
      { status: 409, correlationId: "abcdef1234567890" },
      "El expediente ya se despachó.",
    );

    expect(mensajeParaUsuario(err, "No se pudo guardar.")).toBe(
      "El expediente ya se despachó.",
    );
    expect(consola).not.toHaveBeenCalled();
  });

  it("un 5xx lleva la referencia corta del correlationId", () => {
    const err = errorHttp(
      { status: 500, correlationId: "abcdef1234567890" },
      "Ocurrió un error inesperado en el servidor.",
    );

    expect(mensajeParaUsuario(err, "x")).toBe(
      "Ocurrió un error inesperado en el servidor. (ref. abcdef12)",
    );
  });

  it("un fallo de red lleva referencia y manda el detalle técnico a la consola", () => {
    const err = errorHttp(
      {
        causa: "red",
        correlationId: "1234567890ab",
        detalle: "Network Error",
      },
      MENSAJES_ERROR_HTTP.red,
    );

    const texto = mensajeParaUsuario(err, "x");

    expect(texto).toBe(`${MENSAJES_ERROR_HTTP.red} (ref. 12345678)`);
    expect(texto).not.toMatch(/Network Error/);
    expect(consola).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ detalle: "Network Error" }),
    );
  });

  it("un tiempo agotado también lleva referencia", () => {
    const err = errorHttp(
      { causa: "tiempo", correlationId: "feedbeef0000" },
      MENSAJES_ERROR_HTTP.tiempo,
    );

    expect(mensajeParaUsuario(err, "x")).toBe(
      `${MENSAJES_ERROR_HTTP.tiempo} (ref. feedbeef)`,
    );
  });

  it("sin correlationId no inventa referencia", () => {
    const err = errorHttp({ status: 503 }, MENSAJES_ERROR_HTTP.servidor);

    expect(mensajeParaUsuario(err, "x")).toBe(MENSAJES_ERROR_HTTP.servidor);
  });

  it("un HttpClientError con mensaje vacío cae al texto de la pantalla", () => {
    expect(mensajeParaUsuario(errorHttp({ status: 400 }, ""), "No se pudo.")).toBe(
      "No se pudo.",
    );
  });

  it("un error JS (TypeError) NUNCA se pinta: sale el genérico y el original va a la consola", () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'x')");

    expect(mensajeParaUsuario(err, "No se pudo guardar.")).toBe(
      "No se pudo guardar.",
    );
    expect(consola).toHaveBeenCalledWith(expect.any(String), err);
  });

  it("un `new Error` cualquiera tampoco se pinta", () => {
    expect(mensajeParaUsuario(new Error("Request failed"), "Genérico.")).toBe(
      "Genérico.",
    );
  });

  it("un valor lanzado que no es error da el genérico", () => {
    expect(mensajeParaUsuario("boom", "Genérico.")).toBe("Genérico.");
    expect(mensajeParaUsuario(undefined, "Genérico.")).toBe("Genérico.");
  });

  it("un ErrorParaUsuario (texto de negocio del cliente) pasa tal cual", () => {
    expect(
      mensajeParaUsuario(
        new ErrorParaUsuario("Revise el paso «Notificación»."),
        "x",
      ),
    ).toBe("Revise el paso «Notificación».");
    expect(consola).not.toHaveBeenCalled();
  });

  it("esHttpClientError distingue el error normalizado de uno JS", () => {
    expect(esHttpClientError(errorHttp({}, "a"))).toBe(true);
    expect(esHttpClientError(new Error("a"))).toBe(false);
    expect(esHttpClientError(null)).toBe(false);
  });
});

describe("errorDeBlob", () => {
  it("rescata el mensaje del sobre dentro de un Blob y CONSERVA status, code y correlationId", async () => {
    const err = errorHttp(
      {
        status: 422,
        code: "ERR_BAD_REQUEST",
        causa: "otro",
        correlationId: "corr-1",
        originalError: {
          response: {
            data: new Blob([
              JSON.stringify({
                error: { code: "EJE-ACTA-001", message: "Sin acta definitiva." },
              }),
            ]),
          },
        },
      },
      MENSAJES_ERROR_HTTP.otro,
    );

    const resultado = (await errorDeBlob(err)) as HttpClientError;

    expect(resultado.message).toBe("Sin acta definitiva.");
    expect(resultado.status).toBe(422);
    expect(resultado.code).toBe("EJE-ACTA-001");
    expect(resultado.correlationId).toBe("corr-1");
    expect(resultado.causa).toBeUndefined();
    expect(esHttpClientError(resultado)).toBe(true);
    expect(mensajeParaUsuario(resultado, "x")).toBe("Sin acta definitiva.");
  });

  it("si el Blob no es JSON devuelve el mismo error (con su genérico)", async () => {
    const err = errorHttp(
      {
        status: 502,
        causa: "servidor",
        originalError: { response: { data: new Blob(["<html>"]) } },
      },
      MENSAJES_ERROR_HTTP.servidor,
    );

    expect(await errorDeBlob(err)).toBe(err);
  });

  it("un error que no es del httpClient se devuelve tal cual (y la pantalla no pintará su texto)", async () => {
    const err = new TypeError("x");

    expect(await errorDeBlob(err)).toBe(err);
  });
});
