<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { TagsInputItemTextProps } from "reka-ui";
import { TagsInputItemText, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

defineOptions({
	inheritAttrs: false,
});

const props = defineProps<
	TagsInputItemTextProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <TagsInputItemText
    data-slot="tags-input-item-text"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn(props.class)"
  />
</template>
