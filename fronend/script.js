
let socket; // Initialize WebSocket globally
let currentUser = null;
let selectedUser = null;
let messageQueue = loadMessageQueue(); // Load the message queue from sessionStorage
let typingTimeout; // Variable to hold the timeout reference
const typingDelay = 500; // Delay in milliseconds 
const WEB_SOCKET_URL = 'ws://192.168.1.5:8081'
// Predefined color mapping for each letter
const colorMap = {
	'A': '#FF5733', // Red
	'B': '#33FF57', // Green
	'C': '#3357FF', // Blue
	'D': '#F1C40F', // Yellow
	'E': '#8E44AD', // Purple
	'F': '#E67E22', // Orange
	'G': '#2ECC71', // Emerald
	'H': '#3498DB', // Peter River
	'I': '#9B59B6', // Amethyst
	'J': '#1ABC9C', // Turquoise
	'K': '#D35400', // Pumpkin
	'L': '#C0392B', // Alizarin
	'M': '#2980B9', // Belize Hole
	'N': '#8E44AD', // Wisteria
	'O': '#F39C12', // Orange
	'P': '#2C3E50', // Midnight Blue
	'Q': '#D5DBDB', // Silver
	'R': '#7D3C98', // Amethyst
	'S': '#F1948A', // Light Coral
	'T': '#7FB3D5', // Light Blue
	'U': '#F7DC6F', // Light Yellow
	'V': '#AAB7B8', // Grey
	'W': '#E74C3C', // Red
	'X': '#5D6D7E', // Steel Blue
	'Y': '#F1C40F', // Sunflower
	'Z': '#34495E'  // Dark Blue
};

// Function to handle registration
function registerUser() {
	const username = document.getElementById("username").value.trim();
	if (username) {
		currentUser = username;
		document.getElementById("register-screen").classList.remove("active");
		document.getElementById("user-list-screen").classList.add("active");

		// Initialize WebSocket connection
		socket = new WebSocket(WEB_SOCKET_URL)

		// WebSocket connection open event
		socket.onopen = () => {
			socket.send(JSON.stringify({ type: "register", user: currentUser })); 
			sessionStorage.clear();
		}; 

		// WebSocket message event handler
		socket.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.type === "onlineUsers") {
				updateOnlineUserList(data.users);
			} else if (data.type === "message") {
				const timestamp = data.timestamp || new Date().toLocaleString(); // Use the timestamp from the message or the current time
				if (data.sender === selectedUser) {
					displayMessage(data.message, "received", timestamp); // Pass timestamp to displayMessage
					saveMessage(selectedUser, data.message, "received", timestamp); // Save message with timestamp
				} else {
					playNotificationSound(); // Play notification sound for new messages from other user
					addMessageToQueue(data.sender, data.message, data.timestamp);
					addNotification(data.sender);
				}
			} else if (data.type === "typing" && data.sender === selectedUser) {
				showTypingIndicator(data.sender);
			}
		};

		socket.onerror = (error) => {
			console.error("WebSocket error:", error);
		};

		socket.onclose = () => {
			console.log("WebSocket connection closed");
		};
	} else {
		alert("Please enter a username.");
	}
}

// Function to generate a color based on the first letter
function getColorForLetter(letter) {
return colorMap[letter] || '#000000'// Return an color active
}

// Update online user list
function updateOnlineUserList(users) {
const userList = document.getElementById("user-list");
userList.innerHTML = "";

users.forEach((user) => {
	if (user !== currentUser) {
		const li = document.createElement("li");

		// Get the first letter of the user's name
		const firstLetter = user.charAt(0).toUpperCase(); // Ensure it's uppercase
		const backgroundColor = getColorForLetter(firstLetter); // Get unique color

		li.innerHTML = `
			<div class="profile-pic" style="background-color: ${backgroundColor};" >
				${firstLetter}
			</div>
			<span>${user}</span>
			<span class="online-dot"></span>
			<span class="notification-badge" id="badge-${user}" style="display:none">!</span>
		`;

		li.onclick = () => openChatWindow(user);
		userList.appendChild(li);
	}
});
}


