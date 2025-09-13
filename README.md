# CrewCast

[![Rust CI](https://github.com/mihir-l/CrewCast/workflows/Rust%20CI/badge.svg)](https://github.com/mihir-l/CrewCast/actions/workflows/rust.yml)

CrewCast is a modern desktop application for sharing media and files with friends, built on top of the [iroh](https://github.com/n0-computer/iroh) protocol. It provides a simple, secure, and decentralized way to create topics (groups), chat, and share files with other users.

## Features

- **Decentralized Sharing:** Powered by iroh, CrewCast allows you to share files and messages without relying on centralized servers.
- **Topics:** Create or join topics to collaborate and share with groups of users.
- **User Registration:** Simple onboarding with user info registration.
- **File Sharing:** Share files with topic members, track download status, and download shared files.
- **Chat:** Real-time messaging within topics.
- **Member Status:** See which users are active in each topic.
- **Invitation Tickets:** Easily invite others to join your topic with a secure ticket.
- **Modern UI:** Responsive, themeable interface with support for light and dark modes.
- **Built with Tauri:** Cross-platform desktop app using web technologies and Rust.

## Getting Started

1. **Install Dependencies:**  
   Use [pnpm](https://pnpm.io/) or npm to install frontend dependencies.

   ```
   pnpm install
   ```

2. **Run the App:**  
   Start the Tauri development server.

   ```
   pnpm tauri dev
   ```

3. **Usage:**  
   - On first launch, register your user info.
   - Create or join a topic.
   - Share files, chat, and invite others using tickets.

## Architecture

- **Frontend:** React + TypeScript
- **Backend:** Rust (Tauri) with iroh, iroh-blobs, and iroh-gossip for decentralized networking and file sharing.
- **Database:** Local SQLite for user and topic management.

## Built On

- [iroh](https://github.com/n0-computer/iroh): Decentralized protocol for blobs and gossip.
- [Tauri](https://tauri.app/): Secure, fast desktop app framework.
- [React](https://react.dev/): UI library.

## License

MIT

---

**CrewCast** — Share freely, connect privately.