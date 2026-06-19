import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStuartQuote = createServerFn({ method: "POST" })
  .inputValidator((data: { pickupAddress: string; dropoffAddress: string }) => {
    if (!data?.pickupAddress || !data?.dropoffAddress) {
      throw new Error("pickupAddress and dropoffAddress required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { stuartGetPricing } = await import("./stuart.server");
    try {
      const pricing = await stuartGetPricing({
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
      });
      return {
        ok: true as const,
        amountCents: Math.round(pricing.amount * 100),
        currency: pricing.currency,
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

export const createStuartDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => {
    if (!data?.orderId) throw new Error("orderId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { stuartCreateJob } = await import("./stuart.server");
    const { supabase, userId } = context;

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select(
        "id, user_id, hub_id, delivery_mode, delivery_address, stuart_job_id, hubs:hubs(name, address, city, contact_phone), profiles:profiles(full_name, phone)"
      )
      .eq("id", data.orderId)
      .single();
    if (oErr || !order) throw new Error("Order not found");
    if (order.user_id !== userId) {
      const { data: allowed } = await supabase.rpc("order_has_producer_product", {
        _order_id: data.orderId,
        _user_id: userId,
      });
      if (!allowed) throw new Error("Forbidden");
    }
    if (order.delivery_mode !== "stuart")
      throw new Error("Order is not Stuart-delivery");
    if (order.stuart_job_id)
      throw new Error("Stuart job already created for this order");
    if (!order.delivery_address) throw new Error("No delivery address");

    const hub = order.hubs as unknown as {
      name: string;
      address: string;
      city: string;
      contact_phone: string | null;
    } | null;
    const customer = order.profiles as unknown as {
      full_name: string | null;
      phone: string | null;
    } | null;

    if (!hub?.address || !hub.contact_phone)
      throw new Error("Hub missing address or contact_phone");
    if (!customer?.phone) throw new Error("Customer phone missing in profile");

    const [firstName, ...rest] = (customer.full_name ?? "Client").split(" ");
    const job = await stuartCreateJob({
      clientReference: order.id,
      pickup: {
        address: `${hub.address}, ${hub.city}`,
        contactFirstName: "FoodLoop",
        contactLastName: hub.name.slice(0, 30),
        contactPhone: hub.contact_phone,
        comment: `Commande #${order.id.slice(0, 8)}`,
      },
      dropoff: {
        address: order.delivery_address,
        contactFirstName: firstName || "Client",
        contactLastName: rest.join(" ") || "FoodLoop",
        contactPhone: customer.phone,
        packageType: "small",
        packageDescription: "Produits frais locaux",
      },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("orders")
      .update({
        stuart_job_id: String(job.id),
        stuart_status: job.status,
        stuart_tracking_url: job.tracking_url ?? null,
      })
      .eq("id", order.id);

    return {
      ok: true as const,
      jobId: job.id,
      status: job.status,
      trackingUrl: job.tracking_url,
    };
  });
