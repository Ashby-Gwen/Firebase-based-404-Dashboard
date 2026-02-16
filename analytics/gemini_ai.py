#!/usr/bin/env python3
"""
Gemini AI Integration - Phase 5
Integrates with Gemini 1.5 Flash via Firebase Vertex AI SDK
Generates AI-driven business recommendations based on data trends
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Try to import Vertex AI SDK
try:
    import vertexai
    from vertexai.generative_models import GenerativeModel, Part
    VERTEX_AI_AVAILABLE = True
except ImportError:
    VERTEX_AI_AVAILABLE = False
    logging.warning("Vertex AI SDK not available. Using fallback method.")

# Try to import Google Generative AI as alternative
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GeminiAI:
    """Gemini AI integration for business recommendations"""
    
    def __init__(self):
        self.db = None
        self.model = None
        self.use_vertex = VERTEX_AI_AVAILABLE
        self.use_genai = GENAI_AVAILABLE
        
    def initialize(self) -> bool:
        """Initialize Firebase and AI models"""
        try:
            # Initialize Firebase
            if firebase_admin._apps:
                self.db = firestore.client()
            else:
                cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH', 'serviceAccountKey.json')
                if os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                else:
                    # Use environment variables
                    firebase_admin.initialize_app()
                self.db = firestore.client()
            
            # Initialize AI model
            if self.use_vertex:
                # Initialize Vertex AI
                project_id = os.getenv('FIREBASE_PROJECT_ID')
                location = "us-central1"
                vertexai.init(project=project_id, location=location)
                self.model = GenerativeModel("gemini-1.5-flash")
                logger.info("Initialized Vertex AI Gemini 1.5 Flash")
                
            elif self.use_genai:
                # Initialize Google Generative AI with API key
                api_key = os.getenv('GEMINI_API_KEY')
                if not api_key:
                    logger.error("GEMINI_API_KEY not set in environment")
                    return False
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-1.5-flash')
                logger.info("Initialized Google Generative AI Gemini 1.5 Flash")
            else:
                logger.warning("No AI SDK available. Will use rule-based fallback.")
                
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize: {str(e)}")
            return False
    
    def fetch_trends_from_processed_stats(self) -> List[Dict[str, Any]]:
        """Fetch recent trends from processed_stats collection"""
        try:
            # Get the most recent analysis
            stats_ref = self.db.collection('processed_stats')
            query = stats_ref.order_by('analysisDate', direction=firestore.Query.DESCENDING).limit(1)
            docs = query.stream()
            
            trends = []
            for doc in docs:
                data = doc.to_dict()
                trends = data.get('trends', [])
                break
            
            logger.info(f"Fetched {len(trends)} trends from processed_stats")
            return trends
            
        except Exception as e:
            logger.error(f"Error fetching trends: {str(e)}")
            return []
    
    def generate_prompt(self, trends: List[Dict[str, Any]]) -> str:
        """Generate a prompt for Gemini based on trends"""
        if not trends:
            return """Based on general restaurant business best practices, 
            provide one actionable business recommendation for a restaurant owner 
            to improve profitability and operational efficiency."""
        
        # Build trend summary
        trend_summaries = []
        for trend in trends:
            trend_text = trend.get('trend', '')
            severity = trend.get('severity', 'medium')
            ingredient = trend.get('ingredient', 'Unknown')
            
            if severity == 'high':
                trend_summaries.append(f"URGENT: {trend_text}")
            elif severity == 'opportunity':
                trend_summaries.append(f"OPPORTUNITY: {trend_text}")
            else:
                trend_summaries.append(f"TREND: {trend_text}")
        
        trends_text = "\n".join(trend_summaries)
        
        prompt = f"""As a restaurant business consultant, analyze these market trends and provide strategic recommendations:

TRENDS IDENTIFIED:
{trends_text}

Based on these trends, provide ONE actionable business recommendation for a restaurant owner. 

Your response should be structured as:
1. **Insight**: Brief explanation of the trend impact (1-2 sentences)
2. **Recommended Action**: Specific, actionable step the owner should take (1-2 sentences)
3. **Expected Outcome**: What positive result to expect from this action (1 sentence)

