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
import { getRole } from "./roles";
import { confirmDelete } from "./modal";
import { ClickAddon } from "./list_addons/click";

export const types = {
    counter,
    timer,
    compare,
};

const pageSize = 20;
const overviewElSelector = "#overview";
const listElSelector = "#list";

let rid: symbol | null = null;

let ribbon: Ribbon | null = null;
let list: List | null = null;
let typeModule: (typeof types)[keyof typeof types] | null = null;
let unsubscribe: (() => void) | null = null;
let category: string | null;
let viewArchived = false;

let col: string = "";
let prevId: string | null = null;

async function main() {
    category = new URLSearchParams(location.search).get("id");
    viewArchived = !!new URLSearchParams(location.search).get("archived");

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

    // Listen for category deletions/restores
    document
        .getElementById("ctx-delete")!
        .addEventListener("click", deleteCategory);
    document
        .getElementById("ctx-restore")!
        .addEventListener("click", restoreCategory);

    // Fetch the category type
    const [doc, adminDoc] = await Promise.all([
        db.getDoc(`/categories/${categoryId}`, false),
        db.getDoc("/groups/admins", true),
    ]);
    if (id !== rid) return; // No longer need this result

    // Go home if invalid document detected
    if (!doc) {
        loadPage("/");
        return;
    }

    // Check if allowed to edit document
    unsubscribe = onAuthStateChanged(auth, () => {
        updateEditable(getRole(doc, adminDoc), category!, doc);
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

    typeModule.applyPlugins(list, ribbon);

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
    rid = null;

    if (unsubscribe) unsubscribe();

    // Hide the show button
    document.getElementById("ctx-note")!.classList.add("-ctx-hidden");
    document.getElementById("ctx-admin")!.classList.add("-ctx-hidden");
    document.getElementById("ctx-delete")!.classList.add("-ctx-hidden");
    document.getElementById("ctx-restore")!.classList.add("-ctx-hidden");
}

// Check if the current user is allowed to edit the document, and if so: show the 'New Entry' button.
function updateEditable(
    role: string | null,
    category: string,
    doc: Record<string, any>
): void {
    const addable = role === "write" || role === "admin";
    const editable = role === "admin";

    const queryParams = new URLSearchParams({ cat: category });

    const addButton = document.getElementById("ctx-note")! as HTMLAnchorElement;
    if (addable) {
        addButton.classList.remove("-ctx-hidden");
        addButton.href = `/note?${queryParams.toString()}`;

        // Allower adders to delete notes
        if (list) {
            list.registerAddon("delete", new ClickAddon(deleteNote));
        }
    } else {
        addButton.classList.add("-ctx-hidden");
    }

    const editButton = document.getElementById(
        "ctx-admin"
    )! as HTMLAnchorElement;
    const deleteRestoreButton = document.getElementById(
        doc.archived ? "ctx-restore" : "ctx-delete"
    )! as HTMLAnchorElement;
    if (editable) {
        editButton.classList.remove("-ctx-hidden");
        deleteRestoreButton.classList.remove("-ctx-hidden");
        editButton.href = `/admin?${queryParams.toString()}`;
    } else {
        editButton.classList.add("-ctx-hidden");
    }
}

async function loadList(id: symbol) {
    if (!list) throw new Error("List not yet loaded");

    // Load in initial list data
    const docs = await db.getDocs(
        col,
        {
            prevId: prevId ?? undefined,
            field: "metadata.createdAt",
            limit: pageSize,
            reversed: true,
        },
        viewArchived ? undefined : ["archived", "==", false]
    );

    if (!list || !typeModule || id !== rid) return; // Page unloaded while getting documents

    const mdocs = docs.map(typeModule.convert);

    list.add(mdocs);
    list.render();

    // All items fetched
    if (docs.length != pageSize) {
        prevId = null;
        return;
    }
    prevId = docs[docs.length - 1].__name__;

    const bodyEl = document.querySelector<HTMLElement>(listElSelector);
    if (!bodyEl) return; // How did you get here?

    // Need to load more elements in if at bottom of the list
    if (List.isAtBottom(bodyEl)) loadList(id);
}

function deleteCategory() {
    if (category === null) return;

    confirmDelete(document.getElementById("delete-modal")!, category)
        .then(async () => {
            if (category === null || !auth.currentUser) return;

            // Mark category as 'archived', so data is never lost
            const docId = `/categories/${btoa(category)}`;
            const doc = await db.getDoc(docId, false);
            if (!doc) return; // Invalid doc

            doc.archived = true;
            doc.lastModifiedBy = auth.currentUser.email!;
            doc.lastModified = new Date().getTime();

            await db.setDoc(docId, doc);
            db.reload();
            loadPage("/"); // Go home
        })
        .catch(() => {}); // Do nothing on cancel
}

async function deleteNote(id: string) {
    if (category === null) return;

    const docId = `/categories/${btoa(category)}/events/${id}`;

    const doc = await db.getDoc(docId, false);
    if (!doc || !auth.currentUser) return; // Invalid document/user

    confirmDelete(
        document.getElementById("delete-note-modal")!,
        `< ${JSON.stringify(doc.data)} > by ${doc.metadata.createdBy}`,
        doc.metadata.createdBy
    )
        .then(async () => {
            if (!auth.currentUser) return; // Ignore if the user logged out

            // Archive document
            doc.archived = true;
            doc.lastModifiedBy = auth.currentUser.email!;
            doc.lastModified = new Date().getTime();
            await db.setDoc(docId, doc);

            // Reset loaded list info
            db.reload();
            prevId = null;

            if (list && rid) {
                list.reset();
                loadList(rid);
            }
        })
        .catch(() => {}); // Do nothing on cancel
}

async function restoreCategory() {
    if (category === null || !auth.currentUser) return;

    const docId = `/categories/${btoa(category)}`;
    const doc = await db.getDoc(docId, false);
    if (!doc) return;

    // Restore document to original (non-archived) state
    doc.archived = false;
    doc.lastModifiedBy = auth.currentUser.email!;
    doc.lastModified = new Date().getTime();
    await db.setDoc(docId, doc);

    // Go back to the home page
    db.reload();
    loadPage("/");
}
