import { List } from "../list";
import { Ribbon } from "../ribbon.js";

import {
    collection,
    count,
    getAggregateFromServer,
    sum,
} from "firebase/firestore";
import { firestore } from "../fb";

import list from "../../data/lists/timer.json";
import ribbon from "../../data/ribbons/timer.json";

import _page from "../../public/pages/types/timer.html?raw";
import { note } from "../note";
import { loadPage } from "../spa";
export const page = _page;

/**
 * Generic function used to determine the shape of the ribbon and list
 */
export function setup(): {
    ribbon: ConstructorParameters<typeof Ribbon>[1];
    list: ConstructorParameters<typeof List>[1];
} {
    return {
        ribbon,
        list,
    };
}

export function applyPlugins(list: List, ribbon: Ribbon): void {}

/**
 * Generic function used to fill in the created ribbon
 * @param col   The string referring to the collection to read.
 */
export async function aggregate(col: string): Promise<any> {
    const data = {
        total: 0,
        events: 0,
        average: "0.00",
        duration: "0.00",
    };

    const c = collection(firestore, col);

    await Promise.all([
        // Get total
        getAggregateFromServer(c, {
            events: count(),
            duration: sum("data"),
        }).then((aggr) => {
            const d = aggr.data();
            data.events = d.events;
            data.total = d.duration / (1000 * 60 * 60); // Convert from ms to hours
        }),
    ]);

    if (data.events !== 0) {
        data.average = (data.total / data.events).toFixed(2);
    }

    data.duration = data.total.toFixed(2);

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

    return {
        ...doc,
        cpt: {
            duration: getTimeString(doc.data),
            lastModified: useDate
                ? when.toLocaleDateString()
                : when.toLocaleTimeString(),
        },
    };
}

function getTimeString(time: number) {
    if (time < 1000) return `${Math.round(time)} ms`;
    if (time < 1000 * 60) return `${Math.round(time / 1000)} s`;
    if (time < 1000 * 60 * 60) return `${Math.round(time / (1000 * 60))} min`;
    if (time < 1000 * 60 * 60 * 24)
        return `${Math.round(time / (1000 * 60 * 60))} hr`;
    return `${Math.round(time / (1000 * 60 * 60))} d`; // Fallback to days
}

let timeStart: number | null = null;
let timeStop: number | null = null;
let running = false;
let loading = false;

/**
 * Initialize all HTML/resources for the 'new' page.
 * Assumes the page has already loaded in.
 */
export function new_main() {
    document
        .getElementById("note-timer-toggle")!
        .addEventListener("click", toggleTimer.bind(null, null));
    document
        .getElementById("note-timer-reset")!
        .addEventListener("click", resetTimer);
    document
        .getElementById("note-timer-display")!
        .addEventListener("click", submitTimer);

    timeStart = null;
    timeStop = null;
    running = false;
}

/**
 * Release all used resources for the 'new' page
 */
export function new_unload() {}

function toggleTimer(force: boolean | null) {
    running = force === null ? !running : force;

    // Start timer
    if (running && timeStart === null) {
        timeStart = new Date().getTime();
    }

    // Update button icon
    document.getElementById("note-timer-toggle-txt")!.textContent = running
        ? "pause"
        : "play_arrow";

    const timerEl = document.getElementById("note-timer-display")!;

    // Reset timer to default display
    if (timeStart === null) {
        timerEl.textContent = "00:00.0";
        timerEl.classList.add("note-disabled");
    } else timerEl.classList.remove("note-disabled");

    // Keep track of when paused
    timeStop = running ? null : new Date().getTime();

    // Start animation loop
    updateTimerDisplay();
}

function resetTimer() {
    timeStart = null;

    // Reset timer
    toggleTimer(false);
}

function updateTimerDisplay() {
    if (!timeStart || !running) return; // Invalid state; Stop looping
    requestAnimationFrame(updateTimerDisplay);

    const now = new Date().getTime();
    const delta = now - timeStart;

    const hours = Math.floor(delta / 3600000);
    const minutes = Math.floor(delta / 60000) % 60;
    const seconds = Math.floor(delta / 1000) % 60;
    const ds = Math.floor(delta / 100) % 10; // Deciseconds (10th of a second)

    const minStr = minutes.toString().padStart(2, "0");
    const secStr = seconds.toString().padStart(2, "0");
    const dsStr = ds.toString().padStart(1, "0");

    let output: string = "";
    if (hours === 0) {
        if (minutes === 0) {
            if (seconds !== 0 || ds !== 0) {
                // Display just seconds + ds
                output = `${seconds}.${dsStr}`;
            }
        } else {
            output = `${hours}:${minStr}:${secStr}`;
        }
    }

    // Default display
    if (output === "") {
        output = `${minStr}:${secStr}.${dsStr}`;
    }

    document.getElementById("note-timer-display")!.textContent = output;
}

function submitTimer() {
    // Solidify stop time
    if (running) toggleTimer(false);

    if (!timeStart || !timeStop) return;

    const delta = timeStop - timeStart;
    loading = true;
    note(delta)
        .catch((err) => console.error(err))
        .finally(() => {
            const cat = new URLSearchParams(location.search).get("cat");
            loading = false;

            if (cat === null) loadPage("/");
            else loadPage(`/category?id=${encodeURIComponent(cat)}`);
        });
}
