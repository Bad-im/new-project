import { ChangeEvent } from "react";

type UploadPanelProps = {
  selectedFileName: string;
  onFileSelect: (fileName: string) => void;
};

export default function UploadPanel({ selectedFileName, onFileSelect }: UploadPanelProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(event.target.files?.[0]?.name ?? "");
  };

  return (
    <section className="upload-panel">
      <label className="upload-zone">
        <span>Загрузить GeoTIFF</span>
        <strong>Выберите файл спутникового снимка</strong>
        <small>На текущем этапе файл не обрабатывается, имя используется для сценария анализа.</small>
        <input type="file" accept=".tif,.tiff,.geotiff" onChange={handleFileChange} />
      </label>
      <p className="file-name">
        {selectedFileName ? `Выбран файл: ${selectedFileName}` : "Файл не выбран"}
      </p>
    </section>
  );
}
