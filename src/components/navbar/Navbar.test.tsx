/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 04
 * Feature: Elemento de cierre de sesión del menú de perfil
 * Archivo: Navbar.test.tsx
 * Responsabilidad: Aseverar que el elemento "Cerrar Sesión" del menú de perfil respeta el estado
 *   `isLoggingOut` del contexto: mientras el cierre está en curso no vuelve a invocarlo y la etiqueta
 *   lo dice. La idempotencia real vive en el contexto (y allí está probada); esto asevera que la UI
 *   no invita a pulsar dos veces.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { User } from "../../interfaces/IUser";

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  logoutUser: vi.fn(),
}));

vi.mock("../../context/UserContext", () => ({
  useUser: mocks.useUser,
}));

vi.mock("../../hooks/useAlerts", () => ({
  useAlerts: () => ({
    alerts: [],
    totalAlerts: 0,
    connectionStatus: "connected",
  }),
}));

vi.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

import Navbar from "./Navbar";

const USUARIO: User = {
  usuId: 7,
  usuFullName: "Juan Pérez",
  usuEmail: "juan.perez@quito.gob.ec",
  rolName: "funcionario decisor",
  modulos: [],
  submenus: [],
  actividades: [],
};

function montarNavbar(isLoggingOut: boolean) {
  mocks.useUser.mockReturnValue({
    user: USUARIO,
    logoutUser: mocks.logoutUser,
    isLoggingOut,
  });

  return render(
    <Navbar
      isSidebarOpen={false}
      onToggleSidebar={() => {}}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logoutUser.mockResolvedValue(undefined);
});

describe("Navbar / cerrar sesión", () => {
  it("invoca el cierre de sesión al pulsar el elemento del menú de perfil", () => {
    montarNavbar(false);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar Sesión" }));

    expect(mocks.logoutUser).toHaveBeenCalledTimes(1);
  });

  it("con el cierre en curso no vuelve a invocarlo y lo indica en la etiqueta", () => {
    montarNavbar(true);

    expect(
      screen.queryByRole("button", { name: "Cerrar Sesión" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cerrando sesión/i }));

    expect(mocks.logoutUser).not.toHaveBeenCalled();
  });
});
