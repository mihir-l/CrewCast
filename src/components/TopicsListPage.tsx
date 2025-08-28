import React, { useState, useEffect } from 'react';
import { useTopic } from '../contexts/TopicContext';
import { Topic } from '../types/interfaces';
import { toast } from 'react-toastify';

const TopicsListPage: React.FC = () => {
    const { fetchTopics, createTopic, joinTopicWithTicket, joinTopicWithId } = useTopic();

    const [topics, setTopics] = useState<Topic[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTopicName, setNewTopicName] = useState('');
    const [joinTicket, setJoinTicket] = useState('');
    const [topicIdToJoin, setTopicIdToJoin] = useState('');
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
            loadTopics();
        }
    };

    const handleJoinWithTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinTicket.trim()) {
            toast.warn('Please enter a valid ticket');
            return;
        }

        await joinTopicWithTicket(joinTicket);
    };

    const handleJoinWithId = async (e: React.FormEvent) => {
        e.preventDefault();
        const id = parseInt(topicIdToJoin, 10);
        if (isNaN(id)) {
            toast.warn('Please enter a valid topic ID');
            return;
        }

        await joinTopicWithId(id);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedTicket);
        toast.info('Ticket copied to clipboard');
    };

    return (
        <div className="topics-page">
            <header className="page-header">
                <h1>CrewCast Topics</h1>
            </header>

            <div className="topics-grid">
                <div className="topics-actions">
                    <div className="create-topic-panel panel">
                        <h2>Create New Topic</h2>
                        <form onSubmit={handleCreateTopic}>
                            <input
                                type="text"
                                value={newTopicName}
                                onChange={(e) => setNewTopicName(e.target.value)}
                                placeholder="Enter topic name"
                                className="form-control"
                            />
                            <button type="submit" className="btn btn-primary">Create Topic</button>
                        </form>

                        {generatedTicket && (
                            <div className="generated-ticket">
                                <p>Share this ticket with others to invite them:</p>
                                <div className="ticket-container">
                                    <div className="ticket-field">
                                        <input
                                            type="text"
                                            value={generatedTicket}
                                            readOnly
                                            className="ticket-input"
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                        />
                                    </div>
                                    <div className="ticket-actions">
                                        <button
                                            onClick={copyToClipboard}
                                            className="btn btn-secondary copy-btn"
                                            title="Copy to clipboard"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                                                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
                                            </svg>
                                            Copy
                                        </button>
                                    </div>
                                </div>
                                <p className="ticket-help">
                                    <small>Click on the ticket to select it, or use the copy button</small>
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="join-topic-panel panel">
                        <h2>Join Existing Topic</h2>

                        <div className="join-section">
                            <h3>Join with Ticket</h3>
                            <form onSubmit={handleJoinWithTicket}>
                                <input
                                    type="text"
                                    value={joinTicket}
                                    onChange={(e) => setJoinTicket(e.target.value)}
                                    placeholder="Paste invitation ticket"
                                    className="form-control"
                                />
                                <button type="submit" className="btn btn-primary">Join with Ticket</button>
                            </form>
                        </div>

                        <div className="join-section">
                            <h3>Join with ID</h3>
                            <form onSubmit={handleJoinWithId}>
                                <input
                                    type="text"
                                    value={topicIdToJoin}
                                    onChange={(e) => setTopicIdToJoin(e.target.value)}
                                    placeholder="Enter topic ID"
                                    className="form-control"
                                />
                                <button type="submit" className="btn btn-primary">Join with ID</button>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="topics-list panel">
                    <h2>Available Topics</h2>

                    {loading ? (
                        <div className="loading">Loading topics...</div>
                    ) : topics.length === 0 ? (
                        <div className="no-topics">
                            <p>No topics available. Create a new topic to get started!</p>
                        </div>
                    ) : (
                        <div className="topics-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>ID</th>
                                        <th>Members</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topics.map((topic) => (
                                        <tr key={topic.id}>
                                            <td>{topic.name}</td>
                                            <td>{topic.id}</td>
                                            <td>{topic.members ? topic.members.length : 0}</td>
                                            <td>
                                                <button
                                                    onClick={() => joinTopicWithId(topic.id)}
                                                    className="btn btn-sm btn-secondary"
                                                >
                                                    Join
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopicsListPage;
