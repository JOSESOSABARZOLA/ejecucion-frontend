import { createContext } from "react";
import type { ToastContextType } from "../interfaces/IToast";

export const ToastContext = createContext<ToastContextType | null>(null);
ToastContext.displayName = "ToastContext";
