
// OBS WebSocket connection variables
let obsWebSocket = null;
let obsConnected = false;
let obsServerAddress = '';
let obsServerPort = 4455;
let obsPassword = '';
let obsEnabled = false;

// Load OBS settings from localStorage on page load
function loadOBSSettingsFromStorage() {
    const savedSettings = localStorage.getItem('obsSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            obsEnabled = settings.obsEnabled || false;
            obsServerAddress = settings.obsServerAddress || '';
            obsServerPort = settings.obsServerPort || 4455;
            obsPassword = settings.obsPassword || '';
            
            console.log('Loaded OBS settings from storage:', {
                enabled: obsEnabled,
                address: obsServerAddress,
                port: obsServerPort,
                hasPassword: obsPassword ? 'Yes' : 'No'
            });
        } catch (error) {
            console.error('Failed to load OBS settings from storage:', error);
        }
    }
}

// Save OBS settings to localStorage
function saveOBSSettingsToStorage() {
    const settings = {
        obsEnabled: obsEnabled,
        obsServerAddress: obsServerAddress,
        obsServerPort: obsServerPort,
        obsPassword: obsPassword
    };
    
    try {
        localStorage.setItem('obsSettings', JSON.stringify(settings));
        console.log('Saved OBS settings to storage:', settings);
    } catch (error) {
        console.error('Failed to save OBS settings to storage:', error);
    }
}

function saveOBSSettings() {
    obsEnabled = document.getElementById('osbEnabled').checked;
    obsServerAddress = document.getElementById('osbServerIP').value;
    obsServerPort = parseInt(document.getElementById('obsServerPort').value, 10);
    obsPassword = document.getElementById('obsPassword').value;
    
    console.log('OBS Settings saved:', {
        enabled: obsEnabled,
        address: obsServerAddress,
        port: obsServerPort,
        hasPassword: obsPassword ? 'Yes' : 'No'
    });
    
    // If OBS is enabled and we have valid settings, attempt to connect
    if (obsEnabled && obsServerAddress && obsServerPort) {
        connectToOBS();
    } else if (!obsEnabled && obsWebSocket) {
        // If OBS is disabled, disconnect
        disconnectFromOBS();
    }
    
    // Save to localStorage for persistence
    saveOBSSettingsToStorage();
    
    // Send settings to the ESP32 to save
    websocket.send(JSON.stringify({
        type: 'updateOBSSettings',
        obsEnabled: obsEnabled,
        obsServerAddress: obsServerAddress,
        obsServerPort: obsServerPort,
        obsPassword: obsPassword
    }));
}

function connectToOBS() {
    if (!obsEnabled || !obsServerAddress || !obsServerPort) {
        showOBSMessage('OBS connection skipped - missing settings', true);
        return;
    }
    
    // If already connected, don't create a new connection
    if (obsConnected && obsWebSocket && obsWebSocket.readyState === WebSocket.OPEN) {
        showOBSMessage('Already connected to OBS');
        return;
    }
    
    // Close any existing connection
    if (obsWebSocket) {
        obsWebSocket.close();
        obsWebSocket = null;
    }
    
    try {
        const obsUrl = `ws://${obsServerAddress}:${obsServerPort}`;
        console.log('Attempting to connect to OBS:', obsUrl);
        console.log('OBS Settings:', { address: obsServerAddress, port: obsServerPort, hasPassword: obsPassword ? 'Yes' : 'No' });
        showOBSMessage('Connecting to OBS...');
        
        obsWebSocket = new WebSocket(obsUrl);
        
        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
            if (obsWebSocket && obsWebSocket.readyState === WebSocket.CONNECTING) {
                console.error('OBS connection timeout');
                obsWebSocket.close();
                showOBSMessage('OBS connection timeout', true);
            }
        }, 10000); // 10 second timeout
        
        obsWebSocket.onopen = function(event) {
            clearTimeout(connectionTimeout);
            console.log('Connected to OBS WebSocket');
            obsConnected = true;
            updateOBSConnectionStatus(true);
            showOBSMessage('Connected to OBS successfully!');
            
            // Note: OBS will automatically send a Hello message (op: 0) with authentication challenge if needed
            // No need to send GetAuthRequired request anymore
        };
        
        obsWebSocket.onmessage = function(event) {
            try {
                handleOBSMessage(JSON.parse(event.data));
            } catch (error) {
                console.error('Error parsing OBS message:', error);
            }
        };
        
        obsWebSocket.onclose = function(event) {
            clearTimeout(connectionTimeout);
            console.log('Disconnected from OBS WebSocket');
            console.log('Close code:', event.code, 'Reason:', event.reason);
            obsConnected = false;
            updateOBSConnectionStatus(false);
            
            if (obsEnabled) {
                // Don't auto-reconnect if it was a connection error (code 1006)
                if (event.code === 1006) {
                    showOBSMessage('OBS connection failed - check settings and OBS WebSocket server', true);
                } else {
                    showOBSMessage('OBS disconnected, attempting to reconnect...');
                    // Attempt to reconnect after 5 seconds if OBS is still enabled
                    setTimeout(connectToOBS, 5000);
                }
            } else {
                showOBSMessage('OBS connection closed');
            }
        };
        
        obsWebSocket.onerror = function(event) {
            clearTimeout(connectionTimeout);
            console.error('OBS WebSocket error:', event);
            obsConnected = false;
            updateOBSConnectionStatus(false);
            
            // Provide more specific error messages
            if (!obsServerAddress) {
                showOBSMessage('OBS connection error: No server address specified', true);
            } else {
                showOBSMessage(`OBS connection error: Cannot reach ${obsServerAddress}:${obsServerPort}`, true);
            }
        };
        
    } catch (error) {
        console.error('Failed to create OBS WebSocket connection:', error);
        obsConnected = false;
        updateOBSConnectionStatus(false);
        showOBSMessage('Failed to create OBS connection', true);
    }
}

