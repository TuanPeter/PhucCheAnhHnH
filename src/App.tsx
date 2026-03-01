/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  Languages, 
  X, 
  Loader2,
  Maximize2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Global Types ---
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Types ---

type Language = 'VN' | 'EN';

type ModelOption = 'gemini-2.5-flash-image' | 'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview';

const modelDisplayNames: Record<ModelOption, string> = {
  'gemini-2.5-flash-image': 'Gemini 2.5 Flash Image',
  'gemini-3.1-flash-image-preview': 'Gemini 3 Flash Preview',
  'gemini-3-pro-image-preview': 'Gemini 3 Pro Image Preview'
};

interface Translation {
  title: string;
  subtitle: string;
  uploadLabel: string;
  uploadHint: string;
  promptPlaceholder: string;
  modelLabel: string;
  outputCountLabel: string;
  runButton: string;
  running: string;
  downloadButton: string;
  footer: string;
  noImagesError: string;
  restorationPrompt: string;
  selectKeyTitle: string;
  selectKeyDesc: string;
  selectKeyButton: string;
  billingInfo: string;
}

const translations: Record<Language, Translation> = {
  VN: {
    title: "Phục Chế Ảnh HnH",
    subtitle: "Công nghệ AI đỉnh cao giúp hồi sinh những ký ức quý giá",
    uploadLabel: "Tải ảnh lên",
    uploadHint: "Kéo thả hoặc nhấp để chọn một hoặc nhiều ảnh",
    promptPlaceholder: "Nhập thêm yêu cầu bổ sung (tùy chọn)...",
    modelLabel: "Chọn mô hình AI",
    outputCountLabel: "Số lượng kết quả",
    runButton: "Bắt đầu phục chế",
    running: "Đang xử lý...",
    downloadButton: "Tải ảnh",
    footer: "HnH Photographer",
    noImagesError: "Vui lòng tải lên ít nhất một ảnh.",
    restorationPrompt: "Hãy khôi phục ảnh cũ này. Giữ nguyên các đặc điểm khuôn mặt và biểu cảm ban đầu của người đó, không được chỉnh sửa bất cứ chi tiết gì. Tái tạo và vẽ lại các chi tiết bị thiếu hoặc bị mờ trong ảnh. Làm sạch toàn bộ ảnh (loại bỏ vết xước, vết bẩn, nhiễu) và chuyển đổi thành phiên bản màu hiện đại, đầy đủ ánh sáng, ảnh có chiều sâu và trông như là mới chụp bằng máy ảnh thời điểm hiện tại. Giữ mọi yếu tố tự nhiên, chân thật và không làm thay đổi danh tính, gương mặt, tỷ lệ gương mặt của người đó.",
    selectKeyTitle: "Yêu cầu API Key",
    selectKeyDesc: "Mô hình Gemini 3 Pro yêu cầu bạn chọn API Key trả phí của riêng mình.",
    selectKeyButton: "Chọn API Key",
    billingInfo: "Tìm hiểu về thanh toán Gemini API"
  },
  EN: {
    title: "HnH Photo Restoration",
    subtitle: "Advanced AI technology to revive your precious memories",
    uploadLabel: "Upload Photos",
    uploadHint: "Drag & drop or click to select one or multiple images",
    promptPlaceholder: "Enter additional instructions (optional)...",
    modelLabel: "Select AI Model",
    outputCountLabel: "Number of outputs",
    runButton: "Start Restoration",
    running: "Processing...",
    downloadButton: "Download",
    footer: "HnH Photographer",
    noImagesError: "Please upload at least one image.",
    restorationPrompt: "Restore this old photo. Keep the original facial features and expressions identical, do not modify any details. Reconstruct and redraw missing or blurred parts. Clean the entire photo (remove scratches, stains, noise) and convert it into a modern color version with full lighting, depth, and a look as if it was recently taken with a modern camera. Keep everything natural, authentic, and do not change the identity, face, or facial proportions of the person.",
    selectKeyTitle: "API Key Required",
    selectKeyDesc: "Gemini 3 Pro models require you to select your own paid API Key.",
    selectKeyButton: "Select API Key",
    billingInfo: "Learn about Gemini API billing"
  }
};

// --- Components ---

