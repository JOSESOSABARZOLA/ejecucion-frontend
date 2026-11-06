/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: La columna PLAZO RESTANTE de la bandeja del decisor (Fase 03.19, Plan 07, D-09)
 * Archivo: ChipPlazo.tsx
 * Responsabilidad: Decir, en la fila y sin abrir el expediente, si el decisor ya se hizo cargo del
 *   EPAS y, si todavía no, cuánto le queda para aceptarlo o excusarse.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-09-22 (UAT de la fase, gap 2: el rótulo del chip pasa a
 *   «Auto-aceptado» por pedido del usuario)
 * Extraído de: `MisAsignadosPage.tsx` (`resolvePlazoChip` + `CHIP_CLASSES`), que ya funcionaba.
 *
 * ── 🔴 ESTE COMPONENTE NO DECIDE SI EL EPAS ESTÁ ACEPTADO. LO LEE ────────────────────────────
 * `aceptado`, `aceptadoImplicito` y `excusaPendiente` llegan computed-on-read del backend, y
 * `plazoVenceAt` es la fecha que el propio servidor fijó al sortear. Lo ÚNICO que se hace aquí con
 * el reloj es restar días para la ETIQUETA — nunca para deducir un veredicto.
 *
 * La diferencia importa: si el navegador dedujera «el plazo pasó, luego está aceptado», habría dos
 * jueces del mismo hecho y bastaría un reloj desfasado o una zona horaria para que el chip dijera
 * «Aceptado» y el servidor respondiera que no al pulsar (T-03.19-29). Dos pruebas ponen al
 * componente delante de un plazo vencido con el veredicto del servidor en contra, en los dos
 * sentidos, y afirman que obedece al servidor.
 *
 * ── 🔴 POR QUÉ DOS LÍNEAS Y NO EL «6 días» A SECAS DE LA CAPTURA ─────────────────────────────
 * La captura viene de Resolución, donde el plazo es *para resolver*. Aquí es *para aceptar o
 * excusarse*, y un número suelto no dice de qué: un decisor que lee «6 días» en su bandeja asume
 * que son los que tiene para trabajar el expediente, no los que tiene para quedárselo. La segunda
 * línea son 11 px, cabe en el ancho de la columna y NO depende del hover, que en tableta no existe.
 * El número grande conserva la legibilidad de la captura.
 *
 * ── ⚠️ LO QUE NO SE PORTA ───────────────────────────────────────────────────────────────────
 * `ResolveCountdownBadge` de `resolucion-frontend @ origin/dev`: cuenta contra OTRO plazo y no
 * conoce el aceptado implícito, así que pintaría «6 días» sobre un expediente que ya está aceptado.
 *
 * ── ⚠️ ESTE ARCHIVO NO TOCA `MisAsignadosPage.tsx` ──────────────────────────────────────────
 * El bloque en línea del que sale esto sigue ahí y sigue siendo el que pinta hoy. Lo retira el Plan
 * 17, que es el dueño de ese archivo; hasta entonces conviven, y es deliberado.
 *
 * ── NINGÚN SIGNIFICADO DEPENDE SOLO DEL COLOR (T-03.19-31) ──────────────────────────────────
 * Los cinco estados llevan su texto, y los dos críticos —la excusa pendiente y el plazo por
 * vencer— llevan además icono. Los dos naranjas salen de `--app-plazo-fg` y `--app-plazo-fg-fuerte`
 * (5,4:1 y 7,4:1 sobre blanco): el naranja de marca daba 2,6:1 y fallaba WCAG AA.
 */
import type { FC } from "react";
import Iconos from "./Iconos";
import type { MiEpasAsignado } from "../../services/SorteoService";

/** Un día en milisegundos. */
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * El umbral del aviso: 2 días o menos es «por vencer».
 *
 * Es el mismo número que traía `resolvePlazoChip` en `MisAsignadosPage`. La regla NO se renegocia
 * al extraer el componente: extraer y cambiar a la vez es cómo se pierde el rastro de cuál de las
 * dos cosas rompió algo.
 */
const POR_VENCER_UMBRAL_DIAS = 2;

type ChipPlazoProps = {
  /** La fila de la bandeja, tal y como la entrega el servidor. Ningún campo se recalcula aquí. */
  row: MiEpasAsignado;
};

