import React, { useState, useRef } from 'react';
import { 
  Users, 
  MessageCircle, 
  Files, 
  Share2, 
  Settings, 
  Search, 
  Plus, 
  Send, 
  Paperclip, 
  Download, 
  CheckCircle, 
  Clock, 
  X,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  UserPlus,
  MoreVertical,
  Hash,
  Crown,
  Circle
} from 'lucide-react';

const CrewCastApp = () => {
  const [activeView, setActiveView] = useState('topics');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const fileInputRef = useRef(null);

  const topics = [
    { 
      id: 1, 
      name: 'Team Projects', 
      members: 8, 
      online: 5, 
      lastMessage: 'Sarah shared project-files.zip',
      unread: 3,
      isOwner: true,
      color: 'bg-blue-500'
    },
    { 
      id: 2, 
      name: 'Design Resources', 
      members: 12, 
      online: 3, 
      lastMessage: 'New design system uploaded',
      unread: 0,
      isOwner: false,
      color: 'bg-purple-500'
    },
    { 
      id: 3, 
      name: 'Music Production', 
      members: 6, 
      online: 2, 
      lastMessage: 'Latest mix is fire! 🔥',
      unread: 1,
      isOwner: false,
      color: 'bg-green-500'
    },
  ];

  const messages = [
    {
      id: 1,
      user: 'Sarah Chen',
      message: 'Hey everyone! Just uploaded the latest project files',
      time: '2:30 PM',
      isMe: false,
      avatar: 'SC'
    },
    {
      id: 2,
      user: 'You',
      message: 'Awesome! Downloading now',
      time: '2:32 PM',
      isMe: true,
      avatar: 'ME'
    },
    {
      id: 3,
      user: 'Alex Kim',
      message: 'The new designs look incredible! Great work team',
      time: '2:45 PM',
      isMe: false,
      avatar: 'AK'
    }
  ];

  const files = [
    {
      id: 1,
      name: 'project-files.zip',
      size: '24.5 MB',
      sharedBy: 'Sarah Chen',
      time: '2:30 PM',
      status: 'downloaded',
      type: 'archive'
    },
    {
      id: 2,
      name: 'design-system.fig',
      size: '12.8 MB',
      sharedBy: 'Alex Kim',
      time: '1:15 PM',
      status: 'downloading',
      progress: 75,
      type: 'design'
    },
    {
      id: 3,
      name: 'meeting-notes.md',
      size: '2.1 KB',
      sharedBy: 'You',
      time: '12:30 PM',
      status: 'uploaded',
      type: 'document'
    }
  ];

  const members = [
    { id: 1, name: 'Sarah Chen', status: 'online', avatar: 'SC', role: 'Admin' },
    { id: 2, name: 'Alex Kim', status: 'online', avatar: 'AK', role: 'Member' },
    { id: 3, name: 'Jordan Liu', status: 'away', avatar: 'JL', role: 'Member' },
    { id: 4, name: 'You', status: 'online', avatar: 'ME', role: 'Owner' },
  ];

  const getFileIcon = (type) => {
    const iconClass = `w-4 h-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;
    return <Files className={iconClass} />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const theme = {
    bg: darkMode ? 'bg-gray-900' : 'bg-gray-50',
    card: darkMode ? 'bg-gray-800' : 'bg-white',
    cardHover: darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
    sidebar: darkMode ? 'bg-gray-800' : 'bg-white',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-300' : 'text-gray-600',
    textMuted: darkMode ? 'text-gray-400' : 'text-gray-500',
    border: darkMode ? 'border-gray-700' : 'border-gray-200',
    input: darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300',
    button: darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600',
  };

  const renderTopicsList = () => (
    <div className="space-y-3">
      {topics.map((topic) => (
        <div
          key={topic.id}
          onClick={() => setSelectedTopic(topic)}
          className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${theme.card} ${theme.border} ${theme.cardHover} ${
            selectedTopic?.id === topic.id ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${topic.color}`}></div>
              <div>
                <h3 className={`font-semibold ${theme.text}`}>{topic.name}</h3>
                <p className={`text-sm ${theme.textMuted} truncate max-w-48`}>
                  {topic.lastMessage}
                </p>
                <div className={`flex items-center space-x-4 text-xs ${theme.textSecondary} mt-1`}>
                  <span className="flex items-center space-x-1">
                    <Users className="w-3 h-3" />
                    <span>{topic.members}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                    <span>{topic.online}</span>
                  </span>
                  {topic.isOwner && <Crown className="w-3 h-3 text-yellow-500" />}
                </div>
              </div>
            </div>
            {topic.unread > 0 && (
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full min-w-5 text-center">
                {topic.unread}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-3 max-w-xs lg:max-w-md ${msg.isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                msg.isMe ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'
              }`}>
                {msg.avatar}
              </div>
              <div>
                <div className={`px-4 py-2 rounded-2xl ${
                  msg.isMe 
                    ? 'bg-blue-500 text-white' 
                    : darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                }`}>
                  {msg.message}
                </div>
                <p className={`text-xs mt-1 ${theme.textMuted} ${msg.isMe ? 'text-right' : ''}`}>
                  {msg.isMe ? msg.time : `${msg.user} • ${msg.time}`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className={`p-4 border-t ${theme.border}`}>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <Paperclip className={`w-5 h-5 ${theme.textSecondary}`} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className={`flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.input} ${theme.text}`}
          />
          <button
            className={`p-2 rounded-lg text-white transition-colors ${theme.button}`}
            onClick={() => setNewMessage('')}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={() => {}}
        />
      </div>
    </div>
  );

  const renderFiles = () => (
    <div className="p-4 space-y-3">
      {files.map((file) => (
        <div
          key={file.id}
          className={`p-4 rounded-xl border transition-all duration-200 ${theme.card} ${theme.border} ${theme.cardHover}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getFileIcon(file.type)}
              <div>
                <h4 className={`font-medium ${theme.text}`}>{file.name}</h4>
                <p className={`text-sm ${theme.textMuted}`}>
                  {file.size} • {file.sharedBy} • {file.time}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {file.status === 'downloading' && (
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    ></div>
                  </div>
                  <span className={`text-xs ${theme.textMuted}`}>{file.progress}%</span>
                </div>
              )}
              {file.status === 'downloaded' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {file.status === 'uploaded' && (
                <Clock className="w-5 h-5 text-blue-500" />
              )}
              <button className={`p-1 rounded hover:bg-opacity-10 hover:bg-blue-500 ${theme.textSecondary}`}>
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderMembers = () => (
    <div className="p-4 space-y-3">
      {members.map((member) => (
        <div
          key={member.id}
          className={`flex items-center justify-between p-3 rounded-lg transition-colors ${theme.cardHover}`}
        >
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                member.id === 4 ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'
              }`}>
                {member.avatar}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 ${
                darkMode ? 'border-gray-800' : 'border-white'
              } ${getStatusColor(member.status)}`}></div>
            </div>
            <div>
              <p className={`font-medium ${theme.text}`}>{member.name}</p>
              <p className={`text-sm ${theme.textMuted} capitalize`}>{member.role}</p>
            </div>
          </div>
          <button className={`p-1 rounded hover:bg-opacity-10 hover:bg-gray-500 ${theme.textSecondary}`}>
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      ))}
      
      <button 
        className={`w-full p-3 rounded-lg border-2 border-dashed transition-colors ${theme.border} ${theme.cardHover} ${theme.textSecondary} hover:border-blue-500 hover:text-blue-500`}
      >
        <div className="flex items-center justify-center space-x-2">
          <UserPlus className="w-5 h-5" />
          <span>Invite Members</span>
        </div>
      </button>
    </div>
  );

  const renderMainContent = () => {
    if (!selectedTopic) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className={`w-16 h-16 mx-auto mb-4 ${theme.textMuted}`} />
            <h2 className={`text-xl font-semibold mb-2 ${theme.text}`}>Welcome to CrewCast</h2>
            <p className={`${theme.textMuted} max-w-md`}>
              Select a topic to start sharing files and chatting with your crew, or create a new topic to get started.
            </p>
            <button
              onClick={() => setShowCreateTopic(true)}
              className={`mt-6 px-6 py-3 rounded-lg text-white transition-colors ${theme.button}`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create New Topic
            </button>
          </div>
        </div>
      );
    }

    const contentMap = {
      chat: renderChat(),
      files: renderFiles(),
      members: renderMembers(),
    };

    return (
      <div className="flex-1 flex flex-col">
        <div className={`p-4 border-b ${theme.border} ${theme.card}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded-full ${selectedTopic.color}`}></div>
              <div>
                <h2 className={`text-lg font-semibold ${theme.text}`}>{selectedTopic.name}</h2>
                <p className={`text-sm ${theme.textMuted}`}>
                  {selectedTopic.online} of {selectedTopic.members} members online
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {}}
                className={`p-2 rounded-lg transition-colors ${theme.cardHover} ${theme.textSecondary}`}
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => {}}
                className={`p-2 rounded-lg transition-colors ${theme.cardHover} ${theme.textSecondary}`}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex space-x-1 mt-4">
            {[
              { key: 'chat', icon: MessageCircle, label: 'Chat' },
              { key: 'files', icon: Files, label: 'Files' },
              { key: 'members', icon: Users, label: 'Members' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeView === key
                    ? 'bg-blue-500 text-white'
                    : `${theme.textSecondary} ${theme.cardHover}`
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {contentMap[activeView]}
      </div>
    );
  };

  return (
    <div className={`h-screen flex ${theme.bg}`}>
      {/* Sidebar */}
      <div className={`w-80 ${theme.sidebar} border-r ${theme.border} flex flex-col`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className={`text-xl font-bold ${theme.text}`}>CrewCast</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-colors ${theme.cardHover}`}
              >
                {darkMode ? (
                  <Sun className={`w-5 h-5 ${theme.textSecondary}`} />
                ) : (
                  <Moon className={`w-5 h-5 ${theme.textSecondary}`} />
                )}
              </button>
              <div className={`flex items-center space-x-1 ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              </div>
            </div>
          </div>
          
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme.textMuted}`} />
            <input
              type="text"
              placeholder="Search topics..."
              className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.input} ${theme.text}`}
            />
          </div>
        </div>

        {/* Topics List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wide ${theme.textMuted}`}>
              Topics ({topics.length})
            </h2>
            <button
              onClick={() => setShowCreateTopic(true)}
              className={`p-1 rounded hover:bg-opacity-10 hover:bg-blue-500 ${theme.textSecondary} hover:text-blue-500`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {renderTopicsList()}
        </div>

        {/* User Profile */}
        <div className={`p-4 border-t ${theme.border}`}>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                ME
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 ${
                darkMode ? 'border-gray-800' : 'border-white'
              }`}></div>
            </div>
            <div className="flex-1">
              <p className={`font-medium ${theme.text}`}>Your Name</p>
              <p className={`text-sm ${theme.textMuted}`}>Online</p>
            </div>
            <button className={`p-2 rounded-lg transition-colors ${theme.cardHover}`}>
              <Settings className={`w-4 h-4 ${theme.textSecondary}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {renderMainContent()}
      </div>

      {/* Create Topic Modal */}
      {showCreateTopic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`w-96 p-6 rounded-xl ${theme.card}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${theme.text}`}>Create New Topic</h3>
              <button
                onClick={() => setShowCreateTopic(false)}
                className={`p-1 rounded hover:bg-opacity-10 hover:bg-gray-500 ${theme.textSecondary}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme.text}`}>Topic Name</label>
                <input
                  type="text"
                  placeholder="Enter topic name..."
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.input} ${theme.text}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme.text}`}>Description (Optional)</label>
                <textarea
                  placeholder="Describe what this topic is for..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${theme.input} ${theme.text}`}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCreateTopic(false)}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${theme.border} ${theme.textSecondary} ${theme.cardHover}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowCreateTopic(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${theme.button}`}
                >
                  Create Topic
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrewCastApp;