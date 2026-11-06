/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Borrador de providencia guardado en el servidor (quick 261006-el5)
 * Archivo: useAutoguardadoBorrador.ts
 * Responsabilidad: El MOTOR del autoguardado: decide cuándo se escribe el borrador en el servidor y
 *   expone su estado y los controles que usan el compositor y la página. No pinta nada y no lee el
 *   borrador (la lectura la hace el compositor junto con los tipos, DP-8).
 *
 *   D-01 — viaja SOLO el cuerpo (HTML del editor) y el tipo.
 *   D-03 — se guarda solo, RETARDO_AUTOGUARDADO_MS después del último cambio (DP-10: 2 s, separado
 *     del 1,5 s de la vista previa, porque cada guardado es una ESCRITURA). Guardar no bloquea el
 *     editor; un fallo se expone como estado, nunca como modal, y se reintenta con el siguiente
 *     cambio (no en bucle con el mismo contenido).
 *   DP-7 — un borrador existe si y solo si el cuerpo tiene texto real (`tieneContenido`). Vaciar el
 *     editor con borrador en el servidor es un DELETE, no un PUT vacío; un tipo sin cuerpo no se
 *     guarda.
 *
 *   ── CÓMO FUNCIONA ──────────────────────────────────────────────────────────────────────────
 *   Todo se compara por FIRMA: `null` si no hay cuerpo con texto, y si no la serialización de
 *   `[tipo, cuerpo]`. La firma del servidor la fija `armar(base)` y la actualiza cada escritura con
 *   la de lo ENVIADO. Si la firma actual difiere de la del servidor hay algo pendiente.
 *
 *   🔴 El cuerpo de los efectos NO llama a ningún setter (regla `set-state-in-effect` de
 *   react-hooks 7): los `setState` viven en el callback del temporizador y en las continuaciones
 *   de las promesas. Y el estado se deriva en el render de estado React, nunca de refs.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-06
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { tieneContenido } from "../config/providenciaComposicion";
import {
  ProvidenciaService,
  type BorradorProvidencia,
} from "../services/ProvidenciaService";

/** Cuánto se espera tras el último cambio antes de escribir (DP-10). */
export const RETARDO_AUTOGUARDADO_MS = 2000;

export type EstadoAutoguardado =
  | "inactivo"
  | "al-dia"
  | "pendiente"
  | "guardando"
  | "error";

export interface AutoguardadoBorrador {
  /** Derivado: inactivo (sin armar) / guardando / error / pendiente / al-dia. */
  estado: EstadoAutoguardado;
  /** ISO del último guardado en el servidor (o del borrador recuperado). */
  guardadoAt: string | null;
  /** Mensaje del último fallo; se limpia con la siguiente escritura buena. */
  error: string | null;
  hayBorradorEnServidor: boolean;
  /** Fija lo que hay en el servidor (`null` = nada) y enciende el motor. */
  armar: (base: BorradorProvidencia | null) => void;
  /** Escribe YA lo pendiente. `true` si queda al día (o si no está armado), `false` si falla. */
  guardarYa: () => Promise<boolean>;
  /** Detiene el motor y espera la escritura en vuelo (tragándose su error). */
  pausar: () => Promise<void>;
  reanudar: () => void;
  /** Pausa, borra en el servidor y SE QUEDA PAUSADO: quien llama vacía el contenido y reanuda. */
  descartar: () => Promise<void>;
}

export interface EntradaAutoguardado {
  /** `null` ⇒ el motor es inerte (el modal heredado, DP-16). */
  eejeId: number | null;
  cuerpo: string;
  tipoCodigo: string;
}

/** «06-10 a las 14:32», para el aviso de recuperación (D-04). */
export function rotuloRecuperacion(iso: string): string {
  return format(new Date(iso), "dd-MM 'a las' HH:mm");
}

