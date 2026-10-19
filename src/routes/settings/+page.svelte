<script>
  let { data, form } = $props();
</script>

<div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-8">
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
