# Routing Logic — Analytics Dashboard

This document describes how in-app navigation (routing) works after the user signs in. The app uses **hash-based routing** with **role-based access**: the URL fragment (`#dashboard`, `#reports`, etc.) determines which view is shown, and the current user role can override or redirect certain routes.

---

## 1. Overview

| Aspect | Detail |
|--------|--------|
| **Type** | Client-side, hash-based SPA routing |
| **Source of truth** | `window.location.hash` (e.g. `#dashboard`) |
| **Trigger** | Link clicks (`<a href="#dashboard">`) or manual URL change |
| **Initialization** | Once per session, when the user is authenticated |

There is **no** separate router library. Routing is implemented in `public/js/app.js` with three main pieces:

1. **`getRoute()`** — Reads the hash and applies role-based overrides.
2. **`showView(route)`** — Shows the correct section, updates nav and title, and loads data for that view.
3. **`initRouting()`** — Registers the `hashchange` listener and runs the first `showView(getRoute())`.

---

## 2. Route Names and URLs

| Route name   | URL fragment   | Section ID      | Who can access        |
|-------------|----------------|-----------------|------------------------|
| `dashboard` | `#dashboard`   | `#view-dashboard` | All (owner, manager, admin) |
| `reports`   | `#reports`     | `#view-reports`   | All                    |
| `data-entry`| `#data-entry`  | `#view-data-entry`| Manager, Admin only   |
| `users`     | `#users`       | `#view-users`     | Admin only            |

- **Default route** when the hash is missing or empty: `dashboard`.
- **Invalid or unauthorized** hashes are normalized to a valid route (see Role-based overrides below).

---

## 3. `getRoute()` — Resolving the Current Route

**Location:** `app.js` (Routing section)

**Purpose:** Map the current URL hash (and user role) to a single route name that the app will display.

**Logic:**

```
1. Read hash from URL
   hash = window.location.hash.slice(1)   // "#dashboard" → "dashboard"
   If hash is empty → use "dashboard"

2. Role-based overrides (cannot open a route without permission)
   If hash === "users"     AND userRole !== "admin"   → use "dashboard"
   If hash === "data-entry" AND userRole === "owner"  → use "dashboard"

3. Return the resolved route name (string)
```

**Example:**

| URL                | userRole | getRoute() returns |
|--------------------|----------|--------------------|
| `#dashboard`       | any      | `dashboard`        |
| `#reports`         | any      | `reports`          |
| `#data-entry`      | owner    | `dashboard`        |
| `#data-entry`      | manager  | `data-entry`       |
| `#users`          | owner    | `dashboard`        |
| `#users`          | admin    | `users`            |
| `` (no hash)      | any      | `dashboard`        |

**Note:** `userRole` is loaded asynchronously from Firestore (`loadUserRole`). Until it is set, `userRole` is `null`, so conditions like `userRole !== 'admin'` are true and `#users` will resolve to `dashboard` until the role is known.

---

## 4. `showView(route)` — Displaying a View

**Location:** `app.js` (Routing section)

**Purpose:** Show the section for the given route, sync the sidebar, update the page title, and load any data needed for that view.

**Steps:**

1. **Redirect unauthorized routes**
   - If `route === 'users'` and `userRole !== 'admin'`: set `window.location.hash = 'dashboard'`, then set `route = 'dashboard'`.
   - If `route === 'data-entry'` and `userRole === 'owner'`: set `window.location.hash = 'dashboard'`, then set `route = 'dashboard'`.
   - This keeps the URL in sync when the user has no access (e.g. bookmark or manual `#users` as non-admin).

2. **Update which section is visible**
   - All elements with class `.view` get `active` removed.
   - The element with id `view-<route>` (e.g. `view-dashboard`) gets class `active`.
   - CSS uses `.view.active { display: block }` and `.view` without `active` are hidden.

3. **Update sidebar (nav) active state**
   - All `.nav-item` elements get `active` removed.
   - The `.nav-item` with `data-route="<route>"` gets class `active` (highlighted in the sidebar).

4. **Update page title (top bar)**
   - `pageTitle.textContent` is set from a map:
     - `dashboard` → `"Dashboard"`
     - `reports` → `"Reports"`
     - `data-entry` → `"Data Entry"`
     - `users` → `"User Management"`
   - Fallback: `"Dashboard"`.

5. **Load view-specific data**
   - `route === 'dashboard'` → `loadDashboard()` (KPIs + charts).
   - `route === 'reports'` → `loadReports()` (sales summary + top products).
   - `route === 'users'` and `userRole === 'admin'` → `loadUsers()` (users table).

