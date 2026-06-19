
-- Public read for catalogue
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.labels TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.product_labels TO anon, authenticated;
GRANT SELECT ON public.producers TO anon, authenticated;
GRANT SELECT ON public.hubs TO anon, authenticated;
GRANT SELECT ON public.hub_slots TO anon, authenticated;

-- Producers manage their own products
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_labels TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.producers TO authenticated;

-- User-owned data
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- service_role full access
GRANT ALL ON public.categories, public.labels, public.products, public.product_labels,
             public.producers, public.hubs, public.hub_slots,
             public.carts, public.cart_items, public.orders, public.order_items,
             public.profiles, public.user_roles
  TO service_role;
