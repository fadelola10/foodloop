import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "@/components/ProductEditor";

export const Route = createFileRoute("/app/products/new")({
  head: () => ({ meta: [{ title: "FoodLoop — Nouveau produit" }] }),
  component: () => <ProductEditor />,
});
