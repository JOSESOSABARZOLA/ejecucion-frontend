/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/plantillas (frontend)
 * Feature: Lectura de plantillas de documento (Quick 260916-kwg, D-05)
 * Archivo: PlantillaService.ts
 * Responsabilidad: Consumir `GET /plantillas/:clave` — el texto que precarga un editor.
 *
 *   Existe para que la DAJ pueda corregir la redacción de un acto administrativo sin desplegar: el
 *   texto vive en `t_plantilla_documento`, no en una constante de este repositorio. Si alguien se
 *   ve tentado de «simplificar» esto metiendo el HTML en un `const` del frontend, eso es
 *   exactamente lo que D-05 vino a evitar.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-16
 */
import httpClient from "../api/httpClient";

/** Espeja `PlantillaDocumentoDto` del backend. */
export interface PlantillaDocumento {
  /** Identidad estable: ESCRITO_EXCUSA, PROVIDENCIA_EXCUSA… */
  clave: string;
  nombre: string;
  /**
   * 🔴 `null` NO es «no hay plantilla»: es «la plantilla existe y todavía no tiene texto», y
   * significa que el editor arranca en blanco. «No hay plantilla» es un 404, que propaga como error.
   */
  html: string | null;
  activo: boolean;
}

export const PlantillaService = {
  /**
   * La plantilla vigente de esa clave.
   *
   * 🔴 UN FALLO PROPAGA, no se traduce a `null`. Quien decide qué hacer sin plantilla es la pantalla,
   * y en el modal de excusa esa decisión es deliberada: avisar, abrir el editor en blanco y **dejar
   * enviar igual**. Devolver `null` en silencio le quitaría a la pantalla la información que
   * necesita para distinguir «vacía a propósito» de «el backend no respondió».
   *
   * @param clave `plan_clave` de la plantilla.
   */
  async leer(clave: string): Promise<PlantillaDocumento> {
    const { data } = await httpClient.get<PlantillaDocumento>(
      `/plantillas/${clave}`,
    );
    return data;
  },
};
