# ATV Media Remote

A sleek, Apple-inspired custom media player card for [Home Assistant](https://www.home-assistant.io/) with a built-in Apple TV remote control, smart volume handling, multi-device switching, and a fully visual editor. No YAML required.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=atv-media-remote&category=dashboard)

<p align="center">
  <img src="preview1.png" alt="Compact view" width="32%">
  <img src="preview2.png" alt="Maximised view" width="32%">
  <img src="preview3.png" alt="Remote control view" width="32%">
</p>

-----

## Features

- **Three view modes** — compact strip, full expanded view, and Apple TV remote control overlay
- **Configurable startup view** — choose whether the card opens in compact, maximised, or remote control mode every time
- **Apple TV remote control** — rounded rectangle touchpad with Up / Down / Left / Right / Select navigation, Back, TV home, Apps launcher, and Power on/off with live state indicator
- **App launcher** — tap Apps to see all installed apps on your Apple TV and launch any of them instantly
- **Smart volume control** — automatically detects Apple TV and uses `remote.send_command` for reliable volume across every app (YouTube, Infuse, Plex, Netflix, Disney+ and more); falls back to standard `volume_set` for all other media players
- **Volume slider or buttons** — choose between a full-width drag slider or flanking + / − buttons to match your preference
- **Mini remote shortcut** — single tap in compact mode expands the card and opens the remote simultaneously
- **Multi-device switching** — add multiple media players, drag to reorder, auto-switch to whichever is currently playing
- **Live progress bar** — interpolated second-by-second updates, tap anywhere to seek
- **Full colour customisation** — separate colour pickers for accent, volume slider, song title, and artist name
- **Visual editor** — drag-and-drop entity management with no YAML required
- **Press glow effects** — tactile button feedback throughout

-----

## Visual Editor

<p align="center">
  <img src="preview4.png" alt="Visual editor" width="60%">
</p>

-----

## Requirements

- Home Assistant 2023.1 or later
- One or more `media_player` entities
- A corresponding `remote.*` entity for Apple TV remote and smart volume features (provided automatically by the [Apple TV integration](https://www.home-assistant.io/integrations/apple_tv/))

-----

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
1. Click on **Frontend**
1. Click the three dots menu in the top right and select **Custom repositories**
1. Add `https://github.com/jamesmcginnis/atv-media-remote` and select **Dashboard** as the category
1. Click **Install**
1. Restart Home Assistant

### Manual

1. Download `atv-media-remote.js` from this repository
1. Copy it to your Home Assistant `config/www/` folder
1. Go to **Settings → Dashboards → Resources** and add:
   
   |Field|Value                       |
   |-----|----------------------------|
   |URL  |`/local/atv-media-remote.js`|
   |Type |`JavaScript Module`         |
1. Refresh your browser cache (Ctrl + Shift + R / Cmd + Shift + R)

-----

## Adding the Card to a Dashboard

1. Open a Dashboard and click **Edit** (pencil icon, top right)
1. Click **+ Add Card**
1. Scroll to the bottom and select **ATV Media Remote**
1. Configure your entities and preferences using the visual editor
1. Click **Save**

Alternatively, configure the card manually in YAML:

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

-----

## Configuration Options

All options are available in the visual editor. The table below is for YAML reference.

|Option                |Type   |Default     |Description                                                  |
|----------------------|-------|------------|-------------------------------------------------------------|
|`entities`            |list   |**required**|One or more `media_player` entity IDs                        |
|`accent_color`        |string |`#007AFF`   |Colour of the progress bar and active shuffle/repeat icons   |
|`volume_accent`       |string |`#007AFF`   |Colour of the volume slider                                  |
|`title_color`         |string |`#ffffff`   |Colour of the song or show title text                        |
|`artist_color`        |string |`#ffffff`   |Colour of the artist or friendly name text                   |
|`auto_switch`         |boolean|`true`      |Automatically switch to whichever entity is currently playing|
|`show_entity_selector`|boolean|`true`      |Show the entity picker dropdown in expanded view             |
|`volume_control`      |string |`slider`    |`slider` for a drag slider, `buttons` for + / − buttons      |
|`startup_mode`        |string |`compact`   |Starting view: `compact`, `maximised`, or `remote`           |

-----

## Using the Card

### Compact Mode

The card sits as a slim strip showing the album art thumbnail, track title, artist, a progress bar, playback controls, and volume. Recommended for dashboards where space is limited.

Every time you navigate back to the page or reload the app, the card returns to whichever view you have set as the **Startup View**.

|Element               |Action                                                            |
|----------------------|------------------------------------------------------------------|
|**Thumbnail**         |Tap to open the Home Assistant media info panel                   |
|**Progress bar**      |Thin accent-coloured bar showing current playback position        |
|**📱 Remote icon**     |Tap to expand the card and open the remote control view in one tap|
|**⏮ / ▶⏸ / ⏭**        |Previous / Play-Pause / Next                                      |
|**Volume**            |Drag slider or tap + / − buttons depending on your setting        |
|**⤢ icon** (top right)|Expand to full view                                               |

-----

### Expanded Mode

The card shows full-size album art with all controls and a seekable progress bar.

|Element                         |Action                                                        |
|--------------------------------|--------------------------------------------------------------|
|**Album art**                   |Tap to open the Home Assistant media info panel               |
|**Progress bar**                |Tap anywhere along the bar to seek to that position           |
|**Shuffle icon**                |Toggle shuffle on/off. Highlights in accent colour when active|
|**⏮ / ▶⏸ / ⏭**                  |Previous / Play-Pause / Next                                  |
|**Repeat icon**                 |Cycle through Off → Repeat All → Repeat One                   |
|**Volume**                      |Drag slider or tap + / − buttons depending on your setting    |
|**📱 Remote icon** (on album art)|Open or close the Apple TV remote overlay                     |
|**Entity selector**             |Switch between your configured media players                  |
|**⤡ icon** (top right)          |Collapse back to compact mode                                 |

-----

### Remote Control View

Tapping the remote icon replaces the album art with a full Apple Remote-style interface. All card controls below — progress bar, playback buttons, volume, entity selector — remain fully functional while the remote is open.

**Top row**

|Button    |Description                                                      |
|----------|-----------------------------------------------------------------|
|**Back**  |Go back within the current app (`menu` command)                  |
|**TV**    |Return to the Apple TV home screen (`home` command)              |
|**Apps**  |Open a dropdown listing all installed apps — tap any to launch it|
|**Power** |Toggle Apple TV power. Glows red when the device is on           |
|**⤡ icon**|Collapse the card to compact mode without leaving the remote     |

**Touchpad**

|Area             |Action        |
|-----------------|--------------|
|**Top edge**     |Navigate Up   |
|**Bottom edge**  |Navigate Down |
|**Left edge**    |Navigate Left |
|**Right edge**   |Navigate Right|
|**Centre button**|Select / OK   |


> **Tip:** The 📱 icon in compact mode expands the card and enters the remote view in a single tap.

-----

### App Launcher

Tapping **Apps** in the remote view reads the `source_list` attribute from your Apple TV media player entity and displays all installed apps in a scrollable dropdown. The currently active app is highlighted. Tap any app to launch it via `media_player.select_source`. The dropdown closes automatically after selection or if you tap anywhere else in the remote view.

-----

### Volume Control

The card automatically detects whether the selected media player has a paired Apple TV remote entity and adjusts its behaviour accordingly — no configuration needed.

**Apple TV (remote entity detected)**

When a `remote.*` entity is found matching your `media_player.*` entity name, the volume control sends `volume_up` and `volume_down` remote commands. This works reliably in every app including YouTube, Infuse, Plex, Netflix, and Disney+.

The slider uses a throttled approach — one command fires immediately on first movement, then one per ~380ms while dragging continues, with a trailing command to ensure the final position always registers.

**Standard media players**

For any player without a matched remote entity, the volume control uses `media_player.volume_set` for precise absolute control.

**Slider vs Buttons**

Toggle **Use Volume Buttons** in the visual editor to switch between:

- **Slider** — a full-width drag bar sitting on its own row below the playback controls, aligned with the progress bar
- **Buttons** — a − button on the left and + button on the right of the playback controls row, each sending one volume step per tap

-----

### Startup View

Set the **Startup View** option in the visual editor to control which mode the card opens in:

- **Compact** — the slim strip (default)
- **Maximised** — full album art view
- **Remote Control** — opens directly into the remote overlay

The card snaps back to this view every time you navigate to the page or reload the app. Changing the setting in the editor takes effect immediately.

-----

## Multi-Device Switching

Add multiple `media_player` entities to the `entities` list. The card will:

- Show an entity selector dropdown in expanded mode to switch between devices manually
- Automatically switch to any entity that starts playing when `auto_switch: true`
- Preserve manual selections until you switch away or the device becomes inactive

To reorder entities, open the visual editor and drag the handles next to each device name.

-----

## Visual Editor

|Setting                           |Description                                                                |
|----------------------------------|---------------------------------------------------------------------------|
|**Main Accent**                   |Colour of the progress bar fill and active shuffle/repeat icons            |
|**Volume Accent**                 |Colour of the volume slider thumb and track                                |
|**Song Title**                    |Colour of the track or show title text                                     |
|**Song Artist**                   |Colour of the artist name or device friendly name                          |
|**Auto Switch Entities**          |Toggle automatic device switching                                          |
|**Show Media Player Selector**    |Toggle the entity picker dropdown in expanded view                         |
|**Use Volume Buttons**            |Switch between slider and + / − button volume control                      |
|**Startup View**                  |Choose whether the card opens in Compact, Maximised, or Remote Control mode|
|**Manage & Reorder Media Players**|Searchable, drag-and-drop entity list                                      |

-----

## Apple TV Setup

Install and configure the [Apple TV integration](https://www.home-assistant.io/integrations/apple_tv/) in Home Assistant. This automatically creates both a `media_player.*` and a `remote.*` entity for each Apple TV on your network.

The card derives the remote entity name automatically — if your media player is `media_player.apple_tv_lounge`, the card sends remote commands to `remote.apple_tv_lounge`. Ensure both entities are enabled in **Settings → Devices & Services → Apple TV**.

-----

## Troubleshooting

**Volume has no effect on Apple TV in YouTube, Infuse, etc.**
Ensure the Apple TV integration is installed and a `remote.*` entity exists for your device. Verify it is enabled in **Settings → Devices & Services → Apple TV → entities**.

**Apps dropdown is empty**
Confirm your Apple TV integration is connected and the media player entity is reporting a `source_list` attribute. Check in **Developer Tools → States** and search for your entity.

**Remote commands do not respond**
Confirm your Apple TV is on and the integration shows as connected. Test with **Developer Tools → Services** — call `remote.send_command` with your remote entity ID and `command: select`.

**Power button does not turn Apple TV on**
Enable **Wake on Network Access** in your Apple TV settings under **AirPlay and Handoff**.

**Card not appearing after manual installation**
Clear your browser cache with Ctrl + Shift + R (Windows/Linux) or Cmd + Shift + R (Mac). On the HA mobile app, fully close and reopen it.

**Auto-switch is not working**
Check that `auto_switch: true` is set and that the playing entity is in your `entities` list. Manual selections are respected — switch to a different entity or wait for the current one to stop to re-enable auto-switch.

**Progress bar not updating**
The bar interpolates locally every second and re-syncs from HA on every state update. If it appears frozen, check that your media player entity reports `media_position` and `media_position_updated_at` attributes — not all integrations provide these.

**Card always opens in wrong mode**
Check the **Startup View** setting in the visual editor. The card resets to this view on every page load and navigation.

-----

## License

MIT — free to use, modify, and distribute.