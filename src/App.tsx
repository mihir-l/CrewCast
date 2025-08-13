import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const [messages, setMessages] = useState<string[]>([]); // To store received messages
  const [messageToSend, setMessageToSend] = useState(""); // To store the message to send
  const [ticket, setTicket] = useState(""); // To store the ticket for joining a topic
  const [generatedTicket, setGeneratedTicket] = useState(""); // To store the generated ticket

  // Function to send a message
  async function sendMessage() {
    if (messageToSend.trim() !== "") {
      await invoke("send_message", { message: messageToSend });
      setMessageToSend(""); // Clear the input field after sending
    }
  }

  // Function to start a new topic
  async function startNewTopic() {
    const ticket = await invoke<string>("start_new_topic");
    setGeneratedTicket(ticket); // Store the generated ticket
    alert(`New topic started! Ticket: ${ticket}`);
  }

  // Function to join an existing topic
  async function joinTopic() {
    if (ticket.trim() !== "") {
      try {
        const joinedTicket = await invoke<string>("join_topic", { ticketKey: ticket });
        alert(`Joined topic successfully! Ticket: ${joinedTicket}`);
      } catch (error) {
        alert(`Failed to join topic: ${error}`);
      }
    }
  }

  useEffect(() => {
    // Listen for the "gossip-message" event emitted from the backend
    const unlisten = listen("gossip-message", (event) => {
      const { sender, content } = event.payload as { sender: string; content: string };
      setMessages((prevMessages) => [...prevMessages, `${sender}: ${content}`]);
    });

    return () => {
      unlisten.then((fn) => fn()); // Cleanup the listener on component unmount
    };
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Topic Management</h2>
        <button onClick={startNewTopic}>Start New Topic</button>
        {generatedTicket && (
          <p className="generated-ticket">
            Generated Ticket: <code>{generatedTicket}</code>
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            joinTopic();
          }}
        >
          <input
            id="ticket-input"
            value={ticket}
            onChange={(e) => setTicket(e.currentTarget.value)}
            placeholder="Enter a ticket to join a topic..."
          />
          <button type="submit">Join Topic</button>
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
            value={messageToSend}
            onChange={(e) => setMessageToSend(e.currentTarget.value)}
            placeholder="Type a message..."
          />
          <button type="submit">Send</button>
        </form>
      </main>
    </div>
  );
}

export default App;