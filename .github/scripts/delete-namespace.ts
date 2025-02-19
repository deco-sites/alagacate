import { Turbopuffer } from "npm:@turbopuffer/turbopuffer";

const { REPO_NAME, TURBOPUFFER_API_KEY } = Deno.env.toObject();

if (!REPO_NAME) throw new Error("REPO_NAME is not set");
if (!TURBOPUFFER_API_KEY) throw new Error("TURBOPUFFER_API_KEY is not set");

const turbopuffer = new Turbopuffer({
  apiKey: TURBOPUFFER_API_KEY,
  baseUrl: "https://gcp-us-east4.turbopuffer.com",
});

const ns = turbopuffer.namespace(`site-${REPO_NAME}`);
await ns.deleteAll();

console.log(`"site-${REPO_NAME}" deleted`);
