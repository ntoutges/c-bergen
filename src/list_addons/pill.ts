import { ListAddon } from "../list.js";

export class PillIcon extends ListAddon {
    private readonly column: number;
    private readonly colors: Record<string, string>;

    constructor({
        column,
        colors,
    }: {
        /** The column to affect */
        column: number;

        /** Map from text values to the pill color */
        colors: Record<string, string>;
    }) {
        super();

        this.column = column;
        this.colors = colors;
    }

    protected render(row: HTMLElement): void {
        const column = row.querySelector<HTMLElement>(
            `.list-column:nth-child(${this.column}) > .list-column`
        );
        if (!column) return;

        const text = column.textContent!.toLowerCase().replace(/\s/g, "");
        if (!this.colors.hasOwnProperty(text)) return;

        column.style.padding = "5px 10px";
        column.style.borderRadius = "100px";
        column.style.backgroundColor = this.colors[text];
    }

    // Nothing eneds to be done to destroy this addon
    destroy() {}
}
