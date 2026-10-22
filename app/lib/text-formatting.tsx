import React from "react";

function parseInlineHighlights(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match <mark>...</mark>, **...**, or ==...==
  const regex = /(<mark>[\s\S]*?<\/mark>|\*\*[\s\S]*?\*\*|==[\s\S]*?==)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("<mark>") && part.endsWith("</mark>")) {
      const content = part.slice(6, -7);
      return (
        <mark key={index} className="desc-highlight-tag">
          {content}
        </mark>
      );
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const content = part.slice(2, -2);
      return (
        <mark key={index} className="desc-highlight-tag">
          {content}
        </mark>
      );
    }

    if (part.startsWith("==") && part.endsWith("==") && part.length >= 4) {
      const content = part.slice(2, -2);
      return (
        <mark key={index} className="desc-highlight-tag">
          {content}
        </mark>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function FormattedDescription({
  text,
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <span className={`formatted-description-wrapper ${className}`.trim()}>
      {lines.map((line, idx) => {
        const isBullet =
          line.startsWith("•") ||
          line.startsWith("- ") ||
          line.startsWith("* ");
        const cleanText = isBullet ? line.replace(/^[•\-*]\s*/, "") : line;
        const formattedNodes = parseInlineHighlights(cleanText);

        if (isBullet) {
          return (
            <span key={idx} className="desc-bullet-line">
              <span className="desc-bullet-dot">•</span>
              <span className="desc-bullet-body">{formattedNodes}</span>
            </span>
          );
        }

        return (
          <span key={idx} className="desc-text-line">
            {formattedNodes}
          </span>
        );
      })}
    </span>
  );
}
