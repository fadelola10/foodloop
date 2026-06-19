import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  existingCart: null as { id: string } | null,
  existingItem: null as { id: string; quantity: number } | null,
  lastUpdate: null as unknown,
  lastInsert: null as unknown,
  lastDelete: null as string | null,
};

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.existingItem, error: null }),
        }),
        maybeSingle: async () => ({ data: state.existingCart, error: null }),
      }),
    }),
    insert: (payload: unknown) => {
      state.lastInsert = { table, payload };
      return {
        select: () => ({
          single: async () => ({ data: { id: "new-cart-id" }, error: null }),
          maybeSingle: async () => ({ data: { id: "new-cart-id" }, error: null }),
        }),
      };
    },
    update: (payload: unknown) => {
      state.lastUpdate = { table, payload };
      return { eq: async () => ({ error: null }) };
    },
    delete: () => ({
      eq: async (_col: string, val: string) => {
        state.lastDelete = val;
        return { error: null };
      },
    }),
  });
  return { supabase: { from: builder } };
});

import { addToCart, updateCartItem, ORDER_STATUS_LABELS } from "./cart";

beforeEach(() => {
  state.existingCart = { id: "cart-1" };
  state.existingItem = null;
  state.lastUpdate = null;
  state.lastInsert = null;
  state.lastDelete = null;
});

describe("addToCart", () => {
  it("insère une nouvelle ligne quand le produit n'est pas dans le panier", async () => {
    await addToCart("user-1", "prod-1", 2);
    expect(state.lastInsert).toEqual({
      table: "cart_items",
      payload: { cart_id: "cart-1", product_id: "prod-1", quantity: 2 },
    });
  });

  it("incrémente la quantité si le produit existe déjà", async () => {
    state.existingItem = { id: "item-1", quantity: 3 };
    await addToCart("user-1", "prod-1", 2);
    expect(state.lastUpdate).toEqual({
      table: "cart_items",
      payload: { quantity: 5 },
    });
  });
});

describe("updateCartItem", () => {
  it("supprime la ligne si quantité <= 0", async () => {
    await updateCartItem("item-1", 0);
    expect(state.lastDelete).toBe("item-1");
  });

  it("met à jour la quantité si > 0", async () => {
    await updateCartItem("item-1", 4);
    expect(state.lastUpdate).toEqual({
      table: "cart_items",
      payload: { quantity: 4 },
    });
  });
});

describe("ORDER_STATUS_LABELS", () => {
  it("contient tous les statuts attendus", () => {
    ["pending", "paid", "preparing", "ready", "picked_up", "cancelled"].forEach((s) => {
      expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
    });
  });
});
