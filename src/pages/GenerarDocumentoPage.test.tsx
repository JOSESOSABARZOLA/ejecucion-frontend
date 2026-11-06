/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/generacion-documento (frontend) — tests
 * Archivo: GenerarDocumentoPage.test.tsx
 * Responsabilidad: Fijar lo que el MARCO aporta, que es justo lo que ninguna de las cinco piezas
 *   montadas puede probar por su cuenta.
 *
 *   ── 🔴 QUÉ SE ROMPERÍA Y QUÉ LO IMPIDE VOLVER ────────────────────────────────────────────────
 *
 *   1. **EMITIR SIN NOTIFICAR (D-05, T-03.19-70).** El servidor abre un despacho por cada forma
 *      **ya persistida** en el instante de emitir. Si las formas se guardaran después —o no se
 *      guardaran—, el acto administrativo quedaría emitido, nadie notificado y ningún plazo
 *      corriendo; y eso no se descubre hasta que el plazo que debía correr no corrió, semanas más
 *      tarde y sin ningún error en ninguna pantalla. Aquí se afirma el ORDEN DE INVOCACIÓN de los
 *      dos dobles, y que un fallo al guardar ABORTA la emisión en vez de dejarla a medias.
 *
 *   2. **CREER QUE SE FIRMÓ (D-06).** Con el firmador apagado —el despliegue de hoy— el paso 4
 *      existe igual y lo DICE. Si el paso desapareciera, o si el botón de generar se apagara
 *      esperando una clave que nadie va a pedir, el decisor terminaría el trámite creyendo que
 *      firmó algo, o no podría terminarlo. Se afirma que NO hay campo de clave, que el texto
 *      exigido está, y que el botón sigue habilitado.
 *
 *   3. **PERDER LO REDACTADO AL SALIR.** Desde el quick 261006-el5 el borrador se guarda solo en el
 *      SERVIDOR. Se afirma que «Cancelar» con cambios PENDIENTES del guardado pregunta con el copy
 *      nuevo («Su borrador queda guardado…»), que «Salir» guarda lo pendiente ANTES de irse, que si
 *      ese guardado falla el diálogo lo dice («Salir sin guardar»), y que con todo guardado no se
 *      pregunta. Y el bloque «el borrador guardado en el servidor» fija la recuperación al volver,
 *      el descarte, el retardo del guardado y que emitir no deja un PUT tardío detrás.
 *
 *   4. **QUEDARSE SIN SABER POR QUÉ EL SERVIDOR RECHAZÓ.** La confirmación permanece abierta con el
 *      mensaje del servidor: cerrarla dejaría el motivo detrás de un formulario de cuatro pantallas.
 *
 *   5. **PISAR EL BORRADOR EN SILENCIO (T-03.19-68).** La sección «basarse en un documento anterior»
 *      decide si pregunta mirando `cuerpoActual`. Si el marco le pasara una cadena vacía por
 *      comodidad, la protección entera se apagaría y **nada lo delataría**: la sección seguiría
 *      verde en sus propias pruebas. Por eso aquí se importa sobre un cuerpo YA ESCRITO y se exige
 *      que la confirmación de reemplazo aparezca.
 *
 *   6. **UN PASO QUE DESAPARECE, Y UN FOCO QUE SE QUEDA ATRÁS.** Los pasos aún no alcanzables se
 *      pintan apagados y con su motivo, nunca se esconden; y al cambiar de paso el foco va a la
 *      región del paso, que se nombra con su número y su rótulo.
 *
 *   7. **AVANZAR SIN LA PRUEBA QUE EL ACTO EXIGE (UAT 03.15 paso 8, quick 261006-dw9).** Con el
 *      tipo 3 y sin comprobante en el expediente, el paso 1 «pedía» el papel pero dejaba seguir, y
 *      el botón final se apagaba al final sin decir por qué. Se afirma que ni «Siguiente» ni el
 *      stepper sacan del paso 1 sin la prueba, que la prueba citada no bloquea, y que el máximo
 *      ganado NO sirve de puerta trasera (paso 4 → volver → cambiar a tipo 3 → saltar a «Firma»).
 *      Y en el paso 4, que «Generar documento» apagado DICE qué falta y en qué paso se arregla.
 *
 *   8. **SALIR DEL PASO 3 CON UN CANAL SIN SU DATO (quick 261026-ft2).** Marcar correo sin dirección
 *      vigente, casillero sin número o físico sin dirección dejaba pulsar «Siguiente», y el servidor
 *      lo rechazaba (D-15) solo al confirmar la emisión. Se afirma que ni «Siguiente» ni el stepper
 *      sacan del paso 3 con un canal así, que la frase del servidor se lee junto a la barra y en
 *      línea, que completar el dato o desmarcar libera la salida, y que si las formas llegan
 *      inválidas con el decisor ya en el paso 4, «Generar documento» se apaga y dice qué revisar.
 *
 *   ── LO QUE ESTAS PRUEBAS NO CUBREN, DICHO SIN ADORNOS ────────────────────────────────────────
 *   · **Nada visual.** jsdom no carga CSS: que los pasos ocultos desaparezcan de verdad, que la
 *     barra se quede pegada al pie, que el anillo de foco se vea en los dos temas y que el stepper
 *     siga legible por debajo de 640 px **no está probado y no puede estarlo aquí**.
 *   · **El botón «atrás» del navegador.** La salvaguarda se ejercita disparando `popstate` a mano;
 *     que el navegador real consuma la entrada de historial empujada y no navegue **no se ha visto**.
 *   · **`beforeunload`.** jsdom no descarga la página: solo se podría afirmar que el manejador se
 *     registra, que es afirmar sobre el andamio.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-el5 — el borrador guardado en el
 *   servidor: dobles de leer/guardar/descartar borrador, el copy nuevo del abandono y sus pruebas).
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: la vuelta a quien abrió la página.
 *   `renderPagina` admite un sufijo de query y registra la ficha de la obligación de hacer con una
 *   sonda; se prueban las salidas con `?desde=obligacion-hacer` y que un `desde` ajeno a la lista
 *   cerrada vuelve a la bandeja. Las pruebas sin sufijo no se tocan: son la conducta de siempre.)
 * Modificado por: Andrés Miño — 2026-10-26 (quick 261026-ft2: el punto 8 — el paso 3 no deja salir
 *   con un canal de notificación marcado sin su dato, y la lectura tardía apaga «Generar documento».)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 10: la firma en el mismo acto — la
 *   clave del paso 4 llega a `emitir` como tercer argumento; la confirmación dice «Se firmará con su
 *   certificado»; el estado C apaga «Generar documento»; los fallos `APP-FIRMA-*` cierran la
 *   confirmación y vuelven al campo; los avisos de éxito dicen si salió firmada.)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: los fallos del acto se afirman en el
 *   aviso flotante; ConfirmationDetail ya no los pinta en una caja)
 */
import { errorDelServidor } from "../test/errores";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { crearMiEpasAsignado } from "../test/fixtures/miEpasAsignado";
import { resetModoDeFirmaCache } from "../hooks/useClaveDeFirma";
import type { FormasAceptadas } from "../services/NotificacionEjecucionService";
import type {
  ProvidenciaSimilar,
  TipoProvidenciaDisponible,
} from "../services/ProvidenciaService";

/**
 * EL REGISTRO DE INVOCACIONES. Es el sujeto de la prueba 2: no basta con que las dos llamadas
 * ocurran, tiene que importar CUÁL fue primero.
 */
const llamadas: string[] = [];

const mocks = vi.hoisted(() => ({
  misAsignados: vi.fn(),
  modoDeFirma: vi.fn(),
  tipos: vi.fn(),
  emitir: vi.fn(),
  vistaPrevia: vi.fn(),
  similares: vi.fn(),
  formas: vi.fn(),
  guardarFormas: vi.fn(),
  agregarCorreo: vi.fn(),
  desactivarCorreo: vi.fn(),
  estadoPago: vi.fn(),
  estadoTc: vi.fn(),
  addToast: vi.fn(),
  // Quick 261006-el5. 🔴 Sin estos tres, el doble ESPARCE el servicio real y la página llamaría al
  // `httpClient` de verdad al leer y guardar el borrador.
  leerBorrador: vi.fn(),
  guardarBorrador: vi.fn(),
  descartarBorrador: vi.fn(),
}));

vi.mock("../services/SorteoService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../services/SorteoService")>();
  const doble = {
    ...real.SorteoService,
    misAsignados: mocks.misAsignados,
    readModoDeFirma: mocks.modoDeFirma,
  };
  // `useClaveDeFirma` importa el servicio POR DEFECTO y la página por su nombre: si el doble no
  // cubriera las dos puertas, el paso 4 consultaría el servicio de verdad.
  return { ...real, SorteoService: doble, default: doble };
});

vi.mock("../services/ProvidenciaService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../services/ProvidenciaService")>();
  return {
    ...real,
    ProvidenciaService: {
      ...real.ProvidenciaService,
      tipos: mocks.tipos,
      emitir: mocks.emitir,
      vistaPrevia: mocks.vistaPrevia,
      similares: mocks.similares,
      leerBorrador: mocks.leerBorrador,
      guardarBorrador: mocks.guardarBorrador,
      descartarBorrador: mocks.descartarBorrador,
    },
  };
});

