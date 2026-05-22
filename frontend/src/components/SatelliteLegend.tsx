import { satelliteClassItems } from "./SatelliteLayer";

export default function SatelliteLegend() {
  return (
    <section className="panel legend">
      <h2>Легенда спутниковых классов</h2>
      <ul>
        {satelliteClassItems.map((item) => (
          <li key={item.classValue}>
            <span className="legend-swatch" style={{ backgroundColor: item.color }} />
            <span>{item.className}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
