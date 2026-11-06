/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: El Gestor de Notificaciones — el listado y el reenvío (Fase 03.20, Plan 06)
 * Archivo: NotificacionEjecucionService.test.ts
 * Responsabilidad: Fijar la FORMA DE LA PETICIÓN que este servicio manda, que es lo único que una
 *   prueba de unidad puede demostrar de un cliente HTTP: la ruta, las claves de la query y el
 *   cuerpo. El cliente va doblado; no hay red real.
 *
 *   ── 🔴 LO QUE ESTE ARCHIVO PROTEGE, EN ORDEN DE LO QUE COSTARÍA PERDERLO ────────────────────
 *   1. **Que los nombres de la query sean EXACTAMENTE los que el DTO del backend declara.** El
 *      `ValidationPipe` global corre con `forbidNonWhitelisted: true`: una clave que
 *      `FiltroGestorDto` no declare no se ignora, devuelve **400 — y el mensaje no dice cuál de los
 *      nueve filtros lo causó**. Los dos nombres del rango (`notiEmitidaAtFrom` /
 *      `notiEmitidaAtTo`) son la aserción barata que evita ese 400 opaco.
 *   2. **Que lo vacío se OMITA.** Un `?admiName=` sin valor no es «sin filtro»: es un filtro por
 *      cadena vacía, que el repositorio envolvería en `%%` devolviendo la tabla entera.
 *   3. **Que el reenvío viaje SIN CUERPO.** La dirección sale del despacho CONGELADO en la base
 *      (Plan 05): el endpoint no tiene `@Body` y no hay DTO. Mandar un cuerpo con una dirección
 *      sería ofrecer al cliente decidir a quién se notifica.
 *   4. **Que un fallo del transporte se PROPAGUE.** 🔴 En el camino manual, un servicio de correo
 *      caído responde con **error HTTP, no con un 200** (Plan 05, cuarto desenlace). Si este
 *      servicio lo convirtiera en un resultado, la pantalla diría «no se pudo confirmar» cuando lo
 *      que pasó es que nadie contactó con nadie.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-28
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Doble del cliente HTTP centralizado: solo capturamos ruta, query y cuerpo. Sin red real.
vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
  },
}));

import httpClient from "../api/httpClient";
import { NotificacionEjecucionService } from "./NotificacionEjecucionService";
import type {
  BandejaGestorNotificaciones,
  ResultadoReenvio,
} from "./NotificacionEjecucionService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = httpClient.post as unknown as ReturnType<typeof vi.fn>;

/** El sobre vacío que el backend devuelve cuando no hay filas, con el interruptor en su raíz. */
const SOBRE_VACIO: BandejaGestorNotificaciones = {
  data: [],
  total: 0,
  limit: 10,
  offset: 0,
  page: 1,
  pages: 0,
  correoEnvioHabilitado: false,
};

