# Report Management SaaS Platform - PRD
## Multi-Tenant, PWA, Offline-First Architecture

**Version:** 2.0  
**Last Updated:** July 31, 2026  
**Status:** PRE-DEVELOPMENT  
**Project Type:** SaaS Platform (Multi-Tenant, Progressive Web App)

---

## 1. EXECUTIVE SUMMARY

### Purpose
A **SaaS reporting platform** that enables organizations (churches, companies, teams, etc.) with subunit structures to efficiently document and compile operational reports. The platform leverages AI for automatic formatting and summarization, supports offline-first reporting, and scales across multiple isolated tenants.

### Vision Statement
"Empower organizations of any size to capture, organize, and analyze team performance through collaborative reporting—whether online or offline."

### Key Differentiators
1. **Multi-Tenant Isolation:** Each organization operates in a separate database—complete privacy and data security
2. **Offline-First:** Submit reports without internet; automatic sync when connection returns
3. **AI-Powered:** Google Gemma 4 transcription, image captioning, and quarterly summarization
4. **Progressive Web App:** Install as native app on any device; works seamlessly online and offline
5. **Flexible Customization:** Subunit names, report structures, and workflows adapt to each organization
6. **Subscription Model:** Freemium tier (demo), trial period, and paid plans with scaling features

### Problem Statement
Organizations struggle to:
- Capture and document daily/weekly operational activities consistently
- Manually compile quarterly reports from scattered submissions
- Maintain reporting accountability across distributed teams
- Access reporting tools when offline or during poor connectivity

### Solution Overview
A **Progressive Web App** where:
- **Users** submit reports (text/voice/image) from any device, online or offline
- **Offline reports** sync automatically when connection returns
- **Admins** trigger quarterly compilations with AI-formatted summaries
- **Organizations** enjoy complete data isolation in separate databases
- **System** scales to support unlimited tenants with customizable workflows

### Business Goals
1. **Acquire & Retain Customers:** Freemium → trial → paid conversion funnel
2. **Reduce Operational Overhead:** Quarterly report time reduced by 75%
3. **Ensure Data Privacy:** 100% tenant isolation, GDPR/privacy-first compliance
4. **Enable Offline-First:** Users report anytime, connectivity optional
5. **Drive Adoption:** Easy sign-up, invite-based onboarding, mobile-first UX

---

## 2. MARKET & POSITIONING

### Target Users
1. **Churches & Religious Organizations** (primary pilot: BHBC)
2. **NGOs & Non-Profits** (teams, departments)
3. **Corporate Teams** (HR, operations, field teams)
4. **Community Organizations** (sports clubs, volunteer groups)
5. **Educational Institutions** (departments, student groups)

### Competitive Advantages
- **Privacy-First:** Separate tenant databases (not multi-tenant SaaS with row-level security)
- **Offline-First:** Full functionality without internet
- **AI Summarization:** Automatic quarterly report generation
- **Free Tier:** Start with zero cost; upgrade to unlock features
- **No Vendor Lock-in:** Export reports, archives in standard formats (PDF, Word)

---

## 3. ARCHITECTURE OVERVIEW: MULTI-TENANCY

### 3.1 Multi-Tenant Database Strategy: Separate Databases Per Tenant

**Decision:** Each organization gets its **own PostgreSQL database** (completely isolated).

**Rationale:**
- ✅ Maximum data isolation (security & compliance)
- ✅ Simpler authorization (no row-level security filters needed)
- ✅ Privacy-first approach (no shared infrastructure risk)
- ✅ Per-tenant backups & recovery
- ✅ Each tenant can customize schema (future: custom fields, reports)

**Trade-off:** Higher infrastructure cost than shared databases, but privacy is non-negotiable.

### 3.2 Tenant Routing & Context

**Approach:** Subdomain-based tenant routing + Tenant Middleware

```
Tenant URLs:
- https://app.reportapp.com/           (Global auth/landing page)
- https://bhbc.reportapp.com/          (BHBC tenant dashboard)
- https://acmecorp.reportapp.com/      (Acme Corp tenant dashboard)
- https://healthmin.reportapp.com/     (Health Ministry tenant dashboard)

API Routing:
- Global: https://api.reportapp.com/auth/signup, /auth/login
- Tenant: https://api.reportapp.com/tenant/{tenantId}/reports, etc.
```

**Tenant Identification:**
1. Extract subdomain from request: `bhbc.reportapp.com` → `tenantId = bhbc`
2. Look up tenant in global metadata database (small, shared DB)
3. Establish connection to tenant's isolated PostgreSQL database
4. Set `request.tenant` context for all subsequent API calls
5. All queries filtered by `WHERE tenant_id = request.tenant.id`

### 3.3 Global Metadata Database (Shared, Small)

Only stores:
- Tenant info (ID, name, domain, subscription tier, created_at)
- User → Tenant mapping (which users belong to which tenants)
- Subscription & billing info
- Audit logs (for platform-level support)

**Does NOT store:** Organization's reports, user data, operational content

```sql
-- Global DB Tables
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  slug VARCHAR(50) UNIQUE,           -- "bhbc", "acmecorp", etc.
  name VARCHAR(255),
  domain VARCHAR(255),
  subscription_tier VARCHAR(50),     -- "free", "trial", "pro", "enterprise"
  trial_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  ...
);

CREATE TABLE user_tenant_memberships (
  id UUID PRIMARY KEY,
  user_id UUID,
  tenant_id UUID REFERENCES tenants(id),
  role VARCHAR(50),                  -- "admin", "subunit_head", "system_admin"
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  plan VARCHAR(50),                  -- "free", "pro", "enterprise"
  max_users INT,
  max_reports_per_month INT,
  features JSONB,                    -- Enabled features per plan
  billing_period_end TIMESTAMP,
  ...
);
```

### 3.4 Tenant Isolation Enforcement

