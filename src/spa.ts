type RouteEntry = Record<string, string>;
const routes = new Map<string, RouteEntry>();

// Intercept click events on links
document.addEventListener("click", (event) => {
    
    // User didn't click on a link
    if (!(event.target instanceof HTMLElement)) return;

    const anchor = event.target.matches("a") ? (event.target as HTMLAnchorElement) : (event.target.closest("a") as HTMLAnchorElement | null);
    if (!anchor) return; // No anchor tag available

    // Stop link from actually making redirect
    event.preventDefault();

    const href = anchor.getAttribute("href") || "/";
    loadPage(href);
}, true);

var currRoute: string = "";

/**
 * Load some page given its route
 * @param url
 * @param doPush
 */
export async function loadPage(url: string, mode: "initial" | "push" | "none" = "push") {
    const queryStart = url.indexOf("?");
    const path = (queryStart == -1) ? url : url.substring(0, queryStart);

    const routeData = routes.get(path) ?? null;

    if (!routeData) {
        console.error(`Unable to load route ${url}`);
        return;
    }

    // Load in all data
    const fetched = new Map();
    const promises: Promise<any>[] = [];
    for (let selector in routeData) {
        const loadURL = routeData[selector];

        promises.push(
            fetch(loadURL).then(res => res.text())
                .then(data => fetched.set(selector, data))
                .catch(err => console.error(err))
        );
    }

    // Wait for all data to be fetched
    await Promise.all(promises);

    for (let selector in routeData) {
        const element = document.querySelector(selector)
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
        cb(path, currRoute);
    }
    currRoute = path;
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

const pageListeners: Array<(to: string, from: string) => void> = [];
function onPageChange(cb: (to: string, from: string) => void) {
    pageListeners.push(cb);
}


// Helper functions to make development easier
/**
 * Call some callback whenever a page is loaded
 * @param page
 * @param cb 
 */
function onPageLoad(page: string, cb: () => void) {
    onPageChange((to) => {
        if (to == page) cb();
    });
}

/**
 * Call some callback whenever a page is unloaded
 * @param page 
 * @param cb 
 */
function onPageUnload(page: string, cb: () => void) {
    onPageChange((_, from) => {
        if (from == page) cb();
    });
}

// Create an interface that is bound to some specific route
class SPABind {
    private readonly route;

    constructor(route: string) {
        this.route = route;
    }

    onPageLoad(cb: () => void) {
        onPageLoad(this.route, cb);
    }

    onPageUnload(cb: () => void) {
        onPageUnload(this.route, cb);
    }
}

export const bind = (route: string) => new SPABind(route);

export default {
    setup,
    onPageChange,
    onPageLoad,
    onPageUnload
};