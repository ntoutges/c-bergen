import "../styles/auth.css";

import { auth } from "./fb.js";
import { sendPasswordResetEmail, onAuthStateChanged } from "firebase/auth";

import { bind, loadPage } from "./spa.js";
const spa = bind("/forgot-password");
spa.onPageLoad(main);
spa.onPageUnload(unload);

let unsubscribe: (() => void) | null = null;

function main() {
    document.getElementById("auth-forgot")!.addEventListener("submit", signup);

    unsubscribe = onAuthStateChanged(auth, (user) => {
        // User logged in; Kick them back to the main page!
        if (user) loadPage("/");
    });
}

function unload() {
    unsubscribe?.();
}

function signup(e: Event) {
    if (!(e.target instanceof HTMLFormElement)) return; // Invalid element
    e.preventDefault(); // Prevent form from reloading

    const data = new FormData(e.target);

    const email = data.get("email") as string;

    // Clear the previous error
    const errorEl = document.querySelector<HTMLElement>(".auth-error")!;
    errorEl.innerText = "";

    // Preflight check: email must exist
    if (!email.trim()) {
        errorEl.innerText = "Please provide a valid email.";
        return;
    }

    sendPasswordResetEmail(auth, email)
        .then(() => {})
        .catch((err) => {
            let message = err.message;

            // Pretty up standard error(s)
            switch (err.code) {
                case "auth/invalid-email":
                    message = "No accounts with that email exist!";
                    break;
            }

            errorEl.innerText = message;
        });
}
