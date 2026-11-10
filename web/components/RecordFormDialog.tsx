"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const FOCUSABLE_IN_DIALOG =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

interface Props {
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  /** Erro de validação ou da API, mostrado dentro do diálogo. */
  error?: string | null;
  /** Formulário de duas colunas. */
  wide?: boolean;
  children: ReactNode;
}

/**
 * Diálogo modal de formulário de cadastro. Fecha com Esc, pelo fundo ou pelos
 * botões; o foco entra no primeiro campo, fica preso no painel e volta para
 * quem abriu.
 */
export default function RecordFormDialog({
  title,
  submitLabel,
  onClose,
  onSubmit,
  error,
  wide = false,
  children,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLFormElement>(null);
  // A página recria onClose a cada render; a referência evita religar o
  // ouvinte de teclado (e perder o foco inicial) a cada tecla digitada.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    const opener = document.activeElement as HTMLElement | null;
    panel
      ?.querySelector<HTMLElement>(
        "[data-dialog-body] input, [data-dialog-body] select, [data-dialog-body] textarea"
      )
      ?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_IN_DIALOG)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !panel.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !panel.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      // mousedown, e não click: selecionar texto de um campo e soltar o
      // ponteiro sobre o fundo não pode fechar o formulário.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className={cn(
          "card flex max-h-[calc(100dvh-1.5rem)] w-full flex-col shadow-overlay sm:max-h-[calc(100dvh-2rem)]",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <div className="flex items-center justify-between gap-3 pl-4 pr-2 pt-2 sm:pl-5 sm:pr-3 sm:pt-3">
          <h2 id={titleId} className="font-display text-2xl font-semibold leading-tight">
            {title}
          </h2>
          <button
            type="button"
            className="btn-ghost h-11 w-11 shrink-0 px-0"
            onClick={onClose}
            aria-label="Fechar sem salvar"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div
          data-dialog-body
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-5"
        >
          {error && (
            <p role="alert" className="alert-error text-sm">
              {error}
            </p>
          )}
          {children}
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Campo do diálogo: rótulo visível acima do controle e dica opcional abaixo. */
export function DialogField({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-sm text-ink-muted">{hint}</span>}
    </label>
  );
}
