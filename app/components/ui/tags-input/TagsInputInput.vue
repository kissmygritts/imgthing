<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { TagsInputInputProps } from "reka-ui";
import { TagsInputInput, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

defineOptions({
	inheritAttrs: false,
});

const props = defineProps<
	TagsInputInputProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <TagsInputInput
    data-slot="tags-input-input"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn(
      'h-6 min-w-[6ch] flex-1 border-0 bg-transparent px-1 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-0',
      props.class,
    )"
  />
</template>
