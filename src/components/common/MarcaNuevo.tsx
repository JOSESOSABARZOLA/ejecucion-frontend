/**
 * Microservicio: ejecucion
 * Módulo: Expediente (compartido)
 * Feature: Documentos nuevos sin leer, por usuario (quick 261030-m29)
 * Archivo: MarcaNuevo.tsx
 * Responsabilidad: La insignia «Nuevo» de un documento que el usuario de la sesión todavía no ha
 *   abierto. Una sola pieza para las tres listas (la del decisor, la de otros módulos y el acordeón
 *   del triage), para que se vea y se anuncie igual en todas.
 *
 *   `role="img"` es lo que hace válido el `aria-label` en un `<span>` (un genérico no admite
 *   nombre): el lector anuncia «Documento nuevo sin leer» y no la palabra suelta. Va SIEMPRE fuera
 *   del botón del documento, para no cambiar el nombre accesible de ese botón.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-04
 */

export const ETIQUETA_MARCA_NUEVO = "Documento nuevo sin leer";

const MarcaNuevo = () => (
  <span
    role="img"
    aria-label={ETIQUETA_MARCA_NUEVO}
    title={ETIQUETA_MARCA_NUEVO}
    className="badge badge-accent badge-xs shrink-0"
  >
    Nuevo
  </span>
);

export default MarcaNuevo;
