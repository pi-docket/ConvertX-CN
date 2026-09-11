import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { WEBROOT } from "../helpers/env";
import { isHtmlPageRequest } from "../helpers/isHtmlPageRequest";
import { JWT_SECRET } from "../helpers/jwtSecret";

export const userService = new Elysia({ name: "user/service" })
  .use(
    jwt({
      name: "jwt",
      schema: t.Object({
        id: t.String(),
      }),
      secret: JWT_SECRET,
      exp: "7d",
    }),
  )
  .model({
    signIn: t.Object({
      csrfToken: t.String({ minLength: 16, maxLength: 256 }),
      email: t.String({ format: "email", minLength: 3, maxLength: 254 }),
      password: t.String({ minLength: 1, maxLength: 128 }),
    }),
    registration: t.Object({
      csrfToken: t.String({ minLength: 16, maxLength: 256 }),
      email: t.String({ format: "email", minLength: 3, maxLength: 254 }),
      password: t.String({ minLength: 8, maxLength: 128 }),
    }),
    session: t.Cookie({
      csrf: t.Optional(t.String()),
      auth: t.String(),
      jobId: t.Optional(t.String()),
    }),
    optionalSession: t.Cookie({
      csrf: t.Optional(t.String()),
      auth: t.Optional(t.String()),
      jobId: t.Optional(t.String()),
    }),
  })
  .macro("auth", {
    cookie: "optionalSession",
    async resolve({ request, set, status, jwt, cookie: { auth } }) {
      const unauthorized = () => {
        if (isHtmlPageRequest(request)) {
          set.headers.location = `${WEBROOT}/login`;
          return status(302, {
            success: false,
            message: "Redirecting to login",
          });
        }

        return status(401, {
          success: false,
          message: "Unauthorized",
        });
      };

      if (!auth.value) {
        return unauthorized();
      }
      const user = await jwt.verify(auth.value);
      if (!user) {
        auth.remove();
        return unauthorized();
      }
      return {
        success: true,
        user,
      };
    },
  });
