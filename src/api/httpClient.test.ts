/**
 * Microservicio: ejecucion
 * Módulo: Compartido / HTTP — Fase 03.11 / Plan 03
 * Feature: Cliente HTTP con cookie de sesión, traza y reacción acotada a 401
 * Archivo: httpClient.test.ts
 * Responsabilidad: Ejercer el cliente HTTP REAL (sus interceptores, invocados a mano) para aseverar
 *   que (a) viaja con credenciales, (b) NUNCA manda `Authorization` ni lee el almacenamiento del
 *   navegador —T-0311-11, con la cookie HttpOnly un XSS ya no puede exfiltrar la sesión—, (c) cada
 *   petición lleva `x-correlation-id` y un `x-request-id` nuevo, (d) un 401 fuera de las rutas de
 *   sesión invoca UNA vez al manejador global y uno dentro de ellas no lo invoca (P-01 / T-0311-13) y
 *   (e) el mensaje de error sale del sobre homologado `data.error.message` del backend (Plan 01).
 *   No hace red real.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

/** Fuente cruda del módulo, para aseverar por revisión estática lo que no deja rastro en runtime. */
const MODULE_SOURCES = import.meta.glob<string>("./httpClient.ts", {
  query: "?raw",
  eager: true,
  import: "default",
});

// Ningún test puede navegar de verdad.
vi.mock("../utils/navigation", () => ({
  replaceLocation: vi.fn(),
  currentOrigin: vi.fn(() => "http://localhost:5177"),
}));

import httpClient, {
  normalizeHttpClientError,
  registerUnauthorizedHandler,
} from "./httpClient";
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from "./correlationId";
import { MENSAJES_ERROR_HTTP } from "./mensajeParaUsuario";

interface InterceptorHandler<TValue> {
  fulfilled?: (value: TValue) => TValue;
  rejected?: (error: unknown) => unknown;
}

/** Ejecuta a mano el interceptor de request sobre una config sintética. */
function runRequestInterceptors(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  const { handlers } = httpClient.interceptors.request as unknown as {
    handlers: (InterceptorHandler<InternalAxiosRequestConfig> | null)[];
  };

  return handlers.reduce<InternalAxiosRequestConfig>(
    (current, handler) =>
      handler?.fulfilled ? handler.fulfilled(current) : current,
    config,
  );
}

/** Ejecuta a mano la rama de error del interceptor de response. */
function runResponseErrorInterceptor(error: unknown): unknown {
  const { handlers } = httpClient.interceptors.response as unknown as {
    handlers: (InterceptorHandler<unknown> | null)[];
  };
  const handler = handlers.find((candidate) => candidate?.rejected);

  if (!handler?.rejected) {
    throw new Error("El cliente no tiene rama de error en el response");
  }

  return handler.rejected(error);
}

