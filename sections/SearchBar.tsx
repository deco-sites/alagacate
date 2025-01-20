import { useScript } from "@deco/deco/hooks";
import { clx } from "../sdk/clx.ts";

interface SearchItem {
  /**
   * @title {{{text}}}
   */
  text: string;
}

interface Props {
  /**
   * @description List of items that will be shown while user types
   * @minItems 1
   */
  items: SearchItem[];
  /**
   * @description Placeholder text for the search input
   */
  placeholder?: string;
}

export default function SearchBar({ items, placeholder = "Search..." }: Props) {
  return (
    <div class="w-full min-h-[300px] bg-[#121212] flex items-center justify-center px-4">
      <div class="w-full max-w-2xl relative">
        <input
          type="text"
          placeholder={placeholder}
          class="w-full px-4 py-3 bg-[#1e1e1e] text-white rounded-lg border border-[#2d2d2d] focus:outline-none focus:border-[#e8590c]"
        />
        <div
          id="results"
          class="absolute w-full mt-2 bg-[#1e1e1e] rounded-lg hidden"
        >
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: useScript(
              ({ items }: { items: SearchItem[] }) => {
                const input = document.querySelector("input");
                const results = document.querySelector("#results");

                if (!input || !results) return;

                input.addEventListener("input", (e) => {
                  const value = (e.target as HTMLInputElement).value
                    .toLowerCase();

                  if (!value) {
                    results.classList.add("hidden");
                    results.textContent = "";
                    return;
                  }

                  const filtered = items.filter((item) =>
                    item.text.toLowerCase().includes(value)
                  );

                  results.textContent = "";

                  if (filtered.length) {
                    results.classList.remove("hidden");
                    filtered.forEach((item) => {
                      const div = document.createElement("div");
                      div.className =
                        "px-4 py-2 hover:bg-[#2d2d2d] cursor-pointer";
                      div.textContent = item.text;
                      results.appendChild(div);
                    });
                  } else {
                    results.classList.add("hidden");
                  }
                });
              },
              { items },
            ),
          }}
        />
      </div>
    </div>
  );
}

export function Preview(props: Props) {
  props.items = [
    { text: "JavaScript Development" },
    { text: "TypeScript Basics" },
    { text: "React Framework" },
    { text: "Web Development" },
  ];
  props.placeholder = "Type to search...";

  return <SearchBar {...props} />;
}
