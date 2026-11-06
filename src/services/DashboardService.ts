/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/dashboard (frontend)
 * Feature: Indicadores de gestión con alcance por rol
 * Archivo: DashboardService.ts
 * Responsabilidad: Consumir `GET /dashboard`. Una ruta, sin parámetros.
 *
 *   🔴 NO SE LE MANDA EL USUARIO, Y ES A PROPÓSITO. El alcance lo resuelve el servidor con el
 *   `usu_id` y los roles del JWT. Si el usuario viajara en la query, cualquier decisor podría pedir
 *   el tablero de otro y todo el alcance por rol valdría cero: la autorización dejaría de estar en
 *   el servidor y pasaría a depender de que esta pantalla mande el número correcto.
 *
 *   🔴 LOS ESTADOS LLEGAN CRUDOS. El servidor devuelve `EN_VERIFICACION_PAGO`, no «En verificación
 *   de pago»: la etiqueta y el color son de `config/estadosEpas.ts`, que es la fuente única del
 *   módulo. Que el backend no traduzca es la decisión, no un olvido — dos vocabularios en dos
 *   repos es exactamente el agujero del backlog 999.1.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-02
 */
import httpClient from "../api/httpClient";

/** Los cuatro roles que tienen tablero. El delegado no, y el servidor le responde 403. */
export type RolConTablero =
  | "funcionario decisor"
  | "secretario abogado"
  | "director"
  | "administrador";

export interface ConteoPorEstado {
  /** Valor CRUDO del enum del backend. Se traduce con `etiquetaEstadoEpas`. */
  estado: string;
  total: number;
}

export interface CargaPorPersona {
  usuarioId: number;
  nombre: string;
  rol: string;
  /** `true` si su rol lleva expedientes. Separa la tabla de carga de la de actividad. */
  llevaExpedientes: boolean;
  expedientesActivos: number;
  /**
   * Qué parte del trabajo REPARTIDO del alcance concentra esta persona (0-100).
   *
   * ⚠️ No es un porcentaje de capacidad: en Ejecución no hay ningún cupo declarado por decisor. Es
   * concentración, y con un alcance de una sola persona no dice nada (siempre 100), así que la
   * pantalla lo oculta cuando `alcance.personas === 1`.
   */
  concentracionPorcentaje: number;
  /** Expedientes suyos cuyo plazo de aceptación del sorteo venció sin que los aceptara. */
  aceptacionVencida: number;
  /** Actos suyos en la bitácora en los últimos 30 días. Lo único medible de quien no lleva EPAS. */
  actosUltimos30Dias: number;
  esUsuarioActual?: boolean;
}

export interface ConteoPlazos {
  aceptacionVencida: number;
  aceptacionEnPlazo: number;
  /** EPAS en `EN_TRABAJO_COMUNITARIO`. Es un hecho del estado, no un vencimiento. */
  trabajoComunitarioEnCurso: number;
}

export interface ConteoExcusa {
  causal: string;
  total: number;
}

export interface Tablero {
  alcance: {
    rol: RolConTablero;
    personas: number;
    /** `true` para el administrador: tiene tablero, pero no de expedientes. */
    sinExpedientesPorRol: boolean;
  };
  totales: {
    expedientes: number;
    activos: number;
    archivados: number;
    devueltos: number;
    /** Activos sin decisor. Solo lo reciben los roles que reparten. */
    sinAsignar: number;
  };
  porEstado: ConteoPorEstado[];
  carga: CargaPorPersona[];
  plazos: ConteoPlazos;
  excusas: ConteoExcusa[];
}

export const DashboardService = {
  /** El tablero del usuario de la sesión, con su alcance ya aplicado por el servidor. */
  async obtener(): Promise<Tablero> {
    const { data } = await httpClient.get<Tablero>("/dashboard");
    return data;
  },
};
