<script>
  let { data, form } = $props();
</script>

<div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Data Sources</h1>

    <form method="POST" class="space-y-6">
      <div>
        <label for="source_type" class="block text-sm font-medium text-gray-700">Source Type</label>
        <input
          type="text"
          id="source_type"
          name="source_type"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label for="query_url" class="block text-sm font-medium text-gray-700">Query URL</label>
        <input
          type="text"
          id="query_url"
          name="query_url"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label for="is_active" class="block text-sm font-medium text-gray-700">Is Active</label>
        <input
          type="checkbox"
          id="is_active"
          name="is_active"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div class="pt-4 border-t border-gray-200">
        <button
          type="submit"
          name="action"
          value="addSource"
          class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Add Source
        </button>
      </div>
    </form>

    <ul>
      {#each data.sources as source (source.id)}
        <li>
          {source.source_type} - {source.query_url} - {source.is_active ? 'Active' : 'Inactive'}
          <form method="POST" class="inline">
            <input type="hidden" name="id" value={source.id} />
            <button
              type="submit"
              name="action"
              value="deleteSource"
              class="ml-2 inline-flex justify-center rounded-md border border-transparent bg-red-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Delete
            </button>
          </form>
        </li>
      {/each}
    </ul>

    <h1 class="text-2xl font-bold text-gray-900 mb-6">Search Settings</h1>

    {#if form?.success}
      <div class="mb-6 p-4 rounded-md bg-green-50 border border-green-200 text-sm text-green-800">
        Settings saved successfully.
      </div>
    {/if}

    <form method="POST" class="space-y-6">
      <div>
        <label for="min_salary" class="block text-sm font-medium text-gray-700">Minimum Salary ($/yr)</label>
        <input
          type="number"
          id="min_salary"
          name="min_salary"
          value={data.settings?.min_salary ?? 0}
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label for="work_model" class="block text-sm font-medium text-gray-700">Work Model</label>
        <select
          id="work_model"
          name="work_model"
          class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
        >
          <option value="remote" selected={data.settings?.work_model === 'remote'}>Remote</option>
          <option value="hybrid" selected={data.settings?.work_model === 'hybrid'}>Hybrid</option>
          <option value="onsite" selected={data.settings?.work_model === 'onsite'}>Onsite</option>
        </select>
      </div>

      <div>
        <label for="exclude_keywords" class="block text-sm font-medium text-gray-700">
          Exclude Keywords (comma-separated)
        </label>
        <textarea
          id="exclude_keywords"
          name="exclude_keywords"
          rows="4"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          placeholder="e.g. unpaid, intern, clearance, wordpress"
        >{data.settings?.exclude_keywords ?? ''}</textarea>
        <p class="mt-1 text-xs text-gray-500">
          Jobs whose title or description contains any of these words will be skipped during scraping.
        </p>
      </div>

      <div class="pt-4 border-t border-gray-200">
        <button
          type="submit"
          class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Save Settings
        </button>
      </div>
    </form>
  </div>
</div>
