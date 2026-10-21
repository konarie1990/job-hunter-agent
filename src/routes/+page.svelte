<script>
  import { goto } from "$app/navigation";
  import { enhance } from "$app/forms";
  let { data, form } = $props();

  let expanded = $state({});
  let copied = $state({});
  let jumpPage = $state(1);
  let clientOllamaBusy = $state(false);
  let evaluatingJobId = $state(null);
  let generatingCoverLetterId = $state(null);

  let isOllamaLocked = $derived(clientOllamaBusy || Boolean(data.ollamaBusy));

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

  function formatRelativeTime(dateStr) {
    if (!dateStr) return "Recently";
    const normalized = dateStr.includes("T")
      ? dateStr
      : dateStr.replace(" ", "T") + "Z";
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return dateStr;

    const diffMs = Date.now() - date.getTime();
    const totalMinutes = Math.max(1, Math.floor(diffMs / 60000));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const remHours = totalHours % 24;

    if (totalMinutes < 60) {
      return `${totalMinutes}m ago`;
    } else if (days === 0) {
      return `${totalHours}h ago`;
    } else if (remHours > 0) {
      return `${days}d ${remHours}h ago`;
    } else {
      return `${days}d ago`;
    }
  }

  function getOrigin(url = "") {
    const lower = url.toLowerCase();
    if (lower.includes("linkedin.com"))
      return {
        name: "LinkedIn",
        classes: "bg-blue-100 text-blue-800 border-blue-300",
      };
    if (lower.includes("indeed.com"))
      return {
        name: "Indeed",
        classes: "bg-indigo-100 text-indigo-800 border-indigo-300",
      };
    return {
      name: "Email Alert",
      classes: "bg-gray-100 text-gray-800 border-gray-300",
    };
  }

  function getStatusBadge(status = "") {
    switch (status) {
      case "evaluated":
        return {
          label: "✓ Evaluated",
          classes: "bg-emerald-100 text-emerald-800 border-emerald-300",
        };
      case "extracted":
        return {
          label: "⏳ Queued for Ollama",
          classes: "bg-amber-100 text-amber-800 border-amber-300",
        };
      case "pending":
        return {
          label: "🕒 Queued for Playwright",
          classes: "bg-slate-100 text-slate-600 border-slate-300",
        };
      case "failed":
        return {
          label: "⚠️ Extraction Failed",
          classes: "bg-red-100 text-red-800 border-red-300",
        };
      default:
        return {
          label: status,
          classes: "bg-gray-100 text-gray-700 border-gray-300",
        };
    }
  }

  function handlePageJump(e) {
    e.preventDefault();
    const target = Math.min(
      Math.max(1, Number(jumpPage) || 1),
      data.totalPages,
    );
    goto(`/?filter=${data.filter}&sort=${data.sort}&page=${target}`);
  }
</script>

<!-- STICKY FLOATING COMMAND CENTER HEADER -->
<div
  class="sticky top-16 z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm py-3 px-6 mb-6"
