<script>
  import "../app.css";
  let { children } = $props();
</script>

<div class="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
  <header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-8">
        <a href="/" class="text-xl font-black tracking-tight text-gray-900"
          >Job Hunter</a
        >
        <nav class="flex items-center gap-2">
          <a
            href="/"
            class="px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
          >
            Job Hunter Feed
          </a>
          <a
            href="/settings"
            class="px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
          >
            Settings & Prompt AI
          </a>
        </nav>
      </div>
    </div>
  </header>

  <main class="flex-1 pb-16">
    {@render children()}
  </main>
</div>