Keep your response concise, practical, and focused on immediate actionable steps."""

        return prompt
    
    def generate_recommendation_with_gemini(self, trends: List[Dict[str, Any]]) -> Optional[Dict[str, str]]:
        """Generate recommendation using Gemini AI"""
        if not self.model:
            logger.error("AI model not initialized")
            return None
        
        try:
            prompt = self.generate_prompt(trends)
            
            if self.use_vertex:
                # Use Vertex AI
                response = self.model.generate_content(prompt)
                generated_text = response.text
                
            elif self.use_genai:
                # Use Google Generative AI
                response = self.model.generate_content(prompt)
                generated_text = response.text
            else:
                return None
            
            # Parse the response
            recommendation = self.parse_gemini_response(generated_text)
            
            logger.info("Successfully generated recommendation with Gemini")
            return recommendation
            
        except Exception as e:
            logger.error(f"Error generating recommendation with Gemini: {str(e)}")
            return None
    
    def generate_rule_based_recommendation(self, trends: List[Dict[str, Any]]) -> Dict[str, str]:
        """Generate recommendation using rule-based logic as fallback"""
        if not trends:
            return {
                'insight': 'No significant trends detected in recent data.',
                'action': 'Continue monitoring key metrics and maintain current operational practices.',
                'outcome': 'Stable business performance with early warning system in place.'
            }
        
        # Find the most critical trend
        high_priority = [t for t in trends if t.get('severity') == 'high']
        opportunities = [t for t in trends if t.get('severity') == 'opportunity']
        
        if high_priority:
            trend = high_priority[0]
            ingredient = trend.get('ingredient', 'ingredient')
            return {
                'insight': f"{trend.get('trend', 'Significant price increase detected')}. This is impacting your profit margins.",
                'action': f"Consider menu engineering: either adjust pricing for items using {ingredient} or temporarily feature alternative dishes with lower ingredient costs.",
                'outcome': 'Improved profit margins while maintaining customer satisfaction through strategic menu adjustments.'
            }
        elif opportunities:
            trend = opportunities[0]
            ingredient = trend.get('ingredient', 'ingredient')
            return {
                'insight': f"{trend.get('trend', 'Cost reduction opportunity detected')}. This is a chance to increase profitability.",
                'action': f"Create promotional campaigns featuring menu items that use {ingredient} to capitalize on lower costs and drive higher sales volume.",
                'outcome': 'Increased sales volume and customer engagement while ingredient costs are favorable.'
            }
        else:
            trend = trends[0]
            return {
                'insight': trend.get('trend', 'Market trend detected in your data.'),
                'action': f"Monitor {trend.get('ingredient', 'key ingredients')} closely and adjust purchasing strategies accordingly.",
                'outcome': 'Better inventory management and cost control through data-driven decision making.'
            }
    
    def parse_gemini_response(self, response_text: str) -> Dict[str, str]:
        """Parse Gemini response into structured format"""
        lines = response_text.split('\n')
        
        insight = ""
        action = ""
        outcome = ""
        
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if 'insight' in line.lower() and ':' in line:
                current_section = 'insight'
                insight = line.split(':', 1)[1].strip()
            elif 'action' in line.lower() and ':' in line:
                current_section = 'action'
                action = line.split(':', 1)[1].strip()
            elif 'outcome' in line.lower() and ':' in line:
                current_section = 'outcome'
                outcome = line.split(':', 1)[1].strip()
            elif current_section and line and not line.startswith('*'):
                # Append to current section
                if current_section == 'insight':
                    insight += ' ' + line
                elif current_section == 'action':
                    action += ' ' + line
                elif current_section == 'outcome':
                    outcome += ' ' + line
        
        # Clean up and ensure we have content
        insight = insight.strip() or 'Market trends indicate a need for strategic adjustments.'
        action = action.strip() or 'Review your current menu and pricing strategy.'
        outcome = outcome.strip() or 'Improved operational efficiency and profitability.'
        
        return {
            'insight': insight,
            'action': action,
            'outcome': outcome
        }
    
    def save_recommendation(self, recommendation: Dict[str, str], trends: List[Dict[str, Any]]) -> bool:
        """Save AI-generated recommendation to Firestore"""
        try:
            # Create recommendation document
            rec_data = {
                'title': 'AI Business Recommendation',
                'insight': recommendation.get('insight', ''),
                'suggestedAction': recommendation.get('action', ''),
                'expectedOutcome': recommendation.get('outcome', ''),
                'sourceTrends': trends,
                'aiGenerated': True,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'read': False,
                'icon': '🤖',
                'type': 'ai_recommendation'
            }
            
            # Save to recommendations collection
            doc_ref = self.db.collection('recommendations').document()
            doc_ref.set(rec_data)
            
            logger.info(f"Saved AI recommendation: {doc_ref.id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving recommendation: {str(e)}")
            return False
    
    def run(self) -> bool:
        """Run complete Gemini AI recommendation pipeline"""
        logger.info("Starting Gemini AI recommendation generation...")
        
        # Initialize
        if not self.initialize():
            logger.error("Failed to initialize Gemini AI")
            return False
        
        # Fetch trends
        trends = self.fetch_trends_from_processed_stats()
        
        # Generate recommendation
        if self.model and (self.use_vertex or self.use_genai):
            logger.info("Using Gemini AI for recommendation generation")
            recommendation = self.generate_recommendation_with_gemini(trends)
        else:
            logger.info("Using rule-based fallback for recommendation generation")
            recommendation = self.generate_rule_based_recommendation(trends)
        
        if not recommendation:
            logger.error("Failed to generate recommendation")
            return False
        
        # Save recommendation
        if self.save_recommendation(recommendation, trends):
            logger.info("Gemini AI recommendation pipeline completed successfully")
            return True
        else:
            logger.error("Failed to save recommendation")
            return False


def main():
    """Main entry point"""
    gemini = GeminiAI()
    
    success = gemini.run()
    
    if success:
        logger.info("Gemini AI integration completed successfully")
        return 0
    else:
        logger.error("Gemini AI integration failed")
        return 1


if __name__ == "__main__":
    exit(main())
