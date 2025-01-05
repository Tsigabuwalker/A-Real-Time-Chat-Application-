const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');

// MongoDB Atlas connection
const mongoURI = 'mongodb+srv://tsigabu:Batasha122123%40@cluster0.j7boq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Message schema
const messageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    chatCode: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// HTTP and WebSocket server setup
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Chat rooms object to manage WebSocket connections
const chatRooms = {};

// WebSocket connection handling
wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        const messageObject = JSON.parse(message.toString());
        const { type, chatCode, sender, text } = messageObject;

        if (type === 'join') {
            chatRooms[chatCode] = chatRooms[chatCode] || new Set();
            chatRooms[chatCode].add(ws);
            return;
        }

        // Save the message to MongoDB
        if (text) {
            const newMessage = new Message({ username: sender, chatCode, text });
            await newMessage.save().catch(err => console.error('Error saving message:', err));
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
            if (chatRooms[room].size === 0) {
                delete chatRooms[room];
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// File upload handling
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `uploads/${req.file.filename}`;
    const message = {
        sender: req.body.sender,
        text: `File uploaded: ${fileUrl}`,
        timestamp: new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }),
        chatCode: req.body.chatCode,
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