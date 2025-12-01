import { bind, loadPage } from "./spa.js";
const spa = bind("/");
spa.onPageLoad(main);
spa.onPageUnload(unload);

import { List } from "./list.js";
import config from "../data/lists/categories.json";
import configArchived from "../data/lists/categories_archived.json";

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
let viewArchived = false;

function main() {
    setPath(document.getElementById("route")!, [
        {
            component: home,
        },
    ]);

    viewArchived = !!new URLSearchParams(location.search).get("archived");

    list = new List(
        document.querySelector<HTMLElement>(mainElSelector)!,
        viewArchived ? configArchived : config
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

    if (viewArchived) {
        list.registerAddon(
            "archived",
            new PillIcon({
                column: 3,
                colors: {
                    true: "#d9d9d9",
                    false: "#c0f8ff",
                },
            })
        );
    }

    loadList();

    // Manage 'add' button visibility
    unsubscribe = onAuthStateChanged(auth, (user) => {
        document
            .getElementById("ctx-new")!
            .classList.toggle("-ctx-hidden", !user);

        // Check if this user is a global admin
        db.getDoc("/groups/admins", false).then((doc) => {
            const gAdminButton = document.getElementById(
                "ctx-admin"
            )! as HTMLAnchorElement;

            if (
                !doc || // Global admin document not found
                !auth.currentUser || // User not logged in
                !doc.maintainers ||
                typeof doc.maintainers !== "object" || // Invalid global admin document
                !doc.maintainers.hasOwnProperty(auth.currentUser.email!) // User not present in global admin document
            ) {
                gAdminButton.classList.add("-ctx-hidden");
                return;
            }

            gAdminButton.classList.remove("-ctx-hidden");
            gAdminButton.href = "/gadmin"; // Redirect to G(lobal) Admin page
        });
    });
}

function unload() {
    list?.destroy();
    prevId = null;

    unsubscribe?.();

    // Disable new category button
    document.getElementById("ctx-new")!.classList.add("-ctx-hidden");
    document.getElementById("ctx-admin")!.classList.add("-ctx-hidden");
}

// Load new entries into the list
async function loadList() {
    if (!list) throw new Error("List not yet loaded");

    // Load in initial list data
    const docs = await db.getDocs(
        col,
        {
            prevId: prevId ?? undefined,
            field: "__name__",
            limit: pageSize,
        },
        viewArchived ? undefined : ["archived", "==", false]
    );

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
    prevId = docs[docs.length - 1].__name__;

    const bodyEl = document.querySelector<HTMLElement>(mainElSelector);
    if (!bodyEl) return; // How did you get here?

    // Need to load more elements in if at bottom of the list
    if (List.isAtBottom(bodyEl)) loadList();
}
