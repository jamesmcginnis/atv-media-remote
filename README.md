# ATV Media Remote

A sleek, Apple-inspired custom media player card for [Home Assistant](https://www.home-assistant.io/) with a built-in Apple TV remote control, multi-device switching, live progress tracking, and a fully visual editor. No YAML required.

<p align="center">
  <img src="preview1.png" alt="Compact / minimised view" width="48%">
  <img src="preview2.png" alt="Expanded / maximised view" width="48%">
</p>

---

## Features

- **Compact & expanded modes** — a minimal strip for day-to-day use, expandable to full album art with one tap
- **Apple TV remote control** — touchpad overlay with Up / Down / Left / Right / Select, Back, TV home, and Power on/off
- **Smart volume control** — automatically detects Apple TV and uses `remote.send_command` for reliable volume across all apps (YouTube, Infuse, Plex, etc.); falls back to standard `volume_set` for all other media players
- **Mini remote shortcut** — tap the remote icon in compact mode to jump straight into the full remote view in one tap
- **Multi-device switching** — manage and reorder multiple media players; auto-switch to whichever is currently playing
- **Live progress bar** — updates every second with accurate position interpolation; click or tap to seek
- **Colour customisation** — individual colour pickers for the main accent, volume slider, song title, and artist name
- **Drag-and-drop visual editor** — fully touch-friendly entity management with no YAML needed
- **Press glow effects** — buttons illuminate on press for a natural, physical feel

---

## Preview

<p align="center">
  <img src="preview3.png" alt="Apple TV remote control view" width="48%">
  <img src="preview4.png" alt="Visual editor" width="48%">
</p>

---

## Requirements

- Home Assistant 2023.1 or later
- One or more `media_player` entities
- A corresponding `remote.*` entity for Apple TV remote and smart volume features (provided automatically by the [Apple TV integration](https://www.home-assistant.io/integrations/apple_tv/))

---

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Click on **Frontend**
3. Click the three dots menu in the top right
4. Select **Custom repositories**
5. Add this repository URL and select **Dashboard** as the category
6. Click **Install**
7. Restart Home Assistant

### Manual

1. Download `atv-media-remote.js` from this repository
2. Copy it to your Home Assistant `config/www/` folder
3. Go to **Settings → Dashboards → Resources** and add:

   | Field | Value |
   |---|---|
   | URL | `/local/atv-media-remote.js` |
   | Type | `JavaScript Module` |

4. Refresh your browser cache (Ctrl + Shift + R / Cmd + Shift + R)

---

## Adding the Card to a Dashboard

1. Open a Dashboard and click **Edit** (pencil icon, top right)
2. Click **+ Add Card**
3. Scroll to the bottom of the card list and select **ATV Media Remote**
4. Use the visual editor to configure your entities and colours — no YAML required
5. Click **Save**

Alternatively, add the card manually in YAML:

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

---

## Configuration Options

All options are available in the visual editor. The table below is for reference when using YAML.

| Option | Type | Default | Description |
|---|---|---|---|
| `entities` | list | **required** | One or more `media_player` entity IDs. The first entry is shown on load. |
| `accent_color` | string | `#007AFF` | Colour of the progress bar and active shuffle/repeat icons |
| `volume_accent` | string | `#007AFF` | Colour of the volume slider |
| `title_color` | string | `#ffffff` | Colour of the song or show title text |
| `artist_color` | string | `#ffffff` | Colour of the artist or friendly name text |
| `auto_switch` | boolean | `true` | Automatically switch to whichever entity is currently playing |

---

## Using the Card

### Compact Mode (default)

The card loads in a compact strip showing the album art thumbnail, track title, artist, playback controls, and volume slider. This is ideal for dashboards where space is limited.

| Element | Action |
|---|---|
| **Thumbnail** | Tap to open the Home Assistant media info panel |
| **⏮ Prev** | Skip to the previous track |
| **▶ Play / ⏸ Pause** | Toggle playback |
| **⏭ Next** | Skip to the next track |
| **Remote icon** | Tap to expand the card and open the remote control view in one tap |
| **Volume slider** | Drag left/right to decrease/increase volume |
| **⤢ icon** (top right) | Expand to full view |

---

### Expanded Mode

The card shows full-size album art with all playback controls, shuffle, repeat, and the entity selector.

| Element | Action |
|---|---|
| **Album art** | Tap to open the Home Assistant media info panel |
| **Progress bar** | Tap anywhere along the bar to seek to that position |
| **Shuffle icon** | Toggle shuffle on/off. Highlights in your accent colour when active |
| **⏮ / ▶⏸ / ⏭** | Previous / Play-Pause / Next |
| **Repeat icon** | Cycle through: Off → Repeat All → Repeat One |
| **Volume slider** | Drag to adjust volume |
| **Remote icon** (bottom right of art) | Open or close the Apple TV remote overlay |
| **Entity selector** | Switch between your configured media players |
| **⤡ icon** (top right) | Collapse back to compact mode |

---

### Remote Control View

Tapping the remote icon replaces the album art with a full Apple-style remote interface. All card controls below (progress bar, playback buttons, volume slider, entity selector) remain fully functional while the remote is open.

<br>

**Top row buttons**

| Button | Command | Description |
|---|---|---|
| **Back** | `menu` | Go back within the current app |
| **TV** | `home` | Return to the Apple TV home screen |
| **Power** | `turn_on` / `turn_off` | Toggle Apple TV power. The button glows red when the device is on |

<br>

**Touchpad**

The large rounded rectangle is the navigation touchpad, styled to match the Apple Remote app on iPhone.

| Area | Action |
|---|---|
| **Top edge** | Navigate Up |
| **Bottom edge** | Navigate Down |
| **Left edge** | Navigate Left |
| **Right edge** | Navigate Right |
| **Centre button** | Select / OK — confirms the currently highlighted item |

> **Tip:** Tap the remote icon in compact mode to expand the card **and** enter the remote view simultaneously — no need to expand first.

---

### Volume Control

The card automatically detects whether the selected media player has a paired Apple TV remote entity and adjusts its volume behaviour accordingly.

**Apple TV (remote entity detected)**

When a `remote.*` entity is found matching your `media_player.*` entity name, the volume slider sends `volume_up` and `volume_down` remote commands instead of `volume_set`. This works reliably across all Apple TV apps including:

- YouTube
- Infuse
- Plex
- Netflix
- Disney+
- Any other app that manages its own audio pipeline

The slider is throttled to send one command immediately on first movement, then one command every ~380ms while dragging, with a trailing command ensuring the final position always registers. This prevents commands being dropped by the integration while keeping the control feeling responsive.

**Standard media players**

For any media player without a matched remote entity, the slider uses `media_player.volume_set` for precise, absolute volume control — exactly as normal. No configuration is required; the detection is fully automatic.

---

## Multi-Device Switching

Add multiple `media_player` entities to the `entities` list. The card will:

- Show an entity selector dropdown in expanded mode to switch between devices manually
- Automatically switch to any entity that starts playing when `auto_switch: true`
- Preserve manual selections — once you manually choose a device, auto-switch will not override it until you switch away or that device becomes inactive

To change the order entities appear in the selector, open the visual editor and drag the handles next to each device name.

---

## Visual Editor

Open the card editor by clicking the pencil icon on the card while in dashboard edit mode. The editor provides:

| Section | Description |
|---|---|
| **Main Accent** | Colour picker for the progress bar fill and active shuffle/repeat button colour |
| **Volume Accent** | Separate colour picker for the volume slider thumb and track |
| **Song Title** | Colour picker for the track or show title text |
| **Song Artist** | Colour picker for the artist name or device friendly name |
| **Auto Switch** | Toggle to enable or disable automatic device switching |
| **Manage & Reorder Media Players** | Searchable, drag-and-drop list — check a device to add it, uncheck to remove it, drag the handle to reorder |

---

## Apple TV Setup

Install and configure the [Apple TV integration](https://www.home-assistant.io/integrations/apple_tv/) in Home Assistant. This automatically creates both a `media_player.*` and a `remote.*` entity for each Apple TV on your network.

The card derives the remote entity name automatically — if your media player is `media_player.apple_tv_lounge`, the card sends remote commands to `remote.apple_tv_lounge`. Ensure both entities are available and not disabled in **Settings → Devices & Services → Apple TV**.

---

## Troubleshooting

**Volume slider has no effect on Apple TV while using YouTube, Infuse, etc.**
Ensure the Apple TV integration is installed and that a `remote.*` entity exists for your device. Verify the remote entity is enabled in **Settings → Devices & Services → Apple TV → entities**. The card will only use remote-based volume if it can find a matching `remote.*` entity.

**Remote commands do not respond**
Confirm your Apple TV is powered on and the Home Assistant Apple TV integration shows as connected. Test connectivity manually via **Developer Tools → Services**, call `remote.send_command` with your remote entity ID and `command: select`.

**Power button does not turn Apple TV on**
The Apple TV must be configured to wake on network access. In Apple TV Settings go to **AirPlay and Handoff** and ensure **Allow Access** is set appropriately. Some Apple TV models require **Wake on Network Access** to be enabled.

**Card not appearing after installation**
Clear your browser cache with Ctrl + Shift + R (Windows/Linux) or Cmd + Shift + R (Mac). If using the Home Assistant mobile app, fully close and reopen it.

**Auto-switch is not working**
Ensure `auto_switch: true` is set in the card config and that the playing entity is included in your `entities` list. Note that manual selections are respected — switch to a different entity or wait for the current one to stop playing to re-enable auto-switch.

**Progress bar not updating**
The progress bar interpolates position locally every second and re-syncs from HA state on every state update. If the bar appears frozen, check that your media player entity is reporting `media_position` and `media_position_updated_at` attributes — not all integrations provide these.

---
