/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 06
 * Feature: El módulo de alertas según el modo de autenticación
 * Archivo: AlertProviderWrapper.test.tsx
 * Responsabilidad: Aseverar que en modo central el provider carga las no leídas y SONDEA por HTTP
 *   cada `POLLING_INTERVAL_MS` sin intentar el socket (quick 261030-m29, D-CANAL, que revisa la
 *   D-03 de la Fase 03.11: hasta entonces se aseveraba aquí que el módulo quedaba INERTE); que el
 *   modo aún sin resolver (`null`) no inicializa nada, coherente con el fallo cerrado que ya aplican
 *   el bootstrap, el logout, el guard y la raíz; y que en modo local el comportamiento es el de hoy.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-m29: el describe «modo central» pasa de
 *   aseverar la inercia a aseverar la carga inicial y el sondeo sin socket)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: el sondeo va cada 15 min; la prueba
 *   del intervalo avanza el reloj con la constante)
 */

import { useContext, type ReactElement } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { User } from "../interfaces/IUser";
import { POLLING_CONFIG } from "../config/socketConfig";

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  getUnreadAlerts: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("../context/UserContext", () => ({
  useUser: mocks.useUser,
}));

vi.mock("../services/AlertService", () => ({
  AlertService: { getUnreadAlerts: mocks.getUnreadAlerts },
}));

vi.mock("../services/AlertWebSocketService", () => ({
  AlertWebSocketService: {
    connect: mocks.connect,
    disconnect: mocks.disconnect,
  },
}));

import { AlertContext, AlertProvider } from "../context/AlertContext";
import { AlertProviderWrapper } from "./AlertProviderWrapper";

/** Enseña lo que el contexto tiene, para aseverar que la carga llega a la campana. */
function Espia() {
  const contexto = useContext(AlertContext);
  return (
    <p>
      {contexto?.alerts.length ?? 0} alerta(s) de {contexto?.totalAlerts ?? 0}
    </p>
  );
}

const CONTENIDO = "contenido de la app";

/**
 * Referencia ESTABLE de usuario: si cambiara entre renders, el efecto se volvería a ejecutar por la
 * dependencia `user` y el test del modo que se resuelve tarde dejaría de probar lo que dice probar.
 */
const USUARIO: User = {
  usuId: 7,
  usuFullName: "Usuario de prueba",
  usuEmail: "usuario@amc.gob.ec",
  rolName: "TECNICO",
  modulos: [],
  submenus: [],
  actividades: [],
};

function arbol(): ReactElement {
  return (
    <AlertProvider>
      <AlertProviderWrapper>
        <div>{CONTENIDO}</div>
      </AlertProviderWrapper>
    </AlertProvider>
  );
}

/**
 * Monta el provider con un usuario y un modo de autenticación dados.
 */
function montar(user: User | null, authCentralEnabled: boolean | null) {
  mocks.useUser.mockReturnValue({ user, authCentralEnabled });

  return render(arbol());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUnreadAlerts.mockResolvedValue({ alerts: [], totalAlerts: 0 });
  mocks.connect.mockResolvedValue({});
});

