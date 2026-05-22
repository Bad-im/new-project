import { ChangeEvent } from "react";

type UploadPanelProps = {
  selectedFileName: string;
  onFileSelect: (fileName: string) => void;
  onFileChange?: (file: File | null) => void;
};

export default function UploadPanel({
  selectedFileName,
  onFileChange,
  onFileSelect,
}: UploadPanelProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onFileSelect(file?.name ?? "");
    onFileChange?.(file);
  };

  return (
    <section className="upload-panel">
      <label className="upload-zone">
        <span>Загрузить GeoTIFF</span>
        <strong>Выберите файл спутникового снимка</strong>
        <small>Ожидается 7 каналов Sentinel-2: B2, B3, B4, B5, B8, B11, B12.</small>
        <input type="file" accept=".tif,.tiff" onChange={handleFileChange} />
      </label>
      <p className="file-name">
        {selectedFileName ? `Выбран файл: ${selectedFileName}` : "Файл не выбран"}
      </p>
    </section>
  );
}
