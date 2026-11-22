"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ProductSlider.module.scss";
import { Product } from "@/types";
import { Match } from "@/lib/filterFires";
import { FUEL_NAMES, INSTALL_TYPES, cardsPerRow, metres } from "@/lib/display";
import ProductPicture from "../productPicture/ProductPicture";

interface ProductSliderProps {
    /** straight from the filter: result.best or result.more */
    matches: Match[];
    /** the rounded-up heat need, for "Up to 12.5 kW · you need 6" (leave out to show only the output) */
    kwNeeded?: number | null;
    /** e.g. "Best for your home" or "You might love these too" */
    title?: string;
    /** "top": big heading and sandstone cards. "close" and "more": the grey box with smaller cards */
    variant?: "top" | "close" | "more";
    /** called when a card's "View" is clicked */
    onOpenProduct?: (product: Product) => void;
    // ---- Added: compare, and the text when the list is empty ----
    /** the fires ticked for comparing (shows the Compare tick box on each card when given) */
    compareIds?: string[];
    onToggleCompare?: (id: string, checked: boolean) => void;
    emptyText?: string;
}

/**
 * A row of fire cards that scrolls sideways with a finger or trackpad.
 * The subtitle, arrows, dots and counter follow the scroll position.
 */
export default function ProductSlider(props: ProductSliderProps) {
    const variant = props.variant ?? "top";
    const track = useRef<HTMLDivElement>(null);
    const [per, setPer] = useState(3); // cards per row
    const [index, setIndex] = useState(0); // the first card in view

    const total = props.matches.length;

    // Follow the screen size
    useEffect(() => {
        const update = () => setPer(cardsPerRow());
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    // Back to the start when the list changes, or the number of cards per row does
    const listKey = props.matches.map((m) => m.product.documentId).join();
    useEffect(() => {
        if (track.current) track.current.scrollLeft = 0;
        setIndex(0);
    }, [listKey, per]);

    // The distance from one card to the next
    function cardStep(tr: HTMLDivElement) {
        const cards = tr.children;
        if (cards.length > 1)
            return (
                (cards[1] as HTMLElement).offsetLeft -
                (cards[0] as HTMLElement).offsetLeft
            );
        return cards[0] ? (cards[0] as HTMLElement).offsetWidth : 1;
    }

    // Work out which card is first in view from the scroll position
    function onScroll() {
        const tr = track.current;
        if (!tr) return;
        const max = tr.scrollWidth - tr.clientWidth;
        setIndex(
            tr.scrollLeft >= max - 2
                ? Math.max(0, total - per)
                : Math.round(tr.scrollLeft / cardStep(tr)),
        );
    }

    function scrollToIndex(i: number) {
        const tr = track.current;
        if (!tr) return;
        const target = Math.max(0, Math.min(i, total - per));
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches;
        tr.scrollTo({
            left: target * cardStep(tr),
            behavior: smooth ? "smooth" : "auto",
        });
    }

    // Back one page; if the row is between pages, back to the start of this one
    function previous() {
        scrollToIndex(
            index % per ? Math.floor(index / per) * per : index - per,
        );
    }

    // Which page we're on, and the "1–3 of 7" text
    const pages = Math.max(1, Math.ceil(total / per));
    const atStart = index <= 0;
    const atEnd = index >= total - per;
    const page = atEnd
        ? pages - 1
        : Math.min(pages - 1, Math.round(index / per));
    const from = total ? index + 1 : 0;
    const to = Math.min(total, index + per);
    const range =
        per === 1 ? `${from} of ${total}` : `${from}–${to} of ${total}`;
    const subtitle =
        variant === "top"
            ? `Showing ${range} · sorted by best match`
            : variant === "close"
              ? `${range} · they match all your answers, but give a little less heat than your room needs`
              : `${range} · they suit your room and the rules, ranked lower only because of your answers`;

    return (
        <section
            className={`${styles.slider} ${styles[variant === "top" ? "top" : "more"]}`}
            aria-label={props.title}
        >
            <div className={styles.head}>
                <div>
                    {props.title && <h2>{props.title}</h2>}
                    <p className={styles.sub}>{subtitle}</p>
                </div>
                <div className={styles.arrows}>
                    <button
                        type="button"
                        className={styles.arrow}
                        aria-label="Previous"
                        disabled={atStart}
                        onClick={previous}
                    >
                        <svg
                            aria-hidden="true"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M19 12H5M11 6l-6 6 6 6" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        className={`${styles.arrow} ${styles.dark}`}
                        aria-label="Next"
                        disabled={atEnd}
                        onClick={() => scrollToIndex(index + per)}
                    >
                        <svg
                            aria-hidden="true"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                    </button>
                </div>
            </div>

            {total ? (
                <div
                    ref={track}
                    className={styles.track}
                    style={{ "--per": per } as React.CSSProperties}
                    onScroll={onScroll}
                >
                    {props.matches.map(({ product, misses, kwShort }, i) => (
                        <article
                            key={product.documentId}
                            className={styles.card}
                        >
                            <ProductPicture
                                product={product}
                                className={styles.picture}
                                sizes="(max-width: 699px) 100vw, (max-width: 1099px) 35vw, 25vw"
                            >
                                <span
                                    className={`${styles.tag} ${styles.fuel}`}
                                >
                                    <i
                                        className={`${styles.dot} ${styles[product.fuelType]}`}
                                    />
                                    {FUEL_NAMES[product.fuelType]}
                                </span>
                                {variant === "top" && i === 0 && (
                                    <span
                                        className={`${styles.tag} ${styles.best}`}
                                    >
                                        Best match
                                    </span>
                                )}
                            </ProductPicture>

                            <div className={styles.body}>
                                <h3>{product.name}</h3>
                                <span className={styles.type}>
                                    {product.installType
                                        ? INSTALL_TYPES[product.installType]
                                        : FUEL_NAMES[product.fuelType]}
                                </span>

                                {misses.length > 0 ? (
                                    // "You might love these too": what it doesn't match
                                    <p className={styles.why}>
                                        You chose <b>{misses.join(", ")}</b>,
                                        but this one suits everything else.
                                    </p>
                                ) : (
                                    <ul className={styles.specs}>
                                        {product.maxOutputKw != null && (
                                            <li>
                                                {kwShort > 0 ? (
                                                    // Close on heat: how far below the need
                                                    <>
                                                        ≈ {product.maxOutputKw}{" "}
                                                        kW · {kwShort} kW under
                                                        your {props.kwNeeded}
                                                    </>
                                                ) : (
                                                    <>
                                                        Up to{" "}
                                                        {product.maxOutputKw} kW
                                                        {props.kwNeeded !=
                                                            null &&
                                                            ` · you need ${props.kwNeeded}`}
                                                    </>
                                                )}
                                            </li>
                                        )}
                                        {product.width != null && (
                                            <li>
                                                {metres(product.width)} wide
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            <div className={styles.foot}>
                                <button
                                    type="button"
                                    className={styles.view}
                                    onClick={() =>
                                        props.onOpenProduct?.(product)
                                    }
                                >
                                    View {product.name}
                                </button>
                                {props.onToggleCompare && (
                                    <label className={styles.compare}>
                                        <input
                                            type="checkbox"
                                            checked={
                                                props.compareIds?.includes(
                                                    product.documentId,
                                                ) ?? false
                                            }
                                            onChange={(e) =>
                                                props.onToggleCompare?.(
                                                    product.documentId,
                                                    e.target.checked,
                                                )
                                            }
                                        />
                                        Compare
                                    </label>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <p className={styles.empty}>
                    {props.emptyText ?? "No fires match yet."}
                </p>
            )}

            {pages > 1 && (
                <>
                    <div
                        className={styles.dots}
                        role="group"
                        aria-label="Pages"
                    >
                        {Array.from({ length: pages }, (_, i) => (
                            <button
                                key={i}
                                type="button"
                                className={i === page ? styles.on : undefined}
                                aria-label={`Page ${i + 1}`}
                                aria-current={i === page ? "true" : undefined}
                                onClick={() => scrollToIndex(i * per)}
                            >
                                <span />
                            </button>
                        ))}
                    </div>
                    <p className={styles.counter}>
                        Swipe for more · {page + 1} / {pages}
                    </p>
                </>
            )}
        </section>
    );
}
