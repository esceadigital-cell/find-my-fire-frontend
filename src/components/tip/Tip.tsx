"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./Tip.module.scss";

interface TipProps {
    /** what the question affects, e.g. the extraDescription from Strapi */
    text: React.ReactNode;
    /** the question's label, for screen readers: "More about Ceiling insulation" */
    label: string;
}

/**
 * The small "?" next to a question's label. On a computer the text shows on hover;
 * on phones and tablets (no hover) a tap shows it, and a tap elsewhere hides it.
 * The bubble is fixed to the screen, so the filter box's scrolling can't cut it off.
 */
export default function Tip(props: TipProps) {
    const button = useRef<HTMLButtonElement>(null);
    const bubble = useRef<HTMLSpanElement>(null);
    const [open, setOpen] = useState(false);
    const [place, setPlace] = useState<{
        left: number;
        top: number;
        arrow: number;
        below: boolean;
    } | null>(null);
    const timer = useRef(0);

    // Where the bubble goes: centred above the "?", kept inside the screen, below it if there's no room above
    useLayoutEffect(() => {
        if (!open || !button.current || !bubble.current) return;
        const r = button.current.getBoundingClientRect();
        const w = bubble.current.offsetWidth;
        const h = bubble.current.offsetHeight;
        const left = Math.max(
            8,
            Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2),
        );
        const below = r.top - h - 10 < 8;
        setPlace({
            left,
            top: below ? r.bottom + 10 : r.top - h - 10,
            arrow: r.left + r.width / 2 - left,
            below,
        });
    }, [open]);

    // Close on Escape, on a tap elsewhere, and when the page scrolls
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) =>
            e.key === "Escape" && setOpen(false);
        const onDown = (e: PointerEvent) =>
            !button.current?.contains(e.target as Node) && setOpen(false);
        const onScroll = () => setOpen(false);
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onDown);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onDown);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [open]);

    const canHover = () => window.matchMedia("(hover: hover)").matches;

    return (
        <span className={styles.tip}>
            <button
                ref={button}
                type="button"
                className={styles.button}
                aria-label={`More about ${props.label}`}
                aria-expanded={open}
                aria-describedby={open ? "tip-bubble" : undefined}
                onClick={(e) => {
                    e.preventDefault(); // inside a <label>, a click would otherwise focus the input
                    setOpen(!open);
                }}
                onMouseEnter={() => {
                    if (!canHover()) return;
                    window.clearTimeout(timer.current);
                    timer.current = window.setTimeout(() => setOpen(true), 120);
                }}
                onMouseLeave={() => {
                    if (!canHover()) return;
                    window.clearTimeout(timer.current);
                    setOpen(false);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
            >
                ?
            </button>
            {open && (
                <span
                    ref={bubble}
                    id="tip-bubble"
                    role="tooltip"
                    className={[
                        styles.bubble,
                        place && styles.on,
                        place?.below && styles.below,
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    style={
                        place
                            ? { left: place.left, top: place.top }
                            : { left: -9999, top: 0 }
                    }
                >
                    {props.text}
                    <i
                        className={styles.arrow}
                        style={place ? { left: place.arrow } : undefined}
                    />
                </span>
            )}
        </span>
    );
}