/** «14:32», para «Borrador guardado a las…». */
export function horaDeGuardado(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

/** La firma de un par tipo/cuerpo, tenga o no texto. */
function firmaCruda(cuerpo: string, tipoCodigo: string | null): string {
  return JSON.stringify([tipoCodigo || null, cuerpo]);
}

/** La firma de lo que se GUARDARÍA: `null` si el cuerpo no tiene texto real (DP-7). */
function firmaDe(cuerpo: string, tipoCodigo: string | null): string | null {
  return tieneContenido(cuerpo) ? firmaCruda(cuerpo, tipoCodigo) : null;
}

interface Instantanea {
  eejeId: number | null;
  cuerpo: string;
  tipoCodigo: string | null;
  firma: string | null;
}

/** Último fallo: la firma que no se pudo escribir (puede ser `null`: un DELETE que falló). */
interface Fallo {
  firma: string | null;
}

const mensajeDe = (err: unknown): string =>
  mensajeParaUsuario(err, "error desconocido");

export function useAutoguardadoBorrador({
  eejeId,
  cuerpo,
  tipoCodigo,
}: EntradaAutoguardado): AutoguardadoBorrador {
  const [armado, setArmado] = useState(false);
  const [firmaServidor, setFirmaServidor] = useState<string | null>(null);
  const [fallo, setFallo] = useState<Fallo | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoAt, setGuardadoAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reanudaciones, setReanudaciones] = useState(0);

  // Espejos para la LÓGICA de los callbacks (que pueden correr entre renders). El render no los lee.
  const armadoRef = useRef(false);
  const servidorRef = useRef<string | null>(null);
  const pausadoRef = useRef(false);
  const montadoRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enVueloRef = useRef<Promise<boolean> | null>(null);
  const instantaneaRef = useRef<Instantanea>({
    eejeId: null,
    cuerpo: "",
    tipoCodigo: null,
    firma: null,
  });

  const firmaActual = firmaDe(cuerpo, tipoCodigo);
  const activo = armado && eejeId != null;
  const falloActual = fallo !== null && fallo.firma === firmaActual;

  // La instantánea de lo que se escribiría. Se actualiza tras cada render.
  useEffect(() => {
    instantaneaRef.current = {
      eejeId,
      cuerpo,
      tipoCodigo: tipoCodigo || null,
      firma: firmaActual,
    };
  });

  const limpiarTemporizador = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** UNA escritura de la instantánea actual. Nunca rechaza: resuelve `true`/`false`. */
  const escribir = useCallback((): Promise<boolean> => {
    const snap = instantaneaRef.current;
    const id = snap.eejeId;
    if (id == null) return Promise.resolve(true);
    const firma = snap.firma;
    setGuardando(true);
    const promesa = (async () => {
      try {
        let actualizadoAt: string | null = null;
        if (firma === null) {
          // DP-7: sin texto no hay borrador. Si el servidor tenía uno, se borra.
          await ProvidenciaService.descartarBorrador(id);
        } else {
          const guardado = await ProvidenciaService.guardarBorrador(id, {
            cuerpo: snap.cuerpo,
            tipoCodigo: snap.tipoCodigo,
          });
          actualizadoAt = guardado?.actualizadoAt ?? null;
        }
        // La firma del servidor pasa a la de lo ENVIADO, no a la de la respuesta.
        servidorRef.current = firma;
        if (montadoRef.current) {
          setFirmaServidor(firma);
          setGuardadoAt(actualizadoAt);
          setError(null);
          setFallo(null);
        }
        return true;
      } catch (err) {
        if (montadoRef.current) {
          setFallo({ firma });
          setError(mensajeDe(err));
        }
        return false;
      } finally {
        enVueloRef.current = null;
        if (montadoRef.current) setGuardando(false);
      }
    })();
    enVueloRef.current = promesa;
    return promesa;
  }, []);

  // El temporizador: UNO a la vez, y se limpia en el cleanup — eso es la coalescencia.
  useEffect(() => {
    if (!activo || pausadoRef.current || guardando) return;
    if (firmaActual === firmaServidor || falloActual) return;
    const t = setTimeout(() => {
      timerRef.current = null;
      if (pausadoRef.current || enVueloRef.current) return;
      void escribir();
    }, RETARDO_AUTOGUARDADO_MS);
    timerRef.current = t;
    return () => {
      clearTimeout(t);
      if (timerRef.current === t) timerRef.current = null;
    };
  }, [
    activo,
    firmaActual,
    firmaServidor,
    falloActual,
    guardando,
    reanudaciones,
    escribir,
  ]);

  // Montaje y desmontaje. 🔴 StrictMode: la marca se pone en el CUERPO del efecto y se quita en su
  // cleanup, así que el doble montaje de desarrollo la deja bien.
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Al irse con algo pendiente, se dispara la escritura SIN esperar y sin tocar estado.
      const snap = instantaneaRef.current;
      if (
        !armadoRef.current ||
        pausadoRef.current ||
        snap.eejeId == null ||
        snap.firma === servidorRef.current
      ) {
        return;
      }
      const escritura =
        snap.firma === null
          ? ProvidenciaService.descartarBorrador(snap.eejeId)
          : ProvidenciaService.guardarBorrador(snap.eejeId, {
              cuerpo: snap.cuerpo,
              tipoCodigo: snap.tipoCodigo,
            });
      void escritura.catch(() => undefined);
    };
  }, []);

  const armar = useCallback((base: BorradorProvidencia | null) => {
    const f = base ? firmaCruda(base.cuerpo, base.tipoCodigo) : null;
    servidorRef.current = f;
    armadoRef.current = true;
    setFirmaServidor(f);
    setGuardadoAt(base?.actualizadoAt ?? null);
    setArmado(true);
  }, []);

  const guardarYa = useCallback(async (): Promise<boolean> => {
    limpiarTemporizador();
    if (enVueloRef.current) await enVueloRef.current;
    const snap = instantaneaRef.current;
    if (!armadoRef.current || snap.eejeId == null) return true;
    if (snap.firma === servidorRef.current) return true;
    return escribir();
  }, [escribir, limpiarTemporizador]);

  const pausar = useCallback(async (): Promise<void> => {
    pausadoRef.current = true;
    limpiarTemporizador();
    if (enVueloRef.current) await enVueloRef.current;
  }, [limpiarTemporizador]);

  const reanudar = useCallback(() => {
    pausadoRef.current = false;
    setReanudaciones((n) => n + 1);
  }, []);

  const descartar = useCallback(async (): Promise<void> => {
    await pausar();
    const id = instantaneaRef.current.eejeId;
    if (id == null) return;
    // Si el DELETE lanza, se propaga: quien llama lo cuenta y reanuda.
    await ProvidenciaService.descartarBorrador(id);
    servidorRef.current = null;
    if (montadoRef.current) {
      setFirmaServidor(null);
      setGuardadoAt(null);
      setError(null);
      setFallo(null);
    }
  }, [pausar]);

  let estado: EstadoAutoguardado;
  if (!activo) estado = "inactivo";
  else if (guardando) estado = "guardando";
  else if (falloActual) estado = "error";
  else if (firmaActual !== firmaServidor) estado = "pendiente";
  else estado = "al-dia";

  return {
    estado,
    guardadoAt,
    error,
    hayBorradorEnServidor: firmaServidor !== null,
    armar,
    guardarYa,
    pausar,
    reanudar,
    descartar,
  };
}
