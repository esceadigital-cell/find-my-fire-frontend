"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CompareDialog.module.scss";
import { FilterResult, Match } from "@/lib/filterFires";
import { RuleProfile } from "@/types";
import { FUEL_NAMES, INSTALL_TYPES, metres, toneFor } from "@/lib/display";
import { useDialog } from "@/lib/dialog";
import Icon from "../icon/Icon";

interface CompareDialogProps {
    compared: Match[];
    result: FilterResult;
    m2ToHeat: number | null;
    ruleProfile: RuleProfile | null;
    onRemove: (id: string) => void;
    onClose: () => void;
}

type Row = {
    label: string;
    value: (m: Match) => string;
    /** shows a tick or a cross in front of the value */
    good?: (m: Match) => boolean;
};

/** Up to three fires side by side. A table on tablet and desktop, stacked specs on phones. */
export default function CompareDialog(props: CompareDialogProps) {
    const panel = useRef<HTMLDivElement>(null);
    const [differencesOnly, setDifferencesOnly] = useState(false);
    const [phone, setPhone] = useState(false);
    useDialog(panel, props.onClose);

    // Phones get the stacked layout
    useEffect(() => {
        const query = window.matchMedia("(max-width: 699px)");
        const update = () => setPhone(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    const kw = props.result.kwNeeded;
    const cols = props.compared;
    const area = props.m2ToHeat ? Math.round(props.m2ToHeat * 10) / 10 : null;

    function ranking(m: Match) {
        const position = props.result.best.indexOf(m);
        if (position === 0) return "Best match";
        if (position > 0) return `Best for your home · #${position + 1}`;
        return "You might love this too";
    }

    const rows: Row[] = [
        { label: "Your ranking", value: ranking, good: () => true },
        { label: "Fuel", value: (m) => FUEL_NAMES[m.product.fuelType] },
        {
            label: "Style",
            value: (m) =>
                m.product.installType
                    ? INSTALL_TYPES[m.product.installType]
                    : "–",
        },
        {
            label: "Heat output",
            value: (m) =>
                `Up to ${m.product.maxOutputKw ?? "?"} kW${kw !== null ? ` · you need ${kw}` : ""}`,
            good: (m) => kw === null || (m.product.maxOutputKw ?? 0) >= kw,
        },
        { label: "Width", value: (m) => metres(m.product.width) },
        { label: "Height", value: (m) => metres(m.product.height) },
        {
            label: "Emissions",
            value: (m) =>
                m.product.emissionsGkg == null
                    ? "Not applicable"
                    : `${m.product.emissionsGkg} g/kg`,
        },
        {
            label: "Efficiency",
            value: (m) =>
                m.product.efficiencyPct == null
                    ? "–"
                    : `${m.product.efficiencyPct}%`,
        },
        {
            label: "Local rule",
            value: (m) =>
                m.product.fuelType !== "wood"
                    ? "Not affected"
                    : props.ruleProfile
                      ? "Meets the rules at your address"
                      : "No local rules",
        },
        {
            label: "Needs",
            value: (m) =>
                m.product.fuelType === "gas"
                    ? "Natural gas or LPG, flue"
                    : m.product.fuelType === "wood"
                      ? "Flue, firewood"
                      : "Power socket only",
        },
        {
            label: "Why it’s ranked here",
            value: (m) =>
                m.misses.length
                    ? `You chose ${m.misses.join(" and ")}`
                    : "Matches your answers",
        },
    ];

    const tick = (ok: boolean) =>
        ok ? (
            <span className={styles.ok}>
                <Icon name="check" size={14} strokeWidth={2.4} />
            </span>
        ) : (
            <span className={styles.bad}>
                <Icon name="x" size={14} strokeWidth={2.4} />
            </span>
        );

    const diffToggle = (
        <button
            type="button"
            className={styles.check}
            aria-pressed={differencesOnly}
            onClick={() => setDifferencesOnly(!differencesOnly)}
        >
            <span className={styles.box}>
                {differencesOnly && (
                    <span className={styles.boxTick}>
                        <Icon name="check" size={14} strokeWidth={3} />
                    </span>
                )}
            </span>
            Only show differences
        </button>
    );

    const shownRows = rows
        .map((row) => ({ row, values: cols.map(row.value) }))
        .map((r) => ({ ...r, differs: new Set(r.values).size > 1 }))
        .filter((r) => !differencesOnly || r.differs);

    const fireHeader = (m: Match) => (
        <>
            <div
                className={styles.thumb}
                style={{ background: toneFor(m.product) }}
            />
            <div className={styles.colName}>{m.product.name}</div>
            <div className={styles.colType}>
                {FUEL_NAMES[m.product.fuelType]} ·{" "}
                {m.product.installType
                    ? INSTALL_TYPES[m.product.installType]
                    : "–"}
            </div>
            <button
                type="button"
                className={styles.remove}
                onClick={() => props.onRemove(m.product.documentId)}
            >
                Remove
            </button>
        </>
    );

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
                aria-labelledby="compare-title"
            >
                <div className={styles.panelHead}>
                    <div>
                        <h2 id="compare-title">Compare {cols.length} fires</h2>
                        <p>
                            Measured against your home:{" "}
                            {kw !== null ? `${kw} kW needed, ` : ""}
                            {area} m².
                        </p>
                    </div>
                    <button
                        type="button"
                        className={styles.ib}
                        aria-label="Close compare"
                        onClick={props.onClose}
                        data-close
                    >
                        <Icon name="x" />
                    </button>
                </div>

                {phone ? (
                    // Phones: each spec's name sits above its values
                    <>
                        <div className={`${styles.tools} ${styles.mobileDiff}`}>
                            {diffToggle}
                        </div>
                        <div
                            className={styles.cm}
                            style={
                                { "--n": cols.length } as React.CSSProperties
                            }
                        >
                            <div className={styles.cmFires}>
                                {cols.map((m) => (
                                    <div key={m.product.documentId}>
                                        {fireHeader(m)}
                                    </div>
                                ))}
                            </div>
                            {shownRows.map(({ row, values, differs }) => (
                                <section
                                    key={row.label}
                                    className={
                                        differs
                                            ? `${styles.cmSpec} ${styles.diff}`
                                            : styles.cmSpec
                                    }
                                    aria-label={row.label}
                                >
                                    <h3 className={styles.cmLabel}>
                                        {row.label}
                                        {differs && <span>Differs</span>}
                                    </h3>
                                    <div className={styles.cmValues}>
                                        {cols.map((m, i) => (
                                            <div key={m.product.documentId}>
                                                <span className={styles.sr}>
                                                    {m.product.name}:{" "}
                                                </span>
                                                <span className={styles.cell}>
                                                    {row.good &&
                                                        tick(row.good(m))}
                                                    <span>{values[i]}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <colgroup>
                                <col className={styles.rowHeadCol} />
                                {cols.map((m) => (
                                    <col key={m.product.documentId} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th scope="row" className={styles.corner}>
                                        <span className={styles.sr}>Fire</span>
                                        {diffToggle}
                                    </th>
                                    {cols.map((m) => (
                                        <th
                                            key={m.product.documentId}
                                            scope="col"
                                        >
                                            {fireHeader(m)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {shownRows.map(({ row, values, differs }) => (
                                    <tr
                                        key={row.label}
                                        className={
                                            differs ? styles.diff : undefined
                                        }
                                    >
                                        <th scope="row">{row.label}</th>
                                        {cols.map((m, i) => (
                                            <td key={m.product.documentId}>
                                                <span className={styles.cell}>
                                                    {row.good &&
                                                        tick(row.good(m))}
                                                    <span>{values[i]}</span>
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
