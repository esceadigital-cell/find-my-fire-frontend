"use client";

import { useEffect, useState } from "react";
import styles from "./Skeleton.module.scss";
import { cardsPerRow } from "@/lib/display";

/**
 * Shown the first time the fires load: the block grows out of a blur while the placeholders shimmer.
 * There are as many placeholders as cards fit in a row on this screen (3, 4 or 5 on desktop, 2 on tablet, 1 on phones).
 */
export default function Skeleton() {
    const [per, setPer] = useState(3);

    useEffect(() => {
        const update = () => setPer(cardsPerRow());
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    return (
        <div
            className={styles.skeleton}
            role="status"
            aria-label="Finding your fires"
        >
            <div className={styles.head}>
                <span className={`${styles.bone} ${styles.title}`} />
                <span className={`${styles.bone} ${styles.subtitle}`} />
            </div>
            <div
                className={styles.cards}
                style={{ "--per": per } as React.CSSProperties}
            >
                {Array.from({ length: per }, (_, i) => (
                    <div key={i} className={styles.card}>
                        <span className={`${styles.bone} ${styles.image}`} />
                        <span className={`${styles.bone} ${styles.name}`} />
                        <span className={`${styles.bone} ${styles.line}`} />
                        <span
                            className={`${styles.bone} ${styles.line} ${styles.short}`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
