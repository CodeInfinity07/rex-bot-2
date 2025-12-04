const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json({ limit: '100mb' }));

let messageCount = 0;

app.post('/websocket-data', (req, res) => {
    messageCount++;
    const data = req.body;
    const timestamp = new Date().toISOString();
    
    console.log('\n' + '='.repeat(80));
    console.log(`[${messageCount}] [${timestamp}] WEBSOCKET MESSAGE RECEIVED!`);
    console.log('URL:', data.url);
    
    console.log('\n--- REQUEST ---');
    console.log('Method:', data.method);
    if (data.headers) {
        console.log('Headers:', data.headers.slice(0, 5));
    }
    if (data.payload) {
        console.log('Payload length:', data.payload.length);
        console.log('Payload preview:', data.payload.substring(0, 500));
    }
    
    if (data.response_payload) {
        console.log('\n--- RESPONSE ---');
        console.log('Status:', data.response_status);
        if (data.response_headers) {
            console.log('Headers:', data.response_headers.slice(0, 5));
        }
        console.log('Payload length:', data.response_payload.length);
        console.log('Payload preview:', data.response_payload.substring(0, 500));
    }
    
    console.log('='.repeat(80));
    
    // Save to file
    fs.appendFileSync('websocket-traffic.log', JSON.stringify({timestamp, ...data}) + '\n');
    
    res.status(200).json({ status: 'received', count: messageCount });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', messages_received: messageCount });
});

app.listen(8899, '0.0.0.0', () => {
    console.log('WebSocket forwarder listening on 209.126.3.251:8899');
    console.log('Ready to receive WebSocket messages');
});