function emptyConfig(): InternalAxiosRequestConfig {
  return { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
}

function axiosErrorLike(status: number, url: string, data?: unknown) {
  return {
    isAxiosError: true,
    name: "AxiosError",
    message: `Request failed with status code ${status}`,
    code: "ERR_BAD_REQUEST",
    config: { url, headers: new AxiosHeaders() },
    response: { status, data, headers: new AxiosHeaders() },
  };
}

// ⚠️ Este bloque va PRIMERO a propósito: comprueba el manejador POR DEFECTO, y los bloques de más
// abajo registran uno real (el registro es estado de módulo y no se puede deshacer).
describe("reacción a 401 sin manejador registrado", () => {
  it("no rompe nada: el default es una función vacía", async () => {
    await expect(
      runResponseErrorInterceptor(axiosErrorLike(401, "/epas")),
    ).rejects.toMatchObject({ isHttpClientError: true, status: 401 });
  });
});

describe("configuración del cliente HTTP", () => {
  it("viaja con credenciales: la cookie de sesión es la única credencial", () => {
    expect(httpClient.defaults.withCredentials).toBe(true);
  });

  it("no declara ninguna cabecera Authorization por defecto", () => {
    expect(JSON.stringify(httpClient.defaults.headers)).not.toContain(
      "Authorization",
    );
  });

  it("T-0311-11: el módulo no lee el almacenamiento del navegador ni arma un Bearer", () => {
    const source = MODULE_SOURCES["./httpClient.ts"];

    expect(source).toBeTruthy();

    expect(source).not.toMatch(/localStorage|sessionStorage/);
    expect(source).not.toMatch(/Authorization/);
    expect(source).not.toMatch(/Bearer/);
  });
});

describe("interceptor de request (traza)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no lee el almacenamiento del navegador en tiempo de ejecución", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    runRequestInterceptors(emptyConfig());

    expect(getItem).not.toHaveBeenCalled();
    getItem.mockRestore();
  });

  it("no inyecta Authorization", () => {
    const config = runRequestInterceptors(emptyConfig());
    const headers = AxiosHeaders.from(config.headers);

    expect(headers.has("Authorization")).toBe(false);
  });

  it("pone x-correlation-id y x-request-id en cada petición", () => {
    const config = runRequestInterceptors(emptyConfig());
    const headers = AxiosHeaders.from(config.headers);

    expect(headers.get(CORRELATION_ID_HEADER)).toBeTruthy();
    expect(headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  it("respeta el x-correlation-id que ya venga puesto", () => {
    const config = emptyConfig();
    config.headers.set(CORRELATION_ID_HEADER, "ya-venia");

    const result = runRequestInterceptors(config);

    expect(AxiosHeaders.from(result.headers).get(CORRELATION_ID_HEADER)).toBe(
      "ya-venia",
    );
  });

  it("genera un x-request-id NUEVO por petición", () => {
    const first = AxiosHeaders.from(
      runRequestInterceptors(emptyConfig()).headers,
    ).get(REQUEST_ID_HEADER);
    const second = AxiosHeaders.from(
      runRequestInterceptors(emptyConfig()).headers,
    ).get(REQUEST_ID_HEADER);

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });
});

describe("reacción global a 401 (P-01 / T-0311-13)", () => {
  const onUnauthorized = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    registerUnauthorizedHandler(onUnauthorized);
  });

  it("un 401 en una API privada invoca al manejador exactamente una vez y rechaza", async () => {
    await expect(
      runResponseErrorInterceptor(axiosErrorLike(401, "/epas")),
    ).rejects.toMatchObject({ isHttpClientError: true, status: 401 });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("un 401 en /auth/me SÍ invoca al manejador", async () => {
    await expect(
      runResponseErrorInterceptor(axiosErrorLike(401, "/auth/me")),
    ).rejects.toBeDefined();

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("un 401 en una ruta de sesión NO invoca al manejador", async () => {
    await expect(
      runResponseErrorInterceptor(axiosErrorLike(401, "/auth/session")),
    ).rejects.toBeDefined();
    await expect(
      runResponseErrorInterceptor(axiosErrorLike(401, "/auth/session/exchange")),
    ).rejects.toBeDefined();
    await expect(
      runResponseErrorInterceptor(axiosErrorLike(401, "/auth/session/logout")),
    ).rejects.toBeDefined();
    await expect(
      runResponseErrorInterceptor(axiosErrorLike(401, "/auth/mode")),
    ).rejects.toBeDefined();

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("un 500 no invoca al manejador", async () => {
    await expect(
      runResponseErrorInterceptor(axiosErrorLike(500, "/epas")),
    ).rejects.toBeDefined();

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("normalizeHttpClientError (sobre homologado del ecosistema)", () => {
  it("toma el mensaje de data.error.message", () => {
    const normalized = normalizeHttpClientError(
      axiosErrorLike(401, "/auth/me", {
        success: false,
        error: { code: "APP-UNAUTHORIZED-001", message: "No autenticado." },
        correlationId: "c-1",
        requestId: "r-1",
      }),
    );

    expect(normalized.message).toBe("No autenticado.");
    expect(normalized.code).toBe("APP-UNAUTHORIZED-001");
    expect(normalized.status).toBe(401);
    expect(normalized.isHttpClientError).toBe(true);
  });

  it("cae a data.message cuando no hay sobre homologado", () => {
    const normalized = normalizeHttpClientError(
      axiosErrorLike(400, "/epas", { message: "mensaje viejo" }),
    );

    expect(normalized.message).toBe("mensaje viejo");
  });

  it("cae a data.details.message", () => {
    const normalized = normalizeHttpClientError(
      axiosErrorLike(400, "/epas", { details: { message: "detalle" } }),
    );

    expect(normalized.message).toBe("detalle");
  });

  it("un 5xx sin cuerpo NO enseña el texto de axios: genérico en castellano y el crudo en `detalle`", () => {
    const normalized = normalizeHttpClientError(axiosErrorLike(503, "/epas"));

    expect(normalized.message).toBe(MENSAJES_ERROR_HTTP.servidor);
    expect(normalized.causa).toBe("servidor");
    expect(normalized.detalle).toBe("Request failed with status code 503");
    expect(normalized.status).toBe(503);
    expect(normalized.code).toBe("ERR_BAD_REQUEST");
  });

  it("marca como HttpClientError cualquier error que no sea de axios, sin conservar su texto", () => {
    const normalized = normalizeHttpClientError(new Error("boom"));

    expect(normalized.isHttpClientError).toBe(true);
    expect(normalized.message).toBe(MENSAJES_ERROR_HTTP.otro);
    expect(normalized.detalle).toBe("boom");
  });

  it("un valor que no es error tampoco da texto en inglés", () => {
    const normalized = normalizeHttpClientError("raro");

    expect(normalized.message).toBe(MENSAJES_ERROR_HTTP.otro);
    expect(normalized.detalle).toBe("raro");
  });
});

describe("normalizeHttpClientError (sin mensaje del servidor)", () => {
  function sinRespuesta(code: string, message: string) {
    return {
      isAxiosError: true,
      name: "AxiosError",
      message,
      code,
      config: {
        url: "/epas",
        headers: new AxiosHeaders({ [CORRELATION_ID_HEADER]: "abcdef12-3456" }),
      },
    };
  }

  it("fallo de red ⇒ «No se pudo conectar…», causa `red`, y el correlationId de la petición", () => {
    const normalized = normalizeHttpClientError(
      sinRespuesta("ERR_NETWORK", "Network Error"),
    );

    expect(normalized.message).toBe(MENSAJES_ERROR_HTTP.red);
    expect(normalized.causa).toBe("red");
    expect(normalized.detalle).toBe("Network Error");
    expect(normalized.status).toBeUndefined();
    expect(normalized.correlationId).toBe("abcdef12-3456");
  });

  it("tiempo agotado ⇒ «El servidor tardó demasiado…», causa `tiempo`", () => {
    const normalized = normalizeHttpClientError(
      sinRespuesta("ECONNABORTED", "timeout of 5000ms exceeded"),
    );

    expect(normalized.message).toBe(MENSAJES_ERROR_HTTP.tiempo);
    expect(normalized.causa).toBe("tiempo");
    expect(normalized.detalle).toBe("timeout of 5000ms exceeded");
  });

  it("un 502 con el HTML de un proxy no se toma por mensaje", () => {
    const normalized = normalizeHttpClientError(
      axiosErrorLike(502, "/epas", "<html><body>Bad Gateway</body></html>"),
    );

    expect(normalized.message).toBe(MENSAJES_ERROR_HTTP.servidor);
    expect(normalized.causa).toBe("servidor");
  });

  it("un 4xx con cuerpo Blob cae al genérico `otro` (el servicio lo rescata con `errorDeBlob`)", () => {
    const normalized = normalizeHttpClientError(
      axiosErrorLike(400, "/epas", new Blob(["{}"])),
    );

    expect(normalized.message).toBe(MENSAJES_ERROR_HTTP.otro);
    expect(normalized.causa).toBe("otro");
  });

  it("con el sobre del servidor NO hay `causa`: su mensaje ya es para el usuario", () => {
    const normalized = normalizeHttpClientError(
      axiosErrorLike(500, "/epas", {
        error: { message: "Ocurrió un error inesperado en el servidor." },
      }),
    );

    expect(normalized.message).toBe(
      "Ocurrió un error inesperado en el servidor.",
    );
    expect(normalized.causa).toBeUndefined();
  });
});
