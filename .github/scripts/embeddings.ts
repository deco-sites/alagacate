import { basename } from "jsr:@std/path";
import { readFile } from "node:fs/promises";
import { SDKError } from "npm:@mistralai/mistralai/models/errors/index.js";
import { Vector } from "npm:@turbopuffer/turbopuffer";
import { glob } from "npm:tinyglobby";
import { formatNamespace, setupMistral, setupTurbopuffer } from "../utils.ts";

function splitInChunks(input: string, chunkSize = 1024) {
  const chunks = [] as string[];

  for (let i = 0; i < input.length; i += chunkSize) {
    chunks.push(input.slice(i, i + chunkSize));
  }

  return chunks;
}

async function embed(inputs: { id: string; content: string }[]) {
  let allChunksOffset = 0;
  const allChunks = inputs.flatMap(({ id, content }) =>
    splitInChunks(content, 1024).map((chunk) => ({ id, content: chunk }))
  );

  const returnEmbeddings = [] as { id: string; embedding: number[] }[];

  while (true) {
    const inputs = [] as { id: string; content: string }[];

    // Get the next chunk of allChunks that doesn't exceed the MAX_CHARS limit
    for (let i = allChunksOffset; i < allChunks.length; i += 1) {
      if (
        inputs.reduce((a, b) => a + b.content.length, 0) +
            allChunks[i].content.length >= MAX_CHARS
      ) break;

      inputs.push(allChunks[i]);
    }

    let i = 0;
    for (; i < MAX_RETRIES; i += 1) {
      try {
        const embeddings = await mistral.embeddings.create({
          inputs: inputs.map((chunk) => chunk.content),
          model: "mistral-embed",
        });
        if (!embeddings.data) {
          throw new Error('No "embeddings.data" for some reason');
        }

        const embeddingsChunks = embeddings.data.map((chunk, i) => ({
          id: inputs[i].id,
          embedding: chunk.embedding ?? [],
        }));

        returnEmbeddings.push(...embeddingsChunks);
        allChunksOffset += inputs.length;

        console.log(
          `Processed chunks [${allChunksOffset}/${allChunks.length}]`,
        );
        break;
      } catch (error) {
        if (error instanceof SDKError) {
          if (error.rawResponse.status === 429) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
        }

        throw error;
      }
    }

    if (i === MAX_RETRIES) {
      throw new Error(`Reached max retries for chunk ${allChunksOffset}`);
    }
    if (allChunksOffset >= allChunks.length) return returnEmbeddings;
  }
}

async function namespaceExists() {
  const { namespaces } = await turbopuffer.namespaces({});
  return namespaces.some((n) => n.id === formatNamespace(REPO_NAME));
}

// ------------------------------------------------------------

const { REPO_NAME, ALL_CHANGED_FILES } = Deno.env.toObject();

if (!REPO_NAME) throw new Error("REPO_NAME is not set");

const MAX_RETRIES = 20;
const MAX_CHARS = 8192;

const mistral = setupMistral();
const turbopuffer = setupTurbopuffer();

const ns = turbopuffer.namespace(formatNamespace(REPO_NAME));

let files = [] as string[];
const ignore = [
  "static/tailwind.css",
  "manifest.gen.ts",
  "static/adminIcons.ts",
  "sections/Theme/Theme.tsx",
  ".github",
];

if (await namespaceExists()) {
  console.log(`Namespace "${REPO_NAME}" already exists`);

  files = ALL_CHANGED_FILES.split(",").filter((file) =>
    /\.(ts|tsx|js|jsx|css)$/.test(file) &&
    !ignore.some((e) => file.startsWith(e))
  );
} else {
  console.log(`Namespace "${REPO_NAME}" does not exist`);

  files = await glob("./**/*.{ts,tsx,js,jsx,css}", { ignore });
}

if (files.length === 0) {
  console.log("No files to embed, skipping...");
  Deno.exit(0);
}

const contents = await Promise.all(
  files.map(async (file) => ({
    id: file,
    content: await readFile(file, "utf-8"),
  })),
);

const embeddings = await embed(contents);
const vectorIds = new Set<string>();
const vectors = [] as Vector[];

for (const { id, embedding } of embeddings) {
  let n = 0;
  const content = await readFile(id, "utf-8");

  while (vectorIds.has(`${id}-${n}`)) n += 1;

  vectorIds.add(id);

  vectors.push({
    id: n === 0 ? id : `${id}-${n}`,
    vector: embedding,
    attributes: {
      content: n === 0 ? content : "",
      contentRef: n === 0 ? "" : id,
    },
  });
}

for (const { id } of vectors) {
  console.log(id);
}

await ns.upsert({
  vectors,
  distance_metric: "cosine_distance",
  schema: {
    filename: {
      type: "string",
      filterable: false,
    },
    content: {
      type: "string",
      filterable: false,
    },
  },
});
