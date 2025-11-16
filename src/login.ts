import "../styles/auth.css";

import { auth } from "./fb.js";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";

import { bind, loadPage } from "./spa.js";
const spa = bind("/login");
spa.onPageLoad(main);
spa.onPageUnload(unload);

let unsubscribe: (() => void) | null = null;

function main() {
    document.getElementById("auth-login")!.addEventListener("submit", login);

    unsubscribe = onAuthStateChanged(auth, (user) => {
        // User logged in; Kick them back to the main page!
        if (user) loadPage("/");
    });
}

function unload() {
    unsubscribe?.();
}

function login(e: Event) {
    if (!(e.target instanceof HTMLFormElement)) return; // Invalid element
    e.preventDefault(); // Prevent form from reloading

    const data = new FormData(e.target);

    const email = data.get("email") as string;
    const password = data.get("password") as string;

    // Clear the previous error
    const errorEl = document.querySelector<HTMLElement>(".auth-error")!;
    errorEl.innerText = "";

    // Preflight check: email must exist
    if (!email.trim()) {
        errorEl.innerText = "Please provide a valid email.";
        return;
    }

    // Preflight check: password must exist
    if (!email.trim()) {
        errorEl.innerText = "Please provide a valid password.";
        return;
    }

    signInWithEmailAndPassword(auth, email, password).catch((err) => {
        let message = err.message;

        // Pretty up standard error(s)
        switch (err.code) {
            case "auth/invalid-credential":
                message = "Invalid Credentials";
                break;
        }

        // Display the error
        errorEl.innerText = message;
    });
}
