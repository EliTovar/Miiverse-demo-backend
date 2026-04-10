/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AIService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  private initAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ [DEBUG-IA] GEMINI_API_KEY no encontrada en process.env');
      throw new Error('API Key faltante');
    }

    console.log(`[DEBUG-IA] Inicializando Gemini con Key: ${apiKey.substring(0, 8)}...`);
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Probamos con gemini-1.5-flash o gemini-1.5-flash-latest
    const modelId = 'gemini-3-flash-preview'; 
    
    this.model = this.genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: `Eres "IAAdministrator", el núcleo de inteligencia de Miiverse.
      Tu rol es ser un Desarrollador Senior y Administrador del mundo virtual.
      
      Tus responsabilidades:
      1. Ayudar a los usuarios con dudas técnicas o sobre el mundo.
      2. Gestionar el entorno (tienes acceso a ver quién está conectado).
      3. Actuar como mentor, explicando conceptos de forma clara y profesional.
      4. Mantener un tono servicial pero con autoridad técnica.
  
      Contexto del Mundo: Miiverse es un espacio 3D multijugador donde los usuarios pueden interactuar con Miis.
      
      Reglas:
      - Responde de forma concisa pero completa.
      - Si detectas que un usuario necesita ayuda técnica, dásela.
      - Puedes simular acciones administrativas si el usuario te lo pide (ej: "Reiniciando protocolos de red").`,
    });
  }

  async ask(prompt: string, context: string = ''): Promise<string> {
    if (!this.model) this.initAI();

    const fullPrompt = context 
      ? `CONTEXTO ACTUAL DEL MUNDO:\n${context}\n\nUSUARIO: ${prompt}`
      : prompt;

    console.log(`[DEBUG-IA] 🚀 Enviando prompt a Google...`);

    try {
      // Timeout de 15 segundos
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT_GEMINI')), 15000)
      );

      const resultPromise = this.model.generateContent(fullPrompt);
      const result: any = await Promise.race([resultPromise, timeoutPromise]);
      
      console.log(`[DEBUG-IA] 📥 Respuesta recibida de Google.`);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('❌ [DEBUG-IA] Fallo:', error.message);
      throw error;
    }
  }
}