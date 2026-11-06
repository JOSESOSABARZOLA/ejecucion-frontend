/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Basarse en un documento anterior (Fase 03.19, Plan 15 · D-04)
 * Archivo: useSimilarDocuments.ts
 * Responsabilidad: Sostener la lista de providencias anteriores de la misma clase, paginada de
 *   diez en diez, y sus cuatro estados — cargando, vacío, con resultados y averiado.
 *
 *   Se copió la FORMA del hook homónimo de la rama de Resolución (estado acumulado, `cargarMas`,
 *   `hayMas`); el cuerpo está reescrito contra nuestro servicio y con tres reglas que aquél no
 *   tiene.
 *
 *   ── 1. LA PRIMERA CARGA OCURRE AL DESPLEGAR, NO AL MONTAR ───────────────────────────────────
 *   La sección nace PLEGADA (UI-SPEC §4.5). Pedir por adelantado sería una petición por cada
 *   apertura de la página de generación, para una lista que la mayoría de las veces nadie abre —y
 *   que hoy, además, vuelve vacía siempre—. Por eso el hook recibe `activo`: mientras sea falso no
 *   pide nada, y cuando pasa a verdadero pide UNA vez. Volver a plegar y desplegar no repite la
 *   consulta; cambiar de CLASE de providencia sí la reinicia, porque entonces la lista anterior ya
 *   no habla del documento que se está redactando.
 *
 *   ── 2. UN FALLO AQUÍ NO PUEDE BLOQUEAR LA REDACCIÓN ─────────────────────────────────────────
 *   🔴 Los errores se GUARDAN en estado y se enseñan dentro de la sección; de este hook no sale
 *   ninguno hacia arriba (T-03.19-67). Basarse en un documento anterior es una comodidad: que el
 *   servicio esté caído no puede impedir escribir una providencia a mano, que es como se han
 *   escrito todas hasta hoy.
 *
 *   ── 3. «NO HAY» Y «NO SE PUDO CONSULTAR» SON DOS SEÑALES DISTINTAS ──────────────────────────
 *   🔴 `vacioHonesto` solo es cierto cuando se consultó, NO falló y no vino nada. Si una consulta
 *   averiada se pintara como «no hay providencias anteriores», la pantalla afirmaría algo falso y
 *   además taparía la avería. Es el mismo reparto que `ModalTimeline` (plan 09).
 *
 *   ⚠️ El `limit` que se usa para pedir la página siguiente es el que viene en la RESPUESTA, no el
 *   que se mandó: el backend lo acota a 100 en silencio, y paginar con un tamaño que el servidor no
 *   aplicó se salta registros sin avisar.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ProvidenciaService,
  type ProvidenciaSimilar,
} from "../services/ProvidenciaService";

/**
 * Tamaño de página que se PIDE. El backend tiene el suyo por defecto (10) y su tope (100); éste es
 * solo la primera propuesta, y a partir de la primera respuesta manda el que el servidor aplicó.
 */
export const TAMANIO_PAGINA_SIMILARES = 10;

export interface ParametrosDocumentosSimilares {
  /** La CLASE de providencia que se está redactando. Sin ella no hay nada que consultar. */
  tipoCodigo: string | undefined;
  /** La sección está desplegada. Es lo que dispara la primera carga. */
  activo: boolean;
}

export interface DocumentosSimilares {
  /** Lo acumulado hasta ahora, en el orden en que llegó. */
  documentos: ProvidenciaSimilar[];
  /** Cuántas hay en total según el servidor (no las de esta página). */
  total: number;
  /** Primera carga en vuelo. */
  cargando: boolean;
  /** Una página siguiente en vuelo: la lista ya pintada se queda donde está. */
  cargandoMas: boolean;
  /** La ÚLTIMA consulta falló. La sección lo dice y sigue siendo operable. */
  fallo: boolean;
  /** Quedan resultados por traer. */
  hayMas: boolean;
  /** Se consultó, no falló y no vino nada. La ÚNICA condición para afirmar que no hay. */
  vacioHonesto: boolean;
  /** Trae la página siguiente y la acumula. No hace nada si ya hay algo en vuelo o no queda más. */
  cargarMas: () => void;
  /** Repite la primera página desde cero. Es el botón del aviso de avería. */
  reintentar: () => void;
}

