<template>
  <v-sheet
    outlined
    rounded
    class="px-3 py-2"
  >
    <div class="tltg-octoeverywhere__row">
      <span class="secondary--text">{{ $t('app.tltg_addons.label.service') }}</span>
      <span :class="`${serviceColor}--text`">{{ serviceText }}</span>
    </div>

    <div
      v-if="unavailable"
      class="text-body-2 secondary--text mt-1"
    >
      {{ unavailable }}
    </div>

    <template v-else-if="status">
      <div class="tltg-octoeverywhere__row">
        <span class="secondary--text">{{ $t('app.tltg_addons.label.octoeverywhere') }}</span>
        <span :class="connected ? 'success--text' : 'warning--text'">
          {{ connected ? $t('app.tltg_addons.label.connected') : $t('app.tltg_addons.label.not_connected') }}
        </span>
      </div>

      <div class="tltg-octoeverywhere__row">
        <span class="secondary--text">{{ $t('app.tltg_addons.label.account') }}</span>
        <span
          v-if="linked"
          class="d-inline-flex align-center"
        >
          <v-chip
            small
            outlined
            color="success"
          >
            {{ $t('app.tltg_addons.label.linked') }}
          </v-chip>
          <a
            href="https://octoeverywhere.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-2"
          >
            {{ $t('app.tltg_addons.btn.dashboard') }}
            <v-icon
              small
              color="primary"
            >
              $openInNew
            </v-icon>
          </a>
        </span>
        <span
          v-else
          class="warning--text"
        >
          {{ $t('app.tltg_addons.label.not_linked') }}
        </span>
      </div>

      <template v-if="!linked">
        <div class="d-flex flex-wrap justify-end mt-1">
          <app-btn
            v-if="linkUrl"
            small
            color="primary"
            class="ml-2 my-1"
            :href="linkUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ $t('app.tltg_addons.btn.link_account') }}
            <v-icon
              small
              right
            >
              $openInNew
            </v-icon>
          </app-btn>
          <app-btn
            small
            outlined
            color="primary"
            class="ml-2 my-1"
            :loading="loadingCode"
            @click="showLinkCode"
          >
            {{ $t('app.tltg_addons.btn.show_link_code') }}
          </app-btn>
        </div>

        <v-alert
          v-if="codeError"
          dense
          text
          type="error"
          class="mt-2 mb-0"
        >
          {{ codeError }}
        </v-alert>

        <div
          v-if="linkCode"
          class="text-center mt-2"
        >
          <div class="text-h4 font-weight-medium tltg-octoeverywhere__code">
            {{ linkCode.code }}
          </div>
          <div
            v-if="linkCode.url"
            class="text-body-2"
          >
            {{ $t('app.tltg_addons.msg.enter_code_at') }}
            <a
              :href="linkCode.url"
              target="_blank"
              rel="noopener noreferrer"
            >{{ linkCode.url }}</a>
          </div>
          <div
            v-if="linkCodeExpiresAt"
            class="text-caption secondary--text"
          >
            {{ $t('app.tltg_addons.msg.code_expires', { time: $filters.formatTime(linkCodeExpiresAt) }) }}
          </div>
        </div>
      </template>
    </template>
  </v-sheet>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import { parseTltgAddonLinkCode, type TltgAddon, type TltgAddonLinkCode } from '@/util/tltg-addons'

@Component({})
export default class TltgOctoEverywhereStatus extends Vue {
  @Prop({ type: Object, required: true })
  readonly addon!: TltgAddon

  @Prop({ type: Function, required: true })
  readonly request!: (path: string, method?: 'GET' | 'POST') => Promise<unknown>

  linkCode: TltgAddonLinkCode | null = null
  linkCodeExpiresAt = 0
  loadingCode = false
  codeError = ''
  expiryTimer: ReturnType<typeof setTimeout> | undefined = undefined

  get status (): Record<string, unknown> | null {
    return this.addon.status
  }

  get unavailable (): string {
    const unavailable = this.status?.unavailable

    return typeof unavailable === 'string' ? unavailable : ''
  }

  get connected (): boolean {
    return this.status?.connected === true
  }

  get linked (): boolean {
    return this.status?.linked === true
  }

  get linkUrl (): string {
    const url = this.status?.link_url

    return typeof url === 'string' && /^https:\/\//.test(url) ? url : ''
  }

  get serviceState (): string {
    return this.addon.service?.active ?? 'unknown'
  }

  get serviceText (): string {
    const key = `app.tltg_addons.service.${this.serviceState}`

    return this.$te(key)
      ? this.$t(key).toString()
      : this.serviceState
  }

  get serviceColor (): string {
    switch (this.serviceState) {
      case 'active':
        return 'success'
      case 'failed':
        return 'error'
      case 'activating':
        return 'info'
      default:
        return 'warning'
    }
  }

  @Watch('linked')
  onLinkedChanged (linked: boolean) {
    if (linked) {
      this.clearLinkCode()
    }
  }

  beforeDestroy () {
    clearTimeout(this.expiryTimer)
  }

  clearLinkCode () {
    clearTimeout(this.expiryTimer)
    this.linkCode = null
    this.linkCodeExpiresAt = 0
  }

  async showLinkCode () {
    this.loadingCode = true
    this.codeError = ''

    try {
      const linkCode = parseTltgAddonLinkCode(await this.request(`/addons/${encodeURIComponent(this.addon.id)}/link-code`, 'POST'))

      this.clearLinkCode()

      if (!linkCode) {
        this.codeError = this.$t('app.tltg_addons.msg.code_unavailable').toString()
        return
      }

      this.linkCode = linkCode

      if (linkCode.expires_in > 0) {
        this.linkCodeExpiresAt = Date.now() + linkCode.expires_in * 1000
        this.expiryTimer = setTimeout(() => this.clearLinkCode(), linkCode.expires_in * 1000)
      }
    } catch (e) {
      this.clearLinkCode()
      this.codeError = e instanceof Error ? e.message : String(e)
    } finally {
      this.loadingCode = false
    }
  }
}
</script>

<style lang="scss" scoped>
  .tltg-octoeverywhere__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 28px;
    column-gap: 16px;
  }

  .tltg-octoeverywhere__code {
    font-family: 'Roboto Mono', monospace !important;
    letter-spacing: 0.2em !important;
  }
</style>
