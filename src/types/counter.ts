import { List } from "../list";
import { Ribbon } from "../ribbon.js";

import { firestore } from "../fb";
import {
    collection,
    getAggregateFromServer,
    query,
    sum,
    where,
} from "firebase/firestore";
import db from "../db";

import list from "../../data/lists/counter.json";
import ribbon from "../../data/ribbons/counter.json";

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
        week: 0,
        cpd: "0.00", // Counts per day

        duration: 0,
    };

    const c = collection(firestore, col);

    // 7 days ago (1 week)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    await Promise.all([
        // Get total
        getAggregateFromServer(c, {
            total: sum("data"),
        }).then((aggr) => (data.total = aggr.data().total)),

        // Get events in the last week
        getAggregateFromServer(
            query(c, where("lastModified", ">=", cutoffDate.getTime())),
            {
                total: sum("data"),
            }
        ).then((aggr) => (data.week = aggr.data().total)),

        // Get the earliest document for events/time
        db
            .getDocs(col, {
                limit: 1,
                reversed: true,
                field: "metadata.createdAt",
            })
            .then(
                (docs) =>
                    (data.duration = docs.length
                        ? new Date().getTime() - docs[0].metadata.createdAt
                        : 0)
            ),
    ]);

    // Convert duration from ms to days; Don't allow fractional days
    const days = Math.ceil(data.duration / (24 * 60 * 60 * 1000));
    if (days !== 0) data.cpd = (data.total / days).toFixed(2);

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
            count: doc.data < 0 ? doc.data : `+${doc.data}`, // Emphasize that this is a delta
            lastModified: useDate
                ? when.toLocaleDateString()
                : when.toLocaleTimeString(),
        },
    };
}
