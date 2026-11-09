import FireFinder from "@/components/fireFinder/FireFinder";
import styles from "./page.module.scss";
import { getProducts, getQuestionCategories } from "@/lib/api";

export default async function Home() {
  const allProducts = await getProducts();
  const questionCategories = await getQuestionCategories();

  return (
    <div className={styles.page}>
      <FireFinder
        products={allProducts}
        questionCategories={questionCategories}
      />
    </div>
  );
}
