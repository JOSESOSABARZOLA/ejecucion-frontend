/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 04
 * Feature: Contexto de usuario hidratado desde el backend
 * Archivo: UserContext.test.tsx
 * Responsabilidad: Aseverar que la sesión se decide preguntando al backend y NO leyendo el
 *   almacenamiento del navegador: (a) el bootstrap pasa por un estado de hidratación explícito,
 *   (b) sólo hay usuario si `GET /auth/session` y `GET /auth/me` responden (T-0311-17), (c) el
 *   provider no escribe nada privado en el navegador y borra de una vez las dos claves heredadas
 *   (T-0311-16), (d) bajo doble montaje de efectos la sesión se consulta UNA sola vez, (e) el cierre
 *   de sesión es idempotente, limpia aunque la petición falle y siempre navega, y (f) un 401 en una
 *   API privada deja la sesión en anónimo sin navegar (T-0311-18).
 *   No hace red real: los servicios de auth, la costura de navegación y el cliente HTTP están
 *   sustituidos por dobles.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { errorDelServidor } from "../test/errores";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrictMode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { THEME_STORAGE_KEY } from "../context/ThemeContext";
import type { User, UserFromLogin } from "../interfaces/IUser";

const mocks = vi.hoisted(() => ({
  getMode: vi.fn(),
  getSession: vi.fn(),
  getMe: vi.fn(),
  logout: vi.fn(),
  exchange: vi.fn(),
  getUserAuthorization: vi.fn(),
  replaceLocation: vi.fn(),
  registerUnauthorizedHandler: vi.fn(),
  getCentralAuthLogoutUrl: vi.fn(),
  resetModoDeFirmaCache: vi.fn(),
}));

vi.mock("../services/AuthSessionService", () => ({
  AuthSessionService: {
    getMode: mocks.getMode,
    getSession: mocks.getSession,
    getMe: mocks.getMe,
    logout: mocks.logout,
    exchange: mocks.exchange,
  },
  default: {
    getMode: mocks.getMode,
    getSession: mocks.getSession,
    getMe: mocks.getMe,
    logout: mocks.logout,
    exchange: mocks.exchange,
  },
}));

vi.mock("../services/AuthService", () => ({
  authService: { getUserAuthorization: mocks.getUserAuthorization },
}));

// Ningún test puede navegar de verdad.
vi.mock("../utils/navigation", () => ({
  replaceLocation: mocks.replaceLocation,
  currentOrigin: () => "http://localhost:5177",
}));

vi.mock("../api/httpClient", () => ({
  registerUnauthorizedHandler: mocks.registerUnauthorizedHandler,
  default: {},
}));

vi.mock("../config/authRuntimeConfig", () => ({
  getCentralAuthLogoutUrl: mocks.getCentralAuthLogoutUrl,
}));

vi.mock("../hooks/useClaveDeFirma", () => ({
  resetModoDeFirmaCache: mocks.resetModoDeFirmaCache,
}));

import { UserProvider, useUser } from "./UserContext";

const LOGOUT_URL = "https://auth.example.com/logout";

/** Perfil que devuelve `GET /auth/me`: el shape que ya consumen los 13 puntos de gating de la app. */
const PERFIL_ME: User = {
  usuId: 7,
  usuFullName: "Juan Pérez",
  usuEmail: "juan.perez@quito.gob.ec",
  rolName: "funcionario decisor",
  modulos: [],
  submenus: [],
  actividades: [],
};

/** Perfil del cuerpo del login local: distinto a propósito, para probar quién hidrata de verdad. */
const PERFIL_LOGIN: User = {
  ...PERFIL_ME,
  rolName: "rol-del-cuerpo-del-login",
};

const CREDENCIALES: UserFromLogin = {
  email: "juan.perez@quito.gob.ec",
  password: "secreta",
};

