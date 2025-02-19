import { Namespace, Turbopuffer } from "npm:@turbopuffer/turbopuffer";
import { Mistral } from 'npm:@mistralai/mistralai'
import { SDKError } from 'npm:@mistralai/mistralai/models/errors'
import { readdir } from 'node:fs/promises'

function splitInChunks(input: string, chunkSize = 1024) {
    const chunks = [] as string[]

    for (let i = 0; i < input.length; i += chunkSize) {
        chunks.push(input.slice(i, i + chunkSize))
    }

    return chunks
}

const MAX_RETRIES = 20
const MAX_CHARS = 8192

async function embed(inputs: { id: string; content: string }[]) {
    let allChunksOffset = 0
    const allChunks = inputs.flatMap(({ id, content }) =>
        splitInChunks(content, 1024).map(chunk => ({ id, content: chunk })),
    )

    const returnEmbeddings = [] as { id: string; embedding: number[] }[]

    while (true) {
        const inputs = [] as { id: string; content: string }[]

        // Get the next chunk of allChunks that doesn't exceed the MAX_CHARS limit
        for (let i = allChunksOffset; i < allChunks.length; i += 1) {
            if (inputs.reduce((a, b) => a + b.content.length, 0) + allChunks[i].content.length >= MAX_CHARS) break

            inputs.push(allChunks[i])
        }

        let i = 0
        for (; i < MAX_RETRIES; i += 1) {
            try {
                const embeddings = await mistral.embeddings.create({
                    inputs: inputs.map(chunk => chunk.content),
                    model: 'mistral-embed',
                })
                if (!embeddings.data) throw new Error('No "embeddings.data" for some reason')

                const embeddingsChunks = embeddings.data.map((chunk, i) => ({
                    id: inputs[i].id,
                    embedding: chunk.embedding ?? [],
                }))

                returnEmbeddings.push(...embeddingsChunks)
                allChunksOffset += inputs.length

                console.log(`Processed [${allChunksOffset}/${allChunks.length}]`)
                break
            } catch (error) {
                if (error instanceof SDKError) {
                    if (error.rawResponse.status === 429) {
                        console.log(`[${i}/${MAX_RETRIES}] Rate limited, retrying in 2 seconds...`)
                        await new Promise(resolve => setTimeout(resolve, 2000))
                        continue
                    }
                }

                throw error
            }
        }

        if (i === MAX_RETRIES) throw new Error(`Reached max retries for chunk ${allChunksOffset}`)
        if (allChunksOffset >= allChunks.length) return returnEmbeddings
    }
}

const { REPO_NAME, TURBOPUFFER_API_KEY, MISTRAL_API_KEY } = Deno.env.toObject();

if (!REPO_NAME) throw new Error("REPO_NAME is not set");
if (!TURBOPUFFER_API_KEY) throw new Error("TURBOPUFFER_API_KEY is not set");
if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY is not set");

async function namespaceExists(ns: Namespace) {
    try {
        await ns.metadata()
        return true
    } catch {
        return false
    }
}


const turbopuffer = new Turbopuffer({
  apiKey: TURBOPUFFER_API_KEY,
  baseUrl: "https://gcp-us-east4.turbopuffer.com"
});

const mistral = new Mistral({
    apiKey: MISTRAL_API_KEY,
})


const ns = turbopuffer.namespace(`site-1-${REPO_NAME}`);


if (!(await namespaceExists(ns))) {
    const files = await readdir('.')
    console.log(files)
}


