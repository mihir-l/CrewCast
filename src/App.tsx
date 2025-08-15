import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ToastContainer, toast } from "react-toastify"; // Import Toastify
import "react-toastify/dist/ReactToastify.css"; // Import Toastify styles
import "./App.css";

function App() {
  const [ticket, setTicket] = useState(""); // To store the ticket for joining a topic
  const [topicId, setTopicId] = useState(""); // To store the topic ID for joining a topic
  const [generatedTicket, setGeneratedTicket] = useState(""); // To store the generated ticket
  const [messages, setMessages] = useState<string[]>([]); // To store received gossip messages
  const [topicName, setTopicName] = useState(""); // To store the topic name entered by the user
  const [chatMessage, setChatMessage] = useState(""); // To store the message to be sent

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

  useEffect(() => {
    // Listen for the "gossip-message" event emitted from the backend
    const unlisten = listen("gossip-message", (event) => {
      const message = event.payload as string;
      console.log("Gossip message received:", message);

      try {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === "new_member") {
          // Handle NewMember message
          const newMember = parsedMessage.member;
          toast.info(`New Member Joined: Node ID ${newMember}`);
        }
        if (parsedMessage.type === "check_in") {
          const sender = parsedMessage.sender;
          toast.info(`Check-in from: Node ID ${sender}`, { autoClose: 500 });
        }

        // Add the message to the chat area
        setMessages((prevMessages) => [...prevMessages, message]);
      } catch (error) {
        console.error("Failed to parse gossip message:", error);
      }
    });

    return () => {
      unlisten.then((fn) => fn()); // Cleanup the listener on component unmount
    };
  }, []);

  return (
    <div className="app">
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
                {msg}
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

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}

export default App;