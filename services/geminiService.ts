import { GoogleGenAI, Type } from "@google/genai";
import { ProductDetails, QCReport, QCStatus, AiMode } from "../types";
import { extractOgImage, generateUUID } from "../utils";

// Exporting fileToBase64 from here for backward compatibility with imports in other files
export { fileToBase64 } from "../utils";

const PROMPTS = {
  IDENTIFY_URL: (input: string) => `
      I have a product URL: ${input}
      
      Task:
      1. Analyze the URL string to Infer the Brand, Product Name, and SKU.
      2. Use the Google Search tool to find details: Name, Material, Estimated Cost, Retailer, Description, Category.
      
      Formatting Rules:
      - Estimated Cost MUST be in format "$X,XXX" (e.g., "$1,200"). Do not use decimals.
    `,
  IDENTIFY_IMAGE: `
      Analyze this product.
      1. Identify the AUTHENTIC product, Brand, and SKU. Ignore replicas.
      2. If the exact SKU is unclear, provide the Closest Recommended Match.
      3. Extract: Name, Material, Estimated Cost (USD), Retailer, Description, Category.
      4. Use the Google Search tool to verify details if possible.
    `,
  QC_SYSTEM: (isExpert: boolean) => `
      You are a ${isExpert ? "world-class, extremely critical QA Expert" : "helpful Quality Control Assistant"}.
      ${isExpert ? "You catch even the tiniest flaws. You are strict and professional." : "You are observant but reasonable."}
      
      Task: Compare the inspection media (images/video) against the reference product image and details.
      Output a detailed QC Report in JSON.
  `
};

export const identifyProductFromMedia = async (
  apiKey: string,
  input: string,
  isUrlMode: boolean,
  aiMode: AiMode
): Promise<ProductDetails> => {
  const ai = new GoogleGenAI({ apiKey });
  
  // Use gemini-3-pro-preview for detailed reasoning or when thinking is needed
  // Use gemini-2.5-flash for speed
  const modelName = aiMode === 'detailed' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';

  const tools = [{ googleSearch: {} }];

  const schema = {
    type: Type.OBJECT,
    properties: {
      sku: { type: Type.STRING },
      name: { type: Type.STRING },
      material: { type: Type.STRING },
      estimatedCost: { type: Type.STRING },
      retailer: { type: Type.STRING },
      description: { type: Type.STRING },
      category: { type: Type.STRING },
      productUrl: { type: Type.STRING, description: "Found URL if any" },
    },
    required: ["sku", "name", "category"],
  };

  let contents;
  
  if (isUrlMode) {
    contents = { 
        parts: [{ text: PROMPTS.IDENTIFY_URL(input) }]
    };
  } else {
    // Input is base64 string
    const match = input.match(/^data:(.*?);base64,(.*)$/);
    const mimeType = match ? match[1] : 'image/jpeg';
    const data = match ? match[2] : input;

    contents = {
      parts: [
        { inlineData: { mimeType, data } },
        { text: PROMPTS.IDENTIFY_IMAGE }
      ]
    };
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config: {
      tools,
      responseMimeType: "application/json",
      responseSchema: schema,
      // Add thinking budget if detailed mode is selected
      ...(aiMode === 'detailed' ? { thinkingConfig: { thinkingBudget: 1024 } } : {}),
    }
  });

  const text = response.text || "{}";
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.warn("JSON parse error", e);
  }

  // Attempt to extract URL from grounding metadata if not present in JSON
  let foundUrl = json.productUrl || "";
  const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!foundUrl && grounding) {
     for (const chunk of grounding) {
       if (chunk.web?.uri) {
         foundUrl = chunk.web.uri;
         break;
       }
     }
  }

  // Extract OG Image if possible
  let imageUrl = "";
  if (isUrlMode) {
    imageUrl = await extractOgImage(input) || "";
  } else if (foundUrl) {
    imageUrl = await extractOgImage(foundUrl) || "";
  }

  return {
    sku: json.sku || "UNKNOWN",
    name: json.name || "Unknown Product",
    material: json.material || "N/A",
    estimatedCost: json.estimatedCost || "N/A",
    retailer: json.retailer || "N/A",
    description: json.description || "No description available.",
    category: json.category || "Uncategorized",
    productUrl: foundUrl || (isUrlMode ? input : ""),
    imageUrl
  };
};

export const performQualityControl = async (
  apiKey: string,
  productDetails: ProductDetails,
  referenceImage: string,
  previousReports: QCReport[],
  inspectionImages: string[],
  aiMode: AiMode,
  isExpertMode: boolean
): Promise<QCReport> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelName = aiMode === 'detailed' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';

  const parts: any[] = [];

  // 1. Reference Image Part
  const refMatch = referenceImage.match(/^data:(.*?);base64,(.*)$/);
  if (refMatch) {
    parts.push({ inlineData: { mimeType: refMatch[1], data: refMatch[2] } });
    parts.push({ text: "REFERENCE (Golden Sample) Image" });
  }

  // 2. Inspection Images Parts
  inspectionImages.forEach((img, idx) => {
    const match = img.match(/^data:(.*?);base64,(.*)$/);
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      parts.push({ text: `Inspection Image ${idx + 1}` });
    }
  });

  // 3. Prompt Part
  const prompt = `
    Product Context:
    Name: ${productDetails.name} (${productDetails.sku})
    Material: ${productDetails.material}
    Description: ${productDetails.description}
    Previous Status: ${previousReports.length > 0 ? previousReports[0].status : "None"}

    Perform a full QC inspection based on the provided images.
  `;
  parts.push({ text: prompt });

  const schema = {
    type: Type.OBJECT,
    properties: {
      status: { type: Type.STRING, enum: ["PASS", "FAIL", "WARNING", "NEEDS_INFO"] },
      overallScore: { type: Type.NUMBER },
      summary: { type: Type.STRING },
      faults: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING },
            issue: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ["low", "medium", "critical"] }
          }
        }
      },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            score: { type: Type.NUMBER },
            status: { type: Type.STRING, enum: ["PASS", "FAIL", "WARNING", "INFO"] },
            details: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      },
      followUp: {
        type: Type.OBJECT,
        properties: {
          required: { type: Type.BOOLEAN },
          missingInfo: { type: Type.STRING },
          suggestedAngles: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    },
    required: ["status", "overallScore", "summary", "sections"]
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config: {
      systemInstruction: PROMPTS.QC_SYSTEM(isExpertMode),
      responseMimeType: "application/json",
      responseSchema: schema,
      ...(aiMode === 'detailed' ? { thinkingConfig: { thinkingBudget: 2048 } } : {}),
    }
  });

  const text = response.text || "{}";
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error("QC Parse Error", e);
    // Fallback error report
    return {
       id: generateUUID(),
       timestamp: Date.now(),
       status: QCStatus.FAIL,
       overallScore: 0,
       summary: "AI Failed to generate valid report.",
       faults: [],
       sections: [],
       followUp: { required: false, missingInfo: "AI Error", suggestedAngles: [] },
       images: inspectionImages,
       isExpertMode
    };
  }

  return {
    id: generateUUID(),
    timestamp: Date.now(),
    status: (json.status as QCStatus) || QCStatus.WARNING,
    overallScore: json.overallScore || 0,
    summary: json.summary || "",
    faults: json.faults || [],
    sections: json.sections || [],
    followUp: json.followUp || { required: false, missingInfo: "", suggestedAngles: [] },
    images: inspectionImages,
    isExpertMode
  };
};