<script>
  let { data } = $props();

  let expanded = $state({});
  let copied = $state({});

  function toggleExpand(id) {
    expanded[id] = !expanded[id];
  }

  async function copyCoverLetter(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      copied[id] = true;
      setTimeout(() => {
        copied[id] = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy cover letter:', err);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleString();
  }
</script>

<div class="max-w-6xl mx-auto p-6">
  <h1 class="text-3xl font-bold mb-6 text-gray-900">Job Evaluations</h1>

  <div class="grid gap-6">
    {#each data.jobs as job (job.id)}
      <div class="p-6 border border-gray-200 rounded-lg shadow-sm bg-white">
        {#if job.created_at}
          <div class="text-xs text-gray-500 mb-2">
            Posted / Added: {formatDate(job.created_at)}
          </div>
        {/if}

        <div class="flex justify-between items-start mb-2">
          <div>
            <h2 class="text-xl font-bold">
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                class="text-blue-600 hover:text-blue-800 hover:underline"
                >{job.title || job.url}</a
              >
            </h2>
            {#if job.company}
              <p class="text-gray-600 font-medium text-sm mt-1">{job.company}</p>
            {/if}
          </div>

          {#if job.score !== null && job.score !== undefined}
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

        {#if job.cleaned_description || job.description}
          {@const isRaw = !job.cleaned_description}
          {@const desc = job.cleaned_description || job.description}
          <div class="mt-4">
            {#if isRaw}
              <div class="mb-2">
                <span
                  class="inline-block px-2 py-0.5 text-xs font-medium italic bg-amber-100 text-amber-900 rounded border border-amber-200"
                >
                  [Raw Web Extraction - Pending AI Cleanup]
                </span>
              </div>
            {/if}
            <div
              class="text-sm text-gray-700 whitespace-pre-wrap break-words {expanded[job.id] ? '' : 'line-clamp-10'}"
            >
              {desc}
            </div>
            <button
              onclick={() => toggleExpand(job.id)}
              class="mt-2 text-xs text-blue-600 hover:text-blue-800 font-semibold underline focus:outline-none"
            >
              {expanded[job.id] ? 'Show Less' : 'Expand / Show More'}
            </button>
          </div>
        {/if}

        {#if job.reasoning}
          <div class="mt-4 bg-gray-50 p-4 rounded-md border border-gray-100 text-sm">
            <span class="font-bold text-gray-900 mb-1 block">AI Analysis:</span>
            <p class="text-gray-700 whitespace-pre-wrap">{job.reasoning}</p>
          </div>
        {/if}

        {#if job.cover_letter}
          <div class="mt-4 bg-blue-50 p-4 rounded-md border border-blue-100 text-sm">
            <div class="flex justify-between items-center mb-2">
              <span class="font-bold text-blue-900">Cover Letter:</span>
              <button
                onclick={() => copyCoverLetter(job.id, job.cover_letter)}
                class="px-3 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                {copied[job.id] ? 'Copied!' : 'Copy Cover Letter'}
              </button>
            </div>
            <p class="text-blue-950 whitespace-pre-wrap">{job.cover_letter}</p>
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

  {#if data.totalPages > 1}
    <div class="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
      {#if data.currentPage > 1}
        <a
          href="?page={data.currentPage - 1}"
          class="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Previous Page
        </a>
      {:else}
        <span
          class="px-4 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm font-medium text-gray-400 cursor-not-allowed"
        >
          Previous Page
        </span>
      {/if}

      <span class="text-sm text-gray-600">
        Page {data.currentPage} of {data.totalPages}
      </span>

      {#if data.currentPage < data.totalPages}
        <a
          href="?page={data.currentPage + 1}"
          class="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Next Page
        </a>
      {:else}
        <span
          class="px-4 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm font-medium text-gray-400 cursor-not-allowed"
        >
          Next Page
        </span>
      {/if}
    </div>
  {/if}
</div>