// Open chat window and load previous messages and queued messages
function openChatWindow(user) {
	selectedUser = user;
	document.getElementById("user-list-screen").classList.remove("active");
	document.getElementById("chat-window-screen").classList.add("active");
	document.getElementById("chat-header").textContent = `Chat with ${user}`;
	document.getElementById("chat-window").innerHTML = "";
	document.getElementById(`badge-${user}`).style.display = "none";

	// Load past messages from sessionStorage
	loadMessages(user);

	// Check if there are queued messages for the selected user
	if (messageQueue[user]) {
		messageQueue[user].forEach(({ message, type, timestamp }) => { 
			saveMessage(user, message, type, timestamp);
		});
		messageQueue[user].forEach(({ message, type, timestamp }) => { 
			displayMessage(message, type, timestamp);
		});
		// Clear the queue for this user after displaying
		messageQueue[user] = [];
		saveMessageQueue(); // Update sessionStorage
	}
}

// Go back to user list
function goBack() {
	selectedUser = null;
	document.getElementById("chat-window-screen").classList.remove("active");
	document.getElementById("user-list-screen").classList.add("active");
}

// send message to server
function sendMessage() {
	const messageInput = document.getElementById("message-input");
	const message = messageInput.value.trim();
	const timestamp = new Date().toLocaleString();
	if (message && socket && selectedUser) {
		const messageData = {
			type: "message",
			message: message,
			recipient: selectedUser,
			sender: currentUser,
			timestamp: timestamp,
		};
		socket.send(JSON.stringify(messageData));
		displayMessage(message, "sent", timestamp);
		saveMessage(selectedUser, message, "sent", timestamp);
		messageInput.value = "";
	}
}

// Display message in chat window
function displayMessage(message, type, timestamp) {
	const chatWindow = document.getElementById("chat-window");
	const messageDiv = document.createElement("div");
	messageDiv.className = `chat-message ${type}`;

	messageDiv.innerHTML = `
		<div>${message}</div>
		<small class="timestamp">${timestamp}</small>
	`;
	chatWindow.appendChild(messageDiv);
	chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Save messages to session storage
function saveMessage(user, message, type, timestamp) {
	let messages = JSON.parse(sessionStorage.getItem(`chat_${user}`)) || [];
	messages.push({ message, type, timestamp });
	sessionStorage.setItem(`chat_${user}`, JSON.stringify(messages));
}

// Load messages from session storage
function loadMessages(user) {
	const key = `chat_${user}`;
	const messages = JSON.parse(sessionStorage.getItem(key)) || [];
	messages.forEach(({ message, type, timestamp }) => {
		displayMessage(message, type, timestamp);
	});
}

// Add message to message queue if not in active chat
function addMessageToQueue(user, message, timestamp) {
	if (!messageQueue[user]) {
		messageQueue[user] = [];
	}
	messageQueue[user].push({ message, type: "received", timestamp });
	saveMessageQueue();
}

// Save message queue to session storage
function saveMessageQueue() {
	sessionStorage.setItem("messageQueue", JSON.stringify(messageQueue));
}

// Load message queue from session storage
function loadMessageQueue() {
	return JSON.parse(sessionStorage.getItem("messageQueue")) || {};
}

// notofication sound
function playNotificationSound() {
	const sound = document.getElementById("notification-sound");
	sound.play().catch(error => console.log("Error playing sound:", error));
	}

// Add notification badge for new messages
function addNotification(user) {
	const badge = document.getElementById(`badge-${user}`);
	if (badge) badge.style.display = "inline";
}

// Show typing indicator
function showTypingIndicator(user) {
	const typingIndicator = document.getElementById("typing-indicator");
	typingIndicator.textContent = `${user} is typing...`;

	// Clear any existing timeout to avoid flickering
	clearTimeout(typingTimeout);

	// Set a timeout to clear the typing indicator after the delay
	typingTimeout = setTimeout(() => {
		typingIndicator.textContent = ""; // Clear the typing indicator after the delay
	}, typingDelay);
}

// Handle typing event
function handleTyping() {
	if (socket && selectedUser ) {
		// Send typing notification immediately
		socket.send(JSON.stringify({ type: "typing", sender: currentUser , recipient: selectedUser  }));
	}
}

// clear chat history
function clearChat() {
if (selectedUser) {
	// Remove the messages for the selected user from sessionStorage
	sessionStorage.removeItem(`chat_${selectedUser}`);
	
	// Clear the chat window display
	document.getElementById("chat-window").innerHTML = "";

	// Optionally, you can clear any typing indicators or reset the message queue for the selected user
	messageQueue[selectedUser] = [];
	saveMessageQueue(); // Update sessionStorage with the cleared queue
}
}

// Optional: Load message queue on page load
window.onload = () => {
	messageQueue = loadMessageQueue();
};

