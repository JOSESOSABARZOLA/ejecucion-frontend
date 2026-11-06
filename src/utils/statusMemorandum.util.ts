import type { StatusMemorandum } from "../interfaces/IDocument";

/** Orden del flujo de estados del memorandum (índice = progresión). */
export const STATUS_MEMORANDUM: readonly StatusMemorandum[] = [
  "enviado",
  "recibido",
  "en revisión",
  "en sorteo",
  "sorteado",
  "aprobado",
  "rechazado",
] as const;

export type StatusCondition =
  | { type: "exact"; status: StatusMemorandum }
  | { type: "min"; status: StatusMemorandum };

export function statusIndex(
  status: StatusMemorandum | string | null | undefined,
): number {
  if (!status) return -1;
  return STATUS_MEMORANDUM.indexOf(status as StatusMemorandum);
}

export function meetsStatusCondition(
  docStatus: StatusMemorandum | string | null | undefined,
  condition: StatusCondition,
): boolean {
  const docIdx = statusIndex(docStatus);
  const condIdx = statusIndex(condition.status);

  if (docIdx < 0 || condIdx < 0) return false;

  switch (condition.type) {
    case "exact":
      return docIdx === condIdx;
    case "min":
      return docIdx >= condIdx;
  }
}

export const exact = (status: StatusMemorandum): StatusCondition => ({
  type: "exact",
  status,
});

export const min = (status: StatusMemorandum): StatusCondition => ({
  type: "min",
  status,
});
