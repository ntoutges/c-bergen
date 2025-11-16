import { bind, loadPage } from "./spa.js";
const spa = bind("/categories/{category}");
spa.onPageLoad(main);
spa.onPageUnload(unload);

function main(r: Record<string, any>) {
    const category = decodeURIComponent(r.category);
    console.log(category);
}

function unload() {}
