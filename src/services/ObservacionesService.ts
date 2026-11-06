/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/epas (frontend)
 * Feature: Observaciones por campo y por documento del expediente
 * Archivo: ObservacionesService.ts
 * Responsabilidad: Leer y guardar las observaciones de un expediente contra
 *   `GET/PUT /epas/:id/observaciones`. El interceptor de httpClient inyecta el Authorization: Bearer
 *   desde localStorage.authToken; no se cablean headers por llamada.
 *
 *   🔴 UN SOLO MÉTODO DE ESCRITURA, porque el backend expone un solo camino de escritura. `guardar`
 *   manda el conjunto ENTERO y el servidor reconcilia: borra lo que ya no viene, inserta lo que falta
 *   y corrige lo que cambió. Partirlo en alta/baja/edición aquí daría tres llamadas que pueden fallar
 *   por separado y dejar la base diciendo algo que la pantalla no muestra.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-18
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-01)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261029-kl0: `guardar` devuelve también si la
 *   remisión al secretario se retiró —el expediente volvió al director—; `quedanObservacionesVivas`)
 */
import httpClient from "../api/httpClient";
import type {
  IObservacion,
  IRevisionObservacion,
} from "../interfaces/ICaseObservations";

/** Lo que devuelve la revisión del director: cómo quedaron, y si la devolución se cayó. */
export interface RevisionResult {
  observaciones: IObservacion[];
  /**
   * 🔴 true ⇒ el expediente SALIÓ de la devolución y volvió a la Bandeja de Entrada: el director
   * rechazó todas las observaciones que la motivaban. La pantalla tiene que decirlo — si no, el
   * usuario ve desaparecer la fila de la bandeja y no sabe adónde fue.
   */
  revertido: boolean;
}

/**
 * Lo que devuelve GUARDAR (quick 261029-kl0): cómo quedaron las observaciones y si el servidor
 * RETIRÓ LA REMISIÓN al secretario.
 */
export interface GuardadoObservaciones {
  observaciones: IObservacion[];
  /**
   * 🔴 true ⇒ el expediente estaba remitido al secretario y sin sortear, y la observación lo dejó
   * retenido: el servidor deshizo la remisión en la misma transacción y el expediente volvió al
   * DIRECTOR «Por devolver». El secretario deja de verlo; la pantalla tiene que decírselo.
   */
  remisionRetirada: boolean;
}

/**
 * ¿Queda alguna observación VIVA que retenga el expediente? (quick 261029-kl0). Espeja la retención
 * del servidor (`retenidoDeRemisionExists` = observación que devuelve ∪ por verificar): una
 * observación no RECHAZADA que es nueva, o de la devolución anterior aún por verificar o no cumplida.
 * Una anterior sin `verificacion` cuenta como por verificar, con el criterio de `contarVerificaciones`.
 *
 * Sirve para PINTAR (decir al director que el expediente puede remitirse de nuevo); quien decide es
 * el servidor, que vuelve a mirar la base al remitir.
 *
 * @param lista La lista ENTERA de observaciones del expediente (anteriores y nuevas).
 * @returns true si alguna sigue reteniendo el expediente.
 */
export const quedanObservacionesVivas = (lista: IObservacion[]): boolean =>
  lista.some((o) => {
    if (o.estado === "RECHAZADA") return false;
    if (o.deDevolucionAnterior !== true) return true;
    const verificacion = o.verificacion ?? "POR_VERIFICAR";
    return verificacion === "POR_VERIFICAR" || verificacion === "NO_CUMPLIDA";
  });

