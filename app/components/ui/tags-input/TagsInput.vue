<script setup lang="ts">
// A dedicated, on-brand tags input: reka-ui's TagsInput* primitives give the
// chips + caret one shared flex-wrap shell for free (no layout shift as chips
// wrap), paired with a hand-rolled Popover-anchored suggestions listbox (reka
// ships no built-in combobox-style dropdown for TagsInput).
//
// Add is fully hand-rolled rather than relying on reka's own Enter-adds-
// raw-text behavior: TagsInputInput unconditionally commits `target.value` on
// Enter, which would fight a highlighted suggestion. A capture-phase keydown
// listener on TagsInputRoot (an ancestor of the real <input>, so it always
// runs before the input's own listeners) intercepts Enter/ArrowUp/ArrowDown
// before reka ever sees them, so `commit()` is the single source of truth for
// what gets added. Remove keeps reka's native handling (click the delete
// button, or Backspace/arrow-navigate a chip) — that mechanism has no
// suggestions to fight with, so its `removeTag` event is simply relayed
// outward.
import { X } from "@lucide/vue";
import {
	PopoverAnchor,
	PopoverContent,
	PopoverPortal,
	PopoverRoot,
} from "reka-ui";
import {
	TagsInputInput,
	TagsInputItem,
	TagsInputItemDelete,
	TagsInputItemText,
	TagsInputRoot,
} from "@/components/ui/tags-input";

const props = defineProps<{
	modelValue: string[];
	// Full candidate universe (e.g. every tag ever used) — this component
	// excludes already-selected names and filters case-insensitively.
	suggestions: string[];
	placeholder?: string;
	disabled?: boolean;
	max?: number;
	autoFocus?: boolean;
}>();

const emit = defineEmits<{
	add: [name: string];
	remove: [name: string];
}>();

const inputValue = ref("");
const highlightedIndex = ref(-1);
const popoverOpen = ref(false);

const filteredSuggestions = computed(() => {
	const query = inputValue.value.trim().toLowerCase();
	if (!query) return [];
	const selected = new Set(props.modelValue.map((name) => name.toLowerCase()));
	return props.suggestions.filter(
		(name) =>
			!selected.has(name.toLowerCase()) && name.toLowerCase().includes(query),
	);
});

// Typing invalidates any prior arrow-key highlight; re-derive whether the
// popover should be open from the latest match count.
watch(inputValue, () => {
	highlightedIndex.value = -1;
});
watch(filteredSuggestions, (list) => {
	popoverOpen.value = inputValue.value.trim().length > 0 && list.length > 0;
});

// Single commit path for every "add" gesture: typed Enter (no highlight),
// highlighted-suggestion Enter, and suggestion-row click all funnel here.
function commit(raw: string) {
	const name = raw.trim();
	inputValue.value = "";
	highlightedIndex.value = -1;
	popoverOpen.value = false;
	if (!name) return;
	if (props.max && props.modelValue.length >= props.max) return;
	// Case-insensitive duplicate guard — matches the existing "ignore a
	// no-op re-add of a tag already on the photo" behavior.
	if (
		props.modelValue.some(
			(existing) => existing.toLowerCase() === name.toLowerCase(),
		)
	)
		return;
	emit("add", name);
}

function onRootKeydownCapture(event: KeyboardEvent) {
	if (event.key === "ArrowDown") {
		if (!popoverOpen.value || !filteredSuggestions.value.length) return;
		event.preventDefault();
		highlightedIndex.value =
			highlightedIndex.value < filteredSuggestions.value.length - 1
				? highlightedIndex.value + 1
				: 0;
	} else if (event.key === "ArrowUp") {
		if (!popoverOpen.value || !filteredSuggestions.value.length) return;
		event.preventDefault();
		highlightedIndex.value =
			highlightedIndex.value > 0
				? highlightedIndex.value - 1
				: filteredSuggestions.value.length - 1;
	} else if (event.key === "Enter") {
		// Fully own Enter — prevent reka's own onAddValue (bound on the
		// native input itself) from ever running.
		event.preventDefault();
		event.stopPropagation();
		const highlighted =
			highlightedIndex.value >= 0
				? filteredSuggestions.value[highlightedIndex.value]
				: undefined;
		commit(highlighted ?? inputValue.value);
	}
}

function onRemoveTag(value: unknown) {
	emit("remove", String(value));
}
</script>

<template>
  <PopoverRoot :open="popoverOpen" @update:open="popoverOpen = $event">
    <TagsInputRoot
      :model-value="modelValue"
      :disabled="disabled"
      :max="max ?? 0"
      delimiter=""
      @keydown.capture="onRootKeydownCapture"
      @remove-tag="onRemoveTag"
    >
      <TagsInputItem v-for="name in modelValue" :key="name" :value="name">
        <TagsInputItemText />
        <TagsInputItemDelete :aria-label="`Remove tag ${name}`">
          <X class="size-3" />
        </TagsInputItemDelete>
      </TagsInputItem>
      <!-- Anchor the popover to just the input, not the whole shell — as chips
      wrap the input can sit on any row, and the shell can't be the anchor or
      the dropdown would always open under its bottom-left corner instead of
      near the caret. -->
      <PopoverAnchor as-child>
        <span class="inline-flex min-w-[6ch] flex-1">
          <TagsInputInput
            :placeholder="placeholder"
            :disabled="disabled"
            :auto-focus="autoFocus"
            :value="inputValue"
            class="w-full min-w-0 flex-none"
            @input="inputValue = ($event.target as HTMLInputElement).value"
          />
        </span>
      </PopoverAnchor>
    </TagsInputRoot>
    <PopoverPortal>
      <PopoverContent
        align="start"
        :side-offset="4"
        class="glass-popout z-[110] min-w-[12rem] max-h-64 overflow-y-auto rounded-md border p-1 shadow-md"
        @open-auto-focus.prevent
      >
        <div
          v-for="(suggestion, i) in filteredSuggestions"
          :key="suggestion"
          class="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none"
          :class="
            i === highlightedIndex
              ? 'bg-accent text-accent-foreground'
              : 'text-foreground hover:bg-accent/60 hover:text-accent-foreground'
          "
          @mousedown.prevent="commit(suggestion)"
          @mouseenter="highlightedIndex = i"
        >
          {{ suggestion }}
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
