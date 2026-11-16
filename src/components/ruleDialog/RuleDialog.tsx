"use client";

import { useRef } from "react";
import styles from "./RuleDialog.module.scss";
import { LocationData } from "@/types";
import { useDialog } from "@/lib/dialog";
import Icon, { RuleIcon } from "../icon/Icon";
import LocationMap from "../locationMap/LocationMap";

interface RuleDialogProps {
    location: LocationData;
    onClose: () => void;
}

/** The pop-up behind "Read the rule": where the address is, and what the rule says. */
export default function RuleDialog(props: RuleDialogProps) {
    const panel = useRef<HTMLDivElement>(null);
    useDialog(panel, props.onClose);

    const location = props.location;
    const rule = location.ruleProfile;
    const title =
        location.airShed ??
        (location.region ? `${location.region} rules` : "Local rules");
    const where = location.airShed
        ? location.precise
            ? " · inside the zone"
            : " · the postcode’s centre is inside the zone"
        : "";

    // The full text from Strapi, or the short note if there's no full text
    const text =
        rule?.legalText ||
        rule?.note ||
        "No local wood burner rule was found for this address. Gas and electric fires are never affected.";

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
                aria-labelledby="rule-title"
            >
                <div className={styles.head}>
                    <div>
                        <p className={styles.eyebrow}>
                            <RuleIcon size={16} />
                            Local rule
                        </p>
                        <h2 id="rule-title">{title}</h2>
                        <p className={styles.address}>
                            {location.postcode}
                            {where}
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

                <LocationMap
                    lat={location.lat}
                    lng={location.lng}
                    zones={location.nearby}
                    caption="Dashed line: zone boundary"
                />

                <p className={styles.description}>{text}</p>
                {rule?.sourceUrl && (
                    <a
                        className={styles.source}
                        href={rule.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Source
                    </a>
                )}

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.solid}
                        onClick={props.onClose}
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
