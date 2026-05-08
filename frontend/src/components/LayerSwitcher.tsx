export type MapMode = "satellite" | "weather" | "combined";

export type MapLayerState = {
  satelliteAssessment: boolean;
  weatherForecast: boolean;
  districtBorders: boolean;
  settlements: boolean;
  roads: boolean;
  hydrography: boolean;
};

type LayerSwitcherProps = {
  mode: MapMode;
  layers: MapLayerState;
  onModeChange: (mode: MapMode) => void;
  onLayerChange: (layers: MapLayerState) => void;
};

const modes: Array<{ value: MapMode; label: string }> = [
  { value: "satellite", label: "Спутниковая оценка" },
  { value: "weather", label: "Метеопрогноз" },
  { value: "combined", label: "Комбинированный вид" },
];

const mockLayers: Array<{
  key: keyof MapLayerState;
  label: string;
  disabled?: boolean;
}> = [
  { key: "satelliteAssessment", label: "Спутниковая оценка пожароопасности" },
  { key: "weatherForecast", label: "Метеопрогноз по индексу Нестерова" },
  { key: "districtBorders", label: "Границы районов" },
  { key: "settlements", label: "Населённые пункты", disabled: true },
  { key: "roads", label: "Дороги", disabled: true },
  { key: "hydrography", label: "Гидрография", disabled: true },
];

export default function LayerSwitcher({
  mode,
  layers,
  onModeChange,
  onLayerChange,
}: LayerSwitcherProps) {
  return (
    <section className="panel">
      <h2>Режим карты</h2>
      <div className="segmented-control">
        {modes.map((item) => (
          <button
            className={mode === item.value ? "segment active" : "segment"}
            key={item.value}
            type="button"
            onClick={() => onModeChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="checkbox-group layer-list">
        {mockLayers.map((item) => (
          <label className={item.disabled ? "muted-layer" : undefined} key={item.key}>
            <input
              type="checkbox"
              checked={layers[item.key]}
              disabled={item.disabled}
              onChange={(event) =>
                onLayerChange({ ...layers, [item.key]: event.target.checked })
              }
            />
            {item.label}
          </label>
        ))}
      </div>
    </section>
  );
}
