import spa from "./src/spa.js";

const $ = document.querySelector.bind(document);

// Setup spa
import routes from "./data/routes.json";
spa.setup(routes, `${window.location.pathname}${window.location.search}`);
