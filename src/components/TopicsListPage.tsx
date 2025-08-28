import React, { useState, useEffect } from 'react';
import { useTopic } from '../contexts/TopicContext';
import { Topic } from '../types/interfaces';
import { toast } from 'react-toastify';

const TopicsListPage: React.FC = () => {
    const { fetchTopics, createTopic, joinTopicWithTicket, joinTopicWithId, getTicketForTopic } = useTopic();

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
        toast.info('Ticket copied to clipboard', {
            autoClose: 2000,
            position: "bottom-right"
        });
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
                            <div className="topic-invite-ticket">
                                <div className="ticket-header">
                                    <h3>Topic Invitation Ticket</h3>
                                    <button
                                        className="close-ticket"
                                        onClick={() => setGeneratedTicket('')}
                                        aria-label="Close"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <p>Share this ticket with others to invite them to join this topic:</p>
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
                                        {generatedTicket}
                                    </div>
                                    <button
                                        onClick={copyToClipboard}
                                        className="btn btn-sm btn-primary copy-ticket"
                                        title="Copy ticket to clipboard"
                                    >
                                        Copy
                                    </button>
                                </div>
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
                                            <td className="topic-actions-cell">
                                                <button
                                                    onClick={() => joinTopicWithId(topic.id)}
                                                    className="btn btn-sm btn-primary"
                                                    title="Join this topic"
                                                >
                                                    Join
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        console.log(topic);
                                                        const ticket = await getTicketForTopic(topic.topicId);
                                                        if (ticket) {
                                                            setGeneratedTicket(ticket);
                                                            // Scroll to the ticket display
                                                            setTimeout(() => {
                                                                document.querySelector('.generated-ticket')?.scrollIntoView({
                                                                    behavior: 'smooth',
                                                                    block: 'center'
                                                                });
                                                            }, 100);
                                                        }
                                                    }}
                                                    className="btn btn-sm btn-secondary"
                                                    title="Get invitation ticket"
                                                >
                                                    Get Ticket
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
