export type ProductUnit = "piece" | "kg" | "g" | "litre" | "botte" | "douzaine";

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface Label {
  id: string;
  slug: string;
  name: string;
  color: string | null;
}

export interface Producer {
  id: string;
  user_id: string;
  farm_name: string;
  description: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_active: boolean;
}

export interface Hub {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  description: string | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  producer_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  unit: ProductUnit;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export const UNIT_LABELS: Record<ProductUnit, string> = {
  piece: "pièce",
  kg: "kg",
  g: "g",
  litre: "L",
  botte: "botte",
  douzaine: "douzaine",
};

export function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}
