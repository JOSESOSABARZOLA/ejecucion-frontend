/**
 * Microservicio: ejecucion
 * Módulo: Providers
 * Feature: Providers
 * Archivo: AppProviders.tsx
 * Responsabilidad: Compone los providers globales necesarios para el frontend. Desde la Fase 03.11
 *   la sesión viaja SIEMPRE en la cookie HttpOnly: aquí ya no hay —ni puede volver a haber— ningún
 *   registrador de token de acceso, porque un JWT en el estado de React sería exfiltrable por un XSS
 *   (T-0311-11 / T-0311-29).
 * Desarrollador: Johan Freire / Andrés Miño (Fase 03.11)
 * Fecha: 2026-08-05
 */

import { type PropsWithChildren } from "react";

import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";
import { ModalProvider } from "./ModalProvider";
import ModalContainer from "../components/modals/ModalContainer";
import { UserProvider } from "../context/UserContext";
import { AlertProvider } from "../context/AlertContext";
import { AlertProviderWrapper } from "./AlertProviderWrapper";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <UserProvider>
        <AlertProvider>
          <AlertProviderWrapper>
            <ToastProvider>
              <ModalProvider>
                {children}
                <ModalContainer />
              </ModalProvider>
            </ToastProvider>
          </AlertProviderWrapper>
        </AlertProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
