// Traverse through all notes and attempt to change data from strings to numbers
const firebase = require("firebase-admin");
require("dotenv").config();

const dry = process.argv.includes("--dry"); // Print actions, but _don't_ execute

async function main() {
    // Initialize app
    const app = firebase.initializeApp({
        credential: firebase.credential.applicationDefault(),
    });
    const db = firebase.firestore(app);

    // Get all available categories
    const categories = await db.collection("categories").listDocuments();

    // For each category, get all available events
    for (const category of categories) {
        const name = atob(category.id);
        const type = (await category.get()).data()?.metadata?.type;

        if (!type || !["counter", "timer", "compare"].includes(type)) {
            console.warn(
                `Unrecognized type \"${type}\" in document \"${name}\" (${btoa(name)})... Skipping!`,
            );
            continue;
        }

        console.log(`======== Processing ${name} ========`);

        // Fetch all events in a category
        const col = category.collection("events");
        const events = (await col.get()).docs;

        // Map from doc id to old => new `data` value
        const changes = new Map();

        for (const event of events) {
            let value = null;
            const data = event.data().data;

            switch (type) {
                case "counter": // Expected format: { data: number }
                case "timer": // Expected format: { data: number }
                    if (validNumeric(data)) break; // Good data!

                    value = +(data ?? 0);

                    // Ensure stored data is valid
                    if (!validNumeric(value)) value = 0;
                    break;
                case "compare": // Expected format: { data: { a: number, b: number } }
                    if (
                        data &&
                        typeof data === "object" &&
                        validNumeric(data.a) &&
                        validNumeric(data.b)
                    )
                        break; // Good data!

                    // Restore to known good value
                    value = {
                        a: +(data?.a ?? 0),
                        b: +(data?.b ?? 0),
                    };

                    // Ensure all numbers are valied
                    if (!validNumeric(value.a)) value.a = 0;
                    if (!validNumeric(value.b)) value.b = 0;
                    break;
            }

            // Push to be committed
            if (value !== null) changes.set(event.id, [data, value]);
        }

        // Commit all changes in bulk
        const batch = dry ? null : db.batch(); // Don't even create batch if dry run
        for (const [id, [oldData, newData]] of changes.entries()) {
            console.log(
                `  ${id} : ${JSON.stringify(oldData)} => ${JSON.stringify(newData)}`,
            );
            batch?.update(col.doc(id), "data", newData);
        }
        batch?.commit();

        if (changes.size === 0) {
            console.log("  [ Nothing to commit ]");
        }
    }
}

function validNumeric(num) {
    return typeof num === "number" && isFinite(num) && !isNaN(num);
}

main();
