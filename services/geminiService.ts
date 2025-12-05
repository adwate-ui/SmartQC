
import { GoogleGenAI } from "@google/genai";
import { ProductDetails, QCReport, QCStatus, AiMode } from "../types";
import { extractOgImage } from "../utils";

// Exporting fileToBase64 from here for backward compatibility with imports in other files
export { fileToBase64 } from "../utils";

const PROMPTS = {
  IDENTIFY_URL: (input: string) => `
      I have a product URL: ${input}
      
      Task:
      1. Analyze the URL string to Infer the Brand, Product Name, and SKU.
      2. Use the Google Search tool to find details: Name, Material, Estimated Cost, Retailer, Description, Category.
      3. CRITICAL: Search for "images of [Product Name] official" to find a high-quality image URL.
      4. IF you cannot find a direct image link from the URL, perform a Google Image search and pick the best matching official white-background product image.
      
      Formatting Rules:
      - Estimated Cost MUST be in format "$X,XXX" (e.g., "$1,200"). Do not use decimals.

      Output PURE JSON:
      {
        "sku": "string",
        "name": "string",
        "material": "string",
        "estimatedCost": "string",
        "retailer": "string",
        "description": "string",
        "category": "string",
        "imageUrl": "string" 
      }
    `,
  IDENTIFY_IMAGE: `
      Analyze this product.
      1. Identify the AUTHENTIC product, Brand, and SKU. Ignore replicas.
      2. If the exact SKU is unclear, provide the Closest Recommended Match.
      3. Extract: Name, Material, Estimated Cost (USD), Retailer, Description, Category.
      4. CRITICAL: Use the Google Search tool to find the official product page URL. 
         - Copy this exact found URL into the 'productUrl' field in the JSON.
      5. CRITICAL: Use the Google Search tool to find a high-resolution public URL for the product image (e.g. from the official site) and put it in 'productUrl' if possible, or a new 'imageUrl' field.

      Formatting Rules:
      - Estimated Cost MUST be in format "$X,XXX" (e.g., "$1,200"). Do not use decimals.

      Output PURE JSON:
      {
        "sku": "string",
        "name": "string",
        "material": "string",
        "estimatedCost": "string",
        "retailer": "string",
        "description": "string",
        "category": "string",
        "productUrl": "string"
      }
    `,
  QC: (productContext: ProductDetails, referenceContextText: string, inputMapping: string, historyContextText: string, isExpertMode: boolean) => `
    You are ${isExpertMode ? `THE WORLD'S LEADING EXPERT AUTHENTICATOR for ${productContext.retailer || 'Luxury Goods'}. You have 30+ years of experience detecting high-tier super-fakes. You are extremely strict, cynical, and detail-obsessed.` : 'a Strict QC Inspector.'}
    
    PRODUCT CONTEXT:
    Product: ${productContext.name} (${productContext.sku})
    Category: ${productContext.category}
    Brand/Retailer: ${productContext.retailer}
    ${referenceContextText}
    
    ${inputMapping}
    
    ${historyContextText}
    
    TASK:
    Perform a comprehensive quality control inspection.
    1. Compare ALL **ACTUAL PRODUCT IMAGES** (Images ${inputMapping.includes('ACTUAL PRODUCT IMAGES') ? 'defined above' : 'provided'} onwards) against the **Main Reference Image**.
    2. **CRITICAL - EXTERNAL VALIDATION**: Use the **Google Search tool** to find official details, specifications, and quality visual guides for the Brand: "${productContext.retailer}" and Product: "${productContext.name} ${productContext.sku}".
    3. Use this external knowledge to validate the authenticity and quality of the uploaded images.
    4. Treat all "Actual Product Images" as a single dataset of the current item. Do NOT compare them against each other for timeline changes.
    5. Solely focus on identifying discrepancies, defects, and authenticity issues by contrasting the Actual Item (Inspection Images) with the Ideal Product (Reference Image & Online Standards).
    
    **INTELLIGENT GAP ANALYSIS (CRITICAL)**:
    - You must be PROACTIVE. If the "Actual Product Images" do not show specific high-risk areas (e.g., Wash Tags, Holograms, Underside of Insoles, Back of Buttons, Specific Stitching Lines), you MUST set "followUp.required" to true.
    - Do not be passive. If you cannot see a crucial authentication marker, you need to ask for it.
    
    Output JSON ONLY.
    IMPORTANT: 
    - 'details' inside 'sections' MUST be an Array of Strings (Bullet points).
    - Assign a 'status' (PASS, FAIL, WARNING) to each section based on findings.
    - If followUp is required, provide specific 'suggestedAngles'.
    
    Structure:
    {
      "status": "PASS" | "FAIL" | "WARNING",
      "overallScore": 0-100,
      "summary": "Executive summary string",
      "sections": [
        {
          "title": "Material Quality",
          "score": 0-100,
          "status": "PASS" | "FAIL" | "WARNING",
          "details": ["Grain is consistent", "No scratches found"]
        }
      ],
      "faults": [
        { "location": "string", "issue": "string", "severity": "low"|"medium"|"critical" }
      ],
      "followUp": {
        "required": boolean,
        "missingInfo": "String describing explicitly what is missing for 100% auth check.",
        "suggestedAngles": ["close up of internal label", "underside of hardware", "stitching macro"]
      }
    }
  `
};

/**
 * Helper to initialize AI with user's key
 */
const getAI = (apiKey: string) => new GoogleGenAI({ apiKey });

/**
 * Internal helper to execute Gemini requests with a Fallback strategy.
 */
const generateWithFallback = async (
  apiKey: string,
  modelName: string, 
  generateParams: any, 
  useThinking = true
): Promise<any> => {
  const ai = getAI(apiKey);
  try {
    const config = { ...generateParams.config };
    
    if (useThinking) {
      config.thinkingConfig = { thinkingBudget: 1024 };
    } else {
      delete config.thinkingConfig;
    }

    return await ai.models.generateContent({
      model: modelName,
      contents: generateParams.contents,
      config: config
    });

  } catch (error: any) {
    console.warn(`Gemini Request Failed (Model: ${modelName}, Thinking: ${useThinking}). Error:`, error);
    
    const isInternalError = 
      error.message?.includes('500') || 
      error.message?.includes('Internal error') || 
      error.status === 500 ||
      error.code === 500;

    const isQuotaError = 
      error.message?.includes('429') || 
      error.status === 429 ||
      error.code === 429;

    if (useThinking && isInternalError) {
      console.log("⚠️ Fallback: Retrying request WITHOUT Thinking Mode...");
      return generateWithFallback(apiKey, modelName, generateParams, false);
    }

    if ((isQuotaError || isInternalError) && modelName.includes('pro')) {
      console.log("⚠️ Fallback: Switching to Gemini 2.5 Flash due to Quota/Error...");
      return generateWithFallback(apiKey, "gemini-2.5-flash", generateParams, false);
    }

    throw error;
  }
};

/**
 * Identify product details from Media (Base64) or URL.
 */
export const identifyProductFromMedia = async (
  apiKey: string,
  input: string, 
  isUrl: boolean = false,
  mode: AiMode = 'detailed'
): Promise<ProductDetails & { imageUrl?: string }> => {
  
  const modelName = mode === 'detailed' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
  const useThinking = mode === 'detailed';

  let parts: any[] = [];
  let ogImagePromise: Promise<string | null> = Promise.resolve(null);

  if (isUrl) {
    // START PARALLEL TASK: Attempt to scrape the image via Proxy
    ogImagePromise = extractOgImage(input);
    parts = [{ text: PROMPTS.IDENTIFY_URL(input) }];
  } else {
    const data = input.split(',')[1];
    const mimeType = input.substring(input.indexOf(':') + 1, input.indexOf(';'));
    parts = [
      { inlineData: { mimeType, data } },
      { text: PROMPTS.IDENTIFY_IMAGE }
    ];
  }

  // Run AI identification in parallel with scraping (if URL mode)
  const responsePromise = generateWithFallback(
    apiKey,
    modelName,
    {
      contents: { parts: parts },
      config: {
        tools: [{ googleSearch: {} }] 
      }
    },
    useThinking
  );

  const [response, ogImage] = await Promise.all([responsePromise, ogImagePromise]);

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Failed to find JSON object in AI response");
  }

  const jsonString = text.substring(startIndex, endIndex + 1);
  
  let details: ProductDetails & { imageUrl?: string };
  try {
    details = JSON.parse(jsonString);
  } catch (e) {
    throw new Error("Failed to parse product details from AI response.");
  }

  // === URL & IMAGE HANDLING LOGIC ===
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  if (isUrl) {
    // 1. Product URL is STRICTLY the user input.
    details.productUrl = input;
    
    // 2. Image URL Logic:
    // PRIORITY A: Use the scraped OG Image if available (Most Robust)
    if (ogImage) {
      details.imageUrl = ogImage;
    } 
    // PRIORITY B: Use AI found image if scraped one failed
    else if (details.imageUrl && details.imageUrl.startsWith('http')) {
       // Keep AI result
    }
    // PRIORITY C: Scan search results
    else {
        const imageFromSearch = chunks.find(c => c.web?.uri && c.web.uri.match(/\.(jpeg|jpg|gif|png|webp)$/i));
        if (imageFromSearch) {
          details.imageUrl = imageFromSearch.web.uri;
        } else {
          details.imageUrl = undefined;
        }
    }
  } else {
    // Image Mode: Product URL is strictly the first search result
    if (!details.productUrl || !details.productUrl.startsWith('http')) {
        const firstWebChunk = chunks.find(c => c.web?.uri);
        if (firstWebChunk && firstWebChunk.web?.uri) {
          details.productUrl = firstWebChunk.web.uri;
        } else {
          details.productUrl = `https://www.google.com/search?q=${encodeURIComponent(details.name + ' ' + details.sku)}`;
        }
    }
  }

  return details;
};

