import { Webhook } from "standardwebhooks";
import { createEmailHandler } from "./handler.mjs";

// Gateway JWT checks are off; each request must pass the hook HMAC check.
Deno.serve(createEmailHandler({ Webhook, env: (key: string) => Deno.env.get(key) }));