vi.mock("../services/NotificacionEjecucionService", async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import("../services/NotificacionEjecucionService")
    >();
  return {
    ...real,
    NotificacionEjecucionService: {
      ...real.NotificacionEjecucionService,
      formas: mocks.formas,
      guardarFormas: mocks.guardarFormas,
      agregarCorreo: mocks.agregarCorreo,
      desactivarCorreo: mocks.desactivarCorreo,
    },
  };
});

vi.mock("../services/PagoService", () => ({
  PagoService: { estado: mocks.estadoPago },
}));
vi.mock("../services/TrabajoComunitarioService", () => ({
  TrabajoComunitarioService: { estado: mocks.estadoTc },
  SUBIDA_TIMEOUT_MS: 60000,
}));
vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));
// El visor arrastra `react-pdf`, que en jsdom revienta al cargarse («DOMMatrix is not defined»).
vi.mock("../components/pdf/PDFViewer", () => ({ PDFViewer: () => null }));
// Pide sus propias órdenes de pago al montarse; nada que ver con lo que se prueba aquí.
vi.mock("../components/ordenes-pago/OrdenesPagoCabecera", () => ({
  default: () => null,
}));

import GenerarDocumentoPage from "./GenerarDocumentoPage";
import { RUTA_GENERAR_DOCUMENTO_HIJA } from "../config/rutasGeneracionDocumento";
import { RUTA_OBLIGACION_HACER_HIJA } from "../config/rutasObligacionHacer";

/**
 * Relleno de geometría para jsdom: Tiptap mide dónde cae el cursor (`Range.getClientRects`) y jsdom
 * no implementa la geometría de `Range`. Mismo apaño, y por lo mismo, que en `RichTextEditor.test.tsx`.
 */
const rectanguloNulo = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
} as DOMRect;
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () =>
    Object.assign([], { item: () => null }) as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => rectanguloNulo;
}

const caso = crearMiEpasAsignado();

const CUERPO_PRECARGADO =
  "<p>Providencia de impulso del expediente, con <strong>negrita</strong>.</p>";

const TIPO: TipoProvidenciaDisponible = {
  codigo: "PROVIDENCIA_DE_IMPULSO",
  nombre: "Providencia de impulso",
  activo: true,
  disponible: true,
  borrador: CUERPO_PRECARGADO,
};

const FORMAS: FormasAceptadas = {
  admiId: 9,
  nombre: "Comercial Ficticia del Valle S.A.",
  correos: [
    {
      corrId: 1,
      email: "contacto@ficticia.ec",
      procedencia: "EXPEDIENTE",
      vigente: true,
    },
  ],
  casillero: "",
  direccion: "Av. Inventada 123",
  aceptaCorreo: true,
  aceptaCasillero: false,
  aceptaFisico: false,
};

const SIMILAR: ProvidenciaSimilar = {
  docId: 501,
  docName: "providencia-anterior.pdf",
  docCreatedAt: "2026-08-01T10:00:00.000Z",
  tipoCodigo: TIPO.codigo,
  expNumber: "EPAS-2026-00099",
  docStructure: {
    version: 1,
    tipoCodigo: TIPO.codigo,
    secciones: [
      { clave: "cuerpo", html: "<p>Texto de la providencia anterior.</p>" },
    ],
  },
};

/**
 * 🔴 LOS TEXTOS DEL CONTRATO, ESCRITOS A MANO Y NO IMPORTADOS DE LA FUENTE. Importarlos del
 * componente haría que la prueba dijera «la página pinta lo que la página dice», que es verdad
 * siempre. Están copiados de UI-SPEC §5.4 y §5.7.
 */
const TEXTO_FIRMA_APAGADA =
  "La firma digital está desactivada en este despliegue: el documento se generará SIN firma criptográfica.";
const TITULO_ABANDONO = "Salir sin generar el documento";
/** D-06 del 2026-10-06 (quick 261006-el5): el borrador ya no se pierde al salir. */
const CUERPO_ABANDONO =
  "Su borrador queda guardado; lo encontrará al volver a este expediente.";
const CUERPO_ABANDONO_SIN_GUARDAR =
  "No se pudo guardar su borrador en el servidor. Si sale ahora, perderá lo último que escribió.";

/** La hora LOCAL de los guardados de prueba, para no depender del huso de la máquina. */
const GUARDADO_AT = new Date(2026, 9, 6, 14, 32).toISOString();

/** Una promesa que se resuelve o rechaza a mano. */
function diferida<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

/** La bandeja a la que se vuelve. Basta con verla para saber que se navegó. */
const MARCA_BANDEJA = "LA BANDEJA DEL DECISOR";

/**
 * La ficha de la obligación de hacer, a la que se vuelve cuando se entró desde ella (quick
 * 261014-kn3). Pinta su expediente para poder afirmar que se vuelve al MISMO.
 */
const MARCA_FICHA_OBLIGACION = "LA FICHA DE LA OBLIGACIÓN DE HACER";
const SondaFichaObligacion = () => {
  const { eejeId } = useParams<{ eejeId: string }>();
  return <p>{`${MARCA_FICHA_OBLIGACION} ${eejeId}`}</p>;
};

const renderPagina = (
  eejeId: number | string = caso.eejeId ?? 0,
  sufijo = "",
) =>
  render(
    <MemoryRouter
      initialEntries={[`/home/mis-asignados/document-generate/${eejeId}${sufijo}`]}
    >
      <Routes>
        <Route
          path={`/home/${RUTA_GENERAR_DOCUMENTO_HIJA}`}
          element={<GenerarDocumentoPage />}
        />
        <Route path="/home/mis-asignados" element={<p>{MARCA_BANDEJA}</p>} />
        <Route
          path={`/home/${RUTA_OBLIGACION_HACER_HIJA}`}
          element={<SondaFichaObligacion />}
        />
      </Routes>
    </MemoryRouter>,
  );

/** La superposición de la confirmación de emisión, que es donde vive el botón que sí emite. */
const overlayConfirmacion = () => {
  const nodo = document.querySelector(".modal.modal-open");
  if (!nodo) throw new Error("la confirmación de emisión no está abierta");
  return within(nodo as HTMLElement);
};

/** Elige el tipo: es lo único que hace falta para que el paso 1 dé paso al 2. */
const elegirTipo = async () => {
  fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
    target: { value: TIPO.codigo },
  });
};

const pulsarSiguiente = () =>
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

/** Del paso 1 al 4, por el camino que recorre el decisor. */
const llegarAlPaso4 = async () => {
  await elegirTipo();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Siguiente" }),
    ).not.toBeDisabled(),
  );
  pulsarSiguiente(); // → 2
  pulsarSiguiente(); // → 3
  pulsarSiguiente(); // → 4
  await screen.findByRole("button", { name: "Generar documento" });
};

