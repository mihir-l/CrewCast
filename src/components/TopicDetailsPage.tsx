import React, { useState } from 'react';
import { useTopic } from '../contexts/TopicContext';
import MembersPanel from './MembersPanel';
import FilesPanel from './FilesPanel';
import ChatPanel from './ChatPanel';

const TopicDetailsPage: React.FC = () => {
    const { currentTopic, leaveTopic } = useTopic();
    const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'members'>('chat');

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
                    <button onClick={leaveTopic} className="btn btn-danger">
                        Leave Topic
                    </button>
                </div>
            </header>

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
