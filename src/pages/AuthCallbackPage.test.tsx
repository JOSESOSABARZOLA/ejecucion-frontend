/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 05
 * Feature: Ruta pública de retorno del portal
 * Archivo: AuthCallbackPage.test.tsx
 * Responsabilidad: Aseverar el contrato del canje. El caso caro es el CONTEO: el código es de un
 *   solo uso, así que un segundo canje devuelve 401 y presenta como fallo un acceso que ya funcionó
 *   (P-02). Por eso el caso principal monta la página bajo el doble montaje de efectos y cuenta las
 *   invocaciones. Se asevera además que sin código no se canjea nada, que un canje rechazado NO se
 *   reintenta y que el aterrizaje limpia el código de la URL reemplazando el historial.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { errorDelServidor } from "../test/errores";
import { StrictMode, type ReactElement } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  hydrateSession: vi.fn(),
  navigate: vi.fn(),
  redirectToCentralAuthPortal: vi.fn(),
}));

vi.mock("../services/AuthSessionService", () => ({
  AuthSessionService: { exchange: mocks.exchange },
  default: { exchange: mocks.exchange },
}));

vi.mock("../context/UserContext", () => ({
  useUser: () => ({ hydrateSession: mocks.hydrateSession }),
}));

vi.mock("../config/authRuntimeConfig", () => ({
  redirectToCentralAuthPortal: mocks.redirectToCentralAuthPortal,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();

  return { ...actual, useNavigate: () => mocks.navigate };
});

import AuthCallbackPage from "./AuthCallbackPage";

const CODIGO = "codigo-de-un-solo-uso-123";

/**
 * Fija la query de la URL actual: la página lee el código de `window.location`, no del router.
 * @param search query completa, incluido el signo de interrogación (o cadena vacía)
 */
function fijarQuery(search: string): void {
  window.history.replaceState({}, "", `/auth/callback${search}`);
}

function pagina(): ReactElement {
  return (
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <AuthCallbackPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchange.mockResolvedValue({ usuId: 7 });
  mocks.hydrateSession.mockResolvedValue(undefined);
});

describe("AuthCallbackPage / canje único (P-02)", () => {
  it("bajo el doble montaje de efectos canjea el código EXACTAMENTE una vez", async () => {
    fijarQuery(`?code=${CODIGO}`);

    render(<StrictMode>{pagina()}</StrictMode>);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalled();
    });

    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(mocks.exchange).toHaveBeenCalledWith(CODIGO);
  });

  it("tras un canje exitoso hidrata la sesión y aterriza en el tablero reemplazando el historial", async () => {
    fijarQuery(`?code=${CODIGO}`);

    render(pagina());

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/home/dashboard", {
        replace: true,
      });
    });

    expect(mocks.hydrateSession).toHaveBeenCalledTimes(1);
    expect(mocks.exchange.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.hydrateSession.mock.invocationCallOrder[0],
    );
  });
});

describe("AuthCallbackPage / retorno sin código", () => {
  it("no canjea nada y muestra el error con la opción de volver al portal", async () => {
    fijarQuery("");

    render(pagina());

    expect(
      await screen.findByRole("button", { name: /volver al portal/i }),
    ).toBeInTheDocument();
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe("AuthCallbackPage / canje fallido", () => {
  it("muestra el mensaje del error normalizado y NO reintenta el mismo código", async () => {
    fijarQuery(`?code=${CODIGO}`);
    mocks.exchange.mockRejectedValue(errorDelServidor("El código ya fue utilizado"));

    render(pagina());

    expect(
      await screen.findByText("El código ya fue utilizado"),
    ).toBeInTheDocument();
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("el botón de volver al portal invoca la salida al portal", async () => {
    fijarQuery(`?code=${CODIGO}`);
    mocks.exchange.mockRejectedValue(errorDelServidor("El código ya fue utilizado"));

    render(pagina());

    fireEvent.click(
      await screen.findByRole("button", { name: /volver al portal/i }),
    );

    expect(mocks.redirectToCentralAuthPortal).toHaveBeenCalledTimes(1);
  });

  it("no reintenta ni siquiera bajo el doble montaje de efectos", async () => {
    fijarQuery(`?code=${CODIGO}`);
    mocks.exchange.mockRejectedValue(errorDelServidor("El código ya fue utilizado"));

    render(<StrictMode>{pagina()}</StrictMode>);

    await screen.findByText("El código ya fue utilizado");

    expect(mocks.exchange).toHaveBeenCalledTimes(1);
  });
});

describe("AuthCallbackPage / el código no se filtra", () => {
  const sources = import.meta.glob("./AuthCallbackPage.tsx", {
    query: "?raw",
    eager: true,
    import: "default",
  }) as Record<string, string>;
  const source = sources["./AuthCallbackPage.tsx"];

  it("el módulo no vuelca nada a la consola del navegador (T-0311-22)", () => {
    expect(source).toBeTruthy();
    expect(source).not.toMatch(/console\s*\./);
  });

  it("el módulo no guarda nada en el almacenamiento del navegador", () => {
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });
});
