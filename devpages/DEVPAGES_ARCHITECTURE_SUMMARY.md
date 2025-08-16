# DevPages Architecture Summary

## 1. Import Handling Without Build Tools

### **Modern ES Module Resolution with Import Maps**

DevPages uses **Import Maps** - a modern web standard that allows browsers to resolve bare module specifiers without requiring a bundler or build step.

#### **How It Works:**

```html
<!-- Import Map in client/index.html -->
<script type="importmap">
{
    "imports": {
        "@reduxjs/toolkit": "/node_modules/@reduxjs/toolkit/dist/redux-toolkit.browser.mjs",
        "@reduxjs/toolkit/query": "/node_modules/@reduxjs/toolkit/dist/query/rtk-query.browser.mjs",
        "@standard-schema/utils": "/node_modules/@standard-schema/utils/dist/index.js",
        "redux": "/node_modules/redux/dist/redux.browser.mjs",
        "redux-thunk": "/node_modules/redux-thunk/dist/redux-thunk.mjs",
        "immer": "/node_modules/immer/dist/immer.production.mjs",
        "reselect": "/node_modules/reselect/dist/reselect.browser.mjs"
    }
}
</script>
```

#### **Key Benefits:**
- ✅ **No build step required** - Direct browser execution
- ✅ **Development speed** - Instant reloads, no compilation
- ✅ **Modern standards** - Uses native ES modules
- ✅ **Dependency management** - Centralized import resolution
- ✅ **Browser compatibility** - Works in all modern browsers

#### **Module Resolution Flow:**
1. **Bare specifier**: `import { createSlice } from '@reduxjs/toolkit';`
2. **Import map lookup**: Maps `@reduxjs/toolkit` to `/node_modules/@reduxjs/toolkit/dist/redux-toolkit.browser.mjs`
3. **Browser fetches**: Direct HTTP request to the mapped path
4. **ES module execution**: Browser executes the module natively

#### **Dependencies Covered:**
- **Redux Toolkit**: Core state management
- **RTK Query**: Data fetching and caching
- **Standard Schema**: Runtime validation
- **Supporting libraries**: Redux, Immer, Reselect, Redux Thunk

---

## 2. RTK Query vs Vanilla Redux

### **Traditional Redux Approach (Before RTK Query):**

```javascript
// OLD WAY: Manual thunks and state management
const loadDirectories = createAsyncThunk(
  'path/loadDirectories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/files/dirs', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load');
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Manual loading states, error handling, caching
const pathSlice = createSlice({
  name: 'path',
  initialState: {
    directories: [],
    isLoading: false,
    error: null
  },
  reducers: { /* manual state updates */ },
  extraReducers: (builder) => {
    builder
      .addCase(loadDirectories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadDirectories.fulfilled, (state, action) => {
        state.isLoading = false;
        state.directories = action.payload;
      })
      .addCase(loadDirectories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  }
});
```

### **RTK Query Approach (Current Implementation):**

```javascript
// NEW WAY: Declarative API definitions
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth?.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Directory', 'File', 'Auth'],
  endpoints: (builder) => ({
    getDirectories: builder.query({
      query: () => '/files/dirs',
      providesTags: ['Directory'],
      transformResponse: (response) => response.directories,
    }),
    listFiles: builder.query({
      query: (path) => `/files/list?path=${encodeURIComponent(path)}`,
      providesTags: (result, error, path) => [{ type: 'File', id: path }],
    }),
  }),
});

// Auto-generated hooks with built-in caching
const { useGetDirectoriesQuery, useListFilesQuery } = apiSlice;
```

### **Key Differences:**

| Aspect | Vanilla Redux | RTK Query |
|--------|---------------|-----------|
| **Data Fetching** | Manual thunks, custom logic | Declarative endpoints, auto-generated |
| **Caching** | Manual implementation | Automatic, intelligent caching |
| **Loading States** | Manual state management | Built-in `isLoading`, `isFetching` |
| **Error Handling** | Custom error states | Built-in error handling |
| **Cache Invalidation** | Manual cache management | Tag-based invalidation |
| **Optimistic Updates** | Complex manual implementation | Built-in optimistic updates |
| **Background Refetching** | Manual implementation | Automatic refetching |
| **Code Amount** | ~100+ lines per endpoint | ~10 lines per endpoint |

### **Benefits of RTK Query:**
- ✅ **90% less boilerplate** - Automatic state management
- ✅ **Built-in caching** - No manual cache implementation
- ✅ **Automatic re-fetching** - Smart background updates
- ✅ **Optimistic updates** - Better UX with immediate feedback
- ✅ **Type safety** - Full TypeScript support
- ✅ **DevTools integration** - Built-in debugging

---

## 3. How PData Works

### **Core Architecture**

PData is a **Plan 9-inspired file management and authentication system** that provides:

#### **Three-Tier Mounting System:**
```
~data/          # System-wide shared data
~system/        # System configuration and assets  
~/data/username # User-specific data (isolated per user)
```

#### **Key Components:**

**1. AuthSrv (Authentication Service):**
```javascript
// JWT token creation and validation
const token = authSrv.createToken(username, capabilities);
const isValid = authSrv.validateToken(token);
```

