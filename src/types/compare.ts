import { List } from "../list";
import { Ribbon } from "../ribbon.js";

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
    return {};
}

/**
 * Convert a document to a format able to be used by the configured list
 * @param doc   The original document. This is not garunteed to be unchanged.
 * @returns     The converted document. This may be the original document.
 */
export function convert(doc: Record<string, any>): Record<string, any> {
    return doc;
}
