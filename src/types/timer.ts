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
