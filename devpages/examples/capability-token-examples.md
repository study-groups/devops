# Capability Token System Examples

## **Overview: Token-Based Access Control**

Your new capability system allows admins to generate tokens that grant specific, limited access to games, files, and endpoints - perfect for sharing content without creating full user accounts.

## **1. Basic Admin Token Generation**

### **A. Generate Game-Specific Access Token**
```bash
# Admin creates a token for Zelda game access
curl -X POST http://localhost:3000/api/capabilities/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "type": "access",
    "capabilities": {
      "games": ["zelda"],
      "endpoints": ["/api/capabilities/games/*", "/api/files/list"],
      "paths": {
        "/games/zelda/*": ["read"],
        "/games/zelda/saves/*": ["read", "write"]
      }
    },
    "description": "Zelda game access for beta tester",
    "ttl": 604800,
    "maxUses": 50
  }'

# Response:
{
  "success": true,
  "token": "cap_a1b2c3d4e5f6...",
  "type": "access",
  "capabilities": {
    "games": ["zelda"],
    "endpoints": ["/api/capabilities/games/*", "/api/files/list"],
    "paths": {"/games/zelda/*": ["read"], "/games/zelda/saves/*": ["read", "write"]}
  },
  "expiresAt": 1703587200000,
  "accessUrl": null,
  "examples": {
    "bearer": "Authorization: Bearer cap_a1b2c3d4e5f6...",
    "url": "http://localhost:3000/api/games?token=cap_a1b2c3d4e5f6..."
  }
}
```

### **B. Generate Guest Login Token (IP-Based)**
```bash
# Admin creates guest token for temporary access
curl -X POST http://localhost:3000/api/capabilities/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "type": "guest",
    "capabilities": {
      "games": ["zelda", "mario"],
      "special": ["create_guest"],
      "endpoints": ["/api/capabilities/games/*", "/api/files/list"]
    },
    "description": "Guest access for demo session",
    "ttl": 3600,
    "maxUses": 1
  }'

# Response includes guest login URL:
{
  "token": "cap_guest789abc...",
  "accessUrl": "http://localhost:3000/guest?token=cap_guest789abc...",
  "type": "guest"
}
```

## **2. Using Tokens for Access**

### **A. Token-Based Game Access**
```bash
# Access specific game with token
curl -H "Authorization: Bearer cap_a1b2c3d4e5f6..." \
  http://localhost:3000/api/capabilities/games/zelda

# Or via URL parameter
curl "http://localhost:3000/api/capabilities/games/zelda?token=cap_a1b2c3d4e5f6..."

# Response shows limited game data:
{
  "success": true,
  "game": "zelda",
  "data": {
    "name": "zelda",
    "title": "Game: zelda",
    "accessLevel": "token",
    "availableFeatures": ["play", "view-scores"],
    "tokenExpires": 1703587200000
  },
  "accessMethod": "capability"
}
```

### **B. Guest User Creation & Login**
```javascript
// Frontend: Guest clicks on shared link
// URL: http://localhost:3000/guest?token=cap_guest789abc...

// JavaScript automatically attempts guest login:
fetch('/api/capabilities/guest-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    token: 'cap_guest789abc...' 
  }),
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    console.log('Guest user created:', data.user.username);
    // Automatically logged in as: guest-a1b2c3d4-1a2b3c4d
    // Can now access games: zelda, mario
    
    // Access games with session
    return fetch('/api/capabilities/games/zelda', {
      credentials: 'include'
    });
  }
});
```

## **3. Advanced Token Patterns**

### **A. Limited File Sharing Token**
```bash
# Share specific files/directories
curl -X POST http://localhost:3000/api/capabilities/generate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "type": "share",
    "capabilities": {
      "paths": {
        "/projects/website/public/*": ["read"],
        "/games/zelda/screenshots/*": ["read"]
      },
      "endpoints": ["/api/files/content", "/api/files/list"]
    },
    "description": "Share website assets and game screenshots",
    "ttl": 86400,
    "maxUses": 100
  }'

# Creates shareable URL: http://localhost:3000/share?token=cap_share456...
```

