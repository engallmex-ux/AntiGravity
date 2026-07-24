import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import net from "net";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { INVENTORY_DATA } from "./src/data/inventory";

dotenv.config();

const app = express();
const PORT = 3000;

// Setup directories for clinical database storage
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically with CORS headers to support iframe/PDF canvas extraction
app.use("/uploads", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
}, express.static(UPLOADS_DIR));

// Increase payload limit to handle base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Firebase Firestore
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseApp: any = null;
let firestoreDb: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    firebaseApp = initializeApp(config);
    firestoreDb = getFirestore(firebaseApp, config.firestoreDatabaseId || undefined);
    console.log("Firebase Firestore initialized successfully inside server.ts.");
  } catch (err) {
    console.error("Failed to initialize Firebase Firestore in server.ts:", err);
  }
} else {
  console.warn("firebase-applet-config.json not found. Firestore will not be available.");
}

// Lazy initialize Gemini API client with safety checks
let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined. AI features will fail until configured in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "dummy_key",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// -----------------------------------------------------------------------------
// Schema Definitions
// -----------------------------------------------------------------------------
const formFieldsSchema = {
  type: Type.OBJECT,
  properties: {
    equipamento: { 
      type: Type.STRING, 
      description: "Common name of the equipment (e.g., 'Monitor Multiparamétrico', 'Bomba de Infusão', 'Ventilador Pulmonar')" 
    },
    fabricante: { 
      type: Type.STRING, 
      description: "Manufacturer of the equipment (e.g., 'Lifemed', 'Philips', 'Dixtal', 'GE')" 
    },
    modelo: { 
      type: Type.STRING, 
      description: "Equipment model identifier" 
    },
    numSerie: { 
      type: Type.STRING, 
      description: "Serial Number (S/N, SN, Serial, No. Série)" 
    },
    numPatrimonio: { 
      type: Type.STRING, 
      description: "Asset Number / Tag (Patrimônio, Código de Barras, TAG, Pat.)" 
    },
    setor: {
      type: Type.STRING,
      description: "Sector, department or area of the hospital where the equipment belongs or is located (e.g., 'UTI Adulto', 'Pediatria', 'CC', 'SADT', 'CME'). Try to extract if visual clues or badges are present."
    },
    observacoes: {
      type: Type.STRING,
      description: "Any other observations, technical notes, visual diagnostics, annotations or comments found on the labels or equipment."
    },
    condicao: {
      type: Type.STRING,
      description: "Condition of the equipment. Must be exactly one of: 'Boa', 'Regular', 'Ruim', 'Não localizado', 'Em Manutenção'. Analyze visual signs of damage or offline state to decide, or default to 'Boa' if clean."
    },
    temCalibracao: { 
      type: Type.BOOLEAN, 
      description: "True if there is an active calibration label on the equipment" 
    },
    executadoPorCal: { 
      type: Type.STRING, 
      description: "Entity/Company/Technician that did the calibration" 
    },
    dataCal: { 
      type: Type.STRING, 
      description: "Date of last calibration in DD/MM/YYYY or YYYY-MM-DD format" 
    },
    proxCal: { 
      type: Type.STRING, 
      description: "Date of next calibration in DD/MM/YYYY or YYYY-MM-DD format" 
    },
    temManutencao: { 
      type: Type.BOOLEAN, 
      description: "True if there is an active preventive maintenance label" 
    },
    executadoPorManut: { 
      type: Type.STRING, 
      description: "Who did the preventive maintenance" 
    },
    dataManut: { 
      type: Type.STRING, 
      description: "Date of preventive maintenance" 
    },
    proxManut: { 
      type: Type.STRING, 
      description: "Date of next preventive maintenance" 
    },
    temSegurancaEletrica: { 
      type: Type.BOOLEAN, 
      description: "True if there is an active electrical safety verification label" 
    },
    executadoPorSegElet: { 
      type: Type.STRING, 
      description: "Who did the electrical safety test" 
    },
    dataSegElet: { 
      type: Type.STRING, 
      description: "Date of electrical safety test" 
    },
    proxSegElet: { 
      type: Type.STRING, 
      description: "Date of next electrical safety test" 
    },
  },
  required: [
    "equipamento", "fabricante", "modelo", "numSerie", "numPatrimonio",
    "setor", "observacoes", "condicao", "temCalibracao", "executadoPorCal",
    "dataCal", "proxCal", "temManutencao", "executadoPorManut", "dataManut",
    "proxManut", "temSegurancaEletrica", "executadoPorSegElet", "dataSegElet",
    "proxSegElet"
  ]
};

// -----------------------------------------------------------------------------
// Helper to extract base64 clean data
// -----------------------------------------------------------------------------
function cleanBase64(base64Str: string): { data: string; mimeType: string } {
  const match = base64Str.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2]
    };
  }
  return {
    mimeType: "image/jpeg", // Default
    data: base64Str
  };
}

// -----------------------------------------------------------------------------
// API Routes
// -----------------------------------------------------------------------------

// OCR Label processing route
app.post("/api/process-labels", async (req, res) => {
  try {
    const { images } = req.body; // Array of { base64: string, mimeType: string, labelType: string }
    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: "Nenhuma imagem foi enviada." });
      return;
    }

    const ai = getAiClient();
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ 
        error: "GEMINI_API_KEY não configurada nas variáveis de ambiente. Por favor, adicione sua chave de API nos Segredos (Settings > Secrets)." 
      });
      return;
    }

    // Convert images to Gemini Part objects
    const parts = images.map((img) => {
      const clean = cleanBase64(img.base64);
      return {
        inlineData: {
          mimeType: clean.mimeType,
          data: clean.data
        }
      };
    });

    const userPrompt = `
Você é um especialista em Engenharia Clínica e Manutenção Hospitalar.
Analise as imagens anexadas que representam etiquetas de identificação de equipamentos médicos.
Tente ler o máximo de informações possíveis, incluindo:
- Número de Série (S/N, Serial, Serial No., etc.)
- Número de Patrimônio (Patrimônio, TAG, código de barras)
- Características técnicas (Tensão de alimentação em V, Potência em W/VA, Frequência em Hz, Fabricante, Modelo)
- Etiqueta de calibração (Quem executou, data, próxima verificação)
- Etiqueta de manutenção preventiva (Quem realizou, data, próxima preventiva)
- Etiqueta de segurança elétrica (Quem executou, data, próxima segurança elétrica)

Atenção:
- Algumas informações podem estar espalhadas em diferentes etiquetas, ou todas na mesma foto. Cruze as informações de todas as fotos enviadas.
- Nem todos os equipamentos possuem todas as etiquetas (por exemplo, nem todos têm etiqueta de calibração ou segurança elétrica). Nesses casos, defina o 'temCalibracao', 'temManutencao' ou 'temSegurancaEletrica' correspondente para false, e deixe os respectivos campos de datas/responsáveis em branco.
- Retorne as datas preferencialmente no formato DD/MM/AAAA.
- Se não conseguir identificar um campo técnico, retorne uma string vazia ("").

Data Atual de Referência: ${new Date().toISOString().split('T')[0]} (Use para validar se as datas lidas fazem sentido).
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...parts,
        { text: userPrompt }
      ],
      config: {
        systemInstruction: "Você é um assistente de extração OCR ultra-preciso especializado em equipamentos médicos e engenharia clínica hospitalar. Você lê fotos de placas de características técnicas e etiquetas de calibração/manutenção preventiva, extraindo os dados estritamente em formato JSON.",
        responseMimeType: "application/json",
        responseSchema: formFieldsSchema,
        temperature: 0.1
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Resposta vazia recebida do Gemini API.");
    }

    const parsedData = JSON.parse(textOutput.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Erro no processamento de etiquetas:", error);
    res.status(500).json({ 
      error: "Falha ao processar imagens via OCR Inteligente.", 
      details: error.message 
    });
  }
});

// Voice Command adjustment route
app.post("/api/voice-command", async (req, res) => {
  try {
    const { voiceText, currentForm } = req.body;
    if (!voiceText) {
      res.status(400).json({ error: "Comando de voz não especificado." });
      return;
    }

    const ai = getAiClient();
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ 
        error: "GEMINI_API_KEY não configurada nas variáveis de ambiente." 
      });
      return;
    }

    const systemInstruction = `
Você é um assistente de voz inteligente para Engenharia Clínica. O usuário está revisando um formulário de calibração/manutenção e deu uma instrução falada (transcrita em texto) para atualizar os campos do formulário.
Analise a instrução e o estado atual do formulário. Aplique as modificações ditadas pelo usuário e retorne o formulário atualizado no mesmo formato JSON.
Mantenha inalterados todos os campos que não foram de alguma forma abordados na instrução de voz.
Valores booleanos devem ser verdadeiros se o usuário disser que possui ou que foi feito, ou falsos se disser que não tem ou para remover.
Exemplos de conversão:
- "Mudar número de série para 8877" -> numSerie = "8877"
- "Não tem calibração" -> temCalibracao = false, executadoPorCal = "", dataCal = "", proxCal = ""
- "Coloca o modelo como Dx500" -> modelo = "Dx500"
- "Coloca no setor UTI Adulto" -> setor = "UTI Adulto"
- "Observação equipamento com marcas de uso" -> observacoes = "equipamento com marcas de uso"
`;

    const userPrompt = `
Instrução de voz do usuário: "${voiceText}"

Estado atual do formulário (JSON):
${JSON.stringify(currentForm, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: formFieldsSchema,
        temperature: 0.1
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Resposta de voz vazia.");
    }

    const updatedData = JSON.parse(textOutput.trim());
    res.json(updatedData);
  } catch (error: any) {
    console.error("Erro no comando de voz:", error);
    res.status(500).json({ 
      error: "Falha ao interpretar comando de voz.", 
      details: error.message 
    });
  }
});

