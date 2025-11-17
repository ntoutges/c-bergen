import "../styles/category.css";

import { setPath } from "./paths.js";
import { bind, loadPage } from "./spa.js";
const spa = bind("/category");
spa.onPageLoad(main);
spa.onPageUnload(unload);

import { home } from "../index.js";
import { Ribbon } from "./ribbon.js";
import { List } from "./list.js";

import * as counter from "./types/counter.js";
import * as timer from "./types/timer.js";
import * as compare from "./types/compare.js";
import db from "./db";
import { auth } from "./fb";
import { onAuthStateChanged } from "firebase/auth";

const types = {
    counter,
    timer,
    // compare,
};

const pageSize = 20;
const overviewElSelector = "#overview";
const listElSelector = "#list";

let rid: symbol | null = null;

let ribbon: Ribbon | null = null;
let list: List | null = null;
let typeModule: (typeof types)[keyof typeof types] | null = null;
let unsubscribe: (() => void) | null = null;

let col: string = "";
let prevId: string | null = null;

async function main() {
    const category = new URLSearchParams(location.search).get("id");

    // Invalid category given; Go home...
    if (!category) {
        loadPage("/");
        return;
    }

    const categoryId = btoa(category);

    // Prevent race conditions
    const id = Symbol("main_render");
    rid = id;

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

    // Fetch the category type
    const doc = await db.getDoc(`/categories/${categoryId}`, false);
    if (id !== rid) return; // No longer need this result

    // Go home if invalid document detected
    if (!doc) {
        loadPage("/");
        return;
    }

    // Check if allowed to edit document
    unsubscribe = onAuthStateChanged(auth, () => {
        updateEditable(doc, category);
    });

    let type = doc.metadata.type;

    // Undefined type... Assume counter
    if (!types.hasOwnProperty(type)) type = "counter";

    // Get the proper module to handle this type
    typeModule = (types as Record<string, (typeof types)[keyof typeof types]>)[
        type
    ];

    // Get the data required for the ribbon/list views
    const { ribbon: ribbonSetup, list: listSetup } = typeModule.setup();

    ribbon = new Ribbon(
        document.querySelector<HTMLElement>(overviewElSelector)!,
        ribbonSetup
    );
    list = new List(
        document.querySelector<HTMLElement>(listElSelector)!,
        listSetup
    );

    ribbon.render();

    col = `categories/${categoryId}/events`;
    typeModule.aggregate(col).then((data) => {
        if (id !== rid || !ribbon) return; // No longer need this result
        ribbon.set(data);
        ribbon.render();
    });

    loadList(id);
}

function unload() {
    // Disable edit category button
    document.getElementById("ctx-edit")!.classList.add("-ctx-hidden");
    rid = null;

    if (unsubscribe) unsubscribe();

    // Hide the show button
    document.getElementById("ctx-note")!.classList.add("-ctx-hidden");
}

// Check if the current user is allowed to edit the document, and if so: show the 'New Entry' button.
function updateEditable(doc: Record<string, any>, category: string): void {
    const editable =
        auth.currentUser &&
        (doc.metadata?.createdBy === auth.currentUser.email ||
            (Array.isArray(doc.maintainers) &&
                doc.maintainers.includes(auth.currentUser.email)));

    const button = document.getElementById("ctx-note")! as HTMLAnchorElement;
    if (!editable) {
        button.classList.add("-ctx-hidden");
        return;
    }

    button.classList.remove("-ctx-hidden");

    // Update the HREF
    const queryParams = new URLSearchParams({ id: category });

    button.href = `/note?${queryParams.toString()}`;
}

async function loadList(id: symbol) {
    if (!list) throw new Error("List not yet loaded");

    // Load in initial list data
    const docs = await db.getDocs(col, {
        prevId: prevId ?? undefined,
        field: "__name__",
        limit: pageSize,
    });

    if (!list || !typeModule || id !== rid) return; // Page unloaded while getting documents

    const mdocs = docs.map(typeModule.convert);

    list.add(mdocs);
    list.render();

    // All items fetched
    if (docs.length != pageSize) {
        prevId = null;
        return;
    }
    prevId = docs[docs.length - 1].id;

    const bodyEl = document.querySelector<HTMLElement>(listElSelector);
    if (!bodyEl) return; // How did you get here?

    // Need to load more elements in if at bottom of the list
    if (List.isAtBottom(bodyEl)) loadList(id);
}
