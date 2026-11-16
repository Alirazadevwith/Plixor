import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/api";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt,.md";

// Mirrors backend ExtractionStatus. Anything other than `ok` is shown to the
// student: a document we could not read must never be graded as a blank page
// without them knowing.
const STATUS_COPY = {
  ok: { tone: "good", text: "Text read successfully — this is what will be graded." },
  no_text: {
    tone: "bad",
    text: "We couldn't read any text from this file. If it's a scan or a photo, the words are an image — please upload a version with selectable text.",
  },
  unsupported: { tone: "bad", text: "That file type can't be read. Use PDF, Word (.docx) or a text file." },
  too_large: { tone: "bad", text: "That file is larger than 10 MB." },
  failed: { tone: "bad", text: "We couldn't open that file. It may be corrupt — try re-saving it." },
};

const TONES = {
  good: { bg: "#F0FFF4", border: "#C6F6D5", color: "#276749" },
  bad: { bg: "#FFF5F5", border: "#FED7D7", color: "#C53030" },
  busy: { bg: "#EBF4FF", border: "#BEE3F8", color: "#2C5F8A" },
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Notice = ({ tone, children }) => {
  const t = TONES[tone] || TONES.busy;
  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 6,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
};

const AnswerAttachment = ({ submissionId, questionId, disabled = false, onAttachmentChange }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [attachment, setAttachment] = useState(null);
  const [localError, setLocalError] = useState("");

  const endpoint = `/submissions/${submissionId}/answers/${questionId}/attachment`;

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post(endpoint, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setAttachment(data);
      setLocalError("");
      onAttachmentChange?.(data.extraction_status === "ok");
      queryClient.invalidateQueries({ queryKey: ["exam-questions"] });
    },
    onError: (err) => {
      setLocalError(
        err.response?.data?.detail || "Upload failed. Check your connection and try again."
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      await api.delete(endpoint);
    },
    onSuccess: () => {
      setAttachment(null);
      setLocalError("");
      onAttachmentChange?.(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => {
      setLocalError(err.response?.data?.detail || "Could not remove the file.");
    },
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Mirrors the server's limit so a 50 MB file is refused before it is sent.
    if (file.size > MAX_BYTES) {
      setLocalError(`That file is ${formatSize(file.size)}. The limit is 10 MB.`);
      e.target.value = "";
      return;
    }
    setLocalError("");
    uploadMutation.mutate(file);
  };

  const statusCopy = attachment ? STATUS_COPY[attachment.extraction_status] : null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        border: "1px dashed #CBD5E0",
        borderRadius: 8,
        background: "#FAFBFC",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A202C", marginBottom: 4 }}>
        Attach your work
      </div>
      <div style={{ fontSize: 12, color: "#718096", marginBottom: 12 }}>
        PDF, Word (.docx) or text, up to 10 MB. Optional — you can also just type above.
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFileChange}
        disabled={disabled || uploadMutation.isPending}
        style={{ fontSize: 13, color: "#4A5568" }}
      />

      {uploadMutation.isPending && <Notice tone="busy">Reading your document…</Notice>}

      {attachment && !uploadMutation.isPending && (
        <>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 6,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1A202C",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {attachment.filename}
              </div>
              <div style={{ fontSize: 11, color: "#718096" }}>
                {formatSize(attachment.size_bytes)}
                {attachment.extracted_char_count > 0 &&
                  ` · ${attachment.extracted_char_count.toLocaleString()} characters read`}
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeMutation.mutate()}
                disabled={removeMutation.isPending}
                style={{
                  flexShrink: 0,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #FED7D7",
                  background: "#FFFFFF",
                  color: "#C53030",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: removeMutation.isPending ? "wait" : "pointer",
                }}
              >
                Remove
              </button>
            )}
          </div>

          {statusCopy && <Notice tone={statusCopy.tone}>{statusCopy.text}</Notice>}
        </>
      )}

      {localError && <Notice tone="bad">{localError}</Notice>}
    </div>
  );
};

export default AnswerAttachment;
