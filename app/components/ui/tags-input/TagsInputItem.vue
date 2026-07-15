<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { TagsInputItemProps } from "reka-ui";
import { TagsInputItem, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

defineOptions({
	inheritAttrs: false,
});

const props = defineProps<
	TagsInputItemProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <TagsInputItem
    data-slot="tags-input-item"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn(
      'group/tag flex items-center gap-1 rounded-full border border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 py-1 pl-2.5 pr-1 text-xs font-medium text-foreground backdrop-blur data-[state=active]:border-primary/40 data-[state=active]:bg-primary/15',
      props.class,
    )"
  >
    <slot />
  </TagsInputItem>
</template>
