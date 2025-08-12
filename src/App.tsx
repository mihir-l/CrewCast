import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [messages, setMessages] = useState<string[]>([]); // To store received messages
  const [messageToSend, setMessageToSend] = useState(""); // To store the message to send

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  async function sendMessage() {
    if (messageToSend.trim() !== "") {
      await invoke("send_message", { message: messageToSend });
      setMessageToSend(""); // Clear the input field after sending
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
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src="./assets/react.svg" className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>

      <hr />

      <h2>Messages</h2>
      <div className="messages">
        {messages.map((msg, index) => (
          <p key={index}>{msg}</p>
        ))}
      </div>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
      >
        <input
          id="message-input"
          value={messageToSend}
          onChange={(e) => setMessageToSend(e.currentTarget.value)}
          placeholder="Enter a message to send..."
        />
        <button type="submit">Send Message</button>
      </form>
    </main>
  );
}

export default App;