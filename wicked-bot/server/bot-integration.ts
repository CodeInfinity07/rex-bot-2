import type { Express } from 'express';
import { promises as fs } from 'fs';
import * as http from 'http';
import * as crypto from 'crypto';
import * as path from 'path';
import axios from 'axios';
import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';
import WebSocket from 'ws';

// Load environment variables
dotenv.config();

// Configuration
const club_code = process.env.CLUB_CODE || 'default';
const club_name = process.env.CLUB_NAME || 'Default Club';
const my_uid = process.env.BOT_UID || '';
const bot_ep = process.env.EP || '';
const bot_key = process.env.KEY || '';

// File paths
const DATA_DIR = path.join(process.cwd(), 'data');
const MEMBERS_FILE = path.join(DATA_DIR, 'club_members.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SPAM_FILE = path.join(DATA_DIR, 'spam.txt');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.txt');
const BANNED_PATTERNS_FILE = path.join(DATA_DIR, 'banned_patterns.txt');
const BOT_CONFIG_FILE = path.join(DATA_DIR, 'bot_configuration.json');

// Bot state
let botState = {
  connected: false,
  connecting: false,
  socket: null as WebSocket | null,
  clubCode: club_code,
  clubName: club_name,
  startTime: null as number | null,
  stats: {
    messagesProcessed: 0,
    usersKicked: 0,
    spamBlocked: 0
  }
};

// Bot configuration
let botConfig = {
  admins: [] as string[],
  spamWords: [] as string[],
  bannedPatterns: [] as string[],
  settings: null as any,
  botConfiguration: null as any
};

// Game state
let secretNumber = Math.floor(Math.random() * 100) + 1;
let botMic = 0;
let index_idx = 1;
let sequence = 2;
let mics = new Array(10).fill(null);
let onMic = false;
let savedData: any = {};
let club_members: any[] = [];
let messageBuffer = '';
let typeWord: string | false = false;
let messageStorage = '';
let clubAdmins: string[] = [];
let pendingRemovals: string[] = [];
let bannedUserIds: string[] = [];
let check_ban_list = false;

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Conversation history for OpenAI
const conversationHistory = new Map();

// Logger
const logger = {
  info: (message: string) => console.log(`[BOT] ${message}`),
  error: (message: string) => console.error(`[BOT] ${message}`),
  warn: (message: string) => console.warn(`[BOT] ${message}`)
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function loadSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const defaults = {
        allowAvatars: true,
        banLevel: 10,
        allowGuestIds: false,
        createdAt: new Date().toISOString()
      };
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaults, null, 2));
      return defaults;
    }
    throw error;
  }
}

