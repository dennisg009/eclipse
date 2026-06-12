// Timeline controller: play/pause, speed, clock readout, "next eclipse" jump.
// Owns no time itself — it reports intent via callbacks and renders state.

export const SPEEDS = [
  { label: '1 min/s', days: 1 / 1440 },
  { label: '1 hour/s', days: 1 / 24 },
  { label: '6 hours/s', days: 0.25 },
  { label: '1 day/s', days: 1 },
  { label: '3 days/s', days: 3 },
  { label: '10 days/s', days: 10 },
  { label: '30 days/s', days: 30 },
  { label: '100 days/s', days: 100 },
  { label: '1 year/s', days: 365 },
  { label: '5 years/s', days: 1825 }
]

export class Timeline {
  constructor({ onPlayToggle, onSpeed, onNextEclipse }) {
    this.playing = false
    this.playBtn = document.getElementById('play')
    this.clock = document.getElementById('clock')
    this.speed = document.getElementById('speed')
    this.speedLabel = document.getElementById('speed-label')
    this.nextBtn = document.getElementById('next-eclipse')

    this.playBtn.addEventListener('click', () => {
      this.setPlaying(!this.playing)
      onPlayToggle(this.playing)
    })
    this.speed.addEventListener('input', () => {
      this.speedLabel.textContent = SPEEDS[+this.speed.value].label
      onSpeed(SPEEDS[+this.speed.value].days)
    })
    this.nextBtn.addEventListener('click', () => onNextEclipse())

    this.speedLabel.textContent = SPEEDS[+this.speed.value].label
  }

  speedDays() { return SPEEDS[+this.speed.value].days }

  setSpeedIndex(i) {
    this.speed.value = String(i)
    this.speedLabel.textContent = SPEEDS[i].label
  }

  setPlaying(on) {
    this.playing = on
    this.playBtn.textContent = on ? '❚❚ Pause' : '▶ Play'
  }

  setClock(date) {
    this.clock.textContent = date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  }
}
