<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { TagsInputRootEmits, TagsInputRootProps } from "reka-ui";
import { TagsInputRoot, useForwardPropsEmits } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

defineOptions({
	inheritAttrs: false,
});

const props = defineProps<
	TagsInputRootProps<string> & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<TagsInputRootEmits<string>>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <TagsInputRoot
    data-slot="tags-input-root"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn(
      'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-[20px] border border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
      props.class,
    )"
  >
    <slot />
  </TagsInputRoot>
</template>
