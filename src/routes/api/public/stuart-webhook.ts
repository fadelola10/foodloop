import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stuart-webhook")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Token",
          },
        }),

      POST: async ({ request }) => {
        const expected = process.env.STUART_WEBHOOK_TOKEN;
        if (expected) {
          const provided = request.headers.get("x-webhook-token");
          if (provided !== expected) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        let payload: {
          event?: string;
          data?: {
            job?: {
              id?: number | string;
              status?: string;
              tracking_url?: string;
              client_reference?: string;
              deliveries?: Array<{ client_reference?: string }>;
            };
          };
        };
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const job = payload?.data?.job;
        const jobId = job?.id != null ? String(job.id) : null;
        const orderId =
          job?.client_reference ?? job?.deliveries?.[0]?.client_reference ?? null;
        const status = job?.status ?? null;

        if (!jobId && !orderId) {
          return Response.json({ ok: true, ignored: true });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const updates: {
          stuart_status?: string;
          stuart_tracking_url?: string;
          stuart_job_id?: string;
          status?: "pending" | "paid" | "ready" | "picked_up" | "cancelled";
        } = {};
        if (status) updates.stuart_status = status;
        if (job?.tracking_url) updates.stuart_tracking_url = job.tracking_url;
        if (jobId) updates.stuart_job_id = jobId;

        if (status === "delivered") updates.status = "picked_up";
        else if (status === "in_progress" || status === "picking")
          updates.status = "ready";
        else if (status === "canceled" || status === "cancelled")
          updates.status = "cancelled";

        const { error } = orderId
          ? await supabaseAdmin.from("orders").update(updates).eq("id", orderId)
          : await supabaseAdmin
              .from("orders")
              .update(updates)
              .eq("stuart_job_id", jobId!);

        if (error) {
          console.error("[stuart-webhook] update error:", error.message);
          return new Response("DB error", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
