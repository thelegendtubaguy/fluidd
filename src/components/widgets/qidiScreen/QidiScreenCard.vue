<template>
  <collapsable-card
    :title="$t('app.qidi_screen.title.printer_screen')"
    icon="$screenshot"
    :lazy="false"
    draggable
    layout-path="dashboard.tltg-screen-card"
    @collapsed="onCollapsed"
  >
    <template
      v-if="!collapsed"
      #menu
    >
      <app-btn
        small
        class="ms-1 my-1"
        :disabled="!touch && !control"
        @click="toggleControl"
      >
        <v-icon
          small
          class="mr-1"
        >
          {{ control ? '$lockOpen' : '$lock' }}
        </v-icon>
        {{ control ? $t('app.qidi_screen.btn.control_on') : $t('app.qidi_screen.btn.view_only') }}
      </app-btn>
      <app-btn
        small
        class="ms-1 my-1"
        @click="openFullscreen"
      >
        <v-icon
          small
          class="mr-1"
        >
          $fullScreen
        </v-icon>
        {{ $t('app.qidi_screen.btn.full_screen') }}
      </app-btn>
    </template>

    <qidi-screen-view
      v-if="!collapsed"
      ref="view"
      :control="control"
      @touch="touch = $event"
    />
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Ref, Vue } from 'vue-property-decorator'
import QidiScreenView from './QidiScreenView.vue'

@Component({
  components: { QidiScreenView }
})
export default class QidiScreenCard extends Vue {
  @Ref('view')
  readonly view?: QidiScreenView

  collapsed = true
  control = false
  touch = false

  // Control presses the real touchscreen, so it starts off and needs confirming.
  async toggleControl () {
    if (this.control) {
      this.control = false
      return
    }

    const confirmed = await this.$confirm(this.$t('app.qidi_screen.msg.confirm_control').toString(), {
      title: this.$t('app.qidi_screen.title.control').toString(),
      color: 'card-heading',
      icon: '$error'
    })

    // The card may have collapsed while the dialog was open.
    this.control = !!confirmed && !this.collapsed
  }

  openFullscreen () {
    this.view?.$el.requestFullscreen?.()
  }

  onCollapsed (value: boolean) {
    this.collapsed = value

    if (value) {
      this.control = false
      this.touch = false
    }
  }
}
</script>
