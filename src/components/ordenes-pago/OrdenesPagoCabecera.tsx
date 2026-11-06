/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/ordenes-pago (frontend)
 * Feature: La orden de pago, dentro del modal de emitir providencia (2026-09-08)
 * Archivo: OrdenesPagoCabecera.tsx
 * Responsabilidad: Enseñar las órdenes de pago VIGENTES del expediente en el bloque «Datos de la
 *   cabecera» y dejar que el decisor registre la que falte sin salirse del modal.
 *
 *   ── POR QUÉ ESTO NO ES «DEVOLVER EL CAMPO MANUAL» ────────────────────────────────────────────
 *   El 2026-09-03 el número de orden salió de los campos que se tecleaban en cada providencia: se
 *   escribía suelto, moría dentro de ESE PDF y la siguiente providencia lo volvía a pedir en blanco.
 *   Eso NO vuelve. Aquí no hay un campo de la cabecera: hay una ventana al expediente. Lo que se
 *   teclea se REGISTRA en `t_orden_pago` —el mismo sitio y el mismo endpoint que usa «Mis
 *   Expedientes»— y la providencia lo sigue leyendo de ahí. El dato tiene un solo dueño; lo que
 *   cambia es desde dónde se puede crear.
 *
 *   El hueco que cierra es real: si el expediente no tenía orden, el decisor que estaba redactando
 *   no tenía forma de añadirla sin abandonar el modal y perder lo escrito. El propio servicio lo
 *   anticipó por escrito — «la orden puede emitirse en el mismo acto de redactar».
 *
 *   ── LO QUE NO HACE ───────────────────────────────────────────────────────────────────────────
 *   No registra la CONSTANCIA de pago (decisión del usuario, 2026-09-08). Registrar el pago mueve el
 *   EPAS a CUMPLIDO, y dispararlo desde aquí podría dejar sin sentido la providencia que se está
 *   escribiendo. La constancia sigue en su acción de fila.
 *
 *   No anula: anular exige un motivo y es un acto sobre un número que puede haberse notificado ya.
 *   Eso se queda en la celda de «Mis Expedientes», y el historial completo —anuladas incluidas— se
 *   lee en la línea de tiempo del expediente (Fase 03.22, Plan 03).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-08
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 04 — D-01: la bandeja aparte se retira;
 *   el copy apunta a «Mis Expedientes».)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al cargar las órdenes se dice
 *   en su hueco, con «Reintentar» y sin afirmar «sin registrar»; el número vacío se dice bajo su
 *   campo, con aria-invalid y el foco; el fallo al registrar sigue en el aviso flotante)
 *
 * 🔴 ESTE COMPONENTE **NO** SE BORRA CON LA BANDEJA, Y CUESTA VERLO. Su nombre y su carpeta lo
 *   hacen parecer «el buscador y el filtro de la pantalla retirada» —así lo dieron por hecho los
 *   tres artefactos de planificación de la Fase 03.22— y es falso: la página retirada nunca lo
 *   importó (su buscador y su filtro estaban escritos dentro de ella misma). Esto es el bloque
 *   de órdenes de pago DEL MODAL DE EMITIR PROVIDENCIA: lo importa `CompositorProvidencia` y lo
 *   doblan tres ficheros de prueba. Borrarlo rompe `tsc` y esas tres suites.
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useToast } from "../../hooks/useToast";
import Alert from "../common/Alert";
import Boton from "../common/Boton";
import {
  OrdenPagoService,
  type OrdenPago,
  type TipoOrdenPago,
} from "../../services/OrdenPagoService";

interface Props {
  eejeId: number;
  /** Solo el decisor del expediente registra; el backend lo comprueba con su guard de pertenencia. */
  permiteRegistrar?: boolean;
  /**
   * Se avisa al padre de que el expediente CAMBIÓ. Lo usa el modal para regenerar el borrador: la
   * orden no viaja en el payload —la lee el servidor al armar el PDF—, así que sin este aviso la
   * vista previa seguiría enseñando la cabecera sin número justo después de registrarlo.
   */
  onRegistrada?: () => void;
}

/** Las dos órdenes que puede llevar un expediente, en el orden en que las lee la providencia. */
const TIPOS: ReadonlyArray<{ tipo: TipoOrdenPago; etiqueta: string }> = [
  { tipo: "MULTA", etiqueta: "Orden para el pago (multa)" },
  { tipo: "REMANENTE", etiqueta: "Orden para el pago del remanente" },
];

/** El estado en castellano llano: es como lo imprime la providencia que va al administrado. */
const estadoLegible = (orden: OrdenPago) =>
  orden.estado === "PAGADA" ? "Pagada" : "Registrada";

