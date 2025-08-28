# Copilot Instructions for CrewCast

## Overview
CrewCast is a cross-platform desktop app for decentralized media and file sharing, built with React (frontend), Tauri (Rust backend), and the iroh protocol for peer-to-peer networking. The app enables users to create/join topics, chat, share files, and invite others via tickets.

## Architecture
- **Frontend:** `src/` (React + TypeScript)
  - Major components: `TopicsListPage.tsx`, `TopicDetailsPage.tsx`, `FilesPanel.tsx`, `MembersPanel.tsx`, `ChatPanel.tsx`
  - Contexts: `UserContext.tsx`, `TopicContext.tsx`, `ThemeContext.tsx` for global state
  - UI is responsive, themeable, and uses custom CSS variables (see `App.css`, `styles/ticket.css`)
- **Backend:** `src-tauri/` (Rust)
  - Commands exposed via Tauri: see `src-tauri/src/commands/`
  - Database: SQLite, managed via `Db` in `src-tauri/src/database/`
  - iroh protocol for decentralized file and message sharing

## Key Patterns & Conventions
- **Topic Tickets:** Use `get_ticket_for_topic` Tauri command to generate invitation tickets for topics. Frontend calls via `invoke('get_ticket_for_topic', { topicId })`.
- **Component Communication:** Use React Context for user/topic/theme state. Pass `topicId` explicitly to panels/components.
- **File Sharing:** Files are managed per-topic. Use `list_files` and `share_file` commands for file operations.
- **Window Controls:** Custom titlebar and controls in `WindowControls.tsx`, using Tauri window API.
- **Styling:** Use CSS variables for theme colors. Theme switching is managed via `ThemeContext`.

## Developer Workflows
- **Build/Run:**
  - Install dependencies: `pnpm install`
  - Start dev server: `pnpm tauri dev`
  - Build for release: `pnpm run tauri build`
- **Debugging:**
  - Backend logs: Rust `println!`/`dbg!` output in Tauri console
  - Frontend: Use browser devtools (React, CSS)
- **Adding Tauri Commands:**
  - Define in `src-tauri/src/commands/`
  - Register in `src-tauri/src/lib.rs` via `tauri::generate_handler!`

## Integration Points
- **iroh:** Used for decentralized networking (see `src-tauri/comm`)
- **Tauri Plugins:** Dialog and opener plugins enabled in `lib.rs`
- **Database:** All persistent state via SQLite, managed in `src-tauri/src/database/`

## Examples
- To add a new topic feature, update both `TopicContext.tsx` (frontend logic) and `src-tauri/src/commands/topic.rs` (backend logic).
- To expose a new backend command, add to `src-tauri/src/commands/`, register in `lib.rs`, and call via `invoke` in React.

## References
- See `README.md` for high-level project description and setup.
- See `src-tauri/src/lib.rs` for backend entrypoint and command registration.
- See `src/components/TopicsListPage.tsx` and `src/components/TopicDetailsPage.tsx` for ticket and topic UI patterns.

---
**For AI agents:** Always check for explicit context usage, ticket generation, and Tauri command registration when making changes. Use CSS variables and context providers for UI consistency.
