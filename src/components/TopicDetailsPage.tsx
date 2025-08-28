import React, { useState } from 'react';
import { useTopic } from '../contexts/TopicContext';
import { toast } from 'react-toastify';
import MembersPanel from './MembersPanel';
import FilesPanel from './FilesPanel';
import ChatPanel from './ChatPanel';

const TopicDetailsPage: React.FC = () => {
    const { currentTopic, leaveTopic, getTicketForTopic } = useTopic();
    const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'members'>('chat');
    const [ticketVisible, setTicketVisible] = useState(false);
    const [inviteTicket, setInviteTicket] = useState('');

    if (!currentTopic) {
        return null; // Should never happen as this component should only be shown when a topic is active
    }

    return (
        <div className="topic-details-page">
            <header className="topic-header">
                <div className="topic-info">
                    <h1>{currentTopic.name}</h1>
                    <div className="topic-meta">
                        <span className="topic-id">ID: {currentTopic.id}</span>
                    </div>
                </div>
                <div className="topic-actions">
                    <button
                        onClick={async () => {
                            const ticket = await getTicketForTopic(currentTopic.topicId);
                            if (ticket) {
                                setInviteTicket(ticket);
                                setTicketVisible(true);
                                toast.success('Invitation ticket generated');
                            }
                        }}
                        className="btn btn-secondary"
                    >
                        Get Invitation Ticket
                    </button>
                    <button onClick={leaveTopic} className="btn btn-danger">
                        Leave Topic
                    </button>
                </div>
            </header>

            {ticketVisible && inviteTicket && (
                <div className="topic-invite-ticket">
                    <div className="ticket-header">
                        <h3>Invitation Ticket</h3>
                        <button
                            className="btn btn-sm btn-secondary close-ticket"
                            onClick={() => setTicketVisible(false)}
                        >
                            ✕
                        </button>
                    </div>
                    <p>Share this ticket to invite others to join this topic:</p>
                    <div className="ticket-display">
                        <div className="ticket-value" onClick={(e) => {
                            if (window.getSelection && document.createRange) {
                                const range = document.createRange();
                                range.selectNodeContents(e.currentTarget);
                                const selection = window.getSelection();
                                selection?.removeAllRanges();
                                selection?.addRange(range);
                            }
                        }}>
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
                            className="btn btn-sm btn-primary copy-ticket"
                            title="Copy ticket to clipboard"
                        >
                            Copy
                        </button>
                    </div>
                </div>
            )}

            <div className="tab-navigation">
                <button
                    className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    Chat
                </button>
                <button
                    className={`tab-button ${activeTab === 'files' ? 'active' : ''}`}
                    onClick={() => setActiveTab('files')}
                >
                    Files
                </button>
                <button
                    className={`tab-button ${activeTab === 'members' ? 'active' : ''}`}
                    onClick={() => setActiveTab('members')}
                >
                    Members
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'chat' && <ChatPanel topicId={currentTopic.topicId} />}
                {activeTab === 'files' && <FilesPanel topicId={currentTopic.topicId} />}
                {activeTab === 'members' && <MembersPanel topicId={currentTopic.topicId} />}
            </div>
        </div>
    );
};

export default TopicDetailsPage;
