/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Actas
 * Feature: Clave del certificado para la firma del acta D2
 * Archivo: useClaveDeFirma.ts
 * Responsabilidad: Decidir si hay que PEDIR la clave del certificado al firmar, y sostener su valor
 *   solo el tiempo que dura el acto.
 *
 *   POR QUÉ SE PREGUNTA AL BACKEND. La bandera del firmador vive allí (`GET /sorteo/firma/modo`),
 *   igual que el modo de sesión vive en `GET /auth/mode`. Duplicarla en un `VITE_*` garantizaría que
 *   algún día difieran, y el síntoma sería el peor posible: pedirle al usuario la clave de su
 *   certificado para luego descartarla, o no pedírsela cuando sí hace falta.
 *
 *   🔴 LA CLAVE NO SE GUARDA EN NINGÚN SITIO. Vive en el estado del componente mientras el modal está
 *   abierto y se borra al cerrarlo o al terminar el envío (`limpiar`). Nunca en el almacenamiento del
 *   navegador, nunca en la URL, nunca en un log. Es la contraparte en el cliente de la regla que el
 *   backend ya tiene probada (entrada 9 del deferred de la 03.12).
 *
 *   SESIÓN CENTRAL (Fase 03.21, D-12). Con el firmador encendido, el backend dice además si la sesión
 *   del usuario se abrió con el Auth central (`sesionCentral`), que es lo único que permite firmar.
 *   Si no (`false`), el hook declara `sinSesionCentral` y NO deja enviar ni entrega la clave: el
 *   campo pinta el estado C en lugar de pedirla. Si el servidor no lo informa, se degrada a la
 *   conducta de antes.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-13
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08: `ModoDeFirma` con `sesionCentral`,
 *   `sinSesionCentral` en el hook, y la caché del modo que se vacía al cerrar sesión).
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-01: el hook dice si el modo aún se
 *   está leyendo (`cargando`) o no se pudo leer (`errorModo`, con `reintentarModo`); en ninguno de
 *   los dos deja enviar, y un fallo de lectura ya no se convierte en «firmador apagado»).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import SorteoService, { type ModoDeFirma } from "../services/SorteoService";

/**
 * Respuesta cacheada del modo de firma. La bandera del firmador es una constante del despliegue —solo
 * cambia con un reinicio del backend—, así que se pregunta UNA vez y no en cada modal. Pero
 * `sesionCentral` es de la SESIÓN DEL USUARIO: por eso la caché se vacía cada vez que la sesión
 * cambia —`UserContext` llama a `resetModoDeFirmaCache` al cerrar sesión, ante un 401, al entrar con
 * el login local y en cada hidratación—, para que el siguiente usuario de la misma pestaña no herede
 * la respuesta del anterior.
 */
let modoCacheado: Promise<ModoDeFirma> | null = null;
/**
 * El modo ya RESUELTO de la caché, para que un modal que se abre después arranque sabiéndolo y no
 * pinte un instante de «comprobando…» por una respuesta que ya se tiene.
 */
let modoResuelto: ModoDeFirma | null = null;

/**
 * Lee el modo (una vez por sesión). 🔴 Si la lectura FALLA, la promesa se RECHAZA: no se inventa un
 * «firmador apagado». Suponerlo hacía que la superficie dijera que la firma está desactivada (falso
 * si está encendida) y dejara enviar sin clave, para que el servidor lo rechazara después. La caché
 * se descarta para que el reintento vuelva a preguntar.
 */
function leerModo(): Promise<ModoDeFirma> {
  if (!modoCacheado) {
    const lectura = SorteoService.readModoDeFirma().then(
      (leido) => {
        if (modoCacheado === lectura) modoResuelto = leido;
        return leido;
      },
      (err: unknown) => {
        if (modoCacheado === lectura) modoCacheado = null;
        throw err;
      },
    );
    modoCacheado = lectura;
  }
  return modoCacheado;
}

/**
 * Olvida el modo cacheado: la siguiente lectura vuelve a preguntar al backend. Se llama cuando la
 * sesión cambia —al cerrarla, cuando el servidor la da por muerta (401) y al abrir una nueva—,
 * porque `sesionCentral` es de la sesión del usuario; y en los tests.
 */