beforeEach(() => {
  vi.clearAllMocks();
  llamadas.length = 0;
  resetModoDeFirmaCache();

  // 🔴 EL SOBRE PAGINADO, NO EL ARRAY (Fase 03.19, Plan 17). `GET /sorteo/mis-asignados` devuelve
  // `{data,total,limit,offset,page,pages}` desde el Plan 03; el servicio lo declaraba como array y
  // esta prueba doblaba el array. Se actualiza en el mismo commit que corrige la lectura, y se dice
  // por qué: un doble que no se parece a la red deja pasar justo el defecto que el cambio destapó.
  mocks.misAsignados.mockResolvedValue({
    data: [caso],
    total: 1,
    limit: 100,
    offset: 0,
    page: 1,
    pages: 1,
  });
  // El despliegue de hoy: el firmador está APAGADO.
  mocks.modoDeFirma.mockResolvedValue({ firmadorHabilitado: false });
  mocks.tipos.mockResolvedValue([TIPO]);
  mocks.vistaPrevia.mockResolvedValue(new Blob(["pdf"]));
  mocks.similares.mockResolvedValue({
    data: [],
    total: 0,
    limit: 10,
    offset: 0,
    page: 1,
    pages: 0,
  });
  mocks.formas.mockResolvedValue(FORMAS);
  mocks.guardarFormas.mockImplementation(async () => {
    llamadas.push("guardarFormas");
    return FORMAS;
  });
  mocks.emitir.mockImplementation(async () => {
    llamadas.push("emitir");
    return {
      docId: 77,
      docName: "providencia.pdf",
      docUrl: "/api/fileserver/ejecucion/providencias/2026/10/providencia.pdf",
      paginas: 2,
      tipoCodigo: TIPO.codigo,
      accionEpasAplicada: null,
    };
  });
  mocks.estadoPago.mockResolvedValue(null);
  mocks.estadoTc.mockResolvedValue(null);
  // Quick 261006-el5: por defecto no hay borrador guardado, y guardar devuelve lo recibido.
  mocks.leerBorrador.mockResolvedValue(null);
  mocks.guardarBorrador.mockImplementation(
    async (_eejeId: number, b: { cuerpo: string; tipoCodigo?: string | null }) => {
      llamadas.push("guardarBorrador");
      return {
        tipoCodigo: b.tipoCodigo || null,
        cuerpo: b.cuerpo,
        actualizadoAt: GUARDADO_AT,
      };
    },
  );
  mocks.descartarBorrador.mockResolvedValue({ eliminado: true });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Las escrituras del ACTO, sin los guardados del borrador (que pueden intercalarse antes). */
const escriturasDelActo = () => llamadas.filter((l) => l !== "guardarBorrador");

describe("GenerarDocumentoPage — el marco de la generación (D-03, D-12)", () => {
  it("pinta los cuatro pasos y arranca en el primero", async () => {
    renderPagina();

    expect(
      await screen.findByRole("button", {
        name: "Paso 1 de 4: Información General",
      }),
    ).toHaveAttribute("aria-current", "step");

    for (const rotulo of [
      "Paso 2 de 4: Edición del Documento",
      "Paso 3 de 4: Notificación",
      "Paso 4 de 4: Firma",
    ]) {
      expect(screen.getByRole("button", { name: rotulo })).toBeInTheDocument();
    }
  });

  it("🔴 un paso todavía inalcanzable SIGUE en el stepper, apagado y diciendo qué falta", async () => {
    renderPagina();

    // Escrito como PRESENCIA y nunca como `queryBy… === null`: la regresión que se persigue es un
    // stepper que FILTRA los pasos que no se pueden pulsar, y esa mutación pasa en verde cualquier
    // aserción que solo mire lo que sí está.
    const paso2 = await screen.findByRole("button", {
      name: "Paso 2 de 4: Edición del Documento",
    });

    expect(paso2).toBeInTheDocument();
    expect(paso2).toBeDisabled();
    expect(paso2).toHaveAttribute(
      "title",
      "Elija el tipo de providencia para continuar.",
    );
  });

  it("el expediente que no es suyo no se pinta a medias: lo dice y ofrece la vuelta", async () => {
    // Bandeja VACÍA de verdad: `total` es 0, así que la ausencia sí demuestra la no propiedad.
    mocks.misAsignados.mockResolvedValue({
      data: [],
      total: 0,
      limit: 100,
      offset: 0,
      page: 1,
      pages: 0,
    });
    renderPagina(999999);

    expect(
      await screen.findByText("Este expediente no está entre los suyos"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Volver a Mis Expedientes" }),
    );
    expect(await screen.findByText(MARCA_BANDEJA)).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // 🔴 EL DEFECTO QUE EL SOBRE PAGINADO DESTAPÓ (Fase 03.19, Plan 17).
  //
  // Esta lectura se escribió contra el endpoint VIEJO, que devolvía la bandeja entera. Desde el
  // Plan 03 el endpoint pagina, y su tamaño por defecto es **10**: pedirlo sin parámetros dejaba a
  // un decisor con once expedientes viendo «Este expediente no está entre los suyos» en el
  // undécimo. Dos afirmaciones, y las dos importan: se pide la página máxima, y cuando la bandeja
  // no cabe entera la ausencia NO se convierte en una negación de propiedad.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  it("🔴 pide la página MÁXIMA de la bandeja, no la de diez por defecto", async () => {
    renderPagina();
    // El paso 1 sólo se pinta con el expediente ya cargado: es la señal de que la lectura terminó.
    await screen.findByLabelText("Tipo de providencia");

    expect(mocks.misAsignados).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 100,
    });
  });

  it("🔴 si la bandeja NO cabe entera, la ausencia no se lee como «no es suyo»", async () => {
    mocks.misAsignados.mockResolvedValue({
      data: [caso],
      // Ciento cuarenta asignados y sólo cien mirados: que el 999999 no esté en la página no
      // demuestra nada sobre de quién es.
      total: 140,
      limit: 100,
      offset: 0,
      page: 1,
      pages: 2,
    });
    renderPagina(999999);

    expect(
      await screen.findByText(/su bandeja tiene 140 expedientes/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Este expediente no está entre los suyos"),
    ).not.toBeInTheDocument();
  });

  it("al cambiar de paso el foco va a la región del paso, que dice cuál es", async () => {
    renderPagina();
    await elegirTipo();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Siguiente" }),
      ).not.toBeDisabled(),
    );

    pulsarSiguiente();

    // Por `role="region"` y no por su etiqueta a secas: el rótulo del paso lo lleva también el
    // botón del stepper, y buscar solo por nombre encontraría los dos.
    const region = await screen.findByRole("region", {
      name: "Paso 2 de 4: Edición del Documento",
    });
    await waitFor(() => expect(document.activeElement).toBe(region));
  });
});

describe("GenerarDocumentoPage — el orden de las dos escrituras (D-05)", () => {
  it("🔴 al confirmar, las FORMAS se guardan ANTES de emitir la providencia", async () => {
    renderPagina();
    await llegarAlPaso4();

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    fireEvent.click(
      await overlayConfirmacion().findByRole("button", {
        name: "Generar documento",
      }),
    );

    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));

    // La aserción es sobre el ORDEN, no sobre la presencia: el servidor abre los despachos leyendo
    // las formas YA persistidas, así que emitir primero dejaría el acto emitido y a nadie notificado.
    // (Quick 261006-el5: un guardado del borrador puede haber salido ANTES de confirmar si el
    // decisor tardó más de 2 s; no es una escritura del acto y no cuenta para este orden.)
    expect(escriturasDelActo()).toEqual(["guardarFormas", "emitir"]);
    expect(llamadas.indexOf("guardarFormas")).toBeLessThan(
      llamadas.indexOf("emitir"),
    );
    expect(mocks.guardarFormas).toHaveBeenCalledWith(
      caso.eejeId,
      expect.objectContaining({
        aceptaCorreo: true,
        aceptaCasillero: false,
        aceptaFisico: false,
      }),
    );
  });

  it("🔴 si guardar las formas falla, la providencia NO se emite y se dice qué paso revisar", async () => {
    mocks.guardarFormas.mockImplementation(async () => {
      llamadas.push("guardarFormas");
      throw errorDelServidor("el casillero es obligatorio si acepta casillero");
    });

    renderPagina();
    await llegarAlPaso4();

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    fireEvent.click(
      await overlayConfirmacion().findByRole("button", {
        name: "Generar documento",
      }),
    );

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "No se pudo generar el documento: el casillero es obligatorio si acepta casillero. Revise el paso «Notificación» y vuelva a intentarlo.",
      ),
    );
    // Lo que hace que este caso valga: el acto NO se emitió.
    expect(mocks.emitir).not.toHaveBeenCalled();
    expect(escriturasDelActo()).toEqual(["guardarFormas"]);
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();
  });

  it("🔴 si el servidor rechaza la emisión, la confirmación PERMANECE abierta con su mensaje", async () => {
    mocks.emitir.mockRejectedValue(
      errorDelServidor("El expediente ya tiene una providencia de archivo."),
    );

    renderPagina();
    await llegarAlPaso4();

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    fireEvent.click(
      await overlayConfirmacion().findByRole("button", {
        name: "Generar documento",
      }),
    );

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "El expediente ya tiene una providencia de archivo.",
      ),
    );
    // La confirmación sigue ahí: cerrarla dejaría el motivo detrás de cuatro pantallas de formulario.
    expect(
      overlayConfirmacion().getByRole("heading", {
        name: "Generar documento",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // 🔴 LA OTRA PUERTA A T-03.19-70, LA QUE ESTABA SIN VIGILAR.
  //
  // Las dos pruebas de arriba doblan `formas()` como RESUELTA y afirman sobre el guardado. El
  // agujero entraba por el otro lado: si `formas()` RECHAZA, las tres casillas del paso 3 se quedan
  // en su `false` inicial y el `PUT` de formas REEMPLAZA en vez de parchear. Emitir así no fallaba
  // —escribía «ninguna forma aceptada» encima de lo que el secretario había declarado—, el
  // expediente dejaba de abrir despachos y ningún plazo arrancaba. Y la caja de error del paso 3
  // está OCULTA mientras se confirma desde el paso 4, así que el decisor confirmaba sin ver nada
  // raro y el acto salía emitido y sin notificar a nadie.
  //
  // Tres aserciones, y las tres hacen falta: NO se escribe, NO se emite, y el decisor LO VE.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  it("🔴 si las formas NO se pudieron leer, ni se escriben ni se emite, y se dice por qué", async () => {
    mocks.formas.mockRejectedValue(
      errorDelServidor("El servicio de notificación no responde."),
    );

    renderPagina();
    await llegarAlPaso4();

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    fireEvent.click(
      await overlayConfirmacion().findByRole("button", {
        name: "Generar documento",
      }),
    );

    // (a) EL DECISOR LO VE, y donde está mirando: en el aviso flotante que sale ENCIMA de la
    //     confirmación (quick 261028-kmg), no en el paso 3 oculto.
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "No se pudo generar el documento: no se pudieron leer las formas de notificación del expediente, y guardarlas ahora las borraría todas. Revise el paso «Notificación» y vuelva a intentarlo.",
      ),
    );

    // (b) NO se sobrescribieron las formas del expediente con tres «no» que nadie declaró.
    expect(mocks.guardarFormas).not.toHaveBeenCalled();

    // (c) NO se emitió. Es lo que separa este fallo de la catástrofe: un acto emitido no se
    //     desemite, y el que sale sin despachos no notifica a nadie y no arranca ningún plazo.
    expect(mocks.emitir).not.toHaveBeenCalled();
    expect(llamadas).toEqual([]);
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();
  });

  it("🔴 la ficha de la confirmación NO dice «Sin declarar» cuando la lectura falló", async () => {
    // La ficha es lo último que el decisor lee antes de pulsar. «Sin declarar» se entiende como
    // «no marqué nada, y eso ya lo sé»: invita a confirmar. Lo que pasa es otra cosa.
    mocks.formas.mockRejectedValue(new Error("502"));

    renderPagina();
    await llegarAlPaso4();
    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));

    const ficha = overlayConfirmacion();
    expect(
      await ficha.findByText(
        "No se pudieron leer — revise el paso «Notificación»",
      ),
    ).toBeInTheDocument();
    expect(ficha.queryByText("Sin declarar")).toBeNull();
  });

  it("con éxito vuelve a la bandeja", async () => {
    renderPagina();
    await llegarAlPaso4();

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    fireEvent.click(
      await overlayConfirmacion().findByRole("button", {
        name: "Generar documento",
      }),
    );

    expect(await screen.findByText(MARCA_BANDEJA)).toBeInTheDocument();
  });
});

