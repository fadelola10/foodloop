
CREATE TYPE public.subscription_status AS ENUM ('active','paused','cancelled');

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  producer_id uuid NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  status public.subscription_status NOT NULL DEFAULT 'active',
  day_of_week smallint NOT NULL DEFAULT 3 CHECK (day_of_week BETWEEN 0 AND 6),
  next_run_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_items TO authenticated;
GRANT ALL ON public.subscription_items TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "producers read their subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.producers p
    WHERE p.id = producer_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "users manage own subscription items"
  ON public.subscription_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.id = subscription_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.id = subscription_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "producers read their subscription items"
  ON public.subscription_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.producers p ON p.id = s.producer_id
    WHERE s.id = subscription_id AND p.user_id = auth.uid()
  ));

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_producer ON public.subscriptions(producer_id);
CREATE INDEX idx_subscriptions_next_run ON public.subscriptions(next_run_at) WHERE status = 'active';

-- Function: generate orders from due subscriptions
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
    -- Compute total from current product prices
    SELECT COALESCE(SUM(p.price_cents * si.quantity), 0) INTO total
    FROM public.subscription_items si
    JOIN public.products p ON p.id = si.product_id
    WHERE si.subscription_id = sub.id;

    IF total = 0 THEN
      UPDATE public.subscriptions
      SET next_run_at = next_run_at + interval '7 days'
      WHERE id = sub.id;
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

    UPDATE public.subscriptions
    SET next_run_at = next_run_at + interval '7 days'
    WHERE id = sub.id;

    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_due_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_subscriptions() TO service_role;