/** Componente sonda: pinta el estado del contexto y expone sus tres acciones como botones. */
function Sonda() {
  const {
    user,
    sessionState,
    authCentralEnabled,
    isLoggingOut,
    error,
    loginUser,
    logoutUser,
    hydrateSession,
  } = useUser();

  return (
    <div>
      <span data-testid="estado">{sessionState}</span>
      <span data-testid="rol">{user ? user.rolName : "sin-usuario"}</span>
      <span data-testid="modo">{String(authCentralEnabled)}</span>
      <span data-testid="cerrando">{String(isLoggingOut)}</span>
      <span data-testid="error">{error ?? ""}</span>
      <button
        type="button"
        onClick={() => {
          void loginUser(CREDENCIALES).catch(() => {});
        }}
      >
        entrar
      </button>
      <button
        type="button"
        onClick={() => {
          void logoutUser();
        }}
      >
        salir
      </button>
      <button
        type="button"
        onClick={() => {
          void hydrateSession();
        }}
      >
        hidratar
      </button>
    </div>
  );
}

function montar(opciones?: { strict?: boolean }) {
  const arbol = (
    <UserProvider>
      <Sonda />
    </UserProvider>
  );

  return render(opciones?.strict ? <StrictMode>{arbol}</StrictMode> : arbol);
}

const texto = (testId: string) => screen.getByTestId(testId).textContent;

const clic = (nombre: string) =>
  fireEvent.click(screen.getByRole("button", { name: nombre }));

const esperarEstado = (estado: string) =>
  waitFor(() => expect(texto("estado")).toBe(estado));

/** Promesa que nunca se resuelve: congela el bootstrap donde el test lo necesita. */
const pendiente = <T,>() => new Promise<T>(() => {});

/**
 * Doble del almacenamiento del navegador. jsdom NO expone `window.localStorage` en este proyecto
 * (Node lo deja fuera sin `--localstorage-file`), así que el doble es además la prueba de que el
 * provider habla con el almacenamiento a través de una costura defensiva y no de un global asumido.
 */
function crearAlmacenFalso() {
  const datos = new Map<string, string>();

  return {
    getItem: vi.fn((clave: string) => datos.get(clave) ?? null),
    setItem: vi.fn((clave: string, valor: string) => {
      datos.set(clave, String(valor));
    }),
    removeItem: vi.fn((clave: string) => {
      datos.delete(clave);
    }),
    clear: vi.fn(() => {
      datos.clear();
    }),
    key: vi.fn((indice: number) => Array.from(datos.keys())[indice] ?? null),
    get length() {
      return datos.size;
    },
  };
}

let almacen: ReturnType<typeof crearAlmacenFalso>;

/** Instala (o retira) el doble del almacenamiento en `window`. */
function instalarAlmacen(valor: unknown) {
  Object.defineProperty(window, "localStorage", {
    value: valor,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  almacen = crearAlmacenFalso();
  instalarAlmacen(almacen);

  mocks.getMode.mockResolvedValue({ authCentralEnabled: true });
  mocks.getSession.mockResolvedValue({
    username: "juan.perez",
    displayName: "Juan Pérez",
  });
  mocks.getMe.mockResolvedValue(PERFIL_ME);
  mocks.logout.mockResolvedValue(undefined);
  mocks.getUserAuthorization.mockResolvedValue({ user: PERFIL_LOGIN });
  mocks.getCentralAuthLogoutUrl.mockReturnValue(LOGOUT_URL);
});

describe("UserContext / bootstrap de sesión", () => {
  it("pasa por 'hydrating' antes de resolverse", () => {
    mocks.getMode.mockReturnValue(pendiente());

    montar();

    expect(texto("estado")).toBe("hydrating");
    expect(texto("rol")).toBe("sin-usuario");
  });

  it("con sesión viva hidrata el perfil desde /auth/me y termina en 'authenticated'", async () => {
    montar();

    await esperarEstado("authenticated");

    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
    expect(texto("rol")).toBe(PERFIL_ME.rolName);
    expect(texto("modo")).toBe("true");
  });

  it("con /auth/session en 401 termina en 'anonymous' y NO llama a /auth/me", async () => {
    mocks.getSession.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401 }),
    );

    montar();

    await esperarEstado("anonymous");

    expect(mocks.getMe).not.toHaveBeenCalled();
    expect(texto("rol")).toBe("sin-usuario");
  });

  it("si /auth/mode falla asume modo central (fallo cerrado) y continúa el bootstrap", async () => {
    mocks.getMode.mockRejectedValue(new Error("mode caido"));

    montar();

    await esperarEstado("authenticated");

    expect(texto("modo")).toBe("true");
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
  });

  it("publica el modo local cuando el backend lo declara", async () => {
    mocks.getMode.mockResolvedValue({ authCentralEnabled: false });

    montar();

    await esperarEstado("authenticated");

    expect(texto("modo")).toBe("false");
  });

  it("no escribe NINGUNA clave en el almacenamiento del navegador durante el bootstrap", async () => {
    montar();

    await esperarEstado("authenticated");

    expect(almacen.setItem).not.toHaveBeenCalled();
  });

  it("borra al arrancar las dos claves heredadas y NO toca la del tema (T-0311-16)", async () => {
    almacen.setItem("authToken", "jwt.heredado.de.otra.version");
    almacen.setItem("userData", JSON.stringify({ rolName: "usuario-A" }));
    almacen.setItem(THEME_STORAGE_KEY, "dark");
    almacen.setItem.mockClear();

    montar();

    await esperarEstado("authenticated");

    expect(almacen.getItem("authToken")).toBeNull();
    expect(almacen.getItem("userData")).toBeNull();
    expect(almacen.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(almacen.removeItem).not.toHaveBeenCalledWith(THEME_STORAGE_KEY);
  });

  it("no revienta si el navegador no expone almacenamiento", async () => {
    instalarAlmacen(undefined);

    montar();

    await esperarEstado("authenticated");

    expect(texto("rol")).toBe(PERFIL_ME.rolName);
  });

  it("bajo doble montaje de efectos (StrictMode) consulta la sesión EXACTAMENTE una vez", async () => {
    montar({ strict: true });

    await esperarEstado("authenticated");

    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.getMode).toHaveBeenCalledTimes(1);
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
  });
});

