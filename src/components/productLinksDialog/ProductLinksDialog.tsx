"use client";

import { useRef } from "react";
import styles from "./ProductLinksDialog.module.scss";
import { Product, ProductLink } from "@/types";
import { FUEL_NAMES, INSTALL_TYPES, toneFor } from "@/lib/display";
import { useDialog } from "@/lib/dialog";
import Icon from "../icon/Icon";

interface ProductLinksDialogProps {
    product: Product;
    /** the links to choose between: one brand's configurations or versions (Results picks them) */
    links: ProductLink[];
    onClose: () => void;
}

/** What a link's button says: its label, or its configuration, or just "View" */
export function linkText(link: ProductLink) {
    const text = link.label ?? link.configuration?.configurationType ?? "View";
    return text.charAt(0).toUpperCase() + text.slice(1); // "single-sided" → "Single-sided"
}

/**
 * The pop-up when a fire comes in several versions (e.g. single- and double-sided):
 * the fire's name at the top, a large picture, and one button per version.
 */
export default function ProductLinksDialog(props: ProductLinksDialogProps) {
    const panel = useRef<HTMLDivElement>(null);
    useDialog(panel, props.onClose);

    const product = props.product;

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
                aria-labelledby="links-title"
            >
                <div className={styles.head}>
                    <div>
                        <h2 id="links-title">{product.name}</h2>
                        <p>
                            {FUEL_NAMES[product.fuelType]}
                            {product.installType
                                ? ` · ${INSTALL_TYPES[product.installType]}`
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
                    {/* The picture (the fire's colour until there are product photos) */}
                    <div
                        className={styles.picture}
                        style={{ background: toneFor(product) }}
                    />

                    <p className={styles.lede}>
                        Choose a version to see it. It opens in a new tab.
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
                </div>
            </div>
        </div>
    );
}