async function loadConfigFromFile(type: string) {
  try {
    let filePath = '';
    if (type === 'settings') filePath = SETTINGS_FILE;
    else if (type === 'bot-config') filePath = BOT_CONFIG_FILE;
    else if (type === 'admins') filePath = ADMINS_FILE;
    else if (type === 'spam-words') filePath = SPAM_FILE;
    else if (type === 'banned-patterns') filePath = BANNED_PATTERNS_FILE;
    else return null;

    const data = await fs.readFile(filePath, 'utf8');
    
    if (type === 'settings' || type === 'bot-config') {
      return JSON.parse(data);
    } else {
      if (type === 'spam-words') {
        return data.split('\n').filter(line => line.trim() !== '');
      } else {
        return data.split(',').map(item => item.trim()).filter(item => item !== '');
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.warn(`Config file not found: ${type}`);
      return null;
    }
    logger.error(`Error loading config ${type}: ${error.message}`);
    return null;
  }
}

async function loadAllConfigurations() {
  try {
    const settings = await loadConfigFromFile('settings');
    if (settings) {
      botConfig.settings = settings;
      logger.info(`⚙️ Settings loaded: Avatars: ${settings.allowAvatars}, Ban Level: ${settings.banLevel}`);
    } else {
      botConfig.settings = {
        allowAvatars: true,
        banLevel: 10,
        allowGuestIds: false
      };
    }

    const botConfiguration = await loadConfigFromFile('bot-config');
    if (botConfiguration) {
      botConfig.botConfiguration = botConfiguration;
      logger.info(`🤖 Bot config: ${botConfiguration.botName} (${botConfiguration.botTone})`);
    } else {
      botConfig.botConfiguration = {
        botName: 'Elijah',
        botTone: 'upbeat',
        welcomeMessage: '✨️˚.⭒Wᴇʟᴄᴏᴍᴇ {name}˚✨️'
      };
    }

    const admins = await loadConfigFromFile('admins');
    if (admins) {
      botConfig.admins = admins;
      clubAdmins = admins;
      logger.info(`👥 ${admins.length} admins loaded`);
    }

    const spamWords = await loadConfigFromFile('spam-words');
    if (spamWords) {
      botConfig.spamWords = spamWords;
      logger.info(`🚫 ${spamWords.length} spam words loaded`);
    }

    const bannedPatterns = await loadConfigFromFile('banned-patterns');
    if (bannedPatterns) {
      botConfig.bannedPatterns = bannedPatterns;
      logger.info(`⛔ ${bannedPatterns.length} banned patterns loaded`);
    }
  } catch (error: any) {
    logger.error(`Error loading configurations: ${error.message}`);
  }
}

async function saveClubMembers(members: any) {
  try {
    if (members !== undefined) {
      const jsonString = JSON.stringify(members, null, 2);
      await fs.writeFile(MEMBERS_FILE, jsonString, 'utf8');
      club_members = members;
      logger.info(`✅ ${members.length} club members saved`);
    }
  } catch (error) {
    logger.error('Error saving club members');
  }
}

function formatWelcomeMessage(userName: string) {
  const welcomeTemplate = botConfig.botConfiguration?.welcomeMessage || '✨️˚.⭒Wᴇʟᴄᴏᴍᴇ {name}˚✨️';
  return welcomeTemplate.replace('{name}', userName);
}

async function loadSavedData(filePath: string) {
  try {
    await fs.access(filePath);
    const rawData = await fs.readFile(filePath, 'utf8');
    savedData = JSON.parse(rawData);
    logger.info('📁 User data loaded');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.info('📁 Starting with empty user data');
      savedData = {};
    } else {
      savedData = {};
    }
  }
}

async function saveData(data: any, filePath: string) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error('Error saving data');
  }
}

function findPlayerID(UID: string) {
  for (const GC in savedData) {
    if (savedData[GC].UID === UID) {
      return GC;
    }
  }
  return null;
}

function findPlayerName(UID: string) {
  for (const GC in savedData) {
    if (savedData[GC].UID === UID) {
      return savedData[GC].NM;
    }
  }
  return 'Unknown';
}

function checkAvatar(number: number) {
  return number.toString().startsWith('1000');
}

// ==========================================
// OPENAI FUNCTIONS
// ==========================================

function gptTone(user_id: string) {
  const tones: any = {
    upbeat: "You are an upbeat and friendly assistant. Be positive and encouraging!",
    sarcastic: "You are a witty and sarcastic assistant. Use humor and sass in your responses!",
    wise: "You are a wise and thoughtful assistant. Provide deep insights and wisdom.",
    energetic: "You are an energetic and enthusiastic assistant. Show excitement in every response!",
    chill: "You are a chill and relaxed assistant. Keep things cool and casual.",
    phuppo: "You are a phuppo (aunt) character. Be caring but slightly nosy and gossipy.",
    gangster: "You are a gangster character. Talk tough and street-smart.",
    party: "You are a party animal. Everything is fun and exciting!"
  };
  
  const tone = botConfig.botConfiguration?.botTone || 'upbeat';
  return tones[tone] || tones.upbeat;
}

function removeBotName(message: string) {
  const botName = botConfig.botConfiguration?.botName || 'Elijah';
  return message.replace(new RegExp(botName, 'gi'), '').trim();
}

function splitMessage(text: string, maxLength: number = 150) {
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + word).length > maxLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = word + ' ';
    } else {
      currentChunk += word + ' ';
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function getResponse(message: string, user_id: string) {
  try {
    if (!conversationHistory.has(user_id)) {
      conversationHistory.set(user_id, [
        { role: "system", content: gptTone(user_id) }
      ]);
    }

    const history = conversationHistory.get(user_id);
    history.push({ role: "user", content: message });

    const recentHistory = history.slice(-11);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: recentHistory,
      max_tokens: 200,
      temperature: 0.8,
    });

    const reply = response.choices?.[0]?.message?.content?.trim() || "Sorry, I didn't catch that.";
    history.push({ role: "assistant", content: reply });

    return reply;
  } catch (error) {
    logger.error("Error fetching ChatGPT response");
    return "Sorry, I couldn't process that.";
  }
}