/**
 * Los días que faltan, redondeados HACIA ARRIBA y con suelo en cero.
 *
 * 🔴 Las dos decisiones tienen motivo. Hacia arriba, porque el plazo vence a una hora concreta y
 * quedan «2 días» hasta el último instante del segundo: redondear hacia abajo le quitaría al
 * decisor un día que legalmente tiene. Y con suelo en cero, porque un plazo pasado NO se pinta en
 * negativo — el expediente no está «a −4 días», está vencido, y quién decide qué significa eso es
 * el servidor, no esta resta.
 */
const diasRestantes = (venceAt: string): number =>
  Math.max(0, Math.ceil((new Date(venceAt).getTime() - Date.now()) / MS_POR_DIA));

/** «1 día» / «0 días» / «5 días». El singular es el que se lee la víspera de perder el expediente. */
const textoDias = (dias: number): string =>
  `${dias} ${dias === 1 ? "día" : "días"}`;

const ChipPlazo: FC<ChipPlazoProps> = ({ row }) => {
  // 1 y 2. ACEPTADO. El veredicto efectivo del servidor gana a cualquier cuenta de días: un
  // expediente aceptado ya no espera nada del decisor, y enseñarle un plazo sería pedirle dos veces
  // la misma decisión. `aceptadoExplicito` distingue el aceptado A MANO del aceptado POR
  // VENCIMIENTO, y esa diferencia se dice: es la que el decisor necesita para saber si el
  // expediente es suyo porque lo quiso o porque se le pasó el plazo.
  //
  // 🔴 «Auto-aceptado» Y NO LA FRASE LARGA. El rótulo lo acortó el usuario el 2026-09-22 (UAT de la
  // fase, gap 2). Los dos casos siguen distinguiéndose —«Auto-aceptado» / «Aceptado»— y la
  // distinción sigue saliendo del SERVIDOR: lo único que cambió es el texto, no la derivación.
  if (row.aceptado || row.aceptadoImplicito) {
    const porVencimiento = row.aceptadoExplicito !== true;

    return (
      <span className="badge badge-success whitespace-normal h-auto">
        {porVencimiento ? "Auto-aceptado" : "Aceptado"}
      </span>
    );
  }

  // 3. EXCUSA PENDIENTE. Va ANTES del plazo y no después: el expediente ya no está esperando una
  // aceptación, está esperando que alguien resuelva la excusa. Pintar los días restantes aquí
  // invitaría al decisor a aceptar un caso del que acaba de pedir salirse.
  if (row.excusaPendiente) {
    return (
      <span className="badge badge-warning whitespace-normal h-auto gap-1">
        <Iconos nombre="advertencia" />
        Excusa pendiente
      </span>
    );
  }

  // 4 y 5. EL PLAZO VIVO, en dos líneas.
  if (row.plazoVenceAt) {
    const dias = diasRestantes(row.plazoVenceAt);
    const porVencer = dias <= POR_VENCER_UMBRAL_DIAS;

    return (
      <span
        className="flex flex-col leading-tight"
        style={{
          color: porVencer
            ? "var(--app-plazo-fg-fuerte)"
            : "var(--app-plazo-fg)",
          fontWeight: porVencer ? 700 : 400,
        }}
      >
        <span className="flex items-center gap-1 whitespace-nowrap">
          {/* El icono SÓLO en el caso crítico: si lo llevaran los dos, dejaría de señalar nada. */}
          {porVencer && <Iconos nombre="reloj" />}
          {textoDias(dias)}
        </span>
        {/* La segunda línea es la que dice DE QUÉ son los días. Sin ella el número miente por
            omisión: el decisor asume que son los que tiene para trabajar el expediente. */}
        <span className={`text-xs ${porVencer ? "" : "opacity-70"}`}>
          {porVencer ? "por vencer" : "para aceptar"}
        </span>
      </span>
    );
  }

  // 6. SIN FECHA DE VENCIMIENTO.
  //
  // 🔴 Aquí NO se cae a `plazoDias`, y es deliberado: `plazoDias` es el plazo CONCEDIDO al sortear,
  // no el que queda. Pintarlo como si fuera lo restante daría «7 días» a un expediente sorteado
  // hace un mes — un número falso y creíble, que es la peor clase de número. Sin la fecha, lo
  // honesto es decir que no consta.
  //
  // El texto va en un `span` para lectores de pantalla ADEMÁS de en el `title`: un `title` no se
  // anuncia y en pantalla táctil no existe, así que una raya sola sería una celda muda.
  return (
    <span title="Sin plazo registrado">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Sin plazo registrado</span>
    </span>
  );
};

export default ChipPlazo;
