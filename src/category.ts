import { setPath } from "./paths.js";
import { bind, loadPage } from "./spa.js";
const spa = bind("/categories/{category}");
spa.onPageLoad(main);
spa.onPageUnload(unload);

import { home } from "../index.js";

function main(r: Record<string, any>) {
    const category = decodeURIComponent(r.category);

    setPath(document.getElementById("route")!, [
        {
            component: home,
            path: "/",
        },
        {
            component: category,
        },
    ]);

    // Enable edit category button
    document.getElementById("ctx-edit")!.classList.remove("-ctx-hidden");
}

function unload() {
    // Disable edit category button
    document.getElementById("ctx-edit")!.classList.add("-ctx-hidden");
}
