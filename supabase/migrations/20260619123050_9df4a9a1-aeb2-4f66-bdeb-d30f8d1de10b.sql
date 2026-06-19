CREATE OR REPLACE FUNCTION public.order_has_producer_product(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN producers pr ON pr.id = p.producer_id
    WHERE oi.order_id = _order_id AND pr.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "orders producer read" ON public.orders;
DROP POLICY IF EXISTS "orders producer update" ON public.orders;

CREATE POLICY "orders producer read"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.order_has_producer_product(id, auth.uid()));

CREATE POLICY "orders producer update"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.order_has_producer_product(id, auth.uid()));
