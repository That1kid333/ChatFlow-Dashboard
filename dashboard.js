// ChatFlow Command Center - Dashboard Visualization

// State
let messages = [];
let threads = {};
let scene, camera, renderer;
let nodes = [];
let isDemoMode = false;

// Initialize Three.js scene
function initScene() {
  const canvas = document.getElementById('vizCanvas');
  const container = canvas.parentElement;
  
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 50;
  
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);
  
  // Add point light
  const pointLight = new THREE.PointLight(0x00d4ff, 1, 100);
  pointLight.position.set(0, 0, 30);
  scene.add(pointLight);
  
  // Start render loop
  animate();
  
  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

// Create a conversation node
function createNode(thread, index, total) {
  const geometry = new THREE.SphereGeometry(2 + thread.messages.length * 0.5, 32, 32);
  
  // Color based on type
  let color;
  switch(thread.type) {
    case 'thread': color = 0x00ff88; break;
    case 'direct': color = 0x0088ff; break;
    case 'spam': color = 0xff4466; break;
    default: color = 0x00d4ff;
  }
  
  const material = new THREE.MeshPhongMaterial({
    color: color,
    transparent: true,
    opacity: 0.8,
    emissive: color,
    emissiveIntensity: 0.3,
  });
  
  const sphere = new THREE.Mesh(geometry, material);
  
  // Position in a spiral pattern
  const angle = (index / total) * Math.PI * 4;
  const radius = 10 + index * 2;
  sphere.position.x = Math.cos(angle) * radius;
  sphere.position.y = Math.sin(angle) * radius;
  sphere.position.z = (Math.random() - 0.5) * 20;
  
  // Store thread data
  sphere.userData = { thread, originalScale: sphere.scale.clone() };
  
  scene.add(sphere);
  nodes.push(sphere);
  
  // Add glow effect
  const glowGeometry = new THREE.SphereGeometry(3 + thread.messages.length * 0.5, 32, 32);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.1,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  sphere.add(glow);
  
  return sphere;
}

// Update visualization
function updateVisualization() {
  // Clear existing nodes
  nodes.forEach(node => scene.remove(node));
  nodes = [];
  
  // Create nodes for each thread
  const threadList = Object.values(threads).filter(t => t.type !== 'spam');
  threadList.forEach((thread, i) => {
    createNode(thread, i, threadList.length);
  });
  
  // Update stats
  document.getElementById('totalCount').textContent = messages.length;
  document.getElementById('threadCount').textContent = threadList.length;
  document.getElementById('directCount').textContent = 
    Object.values(threads).filter(t => t.type === 'direct').length;
  document.getElementById('spamCount').textContent = 
    threads['spam-bin']?.messages?.length || 0;
  
  // Update threads panel
  updateThreadsPanel();
  
  // Update live feed
  updateLiveFeed();
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Rotate nodes gently
  nodes.forEach((node, i) => {
    node.rotation.x += 0.002;
    node.rotation.y += 0.003;
    
    // Floating motion
    node.position.y += Math.sin(Date.now() * 0.001 + i) * 0.02;
  });
  
  // Slowly rotate camera
  camera.position.x = Math.sin(Date.now() * 0.0002) * 5;
  camera.lookAt(0, 0, 0);
  
  renderer.render(scene, camera);
}

