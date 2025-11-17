import "../styles/admin.css";

import { onAuthStateChanged } from "firebase/auth";
import { List } from "./list.js";
import { auth } from "./fb.js";
import db from "./db.js";

import { bind, loadPage } from "./spa.js";
const spa = bind("/admin");
spa.onPageLoad(main);
spa.onPageUnload(unload);

import listSetup from "../data/lists/admin.json";
import { PillIcon } from "./list_addons/pill.js";
import { ClickAddon } from "./list_addons/click";
import { setPath } from "./paths";
import { home } from "..";

const mainElSelector = "#list";

let list: List | null = null;
let category: string | null;
let unsubscribe: (() => void) | null = null;
let rid: symbol | null = null;

async function main() {
    // Get category data
    category = new URLSearchParams(location.search).get("cat");

    const id = Symbol("Admin RID");
    rid = id;

    // Redirect home if invalid category
    if (!category) {
        loadPage("/", "none");
        return;
    }

    // Update the path display
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
            component: "admin",
        },
    ]);

    // Attempt to fetch the category document
    const categoryId = btoa(category);
    const doc = await db.getDoc(`/categories/${categoryId}`, false);

    // Invalid category
    if (!doc) {
        loadPage("/", "none");
        return;
    }

    // Redirect home if logged out
    unsubscribe = onAuthStateChanged(auth, (user) => {
        // Check if the user is allowed to view this page
        if (!user || doc.maintainers[user.email!] !== "admin") {
            loadPage(`/?id=${encodeURIComponent(category!)}`);
            return;
        }
    });

    // Ensure that the current user has been fetched before continuing
    await getCurrentUser();

    // RID updated
    if (rid !== id) return;

    // Listen for add button clicks
    document
        .getElementById("user-add-button")!
        .addEventListener("click", updatePermissions);

    list = new List(
        document.querySelector<HTMLElement>(mainElSelector)!,
        listSetup
    );
    list.registerAddon(
        "pill",
        new PillIcon({
            column: 2,
            colors: {
                admin: "#65de3e",
                write: "#57b4da",
            },
        })
    );
    list.registerAddon("click", new ClickAddon(fillInputField));

    list.add(await getMaintainerArray(categoryId));
    list.render();
}
function unload() {
    list?.destroy();
    rid = null;

    // Run all unsubscribe functions
    unsubscribe?.();
    unsubscribe = null;
}

// Get the current user
function getCurrentUser(): Promise<typeof auth.currentUser> {
    return new Promise((resolve) => {
        // Wait for the user to be determined
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            resolve(user);
            unsubscribe();
        });
    });
}

async function getMaintainerArray(
    categoryId: string
): Promise<{ __name__: string; value: "admin" | "write" }[]> {
    const doc = await db.getDoc(`/categories/${categoryId}`);
    if (!doc || !doc.maintainers || typeof doc.maintainers !== "object")
        return [];

    // return doc.maintainers;
    const maintainers: { __name__: string; value: "admin" | "write" }[] = [];
    for (const [__name__, value] of Object.entries(doc.maintainers)) {
        if (!["admin", "write"].includes(value as string)) continue; // Invalid entry; Ignore

        maintainers.push({
            __name__: __name__,
            value: value as "admin" | "write",
        });
    }

    return maintainers.sort((a, b) =>
        // Give admin vs. writer priority over simple username comparison
        a.value === b.value
            ? a.__name__.localeCompare(b.__name__)
            : a.value === "admin"
            ? -1
            : 1
    );
}

async function updatePermissions() {
    const emailInput = document.getElementById(
        "user-add-input"
    )! as HTMLInputElement;
    const typeInput = document.getElementById(
        "user-add-type"
    )! as HTMLSelectElement;

    const email = emailInput.value.trim();
    const type = typeInput.value;

    // Ignore if invalid state
    if (!auth.currentUser || !email || !category) return;

    // User not allowed to update their own permissions
    if (email === auth.currentUser.email) {
        return;
    }

    const docId = `/categories/${btoa(category)}`;
    const doc = await db.getDoc(docId, false);

    // Invalid document
    if (!doc) return;

    // Update maintainers
    if (!doc.maintainers || typeof doc.maintainers !== "object") {
        doc.maintainers = {};
    }

    // Add/remove user based on type option
    if (type === "remove") delete doc.maintainers[email];
    else doc.maintainers[email] = type;

    await db.setDoc(docId, doc);

    // Clear inputs once finished
    emailInput.value = "";
    typeInput.value = "write";

    if (!list) return;

    // Update list
    list.reset();
    list.add(await getMaintainerArray(btoa(category)));
    list.render();
}

async function fillInputField(email: string) {
    const emailInput = document.getElementById(
        "user-add-input"
    )! as HTMLInputElement;
    const typeInput = document.getElementById(
        "user-add-type"
    )! as HTMLSelectElement;

    // Default
    let role = "write";

    // Get the user's role
    // Note that the underlying db mechanism performs caching, negating the otherwise
    // terrible cost of constantly fetchin this document
    if (category) {
        const doc = await db.getDoc(`/categories/${btoa(category)}`);

        if (
            doc &&
            doc.maintainers &&
            typeof doc.maintainers === "object" &&
            doc.maintainers.hasOwnProperty(email)
        ) {
            role = doc.maintainers[email];
        }
    }

    emailInput.value = email;
    typeInput.value = role;
}
