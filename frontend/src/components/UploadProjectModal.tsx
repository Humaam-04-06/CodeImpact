import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS } from "../utils/icons";
import { uploadProjectZip, scanWorkspace, fetchHealth } from "../services/api";
import type { ProjectSample, SymbolNode } from "../types/impact";

interface UploadProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectLoaded: (sample: ProjectSample, symbols: SymbolNode[]) => void;
}

export const UploadProjectModal: React.FC<UploadProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectLoaded,
}) => {
  const [activeTab, setActiveTab] = useState<"zip" | "path">("zip");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  // Check backend server status when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      fetchHealth()
        .then(() => setIsBackendOnline(true))
        .catch(() => setIsBackendOnline(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMsg(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith(".zip")) {
        setSelectedFile(file);
        if (!projectName) {
          setProjectName(file.name.replace(/\.zip$/i, ""));
        }
      } else {
        setErrorMsg("Please upload a .zip archive file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith(".zip")) {
        setSelectedFile(file);
        if (!projectName) {
          setProjectName(file.name.replace(/\.zip$/i, ""));
        }
      } else {
        setErrorMsg("Please upload a .zip archive file.");
      }
    }
  };

  const handleUploadZip = async () => {
    if (!selectedFile) {
      setErrorMsg("Please select a .zip archive file to upload.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await uploadProjectZip(selectedFile, projectName.trim());
      if (res.success && res.sample) {
        onProjectLoaded(res.sample, res.symbols);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload and scan project archive.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanPath = async (overridePath?: string) => {
    const rawPath = overridePath || localPath;
    // Strip quotes and trim whitespace (Windows 'Copy as path' adds quotes)
    const cleanPath = rawPath.trim().replace(/^["']|["']$/g, "").trim();

    if (!cleanPath) {
      setErrorMsg("Please enter or paste a valid directory path.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await scanWorkspace(cleanPath);
      const baseName = cleanPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "Custom Project";
      const customSample: ProjectSample = {
        id: `custom_${Date.now()}`,
        name: `📁 ${baseName}`,
        language: "Auto-Detected",
        path: cleanPath.replace(/\\/g, "/"),
        description: `Local project: ${res.total_symbols} symbols, ${res.total_edges} dependencies.`
      };
      onProjectLoaded(customSample, res.symbols);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Path not found or unable to parse codebase.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-cyan-950/40 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 p-[1px] shadow-md shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <FontAwesomeIcon icon={ICONS.upload} className="text-cyan-400 text-sm" />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white m-0 tracking-tight">Upload &amp; Analyze Project</h2>
              <p className="text-xs text-slate-400 m-0">
                Direct AST dependency analysis for C#, TypeScript, JavaScript, and Python
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <FontAwesomeIcon icon={ICONS.close} className="text-sm" />
          </button>
        </div>

        {/* Backend Server Offline Alert Banner */}
        {isBackendOnline === false && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={ICONS.danger} className="text-amber-400 shrink-0" />
              <span>
                Backend server is offline! Run:{" "}
                <code className="bg-slate-950 px-1.5 py-0.5 rounded text-[11px] font-mono text-amber-200">
                  backend\venv\Scripts\python -m uvicorn backend.main:app --port 8000
                </code>
              </span>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3 gap-4">
          <button
            onClick={() => { setActiveTab("zip"); setErrorMsg(null); }}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "zip"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FontAwesomeIcon icon={ICONS.zip} className="text-xs" />
            <span>Upload ZIP Archive</span>
          </button>
          <button
            onClick={() => { setActiveTab("path"); setErrorMsg(null); }}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "path"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FontAwesomeIcon icon={ICONS.folder} className="text-xs" />
            <span>Local Machine Path</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
              <FontAwesomeIcon icon={ICONS.danger} className="text-xs shrink-0" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {activeTab === "zip" ? (
            <div className="space-y-4">
              {/* Native Accessible Drag & Drop Label */}
              <input
                id="modal-zip-input"
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="modal-zip-input"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all block ${
                  isDragging
                    ? "border-cyan-400 bg-cyan-950/20 scale-[0.99]"
                    : selectedFile
                    ? "border-emerald-500/50 bg-emerald-950/10 hover:border-emerald-400"
                    : "border-slate-700/80 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/60"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-3 text-cyan-400 shadow-inner mx-auto">
                  <FontAwesomeIcon
                    icon={selectedFile ? ICONS.check : ICONS.upload}
                    className={`text-xl ${selectedFile ? "text-emerald-400" : "text-cyan-400"}`}
                  />
                </div>

                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white m-0">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400 m-0 mt-0.5 font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
                    </p>
                    <span className="inline-block mt-2 text-[11px] text-cyan-400 underline">
                      Click to choose a different file
                    </span>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-200 m-0">
                      Drag &amp; drop your project <code className="text-cyan-400">.zip</code> here
                    </p>
                    <p className="text-xs text-slate-400 m-0 mt-1">
                      or click anywhere in this box to browse
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">C# (.cs)</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">TypeScript (.ts)</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">JavaScript (.js)</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Python (.py)</span>
                    </div>
                  </div>
                )}
              </label>

              {/* Project Name (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Project Display Name <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. My Next.js Web App or Payment Service"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Local Directory or File Path
                </label>
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="e.g. D:\Projects\MyService or C:\Users\name\Desktop\Project.zip"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono transition-colors"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Supports absolute paths, relative paths, folder paths, or direct paths to <code className="text-slate-400">.zip</code> files. Surrounding quotes from Windows "Copy as path" are automatically handled.
                </p>
              </div>

              {/* 1-Click Quick Test Buttons */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  ⚡ 1-Click Test Paths:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLocalPath("sample_projects/csharp_ecommerce");
                      handleScanPath("sample_projects/csharp_ecommerce");
                    }}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    C# E-Commerce
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalPath("sample_projects/ts_saas_api");
                      handleScanPath("sample_projects/ts_saas_api");
                    }}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    TypeScript SaaS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalPath("sample_projects/python_ai_service");
                      handleScanPath("sample_projects/python_ai_service");
                    }}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    Python AI Service
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={activeTab === "zip" ? handleUploadZip : () => handleScanPath()}
            disabled={isLoading || (activeTab === "zip" ? !selectedFile : !localPath.trim())}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-md shadow-cyan-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <FontAwesomeIcon icon={ICONS.spinner} className="animate-spin text-xs" />
                <span>Extracting &amp; Analyzing AST...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={ICONS.blastTarget} className="text-xs" />
                <span>Analyze &amp; Launch Dashboard</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
