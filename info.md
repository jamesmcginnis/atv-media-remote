# ATV Media Remote

A sleek, Apple-inspired custom media player card for Home Assistant with a built-in Apple TV remote control, smart volume handling, multi-device switching, and a fully visual editor. No YAML required.

<p align="center">
  <img src="preview1.png" alt="Compact view" width="48%">
  <img src="preview2.png" alt="Expanded view" width="48%">
</p>

---

## What It Does

**ATV Media Remote** replaces the default media player card with something that actually feels good to use. In compact mode it sits as a slim strip in your dashboard. Tap to expand and you get full album art, a seekable progress bar, shuffle and repeat, and volume control. Tap the remote icon and the album art gives way to an Apple Remote-style touchpad for full navigation control — all without leaving the card.

The card remembers how you like it. Set your preferred startup view — compact, maximised, or remote control — and it opens that way every single time you navigate to the page.

---

## Features

- **Three view modes** — compact strip, full expanded view, and Apple TV remote overlay
- **Configurable startup view** — card always opens in compact, maximised, or remote mode
- **Apple TV remote** — touchpad navigation, Back, TV home, and Power with live on/off indicator
- **Smart volume** — detects Apple TV automatically and uses remote commands for reliable volume in every app; falls back to standard volume control for other players
- **Volume slider or buttons** — choose a full-width drag slider or flanking + / − buttons
- **Mini remote shortcut** — one tap in compact mode jumps straight into the remote view
- **Multi-device switching** — manage multiple media players with drag-to-reorder and auto-switch
- **Live progress bar** — second-by-second updates, tap anywhere to seek
- **Full colour customisation** — individual pickers for accent, volume, title, and artist
- **Visual editor** — no YAML needed

---

## Remote Control & Volume

<p align="center">
  <img src="preview3.png" alt="Remote control view" width="48%">
  <img src="preview4.png" alt="Visual editor" width="48%">
</p>

The remote overlay features a large Apple Remote-style touchpad. Tap the edges to navigate, the centre to select. Back, TV home, and Power sit above. The Power button glows red when the Apple TV is on.

Volume is handled intelligently — if a `remote.*` entity exists for your Apple TV, the card sends `volume_up` and `volume_down` remote commands automatically. This works in every app including YouTube, Infuse, Plex, Netflix, and Disney+, which ignore the standard volume service. No configuration needed; the detection is fully automatic.

---

## Startup View

Set your preferred startup view in the visual editor and the card will always open in that state when you navigate to the page or reload the app. Changing the setting takes effect immediately — no page reload required.

---

## Quick Setup

1. Open HACS and click **Frontend**
2. Click the three dots menu and select **Custom repositories**
3. Add `https://github.com/jamesmcginnis/atv-media-remote` with category **Dashboard**
4. Click **Install** and restart Home Assistant
5. Add the card to any dashboard and configure in the visual editor

For full Apple TV support, ensure the Home Assistant [Apple TV integration](https://www.home-assistant.io/integrations/apple_tv/) is installed — it creates the `remote.*` entity the card needs automatically.

---

## Configuration

```yaml
type: custom:atv-media-remote
entities:
  - media_player.apple_tv_living_room
  - media_player.bedroom_speaker
accent_color: "#007AFF"
volume_accent: "#007AFF"
title_color: "#ffffff"
artist_color: "#ffffff"
auto_switch: true
show_entity_selector: true
volume_control: slider
startup_mode: compact
```

| Option | Default | Description |
|---|---|---|
| `entities` | required | One or more `media_player` entity IDs |
| `accent_color` | `#007AFF` | Progress bar and active icon colour |
| `volume_accent` | `#007AFF` | Volume slider colour |
| `title_color` | `#ffffff` | Song title text colour |
| `artist_color` | `#ffffff` | Artist name text colour |
| `auto_switch` | `true` | Switch to whichever entity is currently playing |
| `show_entity_selector` | `true` | Show entity picker in expanded view |
| `volume_control` | `slider` | `slider` or `buttons` |
| `startup_mode` | `compact` | `compact`, `maximised`, or `remote` |
