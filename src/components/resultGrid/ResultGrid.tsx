"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ResultGrid.module.scss";
import { Match } from "@/lib/filterFires";
import { Product } from "@/types";
import { FUEL_NAMES, INSTALL_TYPES, cardsPerRow } from "@/lib/display";
import ProductPicture from "../productPicture/ProductPicture";
import SortBy, { DEFAULT_SORT, Fuel, Sort } from "../sortBy/SortBy";
import Icon from "../icon/Icon";

interface ResultGridProps {
    matches: Match[];
    /** "top": Best for your home (big heading, 2 rows). "close" and "more": a grey box (1 row) */
    kind: "top" | "close" | "more";
    title: string;
    /** the explanation under the heading (close and more); Best shows its count instead */
    explanation?: string;
    /** the heat need, so close cards can say how far under they are */
    kwNeeded: number | null;
    onOpenProduct: (product: Product) => void;
    compareIds: string[];
    onToggleCompare: (id: string, checked: boolean) => void;
    emptyText?: string;
    /** phones: a row that scrolls sideways (cards at 64% width) instead of a grid */
    phone?: boolean;
}

const FUELS: Fuel[] = ["gas", "wood", "electric"];

/** Sorts a copy of the list: the chosen fuel first, then heat output, then width */
function sortMatches(list: Match[], sort: Sort) {
    const kw = (m: Match) => m.product.maxOutputKw ?? 0;
    const w = (m: Match) => m.product.width ?? 0;
    return [...list].sort(
        (a, b) =>
            (sort.fuel
                ? Number(b.product.fuelType === sort.fuel) -
                Number(a.product.fuelType === sort.fuel)
                : 0) ||
            (sort.kw
                ? sort.kw === "asc"
                    ? kw(a) - kw(b)
                    : kw(b) - kw(a)
                : 0) ||
            (sort.w ? (sort.w === "asc" ? w(a) - w(b) : w(b) - w(a)) : 0),
    );
}

/**
 * One section of results on tablet and desktop: a grid of cards.
 * Best starts with 2 rows, the others with 1; "Show more" adds a row. Sorting never changes how many show.
 */