// ==========================================
// WEBSOCKET FUNCTIONS
// ==========================================

function sendMessage(TC: string) {
  if (!botState.socket || botState.socket.readyState !== WebSocket.OPEN) {
    logger.warn('Cannot send message - socket not connected');
    return;
  }

  const message = {
    TC: "msg",
    PY: {
      RLT: 'global',
      _T: Date.now() + sequence,
      msg: TC,
      TM: Date.now()
    }
  };
  botState.socket.send(JSON.stringify(message));
  sequence += 1;
}

function kickUser(uid: string, reason: string = '') {
  if (!botState.socket || botState.socket.readyState !== WebSocket.OPEN) return;

  const message = {
    TC: "kk",
    PY: {
      RLT: 'admin',
      _T: Date.now() + sequence,
      UID: uid,
      BY: my_uid,
      RS: reason,
      TM: Date.now()
    }
  };
  botState.socket.send(JSON.stringify(message));
  botState.stats.usersKicked++;
  sequence += 1;
  logger.info(`⚠️ Kicked user: ${uid} (${reason})`);
}

function takeMic() {
  if (!botState.socket || botState.socket.readyState !== WebSocket.OPEN) return;

  const message = {
    TC: "bwm",
    PY: {
      RLT: 'mic',
      _T: Date.now() + sequence,
      UID: my_uid,
      BS: 1,
      MS: 0,
      TM: Date.now()
    }
  };
  botState.socket.send(JSON.stringify(message));
  onMic = true;
  sequence += 1;
}

function leaveMic() {
  if (!botState.socket || botState.socket.readyState !== WebSocket.OPEN) return;

  const message = {
    TC: "bwm",
    PY: {
      RLT: 'mic',
      _T: Date.now() + sequence,
      UID: my_uid,
      BS: 2,
      MS: 0,
      TM: Date.now()
    }
  };
  botState.socket.send(JSON.stringify(message));
  onMic = false;
  sequence += 1;
}

function changeName(newName: string) {
  if (!botState.socket || botState.socket.readyState !== WebSocket.OPEN) return;

  const message = {
    TC: "un",
    PY: {
      RLT: 'user',
      _T: Date.now() + sequence,
      NM: newName,
      TM: Date.now()
    }
  };
  botState.socket.send(JSON.stringify(message));
  sequence += 1;
}

function inviteMember(uid: string) {
  if (!botState.socket || botState.socket.readyState !== WebSocket.OPEN) return;

  const message = {
    TC: "iv",
    PY: {
      RLT: 'admin',
      _T: Date.now() + sequence,
      UID: uid,
      TM: Date.now()
    }
  };
  botState.socket.send(JSON.stringify(message));
  sequence += 1;
}

function joinMic(micIndex: number) {
  if (!botState.socket || botState.socket.readyState !== WebSocket.OPEN) return;

  const message = {
    TC: "jm",
    PY: {
      RLT: 'mic',
      _T: Date.now() + sequence,
      MI: micIndex,
      TM: Date.now()
    }
  };
  botState.socket.send(JSON.stringify(message));
  botMic = micIndex;
  sequence += 1;
}

