import { bind, loadPage } from "./spa.js";
const spa = bind("/");
spa.onPageLoad(main);
spa.onPageUnload(unload);

import { List } from "./list.js";
import config from "../data/lists/categories.json";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./fb.js";

import db from "./db.js";
import { ClickAddon } from "./list_addons/click.js";
import { setPath } from "./paths.js";
import { home } from "../index.js";
import { PillIcon } from "./list_addons/pill.js";

const pageSize = 20;
const col: string = "categories";
const mainElSelector = "#list";

let list: List | null = null;
let prevId: string | null = null;
let unsubscribe: (() => void) | null = null;

function main() {
    setPath(document.getElementById("route")!, [
        {
            component: home,
        },
    ]);

    list = new List(
        document.querySelector<HTMLElement>(mainElSelector)!,
        config
    );

    // Load new page on click
    list.registerAddon(
        "click",
        new ClickAddon((id) =>
            loadPage(`/category?id=${encodeURIComponent(atob(id))}`)
        )
    );

    // Distinguish type from everything else
    list.registerAddon(
        "pill",
        new PillIcon({
            column: 2,
            colors: {
                counter: "#a19ee5",
                timer: "#adf7b9",
                compare: "#cfd791",
            },
        })
    );

    loadList();

    // Manage 'add' button visibility
    unsubscribe = onAuthStateChanged(auth, (user) => {
        document
            .getElementById("ctx-new")!
            .classList.toggle("-ctx-hidden", !user);
    });
}

function unload() {
    list?.destroy();
    prevId = null;

    unsubscribe?.();

    // Disable new category button
    document.getElementById("ctx-new")!.classList.add("-ctx-hidden");
}

// Load new entries into the list
async function loadList() {
    if (!list) throw new Error("List not yet loaded");

    // Load in initial list data
    const docs = await db.getDocs(col, {
        prevId: prevId ?? undefined,
        field: "__name__",
        limit: pageSize,
    });

    if (!list) return; // Page unloaded while getting documents

    const mdocs = docs.map((doc) => {
        const when = new Date(doc.lastModified);
        const useDate = when.toDateString() !== new Date().toDateString(); // Use date if on *different* days; Otherwise default to time.

        return {
            ...doc,
            cpt: {
                category: atob(doc.__name__),
                lastModified: useDate
                    ? when.toLocaleDateString()
                    : when.toLocaleTimeString(),
            },
        };
    });

    list.add(mdocs);
    list.render();

    // All items fetched
    if (docs.length != pageSize) {
        prevId = null;
        return;
    }
    prevId = docs[docs.length - 1].id;

    const bodyEl = document.querySelector<HTMLElement>(mainElSelector);
    if (!bodyEl) return; // How did you get here?

    // Need to load more elements in if at bottom of the list
    if (List.isAtBottom(bodyEl)) loadList();
}
