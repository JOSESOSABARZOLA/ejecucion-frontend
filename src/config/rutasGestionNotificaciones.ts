/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: La ruta del Gestor de Notificaciones (Fase 03.20, Plan 07)
 * Archivo: rutasGestionNotificaciones.ts
 * Responsabilidad: Ser el ÚNICO sitio donde se escribe la ruta del Gestor, para que `routes.tsx`,
 *   `navigation.ts` y la prueba de topología no puedan discrepar.
 *
 *   ── 🔴 POR QUÉ UNA CONSTANTE Y NO LA CADENA SUELTA EN CADA SITIO ─────────────────────────────
 *   La ruta tiene que ser, letra por letra, el `subm_path` que la migración
 *   `2026-09-25-menu-gestion-notificaciones.sql` siembra en `t_submenus` (fila 10, bajo el módulo 5
 *   «Seguimiento y Control»). **El menú lateral NO sale de este repositorio**: lo construye
 *   `usu_get_user` en la base con lo sembrado, y el sidebar navega a ese `subm_path`. Si la ruta
 *   registrada aquí y la sembrada allí se separan UNA LETRA, el menú aparece y su enlace cae en el
 *   comodín `*` de `routes.tsx` — es decir, la pantalla **existe, se ve, y al pulsarla devuelve al
 *   usuario a la raíz**, sin que nada parezca haber fallado: ni el compilador ni la suite dirían una
 *   palabra. Un solo literal por ruta hace que ese error sólo pueda ocurrir en el diff de este
 *   archivo contra el de la migración, que es un diff de dos líneas.
 *
 *   Es el mismo molde de `rutasObligacionHacer.ts` y por la misma razón medida.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-28
 */

/**
 * La ruta HIJA de `/home` del Gestor de Notificaciones, tal y como la registra `routes.tsx`. Sin la
 * barra inicial: es un hijo del subárbol privado, que es donde vive el `AuthGuard`.
 */
export const RUTA_GESTION_NOTIFICACIONES_HIJA = "gestion-notificaciones";

/**
 * La misma ruta, ABSOLUTA. **Este valor es el que la migración siembra en `subm_path`**
 * (`/home/gestion-notificaciones`), y el que `menuRoutes.test.ts` exige encontrar registrado como
 * hija de `/home`.
 */
export const RUTA_GESTION_NOTIFICACIONES = `/home/${RUTA_GESTION_NOTIFICACIONES_HIJA}`;
