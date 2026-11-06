/**
 * Microservicio: ejecucion
 * Módulo: Jerarquía de usuarios (DME)
 * Feature: Panel de administración de la jerarquía (quick 261002-lds)
 * Archivo: JerarquiaService.ts
 * Responsabilidad: Consumir /jerarquia del backend.
 *
 *   🔴 LOS TRES ENDPOINTS SON EXCLUSIVOS DEL ADMINISTRADOR, también la LECTURA: el listado trae a
 *   toda la plantilla con nombre, correo y rol. Quien autoriza es el `@Roles('administrador')` de
 *   clase del `JerarquiaController`; el grant del menú solo decide quién VE la entrada en el
 *   sidebar, y `RutaProtegida` solo evita que alguien teclee la ruta a mano. Ninguno de los dos
 *   autoriza nada.
 *
 *   El ACTOR de cada cambio lo deriva el backend del JWT: nunca viaja en el cuerpo. Por eso
 *   `asignarSuperior` manda UN solo campo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-02
 */
import httpClient from "../api/httpClient";

/**
 * Una persona en el panel. Espejo de `UsuarioJerarquiaDto` del backend.
 *
 * 🔴 `declarado` Y `superiorId: null` NO SON LO MISMO, y la distinción es el corazón de la
 * pantalla:
 *   · `declarado: false` → **no hay fila** en `t_jerarquia_usuario`. Es el estado con el que la
 *     semilla mínima deja a decisores y delegados. Su superior no lo ve en el Tablero y, si esa
 *     persona tuviera gente a cargo, su propio Tablero sale vacío.
 *   · `declarado: true` con `superiorId: null` → **declarado como RAÍZ**: está dicho que no depende
 *     de nadie. Es el estado del director raíz y el del administrador.
 */
export interface UsuarioJerarquia {
  usuarioId: number;
  nombre: string;
  correo: string;
  rolId: number;
  /** La etiqueta corta del rol (`rol_label`): «Director», «Decisor»… */
  rol: string;
  superiorId: number | null;
  superiorNombre?: string;
  declarado: boolean;
}

export const JerarquiaService = {
  /** Todos los usuarios con su rol y su superior, incluidos los que aún no están declarados. */
  async listar(): Promise<UsuarioJerarquia[]> {
    const { data } = await httpClient.get<UsuarioJerarquia[]>(
      "/jerarquia/usuarios",
    );
    return data;
  },

  /**
   * Declara de quién depende un usuario.
   *
   * ⚠️ Cambia, en el acto, quién ve los indicadores de desempeño de esa persona en el Tablero.
   * Las invariantes (nadie es su propio superior, nada de ciclos) las impone el backend: el filtro
   * del desplegable de la pantalla es conveniencia, no autoridad.
   */
  async asignarSuperior(
    usuarioId: number,
    superiorId: number,
  ): Promise<UsuarioJerarquia> {
    const { data } = await httpClient.put<UsuarioJerarquia>(
      `/jerarquia/usuarios/${usuarioId}/superior`,
      { superiorId },
    );
    return data;
  },

  /**
   * Quita el superior: la persona queda declarada como **RAÍZ**, no vuelve a «sin declarar».
   * La fila se conserva (el panel declara, no desdeclara).
   */
  async quitarSuperior(usuarioId: number): Promise<UsuarioJerarquia> {
    const { data } = await httpClient.delete<UsuarioJerarquia>(
      `/jerarquia/usuarios/${usuarioId}/superior`,
    );
    return data;
  },
};

export default JerarquiaService;
