type RibbonItem = Record<string, any>;

type RibbonSegmentValue = {
    /** Name of this entry */
    name: string;

    /** Where the value for this entry comes from */
    path: string;

    /** The value to fallback to if the property `path` doesn't exist */
    nullish?: string;
};

type RibbonSegmentValues = {
    /** Name of this entry */
    name: string;

    /** The values that make up this segment */
    values: ({ text: string } | { path: string; nullish?: string })[];
};

type RibbonSegmentConst = {
    /** The constant value that this segment represents */
    text: string;
};

type RibbonSegment =
    | RibbonSegmentValue
    | RibbonSegmentValues
    | RibbonSegmentConst;

type RibbonEntry = {
    /** Main focus item */
    title: RibbonSegment;

    /** Secondary entry */
    subtitle?: RibbonSegment;

    /** What this item represents */
    desc: string;
};

export class Ribbon {
    // The item that this banner renders
    private item: RibbonItem | null = null;

    private readonly element: HTMLElement;
    private readonly entries: RibbonEntry[];

    constructor(element: HTMLElement, entries: RibbonEntry[]) {
        this.element = element;
        this.entries = entries;

        // @ts-ignore
        this.element.addEventListener("click", this.handleClick.bind(this));
    }

    /**
     * Set the item that this banner is rendering
     * @param item  The item to render
     */
    set(item: Record<string, any>) {
        this.item = item;
    }

    /**
     * Render the banner
     */
    render() {
        // Clear the previous value
        this.element.innerHTML = "";

        // Setup container
        const container = document.createElement("div");
        container.classList.add("ribbon-container");
        this.element.append(container);

        container.style.gridTemplateColumns = `repeat(${this.entries.length}, 1fr)`;

        for (let i in this.entries) {
            const entry = this.entries[i];
            const title = this.getEntryValue(entry.title);
            const subtitle = this.getEntryValue(entry.subtitle);

            const html = `<div class="ribbon-item" data-index=${i}>
    <div class="ribbon-title">${title}</div>
    <div class="ribbon-subtitle">${subtitle}</div>
</div>`;
            container.insertAdjacentHTML("beforeend", html);
        }
    }

    getEntryValue(entry: RibbonSegment | null = null): string {
        if (entry == null) return ""; // No entry available

        // Raw text already given!
        if (entry.hasOwnProperty("text"))
            return (entry as RibbonSegmentConst).text;

        if (entry.hasOwnProperty("values")) {
            const values = (entry as RibbonSegmentValues).values;
            let strValues: string[] = [];

            for (const value of values) {
                strValues.push(
                    this.getEntryValue(
                        value.hasOwnProperty("path")
                            ? {
                                  name: "",
                                  path: (value as { path: string }).path,
                              }
                            : {
                                  text: (value as { text: string }).text,
                              }
                    )
                );
            }
            return strValues.join("");
        }

        const value = this.getValue((entry as RibbonSegmentValue).path);

        // Extract string value from given value
        let str = "";
        switch (typeof value) {
            case "string":
                str = value;
                break;
            case "number":
                str = value.toString();
                break;
            case "object":
                if (value) str = Object.keys(value).length ? "{ ... }" : "{ }";
                else str = (entry as RibbonSegmentValue).nullish ?? "NULL";
                break;
            default:
                str = "?";
        }

        // Rudimentary escapement
        return str.replaceAll("<", "&lt;").replaceAll(">", "&gt");
    }

    getEntryName(entry: RibbonSegment | null = null): string {
        if (!entry?.hasOwnProperty("name")) return ""; // No value entry available
        return (entry as RibbonSegmentValue).name;
    }

    /**
     * Get a value from the internal item
     * @param path  The "."-separated path to the value to retreive.\
     * If the path is empty, the entire item is returned
     */
    private getValue(path: string): any {
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

    /**
     * Handle modal events
     * @param event
     */
    private handleClick(event: PointerEvent) {
        if (!(event.target instanceof HTMLElement)) return; // What did you even click on?

        // Open modal
        const entry = event.target.closest<HTMLElement>(".ribbon-item");
        if (entry) {
            const entryData = this.entries[+(entry.dataset?.index ?? -1)];
            if (!entryData) return; // Invalid item data

            this.buildModal(entryData);
            return;
        }

        // Close modal
        if (event.target.matches(".ribbon-modal-bg")) {
            event.target.remove();
            return;
        }

        // Close modal
        if (event.target.matches(".ribbon-modal-close")) {
            event.target.closest(".ribbon-modal-bg")?.remove();
            return;
        }
    }

    buildModal(entry: RibbonEntry) {
        const title = this.getEntryValue(entry.title);
        const titleName = this.getEntryName(entry.title);

        const subtitle = this.getEntryValue(entry.subtitle);
        const subtitleName = this.getEntryName(entry.subtitle);

        const content = `<div class="ribbon-modal-bg">
    <div class="ribbon-modal">
        <div class="ribbon-modal-header">
            <span class="material-symbols-outlined ribbon-modal-close">close</span>
        </div>
        <div class="ribbon-modal-v">
            <span>${title}</span>
            <span>${titleName}</span>
        </div>
        <div class="ribbon-modal-v">
            <span>${subtitle}</span>
            <span>${subtitleName}</span>
        </div>
        <div class="ribbon-modal-desc">${entry.desc}</div>
    </div>
</div>`;

        this.element.insertAdjacentHTML("beforeend", content);
    }
}