>
  <div class="max-w-7xl mx-auto space-y-3">
    <!-- Top Row: Title, Sort Toggle, & Pagination -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div class="flex items-center gap-4">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Job Hunter Feed</h1>
          <p class="text-xs text-gray-500">
            Showing {data.jobs?.length || 0} of {data.totalJobs || 0} postings
          </p>
        </div>

        {#if isOllamaLocked}
          <div
            class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold"
          >
            <span
              class="w-3 h-3 border-2 border-amber-800 border-t-transparent rounded-full animate-spin"
            ></span>
            Ollama Busy Evaluating #{evaluatingJobId ||
              data.activeOllamaJobId ||
              "..."}
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <!-- Sort Toggle -->
        <div
          class="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-semibold"
        >
          <a
            href="/?filter={data.filter}&sort=score_desc&page=1"
            class="px-2 py-1 rounded-md transition {data.sort === 'score_desc'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}"
          >
            ★ High&rarr;Low
          </a>
          <a
            href="/?filter={data.filter}&sort=score_asc&page=1"
            class="px-2.5 py-1 rounded-md transition {data.sort === 'score_asc'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}"
          >
            ☆ Low&rarr;High
          </a>
          <a
            href="/?filter={data.filter}&sort=date_desc&page=1"
            class="px-2.5 py-1 rounded-md transition {data.sort === 'date_desc'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}"
          >
            🕒 Newest
          </a>
          <a
            href="/?filter={data.filter}&sort=date_asc&page=1"
            class="px-2.5 py-1 rounded-md transition {data.sort === 'date_asc'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}"
          >
            📜 Oldest
          </a>
        </div>

        <!-- Compact Top Pagination -->
        <div
          class="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
        >
          <a
            href="/?filter={data.filter}&sort={data.sort}&page=1"
            class="font-medium hover:text-blue-600 {data.currentPage <= 1
              ? 'pointer-events-none opacity-30'
              : ''}">&laquo; First</a
          >
          <a
            href="/?filter={data.filter}&sort={data.sort}&page={Math.max(
              1,
              data.currentPage - 1,
            )}"
            class="font-medium hover:text-blue-600 {data.currentPage <= 1
              ? 'pointer-events-none opacity-30'
              : ''}">&lsaquo; Prev</a
          >

          <span class="text-gray-300 px-1">|</span>
          <span class="text-gray-700"
            >Page <strong>{data.currentPage}</strong> of
            <strong>{data.totalPages}</strong></span
          >
          <span class="text-gray-300 px-1">|</span>

          <form onsubmit={handlePageJump} class="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max={data.totalPages}
              bind:value={jumpPage}
              class="w-12 border rounded px-1.5 py-0.5 text-center text-xs bg-white"
            />
            <button
              type="submit"
              class="px-2 py-0.5 bg-gray-900 text-white rounded text-xs font-medium hover:bg-gray-800 cursor-pointer"
            >
              Go
            </button>
          </form>

          <span class="text-gray-300 px-1">|</span>
          <a
            href="/?filter={data.filter}&sort={data.sort}&page={Math.min(
              data.totalPages,
              data.currentPage + 1,
            )}"
            class="font-medium hover:text-blue-600 {data.currentPage >=
            data.totalPages
              ? 'pointer-events-none opacity-30'
              : ''}">Next &rsaquo;</a
          >
          <a
            href="/?filter={data.filter}&sort={data.sort}&page={data.totalPages}"
            class="font-medium hover:text-blue-600 {data.currentPage >=
            data.totalPages
              ? 'pointer-events-none opacity-30'
              : ''}">Last &raquo;</a
          >
        </div>
      </div>
    </div>

    <!-- Bottom Row: Filter Tabs / Queue Counters (Preserves Current Sort State) -->
    <div class="grid grid-cols-5 gap-2">
      <a
        href="/?filter=evaluated&sort={data.sort}&page=1"
        class="px-3 py-2 rounded-lg border text-left transition flex items-center justify-between {data.filter ===
        'evaluated'
          ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-300'
          : 'bg-white border-gray-200 hover:bg-gray-50'}"
      >
        <div>
          <div class="text-[10px] font-bold uppercase text-emerald-800">
            Evaluated Matches
          </div>
          <div class="text-sm font-black text-gray-900">
            {data.stats?.evaluated || 0}
          </div>
        </div>
      </a>

      <a
        href="/?filter=applied&sort={data.sort}&page=1"
        class="px-3 py-2 rounded-lg border text-left transition flex items-center justify-between {data.filter ===
        'applied'
          ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-300'
          : 'bg-white border-gray-200 hover:bg-gray-50'}"
      >
        <div>
          <div class="text-[10px] font-bold uppercase text-blue-800">
            Applied 👍
          </div>
          <div class="text-sm font-black text-gray-900">
            {data.stats?.applied || 0}
          </div>
        </div>
      </a>

      <a
        href="/?filter=pending&sort={data.sort}&page=1"
        class="px-3 py-2 rounded-lg border text-left transition flex items-center justify-between {data.filter ===
        'pending'
          ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-300'
          : 'bg-white border-gray-200 hover:bg-gray-50'}"
      >
        <div>
          <div class="text-[10px] font-bold uppercase text-amber-800">
            In Pipeline Queue
          </div>
          <div class="text-sm font-black text-gray-900">
            {(data.stats?.pending_scrape || 0) +
              (data.stats?.pending_ollama || 0)}
          </div>
          <div class="text-[10px] text-amber-700 font-medium">
            {data.stats?.pending_ollama || 0} Ready for Ollama · {data.stats
              ?.pending_scrape || 0} Unscraped
          </div>
        </div>
      </a>

      <a
        href="/?filter=trashed&sort={data.sort}&page=1"
        class="px-3 py-2 rounded-lg border text-left transition flex items-center justify-between {data.filter ===
        'trashed'
          ? 'bg-red-50 border-red-500 ring-1 ring-red-300'
          : 'bg-white border-gray-200 hover:bg-gray-50'}"
      >
        <div>
          <div class="text-[10px] font-bold uppercase text-red-800">
            Removed Log 👎
          </div>
          <div class="text-sm font-black text-gray-900">
            {data.stats?.trashed || 0}
          </div>
        </div>
      </a>

      <a
        href="/?filter=all&sort={data.sort}&page=1"
        class="px-3 py-2 rounded-lg border text-left transition flex items-center justify-between {data.filter ===
        'all'
          ? 'bg-gray-100 border-gray-500 ring-1 ring-gray-300'
          : 'bg-white border-gray-200 hover:bg-gray-50'}"
      >
        <div>
          <div class="text-[10px] font-bold uppercase text-gray-600">
            All Active
          </div>
          <div class="text-sm font-black text-gray-900">
            {(data.stats?.evaluated || 0) +
              (data.stats?.pending_scrape || 0) +
              (data.stats?.pending_ollama || 0)}
          </div>
        </div>
      </a>
    </div>
  </div>