function disconnectFromOBS() {
    if (obsWebSocket) {
        obsWebSocket.close();
        obsWebSocket = null;
    }
    obsConnected = false;
    updateOBSConnectionStatus(false);
}

function handleOBSMessage(message) {
    console.log('OBS Message received:', message);
    
    // Handle Hello message (op: 0) - this contains authentication challenge
    if (message.op === 0) {
        console.log('Received OBS Hello message');
        console.log('OBS Studio Version:', message.d.obsStudioVersion);
        console.log('OBS WebSocket Version:', message.d.obsWebSocketVersion);
        
        // For OBS WebSocket v5+, send Identify message immediately
        console.log('Sending Identify message to OBS...');
        
        const identifyRequest = {
            op: 1, // RequestOpCode.Identify
            d: {
                rpcVersion: 1,
                eventSubscriptions: 0
            }
        };
        
        // Add authentication if password is provided
        if (message.d.authentication && message.d.authentication.challenge && message.d.authentication.salt) {
            console.log('OBS requires authentication');
            showOBSMessage('OBS requires authentication, authenticating...');
            
            if (!obsPassword) {
                showOBSMessage('OBS requires password but none provided', true);
                return;
            }
            
            // Generate authentication string
            console.log('Starting authentication generation...');
            try {
                const authResult = generateOBSAuth(message.d.authentication.challenge, message.d.authentication.salt, obsPassword);
                
                if (authResult instanceof Promise) {
                    authResult.then(authString => {
                        identifyRequest.d.authentication = authString;
                        console.log('Sending Identify request with authentication:', identifyRequest);
                        obsWebSocket.send(JSON.stringify(identifyRequest));
                        showOBSMessage('Identify request sent to OBS...');
                    }).catch(error => {
                        console.error('Authentication generation failed:', error);
                        showOBSMessage('Authentication generation failed', true);
                    });
                } else {
                    identifyRequest.d.authentication = authResult;
                    console.log('Sending Identify request with authentication:', identifyRequest);
                    obsWebSocket.send(JSON.stringify(identifyRequest));
                    showOBSMessage('Identify request sent to OBS...');
                }
            } catch (error) {
                console.error('Authentication generation failed:', error);
                showOBSMessage('Authentication generation failed', true);
            }
        } else {
            console.log('OBS does not require authentication');
            console.log('Sending Identify request without authentication:', identifyRequest);
            obsWebSocket.send(JSON.stringify(identifyRequest));
            showOBSMessage('Identify request sent to OBS...');
        }
    }
    
    // Handle authentication response (legacy support for older OBS versions)
    if (message.op === 2) { // RequestOpCode.GetAuthRequired response
        if (message.d.authRequired) {
            console.log('OBS requires authentication (legacy method)');
            showOBSMessage('OBS requires authentication, authenticating...');
            
            // OBS WebSocket authentication protocol
            const challenge = message.d.challenge;
            const salt = message.d.salt;
            
            if (!obsPassword) {
                showOBSMessage('OBS requires password but none provided', true);
                return;
            }
            
            // Generate authentication string using the OBS WebSocket protocol
            generateOBSAuth(challenge, salt, obsPassword).then(authString => {
                obsWebSocket.send(JSON.stringify({
                    op: 3, // RequestOpCode.Authenticate
                    d: {
                        rpcVersion: 1,
                        authentication: authString
                    }
                }));
            }).catch(error => {
                console.error('Authentication generation failed:', error);
                showOBSMessage('Authentication generation failed', true);
            });
        } else {
            console.log('OBS does not require authentication');
            showOBSMessage('Connected to OBS (no auth required)');
        }
    }
    
    // Handle Identify response (OBS WebSocket v5+)
    if (message.op === 2) { // RequestOpCode.Identify response
        console.log('OBS Identify response:', message.d);
        
        if (message.d.negotiatedRpcVersion) {
            console.log('Successfully identified with OBS!');
            console.log('Negotiated RPC Version:', message.d.negotiatedRpcVersion);
            showOBSMessage('Successfully connected to OBS!');
        } else if (message.d.authentication && message.d.authentication.challenge) {
            console.log('OBS requires authentication after Identify');
            // This shouldn't happen with the new flow, but handle it just in case
            showOBSMessage('Unexpected authentication challenge', true);
        } else {
            console.log('Identify response received:', message.d);
            showOBSMessage('Connected to OBS (response received)');
        }
    }
    
    // Handle authentication result (legacy)
    if (message.op === 4) { // RequestOpCode.Authenticate response
        console.log('OBS authentication result:', message.d);
        if (message.d.status === "ok") {
            console.log('Successfully authenticated with OBS');
            showOBSMessage('Successfully authenticated with OBS!');
        } else {
            console.error('OBS authentication failed:', message.d);
            showOBSMessage('OBS authentication failed', true);
        }
    }
    
    // Handle vendor request responses
    if (message.op === 7) { // RequestOpCode.CallVendorRequest response
        console.log('OBS vendor request response:', message.d);
        
        // Handle scene item list responses
        if (message.d.requestType === "GetSceneItemList") {
            const requestId = message.d.requestId;
            
            if (window.obsRequestCallbacks && window.obsRequestCallbacks[requestId]) {
                const callback = window.obsRequestCallbacks[requestId];
                delete window.obsRequestCallbacks[requestId];
                
                if (message.d.requestStatus.code === 100) { // Success
                    const sceneItems = message.d.responseData.sceneItems;
                    console.log('Scene items received:', sceneItems);
                    callback.resolve(sceneItems);
                } else {
                    console.error('Failed to get scene items:', message.d.requestStatus);
                    callback.reject(message.d.requestStatus);
                }
            } else {
                // This might be a response from the getSceneItems() function
                console.log('Scene items:', message.d.responseData?.sceneItems);
                if (message.d.responseData?.sceneItems) {
                    message.d.responseData.sceneItems.forEach(item => {
                        console.log(`Item: ${item.sourceName} (ID: ${item.sceneItemId})`);
                    });
                }
            }
        }
    }
}

