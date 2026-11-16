import styles from "./CompareBar.module.scss";
import { Match } from "@/lib/filterFires";
import Icon from "../icon/Icon";

interface CompareBarProps {
    compared: Match[];
    message: string;
    onRemove: (id: string) => void;
    onClear: () => void;
    onOpen: () => void;
}

/** The dark bar at the bottom while fires are picked for comparing. */
export default function CompareBar(props: CompareBarProps) {
    const count = props.compared.length;

    return (
        <div className={styles.bar}>
            <span className={styles.label}>Compare</span>
            <span className={styles.count}>{count} selected</span>
            <div className={styles.chips}>
                {props.compared.map((m) => (
                    <span key={m.product.documentId} className={styles.chip}>
                        {m.product.name}
                        <button
                            type="button"
                            aria-label={`Remove ${m.product.name}`}
                            onClick={() => props.onRemove(m.product.documentId)}
                        >
                            <Icon name="x" size={14} strokeWidth={2} />
                        </button>
                    </span>
                ))}
            </div>
            <button
                type="button"
                className={styles.clear}
                onClick={props.onClear}
            >
                Clear
            </button>
            <button
                type="button"
                className={styles.go}
                disabled={count < 2}
                onClick={props.onOpen}
            >
                Compare {count}
                {count < 2 ? " · pick 1 more" : ""}
            </button>
            {props.message && (
                <p className={styles.message} role="status">
                    {props.message}
                </p>
            )}
        </div>
    );
}
