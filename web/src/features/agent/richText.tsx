import type { ReactNode } from "react";

/** Splits "a **b** c" into plain and bold segments. Odd segments are the bold ones. */
export function splitBold(text: string): Array<{ text: string; bold: boolean }> {
  return text
    .split("**")
    .map((segment, index) => ({ text: segment, bold: index % 2 === 1 }))
    .filter((segment) => segment.text !== "");
}

function normalizeBullets(line: string): string {
  return line.replace(/^(\s*)[*-]\s+/, "$1• ");
}

/**
 * Renders the small amount of Markdown a model tends to emit (bold, bullets) as React nodes.
 * Never uses innerHTML, so model output cannot inject markup.
 */
export function RichText({ text }: { text: string }): ReactNode {
  const hasBalancedBold = (text.split("**").length - 1) % 2 === 0;
  const lines = text.split("\n").map(normalizeBullets).join("\n");
  if (!hasBalancedBold) {
    return lines;
  }
  return splitBold(lines).map((segment, index) =>
    segment.bold ? (
      <strong key={index} className="font-semibold">
        {segment.text}
      </strong>
    ) : (
      <span key={index}>{segment.text}</span>
    ),
  );
}
