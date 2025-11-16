import { ListAddon } from "../list.js";

export class ClickAddon extends ListAddon {
    private readonly callback: (id: string) => void;

    constructor(callback: (id: string) => void) {
        super();

        this.callback = callback;
    }

    protected render(row: HTMLElement): void {
        row.addEventListener("click", this.handleClick.bind(this, this.getValue("__name__")));

        // Indicate that row is clickable
        for (const child of Array.from(row.children)) {
            if (child instanceof HTMLElement) child.style.cursor = "pointer";
        }
    }

    private handleClick(id: string) {
        this.callback(id);
    }

    destroy() {}

}