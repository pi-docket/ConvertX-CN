import { Elysia, t } from "elysia";
import { verifyCsrf } from "../helpers/csrf";
import { inferenceService } from "../inference";
import { userService } from "./user";

export const inferenceApi = new Elysia({ prefix: "/inference" })
  .use(userService)
  .post(
    "/predict",
    async ({ body, user }) => {
      try {
        const result = await inferenceService.inferFromExtension(
          body.ext,
          Number(user.id),
          body.file_size_kb,
          body.available_engines,
        );
        return {
          success: true,
          data: {
            format: result.format,
            engine: result.engine,
            should_auto_fill: result.should_auto_fill,
            warmup_status: result.warmup_status,
          },
        };
      } catch (error) {
        console.error("Inference prediction error:", error);
        return { success: false, error: "Failed to predict format" };
      }
    },
    {
      auth: true,
      body: t.Object({
        ext: t.String({ minLength: 1, maxLength: 32 }),
        file_size_kb: t.Optional(t.Number({ minimum: 0 })),
        available_engines: t.Optional(
          t.Array(t.String({ minLength: 1, maxLength: 128 }), { maxItems: 100 }),
        ),
      }),
    },
  )
  .post(
    "/dismiss",
    ({ body, user, request, cookie: { csrf }, set }) => {
      if (
        !verifyCsrf(
          request,
          body.csrf_token,
          typeof csrf?.value === "string" ? csrf.value : undefined,
        )
      ) {
        set.status = 403;
        return { success: false };
      }
      try {
        inferenceService.logDismiss({
          userId: Number(user.id),
          inputExt: body.input_ext,
          dismissedFormat: body.dismissed_format,
          ...(body.dismissed_engine === undefined
            ? {}
            : { dismissedEngine: body.dismissed_engine }),
        });
        return { success: true };
      } catch (error) {
        console.error("Failed to log dismiss event:", error);
        set.status = 500;
        return { success: false };
      }
    },
    {
      auth: true,
      body: t.Object({
        input_ext: t.String({ minLength: 1, maxLength: 32 }),
        dismissed_format: t.String({ minLength: 1, maxLength: 128 }),
        dismissed_engine: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
        csrf_token: t.String({ minLength: 16, maxLength: 256 }),
      }),
    },
  )
  .get(
    "/warmup-status",
    () => {
      try {
        return { success: true, data: inferenceService.getWarmupStatus() };
      } catch (error) {
        console.error("Failed to get warmup status:", error);
        return { success: false, data: null };
      }
    },
    { auth: true },
  )
  .get(
    "/profile",
    ({ user }) => {
      try {
        return {
          success: true,
          data: inferenceService.getUserProfile(Number(user.id)),
        };
      } catch (error) {
        console.error("Failed to get user profile:", error);
        return { success: false, data: null };
      }
    },
    { auth: true },
  );
