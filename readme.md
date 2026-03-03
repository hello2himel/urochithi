# 📬 Urochithi - Anonymous Letters Platform

A beautiful, privacy-focused anonymous letter platform with a vintage paper aesthetic. Built with vanilla HTML, CSS, JavaScript, deployed on Netlify with Neon Auth (Better Auth) authentication, and Neon PostgreSQL for data storage. Supports multiple users.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/hello2himel/urochithi)

---

## ✨ Features

### 📝 Anonymous Letters
- **No login required** to send — completely anonymous
- **Session tracking** — unique session ID per device (no personal data)
- **Character counter** — real-time counter with warnings
- **Auto-save drafts** — messages saved to localStorage
- **Spam protection** — honeypot field catches bots

### 👥 Multi-User Support
- **Multiple users** can sign up and each gets their own letterbox
- **Clean URLs** — share your letterbox at `yourdomain.com/username`
- **Isolated data** — each user only sees their own messages

### 🔐 Neon Auth (Better Auth)
- **Secure login** via Neon Auth with email/password sign-in
- **Session verification** — server-side session validation
- **No more PINs** — replaced the old static + time-based PIN system

### 📊 Dashboard Features
- **Statistics** — total messages, today's count, unique sessions, weekly stats
- **Search & Filter** — find messages by content or session ID
- **Sort options** — newest/oldest first
- **Time filters** — today, this week, this month, or all
- **Real-time refresh** — reload messages anytime
- **CSV Import** — migrate data from the old Google Sheets version
- **CSV Export** — download all your messages as CSV

### 🎨 Beautiful Design
- **Vintage paper aesthetic** — torn edges, grid pattern, paper texture
- **Fully responsive** — works perfectly on mobile and desktop
- **Minimal UI** — clean, distraction-free interface

---

## 🚀 Quick Start

