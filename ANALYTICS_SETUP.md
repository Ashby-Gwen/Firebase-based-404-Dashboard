# Analytics Setup Guide

## Quick Start - How to Run Analytics

### Step 1: Install Python Dependencies
```bash
cd analytics
pip install -r requirements.txt
```

### Step 2: Set Up Firebase Service Account
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the JSON file as `analytics/serviceAccountKey.json`
4. Replace the placeholder in the file with your actual credentials

### Step 3: Set Environment Variables
```bash
# Set your Firebase project ID
export FIREBASE_PROJECT_ID=dashboard-ed869

# Set your Gemini API key (optional - will use fallback if not set)
export GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 4: Run Analytics Scripts

#### Phase 3: Data Processing & Correlation Analysis
```bash
cd analytics
python analytics_bridge.py
```
**What it does:**
- Fetches sales and market data from Firestore
- Calculates correlations between ingredient costs and sales
- Identifies trends and patterns
- Saves processed statistics to Firestore

#### Phase 5: AI-Powered Recommendations
```bash
cd analytics
python gemini_ai.py
```
**What it does:**
- Analyzes trends from Phase 3
- Generates business recommendations using Gemini AI
- Falls back to rule-based recommendations if AI unavailable
- Saves recommendations to Firestore

### Step 5: View Results in Dashboard
1. Open dashboard: http://localhost:8080
2. Check **Notifications** tab for AI insights
3. View **Predictive Analytics** charts in Dashboard
4. Monitor KPI improvements

---

## Automation Options

### Option 1: Manual (Recommended for testing)
Run scripts manually when you have new data

### Option 2: Scheduled (Production)
```bash
# Run every hour
0 * * * * cd /path/to/analytics && python analytics_bridge.py
30 * * * * cd /path/to/analytics && python gemini_ai.py
```

### Option 3: Cloud Functions (Advanced)
Deploy scripts as Firebase Cloud Functions for automatic execution

---

## Troubleshooting

### Issue: "Permission denied"
**Solution:** Check service account permissions and Firestore rules

### Issue: "No data found"
**Solution:** Upload CSV data first using Data Entry → Upload CSV/Excel

### Issue: "Gemini API key invalid"
**Solution:** Set GEMINI_API_KEY or let it use fallback recommendations

### Issue: "Module not found"
**Solution:** Install dependencies: `pip install -r requirements.txt`

---

## Data Flow

1. **Upload Data** → CSV/Excel → Firestore (`sales_data`, `market_historical_data`)
2. **Process Data** → `analytics_bridge.py` → Firestore (`processed_stats`)
3. **Generate Insights** → `gemini_ai.py` → Firestore (`recommendations`)
4. **View Results** → Dashboard → Notifications & Charts

---

## Next Steps

1. Upload sample data via CSV upload
2. Run analytics scripts
3. Check notifications for insights
4. Monitor predictive charts
5. Adjust based on recommendations