describe("GenerarDocumentoPage — el paso 4 con el firmador apagado (D-06)", () => {
  it("🔴 el paso existe, NO hay campo de clave y el botón de generar sigue habilitado", async () => {
    renderPagina();
    await llegarAlPaso4();

    expect(screen.getByText(TEXTO_FIRMA_APAGADA)).toBeInTheDocument();
    expect(screen.queryByLabelText(/clave/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Generar documento" }),
    ).not.toBeDisabled();
  });

  it("la confirmación DICE que el documento saldrá sin firma criptográfica", async () => {
    renderPagina();
    await llegarAlPaso4();

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));

    const overlay = overlayConfirmacion();
    expect(
      await overlay.findByText("Sin firma criptográfica"),
    ).toBeInTheDocument();
    // Y las formas elegidas, que es lo que decide a quién se notifica (UI-SPEC §4.8).
    expect(overlay.getByText("Correo electrónico")).toBeInTheDocument();
  });
});

/** Textos de la Fase 03.21, ESCRITOS A MANO (UI-SPEC §10). */
const FIRMA_ENCENDIDA_CONFIRMACION = "Se firmará con su certificado";
const FRASE_CONFIRMACION_CON_FIRMA =
  "El documento se firmará con su certificado antes de guardarse; si la firma no se aplica, no se emite nada.";
const AVISO_SIN_SESION_CENTRAL =
  "Para firmar hay que entrar al sistema con el Auth central, y su sesión actual no lo está. Cierre sesión y vuelva a entrar por el Auth central. Mientras tanto no se puede emitir nada que lleve firma.";
const MOTIVO_SIN_SESION_CENTRAL =
  "Entre al sistema con el Auth central para poder firmar.";
const TEXTO_SERVIDOR_CLAVE =
  "La clave de firma no es correcta. Escríbala de nuevo y vuelva a intentarlo.";
const TEXTO_SERVIDOR_NO_RESPONDE =
  "El servicio de firma no responde. Inténtelo de nuevo en unos minutos.";
/** Un marcador de prueba con forma de clave: no es una clave de nadie. */
const MARCADOR_CLAVE = "marcador-de-prueba";

/** Teclea la clave en el paso 4 y abre la confirmación; devuelve el campo. */
const teclearClaveYConfirmar = async () => {
  const campo = await screen.findByLabelText("Clave de firma");
  fireEvent.change(campo, { target: { value: MARCADOR_CLAVE } });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Generar documento" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
  fireEvent.click(
    await overlayConfirmacion().findByRole("button", {
      name: "Generar documento",
    }),
  );
  return campo;
};

describe("GenerarDocumentoPage — la firma en el mismo acto (Fase 03.21, D-04/D-07/D-11/D-12)", () => {
  it("apagado: se emite SIN clave y el aviso de éxito dice que salió SIN firma criptográfica", async () => {
    mocks.emitir.mockImplementation(async () => {
      llamadas.push("emitir");
      return {
        docId: 77,
        docName: "providencia.pdf",
        docUrl: "/api/fileserver/ejecucion/providencias/2026/10/providencia.pdf",
        paginas: 2,
        tipoCodigo: TIPO.codigo,
        accionEpasAplicada: null,
        firma: { aplicada: false },
      };
    });
    renderPagina();
    await llegarAlPaso4();
    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    const overlay = overlayConfirmacion();
    expect(await overlay.findByText("Sin firma criptográfica")).toBeInTheDocument();
    expect(overlay.queryByText(new RegExp(FRASE_CONFIRMACION_CON_FIRMA))).toBeNull();
    fireEvent.click(
      await overlay.findByRole("button", { name: "Generar documento" }),
    );

    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));
    expect(mocks.emitir.mock.calls[0][2]).toBeUndefined();
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Providencia emitida SIN firma criptográfica y adjuntada al expediente.",
      ),
    );
  });

  it("🔴 encendido: la confirmación dice que se firmará, y la clave del paso 4 llega a emitir como tercer argumento", async () => {
    mocks.modoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.emitir.mockImplementation(async () => {
      llamadas.push("emitir");
      return {
        docId: 77,
        docName: "providencia.pdf",
        docUrl: "/api/fileserver/ejecucion/providencias/2026/10/providencia.pdf",
        paginas: 2,
        tipoCodigo: TIPO.codigo,
        accionEpasAplicada: null,
        firma: { aplicada: true },
      };
    });
    renderPagina();
    await llegarAlPaso4();

    const campo = await screen.findByLabelText("Clave de firma");
    fireEvent.change(campo, { target: { value: MARCADOR_CLAVE } });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generar documento" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    const overlay = overlayConfirmacion();
    expect(
      await overlay.findByText(FIRMA_ENCENDIDA_CONFIRMACION),
    ).toBeInTheDocument();
    expect(
      overlay.getByText(new RegExp(FRASE_CONFIRMACION_CON_FIRMA)),
    ).toBeInTheDocument();
    expect(overlay.queryByText("Con firma criptográfica")).toBeNull();
    fireEvent.click(
      await overlay.findByRole("button", { name: "Generar documento" }),
    );

    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));
    expect(mocks.emitir.mock.calls[0][2]).toBe(MARCADOR_CLAVE);
    // La clave nunca dentro del payload.
    expect(JSON.stringify(mocks.emitir.mock.calls[0][0])).not.toContain(
      MARCADOR_CLAVE,
    );
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "success",
        "Providencia emitida, firmada y adjuntada al expediente.",
      ),
    );
  });

  it("🔴 encendido SIN sesión central: estado C, sin campo, y «Generar documento» apagado con su motivo", async () => {
    mocks.modoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: false,
    });
    renderPagina();
    await llegarAlPaso4();

    expect(await screen.findByText(AVISO_SIN_SESION_CENTRAL)).toBeInTheDocument();
    expect(screen.queryByLabelText("Clave de firma")).toBeNull();
    await waitFor(() =>
      expect(screen.getByText(MOTIVO_SIN_SESION_CENTRAL)).toBeInTheDocument(),
    );
    // Pedir una clave que no se puede usar es pedirla de más: no se dice «falta la clave».
    expect(screen.queryByText(MOTIVO_CLAVE)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Generar documento" }),
    ).toBeDisabled();
  });

  it("🔴 si no se pudo leer el modo de firma: no se dice que esté desactivada y «Generar documento» se apaga con su motivo (revisión 03.21, WR-01)", async () => {
    mocks.modoDeFirma.mockRejectedValue(new Error("sin red"));
    renderPagina();
    await llegarAlPaso4();

    expect(
      await screen.findByText(/No se pudo comprobar si la firma digital está activa/),
    ).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_FIRMA_APAGADA)).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByText("Todavía no se sabe si la firma digital está activa."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(MOTIVO_CLAVE)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Generar documento" }),
    ).toBeDisabled();
  });

  it("🔴 APP-FIRMA-CLAVE-001: la confirmación se cierra y se dice UNA vez, bajo el campo: vacío, marcado y con el foco; ni caja ni aviso flotante (UAT 03.21, hueco 2)", async () => {
    mocks.modoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.emitir.mockRejectedValue(
      errorDelServidor(TEXTO_SERVIDOR_CLAVE, 422, "APP-FIRMA-CLAVE-001"),
    );
    renderPagina();
    await llegarAlPaso4();
    const campo = await teclearClaveYConfirmar();

    await waitFor(() =>
      expect(document.querySelector(".modal.modal-open")).toBeNull(),
    );
    await waitFor(() => expect(campo).toHaveAttribute("aria-invalid", "true"));
    expect(campo).toHaveValue("");
    expect(
      screen.getByText("La clave de firma no es correcta."),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(campo));
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();
    // Ni la caja con la consecuencia ni un aviso flotante de error que lo repita.
    expect(
      screen.queryByText(`No se generó el documento. ${TEXTO_SERVIDOR_CLAVE}`),
    ).toBeNull();
    expect(mocks.addToast).not.toHaveBeenCalledWith("error", expect.anything());

    // Escribir de nuevo retira la línea del campo.
    fireEvent.change(campo, { target: { value: "x" } });
    await waitFor(() => expect(campo).not.toHaveAttribute("aria-invalid"));
    expect(screen.queryByText("La clave de firma no es correcta.")).toBeNull();
  });

  it("APP-FIRMA-NO-RESPONDE-001: confirmación cerrada y el aviso compuesto SOLO en el aviso flotante; el campo vacío pero SIN marcar", async () => {
    mocks.modoDeFirma.mockResolvedValue({
      firmadorHabilitado: true,
      sesionCentral: true,
    });
    mocks.emitir.mockRejectedValue(
      errorDelServidor(TEXTO_SERVIDOR_NO_RESPONDE, 504, "APP-FIRMA-NO-RESPONDE-001"),
    );
    renderPagina();
    await llegarAlPaso4();
    const campo = await teclearClaveYConfirmar();

    // Un 5xx lleva además la referencia para soporte: se afirma el principio del texto. Va al aviso
    // flotante, UNA vez, y no en una caja (quick 261028-kmg).
    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(
          /^No se generó el documento\. El servicio de firma no responde/,
        ),
      ),
    );
    expect(
      mocks.addToast.mock.calls.filter(([tipo]) => tipo === "error"),
    ).toHaveLength(1);
    expect(screen.queryByText(/^No se generó el documento\./)).toBeNull();
    await waitFor(() =>
      expect(document.querySelector(".modal.modal-open")).toBeNull(),
    );
    await waitFor(() => expect(campo).toHaveValue(""));
    expect(campo).not.toHaveAttribute("aria-invalid");
  });
});

