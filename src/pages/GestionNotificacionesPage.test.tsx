/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: El Gestor de Notificaciones — la pantalla (Fase 03.20, Plan 07)
 * Archivo: GestionNotificacionesPage.test.tsx
 * Responsabilidad: Fijar las conductas que sólo esta pantalla puede demostrar, porque es la única
 *   que monta a la vez la tabla, la celda del anillo, la fila expandida con sus tres tarjetas, el
 *   aviso del envío apagado y la confirmación del reenvío.
 *
 *   ── 🔴 LO QUE ESTE ARCHIVO PROTEGE, EN ORDEN DE LO QUE COSTARÍA PERDERLO ────────────────────
 *   1. **Que no haya bucle de peticiones.** La fila lleva cédula, nombres y apellidos del
 *      administrado: una tabla que se pida a sí misma en cada render no es sólo lenta, es un goteo
 *      de datos personales (T-03.20-38). Montar pide UNA vez; filtrar añade UNA.
 *   2. **Que un fallo de carga NO se lea como «no hay notificaciones»** (T-03.20-37). Es la
 *      afirmación más peligrosa que esta pantalla puede hacer: el secretario concluye que no hay
 *      nada que notificar y se va.
 *   3. **Que con cero despachos NO se anuncie un progreso que no existe** (§1.4 / A11), y que la
 *      fila expandida siga pintando sus TRES tarjetas — que es el caso de 156 de 157 filas.
 *   4. **Que el aviso del envío apagado esté cuando tiene que estar** (§5.7, D-11/D-20/D-25): lo
 *      resuelve el SERVIDOR, así que se montan las DOS variantes.
 *
 *   ── 🔴 LO QUE ESTAS PRUEBAS NO PUEDEN AFIRMAR ───────────────────────────────────────────────
 *   **jsdom no calcula CSS.** Nada de color resuelto, contraste, ancho, pliegue ni opacidad
 *   compuesta. Las diez comprobaciones humanas del contrato (§7, H1-H10) van al UAT, y fingirlas
 *   con una aserción sobre un estilo calculado sería peor que no tenerlas: daría por verificado lo
 *   que nadie ha mirado. Por eso aquí no se consulta NI UNA VEZ el estilo calculado del navegador —y
 *   el nombre de esa función no se escribe ni en este comentario, para que la comprobación de que no
 *   se usa pueda ser un `grep` que cuente CERO y no una lectura a ojo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-28
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el resultado del reenvío se afirma en el
 *   aviso flotante —ConfirmationDetail ya no lo pinta en una caja— y el diálogo sigue abierto)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-09: la fila de prueba lleva
 *   `despachoBloqueadoPorFirma: false`, que ahora es obligatorio, y una prueba fija que la página
 *   lo pasa a la tarjeta y apaga «Enviar correo» con el motivo de §10.11).
 */
import { errorDeRed } from "../test/errores";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type {
  DespachoGestor,
  GestorNotificacion,
} from "../services/NotificacionEjecucionService";

const mocks = vi.hoisted(() => ({
  gestor: vi.fn(),
  reenviarCorreo: vi.fn(),
  addToast: vi.fn(),
}));

// El servicio se dobla ENTERO y con `importOriginal`: la pantalla sólo llama a dos de sus métodos,
// pero el módulo real trae el cliente HTTP y los catálogos de formas que otras piezas importan como
// valor. Espejar el módulo y sustituir sólo los dos métodos deja todo lo demás real.
vi.mock("../services/NotificacionEjecucionService", async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import("../services/NotificacionEjecucionService")
    >();
  const servicio = {
    ...real.NotificacionEjecucionService,
    gestor: mocks.gestor,
    reenviarCorreo: mocks.reenviarCorreo,
  };
  return { ...real, NotificacionEjecucionService: servicio, default: servicio };
});

vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

// `Table.tsx` arrastra `RowActions`, y con él la cadena de modales que acaba en el visor de PDF, que
// en jsdom no tiene `DOMMatrix`. Se dobla el VISOR y no los modales: así la pantalla sigue montando
// su árbol real —que es lo que estas pruebas miran— sin cargar el lector de PDF.
vi.mock("../components/pdf/PDFViewer", () => ({
  PDFViewer: () => null,
}));