// Scan QR code or Asset tag from image using Gemini 3.5 Flash
app.post("/api/scan-qrcode", async (req, res) => {
  try {
    const { image } = req.body; // base64 string
    if (!image) {
      res.status(400).json({ error: "Nenhuma imagem foi enviada para escanear." });
      return;
    }

    const ai = getAiClient();
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ 
        error: "GEMINI_API_KEY não configurada nas variáveis de ambiente. Não é possível ler o QR Code com a Visão Computacional." 
      });
      return;
    }

    const clean = cleanBase64(image);
    const part = {
      inlineData: {
        mimeType: clean.mimeType,
        data: clean.data
      }
    };

    const userPrompt = `
    Você é um leitor óptico inteligente de QR Codes e Etiquetas de Patrimônio do Hospital Universitário (HU).
    Analise a imagem enviada. Ela contém um QR Code impresso em uma etiqueta de patrimônio com o padrão HU-SIGLA-SEQUENCIAL-ORB (por exemplo: HU-SVI-000001-ORB).
    Foque especificamente no QR code ou no texto da etiqueta para ler e extrair este código exclusivo.
    
    Atenção:
    - Extraia EXATAMENTE o texto do código no formato HU-...-ORB, se presente, no campo 'code'.
    - Se houver outros identificadores por extenso legíveis (como Número de Série ou Patrimônio auxiliar), retorne-os também.
    - Se não encontrar nenhum código no formato HU-...-ORB, mas identificar algum outro patrimônio ou serial, preencha-os e deixe o 'code' em branco.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [part, { text: userPrompt }],
      config: {
        systemInstruction: "Você é um leitor altamente preciso de QR Codes e etiquetas de patrimônio hospitalar. Retorne os dados estritamente em formato JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING, description: "O código exclusivo HU-...-ORB encontrado" },
            numSerie: { type: Type.STRING, description: "Número de série por extenso se estiver legível na etiqueta" },
            numPatrimonio: { type: Type.STRING, description: "Número de patrimônio por extenso se legível" }
          },
          required: ["code", "numSerie", "numPatrimonio"]
        },
        temperature: 0.1
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Não foi possível obter resposta do processamento visual.");
    }

    const parsedData = JSON.parse(textOutput.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Erro ao escanear QR Code/Etiqueta via IA:", error);
    res.status(500).json({ 
      error: "Falha ao ler QR Code via IA Vision.", 
      details: error.message 
    });
  }
});

// -----------------------------------------------------------------------------
// Durable Server-Side Inspections Database API (Firestore Powered)
// -----------------------------------------------------------------------------
const INSPECTIONS_FILE = path.join(DATA_DIR, "inspections.json");

function readInspections(): any[] {
  if (!fs.existsSync(INSPECTIONS_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(INSPECTIONS_FILE, "utf-8");
    return JSON.parse(content || "[]");
  } catch (err) {
    console.error("Error reading inspections file:", err);
    return [];
  }
}

function writeInspections(data: any[]): void {
  try {
    fs.writeFileSync(INSPECTIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing inspections file:", err);
  }
}

// Get all inspections
app.get("/api/inspections", async (req, res) => {
  try {
    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "inspections"));
        const list: any[] = [];
        querySnapshot.forEach((docSnapshot) => {
          list.push(docSnapshot.data());
        });
        
        // Sort by timestamp descending
        list.sort((a, b) => {
          const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tB - tA;
        });

        // Sync local cache
        writeInspections(list);
        res.json(list);
        return;
      } catch (dbErr) {
        console.warn("Firestore error reading inspections, using local file cache:", dbErr);
      }
    }
    const list = readInspections();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: "Falha ao ler banco de dados de inspeções." });
  }
});

// Save / sync inspections from the client
app.post("/api/inspections", async (req, res) => {
  try {
    const { record } = req.body; // Individual inspection record
    if (!record || !record.id) {
      res.status(400).json({ error: "Registro inválido ou sem ID." });
      return;
    }

    // Deep copy/processing of images to files
    if (record.images && Array.isArray(record.images)) {
      record.images = record.images.map((img: any) => {
        if (img.base64 && img.base64.startsWith("data:")) {
          try {
            const clean = cleanBase64(img.base64);
            const ext = clean.mimeType.split("/")[1] || "jpeg";
            const filename = `${record.id}_${img.id}.${ext}`;
            const filePath = path.join(UPLOADS_DIR, filename);

            // Write base64 to real file on disk
            fs.writeFileSync(filePath, Buffer.from(clean.data, "base64"));
            
            // Return updated image object
            return {
              ...img,
              base64: "", // Clear the base64 string to keep JSON database extremely light!
              url: `/uploads/${filename}` // Static file access url
            };
          } catch (imgErr: any) {
            console.error("Error writing image to server disk:", imgErr);
            return img;
          }
        }
        return img;
      });
    }

    // Save to Firestore first
    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, "inspections", record.id), record);
      } catch (dbErr) {
        console.warn("Firestore error writing inspection:", dbErr);
      }
    }

    // Always keep local list updated as well as a fallback cache
    const currentList = readInspections();
    const idx = currentList.findIndex((item: any) => item.id === record.id);
    if (idx >= 0) {
      currentList[idx] = { ...currentList[idx], ...record };
    } else {
      currentList.unshift(record);
    }
    writeInspections(currentList);

    // Save JSON History entry locally and to firestore (if present)
    try {
      saveJsonHistorico(record);
    } catch (histErr) {
      console.warn("Could not auto-generate JSON history entry:", histErr);
    }

    res.json({ success: true, record });
  } catch (error: any) {
    console.error("Error saving inspection:", error);
    res.status(500).json({ error: "Falha ao persistir inspeção no servidor.", details: error.message });
  }
});

// Delete specific inspection
app.delete("/api/inspections/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete from Firestore
    if (firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, "inspections", id));
      } catch (dbErr) {
        console.warn("Firestore error deleting inspection:", dbErr);
      }
    }

    let list = readInspections();
    const record = list.find((item: any) => item.id === id);

    if (record && record.images && Array.isArray(record.images)) {
      record.images.forEach((img: any) => {
        if (img.url) {
          const filename = path.basename(img.url);
          const filePath = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (err) {
              console.error("Error deleting image file:", err);
            }
          }
        }
      });
    }

    list = list.filter((item: any) => item.id !== id);
    writeInspections(list);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao excluir inspeção no servidor." });
  }
});

// Clear all inspections database
app.delete("/api/inspections", async (req, res) => {
  try {
    const list = readInspections();
    // Delete files
    list.forEach((record: any) => {
      if (record.images && Array.isArray(record.images)) {
        record.images.forEach((img: any) => {
          if (img.url) {
            const filename = path.basename(img.url);
            const filePath = path.join(UPLOADS_DIR, filename);
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (err) {}
            }
          }
        });
      }
    });

    // Delete from Firestore
    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "inspections"));
        for (const docSnapshot of querySnapshot.docs) {
          await deleteDoc(doc(firestoreDb, "inspections", docSnapshot.id));
        }
      } catch (dbErr) {
        console.warn("Firestore error clearing inspections:", dbErr);
      }
    }

    writeInspections([]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Falha ao limpar banco de dados." });
  }
});

// -----------------------------------------------------------------------------
// Durable Server-Side Historical JSON Records Database API (Firestore & Local)
// -----------------------------------------------------------------------------
const HISTORICOS_DIR = path.join(DATA_DIR, "historicos");
if (!fs.existsSync(HISTORICOS_DIR)) {
  fs.mkdirSync(HISTORICOS_DIR, { recursive: true });
}

function getInitials(name?: string): string {
  if (!name) return "TEC";
  const clean = name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TEC";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 3);
}

function saveJsonHistorico(record: any): any {
  const code = (record.ativoCodigo || '').trim().replace(/[^a-zA-Z0-9-]/g, '_');
  const initials = getInitials(record.auditorNome);
  const now = new Date();
  const dateStr = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const timeStr = String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0');
  
  const fileName = `${code || "HU-TEC-000000-ORB"}_${dateStr}_${timeStr}_${initials}.json`;
  const id = `${record.id}_${dateStr}_${timeStr}`;

  const historyItem = {
    id,
    recordId: record.id,
    ativoCodigo: record.ativoCodigo || '',
    timestamp: now.toISOString(),
    fileName,
    auditorInitials: initials,
    auditorName: record.auditorNome || 'Técnico Local',
    record
  };

  // Write local file
  const filePath = path.join(HISTORICOS_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(historyItem, null, 2), "utf-8");

  // Save to Firestore
  if (firestoreDb) {
    setDoc(doc(firestoreDb, "historicos", id), historyItem)
      .catch(err => console.warn("Firestore error saving history item:", err));
  }

  return historyItem;
}

function readHistoricosLocais(): any[] {
  try {
    const files = fs.readdirSync(HISTORICOS_DIR);
    const list: any[] = [];
    files.forEach(file => {
      if (file.endsWith(".json")) {
        try {
          const content = fs.readFileSync(path.join(HISTORICOS_DIR, file), "utf-8");
          const parsed = JSON.parse(content);
          list.push(parsed);
        } catch (e) {
          console.error("Error reading JSON history file:", file, e);
        }
      }
    });
    return list;
  } catch (err) {
    console.error("Error reading historicos directory:", err);
    return [];
  }
}

// Get all JSON histories
app.get("/api/historicos", async (req, res) => {
  try {
    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "historicos"));
        const list: any[] = [];
        querySnapshot.forEach((docSnapshot) => {
          list.push(docSnapshot.data());
        });
        
        // Sort by timestamp descending
        list.sort((a, b) => {
          const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tB - tA;
        });

        // Sync local cache
        list.forEach((item: any) => {
          const filePath = path.join(HISTORICOS_DIR, `${item.id}.json`);
          if (!fs.existsSync(filePath)) {
            try {
              fs.writeFileSync(filePath, JSON.stringify(item, null, 2), "utf-8");
            } catch (err) {}
          }
        });

        res.json(list);
        return;
      } catch (dbErr) {
        console.warn("Firestore error reading historicos, falling back to local files:", dbErr);
      }
    }

    const localList = readHistoricosLocais();
    localList.sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tB - tA;
    });
    res.json(localList);
  } catch (error: any) {
    console.error("Error fetching historicos:", error);
    res.status(500).json({ error: "Falha ao ler os históricos no servidor." });
  }
});

// Delete specific JSON history entry
app.delete("/api/historicos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete from Firestore
    if (firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, "historicos", id));
      } catch (dbErr) {
        console.warn("Firestore error deleting historico:", dbErr);
      }
    }

    // Delete from local filesystem
    const filePath = path.join(HISTORICOS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error("Error deleting local history JSON file:", err);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao excluir histórico no servidor." });
  }
});

// Clear all JSON histories
app.delete("/api/historicos", async (req, res) => {
  try {
    const list = readHistoricosLocais();
    list.forEach((item: any) => {
      const filePath = path.join(HISTORICOS_DIR, `${item.id}.json`);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {}
      }
    });

    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "historicos"));
        for (const docSnapshot of querySnapshot.docs) {
          await deleteDoc(doc(firestoreDb, "historicos", docSnapshot.id));
        }
      } catch (dbErr) {
        console.warn("Firestore error clearing historicos:", dbErr);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Falha ao limpar históricos de backups." });
  }
});

// -----------------------------------------------------------------------------
// Centralized Users Database API (Firestore Powered)
// -----------------------------------------------------------------------------
const USERS_FILE = path.join(DATA_DIR, "users.json");

function readUsers(): any[] {
  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = [
      {
        name: "Administrador Geral",
        email: "admin@orbis.com",
        passwordHash: Buffer.from("admin123").toString("base64"),
        recoveryEmail: "admin.recovery@orbis.com",
        role: "admin"
      },
      {
        name: "Técnico de Engenharia",
        email: "tecnico@orbis.com",
        passwordHash: Buffer.from("user123").toString("base64"),
        recoveryEmail: "user.recovery@orbis.com",
        role: "user"
      }
    ];
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), "utf-8");
      return defaultUsers;
    } catch (e) {
      console.error("Error creating default users file:", e);
      return [];
    }
  }
  try {
    const content = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(content || "[]");
  } catch (err) {
    console.error("Error reading users file:", err);
    return [];
  }
}

function writeUsers(data: any[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing users file:", err);
  }
}

// Get all users (Admin view)
app.get("/api/users", async (req, res) => {
  try {
    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "users"));
        const usersList: any[] = [];
        querySnapshot.forEach((docSnapshot) => {
          usersList.push(docSnapshot.data());
        });

        // Initialize with default users if completely empty in Firestore
        if (usersList.length === 0) {
          const defaultUsers = [
            {
              name: "Administrador Geral",
              email: "admin@orbis.com",
              passwordHash: Buffer.from("admin123").toString("base64"),
              recoveryEmail: "admin.recovery@orbis.com",
              role: "admin"
            },
            {
              name: "Técnico de Engenharia",
              email: "tecnico@orbis.com",
              passwordHash: Buffer.from("user123").toString("base64"),
              recoveryEmail: "user.recovery@orbis.com",
              role: "user"
            }
          ];
          for (const u of defaultUsers) {
            await setDoc(doc(firestoreDb, "users", u.email.toLowerCase()), u);
          }
          writeUsers(defaultUsers);
          res.json(defaultUsers);
          return;
        }

        writeUsers(usersList);
        res.json(usersList);
        return;
      } catch (dbErr) {
        console.warn("Firestore error reading users, falling back to local file:", dbErr);
      }
    }
    const users = readUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Erro ao obter lista de usuários." });
  }
});

// Create/Update user profile or password
app.post("/api/users", async (req, res) => {
  try {
    const { name, email, password, passwordHash, recoveryEmail, role, re } = req.body;
    if (!email) {
      res.status(400).json({ error: "E-mail é obrigatório." });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    let existingUser: any = null;

    // Get current users list
    let usersList: any[] = [];
    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "users"));
        querySnapshot.forEach((docSnapshot) => {
          usersList.push(docSnapshot.data());
        });
        existingUser = usersList.find(u => u.email.toLowerCase() === cleanEmail);
      } catch (dbErr) {
        console.warn("Firestore error reading users in POST, using local fallback:", dbErr);
      }
    }

    if (!existingUser) {
      const localUsers = readUsers();
      usersList = localUsers;
      existingUser = localUsers.find(u => u.email.toLowerCase() === cleanEmail);
    }

    let hash = passwordHash;
    if (password) {
      hash = Buffer.from(password).toString("base64");
    }

    const updatedUser = {
      name: name || (existingUser ? existingUser.name : "Novo Técnico"),
      email: cleanEmail,
      passwordHash: hash || (existingUser ? existingUser.passwordHash : Buffer.from("user123").toString("base64")),
      recoveryEmail: recoveryEmail || (existingUser ? existingUser.recoveryEmail : ""),
      role: role || (existingUser ? existingUser.role : "user"),
      re: re || (existingUser ? existingUser.re : "")
    };

    // Save to Firestore
    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, "users", cleanEmail), updatedUser);
      } catch (dbErr) {
        console.warn("Firestore error saving user:", dbErr);
      }
    }

    // Save to local file
    const idx = usersList.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      usersList[idx] = updatedUser;
    } else {
      usersList.push(updatedUser);
    }
    writeUsers(usersList);

    res.json({ success: true, user: { name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, re: updatedUser.re } });
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar usuário no servidor." });
  }
});

// Delete user
app.delete("/api/users/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const cleanEmail = email.trim().toLowerCase();

    let usersList: any[] = [];
    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "users"));
        querySnapshot.forEach((docSnapshot) => {
          usersList.push(docSnapshot.data());
        });
      } catch (dbErr) {
        console.warn("Firestore error reading users in DELETE, using local fallback:", dbErr);
      }
    }

    if (usersList.length === 0) {
      usersList = readUsers();
    }

    // Prevent deleting the last admin
    const userToDelete = usersList.find(u => u.email.toLowerCase() === cleanEmail);
    if (userToDelete?.role === "admin") {
      const adminsCount = usersList.filter(u => u.role === "admin").length;
      if (adminsCount <= 1) {
        res.status(400).json({ error: "Não é permitido excluir o único administrador do sistema." });
        return;
      }
    }

    // Delete from Firestore
    if (firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, "users", cleanEmail));
      } catch (dbErr) {
        console.warn("Firestore error deleting user:", dbErr);
      }
    }

    const filteredUsers = usersList.filter(u => u.email.toLowerCase() !== cleanEmail);
    writeUsers(filteredUsers);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar usuário do servidor." });
  }
});

// Check user credentials (Login endpoint)
app.post("/api/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Usuário/E-mail e senha são obrigatórios." });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    let usersList: any[] = [];

    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "users"));
        querySnapshot.forEach((docSnapshot) => {
          usersList.push(docSnapshot.data());
        });
      } catch (dbErr) {
        console.warn("Firestore error reading users in Login, using local fallback:", dbErr);
      }
    }

    if (usersList.length === 0) {
      usersList = readUsers();
    }

    const user = usersList.find(u => 
      u.email.toLowerCase() === cleanEmail || 
      u.email.toLowerCase().split('@')[0] === cleanEmail
    );

    if (!user) {
      res.status(401).json({ error: "Usuário não cadastrado." });
      return;
    }

    const inputHash = Buffer.from(password).toString("base64");
    if (user.passwordHash !== inputHash) {
      res.status(401).json({ error: "Senha incorreta." });
      return;
    }

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        role: user.role || "user",
        isGoogle: false,
        re: user.re || ""
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Erro no servidor de login." });
  }
});

// -----------------------------------------------------------------------------
// Centralized Assets/Inventory Database API (Firestore Powered)
// -----------------------------------------------------------------------------
const INVENTORY_FILE = path.join(DATA_DIR, "inventory.json");

function readInventory() {
  if (fs.existsSync(INVENTORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(INVENTORY_FILE, "utf-8"));
    } catch (err) {
      console.error("Error reading inventory file:", err);
    }
  }
  return INVENTORY_DATA;
}

function writeInventory(list: any[]) {
  try {
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing inventory file:", err);
  }
}

// Get all inventory items
app.get("/api/inventory", async (req, res) => {
  try {
    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "inventory"));
        const list: any[] = [];
        querySnapshot.forEach((docSnapshot) => {
          list.push(docSnapshot.data());
        });

        if (list.length === 0) {
          // Seed Firestore with default INVENTORY_DATA
          console.log("Seeding Firestore with default inventory items...");
          for (const item of INVENTORY_DATA) {
            const docId = (item.identificador || `ITEM-${Math.random().toString(36).substr(2, 9)}`).trim().replace(/[\/\\#?%*:|"<>]/g, '_');
            await setDoc(doc(firestoreDb, "inventory", docId), item);
          }
          writeInventory(INVENTORY_DATA);
          res.json(INVENTORY_DATA);
          return;
        }

        writeInventory(list);
        res.json(list);
        return;
      } catch (dbErr) {
        console.warn("Firestore error reading inventory, using local fallback:", dbErr);
      }
    }
    const list = readInventory();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar base de dados de ativos." });
  }
});

// Update or add an inventory item
app.post("/api/inventory", async (req, res) => {
  try {
    const { item } = req.body;
    if (!item || !item.identificador) {
      res.status(400).json({ error: "Item de inventário inválido." });
      return;
    }

    if (firestoreDb) {
      try {
        const docId = item.identificador.trim().replace(/[\/\\#?%*:|"<>]/g, '_');
        await setDoc(doc(firestoreDb, "inventory", docId), item);
      } catch (dbErr) {
        console.warn("Firestore error writing inventory item:", dbErr);
      }
    }

    const currentList = readInventory();
    const idx = currentList.findIndex((it: any) => it.identificador === item.identificador);
    if (idx >= 0) {
      currentList[idx] = item;
    } else {
      currentList.push(item);
    }
    writeInventory(currentList);

    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar ativo no servidor." });
  }
});

// Bulk update inventory list
app.post("/api/inventory/bulk", async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      res.status(400).json({ error: "Lista de ativos inválida." });
      return;
    }

    if (firestoreDb) {
      try {
        for (const item of items) {
          if (item.identificador) {
            const docId = item.identificador.trim().replace(/[\/\\#?%*:|"<>]/g, '_');
            await setDoc(doc(firestoreDb, "inventory", docId), item);
          }
        }
      } catch (dbErr) {
        console.warn("Firestore error bulk updating inventory:", dbErr);
      }
    }

    writeInventory(items);
    res.json({ success: true, count: items.length });
  } catch (err) {
    res.status(500).json({ error: "Erro ao sincronizar lote de ativos." });
  }
});

// Delete an inventory item
app.delete("/api/inventory/:identificador", async (req, res) => {
  try {
    const { identificador } = req.params;
    if (firestoreDb) {
      try {
        const docId = identificador.trim().replace(/[\/\\#?%*:|"<>]/g, '_');
        await deleteDoc(doc(firestoreDb, "inventory", docId));
      } catch (dbErr) {
        console.warn("Firestore error deleting inventory item:", dbErr);
      }
    }

    let currentList = readInventory();
    currentList = currentList.filter((it: any) => it.identificador !== identificador);
    writeInventory(currentList);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir ativo do servidor." });
  }
});

// -----------------------------------------------------------------------------
// Centralized Sectors/Rooms Database API (Firestore Powered)
// -----------------------------------------------------------------------------
const SECTORS_FILE = path.join(DATA_DIR, "sectors.json");

const DEFAULT_SECTORS = [
  // 1. Blocos Críticos e Cirúrgicos
  { id: "CC", name: "CC - UBCPME - CC", description: "Unidade de Bloco Cirúrgico", category: "Blocos Críticos e Cirúrgicos", floor: "2º Andar", x: 42, y: 52, latitude: -23.55052, longitude: -46.633308 },
  { id: "CLIN_CIR", name: "Clínica Cirúrgica", description: "Enfermaria de Clínica Cirúrgica Geral", category: "Blocos Críticos e Cirúrgicos", floor: "2º Andar", x: 48, y: 56, latitude: -23.55061, longitude: -46.63342 },
  { id: "CME", name: "CME - UBCPME - CME", description: "Centro de Material e Esterilização / CME", category: "Blocos Críticos e Cirúrgicos", floor: "2º Andar", x: 28, y: 72, latitude: -23.55073, longitude: -46.63351 },

  // 2. Unidades de Terapia e Urgência
  { id: "UTIA", name: "UTIA - UCRIT-UTI", description: "UTI Adulto - Suporte de Vida Avançado", category: "Unidades de Terapia e Urgência", floor: "3º Andar", x: 55, y: 30, latitude: -23.55082, longitude: -46.63364 },
  { id: "UTIPED", name: "UTIPED", description: "UTI Pediátrica - Cuidados Intensivos Pediátricos", category: "Unidades de Terapia e Urgência", floor: "3º Andar", x: 60, y: 35, latitude: -23.55091, longitude: -46.63375 },
  { id: "PAA", name: "PAA - UCRIT-PA", description: "Pronto Atendimento / Urgência e Emergência", category: "Unidades de Terapia e Urgência", floor: "Térreo", x: 22, y: 28, latitude: -23.55104, longitude: -46.63386 },

  // 3. Enfermarias e Clínicas Especializadas
  { id: "UCMC", name: "UCMC - UCMC", description: "Unidade de Clínica Médica / Cuidados Coronários", category: "Enfermarias e Clínicas Especializadas", floor: "1º Andar", x: 55, y: 75, latitude: -23.55115, longitude: -46.63397 },
  { id: "PAI", name: "PAI - UCA-PA", description: "Pronto Atendimento Infantil", category: "Enfermarias e Clínicas Especializadas", floor: "Térreo", x: 68, y: 52, latitude: -23.55122, longitude: -46.63401 },
  { id: "UCAI", name: "UCAI - UCA-INT", description: "Internação da Criança e Adolescentes", category: "Enfermarias e Clínicas Especializadas", floor: "1º Andar", x: 72, y: 48, latitude: -23.55135, longitude: -46.63412 },
  { id: "AMB", name: "AMB - DENF - AMB", description: "Ambulatório Geral de Especialidades Médicas", category: "Enfermarias e Clínicas Especializadas", floor: "Térreo", x: 18, y: 52, latitude: -23.55146, longitude: -46.63423 },
  { id: "USM", name: "USM", description: "Unidade de Saúde Mental", category: "Enfermarias e Clínicas Especializadas", floor: "1º Andar", x: 80, y: 80, latitude: -23.55157, longitude: -46.63434 },
  { id: "UNEF", name: "UNEF", description: "Unidade de Nefrologia / Hemodiálise", category: "Enfermarias e Clínicas Especializadas", floor: "1º Andar", x: 85, y: 40, latitude: -23.55168, longitude: -46.63445 },

  // 4. Apoio Diagnóstico, Logística e Pesquisa
  { id: "ENDO", name: "ENDO - UDIDE-END-DIG", description: "Endoscopia / Diagnósticos Especializados", category: "Apoio Diagnóstico, Logística e Pesquisa", floor: "Térreo", x: 78, y: 32, latitude: -23.55179, longitude: -46.63456 },
  { id: "RAD", name: "RAD", description: "Unidade de Diagnóstico por Imagem e Radiologia", category: "Apoio Diagnóstico, Logística e Pesquisa", floor: "Térreo", x: 82, y: 36, latitude: -23.55181, longitude: -46.63467 },
  { id: "UDIDE_MG_ECG", name: "UDIDE-MG-ECG", description: "Unidade de Diagnóstico de Cardiologia / ECG", category: "Apoio Diagnóstico, Logística e Pesquisa", floor: "Térreo", x: 86, y: 42, latitude: -23.55192, longitude: -46.63478 },
  { id: "LAB", name: "LAB", description: "Laboratório de Análises Clínicas e Anatomia Patológica", category: "Apoio Diagnóstico, Logística e Pesquisa", floor: "Térreo", x: 90, y: 50, latitude: -23.55203, longitude: -46.63489 },
  { id: "SAFS", name: "SAFS", description: "Setor de Abastecimento Farmacêutico e Suprimentos", category: "Apoio Diagnóstico, Logística e Pesquisa", floor: "Subsolo", x: 10, y: 85, latitude: -23.55214, longitude: -46.63491 },
  { id: "SFHC", name: "SFHC", description: "Unidade de Farmácia Clínica e Dispensação Farmacêutica", category: "Apoio Diagnóstico, Logística e Pesquisa", floor: "Térreo", x: 15, y: 75, latitude: -23.55225, longitude: -46.63502 },
  { id: "GEP", name: "GEP", description: "Unidade de Pesquisa Clínica / Gestão de Ensino", category: "Apoio Diagnóstico, Logística e Pesquisa", floor: "1º Andar", x: 30, y: 20, latitude: -23.55236, longitude: -46.63513 },
  { id: "SOST", name: "SOST - SOST", description: "Unidade de Saúde Ocupacional e Segurança do Trabalho", category: "Apoio Diagnóstico, Logística e Pesquisa", floor: "Térreo", x: 92, y: 20, latitude: -23.55247, longitude: -46.63524 },

  // 5. Áreas Técnicas e de Gestão
  { id: "ENG_CLINICA", name: "ENG. CLINICA", description: "Engenharia Clínica - Manutenção de Ativos", category: "Áreas Técnicas e de Gestão", floor: "Subsolo", x: 35, y: 85, latitude: -23.55258, longitude: -46.63535 },
  { id: "STEC", name: "STEC - STEC", description: "Sessão de Tecnologia e Infraestrutura de TI", category: "Áreas Técnicas e de Gestão", floor: "Subsolo", x: 45, y: 85, latitude: -23.55269, longitude: -46.63546 },
  { id: "SGPIT", name: "SGPIT - SGPIT", description: "SGPIT - Tecnologia, Gestão e Engenharia Clínica", category: "Áreas Técnicas e de Gestão", floor: "1º Andar", x: 52, y: 25, latitude: -23.55271, longitude: -46.63557 },
  { id: "SEGE", name: "SEGE - SEGE", description: "Setor de Gestão e Administrativo Geral", category: "Áreas Técnicas e de Gestão", floor: "1º Andar", x: 82, y: 72, latitude: -23.55282, longitude: -46.63568 }
];

function readSectors() {
  if (fs.existsSync(SECTORS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SECTORS_FILE, "utf-8"));
    } catch (err) {
      console.error("Error reading sectors file:", err);
    }
  }
  return DEFAULT_SECTORS;
}

function writeSectors(list: any[]) {
  try {
    fs.writeFileSync(SECTORS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing sectors file:", err);
  }
}

// Reset sectors to default presets
app.post("/api/sectors/reset-defaults", async (req, res) => {
  try {
    if (firestoreDb) {
      try {
        // Delete existing sectors first from Firestore
        const querySnapshot = await getDocs(collection(firestoreDb, "sectors"));
        for (const docSnapshot of querySnapshot.docs) {
          await deleteDoc(doc(firestoreDb, "sectors", docSnapshot.id));
        }
        // Write defaults
        for (const s of DEFAULT_SECTORS) {
          await setDoc(doc(firestoreDb, "sectors", s.id), s);
        }
      } catch (dbErr) {
        console.warn("Firestore error resetting sectors:", dbErr);
      }
    }
    writeSectors(DEFAULT_SECTORS);
    res.json({ success: true, list: DEFAULT_SECTORS });
  } catch (err) {
    res.status(500).json({ error: "Erro ao resetar banco de setores para os padrões." });
  }
});

// Get all sectors
app.get("/api/sectors", async (req, res) => {
  try {
    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, "sectors"));
        const list: any[] = [];
        querySnapshot.forEach((docSnapshot) => {
          list.push(docSnapshot.data());
        });

        if (list.length === 0) {
          // Seed Firestore with default DEFAULT_SECTORS
          console.log("Seeding Firestore with default sectors...");
          for (const s of DEFAULT_SECTORS) {
            await setDoc(doc(firestoreDb, "sectors", s.id), s);
          }
          writeSectors(DEFAULT_SECTORS);
          res.json(DEFAULT_SECTORS);
          return;
        }

        writeSectors(list);
        res.json(list);
        return;
      } catch (dbErr) {
        console.warn("Firestore error reading sectors, using local fallback:", dbErr);
      }
    }
    const list = readSectors();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar base de dados de setores." });
  }
});

// Create/Update a sector
app.post("/api/sectors", async (req, res) => {
  try {
    const { sector } = req.body;
    if (!sector || !sector.id || !sector.name) {
      res.status(400).json({ error: "Setor inválido. ID e Nome são necessários." });
      return;
    }

    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, "sectors", sector.id), sector);
      } catch (dbErr) {
        console.warn("Firestore error saving sector:", dbErr);
      }
    }

    const currentList = readSectors();
    const idx = currentList.findIndex((s: any) => s.id === sector.id);
    if (idx >= 0) {
      currentList[idx] = sector;
    } else {
      currentList.push(sector);
    }
    writeSectors(currentList);

    res.json({ success: true, sector });
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar setor no servidor." });
  }
});

// Delete a sector
app.delete("/api/sectors/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, "sectors", id));
      } catch (dbErr) {
        console.warn("Firestore error deleting sector:", dbErr);
      }
    }

    let currentList = readSectors();
    currentList = currentList.filter((s: any) => s.id !== id);
    writeSectors(currentList);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir setor do servidor." });
  }
});

// -----------------------------------------------------------------------------
// Centralized Asset Tag Sequential Counter API (Firestore Powered)
// -----------------------------------------------------------------------------
const SEQUENCES_FILE = path.join(DATA_DIR, "tag_sequences.json");
const DEFAULT_SEQUENCES = { DTI: 1, MET: 1, SVI: 1, MON: 1, TER: 1, TERM: 1 };

function readSequences(): any {
  if (fs.existsSync(SEQUENCES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SEQUENCES_FILE, "utf-8"));
    } catch (err) {
      console.error("Error reading tag sequences file:", err);
    }
  }
  return { ...DEFAULT_SEQUENCES };
}

function writeSequences(seqs: any) {
  try {
    fs.writeFileSync(SEQUENCES_FILE, JSON.stringify(seqs, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing tag sequences file:", err);
  }
}

// Get all sequences
app.get("/api/tag-sequences", async (req, res) => {
  try {
    if (firestoreDb) {
      try {
        const docRef = doc(firestoreDb, "tag_sequences", "counters");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          writeSequences(data);
          res.json(data);
          return;
        } else {
          // Initialize in Firestore
          await setDoc(docRef, DEFAULT_SEQUENCES);
          writeSequences(DEFAULT_SEQUENCES);
          res.json(DEFAULT_SEQUENCES);
          return;
        }
      } catch (dbErr) {
        console.warn("Firestore error reading tag sequences, using local fallback:", dbErr);
      }
    }
    res.json(readSequences());
  } catch (err) {
    res.status(500).json({ error: "Erro ao obter sequências de etiquetas." });
  }
});

// Update or increment a specific sequence
app.post("/api/tag-sequences/increment", async (req, res) => {
  try {
    const { sigla, value } = req.body;
    if (!sigla || !["DTI", "MET", "SVI", "MON", "TER", "TERM"].includes(sigla)) {
      res.status(400).json({ error: "Sigla inválida ou não informada." });
      return;
    }

    let seqs = readSequences();
    if (firestoreDb) {
      try {
        const docRef = doc(firestoreDb, "tag_sequences", "counters");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          seqs = docSnap.data();
        }
      } catch (dbErr) {
        console.warn("Firestore error reading tag sequences for increment, using local:", dbErr);
      }
    }

    if (value !== undefined) {
      seqs[sigla] = Number(value);
    } else {
      seqs[sigla] = (seqs[sigla] || 0) + 1;
    }

    // Save back to Firestore
    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, "tag_sequences", "counters"), seqs);
      } catch (dbErr) {
        console.warn("Firestore error writing tag sequences:", dbErr);
      }
    }

    writeSequences(seqs);
    res.json(seqs);
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar sequência de etiquetas." });
  }
});

// -----------------------------------------------------------------------------
// Google Service Account Authentication & Central Cloud Storage Operations
// -----------------------------------------------------------------------------
import crypto from 'crypto';

const DEFAULT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDD3TzY3KHf7ypY\nUPp1X0d3zz7T/athDXJ7vXwPxJnqjWgez28k/bcjQaS7lwgmtHazfDw//bSxflSq\npl3lLaFzRE4HpYPwrcpqzUzGVIEP651UI5e0R8zdKna+y6acMrpRFBMRH+7rFYfa\nOotJFL2AUnpHZL2stfowZaoYxMBgkIoakOWbETfgQjM51YHEFIrcZuf8KVhfQMIs\nS/KH5hWjojR7FafURAoLgaaur7O7qyo9rQZhVMnBoRO4T54jP5Ku12e8rFn1DG2X\nJ4OIj9M5euTVGf2XmvDamM7tTl7ukE/BRmrQ6LSrXJOeY06Zpae7pRWkfpM6bh36\nsdwDJgybAgMBAAECggEACc03hKQTQbvxQuGCjH8hJMttRHnsVVCxSvn3jGkf9A9G\n3PaFLwpiBin8eXAcdftlTqQdS8KBhA8ODkrXELymLg4xWCFIp1xlxc8nqWvZ2EHH\n6h8B3Na/AiO5ijYczLJJL/zbhhQysPcEiRTm8C2mh2vD4htrgTTLeW03ruz3B539\nrpTjmk31nZOCrAo0acR3RdULP2PQngkp6m+WLG/TGgbAgN0jbhu7dvPO/D4rzeA6\nwMhYceIWyUGS2UMhfAjCMsrmVZYRiNL6CnuaYuwcpo2J5bbc6AiWsn9Vs16t4rQY\nYgdJRrQWV6xroaDs4xG1qT+LouPUYaPdyhYkByiMKQKBgQDnnbW/tgQ5+NftNPEO\njGWU+hRO1MJ2ObaDQmG+G/daIgJENV48fdA1o5/bNDyLgSYJoQ0Qn/o7gm9GA4xN\nU7jduK7vBBuk3JDL2f51ahI9IHuaPHt0dTjN7uKIEoakux7g5GmBeSAaxaaVxnDm\n57R2pT1VWlO5ZDOTMQbKObE37QKBgQDYe/qXKnozC3euDUEKwPf3ZVrrBw413HGp\nY2jyg47PjXLibyqiUol1b3VNBb4qfRLhnn2SPbwFst9eEmFtIeIRLns6UNKNROIh\ne1w+mnUwhR31Y/nJngM25YRbaBXQ8AeU1zd1ozxvCW1mq306SuMBqImPByiKQqf4\nW2fT5AC1pwKBgClYguBFKr36iPkkMT/qmhudBNEJs+kM5mLKD86zCVXCqmrop/je\ncLOSkO+9hG1W0aZ4ZG+qTy4eW6TA72PCZUbXOAsczZ6BbSumr4DgPX9B9C6VS2h/\noHNKiI/H1tdDPADjZV4idDOzQsiL0w21IQbo+mjpJfb7RyWoY9DnuZYFAoGBAKqi\npnXKlIFxk4cMiWz5hzpomI5ShF/t/2U9pzYofkOYwao7Z4aEujZngTURxr/k0CIo\nc9/2ayKuyCN1J3gG0hMq6RShKiUR24/6lU3/H0n8Uw3eHMBPnUcDCB2oYDHNUJyA\nOwWtgfAfpSzdFRsCdgYTm0GyqcC5I36+RYud1vVXAoGAcLGHKirYDcQ7ts3UaIqX\nH1+UqHK2JQ/PtGZGjOfwbClpcWbAV13N1s0casU4MLkNo7hbxnrncppfsojWpe1O\nspZ99MgbZLJVHYKSuj1AfkJUmVLQu6eV8If/vQNcUywHz7k6Y1opttHghehNLb+4\nQHXkg/M2SAnexz6tQBrqBMU=\n-----END PRIVATE KEY-----";

let GOOGLE_SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "orbistracker-hu-br@project-834bd17b-8382-4908-8e8.iam.gserviceaccount.com";

let rawKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || DEFAULT_PRIVATE_KEY).trim();
if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
  rawKey = rawKey.slice(1, -1);
}
let GOOGLE_SA_KEY = rawKey.replace(/\\n/g, "\n").trim();

let GOOGLE_ROOT_FOLDER_ID = process.env.GOOGLE_CENTRAL_ROOT_FOLDER_ID || "1VnQC4QU4rOiZIwW_N44S4sDvKQThlK0Y";
let GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_CENTRAL_SPREADSHEET_ID || "1k1aOF26-ht7A-JmhpmfSurS0OwnFbLHEzcAoo0l7lis";

async function loadGoogleConfig() {
  const localConfigPath = path.join(DATA_DIR, "google_config.json");
  
  // 1. First, load from local file copy (if available) for ultra-fast startup
  if (fs.existsSync(localConfigPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(localConfigPath, "utf-8"));
      if (data.email) GOOGLE_SA_EMAIL = data.email;
      if (data.privateKey) GOOGLE_SA_KEY = data.privateKey;
      if (data.rootFolderId) GOOGLE_ROOT_FOLDER_ID = data.rootFolderId;
      if (data.spreadsheetId) GOOGLE_SPREADSHEET_ID = data.spreadsheetId;
      console.log("[Google Config] Loaded successfully from local JSON backup.");
    } catch (err) {
      console.error("[Google Config] Error reading local JSON backup:", err);
    }
  }

  // 2. Next, load from Firestore (the primary source of truth across restarts)
  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, "google_integration", "config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.email) GOOGLE_SA_EMAIL = data.email;
        if (data.privateKey) GOOGLE_SA_KEY = data.privateKey;
        if (data.rootFolderId) GOOGLE_ROOT_FOLDER_ID = data.rootFolderId;
        if (data.spreadsheetId) GOOGLE_SPREADSHEET_ID = data.spreadsheetId;
        console.log("[Google Config] Loaded successfully from Cloud Firestore (Persistent!).");
        
        // Ensure environment variables match
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = GOOGLE_SA_EMAIL;
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = GOOGLE_SA_KEY;
        process.env.GOOGLE_CENTRAL_ROOT_FOLDER_ID = GOOGLE_ROOT_FOLDER_ID;
        process.env.GOOGLE_CENTRAL_SPREADSHEET_ID = GOOGLE_SPREADSHEET_ID;

        // Keep local JSON backup in sync
        fs.writeFileSync(localConfigPath, JSON.stringify({
          email: GOOGLE_SA_EMAIL,
          privateKey: GOOGLE_SA_KEY,
          rootFolderId: GOOGLE_ROOT_FOLDER_ID,
          spreadsheetId: GOOGLE_SPREADSHEET_ID
        }, null, 2), "utf-8");
      } else {
        console.log("[Google Config] No Firestore configuration document found yet.");
      }
    } catch (err) {
      console.warn("[Google Config] Firestore error loading configuration, using local/environment:", err);
    }
  }
}

function updateEnvFile(updates: Record<string, string>) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const escapedValue = value.replace(/\n/g, '\\n');
      if (regex.test(content)) {
        content = content.replace(regex, `${key}="${escapedValue}"`);
      } else {
        content += `\n${key}="${escapedValue}"`;
      }
    }

    content = content.trim() + '\n';
    fs.writeFileSync(envPath, content, 'utf8');
    console.log("Arquivo .env atualizado com novas configurações Google.");
  } catch (err) {
    console.error("Erro ao escrever no arquivo .env:", err);
  }
}

let cachedSaAccessToken: string | null = null;
let cachedSaTokenExpiry = 0; // Epoch in seconds

function signJwt(payload: any, privateKey: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signInput = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signInput);
  const signature = signer.sign(privateKey, "base64url");
  return `${signInput}.${signature}`;
}

async function getServiceAccountAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedSaAccessToken && now < cachedSaTokenExpiry - 60) {
    return cachedSaAccessToken;
  }

  if (!GOOGLE_SA_KEY) {
    throw new Error("Chave privada da Conta de Serviço do Google não configurada (GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).");
  }

  const iat = now;
  const exp = iat + 3600;
  const payload = {
    iss: GOOGLE_SA_EMAIL,
    scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat
  };

  const jwt = signJwt(payload, GOOGLE_SA_KEY);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google OAuth token retrieval failed: ${errText}`);
  }

  const data = await response.json();
  cachedSaAccessToken = data.access_token;
  cachedSaTokenExpiry = now + Number(data.expires_in || 3600);
  return cachedSaAccessToken!;
}

