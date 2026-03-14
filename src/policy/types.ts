import type { ExecutionContext } from "../executor/session.js";

export interface PolicyDefinition {
  name: string;
  description: string;
  rules: PolicyRule[];
  config?: Record<string, unknown>;
}

export interface PolicyRule {
  action: string;
  resource: string;
  effect: "allow" | "deny";
  conditions?: Record<string, unknown>;
}

export interface PolicyContext {
  agentPath: string;
  depth: number;
  userId?: string;
  tenantId?: string;
  roles?: string[];
  tags?: string[];
}

export interface PolicyCheckRequest {
  action: string;
  resource: string;
  context: PolicyContext;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  policy?: string;
}

export interface PolicyEnforcer {
  check(request: PolicyCheckRequest): Promise<PolicyCheckResult>;
  enforce(request: PolicyCheckRequest): Promise<void>;
}

export class DefaultPolicyEnforcer implements PolicyEnforcer {
  private policies: Map<string, PolicyDefinition>;

  constructor(policies: PolicyDefinition[] = []) {
    this.policies = new Map();
    policies.forEach(p => this.policies.set(p.name, p));
  }

  addPolicy(policy: PolicyDefinition): void {
    this.policies.set(policy.name, policy);
  }

  async check(request: PolicyCheckRequest): Promise<PolicyCheckResult> {
    for (const [policyName, policy] of this.policies) {
      for (const rule of policy.rules) {
        if (this.ruleMatches(rule, request)) {
          if (rule.effect === "deny") {
            return {
              allowed: false,
              reason: `Denied by policy: ${policyName}`,
              policy: policyName
            };
          }
        }
      }
    }

    return { allowed: true };
  }

  async enforce(request: PolicyCheckRequest): Promise<void> {
    const result = await this.check(request);
    if (!result.allowed) {
      throw new Error(result.reason || "Policy check failed");
    }
  }

  private ruleMatches(rule: PolicyRule, request: PolicyCheckRequest): boolean {
    return rule.action === request.action;
  }
}

export function createPolicyContextFromExecutionContext(
  ctx: ExecutionContext
): PolicyContext {
  return {
    agentPath: ctx.currentPath,
    depth: ctx.depth,
    userId: ctx.globalContext.userId as string | undefined,
    tenantId: ctx.globalContext.tenantId as string | undefined,
    roles: ctx.globalContext.roles as string[] | undefined,
    tags: ctx.globalContext.tags as string[] | undefined
  };
}
