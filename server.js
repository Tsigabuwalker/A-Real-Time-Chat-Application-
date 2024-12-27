const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const multer = require('multer');
const fs = require('fs');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use(cors());
app.use(express.static(__dirname));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const chatRooms = {};

// Handle WebSocket connections
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const messageObject = JSON.parse(message.toString());
        const { type, chatCode } = messageObject;

        if (type === 'join') {
            chatRooms[chatCode] = chatRooms[chatCode] || new Set();
            chatRooms[chatCode].add(ws);
            return;
        }

        // Broadcast message to clients in the same chat room
        const targetClients = chatRooms[chatCode];
        targetClients?.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(messageObject));
            }
        });
    });

    ws.on('close', () => {
        for (const room in chatRooms) {
            chatRooms[room].delete(ws);
        }
    });
});

// Handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `uploads/${req.file.filename}`;
    const message = {
        sender: req.body.sender,
        text: `File uploaded: ${fileUrl}`,
        timestamp: new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }),
        chatCode: req.body.chatCode
    };

    const targetClients = chatRooms[req.body.chatCode];
    targetClients?.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });

    res.json({ message: 'File uploaded successfully', file: fileUrl });
});

// Start the server
server.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});