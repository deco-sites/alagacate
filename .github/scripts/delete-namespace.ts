import { formatNamespace, setupTurbopuffer } from "../utils.ts";

const { REPO_NAME, TURBOPUFFER_API_KEY } = Deno.env.toObject();

if (!REPO_NAME) throw new Error("REPO_NAME is not set");
if (!TURBOPUFFER_API_KEY) throw new Error("TURBOPUFFER_API_KEY is not set");

const turbopuffer = setupTurbopuffer();

const ns = turbopuffer.namespace(formatNamespace(REPO_NAME));
await ns.deleteAll();

console.log(`"${formatNamespace(REPO_NAME)}" deleted`);
