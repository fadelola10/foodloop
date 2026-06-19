
CREATE TYPE public.basket_type AS ENUM ('fruits','legumes','mix','autre');

CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id uuid NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  basket_type public.basket_type NOT NULL DEFAULT 'mix',
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subscription_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions
  ADD COLUMN plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
GRANT SELECT ON public.subscription_plan_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plan_items TO authenticated;
GRANT ALL ON public.subscription_plan_items TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active plans are public"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.producers p
    WHERE p.id = producer_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "producers manage own plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.producers p
    WHERE p.id = producer_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.producers p
    WHERE p.id = producer_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "plan items are public"
  ON public.subscription_plan_items FOR SELECT
  USING (true);

CREATE POLICY "producers manage own plan items"
  ON public.subscription_plan_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscription_plans sp
    JOIN public.producers p ON p.id = sp.producer_id
    WHERE sp.id = plan_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subscription_plans sp
    JOIN public.producers p ON p.id = sp.producer_id
    WHERE sp.id = plan_id AND p.user_id = auth.uid()
  ));

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_subscription_plans_producer ON public.subscription_plans(producer_id);
CREATE INDEX idx_subscription_plan_items_plan ON public.subscription_plan_items(plan_id);

-- Update process_due_subscriptions to support plan-based subscriptions
CREATE OR REPLACE FUNCTION public.process_due_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub record;
  new_order_id uuid;
  total integer;
  processed integer := 0;
BEGIN
  FOR sub IN
    SELECT * FROM public.subscriptions
    WHERE status = 'active' AND next_run_at <= now()
  LOOP
    IF sub.plan_id IS NOT NULL THEN
      -- Plan-based subscription: snapshot the plan items
      SELECT COALESCE(SUM(p.price_cents * spi.quantity), 0) INTO total
      FROM public.subscription_plan_items spi
      JOIN public.products p ON p.id = spi.product_id
      WHERE spi.plan_id = sub.plan_id;

      IF total = 0 THEN
        UPDATE public.subscriptions SET next_run_at = next_run_at + interval '7 days' WHERE id = sub.id;
        CONTINUE;
      END IF;

      INSERT INTO public.orders (user_id, hub_id, status, total_cents, notes)
      VALUES (sub.user_id, sub.hub_id, 'pending', total,
              'Panier hebdomadaire (abonnement)')
      RETURNING id INTO new_order_id;

      INSERT INTO public.order_items (order_id, product_id, product_name, unit_price_cents, quantity, producer_id)
      SELECT new_order_id, p.id, p.name, p.price_cents, spi.quantity, p.producer_id
      FROM public.subscription_plan_items spi
      JOIN public.products p ON p.id = spi.product_id
      WHERE spi.plan_id = sub.plan_id;
    ELSE
      -- Free subscription: use subscription_items
      SELECT COALESCE(SUM(p.price_cents * si.quantity), 0) INTO total
      FROM public.subscription_items si
      JOIN public.products p ON p.id = si.product_id
      WHERE si.subscription_id = sub.id;

      IF total = 0 THEN
        UPDATE public.subscriptions SET next_run_at = next_run_at + interval '7 days' WHERE id = sub.id;
        CONTINUE;
      END IF;

      INSERT INTO public.orders (user_id, hub_id, status, total_cents, notes)
      VALUES (sub.user_id, sub.hub_id, 'pending', total,
              'Commande automatique (abonnement hebdomadaire)')
      RETURNING id INTO new_order_id;

      INSERT INTO public.order_items (order_id, product_id, product_name, unit_price_cents, quantity, producer_id)
      SELECT new_order_id, p.id, p.name, p.price_cents, si.quantity, p.producer_id
      FROM public.subscription_items si
      JOIN public.products p ON p.id = si.product_id
      WHERE si.subscription_id = sub.id;
    END IF;

    UPDATE public.subscriptions SET next_run_at = next_run_at + interval '7 days' WHERE id = sub.id;
    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_due_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_subscriptions() TO service_role;
