import { supabase } from "@/integrations/supabase/client";

export async function ensureCart(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function addToCart(userId: string, productId: string, quantity = 1) {
  const cartId = await ensureCart(userId);
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("product_id", productId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: existing.quantity + quantity })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("cart_items")
      .insert({ cart_id: cartId, product_id: productId, quantity });
    if (error) throw error;
  }
}

export async function getCartItems(userId: string) {
  const cartId = await ensureCart(userId);
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      "id, quantity, products(id, name, price_cents, unit, image_url, stock, producer_id)",
    )
    .eq("cart_id", cartId);
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    quantity: number;
    products: {
      id: string;
      name: string;
      price_cents: number;
      unit: string;
      image_url: string | null;
      stock: number;
      producer_id: string;
    };
  }>;
}

export async function updateCartItem(itemId: string, quantity: number) {
  if (quantity <= 0) {
    await supabase.from("cart_items").delete().eq("id", itemId);
  } else {
    await supabase.from("cart_items").update({ quantity }).eq("id", itemId);
  }
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  preparing: "En préparation",
  ready: "Prête à retirer",
  picked_up: "Retirée",
  cancelled: "Annulée",
};
