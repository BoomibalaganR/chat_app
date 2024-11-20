// server.js
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8081 })

const users = {} // Use an object for online users (username: WebSocket)
const messageQueue = {} // Queued messages for offline users

wss.on('connection', ws => {
	let currentUser = null

	ws.on('message', message => {
		try {
			const data = JSON.parse(message)

			switch (data.type) {
				case 'register':
					// Register user and associate with their WebSocket connection
					currentUser = data.user
					users[currentUser] = ws
					broadcastOnlineUsers()

					// If there are any queued messages for this user, send them now
					if (messageQueue[currentUser]) {
						messageQueue[currentUser].forEach(msg => {
							ws.send(
								JSON.stringify({
									type: 'message',
									message: msg.message,
									sender: msg.sender
								}),
								error => {
									if (error) {
										console.error(
											'Error sending queued message:',
											error
										)
									}
								}
							)
						})

						// Once the messages are delivered, clear the queue
						delete messageQueue[currentUser]
					}
					break

				case 'message':
					// Send the message to the recipient's WebSocket connection
					const recipientSocket = users[data.recipient]
					if (recipientSocket) {
						const timestamp = new Date().toLocaleString()
						const messageData = {
							type: 'message',
							message: data.message,
							sender: data.sender,
							timestamp: timestamp,
							status: 'sent'
						}

						recipientSocket.send(
							JSON.stringify(messageData),
							error => {
								if (error) {
									console.error(
										'Error sending message:',
										error
									)
								}
							}
						)
					} else {
						// If recipient is offline, queue the message
						if (!messageQueue[data.recipient]) {
							messageQueue[data.recipient] = []
						}
						messageQueue[data.recipient].push({
							message: data.message,
							sender: data.sender
						})
					}
					break

				case 'typing':
					// Notify the recipient that the sender is typing
					const typingRecipientSocket = users[data.recipient]
					if (typingRecipientSocket) {
						typingRecipientSocket.send(
							JSON.stringify({
								type: 'typing',
								sender: data.sender
							}),
							error => {
								if (error) {
									console.error(
										'Error sending typing notification:',
										error
									)
								}
							}
						)
					}
					break

				default:
					console.warn('Unknown message type:', data.type)
			}
		} catch (error) {
			console.error('Error parsing message:', error)
		}
	})

	ws.on('close', () => {
		// Remove the user from the `users` object when they disconnect
		if (currentUser) {
			delete users[currentUser]
			broadcastOnlineUsers()
		}
	})
})

// Function to broadcast online users to all connected clients
function broadcastOnlineUsers() {
	const onlineUsers = Object.keys(users) // Get online users from the users object
	wss.clients.forEach(client => {
		client.send(
			JSON.stringify({
				type: 'onlineUsers',
				users: onlineUsers
			}),
			error => {
				if (error) {
					console.error('Error broadcasting online users:', error)
				}
			}
		)
	})
}

console.log('WebSocket server is running on ws://localhost:8081')