// Generate OBS WebSocket authentication string
function generateOBSAuth(challenge, salt, password) {
    // OBS WebSocket authentication uses base64 encoding of SHA256 hash
    // The format is: base64(sha256(password + salt + challenge))
    
    try {
        // Check if crypto.subtle is available (requires HTTPS or localhost)
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            console.log('Using crypto.subtle for authentication');
            // Use crypto.subtle if available
            return generateOBSAuthAsync(challenge, salt, password);
        } else {
            // Fallback: Use a simple SHA256 implementation for HTTP or older browsers
            console.log('crypto.subtle not available, using fallback authentication');
            const combinedString = password + salt + challenge;
            console.log('Combined string for hashing:', combinedString);
            console.log('Password length:', password.length);
            console.log('Salt length:', salt.length);
            console.log('Challenge length:', challenge.length);
            return generateSHA256Base64(combinedString);
        }
    } catch (error) {
        console.error('Error generating OBS auth:', error);
        // Final fallback to simple base64 encoding (may not work with all OBS versions)
        console.log('Using simple base64 fallback (may not work)');
        return btoa(password + salt + challenge);
    }
}

// Async version for crypto.subtle
async function generateOBSAuthAsync(challenge, salt, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt + challenge);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return btoa(String.fromCharCode.apply(null, hashArray));
}

