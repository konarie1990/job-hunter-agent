<script>
  let { data } = $props();
</script>

<div class="max-w-6xl mx-auto p-6">
  <h1 class="text-3xl font-bold mb-6 text-gray-900">Job Evaluations</h1>

  <div class="grid gap-6">
    {#each data.jobs as job}
      <div class="p-6 border border-gray-200 rounded-lg shadow-sm bg-white">
        <div class="flex justify-between items-start mb-2">
          <div>
            <h2 class="text-xl font-bold">
              <a
                href={job.url}
                target="_blank"
                class="text-blue-600 hover:text-blue-800 hover:underline"
                >{job.title}</a
              >
            </h2>
            <p class="text-gray-600 font-medium text-sm mt-1">{job.company}</p>
          </div>

          {#if job.score}
            <div
              class="bg-blue-50 border border-blue-200 px-3 py-1 rounded-md text-blue-800 font-bold text-lg"
            >
              {job.score}/10
            </div>
          {:else}
            <span
              class="inline-block px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full"
              >Pending Evaluation</span
            >
          {/if}
        </div>

        <div
          class="text-sm text-gray-700 mb-4 mt-4 prose max-w-none break-words whitespace-normal"
        >
          {@html job.description}
        </div>

        {#if job.reasoning}
          <div class="bg-gray-50 p-4 rounded-md border border-gray-100 text-sm">
            <span class="font-bold text-gray-900 mb-1 block">AI Analysis:</span>
            <p class="text-gray-700">{job.reasoning}</p>
          </div>
        {/if}
      </div>
    {:else}
      <div
        class="text-center p-12 bg-gray-50 rounded-lg border border-gray-200 text-gray-500"
      >
        No jobs found in the database.
      </div>
    {/each}
  </div>
</div>