// La pantalla de formas aceptadas se dobla, no se monta: ya tiene sus propias pruebas y su cuerpo
// pide las formas al backend en cuanto aparece. Lo que ESTA pantalla tiene que demostrar es que la
// monta con el expediente de la fila correcta y que recarga la bandeja al guardar — y para eso basta
// con un doble que diga qué expediente recibió y ofrezca un disparador de «guardado».
vi.mock("../components/notificacion/FormasNotificacionModal", () => ({
  default: ({
    caso,
    onClose,
    onGuardado,
  }: {
    caso: { eejeId?: number; expNumber?: string; administrado?: string };
    onClose: () => void;
    onGuardado?: () => void;
  }) => (
    <div data-testid="formas-modal">
      <p>{`formas de ${caso.expNumber ?? "sin expediente"}`}</p>
      <button type="button" onClick={() => onGuardado?.()}>
        simular guardado de formas
      </button>
      <button type="button" onClick={onClose}>
        cerrar formas
      </button>
    </div>
  ),
}));

import GestionNotificacionesPage from "./GestionNotificacionesPage";

// ── Datos INVENTADOS. Ninguno copiado de la base: la fila lleva cédula y nombres reales. ────────

const despacho = (
  parcial: Partial<DespachoGestor> & Pick<DespachoGestor, "despId" | "forma">,
): DespachoGestor => ({
  estado: "pendiente",
  intentos: 0,
  ...parcial,
});

const fila = (
  parcial: Partial<GestorNotificacion> = {},
): GestorNotificacion => ({
  notiId: 9001,
  eejeId: 7001,
  docId: 5001,
  docName: "Providencia de archivo 001-2026",
  justificacion: "Providencia",
  especificacion: "Archivo",
  expNumber: "053-2026",
  eejeStatus: "ASIGNADO_DECISOR",
  admiIdentification: "1700000001",
  admiName: "Mariana",
  admiLastname: "Del Valle",
  emitidaAt: "2026-09-10T15:00:00.000Z",
  perfeccionadaAt: null,
  despachos: [],
  despachoBloqueadoPorFirma: false,
  ...parcial,
});

/** El sobre del Gestor: el paginado de siempre MÁS el interruptor, que viaja en la RAÍZ. */
const sobreCon = (
  filas: GestorNotificacion[],
  correoEnvioHabilitado = false,
  total = filas.length,
) => ({
  data: filas,
  total,
  limit: 10,
  offset: 0,
  page: 1,
  pages: Math.ceil(total / 10) || 0,
  correoEnvioHabilitado,
});

/** Monta la bandeja con las filas dadas y espera a que la primera carga pinte. */
const montar = async (
  filas: GestorNotificacion[],
  correoEnvioHabilitado = false,
) => {
  mocks.gestor.mockResolvedValue(sobreCon(filas, correoEnvioHabilitado));
  render(
    <MemoryRouter>
      <GestionNotificacionesPage />
    </MemoryRouter>,
  );
  if (filas.length > 0) {
    await screen.findByText(filas[0].admiIdentification);
  } else {
    await screen.findByText("No hay notificaciones registradas");
  }
};

/**
 * Las cabeceras DE TÍTULO, en orden de pintado.
 *
 * 🔴 `th[scope="col"]` y NO `getAllByRole("columnheader")`: `Table.tsx` pinta DOS filas de `<th>`
 * —la de títulos y la de filtros— y sólo la de títulos lleva `scope="col"`. Un `getAllByRole`
 * devolvería las dos entrelazadas y esta prueba afirmaría algo distinto de lo que cree.
 */
const cabeceras = () =>
  Array.from(document.querySelectorAll('th[scope="col"]')).map((th) =>
    (th.textContent ?? "").trim(),
  );

const AVISO_ENVIO_APAGADO =
  /El envío automático de correo está desactivado en este entorno/i;

const AVISO_SIN_NINGUNA_FORMA =
  /Este administrado no ha declarado ninguna forma de notificación, así que no se abrió ningún despacho/i;

