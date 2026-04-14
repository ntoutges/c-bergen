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
let cleanupInlineInputs: (() => void) | null = null;

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
    cleanupInlineInputs = setupInlineInputSizing();
    typeModule.new_main();
}

function unload() {
    category = null;
    cleanupInlineInputs?.();
    cleanupInlineInputs = null;
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
            },
        ),
    ]);

    db.reload();
}

function setupInlineInputSizing() {
    const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(".modal-input-inline"),
    );

    if (inputs.length === 0) return null;

    const listeners = inputs.map((input) => {
        const onInput = () => resizeInput(input);
        input.addEventListener("input", onInput);
        resizeInput(input);
        return { input, onInput };
    });

    return () => {
        listeners.forEach(({ input, onInput }) => {
            input.removeEventListener("input", onInput);
        });
    };
}

function resizeInput(input: HTMLInputElement) {
    // Prepare element for measuring text width for inline input resizing
    const measure = document.createElement("span");
    measure.setAttribute("aria-hidden", "true");
    measure.style.position = "absolute";
    measure.style.visibility = "hidden";
    measure.style.whiteSpace = "pre";
    measure.style.left = "-9999px";
    measure.style.top = "0";
    document.body.appendChild(measure);

    const styles = window.getComputedStyle(input);
    const value = input.value || input.placeholder || "0";

    measure.textContent = value;
    measure.style.font = styles.font;
    measure.style.fontKerning = styles.fontKerning;
    measure.style.fontFeatureSettings = styles.fontFeatureSettings;
    measure.style.fontVariationSettings = styles.fontVariationSettings;
    measure.style.fontSize = styles.fontSize;
    measure.style.fontFamily = styles.fontFamily;
    measure.style.fontWeight = styles.fontWeight;
    measure.style.fontStyle = styles.fontStyle;
    measure.style.letterSpacing = styles.letterSpacing;
    measure.style.textTransform = styles.textTransform;
    measure.style.textIndent = styles.textIndent;

    const textWidth = measure.getBoundingClientRect().width;
    const paddingX =
        parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const borderX =
        parseFloat(styles.borderLeftWidth) +
        parseFloat(styles.borderRightWidth);
    const minWidth = parseFloat(styles.minWidth);

    input.style.width = `${Math.max(
        Math.ceil(textWidth + paddingX + borderX + 2),
        Number.isNaN(minWidth) ? 0 : minWidth,
    )}px`;

    // Clean up
    document.body.removeChild(measure);
}

/**
 * Open the refine modal
 * @param args  Arguments to provide to modal inputs
 * @returns A promise resolving to the submitted arguments or null if cancelled
 */
export function openModal<T extends Record<string, any>>(
    args: T,
): Promise<T | null> {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById("note-refine-modal");
        if (!modal) {
            reject(new Error("Modal element not found"));
            return;
        }

        // Populate modal inputs with args here (if needed)
        modal.classList.remove("modal-hidden");

        // Fill out preview inputs
        for (const key in args) {
            const id = `note-refine-${key}`;
            const input = document.getElementById(
                id,
            ) as HTMLInputElement | null;
            if (!input) continue;

            input.value = args[key];
            resizeInput(input);
        }

        const submitButton = modal.querySelector(
            "#note-refine-save",
        ) as HTMLElement;
        const cancelButton = modal.querySelector(
            "#note-refine-cancel",
        ) as HTMLElement;

        if (!submitButton || !cancelButton) {
            reject(new Error("Modal buttons not found"));
            return;
        }

        const onBlur = (e: Event) => {
            if (
                !(e.target instanceof HTMLElement) ||
                e.target.closest(".modal-box")
            ) {
                return; // Ignore clicks inside the modal box
            }

            // Clicked on backdrop; Treat as cancel
            onCancel();
        };

        const onCancel = () => {
            modal.classList.add("modal-hidden");
            resolve(null);
        };

        const onSubmit = () => {
            // Extract values from inputs and construct result object
            const result: Record<string, any> = {};

            for (const key in args) {
                const id = `note-refine-${key}`;
                const input = document.getElementById(
                    id,
                ) as HTMLInputElement | null;
                if (!input) continue;

                result[key] = input.value;
            }

            modal.classList.add("modal-hidden");
            resolve(result as T);
        };

        cancelButton.addEventListener("click", onCancel);
        submitButton.addEventListener("click", onSubmit);
        modal.addEventListener("click", onBlur);

        modal;
    });
}