// Update threads panel
function updateThreadsPanel() {
  const container = document.getElementById('threadsList');
  const threadList = Object.values(threads)
    .filter(t => t.type !== 'spam')
    .sort((a, b) => b.lastActivity - a.lastActivity);
  
  if (threadList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>No conversations yet</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = threadList.map(thread => {
    const typeClass = thread.type === 'thread' ? 'convo' : thread.type;
    const lastMsg = thread.messages[thread.messages.length - 1];
    
    return `
      <div class="thread-card" onclick="openRoom('${thread.id}')">
        <div class="thread-header">
          <span class="thread-type ${typeClass}">${thread.type.toUpperCase()}</span>
          <span class="thread-count">${thread.messages.length} msgs</span>
        </div>
        <div class="thread-participants">
          ${thread.participants.slice(0, 3).map(p => '@' + p).join(', ')}
          ${thread.participants.length > 3 ? ` +${thread.participants.length - 3}` : ''}
        </div>
        <div class="thread-preview">${lastMsg?.text || ''}</div>
      </div>
    `;
  }).join('');
}

// Update live feed
function updateLiveFeed() {
  const container = document.getElementById('liveFeed');
  const recent = messages.slice(-20).reverse();
  
  container.innerHTML = recent.map(msg => `
    <div class="feed-message ${msg.type}">
      <div class="feed-author">@${msg.author}</div>
      <div class="feed-text">${escapeHtml(msg.text.substring(0, 100))}</div>
    </div>
  `).join('');
}

// Open room view
window.openRoom = function(threadId) {
  const thread = threads[threadId];
  if (!thread) return;
  
  document.getElementById('roomTitle').textContent = 
    `Conversation: ${thread.participants.slice(0, 3).map(p => '@' + p).join(', ')}`;
  
  const container = document.getElementById('roomMessages');
  container.innerHTML = thread.messages.map((msg, i) => {
    const isReply = msg.text.startsWith('@') || i > 0;
    return `
      <div class="room-message ${isReply ? 'reply' : ''}">
        <div class="message-author">@${msg.author}</div>
        <div class="message-text">${escapeHtml(msg.text)}</div>
        <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
      </div>
    `;
  }).join('');
  
  document.getElementById('roomView').classList.add('active');
};

window.closeRoom = function() {
  document.getElementById('roomView').classList.remove('active');
};

// Demo mode with sample data
window.openDemoMode = function() {
  isDemoMode = true;
  document.getElementById('connectionText').textContent = 'Demo Mode Active';
  document.getElementById('streamTitle').textContent = 'Demo: Gaming Live Stream';
  
  // Generate demo messages
  const demoAuthors = ['Alex', 'Sam', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley', 'Drew', 'Jamie', 'Quinn'];
  const demoMessages = [
    { text: 'This stream is fire! 🔥', type: 'direct' },
    { text: '@Alex totally agree!', type: 'thread' },
    { text: 'What game is this?', type: 'direct' },
    { text: '@Jordan It\'s the new release', type: 'thread' },
    { text: 'CHECK OUT MY CHANNEL', type: 'spam' },
    { text: 'Anyone else lagging?', type: 'direct' },
    { text: '@Sam yeah same here', type: 'thread' },
    { text: 'Love the energy!', type: 'direct' },
    { text: 'Can we get 1000 likes?', type: 'direct' },
    { text: '@Casey that move was insane', type: 'thread' },
    { text: 'First time here, loving it', type: 'direct' },
    { text: '@Riley welcome!', type: 'thread' },
    { text: 'What settings are you using?', type: 'direct' },
    { text: '@Drew I think 1080p60', type: 'thread' },
    { text: 'POG moment right there', type: 'direct' },
  ];
  
  let index = 0;
  
  function addDemoMessage() {
    if (!isDemoMode) return;
    
    const template = demoMessages[index % demoMessages.length];
    const author = demoAuthors[Math.floor(Math.random() * demoAuthors.length)];
    
    const msg = {
      id: Date.now() + '-' + Math.random(),
      author: author,
      text: template.text.replace(/@\w+/, '@' + demoAuthors[Math.floor(Math.random() * demoAuthors.length)]),
      type: template.type,
      timestamp: Date.now(),
    };
    
    processMessage(msg);
    index++;
    
    setTimeout(addDemoMessage, 800 + Math.random() * 1500);
  }
  
  addDemoMessage();
};

// Process incoming message
function processMessage(msg) {
  messages.push(msg);
  if (messages.length > 500) messages = messages.slice(-500);
  
  // Thread assignment
  let threadId;
  if (msg.type === 'spam') {
    threadId = 'spam-bin';
  } else if (msg.type === 'thread') {
    const mention = msg.text.match(/@(\w+)/);
    threadId = mention ? 'thread-' + mention[1] : 'thread-' + msg.author;
  } else {
    threadId = 'direct-' + msg.author;
  }
  
  if (!threads[threadId]) {
    threads[threadId] = {
      id: threadId,
      type: msg.type,
      participants: [],
      messages: [],
      lastActivity: Date.now(),
    };
  }
  
  threads[threadId].messages.push(msg);
  threads[threadId].lastActivity = Date.now();
  if (!threads[threadId].participants.includes(msg.author)) {
    threads[threadId].participants.push(msg.author);
  }
  
  updateVisualization();
}

// Toggle view mode
window.toggleView = function(mode) {
  console.log('Toggle view:', mode);
  // TODO: Implement different visualization modes
};

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Listen for messages from extension
window.addEventListener('message', (event) => {
  if (event.data.type === 'CHATFLOW_MESSAGE') {
    processMessage(event.data.message);
  }
});

// Listen for chrome extension messages
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'CHATFLOW_MESSAGES') {
      message.messages.forEach(msg => processMessage(msg));
    }
  });
}

// Check for stored messages from extension
async function loadFromExtension() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get('chatflowMessages', (data) => {
      if (data.chatflowMessages && data.chatflowMessages.length > 0) {
        document.getElementById('connectionText').textContent = 'Connected to Extension';
        document.getElementById('streamTitle').textContent = 'Live Stream Chat';
        data.chatflowMessages.forEach(msg => processMessage(msg));
      }
    });
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initScene();
  updateVisualization();
  
  // Try to load from extension
  setTimeout(loadFromExtension, 500);
  
  // Auto-start demo if no extension data after 3 seconds
  setTimeout(() => {
    if (messages.length === 0) {
      console.log('No extension data, showing demo prompt');
    }
  }, 3000);
});
