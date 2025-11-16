type RouteEntry = Record<string, string>;
const routes = new Map<string, RouteEntry>();

// Intercept click events on links
document.addEventListener(
    "click",
    (event) => {
        // User didn't click on a link
        if (!(event.target instanceof HTMLElement)) return;

        const anchor = event.target.matches("a")
            ? (event.target as HTMLAnchorElement)
            : (event.target.closest("a") as HTMLAnchorElement | null);
        if (!anchor) return; // No anchor tag available

        // Stop link from actually making redirect
        event.preventDefault();

        const href = anchor.getAttribute("href") || "/";
        loadPage(href);
    },
    true
);

var currRoute: string = "";

/**
 * Load some page given its route
 * @param url
 * @param doPush
 */
export async function loadPage(
    url: string,
    mode: "initial" | "push" | "none" = "push"
) {
    const queryStart = url.indexOf("?");
    const path = queryStart == -1 ? url : url.substring(0, queryStart);

    const routeData = getRouteEntry(path);

    if (!routeData) {
        console.error(`Unable to load route ${url}`);
        return;
    }

    // Load in all data
    const fetched = new Map();
    const promises: Promise<any>[] = [];
    for (let selector in routeData.entry) {
        const loadURL = routeData.entry[selector];

        promises.push(
            fetch(loadURL)
                .then((res) => res.text())
                .then((data) => fetched.set(selector, data))
                .catch((err) => console.error(err))
        );
    }

    // Wait for all data to be fetched
    await Promise.all(promises);

    for (let selector in routeData.entry) {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`Could not find element ${selector}`);
            continue;
        }

        element.innerHTML = fetched.get(selector)!;
    }

    // Push current state to history
    switch (mode) {
        case "push":
            history.pushState({ isLocal: true, path: url }, "", url);
            break;
        case "initial":
            history.replaceState({ isLocal: true, path: url }, "", url);
            break;
    }

    for (const cb of pageListeners) {
        cb(routeData.candidate, currRoute, routeData.replacements);
    }
    currRoute = routeData.candidate;
}

/**
 * Convert a route path to its entry.
 * @param route The route to retreive
 * @returns     The route entry associated with the route. Null if no entry found.
 */
function getRouteEntry(route: string): {
    entry: RouteEntry;
    replacements: Record<string, string>;
    candidate: string;
} | null {
    // Route directly found
    if (routes.has(route)) {
        return {
            entry: routes.get(route)!,
            replacements: {},
            candidate: route,
        };
    }

    const subroutes = route.split("/");

    // Attempt to find substitutions
    let subMatch: {
        key: string;
        replacements: Record<string, string>;
        prioritize: boolean;
    } | null = null;
    for (const candidate of routes.keys()) {
        const parts = candidate.split("/");

        // Candidate has too many parts to match subroute
        if (parts.length > subroutes.length) continue;

        const replacements: Record<string, string> = {};
        let prioritize = true;

        // Check each part individually
        let i = 0;
        for (; i < parts.length; i++) {
            const part = parts[i];
            const multicard = part.match(/^\{(.*?)\s*=\s*\*\*\}/);

            // Wildcard able to consume up any amount of subroutes
            if (multicard) {
                // Not at the end; Warn + ignore
                if (i !== parts.length - 1) {
                    console.warn(
                        `Invalid multiwildcard entry in \"${candidate}\": \"${part}\"; Must be the last part`
                    );
                    break;
                }

                // Store all other replacements
                replacements[multicard[1]] = subroutes.slice(i).join("/");
                prioritize = false; // Indicate a lower priority due to more general match
                i = subroutes.length;
                break;
            }

            const wildcard = part.match(/^\{\s*(.*?)\s*\}/);
            if (wildcard) {
                // Store this replacement
                replacements[wildcard[1]] = subroutes[i];
                continue;
            }

            // Ensure exact match
            if (part !== subroutes[i]) break;
        }

        // Invalid; Not enough matches
        if (i !== subroutes.length) continue;

        // Found some match; Check if better than the current best match

        // If no previous match, automatically accept
        if (subMatch) {
            // Same priority; Break tie with # of replacements
            if (subMatch.prioritize == prioritize) {
                // Prioritize lower # of replacements
                // After that, prioritize more-"recent" candidates
                if (
                    Object.keys(subMatch.replacements) <=
                    Object.keys(replacements)
                ) {
                    continue;
                }
            }

            // Current has a worse priority; Ignore
            else if (subMatch.prioritize && !prioritize) continue;
        }

        // Our priority is better than the current!
        subMatch = {
            key: candidate,
            prioritize: prioritize,
            replacements: replacements,
        };
    }

    // No match found...
    if (subMatch === null) return null;

    return {
        entry: routes.get(subMatch.key)!,
        replacements: subMatch.replacements,
        candidate: subMatch.key,
    };
}

window.addEventListener("popstate", (event) => {
    if (!event.state?.isLocal) return;

    // Load route
    const path = event.state.path || "/";
    loadPage(path, "none");
});

/**
 * Get the route information used to redirect requests
 * @param _routes The routing table, in the form of { [route]: { [element]: [source] } }\
 * Used to load new pages
 */
function setup(_routes: Record<string, RouteEntry>, initialRoute: string = "") {
    // Copy the given data into the globally registered routing table
    for (const route in _routes) {
        routes.set(route, _routes[route]);
    }

    if (initialRoute) {
        loadPage(initialRoute, "initial");
    }
}

const pageListeners: Array<
    (to: string, from: string, replacements: Record<string, string>) => void
> = [];
function onPageChange(
    cb: (to: string, from: string, replacements: Record<string, string>) => void
) {
    pageListeners.push(cb);
}

// Helper functions to make development easier
/**
 * Call some callback whenever a page is loaded
 * @param page
 * @param cb
 */
function onPageLoad(
    page: string,
    cb: (replacements: Record<string, string>) => void
) {
    onPageChange((to, _, replacements) => {
        if (to == page) cb(replacements);
    });
}

/**
 * Call some callback whenever a page is unloaded
 * @param page
 * @param cb
 */
function onPageUnload(
    page: string,
    cb: (replacements: Record<string, string>) => void
) {
    onPageChange((_, from, replacements) => {
        if (from == page) cb(replacements);
    });
}

// Create an interface that is bound to some specific route
class SPABind {
    private readonly route;

    constructor(route: string) {
        this.route = route;
    }

    onPageLoad(cb: (replacements: Record<string, string>) => void) {
        onPageLoad(this.route, cb);
    }

    onPageUnload(cb: (replacements: Record<string, string>) => void) {
        onPageUnload(this.route, cb);
    }
}

export const bind = (route: string) => new SPABind(route);

export default {
    setup,
    onPageChange,
    onPageLoad,
    onPageUnload,
};
