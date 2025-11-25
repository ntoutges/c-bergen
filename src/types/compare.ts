import { List } from "../list";
import { Ribbon } from "../ribbon.js";

import list from "../../data/lists/compare.json";
// import ribbon from "../../data/ribbons/compare.json";

import _page from "../../public/pages/types/compare.html?raw";
import { note } from "../note";
import { loadPage } from "../spa";
import { ProgressAddon } from "../list_addons/progress";
import { collection, getAggregateFromServer, sum } from "firebase/firestore";
import { firestore } from "../fb";
export const page = _page;

/**
 * Generic function used to determine the shape of the ribbon and list
 */
export function setup(): {
    ribbon: ConstructorParameters<typeof Ribbon>[1];
    list: ConstructorParameters<typeof List>[1];
} {
    return {
        ribbon: [
            {
                title: {
                    name: "Ratio",
                    path: "ratio",
                },
                desc: "The ratio between the total score of 'A' versus the score of 'B'\nA higher number indicates a better time for the 'A' side.",
                subtitle: {
                    text: "Ratio",
                },
            },
            {
                title: {
                    name: "Total",
                    values: [
                        {
                            path: "data.a",
                        },
                        {
                            text: "&nbsp;:&nbsp;",
                        },
                        {
                            path: "data.b",
                        },
                    ],
                },
                desc: "The total aggregate number of points for 'A' vs. the number of points scored for 'B'.",
                subtitle: {
                    text: "Total",
                },
            },
        ],
        list,
    };
}

export function applyPlugins(list: List, ribbon: Ribbon): void {
    list.registerAddon(
        "progress",
        new ProgressAddon({
            progress: "cpt.progress",
            min: 0,
            max: 1,
        })
    );
}

/**
 * Generic function used to fill in the created ribbon
 * @param col   The string referring to the collection to read.
 */
export async function aggregate(col: string): Promise<any> {
    const data = {
        data: {
            a: 0,
            b: 0,
        },
        ratio: "00.0%", // Ratio between 'A' and 'B'
    };

    const c = collection(firestore, col);

    await Promise.all([
        // Get total
        getAggregateFromServer(c, {
            a: sum("data.a"),
            b: sum("data.b"),
        }).then((aggr) => {
            data.data.a = aggr.data().a;
            data.data.b = aggr.data().b;
        }),
    ]);

    // Get ratio from aggregate
    let a = data.data.a;
    let b = data.data.b;
    const base = Math.min(a, b, 0);

    // Rebase numbers to handle negatives
    a -= base;
    b -= base;

    // Reset ratios to 50% to handle case of all 0s
    if (a + b === 0) {
        a = 1;
        b = 1;
    }

    const ratio = 100 * (a / (a + b)); // Get ratio as a percentage
    data.ratio = `${ratio.toFixed(1)}%`;

    return data;
}

/**
 * Convert a document to a format able to be used by the configured list
 * @param doc   The original document. This is not garunteed to be unchanged.
 * @returns     The converted document. This may be the original document.
 */
export function convert(doc: Record<string, any>): Record<string, any> {
    const when = new Date(doc.lastModified);
    const useDate = when.toDateString() !== new Date().toDateString(); // Use date if on *different* days; Otherwise default to time.

    const aScore = doc.data.a ?? 1;
    const bScore = doc.data.b ?? 1;

    // Account for negative scores
    const base = Math.min(aScore, bScore, 0);
    let aScoreAdj = aScore - base;
    let bScoreAdj = bScore - base;

    // if 0 points on either side, push to 1 to make graph look even
    if (aScoreAdj + bScoreAdj === 0) {
        aScoreAdj = 1;
        bScoreAdj = 1;
    }

    return {
        ...doc,
        cpt: {
            progress: aScoreAdj / (aScoreAdj + bScoreAdj),
            lastModified: useDate
                ? when.toLocaleDateString()
                : when.toLocaleTimeString(),
        },
    };
}

var countA = 0;
var countB = 0;

/**
 * Initialize all HTML/resources for the 'new' page.
 * Assumes the page has already loaded in.
 */
export function new_main() {
    document
        .getElementById("increment-left")!
        .addEventListener("click", updateCount.bind(null, 1, 0));
    document
        .getElementById("decrement-left")!
        .addEventListener("click", updateCount.bind(null, -1, 0));
    document
        .getElementById("increment-right")!
        .addEventListener("click", updateCount.bind(null, 0, 1));
    document
        .getElementById("decrement-right")!
        .addEventListener("click", updateCount.bind(null, 0, -1));
    document
        .getElementById("note-count-value")!
        .addEventListener("click", submitCount);
    countA = 0;
    countB = 0;
}

/**
 * Release all used resources for the 'new' page
 */
export function new_unload() {}

let loading = false;
function updateCount(deltaA: number, deltaB: number) {
    countA += deltaA;
    countB += deltaB;

    const output = document.getElementById("note-count-value")!;

    // Update the value element
    output.textContent = `${countA} : ${countB}`;

    // Don't allow zero-counts
    output.classList.toggle("note-disabled", countA === 0 && countB === 0);
}

function submitCount() {
    if ((countA === 0 && countB === 0) || loading) return; // Ignore if count is 0 or loading...

    loading = true;
    note({
        a: countA,
        b: countB,
    })
        .catch((err) => {
            // Ignore errors, and act like they never happened!
            console.error(err);
        })
        .finally(() => {
            const cat = new URLSearchParams(location.search).get("cat");
            loading = false;

            if (cat === null) loadPage("/");
            else loadPage(`/category?id=${encodeURIComponent(cat)}`);
        });
}
