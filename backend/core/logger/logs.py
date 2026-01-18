import logging
import sys
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        # logging.FileHandler('app.log')
    ]
)

logger = logging.getLogger(__name__)

def log_info(message: str):
    """Log info message"""
    logger.info(message)

def log_error(message: str):
    """Log error message"""
    logger.error(message)

def log_warning(message: str):
    """Log warning message"""
    logger.warning(message)

def log_debug(message: str):
    """Log debug message"""
    logger.debug(message) 