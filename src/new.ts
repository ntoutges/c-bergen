import "../styles/new.css";
import { doc, runTransaction } from "firebase/firestore";

import { bind, loadPage } from "./spa.js";
import { auth, firestore } from "./fb";
const spaType = bind("/new/{type}");
spaType.onPageLoad(main);
spaType.onPageUnload(unload);

import db from "./db.js";

const spaName = bind("/new");
spaName.onPageLoad(mainName);
spaName.onPageUnload(unloadName);

const validTypes = new Set(["counter", "timer"]);
let inputElement: HTMLInputElement | null = null;
let type: string = "";

function main(r: Record<string, any>) {
    queueMicrotask(() => {
        // Enable cancel button
        document.getElementById("ctx-close")!.classList.remove("-ctx-hidden");
    });

    type = decodeURIComponent(r.type);

    // Invalid type; Return to chooser
    if (!validTypes.has(type)) {
        loadPage("/new");
        return;
    }

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
}

function unload() {
    loading = false;

    // Disable cancel button
    document.getElementById("ctx-close")!.classList.add("-ctx-hidden");
}

function mainName() {
    queueMicrotask(() => {
        // Enable cancel button
        document.getElementById("ctx-close")!.classList.remove("-ctx-hidden");
    });
}

function unloadName() {
    // Disable cancel button
    document.getElementById("ctx-close")!.classList.add("-ctx-hidden");
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
                maintainers: [],
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
        loadPage(`/categories/${encodeURIComponent(category)}`);
    }, 1000);
    return "";
}
