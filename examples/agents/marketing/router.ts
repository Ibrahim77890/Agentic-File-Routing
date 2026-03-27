type RouterRequest = {
  userInput: string;
  availableChildren: string[];
};

const SEO_HINTS = [
  "seo",
  "search",
  "keyword",
  "rank",
  "ranking",
  "google",
  "meta",
  "backlink",
  "traffic"
];

export function route(request: RouterRequest) {
  const text = request.userInput.toLowerCase();
  const hasSeoIntent = SEO_HINTS.some((term) => text.includes(term));

  const preferredTarget = hasSeoIntent ? "marketing.seo" : "marketing.copywriting";

  if (request.availableChildren.includes(preferredTarget)) {
    return {
      targetPath: preferredTarget,
      metadata: {
        router: "marketing/router.ts",
        strategy: hasSeoIntent ? "seo-keyword-match" : "default-copywriting"
      }
    };
  }

  const fallbackChild = request.availableChildren[0];
  if (!fallbackChild) {
    return null;
  }

  return {
    targetPath: fallbackChild,
    metadata: {
      router: "marketing/router.ts",
      strategy: "fallback-first-child"
    }
  };
}

export default route;
