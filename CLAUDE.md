# Claude Instructions for CrewCast Development

## Project Overview
CrewCast is a decentralized media sharing desktop application built with:
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Rust + Tauri framework
- **Protocol**: iroh for decentralized networking, file sharing, and gossip
- **Database**: Local SQLite for user and topic management
- **Architecture**: Cross-platform desktop app using web technologies

## Core Features & Functionality

### 1. Topic Management
- **Topics** are group spaces where users collaborate
- Users can create, join, and manage topics
- Each topic has members, files, and chat functionality
- Topics support invitation tickets for secure member addition
- Color-coded topics for visual organization
- Owner/Admin/Member role hierarchy

### 2. File Sharing System
- Decentralized file sharing using iroh-blobs
- Support for any file type with metadata tracking
- File upload/download with progress indicators
- File status tracking (uploading, downloading, completed)
- File size and sharing timestamp display

### 3. Chat & Messaging
- Real-time messaging within topics using iroh-gossip
- Message history and persistence
- User avatars and timestamps
- Unread message indicators
- File attachment support in chat

### 4. User & Member Management
- User registration and profile management
- Online/offline status tracking
- Member roles and permissions
- Invitation system with secure tickets

## UI/UX Design Principles

### Visual Design Standards
- **Theme Support**: Dark and light mode with smooth transitions
- **Color System**: Blue primary (#3B82F6), with topic-specific accent colors
- **Typography**: Clean, readable fonts with proper hierarchy
- **Spacing**: Consistent 4px grid system (p-4, m-4, space-x-3, etc.)
- **Components**: Rounded corners (rounded-lg, rounded-xl) for modern feel

### Component Architecture
```
App Structure:
├── Sidebar (Topics List + User Profile)
├── Main Content Area
│   ├── Topic Header (with tabs)
│   ├── Content View (Chat/Files/Members)
│   └── Input Areas (message input, file upload)
└── Modals (Create Topic, Settings, etc.)
```

### State Management Patterns
- Use React hooks (useState, useRef) for component state
- Maintain separate state for:
  - `activeView`: Current tab (chat/files/members)
  - `selectedTopic`: Currently selected topic object
  - `darkMode`: Theme preference
  - `isOnline`: Connection status
  - Form states for inputs and modals

### Interactive Elements
- **Hover Effects**: Subtle background color changes on interactive elements
- **Status Indicators**: Colored dots for online/offline status
- **Progress Bars**: For file download/upload progress
- **Badges**: For unread counts and member roles
- **Transitions**: Smooth animations using Tailwind's transition classes

## Code Implementation Guidelines

### React Component Patterns
```typescript
// Use functional components with hooks
const ComponentName = () => {
  const [state, setState] = useState(initialValue);
  
  // Event handlers
  const handleAction = () => {
    // Implementation
  };
  
  return (
    <div className={`theme-aware-classes`}>
      {/* Component JSX */}
    </div>
  );
};
```

### Styling Conventions
- Use Tailwind utility classes exclusively
- Implement theme-aware styling with conditional classes
- Follow responsive design patterns (mobile-first approach)
- Use consistent spacing and sizing scales

### Data Structure Examples
```typescript
// Topic Object
interface Topic {
  id: number;
  name: string;
  members: number;
  online: number;
  lastMessage: string;
  unread: number;
  isOwner: boolean;
  color: string; // Tailwind color class
}

// Message Object
interface Message {
  id: number;
  user: string;
  message: string;
  time: string;
  isMe: boolean;
  avatar: string;
}

// File Object
interface File {
  id: number;
  name: string;
  size: string;
  sharedBy: string;
  time: string;
  status: 'uploaded' | 'downloading' | 'downloaded';
  progress?: number;
  type: string;
}
```

## Development Workflow Instructions

### When Adding New Features
1. **Maintain State Consistency**: Ensure new features integrate with existing state management
2. **Follow Theme System**: Use the established theme object for all styling
3. **Add Proper Icons**: Use Lucide React icons consistently
4. **Implement Loading States**: Show appropriate feedback for async operations
5. **Handle Edge Cases**: Empty states, error states, offline scenarios

### UI Component Guidelines
- **Cards**: Use rounded corners and subtle borders for content containers
- **Buttons**: Implement hover states and loading indicators
- **Forms**: Include proper validation and error messaging
- **Lists**: Use consistent spacing and hover effects
- **Modals**: Center-screen overlays with backdrop blur

### Tauri Integration Considerations
- **File System Access**: Handle file operations through Tauri's filesystem API
- **Network Status**: Monitor connection state for offline/online indicators
- **Native Notifications**: Use system notifications for important events
- **Window Management**: Handle window state and user preferences

### iroh Protocol Integration
- **Blob Sharing**: Implement file sharing through iroh-blobs
- **Gossip Messaging**: Handle real-time chat via iroh-gossip
- **Peer Discovery**: Manage peer connections and status
- **Ticket System**: Generate and handle invitation tickets

## Error Handling & Edge Cases

### Connection States
- Display appropriate UI when offline/disconnected
- Show reconnection attempts and status
- Cache messages/files for offline access

### File Operations
- Handle large file uploads with progress indication
- Manage failed downloads with retry options
- Display file type icons and size formatting

### User Experience
- Empty states for new users or empty topics
- Loading skeletons during data fetching
- Error messages with actionable solutions
- Confirmation dialogs for destructive actions

## Performance Considerations
- **Virtual Scrolling**: For large message/file lists
- **Image Optimization**: Compress and resize shared images
- **Memory Management**: Clean up resources when switching topics
- **Lazy Loading**: Load topic content on demand

## Security & Privacy Notes
- All data sharing is peer-to-peer via iroh protocol
- No central server dependencies for core functionality
- Local data encryption for sensitive information
- Secure ticket generation for invitations

## Testing Scenarios
1. **Topic Creation**: Create new topics and verify persistence
2. **File Sharing**: Upload/download various file types and sizes
3. **Chat Functionality**: Send messages and verify real-time delivery
4. **Member Management**: Invite users and manage permissions
5. **Theme Switching**: Verify UI consistency across light/dark modes
6. **Offline Scenarios**: Test behavior when network is unavailable

## Future Enhancement Areas
- Voice/video calling integration
- Screen sharing capabilities
- Rich text messaging with markdown support
- File preview functionality
- Advanced search across topics and files
- Notification management and settings
- Topic archiving and organization features

---
