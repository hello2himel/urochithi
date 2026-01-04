# 📬 Urochithi - Anonymous Letters Platform

A beautiful, privacy-focused anonymous letter platform with a vintage paper aesthetic. Built with vanilla HTML, CSS, JavaScript, and deployed on Netlify with Google Sheets as the backend.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/hello2himel/urochithi)

---

## ✨ Features

### 📝 Anonymous Letters
- **No login required** - Send messages completely anonymously
- **Session tracking** - Unique session ID per device (no personal data)
- **Character counter** - Real-time counter with warnings
- **Auto-save drafts** - Messages saved to localStorage
- **Spam protection** - Honeypot field catches bots

### 🎨 Beautiful Design
- **Vintage paper aesthetic** - Torn edges, grid pattern, paper texture
- **Fully responsive** - Works perfectly on mobile and desktop
- **Minimal UI** - Clean, distraction-free interface
- **Custom postage stamp** - Link to create your own instance

### 🔐 Secure Dashboard
- **Two-factor authentication**:
  - Static PIN (set by you)
  - Time-based PIN (changes every minute)
- **Session management** - Auto-logout after 30 minutes
- **Protected data access** - All API calls require authentication

### 📊 Dashboard Features
- **Statistics** - Total messages, today's count, unique sessions, weekly stats
- **Search & Filter** - Find messages by content or session ID
- **Sort options** - Newest/oldest first
- **Time filters** - Today, this week, this month, or all
- **Real-time refresh** - Reload messages anytime
- **Clean table view** - Easy to read and manage

---

## 🚀 Quick Start

### Prerequisites
- GitHub account (free)
- Google account (for Google Sheets)
- Netlify account (free, can sign up with GitHub)

### 1. Fork This Repository
Click the "Fork" button at the top right of this page to create your own copy.

