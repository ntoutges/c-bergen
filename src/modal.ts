import "../styles/modal.css";

/**
 * Confirm the deltion of some item 'name'.
 * @param element
 * @param name
 * @param confirm   The word that needs to be typed by the user to confirm deletion. If not given, this matches `name`
 * @returns A promise that resolves on confirmation, or rejects on cancelation.
 */
export function confirmDelete(
    element: HTMLElement,
    name: string,
    confirm?: string
): Promise<void> {
    const nameDisplay = element.querySelector<HTMLElement>(".modal-name");
    const nameInput = element.querySelector<HTMLInputElement>(".modal-input");
    const confirmButton =
        element.querySelector<HTMLElement>(".modal-btn-delete");
    const cancelButton =
        element.querySelector<HTMLElement>(".modal-btn-cancel");

    // Update modal info
    if (nameDisplay) nameDisplay.textContent = name;
    if (nameInput) {
        nameInput.value = "";
        nameInput.placeholder = confirm ?? name;
        nameInput.focus();
    }

    // Display the modal
    element.classList.remove("modal-hidden");

    let resolve!: () => void;
    let reject!: () => void;

    const reset = () => {
        element.removeEventListener("click", sCancel);
        confirmButton?.removeEventListener("click", confirmfn);
        cancelButton?.removeEventListener("click", cancel);
        nameInput?.removeEventListener("input", input);
        element.classList.add("modal-hidden");
    };

    const confirmfn = () => {
        reset();
        resolve();
    };

    const cancel = () => {
        reset();
        reject();
    };

    const sCancel = (event: Event) => {
        if (event.target === element)
            // Only accept clicks directly on the original element
            cancel();
    };

    const input = () => {
        const value = nameInput!.value;
        confirmButton?.classList?.toggle(
            "modal-enabled",
            value === (confirm ?? name)
        );
    };

    return new Promise((res, rej) => {
        resolve = res;
        reject = rej;

        element.addEventListener("click", sCancel);
        confirmButton?.addEventListener("click", confirmfn);
        cancelButton?.addEventListener("click", cancel);
        nameInput?.addEventListener("input", input);
    });
}