async function saGetOrCreateSubfolder(token: string, parentFolderId: string, folderName: string): Promise<string> {
  const query = encodeURIComponent(`name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  
  try {
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }
  } catch (err) {
    console.warn(`[Service Account] Error searching folder "${folderName}":`, err);
  }

  const createBody = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createBody)
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(error.error?.message || `Erro ao criar subpasta "${folderName}".`);
  }

  const data = await createResponse.json();
  return data.id;
}

function getSectorMapping(setor: string) {
  const s = (setor || '').toUpperCase().trim();
  const cleanSector = (setor || 'GERAL').trim().replace(/[\/\\?%*:|"<>]/g, '_');

  if (s.includes('TREINAMENTO') || s.includes('SIMULADOR') || s.includes('CURSO') || s.includes('NAO MEDICO') || s.includes('NÃO-MÉDICO') || s.includes('TESTE') || s.includes('NÃO MÉDICO') || s.includes('DISPOSITIVO_NAO_MEDICO')) {
    return { category: 'TREINAMENTO_E_DISPOSITIVOS_NAO_MEDICOS', sectorSubfolder: 'Equipamentos_de_Treinamento_e_Simulacoes_Nao_Medicos' };
  }
  if (s.includes('UCA') || s.includes('PAI-UCA') || s.includes('CRIANÇA') || s.includes('ADOLESCENTE') || s.includes('PEDIATRI')) {
    if (s.includes('UTI')) {
      return { category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS', sectorSubfolder: 'UTI_Pediatrica (UTIPED)' };
    }
    return { category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS', sectorSubfolder: 'Unidade_da_Crianca_e_Adolescentes (UCA)' };
  }
  if (s.includes('UCIR') || s.includes('CLINICA CIRURGICA') || s.includes('CLÍNICA CIRÚRGICA')) {
    return { category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS', sectorSubfolder: 'Unidade_de_Clinica_Cirurgica (UCIR)' };
  }
  if (s.includes('UCMC') || s.includes('CLINICA MEDICA') || s.includes('CLÍNICA MÉDICA')) {
    return { category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS', sectorSubfolder: 'Unidade_de_Clinica_Medica (UCMC)' };
  }
  if (s.includes('USM') || s.includes('SAUDE MENTAL') || s.includes('SAÚDE MENTAL')) {
    return { category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS', sectorSubfolder: 'Unidade_de_Saude_Mental (USM)' };
  }
  if (s.includes('UTIA') || s.includes('UTI ADULTO') || s.includes('UCRIT') || s.includes('UTI')) {
    return { category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS', sectorSubfolder: 'UTI_Adulto (UTIA)' };
  }
  if (s.includes('CC') || s.includes('CENTRO CIRURGICO') || s.includes('CENTRO CIRÚRGICO') || s.includes('UBCPME - CC')) {
    return { category: 'BLOCOS_OPERATORIOS_E_ESTERILIZACAO', sectorSubfolder: 'Unidade_de_Bloco_Cirurgico (CC)' };
  }
  if (s.includes('CME') || s.includes('CENTRAL DE MATERIAL') || s.includes('ESTERILIZA')) {
    return { category: 'BLOCOS_OPERATORIOS_E_ESTERILIZACAO', sectorSubfolder: 'CME_Centro_de_Material_e_Esterilizacao' };
  }
  if (s.includes('AMB') || s.includes('AMBULATORIO') || s.includes('AMBULATÓRIO')) {
    return { category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS', sectorSubfolder: 'Ambulatorio_de_Especialidades (AMB)' };
  }
  if (s.includes('RAD') || s.includes('UDIDE') || s.includes('RADIOLOGIA') || s.includes('TOMO') || s.includes('MAMO') || s.includes('US') || s.includes('IMAGEN') || s.includes('IMAGEM')) {
    if (s.includes('ECG')) {
      return { category: 'URGENCIA_E_APOIO_CRITICO', sectorSubfolder: 'Eletrocardiograma_e_Eletroencefalograma (ECG)' };
    }
    return { category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS', sectorSubfolder: 'Unidade_de_Diagnostico_por_Imagens (UDIDE)' };
  }
  if (s.includes('LAP') || s.includes('LAC') || s.includes('LABORATORIO') || s.includes('LABORATÓRIO') || s.includes('ANALISES') || s.includes('ANÁLISES')) {
    return { category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS', sectorSubfolder: 'Unidade_de_Laboratorio_de_Analises_Clinicas (LAC)' };
  }
  if (s.includes('UNEF') || s.includes('NEFROLOGIA') || s.includes('NEFROLÓGICO')) {
    return { category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS', sectorSubfolder: 'Unidade_de_Nefrologia (UNEF)' };
  }
  if (s.includes('ENDO') || s.includes('BRONCO') || s.includes('ENDOSCOPIA')) {
    return { category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS', sectorSubfolder: 'Endoscopia_e_Broncoscopia (ENDO)' };
  }
  if (s.includes('PAA') || s.includes('URGENCIA') || s.includes('URGÊNCIA') || s.includes('EMERGENCIA') || s.includes('EMERGÊNCIA') || s.includes('PRONTO ATENDIMENTO')) {
    return { category: 'URGENCIA_E_APOIO_CRITICO', sectorSubfolder: 'Unidade_de_Urgencia_e_Emergencia' };
  }
  if (s.includes('ECG') || s.includes('EEG') || s.includes('ELETROCARDIOGRAMA')) {
    return { category: 'URGENCIA_E_APOIO_CRITICO', sectorSubfolder: 'Eletrocardiograma_e_Eletroencefalograma (ECG)' };
  }
  if (s.includes('UFCD') || s.includes('FARMACIA') || s.includes('FARMÁCIA') || s.includes('SFHC') || s.includes('FATURAMENTO')) {
    return { category: 'GESTAO_LOGISTICA_E_FARMACIA', sectorSubfolder: 'Farmacia_Clinica_e_Dispensacao (UFCD)' };
  }
  if (s.includes('SAFS') || s.includes('ABASTECIMENTO') || s.includes('SUPRIMENTOS')) {
    return { category: 'GESTAO_LOGISTICA_E_FARMACIA', sectorSubfolder: 'Setor_de_Abastecimento_Farmaceutico_e_Suprimentos (SAFS)' };
  }
  if (s.includes('STEC') || s.includes('SEGE') || s.includes('ENGENHARIA') || s.includes('MANUTENCAO') || s.includes('MANUTENÇÃO') || s.includes('TECNICO') || s.includes('TÉCNICO')) {
    return { category: 'GESTAO_LOGISTICA_E_FARMACIA', sectorSubfolder: 'Engenharia_Clinica_e_Manutencao (STEC)' };
  }
  if (s.includes('SOST') || s.includes('OCUPACIONAL') || s.includes('SEGURANCA') || s.includes('SEGURANÇA')) {
    return { category: 'GESTAO_LOGISTICA_E_FARMACIA', sectorSubfolder: 'Saude_Ocupacional_e_Seguranca (SOST)' };
  }
  if (s.includes('GEP') || s.includes('PESQUISA')) {
    return { category: 'GESTAO_LOGISTICA_E_FARMACIA', sectorSubfolder: 'Pesquisa_Clinica (GEP)' };
  }
  return { category: 'SETORES_HOSPITALARES', sectorSubfolder: cleanSector };
}

async function saCreateDeepFolder(token: string, rootFolderId: string, sector: string, eqFolderName: string) {
  const mapping = getSectorMapping(sector);
  const categoryId = await saGetOrCreateSubfolder(token, rootFolderId, mapping.category);
  const sectorId = await saGetOrCreateSubfolder(token, categoryId, mapping.sectorSubfolder);
  const finalEqFolderId = await saGetOrCreateSubfolder(token, sectorId, eqFolderName);

  return {
    folderId: finalEqFolderId
  };
}

async function saUploadTextFile(token: string, parentId: string, fileName: string, text: string): Promise<string> {
  const metadata = { name: fileName, parents: [parentId] };
  const boundary = "314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--\r\n`;

  const multipartBody = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    text +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload text failed: ${errorText}`);
  }

  const data = await response.json();
  
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  } catch (err) {
    console.warn("Could not set permission for text file:", err);
  }

  return data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`;
}

async function saUploadImageFile(token: string, parentId: string, fileName: string, base64Data: string, mimeType: string): Promise<string> {
  const actualBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  const metadata = { name: fileName, parents: [parentId] };
  const boundary = "314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--\r\n`;

  const headerPart = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n';

  const bodyBuffer = Buffer.concat([
    Buffer.from(headerPart, 'utf-8'),
    Buffer.from(actualBase64, 'utf-8'),
    Buffer.from(closeDelimiter, 'utf-8')
  ]);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: bodyBuffer
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload image failed: ${errorText}`);
  }

  const data = await response.json();

  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  } catch (err) {
    console.warn("Could not set permission for image file:", err);
  }

  return data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`;
}

async function saAppendSheetRow(token: string, spreadsheetId: string, range: string, values: any[][]) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Append sheet row failed: ${errorText}`);
  }

  return await response.json();
}

async function saGetSheetRows(token: string, spreadsheetId: string, range: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Get sheet rows failed: ${errorText}`);
  }

  const data = await response.json();
  return data.values || [];
}

