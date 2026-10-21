<script>
  import { enhance } from "$app/forms";
  let { data, form } = $props();

  const FALLBACK_SCHEDULES = [
    {
      id: "morning-mst",
      name: "Morning Fast Scan",
      time: "06:00",
      enabled: true,
      extract_limit: 10,
      target_senders: "alert@indeed.com, jobalerts-noreply@linkedin.com",
      target_keywords: "Shopify, e-commerce, Liquid, SvelteKit, React",
    },
    {
      id: "evening-mst",
      name: "Evening Deep Scan",
      time: "20:00",
      enabled: true,
      extract_limit: 25,
      target_senders: "alert@indeed.com, jobalerts-noreply@linkedin.com",
      target_keywords: "Shopify, e-commerce, Liquid, SvelteKit, React",
    },
  ];

  let schedules = $state(structuredClone(FALLBACK_SCHEDULES));

  $effect(() => {
    if (data.schedules?.length) {
      schedules = structuredClone(data.schedules);
    }
  });

  let selectedProfileIndex = $state(0);
  let isRunning = $state(false);
  let isOptimizing = $state(false);
  let estimatedTotalSeconds = $state(0);
  let remainingSeconds = $state(0);
  let timerInterval = null;

  function startCountdown(jobCount) {
    // Estimate ~6s per job (Playwright + Ollama evaluation) + 5s Gmail ingest overhead
    estimatedTotalSeconds = Math.max(15, jobCount * 6 + 5);
    remainingSeconds = estimatedTotalSeconds;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (remainingSeconds > 1) {
        remainingSeconds -= 1;
      }
    }, 1000);
  }

  function stopCountdown() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    remainingSeconds = 0;
  }

  function formatCountdown(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function addSchedule() {
    schedules.push({
      id: "sched-" + Date.now(),
      name: `Custom Job #${schedules.length + 1}`,
      time: "12:00",
      enabled: true,
      extract_limit: 15,
      target_senders:
        schedules[0]?.target_senders ||
        "alert@indeed.com, jobalerts-noreply@linkedin.com",
      target_keywords:
        schedules[0]?.target_keywords ||
        "Shopify, e-commerce, Liquid, SvelteKit, React",
    });
  }

  function removeSchedule(index) {
    if (schedules.length <= 1) return;
    schedules.splice(index, 1);
    if (selectedProfileIndex >= schedules.length) {
      selectedProfileIndex = 0;
    }
  }
</script>

<div class="max-w-5xl mx-auto p-8 space-y-8">
  <div class="flex items-center justify-between border-b border-gray-200 pb-4">
    <div>
      <h1 class="text-2xl font-black text-gray-900">
        Settings, Cron Scheduler & Prompt AI
      </h1>
      <p class="text-sm text-gray-500">
        Configure multi-run daily Mountain Time cron jobs, keyword score
        boosters, and RLHF prompt tuning.
      </p>
    </div>
  </div>

  {#if form?.message}
    <div
      class="p-4 rounded-xl border text-sm font-medium {form?.error
        ? 'bg-red-50 border-red-200 text-red-800'
        : 'bg-emerald-50 border-emerald-200 text-emerald-800'}"
    >
      {form.message}
    </div>
  {/if}

  <!-- 1. Manual Pipeline Trigger with Animated Indicator & Countdown Timer -->
  <div
    class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4"
  >
    <div class="flex items-center justify-between gap-6 flex-wrap">
      <div>
        <h2 class="text-base font-bold text-gray-900">
          1. Manual Pipeline Trigger
        </h2>
        <p class="text-sm text-gray-500">
          Run the full ingestion, Playwright extraction, and Ollama scoring
          pipeline immediately using any schedule profile below.
        </p>
      </div>

      <form
        method="POST"
        action="?/runManualPipeline"
        class="flex items-center gap-3"
        use:enhance={() => {
          const activeSched = schedules[selectedProfileIndex] || schedules[0];
          isRunning = true;
          startCountdown(Number(activeSched?.extract_limit) || 10);
          return async ({ update }) => {
            await update();
            isRunning = false;
            stopCountdown();
          };
        }}
      >
        <select
          bind:value={selectedProfileIndex}
          disabled={isRunning}
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 font-medium text-gray-700"
        >
          {#each schedules as sched, i}
            <option value={i}
              >{sched.name} ({sched.extract_limit} max jobs)</option
            >
          {/each}
        </select>

        <input
          type="hidden"
          name="manual_limit"
          value={schedules[selectedProfileIndex]?.extract_limit ?? 10}
        />
        <input
          type="hidden"
          name="manual_senders"
          value={schedules[selectedProfileIndex]?.target_senders ?? ""}
        />
        <input
          type="hidden"
          name="manual_keywords"
          value={schedules[selectedProfileIndex]?.target_keywords ?? ""}
        />

        <button
          type="submit"
          disabled={isRunning}
          class="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700 disabled:opacity-60 transition cursor-pointer flex items-center gap-2 shrink-0"
        >
          {#if isRunning}
            <span
              class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
            ></span>
            <span>Running Pipeline...</span>
          {:else}
            <span>▶ Run Pipeline Now</span>
          {/if}
        </button>
      </form>
    </div>

    {#if isRunning}
      {@const progressPct = Math.min(
        95,
        Math.round(
          ((estimatedTotalSeconds - remainingSeconds) /
            Math.max(1, estimatedTotalSeconds)) *
            100,
        ),
      )}
      <div
        class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2"
      >
        <div
          class="flex items-center justify-between text-xs font-semibold text-indigo-900"
        >
          <span class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping"
            ></span>
            Active Run: Ingesting Gmail &rarr; Scraping up to {schedules[
              selectedProfileIndex
            ]?.extract_limit ?? 10} jobs &rarr; Scoring with Ollama
          </span>
          <span
            class="font-mono text-sm bg-white px-2.5 py-1 rounded border border-indigo-200 text-indigo-800"
          >
            Est. Time Remaining: {formatCountdown(remainingSeconds)}
          </span>
        </div>
        <div class="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-indigo-600 transition-all duration-1000"
            style="width: {progressPct}%"
          ></div>
        </div>
      </div>
    {/if}
  </div>

  <!-- 2. Gemini Prompt Optimizer (Manual RLHF) -->
  <div
    class="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl shadow-sm border border-emerald-200 flex items-center justify-between gap-6"
  >
    <div class="space-y-1">
      <h2 class="text-base font-bold text-emerald-950">
        2. Gemini Prompt Optimizer (Manual RLHF)
      </h2>
      <p class="text-sm text-emerald-800">
        Feedback Logged: <strong
          >{data.feedbackCounts?.applied_count || 0} Applied (👍)</strong
        >
        &middot;
        <strong>{data.feedbackCounts?.trashed_count || 0} Removed (👎)</strong>
      </p>
      <p class="text-xs text-emerald-700">
        Analyzes your real choices to automatically rewrite and improve Ollama's
        scoring rules.
      </p>
    </div>
    <form
      method="POST"
      action="?/optimizePromptWithGemini"
      use:enhance={() => {
        isOptimizing = true;
        return async ({ update }) => {
          await update({ reset: false });
          isOptimizing = false;
        };
      }}
    >
      <button
        type="submit"
        disabled={isOptimizing}
        class="px-5 py-2.5 bg-emerald-700 text-white font-semibold rounded-lg shadow hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer shrink-0"
      >
        {isOptimizing ? "Analyzing..." : "✨ Optimize Prompt"}
      </button>
    </form>
  </div>

  <!-- 3. Master Form: Multi-Cron Scheduler + Global Search Parameters -->
  <form
    method="POST"
    action="?/saveSettings"
    use:enhance={() => {
      return async ({ update }) => {
        await update({ reset: false });
      };
    }}
    class="space-y-8"
  >
    <!-- Automated Daily Cron Jobs Container -->
    <div
      class="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6"
    >
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900">
            3. Automated Daily Cron Jobs (Mountain Time)
          </h2>
          <p class="text-xs text-gray-500">
            Each scheduled run has its own Max Jobs limit, Target Email Senders,
            and Score-Boosting Target Keywords.
          </p>
        </div>
        <button
          type="button"
          onclick={addSchedule}
          class="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition cursor-pointer"
        >
          + Add Daily Cron Job
        </button>
      </div>

      <div class="space-y-4">
        {#each schedules as sched, index (sched.id)}
          <div
            class="p-5 rounded-xl border {sched.enabled
              ? 'border-indigo-200 bg-indigo-50/20'
              : 'border-gray-200 bg-gray-50 opacity-70'} space-y-4"
          >
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  bind:checked={sched.enabled}
                  class="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                />
                <input
                  type="text"
                  bind:value={sched.name}
                  placeholder="Schedule Name"
                  class="font-bold text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-1.5"
                />
              </div>

              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-gray-600"
                    >Run Time (MT):</span
                  >
                  <input
                    type="time"
                    bind:value={sched.time}
                    class="border border-gray-300 rounded-lg px-2.5 py-1 text-sm font-mono bg-white"
                  />
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-gray-600"
                    >Max Jobs Per Run:</span
                  >
                  <input
                    type="number"
                    min="1"
                    max="150"
                    bind:value={sched.extract_limit}
                    class="w-20 border border-gray-300 rounded-lg px-2.5 py-1 text-sm font-bold text-center bg-white"
                  />
                </div>

                {#if schedules.length > 1}
                  <button
                    type="button"
                    onclick={() => removeSchedule(index)}
                    class="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 cursor-pointer"
                  >
                    ✕ Remove
                  </button>
                {/if}
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <span class="block text-xs font-semibold text-gray-700 mb-1"
                  >Target Email Senders (comma-separated)</span
                >
                <input
                  type="text"
                  bind:value={sched.target_senders}
                  class="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono bg-white"
                />
              </div>
              <div>
                <span class="block text-xs font-semibold text-emerald-800 mb-1"
                  >Target Keywords (Boosts AI Score +1 to +2 when matched)</span
                >
                <input
                  type="text"
                  bind:value={sched.target_keywords}
                  placeholder="Shopify, e-commerce, Liquid, SvelteKit, React"
                  class="w-full rounded-lg border border-emerald-300 p-2 text-xs bg-white"
                />
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Global Search & Filter Parameters -->
    <div
      class="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6"
    >
      <h2 class="text-lg font-bold text-gray-900">
        4. Global Search & Scoring Parameters
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            for="gmail_days"
            class="block text-sm font-semibold text-gray-700 mb-1"
            >Email Lookback (Days)</label
          >
          <input
            id="gmail_days"
            name="gmail_days"
            type="number"
            min="1"
            max="60"
            value={data.settings?.gmail_days ?? 1}
            class="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
          />
          <span class="text-xs text-gray-500 mt-1 block">1 = past 24 hours</span
          >
        </div>

        <div>
          <label
            for="min_salary"
            class="block text-sm font-semibold text-gray-700 mb-1"
            >Minimum Salary (\$/yr)</label
          >
          <input
            id="min_salary"
            name="min_salary"
            type="number"
            value={data.settings?.min_salary ?? 150000}
            class="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
          />
        </div>
      </div>

      <div class="space-y-2 pt-2">
        <label
          for="custom_ollama_rules"
          class="block text-sm font-bold text-emerald-900"
        >
          Learned Ollama Scoring Rules (Generated by Gemini or Edited Manually)
        </label>
        <textarea
          id="custom_ollama_rules"
          name="custom_ollama_rules"
          rows="6"
          placeholder="Click 'Optimize Prompt' above after marking a few jobs as Applied or Removed..."
          class="w-full rounded-lg border-emerald-300 bg-emerald-50/20 border p-3 text-sm font-mono leading-relaxed"
          >{data.settings?.custom_ollama_rules || ""}</textarea
        >
      </div>

      <div class="pt-2">
        <span class="block text-sm font-semibold text-gray-700 mb-2"
          >Work Model</span
        >
        <div class="flex gap-6 text-sm">
          <label class="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              name="remote"
              checked={Boolean(data.settings?.remote ?? 1)}
              class="rounded border-gray-300"
            /> Remote
          </label>
          <label class="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              name="hybrid"
              checked={Boolean(data.settings?.hybrid ?? 1)}
              class="rounded border-gray-300"
            /> Hybrid
          </label>
          <label class="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              name="onsite"
              checked={Boolean(data.settings?.onsite ?? 0)}
              class="rounded border-gray-300"
            /> Onsite
          </label>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div>
          <label
            for="blocked_senders"
            class="block text-sm font-semibold text-gray-700 mb-1"
            >Blocked / Scam Senders</label
          >
          <textarea
            id="blocked_senders"
            name="blocked_senders"
            rows="2"
            class="w-full rounded-lg border-gray-300 border p-2.5 text-sm font-mono"
            >{data.settings?.blocked_senders || ""}</textarea
          >
        </div>

        <div>
          <label
            for="exclude_keywords"
            class="block text-sm font-semibold text-red-800 mb-1"
            >Exclude Keywords (Penalizes Score)</label
          >
          <textarea
            id="exclude_keywords"
            name="exclude_keywords"
            rows="2"
            class="w-full rounded-lg border-gray-300 border p-2.5 text-sm"
            >{data.settings?.exclude_keywords || ""}</textarea
          >
        </div>
      </div>

      <div class="pt-4 border-t">
        <button
          type="submit"
          class="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition cursor-pointer"
        >
          Save All Schedules & Settings
        </button>
      </div>
    </div>
  </form>
</div>
