import { weatherClassItems } from "./WeatherLayer";

export default function WeatherLegend() {
  return (
    <section className="panel legend">
      <h2>Уровни пожарной опасности</h2>
      <ul>
        {weatherClassItems.map((item) => (
          <li key={item.classValue}>
            <span className="legend-swatch" style={{ backgroundColor: item.color }} />
            <span>
              {item.classValue} - {item.className}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
