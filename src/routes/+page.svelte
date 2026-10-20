<script>
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  let { data } = $props();

  let expanded = $state({});
  let copied = $state({});
  let jumpPage = $state(1);

  function toggleExpand(id) {
    expanded[id] = !expanded[id];
  }

  async function copyCoverLetter(id, text) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copied[id] = true;
    setTimeout(() => {
      copied[id] = false;
    }, 2000);
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleString();
  }

  function getOrigin(url = '') {
    const lower = url.toLowerCase();
    if (lower.includes('linkedin.com')) return { name: 'LinkedIn', classes: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (lower.includes('indeed.com')) return { name: 'Indeed', classes: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    return { name: 'Email Alert', classes: 'bg-gray-100 text-gray-800 border-gray-300' };
  }

  function getStatusBadge(status = '') {
    switch (status) {
      case 'evaluated':
        return { label: '✓ Evaluated', classes: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'extracted':
        return { label: '⏳ Queued for Ollama', classes: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'pending':
        return { label: '🕒 Queued for Playwright', classes: 'bg-slate-100 text-slate-600 border-slate-300' };
      case 'failed':
        return { label: '⚠️ Extraction Failed', classes: 'bg-red-100 text-red-800 border-red-300' };
      default:
        return { label: status, classes: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
  }

  function handlePageJump(e) {
    e.preventDefault();
    const target = Math.min(Math.max(1, Number(jumpPage) || 1), data.totalPages);
    goto(`/?filter=${data.filter}&page=${target}`);
  }
</script>

<div class="max-w-5xl mx-auto p-6 space-y-6">
  <!-- Top Header & Live Queue Monitor -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Job Hunter Feed</h1>
      <p class="text-sm text-gray-500">
        Showing {data.jobs?.length || 0} of {data.totalJobs || 0} postings in current
        view
      </p>
    </div>
    <a
      href="/settings"
      class="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
    >
      Settings, Manual Run & Prompt AI &rarr;
    </a>
  </div>

  <!-- Live Pipeline Queue Status Bar & Filter Tabs -->
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
    <a
      href="/?filter=evaluated&page=1"
      class="p-3 rounded-xl border text-left transition {data.filter ===
      'evaluated'
        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200'
        : 'bg-white border-gray-200 hover:bg-gray-50'}"
    >
      <div class="text-xs font-semibold uppercase text-emerald-700">
        Evaluated Matches
      </div>
      <div class="text-2xl font-bold text-gray-900">
        {data.stats?.evaluated || 0}
      </div>
      <div class="text-[11px] text-gray-500">Scored & Formatted</div>
    </a>

    <a
      href="/?filter=applied&page=1"
      class="p-3 rounded-xl border text-left transition {data.filter ===
      'applied'
        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
        : 'bg-white border-gray-200 hover:bg-gray-50'}"
    >
      <div class="text-xs font-semibold uppercase text-blue-700">
        Applied 👍
      </div>
      <div class="text-2xl font-bold text-gray-900">
        {data.stats?.applied || 0}
      </div>
      <div class="text-[11px] text-gray-500">Used to train Gemini</div>
    </a>

    <a
      href="/?filter=pending&page=1"
      class="p-3 rounded-xl border text-left transition {data.filter ===
      'pending'
        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
        : 'bg-white border-gray-200 hover:bg-gray-50'}"
    >
      <div class="text-xs font-semibold uppercase text-amber-700">
        In Pipeline Queue
      </div>
      <div class="text-2xl font-bold text-gray-900">
        {(data.stats?.pending_scrape || 0) + (data.stats?.pending_ollama || 0)}
      </div>
      <div class="text-[11px] text-gray-500">
        {data.stats?.pending_scrape || 0} Scrape · {data.stats
          ?.pending_ollama || 0} AI
      </div>
    </a>

    <a
      href="/?filter=trashed&page=1"
      class="p-3 rounded-xl border text-left transition {data.filter ===
      'trashed'
        ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
        : 'bg-white border-gray-200 hover:bg-gray-50'}"
    >
      <div class="text-xs font-semibold uppercase text-red-700">
        Removed Log 👎
      </div>
      <div class="text-2xl font-bold text-gray-900">
        {data.stats?.trashed || 0}
      </div>
      <div class="text-[11px] text-gray-500">Used to train Gemini</div>
    </a>

    <a
      href="/?filter=all&page=1"
      class="p-3 rounded-xl border text-left transition {data.filter === 'all'
        ? 'bg-gray-100 border-gray-500 ring-2 ring-gray-200'
        : 'bg-white border-gray-200 hover:bg-gray-50'}"
    >
      <div class="text-xs font-semibold uppercase text-gray-600">
        All Active
      </div>
      <div class="text-2xl font-bold text-gray-900">
        {(data.stats?.evaluated || 0) +
          (data.stats?.pending_scrape || 0) +
          (data.stats?.pending_ollama || 0)}
      </div>
      <div class="text-[11px] text-gray-500">
        {data.stats?.closed || 0} Closed Skipped
      </div>
    </a>
  </div>

  {#if !data.jobs || data.jobs.length === 0}
    <div
      class="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-3"
    >
      <h2 class="text-lg font-semibold text-gray-800">
        No jobs in the "{data.filter}" view
      </h2>
      <p class="text-sm text-gray-500">
        Switch tabs above, or go to Settings to run the pipeline on more queued
        jobs.
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each data.jobs as job (job.id)}
        {@const origin = getOrigin(job.url)}
        {@const statusBadge = getStatusBadge(job.status)}
        {@const displayDesc =
          job.cleaned_description ||
          job.description ||
          "Waiting in queue for Playwright to scrape this URL..."}
        <div
          class="bg-white rounded-xl shadow-sm border {job.applied
            ? 'border-blue-400 ring-1 ring-blue-100'
            : 'border-gray-200'} p-6 space-y-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  class="text-xs font-semibold px-2.5 py-0.5 rounded-full border {origin.classes}"
                >
                  {origin.name}
                </span>
                <span
                  class="text-xs font-semibold px-2.5 py-0.5 rounded-full border {statusBadge.classes}"
                >
                  {statusBadge.label}
                </span>
                {#if job.applied}
                  <span
                    class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white"
                  >
                    ✓ APPLIED
                  </span>
                {/if}
                <span class="text-xs text-gray-400">
                  Added: {formatDate(job.created_at)}
                </span>
              </div>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-lg font-bold text-blue-600 hover:underline block pt-1"
              >
                {job.title || "Pending Playwright Extraction..."}
              </a>
            </div>

            <!-- Right side: Score + Action Controls -->
            <div class="flex items-center gap-3 shrink-0">
              {#if job.score !== null && job.score !== undefined}
                <div
                  class="px-3 py-1.5 rounded-lg font-bold text-sm border {job.score >=
                  8
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : job.score >= 5
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-red-100 text-red-900 border-red-300'}"
                >
                  {job.score}/10
                </div>
              {/if}

              <!-- Applied Checkbox Form -->
              <form method="POST" action="?/toggleApplied" use:enhance>
                <input type="hidden" name="id" value={job.id} />
                <input
                  type="hidden"
                  name="applied"
                  value={job.applied ? 0 : 1}
                />
                <button
                  type="submit"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer {job.applied
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'}"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(job.applied)}
                    class="pointer-events-none"
                  />
                  Applied
                </button>
              </form>

              <!-- Remove / Restore Button Form -->
              {#if !job.trashed}
                <form
                  method="POST"
                  action="?/trashJob"
                  use:enhance={({ formData }) => {
                    const reason = prompt(
                      "Optional: Why are you removing this job? (Helps Gemini improve your Ollama prompt)",
                      "Irrelevant role / low pay / wrong stack",
                    );
                    if (reason === null) return ({ cancel }) => cancel();
                    formData.set("reason", reason);
                  }}
                >
                  <input type="hidden" name="id" value={job.id} />
                  <input type="hidden" name="reason" value="" />
                  <button
                    type="submit"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition cursor-pointer"
                    title="Remove & log for Gemini prompt tuning"
                  >
                    ✕ Remove
                  </button>
                </form>
              {:else}
                <form method="POST" action="?/restoreJob" use:enhance>
                  <input type="hidden" name="id" value={job.id} />
                  <button
                    type="submit"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 transition cursor-pointer"
                  >
                    ↩ Restore
                  </button>
                </form>
              {/if}
            </div>
          </div>

          {#if job.trashed && job.user_feedback}
            <div
              class="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-3 py-1.5 rounded"
            >
              <strong>Removed Reason:</strong>
              {job.user_feedback}
            </div>
          {/if}

          {#if job.status === "extracted" && !job.cleaned_description}
            <div
              class="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded inline-block"
            >
              Scraped by Playwright — Waiting for Ollama to score & format
              Markdown
            </div>
          {/if}

          <div
            class="text-sm text-gray-700 whitespace-pre-wrap break-words bg-gray-50 p-4 rounded-lg border border-gray-100"
            style={expanded[job.id]
              ? ""
              : "display: -webkit-box; -webkit-line-clamp: 10; -webkit-box-orient: vertical; overflow: hidden;"}
          >
            {displayDesc}
          </div>

          <button
            type="button"
            onclick={() => toggleExpand(job.id)}
            class="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {expanded[job.id]
              ? "▲ Show Less"
              : "▼ Expand / Show Full Description"}
          </button>

          {#if job.reasoning}
            <div
              class="bg-blue-50/60 border border-blue-100 p-4 rounded-lg text-sm text-gray-800"
            >
              <strong
                class="block text-xs uppercase tracking-wider text-blue-800 mb-1"
                >AI Analysis:</strong
              >
              {job.reasoning}
            </div>
          {/if}

          {#if job.cover_letter}
            <div
              class="bg-emerald-50/60 border border-emerald-200 p-4 rounded-lg space-y-2"
            >
              <div class="flex items-center justify-between">
                <strong
                  class="text-xs uppercase tracking-wider text-emerald-900"
                  >Tailored Cover Letter:</strong
                >
                <button
                  type="button"
                  onclick={() => copyCoverLetter(job.id, job.cover_letter)}
                  class="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 transition cursor-pointer"
                >
                  {copied[job.id] ? "✓ Copied!" : "Copy Cover Letter"}
                </button>
              </div>
              <div class="text-sm text-gray-800 whitespace-pre-wrap">
                {job.cover_letter}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Pagination Bar with Carets and Page Jump -->
    <div
      class="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200"
    >
      <div class="flex items-center gap-2">
        <a
          href="/?filter={data.filter}&page=1"
          class="px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-gray-50 {data.currentPage <=
          1
            ? 'pointer-events-none opacity-40'
            : ''}">&laquo; First</a
        >
        <a
          href="/?filter={data.filter}&page={Math.max(1, data.currentPage - 1)}"
          class="px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-gray-50 {data.currentPage <=
          1
            ? 'pointer-events-none opacity-40'
            : ''}">&lsaquo; Prev</a
        >
      </div>

      <form onsubmit={handlePageJump} class="flex items-center gap-2 text-sm">
        <span class="text-gray-600"
          >Page <strong>{data.currentPage}</strong> of
          <strong>{data.totalPages}</strong></span
        >
        <span class="text-gray-300">|</span>
        <label for="jump" class="text-gray-600">Go to:</label>
        <input
          id="jump"
          type="number"
          min="1"
          max={data.totalPages}
          bind:value={jumpPage}
          class="w-16 border rounded px-2 py-1 text-center text-sm"
        />
        <button
          type="submit"
          class="px-2.5 py-1 bg-gray-800 text-white rounded text-xs font-semibold hover:bg-gray-700 cursor-pointer"
        >
          Go
        </button>
      </form>

      <div class="flex items-center gap-2">
        <a
          href="/?filter={data.filter}&page={Math.min(
            data.totalPages,
            data.currentPage + 1,
          )}"
          class="px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-gray-50 {data.currentPage >=
          data.totalPages
            ? 'pointer-events-none opacity-40'
            : ''}">Next &rsaquo;</a
        >
        <a
          href="/?filter={data.filter}&page={data.totalPages}"
          class="px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-gray-50 {data.currentPage >=
          data.totalPages
            ? 'pointer-events-none opacity-40'
            : ''}">Last &raquo;</a
        >
      </div>
    </div>
  {/if}
</div>