No data loader is called for `data-entry` on navigation; that view only uses forms and existing handlers.

---

## 5. `initRouting()` — One-Time Setup

**Location:** `app.js` (Routing section)

**When it runs:** From `auth.onAuthStateChanged`, when the user is signed in (so the main app is visible).

**Logic:**

```
1. If routingInited is true:
   - Call showView(getRoute()) (e.g. after role refresh).
   - Return (do not add another listener).

2. Set routingInited = true.

3. Add a single hashchange listener:
   window.addEventListener('hashchange', function () {
     showView(getRoute());
   });

4. Run the initial route:
   showView(getRoute());
```

So the **hashchange** listener is registered only once per session. Any later hash change (link click or browser back/forward) triggers `showView(getRoute())`. The guard ensures we don’t attach duplicate listeners if `initRouting()` is called again (e.g. after re-auth).

---

## 6. Role-Based Access Summary

| Route       | Owner | Manager | Admin |
|------------|-------|---------|-------|
| Dashboard  | ✅    | ✅      | ✅    |
| Reports    | ✅    | ✅      | ✅    |
| Data Entry | ❌ → dashboard | ✅ | ✅    |
| User Management | ❌ → dashboard | ❌ → dashboard | ✅ |

- **Owner:** Sees Dashboard and Reports only. Nav items for Data Entry and User Management are hidden (`.role-hidden`). Direct `#data-entry` or `#users` are resolved to `dashboard` by `getRoute()` and, if needed, redirected in `showView()`.
- **Manager:** Sees Dashboard, Reports, and Data Entry. User Management is hidden; `#users` is resolved/redirected to `dashboard`.
- **Admin:** Sees all four routes.

Role is applied in two places:
- **Nav visibility:** `loadUserRole()` in `app.js` adds/removes `role-hidden` on the Data Entry and User Management nav items (and on the dashboard sample-data toolbar) based on `userRole`.
- **Routing:** `getRoute()` and `showView()` enforce the same rules so URL and visible view stay consistent.

---

## 7. HTML Conventions

The routing logic depends on these conventions in `public/index.html`:

| Convention | Purpose |
|------------|--------|
| **Hash links** | `<a href="#dashboard">` etc. Set `location.hash` and fire `hashchange`. |
| **`data-route`** | Each nav link has `data-route="dashboard"` (or `reports`, `data-entry`, `users`) so the router can find the active nav item: `.nav-item[data-route="<route>"]`. |
| **Section ids** | Each main section has id `view-<route>` (e.g. `id="view-dashboard"`). The router shows the section with `id="view-" + route`. |
| **Class `view`** | Every routable section has class `view`. The router removes `active` from all `.view` and adds `active` only to the current one. |
| **Class `active`** | Only one `.view` and one `.nav-item` have `active` at a time. CSS shows the active view and highlights the active nav item. |

**Example nav item:**

```html
<a href="#dashboard" class="nav-item active" data-route="dashboard">
  <span class="nav-icon">◉</span>
  <span>Dashboard</span>
</a>
```

**Example view section:**

```html
<section id="view-dashboard" class="view active">
  <!-- Dashboard content -->
</section>
```

---

## 8. Flow Diagram (High Level)

```
User signs in
    →
onAuthStateChanged
    →
loadUserRole(uid)  [async]
initRouting()
    →
routingInited?
  No → routingInited = true
       addEventListener('hashchange', () => showView(getRoute()))
  → showView(getRoute())
    →
getRoute()
  read hash (default 'dashboard')
  apply role overrides (#users / #data-entry)
  return route
    →
showView(route)
  redirect if unauthorized (update hash, route = 'dashboard')
  deactivate all .view, activate #view-<route>
  deactivate all .nav-item, activate [data-route="<route>"]
  set page title
  call loadDashboard() / loadReports() / loadUsers() if applicable
```

Later:

```
User clicks <a href="#reports"> or changes hash
    →
hashchange event
    →
showView(getRoute())
  (same steps as above)
```

---

## 9. File Reference

| File | Relevant parts |
|------|-----------------|
| `public/js/app.js` | `getRoute()`, `showView()`, `initRouting()`, `loadUserRole()` (nav/toolbar visibility), `routingInited` |
| `public/index.html` | Nav links with `href="#..."` and `data-route`, sections with `id="view-..."` and class `view` |
| `public/css/style.css` | `.view` / `.view.active`, `.nav-item.active`, `.role-hidden`, `.dashboard-toolbar.role-hidden` |

This is the full routing logic and how it’s documented for the Analytics Dashboard.