async function handleMessage(data: string) {
  try {
    const jsonMessage = JSON.parse(data);
    botState.stats.messagesProcessed++;

    // Handle member list
    if (jsonMessage?.PY?.ML !== undefined) {
      await saveClubMembers(jsonMessage.PY.ML);
    }

    // Handle new member joining
    if (jsonMessage?.TC === "nmu" && jsonMessage?.PY?.NM) {
      const userName = jsonMessage.PY.NM;
      const userUID = jsonMessage.PY.UID;
      
      // Check if avatar allowed
      if (!botConfig.settings?.allowAvatars && checkAvatar(jsonMessage.PY.AVI)) {
        kickUser(userUID, 'Avatars not allowed');
        return;
      }

      // Welcome message
      const welcomeMsg = formatWelcomeMessage(userName);
      sendMessage(welcomeMsg);
    }

    // Handle chat messages
    if (jsonMessage?.TC === "msg" && jsonMessage?.PY?.msg) {
      const message = jsonMessage.PY.msg;
      const senderUID = jsonMessage.PY.UID;
      const senderName = jsonMessage.PY.NM || 'User';

      // Don't respond to own messages
      if (senderUID === my_uid) return;

      // Check spam
      const lowerMsg = message.toLowerCase();
      for (const spamWord of botConfig.spamWords) {
        if (lowerMsg.includes(spamWord.toLowerCase())) {
          kickUser(senderUID, 'Spam detected');
          botState.stats.spamBlocked++;
          logger.info(`🚫 Spam blocked from ${senderName}: ${spamWord}`);
          return;
        }
      }

      // Check banned patterns
      for (const pattern of botConfig.bannedPatterns) {
        if (lowerMsg.includes(pattern.toLowerCase())) {
          kickUser(senderUID, 'Banned content');
          logger.info(`⛔ Banned pattern from ${senderName}: ${pattern}`);
          return;
        }
      }

      // Handle commands
      await handleChatCommand(message, senderUID, senderName);
    }

    // Handle mic updates
    if (jsonMessage?.TC === "mu" && jsonMessage?.PY?.MU) {
      mics = jsonMessage.PY.MU;
    }

  } catch (error) {
    logger.error('Error handling message');
  }
}

