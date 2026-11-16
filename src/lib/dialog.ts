"use client";

import { useEffect, useRef } from "react";

/**
 * Shared behaviour for the pop-ups: Escape closes, Tab stays inside,
 * the page behind doesn't scroll, and focus starts on the close button.
 */
export function useDialog(
    panel: React.RefObject<HTMLElement | null>,
    onClose: () => void,
) {
    const close = useRef(onClose);
    close.current = onClose;

    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        document.body.style.overflow = "hidden";
        panel.current?.querySelector<HTMLElement>("[data-close]")?.focus();

        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                close.current();
                return;
            }
            if (e.key !== "Tab" || !panel.current) return;
            const els = [
                ...panel.current.querySelectorAll<HTMLElement>(
                    "button, a, input",
                ),
            ];
            if (!els.length) return;
            const first = els[0];
            const last = els[els.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
            opener?.focus?.({ preventScroll: true }); // back to what opened the pop-up
        };
    }, [panel]);
}
