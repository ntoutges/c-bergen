type ListItem = Record<string, any>;

type BaseListColumn = {
    /**
     * The attributes ascribed to this level
     */
    attrs: string[];
};

type RecursiveListColumn = {
    /**
     * The list of sub-entries (in order)
     */
    children: ListColumn[];
} & BaseListColumn;

type TerminalListColumn = BaseListColumn & Partial<TerminalListAppend>;

type TerminalListAppendConst = {
    /**
     * Add some constant value
     */
    text: string;
    append?: TerminalListAppend;
};
type TerminalListAppendValue = {
    /**
     * Add some other value retreived from the document
     */
    key: string;
    append?: TerminalListAppend;
};
type TerminalListAppend = TerminalListAppendConst | TerminalListAppendValue;

type ListColumn = RecursiveListColumn | TerminalListColumn;

type TopListColumn = {
    /**
     * The text to put into the header
     */
    title: string;

    /**
     * How much width to give this column.\
     * If not given, width defaults to 'auto'
     */
    width?: string;

    /**
     * How this column is setup
     */
    setup: ListColumn;
};

/**
 * All available parts that may come out of a TopListColumn
 */
type ListColumnComponents = TopListColumn | ListColumn | TerminalListAppend;

/**
 * Some constant value ready to be added directly to the HTML
 */
type ListCompiledConstant = {
    type: "const";
    value: string;
};

/**
 * Some variable which requires some field in teh document to build
 */
type ListCompiledValue = {
    type: "value";
    value: string[];
};

type ListCompiled = ListCompiledConstant | ListCompiledValue;

/**
 * A list instance that represents the HTML list
 */
export class List {
    /**
     * The list items to render
     */
    private readonly items: ListItem[] = [];

    /**
     * The addons used to modify how the list appears
     */
    private readonly addons = new Map<string, ListAddon>();

    private readonly element: HTMLElement;
    private readonly path: string;
    private readonly search: URLSearchParams;

    private readonly columns: {
        setup: ListCompiled[];
        width: string;
        title: string;
    }[];

    constructor(
        element: HTMLElement,
        columns: TopListColumn[],
        path: string = ""
    ) {
        this.element = element;

        const searchIndex = path.indexOf("?");
        this.path = searchIndex == -1 ? path : path.substring(0, searchIndex);
        this.search = new URLSearchParams(
            searchIndex == -1 ? "" : path.substring(searchIndex)
        );

        this.columns = columns.map((column) => ({
            setup: this._compile(column),
            width: column.width ?? "auto",
            title: column.title,
        }));

        // Setup DOM grid columns
        this.element.style.gridTemplateColumns = this.columns
            .map((column) => column.width)
            .join(" ");
    }

