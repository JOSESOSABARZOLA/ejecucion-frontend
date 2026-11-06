/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Página del modulo de documentos generados
 * Archivo: DocumentationPage.tsx
 * Responsabilidad: Presentar la interfaz del modulo de Documentos Generados
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 */

import { useState } from "react";
import { useUser } from "../context/UserContext";
import HeaderPage from "../components/common/HeaderPage";
import TableByDocumentType from "../components/documentation/TableByDocumentType";
import type { UserActions } from "../interfaces/IUser";
import type { IDocumentType } from "../interfaces/IDocument";

export const CONTEXT_PAGE_ACTIONS = "page" as const;

const DocumentationPage = () => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<IDocumentType>(
    "provideProvidence",
  );

  if (!user) {
    return null;
  }

  const { actividades } = user;

  const pageOptions = actividades
    .filter(
      (act: UserActions) =>
        act.actiContext === CONTEXT_PAGE_ACTIONS && act.submId === 14,
    )
    .map((act: UserActions) => ({
      ...act,
      actiIsDisabled: false,
    }));

  return (
    <div className="app-data-container">
      <HeaderPage
        headerKicker="Seguimiento y Control / Documentos Generados"
        title="Documentos Generados"
        subtitle="Gestiona y revisa los documentos generados en tus expedientes"
        options={pageOptions}
        onOptionClick={() => {}}
      />

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="app-section-heading text-sm font-semibold uppercase tracking-[0.18em] text-primary/95">
            Bandeja de documentos
          </h2>
        </div>
        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          <div className="app-modules-tabs-container border-b border-transparent">
            <div className="flex">
              <button
                type="button"
                onClick={() => setActiveTab("provideProvidence")}
                className={`app-modules-tab-label ${
                  activeTab === "provideProvidence" ? "active" : ""
                }`}
              >
                Providencias
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("provideResolve")}
                className={`app-modules-tab-label ${
                  activeTab === "provideResolve" ? "active" : ""
                }`}
              >
                Resoluciones
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("provideNotification")}
                className={`app-modules-tab-label ${
                  activeTab === "provideNotification" ? "active" : ""
                }`}
              >
                Notificaciones
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("provideMemorando")}
                className={`app-modules-tab-label ${
                  activeTab === "provideMemorando" ? "active" : ""
                }`}
              >
                Memorandos
              </button>
            </div>
          </div>

          <div className="app-modules-tab-content">
            {/* <div className="app-data-panel-body pb-4 pt-2 md:px-4"> */}
              <TableByDocumentType
                key={activeTab}
                documentType={activeTab}
              />
            {/* </div> */}
          </div>
        </div>
      </section>
    </div>
  );

};



export default DocumentationPage;

