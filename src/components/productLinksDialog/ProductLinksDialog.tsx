"use client";

import { useRef, useEffect, useState } from "react";
import styles from "./ProductLinksDialog.module.scss";
import { Product, ProductLink } from "@/types";
import { FUEL_NAMES, INSTALL_TYPES } from "@/lib/display";
import { useDialog } from "@/lib/dialog";
import ProductPicture from "../productPicture/ProductPicture";
import Icon from "../icon/Icon";

interface ProductLinksDialogProps {
    product: Product;
    /** the brand's links for this fire (Results picks them): one, several versions, or none */
    links: ProductLink[];
    /** the room's heat need, for "you need 6 kW" (null when there's none) */
    kwNeeded: number | null;
    onClose: () => void;
}

/** What a version's button says: its label, or its configuration, or just "View" */
export function linkText(link: ProductLink) {
    const text = link.label ?? link.configuration?.configurationType ?? "View";
    return text.charAt(0).toUpperCase() + text.slice(1); // "single-sided" → "Single-sided"
}

/** The brand's name for a link, e.g. "Escea" */
function brandName(product: Product, link: ProductLink) {
    return (
        product.brands?.find((b) => b.slug === link.brand?.slug)?.brandName ??
        "the brand’s site"
    );
}

const yesNo = (v: boolean | null | undefined) =>
    v == null ? null : v ? "Yes" : "No";
const FLUES = {
    "direct vent": "Direct vent",
    "powered direct vent": "Powered direct vent",
    ventless: "None needed",
};

type Row = [string, React.ReactNode | null];

/**
 * The pop-up when a fire is clicked: its picture, its properties in grouped boxes, and the way to its page:
 * one button for one link, or a button per version (e.g. single- and double-sided).
 */
export default function ProductLinksDialog(props: ProductLinksDialogProps) {
    const panel = useRef<HTMLDivElement>(null);
    useDialog(panel, props.onClose);

    // The fade at the bottom of the properties: only while there's more to scroll to
    const scroll = useRef<HTMLDivElement>(null);
    const [fade, setFade] = useState(false);

    useEffect(() => {
        const el = scroll.current;
        if (!el) return;
        const update = () =>
            setFade(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
        update();
        el.addEventListener("scroll", update, { passive: true });
        const observer = new ResizeObserver(update); // the window or the pop-up changed size
        observer.observe(el);
        return () => {
            el.removeEventListener("scroll", update);
            observer.disconnect();
        };
    }, []);

    const p = props.product;
    const m = (v: number | null) => (v == null ? "–" : `${v}`);

    // The groups; rows without a value, and groups without rows, are left out
    const groups: [string, Row[]][] = [
        [
            "Fit for your home",
            [
                [
                    "Heat output",
                    p.maxOutputKw == null
                        ? null
                        : `Up to ${p.maxOutputKw} kW${props.kwNeeded ? ` · you need ${props.kwNeeded} kW` : ""}`,
                ],
                ["Width", p.width == null ? null : `${p.width} m`],
                [
                    "Height × depth",
                    p.height == null && p.depth == null
                        ? null
                        : `${m(p.height)} × ${m(p.depth)} m`,
                ],
            ],
        ],
        [
            "Performance",
            [
                [
                    "Energy rating",
                    p.star_rating == null ? null : `${p.star_rating} stars`,
                ],
                [
                    "Efficiency",
                    p.efficiencyPct == null ? null : `${p.efficiencyPct}%`,
                ],
                [
                    "Emissions",
                    p.emissionsGkg == null ? null : `${p.emissionsGkg} g/kg`,
                ],
                ["ULEB-listed", yesNo(p.uleb)],
                ["Clean air approved", yesNo(p.clean_air_approved)],
            ],
        ],
        [
            "Installation",
            [
                [
                    "Install",
                    p.installType ? INSTALL_TYPES[p.installType] : null,
                ],
                ["Flue", p.flue_type ? FLUES[p.flue_type] : null],
                ["Zero clearance", yesNo(p.zero_clearance_rated)],
                ["Outdoor", p.isOutdoor ? "Yes" : null],
            ],
        ],
        [
            "Features",
            [
                ["Remote control", yesNo(p.remote_control)],
                ["SmartHeat app", yesNo(p.smartheat_wifi)],
                ["Wetback", p.fuelType === "wood" ? yesNo(p.wetback) : null],
                ["External fan", p.external_fan],
            ],
        ],
    ];

    return (
        <div
            className={styles.dialog}
            onClick={(e) => e.target === e.currentTarget && props.onClose()}
        >
            <div
                ref={panel}
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-title"
            >
                <div className={styles.head}>
                    <div>
                        <h2 id="product-title">{p.name}</h2>
                        <p>
                            {FUEL_NAMES[p.fuelType]}
                            {p.installType
                                ? ` · ${INSTALL_TYPES[p.installType]}`
                                : ""}
                        </p>
                    </div>
                    <button
                        type="button"
                        className={styles.ib}
                        aria-label="Close"
                        onClick={props.onClose}
                        data-close
                    >
                        <Icon name="x" />
                    </button>
                </div>

                <div className={styles.body}>
                    <ProductPicture
                        product={p}
                        className={styles.picture}
                        sizes="(max-width: 699px) 100vw, 520px"
                    />

                    {/* The properties scroll; the picture and the buttons stay */}
                    <div
                        className={
                            fade
                                ? `${styles.scrollWrap} ${styles.more}`
                                : styles.scrollWrap
                        }
                    >
                        <div
                            ref={scroll}
                            className={
                                fade
                                    ? `${styles.scroll} ${styles.fade}`
                                    : styles.scroll
                            }
                        >
                            {groups.map(([title, rows]) => {
                                const filled = rows.filter(
                                    ([, v]) => v != null && v !== "",
                                );
                                if (!filled.length) return null;
                                return (
                                    <section
                                        key={title}
                                        className={styles.group}
                                    >
                                        <h3>{title}</h3>
                                        <dl>
                                            {filled.map(([k, v]) => (
                                                <div key={k}>
                                                    <dt>{k}</dt>
                                                    <dd>{v}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </section>
                                );
                            })}
                        </div>
                    </div>

                    {props.links.length > 1 ? (
                        <>
                            <p className={styles.lede}>
                                Choose a version to see it. It opens in a new
                                tab.
                            </p>
                            <div className={styles.options}>
                                {props.links.map((link) => (
                                    <a
                                        key={link.id}
                                        className={styles.option}
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <span>{linkText(link)}</span>
                                        <Icon name="external" size={16} />
                                    </a>
                                ))}
                            </div>
                        </>
                    ) : props.links.length === 1 ? (
                        <a
                            className={styles.go}
                            href={props.links[0].url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            View on {brandName(p, props.links[0])}
                            <Icon name="external" size={16} />
                        </a>
                    ) : (
                        <p className={styles.lede}>
                            There’s no page for this fire yet.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
