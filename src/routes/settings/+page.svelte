<script>
  import { enhance } from "$app/forms";
  let { data, form } = $props();
</script>

<div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Search Settings</h1>

    {#if form?.success}
      <div
        class="mb-6 p-4 rounded-md bg-green-50 border border-green-200 text-sm text-green-800"
      >
        Settings saved successfully.
      </div>
    {/if}

    <form
      method="POST"
      action="?/saveSettings"
      use:enhance
      class="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
    >
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-1"
          >Minimum Salary ($/yr)</label
        >
        <input
          type="number"
          name="min_salary"
          value={data.settings?.min_salary || ""}
          class="w-full border border-gray-300 rounded-md p-2"
        />
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2"
          >Work Model</label
        >
        <div class="flex gap-6">
          <label class="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              name="work_model"
              value="Remote"
              checked={data.settings?.work_models?.includes("Remote")}
              class="mr-2"
            /> Remote
          </label>
          <label class="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              name="work_model"
              value="Hybrid"
              checked={data.settings?.work_models?.includes("Hybrid")}
              class="mr-2"
            /> Hybrid
          </label>
          <label class="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              name="work_model"
              value="Onsite"
              checked={data.settings?.work_models?.includes("Onsite")}
              class="mr-2"
            /> Onsite
          </label>
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-bold text-green-700 mb-1"
          >Target Keywords (MUST INCLUDE - comma-separated)</label
        >
        <textarea
          name="include_keywords"
          class="w-full border border-gray-300 rounded-md p-2"
          >{data.settings?.include_keywords || ""}</textarea
        >
        <p class="text-xs text-gray-500 mt-1">
          Jobs MUST contain at least one of these words to be saved.
        </p>
      </div>

      <div class="mb-6">
        <label class="block text-sm font-bold text-red-700 mb-1"
          >Exclude Keywords (comma-separated)</label
        >
        <textarea
          name="exclude_keywords"
          class="w-full border border-gray-300 rounded-md p-2"
          >{data.settings?.exclude_keywords || ""}</textarea
        >
        <p class="text-xs text-gray-500 mt-1">
          Jobs containing ANY of these words will be skipped.
        </p>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-bold text-blue-700 mb-1"
          >Target Email Senders (comma-separated)</label
        >
        <textarea
          name="target_senders"
          class="w-full border border-gray-300 rounded-md p-2"
          >{data.settings?.target_senders || 'alert@indeed.com, jobalerts-noreply@linkedin.com'}</textarea
        >
        <p class="text-xs text-gray-500 mt-1">
          Emails from these senders will be processed.
        </p>
      </div>

      <div class="mb-6">
        <label class="block text-sm font-bold text-purple-700 mb-1"
          >Blocked Email Senders (comma-separated)</label
        >
        <textarea
          name="blocked_senders"
          class="w-full border border-gray-300 rounded-md p-2"
          >{data.settings?.blocked_senders || ''}</textarea
        >
        <p class="text-xs text-gray-500 mt-1">
          Emails from these senders will be skipped.
        </p>
      </div>

      <button
        type="submit"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
        >Save Settings</button
      >
    </form>
  </div>
</div>
