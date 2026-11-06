/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend)
 * Feature: La Bandeja se entera de lo que trajo la pasada (Fase 03.24, Plan 18, G-13)
 * Archivo: AvisoDatosNuevos.tsx
 * Responsabilidad: Cuando el sondeo de la línea de estado trae una pasada NUEVA que trajo casos,
 *   recargar la Bandeja de Entrada sola si es seguro y, si no, pintar en la cabecera «Hay datos
 *   nuevos de Resolución» con «Recargar». Anuncia al lector de pantalla una vez por pasada con datos.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 *
 * ── 🔴 POR QUÉ ES UN COMPONENTE Y NO LÓGICA EN LA PÁGINA ──────────────────────────────────────
 * `BandejaEntradaPage` tiene un `return null` sin usuario por delante de la mayoría de sus hooks
 * (deuda de rules-of-hooks). Añadirle más estado ahí empeora esa deuda; aquí el estado vive en un
 * hijo que la página monta solo cuando tiene bandeja, y la página solo le dice si es SEGURO recargar.
 *
 * ── QUÉ ES UNA PASADA NUEVA (UI-SPEC §3.1) ────────────────────────────────────────────────────
 * Un `fin` distinto del último visto, que no sea la primera lectura (lo que ya estaba al abrir la
 * página no es una novedad), con resultado CORRECTA o PARCIAL y con `trajoDatos`. Una pasada sin
 * cambios o FALLIDA no cuenta. Si el sondeo falla un momento (`estado` null), no se olvida el `fin`.
 *
 * ── CUÁNDO SE VA EL AVISO ─────────────────────────────────────────────────────────────────────
 * En cuanto termina con éxito CUALQUIER recarga: «Recargar», «Actualizar», el `refetchFn` de un modal
 * o la recarga sola de la pasada siguiente. La página lo señala con `marcaDeRecarga` (sus `lotes`,
 * que cambian de identidad en cada carga buena). Varias pasadas sin atender dejan UN solo aviso.
 *
 * ── LAS REGLAS DEL COMPILADOR DE REACT ─────────────────────────────────────────────────────────
 * El estado que depende de un cambio de prop se ajusta durante el render («estado anterior guardado en
 * estado»); el único efecto es la recarga, y sus `setState` van en los callbacks de la promesa.
 */
import { useEffect, useState, type FC } from "react";
import Boton from "../common/Boton";
import type { EstadoSincronizacionResolucion } from "../../services/EntradaLotesService";
import {
  ANUNCIO_CON_AVISO,
  ANUNCIO_RECARGA_SOLA,
  AVISO_DATOS_NUEVOS,
  BOTON_RECARGAR,
  trajoDatos,
  tituloDatosNuevos,
} from "./datosNuevos";

type AvisoDatosNuevosProps = {
  /** El estado de la sincronización tal como lo mandó el servidor; null si no llegó o falló. */
  estado: EstadoSincronizacionResolucion | null;
  /** ¿Se puede recargar la lista sin pisar lo que el usuario está haciendo? Lo calcula la página. */
  seguro: boolean;
  /** La recarga de la bandeja: el mismo camino que «Actualizar». */
  onRecargar: () => Promise<void>;
  /** Cambia en cada carga buena de la bandeja; al cambiar, el aviso se va. */
  marcaDeRecarga: unknown;
};

const AvisoDatosNuevos: FC<AvisoDatosNuevosProps> = ({
  estado,
  seguro,
  onRecargar,
  marcaDeRecarga,
}) => {
  /** Último `fin` visto; `undefined` mientras no haya habido ninguna lectura. */
  const [finVisto, setFinVisto] = useState<string | null | undefined>(
    undefined,
  );
  const [recargaPedida, setRecargaPedida] = useState(false);
  const [avisoVisible, setAvisoVisible] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [marcaVista, setMarcaVista] = useState<unknown>(marcaDeRecarga);

  const habilitada = estado != null && estado.habilitada;

  // Terminó una recarga buena (esta u otra): el aviso ya no tiene nada que decir.
  if (marcaDeRecarga !== marcaVista) {
    setMarcaVista(marcaDeRecarga);
    setAvisoVisible(false);
  }

  // ¿Llegó una pasada nueva? Solo con la integración encendida y un estado de verdad.
  if (estado && habilitada && estado.fin !== finVisto) {
    setFinVisto(estado.fin);
    const esPasadaNueva = finVisto !== undefined && estado.fin !== null;
    const cuenta =
      (estado.resultado === "CORRECTA" || estado.resultado === "PARCIAL") &&
      trajoDatos(estado);
    if (esPasadaNueva && cuenta) {
      if (seguro) {
        setRecargaPedida(true);
      } else {
        setAvisoVisible(true);
        setAnuncio(ANUNCIO_CON_AVISO);
      }
    }
  }

  // La recarga sola. Los `setState` van en los callbacks de la promesa, nunca en el cuerpo del efecto.
  useEffect(() => {
    if (!recargaPedida) return;
    let vivo = true;
    onRecargar()
      .then(() => {
        if (!vivo) return;
        setRecargaPedida(false);
        setAnuncio(ANUNCIO_RECARGA_SOLA);
      })
      .catch(() => {
        if (!vivo) return;
        // No se pudo: que decida el usuario con «Recargar».
        setRecargaPedida(false);
        setAvisoVisible(true);
        setAnuncio(ANUNCIO_CON_AVISO);
      });
    return () => {
      vivo = false;
    };
  }, [recargaPedida, onRecargar]);

  // D-10: con la integración apagada no hay aviso ni anuncio.
  if (!estado || !habilitada) {
    return null;
  }

  return (
    <>
      {/* Lo que el lector anuncia de los datos nuevos: una vez por pasada con datos (UI-SPEC §4.2). */}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {anuncio}
      </span>
      {avisoVisible && (
        <>
          {/* Opacidad completa: la línea de estado va al 80% y el aviso tiene que destacar. */}
          <span
            className="text-sm font-semibold text-[color:var(--app-shell-chrome-fg)]"
            title={tituloDatosNuevos(estado)}
          >
            {AVISO_DATOS_NUEVOS}
          </span>
          <Boton
            estilos="btn btn-sm btn-outline border-[color:var(--app-shell-chrome-fg)] text-[color:var(--app-shell-chrome-fg)]"
            texto={BOTON_RECARGAR}
            deshabilitado={false}
            onClick={() => {
              void onRecargar();
            }}
          />
        </>
      )}
    </>
  );
};

export default AvisoDatosNuevos;
