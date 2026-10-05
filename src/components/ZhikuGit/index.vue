<template>
  <div>
    <svg-icon icon-class="github" @click="goto" />
  </div>
</template>

<script setup lang="ts">
const url = ref('https://github.com/MoMingMq/zhiku');

function goto() {
  window.open(url.value);
}
</script>
