import React, { useState, useRef, useEffect } from 'react';
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
  Crown,
  Circle
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTopic } from '../contexts/TopicContext';
import { useUser } from '../contexts/UserContext';
import { Topic, Message, SharedFile, Member } from '../types/interfaces';
import { toast } from 'react-toastify';

const CrewCastMainUI: React.FC = () => {
  const { currentTheme, toggleTheme, isDark } = useTheme();
  const { currentTopic, fetchTopics, createTopic, getTicketForTopic, joinTopic } = useTopic();
  const { currentUser } = useUser();
  
  const [activeView, setActiveView] = useState<'chat' | 'files' | 'members'>('chat');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isOnline] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load topics on mount
  useEffect(() => {
    const loadTopics = async () => {
      const topicsList = await fetchTopics();
      setTopics(topicsList);
    };
    loadTopics();
  }, [fetchTopics]);

  // Mock data - in real app this would come from context/API
  const messages: Message[] = [
    {
      content: 'Hey everyone! Just uploaded the latest project files',
      sender: 'Sarah Chen',
      firstName: 'Sarah',
      timestamp: Date.now() - 3600000,
    },
    {
      content: 'Awesome! Downloading now',
      sender: currentUser?.nodeId || 'me',
      firstName: currentUser?.firstName || 'You',
      timestamp: Date.now() - 3000000,
    },
    {
      content: 'The new designs look incredible! Great work team',
      sender: 'Alex Kim',
      firstName: 'Alex',
      timestamp: Date.now() - 1800000,
    }
  ];

  const files: SharedFile[] = [
    {
      id: 1,
      nodeId: 'node1',
      topicId: currentTopic?.topicId || '',
      hash: 'hash1',
      name: 'project-files.zip',
      format: 'zip',
      size: 25690112, // 24.5 MB
      status: 'downloaded',
      sharedAt: Date.now() - 3600000,
      sender: 'Sarah Chen'
    },
    {
      id: 2,
      nodeId: 'node2',
      topicId: currentTopic?.topicId || '',
      hash: 'hash2',
      name: 'design-system.fig',
      format: 'fig',
      size: 13421773, // 12.8 MB
      status: 'downloading',
      sharedAt: Date.now() - 7200000,
      sender: 'Alex Kim'
    }
  ];

  const members: Member[] = [
    { nodeId: 'node1', firstName: 'Sarah', lastName: 'Chen', lastSeen: Date.now(), isActive: true },
    { nodeId: 'node2', firstName: 'Alex', lastName: 'Kim', lastSeen: Date.now(), isActive: true },
    { nodeId: 'node3', firstName: 'Jordan', lastName: 'Liu', lastSeen: Date.now() - 3600000, isActive: false },
    { nodeId: currentUser?.nodeId || 'me', firstName: currentUser?.firstName || 'You', lastSeen: Date.now(), isActive: true },
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-500' : 'bg-gray-500';
  };

  const renderTopicsList = () => (
    <div className="space-y-3">
      {topics.map((topic) => (
        <div
          key={topic.id}
          onClick={() => joinTopic(topic)}
          className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${currentTheme.card} ${currentTheme.border} ${currentTheme.cardHover} ${
            currentTopic?.id === topic.id ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <div>
                <h3 className={`font-semibold ${currentTheme.text}`}>{topic.name}</h3>
                <p className={`text-sm ${currentTheme.textMuted} truncate max-w-48`}>
                  Latest activity
                </p>
                <div className={`flex items-center space-x-4 text-xs ${currentTheme.textSecondary} mt-1`}>
                  <span className="flex items-center space-x-1">
                    <Users className="w-3 h-3" />
                    <span>{topic.members?.length || 0}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                    <span>1</span>
                  </span>
                  <Crown className="w-3 h-3 text-yellow-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isMe = msg.sender === currentUser?.nodeId;
          return (
            <div
              key={index}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-3 max-w-xs lg:max-w-md ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isMe ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {msg.firstName?.substring(0, 2).toUpperCase() || 'U'}
                </div>
                <div>
                  <div className={`px-4 py-2 rounded-2xl ${
                    isMe 
                      ? 'bg-blue-500 text-white' 
                      : isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                  }`}>
                    {msg.content}
                  </div>
                  <p className={`text-xs mt-1 ${currentTheme.textMuted} ${isMe ? 'text-right' : ''}`}>
                    {isMe ? formatTime(msg.timestamp) : `${msg.firstName} • ${formatTime(msg.timestamp)}`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className={`p-4 border-t ${currentTheme.border}`}>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 rounded-lg transition-colors ${currentTheme.cardHover}`}
          >
            <Paperclip className={`w-5 h-5 ${currentTheme.textSecondary}`} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className={`flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${currentTheme.input} ${currentTheme.text}`}
          />
          <button
            className={`p-2 rounded-lg text-white transition-colors ${currentTheme.button}`}
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
          className={`p-4 rounded-xl border transition-all duration-200 ${currentTheme.card} ${currentTheme.border} ${currentTheme.cardHover}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Files className={`w-4 h-4 ${currentTheme.textSecondary}`} />
              <div>
                <h4 className={`font-medium ${currentTheme.text}`}>{file.name}</h4>
                <p className={`text-sm ${currentTheme.textMuted}`}>
                  {formatFileSize(file.size)} • {file.sender} • {formatTime(file.sharedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {file.status === 'downloading' && (
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: '75%' }}
                    ></div>
                  </div>
                  <span className={`text-xs ${currentTheme.textMuted}`}>75%</span>
                </div>
              )}
              {file.status === 'downloaded' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {file.status === 'uploaded' && (
                <Clock className="w-5 h-5 text-blue-500" />
              )}
              <button className={`p-1 rounded hover:bg-opacity-10 hover:bg-blue-500 ${currentTheme.textSecondary}`}>
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
          key={member.nodeId}
          className={`flex items-center justify-between p-3 rounded-lg transition-colors ${currentTheme.cardHover}`}
        >
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                member.nodeId === currentUser?.nodeId ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'
              }`}>
                {member.firstName.substring(0, 2).toUpperCase()}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 ${
                isDark ? 'border-gray-800' : 'border-white'
              } ${getStatusColor(member.isActive)}`}></div>
            </div>
            <div>
              <p className={`font-medium ${currentTheme.text}`}>
                {member.firstName} {member.lastName}
              </p>
              <p className={`text-sm ${currentTheme.textMuted} capitalize`}>
                {member.nodeId === currentUser?.nodeId ? 'You' : 'Member'}
              </p>
            </div>
          </div>
          <button className={`p-1 rounded hover:bg-opacity-10 hover:bg-gray-500 ${currentTheme.textSecondary}`}>
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      ))}
      
      <button 
        className={`w-full p-3 rounded-lg border-2 border-dashed transition-colors ${currentTheme.border} ${currentTheme.cardHover} ${currentTheme.textSecondary} hover:border-blue-500 hover:text-blue-500`}
      >
        <div className="flex items-center justify-center space-x-2">
          <UserPlus className="w-5 h-5" />
          <span>Invite Members</span>
        </div>
      </button>
    </div>
  );

  const renderMainContent = () => {
    if (!currentTopic) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className={`w-16 h-16 mx-auto mb-4 ${currentTheme.textMuted}`} />
            <h2 className={`text-xl font-semibold mb-2 ${currentTheme.text}`}>Welcome to CrewCast</h2>
            <p className={`${currentTheme.textMuted} max-w-md`}>
              Select a topic to start sharing files and chatting with your crew, or create a new topic to get started.
            </p>
            <button
              onClick={() => setShowCreateTopic(true)}
              className={`mt-6 px-6 py-3 rounded-lg text-white transition-colors ${currentTheme.button}`}
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
        <div className={`p-4 border-b ${currentTheme.border} ${currentTheme.card}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <div>
                <h2 className={`text-lg font-semibold ${currentTheme.text}`}>{currentTopic.name}</h2>
                <p className={`text-sm ${currentTheme.textMuted}`}>
                  {members.filter(m => m.isActive).length} of {members.length} members online
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={async () => {
                  try {
                    const ticket = await getTicketForTopic(currentTopic.topicId);
                    if (ticket) {
                      navigator.clipboard.writeText(ticket);
                      toast.success('Invitation ticket copied to clipboard');
                    }
                  } catch (error) {
                    toast.error('Failed to generate ticket');
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${currentTheme.cardHover} ${currentTheme.textSecondary}`}
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => {}}
                className={`p-2 rounded-lg transition-colors ${currentTheme.cardHover} ${currentTheme.textSecondary}`}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex space-x-1 mt-4">
            {[
              { key: 'chat' as const, icon: MessageCircle, label: 'Chat' },
              { key: 'files' as const, icon: Files, label: 'Files' },
              { key: 'members' as const, icon: Users, label: 'Members' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeView === key
                    ? 'bg-blue-500 text-white'
                    : `${currentTheme.textSecondary} ${currentTheme.cardHover}`
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
    <div className={`h-screen flex ${currentTheme.bg}`}>
      {/* Sidebar */}
      <div className={`w-80 ${currentTheme.sidebar} border-r ${currentTheme.border} flex flex-col`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className={`text-xl font-bold ${currentTheme.text}`}>CrewCast</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${currentTheme.cardHover}`}
              >
                {isDark ? (
                  <Sun className={`w-5 h-5 ${currentTheme.textSecondary}`} />
                ) : (
                  <Moon className={`w-5 h-5 ${currentTheme.textSecondary}`} />
                )}
              </button>
              <div className={`flex items-center space-x-1 ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              </div>
            </div>
          </div>
          
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${currentTheme.textMuted}`} />
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${currentTheme.input} ${currentTheme.text}`}
            />
          </div>
        </div>

        {/* Topics List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wide ${currentTheme.textMuted}`}>
              Topics ({topics.length})
            </h2>
            <button
              onClick={() => setShowCreateTopic(true)}
              className={`p-1 rounded hover:bg-opacity-10 hover:bg-blue-500 ${currentTheme.textSecondary} hover:text-blue-500`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {renderTopicsList()}
        </div>

        {/* User Profile */}
        <div className={`p-4 border-t ${currentTheme.border}`}>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {currentUser?.firstName?.substring(0, 2).toUpperCase() || 'ME'}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 ${
                isDark ? 'border-gray-800' : 'border-white'
              }`}></div>
            </div>
            <div className="flex-1">
              <p className={`font-medium ${currentTheme.text}`}>
                {currentUser?.firstName || 'Your Name'} {currentUser?.lastName || ''}
              </p>
              <p className={`text-sm ${currentTheme.textMuted}`}>Online</p>
            </div>
            <button className={`p-2 rounded-lg transition-colors ${currentTheme.cardHover}`}>
              <Settings className={`w-4 h-4 ${currentTheme.textSecondary}`} />
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
          <div className={`w-96 p-6 rounded-xl ${currentTheme.card}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${currentTheme.text}`}>Create New Topic</h3>
              <button
                onClick={() => setShowCreateTopic(false)}
                className={`p-1 rounded hover:bg-opacity-10 hover:bg-gray-500 ${currentTheme.textSecondary}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${currentTheme.text}`}>Topic Name</label>
                <input
                  type="text"
                  placeholder="Enter topic name..."
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${currentTheme.input} ${currentTheme.text}`}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCreateTopic(false)}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${currentTheme.border} ${currentTheme.textSecondary} ${currentTheme.cardHover}`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (newTopicName.trim()) {
                      await createTopic(newTopicName);
                      setNewTopicName('');
                      setShowCreateTopic(false);
                      // Refresh topics list
                      const updatedTopics = await fetchTopics();
                      setTopics(updatedTopics);
                    }
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${currentTheme.button}`}
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

export default CrewCastMainUI;