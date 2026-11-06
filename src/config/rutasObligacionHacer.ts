/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La ruta de la rama del correctivo (Fase 03.18, Plan 07)
 * Archivo: rutasObligacionHacer.ts
 * Responsabilidad: Ser el ÚNICO sitio donde se escribe la ruta del correctivo, para que `routes.tsx`
 *   y quien navegue desde otra pantalla no puedan discrepar.
 *
 *   ⚠️ Hasta el 2026-10-08 vivía aquí también la ruta de la bandeja de solicitudes de sello de
 *   clausura (`/home/solicitudes-sello`), atada letra por letra al `subm_path` sembrado. Se retiró
 *   por pedido del área junto con su grant
 *   (`ejecucion-db/migrations/2026-10-08-retiro-menu-solicitudes-sello.sql`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 */

/**
 * La ruta hija de la página del correctivo, CON su parámetro de expediente.
 *
 * 🔴 NO TIENE SUBMENÚ y no lo va a tener: exige un expediente concreto, así que una entrada de menú
 * apuntando aquí sería una entrada que no se puede pulsar. Se llega desde la bandeja del decisor.
 */
export const RUTA_OBLIGACION_HACER_HIJA = "obligacion-hacer/:eejeId";

/** A dónde navegar para abrir el correctivo de UN expediente. */
export const RUTA_OBLIGACION_HACER = (eejeId: number | string): string =>
  `/home/obligacion-hacer/${eejeId}`;
