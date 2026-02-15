# ZoteroReadTracker
A Zotero plugin to track your reading activity and visualize it with a GitHub-style heatmap calendar

![Zotero](https://img.shields.io/badge/Zotero-7.0+-CC2936?logo=zotero&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## Also see these similar projects for tracking reading activity
- [zotero-reading-list](https://github.com/Dominic-DallOsto/zotero-reading-list) - Track reading status with tags and custom columns
- [zotero-paper-tracker](https://github.com/pranavponnusamy/zotero-paper-tracker) - Track papers with reading progress

## Screenshots

<!-- Add screenshots here -->

---

## Installation

### From Release

1. Download the latest `.xpi` file from the [Releases page](https://github.com/YOUR_USERNAME/zotero-read-tracker/releases)
2. Open Zotero
3. Go to `Tools` → `Add-ons`
4. Click the gear icon ⚙️ and select `Install Add-on From File...`
5. Select the downloaded `.xpi` file
6. Restart Zotero

### From Source

1. Clone this repository
2. Zip the contents (not the folder itself) into a `.xpi` file

```bash
# Zip contents into .xpi
zip -r ../ZoteroReadTracker.xpi manifest.json bootstrap.js readTracker.js heatmapBuilder.js
```

3. Follow steps 2-6 above

---

## Usage

### Toggle Read Status

1. Right-click on any item in your library
2. Select **"Toggle Read Status"**
3. The item will be marked as read with today's date (or unmarked if already read)

### View Reading Heatmap

1. Go to `Tools` → **"Plot Reading Heatmap"**
2. You will be prompted to select a browser (e.g. Chrome)
3. The browser window will open with your heatmap
4. Use the 🌙 button to toggle between dark and light themes
5. Hover over cells to see paper counts and dates
6. Export using the buttons at the bottom:
   - 📋 **Copy SVG** — Copy to clipboard
   - 💾 **Save SVG File** — Download as SVG
   - 🖼 **Save PNG** — Download as high-resolution PNG
   - 📤 **Save Shareable HTML** — Download as standalone HTML file

### Edit Read Date

The read date can be manually edited if needed:

1. Select the item in your library
2. Open the **Info** panel (right sidebar)
3. Find the **Extra** field
4. Edit the `Read-Date: YYYY-MM-DD` line


## Data Storage

Read status is stored in each item's **Extra** field using the following format:

Read: true
Read-Date: YYYY-MM-DD

If the item's read status is toggled off, the read status will be updated to the following:

Read: false

## Demo / Testing

To preview the heatmap without setting up real reading data:

1. Open Zotero
2. Go to `Tools` → `Developer` → `Run JavaScript`
3. Copy and paste the contents of `plotExampleHeatmap.js`
4. Click **Run** or press `Ctrl+R` (`Cmd+R` on Mac)
5. Select a browser when prompted to view the heatmap

## Compatibility

- **Zotero 7.0+**
- Not tested on any other version

## Acknowledgments

Inspired by GitHub's contribution graph