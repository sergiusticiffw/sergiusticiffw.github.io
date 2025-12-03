/**
 * Receipt OCR Utilities
 * Handles OCR processing of receipt images using Tesseract.js
 */

import { createWorker } from 'tesseract.js';
import { logger } from './logger';

export interface ExtractedReceiptData {
  amount?: string;
  date?: string;
  merchant?: string;
  description?: string;
  rawText?: string;
}

/**
 * Normalize amount string to 4 decimal places without rounding
 * Examples: "6.5" -> "6.5000", "3.22" -> "3.2200", "110.40" -> "110.4000"
 */
function normalizeAmount(amountStr: string): string {
  let cleaned = amountStr.replace(/,/g, '.').trim(); // Replace comma with dot
  // Handle cases like "123 45" -> "123.45"
  if (/\s\d{2}$/.test(cleaned) && !cleaned.includes('.')) {
    cleaned = cleaned.replace(/\s/, '.');
  }
  // Parse the amount
  const numAmount = parseFloat(cleaned);
  if (isNaN(numAmount)) {
    return amountStr; // Return original if not a valid number
  }
  // Format to 4 decimal places without rounding
  return numAmount.toFixed(4);
}

/**
 * Extract text from receipt image using OCR
 * Uses both English and Romanian for better recognition
 */
export async function extractTextFromReceipt(
  imageData: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    // Use both English and Romanian languages for better recognition
    const worker = await createWorker(['eng', 'ron'], 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && m.progress !== undefined) {
          const progressPercent = Math.round(m.progress * 100);
          // Always log OCR progress for debugging
          console.log(`OCR Progress: ${progressPercent}%`);
          logger.log(`OCR Progress: ${progressPercent}%`);
          // Call progress callback if provided - map to 0-100% range
          // Recognition phase should be the main progress indicator
          if (onProgress) {
            onProgress(progressPercent);
          }
        } else if (m.status === 'loading tesseract core') {
          if (onProgress) {
            onProgress(0); // Initial loading - start at 0%
          }
        } else if (m.status === 'initializing tesseract') {
          if (onProgress) {
            onProgress(0); // Initializing - still at 0%
          }
        } else if (m.status === 'loading language traineddata') {
          if (onProgress) {
            onProgress(0); // Loading language data - still at 0%
          }
        } else if (m.status === 'initializing api') {
          if (onProgress) {
            onProgress(0); // Initializing API - still at 0%, recognition will start
          }
        }
      },
    });

    // Set OCR parameters for better text recognition
    await worker.setParameters({
      tessedit_pageseg_mode: '6', // Assume a single uniform block of text
      tessedit_char_whitelist: '0123456789.,€$RONLEIleiABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzĂăÂâÎîȘșȚț :/-', // Common receipt characters
    });

    const { data } = await worker.recognize(imageData);
    await worker.terminate();

    // Always log OCR results for debugging
    console.log('OCR extracted text length:', data.text.length);
    console.log('OCR extracted text (first 1000 chars):', data.text.substring(0, 1000));
    if (data.text.length > 1000) {
      console.log('OCR extracted text (last 500 chars):', data.text.substring(data.text.length - 500));
    }
    console.log('OCR confidence:', data.confidence);
    console.log('Full OCR text:', data.text); // Log full text for debugging
    logger.log('OCR extracted text length:', data.text.length);
    logger.log('OCR extracted text (first 1000 chars):', data.text.substring(0, 1000));
    if (data.text.length > 1000) {
      logger.log('OCR extracted text (last 500 chars):', data.text.substring(data.text.length - 500));
    }
    logger.log('OCR confidence:', data.confidence);
    logger.log('Full OCR text:', data.text); // Log full text for debugging
    return data.text;
  } catch (error) {
    logger.error('Error extracting text from receipt:', error);
    // Fallback to English only if multi-language fails
    try {
      const worker = await createWorker('eng', 1);
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
      });
      const { data } = await worker.recognize(imageData);
      await worker.terminate();
      logger.log('Fallback OCR text - FULL LENGTH:', data.text.length);
      logger.log('Fallback OCR text (first 1000 chars):', data.text.substring(0, 1000));
      if (data.text.length > 1000) {
        logger.log('Fallback OCR text (last 500 chars):', data.text.substring(data.text.length - 500));
      }
      logger.log('FULL FALLBACK OCR TEXT:', data.text);
      return data.text;
    } catch (fallbackError) {
      logger.error('Fallback OCR also failed:', fallbackError);
      throw error;
    }
  }
}

