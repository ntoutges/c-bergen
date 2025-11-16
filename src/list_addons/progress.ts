import { ListAddon } from "../list.js";

export class ProgressAddon extends ListAddon {
    private readonly progress: string;
    private readonly min: number;
    private readonly max: number;

    constructor({
        progress,
        min = 0,
        max = 100
    }: {

        /** The path to the progress value */
        progress: string,

        /** The value to treat as 0% progress */
        min?: number,

        /** The value to treat as 100% progress */
        max?: number
    }) {
        super();

        this.progress = progress;
        this.min = min;
        this.max = max;
    }

    render(row: HTMLElement): string | void {
        const progressRaw = this.getValue(this.progress);
        if (typeof progressRaw != "number" || isNaN(progressRaw)) return; // Invalid progress value

        // Calculate progress value in range [0,100]
        const progress = (progressRaw - this.min) / (this.max - this.min) * 100;

        return `<div class="list-addon-progress"><div style="width: ${progress}%"></div></div>`;
    }

    // Nothing needs to be done to destroy this addon
    destroy(): void {}
}