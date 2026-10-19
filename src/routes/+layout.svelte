<nav class="bg-white border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <div class="flex items-center space-x-8">
        <a href="/" class="text-xl font-bold text-gray-900">Job Hunter</a>
        <div class="flex space-x-4">
          <a
            href="/"
            class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            Dashboard
          </a>
          <a
            href="/settings"
            class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            Settings
          </a>
        </div>
      </div>
    </div>
  </div>
</nav>

<main class="min-h-screen bg-gray-50 py-8">
  <slot />
</main>
