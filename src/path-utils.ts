import { SegmentDescriptor } from "./types.js";

const DYNAMIC_SEGMENT_RE = /^\[([A-Za-z0-9_]+)\]$/;
const CATCH_ALL_SEGMENT_RE = /^\[\.\.\.([A-Za-z0-9_]+)\]$/;

export function parseSegment(raw: string): SegmentDescriptor {
  const catchAllMatch = raw.match(CATCH_ALL_SEGMENT_RE);
  if (catchAllMatch) {
    return {
      raw,
      kind: "catch-all",
      paramName: catchAllMatch[1]
    };
  }

  const dynamicMatch = raw.match(DYNAMIC_SEGMENT_RE);
  if (dynamicMatch) {
    return {
      raw,
      kind: "dynamic",
      paramName: dynamicMatch[1]
    };
  }

  return {
    raw,
    kind: "static"
  };
}

export function toLogicalPath(segments: SegmentDescriptor[], rootLogicalPath: string): string {
  if (segments.length === 0) {
    return rootLogicalPath;
  }

  return segments
    .map((segment) => {
      if (segment.kind === "dynamic" && segment.paramName) {
        return `:${segment.paramName}`;
      }

      if (segment.kind === "catch-all" && segment.paramName) {
        return `*${segment.paramName}`;
      }

      return segment.raw;
    })
    .join(".");
}

export function toRoutePattern(segments: SegmentDescriptor[]): string {
  if (segments.length === 0) {
    return "/";
  }

  return `/${segments
    .map((segment) => {
      if (segment.kind === "dynamic" && segment.paramName) {
        return `:${segment.paramName}`;
      }

      if (segment.kind === "catch-all" && segment.paramName) {
        return `*${segment.paramName}`;
      }

      return segment.raw;
    })
    .join("/")}`;
}

export function toToolName(segment: SegmentDescriptor): string {
  if (segment.kind === "dynamic" && segment.paramName) {
    return `by_${segment.paramName}`;
  }

  if (segment.kind === "catch-all" && segment.paramName) {
    return `all_${segment.paramName}`;
  }

  return segment.raw.replace(/[^A-Za-z0-9_]/g, "_");
}
