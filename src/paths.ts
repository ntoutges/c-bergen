/**
 * Setup the path display
 * @param element   The container for the path display
 * @param parts     The parts to display, and the path to go to when clicked
 */
export function setPath(
    element: HTMLElement,
    parts: {
        component: string;
        path?: string;
    }[]
) {
    element.innerHTML = ""; // Clear the element

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Add in separator if not the first
        if (i !== 0) {
            const separator = document.createElement("span");
            separator.classList.add("material-symbols-outlined");
            separator.textContent = "arrow_right";
            element.append(separator);
        }

        const el = part.path
            ? document.createElement("a")
            : document.createElement("div");
        el.classList.add("route-part");
        el.textContent = part.component;
        if (part.path) el.setAttribute("href", part.path);

        element.append(el);
    }
}
