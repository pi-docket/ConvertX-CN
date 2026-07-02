import { Elysia } from "elysia";
import { version } from "../../package.json";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import { Filename, Jobs } from "../db/types";
import { webActor } from "../application/actor";
import { jobService } from "../application/jobService";
import { ensureCsrfToken } from "../helpers/csrf";
import { ALLOW_UNAUTHENTICATED, WEBROOT } from "../helpers/env";
import { DownloadIcon } from "../icons/download";
import { DeleteIcon } from "../icons/delete";
import { EyeIcon } from "../icons/eye";
import { type Translator, createTranslator, defaultLocale } from "../i18n/index";
import { localeService } from "../i18n/service";
import { userService } from "./user";

const resultsScriptVersion = `${version}-${Bun.file("public/results.js").lastModified}`;

export function ResultsArticle({
  job,
  files,
  t = createTranslator(defaultLocale),
  csrfToken,
}: {
  job: Jobs;
  files: Filename[];
  t?: Translator;
  csrfToken: string;
}) {
  const terminalFiles = files.filter((file) => file.status !== "processing");
  const successfulFiles = files.filter((file) => file.status === "completed");
  const terminal = ["completed", "partial", "failed"].includes(job.status);
  return (
    <article class="article">
      <div class="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 class="text-xl" safe>
          {t("results", "title")}
        </h1>
        <div class="flex w-full flex-row flex-wrap gap-2 sm:w-auto sm:flex-nowrap sm:gap-4">
          <form
            method="post"
            action={`${WEBROOT}/delete/${job.id}`}
            onsubmit="return confirm('Delete this job?')"
          >
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <button
              type="submit"
              class="flex flex-1 btn-secondary flex-row justify-center gap-2 text-sm text-contrast sm:flex-none sm:text-base"
            >
              <DeleteIcon /> <p safe>{t("common", "delete")}</p>
            </button>
          </form>
          <a
            style={!terminal || successfulFiles.length === 0 ? "pointer-events: none;" : ""}
            href={
              terminal && successfulFiles.length > 0 ? `${WEBROOT}/archive/${job.id}` : undefined
            }
            download={`converted_files_${job.id}.tar`}
            class="flex flex-1 btn-primary flex-row justify-center gap-2 text-sm text-contrast sm:flex-none sm:text-base"
            {...(!terminal || successfulFiles.length === 0
              ? { "aria-disabled": "true", "aria-busy": "true", tabindex: -1 }
              : {})}
          >
            <DownloadIcon /> <p safe>{t("results", "downloadTar")}</p>
          </a>
          <button
            class="flex flex-1 btn-primary flex-row justify-center gap-2 text-sm text-contrast sm:flex-none sm:text-base"
            onclick="downloadAll()"
            disabled={successfulFiles.length === 0}
          >
            <DownloadIcon /> <p safe>{t("results", "downloadAll")}</p>
          </button>
        </div>
      </div>
      <p data-job-status={job.status} role="status" class="mb-3" safe>
        {job.status}
        {job.error_message ? `: ${job.error_message}` : ""}
      </p>
      <progress max={job.num_files} value={terminalFiles.length} class="progress-bar" />
      <table class="result-panel">
        <thead>
          <tr>
            <th class="table-cell-padding px-2 sm:px-4">
              <span safe>{t("results", "convertedFileName")}</span>
            </th>
            <th class="table-cell-padding px-2 sm:px-4">
              <span safe>{t("results", "status")}</span>
            </th>
            <th class="table-cell-padding px-2 sm:px-4">
              <span safe>{t("results", "actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const isTarFile = file.output_file_name.endsWith(".tar");
            const downloadable = file.status === "completed";
            const downloadHref = `${WEBROOT}/download/${encodeURIComponent(String(job.user_id))}/${encodeURIComponent(String(job.id))}/${encodeURIComponent(file.output_file_name)}`;
            return (
              <tr style="border-bottom: 1px solid var(--glass-divider);">
                <td class="table-cell-padding px-2 sm:px-4" title={file.output_file_name} safe>
                  {file.output_file_name}
                </td>
                <td class="table-cell-padding px-2 sm:px-4" safe>
                  {file.status}
                  {file.error_message ? `: ${file.error_message}` : ""}
                </td>
                <td class="table-cell-padding flex flex-row gap-3 px-2 sm:px-4">
                  {downloadable && !isTarFile && (
                    <a class="text-accent-500 underline hover:text-accent-400" href={downloadHref}>
                      <EyeIcon />
                    </a>
                  )}
                  {downloadable && (
                    <a
                      class="text-accent-500 underline hover:text-accent-400"
                      href={downloadHref}
                      download={file.output_file_name}
                    >
                      <DownloadIcon />
                    </a>
                  )}
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
    async ({ params, set, cookie: { job_id, csrf }, user, locale, t }) => {
      if (job_id?.value) {
        // Clear the job_id cookie since we are viewing the results
        job_id.remove();
      }

      const actor = webActor(user.id);
      const job = jobService.getOwnedJob(actor, params.jobId);

      if (!job) {
        set.status = 404;
        return {
          message: t("errors", "jobNotFound"),
        };
      }

      const files = jobService.listFiles(actor, params.jobId);
      const csrfToken = ensureCsrfToken(csrf);

      return (
        <BaseHtml
          webroot={WEBROOT}
          title="ConvertX-CN | Result"
          locale={locale}
          csrfToken={csrfToken}
        >
          <>
            <Header
              webroot={WEBROOT}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              loggedIn
              locale={locale}
              t={t}
              csrfToken={csrfToken}
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <ResultsArticle job={job} files={files} csrfToken={csrfToken} t={t} />
            </main>
            <script src={`${WEBROOT}/results.js?v=${resultsScriptVersion}`} defer />
          </>
        </BaseHtml>
      );
    },
    { auth: true },
  )
  .post(
    "/progress/:jobId",
    async ({ set, params, cookie: { job_id, csrf }, user, t }) => {
      if (job_id?.value) {
        // Clear the job_id cookie since we are viewing the results
        job_id.remove();
      }

      const actor = webActor(user.id);
      const job = jobService.getOwnedJob(actor, params.jobId);

      if (!job) {
        set.status = 404;
        return {
          message: t("errors", "jobNotFound"),
        };
      }

      const files = jobService.listFiles(actor, params.jobId);
      const csrfToken = ensureCsrfToken(csrf);

      return <ResultsArticle job={job} files={files} csrfToken={csrfToken} t={t} />;
    },
    { auth: true },
  )
  .get(
    "/progress-json/:jobId",
    async ({ set, params, user }) => {
      const actor = webActor(user.id);
      const job = jobService.getOwnedJob(actor, params.jobId);
      if (!job) {
        set.status = 404;
        return { error: "Job not found" };
      }
      const files = jobService.listFiles(actor, params.jobId);
      const successCount = files.filter((file) => file.status === "completed").length;
      const failedCount = files.filter((file) => file.status === "failed").length;
      const completedFiles = successCount + failedCount;
      return {
        jobId: job.id,
        status: job.status,
        terminal: ["completed", "partial", "failed"].includes(job.status),
        totalFiles: job.num_files,
        completedFiles,
        successCount,
        failedCount,
        jobError: job.error_message,
        progress: job.num_files > 0 ? Math.round((completedFiles / job.num_files) * 100) : 0,
        files: files.map((file) => ({
          fileName: file.file_name,
          outputFileName: file.output_file_name,
          status: file.status,
          error: file.error_message,
        })),
      };
    },
    { auth: true },
  );
