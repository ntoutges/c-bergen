import "../styles/auth.css";

import { auth } from "./fb.js";
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
} from "firebase/auth";

import { bind, loadPage } from "./spa.js";
const spa = bind("/signup");
spa.onPageLoad(main);
spa.onPageUnload(unload);

let unsubscribe: (() => void) | null = null;

function main() {
    document.getElementById("auth-signup")!.addEventListener("submit", signup);

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
    const password = data.get("password") as string;
    const confirm = data.get("confirm") as string;

    // Clear the previous error
    const errorEl = document.querySelector<HTMLElement>(".auth-error")!;
    errorEl.innerText = "";

    // Preflight check: Password/confirm must match
    if (password !== confirm) {
        errorEl.textContent = "Passwords don't match!";
        return;
    }

    createUserWithEmailAndPassword(auth, email, password)
        .then(() => {})
        .catch((err) => {
            let message = err.message;

            // Pretty up standard error(s)
            switch (err.code) {
                case "auth/email-already-in-use":
                    message = "An account with that email already exists!";
                    break;
            }

            errorEl.innerText = message;
        });
}
