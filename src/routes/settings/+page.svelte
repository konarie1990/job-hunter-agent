<script>
  import { enhance } from "$app/forms";
  let { data, form } = $props();
</script>

<div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Data Sources</h1>

    <form
      method="POST"
      action="?/addSource"
      use:enhance
      class="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg"
    >
      <div class="grid gap-4 mb-4">
        <div>
          <label
            for="source_type"
            class="block text-sm font-medium text-gray-700 mb-1"
            >Source Type</label
          >
          <select
            name="source_type"
            id="source_type"
            class="w-full border border-gray-300 rounded-md p-2 bg-white"
          >
            <option value="Open API">Open API (Remotive, Arbeitnow)</option>
            <option value="Direct ATS">Direct ATS API</option>
          </select>
        </div>

        <div>
          <label
            for="query_url"
            class="block text-sm font-medium text-gray-700 mb-1"
            >Query URL</label
          >
          <input
            type="url"
            name="query_url"
            id="query_url"
            class="w-full border border-gray-300 rounded-md p-2"
            placeholder="https://remotive.com/api/..."
            required
          />
        </div>
      </div>

      <div class="flex items-center mb-4">
        <input
          type="checkbox"
          name="is_active"
          id="is_active"
          value="true"
          checked
          class="h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
        />
        <label
          for="is_active"
          class="ml-2 block text-sm font-medium text-gray-700 cursor-pointer"
        >
          Active <span class="text-gray-500 font-normal"
            >(Include this endpoint in the hourly scrape)</span
          >
        </label>
      </div>

      <button
        type="submit"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
      >
        Add Source
      </button>
    </form>

    <div class="mt-8 mb-12">
      <h3 class="text-xl font-bold mb-4 text-gray-900">Active Endpoints</h3>
      <ul class="space-y-3">
        {#each data.sources as source}
          <li
            class="p-4 border border-gray-200 rounded-lg flex justify-between items-center bg-white shadow-sm"
          >
            <div>
              <span class="font-bold text-sm text-gray-900 block mb-1"
                >{source.source_type}</span
              >
              <a
                href={source.query_url}
                target="_blank"
                class="text-sm text-blue-600 hover:underline"
                >{source.query_url}</a
              >
              <div class="mt-2">
                {#if source.is_active}
                  <span
                    class="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full"
                    >Active</span
                  >
                {:else}
                  <span
                    class="inline-block px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full"
                    >Inactive</span
                  >
                {/if}
              </div>
            </div>
            <form method="POST" action="?/deleteSource" use:enhance>
              <input type="hidden" name="id" value={source.id} />
              <button
                type="submit"
                class="text-red-600 hover:text-red-800 text-sm font-bold bg-red-50 px-3 py-2 rounded-md hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </form>
          </li>
        {:else}
          <div
            class="text-center p-8 bg-gray-50 rounded-lg border border-gray-200 text-gray-500 text-sm"
          >
            No data sources saved yet. Add one above.
          </div>
        {/each}
      </ul>
    </div>

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

      <button
        type="submit"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
        >Save Settings</button
      >
    </form>
  </div>
</div>