/**
 * Perform detailed QC.
 */
export const performQualityControl = async (
  apiKey: string,
  productContext: ProductDetails,
  mainProductImage: string,
  previousReports: QCReport[],
  newMediaFiles: string[],
  mode: AiMode = 'detailed',
  isExpertMode: boolean = false
): Promise<QCReport> => {
  
  const modelName = mode === 'detailed' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
  const useThinking = mode === 'detailed';

  const mediaParts = newMediaFiles.map(media => {
    const data = media.split(',')[1];
    const mimeType = media.substring(media.indexOf(':') + 1, media.indexOf(';'));
    return { inlineData: { mimeType, data } };
  });

  let mainImagePart: any = null;
  let referenceContextText = '';

  if (mainProductImage && mainProductImage.startsWith('data:')) {
    const mimeType = mainProductImage.substring(mainProductImage.indexOf(':') + 1, mainProductImage.indexOf(';'));
    
    // SAFETY CHECK: Gemini Vision does not support SVG.
    // If main image is an SVG placeholder, do NOT send it as inlineData.
    if (mimeType !== 'image/svg+xml') {
        const data = mainProductImage.split(',')[1];
        mainImagePart = { inlineData: { mimeType, data } };
    }
  } else if (mainProductImage && mainProductImage.startsWith('http')) {
     referenceContextText = `\n[Reference Image URL]: ${mainProductImage}`;
  }

  const historicalImagesParts: any[] = [];
  const historySummaries: string[] = [];
  let uniqueHistoryImages: string[] = [];

  const sortedReports = [...previousReports].reverse(); 

  if (sortedReports.length > 0) {
    const allHistoryImages = sortedReports.flatMap(r => r.images || []);
    uniqueHistoryImages = [...new Set(allHistoryImages)].slice(-10); 
    
    uniqueHistoryImages.forEach(img => {
       if (img && img.startsWith('data:')) {
         const mimeType = img.substring(img.indexOf(':') + 1, img.indexOf(';'));
         // SAFETY CHECK: Skip SVGs in history as well
         if (mimeType !== 'image/svg+xml') {
            const data = img.split(',')[1];
            historicalImagesParts.push({ inlineData: { mimeType, data } });
         }
       }
    });

    sortedReports.forEach((r, i) => {
       historySummaries.push(`- Report ${i+1} (${new Date(r.timestamp).toLocaleDateString()}): ${r.status} - ${r.summary}`);
    });
  }

  const historyContextText = historySummaries.length > 0 
    ? `\nPREVIOUS INSPECTION HISTORY (Chronological):\n${historySummaries.join('\n')}\n` 
    : '';

  let imageIndex = 1;
  let inputMapping = "INPUT IMAGE MAPPING (Strict Reference):\n";

  if (mainImagePart) {
      inputMapping += `- Image ${imageIndex}: Main Reference Product Image (Master / Ideal).\n`;
      imageIndex++;
  }

  const inspectionParts = [...historicalImagesParts, ...mediaParts];

  if (inspectionParts.length > 0) {
      const startIndex = imageIndex;
      const endIndex = imageIndex + inspectionParts.length - 1;
      inputMapping += `- Images ${startIndex} to ${endIndex}: ACTUAL PRODUCT IMAGES (Aggregated from current and previous uploads).\n`;
      inputMapping += `  These images represent the specific physical item being inspected.\n`;
  }

  const fullParts = [
      ...(mainImagePart ? [mainImagePart] : []), 
      ...inspectionParts,
      { text: PROMPTS.QC(productContext, referenceContextText, inputMapping, historyContextText, isExpertMode) }
  ];

  const response = await generateWithFallback(
    apiKey,
    modelName,
    {
      contents: { parts: fullParts },
      config: { tools: [{ googleSearch: {} }] }
    },
    useThinking
  );

  const text = response.text;
  if (!text) throw new Error("No QC response from Gemini");
  
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) {
     throw new Error("Failed to find JSON object in QC response");
  }

  const jsonString = text.substring(startIndex, endIndex + 1);
  
  let result;
  try {
    result = JSON.parse(jsonString);
  } catch (e) {
    throw new Error("Failed to parse QC report");
  }

  if (result.sections && Array.isArray(result.sections)) {
    result.sections = result.sections.map((section: any) => ({
      ...section,
      details: Array.isArray(section.details) 
        ? section.details 
        : typeof section.details === 'string' 
          ? [section.details] 
          : []
    }));
  }

  if (!result.followUp) {
     result.followUp = { required: false, missingInfo: "None", suggestedAngles: [] };
  }

  result.followUp.required = !!result.followUp.required;

  const report: QCReport = {
    ...result,
    id: Date.now().toString(),
    timestamp: Date.now(),
    images: [...uniqueHistoryImages, ...newMediaFiles],
    status: result.status as QCStatus,
    isExpertMode
  };

  return report;
};
