# ATV Media Remote

A sleek, Apple-inspired custom media player card for Home Assistant with a built-in Apple TV remote control, smart volume handling, multi-device switching, and a fully visual editor.

<p align="center">
  <img src="preview1.png" alt="Compact view" width="48%">
  <img src="preview2.png" alt="Expanded view" width="48%">
</p>

---

## What It Does

**ATV Media Remote** combines a beautiful media player card with a fully functional Apple TV remote — all in one card. In compact mode it sits neatly in your dashboard as a slim playback strip. Tap to expand and you get full album art, a seekable progress bar, shuffle, repeat, and a remote control overlay that turns the card into an Apple TV trackpad.

---

## Features

- **Compact & expanded modes** — minimal strip for everyday use, full album art on demand
- **Apple TV remote overlay** — Up / Down / Left / Right / Select touchpad, Back, TV home, and Power on/off with live state indicator
- **Smart volume control** — detects Apple TV automatically and uses remote button commands instead of `volume_set`, so volume works correctly in every app including YouTube, Infuse, Plex, Netflix, and Disney+
- **Mini remote shortcut** — single tap in compact mode expands the card and opens the remote simultaneously
- **Multi-device switching** — add multiple media players, drag to reorder, auto-switch to whichever is playing
- **Live progress bar** — interpolated second-by-second updates, tap anywhere to seek
- **Full colour customisation** — separate colour pickers for accent, volume slider, song title, and artist name
- **Visual editor** — drag-and-drop entity management, no YAML required
- **Press glow effects** — tactile button feedback throughout

---

## Remote Control

<p align="center">
  <img src="preview3.png" alt="Remote control view" width="48%">
  <img src="preview4.png" alt="Visual editor" width="48%">
</p>

The remote overlay features a large Apple Remote-style rounded rectangle touchpad. Tap the edges for directional navigation and the centre to select. Back, TV, and Power buttons sit above the pad. The Power button glows red when the Apple TV is on so you always know the device state at a glance.

---

## Volume on Apple TV

Most Apple TV apps — YouTube, Infuse, Plex, and others — manage their own audio pipeline and ignore `media_player.volume_set`. This card detects when an Apple TV remote entity is present and automatically switches to sending `remote.send_command` volume steps instead. Volume control works reliably across every app with no configuration needed.

---

## Quick Setup

1. Open HACS in Home Assistant and click **Frontend**
2. Click the three dots menu (top right) and select **Custom repositories**
3. Add `https://github.com/jamesmcginnis/atv-media-remote` and set the category to **Dashboard**
4. Click **Install**, then restart Home Assistant
5. Add the card to any dashboard and configure your entities and colours in the visual editor

For Apple TV features, ensure the Home Assistant [Apple TV integration](https://www.home-assistant.io/integrations/apple_tv/) is installed — it automatically creates the `remote.*` entity the card needs.

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
```

| Option | Default | Description |
|---|---|---|
| `entities` | required | One or more `media_player` entity IDs |
| `accent_color` | `#007AFF` | Progress bar and active icon colour |
| `volume_accent` | `#007AFF` | Volume slider colour |
| `title_color` | `#ffffff` | Song title text colour |
| `artist_color` | `#ffffff` | Artist name text colour |
| `auto_switch` | `true` | Switch to whichever entity is currently playing |
