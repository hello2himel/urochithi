# 🔄 Urochithi Migration Guide: Google Sheets → Neon

## Why Migrate?

| Feature | Google Sheets | Neon PostgreSQL |
|---------|--------------|-----------------|
| **Speed** | 500ms-2s per request | 10-50ms per query |
| **Concurrency** | Race conditions | ACID transactions |
| **Scale** | ~1,000 messages max | Millions of messages |
| **Indexing** | None | Fast search on any field |
| **Rate Limit** | 100 req/100s | No API limits |
| **Cost** | Free tier limits | Free 0.5 GB, then $19/mo |
| **Relationships** | Can't join data | Full SQL joins |
| **Backup** | Manual exports | Automatic + point-in-time |

---

## Prerequisites

- ✅ Existing Urochithi site on Netlify
- ✅ Access to your Google Sheet with messages
- ✅ Neon account (free tier works) - https://neon.tech

---

## Step 1: Create Neon Database

### 1.1 Sign Up for Neon
1. Go to https://neon.tech
2. Click "Sign Up" → Choose GitHub or Email
3. Create a new project: "urochithi-production"
4. Select region closest to your users
5. Click "Create Project"

### 1.2 Get Connection String
1. In Neon console, click "Dashboard"
2. Copy the connection string (starts with `postgresql://`)
3. Example: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/urochithi`

---

## Step 2: Run Database Migration

### 2.1 Install Dependencies Locally
```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/urochithi.git
cd urochithi

# Install dependencies
npm install
```

### 2.2 Create .env File
```bash
cp .env.example .env
```

Edit `.env`:
```bash
DATABASE_URL=postgresql://your-connection-string-here
```

### 2.3 Run Migration
```bash
# Connect to Neon and create tables
npm run db:migrate

# Or manually:
psql $DATABASE_URL < urochithi-neon-migration.sql
```

Expected output:
```
CREATE EXTENSION
CREATE TABLE
CREATE TABLE
CREATE INDEX
... (more CREATE statements)
✅ Migration complete!
```

---

## Step 3: Export Data from Google Sheets

### 3.1 Download as CSV
1. Open your Urochithi Google Sheet
2. File → Download → Comma Separated Values (.csv)
3. Save as `messages-export.csv`

### 3.2 Import to Neon

Create `scripts/import-from-sheets.js`:

```javascript
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const sql = neon(process.env.DATABASE_URL);

async function importMessages() {
  const csvContent = fs.readFileSync('messages-export.csv', 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Importing ${records.length} messages...`);

  for (const row of records) {
    await sql`
      INSERT INTO messages (message, session_id, created_at)
      VALUES (
        ${row.Message || row.message},
        ${row['Session ID'] || row.sessionId || 'legacy'},
        ${row.Timestamp || row.timestamp || new Date().toISOString()}
      )
    `;
  }

  console.log('✅ Import complete!');
}

importMessages().catch(console.error);
```

Run it:
```bash
node scripts/import-from-sheets.js
```

---

## Step 4: Update Netlify Functions

### 4.1 Replace Functions
Copy the new Neon-based functions:

```bash
# Backup old functions
mkdir backup
cp netlify/functions/*.js backup/

# Replace with Neon versions
cp submit-neon.js netlify/functions/submit.js
cp get-messages-neon.js netlify/functions/get-messages.js
```

### 4.2 Update package.json
Add dependency:
```json
{
  "dependencies": {
    "@neondatabase/serverless": "^0.9.0"
  }
}
```

---

## Step 5: Configure Netlify Environment Variables

### 5.1 Add DATABASE_URL
1. Go to Netlify dashboard
2. Site settings → Environment variables
3. Add new variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Your Neon connection string
4. Click "Save"

### 5.2 Remove Old Variable (Optional)
- Delete `GSCRIPT_URL` (no longer needed)

---

## Step 6: Deploy & Test

### 6.1 Commit Changes
```bash
git add .
git commit -m "Migrate from Google Sheets to Neon database"
git push origin main
```

### 6.2 Netlify Auto-Deploy
- Netlify will automatically redeploy
- Wait 1-2 minutes for build to complete

### 6.3 Test Submission
1. Visit your site: `https://your-site.netlify.app`
2. Send a test message
3. Check Neon console → Tables → messages
4. Verify message appears

### 6.4 Test Dashboard
1. Log in to dashboard
2. Check if old messages appear
3. Verify search/filter works
4. Try saving a letter as image

---

## Step 7: Verify & Monitor

### 7.1 Check Query Performance
In Neon console:
```sql
-- See all messages
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;

-- Check stats
SELECT * FROM message_stats;

-- Verify indexes
SELECT * FROM pg_indexes WHERE tablename = 'messages';
```

### 7.2 Monitor Neon Usage
- Go to Neon dashboard → Usage
- Free tier: 0.5 GB storage, 100 compute hours/month
- You'll likely stay under limits unless you get 100k+ messages

---

## Rollback Plan (If Something Breaks)

### Quick Rollback to Google Sheets
```bash
# 1. Restore old functions
cp backup/*.js netlify/functions/

# 2. Commit & push
git add netlify/functions/
git commit -m "Rollback to Google Sheets"
git push

# 3. In Netlify: Re-add GSCRIPT_URL environment variable
```

---

## Post-Migration Cleanup

### Optional: Keep Google Sheets as Backup
- Leave Google Sheet intact for 30 days
- Export weekly CSV backups
- After 30 days, you can delete or archive

### Set Up Automated Backups
Add to Neon dashboard:
1. Settings → Backup & Restore
2. Enable automated backups (included in free tier)
3. Set retention to 7 days

---

## Troubleshooting

### Error: "Connection refused"
- Check DATABASE_URL is correct in Netlify
- Verify Neon instance is running (not paused)
- Check IP allowlist in Neon (should be "Allow all")

### Error: "relation 'messages' does not exist"
- Migration didn't run successfully
- Re-run: `npm run db:migrate`

### Messages not appearing
- Check Netlify function logs
- Verify DATABASE_URL environment variable
- Test connection: `psql $DATABASE_URL -c "SELECT NOW();"`

---

## Cost Estimation

### Neon Pricing (as of 2024)
- **Free Tier**: 0.5 GB storage, 100 compute hours/month
  - Supports ~10,000 messages
  - Perfect for personal use
  
- **Scale Plan**: $19/month
  - 10 GB storage
  - Unlimited compute hours
  - Supports ~1 million messages
  
- **Business Plan**: Custom pricing
  - For high-traffic sites (10k+ messages/day)

### When to Upgrade?
- Free tier is fine until you hit 8,000-10,000 total messages
- Monitor at: Neon Console → Usage

---

## Benefits After Migration

✅ **Instant queries** - Dashboard loads 10x faster  
✅ **Advanced search** - Filter by date, session, content  
✅ **Better security** - Rate limiting that persists  
✅ **Scalability** - Handle millions of messages  
✅ **Analytics** - Run SQL queries for insights  
✅ **Pagination** - Load messages in chunks  
✅ **Backup & restore** - Point-in-time recovery  

---

## Next Steps

After successful migration:
1. ✅ Add user authentication (see `docs/add-user-auth.md`)
2. ✅ Enable email notifications for new messages
3. ✅ Add message moderation (approve/reject)
4. ✅ Export messages as PDF/CSV
5. ✅ Set up monitoring with Sentry or LogRocket

---

Need help? Open an issue: https://github.com/hello2himel/urochithi/issues