// Helper function to send authentication request
function sendAuthRequest(authString, challenge, salt) {
    console.log('Authentication string generated, sending to OBS...');
    console.log('Challenge:', challenge);
    console.log('Salt:', salt);
    console.log('Auth string length:', authString.length);
    
    // For OBS WebSocket v5+, we need to send Identify message first
    const identifyRequest = {
        op: 1, // RequestOpCode.Identify
        d: {
            rpcVersion: 1,
            authentication: authString,
            eventSubscriptions: 0
        }
    };
    
    console.log('Sending Identify request:', identifyRequest);
    obsWebSocket.send(JSON.stringify(identifyRequest));
    showOBSMessage('Identify request sent to OBS...');
}

// Simple SHA256 implementation for fallback when crypto.subtle is not available
function generateSHA256Base64(message) {
    // This is a basic SHA256 implementation that should work for OBS authentication
    // Based on the SHA-256 specification
    
    console.log('SHA256 input message:', message);
    console.log('SHA256 input length:', message.length);
    
    const hashBytes = sha256(message);
    const result = btoa(String.fromCharCode.apply(null, hashBytes));
    console.log('SHA256 result:', result);
    console.log('SHA256 result length:', result.length);
    return result;
}

// Helper function for SHA256
function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
}

// SHA256 function (moved outside for testing)
function sha256(message) {
    const msg = new TextEncoder().encode(message);
    const msgLength = msg.length * 8;

    // Pre-processing
    const padded = new Uint8Array(Math.ceil((msg.length + 9) / 64) * 64);
    padded.set(msg);
    padded[msg.length] = 0x80;

    // Add length
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, msgLength, false);

    // Initialize hash values
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    // Constants
    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    // Process each 512-bit chunk
    for (let chunk = 0; chunk < padded.length; chunk += 64) {
        const w = new Array(64);

        // Copy chunk into first 16 words
        for (let i = 0; i < 16; i++) {
            w[i] = view.getUint32(chunk + i * 4, false);
        }

        // Extend the first 16 words
        for (let i = 16; i < 64; i++) {
            const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }

        // Initialize working variables
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

        // Main loop
        for (let i = 0; i < 64; i++) {
            const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
            const ch = (e & f) ^ ((~e) & g);
            const temp1 = (h + S1 + ch + k[i] + w[i]) >>> 0;
            const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;

            h = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }

        // Add this chunk's hash to result
        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
        h5 = (h5 + f) >>> 0;
        h6 = (h6 + g) >>> 0;
        h7 = (h7 + h) >>> 0;
    }

    // Produce the final hash value
    const hashArray = new Uint8Array(32);
    const hashView = new DataView(hashArray.buffer);
    hashView.setUint32(0, h0, false);
    hashView.setUint32(4, h1, false);
    hashView.setUint32(8, h2, false);
    hashView.setUint32(12, h3, false);
    hashView.setUint32(16, h4, false);
    hashView.setUint32(20, h5, false);
    hashView.setUint32(24, h6, false);
    hashView.setUint32(28, h7, false);

    return hashArray;
}