</div>

<!-- MAIN FEED CONTENT -->
<div class="max-w-7xl mx-auto px-6 space-y-4">
  {#if form?.ollamaError}
    <div
      class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium"
    >
      {form.message}
    </div>
  {/if}

  {#if !data.jobs || data.jobs.length === 0}
    <div
      class="bg-white rounded-xl border border-gray-200 p-16 text-center space-y-3"
    >
      <h2 class="text-lg font-semibold text-gray-800">
        No jobs in the "{data.filter}" view
      </h2>
      <p class="text-sm text-gray-500">
        Switch tabs above or trigger a run from the Settings tab.
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
        {@const isThisCardEvaluating =
          evaluatingJobId === job.id || data.activeOllamaJobId === job.id}

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
                <span
                  class="text-xs text-gray-400"
                  title={job.created_at || ""}
                >
                  Added: {formatRelativeTime(job.created_at)}
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
            <div
              class="flex items-center gap-2.5 shrink-0 flex-wrap justify-end"
            >
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

              <!-- Single-Job Queue Override Button (For Queued for Ollama or Re-Evaluating) -->
              {#if job.status === "extracted" || job.status === "evaluated"}
                <form
                  method="POST"
                  action="?/evaluateSingleJob&filter={data.filter}&sort={data.sort}&page={data.currentPage}"
                  use:enhance={() => {
                    clientOllamaBusy = true;
                    evaluatingJobId = job.id;
                    return async ({ update }) => {
                      await update({ reset: false });
                      clientOllamaBusy = false;
                      evaluatingJobId = null;
                    };
                  }}
                >
                  <input type="hidden" name="id" value={job.id} />
                  <button
                    type="submit"
                    disabled={isOllamaLocked}
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition {isOllamaLocked
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                      : job.status === 'extracted'
                        ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 cursor-pointer shadow-xs'
                        : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer'}"
                    title={isOllamaLocked
                      ? "Ollama is currently busy evaluating a job"
                      : "Override queue and evaluate this job right now with Ollama"}
                  >
                    {#if isThisCardEvaluating}
                      <span
                        class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
                      ></span>
                      <span>Evaluating...</span>
                    {:else if isOllamaLocked}
                      <span>⏳ Ollama Busy</span>
                    {:else if job.status === "extracted"}
                      <span>⚡ Run Ollama Now</span>
                    {:else}
                      <span>↻ Re-Score</span>
                    {/if}
                  </button>
                </form>
              {/if}

              <!-- Single-Job Playwright Scrape Button (For Pending Cards) -->
              {#if job.status === "pending"}
                <form
                  method="POST"
                  action="?/scrapeSingleJob&filter={data.filter}&sort={data.sort}&page={data.currentPage}"
                  use:enhance={() => {
                    return async ({ update }) => {
                      await update({ reset: false });
                    };
                  }}
                >
                  <input type="hidden" name="id" value={job.id} />
                  <button
                    type="submit"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white border border-slate-900 hover:bg-slate-700 transition cursor-pointer shadow-xs"
                    title="Scrape this URL right now with Playwright"
                  >
                    ⚡ Scrape Now
                  </button>
                </form>
              {/if}

              <!-- Applied Checkbox Form -->
              <form
                method="POST"
                action="?/toggleApplied&filter={data.filter}&sort={data.sort}&page={data.currentPage}"
                use:enhance={() => {
                  return async ({ update }) => {
                    await update({ reset: false });
                  };
                }}
              >
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
                  action="?/trashJob&filter={data.filter}&sort={data.sort}&page={data.currentPage}"
                  use:enhance={({ formData }) => {
                    const reason = prompt(
                      "Optional: Why are you removing this job? (Helps Gemini improve your Ollama prompt)",
                      "Irrelevant role / low pay / wrong stack",
                    );
                    if (reason === null) return ({ cancel }) => cancel();
                    formData.set("reason", reason);
                    return async ({ update }) => {
                      await update({ reset: false });
                    };
                  }}
                >
                  <input type="hidden" name="id" value={job.id} />
                  <input type="hidden" name="reason" value="" />
                  <button
                    type="submit"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition cursor-pointer"
                  >
                    ✕ Remove
                  </button>
                </form>
              {:else}
                <form
                  method="POST"
                  action="?/restoreJob&filter={data.filter}&sort={data.sort}&page={data.currentPage}"
                  use:enhance={() => {
                    return async ({ update }) => {
                      await update({ reset: false });
                    };
                  }}
                >
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
              Scraped by Playwright — Click "⚡ Run Ollama Now" on the right to
              evaluate immediately, or let the next scheduled run process it.
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
                <div class="flex items-center gap-2">
                  <form
                    method="POST"
                    action="?/generateCoverLetter&filter={data.filter}&sort={data.sort}&page={data.currentPage}"
                    use:enhance={() => {
                      generatingCoverLetterId = job.id;
                      return async ({ update }) => {
                        await update({ reset: false });
                        generatingCoverLetterId = null;
                      };
                    }}
                  >
                    <input type="hidden" name="id" value={job.id} />
                    <button
                      type="submit"
                      disabled={generatingCoverLetterId === job.id}
                      class="px-2.5 py-1 bg-emerald-700 text-white text-xs font-semibold rounded hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                      title="Force Ollama to regenerate this cover letter"
                    >
                      {#if generatingCoverLetterId === job.id}
                        <span
                          class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                        ></span>
                        <span>Regenerating...</span>
                      {:else}
                        <span>↻ Regenerate</span>
                      {/if}
                    </button>
                  </form>
                  <button
                    type="button"
                    onclick={() => copyCoverLetter(job.id, job.cover_letter)}
                    class="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 transition cursor-pointer"
                  >
                    {copied[job.id] ? "✓ Copied!" : "Copy Cover Letter"}
                  </button>
                </div>
              </div>
              <div class="text-sm text-gray-800 whitespace-pre-wrap">
                {job.cover_letter}
              </div>
            </div>
          {:else if job.status === "evaluated"}
            <div
              class="bg-gray-50 border border-gray-200 p-4 rounded-lg flex items-center justify-between gap-4"
            >
              <div>
                <strong
                  class="text-xs uppercase tracking-wider text-gray-700 block"
                  >Cover Letter:</strong
                >
                <span class="text-xs text-gray-500"
                  >Not generated (Score was 8 or below during initial
                  evaluation).</span
                >
              </div>
              <form
                method="POST"
                action="?/generateCoverLetter&filter={data.filter}&sort={data.sort}&page={data.currentPage}"
                use:enhance={() => {
                  generatingCoverLetterId = job.id;
                  return async ({ update }) => {
                    await update({ reset: false });
                    generatingCoverLetterId = null;
                  };
                }}
              >
                <input type="hidden" name="id" value={job.id} />
                <button
                  type="submit"
                  disabled={generatingCoverLetterId === job.id}
                  class="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer shadow-xs flex items-center gap-2"
                >
                  {#if generatingCoverLetterId === job.id}
                    <span
                      class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                    ></span>
                    <span>Generating Cover Letter...</span>
                  {:else}
                    <span>✨ Generate Cover Letter</span>
                  {/if}
                </button>
              </form>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
