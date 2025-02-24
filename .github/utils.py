from functools import partial
from itertools import batched
from os import getenv
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
from rich import print
from tokenizers import Tokenizer
from ujson import loads


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
exclude_dirs = {
    "node_modules",
    "public",
    "static",
    ".github",
}

REPO_NAME = getenv("REPO_NAME")
ALL_CHANGED_FILES = getenv("ALL_CHANGED_FILES")
MISTRAL_API_KEY = getenv("MISTRAL_API_KEY")
TURBOPUFFER_API_KEY = getenv("TURBOPUFFER_API_KEY")

if not REPO_NAME:
    raise ValueError("REPO_NAME is not set")

if not ALL_CHANGED_FILES:
    raise ValueError("ALL_CHANGED_FILES is not set")

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


def format_namespace(name: str):
    return f'site-{name}'


def embed_files():
    ns = tp.Namespace(format_namespace(REPO_NAME))
    files = []

    if ns.exists():
        print(f"Namespace {REPO_NAME} already exists")

        files = [Path(f) for f in ALL_CHANGED_FILES.split(",")]
    else:
        for root, dirs, files in Path().walk("*"):
            for dir in dirs:
                if dir in exclude_dirs:
                    dirs.remove(dir)

        for file in files:
            files.append(Path(root) / file)

    files = [f for f in files if f.suffix in extensions]

    if not files:
        print("No files to embed")
        return

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
                    chks = splitter(loads(file.read_text(encoding="utf-8")))
                else:
                    chks = splitter(file.read_text(encoding="utf-8"))
            except Exception:
                print_exc()
                print(f"Error splitting file {file.as_posix()}")
                raise

            chunks.extend(chks)
            chunks_by_file[file.as_posix()] = chks
            n += 1

        print(f"{n}/{len(files)}", len(chunks))

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

    print(f"Upserting {len(files_embeddings)} vectors")

    ns.upsert(
        files_embeddings,
        distance_metric="cosine_distance",
        schema={
            'path': {
                'type': 'string',
                'filterable': False,
            },
            'content': {
                'type': 'string',
                'filterable': False,
            },
        },
    )