async function handleChatCommand(message: string, uid: string, name: string) {
  const msg = message.trim();
  const isAdmin = clubAdmins.includes(uid);
  const botName = botConfig.botConfiguration?.botName || 'Elijah';

  // AI Chat (mention bot name)
  if (msg.toLowerCase().includes(botName.toLowerCase())) {
    const cleanedMessage = removeBotName(msg);
    const response = await getResponse(cleanedMessage, uid);
    const chunks = splitMessage(response);
    
    for (const chunk of chunks) {
      sendMessage(chunk);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return;
  }

  // Admin commands
  if (!isAdmin && msg.startsWith('/')) {
    sendMessage('⛔ Admin-only command');
    return;
  }

  // /mic - Take mic
  if (msg === '/mic') {
    takeMic();
    sendMessage('🎤 Taking mic...');
  }
  
  // /lm - Leave mic
  else if (msg === '/lm' || msg === '/leave') {
    leaveMic();
    sendMessage('👋 Leaving mic...');
  }
  
  // /say <message>
  else if (msg.startsWith('/say ')) {
    const textToSay = msg.substring(5);
    sendMessage(textToSay);
  }
  
  // /spam <word> - Add spam word
  else if (msg.startsWith('/spam ')) {
    const word = msg.substring(6).trim();
    botConfig.spamWords.push(word);
    await fs.appendFile(SPAM_FILE, `${word}\n`);
    sendMessage(`✅ Added spam word: ${word}`);
  }
  
  // /whois <name> - Find user info
  else if (msg.startsWith('/whois ')) {
    const searchName = msg.substring(7).trim().toLowerCase();
    const found = club_members.find((m: any) => 
      m.NM.toLowerCase().includes(searchName)
    );
    if (found) {
      sendMessage(`👤 ${found.NM} - Level ${found.LVL} - UID: ${found.UID}`);
    } else {
      sendMessage('❌ User not found');
    }
  }
  
  // /kick <uid> - Kick user
  else if (msg.startsWith('/kick ')) {
    const targetUID = msg.substring(6).trim();
    kickUser(targetUID, 'Kicked by admin');
    sendMessage(`⚠️ Kicked user: ${targetUID}`);
  }
  
  // /cn <name> - Change bot name
  else if (msg.startsWith('/cn ')) {
    const newName = msg.substring(4).trim();
    changeName(newName);
    sendMessage(`✅ Name changed to: ${newName}`);
  }
  
  // /iv <uid> - Invite member
  else if (msg.startsWith('/iv ')) {
    const targetUID = msg.substring(4).trim();
    inviteMember(targetUID);
    sendMessage(`📨 Invited: ${targetUID}`);
  }
  
  // /joinMic <index> - Join specific mic
  else if (msg.startsWith('/joinMic ')) {
    const micIndex = parseInt(msg.substring(9));
    if (!isNaN(micIndex) && micIndex >= 0 && micIndex < 10) {
      joinMic(micIndex);
      sendMessage(`🎤 Joining mic ${micIndex}...`);
    } else {
      sendMessage('❌ Invalid mic index (0-9)');
    }
  }
  
  // /rejoin - Rejoin club
  else if (msg === '/rejoin') {
    sendMessage('🔄 Rejoining club...');
    setTimeout(() => connectToClub(), 2000);
  }
  
  // /stats - Show bot stats
  else if (msg === '/stats') {
    const uptime = botState.startTime ? Math.floor((Date.now() - botState.startTime) / 1000) : 0;
    sendMessage(`📊 Messages: ${botState.stats.messagesProcessed} | Kicks: ${botState.stats.usersKicked} | Spam: ${botState.stats.spamBlocked} | Uptime: ${uptime}s`);
  }
  
  // /members - Show member count
  else if (msg === '/members') {
    sendMessage(`👥 ${club_members.length} members in club`);
  }
  
  // /guess <number> - Guess the number game
  else if (msg.startsWith('/guess ')) {
    const guess = parseInt(msg.substring(7));
    if (isNaN(guess)) {
      sendMessage('❌ Invalid number');
    } else if (guess === secretNumber) {
      sendMessage(`🎉 ${name} guessed it! The number was ${secretNumber}!`);
      secretNumber = Math.floor(Math.random() * 100) + 1;
    } else if (guess < secretNumber) {
      sendMessage('📈 Higher!');
    } else {
      sendMessage('📉 Lower!');
    }
  }
  
  // /type - Start typing challenge
  else if (msg === '/type') {
    const words = ['javascript', 'typescript', 'nodejs', 'express', 'websocket', 'replit'];
    typeWord = words[Math.floor(Math.random() * words.length)];
    sendMessage(`⌨️ Type this word: ${typeWord}`);
  }
  
  // Check if typing correct word
  else if (typeWord && msg.toLowerCase() === typeWord) {
    sendMessage(`✅ ${name} typed it correctly!`);
    typeWord = false;
  }
  
  // /help - Show commands
  else if (msg === '/help') {
    sendMessage('🤖 Commands: /mic /lm /say /spam /whois /kick /cn /iv /joinMic /rejoin /stats /members /guess /type /help');
  }
}

// ==========================================
// WEBSOCKET CONNECTION
// ==========================================

function connectToClub() {
  if (botState.connecting || botState.connected) {
    logger.warn('Already connecting or connected');
    return;
  }

  if (!my_uid || !bot_ep || !bot_key) {
    logger.error('Missing bot credentials (BOT_UID, EP, KEY)');
    return;
  }

  botState.connecting = true;
  logger.info(`🔌 Connecting to club: ${club_name} (${club_code})...`);

  const url = `wss://ws.ls.superkinglabs.com/?EIO=4&transport=websocket`;
  const ws = new WebSocket(url);

  ws.on('open', () => {
    logger.info('✅ WebSocket connected');
    
    // Send initial connection
    ws.send('2probe');
    ws.send('3');

    // Authenticate
    const authMessage = {
      TC: "auth",
      PY: {
        UID: my_uid,
        EP: bot_ep,
        KEY: bot_key,
        CL: club_code,
        TM: Date.now()
      }
    };
    ws.send(`42${JSON.stringify(['CLUB_STATE_IN', authMessage])}`);
    
    botState.socket = ws;
    botState.connected = true;
    botState.connecting = false;
    botState.startTime = Date.now();
    
    logger.info(`🎉 Bot connected to ${club_name}!`);
  });

  ws.on('message', async (data: WebSocket.Data) => {
    const message = data.toString();
    
    // Heartbeat
    if (message === '2') {
      ws.send('3');
      return;
    }

    // Handle club messages
    if (message.startsWith('42')) {
      try {
        const jsonStr = message.substring(2);
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed[1]) {
          await handleMessage(JSON.stringify(parsed[1]));
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  ws.on('error', (error) => {
    logger.error(`WebSocket error: ${error.message}`);
    botState.connected = false;
    botState.connecting = false;
  });

  ws.on('close', () => {
    logger.warn('🔌 WebSocket disconnected');
    botState.connected = false;
    botState.connecting = false;
    botState.socket = null;
    
    // Reconnect after 5 seconds
    setTimeout(() => {
      logger.info('🔄 Reconnecting...');
      connectToClub();
    }, 5000);
  });
}

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeBot() {
  try {
    await loadAllConfigurations();
    await loadSavedData(USERS_FILE);
    logger.info('✅ Bot initialized successfully');
    
    // Auto-connect if credentials available
    if (my_uid && bot_ep && bot_key && club_code) {
      setTimeout(() => connectToClub(), 2000);
    } else {
      logger.warn('⚠️ Bot credentials not configured - WebSocket disabled');
    }
  } catch (error) {
    logger.error('Error initializing bot');
  }
}

// ==========================================
// EXPRESS API ENDPOINTS
// ==========================================

export function setupBotIntegration(app: Express) {
  
  // ====================
  // JACK API ENDPOINTS
  // ====================

  // Get members with pagination
  app.get('/api/jack/members', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (page < 1 || limit < 1 || limit > 100) {
        return res.json({
          success: false,
          message: 'Invalid pagination parameters'
        });
      }

      const data = await fs.readFile(MEMBERS_FILE, 'utf8');
      const allMembers = JSON.parse(data);

      const levelStats = {
        total: allMembers.length,
        highLevel: allMembers.filter((m: any) => m.LVL >= 10).length,
        mediumLevel: allMembers.filter((m: any) => m.LVL >= 5 && m.LVL <= 9).length,
        lowLevel: allMembers.filter((m: any) => m.LVL >= 1 && m.LVL <= 4).length
      };

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedMembers = allMembers.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          members: paginatedMembers,
          total: allMembers.length,
          page: page,
          limit: limit,
          totalPages: Math.ceil(allMembers.length / limit),
          levelStats: levelStats
        }
      });
    } catch (error) {
      res.json({ success: false, message: 'Failed to load members' });
    }
  });

  // Remove member
  app.delete('/api/jack/members/:uid', async (req, res) => {
    try {
      const { uid } = req.params;
      const data = await fs.readFile(MEMBERS_FILE, 'utf8');
      const allMembers = JSON.parse(data);

      const memberIndex = allMembers.findIndex((m: any) => m.UID === uid);
      if (memberIndex === -1) {
        return res.json({ success: false, message: 'Member not found' });
      }

      const removed = allMembers.splice(memberIndex, 1)[0];
      await fs.writeFile(MEMBERS_FILE, JSON.stringify(allMembers, null, 2));
      
      pendingRemovals.push(uid);
      
      // Kick from club if connected
      if (botState.connected) {
        kickUser(uid, 'Removed by admin');
      }
      
      logger.info(`🗑️ Member removed: ${removed.NM}`);

      res.json({
        success: true,
        message: `Member ${removed.NM} removed successfully`,
        removedMember: removed
      });
    } catch (error) {
      res.json({ success: false, message: 'Failed to remove member' });
    }
  });

  // Bulk remove members
  app.post('/api/jack/members/bulk-remove', async (req, res) => {
    try {
      const { level, count } = req.body;

      if (typeof level !== 'number' || typeof count !== 'number') {
        return res.json({ success: false, message: 'Invalid parameters' });
      }

      const data = await fs.readFile(MEMBERS_FILE, 'utf8');
      const allMembers = JSON.parse(data);
      const membersAtLevel = allMembers.filter((m: any) => m.LVL === level);

      if (membersAtLevel.length === 0) {
        return res.json({ success: false, message: `No members at level ${level}` });
      }

      const removeCount = Math.min(count, membersAtLevel.length);
      const membersToRemove = membersAtLevel.slice(0, removeCount);
      const uidsToRemove = membersToRemove.map((m: any) => m.UID);

      const updated = allMembers.filter((m: any) => !uidsToRemove.includes(m.UID));
      await fs.writeFile(MEMBERS_FILE, JSON.stringify(updated, null, 2));

      pendingRemovals.push(...uidsToRemove);
      
      // Kick all if connected
      if (botState.connected) {
        for (const uid of uidsToRemove) {
          kickUser(uid, 'Bulk removal');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      logger.info(`🗑️ Bulk removed ${removeCount} members at level ${level}`);

      res.json({
        success: true,
        message: `Removed ${removeCount} members at level ${level}`,
        removedCount: removeCount
      });
    } catch (error) {
      res.json({ success: false, message: 'Failed to bulk remove' });
    }
  });

  // Load bot configuration
  app.get('/api/jack/bot-config', async (req, res) => {
    try {
      const data = await fs.readFile(BOT_CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);
      botConfig.botConfiguration = config;
      res.json({ success: true, data: config });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        const defaultConfig = {
          botName: 'Elijah',
          botTone: 'upbeat',
          welcomeMessage: '✨️˚.⭒Wᴇʟᴄᴏᴍᴇ {name}˚✨️',
          createdAt: new Date().toISOString()
        };
        await fs.writeFile(BOT_CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
        res.json({ success: true, data: defaultConfig });
      } else {
        res.json({ success: false, message: 'Failed to load config' });
      }
    }
  });

  // Save bot configuration
  app.post('/api/jack/bot-config', async (req, res) => {
    try {
      const { botName, botTone, welcomeMessage } = req.body;

      if (!botName || !botTone || !welcomeMessage) {
        return res.json({ success: false, message: 'Invalid bot configuration' });
      }

      const validTones = ['upbeat', 'sarcastic', 'wise', 'energetic', 'chill', 'phuppo', 'gangster', 'party'];
      if (!validTones.includes(botTone)) {
        return res.json({ success: false, message: 'Invalid bot tone' });
      }

      const config = {
        botName: botName.trim(),
        botTone,
        welcomeMessage: welcomeMessage.trim(),
        updatedAt: new Date().toISOString()
      };

      await fs.writeFile(BOT_CONFIG_FILE, JSON.stringify(config, null, 2));
      botConfig.botConfiguration = config;
      conversationHistory.clear();

      logger.info(`Bot configuration updated: ${botName} (${botTone})`);
      res.json({ success: true, message: 'Bot configuration saved' });
    } catch (error) {
      res.json({ success: false, message: 'Failed to save config' });
    }
  });

  // Load settings
  app.get('/api/jack/settings', async (req, res) => {
    try {
      const settings = await loadSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      res.json({ success: false, message: 'Failed to load settings' });
    }
  });

  // Save settings
  app.post('/api/jack/settings', async (req, res) => {
    try {
      const { allowAvatars, banLevel, allowGuestIds } = req.body;

      if (typeof allowAvatars !== 'boolean' ||
          typeof allowGuestIds !== 'boolean' ||
          typeof banLevel !== 'number' ||
          banLevel < 1 || banLevel > 100) {
        return res.json({ success: false, message: 'Invalid settings data' });
      }

      const settings = {
        allowAvatars,
        banLevel,
        allowGuestIds,
        updatedAt: new Date().toISOString()
      };

      await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      botConfig.settings = settings;

      logger.info(`Settings updated: Avatars: ${allowAvatars}, Ban Level: ${banLevel}`);
      res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
      res.json({ success: false, message: 'Failed to save settings' });
    }
  });

  // Get exemptions (must be before generic :type route)
  app.get('/api/jack/config/exemptions', async (req, res) => {
    try {
      const data = await fs.readFile(path.join(process.cwd(), 'data', 'exemptions.txt'), 'utf8');
      const arr = data.split(',').map(s => s.trim()).filter(s => s);
      res.json({ success: true, data: arr });
    } catch (error) {
      res.json({ success: true, data: [] });
    }
  });

  // Save exemptions (must be before generic :type route)
  app.post('/api/jack/config/exemptions', async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.json({ success: false, message: 'Invalid data format' });
      }
      
      const fileContent = data.join(', ');
      await fs.writeFile(path.join(process.cwd(), 'data', 'exemptions.txt'), fileContent, 'utf8');
      logger.info(`Exemptions updated: ${data.length} items`);
      
      res.json({ success: true, message: 'Exemptions saved' });
    } catch (error) {
      res.json({ success: false, message: 'Failed to save exemptions' });
    }
  });

  // Get loyal members (must be before generic :type route)
  app.get('/api/jack/config/loyal-members', async (req, res) => {
    try {
      const data = await fs.readFile(path.join(process.cwd(), 'data', 'loyal_members.txt'), 'utf8');
      const arr = data.split(',').map(s => s.trim()).filter(s => s);
      res.json({ success: true, data: arr });
    } catch (error) {
      res.json({ success: true, data: [] });
    }
  });

  // Save loyal members (must be before generic :type route)
  app.post('/api/jack/config/loyal-members', async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.json({ success: false, message: 'Invalid data format' });
      }
      
      const fileContent = data.join(', ');
      await fs.writeFile(path.join(process.cwd(), 'data', 'loyal_members.txt'), fileContent, 'utf8');
      logger.info(`Loyal members updated: ${data.length} items`);
      
      res.json({ success: true, message: 'Loyal members saved' });
    } catch (error) {
      res.json({ success: false, message: 'Failed to save loyal members' });
    }
  });

  // Load configuration (admins, spam-words, banned-patterns)
  app.get('/api/jack/config/:type', async (req, res) => {
    try {
      const { type } = req.params;
      const fileMap: any = {
        'admins': ADMINS_FILE,
        'spam-words': SPAM_FILE,
        'banned-patterns': BANNED_PATTERNS_FILE
      };

      const filePath = fileMap[type];
      if (!filePath) {
        return res.json({ success: false, message: 'Invalid config type' });
      }

      const data = await fs.readFile(filePath, 'utf8');
      let parsedData;

      if (type === 'spam-words') {
        parsedData = data.split('\n').filter(line => line.trim() !== '');
      } else {
        parsedData = data.split(',').map(item => item.trim()).filter(item => item !== '');
      }

      res.json({ success: true, data: parsedData });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        res.json({ success: false, message: 'File not found' });
      } else {
        res.json({ success: false, message: 'Failed to load config' });
      }
    }
  });

  // Save configuration
  app.post('/api/jack/config/:type', async (req, res) => {
    try {
      const { type } = req.params;
      const { data } = req.body;

      const fileMap: any = {
        'admins': ADMINS_FILE,
        'spam-words': SPAM_FILE,
        'banned-patterns': BANNED_PATTERNS_FILE
      };

      const filePath = fileMap[type];
      if (!filePath) {
        return res.json({ success: false, message: 'Invalid config type' });
      }

      let fileContent;
      if (type === 'spam-words') {
        fileContent = data.join('\n');
        botConfig.spamWords = data;
      } else if (type === 'banned-patterns') {
        fileContent = data.join(', ');
        botConfig.bannedPatterns = data;
      } else if (type === 'admins') {
        fileContent = data.join(', ');
        botConfig.admins = data;
        clubAdmins = data;
      }

      await fs.writeFile(filePath, fileContent, 'utf8');
      logger.info(`Configuration ${type} updated: ${data.length} items`);

      res.json({ success: true, message: 'Configuration saved' });
    } catch (error) {
      res.json({ success: false, message: 'Failed to save config' });
    }
  });

  // Get bot status
  app.get('/api/jack/status', (req, res) => {
    const uptime = botState.startTime ? Date.now() - botState.startTime : 0;

    res.json({
      success: true,
      connected: botState.connected,
      connecting: botState.connecting,
      clubCode: botState.clubCode,
      clubName: botState.clubName,
      uptime: uptime,
      stats: botState.stats,
      configLoaded: {
        admins: botConfig.admins.length,
        spamWords: botConfig.spamWords.length,
        bannedPatterns: botConfig.bannedPatterns.length
      }
    });
  });

  // Send message endpoint
  app.post('/api/jack/send-message', (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.json({ success: false, message: 'Message required' });
      }

      sendMessage(message);
      res.json({ success: true, message: 'Message sent' });
    } catch (error) {
      res.json({ success: false, message: 'Failed to send message' });
    }
  });

  // Connect bot endpoint
  app.post('/api/jack/connect', (req, res) => {
    try {
      if (botState.connected) {
        return res.json({ success: false, message: 'Already connected' });
      }
      connectToClub();
      res.json({ success: true, message: 'Connecting...' });
    } catch (error) {
      res.json({ success: false, message: 'Failed to connect' });
    }
  });

  // Disconnect bot endpoint
  app.post('/api/jack/disconnect', (req, res) => {
    try {
      if (botState.socket) {
        botState.socket.close();
      }
      botState.connected = false;
      res.json({ success: true, message: 'Disconnected' });
    } catch (error) {
      res.json({ success: false, message: 'Failed to disconnect' });
    }
  });

  // Restart bot endpoint
  app.post('/api/jack/restart', async (req, res) => {
    try {
      logger.info('🔄 Bot restart requested from dashboard');
      res.json({
        success: true,
        message: 'Bot restart initiated'
      });

      setTimeout(() => {
        process.exit(0);
      }, 1000);
    } catch (error) {
      res.json({ success: false, message: 'Failed to restart' });
    }
  });

  // Initialize bot on server start
  initializeBot();

  logger.info('✅ Bot integration endpoints registered');
  logger.info('📡 Bot API available at /api/jack/*');
}
