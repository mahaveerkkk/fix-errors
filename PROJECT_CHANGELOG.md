# StylQ Salon App - Maintenance & Change Log

> **Note**: This file tracks all bug investigations, fixes, file modifications, and feature additions across the project. No changes are applied without full documentation here.

---

## 📋 Project Rules & Setup
1. **Local System Isolation**: No libraries, tools, or dependencies will be installed locally. Testing, building, and APK generation will happen via GitHub CI/CD only.
2. **Untouchable Directory**: The `full-pro-main` folder must never be opened, inspected, or modified.
3. **Release Keys & Configs Verification**:
   - `android/app/google-services.json` matches `~/Downloads/google-services.json` (SHA-256 / 3,333 bytes verified).
   - `android/app/my-release-key.jks` matches `~/Downloads/my-release-key.jks` (2,772 bytes verified).

---

## 📌 Issue #1: Salon Side Shop Status & Queue Modal Popup (Investigation)

### Description:
When the salon shop is open with customers in the queue (e.g. 9 active customers), interacting with the shop status toggle triggered the modal:
> **"Active Customers in Queue"**  
> *"You cannot close the shop while customers are being served or waiting. Please complete or cancel all bookings first."*

### Detailed Root Cause Analysis:

#### 1. Why 9 Customers showed in Queue (`activeCustomerCount = 9`):
- In the MongoDB database, there are 9 active bookings matching:
  ```javascript
  Booking.countDocuments({
      salonId,
      status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
  });
  ```
- In `src/screens/SalonDashboardScreen.js` and `src/screens/SalonLiveMode.js`:
  - When shop status toggle is triggered, if a close request is made, the backend returns:
    `"Cannot close shop. You have 9 active customer(s) in queue. Complete or cancel all bookings first."`
  - The frontend captures this with regex `error.message?.match(/(\d+)\s*active/)` and sets `activeCustomerCount` to `9`.

#### 2. Why this Close-Shop modal appeared when opening / when shop is open:
- **Button State Inversion / Misleading Tap Action**:
  - In `src/screens/SalonLiveMode.js`, the top-right button displays `OPEN` (when shop is open).
  - Tapping it executes `handleToggleShop`, which does:
    ```javascript
    const newStatus = shopStatus === 'open' ? 'closed' : 'open';
    ```
    Since the shop was already open, it sends `newStatus = 'closed'`.
  - In `SalonDashboardScreen.js`, if `isShopOpen` is already true, clicking the toggle attempts to switch to `closed`.
- **Catch Block Triggers Modal on ANY Error**:
  - In both `SalonDashboardScreen.js` and `SalonLiveMode.js`:
    ```javascript
    } catch (error) {
        const match = error.message?.match(/(\d+)\s*active/);
        setActiveCustomerCount(match ? parseInt(match[1]) : 0);
        setCloseBlockedModal(true); // Always opened!
    }
    ```
    Even if the action was meant to open the shop or if a backend 500 error occurred, the catch block blindly showed the `closeBlockedModal` with the queue count.
- **Backend Missing Variable Extraction**:
  - In `backend/controllers/salonController.js` inside `exports.toggleStatus`, `const { salonId, status } = req.body;` was missing, causing reference errors on status update requests.

### Files Involved:
- `backend/controllers/salonController.js`
- `src/screens/SalonDashboardScreen.js`
- `src/screens/SalonLiveMode.js`

### Implemented Fixes:
1. **Backend Controller (`backend/controllers/salonController.js` - line 831)**:
   - Added `const { salonId, status } = req.body;` with null-check validation at the top of `exports.toggleStatus`.
   - Prevents `ReferenceError: status is not defined` when status toggling occurs.

2. **Dashboard UI (`src/screens/SalonDashboardScreen.js` - lines 376-425)**:
   - Modified `handleToggleShop` to accept an explicit `targetStatus` parameter (`'open'` / `'closed'`).
   - Added explicit confirmation dialog (`Alert.alert("Close Shop?", ...)`) before closing to prevent accidental taps.
   - Updated `catch` block so `closeBlockedModal` ("Active Customers in Queue") is ONLY triggered when `newStatus === 'closed'` and the error is actually due to active customers in queue. General errors and open-shop errors now show normal user-friendly error alerts.

3. **Live Mode UI (`src/screens/SalonLiveMode.js` - lines 53, 244-249, 308-350)**:
   - Fixed initial `shopStatus` to read from `route.params.salon?.status` rather than hardcoding `'open'`.
   - Updated `fetchSalon` to synchronize `shopStatus` when live salon data loads from the API.
   - Added confirmation dialog (`Alert.alert("Close Shop?", ...)`) on the header status button before closing.
   - Protected `catch` block so `closeBlockedModal` is only shown when intentionally closing and blocked by active bookings.

### Status:
- **FIXED & LOGGED**

---

## 📌 Issue #2: GitHub CI/CD Build Prevention (`google-services.json` in `.gitignore`)

### Description:
The `.gitignore` file contained an un-scoped `google-services.json` ignore rule, which prevented `android/app/google-services.json` from being committed to Git. When pushing to GitHub to build the APK via `.github/workflows/android.yml`, the build would fail with `File google-services.json is missing`.

### Files Involved:
- `.gitignore` (line 79)

### Implemented Fix:
- Added `!android/app/google-services.json` exception in `.gitignore` so that the verified release google services configuration is properly pushed to GitHub for automated APK / AAB compilation.

### Status:
- **FIXED & LOGGED**

---

## 📌 Feature #3: Daily Midnight Queue Reset & Walk-in Auto-Cleanup Cron

### Description:
Implemented an automated end-of-day cron job that cancels unserved walk-in tokens and stale queue bookings created on or before that day, preventing "ghost queues" from accumulating across days. Salons start fresh every morning with 0 queued walk-ins.

