# Video Downloader

A sleek, desktop-based utility designed to streamline the process of archiving online media content. This application provides a high-performance interface for retrieving and saving videos directly to your local machine.

## Key Features

- **Format Selection:** Automatically retrieves available media formats, allowing you to choose the specific resolution and file size that fits your needs.
- **Smart Configuration:** rembembers your preferred download location between sessions for a seamless workflow.
- **Real-Time Progress:** Features a detailed progress monitor showing download speed (MB/s), estimated time remaining, and completion percentage.
- **Clean Interface:** Built with a modern, distraction-free UI designed for efficiency.
- **Muxing Support:** Automatically handles the merging of high-quality video and audio streams into a single file.

## Supported Services

The application currently provides optimized support for:
- **YouTube:** Full metadata retrieval, support for all quality levels, and high-speed downloading.
- **Twitter / X:** Reliable media extraction from tweets, including support for various video resolutions.

## Technical Foundation

The application uses a hybrid architecture to ensure reliability:
- **Analysis Engine:** Utilizes advanced metadata retrieval to fetch media details without the overhead of standard analysis tools.
- **Download Core:** Employs industry-standard binaries for robust data transfer and stream processing.
- **Frontend:** Powered by a responsive Angular-based interface.
- **Desktop Shell:** Integrated via Electron for cross-platform system access and security.

## Getting Started

1. **Install Dependencies:** `npm install`
2. **Build the Application:** `npm run build`
3. **Launch:** `npm start`