describe("GenerarDocumentoPage — salir con cambios sin guardar (UI-SPEC §5.4, D-06 del quick 261006-el5)", () => {
  /**
   * 🔴 El guardado del borrador se RETIENE con una promesa a mano: así el cambio sigue «pendiente»
   * pase lo que pase con el reloj (si el temporizador de 2 s vence durante la prueba, el PUT queda
   * en vuelo y el estado sigue siendo pendiente). Sin esto, una máquina lenta convertiría el
   * «Cancelar» en una salida sin pregunta y la prueba fallaría por el reloj, no por la regla.
   */
  const retenerGuardado = () => {
    const portero = diferida<void>();
    mocks.guardarBorrador.mockImplementation(
      async (_id: number, b: { cuerpo: string; tipoCodigo?: string | null }) => {
        llamadas.push("guardarBorrador");
        await portero.promesa;
        return {
          tipoCodigo: b.tipoCodigo || null,
          cuerpo: b.cuerpo,
          actualizadoAt: GUARDADO_AT,
        };
      },
    );
    return portero;
  };

  it("🔴 «Cancelar» con un cambio pendiente pregunta con el copy nuevo, y «Salir» guarda ANTES de volver", async () => {
    const portero = retenerGuardado();
    renderPagina();
    await elegirTipo();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Siguiente" }),
      ).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    const dialogo = await screen.findByRole("alertdialog", {
      name: TITULO_ABANDONO,
    });
    expect(within(dialogo).getByText(CUERPO_ABANDONO)).toBeInTheDocument();
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();

    // Seguir editando devuelve a la página, con el documento intacto.
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Seguir editando" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Salir" }));
    // Mientras guarda, no se va.
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();
    portero.resolver();

    expect(await screen.findByText(MARCA_BANDEJA)).toBeInTheDocument();
    expect(mocks.guardarBorrador).toHaveBeenCalledWith(
      caso.eejeId,
      expect.objectContaining({ tipoCodigo: TIPO.codigo }),
    );
  });

  it("el botón «atrás» con un cambio pendiente también pregunta, en vez de irse", async () => {
    retenerGuardado();
    renderPagina();
    await elegirTipo();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Siguiente" }),
      ).not.toBeDisabled(),
    );

    window.dispatchEvent(new PopStateEvent("popstate"));

    const dialogo = await screen.findByRole("alertdialog", {
      name: TITULO_ABANDONO,
    });
    expect(within(dialogo).getByText(CUERPO_ABANDONO)).toBeInTheDocument();
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();
  });

  it("sin nada redactado, «Cancelar» vuelve sin preguntar", async () => {
    // Un tipo SIN borrador: se elige la clase y el cuerpo sigue vacío.
    mocks.tipos.mockResolvedValue([{ ...TIPO, borrador: undefined }]);
    renderPagina();
    await elegirTipo();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByText(MARCA_BANDEJA)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

// ── EL BORRADOR GUARDADO EN EL SERVIDOR (quick 261006-el5, D-01…D-06) ─────────────────────────

/** Otro tipo con plantilla, para cambiar la firma del borrador sin tocar el cuerpo. */
const TIPO_OTRO: TipoProvidenciaDisponible = {
  codigo: "ATENCION_A_ESCRITO",
  nombre: "Atención a escrito",
  activo: true,
  disponible: true,
  borrador: "<p>Plantilla de atención a escrito.</p>",
};

const CUERPO_GUARDADO = "<p>Lo que dejé escrito ayer por la tarde.</p>";
const TEXTO_GUARDADO = "Lo que dejé escrito ayer por la tarde.";
const BORRADOR_GUARDADO = {
  tipoCodigo: TIPO.codigo,
  cuerpo: CUERPO_GUARDADO,
  actualizadoAt: GUARDADO_AT,
};
const AVISO_RECUPERACION = "Se recuperó el borrador del 06-10 a las 14:32";

/** Deja pasar el retardo del autoguardado con los relojes falsos. */
const dejarPasar = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe("GenerarDocumentoPage — el borrador guardado en el servidor (quick 261006-el5)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("🔴 al volver con borrador: aviso, tipo y cuerpo recuperados, sin plantilla y sin PUT por recuperar", async () => {
    mocks.leerBorrador.mockResolvedValue(BORRADOR_GUARDADO);
    renderPagina();

    expect(await screen.findByText(AVISO_RECUPERACION)).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de providencia")).toHaveValue(
      TIPO.codigo,
    );
    expect(await screen.findByText(TEXTO_GUARDADO)).toBeInTheDocument();
    // La plantilla del tipo NO se precargó encima: se restauró el tipo, no se «eligió».
    expect(
      screen.queryByText(/Providencia de impulso del expediente/),
    ).toBeNull();
    expect(mocks.leerBorrador).toHaveBeenCalledWith(caso.eejeId);

    await dejarPasar(5000);
    expect(mocks.guardarBorrador).not.toHaveBeenCalled();
  });

  it("🔴 mientras la lectura del borrador está pendiente no existe ni el selector ni el editor", async () => {
    const lectura = diferida<typeof BORRADOR_GUARDADO | null>();
    mocks.leerBorrador.mockReturnValue(lectura.promesa);
    renderPagina();

    await screen.findByRole("button", {
      name: "Paso 1 de 4: Información General",
    });
    await waitFor(() => expect(mocks.tipos).toHaveBeenCalled());
    expect(screen.queryByLabelText("Tipo de providencia")).toBeNull();
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();

    await act(async () => {
      lectura.resolver(BORRADOR_GUARDADO);
    });

    expect(await screen.findByLabelText("Tipo de providencia")).toHaveValue(
      TIPO.codigo,
    );
    expect(await screen.findByText(TEXTO_GUARDADO)).toBeInTheDocument();
  });

  it("🔴 lo nuevo no se pisa: tras recuperar, lo importado es lo que se guarda y lo que se ve", async () => {
    mocks.leerBorrador.mockResolvedValue(BORRADOR_GUARDADO);
    mocks.similares.mockResolvedValue({
      data: [SIMILAR],
      total: 1,
      limit: 10,
      offset: 0,
      page: 1,
      pages: 1,
    });
    renderPagina();
    await screen.findByText(AVISO_RECUPERACION);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Siguiente" }),
      ).not.toBeDisabled(),
    );
    pulsarSiguiente(); // → paso 2

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Basarse en un documento anterior/,
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Usar como base" }),
    );
    const reemplazo = await screen.findByRole("alertdialog", {
      name: "Confirmar reemplazo del texto redactado",
    });
    fireEvent.click(
      within(reemplazo).getByRole("button", { name: "Reemplazar" }),
    );

    await dejarPasar(2000);

    await waitFor(() =>
      expect(mocks.guardarBorrador).toHaveBeenLastCalledWith(
        caso.eejeId,
        expect.objectContaining({
          cuerpo: expect.stringContaining("Texto de la providencia anterior."),
        }),
      ),
    );
    // Lo que se VE en el editor (la sección de similares también enseña el texto, como resumen).
    const editor = document.querySelector('[contenteditable="true"]');
    expect(editor?.textContent).toContain("Texto de la providencia anterior.");
    expect(editor?.textContent).not.toContain(TEXTO_GUARDADO);
    expect(screen.queryByText(TEXTO_GUARDADO)).toBeNull();
  });

  it("con el tipo guardado ya no disponible, se recupera el cuerpo y el tipo queda vacío, y se dice", async () => {
    mocks.tipos.mockResolvedValue([
      TIPO,
      {
        ...TIPO_OTRO,
        disponible: false,
        motivoNoDisponible: "El expediente no está en el estado que exige.",
      },
    ]);
    mocks.leerBorrador.mockResolvedValue({
      ...BORRADOR_GUARDADO,
      tipoCodigo: TIPO_OTRO.codigo,
    });
    renderPagina();

    expect(await screen.findByText(AVISO_RECUPERACION)).toBeInTheDocument();
    expect(
      screen.getByText(
        "El tipo de providencia que tenía elegido ya no está disponible para este expediente: elija otro.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de providencia")).toHaveValue("");
    expect(await screen.findByText(TEXTO_GUARDADO)).toBeInTheDocument();
  });

  it("elegir un tipo con plantilla ⇒ UN PUT a los 2 s, ninguno antes, y «Borrador guardado a las HH:MM»", async () => {
    renderPagina();
    await elegirTipo();
    await waitFor(() =>
      expect(screen.getByText("Cambios sin guardar…")).toBeInTheDocument(),
    );

    await dejarPasar(1000);
    expect(mocks.guardarBorrador).not.toHaveBeenCalled();

    await dejarPasar(1000);
    await waitFor(() => expect(mocks.guardarBorrador).toHaveBeenCalledTimes(1));
    expect(mocks.guardarBorrador).toHaveBeenCalledWith(caso.eejeId, {
      cuerpo: CUERPO_PRECARGADO,
      tipoCodigo: TIPO.codigo,
    });
    expect(
      await screen.findByText("Borrador guardado a las 14:32"),
    ).toBeInTheDocument();
  });

  it("un PUT que falla se lee junto a la barra y NO abre ningún diálogo", async () => {
    mocks.guardarBorrador.mockRejectedValue(
      errorDelServidor("sin conexión con el servidor"),
    );
    renderPagina();
    await elegirTipo();

    await dejarPasar(2000);

    expect(
      await screen.findByText(
        "No se pudo guardar el borrador: sin conexión con el servidor. Se volverá a intentar con el próximo cambio.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("lectura fallida ⇒ aviso y ningún PUT aunque se escriba", async () => {
    mocks.leerBorrador.mockRejectedValue(new Error("404"));
    renderPagina();

    expect(
      await screen.findByText(
        "No se pudo comprobar si había un borrador guardado de este expediente. Para no pisarlo, lo que escriba ahora no se guardará automáticamente.",
      ),
    ).toBeInTheDocument();
    await elegirTipo();
    await dejarPasar(5000);

    expect(mocks.guardarBorrador).not.toHaveBeenCalled();
  });

  it("🔴 «Descartar borrador» pregunta; «Conservar» no toca nada; «Sí, descartar» borra y deja vacío editor y tipo", async () => {
    mocks.leerBorrador.mockResolvedValue(BORRADOR_GUARDADO);
    renderPagina();
    await screen.findByText(AVISO_RECUPERACION);

    fireEvent.click(screen.getByRole("button", { name: "Descartar borrador" }));
    let confirmacion = await screen.findByRole("alertdialog", {
      name: "Descartar el borrador",
    });
    fireEvent.click(
      within(confirmacion).getByRole("button", {
        name: "Conservar el borrador",
      }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mocks.descartarBorrador).not.toHaveBeenCalled();
    expect(screen.getByText(TEXTO_GUARDADO)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Descartar borrador" }));
    confirmacion = await screen.findByRole("alertdialog", {
      name: "Descartar el borrador",
    });
    fireEvent.click(
      within(confirmacion).getByRole("button", { name: "Sí, descartar" }),
    );

    await waitFor(() =>
      expect(mocks.descartarBorrador).toHaveBeenCalledWith(caso.eejeId),
    );
    await waitFor(() => expect(screen.queryByText(TEXTO_GUARDADO)).toBeNull());
    expect(screen.getByLabelText("Tipo de providencia")).toHaveValue("");
    expect(screen.queryByText(AVISO_RECUPERACION)).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("si descartar falla, el motivo sale en el aviso flotante (sin caja) y la confirmación del descarte sigue abierta (quick 261028-kmg)", async () => {
    mocks.leerBorrador.mockResolvedValue(BORRADOR_GUARDADO);
    mocks.descartarBorrador.mockRejectedValue(
      errorDelServidor("El borrador ya no existe."),
    );
    renderPagina();
    await screen.findByText(AVISO_RECUPERACION);

    fireEvent.click(screen.getByRole("button", { name: "Descartar borrador" }));
    const confirmacion = await screen.findByRole("alertdialog", {
      name: "Descartar el borrador",
    });
    fireEvent.click(
      within(confirmacion).getByRole("button", { name: "Sí, descartar" }),
    );

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "No se pudo descartar el borrador: El borrador ya no existe.",
      ),
    );
    expect(
      screen.getByRole("alertdialog", { name: "Descartar el borrador" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No se pudo descartar el borrador: El borrador ya no existe."),
    ).toBeNull();
    expect(screen.getByText(TEXTO_GUARDADO)).toBeInTheDocument();
  });

  it("con todo guardado, «Cancelar» vuelve a la bandeja SIN preguntar", async () => {
    renderPagina();
    await elegirTipo();
    await dejarPasar(2000);
    await screen.findByText("Borrador guardado a las 14:32");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByText(MARCA_BANDEJA)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("con todo guardado, el botón «atrás» vuelve a la bandeja SIN preguntar", async () => {
    renderPagina();
    await elegirTipo();
    await dejarPasar(2000);
    await screen.findByText("Borrador guardado a las 14:32");

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByText(MARCA_BANDEJA)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("si el guardado al salir falla, el diálogo lo dice y ofrece «Salir sin guardar»", async () => {
    const portero = diferida<void>();
    mocks.guardarBorrador.mockImplementation(async () => {
      llamadas.push("guardarBorrador");
      await portero.promesa;
      throw new Error("el servidor no responde");
    });
    renderPagina();
    await elegirTipo();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Siguiente" }),
      ).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialogo = await screen.findByRole("alertdialog", {
      name: TITULO_ABANDONO,
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salir" }));
    await act(async () => {
      portero.resolver();
    });

    expect(
      await screen.findByText(CUERPO_ABANDONO_SIN_GUARDAR),
    ).toBeInTheDocument();
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();

    fireEvent.click(
      await screen.findByRole("button", { name: "Salir sin guardar" }),
    );
    expect(await screen.findByText(MARCA_BANDEJA)).toBeInTheDocument();
  });

  it("🔴 la salvaguarda de «atrás» empuja UNA entrada de historial aunque haya varios ciclos de guardado", async () => {
    mocks.tipos.mockResolvedValue([TIPO, TIPO_OTRO]);
    const empujar = vi.spyOn(window.history, "pushState");
    renderPagina();
    await elegirTipo();
    await dejarPasar(2000);
    await screen.findByText("Borrador guardado a las 14:32");

    // Cambiar el tipo cambia la firma del borrador sin tocar el cuerpo: pendiente → guardado.
    for (const codigo of [TIPO_OTRO.codigo, TIPO.codigo, TIPO_OTRO.codigo]) {
      fireEvent.change(screen.getByLabelText("Tipo de providencia"), {
        target: { value: codigo },
      });
      await screen.findByText("Cambios sin guardar…");
      await dejarPasar(2000);
      await screen.findByText("Borrador guardado a las 14:32");
    }

    expect(mocks.guardarBorrador).toHaveBeenCalledTimes(4);
    expect(empujar).toHaveBeenCalledTimes(1);
    empujar.mockRestore();
  });

  it("🔴 emitir con éxito: después del POST no sale ningún PUT más y se vuelve a la bandeja", async () => {
    renderPagina();
    await llegarAlPaso4();

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    fireEvent.click(
      await overlayConfirmacion().findByRole("button", {
        name: "Generar documento",
      }),
    );

    expect(await screen.findByText(MARCA_BANDEJA)).toBeInTheDocument();
    await dejarPasar(5000);

    const tras = llamadas.slice(llamadas.indexOf("emitir") + 1);
    expect(llamadas).toContain("emitir");
    expect(tras).not.toContain("guardarBorrador");
  });
});

describe("GenerarDocumentoPage — «basarse en un documento anterior» (D-04, T-03.19-68)", () => {
  it("🔴 la sección recibe el cuerpo VIVO: importar sobre lo escrito PIDE confirmación", async () => {
    mocks.similares.mockResolvedValue({
      data: [SIMILAR],
      total: 1,
      limit: 10,
      offset: 0,
      page: 1,
      pages: 1,
    });

    renderPagina();
    await elegirTipo();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Siguiente" }),
      ).not.toBeDisabled(),
    );
    pulsarSiguiente(); // → paso 2, donde vive la sección

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Basarse en un documento anterior/,
      }),
    );

    // La consulta sale con la CLASE elegida en el paso 1: sin ella el endpoint responde 400.
    await waitFor(() =>
      expect(mocks.similares).toHaveBeenCalledWith(
        expect.objectContaining({ tipoCodigo: TIPO.codigo }),
      ),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Usar como base" }),
    );

    // 🔴 AQUÍ ESTÁ TODO. La sección solo pregunta si `cuerpoActual` trae texto. Si el marco le
    // pasara `""` por comodidad, el reemplazo se aplicaría en silencio y esta aserción caería —
    // que es exactamente el aviso que el plan 15 dejó escrito.
    expect(
      await screen.findByRole("alertdialog", {
        name: "Confirmar reemplazo del texto redactado",
      }),
    ).toBeInTheDocument();
  });
});

// ── LA PRUEBA EXIGIDA CIERRA EL PASO 1 (UAT 03.15 paso 8, quick 261006-dw9) ──────────────────

/** El tipo 3: exige el comprobante del pago de la multa. Mismo borrador, para que el cuerpo no falte. */
const TIPO_PAGO: TipoProvidenciaDisponible = {
  codigo: "ARCHIVO_POR_PAGO_O_CONVENIO_DE_PAGO",
  nombre: "Archivo por pago o convenio de pago",
  activo: true,
  disponible: true,
  borrador: CUERPO_PRECARGADO,
};

/** Texto del contrato, ESCRITO A MANO (ver el comentario de `TEXTO_FIRMA_APAGADA`). */
const MOTIVO_COMPROBANTE =
  "Adjunte el comprobante del pago de la multa, con su fecha y su número de transacción, para continuar.";

const elegirTipoPorCodigo = async (codigo: string) =>
  fireEvent.change(await screen.findByLabelText("Tipo de providencia"), {
    target: { value: codigo },
  });

/** Aporta las tres piezas del comprobante: la fecha, la transacción y el PDF. */
const aportarComprobante = () => {
  fireEvent.change(screen.getByLabelText("Fecha del pago"), {
    target: { value: "2026-09-01" },
  });
  fireEvent.change(screen.getByLabelText("Nro. de transacción"), {
    target: { value: "TX-0001" },
  });
  fireEvent.change(screen.getByLabelText(/Comprobante \(PDF/), {
    target: {
      files: [
        new File(["%PDF-1.4"], "comprobante.pdf", { type: "application/pdf" }),
      ],
    },
  });
};

/** El motivo, leído donde lo lee el decisor: el texto de estado junto a la barra. */
const motivoVisible = (texto: string) =>
  screen.queryAllByRole("status").some((n) => n.textContent === texto);

const botonPaso = (nombre: string) =>
  screen.getByRole("button", { name: nombre });

describe("GenerarDocumentoPage — la prueba exigida cierra el paso 1 (UAT 03.15 paso 8, quick 261006-dw9)", () => {
  beforeEach(() => {
    mocks.tipos.mockResolvedValue([TIPO, TIPO_PAGO]);
  });

  it("🔴 con el tipo 3 y sin comprobante, «Siguiente» está apagado y dice qué adjuntar", async () => {
    renderPagina();
    await elegirTipoPorCodigo(TIPO_PAGO.codigo);

    await waitFor(() => expect(motivoVisible(MOTIVO_COMPROBANTE)).toBe(true));
    const siguiente = screen.getByRole("button", { name: "Siguiente" });
    expect(siguiente).toBeDisabled();
    expect(siguiente).toHaveAttribute("title", MOTIVO_COMPROBANTE);

    pulsarSiguiente();
    expect(
      screen.getByRole("region", { name: "Paso 1 de 4: Información General" }),
    ).toBeInTheDocument();
  });

  it("al aportar fecha, transacción y PDF, el motivo se va y «Siguiente» lleva al paso 2", async () => {
    renderPagina();
    await elegirTipoPorCodigo(TIPO_PAGO.codigo);
    await waitFor(() => expect(motivoVisible(MOTIVO_COMPROBANTE)).toBe(true));

    aportarComprobante();

    await waitFor(() => expect(motivoVisible(MOTIVO_COMPROBANTE)).toBe(false));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled(),
    );
    pulsarSiguiente();
    expect(
      await screen.findByRole("region", {
        name: "Paso 2 de 4: Edición del Documento",
      }),
    ).toBeInTheDocument();
  });

  it("si el comprobante YA CONSTA en el expediente, el paso 1 no se cierra por él", async () => {
    mocks.estadoPago.mockResolvedValue({
      eejeId: caso.eejeId,
      eejeStatus: "EN_VERIFICACION_PAGO",
      pagoAt: "2026-09-01",
      transaccion: "TX-0001",
      pagoDocId: 5,
    });
    renderPagina();
    await elegirTipoPorCodigo(TIPO_PAGO.codigo);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled(),
    );
    pulsarSiguiente();
    expect(
      await screen.findByRole("region", {
        name: "Paso 2 de 4: Edición del Documento",
      }),
    ).toBeInTheDocument();
  });

  it("🔴 tampoco se sale pulsando el stepper: el paso 2 está apagado y dice qué adjuntar", async () => {
    renderPagina();
    await elegirTipoPorCodigo(TIPO_PAGO.codigo);

    await waitFor(() =>
      expect(botonPaso("Paso 2 de 4: Edición del Documento")).toHaveAttribute(
        "title",
        MOTIVO_COMPROBANTE,
      ),
    );
    expect(botonPaso("Paso 2 de 4: Edición del Documento")).toBeDisabled();
  });

  it("🔴 el máximo ganado NO es una puerta trasera: paso 4 → volver → tipo 3 → los pasos siguientes se cierran", async () => {
    renderPagina();
    await llegarAlPaso4();

    fireEvent.click(botonPaso("Paso 1 de 4: Información General"));
    await elegirTipoPorCodigo(TIPO_PAGO.codigo);

    await waitFor(() =>
      expect(botonPaso("Paso 4 de 4: Firma")).toHaveAttribute(
        "title",
        MOTIVO_COMPROBANTE,
      ),
    );
    for (const nombre of [
      "Paso 2 de 4: Edición del Documento",
      "Paso 3 de 4: Notificación",
      "Paso 4 de 4: Firma",
    ]) {
      expect(botonPaso(nombre)).toBeDisabled();
      expect(botonPaso(nombre)).toHaveAttribute("title", MOTIVO_COMPROBANTE);
    }
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();

    // Reparada la condición, el derecho ganado VUELVE sin pasar otra vez por «Siguiente».
    aportarComprobante();
    await waitFor(() => expect(botonPaso("Paso 4 de 4: Firma")).toBeEnabled());
    fireEvent.click(botonPaso("Paso 4 de 4: Firma"));
    expect(
      await screen.findByRole("button", { name: "Generar documento" }),
    ).toBeInTheDocument();
  });
});

// ── «GENERAR DOCUMENTO» APAGADO DICE QUÉ FALTA (UAT 03.15 paso 8, quick 261006-dw9) ──────────

/** Un tipo que devuelve por nulidad: exige elegir el destino, y esa puerta NO cierra el paso 1. */
const TIPO_NULIDAD: TipoProvidenciaDisponible = {
  codigo: "DEVOLUCION_POR_NULIDAD",
  nombre: "Devolución por nulidad",
  activo: true,
  disponible: true,
  accionEpas: "DEVOLVER_POR_NULIDAD",
  borrador: CUERPO_PRECARGADO,
};

/** Textos del contrato, ESCRITOS A MANO. */
const ENCABEZADO_MOTIVOS = "Todavía no se puede generar el documento:";
const MOTIVO_DESTINO =
  "Falta elegir a qué dirección vuelve el expediente. Revise el paso «Información General».";
const MOTIVO_CLAVE = "Falta escribir la clave de firma.";

describe("GenerarDocumentoPage — «Generar documento» apagado dice qué falta (quick 261006-dw9)", () => {
  it("🔴 un motivo del paso 1 se lee en el paso 4, con el paso donde se arregla", async () => {
    mocks.tipos.mockResolvedValue([TIPO, TIPO_NULIDAD]);
    renderPagina();
    await elegirTipoPorCodigo(TIPO_NULIDAD.codigo);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled(),
    );
    pulsarSiguiente(); // → 2
    pulsarSiguiente(); // → 3
    pulsarSiguiente(); // → 4

    const generar = await screen.findByRole("button", {
      name: "Generar documento",
    });
    expect(generar).toBeDisabled();
    expect(screen.getByText(ENCABEZADO_MOTIVOS)).toBeInTheDocument();
    expect(screen.getByText(MOTIVO_DESTINO)).toBeInTheDocument();
  });

  it("🔴 con el firmador encendido y sin clave, lo dice; al teclearla, se habilita", async () => {
    mocks.modoDeFirma.mockResolvedValue({ firmadorHabilitado: true });
    renderPagina();
    await llegarAlPaso4();

    const generar = screen.getByRole("button", { name: "Generar documento" });
    await waitFor(() =>
      expect(screen.getByText(MOTIVO_CLAVE)).toBeInTheDocument(),
    );
    expect(generar).toBeDisabled();

    fireEvent.change(await screen.findByLabelText("Clave de firma"), {
      target: { value: "clave-de-prueba" },
    });

    await waitFor(() => expect(screen.queryByText(MOTIVO_CLAVE)).toBeNull());
    expect(
      screen.getByRole("button", { name: "Generar documento" }),
    ).toBeEnabled();
    expect(screen.queryByText(ENCABEZADO_MOTIVOS)).toBeNull();
  });

  it("con todo en regla no se pinta el bloque de motivos", async () => {
    renderPagina();
    await llegarAlPaso4();

    expect(
      screen.getByRole("button", { name: "Generar documento" }),
    ).toBeEnabled();
    expect(screen.queryByText(ENCABEZADO_MOTIVOS)).toBeNull();
  });
});

// ── LA VUELTA A QUIEN ABRIÓ LA PÁGINA (quick 261014-kn3) ─────────────────────────────────────

/** El origen que pide la ficha de la obligación de hacer al abrir la página. */
const DESDE_OBLIGACION = "?desde=obligacion-hacer";

/** La bandeja VACÍA de verdad: el estado «no está entre los suyos», que pinta el botón de vuelta. */
const bandejaVacia = () =>
  mocks.misAsignados.mockResolvedValue({
    data: [],
    total: 0,
    limit: 100,
    offset: 0,
    page: 1,
    pages: 0,
  });

describe("GenerarDocumentoPage — la vuelta a quien la abrió (quick 261014-kn3)", () => {
  it("🔴 desde la obligación de hacer, «Cancelar» sin nada redactado vuelve a SU ficha y no a la bandeja", async () => {
    mocks.tipos.mockResolvedValue([{ ...TIPO, borrador: undefined }]);
    renderPagina(caso.eejeId ?? 0, DESDE_OBLIGACION);
    await elegirTipo();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      await screen.findByText(`${MARCA_FICHA_OBLIGACION} ${caso.eejeId}`),
    ).toBeInTheDocument();
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("🔴 desde la obligación de hacer, emitir con éxito vuelve a SU ficha", async () => {
    renderPagina(caso.eejeId ?? 0, DESDE_OBLIGACION);
    await llegarAlPaso4();

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    fireEvent.click(
      await overlayConfirmacion().findByRole("button", {
        name: "Generar documento",
      }),
    );

    expect(
      await screen.findByText(`${MARCA_FICHA_OBLIGACION} ${caso.eejeId}`),
    ).toBeInTheDocument();
    expect(screen.queryByText(MARCA_BANDEJA)).toBeNull();
  });

  it("la miga y el botón de vuelta nombran la obligación de hacer y llevan a la ficha del mismo expediente", async () => {
    bandejaVacia();
    renderPagina(999999, DESDE_OBLIGACION);

    expect(
      await screen.findByText("Este expediente no está entre los suyos"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Obligación de hacer / Generar documento"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Volver a Mis Expedientes" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Volver a la obligación de hacer" }),
    );
    expect(
      await screen.findByText(`${MARCA_FICHA_OBLIGACION} 999999`),
    ).toBeInTheDocument();
  });

  it.each([
    "?desde=https://malicioso.example",
    "?desde=//malicioso.example",
    "?desde=/home/otra-cosa",
    "?desde=constructor",
    "?volver=https://malicioso.example",
  ])("🔴 con %s la vuelta es la bandeja, como siempre", async (sufijo) => {
    bandejaVacia();
    renderPagina(999999, sufijo);

    expect(
      await screen.findByText("Este expediente no está entre los suyos"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mis Expedientes / Generar documento"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Volver a Mis Expedientes" }),
    );
    expect(await screen.findByText(MARCA_BANDEJA)).toBeInTheDocument();
  });
});

// ── EL PASO 3 NO DEJA SALIR CON UN CANAL SIN SU DATO (quick 261026-ft2) ──────────────────────

describe("GenerarDocumentoPage — el paso 3 no deja salir con un canal sin su dato (quick 261026-ft2)", () => {
  /** Las frases de `guardarFormas` del servidor, ESCRITAS A MANO. */
  const FRASE_CORREO =
    "Para notificar por correo hace falta al menos una dirección VIGENTE: agréguela antes de aceptar ese canal.";
  const FRASE_CASILLERO =
    "Para notificar por casillero judicial hace falta su número: indíquelo antes de aceptar ese canal.";
  const FRASE_FISICO =
    "Para aceptar la notificación en el domicilio hace falta la dirección del administrado.";

  /** Las casillas y campos del paso 3, que siguen en el DOM aunque el paso esté oculto. */
  const formasDelPaso3 = () =>
    within(screen.getByRole("region", { name: "Formas de notificación" }));

  /** Del paso 1 al 3, por el camino que recorre el decisor. */
  const llegarAlPaso3 = async () => {
    await elegirTipo();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Siguiente" }),
      ).not.toBeDisabled(),
    );
    pulsarSiguiente(); // → 2
    pulsarSiguiente(); // → 3
    await screen.findByRole("region", { name: "Paso 3 de 4: Notificación" });
  };

  it("🔴 casillero marcado sin número: ni «Siguiente» ni el stepper sacan del paso 3; con el número, sí", async () => {
    renderPagina();
    await llegarAlPaso3();

    fireEvent.click(
      formasDelPaso3().getByRole("checkbox", { name: /casillero/i }),
    );

    await waitFor(() => expect(motivoVisible(FRASE_CASILLERO)).toBe(true));
    const siguiente = screen.getByRole("button", { name: "Siguiente" });
    expect(siguiente).toBeDisabled();
    expect(siguiente).toHaveAttribute("title", FRASE_CASILLERO);

    pulsarSiguiente();
    expect(
      screen.getByRole("region", { name: "Paso 3 de 4: Notificación" }),
    ).toBeInTheDocument();

    const firma = botonPaso("Paso 4 de 4: Firma");
    expect(firma).toBeDisabled();
    expect(firma).toHaveAttribute("title", FRASE_CASILLERO);

    fireEvent.change(formasDelPaso3().getByLabelText("Número de casillero"), {
      target: { value: "1042" },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled(),
    );
    expect(motivoVisible(FRASE_CASILLERO)).toBe(false);
    pulsarSiguiente(); // → 4
    fireEvent.click(
      await screen.findByRole("button", { name: "Generar documento" }),
    );
    fireEvent.click(
      await overlayConfirmacion().findByRole("button", {
        name: "Generar documento",
      }),
    );

    await waitFor(() => expect(mocks.emitir).toHaveBeenCalledTimes(1));
    expect(mocks.guardarFormas).toHaveBeenCalledWith(
      caso.eejeId,
      expect.objectContaining({ aceptaCasillero: true, casillero: "1042" }),
    );
  });

  it("formas leídas ya inválidas (físico sin dirección): el paso 3 llega cerrado; desmarcar lo abre", async () => {
    mocks.formas.mockResolvedValue({
      admiId: FORMAS.admiId,
      nombre: FORMAS.nombre,
      correos: FORMAS.correos,
      casillero: FORMAS.casillero,
      aceptaCorreo: true,
      aceptaCasillero: false,
      aceptaFisico: true,
    } satisfies FormasAceptadas);
    renderPagina();
    await llegarAlPaso3();

    await waitFor(() => expect(motivoVisible(FRASE_FISICO)).toBe(true));
    const siguiente = screen.getByRole("button", { name: "Siguiente" });
    expect(siguiente).toBeDisabled();
    expect(siguiente).toHaveAttribute("title", FRASE_FISICO);
    expect(formasDelPaso3().getByText(FRASE_FISICO)).toBeInTheDocument();

    fireEvent.click(formasDelPaso3().getByRole("checkbox", { name: /físico/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled(),
    );
    expect(motivoVisible(FRASE_FISICO)).toBe(false);
  });

  it("🔴 lectura tardía: si las formas llegan inválidas con el decisor en el paso 4, «Generar documento» se apaga y dice qué revisar", async () => {
    const lectura = diferida<FormasAceptadas>();
    mocks.formas.mockReturnValue(lectura.promesa);
    renderPagina();
    await llegarAlPaso4();

    await act(async () => {
      lectura.resolver({
        ...FORMAS,
        correos: [
          {
            corrId: 2,
            email: "antiguo@ficticia.ec",
            procedencia: "ESCRITO",
            vigente: false,
          },
        ],
        aceptaCorreo: true,
      });
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generar documento" }),
      ).toBeDisabled(),
    );
    expect(
      screen.getByText(`${FRASE_CORREO} Revise el paso «Notificación».`),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    expect(mocks.guardarFormas).not.toHaveBeenCalled();
    expect(mocks.emitir).not.toHaveBeenCalled();
  });
});
