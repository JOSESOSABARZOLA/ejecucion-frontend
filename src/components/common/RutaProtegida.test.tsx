/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Guard de ruta por rol
 * Archivo: RutaProtegida.test.tsx
 * Responsabilidad: Lo que se protege aquí es el agujero que la Fase 03.18 midió: hoy teclear la URL
 *   de una pantalla que el rol no tiene LLEVA a la pantalla. Las cuatro conductas que el guard debe
 *   cumplir —dejar pasar al rol permitido, cortar al que no, NO expulsar mientras la sesión aún no ha
 *   resuelto, y comparar el rol con el mismo criterio que el motor de acciones— son exactamente las
 *   cuatro maneras de romperlo. La tercera es la que más caro sale: redirigir en el primer render
 *   echa de la pantalla a un usuario con cookie válida (mismo P-06 que documenta `AuthGuard`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { User } from "../../interfaces/IUser";
import type { SessionState } from "../../context/UserContext";
import RutaProtegida, { RUTA_DE_REFUGIO } from "./RutaProtegida";

const sesion: { user: User | null; sessionState: SessionState } = {
  user: null,
  sessionState: "authenticated",
};

vi.mock("../../context/UserContext", () => ({
  useUser: () => sesion,
}));

/** Usuario mínimo: al guard sólo le importa `rolName`. */
const usuarioCon = (rolName: string): User =>
  ({
    usuId: 1,
    usuFullName: "Quien sea",
    usuEmail: "quien@sea.gob.ec",
    rolName,
    modulos: [],
    submenus: [],
    actividades: [],
  }) as User;

/**
 * Monta el guard dentro de un router de memoria con la ruta de refugio declarada, para que redirigir
 * se pueda OBSERVAR (aparece el refugio) en vez de deducirse de que los hijos no estén.
 */
const montar = () =>
  render(
    <MemoryRouter initialEntries={["/home/protegida"]}>
      <Routes>
        <Route
          path="/home/protegida"
          element={
            <RutaProtegida rolesPermitidos={["funcionario decisor"]}>
              <p>pantalla protegida</p>
            </RutaProtegida>
          }
        />
        <Route path={RUTA_DE_REFUGIO} element={<p>refugio</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("RutaProtegida", () => {
  beforeEach(() => {
    sesion.user = null;
    sesion.sessionState = "authenticated";
  });

  it("con un rol incluido en los permitidos, renderiza sus hijos", () => {
    sesion.user = usuarioCon("funcionario decisor");

    montar();

    expect(screen.getByText("pantalla protegida")).toBeInTheDocument();
    expect(screen.queryByText("refugio")).toBeNull();
  });

  it("con un rol NO incluido, redirige al refugio y no renderiza los hijos", () => {
    sesion.user = usuarioCon("secretario abogado");

    montar();

    expect(screen.queryByText("pantalla protegida")).toBeNull();
    expect(screen.getByText("refugio")).toBeInTheDocument();
  });

  it("🔴 mientras la sesión no ha resuelto, NO redirige: espera (P-06)", () => {
    sesion.user = null;
    sesion.sessionState = "hydrating";

    montar();

    expect(screen.queryByText("refugio")).toBeNull();
    expect(screen.queryByText("pantalla protegida")).toBeNull();
    expect(screen.getByAltText("Cargando")).toBeInTheDocument();
  });

  it("compara el rol sin distinguir mayúsculas ni espacios, igual que el motor", () => {
    sesion.user = usuarioCon("  Funcionario DECISOR ");

    montar();

    expect(screen.getByText("pantalla protegida")).toBeInTheDocument();
  });
});
