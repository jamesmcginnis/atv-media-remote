# ATV Media Remote

A beautiful, Apple-inspired media player card for Home Assistant with seamless device switching, Music Assistant integration, Apple TV remote control, rich media info panels, and a sleek dark interface. Optimised for iPhone Dashboards.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1+-blue)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![License](https://img.shields.io/badge/license-MIT-green)

[![Open your Home Assistant instance and add this repository to HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=atv-media-remote&category=plugin)

---

## 📸 Screenshots

### Expanded Mode
![Expanded Mode](preview1.png)
*Full album artwork display with all controls*

### Compact / Mini Player Mode
![Compact Mode](preview2.png)
*Space-saving mini player view*

### Apple TV Remote Control
![Remote Control](preview3.png)
*Built-in remote — directional pad, Back, Home, Apps and Power*

### Music Assistant Library Browser
![MA Browser](preview4.png)
*Browse and play from your Music Assistant library*

### Discogs Music Info Panel
![Media Info](preview5.png)
*Discogs music info with tracklist, ratings and artwork — tap any album art to open*

### Visual Configuration Editor
![Configuration Editor](preview6.png)
*Full visual editor — per-entity startup volumes, colour pickers, no YAML required*

### MA Track Playback from Media Info
![MA Track Confirm](preview7.png)
*Tap any track in the Discogs info panel to trigger a Music Assistant play confirmation — showing track, artist and target speaker before committing*

### TMDB Media Info Panel
![TMDB Media Info](preview8.png)
*TV and movie info from TMDB — cast, overview, poster and ratings with a back-navigable picker for ambiguous titles*

---

## ✨ Features

### Core
- 🎨 **Apple-inspired design** — dark frosted-glass theme with customisable accent colours
- 📱 **Compact and expanded modes** — toggle between full album art and a space-saving mini player
- 🔄 **Automatic device switching** — card follows whichever device starts playing
- 🎵 **Full media controls** — play/pause, skip, shuffle, repeat, seek via progress bar
- ✨ **Tactile button feedback** — glow and blur effects when buttons are pressed
- 🔊 **Volume control** — slider or +/− buttons, with optional routing to a separate volume entity
- 🔇 **Mute toggle** — tap the volume percentage badge or speaker icon to instantly mute/unmute
- 🖼️ **Album artwork** — with smart fallback device icons when artwork fails to load
- 📋 **Multi-device support** — manage several media players from a single card
- 🎯 **Live progress tracking** — smooth real-time position updates without extra polling
- 🔁 **Alexa keep-alive** — keeps Alexa entities responsive while they're active
- 🔍 **Long press for more info** — long press the album artwork or fallback icon (expanded mode) to open the Home Assistant more-info dialog for the active entity

### Media Info Panels
- 🎵 **Discogs music lookup** — tap album art on a music track to fetch full release info: tracklist, label, year, country, formats, genres and a community star rating
- 🎬 **TMDB TV & movie lookup** — tap album art on video content to fetch cast, overview, poster and ratings; an interactive picker resolves ambiguous TV vs movie titles
- 🔗 **Discogs track links** — each track row in the music info panel links directly to its Discogs page
- 🎵 **MA playback from tracklist** — when a Music Assistant speaker is active, every track row in the Discogs info panel becomes tappable; a confirmation dialog shows the track title, artist and target speaker before playing via Music Assistant

### Apple TV Remote
- 📺 Built-in remote overlay with directional pad, Select, Back, Home, Apps and Power
- 📋 **Apps dropdown** — populated directly from the Apple TV's source list
- 🔇 **Auto-hidden** for non-Apple-TV players

### Music Assistant Integration
- 🎶 **Automatic detection** — no manual configuration; uses the HA entity registry
- 📚 **Library browser** — Playlists, Artists, Albums, Tracks, Radio, Favourites and Search
- 🖱️ Tap any item to start playback immediately on the selected speaker
- 📱 **Compact view aware** — tapping the browse button expands the card first

### Volume & Startup
- 🚀 **Per-entity startup volume** — set an individual volume level for each speaker that gets applied automatically when a new track starts; configured directly in the visual editor
- 🛡️ **Safe volume handling** — volume commands are only sent to devices that support them, preventing errors on Apple TV and similar devices

### Configuration
- ⚙️ **Full visual editor** — drag-and-drop entity reordering, search/filter, colour pickers
- 🚀 **Startup mode** — open in compact, maximised or remote mode on every load
- 🎨 **Deep colour control** — accent, volume, title, artist, button, volume % and background; native colour picker tiles with hex input on every field; full alpha support via 8-digit hex or use `#000000` as a shortcut for fully transparent
- 🔊 **Per-entity startup volumes** — set directly from the entity list in the editor

---

## 🚀 Installation

### Manual Installation

1. Download `atv-media-remote.js`
2. Copy it into your `config/www/` folder
3. Add the resource in your Lovelace configuration:

```yaml
lovelace:
  resources:
    - url: /local/atv-media-remote.js
      type: module
```

4. Restart Home Assistant

---

## ⚙️ Configuration

### Quick Start

1. Edit your dashboard and click **Add Card**
2. Search for **ATV Media Remote**
3. Use the **visual editor** to select your media players and configure colours
4. Hit **Save** — done!

### YAML Example

```yaml
type: custom:atv-media-remote
entities:
  - media_player.living_room_apple_tv
  - media_player.living_room_homepod
  - media_player.kitchen_alexa
  - media_player.mass_living_room
accent_color: '#007AFF'
volume_accent: '#30D158'
auto_switch: true
startup_mode: compact
volume_control: slider
show_entity_selector: true
tmdb_api_key: 'your_tmdb_v3_key'
entity_startup_volumes:
  media_player.living_room_homepod: 25
  media_player.kitchen_alexa: 40
```

### All Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entities` | list | **Required** | Media player entity IDs to include |
| `accent_color` | string | `#007AFF` | Main accent colour (hex) |
| `volume_accent` | string | same as accent | Separate colour for the volume slider |
| `title_color` | string | `#ffffff` | Track title text colour |
| `artist_color` | string | `#ffffff` | Artist name text colour |
| `button_color` | string | `#ffffff` | Media control button icon colour |
| `vol_pct_color` | string | `rgba(255,255,255,0.45)` | Volume percentage badge colour |
| `player_bg` | string | `#1c1c1e` | Card background colour. `#000000` = fully transparent. Use 8-digit hex (e.g. `#1c1c1e80`) for partial opacity |
| `auto_switch` | boolean | `true` | Auto-follow whichever device starts playing |
| `remember_last_entity` | boolean | `false` | Remember the last manually selected entity |
| `show_entity_selector` | boolean | `true` | Show/hide the device selector dropdown |
| `scroll_text` | boolean | `false` | Scroll long track/artist text instead of truncating |
| `volume_control` | string | `slider` | `slider` or `buttons` |
| `show_vol_pct` | boolean | `true` | Show or hide the volume percentage badge |
| `volume_entity` | string | `''` | Route volume control to a different entity |
| `startup_mode` | string | `compact` | `compact`, `maximised`, or `remote` |
| `tmdb_api_key` | string | `''` | TMDB v3 API key for TV and movie info lookups |
| `entity_startup_volumes` | map | `{}` | Per-entity startup volume levels (0–100) |
| `ma_entities` | list | `[]` | Manual override — force specific entity IDs to be treated as Music Assistant speakers (useful if auto-detection fails) |

---

## 🖥️ Visual Editor Guide

Open the editor by clicking the **pencil icon** on your card.

### Managing Media Players

- **Search box** — filter the entity list by name; the full list reappears after each selection so you can keep ticking multiple speakers
- **Checkboxes** — tick any entity to add it to the card; a **Vol** input appears on the row
- **Vol input** — enter 0–100 for that speaker's startup volume; leave blank for no startup volume
- **Drag handles** (⠿) — drag checked entities to reorder them in the selector
- On mobile, use the grip icon on the left of each row

### Colours Section

Each colour is shown as a tile with a large clickable swatch at the top and the hex value beneath. Click the swatch to open the native colour picker, or type directly into the hex field. A checkerboard pattern shows through the swatch when a colour has transparency.

| Field | Controls |
|-------|----------|
| **Main Accent** | Progress bar, active shuffle/repeat icons, highlights |
| **Volume Accent** | Volume slider track colour (independent from accent) |
| **Song Title** | Track title text colour |
| **Song Artist** | Artist name text colour |
| **Button Colour** | All media control button icon colours |
| **Volume % Colour** | The volume percentage badge colour |
| **Player Background** | Card background colour. Enter `#000000` for fully transparent, or use 8-digit hex (e.g. `#1c1c1e80`) for partial opacity |

### Toggles

| Toggle | What it does |
|--------|--------------|
| **Auto Switch Entities** | Card automatically moves to whichever player starts playing |
| **Remember Last Entity** | Persists your manual player selection across dashboard reloads |
| **Show Media Player Selector** | Shows or hides the device dropdown |
| **Use Volume Buttons** | Replaces the volume slider with +/− buttons |
| **Show Volume Percentage** | Shows or hides the volume % badge |
| **Scroll Long Track / Artist Text** | Scrolls text instead of truncating with ellipsis |

### Startup View

- **Compact** *(default)* — opens as the mini player
- **Maximised** — opens in full expanded view with album art
- **Remote Control** — opens directly into Apple TV remote mode

### Volume Entity

Optionally route all volume commands to a different media player entity — useful when an Apple TV feeds into a HomePod or a TV feeds into a separate amplifier.

### Media Info (TMDB API Key)

Tap any album art to open the media info panel. Music lookups use Discogs (no key needed). TV and movie lookups use TMDB — add a free v3 API key from [themoviedb.org](https://www.themoviedb.org/settings/api).

---

## 📖 Usage Guide

### Compact vs Expanded

Click the **resize button** (↗ icon, top-right) to toggle between modes.

### Media Info Panel

Tap the **album artwork** or poster to open a media info panel:

- **Music** — fetches the full Discogs release: tracklist, label, year, formats, genres, country and community star rating. If the match is ambiguous a release picker appears with artwork and pressing details. **A ← Back button lets you return to the picker and choose a different release without re-fetching.**
- **TV & Movies** — fetches cast, overview, poster and ratings from TMDB. An interactive picker resolves ambiguous TV vs movie titles with colour-coded badges. **A ← Back button lets you return to the picker and choose a different result without re-fetching.**

### Home Assistant More Info

**Long press** (hold for ~½ second) the album artwork or fallback device icon in **expanded mode** to open the standard Home Assistant more-info dialog for the active media player entity. This gives you access to the full entity history, attributes and any extra controls provided by your integration.

> On iPhone the long press works identically — the native iOS image save menu is suppressed so the HA dialog opens instead.

### Playing from the Tracklist (Music Assistant)

When a Music Assistant speaker is active, the Discogs tracklist becomes interactive. Each track row shows a ▶ play hint on hover or tap:

1. **Tap a track** — a confirmation dialog appears showing the track title, artist and the name of the speaker it will play on
2. **Tap Play** — the card searches your MA library, scores the results to find the best match, and starts playback immediately via Music Assistant
3. **Tap Cancel** — dismiss and choose a different track
4. On success the dialog confirms **"✓ Playing now"** and closes automatically

This lets you browse a full album from the info panel and jump to any track without leaving your dashboard.

> On non-MA speakers, track rows link directly to the Discogs page for that track instead.

> **Playback:** Tapping a track starts it immediately — it replaces the current queue rather than adding to the end, so you hear it straight away.

> **MA not detected?** If the ▶ hints don't appear for a known MA speaker, add its entity ID to `ma_entities` in your YAML config as a manual override.

### Browsing Your Music Assistant Library

Two complementary ways to discover and play via Music Assistant:

**Library Browser (♪ button)** — while any MA speaker is selected the ♪ button appears on the card. Tap to open the full browser with tabs for Playlists, Artists, Albums, Tracks, Radio, Favourites and Search. Tap any item to start playback immediately.

**From the album art** — tap the album artwork while a track is playing on an MA speaker. The Discogs info panel opens showing the full tracklist. Tap any track to play it via the confirmation dialog above. Great for exploring an album and queuing specific tracks while staying on your dashboard.

**When nothing is playing** — when an MA speaker is idle or paused, the artwork area shows a music note icon with a **Browse library** hint. Tap it to open the MA library browser directly.

### Startup Volume

Set per-entity levels in the visual editor (tick a speaker → **Vol** input), or via YAML using `entity_startup_volumes`. The card only applies the volume on devices that support it.

### Mute Toggle

| Device | Mute method |
|--------|-------------|
| **Alexa** (modern), **Sonos**, **Chromecast** | Full mute support via Home Assistant |
| **Apple TV** | Soft-mute — sets volume to 0, restores on unmute |
| **HomePod** | Soft-mute — sets volume to 0, restores on unmute |
| **Music Assistant speakers** | Soft-mute — sets volume to 0, restores on unmute |

> Move the slider at least once before muting so the card has a level to restore. If no prior level is known, unmute defaults to 50%.

### Apple TV Remote

| Button | Action |
|--------|--------|
| ← Back | Menu / back navigation |
| 🏠 Home | Return to Apple TV home screen |
| Apps | Opens a list of all sources and apps |
| Power | Toggle power on/off |
| ↑ ↓ ← → | Directional navigation |
| ● centre | Select / OK |

### Music Assistant Library Browser

| Tab | Contents |
|-----|----------|
| Playlists | Your saved playlists |
| Artists | Browse by artist |
| Albums | Browse by album |
| Tracks | Individual tracks |
| Radio | Radio stations |
| Favourites | Your starred items |
| 🔍 Search | Search your entire MA library |

---

## 🧠 Smart Device Detection

| Device | Detection method | Remote | MA button |
|--------|-----------------|:------:|:---------:|
| **Apple TV** | `device_class: tv` | ✅ | ❌ |
| **HomePod** | `device_class: speaker` | ❌ | ❌ |
| **Music Assistant** | `platform: music_assistant` in registry | ❌ | ✅ |
| **Alexa / all others** | Everything else | ❌ | ❌ |

Detection is automatic for most setups. If a Music Assistant speaker isn't being recognised, add its entity ID to `ma_entities` in your YAML config as a manual override.

---

## ⚠️ Compatibility Notes

### Older Alexa Devices

Some older Echo models may not respond reliably to volume or mute commands via HA. This is a device limitation — not a card bug. Try routing volume to a separate entity using `volume_entity`.

### Apple TV Volume

Apple TV doesn't report its current volume level. The card looks back through recent history to find the last known level, and tracks any changes you make from that point. Volume buttons work correctly — they step the HomePod volume up or down as expected.

---

## 🔧 Troubleshooting

**Card doesn't appear after installation**
- Add the resource to Lovelace (see Installation above) and hard-refresh: Ctrl+Shift+R / Cmd+Shift+R
- If you're seeing stale updates after removing and re-adding the card, do a full dashboard reload

**Volume errors on Apple TV or similar devices**
- The card automatically skips volume commands that a device doesn't support. If you're still seeing errors, check that your HA and device integrations are up to date.

**Remote button appears for wrong player**
- Check `device_class: tv` is present on the entity; or ensure `apple tv` is in the entity ID or friendly name

**Media info shows no results**
- Music: ensure artist + title metadata is available from your media player
- TV/Movies: add a TMDB v3 API key

**Album artwork shows fallback icon**
- The card automatically swaps broken artwork for the device icon — this is intentional
- Ensure your media player reports the `entity_picture` attribute

**Long press opens the iOS image menu instead of HA more info**
- Update to the latest version — this is fixed in the current release

**Drag-and-drop not working**
- Entities must be checked before they can be reordered; on mobile use the ⠿ grip handle

---

## 🙏 Credits & Acknowledgements

### Music Assistant Library Browser
The Music Assistant library browser includes code adapted from the work of **[jianyu-li](https://github.com/jianyu-li)**:

> **📦 [yet-another-media-player](https://github.com/jianyu-li/yet-another-media-player)** by [@jianyu-li](https://github.com/jianyu-li)

Many thanks for the excellent foundation on Music Assistant integration.

### Special Thanks
- The [Home Assistant](https://www.home-assistant.io) team
- The HA community for inspiration and feedback
- All users who test, report issues and suggest improvements

---

## 📄 License

MIT License — free to use, modify and distribute.

---

## ⭐ Support

If this card is useful to you, please **star the repository** and share it with the community!

For bugs or feature requests, use the [GitHub Issues](../../issues) page.
