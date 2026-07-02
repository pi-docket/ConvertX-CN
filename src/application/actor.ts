export const ACTOR_SCOPES = {
  JOBS_CREATE: "jobs:create",
  JOBS_READ: "jobs:read",
  JOBS_CANCEL: "jobs:cancel",
  JOBS_DELETE: "jobs:delete",
  ARTIFACTS_READ: "artifacts:read",
} as const;

export type ActorScope = (typeof ACTOR_SCOPES)[keyof typeof ACTOR_SCOPES];

export interface Actor {
  userId: string;
  scopes: ReadonlySet<ActorScope | "*">;
}

export function webActor(userId: string): Actor {
  return {
    userId,
    scopes: new Set(["*"]),
  };
}

export function actorCan(actor: Actor, scope: ActorScope): boolean {
  return actor.scopes.has("*") || actor.scopes.has(scope);
}
