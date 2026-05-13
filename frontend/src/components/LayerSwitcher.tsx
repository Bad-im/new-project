export type MapMode = "satellite" | "weather";

type LayerSwitcherProps = {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
};

const modes: Array<{ value: MapMode; label: string }> = [
  { value: "satellite", label: "Спутниковая оценка" },
  { value: "weather", label: "Метеопрогноз" },
];

export default function LayerSwitcher({
  mode,
  onModeChange,
}: LayerSwitcherProps) {
  return (
    <section className="panel">
      <h2>Режим отображения</h2>
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
    </section>
  );
}