**Application Layer (Middleware):**
```javascript
// Express middleware to set tenant context
app.use((req, res, next) => {
  const subdomain = req.hostname.split('.')[0]; // Extract from "bhbc.reportapp.com"
  
  if (subdomain === 'app' || subdomain === 'api') {
    // Global routes (auth, landing page)
    return next();
  }
  
  // Find tenant in global DB
  const tenant = globalDB.query('SELECT * FROM tenants WHERE slug = ?', [subdomain]);
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }
  
  // Get tenant's database connection
  const tenantDB = getTenantDatabaseConnection(tenant.id);
  
  // Set context
  req.tenant = tenant;
  req.db = tenantDB;  // All queries use tenant's isolated DB
  
  next();
});
```

**Database Layer (Query Scoping):**
```javascript
// All report queries automatically scoped to tenant
app.get('/api/reports', (req, res) => {
  const reports = req.db.query(
    'SELECT * FROM reports WHERE tenant_id = ?',
    [req.tenant.id]
  );
  res.json(reports);
});
```

**Authorization Layer (Server-Side Enforcement):**
```javascript
// Verify user belongs to tenant
const requireTenantAccess = (req, res, next) => {
  const userTenant = globalDB.query(
    'SELECT * FROM user_tenant_memberships WHERE user_id = ? AND tenant_id = ?',
    [req.user.id, req.tenant.id]
  );
  
  if (!userTenant) {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  
  next();
};
```

---

## 4. PWA & OFFLINE-FIRST ARCHITECTURE

### 4.1 Progressive Web App (PWA) Strategy

**PWA Features:**
- ✅ Installable on iOS, Android, macOS, Windows
- ✅ Works offline (with cached data)
- ✅ Push notifications
- ✅ Background sync
- ✅ App-like experience (full-screen, no address bar)

**Tech Stack:**
- **Workbox:** Service worker & caching strategies
- **IndexedDB:** Client-side data storage (last 10 reports + metadata)
- **Web Sync API:** Background sync when connection returns
- **Notification API:** Push notifications
- **Manifest.json:** PWA installation metadata

### 4.2 Offline-First Data Sync Architecture

#### User Scenario:
```
1. User is online → submits report → synced to server + IndexedDB
2. User loses connectivity
3. User submits new reports → stored in IndexedDB only
4. User goes offline mode: can view cached reports
5. Internet connection restored
6. Background sync triggers → uploads pending reports
7. Pulls latest data from server → updates IndexedDB
8. User notified of sync completion
```

#### IndexedDB Schema (Client-Side):

```javascript
// Databases per tenant (isolate data by tenant)
// DB Name: "reportapp_[tenantId]"

const DBSchema = {
  reports: {
    keyPath: 'id',
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'status', keyPath: 'status' },  // "synced", "pending", "conflict"
      { name: 'submittedAt', keyPath: 'submittedAt' }
    ]
  },
  syncQueue: {
    keyPath: 'id',  // Auto-generated UUID
    // Stores: { id, action, reportId, data, timestamp, retries }
  },
  offlineSettings: {
    keyPath: 'key',
    // Stores: { key: 'sync_enabled', value: true }
  },
  metadata: {
    keyPath: 'key',
    // Stores last sync time, user preferences, etc.
  }
};
```

#### Sync Flow (Detailed):

**1. Online Submission → IndexedDB + Server:**
```javascript
const submitReport = async (reportData) => {
  try {
    // Check connection
    if (!navigator.onLine) {
      // Offline: store locally
      await indexedDB.reports.add(reportData);
      await indexedDB.syncQueue.add({
        action: 'CREATE',
        reportId: reportData.id,
        data: reportData,
        timestamp: Date.now(),
        retries: 0
      });
      showNotification('Report saved offline. Will sync when online.');
      return;
    }
    
    // Online: POST to server
    const response = await fetch(`/api/reports`, {
      method: 'POST',
      body: JSON.stringify(reportData),
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      // Store in IndexedDB with synced status
      reportData.status = 'synced';
      await indexedDB.reports.put(reportData);
      showNotification('Report submitted successfully.');
    }
  } catch (error) {
    // Network error while online: queue for retry
    await indexedDB.syncQueue.add({
      action: 'CREATE',
      reportId: reportData.id,
      data: reportData,
      timestamp: Date.now(),
      retries: 0
    });
    showNotification('Submission failed. Queued for retry.');
  }
};
```

**2. Background Sync (via Service Worker):**
```javascript
// service-worker.js
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncPendingReports());
  }
});

async function syncPendingReports() {
  const db = await openIndexedDB(`reportapp_${tenantId}`);
  const syncQueue = await db.getAll('syncQueue');
  
  for (const item of syncQueue) {
    try {
      // Attempt to sync
      const response = await fetch(`/api/reports`, {
        method: item.action === 'CREATE' ? 'POST' : 'PUT',
        body: JSON.stringify(item.data),
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        // Remove from sync queue
        await db.delete('syncQueue', item.id);
        
        // Update report status
        await db.put('reports', {
          ...item.data,
          status: 'synced',
          syncedAt: Date.now()
        });
      } else if (response.status === 409) {
        // Conflict: server has newer version
        const serverReport = await response.json();
        
        // Store conflict
        await db.put('reports', {
          ...item.data,
          status: 'conflict',
          serverVersion: serverReport,
          clientVersion: item.data
        });
        
        // Show user conflict resolution UI
        notifyUser({
          type: 'conflict',
          reportId: item.reportId,
          message: 'This report was edited elsewhere. Please review.'
        });
      } else {
        // Retry later
        item.retries++;
        if (item.retries < 5) {
          await db.put('syncQueue', item);
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
      item.retries++;
      if (item.retries < 5) {
        await db.put('syncQueue', item);
      }
    }
  }
  
  // Notify sync completion
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        pendingCount: await db.count('syncQueue')
      });
    });
  });
}
```

