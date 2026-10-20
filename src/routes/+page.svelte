<script>
  let { data } = $props();

  let expanded = $state({});
  let copied = $state({});

  function toggleExpand(id) {
    expanded[id] = !expanded[id];
  }

  async function copyCoverLetter(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      copied[id] = true;
      setTimeout(() => {
        copied[id] = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy cover letter:', err);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return isNaN(date.getTime())