### Prerequisites
- GitHub account (free)
- [Neon](https://neon.tech) account for PostgreSQL and authentication (free tier: 60,000 MAU)
- [Netlify](https://netlify.com) account for hosting (free)

### 1. Fork This Repository
Click the "Fork" button at the top right of this page.

### 2. Set Up Neon Database
1. Create a new project at [Neon Console](https://console.neon.tech)
2. Copy the **Connection String** (starts with `postgresql://...`)
3. That's it — tables are created automatically!

### 3. Enable Neon Auth
1. In your Neon project, navigate to the **Auth** tab
2. Click **Enable Auth** and copy the **Auth URL**
3. That's it — auth data lives in the same Neon database!

### 4. Customize Your Site
Edit `js/config.js`:
```javascript
const CONFIG = {
  username: "your_username",
  siteName: "YOUR SITE NAME",
  siteTagline: "Your tagline here",
  maxMessageLength: 2000,
  onboardingUrl: "/onboard.html",
  siteUrl: "https://your-site.netlify.app",
  neonAuthUrl: "https://your-project-id.auth.neon.tech"
};
```

### 5. Deploy to Netlify
1. Go to [Netlify](https://app.netlify.com)
2. Click **Add new site → Import an existing project**
3. Select your forked repository
4. Click **Deploy**

### 6. Configure Environment Variables
In Netlify, go to **Site configuration → Environment variables** and add:

```
DATABASE_URL = postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
NEON_AUTH_URL = https://your-project-id.auth.neon.tech
```

### 7. Done! 🎉
Visit your dashboard, sign in with email/password, pick a username, and share your letterbox URL!

---

## 📁 Project Structure

```
urochithi/
├── index.html                      # Main landing page
├── dashboard.html                  # Auth-protected dashboard
├── onboard.html                    # Getting started guide for users
├── selfhost.html                   # Detailed self-hosting deployment guide
├── _redirects                      # Netlify rewrites for clean URLs
├── package.json                    # Dependencies (Neon DB)
├── css/
│   ├── styles.css                  # Main styles (paper aesthetic)
│   └── dashboard.css               # Dashboard styles
├── js/
│   ├── config.js                   # Configuration (EDIT THIS!)
│   ├── main.js                     # Main form & submission logic
│   └── dashboard.js                # Auth + dashboard logic
├── netlify/
│   └── functions/
│       ├── submit.js               # Submit messages (public)
│       ├── get-messages.js         # Fetch messages (auth required)
│       ├── register.js             # Register username (auth required)
│       ├── check-user.js           # Check user status (auth required)
│       ├── import-csv.js           # Import CSV data (auth required)
│       ├── export-csv.js           # Export CSV data (auth required)
│       ├── db.js                   # Neon DB connection utility
│       ├── auth.js                 # Neon Auth session verification utility
│       └── rate-limiter.js         # Rate limiting utility
└── readme.md                       # This file
```

---

## 🌐 Environment Variables

Set these in **Netlify → Site configuration → Environment variables**:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `NEON_AUTH_URL` | Yes | Neon Auth URL from the Auth tab | `https://your-project-id.auth.neon.tech` |

---

## 🔄 Migrating from v1 (Google Sheets)

If you were using the previous version with Google Sheets and time-based PINs:

### Import Your Data
1. Open your Google Sheet
2. **File → Download → Comma-separated values (.csv)**
3. Log into your new dashboard
4. Click **📥 Import** → select your CSV → click **Import**
5. All messages are imported with original timestamps!

### Export Your Data
Click **📤 Export** in the dashboard header to download all messages as CSV at any time.

### Old Environment Variables
These are no longer needed and can be removed:
- `GSCRIPT_URL`
- `DASHBOARD_PIN`
- `TIME_PIN_ALGORITHM`
- `RECAPTCHA_SECRET_KEY`

---

## 📊 Data Collection

### What We Collect
- **Timestamp** — when the message was sent
- **Message** — the letter content
- **Session ID** — unique identifier per device/browser (generated client-side)

### What We DON'T Collect
- ❌ Names or emails (of senders)
- ❌ IP addresses
- ❌ GPS coordinates
- ❌ Browser fingerprints
- ❌ Tracking cookies
- ❌ Any personal information

---

## 🎨 Customization

### Change Colors
Edit `css/styles.css` and replace these hex codes:
- `#5d4037` — dark brown (primary text)
- `#8d6e63` — medium brown (buttons, borders)
- `#f4f1e8` — light beige (body background)
- `#faf8f3` — off-white (paper background)

### Change Fonts
In `index.html`, update the Google Fonts link, then update `font-family` in `css/styles.css`.

### Change Message Limit
Edit `js/config.js`:
```javascript
maxMessageLength: 2000  // Change to your desired limit
```

---

## 🔒 Security Features

- ✅ Neon Auth (Better Auth) for dashboard
- ✅ Server-side session verification
- ✅ Per-user data isolation
- ✅ Rate limiting on submissions
- ✅ Honeypot spam protection
- ✅ Input validation and sanitization
- ✅ HTTPS by default (Netlify)
- ✅ Parameterized SQL queries (injection-safe)

---

## 📱 Mobile Support

Fully responsive design with:
- Touch-friendly buttons and inputs
- Optimized layouts for small screens
- Readable fonts on mobile
- Full functionality on all devices

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — feel free to use for personal or commercial projects!

```
MIT License

Copyright (c) 2024 Urochithi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- Inspired by anonymous messaging platforms like NGL and Tellonym
- Font: [Special Elite](https://fonts.google.com/specimen/Special+Elite) by Google Fonts
- Hosted on [Netlify](https://www.netlify.com/)
- Database: [Neon](https://neon.tech/)
- Authentication: [Neon Auth](https://neon.tech/docs/guides/neon-auth) (Better Auth)

---

## 📞 Support

- 🐛 **Bug reports:** [Open an issue](https://github.com/hello2himel/urochithi/issues)
- 💡 **Feature requests:** [Start a discussion](https://github.com/hello2himel/urochithi/discussions)
- 📖 **Documentation:** See `/onboard.html` on your deployed site

---

[Live Demo](https://urochithi.netlify.app) • [Report Bug](https://github.com/hello2himel/urochithi/issues) • [Request Feature](https://github.com/hello2himel/urochithi/issues)

---

Made by [@hello2himel](https://github.com/hello2himel)