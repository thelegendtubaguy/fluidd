<template>
  <div>
    <template v-if="job.state === 'running'">
      <div class="text-body-2 mb-1">
        {{ $t(`app.tltg_addons.job.${job.action}.running`, { name }) }}
      </div>
      <v-progress-linear
        indeterminate
        color="primary"
        class="mb-1"
      />
      <div
        v-if="job.message"
        class="text-caption secondary--text tltg-addon-job__message"
      >
        {{ job.message }}
      </div>
    </template>

    <v-alert
      v-else
      dense
      text
      :type="job.state === 'failed' ? 'error' : 'success'"
      dismissible
      class="mb-0"
      @input="$emit('dismiss', job.id)"
    >
      <div>{{ $t(`app.tltg_addons.job.${job.action}.${job.state}`, { name }) }}</div>
      <div
        v-if="job.state === 'failed' && job.message"
        class="text-body-2 tltg-addon-job__message"
      >
        {{ job.message }}
      </div>
    </v-alert>

    <template v-if="job.log.length > 0">
      <app-btn
        small
        text
        color="primary"
        class="mt-1 px-1"
        @click="showLog = !logVisible"
      >
        <v-icon
          small
          left
          :class="{ 'rotate-180': logVisible }"
        >
          $chevronDown
        </v-icon>
        {{ logVisible ? $t('app.tltg_addons.btn.hide_log') : $t('app.tltg_addons.btn.show_log') }}
      </app-btn>

      <pre
        v-if="logVisible"
        ref="log"
        class="tltg-addon-job__log mt-1"
      >{{ job.log.join('\n') }}</pre>
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Ref, Vue, Watch } from 'vue-property-decorator'
import type { TltgAddonJob as AddonJob } from '@/util/tltg-addons'

@Component({})
export default class TltgAddonJob extends Vue {
  @Prop({ type: Object, required: true })
  readonly job!: AddonJob

  @Prop({ type: String, required: true })
  readonly name!: string

  @Ref('log')
  readonly logElement?: HTMLElement

  // null follows the job: the log opens by itself when the job fails.
  showLog: boolean | null = null

  get logVisible (): boolean {
    return this.showLog ?? this.job.state === 'failed'
  }

  @Watch('job.id')
  onJobChanged () {
    this.showLog = null
  }

  @Watch('job.log')
  async onLogChanged () {
    const element = this.logElement

    if (!element) {
      return
    }

    // Follow the newest line unless the reader has scrolled back.
    const following = element.scrollTop + element.clientHeight >= element.scrollHeight - 8

    await this.$nextTick()

    if (following) {
      element.scrollTop = element.scrollHeight
    }
  }
}
</script>

<style lang="scss" scoped>
  .tltg-addon-job__message {
    overflow-wrap: anywhere;
  }

  .tltg-addon-job__log {
    max-height: 240px;
    overflow: auto;
    padding: 8px;
    border-radius: 4px;
    background-color: rgba(128, 128, 128, 0.12);
    font-family: 'Roboto Mono', monospace;
    font-size: 0.75rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
