/**
 * App: Administración
 * Módulo: App Shell
 * Feature: Providers
 * Archivo: ThemeProvider.tsx
 * Responsabilidad: Gestiona el tema activo y su persistencia visual en la aplicación.
 * Desarrollador: Cristian Alberto Proaño Estévez
 * Fecha: 2026-03-30
 * Modificado por: Andrés Miño — 2026-10-05 (quick 261005-fas: el modo oscuro queda deshabilitado
 *   de verdad detrás de la constante `MODO_OSCURO_HABILITADO`; la aplicación arranca siempre en
 *   claro y la lógica de elección original se conserva para poder reactivarlo.)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  THEME_STORAGE_KEY,
  ThemeContext,
  type AppTheme,
  type ThemeContextValue,
} from "../context/ThemeContext";

/*
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * MODO OSCURO — interruptor maestro
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * (1) Por qué está apagado: en la reunión del 2026-09-16 se decidió quitar el modo oscuro y se
 *     comentó el interruptor de la barra (`Navbar.tsx`). Eso NO bastó: este provider seguía
 *     eligiendo "dark" si el navegador lo tenía guardado o si el sistema operativo prefería el
 *     oscuro, y quien lo tenía se quedó sin forma de salir (corregido en el quick 261005-fas).
 * (2) Qué hace con false: el tema es SIEMPRE "light". No se consulta lo guardado ni la preferencia
 *     del SO; el efecto de abajo reescribe lo guardado a "light" y el `setTheme` del contexto
 *     también queda fijado en "light", así que ningún control puede encender el oscuro.
 * (3) Consecuencia aceptada: la preferencia oscura que tuviera guardada un usuario se pierde; el
 *     día que se reactive, arrancará en claro y tendrá que volver a elegirla.
 * (4) Cómo reactivarlo:
 *     1. Poner esta constante a true.
 *     2. En `src/components/navbar/Navbar.tsx`, descomentar el bloque «MODO OSCURO», los imports
 *        de `Iconos` y `useTheme` y las líneas de `theme`/`isDarkTheme` del componente.
 *     3. Reescribir `src/providers/ThemeProvider.test.tsx`, que fija el estado apagado y fallará.
 *     No hace falta tocar CSS, `ThemeContext` ni `useTheme`: se conservaron enteros.
 * La anotación `boolean` evita que TypeScript estreche el literal y deje de comprobar la rama
 * original.
 */
const MODO_OSCURO_HABILITADO: boolean = false;

const getInitialTheme = (): AppTheme => {
  if (!MODO_OSCURO_HABILITADO) {
    return "light";
  }

  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);

  // Con el modo oscuro apagado el setter del contexto solo admite "light" (sin puerta trasera).
  const fijarTema = useCallback((tema: AppTheme) => {
    setTheme(MODO_OSCURO_HABILITADO ? tema : "light");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: fijarTema,
    }),
    [theme, fijarTema],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
