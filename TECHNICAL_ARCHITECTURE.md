# Technical Architecture Document
## Report Management SaaS Platform - Multi-Tenant, PWA, Offline-First

**Version:** 1.0  
**Date:** July 31, 2026  
**Audience:** Backend Engineers, DevOps, Tech Lead

---

## TABLE OF CONTENTS

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Multi-Tenant Database Architecture](#2-multi-tenant-database-architecture)
3. [Offline-First Sync Architecture](#3-offline-first-sync-architecture)
4. [PWA & Service Worker Architecture](#4-pwa--service-worker-architecture)
5. [Deployment & Infrastructure](#5-deployment--infrastructure)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [Security Architecture](#7-security-architecture)
8. [Scalability & Performance](#8-scalability--performance)
9. [Error Handling & Resilience](#9-error-handling--resilience)

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 1.1 High-Level System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (PWA)                            │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  React/Next.js App   │  │  Service Worker                  │ │
│  │  - Submit Forms      │  │  - Background Sync               │ │
│  │  - Offline UI        │  │  - Push Notifications            │ │
│  │  - Install Prompt    │  │  - Cache Management              │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  IndexedDB (Local Storage)                               │   │
│  │  - Last 10 reports per tenant                            │   │
│  │  - Sync queue                                            │   │
│  │  - User preferences                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
                    (HTTPS, Network-aware)
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│              API GATEWAY / LOAD BALANCER                         │
│  - Route by subdomain (bhbc.reportapp.com → tenant bhbc)       │
│  - SSL/TLS termination                                          │
│  - Rate limiting                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND APPLICATION LAYER                           │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Express.js Servers  │  │  Job Queue (Bull/Redis)          │ │
│  │  - Auth endpoints    │  │  - Transcription jobs            │ │
│  │  - Report endpoints  │  │  - Image description jobs        │ │
│  │  - Admin endpoints   │  │  - Email notifications           │ │
│  │  - Sync endpoint     │  │  - Weekly reminders              │ │
│  │  - Tenant context    │  │  - Quarterly compilation         │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        ↕                          ↕                         ↕
┌──────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│  Global Database │  │ Per-Tenant Databases│  │   External APIs  │
│  (PostgreSQL)    │  │  (PostgreSQL)       │  │  - Google Gemma 4│
│  - Tenants       │  │  - Users            │  │  - SendGrid      │
│  - Users         │  │  - Reports          │  │  - Web Push      │
│  - Billing       │  │  - Settings         │  │  - Stripe        │
│  - Audit logs    │  │  - Quarterly comps  │  │                  │
└──────────────────┘  └────────────────────┘  └──────────────────┘
        ↕                    ↕
┌──────────────────────────────────────────┐
│     File Storage (S3 or Supabase)         │
│  - User-uploaded images                  │
│  - Audio files                           │
│  - Generated PDFs/Word docs              │
└──────────────────────────────────────────┘
```

### 1.2 Request Flow (High-Level)

```
1. Client (PWA on device)
   ├─ Online → Request sent to API
   └─ Offline → Request queued in IndexedDB

2. API Gateway (Load Balancer)
   └─ Extract subdomain → Determine tenant ID

3. Tenant Middleware
   └─ Validate user access to tenant
   └─ Connect to tenant's database
   └─ Set req.tenant, req.db context

4. Route Handler
   ├─ Simple requests: Query tenant DB → Return response
   ├─ Heavy tasks: Queue job (Bull) → Return status
   └─ Sync requests: Batch merge local/server data

5. Background Jobs (Bull Queue)
   ├─ Transcription (Gemma 4 API)
   ├─ Image captioning (Gemma 4 API)
   ├─ Quarterly compilation (AI summarization)
   └─ Email notifications

6. Response
   ├─ Store in IndexedDB (client)
   └─ Update UI
```

---

## 2. MULTI-TENANT DATABASE ARCHITECTURE

### 2.1 Database Topology Decision Tree

```
Question: How to isolate tenant data?

├─ Option A: Shared Database (Row-Level Security)
│  ├─ Pros: Simpler infrastructure, cost-effective
│  ├─ Cons: Complex RLS policies, subtle isolation bugs, compliance risk
│  └─ Use Case: High-trust, cost-sensitive SaaS
│
├─ Option B: Separate Schema per Tenant (Shared DB)
│  ├─ Pros: Better isolation than RLS, simpler than separate DBs
│  ├─ Cons: Still shared infrastructure, backup complexity
│  └─ Use Case: Medium-security SaaS (typical SaaS model)
│
└─ Option C: Separate Database per Tenant (CHOSEN)
   ├─ Pros: Maximum isolation, privacy-first, simpler backup/restore
   ├─ Cons: Higher infrastructure cost, connection management complexity
   └─ Use Case: Privacy-critical, compliance-heavy, zero-knowledge SaaS
   
CHOSEN: Option C (Separate Database per Tenant)
RATIONALE: "Privacy First" requirement + GDPR compliance + customer trust
```

### 2.2 Database Connection Architecture

**Problem:** Express server needs to connect to N different databases (one per active tenant)

**Solution:** Connection Pool Manager with Lazy Initialization

```javascript
// backend/db/connectionPool.js
import { Pool } from 'pg';

class TenantConnectionPool {
  constructor() {
    this.pools = new Map(); // tenantId → PG.Pool
  }
  
  async getPool(tenantId) {
    // Check if pool already exists
    if (this.pools.has(tenantId)) {
      return this.pools.get(tenantId);
    }
    
    // Fetch connection string from global DB
    const globalDB = getGlobalConnection();
    const tenant = await globalDB.query(
      'SELECT database_url FROM tenants WHERE id = ?',
      [tenantId]
    );
    
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    // Create new connection pool
    const pool = new Pool({
      connectionString: tenant.database_url,
      max: 20, // Connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test connection
    const client = await pool.connect();
    client.release();
    
    // Store in cache
    this.pools.set(tenantId, pool);
    
    // Auto-cleanup after 1 hour of inactivity
    setTimeout(() => {
      pool.end();
      this.pools.delete(tenantId);
    }, 60 * 60 * 1000);
    
    return pool;
  }
  
  async closeAll() {
    for (const [tenantId, pool] of this.pools) {
      await pool.end();
      this.pools.delete(tenantId);
    }
  }
}

export const tenantConnectionPool = new TenantConnectionPool();
```

**Usage in Express Middleware:**

```javascript
// backend/middleware/tenantContext.js
import { tenantConnectionPool } from '../db/connectionPool';

export const tenantContextMiddleware = async (req, res, next) => {
  const tenantId = extractTenantId(req); // From subdomain or header
  
  // Verify user access in global DB
  const globalDB = getGlobalConnection();
  const membership = await globalDB.query(
    'SELECT * FROM user_tenant_memberships WHERE user_id = ? AND tenant_id = ?',
    [req.user.id, tenantId]
  );
  
  if (!membership) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  // Get tenant's database pool
  const pool = await tenantConnectionPool.getPool(tenantId);
  
  // Create query client from pool
  const client = await pool.connect();
  
  // Attach to request
  req.tenant = { id: tenantId };
  req.db = {
    query: (sql, params) => client.query(sql, params),
    end: () => client.release(),
  };
  
  // Clean up on response
  res.on('finish', () => {
    client.release();
  });
  
  next();
};
```

### 2.3 Database Provisioning (Automated)

**When a new tenant signs up:**

```javascript
// backend/services/tenantService.js
import axios from 'axios';

export const createTenant = async (tenantData) => {
  const { slug, name, email } = tenantData;
  
  // Step 1: Provision database via Render/Railway API
  const dbResponse = await axios.post(
    'https://api.render.com/v1/services',
    {
      type: 'pserv',
      name: `reportapp_${slug}`,
      plan: 'starter',
      region: 'us-east-1',
      database: {
        engine: 'postgresql',
        version: '14',
      },
    },
    {
      headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}` }
    }
  );
  
  const databaseUrl = dbResponse.data.databaseUrl;
  
  // Step 2: Run migrations on new database
  await runPrismaMigrations(databaseUrl);
  
  // Step 3: Store tenant in global DB
  const globalDB = getGlobalConnection();
  const tenant = await globalDB.query(
    `INSERT INTO tenants (id, slug, name, domain, database_url, subscription_tier, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     RETURNING *`,
    [generateId(), slug, name, `${slug}.reportapp.com`, databaseUrl, 'free']
  );
  
  // Step 4: Create first admin user in tenant DB
  const tenantDB = await tenantConnectionPool.getPool(tenant.id);
  await tenantDB.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, 'ADMIN', NOW())`,
    [generateId(), tenant.id, name, email, hashPassword(password)]
  );
  
  // Step 5: Store user-tenant membership in global DB
  await globalDB.query(
    `INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
     VALUES (?, ?, 'admin')`,
    [user.id, tenant.id]
  );
  
  return tenant;
};
```

### 2.4 Global Database Schema (Detailed)

```sql
-- Global Database (Shared across platform)
-- Never stores tenant-specific operational data

CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,           -- URL-safe identifier
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE,                 -- e.g., bhbc.reportapp.com
  database_url TEXT NOT NULL,                 -- Connection string to tenant's isolated DB
  
  -- Subscription
  subscription_tier VARCHAR(50) DEFAULT 'free',
  trial_expires_at TIMESTAMP,
  trial_used BOOLEAN DEFAULT FALSE,
  
  -- Organization customization
  logo_url VARCHAR(500),
  brand_color VARCHAR(7) DEFAULT '#007bff',   -- Hex color
  subunit_names JSONB DEFAULT '["Subunit 1", "Subunit 2"]',
  
  -- Settings
  weekly_reminder_enabled BOOLEAN DEFAULT TRUE,
  reminder_day VARCHAR(50) DEFAULT 'monday',
  reminder_hour INT DEFAULT 9,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  INDEX idx_slug (slug),
  INDEX idx_domain (domain),
  INDEX idx_created (created_at)
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_email (email)
);

CREATE TABLE user_tenant_memberships (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  role VARCHAR(50),           -- Admin role in this platform
  joined_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, tenant_id),
  INDEX idx_user (user_id),
  INDEX idx_tenant (tenant_id)
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  
  plan VARCHAR(50),           -- 'free', 'pro', 'enterprise'
  max_users INT,
  max_reports_per_month INT,
  max_offline_cache_reports INT,
  
  features JSONB,             -- e.g., ["offline_sync", "push_notifications"]
  
  billing_period_start TIMESTAMP,
  billing_period_end TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  
  role VARCHAR(50) DEFAULT 'subunit_head',
  subunit VARCHAR(255),
  
  invited_by UUID NOT NULL REFERENCES users(id),
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_token (token),
  INDEX idx_email (email),
  INDEX idx_tenant (tenant_id)
);

CREATE TABLE global_audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  
  action VARCHAR(100),         -- e.g., 'tenant_created', 'user_invited'
  details JSONB,
  ip_address INET,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
);

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,        -- tenant's user ID (can't FK across DBs)
  
  subscription_json JSONB NOT NULL,  -- Serialized PushSubscription
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, user_id),
  INDEX idx_tenant_user (tenant_id, user_id)
);
```

### 2.5 Per-Tenant Database Schema (Detailed)

```sql
-- Per-Tenant Database (Isolated, separate instance per organization)

CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,        -- For audit/queries (FK to global DB)
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL,            -- Unique within tenant
  password_hash VARCHAR(255),
  role VARCHAR(50) DEFAULT 'SUBUNIT_HEAD',
  subunit VARCHAR(255),
  
  -- PWA & Notifications
  push_subscription_id UUID,               -- FK to global_db.push_subscriptions
  notifications_enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(email),
  INDEX idx_role (role),
  INDEX idx_subunit (subunit),
  INDEX idx_created (created_at)
);

CREATE TABLE reports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  tenant_id VARCHAR(255) NOT NULL,        -- Audit trail
  subunit VARCHAR(255),
  report_type VARCHAR(50),                -- 'TEXT', 'VOICE', 'IMAGE'
  
  -- Content
  text_content TEXT,
  image_url VARCHAR(500),                 -- Path/URL to S3
  image_description TEXT,
  audio_url VARCHAR(500),                 -- Path/URL to S3
  
  -- Metadata
  tags VARCHAR[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'DRAFT',     -- 'DRAFT', 'SUBMITTED', 'ARCHIVED'
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- Versioning for sync/conflict detection
  version INT DEFAULT 1,                  -- Incremented on update
  synced_at TIMESTAMP,                    -- Last sync to client
  
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  INDEX idx_user (user_id),
  INDEX idx_subunit (subunit),
  INDEX idx_status (status),
  INDEX idx_submitted (submitted_at),
  INDEX idx_created (created_at),
  INDEX idx_is_deleted (is_deleted)
);

CREATE TABLE deleted_reports (
  id UUID PRIMARY KEY,
  report_id UUID NOT NULL,                -- Original report ID
  user_id UUID NOT NULL REFERENCES users(id),
  
  deleted_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(255),
  reason TEXT,
  
  INDEX idx_user (user_id),
  INDEX idx_deleted (deleted_at)
);

CREATE TABLE quarterly_report_generations (
  id UUID PRIMARY KEY,
  generated_by UUID NOT NULL REFERENCES users(id),
  
  tenant_id VARCHAR(255) NOT NULL,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  subunits VARCHAR[] NOT NULL,
  
  -- Report content
  report_format VARCHAR[] NOT NULL,       -- ['PDF', 'WORD']
  content TEXT,                           -- Markdown or HTML
  
  -- Metadata
  total_reports_included INT,
  downloaded_at TIMESTAMP,
  downloaded_by VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_generated_by (generated_by),
  INDEX idx_created (created_at)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  type VARCHAR(50),                       -- 'WEEKLY_REMINDER', 'SUBMISSION_CONFIRMATION', etc.
  subject VARCHAR(255),
  body TEXT,
  action_url VARCHAR(500),
  
  sent_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  
  INDEX idx_user (user_id),
  INDEX idx_sent (sent_at),
  INDEX idx_read (read_at)
);

CREATE TABLE settings (
  id UUID PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit table (track all changes)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  
  entity_type VARCHAR(50),                -- 'report', 'user', 'setting'
  entity_id UUID,
  action VARCHAR(50),                     -- 'CREATE', 'UPDATE', 'DELETE'
  
  old_values JSONB,
  new_values JSONB,
  
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
);
```

---

## 3. OFFLINE-FIRST SYNC ARCHITECTURE

### 3.1 IndexedDB Schema (Client-Side)

```javascript
// Each browser tab has per-tenant IndexedDB
// DB Name: reportapp_[tenantId]

const openTenantDatabase = (tenantId) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`reportapp_${tenantId}`, 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Reports store
      if (!db.objectStoreNames.contains('reports')) {
        const reportStore = db.createObjectStore('reports', { keyPath: 'id' });
        reportStore.createIndex('userId', 'userId');
        reportStore.createIndex('status', 'status');
        reportStore.createIndex('submittedAt', 'submittedAt');
        reportStore.createIndex('createdAt', 'createdAt');
      }
      
      // Sync queue (pending operations)
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      
      // Quarterly reports (downloaded PDFs/Word docs)
      if (!db.objectStoreNames.contains('quarterlyReports')) {
        const qrStore = db.createObjectStore('quarterlyReports', { keyPath: 'id' });
        qrStore.createIndex('downloadedAt', 'downloadedAt');
      }
      
      // Sync metadata
      if (!db.objectStoreNames.contains('syncMetadata')) {
        db.createObjectStore('syncMetadata', { keyPath: 'key' });
      }
      
      // User preferences
      if (!db.objectStoreNames.contains('userPreferences')) {
        db.createObjectStore('userPreferences', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Store shapes
const reportSchema = {
  id: 'uuid',
  userId: 'uuid',
  subunit: 'string',
  reportType: 'TEXT|VOICE|IMAGE',
  textContent: 'string | null',
  imageUrl: 'string | null',
  imageDescription: 'string | null',
  audioUrl: 'string | null',
  tags: ['string'],
  status: 'DRAFT|SUBMITTED|SYNCED|CONFLICT',
  version: 'int',
  syncedAt: 'timestamp | null',
  submittedAt: 'timestamp | null',
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  // Conflict tracking
  serverVersion: 'object | null',   // Full server version if conflict
  clientVersion: 'object | null',   // Full client version if conflict
};

const syncQueueItemSchema = {
  id: 'auto-increment',
  action: 'CREATE|UPDATE|DELETE',
  reportId: 'uuid',
  data: 'object',                   // Full report data
  timestamp: 'timestamp',
  retries: 'int',
  lastAttempt: 'timestamp | null',
};

const syncMetadataSchema = {
  key: 'string',                    // e.g., 'lastSyncTime'
  value: 'any',
};

const userPreferencesSchema = {
  key: 'string',                    // e.g., 'maxOfflineCacheReports'
  value: 'any',
};
```

### 3.2 Sync Algorithm (Client-Side)

```javascript
// lib/sync.js
import Dexie from 'dexie';

export class SyncManager {
  constructor(tenantId, userId) {
    this.tenantId = tenantId;
    this.userId = userId;
    this.db = null;
  }
  
  async init() {
    this.db = await openTenantDatabase(this.tenantId);
  }
  
  // Submit online
  async submitReportOnline(reportData) {
    try {
      // Check connectivity
      if (!navigator.onLine) {
        return this.submitReportOffline(reportData);
      }
      
      // POST to server
      const response = await fetch(`/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(reportData)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const serverReport = await response.json();
      
      // Store in IndexedDB with synced status
      const reportForDB = {
        ...serverReport,
        status: 'SYNCED',
        syncedAt: Date.now()
      };
      
      await this.db.reports.put(reportForDB);
      
      return { success: true, report: serverReport };
    } catch (error) {
      console.error('Online submission failed:', error);
      // Fall back to offline
      return this.submitReportOffline(reportData);
    }
  }
  
  // Submit offline
  async submitReportOffline(reportData) {
    // Generate client ID if not exists
    const id = reportData.id || generateUUID();
    
    const report = {
      ...reportData,
      id,
      status: 'DRAFT',        // Not submitted yet
      version: 1,
      syncedAt: null,
      createdAt: Date.now()
    };
    
    // Store in IndexedDB
    await this.db.reports.put(report);
    
    // Queue for sync
    await this.db.syncQueue.add({
      action: 'CREATE',
      reportId: id,
      data: report,
      timestamp: Date.now(),
      retries: 0
    });
    
    return { success: true, report, offline: true };
  }
  
  // Sync pending operations (called when online)
  async syncPendingOperations() {
    if (!navigator.onLine) {
      console.log('Still offline, skipping sync');
      return { synced: 0, failed: 0, conflicts: 0 };
    }
    
    const syncQueue = await this.db.syncQueue.toArray();
    
    if (syncQueue.length === 0) {
      console.log('No pending operations to sync');
      return { synced: 0, failed: 0, conflicts: 0 };
    }
    
    const results = { synced: 0, failed: 0, conflicts: [] };
    
    for (const item of syncQueue) {
      try {
        // Attempt sync
        const response = await this.syncSingleItem(item);
        
        if (response.status === 'success') {
          // Remove from sync queue
          await this.db.syncQueue.delete(item.id);
          results.synced++;
        } else if (response.status === 'conflict') {
          // Handle conflict
          await this.handleConflict(item, response.data);
          results.conflicts.push({
            reportId: item.reportId,
            clientVersion: item.data,
            serverVersion: response.data
          });
        } else if (response.status === 'retry') {
          // Retry later
          item.retries++;
          item.lastAttempt = Date.now();
          
          if (item.retries < 5) {
            await this.db.syncQueue.put(item);
          } else {
            // Max retries exceeded
            await this.db.syncQueue.delete(item.id);
            results.failed++;
          }
        }
      } catch (error) {
        console.error(`Sync failed for item ${item.id}:`, error);
        item.retries++;
        item.lastAttempt = Date.now();
        
        if (item.retries < 5) {
          await this.db.syncQueue.put(item);
        } else {
          await this.db.syncQueue.delete(item.id);
          results.failed++;
        }
      }
    }
    
    // Update last sync time
    await this.db.syncMetadata.put({
      key: 'lastSyncTime',
      value: Date.now()
    });
    
    return results;
  }
  
  async syncSingleItem(item) {
    const method = item.action === 'CREATE' ? 'POST' :
                   item.action === 'UPDATE' ? 'PUT' :
                   'DELETE';
    
    const url = item.action === 'DELETE'
      ? `/api/reports/${item.reportId}`
      : '/api/reports';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: method !== 'DELETE' ? JSON.stringify(item.data) : undefined
    });
    
    if (response.status === 200 || response.status === 201) {
      const serverReport = await response.json();
      return { status: 'success', data: serverReport };
    }
    
    if (response.status === 409) {
      // Conflict: server has newer version
      const serverReport = await response.json();
      return { status: 'conflict', data: serverReport };
    }
    
    if (response.status >= 500) {
      // Server error, retry
      return { status: 'retry' };
    }
    
    // Client error, don't retry
    throw new Error(`HTTP ${response.status}`);
  }
  
  async handleConflict(queueItem, serverVersion) {
    // Mark report as conflicted
    const report = await this.db.reports.get(queueItem.reportId);
    
    report.status = 'CONFLICT';
    report.serverVersion = serverVersion;
    report.clientVersion = queueItem.data;
    
    await this.db.reports.put(report);
    
    // Emit event for UI to show conflict resolution
    window.dispatchEvent(new CustomEvent('report-conflict', {
      detail: { reportId: queueItem.reportId, serverVersion, clientVersion: queueItem.data }
    }));
  }
  
  // User resolves conflict
  async resolveConflict(reportId, resolution) {
    const report = await this.db.reports.get(reportId);
    
    let finalData;
    
    if (resolution === 'keep_local') {
      // Force local version to server
      finalData = report.clientVersion;
    } else if (resolution === 'use_server') {
      // Accept server version
      finalData = report.serverVersion;
    } else if (resolution === 'merge') {
      // Manual merge (simplified: just use local for now)
      finalData = { ...report.serverVersion, ...report.clientVersion };
    }
    
    // Upload final version
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(finalData)
      });
      
      if (response.ok) {
        const updated = await response.json();
        
        // Update local copy
        await this.db.reports.put({
          ...updated,
          status: 'SYNCED',
          syncedAt: Date.now()
        });
        
        return { success: true };
      }
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### 3.3 Service Worker Sync Integration

```javascript
// public/sw.js
import { SyncManager } from '../lib/sync';

const TENANT_ID = '...';  // Injected at build time or stored in IndexedDB
const USER_ID = '...';

let syncManager;

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  self.clients.claim();
});

// Sync when connection restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(performSync());
  }
});

// Listen for online event from client
self.addEventListener('message', (event) => {
  if (event.data.type === 'SYNC_REPORTS') {
    performSync();
  }
});

async function performSync() {
  console.log('Starting background sync...');
  
  const manager = new SyncManager(TENANT_ID, USER_ID);
  await manager.init();
  
  const results = await manager.syncPendingOperations();
  
  console.log('Sync results:', results);
  
  // Notify all clients about sync results
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      results
    });
  });
  
  // Show notification if conflicts
  if (results.conflicts.length > 0) {
    await self.registration.showNotification('Sync Conflict', {
      body: `${results.conflicts.length} report(s) need your attention`,
      tag: 'sync-conflict',
      requireInteraction: true,
      actions: [
        { action: 'resolve', title: 'Resolve' }
      ]
    });
  }
}
```

### 3.4 API Endpoint for Bulk Sync

```javascript
// backend/routes/sync.js
import express from 'express';

