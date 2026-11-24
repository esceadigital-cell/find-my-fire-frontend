"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SortBy.module.scss";
import { FUEL_NAMES } from "@/lib/display";

export type Fuel = "gas" | "wood" | "electric";

/** How a section is sorted. Each group can be off (null). Priority: fuel first, then heat output, then width */
export type Sort = {
    fuel: Fuel | null; // this fuel first ("Show first")
    kw: "asc" | "desc" | null; // heat output
    w: "asc" | "desc" | null; // width
};

export const DEFAULT_SORT: Sort = { fuel: null, kw: "asc", w: null };

interface SortByProps {
    sort: Sort;
    onChange: (sort: Sort) => void;
    /** the fuels in the section: "Show first" only appears when there's more than one */
    fuels: Fuel[];
    /** e.g. "Best for your home", for the menu's title and screen readers */
    sectionName: string;
}

const KW = { asc: "Low to high", desc: "High to low" } as const;
const W = { asc: "Narrow to wide", desc: "Wide to narrow" } as const;

/** The text on the button, e.g. "Gas first · Heat output low to high" */
export function sortSummary(sort: Sort) {
    const parts = [
        sort.fuel && `${FUEL_NAMES[sort.fuel]} first`,
        sort.kw && `Heat output ${KW[sort.kw].toLowerCase()}`,
        sort.w && `Width ${W[sort.w].toLowerCase()}`,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Best match";
}

/** "Sort by" for one section: a button that opens a small menu with three groups */
export default function SortBy(props: SortByProps) {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    // Close on a click outside, and on Escape
    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) =>
            !box.current?.contains(e.target as Node) && setOpen(false);
        const onKey = (e: KeyboardEvent) =>
            e.key === "Escape" && setOpen(false);
        document.addEventListener("pointerdown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // Clicking a chosen option turns that group off; clicking another option chooses it
    function pick<K extends keyof Sort>(key: K, value: Sort[K]) {
        props.onChange({
            ...props.sort,
            [key]: props.sort[key] === value ? null : value,
        });
    }

    const groups: {
        key: keyof Sort;
        label: string;
        options: [string, string][];
    }[] = [
        ...(props.fuels.length > 1
            ? [
                  {
                      key: "fuel" as const,
                      label: "Show first",
                      options: props.fuels.map(
                          (f) => [f, FUEL_NAMES[f]] as [string, string],
                      ),
                  },
              ]
            : []),
        { key: "kw", label: "Heat output", options: Object.entries(KW) },
        { key: "w", label: "Width", options: Object.entries(W) },
    ];

    return (
        <div ref={box} className={styles.sortBy}>
            <span className={styles.label}>Sort by</span>
            <button
                type="button"
                className={styles.button}
                aria-expanded={open}
                aria-haspopup="true"
                onClick={() => setOpen(!open)}
            >
                <span className={styles.summary}>
                    {sortSummary(props.sort)}
                </span>
                <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {open && (
                <div
                    className={styles.panel}
                    role="group"
                    aria-label={`Sort ${props.sectionName}`}
                >
                    {groups.map((g) => (
                        <fieldset key={g.key}>
                            <legend>{g.label}</legend>
                            {g.options.map(([value, label]) => {
                                const on = props.sort[g.key] === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        role="checkbox"
                                        aria-checked={on}
                                        className={
                                            on
                                                ? `${styles.option} ${styles.on}`
                                                : styles.option
                                        }
                                        onClick={() =>
                                            pick(g.key, value as never)
                                        }
                                    >
                                        <span
                                            className={styles.tick}
                                            aria-hidden="true"
                                        />
                                        {g.key === "fuel" && (
                                            <i
                                                className={`${styles.fdot} ${styles[value]}`}
                                            />
                                        )}
                                        {label}
                                    </button>
                                );
                            })}
                        </fieldset>
                    ))}
                </div>
            )}
        </div>
    );
}
