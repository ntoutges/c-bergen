import "../styles/new.css";
import { doc, runTransaction } from "firebase/firestore";
import { auth, firestore } from "./fb.js";

import { bind, loadPage } from "./spa.js";
const spaName = bind("/new/{type}");
spaName.onPageLoad(mainName);
spaName.onPageUnload(unloadName);

import { home } from "..";
import { setPath } from "./paths";

import db from "./db.js";
import { onAuthStateChanged } from "firebase/auth";

const spaType = bind("/new");
spaType.onPageLoad(mainType);
spaType.onPageUnload(unloadType);

const validTypes = new Set(["counter", "timer", "compare"]);

let inputElement: HTMLInputElement | null = null;
let type: string = "";

let unsubscribeType: (() => void) | null = null;
let unsubscribeName: (() => void) | null = null;

function mainName(r: Record<string, any>) {
    type = decodeURIComponent(r.type);

    // Invalid type; Return to chooser
    if (!validTypes.has(type)) {
        loadPage("/new");
        return;
    }

    queueMicrotask(() => {
        // Enable cancel button
        document.getElementById("ctx-close")!.classList.remove("-ctx-hidden");
    });

    setPath(document.getElementById("route")!, [
        {
            component: home,
            path: "/",
        },
        {
            component: "New",
            path: "/new",
        },
        {
            component: type[0].toUpperCase() + type.slice(1),
        },
    ]);

    inputElement = document.querySelector<HTMLInputElement>(
        "#new-category-name-container .category-name"
    )!;

    // Listen for button clicks
    document
        .querySelector<HTMLElement>(
            "#new-category-name-container .category-add"
        )!
        .addEventListener("click", async () => {
            const message = await createCategory();
            document.querySelector("#category-error")!.textContent = message;
        });

    unsubscribeName = logoutOnNoAuth();
}

function unloadName() {
    loading = false;

    // Disable cancel button
    document.getElementById("ctx-close")!.classList.add("-ctx-hidden");

    unsubscribeName?.();
}

function mainType() {
    queueMicrotask(() => {
        // Enable cancel button
        document.getElementById("ctx-close")!.classList.remove("-ctx-hidden");
    });

    setPath(document.getElementById("route")!, [
        {
            component: home,
            path: "/",
        },
        {
            component: "New",
        },
    ]);

    unsubscribeType = logoutOnNoAuth();
}

function unloadType() {
    // Disable cancel button
    document.getElementById("ctx-close")!.classList.add("-ctx-hidden");

    unsubscribeType?.();
}

// Attempt to create the new category
let loading = false;
async function createCategory(): Promise<string> {
    if (!inputElement) return "How did you get here?";

    const category = inputElement.value;
    const categoryId = btoa(category);
    const t = type;

    const user = auth.currentUser;
    if (!user) {
        queueMicrotask(() => loadPage("/")); // You shouldn't be here; Go home!
        return "User is not logged in!";
    }

    loading = true;

    const row = document.querySelector(
        "#new-category-name-container .category-name-row"
    )!;

    // Start loading
    row.classList.add("loading");
    row.classList.remove("verified", "failure");

    let success = false;
    try {
        success = await runTransaction(firestore, async (transaction) => {
            const categoryDoc = doc(firestore, `/categories/${categoryId}`);
            const categorySnapshot = await transaction.get(categoryDoc);

            // Category already exists; Give up!
            if (categorySnapshot.exists()) return false;

            const now = new Date().getTime();

            transaction.set(categoryDoc, {
                lastModified: now,
                lastModifiedBy: user.email,
                maintainers: {
                    [user.email!]: "admin",
                },
                archived: false,
                metadata: {
                    createdAt: now,
                    createdBy: user.email,
                    type: t,
                },
            });

            // Successfully created a new doc!
            return true;
        });
    } catch (err) {
        loading = false;
        row.classList.remove("loading");
        row.classList.add("failure");
        return (err as Error).message;
    }
    row.classList.remove("loading");

    // Stop loading and indicate state
    if (!success) {
        row.classList.add("failure");
        loading = false;
        return "Category already exists!";
    }

    // New category! Force reload
    db.reload();

    row.classList.add("verified");
    // **Don't** reset loading; Rely on changing page

    // Move to the new category page
    setTimeout(() => {
        loadPage(`/category?id=${encodeURIComponent(category)}`);
    }, 1000);
    return "";
}

function logoutOnNoAuth() {
    return onAuthStateChanged(auth, (user) => {
        // Go home if not logged in
        if (!user) loadPage("/");
    });
}