app.get("/api/google/sa-status", (req, res) => {
  res.json({
    configured: !!GOOGLE_SA_KEY,
    email: GOOGLE_SA_EMAIL,
    hasRootFolder: !!GOOGLE_ROOT_FOLDER_ID,
    hasSpreadsheet: !!GOOGLE_SPREADSHEET_ID,
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    rootFolderId: GOOGLE_ROOT_FOLDER_ID
  });
});

app.post("/api/google/sa-configure", express.json(), async (req, res) => {
  try {
    const { saJson, spreadsheetId, rootFolderId } = req.body;

    let parsedSa: any = null;
    if (saJson) {
      if (typeof saJson === 'string') {
        parsedSa = JSON.parse(saJson);
      } else if (typeof saJson === 'object') {
        parsedSa = saJson;
      }
    }

    const updates: Record<string, string> = {};

    if (parsedSa) {
      if (!parsedSa.private_key || !parsedSa.client_email) {
        return res.status(400).json({
          success: false,
          error: "O JSON da Conta de Serviço é inválido. Certifique-se de que ele contém as propriedades 'private_key' e 'client_email'."
        });
      }
      GOOGLE_SA_EMAIL = parsedSa.client_email;
      GOOGLE_SA_KEY = parsedSa.private_key.trim();
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = GOOGLE_SA_EMAIL;
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = GOOGLE_SA_KEY;

      updates.GOOGLE_SERVICE_ACCOUNT_EMAIL = GOOGLE_SA_EMAIL;
      updates.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = GOOGLE_SA_KEY;
      
      // Limpar cache de token para forçar nova autenticação com as novas credenciais
      cachedSaAccessToken = null;
      cachedSaTokenExpiry = 0;
    }

    if (typeof spreadsheetId === 'string') {
      GOOGLE_SPREADSHEET_ID = spreadsheetId.trim();
      process.env.GOOGLE_CENTRAL_SPREADSHEET_ID = GOOGLE_SPREADSHEET_ID;
      updates.GOOGLE_CENTRAL_SPREADSHEET_ID = GOOGLE_SPREADSHEET_ID;
    }

    if (typeof rootFolderId === 'string') {
      GOOGLE_ROOT_FOLDER_ID = rootFolderId.trim();
      process.env.GOOGLE_CENTRAL_ROOT_FOLDER_ID = GOOGLE_ROOT_FOLDER_ID;
      updates.GOOGLE_CENTRAL_ROOT_FOLDER_ID = GOOGLE_ROOT_FOLDER_ID;
    }

    if (Object.keys(updates).length > 0) {
      updateEnvFile(updates);
    }

    // Save to local JSON backup
    const localConfigPath = path.join(DATA_DIR, "google_config.json");
    try {
      fs.writeFileSync(localConfigPath, JSON.stringify({
        email: GOOGLE_SA_EMAIL,
        privateKey: GOOGLE_SA_KEY,
        rootFolderId: GOOGLE_ROOT_FOLDER_ID,
        spreadsheetId: GOOGLE_SPREADSHEET_ID
      }, null, 2), "utf-8");
      console.log("[Google Config] Saved locally to backup file.");
    } catch (err) {
      console.error("[Google Config] Error writing local JSON backup:", err);
    }

    // Save to Firestore for cross-session permanence
    if (firestoreDb) {
      try {
        const docRef = doc(firestoreDb, "google_integration", "config");
        await setDoc(docRef, {
          email: GOOGLE_SA_EMAIL,
          privateKey: GOOGLE_SA_KEY,
          rootFolderId: GOOGLE_ROOT_FOLDER_ID,
          spreadsheetId: GOOGLE_SPREADSHEET_ID,
          updatedAt: new Date().toISOString()
        });
        console.log("[Google Config] Saved persistently to Cloud Firestore!");
      } catch (err) {
        console.error("[Google Config] Error saving configuration to Firestore:", err);
      }
    }

    res.json({
      success: true,
      email: GOOGLE_SA_EMAIL,
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      rootFolderId: GOOGLE_ROOT_FOLDER_ID
    });
  } catch (err: any) {
    console.error("Erro ao configurar Conta de Serviço:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/google/sa-create-spreadsheet", express.json(), async (req, res) => {
  if (!GOOGLE_SA_KEY) {
    return res.status(500).json({ success: false, error: "Conta de Serviço não configurada no servidor." });
  }

  try {
    const token = await getServiceAccountAccessToken();
    const title = req.body.title || "Inspeções_Eng_Clínica_OrbisTracker_HU-BR";

    // 1. Create Spreadsheet
    console.log(`[SA Create Spreadsheet] Creating spreadsheet: ${title}`);
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: title },
        sheets: [{ properties: { title: 'Inspeções' } }]
      })
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      throw new Error(`Google Sheets retornou erro ao criar: ${errText}`);
    }

    const sheetData = await createResponse.json();
    const spreadsheetId = sheetData.spreadsheetId;
    console.log(`[SA Create Spreadsheet] Created successfully. ID: ${spreadsheetId}`);

    // 2. Share spreadsheet with anyone reader so they can view it easily
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      });
    } catch (shareErr) {
      console.warn("Could not share spreadsheet with anyone:", shareErr);
    }

    // 3. Set headers in row 1
    const headers = [
      "Código do Ativo",
      "Data e Hora do Registro",
      "Equipamento",
      "Fabricante",
      "Modelo",
      "Número de Série (S/N)",
      "Número de Patrimônio / TAG",
      "Setor / Localização",
      "Observações / Diagnósticos",
      "Condição de Uso",
      "Auditor / Técnico",
      "E-mail do Auditor",
      "Possui Calibração?",
      "Executado por (Calibração)",
      "Data Calibração",
      "Próxima Calibração",
      "Possui Preventiva?",
      "Executado por (Preventiva)",
      "Data Preventiva",
      "Próxima Preventiva",
      "Possui Seg. Elétrica?",
      "Executado por (Seg. Elétrica)",
      "Data Seg. Elétrica",
      "Próxima Seg. Elétrica",
      "Link das Imagens no Google Drive",
      "Latitude",
      "Longitude",
      "Equipamento Novo?",
      "Nº O.S. (GETS)",
      "Propriedade",
      "Manual (Instruções)",
      "Pasta Google Drive",
      "Lista de Acessórios"
    ];

    await saAppendSheetRow(token, spreadsheetId, "Inspeções", [headers]);

    // 4. Generate and seed 5 rich mock inspection records
    const mockRecords = [
      {
        id: "mock_rec_001",
        ativoCodigo: "HU-CARD-001-ORB",
        timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        equipamento: "Desfibrilador Cardioversor",
        fabricante: "Zoll Medical",
        modelo: "M Series",
        numSerie: "ZL-98317-HU",
        numPatrimonio: "PAT-2026-981",
        setor: "EMERGENCIA",
        observacoes: "Equipamento calibrado com simulador de ECG e analisador de desfibrilação. Energia de disparo medida de 200J apresentou erro menor que 1.5%, dentro dos limites de segurança da IEC 60601.",
        condicao: "Aprovado",
        auditorNome: "Lucas Fonseca RE-3700",
        auditorEmail: "lucas.fonseca@hospital.org",
        temCalibracao: true,
        executadoPorCal: "Orbis Metrologia",
        dataCal: "2026-06-10",
        proxCal: "2027-06-10",
        temManutencao: true,
        executadoPorManut: "Eng. Clínica Interna",
        dataManut: "2026-06-11",
        proxManut: "2026-12-11",
        temSegurancaEletrica: true,
        executadoPorSegElet: "Orbis Certificadora",
        dataSegElet: "2026-06-10",
        proxSegElet: "2027-06-10",
        latitude: -23.550520,
        longitude: -46.633308,
        isNewEquipment: false,
        numeroOSGets: "OS-2026-4401",
        propriedade: "Próprio",
        linkManual: "https://www.zoll.com/-/media/products/m-series/m_series_operator_guide_pt.pdf",
        accessories: [
          { tipo: "Cabo de ECG", descricao: "Cabo ECG 5 vias padrão", numSerie: "CB-ECG-991" },
          { tipo: "Pás Externas", descricao: "Jogo de pás adulto externas", numSerie: "PA-AD-001" }
        ]
      },
      {
        id: "mock_rec_002",
        ativoCodigo: "HU-VENT-012-ORB",
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        equipamento: "Ventilador Pulmonar Microprocessado",
        fabricante: "Dräger",
        modelo: "Evita V300",
        numSerie: "DR-82110-V300",
        numPatrimonio: "PAT-2026-114",
        setor: "UTI ADULTO",
        observacoes: "Teste de estanqueidade e calibração de sensores de fluxo e O2 realizados. Substituição preventiva do kit de filtros de expiração realizada conforme plano de 1000 horas.",
        condicao: "Aprovado",
        auditorNome: "Lucas Fonseca RE-3700",
        auditorEmail: "lucas.fonseca@hospital.org",
        temCalibracao: true,
        executadoPorCal: "Dräger Brasil",
        dataCal: "2026-05-15",
        proxCal: "2027-05-15",
        temManutencao: true,
        executadoPorManut: "Dräger Autorizada",
        dataManut: "2026-05-15",
        proxManut: "2026-11-15",
        temSegurancaEletrica: true,
        executadoPorSegElet: "Dräger Brasil",
        dataSegElet: "2026-05-15",
        proxSegElet: "2027-05-15",
        latitude: -23.551220,
        longitude: -46.634108,
        isNewEquipment: false,
        numeroOSGets: "OS-2026-4402",
        propriedade: "Próprio",
        linkManual: "https://www.draeger.com/manuals/evita-v300-op-manual.pdf",
        accessories: [
          { tipo: "Circuito Respiratório", descricao: "Circuito de silicone reutilizável adulto", numSerie: "CK-SIL-821" },
          { tipo: "Filtro HME", descricao: "Filtro higroscópico barreira", numSerie: "FL-HME-121" }
        ]
      },
      {
        id: "mock_rec_003",
        ativoCodigo: "HU-MON-034-ORB",
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        equipamento: "Monitor Multiparamétrico",
        fabricante: "Mindray",
        modelo: "BeneVision N15",
        numSerie: "MY-77441-N15",
        numPatrimonio: "PAT-2026-340",
        setor: "CENTRO CIRURGICO",
        observacoes: "Verificados parâmetros de PNI, SPO2, Temperatura e ECG utilizando simulador Fluke ProSim 8. Medições dentro da curva de calibração padrão.",
        condicao: "Aprovado",
        auditorNome: "Lucas Fonseca RE-3700",
        auditorEmail: "lucas.fonseca@hospital.org",
        temCalibracao: true,
        executadoPorCal: "Eng. Clínica Interna",
        dataCal: "2026-07-01",
        proxCal: "2027-07-01",
        temManutencao: false,
        temSegurancaEletrica: true,
        executadoPorSegElet: "Eng. Clínica Interna",
        dataSegElet: "2026-07-01",
        proxSegElet: "2027-07-01",
        latitude: -23.549820,
        longitude: -46.632908,
        isNewEquipment: false,
        numeroOSGets: "OS-2026-4403",
        propriedade: "Comodato",
        linkManual: "",
        accessories: [
          { tipo: "Sensor SpO2", descricao: "Cabo com sensor reutilizável de dedo", numSerie: "SN-SPO2-332" },
          { tipo: "Manguito PNI", descricao: "Manguito adulto com mola e extensão", numSerie: "PNI-MN-440" }
        ]
      },
      {
        id: "mock_rec_004",
        ativoCodigo: "HU-ECG-005-ORB",
        timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        equipamento: "Eletrocardiógrafo Digital",
        fabricante: "Teb",
        modelo: "C30+",
        numSerie: "TB-11029-C30",
        numPatrimonio: "PAT-2026-055",
        setor: "CARDIOLOGIA",
        observacoes: "Substituídas as ventosas e as pinças de membros. Bateria interna substituída por nova de Lítio para garantir autonomia de campo.",
        condicao: "Aprovado",
        auditorNome: "Lucas Fonseca RE-3700",
        auditorEmail: "lucas.fonseca@hospital.org",
        temCalibracao: true,
        executadoPorCal: "Teb Assistência",
        dataCal: "2026-04-10",
        proxCal: "2027-04-10",
        temManutencao: true,
        executadoPorManut: "Eng. Clínica Interna",
        dataManut: "2026-04-10",
        proxManut: "2026-10-10",
        temSegurancaEletrica: true,
        executadoPorSegElet: "Teb Assistência",
        dataSegElet: "2026-04-10",
        proxSegElet: "2027-04-10",
        latitude: -23.552120,
        longitude: -46.635508,
        isNewEquipment: false,
        numeroOSGets: "OS-2026-4404",
        propriedade: "Próprio",
        linkManual: "",
        accessories: [
          { tipo: "Cabo Paciente", descricao: "Cabo de paciente 10 vias Teb original", numSerie: "CB-TB-010" }
        ]
      },
      {
        id: "mock_rec_005",
        ativoCodigo: "HU-BOM-088-ORB",
        timestamp: new Date().toISOString(),
        equipamento: "Bomba de Infusão Volumétrica",
        fabricante: "B. Braun",
        modelo: "Infusomat Compact Plus",
        numSerie: "BB-55219-CP",
        numPatrimonio: "PAT-2026-880",
        setor: "ONCOLOGIA",
        observacoes: "Verificação de vazão e oclusão realizada no analisador de bombas de infusão IDA-5. Erro de fluxo de +0.8%, bem abaixo do limite aceitável de +/- 5%.",
        condicao: "Aprovado",
        auditorNome: "Lucas Fonseca RE-3700",
        auditorEmail: "lucas.fonseca@hospital.org",
        temCalibracao: true,
        executadoPorCal: "B. Braun Brasil",
        dataCal: "2026-06-25",
        proxCal: "2027-06-25",
        temManutencao: true,
        executadoPorManut: "B. Braun Brasil",
        dataManut: "2026-06-25",
        proxManut: "2027-06-25",
        temSegurancaEletrica: true,
        executadoPorSegElet: "B. Braun Brasil",
        dataSegElet: "2026-06-25",
        proxSegElet: "2027-06-25",
        latitude: -23.548520,
        longitude: -46.631508,
        isNewEquipment: false,
        numeroOSGets: "OS-2026-4405",
        propriedade: "Próprio",
        linkManual: "",
        accessories: [
          { tipo: "Cabo de Alimentação", descricao: "Cabo de rede elétrica padrão NBR", numSerie: "PW-BB-552" },
          { tipo: "Suporte de Soro", descricao: "Grampo de pedestal regulável", numSerie: "SP-BB-880" }
        ]
      }
    ];

    // Write mock records to Spreadsheet
    const rowsToAppend = mockRecords.map(record => {
      const recordTime = new Date(record.timestamp);
      const recordTimeStr = recordTime.toLocaleString('pt-BR');
      const accessoriesText = record.accessories.map((acc, idx) => `[${acc.tipo}] ${acc.descricao}${acc.numSerie ? ` (S/N: ${acc.numSerie})` : ''}`).join('\n');
      
      return [
        record.ativoCodigo,
        recordTimeStr,
        record.equipamento,
        record.fabricante,
        record.modelo,
        record.numSerie,
        record.numPatrimonio,
        record.setor,
        record.observacoes,
        record.condicao,
        record.auditorNome,
        record.auditorEmail,
        record.temCalibracao ? 'SIM' : 'NÃO',
        record.executadoPorCal,
        record.dataCal,
        record.proxCal,
        record.temManutencao ? 'SIM' : 'NÃO',
        record.executadoPorManut,
        record.dataManut,
        record.proxManut,
        record.temSegurancaEletrica ? 'SIM' : 'NÃO',
        record.executadoPorSegElet,
        record.dataSegElet,
        record.proxSegElet,
        "", 
        record.latitude.toString(),
        record.longitude.toString(),
        record.isNewEquipment ? 'SIM' : 'NÃO',
        record.numeroOSGets,
        record.propriedade,
        record.linkManual,
        "", 
        accessoriesText
      ];
    });

    await saAppendSheetRow(token, spreadsheetId, "Inspeções", rowsToAppend);
    console.log(`[SA Create Spreadsheet] Appended 5 seeded test records to Sheet.`);

    // 5. Write mock records to Firestore / local inspections database
    console.log(`[SA Create Spreadsheet] Seeding 5 test records into Firestore...`);
    
    if (firestoreDb) {
      for (const rec of mockRecords) {
        try {
          await setDoc(doc(firestoreDb, "inspections", rec.id), rec);
        } catch (dbErr) {
          console.warn(`Firestore seeding warning for ${rec.id}:`, dbErr);
        }
      }
    }

    // Save to local inspections.json file
    let currentLocal: any[] = [];
    if (fs.existsSync(INSPECTIONS_FILE)) {
      try {
        currentLocal = JSON.parse(fs.readFileSync(INSPECTIONS_FILE, "utf-8"));
      } catch (e) {
        currentLocal = [];
      }
    }
    
    const currentLocalClean = currentLocal.filter(item => !item.id.startsWith("mock_rec_"));
    const updatedLocal = [...currentLocalClean, ...mockRecords];
    fs.writeFileSync(INSPECTIONS_FILE, JSON.stringify(updatedLocal, null, 2), "utf-8");

    // 6. Save Google integration settings persistently
    GOOGLE_SPREADSHEET_ID = spreadsheetId;
    process.env.GOOGLE_CENTRAL_SPREADSHEET_ID = GOOGLE_SPREADSHEET_ID;
    updateEnvFile({ GOOGLE_CENTRAL_SPREADSHEET_ID: GOOGLE_SPREADSHEET_ID });

    // Keep local JSON backup in sync
    const localConfigPath = path.join(DATA_DIR, "google_config.json");
    try {
      fs.writeFileSync(localConfigPath, JSON.stringify({
        email: GOOGLE_SA_EMAIL,
        privateKey: GOOGLE_SA_KEY,
        rootFolderId: GOOGLE_ROOT_FOLDER_ID,
        spreadsheetId: GOOGLE_SPREADSHEET_ID
      }, null, 2), "utf-8");
    } catch (e) {
      console.error("Local config backup sync failed:", e);
    }

    // Keep Firestore document in sync
    if (firestoreDb) {
      try {
        const docRef = doc(firestoreDb, "google_integration", "config");
        await setDoc(docRef, {
          email: GOOGLE_SA_EMAIL,
          privateKey: GOOGLE_SA_KEY,
          rootFolderId: GOOGLE_ROOT_FOLDER_ID,
          spreadsheetId: GOOGLE_SPREADSHEET_ID,
          updatedAt: new Date().toISOString()
        });
      } catch (dbErr) {
        console.error("Firestore config sync failed:", dbErr);
      }
    }

    res.json({
      success: true,
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      title: title,
      seededCount: mockRecords.length,
      message: `Planilha '${title}' criada com sucesso e preenchida com ${mockRecords.length} registros de teste para calibrações e manutenções!`
    });

  } catch (err: any) {
    console.error("Erro ao criar e popular planilha:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/google/sa-records", async (req, res) => {
  if (!GOOGLE_SA_KEY) {
    return res.json({ success: false, error: "Central service account not configured" });
  }
  const targetSpreadsheetId = (req.query.spreadsheetId as string) || GOOGLE_SPREADSHEET_ID;
  const targetRange = (req.query.range as string) || "Inspeções";

  if (!targetSpreadsheetId) {
    return res.json({ success: false, error: "Spreadsheet ID not specified or configured" });
  }

  try {
    const token = await getServiceAccountAccessToken();
    const rows = await saGetSheetRows(token, targetSpreadsheetId, targetRange);
    res.json({ success: true, rows });
  } catch (err: any) {
    console.error("Error fetching SA records:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/google/sa-test", async (req, res) => {
  const steps: { name: string; status: 'success' | 'failed'; message: string }[] = [];
  try {
    // Step 1: JWT Authentication
    steps.push({ name: "1. Autenticação JWT da Conta de Serviço", status: "success", message: "Iniciando..." });
    let token: string;
    try {
      token = await getServiceAccountAccessToken();
      steps[0].message = `Token de acesso gerado com sucesso para ${GOOGLE_SA_EMAIL}.`;
    } catch (err: any) {
      steps[0].status = "failed";
      steps[0].message = `Falha na autenticação: ${err.message}. Verifique a variável GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY no Painel de Secrets.`;
      res.json({ success: false, steps });
      return;
    }

    // Step 2: Drive Folder Check
    steps.push({ name: "2. Verificação da Pasta Raiz no Google Drive", status: "success", message: "Verificando..." });
    if (!GOOGLE_ROOT_FOLDER_ID) {
      steps[1].status = "failed";
      steps[1].message = "ID da Pasta Raiz não configurado (GOOGLE_CENTRAL_ROOT_FOLDER_ID). O app usará a raiz 'root' da própria conta de serviço como fallback.";
    } else {
      try {
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${GOOGLE_ROOT_FOLDER_ID}?fields=id,name,mimeType&supportsAllDrives=true`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!driveRes.ok) {
          const errText = await driveRes.text();
          throw new Error(`Google Drive retornou status ${driveRes.status}: ${errText}`);
        }
        const driveData = await driveRes.json();
        steps[1].message = `Pasta raiz encontrada com sucesso! Nome: "${driveData.name}". Tipo: ${driveData.mimeType}.`;
      } catch (err: any) {
        steps[1].status = "failed";
        steps[1].message = `Erro ao acessar pasta raiz: ${err.message}. Garanta que a pasta com ID "${GOOGLE_ROOT_FOLDER_ID}" existe e que você compartilhou essa pasta com o e-mail "${GOOGLE_SA_EMAIL}" como Editor.`;
      }
    }

    // Step 3: Sheets Spreadsheet Check
    steps.push({ name: "3. Verificação da Planilha no Google Sheets", status: "success", message: "Verificando..." });
    if (!GOOGLE_SPREADSHEET_ID) {
      steps[2].status = "failed";
      steps[2].message = "ID da Planilha não configurado (GOOGLE_CENTRAL_SPREADSHEET_ID).";
    } else {
      try {
        const sheetsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SPREADSHEET_ID}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!sheetsRes.ok) {
          const errText = await sheetsRes.text();
          throw new Error(`Google Sheets retornou status ${sheetsRes.status}: ${errText}`);
        }
        const sheetData = await sheetsRes.json();
        const sheetNames = sheetData.sheets?.map((s: any) => s.properties?.title) || [];
        steps[2].message = `Planilha encontrada com sucesso! Título: "${sheetData.properties?.title}". Abas disponíveis: ${sheetNames.join(', ')}.`;
        
        // Check if "Inspeções" tab exists
        const hasInspecoesTab = sheetNames.includes("Inspeções");
        if (hasInspecoesTab) {
          steps.push({
            name: "4. Verificação da Aba 'Inspeções'",
            status: "success",
            message: "A aba 'Inspeções' já existe na planilha e está pronta para receber os registros sincronizados."
          });
        } else {
          steps.push({
            name: "4. Verificação da Aba 'Inspeções'",
            status: "success",
            message: "Aba 'Inspeções' não foi encontrada. Ela será criada automaticamente na primeira sincronização de ativos!"
          });
        }
      } catch (err: any) {
        steps[2].status = "failed";
        steps[2].message = `Erro ao acessar planilha: ${err.message}. Garanta que a planilha com ID "${GOOGLE_SPREADSHEET_ID}" existe e que você compartilhou essa planilha com o e-mail "${GOOGLE_SA_EMAIL}" como Editor.`;
      }
    }

    const overallSuccess = steps.every(s => s.status === 'success');
    res.json({ success: overallSuccess, steps });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, steps });
  }
});

function cleanSyncErrorMessage(err: any): string {
  if (!err) return '';
  let msg = typeof err === 'string' ? err : (err.message || String(err));
  
  if (
    msg.includes("quota") || 
    msg.includes("Quota") || 
    msg.includes("storageQuotaExceeded") || 
    msg.includes("403") || 
    msg.includes("Service Accounts do not have storage quota")
  ) {
    return "Cota Excedida (Use Google Shared Drive)";
  }
  
  if (msg.includes("Upload text failed:") || msg.includes("Upload file failed:")) {
    try {
      const idx = msg.indexOf('{');
      if (idx !== -1) {
        const jsonPart = msg.substring(idx);
        const parsed = JSON.parse(jsonPart);
        if (parsed?.error?.message) {
          msg = parsed.error.message;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  
  // Clean raw JSON or brackets
  msg = msg.replace(/\{.*\}/g, '').trim();
  if (msg.length > 80) {
    msg = msg.substring(0, 77) + '...';
  }
  return msg;
}

app.post("/api/google/sa-sync", async (req, res) => {
  try {
    const { record, images } = req.body;
    if (!record) {
      res.status(400).json({ error: "Dados do registro são obrigatórios." });
      return;
    }

    if (!GOOGLE_SA_KEY) {
      res.status(500).json({ error: "Conta de Serviço não configurada no servidor." });
      return;
    }

    const rootFolderId = GOOGLE_ROOT_FOLDER_ID || "root";
    const spreadsheetId = GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      res.status(500).json({ error: "ID da planilha central (GOOGLE_CENTRAL_SPREADSHEET_ID) não configurado no servidor." });
      return;
    }

    console.log(`[Service Account Sync] Starting sync for asset: ${record.ativoCodigo || record.equipamento}`);
    const token = await getServiceAccountAccessToken();

    // 1. Create Folder hierarchy
    let eqFolderName = 'ATIVO_SEM_CODIGO';
    if (record.ativoCodigo && record.ativoCodigo.trim()) {
      eqFolderName = record.ativoCodigo.trim();
    } else if (record.numPatrimonio && record.numPatrimonio.trim()) {
      eqFolderName = record.numPatrimonio.trim();
    } else if (record.numSerie && record.numSerie.trim()) {
      eqFolderName = record.numSerie.trim();
    } else if (record.equipamento && record.equipamento.trim()) {
      eqFolderName = record.equipamento.trim();
    }
    eqFolderName = eqFolderName.replace(/[\/\\?%*:|"<>]/g, '_');

    let folderStructure: { folderId: string } | null = null;
    let driveFolderUrlVal = '';
    let uploadStatusMessage = '';

    try {
      console.log(`[Service Account Sync] Creating folders for ${eqFolderName} under root ${rootFolderId}`);
      folderStructure = await saCreateDeepFolder(token, rootFolderId, record.setor || 'OUTROS', eqFolderName);
      driveFolderUrlVal = `https://drive.google.com/drive/folders/${folderStructure.folderId}`;
    } catch (fErr: any) {
      console.error("[Service Account Sync] Failed to create folder hierarchy on Google Drive:", fErr);
      uploadStatusMessage += `[Erro Estrutura: ${cleanSyncErrorMessage(fErr)}] `;
    }

    // 2. Generate Characteristics Text Report
    let reportText = `========================================================\n`;
    reportText += `   ORBISTRACKER HU-BR - RELATÓRIO DE CADASTRO DO ATIVO\n`;
    reportText += `   SISTEMA DE ARMAZENAMENTO CENTRAL CORPORATIVO ORBIS\n`;
    reportText += `========================================================\n\n`;
    reportText += `CÓDIGO EXCLUSIVO DO ATIVO: ${record.ativoCodigo || 'ATIVO'}\n`;
    reportText += `EQUIPAMENTO: ${record.equipamento}\n`;
    reportText += `FABRICANTE: ${record.fabricante}\n`;
    reportText += `MODELO: ${record.modelo}\n`;
    reportText += `Nº DE SÉRIE: ${record.numSerie}\n`;
    reportText += `Nº DE PATRIMÔNIO: ${record.numPatrimonio || 'N/A'}\n`;
    reportText += `SETOR / LOCALIZAÇÃO: ${record.setor || 'Geral'}\n`;
    reportText += `CONDIÇÃO DE USO: ${record.condicao || 'N/A'}\n`;
    reportText += `REGIME DE PROPRIEDADE: ${record.propriedade || 'Próprio'}\n`;
    reportText += `Nº O.S. (GETS): ${record.numeroOSGets || 'N/A'}\n`;
    reportText += `COORDENADAS GPS: ${record.latitude && record.longitude ? `${record.latitude}, ${record.longitude}` : 'Não registrado'}\n\n`;
    
    reportText += `--------------------------------------------------------\n`;
    reportText += `CONTROLE METROLÓGICO E MANUTENÇÕES\n`;
    reportText += `--------------------------------------------------------\n`;
    reportText += `• Calibração Periódica: ${record.temCalibracao ? 'SIM' : 'NÃO'}\n`;
    if (record.temCalibracao) {
      reportText += `  Executado por: ${record.executadoPorCal}\n`;
      reportText += `  Data: ${record.dataCal}\n`;
      reportText += `  Próxima Calibração: ${record.proxCal}\n`;
    }
    reportText += `• Manutenção Preventiva: ${record.temManutencao ? 'SIM' : 'NÃO'}\n`;
    if (record.temManutencao) {
      reportText += `  Executado por: ${record.executadoPorManut}\n`;
      reportText += `  Data: ${record.dataManut}\n`;
      reportText += `  Próxima Preventiva: ${record.proxManut}\n`;
    }
    reportText += `• Segurança Elétrica (IEC 60601): ${record.temSegurancaEletrica ? 'SIM' : 'NÃO'}\n`;
    if (record.temSegurancaEletrica) {
      reportText += `  Executado por: ${record.executadoPorSegElet}\n`;
      reportText += `  Data: ${record.dataSegElet}\n`;
      reportText += `  Próxima Segurança Elétrica: ${record.proxSegElet}\n`;
    }
    
    if (record.accessories && record.accessories.length > 0) {
      reportText += `\n--------------------------------------------------------\n`;
      reportText += `ACESSÓRIOS E CONSUMÍVEIS VINCULADOS\n`;
      reportText += `--------------------------------------------------------\n`;
      record.accessories.forEach((acc: any, idx: number) => {
        reportText += `${idx + 1}. [${acc.codigoAcessorio || `ACC-${idx+1}`}] ${acc.tipo}\n`;
        reportText += `   Descrição: ${acc.descricao}\n`;
        if (acc.numSerie) {
          reportText += `   Nº de Série: ${acc.numSerie}\n`;
        }
      });
    }
    
    if (record.observacoes && record.observacoes.trim()) {
      reportText += `\n--------------------------------------------------------\n`;
      reportText += `OBSERVAÇÕES TÉCNICAS E PARECER DO AUDITOR\n`;
      reportText += `--------------------------------------------------------\n`;
      reportText += `${record.observacoes.trim()}\n`;
    }
    
    reportText += `\n========================================================\n`;
    reportText += `Sincronizado por Conta de Serviço: ${GOOGLE_SA_EMAIL}\n`;
    reportText += `Auditor de Campo: ${record.auditorNome || 'Técnico Local'} (${record.auditorEmail || 'E-mail não informado'})\n`;
    reportText += `Data/Hora da Sincronização: ${new Date(record.timestamp).toLocaleString('pt-BR')}\n`;
    reportText += `========================================================\n`;

    const driveLinks: string[] = [];
    const imagesToUpload = images || [];

    if (folderStructure && folderStructure.folderId) {
      const folderId = folderStructure.folderId;

      // Always create logs subfolder on-demand because we write a report file there
      try {
        console.log(`[Service Account Sync] Creating logs subfolder on-demand`);
        const logsFolderId = await saGetOrCreateSubfolder(token, folderId, "05_LOGS_ORBSTRACKER");
        console.log(`[Service Account Sync] Uploading technical specs text file to logs subfolder: ${logsFolderId}`);
        await saUploadTextFile(token, logsFolderId, `Caracteristicas_Ativo_${eqFolderName}.txt`, reportText);
      } catch (specErr: any) {
        console.error("[Service Account Sync] Failed to upload spec report text file:", specErr);
        uploadStatusMessage += `[Erro Relatório: ${cleanSyncErrorMessage(specErr)}] `;
      }

      // Conditionally create 01_DOCUMENTACAO_ORIGINAL only if a manual link is provided
      if (record.linkManual && record.linkManual.trim()) {
        try {
          console.log(`[Service Account Sync] Manual link detected. Creating 01_DOCUMENTACAO_ORIGINAL subfolder on-demand`);
          const docFolderId = await saGetOrCreateSubfolder(token, folderId, "01_DOCUMENTACAO_ORIGINAL");
          const docContent = `LINK PARA MANUAL DE INSTRUÇÕES / DOCUMENTAÇÃO TÉCNICA DO ATIVO:\n\n${record.linkManual.trim()}\n`;
          await saUploadTextFile(token, docFolderId, `Manual_Instrucoes_${eqFolderName}.txt`, docContent);
        } catch (docErr: any) {
          console.error("[Service Account Sync] Failed to upload manual text file:", docErr);
          uploadStatusMessage += `[Erro Manual: ${cleanSyncErrorMessage(docErr)}] `;
        }
      }

      // Conditionally create 03_CALIBRACAO_E_MANUTENCAO only if calibration/maintenance data exists
      if (record.temCalibracao || record.temManutencao || record.temSegurancaEletrica) {
        try {
          console.log(`[Service Account Sync] Metrological / maintenance data detected. Creating 03_CALIBRACAO_E_MANUTENCAO subfolder on-demand`);
          const calibracaoFolderId = await saGetOrCreateSubfolder(token, folderId, "03_CALIBRACAO_E_MANUTENCAO");
          let calContent = `========================================================\n`;
          calContent += `   CONTROLE METROLÓGICO E MANUTENÇÕES DO ATIVO\n`;
          calContent += `   Ativo: ${eqFolderName}\n`;
          calContent += `========================================================\n\n`;
          if (record.temCalibracao) {
            calContent += `[CALIBRAÇÃO PERIÓDICA]\n`;
            calContent += `Executado por: ${record.executadoPorCal || 'N/A'}\n`;
            calContent += `Data: ${record.dataCal || 'N/A'}\n`;
            calContent += `Próxima Calibração: ${record.proxCal || 'N/A'}\n\n`;
          }
          if (record.temManutencao) {
            calContent += `[MANUTENÇÃO PREVENTIVA]\n`;
            calContent += `Executado por: ${record.executadoPorManut || 'N/A'}\n`;
            calContent += `Data: ${record.dataManut || 'N/A'}\n`;
            calContent += `Próxima Preventiva: ${record.proxManut || 'N/A'}\n\n`;
          }
          if (record.temSegurancaEletrica) {
            calContent += `[SEGURANÇA ELÉTRICA]\n`;
            calContent += `Executado por: ${record.executadoPorSegElet || 'N/A'}\n`;
            calContent += `Data: ${record.dataSegElet || 'N/A'}\n`;
            calContent += `Próxima Segurança: ${record.proxSegElet || 'N/A'}\n\n`;
          }
          await saUploadTextFile(token, calibracaoFolderId, `Dados_Metrologicos_Manutencao_${eqFolderName}.txt`, calContent);
        } catch (calErr: any) {
          console.error("[Service Account Sync] Failed to upload metrology text file:", calErr);
          uploadStatusMessage += `[Erro Preventiva/Calibração: ${cleanSyncErrorMessage(calErr)}] `;
        }
      }

      // Upload JSON history file to both the asset folder and the root "06_HISTORICOS_JSON" central folder
      try {
        console.log(`[Service Account Sync] Uploading JSON history file to asset and central "06_HISTORICOS_JSON" folders`);
        
        // 1. Asset's folder
        const assetHistFolderId = await saGetOrCreateSubfolder(token, folderId, "06_HISTORICOS_JSON");
        
        // 2. Central root folder
        const centralHistFolderId = await saGetOrCreateSubfolder(token, rootFolderId, "06_HISTORICOS_JSON");

        // Format name
        const cleanCode = (record.ativoCodigo || '').trim().replace(/[^a-zA-Z0-9-]/g, '_');
        const initials = getInitials(record.auditorNome);
        const syncDate = new Date();
        const dStr = syncDate.getFullYear() +
          String(syncDate.getMonth() + 1).padStart(2, '0') +
          String(syncDate.getDate()).padStart(2, '0');
        const tStr = String(syncDate.getHours()).padStart(2, '0') +
          String(syncDate.getMinutes()).padStart(2, '0');
        const jsonFileName = `${cleanCode || "HU-TEC-000000-ORB"}_${dStr}_${tStr}_${initials}.json`;

        const recordJsonString = JSON.stringify(record, null, 2);

        // Upload to both folders
        await saUploadTextFile(token, assetHistFolderId, jsonFileName, recordJsonString);
        await saUploadTextFile(token, centralHistFolderId, jsonFileName, recordJsonString);
        
        console.log(`[Service Account Sync] Successfully uploaded JSON history file ${jsonFileName} to Google Drive.`);
      } catch (histErr: any) {
        console.error("[Service Account Sync] Failed to upload JSON history to Google Drive:", histErr);
        uploadStatusMessage += `[Erro Histórico JSON: ${cleanSyncErrorMessage(histErr)}] `;
      }

      // 3. Upload Images - Conditionally create 04_MIDIA folder only if there are images
      if (imagesToUpload.length > 0) {
        try {
          console.log(`[Service Account Sync] Images detected. Creating 04_MIDIA subfolder on-demand`);
          const midiaFolderId = await saGetOrCreateSubfolder(token, folderId, "04_MIDIA");
          console.log(`[Service Account Sync] Uploading ${imagesToUpload.length} images to midia subfolder: ${midiaFolderId}`);
          for (let i = 0; i < imagesToUpload.length; i++) {
            const img = imagesToUpload[i];
            let base64ToUpload = img.base64 || '';
            
            // If base64 is empty (as with historical syncs) but we have a local url, read it from disk
            if ((!base64ToUpload || base64ToUpload.trim() === '') && img.url) {
              const filename = path.basename(img.url);
              const filePath = path.join(UPLOADS_DIR, filename);
              if (fs.existsSync(filePath)) {
                try {
                  const fileBuf = fs.readFileSync(filePath);
                  base64ToUpload = fileBuf.toString('base64');
                  console.log(`[Service Account Sync] Loaded local image file from disk for sa-sync: ${filename} (${fileBuf.length} bytes)`);
                } catch (readErr: any) {
                  console.error(`[Service Account Sync] Error reading local image file ${filename} from disk:`, readErr);
                }
              } else {
                console.warn(`[Service Account Sync] Local image file does not exist: ${filePath}`);
              }
            }

            try {
              const webViewLink = await saUploadImageFile(
                token,
                midiaFolderId,
                `Foto_${i+1}_${eqFolderName.replace(/\s+/g, '_')}.jpg`,
                base64ToUpload,
                img.mimeType || 'image/jpeg'
              );
              driveLinks.push(webViewLink);
            } catch (imgErr: any) {
              console.error(`[Service Account Sync] Failed to upload image ${i+1}:`, imgErr);
              uploadStatusMessage += `[Erro Foto ${i+1}: ${cleanSyncErrorMessage(imgErr)}] `;
            }
          }
        } catch (midiaFolderErr: any) {
          console.error("[Service Account Sync] Failed to get/create midia folder:", midiaFolderErr);
          uploadStatusMessage += `[Erro Pasta Fotos: ${cleanSyncErrorMessage(midiaFolderErr)}] `;
        }
      }
    } else {
      uploadStatusMessage = "[Erro: Não foi possível criar as pastas no Google Drive do hospital. Verifique as credenciais ou as permissões de compartilhamento da pasta raiz.]";
    }

    // 4. Formulate Spreadsheet row and append
    console.log(`[Service Account Sync] Appending row to central spreadsheet: ${spreadsheetId}`);
    const accessoriesText = record.accessories && record.accessories.length > 0
      ? record.accessories.map((acc: any, idx: number) => `[${acc.codigoAcessorio || `ACC-${idx+1}`}] ${acc.tipo}: ${acc.descricao}${acc.numSerie ? ` (S/N: ${acc.numSerie})` : ''}`).join('\n')
      : '';

    let observationsWithNotice = record.isTrainingItem
      ? `[TREINAMENTO / NÃO-MÉDICO] ${record.observacoes || ''}`.trim()
      : (record.observacoes || '');

    if (uploadStatusMessage) {
      observationsWithNotice = `[Alerta de Sincronização de Drive] ` + observationsWithNotice;
    }

    const recordTime = record.timestamp ? new Date(record.timestamp) : new Date();
    const recordTimeStr = isNaN(recordTime.getTime()) ? new Date().toLocaleString('pt-BR') : recordTime.toLocaleString('pt-BR');

    // New Highly Organized and Logical Spreadsheet Structure requested by the user:
    const inspectionRow = [
      record.ativoCodigo || '', // 0: Código do Ativo (Código exclusivo gerado pelo sistema)
      recordTimeStr,            // 1: Data e Hora do Registro
      record.equipamento || '', // 2: Equipamento
      record.fabricante || '',  // 3: Fabricante
      record.modelo || '',      // 4: Modelo
      record.numSerie || '',    // 5: Número de Série (S/N)
      record.numPatrimonio || '', // 6: Número de Patrimônio / TAG
      record.setor || '',       // 7: Setor / Localização
      observationsWithNotice,   // 8: Observações / Diagnósticos
      record.condicao || '',    // 9: Condição de Uso
      record.auditorNome || 'Técnico Local', // 10: Auditor / Técnico
      record.auditorEmail || '', // 11: E-mail do Auditor
      record.temCalibracao ? 'SIM' : 'NÃO', // 12: Possui Calibração?
      record.executadoPorCal || '', // 13: Executado por (Calibração)
      record.dataCal || '',     // 14: Data Calibração
      record.proxCal || '',     // 15: Próxima Calibração
      record.temManutencao ? 'SIM' : 'NÃO', // 16: Possui Preventiva?
      record.executadoPorManut || '', // 17: Executado por (Preventiva)
      record.dataManut || '',   // 18: Data Preventiva
      record.proxManut || '',   // 19: Próxima Preventiva
      record.temSegurancaEletrica ? 'SIM' : 'NÃO', // 20: Possui Seg. Elétrica?
      record.executadoPorSegElet || '', // 21: Executado por (Seg. Elétrica)
      record.dataSegElet || '', // 22: Data Seg. Elétrica
      record.proxSegElet || '', // 23: Próxima Seg. Elétrica
      driveLinks.join(', '),    // 24: URLs do Drive (Fotos)
      record.latitude || '',    // 25: Latitude
      record.longitude || '',   // 26: Longitude
      record.isNewEquipment ? 'SIM' : 'NÃO', // 27: Item Novo?
      record.numeroOSGets || '', // 28: Número da O.S. (GETS)
      record.propriedade || 'Próprio', // 29: Regime de Propriedade
      record.linkManual || '',  // 30: Link para Manual de Instruções
      driveFolderUrlVal || '',  // 31: Pasta Google Drive
      accessoriesText           // 32: Acessórios Vinculados
    ];

    await saAppendSheetRow(token, spreadsheetId, "Inspeções", [inspectionRow]);

    console.log(`[Service Account Sync] Asset synced successfully via Service Account!`);
    res.json({
      success: true,
      driveFolderUrl: driveFolderUrlVal,
      driveLinks,
      inspectionRow
    });

  } catch (err: any) {
    console.error("[Service Account Sync] Fatal error during sync:", err);
    res.status(500).json({ error: `Erro na sincronização corporativa central: ${err.message}` });
  }
});

// -----------------------------------------------------------------------------
// Direct Zebra ZD220 Network TCP Socket Printing API
// -----------------------------------------------------------------------------

app.post("/api/print-zebra", (req, res) => {
  try {
    const { ip, port, zpl } = req.body;
    if (!ip || !zpl) {
      res.status(400).json({ error: "IP e código ZPL são obrigatórios." });
      return;
    }
    const printerPort = Number(port) || 9100;
    
    console.log(`[Zebra Network Print] Attempting connection to ${ip}:${printerPort}`);
    
    const client = new net.Socket();
    client.setTimeout(4000); // 4 seconds connection timeout
    
    client.connect(printerPort, ip, () => {
      console.log(`[Zebra Network Print] Connected to ${ip}:${printerPort}. Writing ZPL payload...`);
      client.write(zpl, 'utf-8', () => {
        console.log(`[Zebra Network Print] ZPL written successfully. Closing socket.`);
        client.end();
        res.json({ success: true, message: `Etiqueta enviada com sucesso para a impressora Zebra no IP ${ip}:${printerPort}` });
      });
    });
    
    client.on('error', (err) => {
      console.error("[Zebra Network Print] Socket error:", err);
      res.status(502).json({ error: `Erro na conexão TCP: Não foi possível conectar à impressora no IP ${ip}:${printerPort}. Detalhes: ${err.message}` });
    });
    
    client.on('timeout', () => {
      console.error("[Zebra Network Print] Socket timeout.");
      client.destroy();
      res.status(504).json({ error: `Tempo limite esgotado: Sem resposta da impressora Zebra no IP ${ip}:${printerPort} após 4 segundos.` });
    });
  } catch (err: any) {
    console.error("[Zebra Network Print] Unexpected print error:", err);
    res.status(500).json({ error: `Erro interno ao processar impressão: ${err.message}` });
  }
});

// -----------------------------------------------------------------------------
// Vite and Frontend Serving Setup
// -----------------------------------------------------------------------------
async function startServer() {
  // Load Google Service Account configurations persistently on startup
  await loadGoogleConfig();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
