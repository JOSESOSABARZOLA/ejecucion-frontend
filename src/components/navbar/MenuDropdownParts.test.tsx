/**
 * Microservicio: ejecucion
 * Módulo: App Shell (frontend)
 * Feature: El tablero, fijo en el menú lateral — tests
 * Archivo: MenuDropdownParts.test.tsx
 * Responsabilidad: Blindar la entrada FIJA del Dashboard, que es la única del menú que no sale de la
 *   base.
 *
 *   ── POR QUÉ ESTA ENTRADA NECESITA PRUEBA Y LAS DEMÁS NO ──────────────────────────────────────
 *   El resto del menú es data-driven y su conjunto por rol lo asevera
 *   `ejecucion-db/scripts/assert-menu-role-matrix.sql` contra la base. Esta entrada **no pasa por
 *   ahí**: se decidió declararla en el shell (2026-10-02) para que aparezca sin re-login y sin
 *   tocar grants, así que la matriz no la cubre y aquí es donde se puede comprobar.
 *
 *   🔴 Lo que hay que impedir en las dos direcciones:
 *     · que DESAPAREZCA para un rol que sí tiene tablero — el usuario se queda otra vez sin forma de
 *       volver salvo reescribiendo la URL, que es el problema que esto vino a resolver;
 *     · que APAREZCA para el delegado de trabajo comunitario, a quien `GET /dashboard` responde
 *       **403**: enseñarle el enlace es ofrecerle un rechazo.
 *
 *   jsdom no carga CSS: esto afirma presencia y destino, nunca aspecto.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-02
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { User } from "../../interfaces/IUser";

const mocks = vi.hoisted(() => ({ useUser: vi.fn() }));

vi.mock("../../context/UserContext", () => ({ useUser: mocks.useUser }));

import { Content } from "./MenuDropdownParts";

const usuarioDe = (rolName: string, parcial: Partial<User> = {}): User => ({
  usuId: 7,
  usuFullName: "Quien sea",
  usuEmail: "quien.sea@quito.gob.ec",
  rolName,
  modulos: [],
  submenus: [],
  actividades: [],
  ...parcial,
});

const montar = (user: User | null) => {
  mocks.useUser.mockReturnValue({ user });
  return render(
    <MemoryRouter>
      <Content />
    </MemoryRouter>,
  );
};

describe("Content — la entrada fija del Dashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    "funcionario decisor",
    "secretario abogado",
    "director",
    "administrador",
  ])("🔴 el rol «%s» ve el Dashboard aunque no tenga ningún módulo", (rol) => {
    montar(usuarioDe(rol));

    const enlace = screen.getByRole("link", { name: /dashboard/i });
    expect(enlace).toHaveAttribute("href", "/home/dashboard");
  });

  it("🔴 el delegado de trabajo comunitario NO lo ve: el backend le responde 403", () => {
    montar(usuarioDe("delegado de trabajo comunitario"));

    expect(
      screen.queryByRole("link", { name: /dashboard/i }),
    ).not.toBeInTheDocument();
  });

  it("un rol desconocido tampoco lo ve", () => {
    montar(usuarioDe("lo que sea"));

    expect(
      screen.queryByRole("link", { name: /dashboard/i }),
    ).not.toBeInTheDocument();
  });

  it("el rol se compara sin importar espacios ni mayúsculas", () => {
    montar(usuarioDe("  Director  "));

    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).toBeInTheDocument();
  });

  describe("el mensaje de «no hay opciones»", () => {
    // Decirle «no hay opciones» a quien tiene el tablero delante seria falso.
    it("🔴 NO sale para un rol con tablero y sin módulos", () => {
      montar(usuarioDe("director"));

      expect(
        screen.queryByText(/No hay opciones de navegacion/i),
      ).not.toBeInTheDocument();
    });

    it("sí sale para quien no tiene ni módulos ni tablero", () => {
      montar(usuarioDe("delegado de trabajo comunitario"));

      expect(
        screen.getByText(/No hay opciones de navegacion/i),
      ).toBeInTheDocument();
    });
  });

  it("el Dashboard va PRIMERO, delante de los módulos de la base", () => {
    montar(
      usuarioDe("director", {
        modulos: [
          {
            moduId: 1,
            moduName: "Recepcion y Asignacion",
            moduPath: "/ejecucion",
            moduIcon: "recepcion",
          },
        ],
      } as Partial<User>),
    );

    const enlaces = screen.getAllByRole("link");
    expect(enlaces[0]).toHaveAttribute("href", "/home/dashboard");
  });

  it("sin usuario no renderiza nada", () => {
    const { container } = montar(null);

    expect(container).toBeEmptyDOMElement();
  });
});