/** Abre la fila de una notificación por su número de expediente. */
const expandir = (expNumber: string) => {
  fireEvent.click(
    screen.getByRole("button", {
      name: `Ver despachos de la notificación del expediente ${expNumber}`,
    }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Gestión de Notificaciones — el contrato de peticiones (T-03.20-38)", () => {
  it("🔴 al montar pide el listado UNA sola vez, con la página 1 y sin filtros", async () => {
    await montar([fila()]);

    expect(mocks.gestor).toHaveBeenCalledTimes(1);
    expect(mocks.gestor.mock.calls[0][0]).toEqual({
      pageIndex: 0,
      pageSize: 10,
      filterParams: {},
    });
  });

  it("🔴 filtrar por CI/RUC añade UNA petición, con ese filtro y la página REINICIADA", async () => {
    await montar([fila()]);
    expect(mocks.gestor).toHaveBeenCalledTimes(1);

    // El nombre accesible del control, no el `placeholder`: las siete columnas de texto comparten
    // el mismo «buscar...» y localizarlas por ahí sería localizar cualquiera de las siete.
    fireEvent.change(screen.getByLabelText("Filtrar por CI/RUC"), {
      target: { value: "1700000001" },
    });

    await waitFor(() => expect(mocks.gestor).toHaveBeenCalledTimes(2), {
      // 4 s y no 2: el debounce del filtro es de 500 ms, pero en jsdom bajo carga la cadena
      // cambio → debounce → efecto de carga → promesa ha llegado a pasar de dos segundos.
      timeout: 4000,
    });
    expect(mocks.gestor.mock.calls[1][0]).toEqual({
      pageIndex: 0,
      pageSize: 10,
      // La clave es el `id` de la columna, y el `id` es el nombre que `FiltroGestorDto` declara.
      // Una letra distinta es un 400 que no dice cuál fue.
      filterParams: { admiIdentification: "1700000001" },
    });

    // 🔴 LA MEDIDA ANTI-BUCLE: 1.200 ms de reloj REAL, más del doble del debounce. Si `columnas` o
    // `buscarNotificaciones` cambiaran de identidad por render, aquí habría ya una tercera.
    await new Promise((resolver) => setTimeout(resolver, 1200));
    expect(mocks.gestor).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Gestión de Notificaciones — las ONCE cabeceras y su filtrabilidad (§1.2 / §1.3)", () => {
  it("🔴 el conjunto de cabeceras ES el contrato: esta lista literal hay que tocarla para cambiarlo", async () => {
    // 🔴 NO SE RELAJA A UN `toContain`. Existe para que cambiar el conjunto o el orden de las
    // columnas cueste tocar esta lista y quede escrito en el diff. La primera entrada es la columna
    // de expansión, que `Table.tsx` antepone SIN título; la segunda es la numeración, que también
    // antepone ella. La página declara las nueve restantes.
    await montar([fila()]);

    expect(cabeceras()).toEqual([
      "",
      "Nro.",
      "Progreso",
      "Justificación",
      "Especificación",
      "Expediente",
      "Estatus",
      "CI/RUC",
      "Nombres",
      "Apellidos",
      "Fecha creación",
    ]);
  });

  it("«Nro.» aparece UNA sola vez: la antepone la tabla compartida, no la página", async () => {
    await montar([fila()]);

    expect(cabeceras().filter((texto) => texto === "Nro.")).toHaveLength(1);
  });

  it("🔴 PROGRESO no ofrece control de filtro: es derivada en el cliente", async () => {
    // Declararla filtrable obligaría al servidor a una subconsulta agregada, y el secretario
    // filtraría por algo que nadie calcula. Precedente exacto: la columna de plazo de «Mis
    // Expedientes».
    await montar([fila()]);

    expect(screen.queryByLabelText("Filtrar por Progreso")).toBeNull();
  });

  it("ESTATUS ofrece un desplegable cerrado y la fecha un rango con sus dos extremos", async () => {
    await montar([fila()]);

    expect(screen.getByLabelText("Filtrar por Estatus")).toBeInTheDocument();

    // El control de rango revela su extremo superior sólo cuando hay inferior: es del componente
    // compartido, y esta prueba afirma que la columna monta ESE control y no un cuadro de texto.
    const desde = screen.getByLabelText("Filtrar por Fecha creación: desde");
    expect(desde).toHaveAttribute("type", "date");
    expect(
      screen.queryByLabelText("Filtrar por Fecha creación: hasta"),
    ).toBeNull();

    fireEvent.change(desde, { target: { value: "2026-09-01" } });

    expect(
      await screen.findByLabelText("Filtrar por Fecha creación: hasta"),
    ).toHaveAttribute("type", "date");
  });

  it("las siete columnas de texto sí ofrecen su cuadro de búsqueda", async () => {
    await montar([fila()]);

    for (const cabecera of [
      "Justificación",
      "Especificación",
      "Expediente",
      "CI/RUC",
      "Nombres",
      "Apellidos",
    ]) {
      expect(
        screen.getByLabelText(`Filtrar por ${cabecera}`),
      ).toBeInTheDocument();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Gestión de Notificaciones — el anillo y su caso de cero (§1.4, D-16, A11)", () => {
  it("🔴 con DOS de TRES despachos resueltos el anillo anuncia 67", async () => {
    // D-16: `rechazado` es un despacho RESUELTO —la vía se agotó, consta su razón de imposibilidad
    // y los plazos arrancan igual—, así que suma. Con la fórmula literal de Resolución esta fila
    // saldría 33 %, y con las tres vías agotadas saldría 0 % en rojo.
    await montar([
      fila({
        despachos: [
          despacho({ despId: 1, forma: "CASILLERO", estado: "notificado" }),
          despacho({ despId: 2, forma: "FISICO", estado: "rechazado" }),
          despacho({ despId: 3, forma: "CORREO", estado: "pendiente" }),
        ],
      }),
    ]);

    const anillo = screen.getByRole("progressbar");
    expect(anillo).toHaveAttribute("aria-valuenow", "67");
  });

  it("🔴 con CERO despachos NO hay ninguna barra de progreso, y sí el texto que lo explica", async () => {
    // Un anillo de 0 % en rojo diría «nadie ha hecho nada, actúe» y es falso: no hay ningún canal
    // que despachar. Es el caso de 156 de 157 administrados, no un borde.
    await montar([fila({ despachos: [] })]);

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("Sin despachos")).toBeInTheDocument();
  });

  it("el conteo del anillo se dice EN PALABRAS en su burbuja, no sólo en el número", async () => {
    // A1/A11: ningún significado depende sólo del color, y el número de dentro del anillo falla
    // contraste en un tema (deuda D-24). La burbuja es una de las tres capas que lo compensan.
    await montar([
      fila({
        despachos: [
          despacho({ despId: 1, forma: "CASILLERO", estado: "notificado" }),
          despacho({ despId: 2, forma: "CORREO", estado: "pendiente" }),
        ],
      }),
    ]);

    expect(
      document.querySelector('[data-tip="1 de 2 despachos resueltos"]'),
    ).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Gestión de Notificaciones — el vacío y el fallo NO son lo mismo (T-03.20-37)", () => {
  it("sin notificaciones lo dice, y NO ofrece reintentar", async () => {
    mocks.gestor.mockResolvedValue(sobreCon([]));
    render(
      <MemoryRouter>
        <GestionNotificacionesPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("No hay notificaciones registradas"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });

  it("🔴 si la carga FALLA lo dice, enseña el motivo del servidor y NO afirma que no haya notificaciones", async () => {
    mocks.gestor.mockRejectedValue(errorDeRed());
    render(
      <MemoryRouter>
        <GestionNotificacionesPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/No se pudieron cargar las notificaciones/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No se pudo conectar con el servidor/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Network Error/)).toBeNull();

    // 🔴 LA AFIRMACIÓN QUE IMPORTA. El vacío sigue en el DOM —la tabla no se desmonta, para no
    // perder los filtros ni la página— pero está OCULTO con el atributo: ni se ve, ni lo anuncia un
    // lector de pantalla.
    expect(
      screen.getByText("No hay notificaciones registradas"),
    ).not.toBeVisible();
  });

  it("🔴 «Reintentar» vuelve a pedir SIN remontar, y al responder bien el aviso desaparece", async () => {
    mocks.gestor
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValue(sobreCon([fila()]));

    render(
      <MemoryRouter>
        <GestionNotificacionesPage />
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "Reintentar" });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() =>
      expect(
        screen.queryByText(/No se pudieron cargar las notificaciones/i),
      ).toBeNull(),
    );
    expect(mocks.gestor).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Gestión de Notificaciones — el aviso del envío apagado (§5.7, D-11/D-20/D-25)", () => {
  it("🔴 con el interruptor en FALSO el aviso aparece UNA vez, y no se puede cerrar", async () => {
    await montar(
      [
        fila(),
        fila({
          notiId: 9002,
          expNumber: "054-2026",
          admiIdentification: "1700000002",
        }),
      ],
      false,
    );

    const avisos = screen.getAllByText(AVISO_ENVIO_APAGADO);
    // Una línea POR PÁGINA, no por fila: con dos filas sigue habiendo uno.
    expect(avisos).toHaveLength(1);
    // No hay aspa ni «Entendido»: D-11 pide que el modo quede visible, no disimulado.
    expect(
      screen.queryByRole("button", { name: /cerrar aviso|entendido/i }),
    ).toBeNull();
  });

  it("🔴 con el interruptor en CIERTO el aviso NO aparece: lo resuelve el servidor", async () => {
    await montar([fila()], true);

    expect(screen.queryByText(AVISO_ENVIO_APAGADO)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Gestión de Notificaciones — las celdas de las nueve columnas declaradas", () => {
  it("el chip de ESTATUS muestra la etiqueta legible, no el valor crudo, y no se capitaliza por palabra", async () => {
    await montar([fila({ eejeStatus: "EN_VERIFICACION_PAGO" })]);

    const chip = screen.getByText("En verificación de pago");
    expect(chip).toBeInTheDocument();
    expect(screen.queryByText("EN_VERIFICACION_PAGO")).toBeNull();
    // Varias etiquetas son frases; con el `capitalize` por defecto el CSS las rompería en
    // «En Verificación De Pago».
    expect(chip.className).not.toMatch(/\bcapitalize\b/);
  });

  it("🔴 las dos columnas traducidas se pintan como TEXTO, no como enlace (D-22)", async () => {
    // El analog las pinta con color de acento y de semántica, y es lo que se ve en la captura. Azul
    // y semifuerte en una tabla ES un enlace, y aquí no navega: la prueba de que miente es que el
    // propio ROADMAP del proyecto lo leyó como enlace.
    await montar([
      fila({ justificacion: "Providencia", especificacion: "Inicio de coactiva" }),
    ]);

    const justificacion = screen.getByText("Providencia");
    const especificacion = screen.getByText("Inicio de coactiva");

    expect(justificacion.closest("a")).toBeNull();
    expect(especificacion.closest("a")).toBeNull();
    expect(justificacion.className).not.toMatch(/text-(primary|secondary)/);
    expect(especificacion.className).not.toMatch(/text-(primary|secondary)/);
    // El peso es lo único que las ordena, y es uno de los dos declarados por el sistema.
    expect(justificacion.className).toMatch(/\bfont-bold\b/);
  });

  it("toda celda de texto sin valor cae a un guion: una celda vacía haría creer que el dato no existe", async () => {
    await montar([fila({ especificacion: null, expNumber: null })]);

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("la fecha de creación usa el formato denso de la columna, no la fecha corta de la tarjeta", async () => {
    await montar([fila({ emitidaAt: "2026-09-10T15:00:00.000Z" })]);

    expect(screen.getByText("10/09/2026")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Gestión de Notificaciones — la fila expandida y sus TRES tarjetas (§2.2 / §2.5.3)", () => {
  it("🔴 el disparador de la fila lleva nombre accesible CON el expediente, y cambia al abrir", async () => {
    // Hoy ese botón se anuncia literalmente «botón», diez veces por página: es el mismo defecto que
    // la Fase 03.19 arregló en la columna de acciones, y la razón de que la prop exista.
    await montar([fila({ expNumber: "053-2026" })]);

    const disparador = screen.getByRole("button", {
      name: "Ver despachos de la notificación del expediente 053-2026",
    });
    fireEvent.click(disparador);

    expect(
      screen.getByRole("button", {
        name: "Ocultar despachos de la notificación del expediente 053-2026",
      }),
    ).toBeInTheDocument();
  });

  it("🔴 con la lista de despachos VACÍA se pintan igual TRES tarjetas, en el orden fijo del catálogo", async () => {
    // Es el caso de 156 de 157 administrados. Copiar el render del analog daría una fila expandida
    // con CERO tarjetas y un vacío genérico que no explica nada y parece una pantalla rota.
    await montar([fila({ despachos: [] })]);
    expandir("053-2026");

    const tarjetas = screen.getAllByRole("article");
    expect(tarjetas).toHaveLength(3);
    expect(tarjetas.map((t) => t.querySelector("h5")?.textContent)).toEqual([
      "Casillero Judicial",
      "Dirección Física",
      "Correo Electrónico",
    ]);
  });

  it("🔴 la tarjeta sin despacho pinta la frase del hueco y NINGÚN botón de acción", async () => {
    await montar([fila({ despachos: [] })]);
    expandir("053-2026");

    expect(
      screen.getAllByText(
        "El administrado no ha declarado esta forma de notificación.",
      ),
    ).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /^Registrar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Enviar correo/ })).toBeNull();
  });

  it("🔴 con las TRES formas sin declarar el panel añade la explicación UNA vez, con su control", async () => {
    // No es adorno: es el hueco que hay que VER y no disimular, dicho en la pantalla en vez de en un
    // registro del servidor. Sin el control, en 156 de 157 filas el secretario leería la explicación
    // sin nada que pulsar.
    await montar([fila({ despachos: [] })]);
    expandir("053-2026");

    expect(screen.getAllByText(AVISO_SIN_NINGUNA_FORMA)).toHaveLength(1);
    expect(
      screen.getByRole("button", {
        name: "Ver las formas de notificación aceptadas del expediente 053-2026",
      }),
    ).toBeInTheDocument();
  });

  it("con ALGUNA forma declarada el panel NO añade la explicación de las tres", async () => {
    await montar([
      fila({
        despachos: [
          despacho({ despId: 11, forma: "CORREO", correo: "a@b.ec" }),
        ],
      }),
    ]);
    expandir("053-2026");

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.queryByText(AVISO_SIN_NINGUNA_FORMA)).toBeNull();
  });

  it("los despachos se reparten por forma: la tarjeta no filtra, la reparte la página", async () => {
    await montar([
      fila({
        despachos: [
          despacho({
            despId: 21,
            forma: "CASILLERO",
            estado: "notificado",
            resueltoAt: "2026-09-10T15:00:00.000Z",
            intentos: 1,
          }),
          despacho({ despId: 22, forma: "CORREO", correo: "x@y.ec" }),
        ],
      }),
    ]);
    expandir("053-2026");

    const [casillero, fisico, correo] = screen.getAllByRole("article");
    // El rótulo de la fecha lo decide la FORMA: los canales físicos dicen «Entrega».
    expect(casillero.textContent).toMatch(/Entrega: 10 sept 2026/);
    expect(casillero.textContent).toMatch(/Intentos: 1/);
    expect(fisico.textContent).toMatch(
      /El administrado no ha declarado esta forma/,
    );
    expect(correo.textContent).toMatch(/Pendiente/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Gestión de Notificaciones — la confirmación del reenvío (§3, T-03.20-35)", () => {
  /** Una fila con un despacho de correo PENDIENTE, que es el único caso que enciende el botón. */
  const filaConCorreoPendiente = () =>
    fila({
      despachos: [
        despacho({
          despId: 777,
          forma: "CORREO",
          correo: "mariana@ejemplo.ec",
          estado: "pendiente",
          intentos: 1,
        }),
      ],
    });

  /** Expande la fila y pulsa el botón de enviar correo. Exige el envío HABILITADO. */
  const pedirReenvio = async () => {
    await montar([filaConCorreoPendiente()], true);
    expandir("053-2026");
    fireEvent.click(
      screen.getByRole("button", { name: /^Enviar correo — Correo Electrónico/ }),
    );
    return screen.findByText("Reenviar la notificación por correo");
  };

  it("🔴 el diálogo dice la CONSECUENCIA antes: que los términos empiezan a correr", async () => {
    await pedirReenvio();

    expect(
      screen.getByText(
        /Si el envío se acepta, la notificación queda perfeccionada y los términos empiezan a correr desde hoy/i,
      ),
    ).toBeInTheDocument();
    // La ficha de datos: expediente, documento, correo e intentos.
    expect(screen.getByText("mariana@ejemplo.ec")).toBeInTheDocument();
    expect(
      screen.getByText("Providencia de archivo 001-2026"),
    ).toBeInTheDocument();
    // Y no es un diálogo del navegador.
    expect(mocks.reenviarCorreo).not.toHaveBeenCalled();
  });

  it("cerrar el diálogo sin confirmar NO dispara ninguna petición", async () => {
    await pedirReenvio();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(
        screen.queryByText("Reenviar la notificación por correo"),
      ).toBeNull(),
    );
    expect(mocks.reenviarCorreo).not.toHaveBeenCalled();
    expect(mocks.gestor).toHaveBeenCalledTimes(1);
  });

  it("🔴 ACEPTADO: avisa del éxito, cierra el diálogo y recarga la bandeja sin remontar", async () => {
    mocks.reenviarCorreo.mockResolvedValue({
      resultado: "notificado",
      intentos: 2,
      correo: "mariana@ejemplo.ec",
      razonDocId: 9100,
    });
    await pedirReenvio();

    fireEvent.click(screen.getByRole("button", { name: "Sí, reenviar" }));

    await waitFor(() =>
      expect(
        screen.queryByText("Reenviar la notificación por correo"),
      ).toBeNull(),
    );
    expect(mocks.reenviarCorreo).toHaveBeenCalledWith(777);
    expect(mocks.addToast).toHaveBeenCalledWith(
      "success",
      "Notificación enviada a mariana@ejemplo.ec. El despacho queda notificado y consta la razón de envío en el expediente.",
    );
    // La recarga NO remonta la tabla: conserva filtros y página.
    expect(mocks.gestor).toHaveBeenCalledTimes(2);
  });

  /**
   * 🔴 CR-05 (revisión de la Fase 03.20) — ESTA PRUEBA AFIRMABA UN TEXTO FALSO.
   *
   * Fijaba, verbatim, que el aviso dijera «El despacho sigue pendiente … y vuelva a intentarlo»,
   * cuando el backend RESUELVE el despacho como `rechazado` y su cuarta guarda rechaza con un 400
   * cualquier reintento de una vía resuelta. Y afirmaba que la tabla NO se recargaba, con lo que la
   * tarjeta se quedaba diciendo «Pendiente» sobre una vía agotada.
   *
   * Lo que se afirma ahora es lo que de verdad pasa: la vía queda agotada, consta su razón, nadie
   * quedó notificado, lo que hay que hacer es corregir la dirección (un despacho NUEVO), el diálogo
   * sigue abierto con su aviso y la fila SÍ se refresca.
   */
  it("🔴 CR-05 RECHAZADO: el aviso dice que la vía queda AGOTADA, el diálogo sigue abierto y la fila SÍ se refresca", async () => {
    mocks.reenviarCorreo.mockResolvedValue({
      resultado: "rechazado",
      intentos: 2,
      correo: "mariana@ejemplo.ec",
      razonDocId: 9101,
    });
    await pedirReenvio();

    fireEvent.click(screen.getByRole("button", { name: "Sí, reenviar" }));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "El servicio de correo rechazó mariana@ejemplo.ec. La vía queda AGOTADA: el despacho pasa a «rechazado» y consta su razón de imposibilidad en el expediente. Nadie quedó notificado por correo. Si la dirección era incorrecta, corríjala en las formas de notificación: la vía corregida es un despacho NUEVO, no un reintento de éste.",
      ),
    );
    expect(
      screen.getByText("Reenviar la notificación por correo"),
    ).toBeInTheDocument();
    // 🔴 El despacho quedó RESUELTO: si la tabla no se refrescara, su chip seguiría diciendo
    // «Pendiente» y el anillo mantendría su porcentaje viejo mientras la base dice lo contrario.
    await waitFor(() => expect(mocks.gestor).toHaveBeenCalledTimes(2));
  });

  // 🔴 CR-05 — la contraprueba de la copy: el aviso NO puede invitar a un reintento que la cuarta
  // guarda de `reenviarCorreo` refuta con un 400, ni afirmar un estado que ya no es el del despacho.
  it("🔴 CR-05 el aviso del rechazo NO dice «sigue pendiente» ni invita a volver a intentarlo", async () => {
    mocks.reenviarCorreo.mockResolvedValue({
      resultado: "rechazado",
      intentos: 2,
      correo: "mariana@ejemplo.ec",
      razonDocId: 9101,
    });
    await pedirReenvio();

    fireEvent.click(screen.getByRole("button", { name: "Sí, reenviar" }));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        expect.stringMatching(/La vía queda AGOTADA/),
      ),
    );
    const aviso = String(
      mocks.addToast.mock.calls.find(([, texto]) =>
        /La vía queda AGOTADA/.test(String(texto)),
      )?.[1],
    );
    expect(aviso).not.toMatch(/sigue pendiente/i);
    expect(aviso).not.toMatch(/vuelva a intentarlo/i);
  });

  /**
   * 🔴 WR-07 (revisión de la Fase 03.20) — esta prueba fijaba «Vuelva a intentarlo en unos minutos»
   * verbatim, sin advertir que el único control capaz de hacerlo queda GRIS: `ConfirmationDetail`
   * apaga su botón de confirmar en cuanto hay mensaje, y esta pantalla deja el diálogo abierto a
   * propósito. Ahora se afirma la instrucción ejecutable —cerrar el aviso y volver a pulsar— y,
   * además, que el botón está de hecho deshabilitado: es lo que hacía falsa la copy anterior.
   */
  it("🔴 WR-07 NO CONFIRMABLE: el diálogo sigue abierto, el botón queda APAGADO y la copy dice qué hacer", async () => {
    mocks.reenviarCorreo.mockResolvedValue({
      resultado: "parcial",
      intentos: 2,
      correo: "mariana@ejemplo.ec",
    });
    await pedirReenvio();

    fireEvent.click(screen.getByRole("button", { name: "Sí, reenviar" }));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "warning",
        "No se pudo confirmar el envío a mariana@ejemplo.ec. El intento quedó contado y el despacho sigue pendiente: nadie quedó notificado. Cierre este aviso y vuelva a pulsar «Enviar correo» en unos minutos.",
      ),
    );
    expect(
      screen.getByText("Reenviar la notificación por correo"),
    ).toBeInTheDocument();
    // 🔴 LA ASERCIÓN QUE FALTABA: con el aviso puesto, confirmar está apagado. Una copy que dijera
    // «vuelva a intentarlo» sin más mandaría al secretario a un botón inerte.
    expect(screen.getByRole("button", { name: "Sí, reenviar" })).toBeDisabled();
  });

  it("🔴 SERVICIO CAÍDO: el cuarto camino NO llega por el valor de retorno, llega por el rechazo", async () => {
    // En el camino manual un servicio de correo caído responde con error HTTP, así que la promesa se
    // RECHAZA: quien llama tiene que distinguir cuatro caminos, no tres.
    mocks.reenviarCorreo.mockRejectedValue(new Error("ECONNREFUSED"));
    await pedirReenvio();

    fireEvent.click(screen.getByRole("button", { name: "Sí, reenviar" }));

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        "error",
        "No se pudo contactar con el servicio de correo. El despacho sigue pendiente y no se ha notificado a nadie. Vuelva a intentarlo más tarde.",
      ),
    );
    expect(
      screen.getByText("Reenviar la notificación por correo"),
    ).toBeInTheDocument();
  });

  it("🔴 Fase 03.21 (D-09): la fila con `despachoBloqueadoPorFirma` apaga «Enviar correo» con el envío ENCENDIDO", async () => {
    await montar(
      [{ ...filaConCorreoPendiente(), despachoBloqueadoPorFirma: true }],
      true,
    );
    expandir("053-2026");

    const boton = screen.getByRole("button", {
      name: /^Enviar correo — Correo Electrónico/,
    });
    expect(boton).toBeDisabled();
    expect(boton.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      "No se despacha: el documento notificado requería firma y no la tiene. Avise a soporte.",
    );
    fireEvent.click(boton);
    expect(
      screen.queryByText("Reenviar la notificación por correo"),
    ).toBeNull();
  });

  it("🔴 con el envío APAGADO el botón de correo está apagado y no se puede pedir nada", async () => {
    await montar([filaConCorreoPendiente()], false);
    expandir("053-2026");

    const boton = screen.getByRole("button", {
      name: /^Enviar correo — Correo Electrónico/,
    });
    expect(boton).toBeDisabled();
    // Y el motivo es alcanzable desde el ENVOLTORIO, nunca desde el botón apagado.
    expect(boton.closest("[data-tip]")?.getAttribute("data-tip")).toMatch(
      /El envío de correo está desactivado en este entorno/i,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe("Gestión de Notificaciones — el salto a la pantalla de formas (D-21)", () => {
  it("🔴 se monta con el expediente de ESA fila, y al guardar recarga la bandeja", async () => {
    await montar([
      fila({ expNumber: "053-2026", despachos: [] }),
      fila({
        notiId: 9002,
        eejeId: 7002,
        expNumber: "054-2026",
        admiIdentification: "1700000002",
        despachos: [],
      }),
    ]);
    expandir("054-2026");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver las formas de notificación aceptadas del expediente 054-2026",
      }),
    );

    expect(await screen.findByTestId("formas-modal")).toBeInTheDocument();
    expect(screen.getByText("formas de 054-2026")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "simular guardado de formas" }),
    );
    await waitFor(() => expect(mocks.gestor).toHaveBeenCalledTimes(2));
  });

  it("también se llega desde una TARJETA, y cerrarlo sin guardar no pide nada", async () => {
    await montar([fila({ despachos: [] })]);
    expandir("053-2026");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver las formas de notificación aceptadas para declarar Correo Electrónico, expediente 053-2026",
      }),
    );

    expect(await screen.findByTestId("formas-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "cerrar formas" }));

    await waitFor(() =>
      expect(screen.queryByTestId("formas-modal")).toBeNull(),
    );
    expect(mocks.gestor).toHaveBeenCalledTimes(1);
  });
});