**2. UserManager:**
```javascript
// CSV-based user management
const users = [
  { username: 'mike', password: 'hashed_password', role: 'admin' },
  { username: 'user1', password: 'hashed_password', role: 'user' }
];
```

**3. FileManager:**
```javascript
// Permission-based file operations
await fileManager.listDirectory(username, path);
await fileManager.readFile(username, filePath);
await fileManager.writeFile(username, filePath, content);
```

**4. CapabilityManager:**
```javascript
// Role-based access control
const capabilities = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  user: ['read', 'write'],
  guest: ['read']
};
```

**5. MountManager:**
```javascript
// Three-tier mounting system
const mounts = {
  '~data': '/system/shared',
  '~system': '/system/config', 
  '~/data/username': `/users/${username}/data`
};
```

### **Authentication Flow:**

1. **User Login**: Username/password validation against CSV
2. **Token Generation**: JWT token with user capabilities
3. **Path Resolution**: Convert virtual paths to real filesystem paths
4. **Permission Check**: Verify user has required capabilities
5. **Operation Execution**: Perform file operation with user context

### **File Operations:**

```javascript
// Virtual path resolution
const realPath = mountManager.resolvePath(username, '~/data/myfile.txt');
// Becomes: /users/username/data/myfile.txt

// Permission-based access
const canRead = capabilityManager.can(username, 'read', path);
if (canRead) {
  const content = await fileManager.readFile(username, path);
}
```

---

## 4. How DevPages Uses PData

### **Integration Architecture**

DevPages integrates PData as its **core authentication and file management system**, replacing traditional session-based auth.

#### **Server-Side Integration:**

```javascript
// server/server.js
import { PData } from '../pdata/PData.js';

// Initialize PData instance
const pdataInstance = new PData();

// Make available to all routes
app.use((req, res, next) => {
  req.pdata = pdataInstance;
  next();
});

// PData routes for file operations
app.use('/api/files', pdataRoutes);
app.use('/api/auth', authRoutes);
```

#### **Authentication Endpoints:**

```javascript
// server/routes/auth.js
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Validate with PData
  const isValid = req.pdata.validateUser(username, password);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate PData token
  const token = req.pdata.authSrv.createToken(username, capabilities);
  
  res.json({
    user: { username, role: req.pdata.getUserRole(username) },
    token: token
  });
});
```

#### **File Operation Endpoints:**

```javascript
// server/routes/files.js
router.get('/dirs', authMiddleware, async (req, res) => {
  const username = req.user.username;
  
  // List directories using PData
  const { dirs, files } = await req.pdata.listDirectory(username, '');
  
  res.json({ directories: dirs, files: files });
});

router.get('/list', authMiddleware, async (req, res) => {
  const { path } = req.query;
  const username = req.user.username;
  
  // List files with PData permissions
  const result = await req.pdata.listDirectory(username, path);
  res.json(result);
});
```

#### **Client-Side Integration:**

```javascript
// client/store/apiSlice.js
const baseQuery = fetchBaseQuery({
  baseUrl: '/api',
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    // Include PData token in all requests
    const token = getState().auth?.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

// RTK Query endpoints that work with PData
endpoints: (builder) => ({
  getDirectories: builder.query({
    query: () => '/files/dirs',
    providesTags: ['Directory'],
  }),
  listFiles: builder.query({
    query: (path) => `/files/list?path=${encodeURIComponent(path)}`,
    providesTags: (result, error, path) => [{ type: 'File', id: path }],
  }),
})
```

### **Key Benefits of PData Integration:**

#### **Security:**
- ✅ **User isolation** - Each user's data is completely separated
- ✅ **Capability-based access** - Fine-grained permissions
- ✅ **JWT tokens** - Stateless authentication
- ✅ **Path validation** - Prevents directory traversal attacks

#### **Simplicity:**
- ✅ **CSV configuration** - Simple user management
- ✅ **Virtual paths** - Clean, user-friendly paths
- ✅ **Automatic mounting** - No complex filesystem setup
- ✅ **Built-in operations** - Standard file operations included

#### **Scalability:**
- ✅ **Stateless design** - Easy to scale horizontally
- ✅ **Modular architecture** - Components can be replaced
- ✅ **Extensible** - Easy to add new capabilities
- ✅ **Performance** - Efficient caching and path resolution

### **Data Flow:**

1. **User Login**: Client sends credentials → PData validates → Returns JWT token
2. **API Requests**: Client includes token → Server validates → PData checks permissions
3. **File Operations**: Virtual path → PData resolves → Permission check → File operation
4. **Response**: Real filesystem data → PData transforms → Client receives

### **Configuration Files:**

```
PD_DIR/
├── users.csv          # User credentials and roles
├── roles.csv          # Role definitions
├── capabilities.csv   # Capability mappings
├── assets.csv         # System assets
└── data/             # User data directories
    ├── user1/
    ├── user2/
    └── ...
```

This architecture provides DevPages with a **secure, scalable, and simple** foundation for user management and file operations, while maintaining the modern development experience with RTK Query and ES modules.