### Files Involved:
- `backend/services/schedulerService.js` (lines 178-256)

### Implementation Details:
- Scheduled at **11:59 PM IST** (`29 18 * * *` UTC) every night.
- Auto-updates unserved queue/walk-in bookings (`isWalkIn: true` or `bookingType: 'queue'`) to `status: 'cancelled'`, with `cancellationReason: 'Auto-expired at end of day (unserved queue/walk-in)'`.
- Recalculates and updates `liveQueueCount` for all active salons in MongoDB.
- Resets expired break states and clears staff queue counts.
- Emits real-time `queueUpdate` socket event (`action: 'midnight_reset'`) to update connected clients.

### Status:
- **IMPLEMENTED & LOGGED**

---

## 📌 Feature #4: Live Screen Socket Auto-Recovery & Connectivity Indicator

### Description:
Enhanced the Salon Live Mode real-time communication layer with auto-reconnection parameters, network status recovery handlers, and header visual indicators.

### Files Involved:
- `src/screens/SalonLiveMode.js` (lines 56, 189-232, 396-410)

### Implementation Details:
- Configured `io(SOCKET_URL)` with resilient parameters: `reconnection: true`, `reconnectionAttempts: Infinity`, `reconnectionDelay: 1000`.
- Added listeners for `reconnect` and `connect` events to immediately re-emit `joinRoom(salonId)` and trigger `fetchQueue()` after temporary network interruptions.
- Added connection listeners for `disconnect` and `connect_error` updating `isSocketConnected`.
- Added header connectivity indicators: Green pulsing dot for "LIVE SALON" and amber indicator for "RECONNECTING... (Restoring live connection...)".

### Status:
- **IMPLEMENTED & LOGGED**

---

## 📌 Feature #5: In-App Digital Receipt & 1-Tap WhatsApp Bill Share (User Side)

### Description:
Built a digital service invoice/receipt system for users on `UserBookingsScreen.js` for completed bookings, with zero database storage overhead (dynamically generated on-the-fly).

### Files Involved:
- `src/screens/UserBookingsScreen.js` (lines 2, 25-28, 48-102, 375-392, 530-638, 903-918, 1010-1175)

### Implementation Details:
- Added a green-pill action button: **"View Bill / Share on WhatsApp"** on every completed booking card.
- Implemented an in-app **Receipt Modal** displaying:
  - Salon name, address, and booking token/ID.
  - Itemized list of services rendered with duration and individual pricing.
  - Total amount paid and payment badge (Paid Online / Paid at Counter).
- Implemented a 1-Tap **"Share on WhatsApp"** button:
  - Dynamically builds a formatted receipt string (`generateReceiptText`).
  - Launches WhatsApp directly via `whatsapp://send?text=...`.
  - Includes graceful fallback to native `Share.share()` if WhatsApp is not installed.
- **Zero Database Storage**: No extra database collections created; generated purely from existing `Booking` model data.

### Status:
- **IMPLEMENTED & LOGGED**

---

## 📌 Feature #6: Automated GitHub Actions CI/CD for Signed Release APK & Play Store AAB

### Description:
Created `.github/workflows/android.yml` to automatically build production-ready Signed Release APKs (for direct phone install) AND Android App Bundles (`.aab` for Google Play Console upload) on GitHub Actions upon push or pull request to `main`/`master`, or via manual workflow dispatch.

### Files Involved:
- `.github/workflows/android.yml` [UPDATED]
- `.gitignore` (lines 35-37) - Explicitly allowed tracking of `android/app/my-release-key.jks` alongside `android/app/google-services.json` so no files need manual attaching on GitHub.

### Implementation Details:
- **Build Targets**: 
  - `assembleRelease`: Signed APK for direct device installation & testing.
  - `bundleRelease`: Signed `.aab` (Android App Bundle) required by Google Play Store Console.
- **Dependencies**: Uses Node.js 20, Java 17 (Temurin), and official Android SDK action.
- **Embedded Keys & Services**: Verifies existence of `android/app/google-services.json` and `android/app/my-release-key.jks` in the repository before building.
- **Artifact Upload**: 
  - `smart-salon-release-apk`: Uploads generated Release APKs.
  - `smart-salon-playstore-aab`: Uploads generated Release `.aab` for Play Store.

### Status:
- **IMPLEMENTED & LOGGED**

---

## 📌 Feature #7: StylQ Secret Backup Audit & Environment Configuration Restoration

### Description:
Audited `/home/veer/Music/StylQ_Secret_Backup` and compared all backup credentials against the current project. Restored critical backend environment variables (`.env`) that were missing from `salon-main-main`.

### Findings & File Comparisons:
1. **`.env` (CRITICAL FIX)**:
   - `salon-main-main/backend/` had NO `.env` file! Without it, backend fell back to local MongoDB (`127.0.0.1:27017`), Firebase Admin SDK crashed (no push notifications / auth token check), Cloudinary failed (no photo uploads), and Razorpay payments failed.
   - Restored `.env` from backup to `salon-main-main/backend/.env` and `salon-main-main/.env`.
   - Contains: MongoDB Atlas cluster URI, Firebase Service Account private key/client email, Cloudinary credentials, and Razorpay API keys.
2. **`google-services.json`**:
   - Compared line-by-line with `android/app/google-services.json`. 100% identical configuration (package `Salon.Mahaveer.com`, project `salon-bf846`).
3. **`gradle.properties`**:
   - 100% byte-for-byte identical match (`MYAPP_UPLOAD_KEY_ALIAS=my-key-alias`, passwords configured).
4. **`my-release-key.jks`**:
   - 100% byte-for-byte identical binary match (2,772 bytes).

### Status:
- **RESTORED, AUDITED & LOGGED**
