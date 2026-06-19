
const STUART_BASE =
  (process.env.STUART_ENV ?? "sandbox").toLowerCase() === "production"
    ? "https://api.stuart.com"
    : "https://api.sandbox.stuart.com";

type TokenCache = { token: string; expiresAt: number };
let cachedToken: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const clientId = process.env.STUART_CLIENT_ID;
  const clientSecret = process.env.STUART_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Stuart credentials not configured");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "api",
  });

  const res = await fetch(`${STUART_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Stuart auth failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

export async function stuartFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${STUART_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export type StuartQuoteInput = {
  pickupAddress: string;
  dropoffAddress: string;
  packageType?: "small" | "medium" | "large" | "xlarge";
};

export async function stuartGetPricing(input: StuartQuoteInput) {
  const payload = {
    job: {
      pickups: [{ address: input.pickupAddress }],
      dropoffs: [
        {
          address: input.dropoffAddress,
          package_type: input.packageType ?? "small",
        },
      ],
    },
  };
  const res = await stuartFetch("/v2/jobs/pricing", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Stuart pricing failed (${res.status}): ${txt}`);
  }
  return res.json() as Promise<{
    amount: number;
    currency: string;
    tax_amount?: number;
  }>;
}

export type StuartJobInput = {
  pickup: {
    address: string;
    contactFirstName: string;
    contactLastName: string;
    contactPhone: string;
    comment?: string;
  };
  dropoff: {
    address: string;
    contactFirstName: string;
    contactLastName: string;
    contactPhone: string;
    comment?: string;
    packageType?: "small" | "medium" | "large" | "xlarge";
    packageDescription?: string;
  };
  clientReference?: string;
};

export async function stuartCreateJob(input: StuartJobInput) {
  const payload = {
    job: {
      assignment_code: input.clientReference,
      pickups: [
        {
          address: input.pickup.address,
          comment: input.pickup.comment,
          contact: {
            firstname: input.pickup.contactFirstName,
            lastname: input.pickup.contactLastName,
            phone: input.pickup.contactPhone,
          },
        },
      ],
      dropoffs: [
        {
          address: input.dropoff.address,
          package_type: input.dropoff.packageType ?? "small",
          package_description: input.dropoff.packageDescription,
          client_reference: input.clientReference,
          comment: input.dropoff.comment,
          contact: {
            firstname: input.dropoff.contactFirstName,
            lastname: input.dropoff.contactLastName,
            phone: input.dropoff.contactPhone,
          },
        },
      ],
    },
  };
  const res = await stuartFetch("/v2/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Stuart createJob failed (${res.status}): ${txt}`);
  }
  return res.json() as Promise<{
    id: number;
    status: string;
    tracking_url?: string;
    pricing?: { price_tax_included: number };
  }>;
}
