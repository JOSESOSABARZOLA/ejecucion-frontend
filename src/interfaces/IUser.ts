import type { ModalType } from "./IModal";

export interface User {
  usuId: number;
  usuFullName: string;
  usuEmail: string;
  rolName: string;
  modulos: UserModule[];
  submenus: UserSubMenu[];
  actividades: UserActions[];
}

/**
 * Respuesta del login local. NO lleva token: desde la Fase 03.11 la sesión viaja SIEMPRE en la cookie
 * HttpOnly que emite el backend, en los dos modos de autenticación. Un token en el estado de React
 * sería exfiltrable por un XSS (T-0311-11).
 */
export interface UserResponse {
  user: User;
}

export interface UserFromLogin {
  email: string;
  password: string;
}

export interface UserModule {
  moduId: number;
  moduName: string;
  moduPath: string;
  moduIcon: string;
}

export interface UserSubMenu {
  moduId: number;
  submId: number;
  submName: string;
  submPath: string;
  submIcon: string;
}

export interface UserActions {
  actiId: number;
  submId: number;
  actiName: ModalType;
  actiLabel: string;
  actiContext: string;
  actiIconName: string;
  actiCreatedAt: Date | null;
  actiUpdatedAt: Date | null;
  actiIsPrioritary: boolean;
  actiIsDisabled?: boolean;
  /**
   * Motivo por el que la acción está deshabilitada (se muestra como tooltip junto al botón). Deshabilitar
   * sin decir por qué deja al usuario adivinando: mismo criterio que `selectHint` en la card del EPAS.
   * Solo tiene efecto cuando `actiIsDisabled` es true.
   */
  actiDisabledHint?: string;
}
