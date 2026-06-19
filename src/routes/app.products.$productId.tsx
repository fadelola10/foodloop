import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProductEditor } from "@/components/ProductEditor";

export const Route = createFileRoute("/app/products/$productId")({
  head: () => ({ meta: [{ title: "FoodLoop — Édition produit" }] }),
  component: EditProduct,
});

function EditProduct() {
  const { productId } = useParams({ from: "/app/products/$productId" });
  return <ProductEditor productId={productId} />;
}
