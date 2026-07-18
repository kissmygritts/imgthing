<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { TagsInputItemDeleteProps } from "reka-ui";
import { TagsInputItemDelete, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

defineOptions({
	inheritAttrs: false,
});

const props = defineProps<
	TagsInputItemDeleteProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <TagsInputItemDelete
    data-slot="tags-input-item-delete"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn(
      'flex size-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive',
      props.class,
    )"
  >
    <slot />
  </TagsInputItemDelete>
</template>
