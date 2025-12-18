const http = require('http');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { OpenAI } = require('openai');
const axios = require('axios');
const { error } = require('winston');
const mysql = require('mysql2/promise');
const WebSocket = require('ws');

require('dotenv').config();

const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to prompt for input
function promptInput(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

// Simple logger replacement
const logger = {
    info: (message) => console.log(`[INFO] ${message}`),
    error: (message) => console.error(`[ERROR] ${message}`),
    warn: (message) => console.warn(`[WARN] ${message}`)
};

// MySQL Configuration
const MYSQL_CONFIG = {
    host: process.env.MYSQL_HOST || '94.72.106.77',
    user: process.env.MYSQL_USER || 'ryzon',
    password: process.env.MYSQL_PASSWORD || 'zain0980',
    database: 'ivex',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Message queue system
class MessageQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.currentSequence = 2;
    }

    getNextSequence() {
        return this.currentSequence++;
    }

    resetSequence() {
        this.currentSequence = 2;
    }

    async enqueue(messagePayload) {
        return new Promise((resolve, reject) => {
            this.queue.push({ messagePayload, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const { messagePayload, resolve, reject } = this.queue.shift();

            try {
                let parsedMessage;
                let needsSequence = false;

                try {
                    parsedMessage = JSON.parse(messagePayload);
                    needsSequence = parsedMessage.hasOwnProperty('SQ');
                } catch {
                    await this._sendDirectly(messagePayload);
                    resolve();
                    continue;
                }

                if (needsSequence) {
                    parsedMessage.SQ = this.getNextSequence();
                }

                await this._sendDirectly(JSON.stringify(parsedMessage));
                console.log(parsedMessage);
                resolve();
            } catch (error) {
                reject(error);
            }

            await new Promise(r => setTimeout(r, 200));
        }

        this.processing = false;
    }

    async _sendDirectly(message) {
        return new Promise((resolve, reject) => {
            if (!botState.ws || botState.ws.readyState !== WebSocket.OPEN) {
                reject(new Error("WebSocket is not open"));
                return;
            }

            try {
                const base64Message = Buffer.from(message, 'utf8').toString('base64');

                botState.ws.send(base64Message, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Create global message queue instance
const messageQueue = new MessageQueue();

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let mysqlPool;
let inClub = false;
let authRequired = false;
let authSocket = null;
let authMessage = null;
let club_code = process.env.CLUB_CODE;
let club_name = process.env.CLUB_NAME;
let my_uid = process.env.BOT_UID;
let bot_ep = process.env.EP;
let bot_key = process.env.KEY;
const PORT = process.env.PORT;
let allowInvites = false;
let membersData = [];
let bannedUserIds = [];
let check_ban_list = false;
const moveable_clubs = ['8937030'];
const ICIC_USAGE_FILE = './icic_usage.json';
const SETTINGS_FILE = './settings.json';
const MEMBERS_FILE = './club_members.json';
const conversationHistory = new Map();

// Load environment variables from token.txt
(async () => {
    if (!bot_ep || !bot_key) {
        const tokenPath = path.resolve('token.txt');

        try {
            await fs.access(tokenPath);
            const base64data = (await fs.readFile(tokenPath, 'utf-8')).trim();
            const decoded = Buffer.from(base64data, 'base64').toString('utf-8');
            const outer = JSON.parse(decoded);
            const pyData = JSON.parse(outer.PY);

            bot_ep = pyData.EP;
            bot_key = pyData.KEY;

            const envPath = path.resolve('.env');
            let envContent = '';
            try {
                envContent = await fs.readFile(envPath, 'utf-8');
            } catch {
                // .env might not exist
            }

            const newLines = [];
            if (!envContent.includes('EP=')) newLines.push(`EP=${bot_ep}`);
            if (!envContent.includes('KEY=')) newLines.push(`KEY=${bot_key}`);

            if (newLines.length > 0) {
                await fs.appendFile(envPath, '\n' + newLines.join('\n'));
                console.log('✅ Added EP and KEY to .env');
            }

            process.env.EP = bot_ep;
            process.env.KEY = bot_key;

        } catch (err) {
            console.error('❌ Failed to decode token.txt or update env:', err);
            process.exit(1);
        }
    }

    console.log('Club Code:', club_code);
    console.log('Club Name:', club_name);
    console.log('BOT UID:', my_uid);
    console.log('Endpoint:', bot_ep);
    console.log('Key:', bot_key);
    console.log('Port:', PORT);
})();

const DEFAULT_SETTINGS = {
    allowAvatars: true,
    banLevel: 10,
    allowGuestIds: false,
    punishments: {
        bannedPatterns: 'ban',
        lowLevel: 'ban',
        noGuestId: 'ban',
        noAvatar: 'kick',
        spamWords: 'kick'
    }
};

// File paths
const CONFIG_FILES = {
    'admins': './admins.txt',
    'spam-words': './spam.txt',
    'banned-patterns': './banned_patterns.txt',
    'exemptions': './exemptions.txt',
    'loyal_members': './loyal_members.txt',
    'settings': './settings.json',
    'bot-config': './bot_configuration.json',
    'tone-templates': './tone_templates.json'
};

const path_users = './users.json';
const spamPath = "./spam.txt";

// Bot state management
let botState = {
    connected: false,
    connecting: false,
    ws: null,
    clubCode: `${club_code}`,
    clubName: `${club_name}`,
    startTime: null,
    stats: {
        messagesProcessed: 0,
        usersKicked: 0,
        spamBlocked: 0
    }
};

// Bot configuration
let botConfig = {
    admins: [],
    spamWords: [],
    bannedPatterns: [],
    settings: null,
    botConfiguration: null,
    toneTemplates: null
};

// Game state variables
let secretNumber = Math.floor(Math.random() * 100) + 1;
let botMic = 0;
let index_idx = 1;
let mics = new Array(10).fill(null);
let onMic = false;
let savedData = {};
let clubAdmins = [];
let pendingRemovals = [];
let pendingBans = [];
let pendingKicks = [];

let openai = new OpenAI({
    apiKey: process.env.OPENAI
});

// Reinitialize OpenAI
function reinitializeOpenAI(apiKey) {
    try {
        openai = new OpenAI({
            apiKey: apiKey
        });
        logger.info('✅ OpenAI client reinitialized with new API key');
        return true;
    } catch (error) {
        logger.error('❌ Failed to reinitialize OpenAI client:', error.message);
        return false;
    }
}

// Initialize MySQL
async function initializeMySQL() {
    let retries = 3;
    let lastError;

    while (retries > 0) {
        try {
            mysqlPool = mysql.createPool(MYSQL_CONFIG);
            const connection = await mysqlPool.getConnection();
            logger.info(`✅ MySQL connected successfully to ${MYSQL_CONFIG.host}`);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS socket_status (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    bot_uid VARCHAR(255) NOT NULL,
                    club_code VARCHAR(255) NOT NULL,
                    club_name VARCHAR(500) NOT NULL,
                    status ENUM('connected', 'disconnected', 'error') NOT NULL,
                    message TEXT,
                    ip_address VARCHAR(45),
                    last_connected DATETIME,
                    last_disconnected DATETIME,
                    last_error DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    connection_count INT DEFAULT 1,
                    disconnection_count INT DEFAULT 0,
                    error_count INT DEFAULT 0,
                    UNIQUE KEY unique_bot_club (bot_uid, club_code),
                    INDEX idx_status (status),
                    INDEX idx_updated_at (updated_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS socket_status_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    bot_uid VARCHAR(255) NOT NULL,
                    club_code VARCHAR(255) NOT NULL,
                    club_name VARCHAR(500) NOT NULL,
                    status ENUM('connected', 'disconnected', 'error') NOT NULL,
                    message TEXT,
                    ip_address VARCHAR(45),
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_bot_uid (bot_uid),
                    INDEX idx_club_code (club_code),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);

            connection.release();
            logger.info('✅ Socket status tables ready');
            return;

        } catch (error) {
            lastError = error;
            retries--;
            logger.error(`❌ MySQL connection attempt failed (${3 - retries}/3):`, error.message);

            if (retries > 0) {
                logger.info(`⏳ Retrying in 5 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    logger.error('❌ MySQL initialization failed after 3 attempts:', lastError?.message);
    logger.warn('⚠️ Bot will continue without MySQL logging');
    mysqlPool = null;
}

// Log socket status
async function logSocketStatus(status, message = null) {
    if (!mysqlPool) {
        logger.warn('⚠️ MySQL pool not available, skipping status log');
        return;
    }

    try {
        const networkInterfaces = os.networkInterfaces();
        let ipAddress = null;

        for (const interfaceName in networkInterfaces) {
            const addresses = networkInterfaces[interfaceName];
            for (const addr of addresses) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    ipAddress = addr.address;
                    break;
                }
            }
            if (ipAddress) break;
        }

        const now = new Date();
        const uid = my_uid || 'unknown';
        const code = club_code || 'unknown';
        const name = club_name || 'unknown';

        let statusColumn = '';
        let counterIncrement = '';

        switch (status) {
            case 'connected':
                statusColumn = 'last_connected = VALUES(last_connected)';
                counterIncrement = 'connection_count = connection_count + 1';
                break;
            case 'disconnected':
                statusColumn = 'last_disconnected = VALUES(last_disconnected)';
                counterIncrement = 'disconnection_count = disconnection_count + 1';
                break;
            case 'error':
                statusColumn = 'last_error = VALUES(last_error)';
                counterIncrement = 'error_count = error_count + 1';
                break;
        }

        await mysqlPool.query(`
            INSERT INTO socket_status 
            (bot_uid, club_code, club_name, status, message, ip_address, last_${status}, ${status === 'connected' ? 'connection_count' : status === 'disconnected' ? 'disconnection_count' : 'error_count'}) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            message = VALUES(message),
            ip_address = VALUES(ip_address),
            ${statusColumn},
            ${counterIncrement},
            updated_at = CURRENT_TIMESTAMP
        `, [uid, code, name, status, message, ipAddress, now]);

        await mysqlPool.query(`
            INSERT INTO socket_status_history 
            (bot_uid, club_code, club_name, status, message, ip_address) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [uid, code, name, status, message, ipAddress]);

    } catch (error) {
        logger.error('❌ Failed to log socket status:', error.message);
    }
}