export function useSimilarDocuments({
  tipoCodigo,
  activo,
}: ParametrosDocumentosSimilares): DocumentosSimilares {
  const [documentos, setDocumentos] = useState<ProvidenciaSimilar[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [consultado, setConsultado] = useState(false);

  /** Desde dónde pedir la página siguiente. Se calcula con lo que dijo la RESPUESTA. */
  const siguienteOffset = useRef(0);
  /** El tamaño de página que el servidor aplicó de verdad. */
  const limiteAplicado = useRef(TAMANIO_PAGINA_SIMILARES);
  /**
   * Contador de peticiones. Una respuesta cuyo número ya no es el último se DESCARTA: sin esto,
   * cambiar de clase de providencia mientras una consulta va en vuelo deja en pantalla la lista de
   * la clase anterior, que es peor que no tener lista.
   */
  const peticion = useRef(0);
  const vivo = useRef(true);
  /** Para qué clase se hizo ya la primera carga: evita repetirla al plegar y desplegar. */
  const pedidoPara = useRef<string | undefined>(undefined);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const cargar = useCallback(
    async (offset: number, acumular: boolean): Promise<void> => {
      if (!tipoCodigo) return;

      const mia = ++peticion.current;
      if (acumular) setCargandoMas(true);
      else setCargando(true);
      setFallo(false);

      try {
        const sobre = await ProvidenciaService.similares({
          tipoCodigo,
          limit: limiteAplicado.current,
          offset,
        });
        if (!vivo.current || mia !== peticion.current) return;

        // El tamaño que MANDA es el de la respuesta (el servidor acota a 100 sin decirlo).
        if (sobre.limit > 0) limiteAplicado.current = sobre.limit;
        siguienteOffset.current = sobre.offset + sobre.data.length;

        setTotal(sobre.total);
        setDocumentos((previos) =>
          acumular ? [...previos, ...sobre.data] : sobre.data,
        );
      } catch {
        // Se GUARDA y no se propaga: el paso 2 tiene que seguir redactándose (T-03.19-67).
        if (!vivo.current || mia !== peticion.current) return;
        setFallo(true);
        if (!acumular) {
          setDocumentos([]);
          setTotal(0);
          siguienteOffset.current = 0;
        }
      } finally {
        if (vivo.current && mia === peticion.current) {
          setCargando(false);
          setCargandoMas(false);
          setConsultado(true);
        }
      }
    },
    [tipoCodigo],
  );

  // Cambió la clase de providencia: lo acumulado ya no habla del documento que se redacta.
  useEffect(() => {
    pedidoPara.current = undefined;
    siguienteOffset.current = 0;
    limiteAplicado.current = TAMANIO_PAGINA_SIMILARES;
    peticion.current += 1;
    setDocumentos([]);
    setTotal(0);
    setFallo(false);
    setConsultado(false);
    setCargando(false);
    setCargandoMas(false);
  }, [tipoCodigo]);

  // La primera carga: al desplegar, una sola vez por clase.
  useEffect(() => {
    if (!activo || !tipoCodigo) return;
    if (pedidoPara.current === tipoCodigo) return;
    pedidoPara.current = tipoCodigo;
    void cargar(0, false);
  }, [activo, tipoCodigo, cargar]);

  const cargarMas = useCallback(() => {
    if (cargando || cargandoMas) return;
    if (documentos.length >= total) return;
    void cargar(siguienteOffset.current, true);
  }, [cargando, cargandoMas, documentos.length, total, cargar]);

  const reintentar = useCallback(() => {
    if (!tipoCodigo) return;
    pedidoPara.current = tipoCodigo;
    siguienteOffset.current = 0;
    void cargar(0, false);
  }, [cargar, tipoCodigo]);

  return {
    documentos,
    total,
    cargando,
    cargandoMas,
    fallo,
    hayMas: documentos.length < total,
    vacioHonesto:
      consultado && !cargando && !fallo && documentos.length === 0,
    cargarMas,
    reintentar,
  };
}
