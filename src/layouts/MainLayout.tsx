/**
 * Microservicio: resolucion
 * M�dulo: N/A
 * Feature: Layout principal
 * Archivo: MainLayout.tsx
 * Responsabilidad: Presentar los componentes comunes que interactuar�n en toda la aplicaci�n, como barras de navegaci�n, menus, etc.
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: solo comentarios. El buscador flotante
 *   consulta el catálogo de CORE por el backend)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-edf: el buscador flotante viene del paquete compartido @amc-automatizacion/ui 0.1.0; las lecturas siguen por InfraccionesService)
 */
import React, { useEffect, useState, type FC } from "react";
import Navbar from "../components/navbar/Navbar";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/navbar/Sidebar";
import {
  BuscadorInfracciones,
  type ConsultaCatalogoInfracciones,
  type ConsultasBuscadorInfracciones,
} from "@amc-automatizacion/ui";
import { InfraccionesService } from "../services/InfraccionesService";

type MainLayoutProps = {
  children?: React.ReactNode;
};

const DESKTOP_SIDEBAR_WIDTH = "16.375rem";

// Lecturas del buscador compartido. Fuera del componente para que no se recree en cada render; el
// tipo del paquete hace que tsc compruebe su contrato contra InfraccionesService aquí mismo.
const consultasCatalogoInfracciones: ConsultasBuscadorInfracciones = {
  materias: () => InfraccionesService.materias(),
  catalogo: (consulta: ConsultaCatalogoInfracciones) =>
    InfraccionesService.catalogo(consulta),
};

const getInitialSidebarOpen = () => {
  if (typeof window === "undefined") {
    return true;
  }

  return window.matchMedia("(min-width: 1024px)").matches;
};

const MainLayout: FC<MainLayoutProps> = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    getInitialSidebarOpen(),
  );

  const toggleSidebar = () => {
    setIsSidebarOpen((current) => !current);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    const initialLoaderTimeout = window.setTimeout(() => {
      // setIsInitialLoginLoaderVisible(false);
    }, 2500);

    return () => {
      window.clearTimeout(initialLoaderTimeout);
    };
  }, []);

  return (
    // La clase bg-system es la contenedora del fondo con la textura de la Amc
    <div className="app-shell-root bg-system relative overflow-hidden bg-base-200 text-base-content">
      <div className="app-shell-overlay pointer-events-none absolute inset-0"></div>
      <div
        className="app-shell-grid relative z-10 flex h-full min-h-0 flex-col overflow-hidden lg:grid lg:grid-rows-[minmax(0,1fr)] lg:transition-[grid-template-columns] lg:duration-460 lg:ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          gridTemplateColumns: isSidebarOpen
            ? `${DESKTOP_SIDEBAR_WIDTH} minmax(0, 1fr)`
            : "0rem minmax(0, 1fr)",
        }}
      >
        <div className="hidden h-full min-h-0 overflow-hidden lg:block">
          <div className="h-full overflow-hidden">
            <Sidebar className="h-full w-65.5 rounded-none border-y-0 border-l-0 border-r border-base-300 shadow-none" />
          </div>
        </div>

        <div
          className={`fixed inset-0 z-40 transition-opacity duration-420 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden ${
            isSidebarOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label="Cerrar menú lateral"
            className="absolute inset-0 bg-slate-950/38 backdrop-blur-[2px]"
            onClick={closeSidebar}
          />

          <div
            className={`absolute inset-y-0 left-0 w-63.5 max-w-[calc(100vw-1rem)] p-2 pr-0 transition-transform duration-460 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar
              className="h-full w-full rounded-[1.75rem]"
              onNavigate={closeSidebar}
            />
          </div>
        </div>

        <div className="app-shell-main-column transition-[width] duration-460 ease-[cubic-bezier(0.16,1,0.3,1)]">
          <Navbar
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
          />
          <main className="app-shell-main-content px-4 py-6 md:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
      {/* Buscador flotante de infracciones del paquete compartido (catálogo de CORE vía backend, Ctrl+K). */}
      <BuscadorInfracciones consultas={consultasCatalogoInfracciones} />
      {/* <Loading /> */}
    </div>
  );
};

export default MainLayout;
