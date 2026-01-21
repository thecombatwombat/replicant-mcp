export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface AccessibilityNode {
  index: number;
  text: string;
  resourceId: string;
  className: string;
  contentDesc: string;
  bounds: Bounds;
  centerX: number;
  centerY: number;
  clickable: boolean;
  focusable: boolean;
  children?: AccessibilityNode[];
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+(?:-\w+)?)="([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(attrStr)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parseBounds(boundsStr: string): Bounds {
  const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return { left: 0, top: 0, right: 0, bottom: 0 };
  return {
    left: parseInt(match[1], 10),
    top: parseInt(match[2], 10),
    right: parseInt(match[3], 10),
    bottom: parseInt(match[4], 10),
  };
}

function parseNodeFromAttrs(attrs: Record<string, string>): AccessibilityNode {
  const bounds = parseBounds(attrs.bounds || "[0,0][0,0]");

  return {
    index: parseInt(attrs.index || "0", 10),
    text: attrs.text || "",
    resourceId: attrs["resource-id"] || "",
    className: attrs.class || "",
    contentDesc: attrs["content-desc"] || "",
    bounds,
    centerX: Math.round((bounds.left + bounds.right) / 2),
    centerY: Math.round((bounds.top + bounds.bottom) / 2),
    clickable: attrs.clickable === "true",
    focusable: attrs.focusable === "true",
  };
}

export function parseUiDump(xml: string): AccessibilityNode[] {
  const nodes: AccessibilityNode[] = [];

  // Find all node elements and build tree structure
  // Using a simple recursive parser
  function parseChildren(content: string): AccessibilityNode[] {
    const children: AccessibilityNode[] = [];

    // Match top-level node elements only
    let depth = 0;
    let nodeStart = -1;
    let i = 0;

    while (i < content.length) {
      // Check for node opening tag
      if (content.slice(i, i + 5) === "<node") {
        if (depth === 0) {
          nodeStart = i;
        }
        depth++;
        // Skip to end of opening tag
        const tagEnd = content.indexOf(">", i);
        if (tagEnd === -1) break;

        // Check if self-closing
        if (content[tagEnd - 1] === "/") {
          depth--;
          if (depth === 0 && nodeStart !== -1) {
            const nodeXml = content.slice(nodeStart, tagEnd + 1);
            const attrMatch = nodeXml.match(/<node\s+([^>]*)/);
            if (attrMatch) {
              const node = parseNodeFromAttrs(parseAttributes(attrMatch[1]));
              children.push(node);
            }
            nodeStart = -1;
          }
        }
        i = tagEnd + 1;
        continue;
      }

      // Check for closing tag
      if (content.slice(i, i + 7) === "</node>") {
        depth--;
        if (depth === 0 && nodeStart !== -1) {
          const nodeXml = content.slice(nodeStart, i + 7);

          // Parse this node's attributes
          const attrMatch = nodeXml.match(/<node\s+([^>]*)>/);
          if (attrMatch) {
            const node = parseNodeFromAttrs(parseAttributes(attrMatch[1]));

            // Parse children recursively
            const innerStart = nodeXml.indexOf(">") + 1;
            const innerEnd = nodeXml.lastIndexOf("</node>");
            if (innerEnd > innerStart) {
              const innerContent = nodeXml.slice(innerStart, innerEnd);
              const childNodes = parseChildren(innerContent);
              if (childNodes.length > 0) {
                node.children = childNodes;
              }
            }
            children.push(node);
          }
          nodeStart = -1;
        }
        i += 7;
        continue;
      }

      i++;
    }

    return children;
  }

  // Extract hierarchy content
  const hierarchyMatch = xml.match(/<hierarchy[^>]*>([\s\S]*)<\/hierarchy>/);
  if (hierarchyMatch) {
    return parseChildren(hierarchyMatch[1]);
  }

  return nodes;
}

export function flattenTree(nodes: AccessibilityNode[]): AccessibilityNode[] {
  const flat: AccessibilityNode[] = [];

  function walk(node: AccessibilityNode) {
    flat.push(node);
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const node of nodes) {
    walk(node);
  }

  return flat;
}

export function findElements(
  nodes: AccessibilityNode[],
  selector: {
    resourceId?: string;
    text?: string;
    textContains?: string;
    className?: string;
  }
): AccessibilityNode[] {
  const flat = flattenTree(nodes);

  return flat.filter((node) => {
    if (selector.resourceId && !node.resourceId.includes(selector.resourceId)) {
      return false;
    }
    if (selector.text && node.text !== selector.text) {
      return false;
    }
    if (selector.textContains && !node.text.includes(selector.textContains)) {
      return false;
    }
    if (selector.className && !node.className.includes(selector.className)) {
      return false;
    }
    return true;
  });
}
