/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 05
 * Feature: Pantalla de acceso en modo central
 * Archivo: CentralAuthRedirectPage.tsx
 * Responsabilidad: Ser lo que ve en la raíz un usuario sin sesión cuando el acceso lo gestiona Auth
 *   central. La salida al portal es EXPLÍCITA, con un botón (Q-13): una redirección automática desde
 *   la raíz haría imposible llegar a la aplicación si el portal estuviera caído. El caso automático
 *   —que sí exige la integración— lo cubre el guard sobre el subárbol privado. Muestra además el
 *   destino exacto al que se va a salir, para diagnóstico en despliegues mal configurados.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import {
  buildCentralAuthPortalUrl,
  redirectToCentralAuthPortal,
} from "../config/authRuntimeConfig";

const CentralAuthRedirectPage = () => {
  const portalUrl = buildCentralAuthPortalUrl();

  return (
    <div className="app-central-auth flex min-h-screen items-center justify-center bg-base-200 px-4">
      <div className="app-central-auth-card card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <h1 className="card-title">Gestión de Ejecución</h1>
          <p className="text-base-content/80">
            El acceso a este módulo se gestiona en el sistema de autenticación
            central de la AMC. Continúa para identificarte y volver aquí con tu
            sesión iniciada.
          </p>
          <div className="card-actions mt-4">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => redirectToCentralAuthPortal()}
            >
              Ingresar
            </button>
          </div>
          <p className="app-central-auth-target mt-4 break-all text-xs text-base-content/60">
            Destino: {portalUrl}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CentralAuthRedirectPage;
