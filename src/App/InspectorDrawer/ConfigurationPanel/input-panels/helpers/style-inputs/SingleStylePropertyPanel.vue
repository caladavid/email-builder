<template>
  <NullableColorInput v-if="name === 'backgroundColor'" label="Color de fondo" :default-value="defaultValue" @change="handleChange" />
  <NullableColorInput v-else-if="name === 'borderColor'" label="Color del borde" :default-value="defaultValue" @change="handleChange" />
  <SliderInput
    v-else-if="name === 'borderRadius'"
    icon-label="material-symbols:rounded-corner"
    label="Radio del borde (Border radius)"
    :default-value="defaultValue"
    :step="4"
    :min="0"
    :max="48"
    @change="handleChange"
  />
  <NullableColorInput v-else-if="name === 'color'" label="Color de texto" :default-value="defaultValue" @change="handleChange" />
  <NullableFontFamily v-else-if="name === 'fontFamily'" label="Familia de fuente" :default-value="defaultValue" @change="handleChange" />
  <FontSizeInput v-else-if="name === 'fontSize'" label="Tamaño de fuente" :model-value="defaultValue" @change="handleChange" />
  <FontWeightInput v-else-if="name === 'fontWeight'" label="Grosor de fuente" :model-value="defaultValue" @change="handleChange" />
  <TextAlignInput v-else-if="name === 'textAlign'" label="Alineación de texto" :model-value="defaultValue" @change="handleChange" />
  <PaddingInput v-else-if="name === 'padding'" label="Relleno (Padding)" :model-value="defaultValue" @change="handleChange" />
</template>

<script setup lang="ts">
import type { TStyle } from '../../../../../../documents/blocks/helpers/TStyle';
import NullableColorInput from '../inputs/ColorInput/NullableColorInput.vue';
import NullableFontFamily from '../inputs/NullableFontFamily.vue';
import FontSizeInput from '../inputs/FontSizeInput.vue';
import FontWeightInput from '../inputs/FontWeightInput.vue';
import TextAlignInput from '../inputs/TextAlignInput.vue';
import PaddingInput from '../inputs/PaddingInput.vue';
import SliderInput from '../inputs/SliderInput.vue';
import { computed } from 'vue';

type StylePropertyPanelProps = {
  name: keyof TStyle,
  modelValue: TStyle,
}

const props = defineProps<StylePropertyPanelProps>()

const emit = defineEmits<{
  (e: 'update:model-value', args: TStyle): void
}>()

/** Computed */

const defaultValue = computed(() => props.modelValue[props.name] ?? null)

/** Functions */

function handleChange(newValue: unknown) {
  emit('update:model-value', {
    ...props.modelValue,
    [props.name]: newValue,
  })
}
</script>
