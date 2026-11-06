/**
 * Microservicio: ejecucion
 * Módulo: Alertas
 * Feature: WebSocket para alertas en tiempo real — tests
 * Archivo: AlertWebSocketService.test.ts
 * Responsabilidad: Fija que SIN TOKEN no se intenta el handshake.
 *
 *   Desde la Fase 03.11 el navegador no ve el JWT en ningún modo (el login emite cookie HttpOnly y
 *   `authToken` dejó de escribirse), y el gateway exige `handshake.auth.token`. Conectar igualmente
 *   era un rechazo garantizado repetido cinco veces por carga de página, con dos avisos de servidor
 *   cada uno. Este test impide que alguien reabra ese camino sin darse cuenta.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-13
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ioMock = vi.fn();
vi.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => ioMock(...args),
  Socket: class {},
}));

import { AlertWebSocketService } from "./AlertWebSocketService";

/**
 * Doble del almacenamiento del navegador. jsdom NO expone `window.localStorage` en este proyecto
 * (Node lo deja fuera sin `--localstorage-file`), así que se instala uno igual que hace
 * `UserContext.test.tsx`.
 */
function crearAlmacenFalso() {
  const datos = new Map<string, string>();
  return {
    getItem: vi.fn((clave: string) => datos.get(clave) ?? null),
    setItem: vi.fn((clave: string, valor: string) => {
      datos.set(clave, String(valor));
    }),
    removeItem: vi.fn((clave: string) => datos.delete(clave)),
    clear: vi.fn(() => datos.clear()),
    key: vi.fn((i: number) => Array.from(datos.keys())[i] ?? null),
    get length() {
      return datos.size;
    },
  };
}

let almacen: ReturnType<typeof crearAlmacenFalso>;

const callbacks = () => ({
  onAlertNew: vi.fn(),
  onAlertRead: vi.fn(),
  onDisconnect: vi.fn(),
  onFallbackToPolling: vi.fn(),
});

describe("AlertWebSocketService.connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    almacen = crearAlmacenFalso();
    Object.defineProperty(window, "localStorage", {
      value: almacen,
      configurable: true,
      writable: true,
    });
    AlertWebSocketService.socket = null;
  });

  describe("sin token en el navegador (el caso de HOY, en los dos modos)", () => {
    it("NO abre el socket: ni siquiera se llama a io()", async () => {
      const cb = callbacks();

      const resultado = await AlertWebSocketService.connect("7", cb);

      expect(ioMock).not.toHaveBeenCalled();
      expect(resultado).toBeNull();
    });

    it("cae DIRECTO al polling, que es el camino que sí funciona con la cookie", async () => {
      const cb = callbacks();

      await AlertWebSocketService.connect("7", cb);

      // Sin esto, las alertas esperarían al umbral de desconexión para empezar a sondear.
      expect(cb.onFallbackToPolling).toHaveBeenCalledTimes(1);
    });

    it("no deja un socket colgado en el servicio", async () => {
      await AlertWebSocketService.connect("7", callbacks());

      expect(AlertWebSocketService.socket).toBeNull();
    });
  });

  describe("con token (si algún día vuelve a haberlo en el navegador)", () => {
    it("sí abre el socket y NO fuerza el polling", async () => {
      almacen.setItem("authToken", "jwt.de.prueba");
      // El servicio registra listeners y llama a connect() sobre el socket que devuelve io().
      const socketFalso = { on: vi.fn(), emit: vi.fn(), connect: vi.fn() };
      ioMock.mockReturnValue(socketFalso);
      const cb = callbacks();

      const resultado = await AlertWebSocketService.connect("7", cb);

      expect(ioMock).toHaveBeenCalledTimes(1);
      // El token viaja en la config del handshake, que es lo que el gateway lee.
      const config = ioMock.mock.calls[0][1] as { auth: { token: string } };
      expect(config.auth.token).toBe("jwt.de.prueba");
      expect(cb.onFallbackToPolling).not.toHaveBeenCalled();
      expect(resultado).toBe(socketFalso);
    });
  });
});