export default function ResultGrid(props: ResultGridProps) {
    const [per, setPer] = useState(3);
    // Close on heat: highest first, so the one closest to the need comes first
    const [sort, setSort] = useState<Sort>(
        props.kind === "close" ? { ...DEFAULT_SORT, kw: "desc" } : DEFAULT_SORT,
    );
    const [rows, setRows] = useState(props.kind === "top" ? 2 : 1);

    useEffect(() => {
        const update = () => setPer(cardsPerRow());
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    // Any change in the answers starts again from the first rows
    const ids = props.matches.map((m) => m.product.documentId).join();
    useEffect(() => setRows(props.kind === "top" ? 2 : 1), [ids, props.kind]);

    const sorted = useMemo(
        () => sortMatches(props.matches, sort),
        [props.matches, sort],
    );
    const fuels = FUELS.filter((f) =>
        props.matches.some((m) => m.product.fuelType === f),
    );
    const n = sorted.length;
    const base = (props.kind === "top" ? 2 : 1) * per;
    const shown = Math.min(n, rows * per);
    const all = shown >= n;

    // ---------- Phones: the sideways row, its counter and arrows ----------
    const track = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState(1);
    function onTrackScroll() {
        const t = track.current;
        const first = t?.firstElementChild as HTMLElement | null;
        if (!t || !first) return;
        const step = first.offsetWidth + 12; // card width + gap
        setPos(Math.min(n, Math.round(t.scrollLeft / step) + 1));
    }
    function move(by: number) {
        const t = track.current;
        const first = t?.firstElementChild as HTMLElement | null;
        if (t && first)
            t.scrollBy({
                left: by * (first.offsetWidth + 12),
                behavior: "smooth",
            });
    }
    useEffect(() => {
        track.current?.scrollTo({ left: 0 });
        setPos(1);
    }, [ids, sort]);

    const sectionClass =
        props.kind === "top"
            ? `${styles.section} ${styles.top}`
            : `${styles.section} ${styles.box} ${props.kind === "close" ? styles.close : styles.more}`;

    return (
        <section className={sectionClass} aria-label={props.title}>
            <div className={styles.head}>
                <h2>{props.title}</h2>
                {/* The line under the heading: count or explanation, fuel types, and Sort by at the right end */}
                <div className={styles.subRow}>
                    <div className={styles.subLeft}>
                        <span>
                            {props.explanation ??
                                `${n} fire${n === 1 ? "" : "s"}`}
                        </span>
                        {fuels.length > 0 && (
                            <>
                                <span className={styles.sep} aria-hidden="true">
                                    ·
                                </span>
                                <span className={styles.fuelTypes}>
                                    <span className={styles.fuelKey}>
                                        Fuel types
                                    </span>
                                    {fuels.map((f) => (
                                        <span key={f} className={styles.ftag}>
                                            <i
                                                className={`${styles.fdot} ${styles[f]}`}
                                            />
                                            {FUEL_NAMES[f]}
                                        </span>
                                    ))}
                                </span>
                            </>
                        )}
                    </div>
                    {n > 1 && (
                        <SortBy
                            sort={sort}
                            onChange={setSort}
                            fuels={fuels}
                            sectionName={props.title}
                        />
                    )}
                </div>
            </div>

            {n === 0 ? (
                <p className={styles.empty}>{props.emptyText}</p>
            ) : props.phone ? (
                <>
                    <div
                        ref={track}
                        className={styles.track}
                        onScroll={onTrackScroll}
                    >
                        {sorted.map((m, i) => (
                            <Card
                                key={m.product.documentId}
                                match={m}
                                index={i}
                                kind={props.kind}
                                kwNeeded={props.kwNeeded}
                                compared={props.compareIds.includes(
                                    m.product.documentId,
                                )}
                                onOpen={() => props.onOpenProduct(m.product)}
                                onToggleCompare={(checked) =>
                                    props.onToggleCompare(
                                        m.product.documentId,
                                        checked,
                                    )
                                }
                            />
                        ))}
                    </div>
                    {n > 1 && (
                        <div className={styles.trackNav}>
                            <span>
                                {pos} / {n}
                            </span>
                            <button
                                type="button"
                                className={styles.arrow}
                                aria-label="Previous fires"
                                disabled={pos <= 1}
                                onClick={() => move(-1)}
                            >
                                <Icon name="arrowLeft" size={16} />
                            </button>
                            <button
                                type="button"
                                className={styles.arrow}
                                aria-label="Next fires"
                                disabled={pos >= n}
                                onClick={() => move(1)}
                            >
                                <Icon name="arrowRight" size={16} />
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div
                    className={styles.grid}
                    style={{ "--per": per } as React.CSSProperties}
                >
                    {sorted.slice(0, shown).map((m, i) => (
                        <Card
                            key={m.product.documentId}
                            match={m}
                            index={i}
                            kind={props.kind}
                            kwNeeded={props.kwNeeded}
                            compared={props.compareIds.includes(
                                m.product.documentId,
                            )}
                            onOpen={() => props.onOpenProduct(m.product)}
                            onToggleCompare={(checked) =>
                                props.onToggleCompare(
                                    m.product.documentId,
                                    checked,
                                )
                            }
                        />
                    ))}
                </div>
            )}

            {n > base && !props.phone && (
                <div className={styles.moreRow}>
                    <span>
                        {all ? `Showing all ${n}` : `Showing ${shown} of ${n}`}
                    </span>
                    <button
                        type="button"
                        className={styles.moreButton}
                        onClick={() =>
                            setRows(
                                all ? (props.kind === "top" ? 2 : 1) : rows + 1,
                            )
                        }
                    >
                        {all ? "Show fewer" : "Show more"}
                    </button>
                </div>
            )}
        </section>
    );
}

interface CardProps {
    match: Match;
    index: number;
    kind: "top" | "close" | "more";
    kwNeeded: number | null;
    compared: boolean;
    onOpen: () => void;
    onToggleCompare: (checked: boolean) => void;
}

/** One fire: picture, name, a small table (heat, size, install), and View + Compare */
function Card(props: CardProps) {
    const p = props.match.product;
    const short = props.match.kwShort > 0;
    const enough = !short && props.kwNeeded != null && props.kwNeeded > 0;
    const m = (v: number | null) => (v == null ? "–" : v);

    return (
        <article
            className={styles.card}
            style={{ "--k": props.index } as React.CSSProperties}
        >
            <ProductPicture
                product={p}
                className={styles.picture}
                sizes="(max-width: 1099px) 35vw, 25vw"
            >
                <span className={styles.tag}>
                    <i className={`${styles.fdot} ${styles[p.fuelType]}`} />
                    {FUEL_NAMES[p.fuelType]}
                </span>
            </ProductPicture>

            <div className={styles.body}>
                <h3>{p.name}</h3>
                <span className={styles.type}>
                    {p.installType ? INSTALL_TYPES[p.installType] : ""}
                </span>

                <dl className={styles.table}>
                    <div>
                        <dt>Heat</dt>
                        <dd>
                            {p.maxOutputKw ?? "–"} kW
                            {short && (
                                <span className={styles.approx}>
                                    {" "}
                                    ≈ {props.match.kwShort} kW under
                                </span>
                            )}
                            {enough && (
                                <span className={styles.ok}>
                                    <Icon
                                        name="check"
                                        size={12}
                                        strokeWidth={2.6}
                                    />
                                </span>
                            )}
                        </dd>
                    </div>
                    <div>
                        <dt>Size</dt>
                        <dd>
                            <span className={styles.dim}>W</span>
                            {m(p.width)} <span className={styles.dim}>H</span>
                            {m(p.height)} <span className={styles.dim}>D</span>
                            {m(p.depth)} m
                        </dd>
                    </div>
                    <div>
                        <dt>Install</dt>
                        <dd>
                            {p.installType ? INSTALL_TYPES[p.installType] : "–"}
                        </dd>
                    </div>
                </dl>
            </div>

            <div className={styles.foot}>
                {/* The whole card is clickable: this button's click area covers it */}
                <button
                    type="button"
                    className={styles.view}
                    onClick={props.onOpen}
                >
                    View {p.name}
                </button>
                <label className={styles.compare}>
                    <input
                        type="checkbox"
                        checked={props.compared}
                        onChange={(e) =>
                            props.onToggleCompare(e.target.checked)
                        }
                    />
                    Compare
                </label>
            </div>
        </article>
    );
}
