import styles from "./NextSteps.module.scss";
import { Match } from "@/lib/filterFires";
import { LINKS } from "@/lib/links";

interface NextStepsProps {
    postcode: string | null;
    shortlist: Match[];
    /** on a brand's own page: its website, so "Find a retailer" goes there */
    retailerUrl?: string;
    retailerName?: string;
}

/** Under the fires: find a retailer, or email the shortlist. */
export default function NextSteps(props: NextStepsProps) {
    const body = [
        "My shortlist from the fire finder:",
        "",
        ...props.shortlist.map((m) => {
            const link = m.product.productLinks?.[0]?.url;
            return `- ${m.product.name}${link ? ` (${link})` : ""}`;
        }),
    ].join("\n");
    const mailto = `mailto:?subject=${encodeURIComponent("My fire shortlist")}&body=${encodeURIComponent(body)}`;

    return (
        <div className={styles.nextSteps}>
            <div>
                <h3>
                    See them burning
                    {props.postcode ? ` near ${props.postcode}` : ""}
                </h3>
                <p>Retailers near you with these fires on display.</p>
                <a
                    className={`${styles.btn} ${styles.solid}`}
                    href={props.retailerUrl ?? LINKS.whereToBuy}
                    target="_blank"
                    rel="noreferrer"
                >
                    {props.retailerName
                        ? `Visit ${props.retailerName}`
                        : "Find a retailer"}
                </a>
            </div>
            <div>
                <h3>Save or share your results</h3>
                <p>
                    Email this shortlist to yourself, your builder or your
                    architect.
                </p>
                <a className={styles.btn} href={mailto}>
                    Email my shortlist
                </a>
            </div>
        </div>
    );
}
