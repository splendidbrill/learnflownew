/**
 * Utility function to merge class names
 */
export function cn(...classes: Array<string | undefined | null | false>): string {
    return (
      classes
        .filter((cls): cls is string => Boolean(cls && typeof cls === "string"))
        .join(" ")
        .trim() || ""
    );
  }
  