describe("NotificacionEjecucionService.gestor — la forma de la query (Plan 04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: SOBRE_VACIO });
  });

  /** Las claves realmente emitidas, en orden de aparición. */
  const clavesEmitidas = (): string[] => {
    const opciones = mockGet.mock.calls[0][1] as { params: URLSearchParams };
    return [...opciones.params.keys()];
  };

  const valorEmitido = (clave: string): string | null => {
    const opciones = mockGet.mock.calls[0][1] as { params: URLSearchParams };
    return opciones.params.get(clave);
  };

  const valoresEmitidos = (clave: string): string[] => {
    const opciones = mockGet.mock.calls[0][1] as { params: URLSearchParams };
    return opciones.params.getAll(clave);
  };

  it("sin filtros y sin tamaño de página NO emite ninguna clave: el backend aplica su defecto", async () => {
    await NotificacionEjecucionService.gestor();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe("/notificacion/gestor");
    expect(clavesEmitidas()).toEqual([]);
  });

  it("traduce el índice y el tamaño de página a límite y desplazamiento", async () => {
    await NotificacionEjecucionService.gestor({ pageIndex: 3, pageSize: 20 });

    expect(valorEmitido("limit")).toBe("20");
    // Página 4 (índice 3) de 20 en 20 ⇒ se saltan 60.
    expect(valorEmitido("offset")).toBe("60");
  });

  it("🔴 lo vacío se OMITE: una cadena en blanco no es un filtro, es un filtro que no está", async () => {
    await NotificacionEjecucionService.gestor({
      filterParams: {
        admiName: "",
        admiLastname: "   ",
        expNumber: undefined,
        eejeStatus: [],
      },
    });

    expect(clavesEmitidas()).toEqual([]);
  });

  it("el filtro de catálogo con dos selecciones REPITE la clave: así se manda un array por query", async () => {
    await NotificacionEjecucionService.gestor({
      filterParams: {
        eejeStatus: ["EN_VERIFICACION_PAGO", "ARCHIVADO"],
      },
    });

    expect(clavesEmitidas()).toEqual(["eejeStatus", "eejeStatus"]);
    expect(valoresEmitidos("eejeStatus")).toEqual([
      "EN_VERIFICACION_PAGO",
      "ARCHIVADO",
    ]);
  });

  it("🔴 el filtro de rango viaja con los DOS nombres que el DTO declara: notiEmitidaAtFrom y notiEmitidaAtTo", async () => {
    await NotificacionEjecucionService.gestor({
      filterParams: {
        notiEmitidaAtFrom: "2026-09-01",
        notiEmitidaAtTo: "2026-09-30",
      },
    });

    // Los nombres LITERALES. Cualquier otro es un 400 que no dice cuál fue.
    expect(clavesEmitidas()).toEqual([
      "notiEmitidaAtFrom",
      "notiEmitidaAtTo",
    ]);
    expect(valorEmitido("notiEmitidaAtFrom")).toBe("2026-09-01");
    expect(valorEmitido("notiEmitidaAtTo")).toBe("2026-09-30");
  });

  it("los seis filtros de texto y el paginado salen juntos, con el conjunto EXACTO de claves", async () => {
    await NotificacionEjecucionService.gestor({
      pageIndex: 0,
      pageSize: 10,
      filterParams: {
        justificacion: "Providencia",
        especificacion: "Archivo",
        expNumber: "053-2026",
        admiIdentification: "1700000001",
        admiName: "Gabriela",
        admiLastname: "Pazmiño",
      },
    });

    expect(clavesEmitidas()).toEqual([
      "justificacion",
      "especificacion",
      "expNumber",
      "admiIdentification",
      "admiName",
      "admiLastname",
      "limit",
      "offset",
    ]);
  });

  it("🔴 devuelve el sobre TAL CUAL, incluido el interruptor de la RAÍZ: el cliente no lo deduce", async () => {
    mockGet.mockResolvedValue({
      data: { ...SOBRE_VACIO, total: 1, correoEnvioHabilitado: true },
    });

    const sobre = await NotificacionEjecucionService.gestor();

    expect(sobre.correoEnvioHabilitado).toBe(true);
    expect(sobre.total).toBe(1);

    // Y con el envío apagado el sobre llega con `false`, no con un defecto puesto aquí.
    mockGet.mockResolvedValue({ data: SOBRE_VACIO });
    const apagado = await NotificacionEjecucionService.gestor();
    expect(apagado.correoEnvioHabilitado).toBe(false);
  });
});

describe("NotificacionEjecucionService.reenviarCorreo — el reintento manual (Plan 05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("🔴 llama a la ruta del despacho SIN CUERPO: la dirección sale del despacho congelado", async () => {
    mockPost.mockResolvedValue({
      data: {
        resultado: "notificado",
        intentos: 1,
        correo: "gabriela@example.com",
        razonDocId: 900,
      } satisfies ResultadoReenvio,
    });

    await NotificacionEjecucionService.reenviarCorreo(77);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/notificacion/despacho/77/reenviar");
    // Un solo argumento: ni un cuerpo vacío, ni un `{}`, ni una dirección elegida por el cliente.
    expect(mockPost.mock.calls[0]).toHaveLength(1);
  });

  it.each([
    ["notificado", 1, 900],
    ["rechazado", 2, 901],
    ["parcial", 3, undefined],
  ] as const)(
    "devuelve el desenlace «%s» con su contador de intentos ya subido",
    async (resultado, intentos, razonDocId) => {
      mockPost.mockResolvedValue({
        data: { resultado, intentos, correo: "gabriela@example.com", razonDocId },
      });

      const salida = await NotificacionEjecucionService.reenviarCorreo(77);

      expect(salida.resultado).toBe(resultado);
      expect(salida.intentos).toBe(intentos);
      expect(salida.razonDocId).toBe(razonDocId);
    },
  );

  it("🔴 un fallo del servidor se PROPAGA: no se convierte en un resultado falso", async () => {
    const caido = new Error("No se pudo contactar con el servicio de correo");
    mockPost.mockRejectedValue(caido);

    await expect(
      NotificacionEjecucionService.reenviarCorreo(77),
    ).rejects.toThrow("No se pudo contactar con el servicio de correo");
  });
});
