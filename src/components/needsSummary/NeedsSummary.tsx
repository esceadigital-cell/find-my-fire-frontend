import styles from "./NeedsSummary.module.scss";
import { FilterResult } from "@/lib/filterFires";
import { LocationData } from "@/types";
import Icon, { RuleIcon } from "../icon/Icon";

interface NeedsSummaryProps {
    result: FilterResult;
    location: LocationData | null;
    m2ToHeat: number | null;
    /** show the "Showing 8 best matches · …" line (once the fires show) */
    showing: boolean;
    /** smaller version, so the results get more room (tablet and desktop) */
    compact: boolean;
    onToggleCompact: () => void;
    onOpenRule: () => void;
}

/** "What your home needs": the strip with the heat need, the local rule and the funnel. */
export default function NeedsSummary(props: NeedsSummaryProps) {
    const location = props.location;
    const kw = props.result.kwNeeded;
    const ready = kw !== null;

    // The rules that apply at the address: the air shed's if it's in one, otherwise the region's
    const ruleName =
        location?.airShed ??
        (location?.region ? `${location.region} rules apply` : null);

    // 0 kW means the fire is just for looks (0 % in step 2): no heat need, and the room size doesn't matter
    const forLooks = kw === 0;
    const area =
        props.m2ToHeat && !forLooks
            ? Math.round(props.m2ToHeat * 10) / 10
            : null;

    return (
        <div
            className={
                props.compact
                    ? `${styles.needs} ${styles.compact}`
                    : styles.needs
            }
            // Compact: clicking it shows it in full again
            onClick={props.compact ? props.onToggleCompact : undefined}
        >
            <div className={styles.head}>
                <h2 className={styles.eyebrow}>What your home needs</h2>
            </div>

            <div className={styles.strip}>
                <div className={styles.heat}>
                    <span className={styles.key}>Heat needed</span>
                    <span className={styles.big}>
                        {ready ? `${kw} kW` : "–"}
                    </span>
                    <span className={styles.small}>
                        {ready
                            ? `Choose a fire ≥ ${kw} kW`
                            : "After steps 1 and 2"}
                    </span>
                </div>
                <div>
                    <span className={styles.key}>Space</span>
                    <span className={`${styles.value} ${styles.num}`}>
                        {area ? `${area} m²` : "–"}
                    </span>
                </div>
                <div className={styles.climate}>
                    <span className={styles.key}>Climate</span>
                    <span className={styles.value}>
                        {location?.climateZone
                            ? `${location.climateZone.name} zone`
                            : "–"}
                    </span>
                </div>
                <div className={styles.region}>
                    <span className={styles.key}>Region</span>
                    <span className={styles.value}>
                        {location?.region ?? "–"}
                    </span>
                </div>
            </div>

            {ruleName && (
                <p className={styles.rule}>
                    <RuleIcon size={18} />
                    <span>
                        <b>{ruleName}</b> ·{" "}
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                props.onOpenRule();
                            }}
                        >
                            Read the rule
                        </a>
                    </span>
                </p>
            )}

            {/* "SHOWING 8 best matches · 12 close on heat · 4 worth a look" (parts with 0 are left out) */}
            {props.showing && (
                <p className={styles.showing}>
                    <span className={styles.showingKey}>Showing</span>
                    <span className={styles.showingValue}>
                        <span>
                            {props.result.best.length} best match
                            {props.result.best.length === 1 ? "" : "es"}
                        </span>
                        {props.result.close.length > 0 && (
                            <span>
                                {" "}
                                · {props.result.close.length} close on heat
                            </span>
                        )}
                        {props.result.more.length > 0 && (
                            <span>
                                {" "}
                                · {props.result.more.length} worth a look
                            </span>
                        )}
                    </span>
                </p>
            )}
        </div>
    );
}
