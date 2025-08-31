import React, { useState } from 'react';
import { useTopic } from '../contexts/TopicContext';
import { toast } from 'react-toastify';
import MembersPanel from './MembersPanel';
import FilesPanel from './FilesPanel';
import ChatPanel from './ChatPanel';

const TopicDetailsPage: React.FC = () => {
    const { currentTopic, getTicketForTopic, leaveTopic } = useTopic();
    const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'members'>('chat');
    const [ticketVisible, setTicketVisible] = useState(false);
    const [inviteTicket, setInviteTicket] = useState('');

    if (!currentTopic) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                        Welcome to CrewCast
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Select a topic to start sharing files and chatting with your crew, or create a new topic to get started.
                    </p>
                </div>
            </div>
        );
    }

    const getTopicColor = () => {
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
        return colors[parseInt(currentTopic.id.toString()) % colors.length];
    };

    return (
        <div className="flex-1 flex flex-col" style={{ background: 'var(--background)' }}>
            {/* Topic Header */}
            <div style={{
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                padding: '1rem'
            }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full ${getTopicColor()}`}></div>
                        <div>
                            <h1 style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: 'var(--text)',
                                margin: 0
                            }}>
                                {currentTopic.name}
                            </h1>
                            <p style={{
                                fontSize: '0.875rem',
                                color: 'var(--textSecondary)',
                                margin: 0
                            }}>
                                {currentTopic.members ? currentTopic.members.length : 0} of {currentTopic.members ? currentTopic.members.length : 0} members online
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={async () => {
                                const ticket = await getTicketForTopic(currentTopic.topicId);
                                if (ticket) {
                                    setInviteTicket(ticket);
                                    setTicketVisible(true);
                                    toast.success('Invitation ticket generated');
                                }
                            }}
                            className="icon-btn"
                            title="Share topic"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => { }}
                            className="icon-btn"
                            title="Topic settings"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <button
                            onClick={async () => {
                                await leaveTopic();
                                toast.success('Left topic successfully');
                            }}
                            className="icon-btn"
                            style={{ color: 'var(--error)' }}
                            title="Leave topic"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex space-x-1 mt-4">
                    {[
                        { key: 'chat' as const, icon: 'MessageCircle', label: 'Chat' },
                        { key: 'files' as const, icon: 'Files', label: 'Files' },
                        { key: 'members' as const, icon: 'Users', label: 'Members' },
                    ].map(({ key, icon, label }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200"
                            style={{
                                background: activeTab === key ? 'var(--primary)' : 'transparent',
                                color: activeTab === key ? 'white' : 'var(--textSecondary)'
                            }}
                        >
                            {icon === 'MessageCircle' && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            )}
                            {icon === 'Files' && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            )}
                            {icon === 'Users' && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            )}
                            <span className="text-sm font-medium">{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'chat' && <ChatPanel topicId={currentTopic.topicId} />}
                {activeTab === 'files' && <FilesPanel topicId={currentTopic.topicId} />}
                {activeTab === 'members' && <MembersPanel topicId={currentTopic.topicId} />}
            </div>

            {/* Invitation Ticket Modal */}
            {ticketVisible && inviteTicket && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 w-96 p-6 rounded-xl shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invitation Ticket</h3>
                            <button
                                onClick={() => setTicketVisible(false)}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            Share this ticket to invite others to join this topic:
                        </p>
                        <div className="flex items-center gap-2">
                            <div
                                className="flex-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 font-mono text-sm text-gray-900 dark:text-white break-all cursor-pointer select-all"
                                onClick={(e) => {
                                    if (window.getSelection && document.createRange) {
                                        const range = document.createRange();
                                        range.selectNodeContents(e.currentTarget);
                                        const selection = window.getSelection();
                                        selection?.removeAllRanges();
                                        selection?.addRange(range);
                                    }
                                }}
                            >
                                {inviteTicket}
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(inviteTicket);
                                    toast.info('Ticket copied to clipboard', {
                                        autoClose: 2000,
                                        position: "bottom-right"
                                    });
                                }}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                                title="Copy ticket to clipboard"
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

export default TopicDetailsPage;
