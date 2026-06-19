
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision,
  ADD COLUMN IF NOT EXISTS delivery_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stuart_job_id text,
  ADD COLUMN IF NOT EXISTS stuart_status text,
  ADD COLUMN IF NOT EXISTS stuart_tracking_url text;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_mode_check
  CHECK (delivery_mode IN ('pickup', 'stuart'));

ALTER TABLE public.hubs
  ADD COLUMN IF NOT EXISTS contact_phone text;
