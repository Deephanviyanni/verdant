import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Send, Paperclip, Mic, Image as ImageIcon, Square, Eye, FileText } from "lucide-react";

type Attachment = { url: string; type: "image" | "file" | "voice"; name: string; viewOnce?: boolean };

type Props = {
  onSend: (content: string, attachment?: Attachment) => void;
  onTyping: (typing: boolean) => void;
  friendId: string;
  _friendId?: string;
};

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "image/gif", "image/webp"];

export default function MessageInput({ onSend, onTyping }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTypingRef = useRef(false);

  const handleTextChange = (val: string) => {
    setText(val);
    const isTyping = val.length > 0;
    if (isTyping !== lastTypingRef.current) {
      lastTypingRef.current = isTyping;
      onTyping(isTyping);
    }
  };

  const send = () => {
    if (!text.trim() && !uploading) return;
    onSend(text.trim());
    setText("");
    if (lastTypingRef.current) {
      lastTypingRef.current = false;
      onTyping(false);
    }
  };

  const uploadFile = async (file: File, isImage: boolean, viewOnce = false): Promise<Attachment | null> => {
    if (!user) return null;
    if (!ALLOWED_FILE_TYPES.includes(file.type) && isImage) {
      alert("Only JPG, PNG, GIF, WEBP images are allowed.");
      return null;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const folder = isImage ? "images" : "files";
      const path = `${folder}/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("chat-media").upload(path, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
      return {
        url: pub.publicUrl,
        type: isImage ? "image" : "file",
        name: file.name,
        viewOnce: viewOnce,
      };
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean, viewOnce = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const att = await uploadFile(file, isImage, viewOnce);
    if (att) onSend("", att);
    e.target.value = "";
    setShowAttach(false);
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (!user) return;
        setUploading(true);
        try {
          const path = `voice/${user.id}/${Date.now()}.webm`;
          const { error } = await supabase.storage.from("chat-media").upload(path, blob);
          if (error) throw error;
          const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
          onSend("", { url: pub.publicUrl, type: "voice", name: "Voice message" });
        } catch (err) {
          alert(err instanceof Error ? err.message : "Voice upload failed");
        } finally {
          setUploading(false);
        }
      };
      recorder.start();
      setRecording(true);
      setRecordTime(0);
      recordTimerRef.current = setInterval(() => setRecordTime((t) => t + 1), 1000);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  return (
    <div className="px-4 py-3 border-t glass">
      {recording ? (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Recording... {Math.floor(recordTime / 60)}:{String(recordTime % 60).padStart(2, "0")}
          </span>
          <button onClick={stopRecording} className="ml-auto px-3 py-1.5 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center gap-1.5">
            <Square className="w-3.5 h-3.5" /> Stop & send
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {/* Attach button */}
          <div className="relative">
            <button onClick={() => setShowAttach(!showAttach)} className="btn-ghost p-2.5" disabled={uploading}>
              <Paperclip className="w-5 h-5" />
            </button>
            {showAttach && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAttach(false)} />
                <div className="absolute bottom-full mb-2 left-0 z-20 card shadow-soft py-1 min-w-[180px] animate-fade-in">
                  <button onClick={() => imageRef.current?.click()} className="w-full px-4 py-2 text-sm text-left hover:bg-ocean-50 dark:hover:bg-mist-800/40 flex items-center gap-2.5">
                    <ImageIcon className="w-4 h-4 text-ocean-500" /> Photo
                  </button>
                  <button onClick={() => { imageRef.current?.click(); }} className="w-full px-4 py-2 text-sm text-left hover:bg-ocean-50 dark:hover:bg-mist-800/40 flex items-center gap-2.5">
                    <Eye className="w-4 h-4 text-coral-500" /> View-once photo
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="w-full px-4 py-2 text-sm text-left hover:bg-ocean-50 dark:hover:bg-mist-800/40 flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-mist-500" /> Document (PDF, DOCX, ZIP)
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Text input */}
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-2xl border bg-transparent outline-none text-sm resize-none max-h-32"
            style={{ borderColor: "var(--border)" }}
          />

          {/* Voice or Send */}
          {text.trim() ? (
            <button onClick={send} disabled={uploading} className="p-2.5 rounded-full text-white transition-all hover:scale-105" style={{ background: "linear-gradient(135deg, #38bdf8, #0284c7)" }}>
              {uploading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          ) : (
            <button onClick={startRecording} disabled={uploading} className="btn-ghost p-2.5" title="Record voice message">
              {uploading ? <span className="w-5 h-5 border-2 border-ocean-500/30 border-t-ocean-500 rounded-full animate-spin" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf,.docx,.zip" className="hidden" onChange={(e) => handleFileSelect(e, false)} />
      <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(e) => handleFileSelect(e, true, false)} />
    </div>
  );
}


