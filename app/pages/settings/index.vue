<script setup lang="ts">
// Landing for /settings — no body of its own; send visitors to the first tab so
// the shell always shows a real section. `replace` keeps /settings out of history.
await navigateTo("/settings/usage", { replace: true });
</script>

<template>
	<div />
</template>
