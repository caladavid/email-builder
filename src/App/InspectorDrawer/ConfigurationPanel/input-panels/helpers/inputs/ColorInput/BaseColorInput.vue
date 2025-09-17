<template>
  <div class="space-y-2">
    <UFormField :label="label">
      <div
        class="gap-x-1 flex items-center"
        :style="{
          '--bg-color': value ?? '#FFFFFF',
        }"
      >
        <UPopover>
          <UButton label="Elegir color" color="neutral" variant="outline">
            <template #leading>
              <UIcon v-if="value === null" name="material-symbols:palette" class="text-lg" />
              <span v-else :style="{ backgroundColor: value ?? undefined }" class="size-3 rounded-full" />
            </template>
          </UButton>

          <template #content>
            <UColorPicker :model-value="value ?? undefined" class="p-2" @update:model-value="handleChange($event ?? null)" />
          </template>
        </UPopover>

        <!-- reset button -->
        <UButton
          v-if="nullable && typeof value === 'string' && value.length > 0"
          class="bg-transparent text-white p-1 cursor-pointer hover:bg-white/10"
          size="sm"
          @click="handleChange(null)"
        >
          <UIcon name="material-symbols:close" class="text-xl" />
        </UButton>
      </div>
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

type Props = {
  nullable: true,
  label: string,
  defaultValue: string | null,
} | {
  nullable: false,
  label: string,
  defaultValue: string,
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'change', args: typeof props.nullable extends true ? string | null : string): void
}>()

/** Refs */

const value = ref(props.defaultValue)

/** Functions */

function handleChange(newValue: string | null) {
  value.value = newValue;
  emit('change', newValue as typeof props.nullable extends true ? string | null : string);
}

</script>
