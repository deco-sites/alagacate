from functools import partial
from itertools import batched
from os import getenv, scandir
from pathlib import Path
from traceback import print_exc

import turbopuffer as tp
from cuid2 import Cuid
from langchain_mistralai import MistralAIEmbeddings
from langchain_text_splitters import (
    Language,
    RecursiveCharacterTextSplitter,
    RecursiveJsonSplitter,
    TextSplitter,
)
from tokenizers import Tokenizer
from ujson import loads, JSONDecodeError


class TSXCodeTextSplitter(RecursiveCharacterTextSplitter):
    def __init__(self, **kwargs):
        html_separators = self.get_separators_for_language(Language.HTML)
        ts_separators = self.get_separators_for_language(Language.TS)

        super().__init__(separators=html_separators + ts_separators, **kwargs)


ts_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=RecursiveCharacterTextSplitter.get_separators_for_language(Language.TS),
)
tsx_splitter = TSXCodeTextSplitter(chunk_size=1000, chunk_overlap=200)
json_splitter = RecursiveJsonSplitter()
generic_text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
cuid = Cuid()

splitter_by_extension: dict[str, TextSplitter] = {
    ".tsx": tsx_splitter.split_text,
    ".ts": ts_splitter.split_text,
    ".json": partial(json_splitter.split_text, convert_lists=True),
    ".css": generic_text_splitter.split_text,
}

extensions = list(splitter_by_extension.keys())
exclude_dirs = {"node_modules", "public", "static", ".github", ".devcontainer"}
exclude_files = {"manifest.gen.ts", "sections/Theme/Theme.tsx", "fresh.gen.ts"}

REPO_NAME = getenv("REPO_NAME")
ALL_CHANGED_FILES = getenv("ALL_CHANGED_FILES")
MISTRAL_API_KEY = getenv("MISTRAL_API_KEY")
TURBOPUFFER_API_KEY = getenv("TURBOPUFFER_API_KEY")

if not REPO_NAME:
    raise ValueError("REPO_NAME is not set")

if not MISTRAL_API_KEY:
    raise ValueError("MISTRAL_API_KEY is not set")

if not TURBOPUFFER_API_KEY:
    raise ValueError("TURBOPUFFER_API_KEY is not set")

embeddings = MistralAIEmbeddings(
    tokenizer=Tokenizer.from_pretrained("model-hub/Mixtral-8x7B-v0.1"),
    max_retries=10,
    wait_time=5,
)

tp.api_key = getenv("TURBOPUFFER_API_KEY")
tp.api_base_url = "https://gcp-us-east4.turbopuffer.com"


def embed_files(files: list[Path]):
    n = 0
    files_embeddings = []

    for files in batched(files, 20):
        chunks = []
        chunks_by_file = {}
        current_chunk_index = 0

        for file in files:
            splitter = splitter_by_extension[file.suffix]

            try:
                if file.suffix == ".json":
                    try:
                        chks = splitter(loads(file.read_text(encoding="utf-8")))
                    except JSONDecodeError:
                        print(f"Error decoding json file {file.as_posix()}")
                        continue
                else:
                    chks = splitter(file.read_text(encoding="utf-8"))
            except Exception:
                print_exc()
                print(f"Error splitting file {file.as_posix()}")
                raise

            chunks.extend(chks)
            chunks_by_file[file.as_posix()] = chks
            n += 1

        print(f"{n}/{len(all_files)}", len(chunks))

        vectors = embeddings.embed_documents(chunks)

        for file in files:
            file_chunks = chunks_by_file.get(file.as_posix(), None)

            if not file_chunks:
                continue

            for chunk in file_chunks:
                files_embeddings.append(
                    {
                        "id": cuid.generate(10),
                        "vector": vectors[current_chunk_index],
                        "attributes": {
                            "path": file.as_posix(),
                            "content": chunk,
                        },
                    }
                )
                current_chunk_index += 1

    return files_embeddings


ns_code = tp.Namespace(f'site-{REPO_NAME}-code')
ns_blocks = tp.Namespace(f'site-{REPO_NAME}-blocks')

all_files = []
code_files = []
blocks_files = []

if ns_code.exists() and ns_blocks.exists():
    print(f"Namespace {REPO_NAME} already exists")

    all_files = [
        i
        for i in (Path(f) for f in ALL_CHANGED_FILES.split(","))
        if i.is_file() and i.suffix in extensions
    ]

    print('Changed files', len(all_files))
    for i in all_files:
        print(i)
else:
    print(f'Namespace {REPO_NAME} does not exist')

    dirs = ['.']
    while True:
        if not dirs:
            break

        with scandir(dirs.pop()) as it:
            for i in it:
                p = Path(i)

                if p.is_dir() and not p.name in exclude_dirs:
                    dirs.append(p)

                if p.is_file() and p.suffix in extensions:
                    all_files.append(p)

if not all_files:
    print("No files to embed")
    exit(0)

all_files = [i for i in all_files if not any(i.match(f) for f in exclude_files)]

for i in all_files:
    is_in_deco_folder = i.parts[0] == '.deco'

    if is_in_deco_folder:
        blocks_files.append(i)
    else:
        code_files.append(i)


print('Embedding files')
code_embeddings = embed_files(code_files)
blocks_embeddings = embed_files(blocks_files)

print(f"Upserting {len(code_embeddings) + len(blocks_embeddings)} vectors")

args = {
    'distance_metric': 'cosine_distance',
    'schema': {
        'path': {
            'type': 'string',
            'filterable': False,
        },
        'content': {
            'type': 'string',
            'filterable': False,
        },
    },
}

ns_code.upsert(code_embeddings, **args)
ns_blocks.upsert(blocks_embeddings, **args)
