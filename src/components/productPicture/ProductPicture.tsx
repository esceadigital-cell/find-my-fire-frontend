import Image from "next/image";
import styles from "./ProductPicture.module.scss";
import { Product } from "@/types";
import { toneFor } from "@/lib/display";

interface ProductPictureProps {
    product: Product;
    /** the picture area's size and shape come from the component using it */
    className?: string;
    /**
     * How wide the picture is shown, so Next.js can send a suitably small image.
     * E.g. a card is a third of the screen on desktop, half on tablet, all of it on phones.
     */
    sizes: string;
    children?: React.ReactNode; // e.g. the fuel and "Best match" tags on a card
}

/**
 * A fire's picture: its image from Strapi, shown whole on a light background,
 * or the fire's colour if it has no image yet.
 * Next.js resizes the image to the size it's shown at, and converts it to a modern format.
 */
export default function ProductPicture(props: ProductPictureProps) {
    const image = props.product.image;
    const className = [styles.picture, props.className]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={className}
            style={image ? undefined : { background: toneFor(props.product) }}
        >
            {image && (
                <Image
                    src={image.url}
                    alt={image.alternativeText || props.product.name}
                    fill // fills the picture area (which has position: relative)
                    sizes={props.sizes}
                />
            )}
            {props.children}
        </div>
    );
}
