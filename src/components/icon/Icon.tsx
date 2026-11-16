// The line icons from the mockup.

const PATHS = {
    arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
    arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    external: <path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" />,
};

interface IconProps {
    name: keyof typeof PATHS;
    size?: number;
    strokeWidth?: number;
}

export default function Icon(props: IconProps) {
    const size = props.size ?? 18;
    return (
        <svg
            aria-hidden="true"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={props.strokeWidth ?? 1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {PATHS[props.name]}
        </svg>
    );
}

/** The dashed orange square with "!" used for local rules. */
export function RuleIcon(props: { size: number }) {
    return (
        <svg
            aria-hidden="true"
            width={props.size}
            height={props.size}
            viewBox="0 0 40 40"
        >
            <rect
                x="1"
                y="1"
                width="38"
                height="38"
                rx="4"
                fill="none"
                stroke="#F0541E"
                strokeWidth="3"
                strokeDasharray="5 4"
            />
            <path
                d="M20 11v11M20 27v2"
                stroke="#141414"
                strokeWidth="3.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
