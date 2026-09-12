import React, { useState } from 'react';
import styles from './Chat.module.css';

export default function SimpleChat({ embedded = false }) {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'สวัสดีครับ มีอะไรให้ผมช่วยวันนี้ไหมครับ?' }
  ]);
  const [input, setInput] = useState('');

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // เพิ่มข้อความใหม่ของผู้ใช้
    const newMessage = { id: Date.now(), sender: 'user', text: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput('');
  };

  return (
    <div className={`${styles.chatContainer} ${embedded ? styles.embedded : ''}`}>
      <div className={styles.messageList}>
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.message} ${styles[msg.sender]}`}>
            <p>{msg.text}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSendMessage} className={styles.inputForm}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="พิมพ์ข้อความที่นี่..."
        />
        <button type="submit">ส่ง</button>
      </form>
    </div>
  );
}