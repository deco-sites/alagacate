import { useScript } from "@deco/deco/hooks";

/**
 * @titleBy label
 */
interface SearchItem {
  /**
   * @title Search Item Label
   */
  label: string;
  /**
   * @title Search Item Value
   */
  value: string;
}

interface Props {
  /**
   * @title Search Items
   * @description List of items that will be displayed while user types
   */
  items: SearchItem[];
  /**
   * @title Placeholder
   * @description Text displayed in the search input when empty
   */
  placeholder?: string;
}

export default function SearchSection(
  { items, placeholder = "Type to search..." }: Props,
) {
  return (
    <div class="w-full min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div class="w-full max-w-3xl">
        <input
          type="text"
          class="w-full px-6 py-4 text-xl text-gray-100 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder={placeholder}
        />
        <div id="results" class="mt-2" />
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: useScript(
            ({ items, placeholder }: Props) => {
              const input = document.querySelector("input");
              const results = document.getElementById("results");

              if (!input || !results) return;

              input.addEventListener("input", () => {
                const value = input.value.toLowerCase();
                results.textContent = "";

                if (!value) return;

                const filtered = items.filter((item) =>
                  item.label.toLowerCase().includes(value)
                );

                filtered.forEach((item) => {
                  const div = document.createElement("div");
                  div.textContent = item.label;
                  div.className =
                    "px-6 py-3 text-lg text-gray-300 hover:bg-gray-800 cursor-pointer rounded";
                  results.appendChild(div);
                });
              });
            },
            { items, placeholder },
          ),
        }}
      />
    </div>
  );
}

export function Preview(props: Props) {
  props.items = [
    { label: "JavaScript", value: "js" },
    { label: "TypeScript", value: "ts" },
    { label: "Python", value: "py" },
  ];
  props.placeholder = "Search programming languages...";

  return <SearchSection {...props} />;
}
