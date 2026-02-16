# Testing Guide - Firebase Analytics Dashboard

## Overview
This guide provides step-by-step instructions for testing all 5 phases of the upgraded system.

---

## Pre-Testing Setup

### 1. Environment Configuration
```bash
# Create .env file
cp .env.example .env

# Edit .env with your credentials
FIREBASE_API_KEY=your_api_key
FIREBASE_PROJECT_ID=your_project_id
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Install Python Dependencies
```bash
cd analytics
pip install -r requirements.txt
```

### 3. Firebase Setup
- Ensure Firestore rules are deployed: `firebase deploy --only firestore:rules`
- Set up Firebase Authentication
- Create service account key and save as `serviceAccountKey.json` in analytics folder

---

## Phase 1: CSV/Excel Upload System

### Test Case 1.1: CSV Upload - Sales Data
**Steps:**
1. Log in to dashboard
2. Navigate to Data Entry tab
3. Click "Upload CSV/Excel" tab
4. Select "Sales Data" from dropdown
5. Upload test CSV file:
   ```csv
   Date,Amount,Item Name,Order Number
   2024-01-15,150.00,Chicken Adobo,ORD001
   2024-01-15,200.00,Beef Steak,ORD002
   2024-01-16,180.00,Chicken Adobo,ORD003
   ```
6. Click "Preview File"
7. Map columns:
   - Date → Date
   - Amount → Amount
   - Item Name → Item Name
   - Order Number → Order Number
8. Click "Save Mapped Data"

**Expected Result:** Success toast appears, data saved to `sales_data` collection

### Test Case 1.2: Date Validation
**Steps:**
1. Upload CSV with various date formats:
   ```csv
   Date,Amount,Item Name,Order Number
   01/15/2024,150.00,Test Item,ORD001
   2024-01-16,200.00,Test Item,ORD002
   ```

**Expected Result:** Both dates normalized to ISO 8601 (YYYY-MM-DD)

### Test Case 1.3: Amount Sanitization
**Steps:**
1. Upload CSV with formatted amounts:
   ```csv
   Date,Amount,Item Name,Order Number
   2024-01-15,"₱1,500.50",Item,ORD001
   2024-01-16,$200.00,Item,ORD002
   ```

**Expected Result:** Amounts converted to float (1500.50, 200.00)

---

## Phase 2: Mobile UI & Notifications

### Test Case 2.1: Mobile Responsive Layout
**Steps:**
1. Open dashboard in Chrome DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone SE / iPhone 12 Pro / Pixel 5
4. Test all views:
   - Dashboard (KPI cards, charts)
   - Data Entry (forms and upload)
   - Notifications
   - Reports

**Expected Results:**
- Sidebar becomes horizontal icon-only nav
- KPI cards stack vertically
- Charts resize properly
- Tables convert to card view (or hidden on mobile)
- Touch targets are 44px+ minimum

### Test Case 2.2: Notification System
**Steps:**
1. Manually add test document to Firestore:
   ```javascript
   db.collection('recommendations').add({
     title: 'Test Alert',
     insight: 'Flour prices increased by 15%',
     suggestedAction: 'Consider bulk purchasing flour',
     createdAt: new Date(),
     read: false,
     icon: '⚠️'
   })
   ```
2. Navigate to Notifications tab
3. Refresh page

**Expected Result:** Test notification appears with insight and action

### Test Case 2.3: Real-time Notifications
**Steps:**
1. Keep Notifications tab open
2. Add new recommendation to Firestore from another window
3. Wait for auto-refresh (or refresh manually)

**Expected Result:** New notification appears in list

---

## Phase 3: Python Analytics Bridge

### Test Case 3.1: Analytics Bridge Execution
**Steps:**
1. Ensure test data exists in:
   - `sales_data` collection (min 10 records)
   - `market_historical_data` collection (min 10 records)
2. Run analytics script:
   ```bash
   cd analytics
   python analytics_bridge.py
   ```

**Expected Output:**
```
INFO: Starting analytics bridge analysis...
INFO: Firebase initialized successfully
INFO: Fetched X sales records
INFO: Fetched X market records
INFO: Calculated correlations for X ingredients
INFO: Saved processed stats to Firestore: [doc_id]
INFO: Analysis completed successfully
```

### Test Case 3.2: Data Joining Verification
**Steps:**
1. Check `processed_stats` collection in Firebase Console
2. Verify document structure:
   - `analysisDate` (timestamp)
   - `correlations` (object with ingredient data)
   - `trends` (array of trends)
   - `status`: "completed"

**Expected Result:** Document exists with complete correlation data

### Test Case 3.3: Correlation Calculation
**Steps:**
1. Create test data with known correlation:
   - Sales: high on days when ingredient X is cheap
   - Market: ingredient X price varies
2. Run analytics
3. Check correlations in processed_stats

**Expected Result:**
- Correlation coefficient between -1 and 1
- `significant: true` if p-value < 0.05
- Correct trend direction

---

## Phase 4: Predictive Charts

### Test Case 4.1: 7-Day Sales Forecast
**Steps:**
1. Add prediction data to `prediction_history`:
   ```javascript
   for (let i = 0; i < 7; i++) {
     const date = new Date();
     date.setDate(date.getDate() - i);
     db.collection('prediction_history').add({
       date: date.toISOString().split('T')[0],
       predictedSales: 1000 + Math.random() * 500,
       actualSales: i < 3 ? 900 + Math.random() * 600 : null
     });
   }
   ```
2. Navigate to Dashboard
3. Click "7-Day Sales Forecast" tab

**Expected Result:**
- Line chart shows historical data (orange)
- Forecast line extends 7 days (green, dashed)
- "No prediction data yet" message if no data

### Test Case 4.2: Menu Demand Chart
**Steps:**
1. Add demand predictions:
   ```javascript
   db.collection('prediction_history').add({
     itemName: 'Chicken Adobo',
     predictedDemand: 85,
     date: '2024-01-20'
   });
   ```
2. Click "Menu Demand" tab

**Expected Result:** Horizontal bar chart ranking items by demand

### Test Case 4.3: Forecast vs Actual
**Steps:**
1. Ensure some predictions have `actualSales` values
2. Click "Forecast vs Actual" tab

**Expected Result:**
- Two lines: Predicted (orange) vs Actual (green)
- Accuracy percentage displayed if data available
- Shows "Waiting for actual sales data..." if no actuals

---

## Phase 5: Gemini AI Integration

### Test Case 5.1: Gemini Recommendation Generation
**Steps:**
1. Ensure processed_stats has trends data
2. Set GEMINI_API_KEY environment variable:
   ```bash
   export GEMINI_API_KEY=your_key_here
   ```
3. Run Gemini script:
   ```bash
   python gemini_ai.py
   ```

**Expected Output:**
```
INFO: Starting Gemini AI recommendation generation...
INFO: Fetched X trends from processed_stats
INFO: Using Gemini AI for recommendation generation
INFO: Successfully generated recommendation with Gemini
INFO: Saved AI recommendation: [doc_id]
INFO: Gemini AI recommendation pipeline completed successfully
```

### Test Case 5.2: AI Recommendation Display
**Steps:**
1. Check recommendations appear in Notifications tab
2. Verify card structure:
   - Title: "AI Business Recommendation"
   - Insight section (orange left border)
   - Suggested Action (green badge)
   - Timestamp

**Expected Result:** Professional-looking AI recommendation card

### Test Case 5.3: Fallback Without API Key
**Steps:**
1. Remove GEMINI_API_KEY
2. Run script

**Expected Result:**
- Logs: "Using rule-based fallback for recommendation generation"
- Still creates recommendation based on trend analysis
- No error thrown

---

## End-to-End Integration Test

### Test Flow:
1. **Upload Data** → Upload CSV sales and market data
2. **Process Data** → Run `python analytics_bridge.py`
3. **Get Insights** → Run `python gemini_ai.py`
4. **View Dashboard** → Check predictive charts
5. **Check Notifications** → View AI recommendations
6. **Mobile Test** → Verify responsive design on phone

---

## Troubleshooting Common Issues

### Issue: CSV Upload Not Working
- Check browser console for errors
- Verify file is CSV/XLSX format
- Ensure columns are properly mapped
- Check Firestore rules allow writes

### Issue: No Predictions Showing
- Verify `prediction_history` collection has data
- Check browser console for Chart.js errors
- Ensure data has proper date format

### Issue: Python Scripts Fail
- Verify all dependencies installed: `pip list`
- Check Firebase service account credentials
- Ensure FIREBASE_PROJECT_ID is set
- Check Python version (3.8+)

### Issue: Gemini Not Working
- Verify GEMINI_API_KEY is set
- Check API key has Vertex AI permissions
- Review quota limits
- Use fallback if API unavailable

---

## Performance Testing

### Load Test:
1. Upload CSV with 1000+ rows
2. Measure upload time
3. Check browser responsiveness during preview
4. Monitor Firestore write performance

### Mobile Performance:
1. Test on actual mobile device (not just DevTools)
2. Check touch responsiveness
3. Verify smooth scrolling
4. Test on slow 3G connection

---

## Security Testing

### Check:
- [ ] API keys not exposed in frontend
- [ ] Firebase rules restrict unauthorized access
- [ ] Input validation prevents XSS
- [ ] File upload size limits enforced
- [ ] No sensitive data in browser console logs

---

## Regression Testing

### Verify Original Features Still Work:
- [ ] Login/Authentication
- [ ] Manual data entry (sales, products, expenses)
- [ ] Basic KPI dashboard
- [ ] Reports generation
- [ ] User management (admin only)
- [ ] Sample data loading

---

## Test Results Template

```markdown
| Test Case | Status | Notes |
|-----------|--------|-------|
| 1.1 CSV Upload | ⬜ Pass / ⬜ Fail | |
| 1.2 Date Validation | ⬜ Pass / ⬜ Fail | |
| 1.3 Amount Sanitization | ⬜ Pass / ⬜ Fail | |
| 2.1 Mobile Layout | ⬜ Pass / ⬜ Fail | |
| 2.2 Notifications | ⬜ Pass / ⬜ Fail | |
| 3.1 Analytics Bridge | ⬜ Pass / ⬜ Fail | |
| 4.1 Sales Forecast | ⬜ Pass / ⬜ Fail | |
| 4.2 Menu Demand | ⬜ Pass / ⬜ Fail | |
| 5.1 Gemini AI | ⬜ Pass / ⬜ Fail | |

Issues Found:
1. 
2. 
3. 
```

---

## Next Steps After Testing

1. Fix any bugs found
2. Deploy updated Firestore rules
3. Deploy updated frontend
4. Schedule Python scripts (cron job / Cloud Scheduler)
5. Monitor error logs
6. Collect user feedback
