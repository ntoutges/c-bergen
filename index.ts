import spa from "./src/spa.js";

// Import all pages
import "./src/main.js";
import "./src/category.js";
import "./src/login.js";
import "./src/signup.js";
import "./src/forgot.js";
import "./src/new.js";

// Import styles
import "./styles/header.css";
import "./styles/list.css";

// Setup spa
import routes from "./data/routes.json";
spa.setup(routes, `${window.location.pathname}${window.location.search}`);

// Setup logout button
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./src/fb.js";
document.getElementById("ctx-logout")!.addEventListener("click", () => {
    signOut(auth);
});

// Manage login/logout buttons based on current auth state
onAuthStateChanged(auth, (user) => {
    document
        .getElementById("ctx-login")!
        .classList.toggle("-ctx-hidden", !!user);
    document
        .getElementById("ctx-logout")!
        .classList.toggle("-ctx-hidden", !user);
});
