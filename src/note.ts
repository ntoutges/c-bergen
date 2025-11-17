import { home } from "../index.js";
import { setPath } from "./paths.js";
import { types } from "./category.js";

import "../styles/note.css";

import { bind, loadPage } from "./spa.js";
import db from "./db.js";
import { auth } from "./fb.js";
import { onAuthStateChanged } from "firebase/auth";
const spa = bind("/note");
spa.onPageLoad(main);
spa.onPageUnload(unload);

let rid: symbol | null = null;
let typeModule: (typeof types)[keyof typeof types] | null = null;
let category: string | null = null;
let unsubscribe: (() => void) | null = null;

async function main() {
    category = new URLSearchParams(location.search).get("cat");

    // Invalid category; Go home...
    if (!category) {
        loadPage(`/category?id=${encodeURIComponent(category!)}`);
        return;
    }

    // if no longer logged in, go back to category
    unsubscribe = onAuthStateChanged(auth, () => {
        if (!auth.currentUser)
            loadPage(`/category?id=${encodeURIComponent(category!)}`);
    });

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
            path: `/category?id=${encodeURIComponent(category)}`,
        },
        {
            component: "Note",
        },
    ]);

    // Fetch the category type
    const doc = await db.getDoc(`/categories/${categoryId}`, false);
    if (id !== rid) return; // No longer need this result

    // Go home if invalid document detected
    if (!doc) {
        loadPage("/");
        return;
    }

    let type = doc.metadata.type;

    // Undefined type... Assume counter
    if (!types.hasOwnProperty(type)) type = "counter";

    typeModule = (types as Record<string, (typeof types)[keyof typeof types]>)[
        type
    ];

    // Fill space with the type-specific HTML
    document.getElementById("note-module")!.innerHTML = typeModule.page;
    typeModule.new_main();
}

function unload() {
    category = null;
    typeModule?.new_unload();
    unsubscribe?.();
}

// Create a new note with some data
export async function note(data: any) {
    if (category === null) return; // Ignore creation if not in a category

    const now = new Date().getTime();
    const user = auth.currentUser;

    // Preflight check: document must be created by a user
    // Rely on firestore for actual permissions check
    if (!user) throw new Error("Not authorized");

    await db.setDoc(
        null,
        {
            data: data,
            lastModified: now,
            lastModifiedBy: user.email,
            metadata: {
                createdAt: now,
                createdBy: user.email,
            },
        },
        {
            collection: `categories/${btoa(category)}/events`,
        }
    );

    db.reload();
}