describe("UserContext / hydrateSession", () => {
  it("puebla el perfil y deja 'authenticated'", async () => {
    mocks.getSession.mockRejectedValue(new Error("sin sesion"));

    montar();

    await esperarEstado("anonymous");

    mocks.getMe.mockResolvedValue({ ...PERFIL_ME, rolName: "rol-hidratado" });
    clic("hidratar");

    await esperarEstado("authenticated");

    expect(texto("rol")).toBe("rol-hidratado");
  });

  it("si /auth/me falla deja el usuario nulo y 'anonymous'", async () => {
    montar();

    await esperarEstado("authenticated");

    mocks.getMe.mockRejectedValue(new Error("me caido"));
    clic("hidratar");

    await esperarEstado("anonymous");

    expect(texto("rol")).toBe("sin-usuario");
  });
});

describe("UserContext / login local", () => {
  it("hidrata por /auth/me tras el login local e ignora lo que venga en el cuerpo", async () => {
    mocks.getSession.mockRejectedValue(new Error("sin sesion"));

    montar();

    await esperarEstado("anonymous");

    clic("entrar");

    await esperarEstado("authenticated");

    expect(mocks.getUserAuthorization).toHaveBeenCalledWith(CREDENCIALES);
    expect(texto("rol")).toBe(PERFIL_ME.rolName);
    expect(texto("rol")).not.toBe(PERFIL_LOGIN.rolName);
  });

  it("no persiste el perfil en el almacenamiento del navegador al entrar", async () => {
    mocks.getSession.mockRejectedValue(new Error("sin sesion"));

    montar();

    await esperarEstado("anonymous");

    almacen.setItem.mockClear();

    clic("entrar");

    await esperarEstado("authenticated");

    expect(almacen.setItem).not.toHaveBeenCalled();
  });

  it("deja el mensaje en `error` y el usuario nulo si el login falla", async () => {
    mocks.getSession.mockRejectedValue(new Error("sin sesion"));
    mocks.getUserAuthorization.mockRejectedValue(
      errorDelServidor("Credenciales inválidas"),
    );

    montar();

    await esperarEstado("anonymous");

    clic("entrar");

    await waitFor(() =>
      expect(texto("error")).toBe("Credenciales inválidas"),
    );

    expect(texto("rol")).toBe("sin-usuario");
    expect(mocks.getMe).not.toHaveBeenCalled();
  });
});