/**
 * Parse extracted text to find structured data
 * Optimized for Romanian receipts
 */
export function parseReceiptText(text: string): ExtractedReceiptData {
  const result: ExtractedReceiptData = {
    rawText: text,
  };

  // Extract amount (look for currency patterns - Romanian and English)
  // Be very flexible with OCR errors - numbers are more reliable than text
  const totalPatterns = [
    // Look for numbers with 2 decimal places near "TOTAL" or similar keywords
    /[Tt0Oo][Oo0][Tt7][Aa4][Ll1]\s*:?\s*([\d,]+\.?\d{2})/g, // TOTAL (with OCR error tolerance)
    /TOTAL\s*:?\s*([\d,]+\.?\d{2})/gi,
    /total\s*:?\s*([\d,]+\.?\d{2})/gi,
    /otal\s*:?\s*([\d,]+\.?\d{2})/gi, // Common OCR error
    /(?:suma|sumă|totalul)\s*:?\s*([\d,]+\.?\d{2})/gi,
    // English patterns
    /(?:total|amount|sum)\s*:?\s*([\d,]+\.?\d{2})/gi,
    // Look for numbers that look like totals (2 decimal places, reasonable amount)
    /([\d,]+\.\d{2})\s*(?:RON|LEI|lei|€|EUR|USD|\$|total|TOTAL)/gi,
    // Pattern for "TOTAL:" followed by number on same or next line
    /TOTAL\s*:?\s*[\s\n]*([\d,]+\.\d{2})/gi,
    /total\s*:?\s*[\s\n]*([\d,]+\.\d{2})/gi,
  ];

  let bestMatch: { amount: string; position: number; priority: number } | null = null;
  
  // First pass: look for TOTAL/total keywords
  for (let i = 0; i < totalPatterns.length; i++) {
    const pattern = totalPatterns[i];
    const matches = [...text.matchAll(pattern)];
    logger.log(`Pattern ${i} found ${matches.length} matches`);
    for (const match of matches) {
      let amount = match[1].replace(/,/g, '').trim();
      // Handle cases where decimal point might be missing or wrong
      if (!amount.includes('.')) {
        // If no decimal point, assume last 2 digits are decimals
        if (amount.length >= 3) {
          amount = amount.slice(0, -2) + '.' + amount.slice(-2);
        }
      }
      const numAmount = parseFloat(amount);
      logger.log(`Found amount candidate: ${amount} (parsed: ${numAmount})`);
      if (!isNaN(numAmount) && numAmount >= 0.01 && numAmount <= 100000) {
        const position = match.index || 0;
        const priority = i; // Lower index = higher priority
        const normalizedAmount = normalizeAmount(amount);
        
        if (!bestMatch || priority < bestMatch.priority) {
          bestMatch = { amount: normalizedAmount, position, priority };
          logger.log(`New best match: ${normalizedAmount} at position ${position} with priority ${priority}`);
        } else if (priority === bestMatch.priority && numAmount > parseFloat(bestMatch.amount)) {
          // Same priority, prefer larger amount
          bestMatch = { amount: normalizedAmount, position, priority };
          logger.log(`Updated best match: ${normalizedAmount} (larger than previous ${bestMatch.amount})`);
        }
      }
    }
  }

  // If no match with TOTAL keyword, look for amounts with currency symbols
  if (!bestMatch) {
    const currencyPatterns = [
      /([\d,]+\.?\d{2,})\s*(?:RON|LEI|lei|€|EUR|USD|\$)/gi,
      /(?:€|EUR|RON|USD|\$)\s*([\d,]+\.?\d{2,})/gi,
    ];
    
    for (const pattern of currencyPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const amount = match[1].replace(/,/g, '').trim();
        const numAmount = parseFloat(amount);
        if (!isNaN(numAmount) && numAmount >= 0.01 && numAmount <= 100000) {
          const position = match.index || 0;
          const normalizedAmount = normalizeAmount(amount);
          if (!bestMatch || numAmount > parseFloat(bestMatch.amount)) {
            bestMatch = { amount: normalizedAmount, position, priority: 100 };
          }
        }
      }
    }
  }

  // Last resort: find numbers with exactly 2 decimal places
  // Handle OCR errors where numbers might be misread
  if (!bestMatch) {
    logger.log('No match found with TOTAL keywords, trying generic patterns...');
    
    // Pattern for standard decimal format (X.XX or X,XX)
    const genericPatterns = [
      /([\d,]+\.\d{2})\b/g, // Standard: 6.85
      /([\d,]+\,\d{2})\b/g, // European: 6,85
      /([\d]+\s+\d{2})\b/g, // Space: 6 85
      /([\d]+\.\d{1,2})\b/g, // Flexible decimals: 6.8 or 6.85
    ];
    
    let largestAmount = 0;
    let largestMatch: { amount: string; position: number; priority: number } | null = null;
    
    for (const pattern of genericPatterns) {
      const matches = [...text.matchAll(pattern)];
      logger.log(`Generic pattern found ${matches.length} matches`);
      for (const match of matches) {
        let amount = match[1].replace(/,/g, '.').replace(/\s+/g, '.').trim();
        
        // Ensure exactly 2 decimal places
        if (amount.includes('.')) {
          const parts = amount.split('.');
          if (parts.length === 2) {
            if (parts[1].length === 1) {
              amount = parts[0] + '.' + parts[1] + '0'; // 6.8 -> 6.80
            } else if (parts[1].length > 2) {
              amount = parts[0] + '.' + parts[1].substring(0, 2); // 6.857 -> 6.85
            }
          }
        } else {
          // No decimal point, assume last 2 digits are decimals
          if (amount.length >= 3) {
            amount = amount.slice(0, -2) + '.' + amount.slice(-2);
          }
        }
        
        const numAmount = parseFloat(amount);
        logger.log(`Generic pattern amount: ${amount} (parsed: ${numAmount})`);
        
        // Consider all reasonable amounts (totals can be small too, like 6.85)
        if (!isNaN(numAmount) && numAmount >= 0.01 && numAmount <= 100000) {
          if (numAmount > largestAmount) {
            largestAmount = numAmount;
            const normalizedAmount = normalizeAmount(amount);
            largestMatch = { amount: normalizedAmount, position: match.index || 0, priority: 200 };
            logger.log(`New largest match: ${normalizedAmount}`);
          }
        }
      }
    }
    
    // Also try to find numbers near the end of the text (totals are usually at the end)
    if (!largestMatch) {
      logger.log('Trying to find numbers at the end of text...');
      const endPattern = /([\d,]+\.\d{2})\b/g;
      const endMatches = [...text.matchAll(endPattern)];
      logger.log(`Found ${endMatches.length} matches at end`);
      // Get last few matches (totals are usually at the end)
      const lastMatches = endMatches.slice(-5);
      for (const match of lastMatches) {
        let amount = match[1].replace(/,/g, '').trim();
        const numAmount = parseFloat(amount);
        logger.log(`End match amount: ${amount} (parsed: ${numAmount})`);
        if (!isNaN(numAmount) && numAmount >= 0.01 && numAmount <= 100000) {
          const normalizedAmount = normalizeAmount(amount);
          if (!largestMatch || numAmount > parseFloat(largestMatch.amount)) {
            largestMatch = { amount: normalizedAmount, position: match.index || 0, priority: 200 };
            logger.log(`New end match: ${normalizedAmount}`);
          }
        }
      }
    }
    
    if (largestMatch) {
      bestMatch = largestMatch;
      logger.log(`Final best match from generic patterns: ${bestMatch.amount}`);
    }
  }

  if (bestMatch) {
    result.amount = bestMatch.amount;
    logger.log(`Extracted amount: ${result.amount} from position ${bestMatch.position}`);
  } else {
    logger.warn('Could not extract amount from receipt text');
  }

  // Extract date (look for date patterns - Romanian and English formats)
  const datePatterns = [
    // Romanian format: "Data: 15-Jun-11" or "15-Jun-2011"
    /(?:data|dată|date)\s*:?\s*(\d{1,2}[-\.\/]\w{3}[-\.\/]\d{2,4})/i,
    // Standard formats
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
    // With month names (Romanian/English)
    /(\d{1,2}[-\.\/](?:ian|feb|mar|apr|mai|iun|iul|aug|sep|oct|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-\.\/]\d{2,4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let dateStr = match[1];
      
      // Normalize Romanian month abbreviations
      const monthMap: { [key: string]: string } = {
        'ian': 'jan', 'feb': 'feb', 'mar': 'mar', 'apr': 'apr',
        'mai': 'may', 'iun': 'jun', 'iul': 'jul', 'aug': 'aug',
        'sep': 'sep', 'oct': 'oct', 'nov': 'nov', 'dec': 'dec'
      };
      
      // Replace Romanian month abbreviations
      for (const [ro, en] of Object.entries(monthMap)) {
        dateStr = dateStr.replace(new RegExp(ro, 'i'), en);
      }
      
      // Try to parse and format date
      try {
        // Handle format like "15-Jun-11" -> "15-Jun-2011" (assume 2000s)
        if (/^\d{1,2}-\w{3}-\d{2}$/i.test(dateStr)) {
          const parts = dateStr.split(/[-\.\/]/);
          if (parts.length === 3) {
            const year = parseInt(parts[2]);
            const fullYear = year < 50 ? 2000 + year : 1900 + year;
            dateStr = `${parts[0]}-${parts[1]}-${fullYear}`;
          }
        }
        
        const date = new Date(dateStr.replace(/[\/\-\.]/g, '/'));
        if (!isNaN(date.getTime())) {
          result.date = date.toISOString().slice(0, 10);
        } else {
          result.date = dateStr;
        }
      } catch (e) {
        result.date = dateStr;
      }
      break;
    }
  }

  // Extract merchant (usually first line or restaurant/store name)
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  
  // Look for merchant patterns
  const merchantPatterns = [
    /^(?:merchant|store|shop|magazin|comerciant|restaurant|restaurant)\s*:?\s*(.+)$/im,
  ];

  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim();
      if (merchant.length > 2 && merchant.length < 100 && !/^\d/.test(merchant)) {
        result.merchant = merchant;
        break;
      }
    }
  }

  // If no pattern match, try first non-empty line that looks like a name
  if (!result.merchant && lines.length > 0) {
    for (const line of lines.slice(0, 5)) {
      const trimmed = line.trim();
      // Skip lines that are clearly not merchant names
      if (
        trimmed.length > 2 &&
        trimmed.length < 50 &&
        !/^\d/.test(trimmed) &&
        !/^(?:nota|data|total|suma|tva|platit|numerar)/i.test(trimmed) &&
        !/^[A-Z0-9\s\-\.]+$/.test(trimmed) // Not all caps (likely receipt number)
      ) {
        result.merchant = trimmed;
        break;
      }
    }
  }

  // Extract description (look for item lists or descriptions)
  // Get product names from the receipt, but filter out headers, quantities, prices, and OCR garbage
  if (lines.length > 2) {
    const descriptionParts: string[] = [];
    
    // Keywords to skip (headers, system text, etc.)
    const skipKeywords = [
      'am primit',
      'comanda',
      'pentru suma',
      'detalii comanda',
      'detalii',
      'produs',
      'cantitate',
      'total',
      'livrare',
      'nota',
      'data',
      'suma',
      'tva',
      'platit',
      'numerar',
      'masa',
      'ora',
      'solution',
      'solutie',
      'mdl',
      'ron',
      'lei',
      '€',
      'eur',
      'card',
      'visa',
      'mastercard',
      'terminal',
      'rrn',
      'autorizare',
      'tranzactie',
      'contactless',
      'achitare',
      'tip tranzactie',
      'cu card',
      'preturi',
      'romaniei',
      'bon fiscal',
      'articole',
      'farmacia',
      's.r.l.',
      'idno',
      'inr',
      'casier',
      'cec-',
      'mb',
    ];
    
    // Filter function to check if text looks like valid product name (not OCR garbage or system text)
    const isValidProductName = (text: string): boolean => {
      const lowerText = text.toLowerCase().trim();
      
      // Skip if it's a system keyword
      for (const keyword of skipKeywords) {
        if (lowerText.includes(keyword)) {
          return false;
        }
      }
      
      // Skip if it's just a number or mostly numbers
      if (/^\d+$/.test(lowerText) || /^\d+\.\d+$/.test(lowerText)) {
        return false;
      }
      
      // Skip if it contains order numbers or IDs (e.g., "77433738")
      if (/\d{6,}/.test(lowerText)) {
        return false;
      }
      
      // Skip if it contains card numbers, terminal IDs, or transaction details
      if (/card|visa|mastercard|terminal|rrn|autorizare|tranzactie|contactless|achitare/i.test(lowerText)) {
        return false;
      }
      
      // Skip if it contains too many random capital letters (OCR garbage pattern)
      const capitalCount = (text.match(/[A-Z]/g) || []).length;
      const letterCount = (text.match(/[a-zA-ZăâîșțĂÂÎȘȚ]/g) || []).length;
      if (letterCount > 0 && capitalCount / letterCount > 0.7 && text.length > 10) {
        // More than 70% capitals in longer text = likely OCR garbage
        return false;
      }
      
      // Skip if it has too many random characters or patterns that look like OCR errors
      // Patterns like "Wphotototototororototatc" or "AEH n i W" are garbage
      if (/([A-Z]{3,}\s*){2,}/.test(text)) {
        // Multiple groups of 3+ capitals = likely garbage
        return false;
      }
      
      // Skip if it has repeating patterns (OCR error)
      if (/(.{2,})\1{2,}/.test(text)) {
        // Repeating patterns like "tototototot" = OCR garbage
        return false;
      }
      
      // Too many special characters = likely OCR garbage
      const specialCharCount = (text.match(/[^a-zA-Z0-9\săâîșțĂÂÎȘȚ]/g) || []).length;
      const specialCharRatio = specialCharCount / text.length;
      
      // If more than 20% special characters, likely garbage
      if (specialCharRatio > 0.2) return false;
      
      // If mostly numbers and symbols, not a product name
      const digitCount = (text.match(/\d/g) || []).length;
      if (digitCount / text.length > 0.3) return false;
      
      // Must have at least 3 letters
      if (letterCount < 3) return false;
      
      // Skip if it's too short (likely not a product name)
      if (text.trim().length < 4) return false;
      
      // Skip if it's too long (likely contains multiple things or garbage)
      if (text.trim().length > 100) return false;
      
      return true;
    };
    
    // Extract product name from line (remove quantities, prices, etc.)
    const extractProductName = (line: string): string | null => {
      let cleaned = line.trim();
      
      // Pattern 1: "4 x 8,00 Ciuc halba 400 32,00 B" -> "Ciuc halba 400"
      // Pattern 2: "1 x 7,00 Coaste de Porc 7,00 B" -> "Coaste de Porc"
      // Pattern 3: "Ciuc halba 400 4 8,00 32,00" -> "Ciuc halba 400"
      // Pattern 4: "Bitonic Orange Imun caps. 1 buc. x 156.00 = 156.00 A" -> "Bitonic Orange Imun caps"
      
      // Pattern examples:
      // "4 x 8,00 Ciuc halba 400 32,00 B" -> "Ciuc halba 400"
      // "1 x 7,00 Coaste de Porc 7,00 B" -> "Coaste de Porc"
      // "Bitonic Orange Imun caps. 1 buc. x 156.00 = 156.00 A" -> "Bitonic Orange Imun caps"
      
      // Remove quantity x price patterns at the start: "4 x 8,00" or "1 x 7,00" or "1 buc. x 156.00"
      cleaned = cleaned.replace(/^\d+\s*(?:buc\.?|buc)?\s*x\s*[\d,]+\s*\.?\s*\d*\s*(?:=\s*[\d,]+\s*\.?\s*\d*)?\s*/i, '');
      cleaned = cleaned.replace(/^\d+\s*x\s*[\d,]+\s*\.?\s*\d*\s*/, '');
      
      // Remove "=" and everything after it if it's a price calculation
      cleaned = cleaned.replace(/\s*=\s*[\d,]+\s*\.?\s*\d*.*$/, '');
      
      // Remove trailing price patterns: "32,00 B" or "7,00 B" or "32,00 RON" or "156.00 A"
      cleaned = cleaned.replace(/\s+[\d,]+\s*\.?\s*\d*\s*[AB]\s*$/i, ''); // Remove "32,00 B" or "156.00 A"
      cleaned = cleaned.replace(/\s+[\d,]+\s*\.?\s*\d*\s*(?:mdl|ron|lei|€|eur|b)\s*$/i, ''); // Remove "32,00 RON" or "32,00 B"
      
      // Remove trailing numbers that are prices: "32,00" or "7,00" or "156.00"
      // But be careful not to remove numbers that are part of product name (like "400" in "Ciuc halba 400")
      // Only remove if it looks like a price (has decimal point with 2 decimals)
      cleaned = cleaned.replace(/\s+[\d,]+\s*\.\s*\d{2}\s*$/, ''); // Remove "32,00" or "156.00" at end (prices)
      cleaned = cleaned.replace(/\s+[\d,]+\s*\.\s*\d+\s*$/, ''); // Remove "156.0" at end (prices)
      
      // Remove trailing quantity: " 4" or " 1" (standalone numbers)
      // BUT: Don't remove if it's a 3+ digit number (likely part of product name like "400")
      // Only remove single or double digit numbers at the end that are likely quantities
      cleaned = cleaned.replace(/\s+\b\d{1,2}\b\s*$/, ''); // Remove trailing quantity like " 4" or " 1" (1-2 digits only)
      
      // Remove patterns like "4 8,00" (quantity space price) - but only if at the end
      cleaned = cleaned.replace(/\s+\d+\s+[\d,]+\s*\.?\s*\d*\s*$/, '');
      
      // Remove "buc." or "buc" at the end
      cleaned = cleaned.replace(/\s+buc\.?\s*$/i, '');
      
      // Remove currency symbols and amounts at the end
      cleaned = cleaned.replace(/\s+[\d,]+\.?\d*\s*(?:mdl|ron|lei|€|eur)\s*$/i, '');
      
      // Clean up multiple spaces and trim
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      logger.log(`Extracted product name: "${cleaned}" from line: "${line}"`);
      
      return cleaned.length > 0 ? cleaned : null;
    };
    
    // Look for product lines (skip headers and footers)
    // Products are usually in the middle section, before payment details
    // We'll look for lines that contain product names with quantities/prices
    
    // First, find the product section (usually between header and totals)
    let productSectionStart = -1;
    let productSectionEnd = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const lowerTrimmed = trimmed.toLowerCase();
      
      // Detect start of product section (after headers, before products)
      if (productSectionStart === -1) {
        // Look for indicators that we're past headers - lines with quantity x price or product names
        if (/^\d+\s*(?:x|buc\.?)\s*[\d,]/.test(trimmed) || // "4 x 8,00" or "1 buc. 156.00"
            /[a-zA-ZăâîșțĂÂÎȘȚ]{4,}\s+\d+\s*(?:x|buc\.?)/i.test(trimmed) || // "Product 1 buc"
            (/[a-zA-ZăâîșțĂÂÎȘȚ]{3,}/.test(trimmed) && /\d+\.?\d*\s*[AB]?\s*$/.test(trimmed))) { // "Product 32,00 B"
          productSectionStart = i;
        }
      }
      
      // Detect end of product section (totals or payment info)
      if (productSectionStart !== -1 && productSectionEnd === -1) {
        if (/^total\s*:?|^tva\s*|livrare|card|visa|mastercard|terminal|rrn|autorizare|cu card|^total\s+[\d,]+/i.test(lowerTrimmed)) {
          productSectionEnd = i;
          break;
        }
      }
    }
    
    logger.log(`Product section: start=${productSectionStart}, end=${productSectionEnd}`);
    
    // If we found a product section, extract products from it
    if (productSectionStart !== -1) {
      const endIndex = productSectionEnd !== -1 ? productSectionEnd : lines.length;
      logger.log(`Extracting products from lines ${productSectionStart} to ${endIndex}`);
      
      for (let i = productSectionStart; i < endIndex; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Skip empty lines or very short lines
        if (trimmed.length < 4) continue;
        
        // Skip if it's clearly not a product (headers, totals, etc.)
        if (/^(?:total|tva|card|visa|nota|data|bon|fiscal|articole|preturi|romaniei|detalii|produs|cantitate)/i.test(trimmed)) {
          continue;
        }
        
        // Extract product name
        const productName = extractProductName(trimmed);
        if (productName && isValidProductName(productName)) {
          descriptionParts.push(productName);
          logger.log(`Found product ${descriptionParts.length}: "${productName}" from line: "${trimmed}"`);
        }
      }
    }
    
    // If no products found in product section, try searching all lines
    if (descriptionParts.length === 0) {
      logger.log('No products found in product section, trying full search...');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lowerTrimmed = trimmed.toLowerCase();
        
        // Stop at totals or payment
        if (/^total\s*:?|^tva\s*|card|visa|mastercard|terminal|rrn|autorizare|cu card/i.test(lowerTrimmed)) {
          break;
        }
        
        // Skip headers and system text
        if (
          trimmed.length < 4 ||
          /^(?:nota|data|total|suma|tva|platit|numerar|masa|ora|solution|solutie|am primit|comanda|pentru suma|farmacia|s\.r\.l\.|idno|inr|preturi|romaniei|bon fiscal|articole|detalii|produs|cantitate)/i.test(trimmed) ||
          /^\d{6,}/.test(trimmed) || // Order numbers
          /^mb\d+/i.test(trimmed) // Fiscal codes
        ) {
          continue;
        }
        
        // Look for lines that might be products (contain letters and numbers)
        const letterCount = (trimmed.match(/[a-zA-ZăâîșțĂÂÎȘȚ]/g) || []).length;
        const hasNumbers = /\d/.test(trimmed);
        
        if (letterCount >= 4 && hasNumbers && trimmed.length >= 6 && trimmed.length <= 100) {
          const productName = extractProductName(trimmed);
          if (productName && isValidProductName(productName)) {
            descriptionParts.push(productName);
            logger.log(`Found product (full search) ${descriptionParts.length}: "${productName}" from line: "${trimmed}"`);
            if (descriptionParts.length >= 6) break; // Stop after finding enough products
          }
        }
      }
    }
    
    logger.log(`Total products found: ${descriptionParts.length}`);
    
    if (descriptionParts.length > 0) {
      // Join product names, limit to first 5-6 products and 150 characters
      const limitedProducts = descriptionParts.slice(0, 6);
      result.description = limitedProducts.join(', ').substring(0, 150);
    }
    // If no valid description found, leave it empty rather than showing garbage
  }

  return result;
}

/**
 * Process receipt image and extract structured data
 */
export async function processReceipt(
  imageData: string,
  onProgress?: (progress: number) => void
): Promise<ExtractedReceiptData> {
  try {
    // Always log for debugging
    console.log('Starting OCR processing...');
    logger.log('Starting OCR processing...');
    // Progress starts at 0% from extractTextFromReceipt
    const text = await extractTextFromReceipt(imageData, (ocrProgress) => {
      // OCR progress is 0-100%, map it to 0-90% (leaving 10% for parsing)
      if (onProgress) {
        onProgress(Math.round((ocrProgress / 100) * 90));
      }
    });
    console.log('OCR completed, parsing text...');
    logger.log('OCR completed, parsing text...');
    if (onProgress) {
      onProgress(90); // OCR done, parsing
    }
    const parsed = parseReceiptText(text);
    console.log('Receipt processing completed');
    logger.log('Receipt processing completed');
    if (onProgress) {
      onProgress(100); // Complete
    }
    return parsed;
  } catch (error) {
    logger.error('Error processing receipt:', error);
    throw error;
  }
}

