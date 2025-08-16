import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from '@tauri-apps/plugin-dialog';
import { ToastContainer, toast } from "react-toastify"; // Import Toastify
import { Node } from './types/node';
import "react-toastify/dist/ReactToastify.css"; // Import Toastify styles
import "./App.css";

interface SharedFile {
  fileName: string;
  sender: string;
  blobTicket: string;
  timestamp: number;
}

function App() {
  const [ticket, setTicket] = useState(""); // To store the ticket for joining a topic
  const [topicId, setTopicId] = useState(""); // To store the topic ID for joining a topic
  const [generatedTicket, setGeneratedTicket] = useState(""); // To store the generated ticket
  const [messages, setMessages] = useState<
    { content: string; sender: string; firstName?: string }[]
  >([]); // To store received gossip messages
  const [topicName, setTopicName] = useState(""); // To store the topic name entered by the user
  const [chatMessage, setChatMessage] = useState(""); // To store the message to be sent
  const [showUserForm, setShowUserForm] = useState(false); // To control the visibility of the user form
  const [userInfo, setUserInfo] = useState({
    email: "",
    firstName: "",
    lastName: "",
    nodeId: "",
  }); // To store user information
  const [userCache, setUserCache] = useState<Record<string, { firstName: string }>>({}); // Cache for nodeId to User mapping
  const [currentNode, setCurrentNode] = useState<Node | null>(null);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);

  // Function to handle file selection and sharing
  async function handleFileShare() {
    try {
      // Open file selector dialog
      const filePath = await open({
        multiple: false,
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (filePath && typeof filePath === 'string') {
        await invoke('share_file', { filePath });
        toast.success('File shared successfully');
      }
    } catch (error) {
      console.error('Failed to share file:', error);
      toast.error('Failed to share file');
    }
  }

  // Function to download a shared file
  async function handleFileDownload(ticket: string, fileName: string) {
    try {
      // Let user choose where to save the file
      console.log("Downloading file:", fileName, "with ticket:", ticket);
      await invoke('download_file', {
        ticket: ticket,
        fileName: fileName
      });
      toast.success('File downloaded successfully');

    } catch (error) {
      console.error('Failed to download file:', error);
      toast.error('Failed to download file');
    }
  }

  // Function to handle user form submission
  async function handleUserFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentNode) {
      toast.error("No node initialized");
      return;
    }
    console.log(currentNode.nodeId);

    try {
      await invoke("create_user", {
        user: {
          email: userInfo.email,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          nodeId: currentNode.nodeId, // Use node_id from currentNode
        },
      });
      toast.success("User created successfully!");
      setShowUserForm(false);
    } catch (error) {
      console.error("Failed to create user:", error);
      toast.error("Failed to create user.");
    }
  }

  // Function to fetch user by nodeId and cache it
  async function fetchUserByNodeId(nodeId: string) {
    if (userCache[nodeId]) {
      return userCache[nodeId]; // Return cached user if available
    }

    try {
      const user = await invoke<{ firstName: string }>("get_user_by_node_id", { nodeId: nodeId });
      setUserCache((prevCache) => ({ ...prevCache, [nodeId]: user })); // Cache the user
      return user;
    } catch (error) {
      console.error(`Failed to fetch user for nodeId ${nodeId}:`, error);
      return { firstName: "Unknown" }; // Fallback if user fetch fails
    }
  }

  // Function to start a new topic
  async function startNewTopic() {
    if (topicName.trim() !== "") {
      try {
        const ticket = await invoke<string>("start_new_topic", { name: topicName });
        setGeneratedTicket(ticket); // Store the generated ticket
        toast.success(`New topic started! Ticket: ${ticket}`);
      } catch (error) {
        console.error("Failed to start a new topic:", error);
        toast.error("Failed to start a new topic.");
      }
    } else {
      toast.warn("Please enter a valid topic name.");
    }
  }

  // Function to join a topic with a ticket
  async function joinTopicWithTicket() {
    if (ticket.trim() !== "") {
      try {
        const topic = await invoke("join_topic_with_ticket", { key: ticket });
        console.log("Joined topic with ticket:", topic);
        toast.success("Successfully joined the topic with the provided ticket.");
      } catch (error) {
        console.error("Failed to join topic with ticket:", error);
        toast.error("Failed to join topic with the provided ticket.");
      }
    } else {
      toast.warn("Please enter a valid ticket.");
    }
  }

  // Function to join a topic with an ID
  async function joinTopicWithId() {
    if (topicId.trim() !== "") {
      try {
        const topic = await invoke("join_topic_with_id", { id: parseInt(topicId, 10) });
        console.log("Joined topic with ID:", topic);
        toast.success("Successfully joined the topic with the provided ID.");
      } catch (error) {
        console.error("Failed to join topic with ID:", error);
        toast.error("Failed to join topic with the provided ID.");
      }
    } else {
      toast.warn("Please enter a valid topic ID.");
    }
  }

  // Function to send a message
  async function sendMessage() {
    if (chatMessage.trim() !== "") {
      try {
        await invoke("send_message", { message: chatMessage });
        setChatMessage(""); // Clear the input field after sending
        toast.success("Message sent!");
      } catch (error) {
        console.error("Failed to send message:", error);
        toast.error("Failed to send message.");
      }
    } else {
      toast.warn("Please enter a valid message.");
    }
  }

  // Function to check if user exists
  async function checkAndInitializeUser() {
    try {
      // First check if node exists
      const node = await invoke<Node>("get_node_by_id", { id: 1 });
      setCurrentNode(node); // Store the node


      try {
        // Then check if user exists for this node
        await invoke("get_user_by_node_id", { nodeId: node.nodeId });
        // User exists, no need to show form
      } catch (error) {
        // User doesn't exist, show the form and pre-fill nodeId
        setUserInfo(prev => ({ ...prev, nodeId: node.nodeId }));
        setShowUserForm(true);
      }
    } catch (error) {
      console.error("Failed to check node/user:", error);
      toast.error("Failed to initialize application");
    }
  }

  useEffect(() => {
    // Check for existing user on app start
    checkAndInitializeUser();

    // Listen for the "gossip-message" event emitted from the backend
    const unlistenGossipMessage = listen("gossip-message", async (event) => {
      const message = event.payload as string;
      console.log("Gossip message received:", message);

      try {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === "chat") {
          const sender = parsedMessage.sender;
          const user = await fetchUserByNodeId(sender);
          setMessages((prevMessages) => [
            ...prevMessages,
            { content: parsedMessage.content, sender, firstName: user.firstName },
          ]);
        } else if (parsedMessage.type === "check_in") {
          const newMember = parsedMessage.sender;
          const user = await fetchUserByNodeId(newMember);
          toast.info(`New Member Joined: ${user.firstName}`);
        } else if (parsedMessage.type === "file") {
          // Add new shared file to the list
          const user = await fetchUserByNodeId(parsedMessage.sender);
          setSharedFiles(prev => [...prev, {
            fileName: parsedMessage.fileName,
            sender: user.firstName || parsedMessage.sender,
            blobTicket: parsedMessage.blobTicket,
            timestamp: parsedMessage.ts
          }]);
          toast.info(`New file shared: ${parsedMessage.fileName}`);
        }
      } catch (error) {
        console.error("Failed to parse gossip message:", error);
      }
    });

    const unlistenDownloadProgress = listen("download-progress", async (event) => {
      const progress = event.payload as string;
      try {
        const parsedMessage = JSON.parse(progress);
        console.log("Download progress received:", parsedMessage);
        toast.info(`${parsedMessage.fileName}: ${parsedMessage.percentage}%`);
      } catch (error) {
        console.error("Failed to parse download progress:", error);
      }

    });

    return () => {
      unlistenGossipMessage.then((fn) => fn());
      unlistenDownloadProgress.then((fn) => fn());
    };
  }, [userCache]); // Re-run effect if userCache changes

  return (
    <div className="app">
      {showUserForm && (
        <div className="user-form-overlay">
          <form className="user-form" onSubmit={handleUserFormSubmit}>
            <h2>Welcome! Please provide your information</h2>
            <label>
              Email:
              <input
                type="email"
                value={userInfo.email}
                onChange={(e) =>
                  setUserInfo((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
            </label>
            <label>
              First Name:
              <input
                type="text"
                value={userInfo.firstName}
                onChange={(e) =>
                  setUserInfo((prev) => ({ ...prev, firstName: e.target.value }))
                }
                required
              />
            </label>
            <label>
              Last Name:
              <input
                type="text"
                value={userInfo.lastName}
                onChange={(e) =>
                  setUserInfo((prev) => ({ ...prev, lastName: e.target.value }))
                }
              />
            </label>

            <button type="submit">Submit</button>
          </form>
        </div>
      )}

      {/* Existing UI */}
      <aside className="sidebar">
        <h2>Topic Management</h2>

        {/* Start a new topic */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startNewTopic();
          }}
        >
          <input
            id="topic-name-input"
            value={topicName}
            onChange={(e) => setTopicName(e.currentTarget.value)}
            placeholder="Enter a topic name..."
          />
          <button type="submit">Start New Topic</button>
        </form>
        {generatedTicket && (
          <p className="generated-ticket">
            Generated Ticket: <code>{generatedTicket}</code>
          </p>
        )}

        {/* Join a topic with a ticket */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            joinTopicWithTicket();
          }}
        >
          <input
            id="ticket-input"
            value={ticket}
            onChange={(e) => setTicket(e.currentTarget.value)}
            placeholder="Enter a ticket to join a topic..."
          />
          <button type="submit">Join Topic with Ticket</button>
        </form>

        {/* Join a topic with an ID */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            joinTopicWithId();
          }}
        >
          <input
            id="topic-id-input"
            value={topicId}
            onChange={(e) => setTopicId(e.currentTarget.value)}
            placeholder="Enter a topic ID to join..."
          />
          <button type="submit">Join Topic with ID</button>
        </form>
      </aside>

      <main className="chat">
        <header className="chat-header">
          <h1>CrewCast Chat</h1>
        </header>
        <div className="messages">
          {messages.length > 0 ? (
            messages.map((msg, index) => (
              <p key={index} className="message">
                <strong>{msg.firstName || msg.sender}:</strong> {msg.content}
              </p>
            ))
          ) : (
            <p className="no-messages">No messages yet. Start a conversation!</p>
          )}
        </div>
        <form
          className="message-input"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            id="message-input"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.currentTarget.value)}
            placeholder="Type a message..."
          />
          <button type="submit">Send</button>
        </form>
      </main>

      <div className="file-sharing-section">
        <h2>File Sharing</h2>
        <button
          className="share-file-btn"
          onClick={handleFileShare}
        >
          Share a File
        </button>

        <div className="shared-files">
          <h3>Shared Files</h3>
          {sharedFiles.length === 0 ? (
            <p className="no-files">No files have been shared yet</p>
          ) : (
            <ul className="files-list">
              {sharedFiles.map((file, index) => (
                <li key={index} className="file-item">
                  <div className="file-info">
                    <span className="file-name">{file.fileName}</span>
                    <span className="file-sender">Shared by: {file.sender}</span>
                    <span className="file-time">
                      {new Date(file.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>
                  <button
                    className="download-btn"
                    onClick={() => handleFileDownload(file.blobTicket, file.fileName)}
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>


      <ToastContainer autoClose={2000} />
    </div>
  );
}

export default App;