describe("UserContext / cierre de sesión", () => {
  it("limpia el estado y navega AUNQUE la petición de logout falle", async () => {
    mocks.logout.mockRejectedValue(new Error("logout caido"));

    montar();

    await esperarEstado("authenticated");

    clic("salir");

    await esperarEstado("anonymous");

    expect(texto("rol")).toBe("sin-usuario");
    expect(mocks.replaceLocation).toHaveBeenCalledTimes(1);
  });

  it("invocado dos veces seguidas ejecuta la petición de logout UNA sola vez", async () => {
    mocks.logout.mockReturnValue(pendiente());

    montar();

    await esperarEstado("authenticated");

    clic("salir");
    clic("salir");

    await waitFor(() => expect(texto("cerrando")).toBe("true"));

    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });

  it("en modo central navega a la URL de logout del portal", async () => {
    montar();

    await esperarEstado("authenticated");

    clic("salir");

    await esperarEstado("anonymous");

    expect(mocks.replaceLocation).toHaveBeenCalledWith(LOGOUT_URL);
  });

  it("en modo local navega a la raíz", async () => {
    mocks.getMode.mockResolvedValue({ authCentralEnabled: false });

    montar();

    await esperarEstado("authenticated");

    clic("salir");

    await esperarEstado("anonymous");

    expect(mocks.replaceLocation).toHaveBeenCalledWith("/");
    expect(mocks.getCentralAuthLogoutUrl).not.toHaveBeenCalled();
  });
});

describe("UserContext / reacción global a 401", () => {
  /** Devuelve el último manejador entregado al cliente HTTP. */
  const ultimoManejador = () => {
    const llamadas = mocks.registerUnauthorizedHandler.mock.calls;

    return llamadas[llamadas.length - 1][0] as () => void;
  };

  it("registra un manejador al montar", async () => {
    montar();

    await esperarEstado("authenticated");

    expect(mocks.registerUnauthorizedHandler).toHaveBeenCalledTimes(1);
    expect(typeof ultimoManejador()).toBe("function");
  });

  it("cuando el manejador se invoca, la sesión queda en anónimo y sin usuario", async () => {
    montar();

    await esperarEstado("authenticated");

    const manejador = ultimoManejador();

    fireEvent.click(screen.getByRole("button", { name: "hidratar" })); // ruido: no debe estorbar
    await esperarEstado("authenticated");

    manejador();

    await esperarEstado("anonymous");

    expect(texto("rol")).toBe("sin-usuario");
  });

  it("el manejador de 401 NO navega: la salida la decide el guard (T-0311-18)", async () => {
    montar();

    await esperarEstado("authenticated");

    ultimoManejador()();

    await esperarEstado("anonymous");

    expect(mocks.replaceLocation).not.toHaveBeenCalled();
  });

  it("al desmontar devuelve el registro a un manejador inerte", async () => {
    const { unmount } = montar();

    await esperarEstado("authenticated");

    const manejadorDelProvider = ultimoManejador();

    unmount();

    expect(mocks.registerUnauthorizedHandler).toHaveBeenCalledTimes(2);
    expect(ultimoManejador()).not.toBe(manejadorDelProvider);
    expect(() => ultimoManejador()()).not.toThrow();
  });
});

describe("UserContext / el modo de firma cacheado no pasa de una sesión a otra (revisión 03.21, WR-06)", () => {
  const ultimoManejador = () => {
    const llamadas = mocks.registerUnauthorizedHandler.mock.calls;

    return llamadas[llamadas.length - 1][0] as () => void;
  };

  it("una sesión muerta por 401 vacía la caché del modo de firma", async () => {
    montar();
    await esperarEstado("authenticated");
    mocks.resetModoDeFirmaCache.mockClear();

    ultimoManejador()();

    await esperarEstado("anonymous");
    expect(mocks.resetModoDeFirmaCache).toHaveBeenCalled();
  });

  it("el login local vacía la caché antes de hidratar la sesión nueva", async () => {
    mocks.getSession.mockRejectedValue(new Error("sin sesion"));
    montar();
    await esperarEstado("anonymous");
    mocks.resetModoDeFirmaCache.mockClear();

    clic("entrar");

    await esperarEstado("authenticated");
    expect(mocks.resetModoDeFirmaCache).toHaveBeenCalled();
  });

  it("cada hidratación (p. ej. el callback del Auth central) vacía la caché", async () => {
    mocks.getSession.mockRejectedValue(new Error("sin sesion"));
    montar();
    await esperarEstado("anonymous");
    mocks.resetModoDeFirmaCache.mockClear();

    clic("hidratar");

    await esperarEstado("authenticated");
    expect(mocks.resetModoDeFirmaCache).toHaveBeenCalledTimes(1);
  });
});
