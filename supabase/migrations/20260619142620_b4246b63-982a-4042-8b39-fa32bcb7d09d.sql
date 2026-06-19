
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Helper: notify producers concerned by an order
CREATE OR REPLACE FUNCTION public._notify_producers(
  _order_id uuid,
  _type text,
  _title text,
  _body text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, order_id)
  SELECT DISTINCT pr.user_id, _type, _title, _body,
         '/app/orders-received', _order_id
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  JOIN public.producers pr ON pr.id = p.producer_id
  WHERE oi.order_id = _order_id;
END;
$$;

-- On new order: notify producers
CREATE OR REPLACE FUNCTION public.notify_on_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._notify_producers(
    NEW.id,
    'order.created',
    'Nouvelle commande reçue',
    'Code de retrait : ' || NEW.pickup_code
  );
  RETURN NEW;
END;
$$;

-- On status change: notify the right people
CREATE OR REPLACE FUNCTION public.notify_on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, order_id)
      VALUES (NEW.user_id, 'order.paid', 'Paiement confirmé',
              'Votre commande #' || NEW.pickup_code || ' a bien été payée.',
              '/app/orders/' || NEW.id, NEW.id);
      PERFORM public._notify_producers(NEW.id, 'order.paid',
        'Commande payée',
        'La commande #' || NEW.pickup_code || ' a été réglée.');
    ELSIF NEW.status = 'ready' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, order_id)
      VALUES (NEW.user_id, 'order.ready', 'Votre commande est prête !',
              'Présentez votre QR code au hub pour la récupérer.',
              '/app/orders/' || NEW.id, NEW.id);
    ELSIF NEW.status = 'picked_up' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, order_id)
      VALUES (NEW.user_id, 'order.picked_up', 'Merci pour votre commande',
              'Pensez à noter votre producteur ⭐',
              '/app/orders/' || NEW.id, NEW.id);
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, order_id)
      VALUES (NEW.user_id, 'order.cancelled', 'Commande annulée',
              'La commande #' || NEW.pickup_code || ' a été annulée.',
              '/app/orders/' || NEW.id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_created();

CREATE TRIGGER trg_notify_order_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_status();

REVOKE EXECUTE ON FUNCTION public._notify_producers(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_order_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_order_status() FROM PUBLIC, anon, authenticated;
