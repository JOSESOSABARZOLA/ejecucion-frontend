/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Tema de la aplicación — modo oscuro deshabilitado (quick 261005-fas)
 * Archivo: ThemeProvider.test.tsx
 * Responsabilidad: Fijar el estado APAGADO del modo oscuro: con el SO en oscuro y/o "dark" guardado
 *   en el navegador la aplicación arranca en claro y lo guardado se reescribe a "light", y el
 *   `setTheme` del contexto no puede encender el oscuro. Existe porque comentar el interruptor de la
 *   barra el 2026-09-16 no bastó: el provider seguía eligiendo "dark". El día que se reactive el
 *   oscuro (constante `MODO_OSCURO_HABILITADO` a true en `ThemeProvider.tsx`) esta prueba se
 *   reescribe A PROPÓSITO.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-05
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";
import { THEME_STORAGE_KEY } from "../context/ThemeContext";
import { useTheme } from "../hooks/useTheme";

/**
 * Doble del almacenamiento del navegador. jsdom NO expone `window.localStorage` en este proyecto
 * (Node lo deja fuera sin `--localstorage-file`), así que hay que instalarlo a mano. Copia local del
 * patrón de `UserContext.test.tsx`.
 */
function crearAlmacenFalso() {
  const datos = new Map<string, string>();

  return {
    getItem: vi.fn((clave: string) => datos.get(clave) ?? null),
    setItem: vi.fn((clave: string, valor: string) => {
      datos.set(clave, String(valor));
    }),
    removeItem: vi.fn((clave: string) => {
      datos.delete(clave);
    }),
    clear: vi.fn(() => {
      datos.clear();
    }),
    key: vi.fn((indice: number) => Array.from(datos.keys())[indice] ?? null),
    get length() {
      return datos.size;
    },
  };
}

let almacen: ReturnType<typeof crearAlmacenFalso>;

/** Instala el doble del almacenamiento en `window`. */
function instalarAlmacen(valor: unknown) {
  Object.defineProperty(window, "localStorage", {
    value: valor,
    configurable: true,
    writable: true,
  });
}

/**
 * Doble de `window.matchMedia`, que jsdom no implementa. Solo responde `matches: true` a la consulta
 * exacta del modo oscuro y únicamente si el caso simula un SO en oscuro.
 */
function instalarMatchMedia(soOscuro: boolean) {
  const matchMedia = vi.fn(
    (consulta: string) =>
      ({
        matches: soOscuro && consulta === "(prefers-color-scheme: dark)",
        media: consulta,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

  Object.defineProperty(window, "matchMedia", {
    value: matchMedia,
    configurable: true,
    writable: true,
  });
}

/** Sonda: pinta el tema del contexto y ofrece un botón que intenta encender el oscuro. */
function Sonda() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="tema">{theme}</span>
      <button type="button" onClick={() => setTheme("dark")}>
        Pedir oscuro
      </button>
    </div>
  );
}

const montar = () =>
  render(
    <ThemeProvider>
      <Sonda />
    </ThemeProvider>,
  );

/** Las tres cosas que deben valer "light": el `<html>`, lo guardado y lo que expone el contexto. */
function aseverarClaro() {
  expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  expect(almacen.getItem(THEME_STORAGE_KEY)).toBe("light");
  expect(screen.getByTestId("tema").textContent).toBe("light");
}

describe("ThemeProvider — modo oscuro deshabilitado (quick 261005-fas)", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    almacen = crearAlmacenFalso();
    instalarAlmacen(almacen);
  });

  it.each([
    {
      caso: "A (el reportado por el usuario): SO en oscuro y 'dark' guardado",
      soOscuro: true,
      darkGuardado: true,
    },
    {
      caso: "B (usuario atrapado): SO en claro y 'dark' guardado",
      soOscuro: false,
      darkGuardado: true,
    },
    {
      caso: "C (preferencia del SO): SO en oscuro y nada guardado",
      soOscuro: true,
      darkGuardado: false,
    },
  ])("caso $caso → arranca en claro y guarda 'light'", ({ soOscuro, darkGuardado }) => {
    if (darkGuardado) {
      almacen.setItem(THEME_STORAGE_KEY, "dark");
    }
    instalarMatchMedia(soOscuro);

    montar();

    aseverarClaro();
  });

  it("caso D (puerta trasera): setTheme('dark') no enciende el oscuro", () => {
    instalarMatchMedia(true);

    montar();
    fireEvent.click(screen.getByRole("button", { name: "Pedir oscuro" }));

    aseverarClaro();
  });
});
