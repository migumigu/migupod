# M-pod

M-pod is a modern music player with a vertical cover flow interface, designed to provide a seamless and visually appealing music browsing experience.

## Features

- **Vertical Cover Flow**: Browse through your music collection with a smooth, visually engaging vertical cover flow
- **Touch Gestures**: Support for touch swipes and long presses for intuitive navigation
- **Performance Optimizations**: Virtual scrolling and efficient rendering for smooth performance
- **Responsive Design**: Works well on both desktop and mobile devices
- **Integration**: Connects to Emby or Plex media servers

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Create a `.env.local` file based on `.env.example` and configure your media server settings
3. Run the app:
   `npm run dev`

## Usage

- **Swipe Up/Down**: Scroll through the cover flow
- **Quick Swipe**: Swipe quickly to navigate one cover at a time
- **Long Press + Swipe**: Swipe with a long press to navigate multiple covers at once
- **Tap Center Cover**: View the songs list for the selected album/artist/playlist
- **Tap Left Avatar**: Play/pause the current track

## Configuration

Configure your media server settings in the settings panel (click the gear icon in the top left corner).

Supported providers:
- Emby
- Plex
