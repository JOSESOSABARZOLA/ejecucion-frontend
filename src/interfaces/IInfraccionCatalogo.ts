/**
 * Microservicio: ejecucion
 * Módulo: interfaces
 * Feature: Buscador flotante de infracciones
 * Archivo: IInfraccionCatalogo.ts
 * Responsabilidad: Forma de una infracción del catálogo tal como la sirve `GET /infracciones/catalogo`:
 *   el catálogo es el de CORE (consultado por el backend) con los nombres de materia y submateria de
 *   Sorteo por su ssubId. Copia palabra por palabra de `InfraccionCatalogo` de
 *   `ejecucion-backend — infracciones/interfaces/catalogos-externos.interface.ts`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-16
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: fuera la copia local del CAT v1.3; la
 *   forma es la del catálogo de CORE vía backend, con ids y nombres de Sorteo y «sin materia»)
 */

export interface IInfraccionCatalogo {
  /** Código único, p. ej. `LIC-LU-X-124-1947A-02`. */
  codigo: string;
  /** Tipificación de CORE; `null` si CORE no la trae. */
  infraccion: string | null;
  /** Sanción de CORE, p. ej. `4 RBU`. */
  sancion: string | null;
  categoria: string | null;
  norma: string | null;
  /** subId de Sorteo; `null` = sin materia. */
  materiaId: number | null;
  /** id de la submateria de Sorteo (= ssubId de CORE); `null` = sin materia. */
  submateriaId: number | null;
  /** Nombre de la materia en Sorteo; `null` = sin materia. */
  materia: string | null;
  /** Nombre de la submateria en Sorteo; `null` = sin materia. */
  submateria: string | null;
  /** `true` si su ssubId no existe en Sorteo (o CORE no lo trae). */
  sinMateria: boolean;
}
