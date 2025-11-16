import { bind, loadPage } from "./spa.js";
const spa = bind("/categories/{category}");
spa.onPageLoad(main);
spa.onPageUnload(unload);

function main(r: Record<string, any>) {
    const category = decodeURIComponent(r.category);

    // Enable edit category button
    document.getElementById("ctx-edit")!.classList.remove("-ctx-hidden");
}

function unload() {
    // Disable edit category button
    document.getElementById("ctx-edit")!.classList.add("-ctx-hidden");
}