### **B. Multi-Game Tournament Token**
```bash
# Tournament access to multiple games
curl -X POST http://localhost:3000/api/capabilities/generate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "type": "access",
    "capabilities": {
      "games": ["zelda", "mario", "tetris"],
      "endpoints": [
        "/api/capabilities/games/*",
        "/api/tournament/scores",
        "/api/tournament/leaderboard"
      ],
      "special": ["tournament_access"],
      "paths": {
        "/tournament/saves/*": ["read", "write"]
      }
    },
    "description": "Tournament participant access",
    "ttl": 604800,
    "maxUses": 1000
  }'
```

### **C. Time-Limited Beta Access**
```bash
# Beta tester with specific game versions
curl -X POST http://localhost:3000/api/capabilities/generate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "type": "access", 
    "capabilities": {
      "games": ["zelda-beta", "mario-unreleased"],
      "endpoints": [
        "/api/capabilities/games/*",
        "/api/feedback/submit",
        "/api/bugs/report"
      ],
      "paths": {
        "/beta/*": ["read"],
        "/beta/saves/*": ["read", "write"],
        "/beta/feedback/*": ["write"]
      },
      "special": ["beta_tester", "can_report_bugs"]
    },
    "description": "Beta tester - 72 hour access",
    "ttl": 259200,
    "maxUses": 500
  }'
```

## **4. Integration with Existing PData Roles**

### **Enhanced Role Checking in Your Endpoints**
```javascript
// In your route handlers, check both traditional roles and token capabilities:

app.get('/api/games/:gameName', async (req, res) => {
  const { gameName } = req.params;
  let hasAccess = false;
  
  // Check capability token first
  if (req.capabilityToken) {
    hasAccess = req.app.locals.capabilityManager.hasCapability(
      req.capabilityToken.token, 
      'game', 
      gameName
    );
  }
  
  // Check traditional user roles
  else if (req.user) {
    const userRoles = req.pdata.getUserRoles(req.user.username);
    hasAccess = userRoles.some(role => 
      role === 'admin' || 
      role === 'dev' || 
      role === `game-${gameName}` ||
      role === 'guest' // If you want guests to have general access
    );
  }
  
  if (!hasAccess) {
    return res.status(403).json({ 
      error: `Access denied to game: ${gameName}` 
    });
  }
  
  // Serve game content...
});
```

## **5. Monitoring & Management**

### **A. List Active Tokens (Admin)**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3000/api/capabilities/list

# Response shows all active tokens:
{
  "success": true,
  "count": 3,
  "tokens": [
    {
      "token": "cap_a1b2c3d4...",
      "type": "access",
      "issuer": "admin",
      "capabilities": {"games": ["zelda"]},
      "usageCount": 15,
      "maxUses": 50,
      "expiresAt": 1703587200000
    }
  ]
}
```

### **B. Revoke Token**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3000/api/capabilities/revoke/cap_a1b2c3d4e5f6...
```

## **6. Real-World Use Cases**

### **Game Demo at Convention**
```bash
# Create 100 guest tokens for convention demo
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/capabilities/generate \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{
      "type": "guest",
      "capabilities": {
        "games": ["zelda-demo"],
        "special": ["create_guest"],
        "endpoints": ["/api/capabilities/games/zelda-demo"]
      },
      "description": "Convention demo - booth #'$i'",
      "ttl": 7200,
      "maxUses": 1
    }' | jq -r '.accessUrl' >> demo_urls.txt
done

# Each URL creates a unique guest user when accessed
```

### **Press Preview Access**
```bash
# Generate press preview tokens
curl -X POST http://localhost:3000/api/capabilities/generate \
  -d '{
    "type": "access",
    "capabilities": {
      "games": ["all-preview-builds"],
      "paths": {
        "/press/*": ["read"],
        "/screenshots/*": ["read"],
        "/press-kit/*": ["read"]
      },
      "endpoints": [
        "/api/capabilities/games/*",
        "/api/press/assets",
        "/api/press/info"
      ]
    },
    "description": "Press preview access - IGN",
    "ttl": 1209600,
    "maxUses": 200
  }'
```

This system gives you Plan 9-inspired capability-based access control while integrating seamlessly with your existing PData user/role system. Tokens can be more powerful and targeted than user accounts, with precise expiration and usage tracking.