async function enableReadyElement() {
    if (!obsConnected || !obsWebSocket) {
        showOBSMessage('Cannot enable READY element - OBS not connected', true);
        return false;
    }
    
    try {
        // First, find the scene item ID for "READY!"
        const sceneItems = await findSceneItemId("Pre Race", "READY!");
        
        // Find the item with the name "READY!"
        const readyItem = sceneItems.find(item => 
            item.sourceName === "READY!" || 
            item.sourceName.toLowerCase().includes("ready")
        );
        
        if (!readyItem) {
            showOBSMessage('READY! element not found in Pre Race scene', true);
            console.log('Available items:', sceneItems.map(item => item.sourceName));
            return false;
        }
        
        console.log('Found READY! element with ID:', readyItem.sceneItemId);
        
        // Request to set scene item enabled in Pre Race scene
        const request = {
            op: 6, // RequestOpCode.CallVendorRequest
            d: {
                rpcVersion: 1,
                requestType: "SetSceneItemEnabled",
                requestId: "enable-ready-" + Date.now(),
                requestData: {
                    sceneName: "Pre Race",
                    sceneItemId: readyItem.sceneItemId, // Use the actual numeric ID
                    sceneItemEnabled: true
                }
            }
        };
        
        console.log('Sending OBS request to enable READY element:', request);
        showOBSMessage('Enabling READY! element...');
        obsWebSocket.send(JSON.stringify(request));
        return true;
        
    } catch (error) {
        console.error('Failed to enable READY element:', error);
        showOBSMessage('Failed to enable READY element: ' + error, true);
        return false;
    }
}

async function disableReadyElement() {
    if (!obsConnected || !obsWebSocket) {
        showOBSMessage('Cannot disable READY element - OBS not connected', true);
        return false;
    }
    
    try {
        // First, find the scene item ID for "READY!"
        const sceneItems = await findSceneItemId("Pre Race", "READY!");
        
        // Find the item with the name "READY!"
        const readyItem = sceneItems.find(item => 
            item.sourceName === "READY!" || 
            item.sourceName.toLowerCase().includes("ready")
        );
        
        if (!readyItem) {
            showOBSMessage('READY! element not found in Pre Race scene', true);
            console.log('Available items:', sceneItems.map(item => item.sourceName));
            return false;
        }
        
        console.log('Found READY! element with ID:', readyItem.sceneItemId);
        
        // Request to set scene item disabled in Pre Race scene
        const request = {
            op: 6, // RequestOpCode.CallVendorRequest
            d: {
                rpcVersion: 1,
                requestType: "SetSceneItemEnabled",
                requestId: "disable-ready-" + Date.now(),
                requestData: {
                    sceneName: "Pre Race",
                    sceneItemId: readyItem.sceneItemId, // Use the actual numeric ID
                    sceneItemEnabled: false
                }
            }
        };
        
        console.log('Sending OBS request to disable READY element:', request);
        showOBSMessage('Disabling READY! element...');
        obsWebSocket.send(JSON.stringify(request));
        return true;
        
    } catch (error) {
        console.error('Failed to disable READY element:', error);
        showOBSMessage('Failed to disable READY element: ' + error, true);
        return false;
    }
}

function updateOBSConnectionStatus(isConnected) {
    const statusElement = document.getElementById('obsStatus');
    if (statusElement) {
        if (isConnected) {
            statusElement.textContent = 'OBS Status: Connected';
            statusElement.style.backgroundColor = '#ccffcc';
        } else {
            statusElement.textContent = 'OBS Status: Disconnected';
            statusElement.style.backgroundColor = '#ffcccc';
        }
    }
    console.log('OBS Connection Status:', isConnected ? 'Connected' : 'Disconnected');
}

function loadOBSSettings() {
    // Load settings from localStorage first
    loadOBSSettingsFromStorage();
    
    // Update UI with loaded settings
    document.getElementById('osbEnabled').checked = obsEnabled;
    document.getElementById('osbServerIP').value = obsServerAddress;
    document.getElementById('obsServerPort').value = obsServerPort;
    document.getElementById('obsPassword').value = obsPassword;
    
    // Request OBS settings from the ESP32 (this will override localStorage settings)
    websocket.send(JSON.stringify({ type: 'getOBSSettings' }));
}

function showOBSMessage(message, isError = false) {
    const statusElement = document.getElementById('obsStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.backgroundColor = isError ? '#ffcccc' : '#ffffcc';
        
        // Reset to normal status after 3 seconds
        setTimeout(() => {
            updateOBSConnectionStatus(obsConnected);
        }, 3000);
    }
    console.log(isError ? 'OBS Error:' : 'OBS Message:', message);
}