export const OrdenesPagoCabecera = ({
  eejeId,
  permiteRegistrar = false,
  onRegistrada,
}: Props) => {
  const { addToast } = useToast();
  const [ordenes, setOrdenes] = useState<OrdenPago[]>([]);
  const [cargando, setCargando] = useState(true);
  /** Qué tipo se está tecleando ahora. `null` = ninguno. Solo uno a la vez. */
  const [editando, setEditando] = useState<TipoOrdenPago | null>(null);
  const [numero, setNumero] = useState("");
  const [guardando, setGuardando] = useState(false);
  /**
   * Fallo al CARGAR las órdenes: se dice en su hueco, con «Reintentar», y mientras falla no se
   * afirma que están «sin registrar» (regla 3b de 261028-kmg).
   */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  /** Error de CAMPO del número: bajo el control, y se retira al escribir. */
  const [errorNumero, setErrorNumero] = useState<string | null>(null);
  const numeroRef = useRef<HTMLInputElement>(null);
  const idErrorNumero = `${useId()}-error-numero`;

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      setOrdenes(await OrdenPagoService.historial(eejeId));
    } catch (err) {
      setErrorCarga(
        mensajeParaUsuario(err, "No se pudieron cargar las órdenes de pago."),
      );
    } finally {
      setCargando(false);
    }
  }, [eejeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /**
   * La orden VIGENTE de un tipo. El historial trae también las anuladas —es lo que explica por qué
   * un expediente tiene dos números— pero la providencia solo imprime la vigente.
   */
  const vigente = (tipo: TipoOrdenPago) =>
    ordenes.find((o) => o.tipo === tipo && !o.anuladaAt);

  const registrar = async (tipo: TipoOrdenPago) => {
    const valor = numero.trim();
    if (!valor) {
      setErrorNumero("Escriba el número de la orden.");
      numeroRef.current?.focus();
      return;
    }

    setGuardando(true);
    try {
      await OrdenPagoService.registrar(eejeId, tipo, valor);
      addToast("success", "Orden de pago registrada");
      setEditando(null);
      setNumero("");
      await cargar();
      // El aviso va DESPUÉS de recargar: si el padre regenera el borrador, que lo haga contra un
      // expediente que ya tiene la orden dentro.
      onRegistrada?.();
    } catch (err) {
      // Lo tecleado se QUEDA en pantalla: si el backend rechazó el número —mal formado, expediente
      // ajeno, orden ya vigente— borrarlo obligaría a escribirlo otra vez para corregir una letra.
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo registrar la orden de pago."),
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="md:col-span-2 flex flex-col gap-2 rounded-lg border border-base-300 p-3">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary/90">
        Órdenes de pago del expediente
      </span>

      {cargando ? (
        <span className="text-sm opacity-70">Cargando…</span>
      ) : errorCarga ? (
        <Alert
          variant="error"
          message={errorCarga}
          buttonFunction={() => void cargar()}
        />
      ) : (
        TIPOS.map(({ tipo, etiqueta }) => {
          const orden = vigente(tipo);
          const abierto = editando === tipo;

          return (
            <div
              key={tipo}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span className="min-w-56 font-medium">{etiqueta}:</span>

              {orden ? (
                <span>
                  {orden.numero}{" "}
                  <span className="opacity-70">({estadoLegible(orden)})</span>
                </span>
              ) : abierto ? (
                <>
                  <input
                    ref={numeroRef}
                    autoFocus
                    className={`input input-bordered input-sm w-48${errorNumero ? " input-error" : ""}`}
                    value={numero}
                    disabled={guardando}
                    placeholder="Nro. de orden (SAO)"
                    aria-invalid={errorNumero ? true : undefined}
                    aria-describedby={errorNumero ? idErrorNumero : undefined}
                    onChange={(e) => {
                      setNumero(e.target.value);
                      setErrorNumero(null);
                    }}
                    // Enter guarda, igual que la edición en la fila de la bandeja: quien teclea
                    // números seguidos no levanta la mano del teclado para buscar un botón.
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void registrar(tipo);
                      }
                      if (e.key === "Escape") {
                        setEditando(null);
                        setNumero("");
                        setErrorNumero(null);
                      }
                    }}
                  />
                  <Boton
                    estilos="btn btn-sm btn-primary"
                    texto={guardando ? "Registrando…" : "Registrar"}
                    deshabilitado={guardando}
                    onClick={() => void registrar(tipo)}
                  />
                  <Boton
                    estilos="btn btn-sm btn-ghost"
                    texto="Cancelar"
                    deshabilitado={guardando}
                    onClick={() => {
                      setEditando(null);
                      setNumero("");
                      setErrorNumero(null);
                    }}
                  />
                  {errorNumero && (
                    <span
                      id={idErrorNumero}
                      className="basis-full text-sm text-error"
                    >
                      {errorNumero}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="opacity-70">sin registrar</span>
                  {permiteRegistrar && (
                    <Boton
                      estilos="btn btn-xs"
                      texto="Añadir"
                      deshabilitado={guardando}
                      onClick={() => {
                        setEditando(tipo);
                        setNumero("");
                      }}
                    />
                  )}
                </>
              )}
            </div>
          );
        })
      )}

      <p className="text-xs opacity-70">
        Lo que se registre aquí queda en el expediente, no solo en esta
        providencia: la cabecera lo imprime leyéndolo de ahí, y «Mis
        Expedientes» lo muestra igual en sus columnas de orden.
      </p>
    </div>
  );
};

export default OrdenesPagoCabecera;
