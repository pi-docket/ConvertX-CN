import { Elysia } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db from "../db/db";
import { Filename, Jobs } from "../db/types";
import { ALLOW_UNAUTHENTICATED, WEBROOT } from "../helpers/env";
import { DownloadIcon } from "../icons/download";
import { DeleteIcon } from "../icons/delete";
import { EyeIcon } from "../icons/eye";
import { type Translator, createTranslator, defaultLocale } from "../i18n/index";
import { localeService } from "../i18n/service";
import { userService } from "./user";

function ResultsArticle({
  job,
  files,
  outputPath,
  t = createTranslator(defaultLocale),
}: {
  job: Jobs;
  files: Filename[];
  outputPath: string;
  t?: Translator;
}) {
  return (
    <article class="article">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl" safe>
          {t("results", "title")}
        </h1>
        <div class="flex flex-row gap-4">
          <a
            style={files.length !== job.num_files ? "pointer-events: none;" : ""}
            class="flex btn-secondary flex-row gap-2 text-contrast"
            href={`${WEBROOT}/delete/${job.id}`}
            {...(files.length !== job.num_files ? { disabled: true, "aria-busy": "true" } : "")}
          >
            <DeleteIcon /> <p safe>{t("common", "delete")}</p>
          </a>
          <a
            style={files.length !== job.num_files ? "pointer-events: none;" : ""}
            href={`${WEBROOT}/archive/${job.id}`}
            download={`converted_files_${job.id}.tar`}
            class="flex btn-primary flex-row gap-2 text-contrast"
            {...(files.length !== job.num_files ? { disabled: true, "aria-busy": "true" } : "")}
          >
            <DownloadIcon /> <p safe>{t("results", "downloadTar")}</p>
          </a>
          <button class="flex btn-primary flex-row gap-2 text-contrast" onclick="downloadAll()">
            <DownloadIcon /> <p safe>{t("results", "downloadAll")}</p>
          </button>
        </div>
      </div>
      <progress
        max={job.num_files}
        {...(files.length === job.num_files ? { value: files.length } : "")}
        class={`
          mb-4 inline-block h-2 w-full appearance-none overflow-hidden rounded-full border-0
          bg-neutral-700 bg-none text-accent-500 accent-accent-500
          [&::-moz-progress-bar]:bg-accent-500 [&::-webkit-progress-value]:rounded-full
          [&::-webkit-progress-value]:[background:none]
          [&[value]::-webkit-progress-value]:bg-accent-500
          [&[value]::-webkit-progress-value]:transition-[inline-size]
        `}
      />
      <table
        class={`
          w-full table-auto overflow-hidden rounded-xl text-left
          [&_td]:p-4
          [&_tr]:border-b [&_tr]:border-[var(--glass-divider)]
          [&_tr:last-child]:border-b-0
        `}
        style={{
          background: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--glass-shadow), var(--glass-inset-highlight)",
        }}
      >
        <thead>
          <tr>
            <th
              class={`
                p-2
                sm:px-4
              `}
            >
              <span safe>{t("results", "convertedFileName")}</span>
            </th>
            <th
              class={`
                p-2
                sm:px-4
              `}
            >
              <span safe>{t("results", "status")}</span>
            </th>
            <th
              class={`
                p-2
                sm:px-4
              `}
            >
              <span safe>{t("results", "actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const isTarFile = file.output_file_name.endsWith(".tar");
            return (
              <tr>
                <td safe class="max-w-[20vw] truncate">
                  {file.output_file_name}
                </td>
                <td safe>{file.status}</td>
                <td class="flex flex-row gap-4">
                  {/* Hide preview icon for .tar files */}
                  {!isTarFile && (
                    <a
                      class={`
                        text-accent-500 underline
                        hover:text-accent-400
                      `}
                      href={`${WEBROOT}/download/${outputPath}${file.output_file_name}`}
                    >
                      <EyeIcon />
                    </a>
                  )}
                  <a
                    class={`
                      text-accent-500 underline
                      hover:text-accent-400
                    `}
                    href={`${WEBROOT}/download/${outputPath}${file.output_file_name}`}
                    download={file.output_file_name}
                  >
                    <DownloadIcon />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </article>
  );
}

export const results = new Elysia()
  .use(userService)
  .use(localeService)
  .get(
    "/results/:jobId",
    async ({ params, set, cookie: { job_id }, user, locale, t }) => {
      if (job_id?.value) {
        // Clear the job_id cookie since we are viewing the results
        job_id.remove();
      }

      const job = db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .as(Jobs)
        .get(user.id, params.jobId);

      if (!job) {
        set.status = 404;
        return {
          message: t("errors", "jobNotFound"),
        };
      }

      const outputPath = `${user.id}/${params.jobId}/`;

      const files = db
        .query("SELECT * FROM file_names WHERE job_id = ?")
        .as(Filename)
        .all(params.jobId);

      return (
        <BaseHtml webroot={WEBROOT} title="ConvertX-CN | Result" locale={locale}>
          <>
            <Header
              webroot={WEBROOT}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              loggedIn
              locale={locale}
              t={t}
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <ResultsArticle job={job} files={files} outputPath={outputPath} t={t} />
            </main>
            <script src={`${WEBROOT}/results.js`} defer />
          </>
        </BaseHtml>
      );
    },
    { auth: true },
  )
  .post(
    "/progress/:jobId",
    async ({ set, params, cookie: { job_id }, user, t }) => {
      if (job_id?.value) {
        // Clear the job_id cookie since we are viewing the results
        job_id.remove();
      }

      const job = db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .as(Jobs)
        .get(user.id, params.jobId);

      if (!job) {
        set.status = 404;
        return {
          message: t("errors", "jobNotFound"),
        };
      }

      const outputPath = `${user.id}/${params.jobId}/`;

      const files = db
        .query("SELECT * FROM file_names WHERE job_id = ?")
        .as(Filename)
        .all(params.jobId);

      return <ResultsArticle job={job} files={files} outputPath={outputPath} t={t} />;
    },
    { auth: true },
  )
  .get(
    "/progress-json/:jobId",
    async ({ set, params, user }) => {
      const job = db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .as(Jobs)
        .get(user.id, params.jobId);

      if (!job) {
        set.status = 404;
        return { error: "Job not found" };
      }

      const files = db
        .query("SELECT * FROM file_names WHERE job_id = ?")
        .as(Filename)
        .all(params.jobId);

      return {
        jobId: job.id,
        status: job.status,
        totalFiles: job.num_files,
        completedFiles: files.length,
        progress: job.num_files > 0 ? Math.round((files.length / job.num_files) * 100) : 0,
        files: files.map((f) => ({
          fileName: f.file_name,
          outputFileName: f.output_file_name,
          status: f.status,
        })),
      };
    },
    { auth: true },
  );