export default function App() {
  const [lang, setLang] = useState<Language>('VN');
  const [images, setImages] = useState<{ file: File; preview: string; base64: string }[]>([]);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ModelOption>('gemini-2.5-flash-image');
  const [outputCount, setOutputCount] = useState<1 | 2 | 3>(1);
  const [results, setResults] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const newImages = await Promise.all(
      fileArray.map(async (file: File) => {
        const preview = URL.createObjectURL(file);
        const base64 = await fileToBase64(file);
        return { file, preview, base64: base64.split(',')[1] };
      })
    );

    setImages((prev) => [...prev, ...newImages]);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleOpenSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const runRestoration = async () => {
    if (images.length === 0) {
      setError(t.noImagesError);
      return;
    }

    // Check key for Gemini 3 models
    const isGemini3 = model.startsWith('gemini-3');
    if (isGemini3 && !hasKey) {
      setError(t.selectKeyDesc);
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      // Use the selected API key if available, otherwise fallback to default
      // We check process.env.API_KEY first as it's the one injected when a user selects a key
      // Then GEMINI_API_KEY from environment, and finally the user-provided fallback
      const userFallbackKey = "AIzaSyDjinr9urhbgLO6gN-3bZVRy0F9NRZGB4w";
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || userFallbackKey;
      const ai = new GoogleGenAI({ apiKey });
      
      // We'll process images one by one or as a batch depending on the model
      // For simplicity and better results, we'll process the first image or a combined prompt
      const imageParts = images.map(img => ({
        inlineData: {
          data: img.base64,
          mimeType: img.file.type
        }
      }));

      const fullPrompt = `${t.restorationPrompt}\n\nAdditional instructions: ${prompt}`;

      const generatedResults: string[] = [];

      // Loop for output count
      for (let i = 0; i < outputCount; i++) {
        const response = await ai.models.generateContent({
          model: model,
          contents: {
            parts: [
              ...imageParts,
              { text: fullPrompt }
            ]
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "1K"
            }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            generatedResults.push(`data:image/png;base64,${part.inlineData.data}`);
          }
        }
      }

      setResults(generatedResults);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        setError("API Key error. Please re-select your key.");
      } else if (err.message?.includes("permission") || err.message?.includes("403")) {
        setError("Lỗi phân quyền (403). Vui lòng thử chọn lại API Key trả phí để tiếp tục. / Permission denied (403). Please try selecting a paid API Key to continue.");
        // If it's a permission error, maybe they need a key even for non-Gemini 3 models
        if (!hasKey) {
           // Show the key selection UI if it wasn't already shown
           setHasKey(false); 
        }
      } else {
        setError(err.message || "An error occurred during restoration.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = (base64: string) => {
    const link = document.createElement('a');
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-mm-ss
    link.href = base64;
    link.download = `(${dateStr}) ${timeStr}_HPeter.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{t.footer}</p>
            </div>
          </div>

          <button 
            onClick={() => setLang(lang === 'VN' ? 'EN' : 'VN')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm font-medium"
          >
            <Languages className="w-4 h-4" />
            {lang}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-4">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold tracking-tight text-white"
          >
            {t.subtitle}
          </motion.h2>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-8">
            {/* Upload Area */}
            <div className="space-y-4">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4" />
                {t.uploadLabel}
              </label>
              
              <div className="relative group">
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-white/10 group-hover:border-emerald-500/50 rounded-2xl p-8 transition-all bg-white/[0.02] group-hover:bg-emerald-500/[0.02] flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-6 h-6 text-zinc-400 group-hover:text-emerald-500" />
                  </div>
                  <p className="text-sm text-zinc-400">{t.uploadHint}</p>
                </div>
              </div>

              {/* Image Previews */}
              <AnimatePresence>
                {images.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-3 gap-3 pt-2"
                  >
                    {images.map((img, idx) => (
                      <motion.div 
                        key={idx}
                        layout
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group"
                      >
                        <img src={img.preview} alt="preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Prompt Input */}
            <div className="space-y-4">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Prompt
              </label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t.promptPlaceholder}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all min-h-[120px] resize-none"
              />
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                  {t.modelLabel}
                </label>
                <div className="flex flex-col gap-2">
                  {(['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'] as ModelOption[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setModel(m)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                        model === m 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      {modelDisplayNames[m]}
                      {model === m && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                  {t.outputCountLabel}
                </label>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map((count) => (
                    <button
                      key={count}
                      onClick={() => setOutputCount(count)}
                      className={`flex-1 py-3 rounded-xl border transition-all text-sm font-medium ${
                        outputCount === count 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-4">
              {(model.startsWith('gemini-3') || (error && (error.includes('403') || error.includes('Permission')))) && !hasKey ? (
                <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-amber-500">{t.selectKeyTitle}</p>
                      <p className="text-sm text-zinc-400">{t.selectKeyDesc}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleOpenSelectKey}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20"
                  >
                    {t.selectKeyButton}
                  </button>
                  <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noreferrer"
                    className="block text-center text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-4"
                  >
                    {t.billingInfo}
                  </a>
                </div>
              ) : (
                <button 
                  onClick={runRestoration}
                  disabled={isProcessing}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t.running}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                      {t.runButton}
                    </>
                  )}
                </button>
              )}
              {error && (
                <p className="mt-4 text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <div className="sticky top-32 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-500" />
                  Results
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {results.length > 0 ? (
                  results.map((res, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative bg-white/5 rounded-3xl overflow-hidden border border-white/10 aspect-square"
                    >
                      <img 
                        src={res} 
                        alt={`Result ${idx + 1}`} 
                        className="w-full h-full object-contain cursor-zoom-in"
                        onClick={() => setZoomedImage(res)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button 
                          onClick={() => setZoomedImage(res)}
                          className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl"
                        >
                          <Maximize2 className="w-6 h-6" />
                        </button>
                        <button 
                          onClick={() => downloadImage(res)}
                          className="p-3 bg-emerald-500 text-black rounded-full hover:scale-110 transition-transform shadow-xl"
                        >
                          <Download className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="absolute bottom-6 left-6">
                        <button 
                          onClick={() => downloadImage(res)}
                          className="flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-sm font-medium hover:bg-black/80 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          {t.downloadButton}
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="aspect-square rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-zinc-600 gap-4">
                    {isProcessing ? (
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-emerald-500/50" />
                        <p className="text-sm font-medium animate-pulse">{t.running}</p>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="w-16 h-16 opacity-20" />
                        <p className="text-sm">No results yet</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-white/5 text-center">
        <p className="text-sm text-zinc-500 font-medium uppercase tracking-[0.3em]">
          {t.footer}
        </p>
      </footer>

      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedImage(null)}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
          >
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={zoomedImage} 
              alt="Zoomed" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <button 
              onClick={() => setZoomedImage(null)}
              className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
