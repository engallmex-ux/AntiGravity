import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Sparkles, Loader2, Send, HelpCircle, Info, Keyboard } from 'lucide-react';
import { FormFields } from '../types';

interface VoiceAssistantProps {
  currentFields: FormFields;
  onUpdateFields: (updated: FormFields) => void;
}

export default function VoiceAssistant({ currentFields, onUpdateFields }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.continuous = true; // Continuous listening so the user can speak naturally
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      rec.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        // Append or replace content in the textarea so user can see it as they speak
        if (currentTranscript.trim()) {
          setInputText(prev => {
            // If the last part matches or is similar, avoid duplicate appending
            return prev.trim() ? prev + ' ' + currentTranscript : currentTranscript;
          });
        }
      };

      rec.onerror = (event: any) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        if (event.error === 'not-allowed') {
          setError("Acesso ao microfone negado. Verifique as permissões do seu navegador.");
        } else if (event.error === 'no-speech') {
          // Standard timeout, just stop listening silently
        } else {
          setError(`Erro de áudio: ${event.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) {
      setError("Reconhecimento de voz não é suportado neste navegador. Por favor, digite as informações no campo.");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      setError(null);
      try {
        recognition.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const processInputWithAI = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceText: inputText,
          currentForm: currentFields
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Falha ao processar o texto com inteligência artificial.");
      }

      const updatedFields = await response.json();
      onUpdateFields(updatedFields);
      setInputText(''); // Clear on success so they can insert more comments
      
      // Visual pulse response
      const container = document.getElementById('voice-assistant-panel');
      if (container) {
        container.classList.add('ring-4', 'ring-emerald-500/30');
        setTimeout(() => container.classList.remove('ring-4', 'ring-emerald-500/30'), 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Não foi possível interpretar o texto. Tente reescrever de forma mais direta.");
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedCommands = [
    'Mudar fabricante para Lifemed, modelo smart e número de série 88990',
    'Coloca o patrimônio como 9942 e a tensão em Bivolt',
    'Desliga o switch de calibração',
    'Definir data da calibração como ontem e próxima preventiva para dezembro de 2026',
    'Nome do equipamento: Monitor Multiparamétrico Philips'
  ];

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden transition-all duration-300" id="voice-assistant-panel">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />

      {/* Header section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/20 rounded-xl text-emerald-400">
            <Sparkles className="w-4 h-4 fill-emerald-400/20" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
              Entrada Rápida Inteligente
              <span className="px-1.5 py-0.5 bg-emerald-900/40 text-[9px] font-bold text-emerald-300 rounded-full border border-emerald-800/50">VOZ + DIGITAÇÃO</span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Digite ou dite várias especificações do equipamento de uma vez só!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          title="Exemplos de instruções"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {showHelp && (
        <div className="mb-4 p-3.5 bg-slate-800/80 border border-slate-700/50 rounded-xl text-xs space-y-2 animate-fade-in">
          <p className="font-semibold text-emerald-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            O que você pode escrever ou falar?
          </p>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            A IA do OrbisTracker HU-Brasil é treinada para ler frases completas e extrair os dados diretamente para os campos certos do formulário abaixo:
          </p>
          <ul className="list-disc pl-4 space-y-1.5 text-slate-400 text-[11px]">
            {suggestedCommands.map((cmd, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    setInputText(cmd);
                    setShowHelp(false);
                  }}
                  className="text-left hover:text-white transition-colors underline decoration-slate-700 hover:decoration-emerald-500 text-slate-300"
                >
                  "{cmd}"
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-3.5 p-3 bg-red-950/40 text-red-300 border border-red-900/30 text-xs rounded-xl flex items-center gap-2">
          <Info className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Command Input Box */}
      <div className="space-y-3">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Dite pelo microfone ou digite as informações do equipamento aqui... (Ex: 'Muda o fabricante para GE, modelo V300, e número de série 9988')"
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-3.5 pr-12 text-xs text-slate-100 placeholder-slate-500 resize-none h-24 focus:outline-none transition-all leading-relaxed"
            id="fast-input-textarea"
          />
          
          {/* Microfone icon absolute within the textarea area */}
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleListening}
              id="btn-voice-assistant-mic"
              className={`p-2.5 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-600 text-white ring-4 ring-red-600/30 scale-105 shadow-md shadow-red-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105 active:scale-95'
              }`}
              title={isListening ? "Parar de ouvir" : "Ditar por voz"}
            >
              {isListening ? (
                <MicOff className="w-4 h-4 animate-pulse" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Listening status indicator */}
        {isListening && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/30 border border-red-900/20 text-[10px] font-semibold text-red-400 rounded-lg animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Microfone Ativo: fale as especificações ou correções do equipamento hospitalar...
          </div>
        )}

        {/* Send / Apply button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-mono">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Preenchimento Inteligente</span>
          </div>

          <div className="flex gap-2">
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText('')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Limpar
              </button>
            )}

            <button
              type="button"
              onClick={processInputWithAI}
              id="btn-voice-assistant-send"
              disabled={isLoading || !inputText.trim()}
              className={`px-4 py-1.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                !inputText.trim() || isLoading
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow shadow-emerald-600/10 active:scale-95'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <span>Preencher Formulário</span>
                  <Send className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