describe("AlertProviderWrapper / modo central (quick 261030-m29, revisa D-03)", () => {
  it("el sondeo va cada 15 minutos (decisión del usuario, 2026-11-04)", () => {
    expect(POLLING_CONFIG.POLLING_INTERVAL_MS).toBe(15 * 60 * 1000);
  });

  it("con usuario autenticado carga las no leídas y NO conecta el socket", async () => {
    montar(USUARIO, true);

    await waitFor(() => expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(1));
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("sondea cada POLLING_INTERVAL_MS: un minuto antes no hay segunda carga y al cumplirse sí", async () => {
    vi.useFakeTimers();

    try {
      const { unmount } = montar(USUARIO, true);
      await vi.advanceTimersByTimeAsync(0);

      expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);

      const UN_MINUTO = 60 * 1000;
      await vi.advanceTimersByTimeAsync(
        POLLING_CONFIG.POLLING_INTERVAL_MS - UN_MINUTO,
      );
      expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(UN_MINUTO);
      expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(2);

      // Seis intervalos más, seis cargas más: un solo intervalo, nunca dos.
      await vi.advanceTimersByTimeAsync(POLLING_CONFIG.POLLING_INTERVAL_MS * 6);
      expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(8);
      expect(vi.getTimerCount()).toBe(1);
      expect(mocks.connect).not.toHaveBeenCalled();

      // Al desmontar no queda ningún intervalo vivo.
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("un fallo del sondeo no lo detiene: la siguiente vuelta vuelve a pedir", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      montar(USUARIO, true);
      await vi.advanceTimersByTimeAsync(0);

      mocks.getUnreadAlerts.mockRejectedValueOnce(new Error("500"));
      await vi.advanceTimersByTimeAsync(POLLING_CONFIG.POLLING_INTERVAL_MS);
      await vi.advanceTimersByTimeAsync(POLLING_CONFIG.POLLING_INTERVAL_MS);

      expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(3);
    } finally {
      error.mockRestore();
      vi.useRealTimers();
    }
  });

  it("pinta las no leídas que devuelve el servidor en el contexto", async () => {
    mocks.getUnreadAlerts.mockResolvedValue({
      alerts: [{ ualeId: 1, aresTitle: "Plazo por vencer" }],
      totalAlerts: 3,
    });
    mocks.useUser.mockReturnValue({ user: USUARIO, authCentralEnabled: true });

    render(
      <AlertProvider>
        <AlertProviderWrapper>
          <Espia />
        </AlertProviderWrapper>
      </AlertProvider>,
    );

    expect(await screen.findByText("1 alerta(s) de 3")).toBeInTheDocument();
  });
});

describe("AlertProviderWrapper / modo aún sin resolver", () => {
  it("con el modo en null no inicializa nada (fallo cerrado)", async () => {
    montar(USUARIO, null);

    await Promise.resolve();

    expect(mocks.getUnreadAlerts).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("cuando el modo se resuelve a central DESPUÉS del primer render, carga entonces sin socket", async () => {
    const { rerender } = montar(USUARIO, null);

    expect(mocks.getUnreadAlerts).not.toHaveBeenCalled();

    mocks.useUser.mockReturnValue({
      user: USUARIO,
      authCentralEnabled: true,
    });
    rerender(arbol());

    await waitFor(() => expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(1));
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("cuando el modo se resuelve a local DESPUÉS del primer render, inicializa entonces", async () => {
    const { rerender } = montar(USUARIO, null);

    expect(mocks.connect).not.toHaveBeenCalled();

    mocks.useUser.mockReturnValue({
      user: USUARIO,
      authCentralEnabled: false,
    });
    rerender(arbol());

    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(1));
    expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(1);
  });
});

describe("AlertProviderWrapper / modo local (sin cambios de conducta)", () => {
  it("con usuario autenticado carga las alertas iniciales y conecta el socket", async () => {
    montar(USUARIO, false);

    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(1));
    expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(1);
    expect(mocks.connect).toHaveBeenCalledWith(
      String(USUARIO.usuId),
      expect.any(Object),
    );
  });
});

describe("AlertProviderWrapper / sin usuario", () => {
  it("no inicializa nada ni siquiera en modo local", async () => {
    montar(null, false);

    await Promise.resolve();

    expect(mocks.getUnreadAlerts).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});

describe("AlertProviderWrapper / hijos", () => {
  it.each([
    ["central", true],
    ["local", false],
    ["sin resolver", null],
  ] as const)("sigue renderizando a sus hijos en modo %s", (_etiqueta, modo) => {
    montar(USUARIO, modo);

    expect(screen.getByText(CONTENIDO)).toBeInTheDocument();
  });
});