export const ObservacionesService = {
  /**
   * Observaciones guardadas del expediente, en el orden en que se anotaron.
   *
   * @param eejeId eeje_id del EPAS.
   * @returns La lista; vacía si el expediente no tiene ninguna.
   */
  async listar(eejeId: number): Promise<IObservacion[]> {
    const { data } = await httpClient.get<IObservacion[]>(
      `/epas/${eejeId}/observaciones`,
    );
    return Array.isArray(data) ? data : [];
  },

  /**
   * Guarda el CONJUNTO COMPLETO. Una lista vacía es un borrado total, y es legítimo: significa que
   * ya no hay nada que corregir.
   *
   * La VENTANA de edición la impone el backend —se puede corregir hasta que el expediente se
   * despacha en su lote de devolución, y no después—; aquí no se replica, para no tener dos
   * versiones de la misma regla que puedan divergir.
   *
   * ⟳ 2026-10-29 (quick 261029-kl0): el servidor responde `{ observaciones, remisionRetirada }`.
   * Se TOLERA la respuesta array del servidor anterior (se despliegan juntos, pero la pantalla no se
   * rompe si llega el orden inverso): entonces `remisionRetirada` es false.
   *
   * @param eejeId eeje_id del EPAS.
   * @param observaciones El conjunto entero que la ficha está mostrando.
   * @returns Las observaciones tal y como quedaron en el servidor (con su `obseId` ya asignado) y si
   *   la remisión al secretario se retiró.
   */
  async guardar(
    eejeId: number,
    observaciones: IObservacion[],
  ): Promise<GuardadoObservaciones> {
    const { data } = await httpClient.put<
      GuardadoObservaciones | IObservacion[]
    >(
      `/epas/${eejeId}/observaciones`,
      {
        // Se manda SOLO lo que el DTO del backend admite: su ValidationPipe va con
        // `forbidNonWhitelisted`, así que colar `obseId` o la autoría devolvería un 400.
        observaciones: observaciones.map((o) => ({
          tipo: o.tipo,
          clave: o.clave,
          etiqueta: o.etiqueta,
          texto: o.texto,
        })),
      },
    );
    if (Array.isArray(data)) {
      return { observaciones: data, remisionRetirada: false };
    }
    return {
      observaciones: Array.isArray(data?.observaciones)
        ? data.observaciones
        : [],
      remisionRetirada: data?.remisionRetirada === true,
    };
  },

  /**
   * LA REVISIÓN DEL DIRECTOR (2026-09-18): aprueba o rechaza, una por una.
   *
   * 🔴 VA POR `obseId` y NO por objetivo, al revés que `guardar`. La diferencia es de quién manda:
   * al guardar, el cliente DESCRIBE el conjunto que quiere; al revisar, el director se pronuncia
   * sobre filas que ya existen y que acaba de leer. Un veredicto que «cree» la observación que
   * aprueba no sería un veredicto.
   *
   * No hace falta mandarlas todas: lo que no viaje sigue PENDIENTE, que es cierto — y es lo que
   * mantiene el expediente bloqueado hasta que el director acabe.
   *
   * @param eejeId eeje_id del EPAS.
   * @param revisiones Los veredictos de este gesto.
   * @returns Las observaciones como quedaron + si la devolución se revirtió.
   */
  async revisar(
    eejeId: number,
    revisiones: IRevisionObservacion[],
  ): Promise<RevisionResult> {
    const { data } = await httpClient.patch<RevisionResult>(
      `/epas/${eejeId}/observaciones/revision`,
      {
        // Solo lo que el DTO admite: su ValidationPipe va con `forbidNonWhitelisted`, y el motivo
        // se omite —no se manda vacío— en la aprobación, porque ahí el servidor lo rechaza.
        revisiones: revisiones.map((r) =>
          r.estado === "RECHAZADA"
            ? {
                obseId: r.obseId,
                estado: r.estado,
                motivoRechazo: r.motivoRechazo,
              }
            : { obseId: r.obseId, estado: r.estado },
        ),
      },
    );
    return {
      observaciones: Array.isArray(data?.observaciones)
        ? data.observaciones
        : [],
      revertido: data?.revertido === true,
    };
  },

  /**
   * LA VERIFICACIÓN DEL DIRECTOR (Fase 03.24, G-01): ¿cumplió la DMR la observación de la
   * devolución anterior? Una por llamada, como `revisar`, y por `obseId`, que va en la ruta.
   *
   * La regla —quién puede, hasta cuándo y qué le pasa al expediente— la aplica el servidor; aquí no
   * se replica. Un fallo se propaga para que la ficha enseñe el mensaje del servidor.
   *
   * @param eejeId eeje_id del EPAS.
   * @param obseId La observación de la devolución anterior que se verifica.
   * @param verificacion `CUMPLIDA` o `NO_CUMPLIDA`; `POR_VERIFICAR` no es una verificación.
   * @returns La lista ENTERA de observaciones del expediente tal y como quedó.
   */
  async verificar(
    eejeId: number,
    obseId: number,
    verificacion: "CUMPLIDA" | "NO_CUMPLIDA",
  ): Promise<IObservacion[]> {
    const { data } = await httpClient.patch<{ observaciones: IObservacion[] }>(
      `/epas/${eejeId}/observaciones/${obseId}/verificacion`,
      // Solo lo que el DTO admite: su ValidationPipe va con `forbidNonWhitelisted`.
      { verificacion },
    );
    return Array.isArray(data?.observaciones) ? data.observaciones : [];
  },
};

export default ObservacionesService;