### 2. Set Up Google Sheet
1. Create a new [Google Sheet](https://sheets.google.com)
2. Go to **Extensions → Apps Script**
3. Delete any existing code
4. Paste the code from `google-apps-script.js` (see below)
5. Save and deploy as Web App (see detailed instructions below)

### 3. Deploy to Netlify
1. Go to [Netlify](https://app.netlify.com)
2. Click **Add new site → Import an existing project**
3. Connect your GitHub account
4. Select your forked repository
5. Click **Deploy**

### 4. Configure Environment Variables
In Netlify, go to **Site configuration → Environment variables** and add:

```
DASHBOARD_PIN = <yourPassword>
TIME_PIN_ALGORITHM = <See algorithm examples below>
GSCRIPT_URL = <https://script.google.com/macros/s/.../exec>
```

### 5. Customize Your Site
Edit `js/config.js`:
```javascript
const CONFIG = {
  username: "your_username",
  siteName: "YOUR SITE NAME",
  siteTagline: "Your tagline here",
  maxMessageLength: 2000,
  onboardingUrl: "/onboard.html"
};
```

### 6. Done! 🎉
Your site is live! Share your URL and start receiving anonymous messages.

---

## 📁 Project Structure

```
urochithi/
├── index.html                      # Main landing page
├── dashboard.html                  # Protected admin dashboard
├── onboard.html                   # Setup guide for new users
├── css/
│   └── styles.css                 # All styles (paper aesthetic)
├── js/
│   ├── config.js                  # Configuration (EDIT THIS!)
│   └── main.js                    # Main functionality
├── netlify/
│   └── functions/
│       ├── submit.js              # Submit messages
│       ├── get-messages.js        # Fetch messages (auth required)
│       ├── verify-static-pin.js   # Step 1 authentication
│       └── verify-time-pin.js     # Step 2 authentication
└── README.md                      # This file
```

---

## 🔧 Detailed Setup

### Google Apps Script Setup

1. **Open Apps Script Editor**
   - In your Google Sheet: **Extensions → Apps Script**

2. **Paste This Code**

```javascript
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({ messages: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const range = sheet.getRange(2, 1, lastRow - 1, 3);
    const values = range.getValues();
    
    const messages = values.map(row => ({
      timestamp: row[0] ? new Date(row[0]).toISOString() : new Date().toISOString(),
      message: row[1] || "",
      sessionId: row[2] || "unknown"
    }));
    
    return ContentService
      .createTextOutput(JSON.stringify({ messages: messages }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log("Error in doGet: " + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ messages: [], error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSheet();
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Message", "Session ID"]);
      const headerRange = sheet.getRange(1, 1, 1, 3);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f0ede5");
      headerRange.setHorizontalAlignment("center");
      sheet.setColumnWidth(1, 180);
      sheet.setColumnWidth(2, 400);
      sheet.setColumnWidth(3, 200);
    }
    
    const row = [
      data.timestamp || new Date().toISOString(),
      data.message || "",
      data.sessionId || "N/A"
    ];
    
    sheet.appendRow(row);
    
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 2).setWrap(true);
    
    if (lastRow % 2 === 0) {
      sheet.getRange(lastRow, 1, 1, 3).setBackground("#faf8f3");
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log("Error in doPost: " + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. **Deploy as Web App**
   - Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
   - **Copy the deployment URL** - you'll need this!

---

## 🔐 Dashboard Authentication

Your dashboard uses **two-factor authentication** for security:

### Step 1: Static PIN
A password you set in the `DASHBOARD_PIN` environment variable.

Example: `mySecretPassword123`

### Step 2: Time-based PIN
A code that changes every minute, calculated from the current UTC time.

**Example Formula:** `(hour × 7) + (minute % 10)`

**Example at 14:42 UTC:**
```
(14 × 7) + (42 % 10)
= 98 + 4
= 102
```

### Custom Algorithms

You can customize the formula by changing the `TIME_PIN_ALGORITHM` environment variable:

**Simple:**
```
TIME_PIN_ALGORITHM = (hour + minute)
```

**Medium (default):**
```
TIME_PIN_ALGORITHM = (hour * 7) + (minute % 10)
```

**Complex:**
```
TIME_PIN_ALGORITHM = (hour * hour) + (minute * 3)
```

**Variables available:**
- `hour` - Current UTC hour (0-23)
- `minute` - Current UTC minute (0-59)
- Operators: `+`, `-`, `*`, `/`, `%`, `()`

---

## 🌐 Environment Variables

Set these in **Netlify → Site configuration → Environment variables**:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DASHBOARD_PIN` | Yes | Static password for dashboard | `mySecretPass123` |
| `TIME_PIN_ALGORITHM` | Yes | Formula for time-based code | `(hour * 7) + (minute % 10)` |
| `GSCRIPT_URL` | Yes | Google Apps Script deployment URL | `https://script.google.com/...` |

---

## 📊 Data Collection

### What We Collect
- **Timestamp** - When the message was sent
- **Message** - The actual letter content
- **Session ID** - Unique identifier per device/browser (generated client-side)

### What We DON'T Collect
- ❌ Names or emails
- ❌ IP addresses
- ❌ GPS coordinates
- ❌ Browser fingerprints
- ❌ Tracking cookies
- ❌ Any personal information

### Session IDs
- Generated once per device/browser
- Stored in localStorage
- Format: `timestamp-random` (e.g., `lq8x7k9m-a3b4c5d6e`)
- Helps identify messages from the same sender
- No way to trace back to actual identity

---

## 🎨 Customization

### Change Colors
Edit `css/styles.css` and replace these hex codes:
- `#5d4037` - Dark brown (primary text)
- `#8d6e63` - Medium brown (buttons, borders)
- `#f4f1e8` - Light beige (body background)
- `#faf8f3` - Off-white (paper background)

### Change Fonts
In `index.html`, update the Google Fonts link:
```html
<link href="https://fonts.googleapis.com/css2?family=YOUR_FONT&display=swap" rel="stylesheet">
```

Then update font-family in `css/styles.css`.

### Change Message Limit
Edit `js/config.js`:
```javascript
maxMessageLength: 2000  // Change to your desired limit
```

Also update in `netlify/functions/submit.js`:
```javascript
if (!data.message || data.message.length > 2000) {
```

---

## 🔒 Security Features

- ✅ Two-factor authentication for dashboard
- ✅ Time-based PIN changes every minute
- ✅ 3-minute window for clock sync issues
- ✅ Session timeout (30 minutes of inactivity)
- ✅ Server-side PIN verification
- ✅ Honeypot spam protection
- ✅ Input validation and sanitization
- ✅ HTTPS by default (Netlify)
- ✅ No sensitive data in client-side code

---

## 🐛 Troubleshooting

### Messages not being saved

**Check:**
1. `GSCRIPT_URL` is set correctly in Netlify
2. Apps Script is deployed with "Anyone" access
3. Apps Script has both `doGet` and `doPost` functions
4. Browser console for error messages (F12)

**Fix:**
- Redeploy Apps Script
- Update `GSCRIPT_URL` in Netlify
- Trigger new deployment in Netlify

### Dashboard login fails

**Static PIN error:**
- Verify `DASHBOARD_PIN` matches exactly (case-sensitive)
- Check environment variable is set in Netlify

**Time-based PIN error:**
- Use the **UTC time** shown on screen
- Double-check your calculation
- Make sure `TIME_PIN_ALGORITHM` is set correctly
- Try the next minute's code (3-minute window)

### Session expired quickly

**Cause:** 30-minute inactivity timeout

**Fix:** Just log in again with both PINs

---

## 📱 Mobile Support

Fully responsive design with:
- Touch-friendly buttons and inputs
- Optimized layouts for small screens
- Readable fonts on mobile
- Adjusted navigation for mobile
- Full functionality on all devices

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup
```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/urochithi.git
cd urochithi

# Make changes
# Test locally (use a local server for testing)
python -m http.server 8000
# or
npx serve

# Commit and push
git add .
git commit -m "Your changes"
git push
```

---

## 📄 License

MIT License - feel free to use for personal or commercial projects!

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
- Data storage: [Google Sheets](https://www.google.com/sheets/about/)

---

## 📞 Support

- 🐛 **Bug reports:** [Open an issue](https://github.com/hello2himel/urochithi/issues)
- 💡 **Feature requests:** [Start a discussion](https://github.com/hello2himel/urochithi/discussions)
- 📧 **Contact:** Create an issue or discussion
- 📖 **Documentation:** See `/onboard.html` on your deployed site

---

## 🗺️ Roadmap

- [ ] Email notifications for new messages
- [ ] Reply functionality (optional for senders)
- [ ] Message categories/tags
- [ ] Export messages as PDF
- [ ] Custom domain support guide
- [ ] Dark mode toggle
- [ ] Multiple language support
- [ ] Analytics dashboard enhancements
- [ ] Message moderation tools
- [ ] Batch operations in dashboard

---

## ⭐ Show Your Support

If you found this helpful:
- ⭐ Star this repository
- 🍴 Fork it for your own project
- 📣 Share with friends
- 🐛 Report bugs or suggest features
- 💖 Consider sponsoring

---


[Live Demo](https://urochithi.netlify.app) • [Report Bug](https://github.com/hello2himel/urochithi/issues) • [Request Feature](https://github.com/hello2himel/urochithi/issues)

---

Made by [@hello2himel](https://github.com/hello2himel)