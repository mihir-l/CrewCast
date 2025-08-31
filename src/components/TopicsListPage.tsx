import React, { useState, useEffect } from 'react';
import { useTopic } from '../contexts/TopicContext';
import { useUser } from '../contexts/UserContext';
import { Topic } from '../types/interfaces';
import { toast } from 'react-toastify';

const TopicsListPage: React.FC = () => {
    const {
        fetchTopics,
        createTopic,
        joinTopicWithTicket,
        currentTopic,
        joinTopicWithId
    } = useTopic();

    const { currentUser } = useUser();

    const [topics, setTopics] = useState<Topic[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTopicName, setNewTopicName] = useState('');
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinTicket, setJoinTicket] = useState('');
    const [generatedTicket, setGeneratedTicket] = useState('');

    const loadTopics = async () => {
        setLoading(true);
        const fetchedTopics = await fetchTopics();
        setTopics(fetchedTopics);
        setLoading(false);
    };

    useEffect(() => {
        loadTopics();
    }, []);

    const filteredTopics = topics.filter(topic =>
        topic.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTopicName.trim()) {
            toast.warn('Please enter a valid topic name');
            return;
        }

        const ticket = await createTopic(newTopicName);
        if (ticket) {
            setGeneratedTicket(ticket);
            setNewTopicName('');
            setShowCreateModal(false);
            loadTopics();
        }
    };

    const handleJoinWithTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinTicket.trim()) {
            toast.warn('Please enter a valid ticket');
            return;
        }

        const success = await joinTopicWithTicket(joinTicket);
        if (success) {
            setJoinTicket('');
            setShowJoinModal(false);
            loadTopics();
        }
    };

    const handleTopicSelect = async (topic: Topic) => {
        try {
            await joinTopicWithId(topic.id);
        } catch (error) {
            console.error('Failed to join topic:', error);
            toast.error('Failed to join topic');
        }
    };

    const getTopicColor = (index: number) => {
        const colors = [
            'bg-blue-500',
            'bg-purple-500',
            'bg-green-500',
            'bg-yellow-500',
            'bg-red-500',
            'bg-indigo-500',
            'bg-pink-500',
            'bg-teal-500'
        ];
        return colors[index % colors.length];
    };

    return (
        <div className="modern-sidebar">
            {/* Sidebar Header */}
            <div className="sidebar-header">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="sidebar-title">CrewCast</h1>
                    <div className="sidebar-actions">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="icon-btn"
                            title="Create new topic"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="icon-btn"
                            title="Join topic"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="search-container">
                    <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search topics..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Topics List */}
            <div className="sidebar-content">
                <div className="section-header">
                    Topics ({filteredTopics.length})
                </div>

                {loading ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </div>
                        <p>Loading topics...</p>
                    </div>
                ) : filteredTopics.length === 0 ? (
                    <div className="empty-state">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            {searchQuery ? 'No topics found' : 'No topics yet'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Create your first topic
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredTopics.map((topic, index) => (
                            <div
                                key={topic.id}
                                onClick={() => handleTopicSelect(topic)}
                                style={{
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    border: currentTopic?.id === topic.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    backgroundColor: currentTopic?.id === topic.id ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}
                                onMouseEnter={(e) => {
                                    if (currentTopic?.id !== topic.id) {
                                        (e.target as HTMLElement).style.backgroundColor = 'var(--border)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (currentTopic?.id !== topic.id) {
                                        (e.target as HTMLElement).style.backgroundColor = 'var(--surface)';
                                    }
                                }}
                            >
                                <div
                                    className={getTopicColor(index)}
                                    style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        flexShrink: 0
                                    }}
                                ></div>
                                <h3 style={{
                                    fontWeight: 500,
                                    color: 'var(--text)',
                                    fontSize: '14px',
                                    margin: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1
                                }}>
                                    {topic.name}
                                </h3>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* User Profile Footer */}
            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="user-avatar">
                        <div className="avatar">ME</div>
                        <div className="status-indicator"></div>
                    </div>
                    <div className="user-info">
                        <div className="user-name">{currentUser?.firstName || 'User'}</div>
                        <div className="user-status">Online</div>
                    </div>
                    <button className="icon-btn">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Create Topic Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Create New Topic</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="modal-close"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleCreateTopic} className="modal-form">
                            <div className="form-group">
                                <label className="form-label">Topic Name</label>
                                <input
                                    type="text"
                                    value={newTopicName}
                                    onChange={(e) => setNewTopicName(e.target.value)}
                                    placeholder="Enter topic name..."
                                    className="form-input"
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="btn btn-secondary"
                                    style={{ flex: 1 }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                >
                                    Create Topic
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Join Topic Modal */}
            {showJoinModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Join Topic</h3>
                            <button
                                onClick={() => setShowJoinModal(false)}
                                className="modal-close"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleJoinWithTicket} className="modal-form">
                            <div className="form-group">
                                <label className="form-label">Invitation Ticket</label>
                                <input
                                    type="text"
                                    value={joinTicket}
                                    onChange={(e) => setJoinTicket(e.target.value)}
                                    placeholder="Paste invitation ticket..."
                                    className="form-input"
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    onClick={() => setShowJoinModal(false)}
                                    className="btn btn-secondary"
                                    style={{ flex: 1 }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                >
                                    Join Topic
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Generated Ticket Display */}
            {generatedTicket && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Topic Created!</h3>
                            <button
                                onClick={() => setGeneratedTicket('')}
                                className="modal-close"
                            >
                                ✕
                            </button>
                        </div>
                        <p style={{ color: 'var(--textSecondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            Share this ticket to invite others to join your topic:
                        </p>
                        <div className="ticket-display">
                            <div className="ticket-value">
                                {generatedTicket}
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(generatedTicket);
                                    toast.success('Ticket copied to clipboard');
                                }}
                                className="btn btn-primary"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TopicsListPage;
