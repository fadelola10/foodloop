
CREATE TABLE public.producer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id uuid NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producer_id, user_id, order_id)
);

GRANT SELECT ON public.producer_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.producer_reviews TO authenticated;
GRANT ALL ON public.producer_reviews TO service_role;

ALTER TABLE public.producer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews are public readable"
  ON public.producer_reviews FOR SELECT
  USING (true);

CREATE POLICY "users insert their own reviews"
  ON public.producer_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update their own reviews"
  ON public.producer_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete their own reviews"
  ON public.producer_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_producer_reviews_updated_at
  BEFORE UPDATE ON public.producer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_producer_reviews_producer ON public.producer_reviews(producer_id);
CREATE INDEX idx_producer_reviews_user ON public.producer_reviews(user_id);
