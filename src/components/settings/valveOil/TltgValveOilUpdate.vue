<template>
  <div>
    <template v-if="update.state === 'running'">
      <div class="text-body-2 mb-1">
        {{ $t(`app.tltg_valve_oil.update.running.${update.kind}`) }}
      </div>
      <v-progress-linear
        indeterminate
        color="primary"
        class="mb-1"
      />
      <div class="text-body-2 tltg-valve-oil-update__message">
        {{ update.stepLabel || $t('app.tltg_valve_oil.update.starting') }}
      </div>
      <div
        v-if="update.resumed"
        class="text-caption secondary--text"
      >
        {{ $t('app.tltg_valve_oil.update.resumed') }}
      </div>
      <div class="text-caption warning--text">
        {{ $t('app.tltg_valve_oil.update.dont_power_off') }}
      </div>
    </template>

    <v-alert
      v-else
      dense
      text
      :type="alertType"
      dismissible
      class="mb-0"
      @input="$emit('dismiss', update.id)"
    >
      <div>
        {{ title }}
        <span
          v-if="update.finishedAt"
          class="text-caption"
        >
          · {{ $filters.formatDateTime(update.finishedAt) }}
        </span>
      </div>
      <div
        v-if="update.stepLabel"
        class="text-body-2 tltg-valve-oil-update__message"
      >
        {{ $t('app.tltg_valve_oil.update.stopped_at', { step: update.stepLabel }) }}
      </div>
      <div
        v-if="update.message"
        class="text-body-2 tltg-valve-oil-update__message"
      >
        {{ update.message }}
      </div>
      <div
        v-if="update.state === 'interrupted'"
        class="text-body-2"
      >
        {{ $t('app.tltg_valve_oil.update.finish_interrupted') }}
      </div>
      <div
        v-else-if="update.canContinue && !recoveryRequired"
        class="text-body-2"
      >
        {{ $t('app.tltg_valve_oil.update.continue_failed') }}
      </div>
    </v-alert>

    <template v-if="update.log.length > 0">
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
        {{ logVisible ? $t('app.tltg_valve_oil.btn.hide_log') : $t('app.tltg_valve_oil.btn.show_log') }}
      </app-btn>

      <pre
        v-if="logVisible"
        ref="log"
        class="tltg-valve-oil-update__log mt-1"
      >{{ update.log.join('\n') }}</pre>
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Ref, Vue, Watch } from 'vue-property-decorator'
import type { TltgUpdateView } from '@/util/tltg-status'

@Component({})
export default class TltgValveOilUpdate extends Vue {
  @Prop({ type: Object, required: true })
  readonly update!: TltgUpdateView

  // A recovery comes first, as the update's message says; Update now waits for it.
  @Prop({ type: Boolean, default: false })
  readonly recoveryRequired!: boolean

  @Ref('log')
  readonly logElement?: HTMLElement

  // null follows the update: the log opens by itself when it fails.
  showLog: boolean | null = null

  get logVisible (): boolean {
    return this.showLog ?? this.update.state === 'failed'
  }

  get title (): string {
    return this.update.state === 'failed' && this.update.firmware
      ? this.$t('app.tltg_valve_oil.update.failed_firmware').toString()
      : this.$t(`app.tltg_valve_oil.update.${this.update.state}.${this.update.kind}`).toString()
  }

  get alertType (): string {
    switch (this.update.state) {
      case 'succeeded':
        return 'success'
      case 'interrupted':
        return 'warning'
      default:
        return 'error'
    }
  }

  @Watch('update.id')
  onUpdateChanged () {
    this.showLog = null
  }

  @Watch('update.log')
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
  .tltg-valve-oil-update__message {
    overflow-wrap: anywhere;
  }

  .tltg-valve-oil-update__log {
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
