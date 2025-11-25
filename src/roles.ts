import { auth } from "./fb";

/**
 * Get the highest-ability role of all the documents passed in
 * @param doc
 * @returns The role, or 'null' if none assigned
 */
export function getRole(
    ...doc: Record<string, any>[]
): "write" | "admin" | null {
    // Update permissions based on the logged in user
    if (!auth.currentUser) {
        return null;
    }
    const maintainers = doc.map((d) =>
        d.maintainers && typeof d.maintainers === "object" ? d.maintainers : {}
    );

    const user = auth.currentUser.email!;

    if (maintainers.some((m) => m[user] === "admin")) return "admin";
    if (maintainers.some((m) => m[user] === "write")) return "write";

    // No known roles found
    return null;
}
