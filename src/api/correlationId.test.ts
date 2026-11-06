/**
 * Microservicio: ejecucion
 * Módulo: Compartido / HTTP
 * Feature: Identificadores de traza fuera de contexto seguro
 * Archivo: correlationId.test.ts
 * Responsabilidad: Fijar que los identificadores de traza se generan SIN depender de
 *   `crypto.randomUUID`, que solo existe en contextos seguros (https o localhost). El despliegue 1.2.0
 *   en el servidor —HTTP contra una IP— reventó el acceso con «crypto.randomUUID is not a function»,
 *   así que estos casos existen para que ese fallo no pueda volver.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-07
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCorrelationId,
  createRequestId,
  generateUuid,
} from "./correlationId";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Sustituye `globalThis.crypto` por el doble indicado durante la prueba. */
function stubCrypto(replacement: unknown): void {
  vi.stubGlobal("crypto", replacement);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("identificadores de traza fuera de contexto seguro", () => {
  it("usa randomUUID cuando existe", () => {
    const randomUUID = vi.fn(
      () => "11111111-2222-4333-8444-555555555555" as const,
    );
    stubCrypto({ randomUUID, getRandomValues: vi.fn() });

    expect(generateUuid()).toBe("11111111-2222-4333-8444-555555555555");
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("SIN randomUUID cae a getRandomValues y sigue devolviendo un uuid v4", () => {
    // El caso real del servidor: contexto no seguro, `randomUUID` no está definido.
    stubCrypto({
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i += 1) {
          bytes[i] = (i * 17) % 256;
        }

        return bytes;
      },
    });

    expect(() => generateUuid()).not.toThrow();
    expect(generateUuid()).toMatch(UUID_V4);
  });

  it("SIN crypto en absoluto no revienta: la traza nunca tumba la app", () => {
    stubCrypto(undefined);

    expect(() => generateUuid()).not.toThrow();
    expect(generateUuid()).toMatch(UUID_V4);
  });

  it("los dos generadores públicos aguantan el contexto no seguro", () => {
    stubCrypto({
      getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
    });

    expect(createCorrelationId()).toMatch(UUID_V4);
    expect(createRequestId()).toMatch(UUID_V4);
  });

  it("no repite el identificador entre llamadas consecutivas", () => {
    const generados = new Set(
      Array.from({ length: 50 }, () => createRequestId()),
    );

    expect(generados.size).toBe(50);
  });
});
