<script>
  import { enhance } from "$app/forms";
  let { data, form } = $props();

  let activeTab = $state("pipeline"); // 'pipeline' | 'ai' | 'resume'

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
    estimatedTotalSeconds = Math.max(15, jobCount * 6 + 5);
    remainingSeconds = estimatedTotalSeconds;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (remainingSeconds > 1) remainingSeconds -= 1;
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
    if (selectedProfileIndex >= schedules.length) selectedProfileIndex = 0;
  }
</script>

<div class="max-w-5xl mx-auto p-8 space-y-8">
  <div class="flex items-center justify-between border-b border-gray-200 pb-4">
    <div>
      <h1 class="text-2xl font-black text-gray-900">
        Settings, Ollama Models & Resume Vault
      </h1>
      <p class="text-sm text-gray-500">
        Configure schedules, select local Ollama models, and manage immutable
        resume versions.
      </p>
    </div>

    <!-- Tab Navigation -->
    <div
      class="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold"
    >
      <button
        type="button"
        onclick={() => (activeTab = "pipeline")}
        class="px-4 py-2 rounded-lg transition cursor-pointer {activeTab ===
        'pipeline'
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'}"
      >
        ⚙️ Pipeline & Schedulers
      </button>
      <button
        type="button"
        onclick={() => (activeTab = "ai")}
        class="px-4 py-2 rounded-lg transition cursor-pointer {activeTab ===
        'ai'
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'}"
      >
        🤖 AI & Prompt Rules
      </button>
      <button
        type="button"
        onclick={() => (activeTab = "resume")}
        class="px-4 py-2 rounded-lg transition cursor-pointer {activeTab ===
        'resume'
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'}"
      >
        📄 Resume Vault ({data.resumeVersions?.length || 0})
      </button>
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

  <!-- TAB 1: PIPELINE & SCHEDULERS -->
  {#if activeTab === "pipeline"}
    <div class="space-y-8">
      <!-- Manual Pipeline Trigger -->
      <div
        class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4"
      >
        <div class="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h2 class="text-base font-bold text-gray-900">
              Manual Pipeline Trigger
            </h2>
            <p class="text-sm text-gray-500">
              Run ingestion, Playwright scraping, and Ollama scoring
              immediately.
            </p>
          </div>

          <form
            method="POST"
            action="?/runManualPipeline"
            class="flex items-center gap-3"
            use:enhance={() => {
              const activeSched =
                schedules[selectedProfileIndex] || schedules[0];
              isRunning = true;
              startCountdown(Number(activeSched?.extract_limit) || 10);
              return async ({ update }) => {
                await update({ reset: false });
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
                <span
                  class="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping"
                ></span>
                Running Active Schedule...
              </span>
              <span
                class="font-mono text-sm bg-white px-2.5 py-1 rounded border border-indigo-200 text-indigo-800"
              >
                Est. Remaining: {formatCountdown(remainingSeconds)}
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

      <!-- Schedulers Form -->
      <form
        method="POST"
        action="?/saveSettings"
        use:enhance={() =>
          async ({ update }) =>
            update({ reset: false })}
        class="space-y-6"
      >
        <input
          type="hidden"
          name="schedules_json"
          value={JSON.stringify(schedules)}
        />
        <input
          type="hidden"
          name="ollama_model"
          value={data.settings?.ollama_model || "qwen2.5-coder:7b"}
        />

        <div
          class="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6"
        >
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-gray-900">
                Automated Daily Cron Jobs (Mountain Time)
              </h2>
              <p class="text-xs text-gray-500">
                Configure multiple daily execution profiles.
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
                      class="font-bold text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-1.5"
                    />
                  </div>

                  <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-gray-600"
                        >Time (MT):</span
                      >
                      <input
                        type="time"
                        bind:value={sched.time}
                        class="border border-gray-300 rounded-lg px-2.5 py-1 text-sm font-mono bg-white"
                      />
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-gray-600"
                        >Max Jobs:</span
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
                        ✕
                      </button>
                    {/if}
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <span class="block text-xs font-semibold text-gray-700 mb-1"
                      >Target Email Senders</span
                    >
                    <input
                      type="text"
                      bind:value={sched.target_senders}
                      class="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono bg-white"
                    />
                  </div>
                  <div>
                    <span
                      class="block text-xs font-semibold text-emerald-800 mb-1"
                      >Target Keywords (Score Boosters)</span
                    >
                    <input
                      type="text"
                      bind:value={sched.target_keywords}
                      class="w-full rounded-lg border border-emerald-300 p-2 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <div class="pt-4 border-t">
            <button
              type="submit"
              class="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition cursor-pointer"
            >
              Save Schedules
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- TAB 2: AI & PROMPT RULES -->
  {:else if activeTab === "ai"}
    <div class="space-y-8">
      <!-- Gemini RLHF Optimizer -->
      <div
        class="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl shadow-sm border border-emerald-200 flex items-center justify-between gap-6"
      >
        <div class="space-y-1">
          <h2 class="text-base font-bold text-emerald-950">
            Gemini Prompt Optimizer (Manual RLHF)
          </h2>
          <p class="text-sm text-emerald-800">
            Feedback Logged: <strong
              >{data.feedbackCounts?.applied_count || 0} Applied (👍)</strong
            >
            &middot;
            <strong
              >{data.feedbackCounts?.trashed_count || 0} Removed (👎)</strong
            >
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

      <form
        method="POST"
        action="?/saveSettings"
        use:enhance={() =>
          async ({ update }) =>
            update({ reset: false })}
        class="space-y-6"
      >
        <input
          type="hidden"
          name="schedules_json"
          value={JSON.stringify(schedules)}
        />

        <div
          class="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6"
        >
          <h2 class="text-lg font-bold text-gray-900">
            Local and Remote AI Model Selection & Prompt Rules
          </h2>
          <!-- Gemini Model Selector -->
          <div class="space-y-2">
            <label
              for="gemini_model"
              class="block text-sm font-bold text-gray-900"
            >
              Gemini API Model (For RLHF Prompt Optimizer)
            </label>
            <select
              id="gemini_model"
              name="gemini_model"
              value={data.settings?.gemini_model || "gemini-3.8-flash"}
              class="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold bg-white"
            >
              <option value="gemini-3.8-flash"
                >gemini-3.8-flash (Recommended)</option
              >
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            </select>
          </div>
          <!-- Ollama Model Selector Dropdown -->
          <div class="space-y-2">
            <label
              for="ollama_model"
              class="block text-sm font-bold text-gray-900"
            >
              Active Local Ollama Model (Queried from <code
                class="bg-gray-100 px-1 py-0.5 rounded text-xs"
                >http://localhost:11434</code
              >)
            </label>
            <select
              id="ollama_model"
              name="ollama_model"
              value={data.settings?.ollama_model || "qwen2.5-coder:7b"}
              class="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold bg-white"
            >
              {#each data.availableModels || ["qwen2.5-coder:7b"] as modelName}
                <option value={modelName}>{modelName}</option>
              {/each}
            </select>
            <span class="text-xs text-gray-500 block"
              >Make sure Ollama is running locally and the model is downloaded.</span
            >
          </div>

          <div class="space-y-2 pt-2">
            <label
              for="custom_ollama_rules"
              class="block text-sm font-bold text-emerald-900"
            >
              Learned Ollama Scoring Rules (Generated by Gemini or Edited
              Manually)
            </label>
            <textarea
              id="custom_ollama_rules"
              name="custom_ollama_rules"
              rows="8"
              class="w-full rounded-lg border-emerald-300 bg-emerald-50/20 border p-3 text-sm font-mono leading-relaxed"
              >{data.settings?.custom_ollama_rules || ""}</textarea
            >
          </div>

          <div class="pt-4 border-t">
            <button
              type="submit"
              class="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition cursor-pointer"
            >
              Save AI & Model Settings
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- TAB 3: RESUME VAULT -->
  {:else if activeTab === "resume"}
    <div class="space-y-8">
      <div
        class="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6"
      >
        <div>
          <h2 class="text-lg font-bold text-gray-900">
            📄 Immutable Resume Vault
          </h2>
          <p class="text-sm text-gray-500">
            Every submission here creates a brand-new, permanent historical
            version. Past extractions permanently link to the exact resume
            version used when evaluated.
          </p>
        </div>

        <form
          method="POST"
          action="?/saveNewResumeVersion"
          use:enhance={() =>
            async ({ update }) =>
              update({ reset: false })}
          class="space-y-4"
        >
          <div class="space-y-2">
            <label
              for="resume_content"
              class="block text-sm font-bold text-gray-900"
            >
              Add New Resume Version (Markdown format)
            </label>
            <textarea
              id="resume_content"
              name="resume_content"
              rows="12"
              placeholder="# Enter updated resume markdown here..."
              class="w-full rounded-lg border border-gray-300 p-4 text-sm font-mono leading-relaxed bg-gray-50/50"
              >{data.activeResume?.content || ""}</textarea
            >
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs text-emerald-700 font-medium">
              Active Version ID in DB: #{data.activeResume?.id || "None"}
            </span>
            <button
              type="submit"
              class="px-6 py-2.5 bg-emerald-700 text-white font-semibold rounded-lg shadow hover:bg-emerald-800 transition cursor-pointer"
            >
              + Save as New Resume Version
            </button>
          </div>
        </form>

        <div class="border-t pt-6 space-y-3">
          <h3 class="text-sm font-bold text-gray-900">
            Historical Versions in Vault
          </h3>
          <div class="space-y-2 max-h-60 overflow-y-auto pr-2">
            {#each data.resumeVersions as ver (ver.id)}
              <div
                class="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between text-xs font-mono"
              >
                <span>Version ID #{ver.id}</span>
                <span class="text-gray-400">{ver.created_at}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
