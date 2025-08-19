/// <reference no-default-lib="true"/>
/// <reference lib="dom" />
/// <reference lib="deno.ns" />
/// <reference lib="esnext" />

// a

import { start } from "$fresh/server.ts";
import config from "./fresh.config.ts";
import manifest from "./fresh.gen.ts";

await start(manifest, config);
