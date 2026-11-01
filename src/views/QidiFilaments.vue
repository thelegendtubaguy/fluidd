<template>
  <v-row :dense="$vuetify.breakpoint.smAndDown">
    <v-col cols="12">
      <qidi-filaments-card />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import QidiFilamentsCard from '@/components/widgets/qidiFilaments/QidiFilamentsCard.vue'

@Component({
  components: {
    QidiFilamentsCard
  }
})
export default class QidiFilaments extends Vue {}
</script>
