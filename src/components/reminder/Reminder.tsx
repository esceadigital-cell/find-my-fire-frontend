"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Reminder.module.scss";

interface ReminderProps {
    /** the steps with unanswered questions */
    steps: number[];
    /** clicked: open the filter on the first of those steps */
    onClick: () => void;
    /** gone, by itself or after a click */
    onDone: () => void;
}

/** "step 2", "steps 2 and 3", "steps 2, 3 and 4" */
export function stepList(steps: number[]) {
    if (steps.length === 1) return `step ${steps[0]}`;
    return `steps ${steps.slice(0, -1).join(", ")} and ${steps[steps.length - 1]}`;
}

/**
 * "Answer steps 2, 3 and 4 to get better recommendations": drops in from the top, shakes once,
 * and goes by itself after 3 seconds (2 on phones). Clicking it opens the filter where answers are missing.
 */
export default function Reminder(props: ReminderProps) {
    const box = useRef<HTMLButtonElement>(null);
    const [state, setState] = useState<"in" | "on" | "out">("in");
    const done = useRef(props.onDone);
    done.current = props.onDone;

    useEffect(() => {
        const phone = window.matchMedia("(max-width: 699px)").matches;
        const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        requestAnimationFrame(() => setState("on"));

        // Phones: the product pop-up moves down by the reminder's height, so it's never covered
        const root = document.documentElement;
        if (phone)
            root.style.setProperty(
                "--drop",
                `${box.current?.offsetHeight ?? 0}px`,
            );

        // One shake after it has dropped in (on phones only the text shakes, since the strip spans the screen)
        const shake = window.setTimeout(() => {
            if (reduced) return;
            // The box is centred with translate(-50%), so its shake keeps that and only adds a few pixels
            // (without it, the box jumps to the right while it shakes). On phones only the text shakes.
            const shift = (px: number) =>
                phone
                    ? `translateX(${px}px)`
                    : `translate(calc(-50% + ${px}px), 0)`;
            const target = phone
                ? box.current?.querySelector("span")
                : box.current;
            target?.animate(
                [0, -6, 6, -3, 0].map((px) => ({ transform: shift(px) })),
                { duration: 420, easing: "ease-out" },
            );
        }, 500);

        const out = window.setTimeout(
            () => setState("out"),
            phone ? 2000 : 3000,
        );
        const gone = window.setTimeout(
            () => done.current(),
            (phone ? 2000 : 3000) + 350,
        );
        const lift = window.setTimeout(
            () => root.style.removeProperty("--drop"),
            phone ? 2000 : 3000,
        );
        return () => {
            [shake, out, gone, lift].forEach(window.clearTimeout);
            root.style.removeProperty("--drop");
        };
    }, []);

    return (
        <button
            ref={box}
            type="button"
            className={[
                styles.reminder,
                state === "on" && styles.on,
                state === "out" && styles.out,
            ]
                .filter(Boolean)
                .join(" ")}
            role="status"
            onClick={() => {
                props.onClick();
                done.current();
            }}
        >
            <span>
                Answer {stepList(props.steps)} to get better recommendations
            </span>
        </button>
    );
}
