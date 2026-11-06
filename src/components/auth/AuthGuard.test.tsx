/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 05
 * Feature: Guard de las rutas privadas
 * Archivo: AuthGuard.test.tsx
 * Responsabilidad: Aseverar el contrato del guard frente a los cuatro estados de sesión. El caso
 *   caro es `hydrating`: redirigir desde ahí es una salida DURA e incancelable de la SPA que echa a
 *   un usuario con cookie válida en el primer render (P-06). También se asevera que la salida al
 *   portal ocurre EXACTAMENTE una vez aunque el componente vuelva a renderizarse.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { StrictMode, type ReactElement } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SessionState } from "../../context/UserContext";

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  redirectToCentralAuthPortal: vi.fn(),
}));

vi.mock("../../context/UserContext", () => ({
  useUser: mocks.useUser,
}));

vi.mock("../../config/authRuntimeConfig", () => ({
  redirectToCentralAuthPortal: mocks.redirectToCentralAuthPortal,
}));

import AuthGuard from "./AuthGuard";

const CONTENIDO_PRIVADO = "contenido privado";
const RAIZ_LOCAL = "raíz de la app";

/**
 * Árbol de una ruta privada guardada, con la raíz declarada como destino alcanzable para poder
 * observar la navegación de router del modo local.
 */
function arbolGuardado(): ReactElement {
  return (
    <MemoryRouter initialEntries={["/home/dashboard"]}>
      <Routes>
        <Route
          path="/"
          element={<div>{RAIZ_LOCAL}</div>}
        />
        <Route
          path="/home/dashboard"
          element={
            <AuthGuard>
              <div>{CONTENIDO_PRIVADO}</div>
            </AuthGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * Monta el guard con un estado de sesión y un modo dados.
 */
function montarGuard(
  sessionState: SessionState,
  authCentralEnabled: boolean | null,
) {
  mocks.useUser.mockReturnValue({ sessionState, authCentralEnabled });

  return render(arbolGuardado());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthGuard / hidratación (P-06)", () => {
  it.each(["idle", "hydrating"] as const)(
    "con la sesión en '%s' muestra carga, NO renderiza los hijos y NO navega",
    (sessionState) => {
      montarGuard(sessionState, true);

      expect(screen.getByAltText("Cargando")).toBeInTheDocument();
      expect(screen.queryByText(CONTENIDO_PRIVADO)).not.toBeInTheDocument();
      expect(screen.queryByText(RAIZ_LOCAL)).not.toBeInTheDocument();
      expect(mocks.redirectToCentralAuthPortal).not.toHaveBeenCalled();
    },
  );

  it("con el modo aún sin resolver e hidratando tampoco navega", () => {
    montarGuard("hydrating", null);

    expect(mocks.redirectToCentralAuthPortal).not.toHaveBeenCalled();
  });
});

describe("AuthGuard / sesión viva", () => {
  it("con la sesión autenticada renderiza los hijos y no navega", () => {
    montarGuard("authenticated", true);

    expect(screen.getByText(CONTENIDO_PRIVADO)).toBeInTheDocument();
    expect(mocks.redirectToCentralAuthPortal).not.toHaveBeenCalled();
  });
});

describe("AuthGuard / sin sesión", () => {
  it("en modo central deriva al portal exactamente una vez y muestra carga", () => {
    montarGuard("anonymous", true);

    expect(mocks.redirectToCentralAuthPortal).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText("Cargando")).toBeInTheDocument();
    expect(screen.queryByText(CONTENIDO_PRIVADO)).not.toBeInTheDocument();
  });

  it("trata el modo aún sin resolver como central (fallo cerrado)", () => {
    montarGuard("anonymous", null);

    expect(mocks.redirectToCentralAuthPortal).toHaveBeenCalledTimes(1);
  });

  it("un re-render adicional NO produce una segunda salida al portal", () => {
    const { rerender } = montarGuard("anonymous", true);

    rerender(arbolGuardado());

    expect(mocks.redirectToCentralAuthPortal).toHaveBeenCalledTimes(1);
  });

  it("bajo el doble montaje de efectos (StrictMode) sale al portal UNA sola vez", () => {
    mocks.useUser.mockReturnValue({
      sessionState: "anonymous",
      authCentralEnabled: true,
    });

    render(<StrictMode>{arbolGuardado()}</StrictMode>);

    expect(mocks.redirectToCentralAuthPortal).toHaveBeenCalledTimes(1);
  });

  it("en modo local no llama al portal: navega a la raíz", () => {
    montarGuard("anonymous", false);

    expect(mocks.redirectToCentralAuthPortal).not.toHaveBeenCalled();
    expect(screen.getByText(RAIZ_LOCAL)).toBeInTheDocument();
    expect(screen.queryByText(CONTENIDO_PRIVADO)).not.toBeInTheDocument();
  });
});