const router = express.Router();

// POST /api/sync/reports
// Bulk sync: merge local changes with server state
router.post('/sync/reports', async (req, res) => {
  const { reports, lastSyncTime } = req.body;
  const userId = req.user.id;
  const tenantId = req.tenant.id;
  
  try {
    // Separate by action
    const creates = reports.filter(r => r.action === 'CREATE');
    const updates = reports.filter(r => r.action === 'UPDATE');
    const deletes = reports.filter(r => r.action === 'DELETE');
    
    const results = {
      synced: [],
      conflicts: [],
      errors: []
    };
    
    // Process creates
    for (const item of creates) {
      try {
        const report = await req.db.query(
          `INSERT INTO reports (id, user_id, tenant_id, subunit, report_type, text_content, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'SUBMITTED', NOW(), NOW())
           RETURNING *`,
          [item.id, userId, tenantId, item.subunit, item.reportType, item.textContent]
        );
        
        results.synced.push(report[0]);
      } catch (error) {
        results.errors.push({ id: item.id, error: error.message });
      }
    }
    
    // Process updates
    for (const item of updates) {
      try {
        const serverReport = await req.db.query(
          'SELECT * FROM reports WHERE id = ? AND user_id = ?',
          [item.id, userId]
        );
        
        if (!serverReport || serverReport.length === 0) {
          results.errors.push({ id: item.id, error: 'Report not found' });
          continue;
        }
        
        const server = serverReport[0];
        
        // Check version: if server is newer, conflict
        if (server.version > item.version) {
          results.conflicts.push({
            id: item.id,
            clientVersion: item,
            serverVersion: server
          });
          continue;
        }
        
        // Update
        const updated = await req.db.query(
          `UPDATE reports SET text_content = ?, version = version + 1, updated_at = NOW()
           WHERE id = ? AND user_id = ?
           RETURNING *`,
          [item.textContent, item.id, userId]
        );
        
        results.synced.push(updated[0]);
      } catch (error) {
        results.errors.push({ id: item.id, error: error.message });
      }
    }
    
    // Process deletes
    for (const item of deletes) {
      try {
        await req.db.query(
          `UPDATE reports SET is_deleted = TRUE, deleted_at = NOW()
           WHERE id = ? AND user_id = ?`,
          [item.id, userId]
        );
        
        results.synced.push({ id: item.id, deleted: true });
      } catch (error) {
        results.errors.push({ id: item.id, error: error.message });
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

## 4. PWA & SERVICE WORKER ARCHITECTURE

### 4.1 Service Worker Lifecycle & Caching

```javascript
// public/sw.js - Comprehensive Service Worker

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  static: `static-${CACHE_VERSION}`,
  api: `api-${CACHE_VERSION}`,
  images: `images-${CACHE_VERSION}`,
};

// Install: cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAMES.static).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/offline.html',
        '/icon-192x192.png',
        '/icon-512x512.png',
        '/styles/main.css',
        '/js/app.js'
      ]);
    })
  );
  
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // API calls: Network-first with fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Images: Cache-first with network fallback
  if (/\.(png|jpg|jpeg|svg|webp|gif)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.images));
    return;
  }
  
  // Static assets (JS, CSS): Cache-first
  if (/\.(js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.static));
    return;
  }
  
  // Default: cache-first
  event.respondWith(cacheFirst(request, CACHE_NAMES.static));
});

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAMES.api);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Fall back to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // No cache, return offline page
    return caches.match('/offline.html');
  }
}

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    return caches.match('/offline.html');
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Report App', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  
  if (event.action === 'close') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(data.url || '/');
      }
    })
  );
});
```

### 4.2 Service Worker Registration & Updates

```javascript
// lib/registerServiceWorker.ts (Next.js app initialization)
import { useEffect } from 'react';

export function useServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!('serviceWorker' in navigator)) {
      console.log('Service Workers not supported');
      return;
    }
    
    // Register service worker
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('[App] Service Worker registered:', registration);
      
      // Check for updates periodically
      const checkForUpdates = () => {
        registration.update().then(() => {
          if (registration.waiting) {
            // New version available
            promptUserToRefresh(registration.waiting);
          }
        });
      };
      
      // Check every minute
      setInterval(checkForUpdates, 60000);
      
      // Listen for new service worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version installed
            promptUserToRefresh(newWorker);
          }
        });
      });
    }).catch((error) => {
      console.error('[App] Service Worker registration failed:', error);
    });
    
    // Message from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        handleSyncComplete(event.data.results);
      }
    });
    
  }, []);
}

function promptUserToRefresh(worker) {
  const response = window.confirm(
    'New version available! Refresh to update?'
  );
  
  if (response) {
    worker.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
}

function handleSyncComplete(results) {
  console.log('[App] Sync complete:', results);
  
  // Show toast notification
  if (results.synced > 0) {
    showToast(`${results.synced} report(s) synced`);
  }
  
  if (results.conflicts.length > 0) {
    showToast(`${results.conflicts.length} conflict(s) detected`, 'warning');
  }
  
  // Refresh UI
  window.dispatchEvent(new CustomEvent('reports-updated'));
}
```

---

## 5. DEPLOYMENT & INFRASTRUCTURE

### 5.1 Deployment Architecture (High-Level)

```
┌──────────────────────────────────────────────────────────────┐
│                     INTERNET / USERS                          │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│               Cloudflare CDN (Optional)                        │
│  - Cache static assets                                        │
│  - DDoS protection                                            │
│  - Global edge locations                                      │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│               Load Balancer (AWS ALB / Nginx)                 │
│  - HTTPS termination                                          │
│  - Route by hostname (*.reportapp.com)                        │
│  - Health checks                                              │
└──────────────────────────────────────────────────────────────┘
                    ↙                      ↘
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   Frontend (Vercel/Netlify)  │  │    Backend API (Render/...)  │
│  - Next.js apps              │  │  - Express servers (2-4)     │
│  - Auto-scaling              │  │  - Load balanced             │
│  - Global CDN                │  │  - Auto-scaling              │
└──────────────────────────────┘  └──────────────────────────────┘
                                              ↓
                    ┌─────────────────────────┼─────────────────────────┐
                    ↓                         ↓                         ↓
        ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────┐
        │  Global Database     │  │  Tenant Databases    │  │  File Storage  │
        │  (PostgreSQL)        │  │  (PostgreSQL x N)    │  │  (S3/Supabase) │
        │  - Tenants           │  │  - Auto-provisioned  │  │  - Images      │
        │  - Users             │  │  - Isolated          │  │  - Audio       │
        │  - Billing           │  │  - Per-org backup    │  │  - PDFs/Docs   │
        └──────────────────────┘  └──────────────────────┘  └────────────────┘
                    ↓
        ┌──────────────────────┐
        │   Redis Cluster      │
        │  - Job queue (Bull)  │
        │  - Session cache     │
        │  - Rate limiting     │
        └──────────────────────┘
```

### 5.2 Docker Deployment (Backend)

```dockerfile
# Dockerfile.backend
FROM node:18-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci --only=production

# Prisma
COPY prisma ./prisma
RUN npx prisma generate

# Source code
COPY . .

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml (for local development)
version: '3.9'

services:
  global-db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: reportapp_global
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - global_db_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      DATABASE_URL: postgresql://postgres:password@global-db:5432/reportapp_global
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    ports:
      - "3000:3000"
    depends_on:
      - global-db
      - redis
    volumes:
      - .:/app

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.frontend
    ports:
      - "3001:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000

volumes:
  global_db_data:
```

---

## 6. DATA FLOW DIAGRAMS

### 6.1 Report Submission Flow (Online)

```
User (Browser)                API (Backend)              Tenant DB          External
   │                              │                         │                │
   ├─ Click "Submit"              │                         │                │
   │  (form filled)               │                         │                │
   │                              │                         │                │
   ├─ POST /api/reports ──────────>                         │                │
   │  (JSON body with report)     │                         │                │
   │                              ├─ Verify tenant access   │                │
   │                              │  (check JWT)            │                │
   │                              │                         │                │
   │                              ├─ Validate data          │                │
   │                              │                         │                │
   │                              ├─ INSERT report ────────>                 │
   │                              │                    (200) │                │
   │                              │                         │                │
   │                    (200) JSON <──────────────────────-┤                │
   │  (report with id,            │                         │                │
   │   createdAt)                 │                         │                │
   │                              ├─ If voice/image:────────────────────────>
   │                              │  Queue transcription/   │                │
   │                              │  description job (Bull)  │                │
   │                              │                         │                │
   ├─ Store in IndexedDB          │                         │                │
   │  (status: SYNCED)            │                         │                │
   │                              │                         │                │
   ├─ Show success toast          │                         │                │
   │                              │                         │                │
   └─ Refresh report list         │                         │                │
```

### 6.2 Report Submission Flow (Offline)

```
User (Browser, Offline)        IndexedDB             [No Network]
   │                              │
   ├─ Click "Submit"              │
   │  (form filled)               │
   │                              │
   ├─ Check navigator.onLine?     │
   │  → FALSE                     │
   │                              │
   ├─ Generate client ID (UUID)   │
   │                              │
   ├─ Add report to IndexedDB ────>
   │  (status: DRAFT)             │
   │                              │
   ├─ Add to syncQueue ───────────>
   │  (action: CREATE,            │
   │   reportId, data)            │
   │                              │
   ├─ Show offline toast          │
   │  "Report saved offline"      │
   │                              │
   └─ Refresh report list         │
      (show cached reports)       │
                                  │
  [Network restored]              │
   │                              │
   ├─ window 'online' event       │
   │                              │
   ├─ Trigger background sync     │
   │                              │
   └─ Service Worker:             │
      Fetch syncQueue items ─────>
      Process each item
      POST /api/sync/reports ───┐
                                └──> API merges with server state
                                     Returns results
      Update IndexedDB ──────────>
      (status: SYNCED)
```

### 6.3 Quarterly Report Generation Flow

```
Admin (Dashboard)              Backend               Tenant DB            Gemma 4 API
   │                              │                     │                    │
   ├─ Click "Generate Report"     │                     │                    │
   │                              │                     │                    │
   ├─ Modal: Select date range,   │                     │                    │
   │  subunits, format            │                     │                    │
   │                              │                     │                    │
   ├─ POST /api/admin/            │                     │                    │
   │  reports/generate-quarterly  │                     │                    │
   │  (dateRange, subunits)       │                     │                    │
   │                              │                     │                    │
   │                    (202) Accepted                   │                    │
   │  "Processing..."             │                     │                    │
   │                              │                     │                    │
   │                              ├─ Validate params    │                    │
   │                              │                     │                    │
   │                              ├─ Query reports ────>│                    │
   │                              │  (WHERE               │                    │
   │                              │   date BETWEEN ...)  │                    │
   │                              │                <─────┤                    │
   │                              │   Reports array      │                    │
   │                              │                     │                    │
   │                              ├─ For each subunit:  │                    │
   │                              │  ├─ Aggregate text  │                    │
   │                              │  ├─ Format AI prompt │                    │
   │                              │  └─ POST to Gemma4 ─────────────────────>│
   │                              │                                           │
   │                              │<──────────────────── AI summary           │
   │                              │                                           │
   │                              ├─ Format into doc    │                    │
   │                              │  (headings, sections)│                    │
   │                              │                     │                    │
   │                              ├─ Generate PDF       │                    │
   │                              │  (pdf-lib)          │                    │
   │                              │                     │                    │
   │                              ├─ Generate Word      │                    │
   │                              │  (docx)             │                    │
   │                              │                     │                    │
   │                              ├─ INSERT quarterly   │                    │
   │                              │  report record ────>│                    │
   │                              │                <─────┤                    │
   │                              │   Report ID         │                    │
   │                              │                     │                    │
   ├─ Notify: "Report Ready" ─────┤                     │                    │
   │  (click to preview/download) │                     │                    │
   │                              │                     │                    │
   └─ Click "Download PDF"        │                     │                    │
      GET /api/admin/             │                     │                    │
      reports/quarterly/ID/       │                     │                    │
      download?format=pdf         │                     │                    │
                                  │                     │                    │
                    (200) PDF Blob │                    │                    │
      (browser downloads file)    │                     │                    │
```

---

## 7. SECURITY ARCHITECTURE

### 7.1 Authentication & Authorization

```
┌─────────────────────────────────────────────────────┐
│         GLOBAL AUTHENTICATION (Platform Level)      │
│                                                     │
│  1. POST /api/auth/signup                          │
│     ├─ Email + password → hash password            │
│     ├─ Create user in global DB                    │
│     ├─ Return JWT (expires: 24h)                   │
│     └─ Return refresh token (expires: 7d)          │
│                                                     │
│  2. POST /api/auth/login                           │
│     ├─ Email + password → verify                   │
│     ├─ Generate JWT + refresh token                │
│     └─ Return both tokens                          │
│                                                     │
│  3. POST /api/auth/refresh                         │
│     ├─ Send refresh token                          │
│     ├─ Verify token signature                      │
│     └─ Issue new JWT                               │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│     TENANT-LEVEL AUTHORIZATION (Middleware)        │
│                                                     │
│  For each request:                                  │
│  1. Extract JWT from Authorization header          │
│  2. Verify JWT signature (HS256 or RS256)          │
│  3. Decode JWT → get user.id                       │
│  4. Extract tenant from subdomain/header           │
│  5. Query global DB:                               │
│     SELECT * FROM user_tenant_memberships          │
│     WHERE user_id = ? AND tenant_id = ?            │
│  6. If not found → 403 Forbidden                   │
│  7. If found → set req.tenant, req.user, req.db    │
│  8. Allow request to proceed                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│    ROLE-BASED ACCESS CONTROL (Per-Tenant)          │
│                                                     │
│  Routes have role guards:                           │
│  - GET /api/reports → "SUBUNIT_HEAD"               │
│  - POST /api/users/invite → "ADMIN"                │
│  - GET /api/admin/analytics → "ADMIN"              │
│                                                     │
│  Middleware checks user.role before handler        │
└─────────────────────────────────────────────────────┘
```

### 7.2 Token Storage & Refresh Strategy

```javascript
// lib/auth.ts - Secure token management

export class AuthManager {
  // Store tokens securely
  setTokens(accessToken, refreshToken) {
    // Access token: HTTP-only cookie (no JS access)
    document.cookie = `accessToken=${accessToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
    
    // Refresh token: HTTP-only cookie
    document.cookie = `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
  }
  
  // Auto-refresh access token before expiry
  startTokenRefresh() {
    // Refresh 1 minute before expiry
    const expiresIn = 24 * 60 * 60 * 1000; // 24h
    const refreshIn = expiresIn - (1 * 60 * 1000);
    
    setInterval(async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include' // Include cookies
        });
        
        if (response.ok) {
          const { accessToken } = await response.json();
          document.cookie = `accessToken=${accessToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Redirect to login
        window.location.href = '/login';
      }
    }, refreshIn);
  }
}
```

---

## 8. SCALABILITY & PERFORMANCE

### 8.1 Performance Targets

```
Metric                    Target        How to Achieve
─────────────────────────────────────────────────────────
API Response Time (p95)   <200ms        ├─ Database indexing
                                        ├─ Query optimization
                                        ├─ Connection pooling
                                        └─ Redis caching

Offline Sync Time         <5s           ├─ Batch sync operations
                                        ├─ Efficient conflict detection
                                        └─ Async processing

Page Load Time (LCP)      <2.5s         ├─ Code splitting
                                        ├─ Image optimization
                                        ├─ Service worker caching
                                        └─ CDN delivery

Database Query Time       <100ms (p95)  ├─ Composite indexes
                                        ├─ Query analysis/optimization
                                        └─ Query result caching

Concurrent Users (1 tenant)<500         ├─ Connection pooling (max 20/user)
                                        ├─ Load balancing
                                        └─ Horizontal scaling
```

### 8.2 Database Optimization

```sql
-- Essential indexes for common queries

-- User queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Report queries
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_subunit_submitted ON reports(subunit, submitted_at);
CREATE INDEX idx_reports_status_created ON reports(status, created_at);
CREATE INDEX idx_reports_is_deleted ON reports(is_deleted);

-- Audit queries
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user_created ON audit_log(user_id, created_at);
```

### 8.3 Horizontal Scaling (Backend)

```
Scenario: Single Express server at 80% CPU utilization

┌─────────────────┐
│  Load Balancer  │ (Route by request)
└────────┬────────┘
         │
    ┌────┼────┬──────┐
    ↓    ↓    ↓      ↓
   API  API  API    API
   [1]  [2]  [3]   [4]
    │    │    │      │
    └────┼────┼──────┘
         ↓    ↓
    Redis Cluster (shared)
    Connection Pooling to Tenant DBs
```

**Deployment with Docker Compose / Kubernetes:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reportapp-api
spec:
  replicas: 3  # Start with 3, auto-scale to 5
  selector:
    matchLabels:
      app: reportapp-api
  template:
    metadata:
      labels:
        app: reportapp-api
    spec:
      containers:
      - name: api
        image: reportapp:api-latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: global-url
        - name: REDIS_URL
          value: redis://redis-cluster:6379
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: reportapp-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: reportapp-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## 9. ERROR HANDLING & RESILIENCE

### 9.1 Common Error Scenarios

| Scenario | Client Behavior | Recovery Strategy |
|----------|---|---|
| **Network loss during submit** | Queue in IndexedDB | Auto-retry when online |
| **API timeout** | Show retry prompt | Exponential backoff, max 5 retries |
| **Conflict on sync** | Show conflict UI | User chooses: keep local or use server |
| **Server error (500)** | Retry queue | Max 5 retries, then manual review |
| **Database connection pool full** | API returns 503 | Client waits, then retries |
| **Tenant DB down** | API returns 503 | Automatic failover (if replicas available) |
| **Service worker registration fails** | App works online only | User sees warning banner |
| **IndexedDB full** | Can't cache more reports | Show cleanup UI, delete old reports |

### 9.2 Resilience Patterns

```javascript
// Exponential backoff retry logic
async function retryWithBackoff(fn, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Graceful degradation
async function getReportWithFallback(reportId) {
  try {
    // Try server
    return await fetch(`/api/reports/${reportId}`);
  } catch (error) {
    // Fall back to cached version
    const db = await openTenantDatabase(tenantId);
    const cached = await db.reports.get(reportId);
    
    if (cached) {
      return cached; // Return stale data
    } else {
      throw new Error('Report not found locally or online');
    }
  }
}

// Circuit breaker pattern (for external APIs like Gemma 4)
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Usage
const gemmaBreaker = new CircuitBreaker(3, 60000);

async function transcribeAudio(audioFile) {
  return gemmaBreaker.call(async () => {
    const response = await fetch('/api/reports/transcribe', {
      method: 'POST',
      body: audioFile
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}
```

---

**End of Technical Architecture Document**

This document provides the detailed implementation patterns, database topology, and architectural decisions for the multi-tenant, PWA-based report management platform.
