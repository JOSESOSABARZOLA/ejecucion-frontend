/**
 * App: Administración
 * Módulo: Compartido
 * Feature: UI Compartida
 * Archivo: Loading.tsx
 * Responsabilidad: Renderiza el estado visual de carga reutilizable del frontend.
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-27
 */

import sigocLoader from "../../assets/sigoc_loader.svg";

const Loading = () => {
  return (
    <div className="flex h-full min-h-64 w-full items-center justify-center bg-white/50 absolute top-0 left-0 right-0 bottom-0 z-50">
      <img
        src={sigocLoader}
        alt="Cargando"
        className="h-[clamp(12rem,30vw,26rem)] w-[clamp(12rem,30vw,26rem)] select-none"
        draggable={false}
      />
    </div>
  );
};

export default Loading;
