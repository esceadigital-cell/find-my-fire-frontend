import styles from "./NeedsSummary.module.scss";
import { FilterResult } from "@/lib/filterFires";
import { LocationData } from "@/types";
import { FUEL_NAMES } from "@/lib/display";
import Icon, { RuleIcon } from "../icon/Icon";

interface NeedsSummaryProps {
    result: FilterResult;
    location: LocationData | null;
    m2ToHeat: number | null;
    /** the fires are showing and have loaded: the funnel goes with them */
    showFunnel: boolean;
    /** smaller version, so the results get more room (tablet and desktop) */
    compact: boolean;
    onToggleCompact: () => void;
    onOpenRule: () => void;
}

const FUELS = ["gas", "wood", "electric"] as const;

/** "What your home needs": the strip with the heat need, the local rule and the funnel. */
export default function NeedsSummary(props: NeedsSummaryProps) {
    const location = props.location;
    const kw = props.result.kwNeeded;
    const ready = kw !== null;

    // Fuels that are still possible (all three until there are results)
    const possible = [...props.result.best, ...props.result.more];
    const fuels = ready
        ? FUELS.filter((f) => possible.some((m) => m.product.fuelType === f))
        : FUELS;

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
        >
            <div className={styles.head}>
                <h2 className={styles.eyebrow}>What your home needs</h2>
            </div>

            <button
                type="button"
                className={styles.toggle}
                aria-label={
                    props.compact
                        ? "Show what your home needs in full"
                        : "Minimise what your home needs"
                }
                aria-expanded={!props.compact}
                onClick={props.onToggleCompact}
            >
                <span>{props.compact ? "Expand" : "Collapse"}</span>
                <svg
                    className={styles.toggleChevron}
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

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
                <div>
                    <span className={styles.key}>Fuel</span>
                    <span className={styles.ftags}>
                        {fuels.map((f) => (
                            <span key={f} className={styles.ftag}>
                                <i className={`${styles.fdot} ${styles[f]}`} />
                                {FUEL_NAMES[f]}
                            </span>
                        ))}
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
        </div>
    );
}
