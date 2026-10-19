<script>
  /** @typedef {import('../../shared.d.ts').Job} Job */

  /** @type {{ jobs: Job[] }} */
  export let data;
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Scraped Jobs</h1>
      <p class="text-sm text-gray-600">Showing {data.jobs.length} jobs sorted by match score</p>
    </div>
  </div>

  {#if data.jobs.length === 0}
    <div class="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
      No jobs found. Run the scraper and evaluator scripts to populate jobs.
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each data.jobs as job (job.id)}
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between p-6">
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <h2 class="text-lg font-semibold text-gray-900 leading-snug">{job.title}</h2>
              {#if job.score !== null && job.score !== undefined}
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold {job.score >= 8
                    ? 'bg-green-100 text-green-800'
                    : job.score >= 5
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'}"
                >
                  Score: {job.score}/10
                </span>
              {:else}
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Unscored
                </span>
              {/if}
            </div>

            <p class="text-sm font-medium text-indigo-600 mb-1">{job.company}</p>
            <p class="text-xs text-gray-500 mb-4">
              <span class="font-medium text-gray-700">Salary:</span> {job.salary_range}
            </p>

            {#if job.reasoning}
              <div class="mb-4 bg-gray-50 p-3 rounded text-sm text-gray-700">
                <span class="font-medium text-gray-900">Analysis:</span> {job.reasoning}
              </div>
            {/if}

            {#if job.cover_letter}
              <details class="mb-4 text-sm text-gray-700 border border-gray-200 rounded p-3 bg-gray-50">
                <summary class="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800">
                  Tailored Cover Letter
                </summary>
                <div class="mt-2 whitespace-pre-line text-xs text-gray-600 border-t border-gray-200 pt-2">
                  {job.cover_letter}
                </div>
              </details>
            {/if}
          </div>

          <div class="pt-4 border-t border-gray-100">
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              class="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Review &amp; Apply
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
