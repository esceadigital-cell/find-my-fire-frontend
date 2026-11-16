"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HintToast.module.scss";
import Icon from "../icon/Icon";

interface HintToastProps {
    /** the steps that still have unanswered questions */
    steps: { step: number; title: string }[];
    /** the step that's open in the filter box */
    currentStep: number;
    onGo: (step: number) => void;
    onClose: () => void;
}

/**
 * "Answer 2 more steps for better recommendations", in the middle of the screen.
 * It doesn't block anything: clicking elsewhere gives it a little rattle,
 * and going to the filter box closes it, since then it has done its job.
 */
export default function HintToast(props: HintToastProps) {
    const box = useRef<HTMLDivElement>(null);
    const [on, setOn] = useState(false); // for the fade-in
    const opened = useRef(0);

    const onClose = useRef(props.onClose);
    onClose.current = props.onClose;

    useEffect(() => {
        opened.current = performance.now();
        requestAnimationFrame(() => setOn(true));
        box.current
            ?.querySelector<HTMLElement>("[data-go]")
            ?.focus({ preventScroll: true });

        function onClick(e: MouseEvent) {
            const target = e.target as HTMLElement;
            if (
                performance.now() - opened.current < 150 ||
                box.current?.contains(target)
            )
                return;
            // They went to the filter box: the hint has done its job
            if (target.closest("aside")) {
                onClose.current();
                return;
            }
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
                return;
            box.current?.animate(
                [
                    { transform: "translate(-50%, -50%)" },
                    {
                        transform:
                            "translate(calc(-50% - 4px), -50%) rotate(-0.5deg)",
                    },
                    {
                        transform:
                            "translate(calc(-50% + 4px), -50%) rotate(0.5deg)",
                    },
                    {
                        transform:
                            "translate(calc(-50% - 2px), -50%) rotate(-0.3deg)",
                    },
                    { transform: "translate(calc(-50% + 1px), -50%)" },
                    { transform: "translate(-50%, -50%)" },
                ],
                { duration: 420, easing: "ease-out" },
            );
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose.current();
        }
        document.addEventListener("click", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("click", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    const count = props.steps.length;
    const first = props.steps[0];

    return (
        <div
            ref={box}
            className={on ? `${styles.hint} ${styles.on}` : styles.hint}
            role="dialog"
            aria-labelledby="hint-title"
        >
            <button
                type="button"
                className={styles.close}
                aria-label="Dismiss"
                onClick={props.onClose}
            >
                <Icon name="x" />
            </button>
            <h2 id="hint-title">
                Answer {count === 1 ? "one more step" : `${count} more steps`}{" "}
                for better recommendations
            </h2>
            <p>Until then, the fires aren’t matched against your answers in:</p>
            <span className={styles.steps}>
                {props.steps.map((s) => (
                    <span key={s.step} className={styles.step}>
                        <i>{s.step}</i>
                        {s.title}
                    </span>
                ))}
            </span>
            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.go}
                    data-go
                    onClick={() => props.onGo(first.step)}
                >
                    {first.step === props.currentStep
                        ? "Back to the questions"
                        : `Go to step ${first.step}`}
                </button>
            </div>
        </div>
    );
}
