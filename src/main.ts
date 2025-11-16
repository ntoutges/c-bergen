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

const pageSize = 20;
const col: string = "categories";
const mainElSelector = "#list";

let list: List | null = null;
let loading: boolean = false;
let prevId: string | null = null;
let unsubscribe: (() => void) | null = null;

function main() {
    list = new List(
        document.querySelector<HTMLElement>(mainElSelector)!,
        config
    );

    // Load new page on click
    list.registerAddon(
        "click",
        new ClickAddon((id) =>
            loadPage(`/categories/${encodeURIComponent(atob(id))}`)
        )
    );
    loading = false;
    loadList();

    // Manage 'add' button visibility
    unsubscribe = onAuthStateChanged(auth, (user) => {
        document
            .getElementById("ctx-edit")!
            .classList.toggle("-ctx-hidden", !user);
    });
}

function unload() {
    list?.destroy();
    prevId = null;

    unsubscribe?.();
}

// Load new entries into the list
async function loadList() {
    if (!list) throw new Error("List not yet loaded");
    loading = true;

    // Load in initial list data
    const docs = await db.getDocs(col, {
        prevId: prevId ?? undefined,
        field: "__name__",
        limit: pageSize,
    });

    if (!list) return; // Page unloaded while getting documents

    const mdocs = await Promise.all(
        docs.map(async (doc) => {
            const when = new Date(doc.lastModified);
            const useDate = when.toDateString() !== new Date().toDateString(); // Use date if on *different* days; Otherwise default to time.

            // Get the email of the user who last modified this
            const user = (await db.getDoc(`users/${doc.lastModifiedBy}`, false))
                ?.email;

            return {
                ...doc,
                cpt: {
                    category: atob(doc.__name__),
                    lastModified: useDate
                        ? when.toLocaleDateString()
                        : when.toLocaleTimeString(),
                    lastModifiedBy: user,
                },
            };
        })
    );

    list.add(mdocs);
    list.render();
    loading = false;

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
