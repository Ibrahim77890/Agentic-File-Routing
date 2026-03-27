type RouterRequest = {
  userInput: string;
  availableChildren: string[];
};

const INCIDENT_HINTS = [
  "incident",
  "outage",
  "downtime",
  "latency",
  "alert",
  "sev",
  "urgent",
  "degraded"
];

export function route(request: RouterRequest) {
  const text = request.userInput.toLowerCase();
  const incidentChild = request.availableChildren.find((child) => child.endsWith("incident"));

  if (incidentChild) {
    const hasIncidentIntent = INCIDENT_HINTS.some((term) => text.includes(term));
    if (hasIncidentIntent) {
      return {
        targetPath: incidentChild,
        metadata: {
          router: "devops/router.ts",
          strategy: "incident-keyword-match"
        }
      };
    }
  }

  const fallbackChild = request.availableChildren[0];
  if (!fallbackChild) {
    return null;
  }

  return {
    targetPath: fallbackChild,
    metadata: {
      router: "devops/router.ts",
      strategy: "fallback-first-child"
    }
  };
}

export default route;