    /**
     * Convert a column into raw text and required document fields
     * @param column    The column object to compile
     */
    private _compile(column: TopListColumn) {
        const compiled: ListCompiled[] = []; // Compiled items to add in-order
        const compilend: ListCompiled[] = []; // Compiled items to add to the end of 'compiled' once some block is finished

        const queue: ({ block: true } | ListColumnComponents)[] = [column];
        while (queue.length) {
            const candidate = queue.pop()!;

            // One 'block' proerty, indicating that the current block is finished
            if (
                Object.keys(candidate).length == 1 &&
                candidate.hasOwnProperty("block")
            ) {
                if (compilend.length > 0) compiled.push(compilend.pop()!);
                continue;
            }

            const type = this._getType(candidate as ListColumnComponents);

            const pushAttrs = (attrs: string[]) => {
                const attributes = attrs
                    .map((attr) => `list-${attr}`)
                    .join(" ");
                if (attributes.length == 0) return;

                compiled.push({
                    type: "const",
                    value: `<div class="${attributes}">`,
                });
                compilend.push({ type: "const", value: "</div>" });
            };

            switch (type) {
                case "top":
                    compiled.push({
                        type: "const",
                        value: `<div class="list-column">`,
                    });
                    compilend.push({ type: "const", value: `</div>` });
                    queue.push(
                        { block: true },
                        (<TopListColumn>candidate).setup
                    );
                    break;

                case "recursive": {
                    const column = candidate as RecursiveListColumn;
                    pushAttrs(column.attrs);
                    queue.push(
                        { block: true },
                        ...column.children.toReversed()
                    );
                    break;
                }

                case "tvalue": {
                    const column = candidate as BaseListColumn &
                        TerminalListAppendValue;
                    pushAttrs(column.attrs);
                    compiled.push({
                        type: "value",
                        value: column.key.split("."),
                    });

                    queue.push({ block: true });
                    if (column.append) queue.push(column.append);
                    break;
                }

                case "ttext": {
                    const column = candidate as BaseListColumn &
                        TerminalListAppendConst;
                    pushAttrs(column.attrs);
                    compiled.push({ type: "const", value: column.text });

                    queue.push({ block: true });
                    if (column.append) queue.push(column.append);
                    break;
                }

                case "empty": {
                    const column = candidate as BaseListColumn;
                    pushAttrs(column.attrs);
                    queue.push({ block: true });
                    break;
                }

                case "value": {
                    const column = candidate as TerminalListAppendValue;
                    compiled.push({
                        type: "value",
                        value: column.key.split("."),
                    });

                    queue.push({ block: true });
                    if (column.append) queue.push(column.append);
                    break;
                }

                case "text": {
                    const column = candidate as TerminalListAppendConst;
                    compiled.push({ type: "const", value: column.text });

                    queue.push({ block: true });
                    if (column.append) queue.push(column.append);
                    break;
                }

                default:
                    console.warn(`Unable to compile list type: "${type}"`);
            }
        }

        if (compilend.length > 0)
            console.warn(
                "Improper Compilation; Detected non-emppty compilend list:",
                compilend
            );
        compiled.push(...compilend.toReversed());

        // Merge adjacent 'const' elements
        for (let i = 1; i < compiled.length; i++) {
            const prev = compiled[i - 1];
            const curr = compiled[i];

            // Merge!
            if (prev.type == "const" && curr.type == "const") {
                prev.value += curr.value;
                compiled.splice(i, 1);
                i--;
            }
        }

        return compiled;
    }

    private _buildHeader() {
        const headerComponents: string[] = [];

        for (const column of this.columns) {
            const title = column.title
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;"); // Escape title
            headerComponents.push(`<div class="list-column">${title}</div>`);
        }

        return (
            '<div class="list-header">' + headerComponents.join("") + "</div>"
        );
    }

    /**
     * Attempt to build a list item using the provided document.
     * @param data  The document to base the list item off of.
     */
    private _buildItem(item: ListItem) {
        const itemComponents: string[] = [];

        for (const column of this.columns) {
            for (const setup of column.setup) {
                if (setup.type == "const") {
                    itemComponents.push(setup.value);
                    continue;
                }

                itemComponents.push(
                    (List.getValue(item, setup.value) ?? "/").toString()
                );
            }
        }

        const build = itemComponents.join("");
        if (this.path) {
            const docId = (item.__name__ || "").toString();
            this.search.set("id", docId);
            return `<a href="${
                this.path
            }?${this.search.toString()}" class="list-entry">${build}</a>`;
        }
        return `<div class="list-entry">${build}</div>`;
    }

    /**
     * Determine the type of column.
     * @param column    The column object to acertain the type.
     * @returns         A string representing the column type
     */
    private _getType(column: ListColumnComponents) {
        if (column.hasOwnProperty("setup")) return "top"; // TopListColumn
        if (column.hasOwnProperty("children")) return "recursive"; // RecursiveListColumn
        if (column.hasOwnProperty("attrs")) {
            if (column.hasOwnProperty("key")) return "tvalue"; // TerminalListColumn (w/ value)
            if (column.hasOwnProperty("text")) return "ttext"; // TerminalListColumn (w/ text)
            return "empty"; // TerminalListColumn
        }

        if (column.hasOwnProperty("key")) return "value"; // TerminalListAppend (w/ value)
        if (column.hasOwnProperty("text")) return "text"; // TerminalListAppend (w/ text)

        return "unknown"; // ???
    }

    /**
     * Clear the list
     */
    reset() {
        this.items.splice(0);
    }

    /**
     * Update the list with more items, added to the end.
     * @param items The items to add
     */
    add(items: ListItem[]) {
        this.items.push(...items);
    }