export function resetModoDeFirmaCache(): void {
  modoCacheado = null;
  modoResuelto = null;
}

/** En qué punto está la lectura del modo de firma. */
type EstadoLectura =
  | { fase: "cargando" }
  | { fase: "listo"; modo: ModoDeFirma }
  | { fase: "error" };

const estadoInicial = (): EstadoLectura =>
  modoResuelto ? { fase: "listo", modo: modoResuelto } : { fase: "cargando" };

export interface ClaveDeFirma {
  /**
   * El modo de firma todavía se está leyendo. Mientras tanto no se sabe si hay que pedir la clave:
   * no se deja enviar y el campo pinta un estado neutro, no el aviso del firmador apagado.
   */
  cargando: boolean;
  /**
   * No se pudo leer el modo de firma. No se sabe si el firmador está encendido, así que no se deja
   * enviar; el campo lo dice y ofrece `reintentarModo`.
   */
  errorModo: boolean;
  /** Vuelve a preguntar el modo tras un fallo de lectura. */
  reintentarModo: () => void;
  /** true cuando el firmador está encendido y por tanto hay que pedir la clave. */
  requerida: boolean;
  /**
   * Si la sesión se abrió con el Auth central, tal cual lo dijo el servidor. `undefined` con el
   * firmador apagado o cuando el servidor no lo informa. Se le pasa al campo (`sesionCentral`).
   */
  sesionCentral?: boolean;
  /** Estado C (D-12): firmador encendido y la sesión NO es central. No se puede firmar. */
  sinSesionCentral: boolean;
  /** Valor tecleado. Cadena vacía mientras no se pide o no se ha escrito nada. */
  clave: string;
  setClave: (valor: string) => void;
  /** Borra la clave del estado. Llamar al cerrar el modal y al terminar el envío. */
  limpiar: () => void;
  /**
   * ¿Se puede enviar? Falso mientras el modo no se conoce (cargando o error), si la clave es
   * obligatoria y está vacía, o en el estado C.
   */
  listaParaEnviar: boolean;
  /**
   * Lo que hay que pasarle al servicio: la clave, o `undefined` si no se pide o está en blanco.
   * Nunca una cadena vacía: mandar una clave vacía sería pedirle al firmador que lo intente con nada.
   */
  claveParaEnviar: string | undefined;
}

export function useClaveDeFirma(): ClaveDeFirma {
  const [lectura, setLectura] = useState<EstadoLectura>(estadoInicial);
  const [clave, setClave] = useState("");
  // Cada lectura pedida lleva su número: si llega una respuesta vieja (un reintento la adelantó o
  // el componente se desmontó), no pisa el estado.
  const intento = useRef(0);

  const leer = useCallback(() => {
    const este = ++intento.current;
    leerModo().then(
      (leido) => {
        if (intento.current === este) setLectura({ fase: "listo", modo: leido });
      },
      () => {
        if (intento.current === este) setLectura({ fase: "error" });
      },
    );
  }, []);

  useEffect(() => {
    leer();
    return () => {
      intento.current += 1;
    };
  }, [leer]);

  const reintentarModo = useCallback(() => {
    setLectura({ fase: "cargando" });
    leer();
  }, [leer]);

  const limpiar = useCallback(() => setClave(""), []);

  const conocido = lectura.fase === "listo";
  const requerida = conocido && lectura.modo.firmadorHabilitado;
  const sesionCentral = conocido && requerida ? lectura.modo.sesionCentral : undefined;
  const sinSesionCentral = requerida && sesionCentral === false;
  const hayClave = clave.trim().length > 0;

  return {
    cargando: lectura.fase === "cargando",
    errorModo: lectura.fase === "error",
    reintentarModo,
    requerida,
    sesionCentral,
    sinSesionCentral,
    clave,
    setClave,
    limpiar,
    listaParaEnviar: conocido && (!requerida || (!sinSesionCentral && hayClave)),
    claveParaEnviar:
      requerida && !sinSesionCentral && hayClave ? clave : undefined,
  };
}
