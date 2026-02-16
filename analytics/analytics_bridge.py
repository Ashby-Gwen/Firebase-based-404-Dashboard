#!/usr/bin/env python3
"""
Analytics Bridge - Phase 3
Python backend script for processing restaurant data
Pulls sales_data and market_historical_data, joins them, calculates correlations,
and saves processed analysis to Firestore.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
import pandas as pd
from scipy import stats
from dotenv import load_dotenv

# Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials, firestore

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AnalyticsBridge:
    """Main class for data processing and analysis"""
    
    def __init__(self):
        self.db = None
        self.sales_data: pd.DataFrame = None
        self.market_data: pd.DataFrame = None
        self.processed_stats: pd.DataFrame = None
        
    def initialize_firebase(self) -> bool:
        """Initialize Firebase Admin SDK with credentials"""
        try:
            # Check if already initialized
            if firebase_admin._apps:
                self.db = firestore.client()
                logger.info("Firebase already initialized")
                return True
                
            # Load service account credentials from environment
            cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH', 'serviceAccountKey.json')
            
            if not os.path.exists(cred_path):
                logger.error(f"Service account file not found: {cred_path}")
                # Try to use environment variables
                cred_dict = {
                    "type": "service_account",
                    "project_id": os.getenv('FIREBASE_PROJECT_ID'),
                    "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
                    "private_key": os.getenv('FIREBASE_PRIVATE_KEY', '').replace('\\n', '\n'),
                    "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
                    "client_id": os.getenv('FIREBASE_CLIENT_ID'),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
                cred = credentials.Certificate(cred_dict)
            else:
                cred = credentials.Certificate(cred_path)
            
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            logger.info("Firebase initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {str(e)}")
            return False
    
    def fetch_sales_data(self, days: int = 90) -> pd.DataFrame:
        """Fetch sales data from Firestore for the specified number of days"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            sales_ref = self.db.collection('sales_data')
            query = sales_ref.where('date', '>=', cutoff_date.strftime('%Y-%m-%d'))
            docs = query.stream()
            
            data = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                data.append(record)
            
            if not data:
                logger.warning("No sales data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            
            # Ensure required columns exist
            required_cols = ['date', 'amount', 'itemName', 'orderNumber']
            for col in required_cols:
                if col not in df.columns:
                    logger.warning(f"Missing column in sales data: {col}")
            
            # Convert date to datetime
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0)
            
            self.sales_data = df
            logger.info(f"Fetched {len(df)} sales records")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching sales data: {str(e)}")
            return pd.DataFrame()
    
    def fetch_market_data(self, days: int = 90) -> pd.DataFrame:
        """Fetch market/historical ingredient cost data from Firestore"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            market_ref = self.db.collection('market_historical_data')
            query = market_ref.where('date', '>=', cutoff_date.strftime('%Y-%m-%d'))
            docs = query.stream()
            
            data = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                data.append(record)
            
            if not data:
                logger.warning("No market data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            
            # Ensure required columns exist
            required_cols = ['date', 'amount', 'ingredientName']
            for col in required_cols:
                if col not in df.columns:
                    logger.warning(f"Missing column in market data: {col}")
            
            # Convert date to datetime
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0)
            
            self.market_data = df
            logger.info(f"Fetched {len(df)} market records")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching market data: {str(e)}")
            return pd.DataFrame()
    
    def join_data_on_date(self) -> pd.DataFrame:
        """Join sales and market data on the Date field"""
        if self.sales_data is None or self.sales_data.empty:
            logger.error("Sales data not available for joining")
            return pd.DataFrame()
        
        if self.market_data is None or self.market_data.empty:
            logger.error("Market data not available for joining")
            return pd.DataFrame()
        
        try:
            # Aggregate sales data by date
            daily_sales = self.sales_data.groupby('date').agg({
                'amount': 'sum',
                'orderNumber': 'count',
                'itemName': lambda x: list(x)  # Keep list of items sold
            }).reset_index()
            daily_sales.columns = ['date', 'total_sales', 'transaction_count', 'items_sold']
            
            # Aggregate market data by date and ingredient
            daily_market = self.market_data.groupby(['date', 'ingredientName']).agg({
                'amount': 'mean'  # Average cost if multiple entries per day
            }).reset_index()
            daily_market.columns = ['date', 'ingredient', 'avg_cost']
            
            # Pivot market data to have ingredients as columns
            market_pivot = daily_market.pivot(
                index='date', 
                columns='ingredient', 
                values='avg_cost'
            ).reset_index()
            
            # Join sales and market data
            joined = pd.merge(
                daily_sales, 
                market_pivot, 
                on='date', 
                how='inner'
            )
            
            logger.info(f"Joined data: {len(joined)} records with {len(market_pivot.columns)-1} ingredients")
            return joined
            
        except Exception as e:
            logger.error(f"Error joining data: {str(e)}")
            return pd.DataFrame()
    
    def calculate_correlations(self, joined_data: pd.DataFrame) -> Dict[str, Any]:
        """Calculate correlation between ingredient costs and sales metrics"""
        if joined_data is None or joined_data.empty:
            logger.error("No joined data available for correlation analysis")
            return {}
        
        correlations = {
            'analysis_date': datetime.now().isoformat(),
            'total_days_analyzed': len(joined_data),
            'date_range': {
                'start': joined_data['date'].min().isoformat() if not joined_data.empty else None,
                'end': joined_data['date'].max().isoformat() if not joined_data.empty else None
            },
            'ingredient_correlations': [],
            'summary': {}
        }
        
        try:
            # Get ingredient columns (all columns except date, total_sales, transaction_count, items_sold)
            ingredient_cols = [col for col in joined_data.columns 
                             if col not in ['date', 'total_sales', 'transaction_count', 'items_sold']]
            
            for ingredient in ingredient_cols:
                # Skip if no data for this ingredient
                if joined_data[ingredient].isna().all():
                    continue
                
                # Calculate correlation with total sales
                valid_data = joined_data[['total_sales', ingredient]].dropna()
                
                if len(valid_data) < 3:  # Need at least 3 data points
                    continue
                
                # Pearson correlation
                corr_sales, p_value_sales = stats.pearsonr(
                    valid_data['total_sales'], 
                    valid_data[ingredient]
                )
                
                # Calculate correlation with transaction count
                valid_data_txn = joined_data[['transaction_count', ingredient]].dropna()
                if len(valid_data_txn) >= 3:
                    corr_txn, p_value_txn = stats.pearsonr(
                        valid_data_txn['transaction_count'], 
                        valid_data_txn[ingredient]
                    )
                else:
                    corr_txn, p_value_txn = 0, 1
                
                # Determine trend direction
                if abs(corr_sales) > 0.5:
                    if corr_sales > 0:
                        trend = "positive"
                        insight = f"As {ingredient} cost increases, sales tend to increase"
                    else:
                        trend = "negative"
                        insight = f"As {ingredient} cost increases, sales tend to decrease"
                else:
                    trend = "weak"
                    insight = f"No strong correlation between {ingredient} cost and sales"
                
                # Calculate percentage changes
                cost_change = ((valid_data[ingredient].iloc[-1] - valid_data[ingredient].iloc[0]) 
                              / valid_data[ingredient].iloc[0] * 100) if valid_data[ingredient].iloc[0] != 0 else 0
                sales_change = ((valid_data['total_sales'].iloc[-1] - valid_data['total_sales'].iloc[0]) 
                               / valid_data['total_sales'].iloc[0] * 100) if valid_data['total_sales'].iloc[0] != 0 else 0
                
                corr_data = {
                    'ingredient': ingredient,
                    'correlation_with_sales': round(corr_sales, 4),
                    'correlation_with_transactions': round(corr_txn, 4),
                    'p_value_sales': round(p_value_sales, 4),
                    'p_value_transactions': round(p_value_txn, 4),
                    'trend': trend,
                    'insight': insight,
                    'cost_change_percent': round(cost_change, 2),
                    'sales_change_percent': round(sales_change, 2),
                    'data_points': len(valid_data),
                    'significant': p_value_sales < 0.05
                }
                
                correlations['ingredient_correlations'].append(corr_data)
            
            # Calculate summary statistics
            if correlations['ingredient_correlations']:
                significant_corrs = [c for c in correlations['ingredient_correlations'] if c['significant']]
                correlations['summary'] = {
                    'total_ingredients_analyzed': len(correlations['ingredient_correlations']),
                    'significant_correlations': len(significant_corrs),
                    'strongest_correlation': max(
                        correlations['ingredient_correlations'], 
                        key=lambda x: abs(x['correlation_with_sales'])
                    )['ingredient'] if correlations['ingredient_correlations'] else None,
                    'avg_correlation_strength': np.mean([
                        abs(c['correlation_with_sales']) 
                        for c in correlations['ingredient_correlations']
                    ]) if correlations['ingredient_correlations'] else 0
                }
            
            logger.info(f"Calculated correlations for {len(correlations['ingredient_correlations'])} ingredients")
            return correlations
            
        except Exception as e:
            logger.error(f"Error calculating correlations: {str(e)}")
            return correlations
    
    def identify_trends(self, correlations: Dict[str, Any]) -> List[Dict[str, str]]:
        """Identify significant trends for AI recommendations"""
        trends = []
        
        for corr in correlations.get('ingredient_correlations', []):
            # Strong negative correlation with significant cost increase
            if corr['trend'] == 'negative' and corr['cost_change_percent'] > 10:
                trend_text = f"{corr['ingredient']} price up {corr['cost_change_percent']:.1f}%, sales down {abs(corr['sales_change_percent']):.1f}%"
                trends.append({
                    'ingredient': corr['ingredient'],
                    'trend': trend_text,
                    'severity': 'high' if corr['cost_change_percent'] > 20 else 'medium',
                    'correlation_strength': abs(corr['correlation_with_sales']),
                    'action_needed': True
                })
            
            # Strong positive correlation with cost decrease
            elif corr['trend'] == 'positive' and corr['cost_change_percent'] < -10:
                trend_text = f"{corr['ingredient']} price down {abs(corr['cost_change_percent']):.1f}%, opportunity to increase sales"
                trends.append({
                    'ingredient': corr['ingredient'],
                    'trend': trend_text,
                    'severity': 'opportunity',
                    'correlation_strength': abs(corr['correlation_with_sales']),
                    'action_needed': True
                })
        
        logger.info(f"Identified {len(trends)} significant trends")
        return trends
    
    def save_processed_stats(self, correlations: Dict[str, Any], trends: List[Dict[str, str]]) -> bool:
        """Save processed analysis to Firestore processed_stats collection"""
        try:
            # Prepare document data
            doc_data = {
                'analysisDate': firestore.SERVER_TIMESTAMP,
                'correlations': correlations,
                'trends': trends,
                'status': 'completed',
                'type': 'ingredient_sales_correlation'
            }
            
            # Save to processed_stats collection
            doc_ref = self.db.collection('processed_stats').document()
            doc_ref.set(doc_data)
            
            logger.info(f"Saved processed stats to Firestore: {doc_ref.id}")
            
            # Also save trends to recommendations collection for notifications
            for trend in trends:
                if trend['action_needed']:
                    recommendation = {
                        'title': f"Trend Alert: {trend['ingredient']}",
                        'insight': trend['trend'],
                        'suggestedAction': self._generate_action_suggestion(trend),
                        'severity': trend['severity'],
                        'ingredient': trend['ingredient'],
                        'correlationStrength': trend['correlation_strength'],
                        'createdAt': firestore.SERVER_TIMESTAMP,
                        'read': False,
                        'icon': '⚠️' if trend['severity'] == 'high' else ('💡' if trend['severity'] == 'opportunity' else '📊')
                    }
                    
                    rec_ref = self.db.collection('recommendations').document()
                    rec_ref.set(recommendation)
                    logger.info(f"Created recommendation: {rec_ref.id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving processed stats: {str(e)}")
            return False
    
    def _generate_action_suggestion(self, trend: Dict[str, str]) -> str:
        """Generate a basic action suggestion based on trend"""
        ingredient = trend['ingredient']
        
        if trend['severity'] == 'high':
            return f"Consider finding alternative suppliers for {ingredient} or adjust menu pricing to maintain margins."
        elif trend['severity'] == 'medium':
            return f"Monitor {ingredient} prices closely and consider bulk purchasing when prices are favorable."
        elif trend['severity'] == 'opportunity':
            return f"Take advantage of lower {ingredient} prices by promoting menu items that use this ingredient."
        else:
            return f"Review {ingredient} usage patterns and optimize inventory management."
    
    def run_analysis(self, days: int = 90) -> bool:
        """Run complete analysis pipeline"""
        logger.info("Starting analytics bridge analysis...")
        
        # Initialize Firebase
        if not self.initialize_firebase():
            return False
        
        # Fetch data
        sales_df = self.fetch_sales_data(days)
        market_df = self.fetch_market_data(days)
        
        if sales_df.empty or market_df.empty:
            logger.error("Insufficient data for analysis")
            return False
        
        # Join data
        joined_data = self.join_data_on_date()
        if joined_data.empty:
            logger.error("Failed to join data")
            return False
        
        # Calculate correlations
        correlations = self.calculate_correlations(joined_data)
        
        # Identify trends
        trends = self.identify_trends(correlations)
        
        # Save results
        if self.save_processed_stats(correlations, trends):
            logger.info("Analysis completed successfully")
            return True
        else:
            logger.error("Failed to save analysis results")
            return False


def main():
    """Main entry point"""
    bridge = AnalyticsBridge()
    
    # Run analysis for last 90 days
    success = bridge.run_analysis(days=90)
    
    if success:
        logger.info("Analytics bridge completed successfully")
        return 0
    else:
        logger.error("Analytics bridge failed")
        return 1


if __name__ == "__main__":
    exit(main())
