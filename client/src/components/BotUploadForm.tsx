import { type InboundMessage, MAX_BOT_SOURCE_BYTES } from "@arena/shared";
import { useCallback, useState } from "react";
import { validateBotArtifact } from "../sandbox/validateBotArtifact";

export interface BotUploadFormProps {
  send: (message: InboundMessage) => void;
}

interface UploadError {
  fileName: string;
  reason: string;
}

export function BotUploadForm({ send }: BotUploadFormProps) {
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BOT_SOURCE_BYTES) {
        setErrors((prev) => [
          ...prev,
          { fileName: file.name, reason: "Datei zu groß (Maximum 200 KB)." },
        ]);
        return;
      }

      const sourceCode = await file.text();
      const validation = await validateBotArtifact(sourceCode, file.name);

      if (!validation.valid) {
        setErrors((prev) => [...prev, { fileName: file.name, reason: validation.reason }]);
        return;
      }

      send({
        type: "bot-add",
        name: validation.name,
        author: validation.author,
        color: validation.color,
        sourceCode,
      });
    },
    [send]
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      setErrors([]);
      await Promise.all(Array.from(files).map(processFile));
      setIsUploading(false);
      event.target.value = "";
    },
    [processFile]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      setErrors([]);
      await Promise.all(Array.from(files).map(processFile));
      setIsUploading(false);
    },
    [processFile]
  );

  return (
    <div className="bot-upload-form">
      <label
        className="bot-upload-form__dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".js"
          multiple
          disabled={isUploading}
          onChange={handleFileChange}
          className="bot-upload-form__input"
        />
        {isUploading ? "Bots werden geprüft…" : ".js-Dateien auswählen oder hierher ziehen"}
      </label>

      {errors.length > 0 && (
        <ul className="bot-upload-form__errors">
          {errors.map((error, index) => (
            <li key={`${error.fileName}-${index}`}>
              <strong>{error.fileName}</strong>: {error.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
