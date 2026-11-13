# StylQ Backend API (main-backend)

Salon Management Operating System API powered by Node.js, Express, MongoDB, and Socket.io.

---

## 🚀 1-Click Docker Deployment (VPS / Cloud)

Deploy immediately on any VPS (AWS, DigitalOcean, Hetzner, etc.):

```bash
# Clone the repository
git clone https://github.com/veermonee/main-backend.git
cd main-backend

# Start Backend + MongoDB in background
docker compose up -d --build
```

### Useful Docker Commands:
- Check container status: `docker compose ps`
- View live logs: `docker compose logs -f backend`
- Stop containers: `docker compose down`
- Restart backend: `docker compose restart backend`

---

## 🛠️ Manual Run (Without Docker)

1. **Install dependencies:**
   ```bash
   npm install --omit=dev
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Update your MONGO_URI, JWT_SECRET, and RAZORPAY credentials in .env
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   API runs by default on `http://localhost:5000`.

---

## 📡 API Core Routes
- `POST /api/auth/*` - User & Owner Authentication
- `POST /api/salons/*` - Salon Operations & 1-Click Walk-ins
- `POST /api/payment/*` - Razorpay Subscriptions & Verification
- `POST /api/wallet/*` - StylQ Wallet & Payout Requests
- `POST /api/referral/*` - VIP Partner Referral Rewards
- `GET /` - Health check endpoint