    /**
     * Update the list in the HTML DOM
     */
    render() {
        this.element.innerHTML = ""; // Clear element

        const listContents = [this._buildHeader()];

        for (const item of this.items) {
            listContents.push(this._buildItem(item));
        }

        this.element.innerHTML = listContents.join("\n");

        // Set rows and columns
        const rows = this.element.querySelectorAll<HTMLElement>(".list-entry");
        for (let row = 0; row < rows.length; row++) {
            const rowEl = rows[row];
            const columns = rowEl.children;
            for (let col = 0; col < columns.length; col++) {
                const colEl = columns[col] as HTMLElement;
                colEl.style.gridRow = (2 * row + 2).toString(); // Leave space for dividers
                colEl.style.gridColumn = (col + 1).toString();
            }

            // Run any available addons
            for (let addon of this.addons.values()) {
                addon._render(rowEl, this.items[row]);
            }
        }
    }

    /**
     * Register an addon within the list
     * @param label A string value used to identify this addon.
     * @param addon The addon instance to add.
     */
    registerAddon(label: string, addon: ListAddon) {
        if (this.addons.has(label)) this.addons.get(label)!.destroy();
        this.addons.set(label, addon);
    }

    /**
     * Remove an addon from the list.
     * @param label The addon instance to remove
     */
    removeAddon(label: string) {
        if (!this.addons.has(label)) return; // No addon to remove
        this.addons.get(label)!.destroy();
        this.addons.delete(label);
    }

    /**
     * Release all used resources.
     */
    destroy() {
        for (const addon of this.addons.values()) {
            addon.destroy();
        }
        this.addons.clear();
    }

    static getValue(obj: ListItem, key: string[]) {
        let temp = obj;
        for (const k of key) {
            // Unable to get value
            if (!temp || typeof temp != "object") return null;

            // Traverse to the next element
            temp = temp[k];
        }

        return temp ?? null;
    }

    static isAtBottom(element: HTMLElement) {
        return element.scrollTop + element.clientHeight >= element.scrollHeight;
    }
}

export abstract class ListAddon {
    /** The item that the current row being rendered represents */
    private item: ListItem = {};

    /**
     * For internal use only.\
     * Called to render the addon, setting up all necessary information
     */
    _render(row: HTMLElement, item: ListItem): void {
        this.item = JSON.parse(JSON.stringify(item));
        let element = this.render(row);

        if (element == null) return; // No value returned, so nothing to do

        // Convert HTML string to object
        if (typeof element == "string") {
            const parser = new DOMParser();
            const el = parser
                .parseFromString(element, "text/html")
                .querySelector("body > *");

            if (!(el instanceof HTMLElement)) return;
            element = el;
        }

        // Check that row is valid
        const firstColumn = row.children[0];
        if (!(firstColumn instanceof HTMLElement)) return;

        // Get grid column/row info
        const gridArea = firstColumn.style.gridArea ?? "";
        const gridRow = gridArea.split("/", 1)[0].trim();
        const gridColumn = `1 / ${row.children.length + 1}`;

        if (!gridRow || isNaN(+gridRow)) return; // Invalid row

        element.style.gridRow = gridRow;
        element.style.gridColumn = gridColumn;
        row.before(element);
    }

    /**
     * Render the addon. If an element is returned, it will be inserted into the list, spanning the modified row, before the element in DOM order.
     * @param row   The row to render the addon for.
     * @param item  The item used in rendering the row.
     * @returns     An optional element; If returned, this element will be placed in the list above the original row.
     */
    protected abstract render(row: HTMLElement): string | HTMLElement | void;

    /**
     * Called when the addon is no longer required
     */
    abstract destroy(): void;

    /**
     * Get a value from the current list item
     * @param path  The "."-separated path to the value to retreive.\
     * If the path is empty, the entire item is returned
     */
    protected getValue(path: string): any {
        if (path == "") return this.item;

        const parts = path.split(".");
        let temp: any = this.item;
        for (const part of parts) {
            // Invalid path
            if (
                !temp ||
                typeof temp != "object" ||
                !temp.hasOwnProperty(part)
            ) {
                temp = null;
                break;
            }

            // Climb up the ladder
            temp = temp[part];
        }

        return temp;
    }
}
