// @ts-nocheck

const ws = new WebSocket('ws://localhost:3000');

const chatMessages = document.querySelector('.chat-messages');
const chatInputForm = document.querySelector('.chat-input-form');
const chatInput = document.querySelector('.chat-input');
const clearChatBtn = document.querySelector('.clear-chat-button');
const chatHeader = document.querySelector('.chat-header');
const userInfoModal = document.querySelector('.user-info-modal');
const userInfoForm = document.querySelector('.user-info-form');

let messageSender = '';
let chatCode = '';

// Function to create chat message element
const createChatMessageElement = (message) => {
    if (message.text.startsWith('File uploaded:')) {
        return `
            <div class="message ${message.sender === messageSender ? 'blue-bg' : 'gray-bg'}">
                <div class="message-sender">${message.sender}</div>
                <div class="message-text">
                    <img src="${message.text.replace('File uploaded: ', '')}" alt="Uploaded image" class="uploaded-image" />
                </div>
                <div class="message-timestamp">${message.timestamp}</div>
            </div>
        `;
    }
    
    return `
        <div class="message ${message.sender === messageSender ? 'blue-bg' : 'gray-bg'}">
            <div class="message-sender">${message.sender}</div>
            <div class="message-text">${message.text}</div>
            <div class="message-timestamp">${message.timestamp}</div>
        </div>
    `;
};

// Handle incoming WebSocket messages
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    chatMessages.innerHTML += createChatMessageElement(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
};

// Function to update the message sender and chat code
const updateMessageSender = (name, code) => {
    messageSender = name;
    chatCode = code;
    chatHeader.innerText = `${messageSender} chatting with code: ${chatCode}`;
    chatInput.placeholder = `Type here, ${messageSender}...`;
    chatInput.focus();
};

// Handle user info form submission
userInfoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const code = e.target.chatCode.value;

    updateMessageSender(username, code);
    ws.send(JSON.stringify({ type: 'join', chatCode: code, sender: username }));

    userInfoModal.style.display = 'none';
});

// Handle sending a message
const sendMessage = (e) => {
    e.preventDefault();

    const timestamp = new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    const message = {
        sender: messageSender,
        text: chatInput.value,
        timestamp,
        chatCode
    };

    ws.send(JSON.stringify(message));
    chatInputForm.reset();
    chatMessages.scrollTop = chatMessages.scrollHeight;
};

// Attach event listeners
chatInputForm.addEventListener('submit', sendMessage);

clearChatBtn.addEventListener('click', () => {
    localStorage.clear();
    chatMessages.innerHTML = '';
});

// Handle emoji selection
document.querySelectorAll('.emoji').forEach((emojiElem) => {
    emojiElem.addEventListener('click', () => selectEmoji(emojiElem.innerText));
});