**3. Connection Detection & Immediate Sync:**
```javascript
// client-side connection listener
window.addEventListener('online', async () => {
  console.log('Connection restored');
  
  // Immediately trigger background sync
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-reports');
  }
  
  // Also attempt immediate sync (fallback)
  await syncPendingReports();
  
  showNotification('Back online. Syncing reports...');
});

window.addEventListener('offline', () => {
  console.log('Connection lost');
  showNotification('You are offline. Reports will sync automatically.');
});
```

**4. Conflict Resolution UI (Show to User):**
```javascript
// User sees conflict notification
const resolveConflict = async (reportId, choice) => {
  // choice: 'keep_local' | 'use_server' | 'merge'
  
  const db = await openIndexedDB(`reportapp_${tenantId}`);
  const report = await db.get('reports', reportId);
  
  if (choice === 'keep_local') {
    // Force local version to server (last-write-wins)
    await fetch(`/api/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify(report.clientVersion),
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } else if (choice === 'use_server') {
    // Accept server version
    await db.put('reports', {
      ...report.serverVersion,
      status: 'synced'
    });
  }
  
  // Remove conflict marker
  await db.delete('syncQueue', reportId);
};
```

### 4.3 Offline Report Download for Quarterly Reports

**Scenario:** User downloads quarterly report while online → stored for offline access

```javascript
// Download quarterly report (PDF/Word)
const downloadQuarterlyReport = async (reportId) => {
  try {
    // Fetch from server
    const response = await fetch(`/api/admin/reports/quarterly/${reportId}/download`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const blob = await response.blob();
    
    // Save to IndexedDB for offline access
    const db = await openIndexedDB(`reportapp_${tenantId}`);
    await db.put('quarterlyReports', {
      id: reportId,
      fileName: `report_${reportId}.pdf`,
      blob: blob,
      downloadedAt: Date.now(),
      size: blob.size
    });
    
    // Also trigger download to device
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${reportId}.pdf`;
    link.click();
    
    showNotification('Report downloaded for offline access.');
  } catch (error) {
    showNotification('Download failed. Will retry when online.');
  }
};

// Access offline quarterly report
const openOfflineQuarterlyReport = async (reportId) => {
  const db = await openIndexedDB(`reportapp_${tenantId}`);
  const report = await db.get('quarterlyReports', reportId);
  
  if (report) {
    const url = URL.createObjectURL(report.blob);
    window.open(url, '_blank');
  } else {
    showNotification('Report not available offline.');
  }
};
```

### 4.4 Service Worker & Caching Strategy

**Caching Strategy (Workbox):**
```javascript
// workbox-config.js
module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{js,css,html,png,jpg,svg,woff2}'
  ],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
  cleanupOutdatedCaches: true,
  
  // Caching strategies per resource type
  runtimeCaching: [
    // API calls: Network-first (online preferred)
    {
      urlPattern: /^https:\/\/api\.reportapp\.com\/api\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 3600 // 1 hour
        }
      }
    },
    // Static assets: Cache-first (offline preferred)
    {
      urlPattern: /\.(?:js|css|woff2)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets'
      }
    },
    // Images: Cache-first with expiration
    {
      urlPattern: /\.(?:png|jpg|svg)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
        }
      }
    }
  ]
};
```

**Service Worker Registration (Next.js):**
```javascript
// pages/_app.jsx
import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/public/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
          
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
        })
        .catch(error => console.error('Service Worker registration failed:', error));
    }
  }, []);
  
  return <Component {...pageProps} />;
}
```

### 4.5 Push Notifications (PWA)

**Request Permission & Subscribe:**
```javascript
const subscribeToPushNotifications = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
      });
      
      // Send subscription to server
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('Push notification subscription sent to server');
    }
  } catch (error) {
    console.error('Push subscription failed:', error);
  }
};
```

**Handle Push Events (Service Worker):**
```javascript
// service-worker.js
self.addEventListener('push', event => {
  const options = {
    body: event.data?.body || 'New report notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'report-notification',
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Report Alert', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // Focus existing app window or open new one
        const client = clientList.find(c => c.url.includes('/'));
        return client ? client.focus() : clients.openWindow('/');
      })
    );
  }
});
```

**Send Push Notifications from Backend:**
```javascript
// backend: send weekly reminder via push
const sendPushReminder = async (userId, tenantId) => {
  const db = getTenantDatabaseConnection(tenantId);
  
  // Get user's push subscriptions
  const subscriptions = await db.query(
    'SELECT push_subscription FROM users WHERE id = ?',
    [userId]
  );
  
  const pushSubscription = JSON.parse(subscriptions[0].push_subscription);
  
  const payload = JSON.stringify({
    title: 'Weekly Report Reminder',
    body: `Time to submit your weekly report for ${tenantId}`,
    icon: '/icon-192x192.png',
    data: {
      url: `/submit`
    }
  });
  
  try {
    await webpush.sendNotification(pushSubscription, payload);
  } catch (error) {
    console.error('Push notification failed:', error);
  }
};
```

### 4.6 PWA Manifest & Installation

**public/manifest.json:**
```json
{
  "name": "Report Management Platform",
  "short_name": "ReportApp",
  "description": "Offline-first team reporting platform",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#ffffff",
  "theme_color": "#007bff",
  "icons": [
    {
      "src": "/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/maskable-icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshot-wide.png",
      "sizes": "1280x720",
      "form_factor": "wide"
    },
    {
      "src": "/screenshot-narrow.png",
      "sizes": "540x720",
      "form_factor": "narrow"
    }
  ],
  "categories": ["productivity", "utilities"],
  "screenshots_manifest": true
}
```

**Install Prompt (Next.js Component):**
```javascript
// components/InstallPrompt.jsx
import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    });
    
    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      console.log('App installed successfully');
    });
  }, []);
  
  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted install');
      }
      setShowPrompt(false);
    }
  };
  
  return showPrompt ? (
    <div className="install-prompt">
      <p>Install the app for faster access and offline support</p>
      <button onClick={handleInstall}>Install</button>
      <button onClick={() => setShowPrompt(false)}>Dismiss</button>
    </div>
  ) : null;
}
```

---

## 5. SUBSCRIPTION & BILLING MODEL

### 5.1 Pricing Tiers

| Feature | Free | Trial (14 days) | Pro | Enterprise |
|---------|------|---|---|---|
| **Subunits** | Up to 2 | Up to 4 | Unlimited | Unlimited |
| **Users** | Up to 5 | Up to 10 | Up to 50 | Custom |
| **Reports/Month** | 50 | 500 | 5,000 | Unlimited |
| **Offline Cache** | Last 5 reports | Last 10 | Last 20 | Last 50 |
| **Quarterly Reports** | 1 per quarter | 4 | Unlimited | Unlimited |
| **AI Summarization** | Basic | Full | Full | Full |
| **Push Notifications** | ❌ | ✅ | ✅ | ✅ |
| **Custom Branding** | ❌ | ❌ | ✅ | ✅ |
| **Analytics** | ❌ | ❌ | Basic | Advanced |
| **Support** | Email (48h) | Email (24h) | Priority (4h) | Dedicated |
| **Price** | $0 | $0 (trial) | $29/month | Custom |

### 5.2 Trial Period Flow

```
1. Signup → Create tenant (Free tier)
2. Admin clicks "Start 14-day Trial"
3. Trial activated → Pro features unlocked for 14 days
4. Before trial expires:
   - Email reminder (Day 10): "Your trial expires in 4 days"
   - Email reminder (Day 13): "Your trial expires tomorrow"
   - Option to upgrade to Pro or downgrade to Free
5. After trial expires:
   - Automatically downgraded to Free tier
   - Features restricted (show "Upgrade" prompts)
   - Data preserved (not deleted)
```

### 5.3 Subscription Enforcement (Middleware)

```javascript
// Check subscription tier for feature access
const checkSubscriptionTier = (requiredTier) => {
  return (req, res, next) => {
    const tenant = req.tenant;
    const tierHierarchy = { free: 0, pro: 1, enterprise: 2 };
    
    if (tierHierarchy[tenant.subscription_tier] < tierHierarchy[requiredTier]) {
      return res.status(403).json({
        error: 'Feature not available in your plan',
        message: `Upgrade to ${requiredTier.toUpperCase()} to access this feature`,
        upgradeUrl: `/billing/upgrade`
      });
    }
    
    next();
  };
};

// Usage in routes
app.get(
  '/api/analytics',
  checkSubscriptionTier('pro'),
  getAnalytics
);

app.post(
  '/api/notifications/subscribe',
  checkSubscriptionTier('pro'),
  subscribePushNotifications
);
```

---

## 6. TENANT ONBOARDING FLOW

### 6.1 Invitation-Based Signup

**Step 1: Admin Invites Users**
```
1. Admin logs into tenant dashboard
2. Clicks "Invite Users"
3. Enters email addresses
4. System generates unique invite links with tenant ID:
   https://app.reportapp.com/join?tenant=bhbc&token=xyz123
5. Emails sent to invitees with link & welcome message
```

**Step 2: Invitee Signs Up**
```
1. Clicks link in email
2. Redirected to signup page with tenant pre-filled
3. Enters: Name, Email, Password
4. Account created in tenant's isolated database
5. Automatically assigned to tenant with default role (subunit_head)
6. Redirected to app → onboarding tour
```

**Step 3: Admin Assigns Roles & Subunits**
```
1. Admin views "Users" page
2. For each user:
   - Select Role: Subunit Head, Department Admin, System Admin
   - Select Subunit/Department: Livestream, Socials, etc.
   - Save changes
3. User receives notification: "You've been assigned to [Subunit]"
```

### 6.2 Tenant Initialization (First Setup)

```
1. First admin user completes signup
2. Tenant onboarding wizard:
   a. "Name your organization" → "BHBC Media Ministry"
   b. "Define your subunits" → Add: Livestream, Socials, Videography, Photography
   c. "Invite your team" → Email list
   d. "Customize settings" → Logo, colors, report format preferences
   e. "Review & confirm"
3. Tenant database initialized with custom schema
4. First quarterly report template generated
5. Admin redirected to dashboard
```

---

## 7. USER STORIES (UPDATED FOR MULTI-TENANT & OFFLINE)

### 7.1 User Signs Up & Joins Tenant

**User Story:**  
As a new team member, I want to join my organization using an invite link so I can start submitting reports.

**Acceptance Criteria:**
- [ ] Receive email with invite link containing tenant ID
- [ ] Click link → redirected to signup page with tenant pre-filled
- [ ] Enter name, email, password → account created in tenant's DB
- [ ] Confirm email (optional for MVP)
- [ ] Redirected to dashboard → welcome message with onboarding tour
- [ ] Role pre-assigned (subunit head), editable by admin later
- [ ] Cannot sign up for a different tenant with same email (isolated DBs)

---

### 7.2 Submit Report Offline

**User Story:**  
As a subunit head, I want to submit a report even without internet so I can document activities anytime, anywhere.

**Acceptance Criteria:**
- [ ] In offline mode, submit report form is fully functional
- [ ] Report saved to IndexedDB (local storage)
- [ ] Visual indicator: "Report saved offline. Will sync when online."
- [ ] Report appears in "My Reports" with status "Pending Sync"
- [ ] When connection restored:
  - System detects online event
  - Automatically syncs pending reports
  - Status changes to "Synced" with timestamp
  - User notified: "Reports synced successfully"

---

### 7.3 View Cached Reports Offline

**User Story:**  
As a user, I want to view my cached reports when offline so I can reference past submissions.

**Acceptance Criteria:**
- [ ] Offline mode: last 10 reports (or user-configured limit) display
- [ ] Can filter by date, type (text/voice/image)
- [ ] Cannot edit submitted reports (read-only while offline)
- [ ] Can view full content (text, transcription, image description)
- [ ] When online, can re-edit from local cache
- [ ] Clear indicator: "Showing cached reports (last updated [time])"

---

### 7.4 Download Quarterly Report for Offline Access

**User Story:**  
As an admin, I want to download quarterly reports while online so I can access them later without internet.

**Acceptance Criteria:**
- [ ] Generate quarterly report (as before)
- [ ] "Download for Offline" option in download modal
- [ ] PDF/Word file saved to IndexedDB + device storage
- [ ] Later, when offline, access "Downloaded Reports" section
- [ ] Open report in viewer (embedded PDF viewer)
- [ ] Can export/share if device permits
- [ ] Sync: If report is regenerated while online, version is updated on device

---

### 7.5 Resolve Sync Conflict

**User Story:**  
As a user, I want to see and resolve conflicts when my offline changes conflict with server changes.

**Acceptance Criteria:**
- [ ] Offline: edit report A
- [ ] Meanwhile, server version of report A is edited
- [ ] When sync happens:
  - Conflict detected (409 status)
  - Report marked as "Conflict" in UI
- [ ] User sees modal:
  - "Your version" (text diff)
  - "Server version" (text diff)
  - Buttons: "Keep Mine" | "Use Server" | "Manual Merge"
- [ ] Click "Keep Mine" → local version uploaded (last-write-wins)
- [ ] Click "Use Server" → discard local changes
- [ ] Report status changes to "Synced"

---

### 7.6 Configure Offline Sync Preferences

**User Story:**  
As a power user, I want to customize what syncs offline so I can save device storage space.

**Acceptance Criteria:**
- [ ] Navigate to Settings → Offline Storage
- [ ] Options:
  - "Auto-sync reports" (toggle)
  - "Number of reports to cache" (dropdown: 5, 10, 20, 50)
  - "Include images" (toggle, to save space)
  - "Include audio files" (toggle)
- [ ] Clear cache button with confirmation
- [ ] Display current storage usage (e.g., "2.5 MB of 50 MB used")
- [ ] Changes persist in IndexedDB settings store
- [ ] Next sync respects new preferences

---

### 7.7 Install PWA on Device

**User Story:**  
As a user, I want to install the app on my home screen so I can access it like a native app.

**Acceptance Criteria:**
- [ ] Prompt appears: "Install the app for faster access"
- [ ] Click "Install" → browser shows install dialog
- [ ] Confirm → app icon added to home screen
- [ ] Open from home screen → app runs full-screen (no browser chrome)
- [ ] App name displayed: "Report App"
- [ ] App icon matches manifest (custom branding per tenant future feature)
- [ ] Prompt can be dismissed; appears again later

---

### 7.8 Receive Push Notification (Pro+ Tier)

**User Story:**  
As an admin, I want my users to receive push notifications so they remember to submit weekly reports.

**Acceptance Criteria:**
- [ ] App prompts for notification permission on first visit
- [ ] User grants permission → subscription sent to server
- [ ] Weekly reminder time approaches:
  - Backend sends push notification: "Weekly Report Reminder"
  - Notification appears even if app is closed
- [ ] User clicks notification → app opens to Submit page
- [ ] Push notification settings: Users can enable/disable in Settings

---

## 8. UPDATED DATA MODEL (Prisma Schema)

### 8.1 Per-Tenant Database Schema

```prisma
// Each tenant has their own database with this schema

model User {
  id                String          @id @default(cuid())
  tenantId          String          @db.VarChar(255)  // Foreign key to global DB
  name              String
  email             String          @unique
  passwordHash      String
  role              Role            @default(SUBUNIT_HEAD)
  subunit           String?         // e.g., "Livestream", "Socials"
  
  // PWA & Notifications
  pushSubscription  String?         @db.Text  // Stringified PushSubscription
  notificationsEnabled Boolean      @default(true)
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  reports           Report[]
  deletedReports    DeletedReport[]
  notifications     Notification[]
}

enum Role {
  SUBUNIT_HEAD
  ADMIN
  SYSTEM_ADMIN
}

model Report {
  id                String          @id @default(cuid())
  userId            String          @db.VarChar(255)
  user              User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  tenantId          String          @db.VarChar(255)  // Metadata (for audit)
  subunit           String
  reportType        ReportType
  
  // Content
  textContent       String?         @db.Text
  imageUrl          String?
  imageDescription  String?         @db.Text
  audioUrl          String?
  
  // Metadata & Status
  tags              String[]        @default([])
  status            ReportStatus    @default(DRAFT)
  isDeleted         Boolean         @default(false)
  submittedAt       DateTime?
  
  // Sync Metadata (for offline handling)
  syncedAt          DateTime?       // When last synced to client
  version           Int             @default(1)  // For conflict detection
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  deletedAt         DateTime?
  
  @@index([userId])
  @@index([subunit])
  @@index([submittedAt])
  @@index([isDeleted])
  @@index([status])
}

enum ReportType {
  TEXT
  VOICE
  IMAGE
}

enum ReportStatus {
  DRAFT
  SUBMITTED
  ARCHIVED
}

model DeletedReport {
  id                String          @id @default(cuid())
  reportId          String          @db.VarChar(255)  // Original report ID
  userId            String          @db.VarChar(255)
  user              User            @relation(fields: [userId], references: [id])
  
  deletedAt         DateTime        @default(now())
  reason            String?
  
  @@index([userId])
  @@index([deletedAt])
}

model QuarterlyReportGeneration {
  id                String          @id @default(cuid())
  generatedBy       String          @db.VarChar(255)
  
  tenantId          String          @db.VarChar(255)
  startDate         DateTime
  endDate           DateTime
  subunits          String[]
  
  reportFormat      String[]
  content           String          @db.Text
  
  downloadedAt      DateTime?
  downloadedBy      String?
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  @@index([generatedBy])
  @@index([createdAt])
}

model Notification {
  id                String          @id @default(cuid())
  userId            String          @db.VarChar(255)
  user              User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  type              NotificationType
  subject           String
  body              String
  actionUrl         String?
  
  sentAt            DateTime        @default(now())
  readAt            DateTime?
  
  @@index([userId])
  @@index([sentAt])
}

enum NotificationType {
  WEEKLY_REMINDER
  SUBMISSION_CONFIRMATION
  REPORT_READY
  SYNC_COMPLETE
  SYNC_CONFLICT
}

model Setting {
  id                String          @id @default(cuid())
  key               String          @unique
  value             String          @db.Text
  description       String?
  
  updatedAt         DateTime        @updatedAt
}
```

### 8.2 Global Database Schema (Shared Metadata)

```prisma
// Global database (shared across all tenants)
// Handles auth, tenant management, billing

model Tenant {
  id                String          @id @default(cuid())
  slug              String          @unique  // "bhbc", "acmecorp"
  name              String
  domain            String?         // e.g., "bhbc.reportapp.com"
  databaseUrl       String          @db.Text  // Connection string to tenant's isolated DB
  
  // Subscription
  subscriptionTier  String          @default("free")  // "free", "pro", "enterprise"
  trialExpiresAt    DateTime?
  trialUsed         Boolean         @default(false)
  
  // Organization Customization
  logoUrl           String?
  brandColor        String?         @default("#007bff")
  subunitNames      String[]        @default(["Subunit 1", "Subunit 2"]) // Customizable
  
  // Settings
  weeklyReminderEnabled Boolean     @default(true)
  reminderDay       String          @default("monday")
  reminderHour      Int             @default(9)
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  memberships       UserTenantMembership[]
  subscriptions     Subscription[]
}

model UserTenantMembership {
  id                String          @id @default(cuid())
  userId            String          @db.VarChar(255)
  tenantId          String
  tenant            Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  role              String          @default("subunit_head")  // Global role (per-tenant role is in tenant DB)
  joinedAt          DateTime        @default(now())
  
  @@unique([userId, tenantId])
  @@index([userId])
  @@index([tenantId])
}

model Subscription {
  id                String          @id @default(cuid())
  tenantId          String
  tenant            Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  plan              String          // "free", "pro", "enterprise"
  maxUsers          Int
  maxReportsPerMonth Int
  features          String[]        // ["offline_sync", "push_notifications", "analytics"]
  
  billingPeriodStart DateTime
  billingPeriodEnd  DateTime
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  @@unique([tenantId])
}

model GlobalAuditLog {
  id                String          @id @default(cuid())
  tenantId          String          @db.VarChar(255)
  userId            String?         @db.VarChar(255)
  
  action            String          // "tenant_created", "user_invited", "trial_started"
  details           String          @db.Text
  ipAddress         String?
  
  createdAt         DateTime        @default(now())
  
  @@index([tenantId])
  @@index([createdAt])
}
```

---

## 9. API ENDPOINTS (UPDATED FOR MULTI-TENANT & OFFLINE)

### 9.1 Global Endpoints (No Tenant Context)

**Authentication:**
- `POST /api/auth/signup` – Sign up for platform (create free tenant)
- `POST /api/auth/login` – Login with email/password
- `POST /api/auth/logout` – Logout
- `GET /api/auth/me` – Current user info (across all tenants)
- `POST /api/auth/refresh` – Refresh JWT token

**Tenant Management:**
- `POST /api/tenants` – Create new tenant (admin only, future)
- `GET /api/tenants` – List user's tenants
- `POST /api/tenants/:tenantId/join` – Join tenant via invite token
- `GET /api/invites/:token` – Validate invite link

**Billing & Subscription:**
- `GET /api/billing/plans` – Get pricing tiers
- `POST /api/billing/subscribe` – Upgrade subscription
- `GET /api/billing/current` – Current subscription status
- `POST /api/billing/cancel` – Cancel subscription

### 9.2 Tenant-Scoped Endpoints (Multi-Tenant Context)

**All endpoints prefixed with tenant ID or extracted from subdomain:**
`/api/tenant/{tenantId}/...` OR auto-detected from `subdomain.reportapp.com`

**Reports:**
- `POST /api/reports` – Submit report (text/voice/image)
- `GET /api/reports/mine` – User's reports (with offline sync metadata)
- `GET /api/reports` – Admin: all reports with filters
- `GET /api/reports/:id` – Get specific report
- `PUT /api/reports/:id` – Update report (if draft)
- `DELETE /api/reports/:id` – Soft delete report
- `POST /api/reports/sync` – Offline sync endpoint (bulk get/put)

**Voice & Image Processing:**
- `POST /api/reports/:id/transcribe` – Async transcription (Gemma 4)
- `POST /api/reports/:id/image-description` – AI image captioning

**Quarterly Reports:**
- `POST /api/admin/reports/generate-quarterly` – Trigger compilation
- `GET /api/admin/reports/quarterly/:id/preview` – Preview before download
- `GET /api/admin/reports/quarterly/:id/download` – Download (PDF/Word)

**Users & Permissions:**
- `GET /api/users` – Admin: list all users in tenant
- `POST /api/users/invite` – Admin: invite user via email
- `PUT /api/users/:userId/role` – Admin: update user role/subunit
- `DELETE /api/users/:userId` – Admin: remove user from tenant

**Notifications:**
- `GET /api/notifications` – User's notifications
- `PUT /api/notifications/:id/read` – Mark as read
- `POST /api/notifications/subscribe` – Subscribe to push notifications
- `DELETE /api/notifications/subscribe` – Unsubscribe from push

**Sync & Offline:**
- `POST /api/sync/reports` – Bulk sync offline changes
  - Request: `{ reports: [{ id, textContent, version, timestamp }] }`
  - Response: `{ synced: [...], conflicts: [...], newReports: [...] }`
- `GET /api/sync/metadata` – Get last sync timestamp & settings

**Settings:**
- `GET /api/settings` – Get tenant settings
- `PUT /api/settings` – Update settings (admin only)
- `GET /api/settings/user-preferences` – Get user's offline sync preferences
- `PUT /api/settings/user-preferences` – Update preferences (cache limit, auto-sync, etc.)

**Analytics (Pro+ Tier):**
- `GET /api/analytics/submission-trends` – Reports over time
- `GET /api/analytics/subunit-summary` – Per-subunit stats
- `GET /api/analytics/export` – Export analytics data

---

## 10. IMPLEMENTATION ROADMAP (20-14 WEEKS)

### Phase 1: Core Infrastructure & Multi-Tenancy (Weeks 1-4)

**Week 1-2: Setup & Tenant Architecture**
- [ ] Global database schema (Prisma migrations)
- [ ] Tenant database connection pooling
- [ ] Tenant middleware & context injection
- [ ] Global auth system (signup, login, JWT)
- [ ] Deployment infrastructure (tenant DB provisioning automation)

**Week 3-4: Tenant Onboarding**
- [ ] Invite system (email with token)
- [ ] Signup per tenant
- [ ] Tenant initialization wizard
- [ ] Role & permission system (RBAC)
- [ ] Dashboard scaffold

### Phase 2: Core Features (Weeks 5-10)

**Week 5-6: Report Submission (Offline-Aware)**
- [ ] Text/voice/image report forms
- [ ] IndexedDB setup per tenant
- [ ] Online submission → server + IndexedDB
- [ ] Offline submission → IndexedDB only
- [ ] Sync status indicators

**Week 7-8: AI Integration & Processing**
- [ ] Google Gemma 4 API integration
- [ ] Voice transcription async endpoint
- [ ] Image description generation
- [ ] Quarterly report summarization

**Week 9-10: Admin Dashboard & Compilation**
- [ ] All reports view with filters
- [ ] Quarterly report generation UI
- [ ] Draft review interface
- [ ] PDF/Word export

### Phase 3: PWA & Offline Sync (Weeks 11-14)

**Week 11-12: PWA Foundation**
- [ ] Service worker setup (Workbox)
- [ ] Manifest.json & installation
- [ ] Caching strategies
- [ ] Offline asset loading
- [ ] Install prompt UI

**Week 13-14: Background Sync & Push Notifications**
- [ ] Background sync API implementation
- [ ] Conflict detection & resolution UI
- [ ] Push notification subscription
- [ ] Web push backend integration
- [ ] Sync status UI notifications

### Phase 4: Subscription & Polish (Weeks 15-18)

- [ ] Subscription tier enforcement
- [ ] Trial period flow
- [ ] Billing integration (Stripe)
- [ ] Feature gates per plan
- [ ] Testing & bug fixes

### Phase 5: Launch & Monitoring (Weeks 19-20)

- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing
- [ ] Documentation & support materials
- [ ] Beta launch with limited tenants

---

## 11. TECHNICAL STACK (UPDATED)

### Frontend
```json
{
  "next": "^15.0.0",
  "react": "^19.0.0",
  "tailwindcss": "^3.3.0",
  "axios": "^1.4.0",
  "zustand": "^4.3.0",
  "react-query": "^3.39.0",
  "dexie": "^3.2.0",  // IndexedDB wrapper
  "idb": "^7.0.0",    // IndexedDB utilities
  "workbox-window": "^7.0.0"  // PWA client
}
```

### Backend
```json
{
  "express": "^4.18.0",
  "@prisma/client": "^5.0.0",
  "prisma": "^5.0.0",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "node-cron": "^3.0.0",
  "bull": "^4.10.0",     // Job queue
  "redis": "^4.6.0",     // Redis for jobs
  "multer": "^1.4.5",    // File upload
  "pdf-lib": "^1.17.0",  // PDF generation
  "docx": "^8.0.0",      // Word document generation
  "web-push": "^3.6.0",  // Push notifications
  "axios": "^1.4.0"
}
```

### DevOps & Infrastructure
```
- PostgreSQL 14+ per tenant
- Redis (job queuing)
- AWS S3 or Supabase Storage (file storage)
- Google Gemma 4 AI Studio (LLM)
- Render or Railway (managed databases)
- Vercel (frontend hosting)
- node-cron or AWS Lambda (scheduled tasks)
- Stripe (billing, future)
```

### External Services
```
- Google Gemma 4 (transcription, summarization)
- Web Push API (browser notifications)
- Sendgrid or Resend (email)
- Stripe (subscription billing, future)
```

---

## 12. DEPLOYMENT & SCALING

### 12.1 Multi-Tenant Database Deployment

**Option A: Render/Railway (Recommended for MVP)**
```
- Global database: Managed PostgreSQL instance
- Each tenant database: Managed PostgreSQL instance (auto-provisioned)
- Connection string stored in global DB
- Cost: ~$15/month per tenant (scales with usage)
```

**Option B: AWS RDS (Enterprise)**
```
- RDS cluster for global DB
- Aurora PostgreSQL for per-tenant databases (auto-scaling)
- AWS Secrets Manager for connection strings
- DMS for migrations
```

**Provisioning Automation:**
```javascript
// When tenant signs up
const createTenantDatabase = async (tenantId) => {
  // Call Render/Railway API to provision DB
  const dbInstance = await renderAPI.createDatabase({
    name: `reportapp_${tenantId}`,
    region: 'us-east-1',
    backup_retention: 7
  });
  
  // Store connection string in global DB
  await globalDB.tenants.update(tenantId, {
    databaseUrl: dbInstance.connectionString
  });
  
  // Run migrations on tenant DB
  await runPrismaMigrations(dbInstance.connectionString);
};
```

### 12.2 Scaling Path

**Phase 1 (MVP): Single Instance**
- Next.js app: Vercel
- Global DB: Managed PostgreSQL
- Tenant DBs: On-demand provisioning

**Phase 2: Horizontal Scaling**
- Backend API: Separate Express servers (behind load balancer)
- Frontend: Vercel (auto-scales)
- Redis: Cluster for job queue
- Database: Connection pooling (PgBouncer)

**Phase 3: Geo-Distribution**
- CDN for assets (Cloudflare)
- Regional app servers
- Database replicas per region

---

## 13. SECURITY & COMPLIANCE

### 13.1 Multi-Tenant Isolation Security

```javascript
// CRITICAL: Verify tenant access on every request
app.use((req, res, next) => {
  const userToken = req.headers.authorization?.split('Bearer ')[1];
  const tenant = extractTenantFromRequest(req); // Subdomain or header
  
  // Verify JWT
  const decoded = verifyJWT(userToken);
  
  // Check user belongs to tenant (global DB)
  const membership = globalDB.query(
    'SELECT * FROM user_tenant_memberships WHERE user_id = ? AND tenant_id = ?',
    [decoded.userId, tenant.id]
  );
  
  if (!membership) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  // Set request context
  req.tenant = tenant;
  req.user = decoded;
  req.db = getTenantConnection(tenant.id);
  
  next();
});
```

### 13.2 Data Privacy

- **GDPR Compliance:** Tenant data deletion on account close
- **Data Encryption:** HTTPS for all requests; data at rest encrypted (DB-level)
- **Audit Logging:** All data access logged (per-tenant audit logs)
- **Right to Erasure:** User can request data deletion; removed from tenant DB

### 13.3 File Upload Security

```javascript
const validateFileUpload = (req, res, next) => {
  const file = req.file;
  
  // Validate type & size
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  
  if (file.size > maxSize) {
    return res.status(400).json({ error: 'File too large' });
  }
  
  // Scan for malware (optional: ClamAV)
  // Store securely
  file.storagePath = `/tenant/${req.tenant.id}/${Date.now()}_${file.originalname}`;
  
  next();
};
```

---

## 14. MONITORING & OBSERVABILITY

### 14.1 Metrics to Track

```
- Tenant signup & activation rate
- Trial-to-paid conversion rate
- Daily/monthly active users per tenant
- Report submission rate
- Sync success/failure rate
- API response times (per endpoint)
- Database connection pool utilization
- IndexedDB cache hit rate
- Push notification delivery rate
- App crash rate (PWA)
```

### 14.2 Logging & Alerting

```javascript
// Winston logger (per-tenant)
const logger = winston.createLogger({
  defaultMeta: { tenantId: req.tenant.id },
  transports: [
    new winston.transports.File({ filename: `logs/tenant_${req.tenant.id}.log` })
  ]
});

// Alert conditions
- API error rate > 5%
- Database query time > 5s
- Sync queue buildup > 100 items
- Push notification failures > 10%
- Tenant database size approaching limit
```

---

## 15. SUCCESS METRICS

### Adoption
- [ ] 500+ tenants signed up (first year)
- [ ] 50+ trial conversions to paid (first 6 months)
- [ ] 10,000+ users across all tenants (first year)

### Feature Usage
- [ ] 80%+ of users submit ≥2 reports per month
- [ ] 95%+ offline-first usage on mobile
- [ ] 60%+ of users have app installed (PWA)
- [ ] 70%+ push notification opt-in rate

### Performance
- [ ] API response time: <200ms (p95)
- [ ] Offline sync success rate: 99%+
- [ ] Conflict detection accuracy: 99%+
- [ ] Database availability: 99.9%+

### Business
- [ ] MRR (Monthly Recurring Revenue): $10k+ (year 2)
- [ ] Customer retention: 90%+ (annual)
- [ ] Support ticket response time: <4 hours

---

## 16. APPENDIX: GLOSSARY

| Term | Definition |
|------|-----------|
| **Tenant** | An isolated organization with its own database, users, and reports |
| **Multi-Tenant** | Multiple independent organizations using the same SaaS platform |
| **PWA** | Progressive Web App; installable web app with offline & notification support |
| **IndexedDB** | Browser-side database for storing offline data |
| **Service Worker** | Background script that manages caching, background sync, notifications |
| **Background Sync** | Automatic sync of offline changes when connection is restored |
| **Conflict** | When both client & server edit the same report while offline |
| **Last-Write-Wins** | Conflict resolution strategy: latest edit overwrites earlier edits |
| **Soft Delete** | Marking record as deleted without permanently removing from DB |
| **Subscription Tier** | Pricing plan level (Free, Pro, Enterprise) with feature limits |

---

## 17. APPROVALS & SIGN-OFF

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Manager | [TBD] | ________ | __/__/__ |
| Tech Lead | [TBD] | ________ | __/__/__ |
| DevOps Lead | [TBD] | ________ | __/__/__ |
| Stakeholder | [TBD] | ________ | __/__/__ |

---

**End of Updated PRD v2.0**

---

### Key Changes from v1.0

✅ **Multi-Tenancy**
- Separate PostgreSQL database per tenant
- Global metadata database for tenant management
- Tenant middleware & context isolation
- Subdomain-based routing

✅ **PWA & Offline-First**
- IndexedDB for local report storage
- Background sync with conflict resolution
- Service worker caching strategies
- Push notifications
- Install prompts

✅ **Subscription Model**
- Freemium tier (Free) with 2 subunits, 50 reports/month
- Trial period (14 days, all Pro features)
- Pro tier ($29/month) and Enterprise (custom)
- Feature gates per subscription level

✅ **Updated APIs**
- Tenant-scoped endpoints
- Sync endpoint for offline changes
- Subscription management
- Billing endpoints

✅ **Expanded User Stories**
- Offline submission
- Sync conflict resolution
- Cache management
- PWA installation

✅ **Security & Compliance**
- Strict tenant isolation enforcement
- GDPR-ready (data deletion, audit logs)
- File upload validation
- Per-tenant audit logging
