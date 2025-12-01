import { home } from "../index.js";
import { setPath } from "./paths.js";
import { types } from "./category.js";

import "../styles/note.css";

import { bind, loadPage } from "./spa.js";
import db from "./db.js";
import { auth } from "./fb.js";
import { onAuthStateChanged } from "firebase/auth";
import { getRole } from "./roles.js";
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

    // Invalid role; Not allowed to add documents
    const role = getRole(doc, adminDoc);
    if (!role) {
        loadPage(`/category?id=${encodeURIComponent(category)}`);
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

    const categoryPath = `categories/${btoa(category)}`;

    // Preflight check: document must be created by a user
    // Rely on firestore for actual permissions check
    if (!user) throw new Error("Not authorized");

    // Get the category document
    const categoryDoc = await db.getDoc(categoryPath, false);

    // Invalid category; Ignore!
    if (!categoryDoc) return;

    // Cache last update information
    // (Anyone allowed to modify this data...)
    categoryDoc.lastModified = now;
    categoryDoc.lastModifiedBy = user.email;

    await Promise.all([
        // Update the base category document
        db.setDoc(categoryPath, categoryDoc),

        // Create the new note document
        db.setDoc(
            null,
            {
                data: data,
                archived: false,
                lastModified: now,
                lastModifiedBy: user.email,
                metadata: {
                    createdAt: now,
                    createdBy: user.email,
                },
                maintainers: {
                    [user.email!]: "write",
                },
            },
            {
                collection: `${categoryPath}/events`,
            }
        ),
    ]);

    db.reload();
}