// Function to test OBS authentication (useful for debugging)
function testOBSConnection() {
    if (!obsEnabled || !obsServerAddress || !obsServerPort) {
        showOBSMessage('Cannot test connection - missing settings', true);
        return;
    }
    
    showOBSMessage('Testing OBS connection...');
    
    // Create a temporary WebSocket connection to test authentication
    const testUrl = `ws://${obsServerAddress}:${obsServerPort}`;
    const testSocket = new WebSocket(testUrl);
    
    testSocket.onopen = function() {
        testSocket.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }));
    };
    
    testSocket.onmessage = function(event) {
        const message = JSON.parse(event.data);
        if (message.op === 2) {
            if (message.d.authRequired) {
                showOBSMessage('OBS requires authentication (password needed)', true);
            } else {
                showOBSMessage('OBS connection test successful (no auth needed)');
            }
        }
        testSocket.close();
    };
    
    testSocket.onerror = function() {
        showOBSMessage('OBS connection test failed', true);
    };
}

// Function to get scene items (useful for debugging and finding the correct item ID)
function getSceneItems() {
    if (!obsConnected || !obsWebSocket) {
        console.log('Cannot get scene items - OBS not connected');
        return;
    }
    
    try {
        const request = {
            op: 6, // RequestOpCode.CallVendorRequest
            d: {
                rpcVersion: 1,
                requestType: "GetSceneItemList",
                requestId: "get-scene-items-" + Date.now(),
                requestData: {
                    sceneName: "Pre Race"
                }
            }
        };
        
        console.log('Requesting scene items for Pre Race scene');
        obsWebSocket.send(JSON.stringify(request));
        
    } catch (error) {
        console.error('Failed to get scene items:', error);
    }
}

// Test function to verify SHA256 implementation
function testSHA256() {
    console.log('Testing SHA256 implementation...');
    
    // Test vector: SHA256("abc") should equal "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    const testInput = "abc";
    const expectedHex = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    
    const hashBytes = sha256(testInput);
    const actualHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('Test input:', testInput);
    console.log('Expected hex:', expectedHex);
    console.log('Actual hex:', actualHex);
    console.log('Test passed:', actualHex === expectedHex);
    
    if (actualHex !== expectedHex) {
        console.error('SHA256 implementation is incorrect!');
    }
    
    return actualHex === expectedHex;
}

// Helper function to convert hex to base64 (for testing)
function hexToBase64(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return btoa(String.fromCharCode.apply(null, bytes));
}

// Make test function available globally for debugging
window.testSHA256 = testSHA256;

// Test SHA256 on page load
testSHA256();

// Function to set hardcoded values for testing
function setHardcodedOBSSettings() {
    obsEnabled = true;
    obsServerAddress = '192.168.76.168';
    obsServerPort = 4455;
    obsPassword = 'EkDy4UYU1TzW9pGT';
    
    // Update UI
    document.getElementById('osbEnabled').checked = obsEnabled;
    document.getElementById('osbServerIP').value = obsServerAddress;
    document.getElementById('obsServerPort').value = obsServerPort;
    document.getElementById('obsPassword').value = obsPassword;
    
    // Save to localStorage
    saveOBSSettingsToStorage();
    
    console.log('Set hardcoded OBS settings for testing');
}

// Make function available globally
window.setHardcodedOBSSettings = setHardcodedOBSSettings;

// Function to find scene item ID by name
function findSceneItemId(sceneName, itemName) {
    if (!obsConnected || !obsWebSocket) {
        console.log('Cannot find scene item - OBS not connected');
        return Promise.reject('OBS not connected');
    }
    
    return new Promise((resolve, reject) => {
        const requestId = "find-item-" + Date.now();
        
        const request = {
            op: 6, // RequestOpCode.CallVendorRequest
            d: {
                rpcVersion: 1,
                requestType: "GetSceneItemList",
                requestId: requestId,
                requestData: {
                    sceneName: sceneName
                }
            }
        };
        
        // Store the promise resolve/reject functions for this request
        window.obsRequestCallbacks = window.obsRequestCallbacks || {};
        window.obsRequestCallbacks[requestId] = { resolve, reject };
        
        console.log('Finding scene item ID for:', itemName, 'in scene:', sceneName);
        obsWebSocket.send(JSON.stringify(request));
        
        // Set a timeout for the request
        setTimeout(() => {
            if (window.obsRequestCallbacks[requestId]) {
                delete window.obsRequestCallbacks[requestId];
                reject('Timeout waiting for scene item list');
            }
        }, 5000);
    });
}